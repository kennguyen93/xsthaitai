import React, { useEffect, useState } from 'react';
import { CheckCircle2, Info } from 'lucide-react';
import { fetchVietlottByDate, mapVietlottRows } from '../services/apiClient';
import {
  VietlottMax3DResult,
  VietlottMegaResult,
  VietlottPowerResult,
} from '../types/lottery';
import { formatDateVN, getDayNameVN } from '../utils/lotteryEngine';
import { generateVietlottPageJsonLd } from '../utils/jsonLdGenerator';
import { applyDynamicSeoHead } from '../utils/seoHead';

interface VietlottViewProps {
  selectedDate: string;
}

export const VietlottView: React.FC<VietlottViewProps> = ({ selectedDate }) => {
  const [mega, setMega] = useState<VietlottMegaResult | null>(null);
  const [power, setPower] = useState<VietlottPowerResult | null>(null);
  const [max3d, setMax3d] = useState<VietlottMax3DResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [gameCheck, setGameCheck] = useState<'mega' | 'power'>('mega');
  const [userBalls, setUserBalls] = useState<string>('');
  const [checkMsg, setCheckMsg] = useState<{
    matched: number;
    hasBonus: boolean;
    text: string;
  } | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetchVietlottByDate(selectedDate)
      .then((res) => {
        const mapped = mapVietlottRows(res.results);
        setMega(mapped.mega);
        setPower(mapped.power);
        setMax3d(mapped.max3d);
      })
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : 'Không thể tải Vietlott.')
      )
      .finally(() => setLoading(false));
  }, [selectedDate]);

  useEffect(() => {
    if (loading) return;
    const payload = generateVietlottPageJsonLd({
      origin: window.location.origin,
      date: selectedDate,
      mega,
      power,
      max3d,
    });
    applyDynamicSeoHead(payload);
  }, [selectedDate, mega, power, max3d, loading]);

  const handleCheckVietlott = (e: React.FormEvent) => {
    e.preventDefault();
    if (!mega || !power) return;

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

    const target = gameCheck === 'mega' ? mega.numbers : power.numbers;
    const matched = unique.filter((n) => target.includes(n)).length;
    const hasBonus = gameCheck === 'power' && unique.includes(power.bonusNumber);

    let prizeText = 'Rất tiếc, bộ số này chưa trúng giải kỳ này.';
    if (gameCheck === 'mega') {
      if (matched === 6) prizeText = `Chúc mừng! Trúng Jackpot (${mega.jackpotValue}).`;
      else if (matched === 5) prizeText = 'Chúc mừng! Trúng Giải Nhất (10.000.000đ).';
      else if (matched === 4) prizeText = 'Chúc mừng! Trúng Giải Nhì (300.000đ).';
      else if (matched === 3) prizeText = 'Chúc mừng! Trúng Giải Ba (30.000đ).';
    } else {
      if (matched === 6) prizeText = `Chúc mừng! Trúng Jackpot 1 (${power.jackpot1Value}).`;
      else if (matched === 5 && hasBonus)
        prizeText = `Chúc mừng! Trúng Jackpot 2 (${power.jackpot2Value}).`;
      else if (matched === 5) prizeText = 'Chúc mừng! Trúng Giải Nhất (40.000.000đ).';
      else if (matched === 4) prizeText = 'Chúc mừng! Trúng Giải Nhì (500.000đ).';
      else if (matched === 3) prizeText = 'Chúc mừng! Trúng Giải Ba (50.000đ).';
    }

    setCheckMsg({ matched, hasBonus, text: prizeText });
  };

  if (loading) {
    return (
      <div className="bg-white border border-slate-200 rounded-lg p-8 text-center text-sm text-slate-500">
        Đang tải kết quả Vietlott từ cơ sở dữ liệu...
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-800">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {power && (
        <section className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="bg-[#C8102E] text-white px-4 py-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-base sm:text-lg font-bold">
                Kết quả Vietlott Power 6/55 — Kỳ {power.period}
              </h2>
              <p className="text-xs text-red-100 mt-0.5">
                {getDayNameVN(selectedDate)} · Ngày {formatDateVN(selectedDate)} · Quay số 18:00
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
              <h2 className="text-base sm:text-lg font-bold">
                Kết quả Vietlott Mega 6/45 — Kỳ {mega.period}
              </h2>
              <p className="text-xs text-slate-300 mt-0.5">
                {getDayNameVN(selectedDate)} · Ngày {formatDateVN(selectedDate)} · Quay số 18:00
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
              <h2 className="text-base font-bold">
                Kết quả Vietlott Max 3D — Kỳ {max3d.period}
              </h2>
              <p className="text-xs text-slate-300 mt-0.5">
                Ngày {formatDateVN(selectedDate)}
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

      <section className="bg-white border border-slate-200 rounded-lg p-5">
        <h3 className="text-base font-bold text-slate-900 mb-3">
          Dò bộ số Vietlott nhanh
        </h3>
        <form onSubmit={handleCheckVietlott} className="flex flex-col sm:flex-row gap-3">
          <select
            value={gameCheck}
            onChange={(e) => {
              setGameCheck(e.target.value as 'mega' | 'power');
              setCheckMsg(null);
            }}
            className="px-3 py-2 text-sm border border-slate-300 rounded-md bg-white font-medium text-slate-800"
          >
            <option value="mega">Mega 6/45</option>
            <option value="power">Power 6/55</option>
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
            className="px-4 py-2 text-sm font-semibold text-white bg-[#C8102E] hover:bg-[#A60D26] rounded-md whitespace-nowrap shrink-0 cursor-pointer"
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
    </div>
  );
};
