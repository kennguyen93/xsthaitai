import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Search, Sparkles, XCircle } from 'lucide-react';
import {
  fetchResultsByDate,
  mapDbRowToProvinceDraw,
  mapDbRowToXSMB,
} from '../services/apiClient';
import {
  ProvinceDrawResult,
  ProvinceInfo,
  RegionKey,
  TicketMatchDetail,
  XSMBResult,
} from '../types/lottery';
import {
  checkTicketProvince,
  checkTicketXSMB,
  formatDateVN,
  getProvincesForDate,
} from '../utils/lotteryEngine';

interface TicketCheckerProps {
  selectedDate: string;
  todayISO: string;
  initialProvinceCode?: string | null;
}

export const TicketChecker: React.FC<TicketCheckerProps> = ({
  selectedDate,
  todayISO,
  initialProvinceCode,
}) => {
  const [date, setDate] = useState(selectedDate);
  const [region, setRegion] = useState<RegionKey>('MB');
  const [provinceCode, setProvinceCode] = useState<string>('');
  const [ticketNumber, setTicketNumber] = useState<string>('');
  const [hasChecked, setHasChecked] = useState(false);

  const [dbXSMB, setDbXSMB] = useState<XSMBResult | null>(null);
  const [dbProvinceDraws, setDbProvinceDraws] = useState<ProvinceDrawResult[]>([]);
  const [loadingDraw, setLoadingDraw] = useState(false);

  const provincesForDay: ProvinceInfo[] = useMemo(
    () => getProvincesForDate(date, region),
    [date, region]
  );

  useEffect(() => {
    setDate(selectedDate);
    if (initialProvinceCode) {
      const mbProvs = getProvincesForDate(selectedDate, 'MB');
      const mnProvs = getProvincesForDate(selectedDate, 'MN');
      const mtProvs = getProvincesForDate(selectedDate, 'MT');
      if (mbProvs.some((p) => p.code === initialProvinceCode)) {
        setRegion('MB');
        setProvinceCode(initialProvinceCode);
      } else if (mnProvs.some((p) => p.code === initialProvinceCode)) {
        setRegion('MN');
        setProvinceCode(initialProvinceCode);
      } else if (mtProvs.some((p) => p.code === initialProvinceCode)) {
        setRegion('MT');
        setProvinceCode(initialProvinceCode);
      }
      setHasChecked(false);
    }
  }, [initialProvinceCode, selectedDate]);

  useEffect(() => {
    if (
      provincesForDay.length > 0 &&
      !provincesForDay.some((p) => p.code === provinceCode)
    ) {
      setProvinceCode(provincesForDay[0].code);
    }
  }, [provincesForDay, provinceCode]);

  useEffect(() => {
    setLoadingDraw(true);
    fetchResultsByDate(date)
      .then((res) => {
        const mbRow = res.results.find((r) => r.region === 'MB');
        setDbXSMB(mbRow ? mapDbRowToXSMB(mbRow) : null);
        setDbProvinceDraws(
          res.results.filter((r) => r.region !== 'MB').map(mapDbRowToProvinceDraw)
        );
      })
      .catch(() => {
        setDbXSMB(null);
        setDbProvinceDraws([]);
      })
      .finally(() => setLoadingDraw(false));
  }, [date]);

  const activeProvince =
    provincesForDay.find((p) => p.code === provinceCode) || provincesForDay[0];

  const activeDraw = useMemo(() => {
    if (!activeProvince) return null;
    if (region === 'MB' && dbXSMB) {
      return { type: 'MB' as const, data: dbXSMB };
    }
    const found = dbProvinceDraws.find((d) => d.province.code === activeProvince.code);
    if (found) {
      return { type: 'PROVINCE' as const, data: found };
    }
    return null;
  }, [activeProvince, region, dbXSMB, dbProvinceDraws]);

  const matches: TicketMatchDetail[] = useMemo(() => {
    if (!hasChecked || !activeDraw || ticketNumber.trim().length < 2) return [];
    if (activeDraw.type === 'MB') {
      return checkTicketXSMB(ticketNumber, activeDraw.data);
    }
    return checkTicketProvince(ticketNumber, activeDraw.data);
  }, [hasChecked, activeDraw, ticketNumber]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (ticketNumber.replace(/\D/g, '').length >= 2) {
      setHasChecked(true);
    }
  };

  const handleFillSampleWinner = () => {
    if (!activeDraw) return;
    const sample = activeDraw.data.prizes.db[0];
    if (sample) {
      setTicketNumber(sample);
      setHasChecked(true);
    }
  };

  const requiredDigits = region === 'MB' ? 5 : 6;

  return (
    <section className="bg-white border border-slate-200 rounded-lg overflow-hidden">
      <div className="bg-[#C8102E] text-white px-5 py-3.5">
        <h2 className="text-lg font-bold">Dò Vé Số Kiến Thiết Trực Tuyến</h2>
        <p className="text-xs text-red-100 mt-0.5">
          Đối chiếu trực tiếp với dữ liệu kỳ quay lưu trong PostgreSQL từ Giải Tám/Bảy đến Giải Đặc Biệt
        </p>
      </div>

      <form onSubmit={handleSubmit} className="p-5 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Chọn Miền
            </label>
            <select
              value={region}
              onChange={(e) => {
                setRegion(e.target.value as RegionKey);
                setHasChecked(false);
              }}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md bg-white text-slate-900 font-medium"
            >
              <option value="MB">Miền Bắc (5 số)</option>
              <option value="MN">Miền Nam (6 số)</option>
              <option value="MT">Miền Trung (6 số)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Ngày mở thưởng
            </label>
            <input
              type="date"
              value={date}
              min="2016-01-01"
              max={todayISO}
              onChange={(e) => {
                if (e.target.value) {
                  setDate(e.target.value);
                  setHasChecked(false);
                }
              }}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md bg-white text-slate-900"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Tỉnh / Đài mở thưởng
            </label>
            <select
              value={activeProvince?.code || ''}
              onChange={(e) => {
                setProvinceCode(e.target.value);
                setHasChecked(false);
              }}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md bg-white text-slate-900 font-medium"
            >
              {provincesForDay.map((p) => (
                <option key={p.code} value={p.code}>
                  {p.name} ({p.code})
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-xs font-semibold text-slate-700">
              Nhập dãy số trên tờ vé ({requiredDigits} chữ số, hoặc ít nhất 2 số cuối)
            </label>
            <button
              type="button"
              disabled={!activeDraw}
              onClick={handleFillSampleWinner}
              className="inline-flex items-center gap-1 text-xs font-medium text-[#C8102E] hover:underline disabled:opacity-40 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
              Thử số trúng ĐB kỳ này
            </button>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={ticketNumber}
              onChange={(e) => {
                setTicketNumber(e.target.value.replace(/\D/g, ''));
                setHasChecked(false);
              }}
              placeholder={region === 'MB' ? 'Ví dụ: 58392' : 'Ví dụ: 482910'}
              className="flex-1 px-4 py-2.5 text-lg font-lottery font-bold tracking-widest border border-slate-300 rounded-md focus:outline-none focus:border-[#C8102E]"
            />
            <button
              type="submit"
              disabled={ticketNumber.length < 2 || loadingDraw}
              className="inline-flex items-center justify-center gap-2 px-6 py-2.5 text-sm font-semibold text-white bg-[#C8102E] hover:bg-[#A60D26] disabled:opacity-50 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Search className="w-4 h-4" aria-hidden="true" />
              {loadingDraw ? 'Đang tải...' : 'Dò Kết Quả'}
            </button>
          </div>
        </div>
      </form>

      {hasChecked && activeProvince && (
        <div className="px-5 pb-5">
          {matches.length > 0 ? (
            <div className="p-4 rounded-md bg-emerald-50 border border-emerald-200 space-y-3">
              <div className="flex items-center gap-2 text-emerald-900 font-bold text-base">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                <span>
                  Chúc mừng! Vé số{' '}
                  <span className="font-lottery underline">{ticketNumber}</span> trúng thưởng đài{' '}
                  {activeProvince.name} ngày {formatDateVN(date)}
                </span>
              </div>
              <div className="divide-y divide-emerald-200 bg-white rounded border border-emerald-200">
                {matches.map((m, idx) => (
                  <div
                    key={idx}
                    className="px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2 text-sm"
                  >
                    <div>
                      <span className="font-bold text-slate-900">{m.prizeLabel}</span>
                      {m.note && (
                        <span className="ml-2 text-xs text-slate-500">({m.note})</span>
                      )}
                      <div className="text-xs text-slate-500">
                        Số trúng:{' '}
                        <span className="font-lottery font-bold text-slate-800">
                          {m.matchedNumber}
                        </span>
                      </div>
                    </div>
                    <div className="font-lottery font-bold text-[#C8102E] text-base">
                      {m.prizeAmount}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-md bg-slate-50 border border-slate-200 flex items-start gap-2.5 text-sm text-slate-700">
              <XCircle className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold text-slate-900">
                  Vé số <span className="font-lottery">{ticketNumber}</span> chưa trúng giải nào
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Đài {activeProvince.name} ({activeProvince.code}) · Ngày mở thưởng{' '}
                  {formatDateVN(date)}. Chúc bạn may mắn lần sau!
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
};
