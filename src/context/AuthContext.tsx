import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import {
  browserPopupRedirectResolver,
  getRedirectResult,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import { auth, googleAuthProvider } from '../lib/firebase';
import { ensureBackendChecked, resolveApiUrl } from '../services/apiClient';

export const ALLOWED_ADMIN_EMAIL = 'kennguyen931908@gmail.com';

export interface AppUserProfile {
  id: number;
  uid: string;
  email: string;
  displayName: string | null;
  role: 'admin' | 'user';
}

interface AuthContextValue {
  firebaseUser: User | null;
  profile: AppUserProfile | null;
  isAdmin: boolean;
  loading: boolean;
  signingIn: boolean;
  authError: string | null;
  popupBlocked: boolean;
  inIframe: boolean;
  getToken: () => Promise<string | null>;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  clearAuthError: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function extractFirebaseErrorCode(err: unknown): string {
  if (err && typeof err === 'object' && 'code' in err && typeof (err as { code: unknown }).code === 'string') {
    return (err as { code: string }).code;
  }
  const msg = err instanceof Error ? err.message : String(err || '');
  const match = msg.match(/\((auth\/[a-z0-9-]+)\)/i);
  return match ? match[1] : '';
}

function formatFirebaseAuthError(err: unknown, inIframe: boolean): { message: string; popupBlocked: boolean } {
  const code = extractFirebaseErrorCode(err);
  const host = typeof window !== 'undefined' ? window.location.hostname : '';

  if (
    code === 'auth/popup-blocked' ||
    code === 'auth/operation-not-supported-in-this-environment'
  ) {
    return {
      popupBlocked: true,
      message: inIframe
        ? 'Trình duyệt đang chặn cửa sổ bật lên (Popup) trong khung xem trước. Vui lòng bấm "Mở ở tab mới" để đăng nhập bằng Google.'
        : 'Trình duyệt đang chặn cửa sổ bật lên (Popup) để đăng nhập Google. Vui lòng bật cho phép Popup cho trang này rồi bấm Đăng nhập lại.',
    };
  }

  if (code === 'auth/popup-closed-by-user') {
    return {
      popupBlocked: false,
      message:
        'Phiên xác nhận Google chưa hoàn tất (cửa sổ bật lên đã đóng hoặc trình duyệt/tiện ích chặn Cookie bên thứ 3 khiến trang không nhận được phản hồi xác nhận từ bước 2). Vui lòng cho phép Cookie bên thứ 3 và thử lại. (auth/popup-closed-by-user)',
    };
  }

  if (code === 'auth/cancelled-popup-request') {
    return {
      popupBlocked: false,
      message: 'Yêu cầu đăng nhập trước đó đã bị hủy do mở cửa sổ mới. Vui lòng thử lại. (auth/cancelled-popup-request)',
    };
  }

  if (code === 'auth/web-storage-unsupported') {
    return {
      popupBlocked: false,
      message:
        'Trình duyệt đang chặn Cookie bên thứ 3 hoặc Web Storage cho trang xác thực Google (firebaseapp.com). Vui lòng tắt chế độ chặn Cookie bên thứ 3 / trình chặn quảng cáo rồi thử lại. (auth/web-storage-unsupported)',
    };
  }

  if (code === 'auth/unauthorized-domain') {
    return {
      popupBlocked: false,
      message: `Tên miền hiện tại (${host}) chưa được cấp phép trong Firebase Authorized Domains. Vui lòng thêm "${host}" vào Firebase Console -> Authentication -> Settings -> Authorized domains.`,
    };
  }

  if (code === 'auth/operation-not-allowed') {
    return {
      popupBlocked: false,
      message: 'Đăng nhập Google chưa được bật trong Firebase Console -> Authentication -> Sign-in method. (auth/operation-not-allowed)',
    };
  }

  if (code === 'auth/internal-error') {
    return {
      popupBlocked: inIframe,
      message:
        'Lỗi xác thực nội bộ khi hoàn tất bước xác nhận Google (thường do trình duyệt chặn Cookie bên thứ 3 hoặc tiện ích mở rộng can thiệp). Hãy thử cho phép Cookie bên thứ 3 hoặc mở ở tab mới. (auth/internal-error)',
    };
  }

  if (code === 'auth/network-request-failed') {
    return {
      popupBlocked: false,
      message: 'Lỗi kết nối mạng khi xác thực Google. Vui lòng kiểm tra kết nối và thử lại. (auth/network-request-failed)',
    };
  }

  const raw = err instanceof Error ? err.message : 'Đăng nhập thất bại.';
  return {
    popupBlocked: false,
    message: code && !raw.includes(code) ? `${raw} (${code})` : raw,
  };
}

async function fetchAuthProfileWithRetry(token: string): Promise<AppUserProfile | null> {
  if (!(await ensureBackendChecked())) return null;
  const delays = [600, 1200, 2000];
  for (let attempt = 0; attempt <= delays.length; attempt++) {
    try {
      const res = await fetch(resolveApiUrl('/api/auth/me'), {
        headers: { Authorization: `Bearer ${token}` },
      });
      const ct = res.headers.get('content-type') || '';
      if (res.ok && ct.includes('application/json')) {
        const data = (await res.json()) as { user: AppUserProfile };
        return data.user;
      }
      if (res.status < 500) {
        return null;
      }
    } catch {
      // Transient network error while server warms up
    }
    if (attempt < delays.length) {
      await new Promise((r) => setTimeout(r, delays[attempt]));
    }
  }
  return null;
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<AppUserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [signingIn, setSigningIn] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [popupBlocked, setPopupBlocked] = useState(false);
  const signingInRef = useRef(false);
  const [inIframe] = useState(() => {
    try {
      return typeof window !== 'undefined' && window.self !== window.top;
    } catch {
      return true;
    }
  });

  useEffect(() => {
    googleAuthProvider.setCustomParameters({ prompt: 'select_account' });

    // Proactively initialize Firebase's popup/iframe bridge on ALL browsers (including Desktop Chrome)
    // so signInWithPopup does not stall on network I/O during click.
    const internalAuth = auth as unknown as {
      _popupRedirectResolver?: { _initialize?: (a: typeof auth) => Promise<unknown> };
    };
    if (typeof internalAuth._popupRedirectResolver?._initialize === 'function') {
      internalAuth._popupRedirectResolver._initialize(auth).catch(() => {});
    }

    if (!inIframe) {
      getRedirectResult(auth, browserPopupRedirectResolver).catch((err: unknown) => {
        console.error('[Auth] Redirect result error:', err);
        const code = extractFirebaseErrorCode(err);
        if (code) {
          const formatted = formatFirebaseAuthError(err, false);
          setPopupBlocked(formatted.popupBlocked);
          setAuthError(formatted.message);
        }
      });
    }

    const unsub = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (user) {
        setAuthError(null);
        setPopupBlocked(false);
        try {
          const token = await user.getIdToken();
          const syncedProfile = await fetchAuthProfileWithRetry(token);
          setProfile(syncedProfile);
        } catch (err) {
          console.error('[Auth] Profile sync error:', err);
          setProfile(null);
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });
    return () => unsub();
  }, [inIframe]);

  const getToken = async () => {
    if (!auth.currentUser) return null;
    return auth.currentUser.getIdToken();
  };

  const loginWithGoogle = async () => {
    if (signingInRef.current) return;
    signingInRef.current = true;
    setSigningIn(true);
    setAuthError(null);
    setPopupBlocked(false);

    // Open the popup synchronously inside the user-click event so Chrome/Edge/Safari
    // do not expire the user-gesture token while Firebase initializes its auth bridge.
    const width = 500;
    const height = 600;
    const top = Math.max((window.screen.availHeight - height) / 2, 0);
    const left = Math.max((window.screen.availWidth - width) / 2, 0);
    const specs = `location=yes,resizable=yes,statusbar=yes,toolbar=no,scrollbars=yes,width=${width},height=${height},top=${top},left=${left}`;

    let preOpenedPopup: Window | null = null;
    let popupConsumed = false;
    const originalWindowOpen = window.open;

    try {
      preOpenedPopup = originalWindowOpen.call(window, 'about:blank', 'xsthantai_google_auth', specs);
      if (!preOpenedPopup) {
        const formatted = formatFirebaseAuthError({ code: 'auth/popup-blocked' }, inIframe);
        setPopupBlocked(formatted.popupBlocked);
        setAuthError(formatted.message);
        return;
      }

      try {
        preOpenedPopup.document.title = 'Đang kết nối đăng nhập Google...';
        preOpenedPopup.document.body.innerHTML =
          '<div style="font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;height:90vh;color:#334155;font-size:14px;">Đang kết nối tới Google để xác nhận tài khoản...</div>';
      } catch {
        // Ignore cross-origin or restricted document write errors
      }

      window.open = function patchedOpen(
        url?: string | URL,
        target?: string,
        features?: string
      ): Window | null {
        const urlStr = typeof url === 'string' ? url : url ? url.toString() : '';
        if (urlStr.includes('/__/auth/handler') && preOpenedPopup && !preOpenedPopup.closed) {
          popupConsumed = true;
          window.open = originalWindowOpen;
          try {
            preOpenedPopup.location.replace(urlStr);
            preOpenedPopup.focus();
          } catch {
            preOpenedPopup.location.href = urlStr;
          }
          return preOpenedPopup;
        }
        return originalWindowOpen.call(window, url, target, features);
      };

      await signInWithPopup(auth, googleAuthProvider, browserPopupRedirectResolver);
    } catch (err: unknown) {
      console.error('[Auth] Google signInWithPopup failed:', err);
      const formatted = formatFirebaseAuthError(err, inIframe);
      setPopupBlocked(formatted.popupBlocked);
      setAuthError(formatted.message);
    } finally {
      window.open = originalWindowOpen;
      if (preOpenedPopup && !popupConsumed && !preOpenedPopup.closed) {
        try {
          preOpenedPopup.close();
        } catch {
          // Ignore close errors
        }
      }
      signingInRef.current = false;
      setSigningIn(false);
    }
  };

  const logout = async () => {
    await signOut(auth);
    setProfile(null);
  };

  const clearAuthError = () => {
    setAuthError(null);
    setPopupBlocked(false);
  };

  const isAdmin = Boolean(
    firebaseUser?.email &&
      firebaseUser.email.trim().toLowerCase() === ALLOWED_ADMIN_EMAIL &&
      (!profile || profile.role === 'admin')
  );

  return (
    <AuthContext.Provider
      value={{
        firebaseUser,
        profile,
        isAdmin,
        loading,
        signingIn,
        authError,
        popupBlocked,
        inIframe,
        getToken,
        loginWithGoogle,
        logout,
        clearAuthError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
