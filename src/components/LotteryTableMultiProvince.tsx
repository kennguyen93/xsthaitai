import React, { useMemo, useState } from 'react';
import { Printer } from 'lucide-react';
import { DigitDisplayMode, ProvinceDrawResult } from '../types/lottery';
import {
  extractDauDuoiMap,
  formatDateVN,
  formatPrizeNumber,
  getAllProvinceNumbers,
  getDayNameVN,
} from '../utils/lotteryEngine';

interface LotteryTableMultiProvinceProps {
  regionLabel: 'Miền Nam' | 'Miền Trung';
  drawTime: string;
  dateStr: string;
  results: ProvinceDrawResult[];
  onQuickCheck?: (provinceCode: string) => void;
}

const PRIZE_ROWS: {
  key: keyof ProvinceDrawResult['prizes'];
  label: string;
  isRed?: boolean;
  isSpecial?: boolean;
}[] = [
  { key: 'g8', label: 'G.Tám', isRed: true },
  { key: 'g7', label: 'G.Bảy' },
  { key: 'g6', label: 'G.Sáu' },
  { key: 'g5', label: 'G.Năm' },
  { key: 'g4', label: 'G.Tư' },
  { key: 'g3', label: 'G.Ba' },
  { key: 'g2', label: 'G.Nhì' },
  { key: 'g1', label: 'G.Nhất' },
  { key: 'db', label: 'ĐB', isSpecial: true },
];

export const LotteryTableMultiProvince: React.FC<LotteryTableMultiProvinceProps> = ({
  regionLabel,
  drawTime,
  dateStr,
  results,
  onQuickCheck,
}) => {
  const [digitMode, setDigitMode] = useState<DigitDisplayMode>('full');
  const [highlightedPair, setHighlightedPair] = useState<string | null>(null);

  const lotoByProvince = useMemo(() => {
    return results.map((res) => ({
      province: res.province,
      dauMap: extractDauDuoiMap(getAllProvinceNumbers(res), res.prizes.db),
    }));
  }, [results]);

  if (results.length === 0) return null;

  return (
    <section className="bg-white border border-slate-200 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="bg-[#C8102E] text-white px-4 py-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base sm:text-lg font-bold tracking-tight">
            Kết quả Xổ Số {regionLabel} ({results.map((r) => r.province.name).join(' · ')})
          </h2>
          <p className="text-xs text-red-100 mt-0.5">
            {getDayNameVN(dateStr)} · Ngày {formatDateVN(dateStr)} · Mở thưởng {drawTime}
          </p>
        </div>

        <button
          type="button"
          onClick={() => window.print()}
          className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-white/15 hover:bg-white/25 text-white rounded transition-colors cursor-pointer"
        >
          <Printer className="w-3.5 h-3.5" aria-hidden="true" />
          In
        </button>
      </div>

      {/* Mode Switcher */}
      <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
          <span>Chọn đài dò vé nhanh:</span>
          {results.map((r) => (
            <button
              key={r.province.code}
              type="button"
              onClick={() => onQuickCheck && onQuickCheck(r.province.code)}
              className="text-xs font-semibold text-[#C8102E] hover:underline cursor-pointer"
            >
              {r.province.name}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1 bg-slate-200/70 p-0.5 rounded-md">
          {(
            [
              { id: 'full', label: 'Đầy đủ' },
              { id: '2', label: '2 số cuối' },
              { id: '3', label: '3 số cuối' },
            ] as { id: DigitDisplayMode; label: string }[]
          ).map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setDigitMode(m.id)}
              className={`px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                digitMode === m.id
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* Multi-province Table */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-center min-w-[540px]">
          <thead>
            <tr className="bg-slate-100 border-b border-slate-200">
              <th className="w-20 sm:w-24 py-2.5 px-2 text-xs font-bold text-slate-700 border-r border-slate-200">
                Giải
              </th>
              {results.map((res) => (
                <th
                  key={res.province.code}
                  className="py-2.5 px-2 text-xs sm:text-sm font-bold text-slate-900 border-r last:border-r-0 border-slate-200"
                >
                  <div>{res.province.name}</div>
                  <div className="text-[11px] font-medium text-slate-500">
                    {res.province.code}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PRIZE_ROWS.map((row, rIdx) => (
              <tr
                key={row.key}
                className={`border-b border-slate-200 ${
                  row.isSpecial
                    ? 'bg-red-50/35'
                    : rIdx % 2 === 1
                    ? 'bg-slate-50/50'
                    : 'bg-white'
                }`}
              >
                <th
                  scope="row"
                  className={`py-2 px-2 text-xs sm:text-sm font-semibold border-r border-slate-200 bg-slate-50 ${
                    row.isSpecial || row.isRed ? 'text-[#C8102E] font-bold' : 'text-slate-600'
                  }`}
                >
                  {row.label}
                </th>
                {results.map((res) => {
                  const nums = res.prizes[row.key];
                  return (
                    <td
                      key={`${res.province.code}-${row.key}`}
                      className="py-2 px-2 border-r last:border-r-0 border-slate-200 align-middle"
                    >
                      <div className="flex flex-col items-center gap-0.5">
                        {nums.map((num, idx) => {
                          const tail2 = num.slice(-2);
                          const isMatched =
                            highlightedPair !== null && tail2 === highlightedPair;
                          const display = formatPrizeNumber(num, digitMode);

                          return (
                            <span
                              key={`${num}-${idx}`}
                              onMouseEnter={() => setHighlightedPair(tail2)}
                              onMouseLeave={() => setHighlightedPair(null)}
                              onClick={() =>
                                setHighlightedPair(
                                  highlightedPair === tail2 ? null : tail2
                                )
                              }
                              title={`Soi lô ${tail2}`}
                              className={`font-lottery px-1.5 rounded transition-colors cursor-pointer ${
                                row.isSpecial
                                  ? 'text-xl sm:text-2xl font-bold text-[#C8102E]'
                                  : row.isRed
                                  ? 'text-xl font-bold text-[#C8102E]'
                                  : 'text-base sm:text-lg font-bold text-slate-900'
                              } ${
                                isMatched
                                  ? 'bg-amber-200/80 ring-1 ring-amber-400'
                                  : 'hover:bg-slate-100'
                              }`}
                            >
                              {display}
                            </span>
                          );
                        })}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Multi-province Đầu Lô Tô Table */}
      <div className="border-t border-slate-200 bg-slate-50/60 px-4 py-3">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs sm:text-sm font-bold text-slate-800">
            Bảng Lô Tô Đầu {regionLabel} — {formatDateVN(dateStr)}
          </h3>
          {highlightedPair && (
            <button
              type="button"
              onClick={() => setHighlightedPair(null)}
              className="text-xs font-medium text-[#C8102E] hover:underline cursor-pointer"
            >
              Đang chọn số {highlightedPair} · Bỏ chọn
            </button>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border border-slate-200 bg-white text-xs sm:text-sm border-collapse min-w-[540px]">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-200 text-slate-700">
                <th className="w-12 py-1.5 px-2 border-r border-slate-200 font-bold">Đầu</th>
                {lotoByProvince.map((item) => (
                  <th
                    key={item.province.code}
                    className="py-1.5 px-3 text-left font-bold border-r last:border-r-0 border-slate-200"
                  >
                    {item.province.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 10 }, (_, d) => (
                <tr key={d} className="border-b border-slate-200 last:border-b-0">
                  <td className="py-1.5 px-2 text-center font-bold text-[#C8102E] bg-slate-50 border-r border-slate-200 font-lottery">
                    {d}
                  </td>
                  {lotoByProvince.map((provItem) => {
                    const entries = provItem.dauMap[String(d)] || [];
                    return (
                      <td
                        key={`${provItem.province.code}-${d}`}
                        className="py-1.5 px-3 font-lottery border-r last:border-r-0 border-slate-200"
                      >
                        {entries.length === 0 ? (
                          <span className="text-slate-300">-</span>
                        ) : (
                          <div className="flex flex-wrap gap-x-2 gap-y-0.5">
                            {entries.map((entry, idx) => (
                              <span
                                key={`${entry.full2}-${idx}`}
                                onMouseEnter={() => setHighlightedPair(entry.full2)}
                                onMouseLeave={() => setHighlightedPair(null)}
                                onClick={() =>
                                  setHighlightedPair(
                                    highlightedPair === entry.full2 ? null : entry.full2
                                  )
                                }
                                className={`px-1 rounded cursor-pointer transition-colors ${
                                  entry.isDB
                                    ? 'text-[#C8102E] font-bold underline decoration-red-300'
                                    : 'text-slate-800 font-semibold'
                                } ${
                                  highlightedPair === entry.full2
                                    ? 'bg-amber-200'
                                    : 'hover:bg-slate-100'
                                }`}
                              >
                                {entry.tailDigit}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
};
