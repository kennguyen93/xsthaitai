import React, { useEffect, useMemo, useState } from 'react';
import { BarChart3, Search } from 'lucide-react';
import { DREAM_BOOK_ENTRIES } from '../data/dreamBook';
import { fetchStatistics, ServerStatisticsData } from '../services/apiClient';
import { RegionKey } from '../types/lottery';
import { formatDateVN } from '../utils/lotteryEngine';

interface StatisticsViewProps {
  selectedDate: string;
}

const TIME_WINDOWS = [
  { days: 7, label: '7 ngày' },
  { days: 30, label: '30 ngày' },
  { days: 90, label: '90 ngày' },
  { days: 365, label: '1 năm' },
  { days: 1095, label: '3 năm' },
  { days: 1825, label: '5 năm' },
  { days: 3650, label: '10 năm' },
];

export const StatisticsView: React.FC<StatisticsViewProps> = ({ selectedDate }) => {
  const [region, setRegion] = useState<RegionKey>('MB');
  const [daysWindow, setDaysWindow] = useState<number>(30);
  const [subTab, setSubTab] = useState<
    'logan' | 'tansuat' | 'dauduoi' | 'dacbiet' | 'charts' | 'somo'
  >('logan');
  const [dreamQuery, setDreamQuery] = useState('');
  const [data, setData] = useState<ServerStatisticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetchStatistics(selectedDate, region, daysWindow)
      .then((res) => setData(res))
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : 'Không thể tải thống kê.')
      )
      .finally(() => setLoading(false));
  }, [selectedDate, region, daysWindow]);

  const filteredDreams = useMemo(() => {
    const q = dreamQuery.trim().toLowerCase();
    if (!q) return DREAM_BOOK_ENTRIES;
    return DREAM_BOOK_ENTRIES.filter(
      (d) =>
        d.keyword.toLowerCase().includes(q) ||
        d.category.toLowerCase().includes(q) ||
        d.numbers.some((n) => n.includes(q))
    );
  }, [dreamQuery]);

  const maxHeadTailVal = useMemo(() => {
    if (!data) return 1;
    return Math.max(
      1,
      ...data.headTail.map((h) => Math.max(h.headCount, h.tailCount))
    );
  }, [data]);

  const maxMonthlyDraws = useMemo(() => {
    if (!data || data.monthlySeries.length === 0) return 1;
    return Math.max(1, ...data.monthlySeries.map((m) => m.draws));
  }, [data]);

  return (
    <div className="space-y-5">
      <section className="bg-white border border-slate-200 rounded-lg p-4 sm:p-5">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              Thống Kê Xổ Số &amp; Phân Tích Dữ Liệu Lịch Sử (7 Ngày – 10 Năm)
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              {data
                ? `Đã phân tích ${data.actualDrawsAnalyzed.toLocaleString('vi-VN')} kỳ quay (${formatDateVN(
                    data.dateFrom
                  )} – ${formatDateVN(data.dateTo)})`
                : `Tính đến ngày ${formatDateVN(selectedDate)}`}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-md">
              {(
                [
                  { id: 'MB', label: 'Miền Bắc' },
                  { id: 'MN', label: 'Miền Nam' },
                  { id: 'MT', label: 'Miền Trung' },
                ] as { id: RegionKey; label: string }[]
              ).map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setRegion(r.id)}
                  className={`px-2.5 py-1 text-xs font-semibold rounded cursor-pointer ${
                    region === r.id
                      ? 'bg-white text-[#C8102E] shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Time Window Buttons (7d, 30d, 90d, 1y, 3y, 5y, 10y) */}
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-semibold text-slate-500 mr-1">Khoảng thời gian:</span>
          {TIME_WINDOWS.map((w) => (
            <button
              key={w.days}
              type="button"
              onClick={() => setDaysWindow(w.days)}
              className={`px-2.5 py-1 text-xs font-medium rounded border transition-colors cursor-pointer ${
                daysWindow === w.days
                  ? 'bg-[#C8102E] text-white border-[#C8102E]'
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              {w.label}
            </button>
          ))}
        </div>

        {/* Sub-tabs */}
        <div className="mt-4 flex items-center gap-1 border-b border-slate-200 overflow-x-auto">
          {(
            [
              { id: 'logan', label: 'Lô Gan & Về Nhiều' },
              { id: 'tansuat', label: 'Tần Suất 00–99' },
              { id: 'dauduoi', label: 'Đầu & Đuôi (0–9)' },
              { id: 'dacbiet', label: 'Giải Đặc Biệt' },
              { id: 'charts', label: 'Biểu Đồ Lịch Sử' },
              { id: 'somo', label: 'Sổ Mơ' },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setSubTab(t.id)}
              className={`px-3.5 py-2 text-xs sm:text-sm font-semibold border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                subTab === t.id
                  ? 'border-[#C8102E] text-[#C8102E]'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {loading && subTab !== 'somo' && (
          <div className="py-12 text-center text-sm text-slate-500">
            Đang tổng hợp thống kê từ cơ sở dữ liệu PostgreSQL...
          </div>
        )}

        {error && subTab !== 'somo' && (
          <div className="mt-4 p-4 rounded bg-red-50 border border-red-200 text-sm text-red-800">
            {error}
          </div>
        )}

        {!loading && !error && data && subTab === 'logan' && (
          <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div>
              <h3 className="text-sm font-bold text-slate-800 mb-2">
                Top 20 Cặp Số Lâu Chưa Về (Lô Gan)
              </h3>
              <table className="w-full text-xs sm:text-sm border border-slate-200 border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-700">
                    <th className="py-2 px-2.5 text-center font-semibold">Bộ số</th>
                    <th className="py-2 px-2.5 text-right font-semibold">Chưa về</th>
                    <th className="py-2 px-2.5 text-right font-semibold">Gan cực đại</th>
                    <th className="py-2 px-2.5 text-right font-semibold">Về gần nhất</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {data.topLoGan.map((item) => (
                    <tr key={item.pair} className="hover:bg-slate-50">
                      <td className="py-2 px-2.5 text-center font-lottery font-bold text-[#C8102E]">
                        {item.pair}
                      </td>
                      <td className="py-2 px-2.5 text-right font-lottery font-bold text-slate-900">
                        {item.daysSinceLast} ngày
                      </td>
                      <td className="py-2 px-2.5 text-right font-lottery text-slate-600">
                        {item.maxGap} ngày
                      </td>
                      <td className="py-2 px-2.5 text-right font-lottery text-slate-500">
                        {item.lastSeenDate === 'Chưa về'
                          ? 'Chưa về'
                          : formatDateVN(item.lastSeenDate)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div>
              <h3 className="text-sm font-bold text-slate-800 mb-2">
                Top 20 Bộ Số Về Nhiều Nhất
              </h3>
              <table className="w-full text-xs sm:text-sm border border-slate-200 border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-700">
                    <th className="py-2 px-2.5 text-center font-semibold">Bộ số</th>
                    <th className="py-2 px-2.5 text-right font-semibold">Số lần về</th>
                    <th className="py-2 px-2.5 text-left font-semibold">Mật độ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {data.topHot.map((item) => {
                    const maxCount = data.topHot[0]?.count || 1;
                    const pct = Math.round((item.count / maxCount) * 100);
                    return (
                      <tr key={item.pair} className="hover:bg-slate-50">
                        <td className="py-2 px-2.5 text-center font-lottery font-bold text-slate-900">
                          {item.pair}
                        </td>
                        <td className="py-2 px-2.5 text-right font-lottery font-semibold text-[#C8102E]">
                          {item.count} lượt
                        </td>
                        <td className="py-2 px-2.5">
                          <div className="h-2 w-full bg-slate-100 rounded overflow-hidden">
                            <div
                              className="h-full bg-[#C8102E]"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {!loading && !error && data && subTab === 'tansuat' && (
          <div className="mt-4">
            <p className="text-xs text-slate-500 mb-3">
              Tần suất xuất hiện của toàn bộ 100 cặp số (00 đến 99) trong {data.actualDaysCovered} ngày có dữ liệu.
            </p>
            <div className="grid grid-cols-5 sm:grid-cols-10 gap-1.5">
              {data.pairs.map((item) => {
                const avg =
                  data.pairs.reduce((acc, p) => acc + p.count, 0) / 100 || 1;
                const isHot = item.count > avg * 1.15;
                return (
                  <div
                    key={item.pair}
                    className={`p-2 border rounded text-center ${
                      isHot
                        ? 'bg-red-50 border-red-200'
                        : 'bg-white border-slate-200'
                    }`}
                  >
                    <div
                      className={`font-lottery text-sm font-bold ${
                        isHot ? 'text-[#C8102E]' : 'text-slate-900'
                      }`}
                    >
                      {item.pair}
                    </div>
                    <div className="font-lottery text-[11px] text-slate-500 mt-0.5">
                      {item.count} lần
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {!loading && !error && data && subTab === 'dauduoi' && (
          <div className="mt-4 space-y-4">
            <h3 className="text-sm font-bold text-slate-800">
              Thống Kê Đầu – Đuôi Toàn Bộ Các Giải &amp; Giải Đặc Biệt (0–9)
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs sm:text-sm border border-slate-200 border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-700">
                    <th className="py-2 px-3 text-center font-bold">Chữ số</th>
                    <th className="py-2 px-3 text-right font-semibold">Đầu (Lô tô)</th>
                    <th className="py-2 px-3 text-right font-semibold">Đuôi (Lô tô)</th>
                    <th className="py-2 px-3 text-right font-semibold text-[#C8102E]">
                      Đầu ĐB
                    </th>
                    <th className="py-2 px-3 text-right font-semibold text-[#C8102E]">
                      Đuôi ĐB
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {data.headTail.map((row) => (
                    <tr key={row.digit} className="hover:bg-slate-50">
                      <td className="py-2 px-3 text-center font-lottery font-bold text-slate-900 bg-slate-50">
                        {row.digit}
                      </td>
                      <td className="py-2 px-3 text-right font-lottery">
                        {row.headCount.toLocaleString('vi-VN')}
                      </td>
                      <td className="py-2 px-3 text-right font-lottery">
                        {row.tailCount.toLocaleString('vi-VN')}
                      </td>
                      <td className="py-2 px-3 text-right font-lottery font-bold text-[#C8102E]">
                        {row.specialHeadCount.toLocaleString('vi-VN')}
                      </td>
                      <td className="py-2 px-3 text-right font-lottery font-bold text-[#C8102E]">
                        {row.specialTailCount.toLocaleString('vi-VN')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {!loading && !error && data && subTab === 'dacbiet' && (
          <div className="mt-4">
            <h3 className="text-sm font-bold text-slate-800 mb-2">
              Bảng Thống Kê Giải Đặc Biệt Gần Nhất ({data.specialHistory.length} kỳ)
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs sm:text-sm border border-slate-200 border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-700">
                    <th className="py-2 px-3 text-left font-semibold">Ngày quay</th>
                    <th className="py-2 px-3 text-left font-semibold">Đài / Tỉnh</th>
                    <th className="py-2 px-3 text-center font-semibold">Giải ĐB</th>
                    <th className="py-2 px-3 text-center font-semibold">2 số cuối</th>
                    <th className="py-2 px-3 text-right font-semibold">Tổng đề</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {data.specialHistory.map((item, idx) => (
                    <tr key={`${item.drawDate}-${item.provinceCode}-${idx}`} className="hover:bg-slate-50">
                      <td className="py-2 px-3 font-lottery text-slate-700">
                        {formatDateVN(item.drawDate)}
                      </td>
                      <td className="py-2 px-3 font-medium text-slate-900">
                        {item.provinceName}
                      </td>
                      <td className="py-2 px-3 text-center font-lottery font-bold text-[#C8102E]">
                        {item.specialNumber}
                      </td>
                      <td className="py-2 px-3 text-center font-lottery font-bold text-slate-900">
                        {item.specialTail}
                      </td>
                      <td className="py-2 px-3 text-right font-lottery text-slate-600">
                        {item.sum}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {!loading && !error && data && subTab === 'charts' && (
          <div className="mt-4 space-y-6">
            {/* SVG Chart 1: Head vs Tail 0-9 */}
            <div className="border border-slate-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-[#C8102E]" />
                  Biểu Đồ Phân Bổ Đầu (Đỏ) &amp; Đuôi (Xám Đậm) Theo Chữ Số 0–9
                </h3>
              </div>
              <div className="w-full overflow-x-auto">
                <svg viewBox="0 0 600 220" className="w-full min-w-[460px] h-52">
                  {data.headTail.map((item, idx) => {
                    const xBase = 24 + idx * 56;
                    const hHeight = Math.round((item.headCount / maxHeadTailVal) * 145);
                    const tHeight = Math.round((item.tailCount / maxHeadTailVal) * 145);
                    return (
                      <g key={item.digit}>
                        <rect
                          x={xBase}
                          y={175 - hHeight}
                          width={18}
                          height={Math.max(4, hHeight)}
                          rx={2}
                          fill="#C8102E"
                        />
                        <rect
                          x={xBase + 21}
                          y={175 - tHeight}
                          width={18}
                          height={Math.max(4, tHeight)}
                          rx={2}
                          fill="#334155"
                        />
                        <text
                          x={xBase + 19}
                          y={196}
                          textAnchor="middle"
                          className="fill-slate-700 text-[12px] font-bold"
                        >
                          {item.digit}
                        </text>
                        <text
                          x={xBase + 9}
                          y={170 - hHeight}
                          textAnchor="middle"
                          className="fill-slate-500 text-[9px]"
                        >
                          {item.headCount}
                        </text>
                      </g>
                    );
                  })}
                  <line x1="15" y1="176" x2="585" y2="176" stroke="#CBD5E1" strokeWidth="1" />
                </svg>
              </div>
            </div>

            {/* SVG Chart 2: Monthly Historical Volume & Avg Special Sum */}
            <div className="border border-slate-200 rounded-lg p-4">
              <h3 className="text-sm font-bold text-slate-900 mb-3">
                Biểu Đồ Số Kỳ Quay Theo Tháng (24 Tháng Gần Nhất Trong Khoảng Đã Chọn)
              </h3>
              {data.monthlySeries.length === 0 ? (
                <p className="text-xs text-slate-500">Chưa có dữ liệu chuỗi tháng.</p>
              ) : (
                <div className="space-y-2">
                  {data.monthlySeries.map((m) => {
                    const widthPct = Math.max(4, Math.round((m.draws / maxMonthlyDraws) * 100));
                    return (
                      <div key={m.month} className="grid grid-cols-12 items-center gap-2 text-xs">
                        <div className="col-span-3 sm:col-span-2 font-lottery font-semibold text-slate-700">
                          {m.month}
                        </div>
                        <div className="col-span-6 sm:col-span-7">
                          <div className="h-3.5 bg-slate-100 rounded overflow-hidden">
                            <div
                              className="h-full bg-[#C8102E]"
                              style={{ width: `${widthPct}%` }}
                            />
                          </div>
                        </div>
                        <div className="col-span-3 text-right font-lottery text-slate-600">
                          {m.draws} kỳ · Đề TB: {m.avgSpecialSum}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {subTab === 'somo' && (
          <div className="mt-4 space-y-3">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={dreamQuery}
                onChange={(e) => setDreamQuery(e.target.value)}
                placeholder="Tìm kiếm giấc mơ (ví dụ: rắn, cá chép, tiền, nước, vàng...)"
                className="w-full pl-9 pr-4 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:border-[#C8102E]"
              />
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs sm:text-sm border border-slate-200 border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-700">
                    <th className="py-2 px-3 text-left font-semibold">Nội dung giấc mơ</th>
                    <th className="py-2 px-3 text-left font-semibold">Nhóm</th>
                    <th className="py-2 px-3 text-right font-semibold">Bộ số tham khảo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredDreams.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="py-6 text-center text-slate-500">
                        Không tìm thấy mục phù hợp với từ khóa "{dreamQuery}".
                      </td>
                    </tr>
                  ) : (
                    filteredDreams.map((entry) => (
                      <tr key={entry.id} className="hover:bg-slate-50">
                        <td className="py-2.5 px-3 font-medium text-slate-900">
                          {entry.keyword}
                        </td>
                        <td className="py-2.5 px-3 text-slate-500">{entry.category}</td>
                        <td className="py-2.5 px-3 text-right font-lottery font-bold text-[#C8102E]">
                          {entry.numbers.join(' - ')}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </div>
  );
};
