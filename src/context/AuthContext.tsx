import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  getRedirectResult,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  type User,
} from 'firebase/auth';
import { auth, googleAuthProvider } from '../lib/firebase';

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
  loading: boolean;
  authError: string | null;
  popupBlocked: boolean;
  inIframe: boolean;
  getToken: () => Promise<string | null>;
  loginWithGoogle: () => Promise<void>;
  loginWithRedirect: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function extractFirebaseErrorCode(err: unknown): string {
  if (err && typeof err === 'object' && 'code' in err && typeof (err as { code: unknown }).code === 'string') {
    return (err as { code: string }).code;
  }
  return '';
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

    // Complete pending redirect sign-in if returning from signInWithRedirect
    getRedirectResult(auth).catch((err: unknown) => {
      const code = extractFirebaseErrorCode(err);
      if (code && code !== 'auth/no-current-user') {
        setAuthError(err instanceof Error ? err.message : 'Không thể hoàn tất đăng nhập chuyển hướng.');
      }
    });

    const unsub = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (user) {
        setAuthError(null);
        setPopupBlocked(false);
        try {
          const token = await user.getIdToken();
          const res = await fetch('/api/auth/me', {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (res.ok) {
            const data = (await res.json()) as { user: AppUserProfile };
            setProfile(data.user);
          } else {
            setProfile(null);
          }
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

  const loginWithRedirect = async () => {
    setAuthError(null);
    setPopupBlocked(false);
    try {
      await signInWithRedirect(auth, googleAuthProvider);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Đăng nhập chuyển hướng thất bại.';
      setAuthError(msg);
    }
  };

  const loginWithGoogle = async () => {
    setAuthError(null);
    setPopupBlocked(false);
    try {
      await signInWithPopup(auth, googleAuthProvider);
    } catch (err: unknown) {
      const code = extractFirebaseErrorCode(err);
      if (
        code === 'auth/popup-blocked' ||
        code === 'auth/operation-not-supported-in-this-environment'
      ) {
        if (!inIframe) {
          // Top-level web tab: seamlessly fall back to redirect sign-in
          try {
            await signInWithRedirect(auth, googleAuthProvider);
            return;
          } catch (redirErr: unknown) {
            setAuthError(
              redirErr instanceof Error ? redirErr.message : 'Không thể chuyển hướng đăng nhập Google.'
            );
            return;
          }
        }
        setPopupBlocked(true);
        setAuthError(
          'Trình duyệt đang chặn cửa sổ bật lên (Popup) để đăng nhập Google. Vui lòng bật cho phép Popup cho trang này rồi bấm thử lại, hoặc mở trang trong tab mới để đăng nhập.'
        );
        return;
      }

      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        setAuthError('Cửa sổ đăng nhập Google đã bị đóng trước khi hoàn tất.');
        return;
      }

      if (code === 'auth/unauthorized-domain') {
        setAuthError(
          `Tên miền ${window.location.hostname} chưa được thêm vào Authorized Domains trong Firebase Authentication.`
        );
        return;
      }

      const msg = err instanceof Error ? err.message : 'Đăng nhập thất bại.';
      setAuthError(msg);
    }
  };

  const logout = async () => {
    await signOut(auth);
    setProfile(null);
  };

  return (
    <AuthContext.Provider
      value={{
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
