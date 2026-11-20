import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import { auth, googleAuthProvider } from '../lib/firebase';

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
  authError: string | null;
  popupBlocked: boolean;
  inIframe: boolean;
  getToken: () => Promise<string | null>;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
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

  if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
    return {
      popupBlocked: false,
      message: 'Cửa sổ đăng nhập Google đã bị đóng trước khi hoàn tất.',
    };
  }

  if (code === 'auth/unauthorized-domain') {
    const host = typeof window !== 'undefined' ? window.location.hostname : '';
    return {
      popupBlocked: false,
      message: `Tên miền hiện tại (${host}) chưa được cấp phép trong Firebase Authorized Domains. Vui lòng mở ứng dụng qua URL chính thức hoặc thêm "${host}" vào Firebase Console -> Authentication -> Settings -> Authorized domains.`,
    };
  }

  if (code === 'auth/network-request-failed') {
    return {
      popupBlocked: false,
      message: 'Lỗi kết nối mạng khi xác thực Google. Vui lòng kiểm tra kết nối và thử lại.',
    };
  }

  return {
    popupBlocked: false,
    message: err instanceof Error ? err.message : 'Đăng nhập thất bại.',
  };
}

async function fetchAuthProfileWithRetry(token: string): Promise<AppUserProfile | null> {
  const delays = [600, 1200, 2000];
  for (let attempt = 0; attempt <= delays.length; attempt++) {
    try {
      const res = await fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const ct = res.headers.get('content-type') || '';
      if (res.ok && ct.includes('application/json')) {
        const data = (await res.json()) as { user: AppUserProfile };
        return data.user;
      }
      if (res.status < 500 && ct.includes('application/json')) {
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
  const [authError, setAuthError] = useState<string | null>(null);
  const [popupBlocked, setPopupBlocked] = useState(false);
  const [inIframe] = useState(() => {
    try {
      return typeof window !== 'undefined' && window.self !== window.top;
    } catch {
      return true;
    }
  });

  useEffect(() => {
    googleAuthProvider.setCustomParameters({ prompt: 'select_account' });

    const unsub = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (user) {
        setAuthError(null);
        setPopupBlocked(false);
        try {
          const token = await user.getIdToken();
          const syncedProfile = await fetchAuthProfileWithRetry(token);
          setProfile(syncedProfile);
        } catch {
          setProfile(null);
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const getToken = async () => {
    if (!auth.currentUser) return null;
    return auth.currentUser.getIdToken();
  };

  const loginWithGoogle = async () => {
    setAuthError(null);
    setPopupBlocked(false);
    try {
      await signInWithPopup(auth, googleAuthProvider);
    } catch (err: unknown) {
      const formatted = formatFirebaseAuthError(err, inIframe);
      setPopupBlocked(formatted.popupBlocked);
      setAuthError(formatted.message);
    }
  };

  const logout = async () => {
    await signOut(auth);
    setProfile(null);
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
        authError,
        popupBlocked,
        inIframe,
        getToken,
        loginWithGoogle,
        logout,
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
