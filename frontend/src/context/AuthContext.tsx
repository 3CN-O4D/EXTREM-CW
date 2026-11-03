import React, { createContext, useContext, useEffect, useState } from 'react';
import api, { clearApiCache } from '../services/api';

export interface User {
  id?: number;
  abbreviation: string;
  role: 'admin' | 'manager' | 'employee';
  full_name: string;
  payable_balance?: number;
  debt_balance?: number;
}

interface AuthContextType {
  user: User | null;
  ready: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function readSavedUser(): User | null {
  try {
    const raw = localStorage.getItem('user');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || !parsed.role) return null;
    return parsed as User;
  } catch {
    localStorage.removeItem('user');
    return null;
  }
}

function userFromToken(token: string): User | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    if (!payload?.sub || !payload?.role) return null;
    return {
      abbreviation: payload.sub,
      role: payload.role,
      full_name: payload.sub,
    };
  } catch {
    return null;
  }
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const expire = () => {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      setUser(null);
      setReady(true);
    };

    window.addEventListener('auth:expired', expire);

    const restore = async () => {
      const token = localStorage.getItem('token');
      if (!token) {
        setUser(null);
        setReady(true);
        return;
      }

      const saved = readSavedUser() || userFromToken(token);
      if (!saved) {
        expire();
        return;
      }

      // Show the saved profile immediately (no white flash), then verify the
      // token in the background. A 401 fires `auth:expired` via the interceptor.
      setUser(saved);
      try {
        const res = await api.get('/auth/me');
        const fresh = res.data as User;
        if (cancelled) return;
        setUser(fresh);
        localStorage.setItem('user', JSON.stringify(fresh));
      } catch {
        // Interceptor already clears the session on 401. For network errors we
        // keep the saved profile so the user can retry from the panel.
      } finally {
        if (!cancelled) setReady(true);
      }
    };

    restore();

    return () => {
      cancelled = true;
      window.removeEventListener('auth:expired', expire);
    };
  }, []);

  const login = (token: string, nextUser: User) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(nextUser));
    // Legacy keys used by a couple of older screens.
    localStorage.setItem('userRole', nextUser.role);
    localStorage.setItem('userId', String(nextUser.id ?? ''));
    setUser(nextUser);
    setReady(true);
  };

  const logout = () => {
    clearApiCache();
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('userRole');
    localStorage.removeItem('userId');
    setUser(null);
    setReady(true);
  };

  return (
    <AuthContext.Provider value={{ user, ready, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
