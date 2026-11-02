import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { BrowserRouter, Routes, Route, Link, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import api from './services/api';
import Login from './pages/Login';
import LandingPage from './pages/LandingPage';
import AdminDashboard from './pages/AdminDashboard';
import ManagerPanel from './pages/ManagerPanel';
import EmployeeManagement from './pages/EmployeeManagement';
import EmployeeDashboard from './pages/EmployeeDashboard';
import CarpetsPanel from './pages/CarpetsPanel';
import PricesPanel from './pages/PricesPanel';
import {
  Calculator,
  DollarSign,
  Image,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  Sun,
  Users,
  X,
} from 'lucide-react';

type NavItem = {
  to: string;
  label: string;
  icon: ReactNode;
  roles: Array<'admin' | 'manager' | 'employee'>;
};

const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: <LayoutDashboard size={19} />, roles: ['admin', 'manager', 'employee'] },
  { to: '/manage', label: 'Manager panel', icon: <Calculator size={19} />, roles: ['admin', 'manager'] },
  { to: '/carpets', label: 'Carpets', icon: <Image size={19} />, roles: ['admin', 'manager'] },
  { to: '/prices', label: 'Prices', icon: <DollarSign size={19} />, roles: ['admin', 'manager'] },
  { to: '/employees', label: 'Employees', icon: <Users size={19} />, roles: ['admin'] },
];

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link to="/" className="flex items-center gap-3">
      <img
        src="/images/logo.jpeg"
        alt="Extreme Auto Carwash"
        className={`${compact ? 'h-9 w-9' : 'h-11 w-11'} rounded-xl object-cover ring-1 ring-black/5 dark:ring-white/10`}
      />
      <div className="leading-tight">
        <p className="text-sm font-black tracking-[0.14em] text-slate-900 dark:text-white">EXTREME</p>
        <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-brand-600 dark:text-brand-300">
          Auto Carwash
        </p>
      </div>
    </Link>
  );
}

function Splash() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-5 bg-slate-950 text-white">
      <img src="/images/logo.jpeg" alt="Extreme Auto Carwash" className="h-16 w-16 rounded-2xl object-cover ring-1 ring-white/15" />
      <div className="flex items-center gap-3 text-sm text-slate-300">
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/20 border-t-brand-400" />
        Preparing your workspace…
      </div>
    </div>
  );
}

function AppContent() {
  const { user, ready, logout } = useAuth();
  const location = useLocation();
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('theme');
    if (saved) return saved === 'dark';
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
  });
  const [mobileOpen, setMobileOpen] = useState(false);
  const [showPwModal, setShowPwModal] = useState(false);
  const [pw, setPw] = useState({ current: '', next: '', confirm: '' });
  const [pwBusy, setPwBusy] = useState(false);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
    localStorage.setItem('theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const items = useMemo(() => {
    if (!user) return [];
    return NAV_ITEMS.filter((item) => item.roles.includes(user.role));
  }, [user]);

  const activeLabel = items.find((item) => item.to === location.pathname)?.label ?? 'Dashboard';

  const submitPassword = async () => {
    if (pw.next !== pw.confirm) { alert('New passwords do not match'); return; }
    if (pw.next.length < 4) { alert('New password must be at least 4 characters'); return; }
    setPwBusy(true);
    try {
      await api.post('/auth/change-password', {
        current_password: pw.current,
        new_password: pw.next,
      });
      alert('Password changed successfully');
      setPw({ current: '', next: '', confirm: '' });
      setShowPwModal(false);
    } catch (e: any) {
      alert(e?.response?.data?.detail || 'Could not change password');
    } finally {
      setPwBusy(false);
    }
  };

  if (!ready) return <Splash />;

  if (!user) {
    return (
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 transition-colors duration-200 dark:bg-slate-950 dark:text-slate-100">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-72 flex-col border-r border-slate-200/80 bg-white dark:border-white/10 dark:bg-slate-900/70 dark:backdrop-blur-xl lg:flex">
        <div className="flex h-20 items-center border-b border-slate-200/80 px-6 dark:border-white/10">
          <Brand />
        </div>

        <nav className="flex-1 space-y-1.5 p-4">
          <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-[0.24em] text-slate-400">Workspace</p>
          {items.map((item) => {
            const active = location.pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
                  active
                    ? 'bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-200'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-white'
                }`}
              >
                <span className={`${active ? 'text-brand-600 dark:text-brand-300' : 'text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-200'}`}>
                  {item.icon}
                </span>
                {item.label}
              </Link>
            );
          })}

          <div className="pt-6">
            <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-[0.24em] text-slate-400">Account</p>
            <button
              onClick={() => setShowPwModal(true)}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-white"
            >
              <KeyRound size={19} className="text-slate-400" /> Change password
            </button>
            <button
              onClick={() => setDarkMode((v) => !v)}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-white"
            >
              {darkMode ? <Sun size={19} className="text-amber-400" /> : <Moon size={19} className="text-slate-400" />}
              {darkMode ? 'Light mode' : 'Dark mode'}
            </button>
          </div>
        </nav>

        <div className="border-t border-slate-200/80 p-4 dark:border-white/10">
          <div className="flex items-center gap-3 rounded-2xl bg-slate-100/70 p-3 dark:bg-white/5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-cyan-500 text-sm font-black text-white">
              {(user.full_name || user.abbreviation || '?').charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold">{user.full_name || user.abbreviation}</p>
              <p className="text-[11px] font-medium capitalize text-slate-500 dark:text-slate-400">{user.role}</p>
            </div>
            <button
              onClick={logout}
              title="Sign out"
              className="rounded-xl p-2 text-slate-400 transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-80 max-w-[85vw] flex-col border-r border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-slate-900">
            <div className="flex h-20 items-center justify-between border-b border-slate-200 px-5 dark:border-white/10">
              <Brand compact />
              <button onClick={() => setMobileOpen(false)} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5">
                <X size={20} />
              </button>
            </div>
            <nav className="flex-1 space-y-1.5 p-4">
              {items.map((item) => {
                const active = location.pathname === item.to;
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold ${
                      active
                        ? 'bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-200'
                        : 'text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {item.icon}
                    {item.label}
                  </Link>
                );
              })}
              <button
                onClick={() => { setMobileOpen(false); setShowPwModal(true); }}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-slate-600 dark:text-slate-300"
              >
                <KeyRound size={19} /> Change password
              </button>
              <button
                onClick={() => setDarkMode((v) => !v)}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-slate-600 dark:text-slate-300"
              >
                {darkMode ? <Sun size={19} /> : <Moon size={19} />} {darkMode ? 'Light mode' : 'Dark mode'}
              </button>
            </nav>
            <div className="border-t border-slate-200 p-4 dark:border-white/10">
              <div className="mb-3 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-cyan-500 text-sm font-black text-white">
                  {(user.full_name || user.abbreviation || '?').charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold">{user.full_name || user.abbreviation}</p>
                  <p className="text-[11px] capitalize text-slate-500 dark:text-slate-400">{user.role}</p>
                </div>
              </div>
              <button onClick={logout} className="flex w-full items-center justify-center gap-2 rounded-xl bg-red-50 py-2.5 text-sm font-bold text-red-600 dark:bg-red-500/10 dark:text-red-300">
                <LogOut size={17} /> Sign out
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Main column */}
      <div className="lg:pl-72">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-slate-200/80 bg-white/80 px-4 backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/70 sm:px-6 lg:h-20">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileOpen(true)}
              className="rounded-xl border border-slate-200 p-2 text-slate-600 dark:border-white/10 dark:text-slate-300 lg:hidden"
              aria-label="Open menu"
            >
              <Menu size={20} />
            </button>
            <div className="lg:hidden">
              <Brand compact />
            </div>
            <div className="hidden lg:block">
              <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-400">Extreme Auto Carwash</p>
              <h1 className="text-lg font-black tracking-tight text-slate-900 dark:text-white">{activeLabel}</h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setDarkMode((v) => !v)}
              className="rounded-xl border border-slate-200 p-2.5 text-slate-500 transition hover:bg-slate-100 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5"
              title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {darkMode ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <div className="hidden items-center gap-2 rounded-full border border-slate-200 py-1 pl-1 pr-3 dark:border-white/10 sm:flex">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-cyan-500 text-xs font-black text-white">
                {(user.full_name || user.abbreviation || '?').charAt(0).toUpperCase()}
              </div>
              <span className="text-xs font-bold">{user.abbreviation}</span>
            </div>
          </div>
        </header>

        <main className="mx-auto min-h-[calc(100vh-5rem)] max-w-[1600px] px-3 py-4 sm:px-5 sm:py-6 lg:px-8 lg:py-8">
          <Routes>
            <Route
              path="/"
              element={
                user.role === 'admin' ? <AdminDashboard /> :
                user.role === 'manager' ? <ManagerPanel /> :
                <EmployeeDashboard />
              }
            />
            <Route path="/login" element={<Navigate to="/" replace />} />
            <Route path="/manage" element={user.role === 'admin' || user.role === 'manager' ? <ManagerPanel /> : <Navigate to="/" replace />} />
            <Route path="/carpets" element={user.role === 'admin' || user.role === 'manager' ? <CarpetsPanel /> : <Navigate to="/" replace />} />
            <Route path="/prices" element={user.role === 'admin' || user.role === 'manager' ? <PricesPanel /> : <Navigate to="/" replace />} />
            <Route path="/employees" element={user.role === 'admin' ? <EmployeeManagement /> : <Navigate to="/" replace />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>

      {showPwModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm print:hidden">
          <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-white/10 dark:bg-slate-900">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-black tracking-tight">Change password</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Use at least 4 characters.</p>
              </div>
              <button onClick={() => setShowPwModal(false)} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5">
                <X size={20} />
              </button>
            </div>
            <div className="space-y-3">
              <input
                type="password"
                placeholder="Current password"
                value={pw.current}
                className="input-base"
                onChange={(e) => setPw({ ...pw, current: e.target.value })}
              />
              <input
                type="password"
                placeholder="New password"
                value={pw.next}
                className="input-base"
                onChange={(e) => setPw({ ...pw, next: e.target.value })}
              />
              <input
                type="password"
                placeholder="Confirm new password"
                value={pw.confirm}
                className="input-base"
                onChange={(e) => setPw({ ...pw, confirm: e.target.value })}
              />
              <button
                onClick={submitPassword}
                disabled={pwBusy}
                className="btn-primary w-full justify-center"
              >
                {pwBusy ? 'Saving…' : 'Save new password'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppContent />
      </BrowserRouter>
    </AuthProvider>
  );
}
