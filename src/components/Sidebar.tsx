import React, { useEffect, useMemo, useState } from 'react';
import { BarChart3, CalendarClock, ExternalLink, Search } from 'lucide-react';
import {
  AdRow,
  DbProvinceRow,
  fetchActiveAds,
  fetchProvinces,
  fetchVietlottByDate,
  mapVietlottRows,
} from '../services/apiClient';
import { MainTab, RegionKey } from '../types/lottery';
import {
  checkTicketProvince,
  checkTicketXSMB,
  formatDateVN,
  generateProvinceDrawResult,
  generateXSMBResult,
  getDayNameVN,
  getProvincesForDate,
} from '../utils/lotteryEngine';

interface SidebarProps {
  selectedDate: string;
  onSelectTab: (tab: MainTab) => void;
  onQuickCheckProvince: (provinceCode: string) => void;
  onOpenProvinceSlug: (slug: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  selectedDate,
  onSelectTab,
  onQuickCheckProvince,
  onOpenProvinceSlug,
}) => {
  const [quickRegion, setQuickRegion] = useState<RegionKey>('MB');
  const [quickInput, setQuickInput] = useState('');
  const [quickResult, setQuickResult] = useState<string | null>(null);
  const [provincesList, setProvincesList] = useState<DbProvinceRow[]>([]);
  const [ads, setAds] = useState<AdRow[]>([]);
  const [jackpots, setJackpots] = useState<{ mega: string; power: string; megaP: string; powerP: string }>({
    mega: '18.450.000.000đ',
    power: '74.210.500.000đ',
    megaP: '#01285',
    powerP: '#01120',
  });

  useEffect(() => {
    fetchProvinces().then(setProvincesList).catch(() => {});
    fetchActiveAds().then(setAds).catch(() => {});
  }, []);

  useEffect(() => {
    fetchVietlottByDate(selectedDate)
      .then((res) => {
        const mapped = mapVietlottRows(res.results);
        if (mapped.mega && mapped.power) {
          setJackpots({
            mega: mapped.mega.jackpotValue,
            power: mapped.power.jackpot1Value,
            megaP: mapped.mega.period,
            powerP: mapped.power.period,
          });
        }
      })
      .catch(() => {});
  }, [selectedDate]);

  const mbProv = useMemo(() => getProvincesForDate(selectedDate, 'MB'), [selectedDate]);
  const mnProvs = useMemo(() => getProvincesForDate(selectedDate, 'MN'), [selectedDate]);
  const mtProvs = useMemo(() => getProvincesForDate(selectedDate, 'MT'), [selectedDate]);

  const slugForCode = (code: string) => {
    const found = provincesList.find((p) => p.code === code);
    return found?.slug || `xoso-${code.toLowerCase()}`;
  };

  const handleQuickVerify = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = quickInput.replace(/\D/g, '');
    if (clean.length < 2) {
      setQuickResult('Nhập tối thiểu 2 chữ số cuối của vé.');
      return;
    }

    if (quickRegion === 'MB') {
      const res = generateXSMBResult(selectedDate);
      const hits = checkTicketXSMB(clean, res);
      setQuickResult(
        hits.length > 0
          ? `Trúng ${hits[0].prizeLabel} (${hits[0].prizeAmount})`
          : `Vé ${clean} chưa trúng XSMB (${res.provinceName}).`
      );
    } else {
      const provs = quickRegion === 'MN' ? mnProvs : mtProvs;
      const allHits: string[] = [];
      provs.forEach((p) => {
        const res = generateProvinceDrawResult(selectedDate, p);
        const hits = checkTicketProvince(clean, res);
        if (hits.length > 0) {
          allHits.push(`${p.name}: ${hits[0].prizeLabel}`);
        }
      });
      setQuickResult(
        allHits.length > 0
          ? `Trúng thưởng tại ${allHits.join(', ')}`
          : `Vé ${clean} chưa trúng các đài ${quickRegion === 'MN' ? 'Miền Nam' : 'Miền Trung'}.`
      );
    }
  };

  const sidebarAds = ads.filter((a) => a.slotKey === 'sidebar_top');

  return (
    <aside className="space-y-5">
      {/* Quick Ticket Checker Box */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-4 py-2.5 bg-slate-900 text-white text-sm font-bold flex items-center gap-2">
          <Search className="w-4 h-4 text-red-400" aria-hidden="true" />
          Dò Vé Số Nhanh
        </div>
        <form onSubmit={handleQuickVerify} className="p-4 space-y-3">
          <div className="grid grid-cols-3 gap-1 bg-slate-100 p-0.5 rounded-md">
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
                onClick={() => {
                  setQuickRegion(r.id);
                  setQuickResult(null);
                }}
                className={`py-1.5 text-xs font-semibold rounded transition-colors cursor-pointer ${
                  quickRegion === r.id
                    ? 'bg-white text-[#C8102E] shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>

          <input
            type="text"
            inputMode="numeric"
            maxLength={6}
            value={quickInput}
            onChange={(e) => {
              setQuickInput(e.target.value.replace(/\D/g, ''));
              setQuickResult(null);
            }}
            placeholder="Nhập số vé (2–6 số)..."
            className="w-full px-3 py-2 text-sm font-lottery font-bold border border-slate-300 rounded-md focus:outline-none focus:border-[#C8102E]"
          />

          <button
            type="submit"
            className="w-full py-2 text-xs font-semibold text-white bg-[#C8102E] hover:bg-[#A60D26] rounded-md transition-colors cursor-pointer"
          >
            Kiểm tra ngay
          </button>

          {quickResult && (
            <div className="p-2.5 text-xs rounded bg-slate-50 border border-slate-200 text-slate-800 font-medium">
              {quickResult}
            </div>
          )}

          <button
            type="button"
            onClick={() => onSelectTab('do-ve-so')}
            className="block w-full text-center text-xs font-medium text-slate-500 hover:text-[#C8102E] cursor-pointer"
          >
            Mở trình dò vé chi tiết theo tỉnh →
          </button>
        </form>
      </div>

      {/* Lịch Mở Thưởng Hôm Nay (links directly to individual province page) */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 text-sm font-bold text-slate-900 flex items-center gap-2">
          <CalendarClock className="w-4 h-4 text-[#C8102E]" aria-hidden="true" />
          Đài Mở Thưởng {getDayNameVN(selectedDate)}
        </div>
        <div className="p-4 space-y-3 text-xs sm:text-sm">
          <div>
            <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
              <span className="font-semibold text-slate-700">Miền Nam</span>
              <span className="font-lottery">16:15</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {mnProvs.map((p) => (
                <button
                  key={p.code}
                  type="button"
                  onClick={() => onOpenProvinceSlug(slugForCode(p.code))}
                  className="text-xs font-medium text-[#C8102E] hover:underline cursor-pointer"
                >
                  {p.name}
                </button>
              ))}
            </div>
          </div>

          <div className="border-t border-slate-100 pt-2.5">
            <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
              <span className="font-semibold text-slate-700">Miền Trung</span>
              <span className="font-lottery">17:15</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {mtProvs.map((p) => (
                <button
                  key={p.code}
                  type="button"
                  onClick={() => onOpenProvinceSlug(slugForCode(p.code))}
                  className="text-xs font-medium text-[#C8102E] hover:underline cursor-pointer"
                >
                  {p.name}
                </button>
              ))}
            </div>
          </div>

          <div className="border-t border-slate-100 pt-2.5">
            <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
              <span className="font-semibold text-slate-700">Miền Bắc</span>
              <span className="font-lottery">18:15</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {mbProv.map((p) => (
                <button
                  key={p.code}
                  type="button"
                  onClick={() => onOpenProvinceSlug(slugForCode(p.code))}
                  className="text-xs font-medium text-[#C8102E] hover:underline cursor-pointer"
                >
                  {p.name} (Truyền thống)
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Vietlott Jackpot Summary */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 text-sm font-bold text-slate-900">
          Jackpot Vietlott — {formatDateVN(selectedDate)}
        </div>
        <div className="p-4 space-y-3">
          <div>
            <div className="text-xs text-slate-500">Power 6/55 · Kỳ {jackpots.powerP}</div>
            <div className="font-lottery text-base font-bold text-[#C8102E] mt-0.5">
              {jackpots.power}
            </div>
          </div>
          <div className="border-t border-slate-100 pt-2.5">
            <div className="text-xs text-slate-500">Mega 6/45 · Kỳ {jackpots.megaP}</div>
            <div className="font-lottery text-base font-bold text-slate-900 mt-0.5">
              {jackpots.mega}
            </div>
          </div>
          <button
            type="button"
            onClick={() => onSelectTab('vietlott')}
            className="w-full py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors cursor-pointer"
          >
            Xem chi tiết Vietlott
          </button>
        </div>
      </div>

      {/* Managed Ads Slot */}
      {sidebarAds.map((ad) => (
        <div
          key={ad.id}
          className="bg-white border border-slate-200 rounded-lg p-4 space-y-2"
        >
          <div className="text-[11px] font-medium text-slate-400">Thông tin tài trợ</div>
          <a
            href={ad.targetUrl}
            onClick={(e) => {
              fetch(`/api/ads/${ad.id}/click`, { method: 'POST' }).catch(() => {});
              if (ad.targetUrl.startsWith('/')) {
                e.preventDefault();
                if (ad.targetUrl === '/do-ve-so') onSelectTab('do-ve-so');
                else if (ad.targetUrl === '/thong-ke') onSelectTab('thong-ke');
                else onQuickCheckProvince('XSHN');
              }
            }}
            className="block group"
          >
            <div className="text-sm font-bold text-slate-900 group-hover:text-[#C8102E] flex items-center justify-between gap-2">
              <span>{ad.title}</span>
              <ExternalLink className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            </div>
            <p className="text-xs text-slate-500 mt-1">{ad.altText}</p>
          </a>
        </div>
      ))}

      {/* Thống Kê Shortcut */}
      <div className="bg-white border border-slate-200 rounded-lg p-4">
        <div className="flex items-center gap-2 text-sm font-bold text-slate-900 mb-1.5">
          <BarChart3 className="w-4 h-4 text-[#C8102E]" aria-hidden="true" />
          Thống Kê Xổ Số 10 Năm
        </div>
        <p className="text-xs text-slate-500 mb-3">
          Xem biểu đồ tần suất, Lô Gan, Giải Đặc Biệt và lịch sử quay thưởng 3 miền tới 10 năm.
        </p>
        <button
          type="button"
          onClick={() => onSelectTab('thong-ke')}
          className="w-full py-2 px-3 text-xs font-semibold text-[#C8102E] bg-red-50 hover:bg-red-100 rounded-md cursor-pointer transition-colors"
        >
          Xem thống kê 10 năm
        </button>
      </div>
    </aside>
  );
};
