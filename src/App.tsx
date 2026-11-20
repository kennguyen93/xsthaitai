import React, { useEffect, useMemo, useState } from 'react';
import { AdminDashboard } from './components/AdminDashboard';
import { Header } from './components/Header';
import { ProvinceDetailView } from './components/ProvinceDetailView';
import { RegionHistoryView } from './components/RegionHistoryView';
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
  mapDbRowToXSMB,
  SeoRow,
} from './services/apiClient';
import { MainTab, StatCategoryId } from './types/lottery';
import {
  generateHomePageJsonLd,
  generateRegionalPageJsonLd,
  generateUtilityPageJsonLd,
} from './utils/jsonLdGenerator';
import { formatDateISO, formatDateVN, getDayNameVN } from './utils/lotteryEngine';
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
  const [activeStatCategory, setActiveStatCategory] = useState<StatCategoryId>('loto-gan');
  const [provinceSlug, setProvinceSlug] = useState<string | null>(initialRoute.provinceSlug);
  const [checkerProvinceCode, setCheckerProvinceCode] = useState<string | null>(null);

  const [dbRows, setDbRows] = useState<DbLotteryRow[]>([]);
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
    fetchResultsByDate(selectedDate, controller.signal)
      .then((res) => {
        if (!active) return;
        setDbRows(res.results);
      })
      .catch(() => {
        if (!active) return;
        setDbRows([]);
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [selectedDate]);

  const xsmbResult = useMemo(() => {
    const row = dbRows.find((r) => r.region === 'MB');
    return row ? mapDbRowToXSMB(row) : null;
  }, [dbRows]);

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

  const handleSelectStatCategory = (category: StatCategoryId) => {
    setActiveStatCategory(category);
    navigate('thong-ke');
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F4F6F9] text-slate-900">
      <Header
        activeTab={activeTab}
        activeStatCategory={activeStatCategory}
        onSelectTab={(t) => navigate(t)}
        onSelectStatCategory={handleSelectStatCategory}
      />

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
            {activeTab === 'home' && (
              <>
                <RegionHistoryView
                  region="ALL"
                  selectedDate={selectedDate}
                  todayISO={todayISO}
                  onQuickCheck={handleQuickCheckProvince}
                />

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

            {activeTab === 'xsmb' && (
              <RegionHistoryView
                region="MB"
                selectedDate={selectedDate}
                todayISO={todayISO}
                onQuickCheck={handleQuickCheckProvince}
              />
            )}

            {activeTab === 'xsmn' && (
              <RegionHistoryView
                region="MN"
                selectedDate={selectedDate}
                todayISO={todayISO}
                onQuickCheck={handleQuickCheckProvince}
              />
            )}

            {activeTab === 'xsmt' && (
              <RegionHistoryView
                region="MT"
                selectedDate={selectedDate}
                todayISO={todayISO}
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

            {activeTab === 'vietlott' && (
              <VietlottView selectedDate={selectedDate} todayISO={todayISO} />
            )}

            {activeTab === 'do-ve-so' && (
              <TicketChecker
                selectedDate={selectedDate}
                todayISO={todayISO}
                initialProvinceCode={checkerProvinceCode}
              />
            )}

            {activeTab === 'thong-ke' && (
              <StatisticsView
                selectedDate={selectedDate}
                activeCategory={activeStatCategory}
                onSelectCategory={setActiveStatCategory}
              />
            )}

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
