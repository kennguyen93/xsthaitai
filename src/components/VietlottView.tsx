import React, { useEffect, useMemo, useState } from 'react';
import { Calendar, CheckCircle2, ChevronDown, Info } from 'lucide-react';
import {
  DbVietlottRow,
  fetchVietlottHistory,
  mapVietlottRows,
} from '../services/apiClient';
import {
  VietlottMax3DResult,
  VietlottMegaResult,
  VietlottPowerResult,
} from '../types/lottery';
import { formatDateVN, getDayNameVN, shiftDateISO } from '../utils/lotteryEngine';
import { generateVietlottPageJsonLd } from '../utils/jsonLdGenerator';
import { applyDynamicSeoHead } from '../utils/seoHead';

interface VietlottViewProps {
  selectedDate: string;
  todayISO?: string;
}

interface VietlottDayGroup {
  dateStr: string;
  mega: VietlottMegaResult | null;
  power: VietlottPowerResult | null;
  max3d: VietlottMax3DResult | null;
}

const MIN_ARCHIVE_DATE = '2016-01-01';
const PAGE_SIZE = 7;

export const VietlottView: React.FC<VietlottViewProps> = ({ selectedDate, todayISO }) => {
  const effectiveTodayISO = todayISO || selectedDate;

  const [rows, setRows] = useState<DbVietlottRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nextCursorDate, setNextCursorDate] = useState<string>(() =>
    shiftDateISO(selectedDate, -PAGE_SIZE)
  );
  const [reloadKey, setReloadKey] = useState(0);

  const [gameCheck, setGameCheck] = useState<'mega' | 'power'>('mega');
  const [userBalls, setUserBalls] = useState<string>('');
  const [checkMsg, setCheckMsg] = useState<{
    matched: number;
    hasBonus: boolean;
    text: string;
  } | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setLoading(true);
    setError(null);
    setRows([]);
    setNextCursorDate(shiftDateISO(selectedDate, -PAGE_SIZE));

    fetchVietlottHistory(selectedDate, PAGE_SIZE, controller.signal)
      .then((res) => {
        if (!active) return;
        setRows(res.results);
      })
      .catch((err: unknown) => {
        if (!active) return;
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setError(err instanceof Error ? err.message : 'Không thể tải Vietlott.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [selectedDate, reloadKey]);

  const groupedByDate: VietlottDayGroup[] = useMemo(() => {
    const map = new Map<string, DbVietlottRow[]>();
    for (const row of rows) {
      const list = map.get(row.drawDate) || [];
      list.push(row);
      map.set(row.drawDate, list);
    }
    return Array.from(map.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([dateStr, dayRows]) => {
        const mapped = mapVietlottRows(dayRows);
        return {
          dateStr,
          mega: mapped.mega,
          power: mapped.power,
          max3d: mapped.max3d,
        };
      });
  }, [rows]);

  const latestMega = useMemo(
    () => groupedByDate.find((d) => d.mega !== null)?.mega ?? null,
    [groupedByDate]
  );
  const latestPower = useMemo(
    () => groupedByDate.find((d) => d.power !== null)?.power ?? null,
    [groupedByDate]
  );
  const latestMax3d = useMemo(
    () => groupedByDate.find((d) => d.max3d !== null)?.max3d ?? null,
    [groupedByDate]
  );

  useEffect(() => {
    if (loading) return;
    const payload = generateVietlottPageJsonLd({
      origin: window.location.origin,
      date: selectedDate,
      mega: latestMega,
      power: latestPower,
      max3d: latestMax3d,
    });
    applyDynamicSeoHead(payload);
  }, [selectedDate, latestMega, latestPower, latestMax3d, loading]);

  const handleLoadMore = async () => {
    if (loadingMore || nextCursorDate < MIN_ARCHIVE_DATE) return;
    setLoadingMore(true);
    setError(null);
    try {
      const res = await fetchVietlottHistory(nextCursorDate, PAGE_SIZE);
      setRows((prev) => {
        const map = new Map<string, DbVietlottRow>();
        for (const row of prev) map.set(`${row.drawDate}:${row.gameType}`, row);
        for (const row of res.results) map.set(`${row.drawDate}:${row.gameType}`, row);
        return Array.from(map.values()).sort((a, b) => {
          const cmp = b.drawDate.localeCompare(a.drawDate);
          if (cmp !== 0) return cmp;
          return a.gameType.localeCompare(b.gameType);
        });
      });
      setNextCursorDate(shiftDateISO(nextCursorDate, -PAGE_SIZE));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Không thể tải thêm các ngày hôm trước.');
    } finally {
      setLoadingMore(false);
    }
  };

  const handleCheckVietlott = (e: React.FormEvent) => {
    e.preventDefault();
    const activeMega = latestMega;
    const activePower = latestPower;
    if (gameCheck === 'mega' && !activeMega) return;
    if (gameCheck === 'power' && !activePower) return;

    const nums = userBalls
      .split(/[\s,.-]+/)
      .map((s) => parseInt(s, 10))
      .filter((n) => !Number.isNaN(n) && n >= 1 && n <= (gameCheck === 'mega' ? 45 : 55));

    const unique = Array.from(new Set(nums)).slice(0, 6);
    if (unique.length < 6) {
      setCheckMsg({
        matched: 0,
        hasBonus: false,
        text: 'Vui lòng nhập đủ 6 cặp số hợp lệ (cách nhau bởi dấu cách hoặc dấu phẩy).',
      });
      return;
    }

    const target = gameCheck === 'mega' ? activeMega!.numbers : activePower!.numbers;
    const matched = unique.filter((n) => target.includes(n)).length;
    const hasBonus =
      gameCheck === 'power' && Boolean(activePower && unique.includes(activePower.bonusNumber));

    let prizeText = 'Rất tiếc, bộ số này chưa trúng giải kỳ này.';
    if (gameCheck === 'mega' && activeMega) {
      if (matched === 6) prizeText = `Chúc mừng! Trúng Jackpot (${activeMega.jackpotValue}).`;
      else if (matched === 5) prizeText = 'Chúc mừng! Trúng Giải Nhất (10.000.000đ).';
      else if (matched === 4) prizeText = 'Chúc mừng! Trúng Giải Nhì (300.000đ).';
      else if (matched === 3) prizeText = 'Chúc mừng! Trúng Giải Ba (30.000đ).';
    } else if (activePower) {
      if (matched === 6) prizeText = `Chúc mừng! Trúng Jackpot 1 (${activePower.jackpot1Value}).`;
      else if (matched === 5 && hasBonus)
        prizeText = `Chúc mừng! Trúng Jackpot 2 (${activePower.jackpot2Value}).`;
      else if (matched === 5) prizeText = 'Chúc mừng! Trúng Giải Nhất (40.000.000đ).';
      else if (matched === 4) prizeText = 'Chúc mừng! Trúng Giải Nhì (500.000đ).';
      else if (matched === 3) prizeText = 'Chúc mừng! Trúng Giải Ba (50.000đ).';
    }

    setCheckMsg({ matched, hasBonus, text: prizeText });
  };

  if (loading) {
    return (
      <div
        role="status"
        aria-live="polite"
        aria-label="Đang tải kết quả Vietlott"
        className="bg-white border border-slate-200 rounded-lg py-14 px-6 flex flex-col items-center justify-center gap-3"
      >
        <div className="relative w-10 h-10">
          <svg
            className="w-10 h-10 animate-spin text-[#C8102E]"
            viewBox="0 0 44 44"
            fill="none"
            aria-hidden="true"
          >
            <circle
              cx="22"
              cy="22"
              r="18"
              stroke="currentColor"
              strokeOpacity="0.15"
              strokeWidth="4"
            />
            <path
              d="M22 4a18 18 0 0 1 18 18"
              stroke="currentColor"
              strokeWidth="4"
              strokeLinecap="round"
            />
          </svg>
        </div>
        <span className="text-xs text-slate-500">
          Đang tải kết quả Vietlott từ ngày {formatDateVN(selectedDate)} trở về trước...
        </span>
      </div>
    );
  }

  if (error && groupedByDate.length === 0) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-800 flex items-center justify-between gap-3">
        <span>{error}</span>
        <button
          type="button"
          onClick={() => setReloadKey((k) => k + 1)}
          className="px-3 py-1.5 text-xs font-semibold bg-white border border-red-300 text-red-700 hover:bg-red-100 rounded-md shrink-0 cursor-pointer"
        >
          Thử lại
        </button>
      </div>
    );
  }

  if (groupedByDate.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-lg p-6 text-center text-sm text-slate-600">
        Chưa có dữ liệu kết quả Vietlott cho ngày {formatDateVN(selectedDate)} và các ngày gần nhất.
      </div>
    );
  }

  const hasSelectedDateDraw = groupedByDate.some((d) => d.dateStr === selectedDate);
  const canLoadMore = nextCursorDate >= MIN_ARCHIVE_DATE;
  const activeCheckDraw = gameCheck === 'mega' ? latestMega : latestPower;

  return (
    <div className="space-y-6">
      {!hasSelectedDateDraw && (
        <div className="bg-white border border-slate-200 rounded-lg px-4 py-3 flex items-center gap-2.5 text-xs sm:text-sm text-slate-600">
          <Calendar className="w-4 h-4 text-[#C8102E] shrink-0" aria-hidden="true" />
          <span>
            {selectedDate === effectiveTodayISO
              ? `Kỳ quay Vietlott hôm nay (${formatDateVN(selectedDate)}) chưa mở thưởng xong (18:00). Dưới đây là kết quả các ngày hôm trước:`
              : `Chưa có dữ liệu Vietlott cho ngày ${formatDateVN(selectedDate)}. Dưới đây là kết quả các ngày hôm trước:`}
          </span>
        </div>
      )}

      {(latestMega || latestPower) && (
        <section className="bg-white border border-slate-200 rounded-lg p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
            <h3 className="text-base font-bold text-slate-900">Dò bộ số Vietlott nhanh</h3>
            {activeCheckDraw && (
              <span className="text-xs text-slate-500">
                Đối chiếu kỳ mới nhất: Kỳ {activeCheckDraw.period} ({formatDateVN(activeCheckDraw.date)})
              </span>
            )}
          </div>
          <form onSubmit={handleCheckVietlott} className="flex flex-col sm:flex-row gap-3">
            <select
              value={gameCheck}
              onChange={(e) => {
                setGameCheck(e.target.value as 'mega' | 'power');
                setCheckMsg(null);
              }}
              className="px-3 py-2 text-sm border border-slate-300 rounded-md bg-white font-medium text-slate-800"
            >
              <option value="mega" disabled={!latestMega}>
                Mega 6/45
              </option>
              <option value="power" disabled={!latestPower}>
                Power 6/55
              </option>
            </select>
            <input
              type="text"
              value={userBalls}
              onChange={(e) => setUserBalls(e.target.value)}
              placeholder="Nhập 6 cặp số, ví dụ: 05 12 19 24 33 41"
              className="flex-1 px-3 py-2 text-sm border border-slate-300 rounded-md font-lottery"
            />
            <button
              type="submit"
              disabled={!activeCheckDraw}
              className="px-4 py-2 text-sm font-semibold text-white bg-[#C8102E] hover:bg-[#A60D26] rounded-md whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
            >
              Kiểm tra
            </button>
          </form>
          {checkMsg && (
            <div
              className={`mt-3 p-3 rounded-md text-sm flex items-start gap-2 ${
                checkMsg.matched >= 3
                  ? 'bg-emerald-50 text-emerald-900 border border-emerald-200'
                  : 'bg-slate-50 text-slate-700 border border-slate-200'
              }`}
            >
              {checkMsg.matched >= 3 ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <Info className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
              )}
              <span>{checkMsg.text}</span>
            </div>
          )}
        </section>
      )}

      {groupedByDate.map(({ dateStr, power, mega, max3d }) => (
        <div key={dateStr} className="space-y-4">
          <div className="flex items-center justify-between px-1 pt-1 border-b border-slate-200 pb-1.5">
            <h2 className="text-sm sm:text-base font-bold text-slate-800 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-[#C8102E]" aria-hidden="true" />
              <span>
                {getDayNameVN(dateStr)}, ngày {formatDateVN(dateStr)}
              </span>
            </h2>
            {dateStr === effectiveTodayISO && (
              <span className="text-[11px] font-semibold text-[#C8102E] bg-red-50 px-2 py-0.5 rounded">
                Hôm nay
              </span>
            )}
          </div>

          {power && (
            <section className="bg-white border border-slate-200 rounded-lg overflow-hidden">
              <div className="bg-[#C8102E] text-white px-4 py-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-base sm:text-lg font-bold">
                    Kết quả Vietlott Power 6/55 — Kỳ {power.period}
                  </h3>
                  <p className="text-xs text-red-100 mt-0.5">
                    {getDayNameVN(dateStr)} · Ngày {formatDateVN(dateStr)} · Quay số 18:00
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-[11px] text-red-100">Jackpot 1 ước tính</div>
                  <div className="font-lottery text-base sm:text-lg font-bold text-amber-300">
                    {power.jackpot1Value}
                  </div>
                </div>
              </div>

              <div className="p-5">
                <div className="flex flex-wrap items-center justify-center gap-2.5 sm:gap-3 py-2">
                  {power.numbers.map((num) => (
                    <span
                      key={num}
                      className="font-lottery w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-white border-2 border-[#C8102E] text-slate-900 font-bold text-lg sm:text-xl inline-flex items-center justify-center shadow-xs"
                    >
                      {String(num).padStart(2, '0')}
                    </span>
                  ))}
                  <span className="text-slate-400 font-bold px-1">+</span>
                  <span
                    title="Số đặc biệt (Jackpot 2)"
                    className="font-lottery w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-amber-500 text-white font-bold text-lg sm:text-xl inline-flex items-center justify-center shadow-xs"
                  >
                    {String(power.bonusNumber).padStart(2, '0')}
                  </span>
                </div>

                <div className="mt-4 overflow-x-auto">
                  <table className="w-full text-xs sm:text-sm border border-slate-200 border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-700">
                        <th className="py-2 px-3 text-left font-semibold">Hạng giải</th>
                        <th className="py-2 px-3 text-center font-semibold">Trùng khớp</th>
                        <th className="py-2 px-3 text-right font-semibold">Số lượng</th>
                        <th className="py-2 px-3 text-right font-semibold">Giá trị giải</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      <tr>
                        <td className="py-2 px-3 font-bold text-[#C8102E]">Jackpot 1</td>
                        <td className="py-2 px-3 text-center">6 số</td>
                        <td className="py-2 px-3 text-right font-lottery">{power.winnersJp1}</td>
                        <td className="py-2 px-3 text-right font-lottery font-bold text-[#C8102E]">
                          {power.jackpot1Value}
                        </td>
                      </tr>
                      <tr>
                        <td className="py-2 px-3 font-bold text-amber-700">Jackpot 2</td>
                        <td className="py-2 px-3 text-center">5 số + Số đặc biệt</td>
                        <td className="py-2 px-3 text-right font-lottery">{power.winnersJp2}</td>
                        <td className="py-2 px-3 text-right font-lottery font-bold text-amber-700">
                          {power.jackpot2Value}
                        </td>
                      </tr>
                      <tr>
                        <td className="py-2 px-3 font-medium">Giải Nhất</td>
                        <td className="py-2 px-3 text-center">5 số</td>
                        <td className="py-2 px-3 text-right font-lottery">14</td>
                        <td className="py-2 px-3 text-right font-lottery">40.000.000đ</td>
                      </tr>
                      <tr>
                        <td className="py-2 px-3 font-medium">Giải Nhì</td>
                        <td className="py-2 px-3 text-center">4 số</td>
                        <td className="py-2 px-3 text-right font-lottery">784</td>
                        <td className="py-2 px-3 text-right font-lottery">500.000đ</td>
                      </tr>
                      <tr>
                        <td className="py-2 px-3 font-medium">Giải Ba</td>
                        <td className="py-2 px-3 text-center">3 số</td>
                        <td className="py-2 px-3 text-right font-lottery">15.320</td>
                        <td className="py-2 px-3 text-right font-lottery">50.000đ</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          )}

          {mega && (
            <section className="bg-white border border-slate-200 rounded-lg overflow-hidden">
              <div className="bg-slate-900 text-white px-4 py-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-base sm:text-lg font-bold">
                    Kết quả Vietlott Mega 6/45 — Kỳ {mega.period}
                  </h3>
                  <p className="text-xs text-slate-300 mt-0.5">
                    {getDayNameVN(dateStr)} · Ngày {formatDateVN(dateStr)} · Quay số 18:00
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-[11px] text-slate-300">Jackpot tích lũy</div>
                  <div className="font-lottery text-base sm:text-lg font-bold text-amber-300">
                    {mega.jackpotValue}
                  </div>
                </div>
              </div>

              <div className="p-5">
                <div className="flex flex-wrap items-center justify-center gap-2.5 sm:gap-3 py-2">
                  {mega.numbers.map((num) => (
                    <span
                      key={num}
                      className="font-lottery w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-[#C8102E] text-white font-bold text-lg sm:text-xl inline-flex items-center justify-center shadow-xs"
                    >
                      {String(num).padStart(2, '0')}
                    </span>
                  ))}
                </div>

                <div className="mt-4 overflow-x-auto">
                  <table className="w-full text-xs sm:text-sm border border-slate-200 border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-700">
                        <th className="py-2 px-3 text-left font-semibold">Hạng giải</th>
                        <th className="py-2 px-3 text-center font-semibold">Trùng khớp</th>
                        <th className="py-2 px-3 text-right font-semibold">Số lượng</th>
                        <th className="py-2 px-3 text-right font-semibold">Giá trị giải</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      <tr>
                        <td className="py-2 px-3 font-bold text-[#C8102E]">Jackpot</td>
                        <td className="py-2 px-3 text-center">6 số</td>
                        <td className="py-2 px-3 text-right font-lottery">{mega.winnersJackpot}</td>
                        <td className="py-2 px-3 text-right font-lottery font-bold text-[#C8102E]">
                          {mega.jackpotValue}
                        </td>
                      </tr>
                      <tr>
                        <td className="py-2 px-3 font-medium">Giải Nhất</td>
                        <td className="py-2 px-3 text-center">5 số</td>
                        <td className="py-2 px-3 text-right font-lottery">{mega.winnersFirst}</td>
                        <td className="py-2 px-3 text-right font-lottery">10.000.000đ</td>
                      </tr>
                      <tr>
                        <td className="py-2 px-3 font-medium">Giải Nhì</td>
                        <td className="py-2 px-3 text-center">4 số</td>
                        <td className="py-2 px-3 text-right font-lottery">{mega.winnersSecond}</td>
                        <td className="py-2 px-3 text-right font-lottery">300.000đ</td>
                      </tr>
                      <tr>
                        <td className="py-2 px-3 font-medium">Giải Ba</td>
                        <td className="py-2 px-3 text-center">3 số</td>
                        <td className="py-2 px-3 text-right font-lottery">
                          {mega.winnersThird.toLocaleString('vi-VN')}
                        </td>
                        <td className="py-2 px-3 text-right font-lottery">30.000đ</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          )}

          {max3d && (
            <section className="bg-white border border-slate-200 rounded-lg overflow-hidden">
              <div className="bg-slate-800 text-white px-4 py-3 flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold">
                    Kết quả Vietlott Max 3D — Kỳ {max3d.period}
                  </h3>
                  <p className="text-xs text-slate-300 mt-0.5">
                    {getDayNameVN(dateStr)} · Ngày {formatDateVN(dateStr)}
                  </p>
                </div>
              </div>
              <div className="p-4">
                <table className="w-full text-xs sm:text-sm border border-slate-200 border-collapse text-center">
                  <tbody>
                    <tr className="border-b border-slate-200 bg-red-50/30">
                      <th className="w-28 py-2.5 px-3 text-left font-bold text-[#C8102E] bg-slate-50 border-r border-slate-200">
                        Giải ĐB
                      </th>
                      <td className="py-2.5 px-3 font-lottery text-lg font-bold text-[#C8102E]">
                        <div className="flex justify-center gap-6">
                          {max3d.special.map((n, i) => (
                            <span key={i}>{n}</span>
                          ))}
                        </div>
                      </td>
                    </tr>
                    <tr className="border-b border-slate-200">
                      <th className="py-2.5 px-3 text-left font-semibold text-slate-700 bg-slate-50 border-r border-slate-200">
                        Giải Nhất
                      </th>
                      <td className="py-2.5 px-3 font-lottery text-base font-bold text-slate-900">
                        <div className="flex flex-wrap justify-center gap-4">
                          {max3d.first.map((n, i) => (
                            <span key={i}>{n}</span>
                          ))}
                        </div>
                      </td>
                    </tr>
                    <tr className="border-b border-slate-200 bg-slate-50/40">
                      <th className="py-2.5 px-3 text-left font-semibold text-slate-700 bg-slate-50 border-r border-slate-200">
                        Giải Nhì
                      </th>
                      <td className="py-2.5 px-3 font-lottery text-base font-bold text-slate-900">
                        <div className="flex flex-wrap justify-center gap-4">
                          {max3d.second.map((n, i) => (
                            <span key={i}>{n}</span>
                          ))}
                        </div>
                      </td>
                    </tr>
                    <tr>
                      <th className="py-2.5 px-3 text-left font-semibold text-slate-700 bg-slate-50 border-r border-slate-200">
                        Giải Ba
                      </th>
                      <td className="py-2.5 px-3 font-lottery text-base font-bold text-slate-900">
                        <div className="flex flex-wrap justify-center gap-4">
                          {max3d.third.map((n, i) => (
                            <span key={i}>{n}</span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </div>
      ))}

      {error && groupedByDate.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-2.5 text-xs text-red-700">
          {error}
        </div>
      )}

      {canLoadMore && groupedByDate.length > 0 && (
        <div className="flex justify-center pt-1">
          <button
            type="button"
            disabled={loadingMore}
            onClick={() => void handleLoadMore()}
            className="inline-flex items-center gap-1.5 px-5 py-2.5 text-xs sm:text-sm font-semibold text-slate-800 bg-white hover:bg-slate-50 border border-slate-300 rounded-md shadow-xs disabled:opacity-60 disabled:cursor-wait cursor-pointer transition-colors"
          >
            <ChevronDown className="w-4 h-4 text-[#C8102E]" aria-hidden="true" />
            {loadingMore
              ? 'Đang tải thêm kết quả...'
              : `Xem thêm ${PAGE_SIZE} ngày hôm trước`}
          </button>
        </div>
      )}
    </div>
  );
};

