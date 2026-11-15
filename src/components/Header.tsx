import React from 'react';
import { LogIn, LogOut, Menu, Search, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { MainTab } from '../types/lottery';

interface HeaderProps {
  activeTab: MainTab;
  onSelectTab: (tab: MainTab) => void;
}

const NAV_LINKS: { id: MainTab; label: string }[] = [
  { id: 'home', label: 'Trang chủ' },
  { id: 'xsmb', label: 'Miền Bắc' },
  { id: 'xsmn', label: 'Miền Nam' },
  { id: 'xsmt', label: 'Miền Trung' },
  { id: 'vietlott', label: 'Vietlott' },
];

export const Header: React.FC<HeaderProps> = ({ activeTab, onSelectTab }) => {
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const { firebaseUser, isAdmin, loading, loginWithGoogle, logout } = useAuth();

  const handleNav = (tab: MainTab) => {
    onSelectTab(tab);
    setMobileOpen(false);
  };

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-slate-200">
      <div className="max-w-[1240px] mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-8">
        {/* Zone 1: Single-element Brand Wordmark */}
        <button
          type="button"
          onClick={() => handleNav('home')}
          className="text-xl font-extrabold tracking-tight text-[#C8102E] whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-[#C8102E] rounded"
        >
          xosothantai1.com
        </button>

        {/* Zone 2: 5 concise single-line nav links */}
        <nav className="hidden md:flex items-center gap-6" aria-label="Điều hướng chính">
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
              onClick={() => void loginWithGoogle()}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <LogIn className="w-3.5 h-3.5" aria-hidden="true" />
              Đăng nhập
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
        <div className="md:hidden border-t border-slate-200 bg-white px-4 py-3 space-y-1">
          {[
            ...NAV_LINKS,
            { id: 'tinh' as MainTab, label: 'Theo Tỉnh' },
            { id: 'thong-ke' as MainTab, label: 'Thống kê 10 năm' },
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
          {!loading && !firebaseUser && (
            <button
              type="button"
              onClick={() => {
                setMobileOpen(false);
                void loginWithGoogle();
              }}
              className="flex items-center gap-2 w-full text-left px-3 py-2.5 text-sm font-semibold text-[#C8102E] hover:bg-red-50 rounded-md cursor-pointer"
            >
              <LogIn className="w-4 h-4" />
              Đăng nhập bằng Google
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
    </header>
  );
};
