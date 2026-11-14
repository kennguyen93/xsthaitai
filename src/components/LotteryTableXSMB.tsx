import React, { useMemo, useState } from 'react';
import { Printer } from 'lucide-react';
import { DigitDisplayMode, XSMBResult } from '../types/lottery';
import {
  extractDauDuoiMap,
  extractDuoiDauMap,
  formatDateVN,
  formatPrizeNumber,
  getAllXSMBNumbers,
} from '../utils/lotteryEngine';

interface LotteryTableXSMBProps {
  result: XSMBResult;
  titleOverride?: string;
  onQuickCheck?: (provinceCode: string) => void;
}

export const LotteryTableXSMB: React.FC<LotteryTableXSMBProps> = ({
  result,
  titleOverride,
  onQuickCheck,
}) => {
  const [digitMode, setDigitMode] = useState<DigitDisplayMode>('full');
  const [highlightedPair, setHighlightedPair] = useState<string | null>(null);

  const allNumbers = useMemo(() => getAllXSMBNumbers(result), [result]);
  const dauMap = useMemo(
    () => extractDauDuoiMap(allNumbers, result.prizes.db),
    [allNumbers, result.prizes.db]
  );
  const duoiMap = useMemo(
    () => extractDuoiDauMap(allNumbers, result.prizes.db),
    [allNumbers, result.prizes.db]
  );

  const renderNumberCell = (
    num: string,
    idx: number,
    isSpecial = false,
    isSmallRed = false
  ) => {
    const tail2 = num.slice(-2);
    const isMatched = highlightedPair !== null && tail2 === highlightedPair;
    const display = formatPrizeNumber(num, digitMode);

    return (
      <span
        key={`${num}-${idx}`}
        onMouseEnter={() => setHighlightedPair(tail2)}
        onMouseLeave={() => setHighlightedPair(null)}
        onClick={() => setHighlightedPair(highlightedPair === tail2 ? null : tail2)}
        title={`Nhấn hoặc rê chuột để soi lô ${tail2}`}
        className={`font-lottery inline-flex items-center justify-center px-2 py-0.5 rounded transition-colors cursor-pointer select-all ${
          isSpecial
            ? 'text-2xl sm:text-3xl font-bold text-[#C8102E] tracking-wider'
            : isSmallRed
            ? 'text-lg sm:text-xl font-bold text-[#C8102E]'
            : 'text-lg sm:text-xl font-bold text-slate-900'
        } ${isMatched ? 'bg-amber-200/80 ring-1 ring-amber-400' : 'hover:bg-slate-100'}`}
      >
        {display}
      </span>
    );
  };

  return (
    <section className="bg-white border border-slate-200 rounded-lg overflow-hidden">
      {/* Header Bar */}
      <div className="bg-[#C8102E] text-white px-4 py-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base sm:text-lg font-bold tracking-tight">
            {titleOverride || `Kết quả Xổ Số Miền Bắc (${result.provinceName})`}
          </h2>
          <p className="text-xs text-red-100 mt-0.5">
            {result.dayOfWeekLabel} · Ngày {formatDateVN(result.date)} · Mở thưởng 18:15
          </p>
        </div>

        <div className="flex items-center gap-2">
          {onQuickCheck && (
            <button
              type="button"
              onClick={() => onQuickCheck(result.provinceCode)}
              className="px-2.5 py-1 text-xs font-semibold bg-white/15 hover:bg-white/25 text-white rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Dò vé đài này
            </button>
          )}
          <button
            type="button"
            onClick={() => window.print()}
            className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-white/15 hover:bg-white/25 text-white rounded transition-colors cursor-pointer"
            title="In kết quả"
          >
            <Printer className="w-3.5 h-3.5" aria-hidden="true" />
            In
          </button>
        </div>
      </div>

      {/* Mode Switcher Bar */}
      <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs text-slate-600">
          <span className="font-medium">Ký hiệu ĐB:</span>
          <span className="font-lottery font-semibold text-slate-900">
            {result.kyHieu.join(' - ')}
          </span>
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

      {/* Main Prize Grid */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-center">
          <tbody>
            {/* Giải ĐB */}
            <tr className="border-b border-slate-200 bg-red-50/30">
              <th
                scope="row"
                className="w-20 sm:w-28 py-3 px-2 text-xs sm:text-sm font-bold text-[#C8102E] bg-slate-50 border-r border-slate-200"
              >
                ĐB
              </th>
              <td className="py-3 px-3">
                {result.prizes.db.map((n, i) => renderNumberCell(n, i, true))}
              </td>
            </tr>

            {/* Giải Nhất */}
            <tr className="border-b border-slate-200">
              <th
                scope="row"
                className="py-2.5 px-2 text-xs sm:text-sm font-semibold text-slate-600 bg-slate-50 border-r border-slate-200"
              >
                G.Nhất
              </th>
              <td className="py-2.5 px-3">
                {result.prizes.g1.map((n, i) => renderNumberCell(n, i))}
              </td>
            </tr>

            {/* Giải Nhì */}
            <tr className="border-b border-slate-200 bg-slate-50/40">
              <th
                scope="row"
                className="py-2.5 px-2 text-xs sm:text-sm font-semibold text-slate-600 bg-slate-50 border-r border-slate-200"
              >
                G.Nhì
              </th>
              <td className="py-2.5 px-3">
                <div className="grid grid-cols-2 gap-2 max-w-md mx-auto">
                  {result.prizes.g2.map((n, i) => renderNumberCell(n, i))}
                </div>
              </td>
            </tr>

            {/* Giải Ba */}
            <tr className="border-b border-slate-200">
              <th
                scope="row"
                className="py-3 px-2 text-xs sm:text-sm font-semibold text-slate-600 bg-slate-50 border-r border-slate-200"
              >
                G.Ba
              </th>
              <td className="py-3 px-3">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-y-2 gap-x-3">
                  {result.prizes.g3.map((n, i) => renderNumberCell(n, i))}
                </div>
              </td>
            </tr>

            {/* Giải Tư */}
            <tr className="border-b border-slate-200 bg-slate-50/40">
              <th
                scope="row"
                className="py-2.5 px-2 text-xs sm:text-sm font-semibold text-slate-600 bg-slate-50 border-r border-slate-200"
              >
                G.Tư
              </th>
              <td className="py-2.5 px-3">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {result.prizes.g4.map((n, i) => renderNumberCell(n, i))}
                </div>
              </td>
            </tr>

            {/* Giải Năm */}
            <tr className="border-b border-slate-200">
              <th
                scope="row"
                className="py-3 px-2 text-xs sm:text-sm font-semibold text-slate-600 bg-slate-50 border-r border-slate-200"
              >
                G.Năm
              </th>
              <td className="py-3 px-3">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-y-2 gap-x-3">
                  {result.prizes.g5.map((n, i) => renderNumberCell(n, i))}
                </div>
              </td>
            </tr>

            {/* Giải Sáu */}
            <tr className="border-b border-slate-200 bg-slate-50/40">
              <th
                scope="row"
                className="py-2.5 px-2 text-xs sm:text-sm font-semibold text-slate-600 bg-slate-50 border-r border-slate-200"
              >
                G.Sáu
              </th>
              <td className="py-2.5 px-3">
                <div className="grid grid-cols-3 gap-2 max-w-lg mx-auto">
                  {result.prizes.g6.map((n, i) => renderNumberCell(n, i))}
                </div>
              </td>
            </tr>

            {/* Giải Bảy */}
            <tr className="border-b border-slate-200">
              <th
                scope="row"
                className="py-2.5 px-2 text-xs sm:text-sm font-bold text-[#C8102E] bg-slate-50 border-r border-slate-200"
              >
                G.Bảy
              </th>
              <td className="py-2.5 px-3">
                <div className="grid grid-cols-4 gap-2 max-w-lg mx-auto">
                  {result.prizes.g7.map((n, i) => renderNumberCell(n, i, false, true))}
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Bảng Lô Tô Đầu - Đuôi */}
      <div className="border-t border-slate-200 bg-slate-50/60 px-4 py-3">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs sm:text-sm font-bold text-slate-800">
            Bảng Lô Tô Miền Bắc — {formatDateVN(result.date)}
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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Đầu -> Đuôi */}
          <table className="w-full border border-slate-200 bg-white text-xs sm:text-sm border-collapse">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-200 text-slate-700">
                <th className="w-14 py-1.5 px-2 border-r border-slate-200 font-bold">Đầu</th>
                <th className="py-1.5 px-3 text-left font-bold">Đuôi</th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 10 }, (_, d) => {
                const items = dauMap[String(d)] || [];
                return (
                  <tr key={d} className="border-b border-slate-200 last:border-b-0">
                    <td className="py-1.5 px-2 text-center font-bold text-[#C8102E] bg-slate-50 border-r border-slate-200 font-lottery">
                      {d}
                    </td>
                    <td className="py-1.5 px-3 font-lottery">
                      {items.length === 0 ? (
                        <span className="text-slate-300">-</span>
                      ) : (
                        <div className="flex flex-wrap gap-x-2 gap-y-0.5">
                          {items.map((item, idx) => (
                            <span
                              key={`${item.full2}-${idx}`}
                              onMouseEnter={() => setHighlightedPair(item.full2)}
                              onMouseLeave={() => setHighlightedPair(null)}
                              onClick={() =>
                                setHighlightedPair(
                                  highlightedPair === item.full2 ? null : item.full2
                                )
                              }
                              className={`px-1 rounded cursor-pointer transition-colors ${
                                item.isDB
                                  ? 'text-[#C8102E] font-bold underline decoration-red-300'
                                  : 'text-slate-800 font-semibold'
                              } ${
                                highlightedPair === item.full2
                                  ? 'bg-amber-200'
                                  : 'hover:bg-slate-100'
                              }`}
                            >
                              {item.tailDigit}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Đuôi -> Đầu */}
          <table className="w-full border border-slate-200 bg-white text-xs sm:text-sm border-collapse">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-200 text-slate-700">
                <th className="w-14 py-1.5 px-2 border-r border-slate-200 font-bold">Đuôi</th>
                <th className="py-1.5 px-3 text-left font-bold">Đầu</th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 10 }, (_, d) => {
                const items = duoiMap[String(d)] || [];
                return (
                  <tr key={d} className="border-b border-slate-200 last:border-b-0">
                    <td className="py-1.5 px-2 text-center font-bold text-[#C8102E] bg-slate-50 border-r border-slate-200 font-lottery">
                      {d}
                    </td>
                    <td className="py-1.5 px-3 font-lottery">
                      {items.length === 0 ? (
                        <span className="text-slate-300">-</span>
                      ) : (
                        <div className="flex flex-wrap gap-x-2 gap-y-0.5">
                          {items.map((item, idx) => (
                            <span
                              key={`${item.full2}-${idx}`}
                              onMouseEnter={() => setHighlightedPair(item.full2)}
                              onMouseLeave={() => setHighlightedPair(null)}
                              onClick={() =>
                                setHighlightedPair(
                                  highlightedPair === item.full2 ? null : item.full2
                                )
                              }
                              className={`px-1 rounded cursor-pointer transition-colors ${
                                item.isDB
                                  ? 'text-[#C8102E] font-bold underline decoration-red-300'
                                  : 'text-slate-800 font-semibold'
                              } ${
                                highlightedPair === item.full2
                                  ? 'bg-amber-200'
                                  : 'hover:bg-slate-100'
                              }`}
                            >
                              {item.headDigit}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
};
