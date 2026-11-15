import React, { useEffect, useMemo, useState } from 'react';
import { AdminDashboard } from './components/AdminDashboard';
import { Header } from './components/Header';
import { LotteryTableMultiProvince } from './components/LotteryTableMultiProvince';
import { LotteryTableXSMB } from './components/LotteryTableXSMB';
import { ProvinceDetailView } from './components/ProvinceDetailView';
import { Sidebar } from './components/Sidebar';
import { StatisticsView } from './components/StatisticsView';
import { TicketChecker } from './components/TicketChecker';
import { VietlottView } from './components/VietlottView';
import { WorkspaceBar } from './components/WorkspaceBar';
import {
  DAY_NAMES_VI,
  XSMB_SCHEDULE,
  XSMN_SCHEDULE,
  XSMT_SCHEDULE,
} from './data/lotterySchedule';
import {
  DbLotteryRow,
  fetchResultsByDate,
  fetchSeoMetadata,
  mapDbRowToProvinceDraw,
  mapDbRowToXSMB,
  SeoRow,
} from './services/apiClient';
import { MainTab } from './types/lottery';
import {
  generateHomePageJsonLd,
  generateRegionalPageJsonLd,
  generateUtilityPageJsonLd,
} from './utils/jsonLdGenerator';
import { formatDateISO, formatDateVN, getDayNameVN, shiftDateISO } from './utils/lotteryEngine';
import { applyDynamicSeoHead } from './utils/seoHead';

const ORDERED_WEEKDAYS = [1, 2, 3, 4, 5, 6, 0];

function parsePathToState(pathname: string): { tab: MainTab; provinceSlug: string | null } {
  const clean = pathname.replace(/\/+$/, '') || '/';
  if (clean === '/') return { tab: 'home', provinceSlug: null };
  if (clean === '/xsmb') return { tab: 'xsmb', provinceSlug: null };
  if (clean === '/xsmn') return { tab: 'xsmn', provinceSlug: null };
  if (clean === '/xsmt') return { tab: 'xsmt', provinceSlug: null };
  if (clean === '/vietlott') return { tab: 'vietlott', provinceSlug: null };
  if (clean === '/do-ve-so') return { tab: 'do-ve-so', provinceSlug: null };
  if (clean === '/thong-ke') return { tab: 'thong-ke', provinceSlug: null };
  if (clean === '/admin') return { tab: 'admin', provinceSlug: null };
  if (clean === '/tinh') return { tab: 'tinh', provinceSlug: null };
  if (clean.startsWith('/tinh/')) {
    return { tab: 'tinh', provinceSlug: clean.slice('/tinh/'.length) };
  }
  return { tab: 'home', provinceSlug: null };
}

function tabToPath(tab: MainTab, provinceSlug: string | null): string {
  switch (tab) {
    case 'home':
      return '/';
    case 'xsmb':
      return '/xsmb';
    case 'xsmn':
      return '/xsmn';
    case 'xsmt':
      return '/xsmt';
    case 'vietlott':
      return '/vietlott';
    case 'do-ve-so':
      return '/do-ve-so';
    case 'thong-ke':
      return '/thong-ke';
    case 'admin':
      return '/admin';
    case 'tinh':
      return provinceSlug ? `/tinh/${provinceSlug}` : '/tinh';
  }
}

function LoadingSpinner() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Đang tải dữ liệu kết quả"
      className="bg-white border border-slate-200 rounded-lg py-14 px-6 flex flex-col items-center justify-center"
    >
      <div className="relative w-11 h-11">
        <svg
          className="w-11 h-11 animate-spin text-[#C8102E]"
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
      <span className="sr-only">Đang tải bảng kết quả từ cơ sở dữ liệu...</span>
    </div>
  );
}

function getTodayVNISOClient(): string {
  try {
    const fmt = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Ho_Chi_Minh',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const formatted = fmt.format(new Date());
    if (/^\d{4}-\d{2}-\d{2}$/.test(formatted)) return formatted;
  } catch {
    // Fallback to local clock
  }
  return formatDateISO(new Date());
}

export function App() {
  const todayISO = useMemo(() => getTodayVNISOClient(), []);
  const initialRoute = useMemo(() => parsePathToState(window.location.pathname), []);

  const [selectedDate, setSelectedDate] = useState<string>(todayISO);
  const [activeTab, setActiveTab] = useState<MainTab>(initialRoute.tab);
  const [provinceSlug, setProvinceSlug] = useState<string | null>(initialRoute.provinceSlug);
  const [checkerProvinceCode, setCheckerProvinceCode] = useState<string | null>(null);

  const [dbRows, setDbRows] = useState<DbLotteryRow[]>([]);
  const [loadingResults, setLoadingResults] = useState<boolean>(true);
  const [resultsError, setResultsError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState<number>(0);
  const [seoList, setSeoList] = useState<SeoRow[]>([]);

  useEffect(() => {
    const onPopState = () => {
      const parsed = parsePathToState(window.location.pathname);
      setActiveTab(parsed.tab);
      setProvinceSlug(parsed.provinceSlug);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    fetchSeoMetadata().then(setSeoList).catch(() => {});
  }, []);

  // Update SEO document title, meta tags, canonical URL & Schema.org JSON-LD dynamically
  useEffect(() => {
    const routePath = tabToPath(activeTab, provinceSlug);
    const origin = window.location.origin;
    const matched =
      seoList.find((s) => s.routePath === routePath) ||
      seoList.find((s) => s.routePath === '/');

    if (activeTab === 'home') {
      const payload = generateHomePageJsonLd({
        origin,
        date: selectedDate,
        draws: dbRows,
        customTitle: matched?.title,
        customDescription: matched?.description,
      });
      applyDynamicSeoHead(payload);
      return;
    }

    if (activeTab === 'xsmb' || activeTab === 'xsmn' || activeTab === 'xsmt') {
      const region = activeTab === 'xsmb' ? 'MB' : activeTab === 'xsmn' ? 'MN' : 'MT';
      const payload = generateRegionalPageJsonLd({
        origin,
        region,
        date: selectedDate,
        draws: dbRows,
      });
      applyDynamicSeoHead(payload);
      return;
    }

    // ProvinceDetailView and VietlottView manage their own rich draw-level JSON-LD once loaded
    if (activeTab === 'tinh' || activeTab === 'vietlott') {
      if (matched) {
        applyDynamicSeoHead(
          generateUtilityPageJsonLd({
            origin,
            path: routePath,
            title: matched.title,
            description: matched.description,
            breadcrumbName: activeTab === 'tinh' ? 'Xổ số theo tỉnh' : 'Vietlott',
          })
        );
      }
      return;
    }

    const utilityLabels: Record<string, string> = {
      'do-ve-so': 'Dò vé số',
      'thong-ke': 'Thống kê xổ số',
      admin: 'Quản trị hệ thống',
    };
    const title = matched?.title || 'xosothantai1.com – Kết Quả Xổ Số 3 Miền & Vietlott';
    const description =
      matched?.description ||
      'Tra cứu kết quả xổ số 3 miền Bắc, Trung, Nam, Vietlott và thống kê lịch sử 10 năm trên xosothantai1.com.';

    applyDynamicSeoHead(
      generateUtilityPageJsonLd({
        origin,
        path: routePath,
        title,
        description,
        breadcrumbName: utilityLabels[activeTab] || 'Tra cứu',
      })
    );
  }, [activeTab, provinceSlug, seoList, selectedDate, dbRows]);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setLoadingResults(true);
    setResultsError(null);
    fetchResultsByDate(selectedDate, controller.signal)
      .then((res) => {
        if (!active) return;
        setDbRows(res.results);
      })
      .catch((err: unknown) => {
        if (!active) return;
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setResultsError(
          err instanceof Error ? err.message : 'Không thể tải dữ liệu từ máy chủ.'
        );
      })
      .finally(() => {
        if (active) setLoadingResults(false);
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [selectedDate, reloadKey]);

  const xsmbResult = useMemo(() => {
    const row = dbRows.find((r) => r.region === 'MB');
    return row ? mapDbRowToXSMB(row) : null;
  }, [dbRows]);

  const xsmnResults = useMemo(
    () => dbRows.filter((r) => r.region === 'MN').map(mapDbRowToProvinceDraw),
    [dbRows]
  );

  const xsmtResults = useMemo(
    () => dbRows.filter((r) => r.region === 'MT').map(mapDbRowToProvinceDraw),
    [dbRows]
  );

  const navigate = (tab: MainTab, slug: string | null = null) => {
    setActiveTab(tab);
    setProvinceSlug(slug);
    const nextPath = tabToPath(tab, slug);
    if (window.location.pathname !== nextPath) {
      window.history.pushState({}, '', nextPath);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleQuickCheckProvince = (provinceCode: string) => {
    setCheckerProvinceCode(provinceCode);
    navigate('do-ve-so');
  };

  const handleOpenProvinceSlug = (slug: string) => {
    navigate('tinh', slug);
  };

  const showResultsSkeleton =
    loadingResults &&
    (activeTab === 'home' || activeTab === 'xsmb' || activeTab === 'xsmn' || activeTab === 'xsmt');

  return (
    <div className="min-h-screen flex flex-col bg-[#F4F6F9] text-slate-900">
      <Header activeTab={activeTab} onSelectTab={(t) => navigate(t)} />

      <WorkspaceBar
        selectedDate={selectedDate}
        todayISO={todayISO}
        onChangeDate={setSelectedDate}
        activeTab={activeTab}
        onSelectTab={(t) => navigate(t)}
      />

      <main className="flex-1 max-w-[1240px] w-full mx-auto px-4 sm:px-6 py-6">
        <div className="mb-5 flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-2">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              {activeTab === 'home' &&
                `xosothantai1.com — Kết Quả Xổ Số 3 Miền ${getDayNameVN(selectedDate)}, ${formatDateVN(
                  selectedDate
                )}`}
              {activeTab === 'xsmb' &&
                `Xổ Số Miền Bắc (${xsmbResult?.provinceName || 'Truyền thống'}) — ${formatDateVN(
                  selectedDate
                )}`}
              {activeTab === 'xsmn' &&
                `Xổ Số Miền Nam — ${getDayNameVN(selectedDate)}, ${formatDateVN(selectedDate)}`}
              {activeTab === 'xsmt' &&
                `Xổ Số Miền Trung — ${getDayNameVN(selectedDate)}, ${formatDateVN(selectedDate)}`}
              {activeTab === 'tinh' && 'Kết Quả Xổ Số Theo Tỉnh / Thành Phố'}
              {activeTab === 'vietlott' &&
                `Kết Quả Vietlott — ${getDayNameVN(selectedDate)}, ${formatDateVN(selectedDate)}`}
              {activeTab === 'do-ve-so' && 'Dò Vé Số Kiến Thiết Trực Tuyến'}
              {activeTab === 'thong-ke' && 'Thống Kê Xổ Số & Biểu Đồ Lịch Sử 10 Năm'}
              {activeTab === 'admin' && 'Quản Trị Hệ Thống xosothantai1.com'}
            </h1>
          </div>
          <div className="text-xs text-slate-500">
            Lịch quay: Miền Nam 16:15 · Miền Trung 17:15 · Vietlott 18:00 · Miền Bắc 18:15
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-8 space-y-6">
            {showResultsSkeleton && <LoadingSpinner />}

            {resultsError &&
              (activeTab === 'home' ||
                activeTab === 'xsmb' ||
                activeTab === 'xsmn' ||
                activeTab === 'xsmt') && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-800 flex items-center justify-between gap-3">
                  <span>{resultsError}</span>
                  <button
                    type="button"
                    onClick={() => setReloadKey((k) => k + 1)}
                    className="px-3 py-1.5 text-xs font-semibold bg-white border border-red-300 text-red-700 hover:bg-red-100 rounded-md shrink-0 cursor-pointer"
                  >
                    Thử lại
                  </button>
                </div>
              )}

            {!showResultsSkeleton && !resultsError && activeTab === 'home' && (
              <>
                {!xsmbResult && xsmnResults.length === 0 && xsmtResults.length === 0 && (
                  <div className="bg-white border border-slate-200 rounded-lg p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="text-sm text-slate-600">
                      Chưa có kết quả mở thưởng cho ngày{' '}
                      <span className="font-semibold text-slate-900">
                        {formatDateVN(selectedDate)}
                      </span>
                      . Hệ thống sẽ tự động cập nhật ngay khi có giải mới từ đài quay.
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedDate(shiftDateISO(selectedDate, -1))}
                      className="px-3 py-1.5 text-xs font-semibold text-[#C8102E] bg-red-50 hover:bg-red-100 rounded-md whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      Xem ngày hôm qua
                    </button>
                  </div>
                )}

                {xsmbResult && (
                  <LotteryTableXSMB
                    result={xsmbResult}
                    onQuickCheck={handleQuickCheckProvince}
                  />
                )}
                {xsmnResults.length > 0 && (
                  <LotteryTableMultiProvince
                    regionLabel="Miền Nam"
                    drawTime="16:15"
                    dateStr={selectedDate}
                    results={xsmnResults}
                    onQuickCheck={handleQuickCheckProvince}
                  />
                )}
                {xsmtResults.length > 0 && (
                  <LotteryTableMultiProvince
                    regionLabel="Miền Trung"
                    drawTime="17:15"
                    dateStr={selectedDate}
                    results={xsmtResults}
                    onQuickCheck={handleQuickCheckProvince}
                  />
                )}

                <section className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                  <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
                    <h2 className="text-base font-bold text-slate-900">
                      Lịch Mở Thưởng Xổ Số Kiến Thiết 3 Miền Trong Tuần
                    </h2>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs sm:text-sm border-collapse min-w-[540px]">
                      <thead>
                        <tr className="bg-slate-100 border-b border-slate-200 text-slate-700">
                          <th className="py-2 px-3 text-left font-bold border-r border-slate-200 w-24">
                            Thứ
                          </th>
                          <th className="py-2 px-3 text-left font-bold border-r border-slate-200">
                            Miền Nam (16:15)
                          </th>
                          <th className="py-2 px-3 text-left font-bold border-r border-slate-200">
                            Miền Trung (17:15)
                          </th>
                          <th className="py-2 px-3 text-left font-bold">Miền Bắc (18:15)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {ORDERED_WEEKDAYS.map((dow) => (
                          <tr key={dow} className="hover:bg-slate-50">
                            <td className="py-2 px-3 font-semibold text-slate-900 border-r border-slate-200 bg-slate-50/50">
                              {DAY_NAMES_VI[dow]}
                            </td>
                            <td className="py-2 px-3 text-slate-700 border-r border-slate-200">
                              {XSMN_SCHEDULE[dow].map((p) => p.name).join(', ')}
                            </td>
                            <td className="py-2 px-3 text-slate-700 border-r border-slate-200">
                              {XSMT_SCHEDULE[dow].map((p) => p.name).join(', ')}
                            </td>
                            <td className="py-2 px-3 font-medium text-[#C8102E]">
                              {XSMB_SCHEDULE[dow].name}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              </>
            )}

            {!showResultsSkeleton && !resultsError && activeTab === 'xsmb' && xsmbResult && (
              <LotteryTableXSMB
                result={xsmbResult}
                onQuickCheck={handleQuickCheckProvince}
              />
            )}

            {!showResultsSkeleton && !resultsError && activeTab === 'xsmn' && (
              <LotteryTableMultiProvince
                regionLabel="Miền Nam"
                drawTime="16:15"
                dateStr={selectedDate}
                results={xsmnResults}
                onQuickCheck={handleQuickCheckProvince}
              />
            )}

            {!showResultsSkeleton && !resultsError && activeTab === 'xsmt' && (
              <LotteryTableMultiProvince
                regionLabel="Miền Trung"
                drawTime="17:15"
                dateStr={selectedDate}
                results={xsmtResults}
                onQuickCheck={handleQuickCheckProvince}
              />
            )}

            {activeTab === 'tinh' && (
              <ProvinceDetailView
                selectedSlug={provinceSlug}
                onSelectProvinceSlug={handleOpenProvinceSlug}
                onQuickCheckProvince={handleQuickCheckProvince}
              />
            )}

            {activeTab === 'vietlott' && <VietlottView selectedDate={selectedDate} />}

            {activeTab === 'do-ve-so' && (
              <TicketChecker
                selectedDate={selectedDate}
                todayISO={todayISO}
                initialProvinceCode={checkerProvinceCode}
              />
            )}

            {activeTab === 'thong-ke' && <StatisticsView selectedDate={selectedDate} />}

            {activeTab === 'admin' && <AdminDashboard />}
          </div>

          <div className="lg:col-span-4">
            <Sidebar
              selectedDate={selectedDate}
              onSelectTab={(t) => navigate(t)}
              onQuickCheckProvince={handleQuickCheckProvince}
              onOpenProvinceSlug={handleOpenProvinceSlug}
            />
          </div>
        </div>
      </main>

      <footer className="bg-white border-t border-slate-200 mt-10">
        <div className="max-w-[1240px] mx-auto px-4 sm:px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
          <div className="font-medium text-slate-700">
            xosothantai1.com — Hệ thống tra cứu kết quả xổ số 3 miền, Vietlott &amp; thống kê lịch sử 10 năm
          </div>
          <div>
            Dữ liệu được lưu trữ trên PostgreSQL &amp; bộ nhớ đệm Redis. Đối chiếu vé gốc tại đại lý XSKT chính thức.
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
