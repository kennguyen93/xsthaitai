import React, { useEffect, useMemo, useState } from 'react';
import { BarChart3, Search } from 'lucide-react';
import { DREAM_BOOK_ENTRIES } from '../data/dreamBook';
import { STAT_DROPDOWN_ITEMS } from '../data/statCategories';
import { fetchStatistics, ServerStatisticsData } from '../services/apiClient';
import { RegionKey, StatCategoryId } from '../types/lottery';
import { formatDateVN } from '../utils/lotteryEngine';

interface StatisticsViewProps {
  selectedDate: string;
  activeCategory: StatCategoryId;
  onSelectCategory: (category: StatCategoryId) => void;
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

const KEP_BANG = ['00', '11', '22', '33', '44', '55', '66', '77', '88', '99'];
const KEP_LECH = ['05', '50', '16', '61', '27', '72', '38', '83', '49', '94'];

export const StatisticsView: React.FC<StatisticsViewProps> = ({
  selectedDate,
  activeCategory,
  onSelectCategory,
}) => {
  const [region, setRegion] = useState<RegionKey>('MB');
  const [daysWindow, setDaysWindow] = useState<number>(
    activeCategory === 'dac-biet-ngay-mai' ? 365 : 30
  );
  const [matrixHeadFilter, setMatrixHeadFilter] = useState<string>('0');
  const [dreamQuery, setDreamQuery] = useState('');
  const [data, setData] = useState<ServerStatisticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (activeCategory === 'dac-biet-ngay-mai' && daysWindow < 365) {
      setDaysWindow(365);
    }
  }, [activeCategory, daysWindow]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    fetchStatistics(selectedDate, region, daysWindow)
      .then((res) => {
        if (active) setData(res);
      })
      .catch((err: unknown) => {
        if (active) {
          setError(err instanceof Error ? err.message : 'Không thể tải thống kê.');
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [selectedDate, region, daysWindow]);

  const activeMeta = useMemo(
    () =>
      STAT_DROPDOWN_ITEMS.find((item) => item.id === activeCategory) || {
        id: 'so-mo' as StatCategoryId,
        label: 'Sổ mơ giải mã số',
        shortLabel: 'Sổ mơ',
        description: 'Tra cứu ý nghĩa giấc mơ và bộ số tham khảo.',
      },
    [activeCategory]
  );

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
    return Math.max(1, ...data.headTail.map((h) => Math.max(h.headCount, h.tailCount)));
  }, [data]);

  const maxMonthlyDraws = useMemo(() => {
    if (!data || data.monthlySeries.length === 0) return 1;
    return Math.max(1, ...data.monthlySeries.map((m) => m.draws));
  }, [data]);

  const sortedByFrequency = useMemo(() => {
    if (!data) return [];
    return [...data.pairs].sort((a, b) => b.count - a.count || a.daysSinceLast - b.daysSinceLast);
  }, [data]);

  const kepBangRows = useMemo(() => {
    if (!data) return [];
    const map = new Map(data.pairs.map((p) => [p.pair, p]));
    return KEP_BANG.map((code) => map.get(code)!).filter(Boolean);
  }, [data]);

  const kepLechRows = useMemo(() => {
    if (!data) return [];
    const map = new Map(data.pairs.map((p) => [p.pair, p]));
    return KEP_LECH.map((code) => map.get(code)!).filter(Boolean);
  }, [data]);

  const matrixNumbers = useMemo(() => {
    const list: string[] = [];
    for (let d = 0; d < 10; d++) {
      list.push(`${matrixHeadFilter}${d}`);
    }
    return list;
  }, [matrixHeadFilter]);

  return (
    <div className="space-y-5">
      <section className="bg-white border border-slate-200 rounded-lg p-4 sm:p-5">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900">{activeMeta.label}</h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              {activeMeta.description}{' '}
              {data && activeCategory !== 'so-mo' && (
                <span className="text-slate-600 font-medium">
                  ({data.actualDrawsAnalyzed.toLocaleString('vi-VN')} kỳ ·{' '}
                  {formatDateVN(data.dateFrom)} – {formatDateVN(data.dateTo)})
                </span>
              )}
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

        {/* Time Window Buttons */}
        {activeCategory !== 'so-mo' && (
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
        )}

        {/* Quick Category Switcher mirroring the 11 dropdown items + So Mo */}
        <div className="mt-4 pt-3 border-t border-slate-200 flex flex-wrap gap-1.5">
          {STAT_DROPDOWN_ITEMS.map((item) => {
            const isActive = activeCategory === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectCategory(item.id)}
                className={`px-2.5 py-1.5 text-xs font-semibold rounded border transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-[#C8102E] text-white border-[#C8102E]'
                    : 'bg-white text-slate-700 border-slate-200 hover:border-[#C8102E] hover:text-[#C8102E]'
                }`}
              >
                {item.label}
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => onSelectCategory('so-mo')}
            className={`px-2.5 py-1.5 text-xs font-semibold rounded border transition-colors cursor-pointer ${
              activeCategory === 'so-mo'
                ? 'bg-[#C8102E] text-white border-[#C8102E]'
                : 'bg-white text-slate-700 border-slate-200 hover:border-[#C8102E] hover:text-[#C8102E]'
            }`}
          >
            Sổ mơ
          </button>
        </div>

        {loading && activeCategory !== 'so-mo' && (
          <div className="py-12 text-center text-sm text-slate-500">
            Đang tổng hợp thống kê từ cơ sở dữ liệu PostgreSQL...
          </div>
        )}

        {error && activeCategory !== 'so-mo' && (
          <div className="mt-4 p-4 rounded bg-red-50 border border-red-200 text-sm text-red-800">
            {error}
          </div>
        )}

        {/* 1. Thống kê Loto gan */}
        {!loading && !error && data && activeCategory === 'loto-gan' && (
          <div className="mt-5 space-y-4">
            <h3 className="text-sm font-bold text-slate-800">
              Top 20 Cặp Số Lâu Chưa Về Nhất (Loto Gan) — {region}
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs sm:text-sm border border-slate-200 border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-700">
                    <th className="py-2 px-2.5 text-center font-semibold">Hạng</th>
                    <th className="py-2 px-2.5 text-center font-semibold">Bộ số</th>
                    <th className="py-2 px-2.5 text-right font-semibold">Số ngày chưa về</th>
                    <th className="py-2 px-2.5 text-right font-semibold">Gan cực đại</th>
                    <th className="py-2 px-2.5 text-right font-semibold">Tổng lần về</th>
                    <th className="py-2 px-2.5 text-right font-semibold">Về gần nhất</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {data.topLoGan.map((item, idx) => (
                    <tr key={item.pair} className="hover:bg-slate-50">
                      <td className="py-2 px-2.5 text-center text-slate-500">{idx + 1}</td>
                      <td className="py-2 px-2.5 text-center font-lottery font-bold text-[#C8102E] text-base">
                        {item.pair}
                      </td>
                      <td className="py-2 px-2.5 text-right font-lottery font-bold text-slate-900">
                        {item.daysSinceLast} ngày
                      </td>
                      <td className="py-2 px-2.5 text-right font-lottery text-slate-600">
                        {item.maxGap} ngày
                      </td>
                      <td className="py-2 px-2.5 text-right font-lottery text-slate-700">
                        {item.count} lần
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
          </div>
        )}

        {/* 2. TK giải Đặc biệt */}
        {!loading && !error && data && activeCategory === 'giai-dac-biet' && (
          <div className="mt-5 space-y-4">
            <h3 className="text-sm font-bold text-slate-800">
              Bảng Thống Kê Giải Đặc Biệt ({data.specialHistory.length} kỳ gần nhất)
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs sm:text-sm border border-slate-200 border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-700">
                    <th className="py-2 px-3 text-left font-semibold">Ngày quay</th>
                    <th className="py-2 px-3 text-left font-semibold">Đài / Tỉnh</th>
                    <th className="py-2 px-3 text-center font-semibold">Giải ĐB</th>
                    <th className="py-2 px-3 text-center font-semibold">2 số cuối</th>
                    <th className="py-2 px-3 text-center font-semibold">Đầu / Đuôi</th>
                    <th className="py-2 px-3 text-right font-semibold">Tổng đề</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {data.specialHistory.map((item, idx) => (
                    <tr
                      key={`${item.drawDate}-${item.provinceCode}-${idx}`}
                      className="hover:bg-slate-50"
                    >
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
                      <td className="py-2 px-3 text-center font-lottery text-slate-600">
                        Đầu {item.head} – Đuôi {item.tail}
                      </td>
                      <td className="py-2 px-3 text-right font-lottery font-semibold text-slate-800">
                        {item.sum}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 3. Thống kê tổng hợp */}
        {!loading && !error && data && activeCategory === 'tong-hop' && (
          <div className="mt-5 space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <div>
                <h3 className="text-sm font-bold text-slate-800 mb-2">
                  Top 10 Loto Gan Lâu Chưa Về
                </h3>
                <table className="w-full text-xs sm:text-sm border border-slate-200 border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-700">
                      <th className="py-2 px-2.5 text-center font-semibold">Bộ số</th>
                      <th className="py-2 px-2.5 text-right font-semibold">Chưa về</th>
                      <th className="py-2 px-2.5 text-right font-semibold">Gan max</th>
                      <th className="py-2 px-2.5 text-right font-semibold">Gần nhất</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {data.topLoGan.slice(0, 10).map((item) => (
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
                  Top 10 Bộ Số Về Nhiều Nhất
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
                    {data.topHot.slice(0, 10).map((item) => {
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
                              <div className="h-full bg-[#C8102E]" style={{ width: `${pct}%` }} />
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="border border-slate-200 rounded-lg p-4">
              <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-[#C8102E]" />
                Tổng Hợp Kỳ Quay Theo Tháng
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
                          {m.draws} kỳ · Top: {m.topPair}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* 4. Thống kê Đầu - Đuôi */}
        {!loading && !error && data && activeCategory === 'dau-duoi' && (
          <div className="mt-5 space-y-5">
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
                    <th className="py-2 px-3 text-right font-semibold text-[#C8102E]">Đầu ĐB</th>
                    <th className="py-2 px-3 text-right font-semibold text-[#C8102E]">Đuôi ĐB</th>
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

            <div className="border border-slate-200 rounded-lg p-4">
              <h4 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-[#C8102E]" />
                Biểu Đồ Phân Bổ Đầu (Đỏ) &amp; Đuôi (Xám Đậm) Theo Chữ Số 0–9
              </h4>
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
          </div>
        )}

        {/* 5. Tần suất xuất hiện */}
        {!loading && !error && data && activeCategory === 'tan-suat-xuat-hien' && (
          <div className="mt-5 space-y-4">
            <h3 className="text-sm font-bold text-slate-800">
              Xếp Hạng Tần Suất Xuất Hiện 100 Cặp Số (Từ Cao Đến Thấp)
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs sm:text-sm border border-slate-200 border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-700">
                    <th className="py-2 px-2.5 text-center font-semibold">Hạng</th>
                    <th className="py-2 px-2.5 text-center font-semibold">Bộ số</th>
                    <th className="py-2 px-2.5 text-right font-semibold">Số lần về</th>
                    <th className="py-2 px-2.5 text-right font-semibold">Chưa về</th>
                    <th className="py-2 px-2.5 text-left font-semibold min-w-[140px]">Mật độ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {sortedByFrequency.map((item, idx) => {
                    const maxCount = sortedByFrequency[0]?.count || 1;
                    const pct = Math.round((item.count / maxCount) * 100);
                    return (
                      <tr key={item.pair} className="hover:bg-slate-50">
                        <td className="py-1.5 px-2.5 text-center text-slate-500">{idx + 1}</td>
                        <td className="py-1.5 px-2.5 text-center font-lottery font-bold text-[#C8102E]">
                          {item.pair}
                        </td>
                        <td className="py-1.5 px-2.5 text-right font-lottery font-semibold text-slate-900">
                          {item.count} lượt
                        </td>
                        <td className="py-1.5 px-2.5 text-right font-lottery text-slate-600">
                          {item.daysSinceLast} ngày
                        </td>
                        <td className="py-1.5 px-2.5">
                          <div className="h-2 w-full bg-slate-100 rounded overflow-hidden">
                            <div className="h-full bg-[#C8102E]" style={{ width: `${pct}%` }} />
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

        {/* 6. TK từ 00 đến 99 */}
        {!loading && !error && data && activeCategory === 'tu-00-den-99' && (
          <div className="mt-5">
            <p className="text-xs text-slate-500 mb-3">
              Bảng toàn bộ 100 cặp số từ 00 đến 99 trong {data.actualDaysCovered} ngày có dữ liệu
              (ô nền đỏ là bộ số về trên mức trung bình).
            </p>
            <div className="grid grid-cols-5 sm:grid-cols-10 gap-1.5">
              {data.pairs.map((item) => {
                const avg = data.pairs.reduce((acc, p) => acc + p.count, 0) / 100 || 1;
                const isHot = item.count > avg * 1.15;
                return (
                  <div
                    key={item.pair}
                    className={`p-2 border rounded text-center ${
                      isHot ? 'bg-red-50 border-red-200' : 'bg-white border-slate-200'
                    }`}
                  >
                    <div
                      className={`font-lottery text-sm font-bold ${
                        isHot ? 'text-[#C8102E]' : 'text-slate-900'
                      }`}
                    >
                      {item.pair}
                    </div>
                    <div className="font-lottery text-[11px] text-slate-600 mt-0.5">
                      {item.count} lần
                    </div>
                    <div className="font-lottery text-[10px] text-slate-400">
                      Gan {item.daysSinceLast}n
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 7. Thống kê cặp loto cùng về XSMB */}
        {!loading && !error && data && activeCategory === 'cap-cung-ve' && (
          <div className="mt-5 space-y-4">
            <h3 className="text-sm font-bold text-slate-800">
              Top 30 Cặp Loto Thường Xuyên Về Cùng Nhau Trong Một Kỳ ({region})
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs sm:text-sm border border-slate-200 border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-700">
                    <th className="py-2 px-3 text-center font-semibold">Hạng</th>
                    <th className="py-2 px-3 text-center font-semibold">Cặp số cùng về</th>
                    <th className="py-2 px-3 text-right font-semibold">Số kỳ cùng xuất hiện</th>
                    <th className="py-2 px-3 text-right font-semibold">Kỳ gần nhất</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {data.coOccurrences.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-6 text-center text-slate-500">
                        Chưa đủ dữ liệu kỳ quay để tính cặp cùng về.
                      </td>
                    </tr>
                  ) : (
                    data.coOccurrences.map((row, idx) => (
                      <tr key={`${row.pairA}-${row.pairB}`} className="hover:bg-slate-50">
                        <td className="py-2 px-3 text-center text-slate-500">{idx + 1}</td>
                        <td className="py-2 px-3 text-center font-lottery font-bold text-[#C8102E]">
                          {row.pairA} &amp; {row.pairB}
                        </td>
                        <td className="py-2 px-3 text-right font-lottery font-semibold text-slate-900">
                          {row.count} kỳ
                        </td>
                        <td className="py-2 px-3 text-right font-lottery text-slate-500">
                          {formatDateVN(row.lastDate)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 8. Thống kê loto kép */}
        {!loading && !error && data && activeCategory === 'loto-kep' && (
          <div className="mt-5 grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div>
              <h3 className="text-sm font-bold text-slate-800 mb-2">
                Loto Kép Bằng (00, 11, 22, ..., 99)
              </h3>
              <table className="w-full text-xs sm:text-sm border border-slate-200 border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-700">
                    <th className="py-2 px-2.5 text-center font-semibold">Bộ số</th>
                    <th className="py-2 px-2.5 text-right font-semibold">Lần về</th>
                    <th className="py-2 px-2.5 text-right font-semibold">Chưa về</th>
                    <th className="py-2 px-2.5 text-right font-semibold">Gan max</th>
                    <th className="py-2 px-2.5 text-right font-semibold">Gần nhất</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {kepBangRows.map((item) => (
                    <tr key={item.pair} className="hover:bg-slate-50">
                      <td className="py-2 px-2.5 text-center font-lottery font-bold text-[#C8102E]">
                        {item.pair}
                      </td>
                      <td className="py-2 px-2.5 text-right font-lottery font-semibold text-slate-900">
                        {item.count}
                      </td>
                      <td className="py-2 px-2.5 text-right font-lottery text-slate-700">
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
                Loto Kép Lệch (05-50, 16-61, 27-72, 38-83, 49-94)
              </h3>
              <table className="w-full text-xs sm:text-sm border border-slate-200 border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-700">
                    <th className="py-2 px-2.5 text-center font-semibold">Bộ số</th>
                    <th className="py-2 px-2.5 text-right font-semibold">Lần về</th>
                    <th className="py-2 px-2.5 text-right font-semibold">Chưa về</th>
                    <th className="py-2 px-2.5 text-right font-semibold">Gan max</th>
                    <th className="py-2 px-2.5 text-right font-semibold">Gần nhất</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {kepLechRows.map((item) => (
                    <tr key={item.pair} className="hover:bg-slate-50">
                      <td className="py-2 px-2.5 text-center font-lottery font-bold text-slate-900">
                        {item.pair}
                      </td>
                      <td className="py-2 px-2.5 text-right font-lottery font-semibold text-[#C8102E]">
                        {item.count}
                      </td>
                      <td className="py-2 px-2.5 text-right font-lottery text-slate-700">
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
          </div>
        )}

        {/* 9. Thống kê tần suất loto (theo ngày) */}
        {!loading && !error && data && activeCategory === 'tan-suat-loto' && (
          <div className="mt-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-bold text-slate-800">
                Bảng Tần Suất Loto Theo Từng Ngày ({data.recentDays.length} kỳ gần nhất)
              </h3>
              <div className="flex items-center gap-1 flex-wrap">
                <span className="text-xs text-slate-500 mr-1">Chọn đầu số:</span>
                {Array.from({ length: 10 }, (_, d) => String(d)).map((head) => (
                  <button
                    key={head}
                    type="button"
                    onClick={() => setMatrixHeadFilter(head)}
                    className={`w-7 h-7 text-xs font-lottery font-bold rounded border cursor-pointer ${
                      matrixHeadFilter === head
                        ? 'bg-[#C8102E] text-white border-[#C8102E]'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {head}x
                  </button>
                ))}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs border border-slate-200 border-collapse text-center">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-700">
                    <th className="py-2 px-2.5 text-left font-semibold whitespace-nowrap">
                      Ngày quay
                    </th>
                    {matrixNumbers.map((num) => (
                      <th key={num} className="py-2 px-2 font-lottery font-bold text-slate-900">
                        {num}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {data.recentDays.map((day) => {
                    const tailSet = new Set(day.tails);
                    return (
                      <tr key={day.drawDate} className="hover:bg-slate-50">
                        <td className="py-1.5 px-2.5 text-left font-lottery text-slate-700 whitespace-nowrap">
                          {formatDateVN(day.drawDate)}
                        </td>
                        {matrixNumbers.map((num) => {
                          const hit = tailSet.has(num);
                          const isSpecial = day.specialTail === num;
                          return (
                            <td
                              key={num}
                              className={`py-1.5 px-2 font-lottery ${
                                isSpecial
                                  ? 'bg-[#C8102E] text-white font-bold'
                                  : hit
                                  ? 'bg-emerald-50 text-emerald-800 font-bold'
                                  : 'text-slate-300'
                              }`}
                            >
                              {hit ? num : '—'}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="text-[11px] text-slate-500">
              Ô nền đỏ: về 2 số cuối Giải Đặc Biệt · Ô nền xanh: về trong các giải lô tô ngày đó.
            </p>
          </div>
        )}

        {/* 10. Thống kê tần suất cặp loto (45 cặp lộn AB - BA) */}
        {!loading && !error && data && activeCategory === 'tan-suat-cap-loto' && (
          <div className="mt-5 space-y-4">
            <h3 className="text-sm font-bold text-slate-800">
              Thống Kê Tần Suất 45 Cặp Loto Đối Xứng (AB – BA)
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs sm:text-sm border border-slate-200 border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-700">
                    <th className="py-2 px-3 text-center font-semibold">Hạng</th>
                    <th className="py-2 px-3 text-center font-semibold">Cặp loto</th>
                    <th className="py-2 px-3 text-right font-semibold">Tổng lần về</th>
                    <th className="py-2 px-3 text-right font-semibold">Cả cặp chưa về</th>
                    <th className="py-2 px-3 text-right font-semibold">Gan cực đại</th>
                    <th className="py-2 px-3 text-right font-semibold">Về gần nhất</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {data.mirrorPairs.map((item, idx) => (
                    <tr key={item.pairLabel} className="hover:bg-slate-50">
                      <td className="py-2 px-3 text-center text-slate-500">{idx + 1}</td>
                      <td className="py-2 px-3 text-center font-lottery font-bold text-[#C8102E]">
                        {item.pairLabel}
                      </td>
                      <td className="py-2 px-3 text-right font-lottery font-bold text-slate-900">
                        {item.totalCount} lượt
                      </td>
                      <td className="py-2 px-3 text-right font-lottery text-slate-700">
                        {item.daysSinceLast} ngày
                      </td>
                      <td className="py-2 px-3 text-right font-lottery text-slate-600">
                        {item.maxGap} ngày
                      </td>
                      <td className="py-2 px-3 text-right font-lottery text-slate-500">
                        {item.lastSeenDate === 'Chưa về'
                          ? 'Chưa về'
                          : formatDateVN(item.lastSeenDate)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 11. Thống kê giải đặc biệt ngày mai */}
        {!loading && !error && data && activeCategory === 'dac-biet-ngay-mai' && (
          <div className="mt-5 space-y-5">
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
              <div className="text-sm font-bold text-slate-900">
                Đối Chiếu Lịch Sử Sau Khi Giải ĐB Về Đuôi{' '}
                <span className="font-lottery text-base text-[#C8102E]">
                  {data.nextDaySpecial.triggerTail || '--'}
                </span>
                {data.nextDaySpecial.triggerDate && (
                  <span className="text-xs font-normal text-slate-500 ml-2">
                    (kỳ gần nhất ngày {formatDateVN(data.nextDaySpecial.triggerDate)})
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-600 mt-1">
                Tìm thấy{' '}
                <span className="font-semibold text-slate-900">
                  {data.nextDaySpecial.sampleCount}
                </span>{' '}
                lần trong khoảng dữ liệu giải ĐB về số{' '}
                <span className="font-lottery font-bold">{data.nextDaySpecial.triggerTail}</span>.
                Dưới đây là thống kê kết quả giải ĐB của kỳ quay kế tiếp ngay sau đó:
              </p>
            </div>

            {data.nextDaySpecial.sampleCount === 0 ? (
              <div className="bg-white border border-slate-200 rounded-lg p-6 text-center text-sm text-slate-500 space-y-2">
                <p>
                  Trong khoảng {daysWindow} ngày gần đây chưa có kỳ lặp lại giải ĐB{' '}
                  {data.nextDaySpecial.triggerTail}.
                </p>
                {daysWindow < 1825 && (
                  <button
                    type="button"
                    onClick={() => setDaysWindow(1825)}
                    className="px-3 py-1.5 text-xs font-semibold text-[#C8102E] bg-red-50 hover:bg-red-100 rounded-md cursor-pointer"
                  >
                    Mở rộng phân tích 5 năm
                  </button>
                )}
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="border border-slate-200 rounded-lg p-3.5">
                    <h4 className="text-xs font-bold text-slate-700 mb-2">
                      2 Số Cuối ĐB Hay Về Ngày Hôm Sau
                    </h4>
                    <div className="flex flex-wrap gap-1.5">
                      {data.nextDaySpecial.nextTails.map((item) => (
                        <span
                          key={item.pair}
                          className="px-2 py-1 text-xs font-lottery bg-red-50 border border-red-200 rounded text-[#C8102E] font-bold"
                        >
                          {item.pair}{' '}
                          <span className="text-slate-500 font-normal">({item.count})</span>
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="border border-slate-200 rounded-lg p-3.5">
                    <h4 className="text-xs font-bold text-slate-700 mb-2">
                      Đầu ĐB Hay Về Ngày Hôm Sau
                    </h4>
                    <div className="space-y-1 text-xs">
                      {data.nextDaySpecial.nextHeads.slice(0, 5).map((h) => (
                        <div key={h.digit} className="flex justify-between">
                          <span className="font-lottery font-bold text-slate-800">
                            Đầu {h.digit}
                          </span>
                          <span className="font-lottery text-[#C8102E] font-semibold">
                            {h.count} lần
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="border border-slate-200 rounded-lg p-3.5">
                    <h4 className="text-xs font-bold text-slate-700 mb-2">
                      Đuôi ĐB Hay Về Ngày Hôm Sau
                    </h4>
                    <div className="space-y-1 text-xs">
                      {data.nextDaySpecial.nextTailsDigit.slice(0, 5).map((t) => (
                        <div key={t.digit} className="flex justify-between">
                          <span className="font-lottery font-bold text-slate-800">
                            Đuôi {t.digit}
                          </span>
                          <span className="font-lottery text-[#C8102E] font-semibold">
                            {t.count} lần
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs sm:text-sm border border-slate-200 border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-700">
                        <th className="py-2 px-3 text-left font-semibold">
                          Ngày về ĐB {data.nextDaySpecial.triggerTail}
                        </th>
                        <th className="py-2 px-3 text-left font-semibold">Ngày kế tiếp</th>
                        <th className="py-2 px-3 text-center font-semibold">Giải ĐB hôm sau</th>
                        <th className="py-2 px-3 text-center font-semibold">2 số cuối</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {data.nextDaySpecial.history.map((h, idx) => (
                        <tr key={`${h.triggerDate}-${idx}`} className="hover:bg-slate-50">
                          <td className="py-2 px-3 font-lottery text-slate-600">
                            {formatDateVN(h.triggerDate)}
                          </td>
                          <td className="py-2 px-3 font-lottery text-slate-800">
                            {formatDateVN(h.nextDate)}
                          </td>
                          <td className="py-2 px-3 text-center font-lottery font-bold text-[#C8102E]">
                            {h.nextSpecial}
                          </td>
                          <td className="py-2 px-3 text-center font-lottery font-bold text-slate-900">
                            {h.nextTail}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )}

        {/* 12. Sổ Mơ */}
        {activeCategory === 'so-mo' && (
          <div className="mt-5 space-y-3">
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
