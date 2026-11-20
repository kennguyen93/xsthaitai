import { StatCategoryId } from '../types/lottery';

export interface StatCategoryItem {
  id: StatCategoryId;
  label: string;
  shortLabel: string;
  description: string;
}

export const STAT_DROPDOWN_ITEMS: StatCategoryItem[] = [
  {
    id: 'loto-gan',
    label: 'Thống kê Loto gan',
    shortLabel: 'Loto gan',
    description: 'Các cặp số 00–99 lâu ngày chưa về và gan cực đại theo lịch sử quay thưởng.',
  },
  {
    id: 'giai-dac-biet',
    label: 'TK giải Đặc biệt',
    shortLabel: 'Giải Đặc biệt',
    description: 'Bảng chi tiết giải Đặc biệt, 2 số cuối, đầu – đuôi và tổng đề qua các kỳ.',
  },
  {
    id: 'tong-hop',
    label: 'Thống kê tổng hợp',
    shortLabel: 'Tổng hợp',
    description: 'Tổng quan nhanh loto gan, về nhiều, đầu đuôi nổi bật và biểu đồ theo tháng.',
  },
  {
    id: 'dau-duoi',
    label: 'Thống kê Đầu - Đuôi',
    shortLabel: 'Đầu - Đuôi',
    description: 'Phân bổ tần suất chữ số Đầu và Đuôi (0–9) cho toàn bộ giải và giải Đặc biệt.',
  },
  {
    id: 'tan-suat-xuat-hien',
    label: 'Tần suất xuất hiện',
    shortLabel: 'Tần suất xuất hiện',
    description: 'Bảng xếp hạng tần suất xuất hiện của 100 cặp số từ cao đến thấp.',
  },
  {
    id: 'tu-00-den-99',
    label: 'TK từ 00 đến 99',
    shortLabel: '00 đến 99',
    description: 'Toàn bộ 100 cặp số từ 00 đến 99 kèm số lượt về và số ngày gan hiện tại.',
  },
  {
    id: 'cap-cung-ve',
    label: 'Thống kê cặp loto cùng về XSMB',
    shortLabel: 'Cặp cùng về',
    description: 'Những cặp 2 bộ số thường xuyên xuất hiện đồng thời trong cùng một kỳ quay.',
  },
  {
    id: 'loto-kep',
    label: 'Thống kê loto kép',
    shortLabel: 'Loto kép',
    description: 'Thống kê chi tiết nhóm loto kép bằng (00–99) và kép lệch trong lịch sử.',
  },
  {
    id: 'tan-suat-loto',
    label: 'Thống kê tần suất loto',
    shortLabel: 'Tần suất loto',
    description: 'Bảng ma trận theo dõi sự xuất hiện của các bộ số qua từng ngày gần nhất.',
  },
  {
    id: 'tan-suat-cap-loto',
    label: 'Thống kê tần suất cặp loto',
    shortLabel: 'Tần suất cặp loto',
    description: 'Thống kê 45 cặp loto đối xứng (AB – BA) về nhiều và ngày gan chung của cặp.',
  },
  {
    id: 'dac-biet-ngay-mai',
    label: 'Thống kê giải đặc biệt ngày mai',
    shortLabel: 'ĐB ngày mai',
    description: 'Đối chiếu lịch sử những kỳ quay kế tiếp ngay sau khi giải ĐB về số gần nhất.',
  },
];
