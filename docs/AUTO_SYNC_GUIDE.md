# Hướng Dẫn Cài Đặt, Vận Hành & Kiểm Thử Module Automatic Lottery API Synchronization

## 1. Kiến Trúc & Lịch Trình Đồng Bộ (`Asia/Ho_Chi_Minh`)

Hệ thống đồng bộ tự động hoạt động theo múi giờ chuẩn **`Asia/Ho_Chi_Minh`** (UTC+7), bắt đầu trước giờ quay chính thức **15 phút** và polling mỗi **30 giây** cho đến khi đủ toàn bộ giải (kèm bước kiểm tra xác minh lần cuối) hoặc hết khung giờ:

| Miền | Bắt đầu đồng bộ (trước 15p) | Giờ quay chính thức | Dừng khi hết giờ | Cơ cấu giải xác minh hoàn tất |
| :--- | :--- | :--- | :--- | :--- |
| **Miền Nam (XSMN)** | `16:00` | `16:15` | `16:50` | 18 giải / đài (G8 → ĐB) |
| **Miền Trung (XSMT)** | `17:00` | `17:15` | `17:50` | 18 giải / đài (G8 → ĐB) |
| **Miền Bắc (XSMB)** | `18:00` | `18:15` | `18:45` | 27 giải (ĐB → G7) |

### Quy trình xử lý mỗi chu kỳ:
1. **Chống chạy đồng thời (Concurrency Lock)**: Khóa theo cặp `(region, drawDate)` cả trong bộ nhớ (`inFlightSyncLocks`) và lease 45 giây trong bảng `sync_sessions` (`locked_by`, `locked_until`).
2. **Giới hạn tốc độ (Rate Limiter)**: Sliding-window 60 giây theo từng nhà cung cấp (`api_providers.rate_limit_per_min`, mặc định 30 req/phút).
3. **Cập nhật từng giải (Incremental Update)**: Không đợi đủ 100% giải; bất kỳ giải nào hợp lệ vừa mở sẽ được lưu trạng thái `PARTIAL` ngay lập tức và xóa cache.
4. **Chống trùng lặp & cập nhật bản ghi thay đổi**: Tính SHA-256 (`payload_hash`); nếu dữ liệu giống hệt sẽ bỏ qua (`SKIPPED_DUPLICATE`), nếu có giải mới hoặc số thay đổi sẽ cập nhật bản ghi cũ và tăng `version`.
5. **Không tự tạo kết quả giả**: Khi API chưa có dữ liệu hoặc lỗi mạng, hệ thống ghi log `NO_DATA_YET` / `RETRY` / `FAILED`, tuyệt đối không sinh dữ liệu giả cho ngày quay hiện tại.
6. **Xác minh lần cuối (`VERIFYING` → `COMPLETED`)**: Khi đủ 18/18 (MN/MT) hoặc 27/27 (MB) giải, hệ thống gọi API kiểm tra lại lần cuối để đối chiếu tính nhất quán trước khi đánh dấu `is_verified = true` và `sync_status = 'COMPLETED'`, sau đó tự động dừng đồng bộ.

---

## 2. Database Migration (PostgreSQL)

Tệp migration SQL nằm tại: `drizzle/0001_auto_sync_module.sql`.

Chạy migration bằng `psql` (hoặc Drizzle `drizzle-kit push`):

```bash
psql "$DATABASE_URL" -f drizzle/0001_auto_sync_module.sql
```

Các bảng liên quan:
- `lottery_results`: Bổ sung `sync_status`, `prizes_found`, `prizes_expected`, `payload_hash`, `version`, `verified_at`.
- `api_providers`: Bổ sung `adapter_type`, `auth_header`, `rate_limit_per_min`.
- `sync_logs`: Bổ sung `sync_mode`, `endpoint_url`, `http_status`, `prizes_found`, `prizes_expected`.
- `sync_sessions`: Bảng mới quản lý phiên đồng bộ theo ngày/miền, lock phân tán và trạng thái tự động dừng.

---

## 3. Biến Môi Trường Backend (`.env`)

Không bao giờ lưu API Key trong code frontend hoặc database công khai. Khai báo biến môi trường trên server:

```env
# Bật scheduler nội bộ 30s (đặt "false" nếu chỉ chạy qua Google Cloud Scheduler)
AUTO_SYNC_ENABLED="true"

# Secret dùng để xác thực Google Cloud Scheduler gọi POST /api/cron/sync
CRON_SYNC_SECRET="thay-bang-chuoi-bi-mat-32-ky-tu"

# Cấu hình nguồn API & API Key trên backend (nếu nhà cung cấp yêu cầu)
XOSOVNM_BASE_URL="https://api.xosovnm.net/api"
XOSOVNM_API_KEY=""
LOTTERY_SECONDARY_API_KEY=""
```

Trong trang **Quản trị (`/admin`) → Nguồn API & Đồng bộ**, bạn chỉ điền **tên biến môi trường** (ví dụ `LOTTERY_SECONDARY_API_KEY`) vào trường `ENV Secret Name`.

---

## 4. Triển Khai Trên VPS vs Google Cloud Run

### Phương án A: VPS / Dedicated Server (Chạy thường trực)
Đặt `AUTO_SYNC_ENABLED="true"`. Backend Node.js (`server.ts`) tự động chạy vòng lặp 30 giây kiểm tra khung giờ `Asia/Ho_Chi_Minh`. Khuyên dùng PM2 để tự khởi động lại khi server reboot:

```bash
npm install
npm run build
NODE_ENV=production pm2 start npm --name "xosothantai1" -- start
pm2 save
```

*(Tùy chọn Crontab bổ sung nếu muốn kích hoạt thủ công từ hệ điều hành mỗi phút trong khung giờ 16h-19h giờ Việt Nam)*:
```cron
TZ=Asia/Ho_Chi_Minh
* 16-18 * * * curl -s -X POST -H "X-Cron-Secret: $CRON_SYNC_SECRET" http://127.0.0.1:3000/api/cron/sync > /dev/null
```

### Phương án B: Google Cloud Run + Google Cloud Scheduler
Trên Cloud Run, container có thể scale-to-zero khi không có traffic, nên bạn dùng **Google Cloud Scheduler** gọi endpoint đồng bộ:

1. Đặt biến môi trường trên Cloud Run:
   - `AUTO_SYNC_ENABLED="false"` (hoặc `"true"` nếu đặt `min-instances=1`)
   - `CRON_SYNC_SECRET="<SECRET_CUA_BAN>"`
2. Tạo Cloud Scheduler jobs theo múi giờ `Asia/Ho_Chi_Minh` (`* 16-18 * * *` chạy mỗi phút trong khung giờ quay, hoặc 2 job lệch pha 30s):

```bash
# Job chính: chạy mỗi phút trong khung 16:00 - 18:59 giờ Việt Nam
gcloud scheduler jobs create http xoso-auto-sync-vn \
  --location=asia-southeast1 \
  --schedule="* 16-18 * * *" \
  --time-zone="Asia/Ho_Chi_Minh" \
  --uri="https://<YOUR_CLOUD_RUN_URL>/api/cron/sync" \
  --http-method=POST \
  --headers="Content-Type=application/json,X-Cron-Secret=<CRON_SYNC_SECRET>" \
  --message-body='{}'
```

*(Nếu muốn tần suất 30 giây/lần trên Cloud Scheduler, tạo thêm 1 job Cloud Tasks hoặc script kích hoạt mỗi 30 giây; lock phân tán trong `sync_sessions` đảm bảo không bao giờ chạy trùng).*

---

## 5. Hướng Dẫn Kiểm Thử (Testing)

1. **Kiểm tra trạng thái hệ thống & khóa đồng bộ**:
   ```bash
   curl -s -H "X-Cron-Secret: <CRON_SYNC_SECRET>" http://localhost:3000/api/cron/status | jq .
   ```
2. **Kiểm tra endpoint đồng bộ Cloud Scheduler theo miền & ngày**:
   ```bash
   curl -s -X POST http://localhost:3000/api/cron/sync \
     -H "Content-Type: application/json" \
     -H "X-Cron-Secret: <CRON_SYNC_SECRET>" \
     -d '{"region":"MB","date":"2026-11-14","force":true}' | jq .
   ```
3. **Kiểm tra chống chạy đồng thời (Concurrency Lock)**:
   Gọi song song 2 request `POST /api/cron/sync` cùng lúc — 1 request xử lý bình thường, request thứ 2 sẽ trả về `status: "LOCKED_SKIPPED"`.
4. **Kiểm tra không tự sinh dữ liệu giả cho ngày chưa quay**:
   Truy vấn `GET /api/results?date=2099-01-01` hoặc ngày hôm nay khi API chưa có dữ liệu → trả về `count: 0` (hoặc chỉ các giải đã mở `PARTIAL`).
5. **Kiểm tra trên giao diện Admin**:
   Đăng nhập `/admin` → chọn tab **Nguồn API & Đồng bộ** để theo dõi đồng hồ `Asia/Ho_Chi_Minh`, trạng thái 3 phiên (`PENDING`, `RUNNING`, `COMPLETED`, `TIMEOUT_STOPPED`), tiến độ `prizesFound/prizesExpected` của từng đài và nhật ký `sync_logs` tự động làm mới mỗi 10 giây.
