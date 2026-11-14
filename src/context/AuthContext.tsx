import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut, type User } from 'firebase/auth';
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
  getToken: () => Promise<string | null>;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<AppUserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      setAuthError(null);
      if (user) {
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

  const loginWithGoogle = async () => {
    setAuthError(null);
    try {
      await signInWithPopup(auth, googleAuthProvider);
    } catch (err: unknown) {
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
      value={{ firebaseUser, profile, loading, authError, getToken, loginWithGoogle, logout }}
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
