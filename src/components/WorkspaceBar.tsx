import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Calendar, ChevronLeft, ChevronRight, ShieldCheck } from 'lucide-react';
import { MainTab } from '../types/lottery';
import { formatDateISO, formatDateVN, getDayNameVN, shiftDateISO } from '../utils/lotteryEngine';

interface WorkspaceBarProps {
  selectedDate: string;
  todayISO: string;
  onChangeDate: (date: string) => void;
  activeTab: MainTab;
  onSelectTab: (tab: MainTab) => void;
}

const TOOL_TABS: { id: MainTab; label: string }[] = [
  { id: 'home', label: 'Trực tiếp 3 Miền' },
  { id: 'xsmb', label: 'XSMB' },
  { id: 'xsmn', label: 'XSMN' },
  { id: 'xsmt', label: 'XSMT' },
  { id: 'tinh', label: 'Theo Tỉnh' },
  { id: 'vietlott', label: 'Vietlott' },
  { id: 'thong-ke', label: 'Thống kê 10 năm' },
];

const WEEKDAY_HEADERS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

function parseISOYearMonth(iso: string): { year: number; month: number } {
  const [y, m] = iso.split('-').map(Number);
  if (!y || !m) {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  }
  return { year: y, month: m - 1 };
}

export const WorkspaceBar: React.FC<WorkspaceBarProps> = ({
  selectedDate,
  todayISO,
  onChangeDate,
  activeTab,
  onSelectTab,
}) => {
  const isToday = selectedDate === todayISO;
  const minDate = '2016-01-01'; // 10-year historical lookup support
  const minYear = 2016;
  const maxYear = Number(todayISO.slice(0, 4)) || new Date().getFullYear();

  const [calendarOpen, setCalendarOpen] = useState(false);
  const initialYM = parseISOYearMonth(selectedDate);
  const [viewYear, setViewYear] = useState<number>(initialYM.year);
  const [viewMonth, setViewMonth] = useState<number>(initialYM.month);
  const pickerRef = useRef<HTMLDivElement>(null);

  // Sync viewed month/year whenever selectedDate changes
  useEffect(() => {
    const ym = parseISOYearMonth(selectedDate);
    setViewYear(ym.year);
    setViewMonth(ym.month);
  }, [selectedDate]);

  // Close popover on outside click or Escape
  useEffect(() => {
    if (!calendarOpen) return;
    const handlePointerDown = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setCalendarOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setCalendarOpen(false);
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [calendarOpen]);

  const calendarCells = useMemo(() => {
    const firstDay = new Date(viewYear, viewMonth, 1);
    // Convert JS getDay() (0=Sun..6=Sat) to Monday-first index (0=Mon..6=Sun)
    const startOffset = (firstDay.getDay() + 6) % 7;
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

    const cells: ({ day: number; iso: string; disabled: boolean } | null)[] = [];
    for (let i = 0; i < startOffset; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      const iso = formatDateISO(new Date(viewYear, viewMonth, d));
      const disabled = iso < minDate || iso > todayISO;
      cells.push({ day: d, iso, disabled });
    }
    return cells;
  }, [viewYear, viewMonth, minDate, todayISO]);

  const years = useMemo(() => {
    const list: number[] = [];
    for (let y = maxYear; y >= minYear; y--) list.push(y);
    return list;
  }, [minYear, maxYear]);

  const canGoPrevMonth = viewYear > minYear || viewMonth > 0;
  const maxMonth = Number(todayISO.slice(5, 7)) - 1;
  const canGoNextMonth = viewYear < maxYear || (viewYear === maxYear && viewMonth < maxMonth);

  const shiftMonth = (delta: number) => {
    const next = new Date(viewYear, viewMonth + delta, 1);
    const nextY = next.getFullYear();
    const nextM = next.getMonth();
    if (nextY < minYear) return;
    if (nextY > maxYear || (nextY === maxYear && nextM > maxMonth)) return;
    setViewYear(nextY);
    setViewMonth(nextM);
  };

  const handleSelectDay = (iso: string) => {
    if (iso < minDate || iso > todayISO) return;
    onChangeDate(iso);
    setCalendarOpen(false);
  };

  return (
    <div className="bg-white border-b border-slate-200 relative z-30">
      <div className="max-w-[1240px] mx-auto px-4 sm:px-6 py-2.5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        {/* Segmented sub-navigation */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 lg:pb-0">
          {TOOL_TABS.map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onSelectTab(tab.id)}
                className={`px-3 py-1.5 text-xs sm:text-sm font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  active
                    ? 'bg-[#C8102E] text-white'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => onSelectTab('admin')}
            className={`inline-flex items-center gap-1 px-3 py-1.5 text-xs sm:text-sm font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'admin'
                ? 'bg-slate-900 text-white'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />
            Quản trị
          </button>
        </div>

        {/* Date Picker & Quick Day Switcher */}
        <div className="flex items-center gap-1.5 shrink-0" ref={pickerRef}>
          <button
            type="button"
            onClick={() => {
              const prev = shiftDateISO(selectedDate, -1);
              if (prev >= minDate) onChangeDate(prev);
            }}
            className="p-1.5 border border-slate-200 rounded-md text-slate-600 hover:text-slate-900 hover:bg-slate-50 cursor-pointer"
            title="Ngày trước"
            aria-label="Ngày trước"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <div className="relative">
            <button
              type="button"
              onClick={() => {
                const ym = parseISOYearMonth(selectedDate);
                setViewYear(ym.year);
                setViewMonth(ym.month);
                setCalendarOpen((prev) => !prev);
              }}
              aria-expanded={calendarOpen}
              aria-haspopup="dialog"
              aria-label="Chọn ngày mở thưởng"
              className={`inline-flex items-center gap-2 px-3 py-1.5 border rounded-md text-xs sm:text-sm font-medium cursor-pointer transition-colors ${
                calendarOpen
                  ? 'border-[#C8102E] bg-white text-slate-900 ring-2 ring-[#C8102E]/15'
                  : 'border-slate-200 bg-slate-50 hover:bg-white text-slate-800'
              }`}
            >
              <Calendar className="w-3.5 h-3.5 text-[#C8102E] shrink-0" aria-hidden="true" />
              <span className="whitespace-nowrap">
                {getDayNameVN(selectedDate)}, {formatDateVN(selectedDate)}
              </span>
            </button>

            {calendarOpen && (
              <div
                role="dialog"
                aria-label="Lịch chọn ngày quay thưởng"
                className="absolute right-0 mt-2 w-72 bg-white border border-slate-200 rounded-lg shadow-xl p-3 z-50"
              >
                {/* Month & Year Navigation */}
                <div className="flex items-center justify-between gap-1.5 mb-2.5">
                  <button
                    type="button"
                    onClick={() => shiftMonth(-1)}
                    disabled={!canGoPrevMonth}
                    className="p-1.5 rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-35 disabled:cursor-not-allowed cursor-pointer"
                    aria-label="Tháng trước"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>

                  <div className="flex items-center gap-1.5">
                    <select
                      aria-label="Chọn tháng"
                      value={viewMonth}
                      onChange={(e) => {
                        const m = Number(e.target.value);
                        if (viewYear === maxYear && m > maxMonth) {
                          setViewMonth(maxMonth);
                        } else {
                          setViewMonth(m);
                        }
                      }}
                      className="px-2 py-1 text-xs font-semibold text-slate-800 bg-slate-50 border border-slate-200 rounded-md cursor-pointer focus:outline-none focus:border-[#C8102E]"
                    >
                      {Array.from({ length: 12 }, (_, m) => {
                        const disabledMonth = viewYear === maxYear && m > maxMonth;
                        return (
                          <option key={m} value={m} disabled={disabledMonth}>
                            Tháng {m + 1}
                          </option>
                        );
                      })}
                    </select>

                    <select
                      aria-label="Chọn năm"
                      value={viewYear}
                      onChange={(e) => {
                        const y = Number(e.target.value);
                        setViewYear(y);
                        if (y === maxYear && viewMonth > maxMonth) {
                          setViewMonth(maxMonth);
                        }
                      }}
                      className="px-2 py-1 text-xs font-semibold text-slate-800 bg-slate-50 border border-slate-200 rounded-md cursor-pointer focus:outline-none focus:border-[#C8102E]"
                    >
                      {years.map((y) => (
                        <option key={y} value={y}>
                          {y}
                        </option>
                      ))}
                    </select>
                  </div>

                  <button
                    type="button"
                    onClick={() => shiftMonth(1)}
                    disabled={!canGoNextMonth}
                    className="p-1.5 rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-35 disabled:cursor-not-allowed cursor-pointer"
                    aria-label="Tháng sau"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>

                {/* Weekday Headers */}
                <div className="grid grid-cols-7 gap-1 mb-1 text-center">
                  {WEEKDAY_HEADERS.map((wd) => (
                    <div
                      key={wd}
                      className={`text-[11px] font-bold py-1 ${
                        wd === 'CN' ? 'text-[#C8102E]' : 'text-slate-500'
                      }`}
                    >
                      {wd}
                    </div>
                  ))}
                </div>

                {/* Days Grid */}
                <div className="grid grid-cols-7 gap-1">
                  {calendarCells.map((cell, idx) => {
                    if (!cell) {
                      return <div key={`empty-${idx}`} className="h-8" />;
                    }
                    const isSelected = cell.iso === selectedDate;
                    const isCurrentToday = cell.iso === todayISO;
                    return (
                      <button
                        key={cell.iso}
                        type="button"
                        disabled={cell.disabled}
                        onClick={() => handleSelectDay(cell.iso)}
                        className={`h-8 w-full rounded-md text-xs font-medium transition-colors flex items-center justify-center ${
                          cell.disabled
                            ? 'text-slate-300 cursor-not-allowed'
                            : isSelected
                            ? 'bg-[#C8102E] text-white font-bold cursor-pointer'
                            : isCurrentToday
                            ? 'border border-[#C8102E] text-[#C8102E] font-bold hover:bg-red-50 cursor-pointer'
                            : 'text-slate-700 hover:bg-slate-100 cursor-pointer'
                        }`}
                      >
                        {cell.day}
                      </button>
                    );
                  })}
                </div>

                {/* Footer Quick Actions */}
                <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleSelectDay(todayISO)}
                      className="px-2 py-1 text-xs font-semibold text-[#C8102E] bg-red-50 hover:bg-red-100 rounded cursor-pointer"
                    >
                      Hôm nay
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSelectDay(shiftDateISO(todayISO, -1))}
                      className="px-2 py-1 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded cursor-pointer"
                    >
                      Hôm qua
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCalendarOpen(false)}
                    className="px-2 py-1 text-xs font-medium text-slate-500 hover:text-slate-800 cursor-pointer"
                  >
                    Đóng
                  </button>
                </div>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => {
              const next = shiftDateISO(selectedDate, 1);
              if (next <= todayISO) onChangeDate(next);
            }}
            disabled={isToday}
            className="p-1.5 border border-slate-200 rounded-md text-slate-600 hover:text-slate-900 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            title="Ngày sau"
            aria-label="Ngày sau"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          {!isToday && (
            <button
              type="button"
              onClick={() => onChangeDate(todayISO)}
              className="ml-1 px-2.5 py-1.5 text-xs font-semibold text-[#C8102E] bg-red-50 hover:bg-red-100 rounded-md whitespace-nowrap shrink-0 cursor-pointer"
            >
              Hôm nay
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
