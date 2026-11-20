import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, ExternalLink, LogIn, LogOut, Menu, Search, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { STAT_DROPDOWN_ITEMS } from '../data/statCategories';
import { MainTab, StatCategoryId } from '../types/lottery';

interface HeaderProps {
  activeTab: MainTab;
  activeStatCategory?: StatCategoryId;
  onSelectTab: (tab: MainTab) => void;
  onSelectStatCategory?: (category: StatCategoryId) => void;
}

const NAV_LINKS: { id: MainTab; label: string }[] = [
  { id: 'home', label: 'Trang chủ' },
  { id: 'xsmb', label: 'Miền Bắc' },
  { id: 'xsmn', label: 'Miền Nam' },
  { id: 'xsmt', label: 'Miền Trung' },
  { id: 'vietlott', label: 'Vietlott' },
];

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  activeStatCategory,
  onSelectTab,
  onSelectStatCategory,
}) => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [statsMenuOpen, setStatsMenuOpen] = useState(false);
  const [mobileStatsOpen, setMobileStatsOpen] = useState(false);
  const statsMenuRef = useRef<HTMLDivElement>(null);

  const {
    firebaseUser,
    isAdmin,
    loading,
    signingIn,
    authError,
    popupBlocked,
    inIframe,
    loginWithGoogle,
    logout,
    clearAuthError,
  } = useAuth();

  useEffect(() => {
    if (!statsMenuOpen) return;
    const handlePointerDown = (e: MouseEvent) => {
      if (statsMenuRef.current && !statsMenuRef.current.contains(e.target as Node)) {
        setStatsMenuOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setStatsMenuOpen(false);
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [statsMenuOpen]);

  const handleNav = (tab: MainTab) => {
    onSelectTab(tab);
    setMobileOpen(false);
    setStatsMenuOpen(false);
  };

  const handleSelectStat = (categoryId: StatCategoryId) => {
    if (onSelectStatCategory) {
      onSelectStatCategory(categoryId);
    } else {
      onSelectTab('thong-ke');
    }
    setStatsMenuOpen(false);
    setMobileOpen(false);
  };

  const isStatsActive = activeTab === 'thong-ke';

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-slate-200">
      <div className="max-w-[1240px] mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-6">
        {/* Zone 1: Brand Wordmark */}
        <button
          type="button"
          onClick={() => handleNav('home')}
          className="text-xl font-extrabold tracking-tight text-[#C8102E] whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-[#C8102E] rounded"
        >
          xosothantai1.com
        </button>

        {/* Zone 2: Nav links + Thống kê dropdown */}
        <nav className="hidden md:flex items-center gap-5" aria-label="Điều hướng chính">
          {NAV_LINKS.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNav(item.id)}
                className={`relative py-4 text-sm font-semibold whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                  isActive
                    ? 'text-[#C8102E]'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {item.label}
                {isActive && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#C8102E]" />
                )}
              </button>
            );
          })}

          {/* Thống kê dropdown matching reference menu */}
          <div
            ref={statsMenuRef}
            className="relative"
            onMouseEnter={() => setStatsMenuOpen(true)}
            onMouseLeave={() => setStatsMenuOpen(false)}
          >
            <button
              type="button"
              aria-expanded={statsMenuOpen}
              aria-haspopup="menu"
              onClick={() => setStatsMenuOpen((v) => !v)}
              className={`h-14 px-3.5 inline-flex items-center gap-1 text-sm font-bold uppercase tracking-wide whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                isStatsActive || statsMenuOpen
                  ? 'bg-[#C8102E] text-white'
                  : 'text-slate-700 hover:bg-[#C8102E] hover:text-white'
              }`}
            >
              <span>THỐNG KÊ</span>
              <ChevronDown
                className={`w-3.5 h-3.5 transition-transform ${
                  statsMenuOpen ? 'rotate-180' : ''
                }`}
                aria-hidden="true"
              />
            </button>

            {statsMenuOpen && (
              <div
                role="menu"
                aria-label="Danh mục thống kê xổ số"
                className="absolute left-0 top-full w-64 bg-white border border-slate-200 shadow-xl rounded-b-md py-1.5 z-50"
              >
                {STAT_DROPDOWN_ITEMS.map((item) => {
                  const isCurrent = isStatsActive && activeStatCategory === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      role="menuitem"
                      onClick={() => handleSelectStat(item.id)}
                      className={`block w-full text-left px-4 py-2 text-[13px] transition-colors cursor-pointer ${
                        isCurrent
                          ? 'bg-red-50 text-[#C8102E] font-semibold'
                          : 'text-slate-700 hover:bg-slate-50 hover:text-[#C8102E]'
                      }`}
                    >
                      {item.label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </nav>

        {/* Zone 3: Primary CTA button + Login/Logout + mobile menu trigger */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <button
            type="button"
            onClick={() => handleNav('do-ve-so')}
            className="inline-flex items-center gap-1.5 px-3.5 sm:px-4 py-2 text-xs sm:text-sm font-semibold text-white bg-[#C8102E] hover:bg-[#A60D26] rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Search className="w-3.5 h-3.5" aria-hidden="true" />
            Dò vé số
          </button>
          {!loading && !firebaseUser && (
            <button
              type="button"
              disabled={signingIn}
              onClick={() => void loginWithGoogle()}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 disabled:opacity-60 disabled:cursor-wait rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <LogIn className="w-3.5 h-3.5" aria-hidden="true" />
              {signingIn ? 'Đang xác nhận...' : 'Đăng nhập'}
            </button>
          )}
          {!loading && firebaseUser && (
            <button
              type="button"
              onClick={() => void logout()}
              title={firebaseUser.email || ''}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
              Đăng xuất
            </button>
          )}
          <button
            type="button"
            onClick={() => setMobileOpen((v) => !v)}
            className="md:hidden p-2 text-slate-600 hover:text-slate-900 rounded-md cursor-pointer"
            aria-label="Mở menu"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="md:hidden border-t border-slate-200 bg-white px-4 py-3 space-y-1 max-h-[80vh] overflow-y-auto">
          {[
            ...NAV_LINKS,
            { id: 'tinh' as MainTab, label: 'Theo Tỉnh' },
            ...(isAdmin ? [{ id: 'admin' as MainTab, label: 'Quản trị' }] : []),
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => handleNav(item.id)}
              className={`block w-full text-left px-3 py-2.5 text-sm font-semibold rounded-md cursor-pointer ${
                activeTab === item.id
                  ? 'bg-red-50 text-[#C8102E]'
                  : 'text-slate-700 hover:bg-slate-50'
              }`}
            >
              {item.label}
            </button>
          ))}

          <div>
            <button
              type="button"
              onClick={() => setMobileStatsOpen((v) => !v)}
              className={`w-full flex items-center justify-between px-3 py-2.5 text-sm font-bold rounded-md cursor-pointer ${
                isStatsActive
                  ? 'bg-[#C8102E] text-white'
                  : 'text-slate-800 hover:bg-slate-50'
              }`}
            >
              <span>THỐNG KÊ</span>
              <ChevronDown
                className={`w-4 h-4 transition-transform ${mobileStatsOpen ? 'rotate-180' : ''}`}
              />
            </button>
            {mobileStatsOpen && (
              <div className="mt-1 ml-2 pl-2 border-l-2 border-slate-200 space-y-0.5">
                {STAT_DROPDOWN_ITEMS.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleSelectStat(item.id)}
                    className={`block w-full text-left px-3 py-2 text-xs font-medium rounded cursor-pointer ${
                      isStatsActive && activeStatCategory === item.id
                        ? 'bg-red-50 text-[#C8102E] font-semibold'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-[#C8102E]'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {!loading && !firebaseUser && (
            <button
              type="button"
              disabled={signingIn}
              onClick={() => {
                setMobileOpen(false);
                void loginWithGoogle();
              }}
              className="flex items-center gap-2 w-full text-left px-3 py-2.5 text-sm font-semibold text-[#C8102E] hover:bg-red-50 disabled:opacity-60 rounded-md cursor-pointer"
            >
              <LogIn className="w-4 h-4" />
              {signingIn ? 'Đang xác nhận...' : 'Đăng nhập bằng Google'}
            </button>
          )}
          {!loading && firebaseUser && (
            <button
              type="button"
              onClick={() => {
                setMobileOpen(false);
                void logout();
              }}
              className="flex items-center gap-2 w-full text-left px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 rounded-md cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              Đăng xuất ({firebaseUser.email})
            </button>
          )}
        </div>
      )}

      {!firebaseUser && authError && (
        <div className="bg-red-50 border-t border-red-200">
          <div className="max-w-[1240px] mx-auto px-4 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs text-red-700">
            <span className="font-medium">{authError}</span>
            <div className="flex items-center gap-2 shrink-0">
              {(popupBlocked || inIframe) && (
                <a
                  href={typeof window !== 'undefined' ? window.location.href : '/'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-2.5 py-1 font-semibold bg-white border border-red-200 text-slate-800 hover:bg-slate-50 rounded"
                >
                  <ExternalLink className="w-3 h-3" />
                  Mở ở tab mới
                </a>
              )}
              <button
                type="button"
                onClick={clearAuthError}
                className="px-2 py-1 text-red-600 hover:text-red-900 font-semibold cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
