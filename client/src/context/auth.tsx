import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { ReactNode } from 'react';
import {
  clearToken,
  getToken,
  setToken as persistToken,
  setUnauthorizedHandler,
} from '../api/client';
import { auth as authApi } from '../api/endpoints';
import type { Employer, LoginPayload, RegisterPayload } from '../api/types';

const EMPLOYER_KEY = 'payroll.employer';

interface AuthState {
  employer: Employer | null;
  isAuthenticated: boolean;
  login: (payload: LoginPayload) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

function loadEmployer(): Employer | null {
  try {
    const raw = localStorage.getItem(EMPLOYER_KEY);
    return raw ? (JSON.parse(raw) as Employer) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  // Hydrate from storage so a refresh keeps the session (the JWT lives there too).
  const [employer, setEmployer] = useState<Employer | null>(() =>
    getToken() ? loadEmployer() : null,
  );

  const logout = useCallback(() => {
    clearToken();
    localStorage.removeItem(EMPLOYER_KEY);
    setEmployer(null);
  }, []);

  // Any 401 from the API client forces a logout (token expired/invalid).
  useEffect(() => {
    setUnauthorizedHandler(() => logout());
  }, [logout]);

  const persist = useCallback((token: string, emp: Employer) => {
    persistToken(token);
    localStorage.setItem(EMPLOYER_KEY, JSON.stringify(emp));
    setEmployer(emp);
  }, []);

  const login = useCallback(
    async (payload: LoginPayload) => {
      const res = await authApi.login(payload);
      persist(res.accessToken, res.employer);
    },
    [persist],
  );

  const register = useCallback(
    async (payload: RegisterPayload) => {
      const res = await authApi.register(payload);
      persist(res.accessToken, res.employer);
    },
    [persist],
  );

  const value = useMemo<AuthState>(
    () => ({
      employer,
      isAuthenticated: !!employer,
      login,
      register,
      logout,
    }),
    [employer, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
