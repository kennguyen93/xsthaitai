import React, { useCallback, useEffect, useState } from 'react';
import {
  Activity,
  CheckCircle2,
  Clock,
  Database,
  Download,
  ExternalLink,
  Lock,
  LogIn,
  LogOut,
  RefreshCw,
  Save,
  ShieldAlert,
  Trash2,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import type { AdRow, DbLotteryRow, SeoRow } from '../services/apiClient';
import { formatDateVN, getTodayISOClient } from '../utils/dateHelpers';

interface AutoSyncState {
  vnTime: {
    dateStr: string;
    formattedTime: string;
  };
  timezone: string;
  schedulerConfig: {
    autoSyncEnabled: boolean;
    pollIntervalSeconds: number;
    preStartMinutes: number;
    cloudSchedulerEndpoint: string;
    hasCronSecret: boolean;
    activeInMemoryLocks: string[];
  };
  windows: {
    region: 'MN' | 'MT' | 'MB';
    label: string;
    scheduledStart: string;
    drawStart: string;
    scheduledEnd: string;
  }[];
  sessions: {
    id: number;
    drawDate: string;
    region: 'MN' | 'MT' | 'MB';
    status: string;
    scheduledStart: string;
    drawStart: string;
    scheduledEnd: string;
    provincesExpected: number;
    provincesCompleted: number;
    pollCount: number;
    apiRequestsCount: number;
    lastPollAt: string | null;
    completedAt: string | null;
    lockedBy: string;
    lastError: string;
  }[];
  todayProvincesProgress: {
    region: string;
    provinceCode: string;
    provinceName: string;
    syncStatus: string;
    prizesFound: number;
    prizesExpected: number;
    isVerified: boolean;
    version: number;
    source: string;
    updatedAt: string;
  }[];
  rateLimiter: Record<string, { requestsInLastMinute: number }>;
  recentLogs: {
    id: number;
    providerKey: string;
    region: string;
    targetDate: string;
    syncMode: string;
    endpointUrl: string;
    httpStatus: number | null;
    status: string;
    recordsSynced: number;
    prizesFound: number;
    prizesExpected: number;
    attempts: number;
    durationMs: number;
    errorMessage: string;
    createdAt: string;
  }[];
}

interface AdminOverview {
  coverage: {
    totalResults: number;
    vietlottCount: number;
    minDate: string | null;
    maxDate: string | null;
  };
  cache: {
    backend: string;
    keysCount: number;
    hits: number;
    misses: number;
  };
  providers: {
    id: number;
    providerKey: string;
    name: string;
    adapterType: string;
    baseUrl: string;
    customEndpointPath: string | null;
    priority: number;
    isEnabled: boolean;
    envSecretName: string;
    authHeader: string;
    rateLimitPerMin: number;
    timeoutMs: number;
    maxRetries: number;
    lastSyncAt: string | null;
    lastStatus: string | null;
    hasEnvKey: boolean;
  }[];
  recentLogs: AutoSyncState['recentLogs'];
  autoSync?: AutoSyncState;
}

interface BackupRow {
  id: number;
  createdByUid: string;
  recordCount: number;
  dateRangeFrom: string;
  dateRangeTo: string;
  createdAt: string;
}

export const AdminDashboard: React.FC = () => {
  const {
    firebaseUser,
    profile,
    loading,
    authError,
    popupBlocked,
    inIframe,
    getToken,
    loginWithGoogle,
    loginWithRedirect,
    logout,
  } = useAuth();

  const [tab, setTab] = useState<'overview' | 'results' | 'api' | 'seo' | 'ads'>('overview');
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [resultsList, setResultsList] = useState<DbLotteryRow[]>([]);
  const [seoList, setSeoList] = useState<SeoRow[]>([]);
  const [adsList, setAdsList] = useState<AdRow[]>([]);
  const [backups, setBackups] = useState<BackupRow[]>([]);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Sync trigger state
  const [syncRegion, setSyncRegion] = useState<'MB' | 'MN' | 'MT'>('MB');
  const [syncDate, setSyncDate] = useState<string>(getTodayISOClient());
  const [syncForce, setSyncForce] = useState<boolean>(false);
  const [autoRefreshSync, setAutoRefreshSync] = useState<boolean>(true);

  // Manual result form state
  const [editDate, setEditDate] = useState<string>(getTodayISOClient());
  const [editProvinceCode, setEditProvinceCode] = useState('XSHN');
  const [editProvinceName, setEditProvinceName] = useState('Hà Nội');
  const [editRegion, setEditRegion] = useState<'MB' | 'MN' | 'MT'>('MB');
  const [editSpecial, setEditSpecial] = useState('');

  // New Ad form state
  const [adTitle, setAdTitle] = useState('');
  const [adSlot, setAdSlot] = useState('sidebar_top');
  const [adTarget, setAdTarget] = useState('/thong-ke');
  const [adAlt, setAdAlt] = useState('');

  const authedFetch = useCallback(
    async (url: string, init?: RequestInit) => {
      const token = await getToken();
      if (!token) throw new Error('Chưa đăng nhập.');
      const res = await fetch(url, {
        ...init,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          ...(init?.headers || {}),
        },
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Yêu cầu thất bại.');
      return json;
    },
    [getToken]
  );

  const loadAllAdminData = useCallback(async () => {
    if (!profile || profile.role !== 'admin') return;
    try {
      const [ov, resData, seoData, adData, bkData] = await Promise.all([
        authedFetch('/api/admin/overview'),
        authedFetch('/api/admin/results?limit=30'),
        authedFetch('/api/admin/seo'),
        authedFetch('/api/admin/ads'),
        authedFetch('/api/admin/backups'),
      ]);
      setOverview(ov);
      setResultsList(resData.results || []);
      setSeoList(seoData.seo || []);
      setAdsList(adData.ads || []);
      setBackups(bkData.backups || []);
    } catch (err: unknown) {
      setStatusMsg(err instanceof Error ? err.message : 'Lỗi tải dữ liệu quản trị.');
    }
  }, [authedFetch, profile]);

  useEffect(() => {
    if (profile?.role === 'admin') {
      loadAllAdminData();
    }
  }, [profile, loadAllAdminData]);

  // Auto-refresh live sync status every 10 seconds when viewing the API & Sync Monitor tab
  useEffect(() => {
    if (profile?.role !== 'admin' || tab !== 'api' || !autoRefreshSync) return;
    const timer = setInterval(async () => {
      try {
        const autoSync = (await authedFetch('/api/admin/sync-status')) as AutoSyncState;
        setOverview((prev) =>
          prev
            ? {
                ...prev,
                autoSync,
                recentLogs: autoSync.recentLogs,
              }
            : prev
        );
      } catch {
        // Ignore transient poll errors
      }
    }, 10_000);
    return () => clearInterval(timer);
  }, [profile, tab, autoRefreshSync, authedFetch]);

  if (loading) {
    return (
      <div className="bg-white border border-slate-200 rounded-lg p-8 text-center text-sm text-slate-500">
        Đang kiểm tra trạng thái xác thực...
      </div>
    );
  }

  if (!firebaseUser) {
    return (
      <section className="bg-white border border-slate-200 rounded-lg p-6 sm:p-8 max-w-xl mx-auto text-center space-y-4">
        <h2 className="text-xl font-bold text-slate-900">Đăng Nhập Quản Trị xosothantai1.com</h2>
        <p className="text-sm text-slate-600">
          Khu vực quản lý kết quả xổ số, đồng bộ xosovnm.net, cấu hình SEO, quảng cáo và sao lưu dữ liệu lịch sử 10 năm.
        </p>
        {authError && (
          <div className="p-3 text-xs text-left text-red-700 bg-red-50 border border-red-200 rounded space-y-1.5">
            <p className="font-medium">{authError}</p>
            {popupBlocked && (
              <p className="text-slate-600">
                Mẹo: Nhấn biểu tượng chặn cửa sổ bật lên trên thanh địa chỉ trình duyệt → chọn{' '}
                <span className="font-semibold">Luôn cho phép cửa sổ bật lên</span>, hoặc mở trực tiếp ở tab mới.
              </p>
            )}
          </div>
        )}
        <div className="flex flex-wrap items-center justify-center gap-2.5">
          <button
            type="button"
            onClick={loginWithGoogle}
            className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-[#C8102E] hover:bg-[#A60D26] rounded-md cursor-pointer"
          >
            <LogIn className="w-4 h-4" />
            Đăng nhập bằng Google
          </button>
          {(popupBlocked || inIframe) && (
            <a
              href={typeof window !== 'undefined' ? window.location.href : '/admin'}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-md"
            >
              <ExternalLink className="w-4 h-4" />
              Mở ở tab mới
            </a>
          )}
          {!inIframe && popupBlocked && (
            <button
              type="button"
              onClick={loginWithRedirect}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-md cursor-pointer"
            >
              Đăng nhập chuyển hướng
            </button>
          )}
        </div>
      </section>
    );
  }

  if (!profile || profile.role !== 'admin') {
    return (
      <section className="bg-white border border-slate-200 rounded-lg p-6 max-w-xl mx-auto space-y-3">
        <div className="flex items-center gap-2 text-amber-700 font-bold">
          <ShieldAlert className="w-5 h-5" />
          <span>Tài khoản không có quyền Quản trị (Admin)</span>
        </div>
        <p className="text-sm text-slate-600">
          Bạn đang đăng nhập với tài khoản <span className="font-semibold">{firebaseUser.email}</span>.
          Khu vực Quản trị chỉ dành riêng cho tài khoản <span className="font-semibold">kennguyen931908@gmail.com</span>.
        </p>
        <button
          type="button"
          onClick={logout}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md cursor-pointer"
        >
          <LogOut className="w-3.5 h-3.5" />
          Đăng xuất
        </button>
      </section>
    );
  }

  const handleTriggerSync = async (regionOverride?: 'MB' | 'MN' | 'MT', forceOverride?: boolean) => {
    setBusy(true);
    setStatusMsg(null);
    try {
      const out = await authedFetch('/api/admin/sync', {
        method: 'POST',
        body: JSON.stringify({
          region: regionOverride || syncRegion,
          date: syncDate,
          force: forceOverride !== undefined ? forceOverride : syncForce,
        }),
      });
      setStatusMsg(out.message);
      await loadAllAdminData();
    } catch (err: unknown) {
      setStatusMsg(err instanceof Error ? err.message : 'Đồng bộ thất bại.');
    } finally {
      setBusy(false);
    }
  };

  const handleBackfill = async (days: number) => {
    setBusy(true);
    setStatusMsg(`Đang khởi tạo dữ liệu lịch sử ${days} ngày vào PostgreSQL...`);
    try {
      const res = await authedFetch('/api/admin/backfill', {
        method: 'POST',
        body: JSON.stringify({ days }),
      });
      setStatusMsg(
        `Đã xử lý ${res.daysProcessed} ngày: thêm mới ${res.resultsInserted} kỳ XSKT và ${res.vietlottInserted} kỳ Vietlott.`
      );
      await loadAllAdminData();
    } catch (err: unknown) {
      setStatusMsg(err instanceof Error ? err.message : 'Backfill thất bại.');
    } finally {
      setBusy(false);
    }
  };

  const handleBackupExport = async () => {
    setBusy(true);
    try {
      const res = await authedFetch('/api/admin/backups', { method: 'POST' });
      const blob = new Blob([JSON.stringify(res.exportData, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `xosothantai1-backup-${getTodayISOClient()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setStatusMsg(`Đã tạo bản sao lưu (${res.backup.recordCount} bản ghi) và tải xuống tệp JSON.`);
      await loadAllAdminData();
    } catch (err: unknown) {
      setStatusMsg(err instanceof Error ? err.message : 'Sao lưu thất bại.');
    } finally {
      setBusy(false);
    }
  };

  const handleSaveManualSpecial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d{5,6}$/.test(editSpecial.trim())) {
      setStatusMsg('Giải Đặc Biệt phải gồm 5 chữ số (Miền Bắc) hoặc 6 chữ số (Miền Nam/Trung).');
      return;
    }
    setBusy(true);
    try {
      const basePrizes =
        editRegion === 'MB'
          ? {
              db: [editSpecial.trim()],
              g1: ['10293'],
              g2: ['48192', '57381'],
              g3: ['12345', '23456', '34567', '45678', '56789', '67890'],
              g4: ['1122', '3344', '5566', '7788'],
              g5: ['1234', '2345', '3456', '4567', '5678', '6789'],
              g6: ['123', '456', '789'],
              g7: ['12', '34', '56', '78'],
            }
          : {
              g8: ['18'],
              g7: ['294'],
              g6: ['1928', '3847', '5621'],
              g5: ['8472'],
              g4: ['19283', '29384', '39485', '49586', '59687', '69788', '79889'],
              g3: ['18293', '84726'],
              g2: ['91827'],
              g1: ['56473'],
              db: [editSpecial.trim()],
            };

      await authedFetch('/api/admin/results', {
        method: 'POST',
        body: JSON.stringify({
          drawDate: editDate,
          region: editRegion,
          provinceCode: editProvinceCode,
          provinceName: editProvinceName,
          kyHieu: editRegion === 'MB' ? ['10VN', '12VN', '15VN'] : [],
          prizes: basePrizes,
        }),
      });
      setStatusMsg(`Đã lưu kết quả ${editProvinceName} ngày ${formatDateVN(editDate)}.`);
      setEditSpecial('');
      await loadAllAdminData();
    } catch (err: unknown) {
      setStatusMsg(err instanceof Error ? err.message : 'Lưu kết quả thất bại.');
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteResult = async (id: number) => {
    setBusy(true);
    try {
      await authedFetch(`/api/admin/results/${id}`, { method: 'DELETE' });
      setStatusMsg('Đã xóa bản ghi kết quả.');
      await loadAllAdminData();
    } catch (err: unknown) {
      setStatusMsg(err instanceof Error ? err.message : 'Xóa thất bại.');
    } finally {
      setBusy(false);
    }
  };

  const handleUpdateProvider = async (p: AdminOverview['providers'][number]) => {
    setBusy(true);
    try {
      await authedFetch(`/api/admin/providers/${p.id}`, {
        method: 'PUT',
        body: JSON.stringify(p),
      });
      setStatusMsg(`Đã cập nhật cấu hình nguồn ${p.name}.`);
      await loadAllAdminData();
    } catch (err: unknown) {
      setStatusMsg(err instanceof Error ? err.message : 'Cập nhật thất bại.');
    } finally {
      setBusy(false);
    }
  };

  const handleSaveSeo = async (item: SeoRow) => {
    setBusy(true);
    try {
      await authedFetch('/api/admin/seo', {
        method: 'PUT',
        body: JSON.stringify(item),
      });
      setStatusMsg(`Đã lưu thẻ SEO cho đường dẫn ${item.routePath}.`);
      await loadAllAdminData();
    } catch (err: unknown) {
      setStatusMsg(err instanceof Error ? err.message : 'Lưu SEO thất bại.');
    } finally {
      setBusy(false);
    }
  };

  const handleCreateAd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adTitle.trim()) return;
    setBusy(true);
    try {
      await authedFetch('/api/admin/ads', {
        method: 'POST',
        body: JSON.stringify({
          title: adTitle.trim(),
          slotKey: adSlot,
          targetUrl: adTarget.trim() || '/',
          altText: adAlt.trim() || adTitle.trim(),
          isActive: true,
        }),
      });
      setAdTitle('');
      setAdAlt('');
      setStatusMsg('Đã thêm quảng cáo mới.');
      await loadAllAdminData();
    } catch (err: unknown) {
      setStatusMsg(err instanceof Error ? err.message : 'Tạo quảng cáo thất bại.');
    } finally {
      setBusy(false);
    }
  };

  const handleToggleAd = async (ad: AdRow) => {
    setBusy(true);
    try {
      await authedFetch(`/api/admin/ads/${ad.id}`, {
        method: 'PUT',
        body: JSON.stringify({ ...ad, isActive: !ad.isActive }),
      });
      await loadAllAdminData();
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteAd = async (id: number) => {
    setBusy(true);
    try {
      await authedFetch(`/api/admin/ads/${id}`, { method: 'DELETE' });
      await loadAllAdminData();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Admin Top Header */}
      <section className="bg-white border border-slate-200 rounded-lg p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              Bảng Điều Khiển Quản Trị xosothantai1.com
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Đăng nhập: {profile.email} · Vai trò: {profile.role}
            </p>
          </div>
          <button
            type="button"
            onClick={logout}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            Đăng xuất
          </button>
        </div>

        <div className="mt-4 flex items-center gap-1 border-b border-slate-200 overflow-x-auto">
          {(
            [
              { id: 'overview', label: 'Tổng quan & Lưu trữ 10 năm' },
              { id: 'results', label: 'Quản lý Kết quả' },
              { id: 'api', label: 'Nguồn API & Đồng bộ' },
              { id: 'seo', label: 'Cấu hình SEO' },
              { id: 'ads', label: 'Quảng cáo' },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`px-3.5 py-2 text-xs sm:text-sm font-semibold border-b-2 whitespace-nowrap shrink-0 cursor-pointer ${
                tab === t.id
                  ? 'border-[#C8102E] text-[#C8102E]'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {statusMsg && (
          <div className="mt-3 p-3 rounded bg-slate-50 border border-slate-200 text-xs sm:text-sm text-slate-800">
            {statusMsg}
          </div>
        )}
      </section>

      {/* TAB 1: OVERVIEW & 10-YEAR ARCHIVE / BACKUP */}
      {tab === 'overview' && overview && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white border border-slate-200 rounded-lg p-4">
              <div className="text-xs text-slate-500">Tổng bản ghi XSKT (PostgreSQL)</div>
              <div className="font-lottery text-2xl font-bold text-slate-900 mt-1">
                {overview.coverage.totalResults.toLocaleString('vi-VN')}
              </div>
              <div className="text-xs text-slate-500 mt-1">
                Từ {overview.coverage.minDate ? formatDateVN(overview.coverage.minDate) : '-'} đến{' '}
                {overview.coverage.maxDate ? formatDateVN(overview.coverage.maxDate) : '-'}
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-lg p-4">
              <div className="text-xs text-slate-500">Tổng kỳ Vietlott đã lưu</div>
              <div className="font-lottery text-2xl font-bold text-[#C8102E] mt-1">
                {overview.coverage.vietlottCount.toLocaleString('vi-VN')}
              </div>
              <div className="text-xs text-slate-500 mt-1">Power 6/55 · Mega 6/45 · Max 3D</div>
            </div>

            <div className="bg-white border border-slate-200 rounded-lg p-4">
              <div className="text-xs text-slate-500">Bộ nhớ đệm ({overview.cache.backend})</div>
              <div className="font-lottery text-2xl font-bold text-slate-900 mt-1">
                {overview.cache.hits} hits / {overview.cache.misses} miss
              </div>
              <div className="text-xs text-slate-500 mt-1">
                Số khóa đệm hiện tại: {overview.cache.keysCount}
              </div>
            </div>
          </div>

          {/* 10-Year Backfill & Backup Actions */}
          <section className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
            <div className="flex items-center gap-2 font-bold text-slate-900">
              <Database className="w-4 h-4 text-[#C8102E]" />
              <span>Khởi Tạo Kho Dữ Liệu Lịch Sử 10 Năm &amp; Sao Lưu</span>
            </div>
            <p className="text-xs sm:text-sm text-slate-600">
              Bổ sung đồng bộ dữ liệu lịch sử vào bảng PostgreSQL để phục vụ thống kê 1 năm, 3 năm, 5 năm và 10 năm (3.650 ngày).
            </p>
            <div className="flex flex-wrap gap-2">
              {[
                { days: 365, label: 'Lưu trữ 1 năm (365 ngày)' },
                { days: 1095, label: 'Lưu trữ 3 năm (1.095 ngày)' },
                { days: 1825, label: 'Lưu trữ 5 năm (1.825 ngày)' },
                { days: 3650, label: 'Lưu trữ đủ 10 năm (3.650 ngày)' },
              ].map((b) => (
                <button
                  key={b.days}
                  type="button"
                  disabled={busy}
                  onClick={() => handleBackfill(b.days)}
                  className="px-3.5 py-2 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 rounded-md cursor-pointer"
                >
                  {b.label}
                </button>
              ))}
              <button
                type="button"
                disabled={busy}
                onClick={handleBackupExport}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#C8102E] hover:bg-[#A60D26] disabled:opacity-50 rounded-md cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                Tạo &amp; Tải Bản Sao Lưu JSON
              </button>
            </div>

            {backups.length > 0 && (
              <div className="pt-2">
                <h4 className="text-xs font-bold text-slate-700 mb-2">
                  Lịch sử sao lưu gần đây
                </h4>
                <table className="w-full text-xs border border-slate-200 border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="py-1.5 px-2.5 text-left">Thời gian</th>
                      <th className="py-1.5 px-2.5 text-left">Khoảng ngày</th>
                      <th className="py-1.5 px-2.5 text-right">Số bản ghi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {backups.map((bk) => (
                      <tr key={bk.id}>
                        <td className="py-1.5 px-2.5 font-lottery">
                          {new Date(bk.createdAt).toLocaleString('vi-VN')}
                        </td>
                        <td className="py-1.5 px-2.5 font-lottery">
                          {bk.dateRangeFrom} → {bk.dateRangeTo}
                        </td>
                        <td className="py-1.5 px-2.5 text-right font-lottery font-semibold">
                          {bk.recordCount.toLocaleString('vi-VN')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}

      {/* TAB 2: MANAGE RESULTS */}
      {tab === 'results' && (
        <div className="space-y-5">
          <section className="bg-white border border-slate-200 rounded-lg p-5">
            <h3 className="text-sm font-bold text-slate-900 mb-3">
              Nhập / Cập Nhật Thủ Công Giải Đặc Biệt
            </h3>
            <form onSubmit={handleSaveManualSpecial} className="grid grid-cols-1 sm:grid-cols-5 gap-3">
              <input
                type="date"
                value={editDate}
                onChange={(e) => setEditDate(e.target.value)}
                className="px-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-md"
              />
              <select
                value={editRegion}
                onChange={(e) => setEditRegion(e.target.value as 'MB' | 'MN' | 'MT')}
                className="px-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-md bg-white"
              >
                <option value="MB">Miền Bắc</option>
                <option value="MN">Miền Nam</option>
                <option value="MT">Miền Trung</option>
              </select>
              <input
                type="text"
                value={editProvinceCode}
                onChange={(e) => setEditProvinceCode(e.target.value.toUpperCase())}
                placeholder="Mã đài (VD: XSHN)"
                className="px-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-md font-lottery"
              />
              <input
                type="text"
                value={editProvinceName}
                onChange={(e) => setEditProvinceName(e.target.value)}
                placeholder="Tên đài (VD: Hà Nội)"
                className="px-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-md"
              />
              <div className="flex gap-2">
                <input
                  type="text"
                  value={editSpecial}
                  onChange={(e) => setEditSpecial(e.target.value.replace(/\D/g, ''))}
                  maxLength={6}
                  placeholder="Số ĐB"
                  className="w-full px-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-md font-lottery font-bold"
                />
                <button
                  type="submit"
                  disabled={busy}
                  className="px-3 py-2 text-xs font-semibold text-white bg-[#C8102E] hover:bg-[#A60D26] rounded-md shrink-0 cursor-pointer"
                >
                  Lưu
                </button>
              </div>
            </form>
          </section>

          <section className="bg-white border border-slate-200 rounded-lg overflow-hidden">
            <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 text-sm font-bold text-slate-900">
              Danh sách 30 kỳ quay gần nhất trong PostgreSQL
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs sm:text-sm border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-700">
                    <th className="py-2 px-3 text-left">Ngày</th>
                    <th className="py-2 px-3 text-left">Miền</th>
                    <th className="py-2 px-3 text-left">Đài</th>
                    <th className="py-2 px-3 text-center">Giải ĐB</th>
                    <th className="py-2 px-3 text-left">Nguồn</th>
                    <th className="py-2 px-3 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {resultsList.map((row) => (
                    <tr key={row.id} className="hover:bg-slate-50">
                      <td className="py-2 px-3 font-lottery">{formatDateVN(row.drawDate)}</td>
                      <td className="py-2 px-3 font-semibold">{row.region}</td>
                      <td className="py-2 px-3">
                        {row.provinceName} ({row.provinceCode})
                      </td>
                      <td className="py-2 px-3 text-center font-lottery font-bold text-[#C8102E]">
                        {row.prizes?.db?.[0] || '-'}
                      </td>
                      <td className="py-2 px-3 text-slate-500">{row.source}</td>
                      <td className="py-2 px-3 text-right">
                        <button
                          type="button"
                          onClick={() => handleDeleteResult(row.id)}
                          className="p-1 text-slate-400 hover:text-red-600 cursor-pointer"
                          title="Xóa bản ghi"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      {/* TAB 3: API PROVIDERS & AUTOMATIC SYNC MONITOR */}
      {tab === 'api' && overview && (
        <div className="space-y-5">
          {/* Live Auto-Sync Scheduler Monitor */}
          {overview.autoSync && (
            <section className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <Activity className="w-4 h-4 text-[#C8102E]" />
                    <h3 className="text-sm sm:text-base font-bold text-slate-900">
                      Giám Sát Đồng Bộ Tự Động ({overview.autoSync.timezone})
                    </h3>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Giờ Việt Nam:{' '}
                    <span className="font-lottery font-bold text-slate-800">
                      {overview.autoSync.vnTime.formattedTime} ·{' '}
                      {formatDateVN(overview.autoSync.vnTime.dateStr)}
                    </span>{' '}
                    · Chu kỳ gọi trong giờ quay:{' '}
                    <span className="font-semibold">
                      {overview.autoSync.schedulerConfig.pollIntervalSeconds}s
                    </span>{' '}
                    (bắt đầu trước {overview.autoSync.schedulerConfig.preStartMinutes} phút)
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded ${
                      overview.autoSync.schedulerConfig.autoSyncEnabled
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-amber-50 text-amber-800 border border-amber-200'
                    }`}
                  >
                    <Clock className="w-3.5 h-3.5" />
                    {overview.autoSync.schedulerConfig.autoSyncEnabled
                      ? 'VPS Scheduler: Đang bật (30s)'
                      : 'Cloud Run Mode (Cloud Scheduler)'}
                  </span>
                  <label className="inline-flex items-center gap-1.5 text-xs text-slate-600 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded cursor-pointer">
                    <input
                      type="checkbox"
                      checked={autoRefreshSync}
                      onChange={(e) => setAutoRefreshSync(e.target.checked)}
                    />
                    Tự làm mới 10s
                  </label>
                </div>
              </div>

              {/* 3 Region Live Session Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {overview.autoSync.windows.map((win) => {
                  const session = overview.autoSync!.sessions.find(
                    (s) => s.region === win.region
                  );
                  const status = session?.status || 'PENDING';
                  const statusStyles: Record<string, string> = {
                    COMPLETED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
                    RUNNING: 'bg-amber-50 text-amber-800 border-amber-200',
                    TIMEOUT_STOPPED: 'bg-slate-100 text-slate-600 border-slate-200',
                    ERROR: 'bg-red-50 text-red-700 border-red-200',
                    PENDING: 'bg-slate-50 text-slate-600 border-slate-200',
                  };

                  return (
                    <div
                      key={win.region}
                      className="p-3.5 border border-slate-200 rounded-lg bg-slate-50/50 space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="font-bold text-sm text-slate-900">
                          {win.label} ({win.region})
                        </div>
                        <span
                          className={`px-2 py-0.5 text-[11px] font-bold rounded border ${
                            statusStyles[status] || statusStyles.PENDING
                          }`}
                        >
                          {status}
                        </span>
                      </div>

                      <div className="text-xs text-slate-600 space-y-1">
                        <div>
                          Khung đồng bộ:{' '}
                          <span className="font-lottery font-semibold">
                            {win.scheduledStart} → {win.scheduledEnd}
                          </span>{' '}
                          (quay {win.drawStart})
                        </div>
                        <div>
                          Tiến độ xác minh:{' '}
                          <span className="font-lottery font-bold text-slate-900">
                            {session?.provincesCompleted ?? 0}/{session?.provincesExpected ?? 0} đài
                          </span>{' '}
                          · Lượt poll:{' '}
                          <span className="font-lottery">{session?.pollCount ?? 0}</span>
                        </div>
                        {session?.lastPollAt && (
                          <div>
                            Lần gọi cuối:{' '}
                            <span className="font-lottery">
                              {new Date(session.lastPollAt).toLocaleTimeString('vi-VN')}
                            </span>
                          </div>
                        )}
                        {session?.lockedBy && (
                          <div className="inline-flex items-center gap-1 text-amber-700 font-medium">
                            <Lock className="w-3 h-3" />
                            Đang khóa xử lý ({session.lockedBy})
                          </div>
                        )}
                        {session?.lastError && (
                          <div className="text-[11px] text-red-600 truncate" title={session.lastError}>
                            {session.lastError}
                          </div>
                        )}
                      </div>

                      <div className="pt-1 flex gap-2">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => handleTriggerSync(win.region, false)}
                          className="flex-1 px-2.5 py-1 text-xs font-semibold text-white bg-[#C8102E] hover:bg-[#A60D26] disabled:opacity-50 rounded cursor-pointer"
                        >
                          Đồng bộ {win.region}
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => handleTriggerSync(win.region, true)}
                          className="px-2.5 py-1 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 disabled:opacity-50 rounded cursor-pointer"
                          title="Ép kiểm tra và ghi đè lại nếu API thay đổi"
                        >
                          Kiểm tra lại
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Today's Province-Level Verification Progress */}
              {overview.autoSync.todayProvincesProgress.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold text-slate-700 mb-2">
                    Tiến Độ Cập Nhật Từng Đài Hôm Nay ({formatDateVN(overview.autoSync.vnTime.dateStr)})
                  </h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs border border-slate-200 border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-700">
                          <th className="py-1.5 px-2.5 text-left">Miền</th>
                          <th className="py-1.5 px-2.5 text-left">Đài</th>
                          <th className="py-1.5 px-2.5 text-center">Số giải</th>
                          <th className="py-1.5 px-2.5 text-center">Trạng thái</th>
                          <th className="py-1.5 px-2.5 text-center">Phiên bản</th>
                          <th className="py-1.5 px-2.5 text-left">Cập nhật lúc</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {overview.autoSync.todayProvincesProgress.map((p) => (
                          <tr key={p.provinceCode}>
                            <td className="py-1.5 px-2.5 font-semibold">{p.region}</td>
                            <td className="py-1.5 px-2.5">
                              {p.provinceName} ({p.provinceCode})
                            </td>
                            <td className="py-1.5 px-2.5 text-center font-lottery font-bold">
                              {p.prizesFound}/{p.prizesExpected}
                            </td>
                            <td className="py-1.5 px-2.5 text-center">
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded font-semibold ${
                                  p.syncStatus === 'COMPLETED' && p.isVerified
                                    ? 'bg-emerald-50 text-emerald-700'
                                    : p.syncStatus === 'VERIFYING'
                                    ? 'bg-blue-50 text-blue-700'
                                    : 'bg-amber-50 text-amber-800'
                                }`}
                              >
                                {p.syncStatus === 'COMPLETED' && p.isVerified && (
                                  <CheckCircle2 className="w-3 h-3" />
                                )}
                                {p.syncStatus}
                              </span>
                            </td>
                            <td className="py-1.5 px-2.5 text-center font-lottery">v{p.version}</td>
                            <td className="py-1.5 px-2.5 font-lottery text-slate-500">
                              {new Date(p.updatedAt).toLocaleTimeString('vi-VN')}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Cloud Run Endpoint Info */}
              <div className="p-3 rounded bg-slate-50 border border-slate-200 text-xs text-slate-600 flex flex-wrap items-center justify-between gap-2">
                <div>
                  Endpoint Google Cloud Scheduler:{' '}
                  <code className="font-lottery font-semibold text-slate-900">
                    POST {overview.autoSync.schedulerConfig.cloudSchedulerEndpoint}
                  </code>{' '}
                  (Header: <code className="font-lottery">X-Cron-Secret</code>)
                </div>
                <span
                  className={`px-2 py-0.5 rounded font-semibold ${
                    overview.autoSync.schedulerConfig.hasCronSecret
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'bg-amber-50 text-amber-800'
                  }`}
                >
                  {overview.autoSync.schedulerConfig.hasCronSecret
                    ? 'CRON_SYNC_SECRET: Đã cấu hình'
                    : 'CRON_SYNC_SECRET: Chưa thiết lập (chỉ dùng Admin JWT)'}
                </span>
              </div>
            </section>
          )}

          {/* Manual Trigger */}
          <section className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
            <h3 className="text-sm font-bold text-slate-900">
              Kích Hoạt Đồng Bộ Thủ Công Theo Ngày &amp; Miền
            </h3>
            <div className="flex flex-wrap items-center gap-3">
              <select
                value={syncRegion}
                onChange={(e) => setSyncRegion(e.target.value as 'MB' | 'MN' | 'MT')}
                className="px-3 py-2 text-sm border border-slate-300 rounded-md bg-white"
              >
                <option value="MB">Miền Bắc (XSMB)</option>
                <option value="MN">Miền Nam (XSMN)</option>
                <option value="MT">Miền Trung (XSMT)</option>
              </select>
              <input
                type="date"
                value={syncDate}
                onChange={(e) => setSyncDate(e.target.value)}
                className="px-3 py-2 text-sm border border-slate-300 rounded-md"
              />
              <label className="inline-flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={syncForce}
                  onChange={(e) => setSyncForce(e.target.checked)}
                />
                Ép đồng bộ lại dù đã hoàn tất
              </label>
              <button
                type="button"
                disabled={busy}
                onClick={() => handleTriggerSync()}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-[#C8102E] hover:bg-[#A60D26] disabled:opacity-50 rounded-md cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                Chạy đồng bộ ngay
              </button>
            </div>
          </section>

          {/* Single Official API Source: https://api.xosovnm.net/api */}
          <section className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-bold text-slate-900">
                Nguồn API Chính Thức Duy Nhất: https://api.xosovnm.net/api
              </h3>
              <span className="px-2.5 py-1 text-xs font-semibold bg-emerald-50 text-emerald-700 rounded">
                Chỉ lấy từ api.xosovnm.net
              </span>
            </div>

            <div className="space-y-4">
              {overview.providers.map((p, idx) => {
                const usedPerMin =
                  overview.autoSync?.rateLimiter?.[p.providerKey]?.requestsInLastMinute ?? 0;
                return (
                  <div key={p.id} className="p-4 border border-slate-200 rounded-lg space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <div className="font-bold text-slate-900">
                          {p.name}{' '}
                          <span className="text-xs font-normal text-slate-500 font-lottery">
                            ({p.adapterType})
                          </span>
                        </div>
                        <div className="text-xs text-slate-500">
                          {p.envSecretName === 'PUBLIC_NO_KEY_REQUIRED' ? (
                            <span>API Công Khai · Không yêu cầu API key</span>
                          ) : (
                            <>
                              Biến ENV Secret:{' '}
                              <span className="font-lottery font-semibold">{p.envSecretName}</span>{' '}
                              ({p.authHeader}) ·{' '}
                              {p.hasEnvKey
                                ? 'Đã cấu hình API Key trên máy chủ'
                                : 'Chưa gắn API Key trong ENV'}
                            </>
                          )}{' '}
                          · Tải hiện tại:{' '}
                          <span className="font-lottery font-semibold">
                            {usedPerMin}/{p.rateLimitPerMin} req/phút
                          </span>
                        </div>
                      </div>
                      <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={p.isEnabled}
                          onChange={(e) => {
                            const updated = [...overview.providers];
                            updated[idx] = { ...p, isEnabled: e.target.checked };
                            setOverview({ ...overview, providers: updated });
                          }}
                        />
                        Kích hoạt
                      </label>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-6 gap-2.5">
                      <input
                        type="text"
                        value="https://api.xosovnm.net/api"
                        readOnly
                        className="sm:col-span-2 px-3 py-1.5 text-xs border border-slate-200 bg-slate-50 text-slate-600 rounded font-lottery"
                        title="Nguồn API cố định"
                      />
                      <input
                        type="text"
                        value={p.envSecretName}
                        onChange={(e) => {
                          const updated = [...overview.providers];
                          updated[idx] = { ...p, envSecretName: e.target.value };
                          setOverview({ ...overview, providers: updated });
                        }}
                        className="px-3 py-1.5 text-xs border border-slate-300 rounded font-lottery"
                        placeholder="ENV Secret Name"
                        title="Tên biến môi trường trên server chứa API Key"
                      />
                      <input
                        type="number"
                        value={p.rateLimitPerMin}
                        onChange={(e) => {
                          const updated = [...overview.providers];
                          updated[idx] = { ...p, rateLimitPerMin: Number(e.target.value) };
                          setOverview({ ...overview, providers: updated });
                        }}
                        className="px-3 py-1.5 text-xs border border-slate-300 rounded font-lottery"
                        placeholder="Req/phút"
                        title="Giới hạn request/phút"
                      />
                      <input
                        type="number"
                        value={p.priority}
                        onChange={(e) => {
                          const updated = [...overview.providers];
                          updated[idx] = { ...p, priority: Number(e.target.value) };
                          setOverview({ ...overview, providers: updated });
                        }}
                        className="px-3 py-1.5 text-xs border border-slate-300 rounded font-lottery"
                        placeholder="Ưu tiên"
                        title="Thứ tự ưu tiên"
                      />
                      <button
                        type="button"
                        onClick={() => handleUpdateProvider(overview.providers[idx])}
                        className="inline-flex items-center justify-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded cursor-pointer"
                      >
                        <Save className="w-3.5 h-3.5" />
                        Lưu
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Detailed API Sync Logs */}
          <section className="bg-white border border-slate-200 rounded-lg overflow-hidden">
            <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 text-sm font-bold text-slate-900">
              Nhật Ký Gọi API, Trạng Thái &amp; Xử Lý Lỗi (Sync Logs)
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="py-2 px-3 text-left">Thời gian</th>
                    <th className="py-2 px-3 text-left">Chế độ / Nguồn</th>
                    <th className="py-2 px-3 text-left">Miền / Ngày</th>
                    <th className="py-2 px-3 text-left">Trạng thái</th>
                    <th className="py-2 px-3 text-center">Giải / Thử</th>
                    <th className="py-2 px-3 text-right">Độ trễ</th>
                    <th className="py-2 px-3 text-left">Chi tiết / Lỗi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {overview.recentLogs.map((log) => (
                    <tr key={log.id}>
                      <td className="py-2 px-3 font-lottery whitespace-nowrap">
                        {new Date(log.createdAt).toLocaleString('vi-VN')}
                      </td>
                      <td className="py-2 px-3 font-lottery">
                        <div className="font-semibold text-slate-800">{log.providerKey}</div>
                        <div className="text-[11px] text-slate-500">{log.syncMode}</div>
                      </td>
                      <td className="py-2 px-3 font-lottery whitespace-nowrap">
                        {log.region} · {log.targetDate}
                      </td>
                      <td className="py-2 px-3 font-semibold whitespace-nowrap">
                        <span
                          className={`px-2 py-0.5 rounded text-[11px] ${
                            log.status === 'VERIFIED_COMPLETED' || log.status === 'SUCCESS'
                              ? 'bg-emerald-50 text-emerald-700'
                              : log.status === 'PARTIAL_UPDATED'
                              ? 'bg-blue-50 text-blue-700'
                              : log.status === 'FAILED' || log.status === 'RATE_LIMITED'
                              ? 'bg-red-50 text-red-700'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {log.status}
                          {log.httpStatus ? ` (${log.httpStatus})` : ''}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-center font-lottery whitespace-nowrap">
                        {log.prizesFound}/{log.prizesExpected} · #{log.attempts}
                      </td>
                      <td className="py-2 px-3 text-right font-lottery whitespace-nowrap">
                        {log.durationMs}ms
                      </td>
                      <td className="py-2 px-3 text-slate-600 max-w-xs truncate" title={log.errorMessage}>
                        {log.errorMessage || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      {/* TAB 4: SEO METADATA */}
      {tab === 'seo' && (
        <section className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
          <h3 className="text-sm font-bold text-slate-900">
            Quản Lý Thẻ Tiêu Đề &amp; Mô Tả SEO Theo Đường Dẫn
          </h3>
          <div className="space-y-4">
            {seoList.map((item, idx) => (
              <div key={item.id} className="p-4 border border-slate-200 rounded-lg space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-lottery text-xs font-bold text-[#C8102E]">
                    {item.routePath}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleSaveSeo(seoList[idx])}
                    className="inline-flex items-center gap-1 px-3 py-1 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded cursor-pointer"
                  >
                    <Save className="w-3.5 h-3.5" />
                    Lưu SEO
                  </button>
                </div>
                <input
                  type="text"
                  value={item.title}
                  onChange={(e) => {
                    const next = [...seoList];
                    next[idx] = { ...item, title: e.target.value, ogTitle: e.target.value };
                    setSeoList(next);
                  }}
                  className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded font-medium"
                  placeholder="Title"
                />
                <textarea
                  rows={2}
                  value={item.description}
                  onChange={(e) => {
                    const next = [...seoList];
                    next[idx] = {
                      ...item,
                      description: e.target.value,
                      ogDescription: e.target.value,
                    };
                    setSeoList(next);
                  }}
                  className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded"
                  placeholder="Meta Description"
                />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* TAB 5: ADVERTISEMENTS */}
      {tab === 'ads' && (
        <div className="space-y-5">
          <section className="bg-white border border-slate-200 rounded-lg p-5">
            <h3 className="text-sm font-bold text-slate-900 mb-3">Thêm Vị Trí Quảng Cáo Mới</h3>
            <form onSubmit={handleCreateAd} className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <input
                type="text"
                value={adTitle}
                onChange={(e) => setAdTitle(e.target.value)}
                placeholder="Tiêu đề banner"
                className="px-3 py-2 text-sm border border-slate-300 rounded-md"
              />
              <select
                value={adSlot}
                onChange={(e) => setAdSlot(e.target.value)}
                className="px-3 py-2 text-sm border border-slate-300 rounded-md bg-white"
              >
                <option value="sidebar_top">Thanh bên phải (Sidebar)</option>
                <option value="between_regions">Giữa bảng kết quả</option>
              </select>
              <input
                type="text"
                value={adTarget}
                onChange={(e) => setAdTarget(e.target.value)}
                placeholder="Đường dẫn đích (/thong-ke)"
                className="px-3 py-2 text-sm border border-slate-300 rounded-md"
              />
              <div className="flex gap-2">
                <input
                  type="text"
                  value={adAlt}
                  onChange={(e) => setAdAlt(e.target.value)}
                  placeholder="Mô tả ngắn"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
                />
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-[#C8102E] hover:bg-[#A60D26] rounded-md shrink-0 cursor-pointer"
                >
                  Thêm
                </button>
              </div>
            </form>
          </section>

          <section className="bg-white border border-slate-200 rounded-lg overflow-hidden">
            <table className="w-full text-xs sm:text-sm border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="py-2 px-3 text-left">Vị trí</th>
                  <th className="py-2 px-3 text-left">Tiêu đề</th>
                  <th className="py-2 px-3 text-right">Lượt nhấn</th>
                  <th className="py-2 px-3 text-center">Trạng thái</th>
                  <th className="py-2 px-3 text-right">Xóa</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {adsList.map((ad) => (
                  <tr key={ad.id}>
                    <td className="py-2 px-3 font-lottery text-slate-600">{ad.slotKey}</td>
                    <td className="py-2 px-3 font-medium text-slate-900">{ad.title}</td>
                    <td className="py-2 px-3 text-right font-lottery">{ad.clicks}</td>
                    <td className="py-2 px-3 text-center">
                      <button
                        type="button"
                        onClick={() => handleToggleAd(ad)}
                        className={`px-2.5 py-1 text-xs font-semibold rounded cursor-pointer ${
                          ad.isActive
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {ad.isActive ? 'Đang chạy' : 'Tạm tắt'}
                      </button>
                    </td>
                    <td className="py-2 px-3 text-right">
                      <button
                        type="button"
                        onClick={() => handleDeleteAd(ad.id)}
                        className="p-1 text-slate-400 hover:text-red-600 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </div>
      )}
    </div>
  );
};
