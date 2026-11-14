import React, { useEffect, useState } from 'react';
import { Calendar, MapPin } from 'lucide-react';
import {
  DbLotteryRow,
  DbProvinceRow,
  fetchProvinceHistory,
  fetchProvinces,
  mapDbRowToProvinceDraw,
  mapDbRowToXSMB,
} from '../services/apiClient';
import { LotteryTableMultiProvince } from './LotteryTableMultiProvince';
import { LotteryTableXSMB } from './LotteryTableXSMB';
import { generateProvincePageJsonLd } from '../utils/jsonLdGenerator';
import { applyDynamicSeoHead } from '../utils/seoHead';

interface ProvinceDetailViewProps {
  selectedSlug: string | null;
  onSelectProvinceSlug: (slug: string) => void;
  onQuickCheckProvince: (provinceCode: string) => void;
}

const DAY_SHORT: Record<number, string> = {
  0: 'CN',
  1: 'T2',
  2: 'T3',
  3: 'T4',
  4: 'T5',
  5: 'T6',
  6: 'T7',
};

export const ProvinceDetailView: React.FC<ProvinceDetailViewProps> = ({
  selectedSlug,
  onSelectProvinceSlug,
  onQuickCheckProvince,
}) => {
  const [provinces, setProvinces] = useState<DbProvinceRow[]>([]);
  const [activeProvince, setActiveProvince] = useState<DbProvinceRow | null>(null);
  const [draws, setDraws] = useState<DbLotteryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchProvinces()
      .then((list) => {
        setProvinces(list);
        if (!selectedSlug && list.length > 0) {
          onSelectProvinceSlug(list[0].slug);
        }
      })
      .catch(() => setProvinces([]));
  }, [selectedSlug, onSelectProvinceSlug]);

  useEffect(() => {
    const slugToLoad = selectedSlug || provinces[0]?.slug;
    if (!slugToLoad) return;

    setLoading(true);
    setError(null);
    fetchProvinceHistory(slugToLoad, 8)
      .then((res) => {
        setActiveProvince(res.province);
        setDraws(res.draws);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Không thể tải dữ liệu tỉnh.');
      })
      .finally(() => setLoading(false));
  }, [selectedSlug, provinces]);

  useEffect(() => {
    if (!activeProvince || loading) return;
    const payload = generateProvincePageJsonLd({
      origin: window.location.origin,
      province: activeProvince,
      draws,
    });
    applyDynamicSeoHead(payload);
  }, [activeProvince, draws, loading]);

  const groupedByRegion = {
    MB: provinces.filter((p) => p.region === 'MB'),
    MN: provinces.filter((p) => p.region === 'MN'),
    MT: provinces.filter((p) => p.region === 'MT'),
  };

  return (
    <div className="space-y-5">
      {/* Province Directory Selector */}
      <section className="bg-white border border-slate-200 rounded-lg p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              Tra Cứu Kết Quả Theo Từng Tỉnh / Thành Phố
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Chọn đài mở thưởng để xem lịch quay và các kỳ gần nhất từ cơ sở dữ liệu PostgreSQL
            </p>
          </div>
          {activeProvince && (
            <div className="text-xs font-medium text-slate-600 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-[#C8102E]" />
              <span>
                Lịch quay: {activeProvince.drawDays.map((d) => DAY_SHORT[d]).join(', ')} lúc{' '}
                {activeProvince.drawTime}
              </span>
            </div>
          )}
        </div>

        <div className="space-y-3">
          {(
            [
              { key: 'MB', label: 'Miền Bắc' },
              { key: 'MN', label: 'Miền Nam' },
              { key: 'MT', label: 'Miền Trung' },
            ] as const
          ).map((grp) => (
            <div key={grp.key}>
              <div className="text-xs font-bold text-slate-500 mb-1.5">{grp.label}</div>
              <div className="flex flex-wrap gap-1.5">
                {groupedByRegion[grp.key].map((p) => {
                  const isActive = activeProvince?.slug === p.slug;
                  return (
                    <button
                      key={p.code}
                      type="button"
                      onClick={() => onSelectProvinceSlug(p.slug)}
                      className={`px-2.5 py-1 text-xs font-medium rounded border transition-colors cursor-pointer ${
                        isActive
                          ? 'bg-[#C8102E] text-white border-[#C8102E]'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {p.name}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </section>

      {loading && (
        <div className="bg-white border border-slate-200 rounded-lg p-8 text-center text-sm text-slate-500">
          Đang tải lịch sử các kỳ quay của đài...
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-800">
          {error}
        </div>
      )}

      {!loading && !error && activeProvince && draws.length === 0 && (
        <div className="bg-white border border-slate-200 rounded-lg p-8 text-center text-sm text-slate-500">
          Chưa có kỳ quay nào được lưu cho đài {activeProvince.name}.
        </div>
      )}

      {!loading && !error && activeProvince && draws.length > 0 && (
        <div className="space-y-6">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-800">
            <MapPin className="w-4 h-4 text-[#C8102E]" />
            <span>
              {draws.length} kỳ quay gần nhất — Xổ Số {activeProvince.name} ({activeProvince.code})
            </span>
          </div>

          {draws.map((row) =>
            row.region === 'MB' ? (
              <LotteryTableXSMB
                key={`${row.drawDate}-${row.provinceCode}`}
                result={mapDbRowToXSMB(row)}
                onQuickCheck={onQuickCheckProvince}
              />
            ) : (
              <LotteryTableMultiProvince
                key={`${row.drawDate}-${row.provinceCode}`}
                regionLabel={row.region === 'MN' ? 'Miền Nam' : 'Miền Trung'}
                drawTime={activeProvince.drawTime}
                dateStr={row.drawDate}
                results={[mapDbRowToProvinceDraw(row)]}
                onQuickCheck={onQuickCheckProvince}
              />
            )
          )}
        </div>
      )}
    </div>
  );
};
