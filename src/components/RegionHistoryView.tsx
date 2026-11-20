import React, { useEffect, useMemo, useState } from 'react';
import { Calendar, ChevronDown } from 'lucide-react';
import {
  DbLotteryRow,
  fetchRegionHistory,
  mapDbRowToProvinceDraw,
  mapDbRowToXSMB,
} from '../services/apiClient';
import { formatDateVN, getDayNameVN, shiftDateISO } from '../utils/lotteryEngine';
import { LotteryTableMultiProvince } from './LotteryTableMultiProvince';
import { LotteryTableXSMB } from './LotteryTableXSMB';

interface RegionHistoryViewProps {
  region: 'MB' | 'MN' | 'MT' | 'ALL';
  selectedDate: string;
  todayISO: string;
  onQuickCheck: (provinceCode: string) => void;
}

const MIN_ARCHIVE_DATE = '2016-01-01';

const REGION_META: Record<
  'MB' | 'MN' | 'MT' | 'ALL',
  { label: string; drawTime: string; pageSize: number }
> = {
  ALL: { label: 'Xổ Số 3 Miền', drawTime: '16:15 – 18:15', pageSize: 4 },
  MB: { label: 'Xổ Số Miền Bắc', drawTime: '18:15', pageSize: 7 },
  MN: { label: 'Xổ Số Miền Nam', drawTime: '16:15', pageSize: 5 },
  MT: { label: 'Xổ Số Miền Trung', drawTime: '17:15', pageSize: 5 },
};

export const RegionHistoryView: React.FC<RegionHistoryViewProps> = ({
  region,
  selectedDate,
  todayISO,
  onQuickCheck,
}) => {
  const meta = REGION_META[region];
  const pageSize = meta.pageSize;

  const [draws, setDraws] = useState<DbLotteryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nextCursorDate, setNextCursorDate] = useState<string>(() =>
    shiftDateISO(selectedDate, -pageSize)
  );
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setLoading(true);
    setError(null);
    setDraws([]);
    setNextCursorDate(shiftDateISO(selectedDate, -pageSize));

    fetchRegionHistory(region, selectedDate, pageSize, controller.signal)
      .then((res) => {
        if (!active) return;
        setDraws(res.draws);
      })
      .catch((err: unknown) => {
        if (!active) return;
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setError(
          err instanceof Error ? err.message : `Không thể tải kết quả ${meta.label}.`
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [region, selectedDate, pageSize, reloadKey, meta.label]);

  const handleLoadMore = async () => {
    if (loadingMore || nextCursorDate < MIN_ARCHIVE_DATE) return;
    setLoadingMore(true);
    setError(null);
    try {
      const res = await fetchRegionHistory(region, nextCursorDate, pageSize);
      setDraws((prev) => {
        const map = new Map<string, DbLotteryRow>();
        for (const row of prev) map.set(`${row.drawDate}:${row.provinceCode}`, row);
        for (const row of res.draws) map.set(`${row.drawDate}:${row.provinceCode}`, row);
        const regionOrder: Record<string, number> = { MB: 0, MN: 1, MT: 2 };
        return Array.from(map.values()).sort((a, b) => {
          const cmp = b.drawDate.localeCompare(a.drawDate);
          if (cmp !== 0) return cmp;
          return (regionOrder[a.region] ?? 9) - (regionOrder[b.region] ?? 9);
        });
      });
      setNextCursorDate(shiftDateISO(nextCursorDate, -pageSize));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Không thể tải thêm các ngày hôm trước.');
    } finally {
      setLoadingMore(false);
    }
  };

  const groupedByDate = useMemo(() => {
    const map = new Map<string, DbLotteryRow[]>();
    for (const row of draws) {
      const list = map.get(row.drawDate) || [];
      list.push(row);
      map.set(row.drawDate, list);
    }
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [draws]);

  if (loading) {
    return (
      <div
        role="status"
        aria-live="polite"
        aria-label={`Đang tải kết quả ${meta.label}`}
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
          Đang tải {meta.label} từ ngày {formatDateVN(selectedDate)} trở về trước...
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

  const hasSelectedDateDraw = groupedByDate.some(([d]) => d === selectedDate);
  const canLoadMore = nextCursorDate >= MIN_ARCHIVE_DATE;

  return (
    <div className="space-y-6">
      {!hasSelectedDateDraw && (
        <div className="bg-white border border-slate-200 rounded-lg px-4 py-3 flex items-center gap-2.5 text-xs sm:text-sm text-slate-600">
          <Calendar className="w-4 h-4 text-[#C8102E] shrink-0" aria-hidden="true" />
          <span>
            {selectedDate === todayISO
              ? `Kỳ quay ${meta.label} hôm nay (${formatDateVN(selectedDate)}) chưa mở thưởng xong (${meta.drawTime}). Dưới đây là kết quả các ngày hôm trước:`
              : `Chưa có dữ liệu ${meta.label} cho ngày ${formatDateVN(selectedDate)}. Dưới đây là kết quả các ngày hôm trước:`}
          </span>
        </div>
      )}

      {groupedByDate.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-lg p-6 text-center text-sm text-slate-500">
          Chưa có kết quả {meta.label} trong khoảng thời gian này.
        </div>
      ) : (
        groupedByDate.map(([dateStr, rows]) => {
          const mbRow = rows.find((r) => r.region === 'MB');
          const mnRows = rows.filter((r) => r.region === 'MN').map(mapDbRowToProvinceDraw);
          const mtRows = rows.filter((r) => r.region === 'MT').map(mapDbRowToProvinceDraw);

          return (
            <div key={dateStr} className="space-y-4">
              {region === 'ALL' && (
                <div className="flex items-center justify-between px-1 pt-1 border-b border-slate-200 pb-1.5">
                  <h2 className="text-sm sm:text-base font-bold text-slate-800 flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-[#C8102E]" aria-hidden="true" />
                    <span>
                      {getDayNameVN(dateStr)}, ngày {formatDateVN(dateStr)}
                    </span>
                  </h2>
                  {dateStr === todayISO && (
                    <span className="text-[11px] font-semibold text-[#C8102E] bg-red-50 px-2 py-0.5 rounded">
                      Hôm nay
                    </span>
                  )}
                </div>
              )}

              {mbRow && (
                <LotteryTableXSMB
                  result={mapDbRowToXSMB(mbRow)}
                  onQuickCheck={onQuickCheck}
                />
              )}

              {mnRows.length > 0 && (
                <LotteryTableMultiProvince
                  regionLabel="Miền Nam"
                  drawTime="16:15"
                  dateStr={dateStr}
                  results={mnRows}
                  onQuickCheck={onQuickCheck}
                />
              )}

              {mtRows.length > 0 && (
                <LotteryTableMultiProvince
                  regionLabel="Miền Trung"
                  drawTime="17:15"
                  dateStr={dateStr}
                  results={mtRows}
                  onQuickCheck={onQuickCheck}
                />
              )}
            </div>
          );
        })
      )}

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
              : `Xem thêm ${pageSize} ngày hôm trước`}
          </button>
        </div>
      )}
    </div>
  );
};
