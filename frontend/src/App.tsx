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
  Image as ImageIcon,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  MoreHorizontal,
  Sun,
  Users,
  X,
} from 'lucide-react';

type NavItem = {
  to: string;
  label: string;
  shortLabel: string;
  icon: ReactNode;
  roles: Array<'admin' | 'manager' | 'employee'>;
};

const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Dashboard', shortLabel: 'Home', icon: <LayoutDashboard size={20} />, roles: ['admin', 'manager', 'employee'] },
  { to: '/manage', label: 'Day sheet', shortLabel: 'Day sheet', icon: <Calculator size={20} />, roles: ['admin', 'manager'] },
  { to: '/carpets', label: 'Carpets', shortLabel: 'Carpets', icon: <ImageIcon size={20} />, roles: ['admin', 'manager', 'employee'] },
  { to: '/prices', label: 'Prices', shortLabel: 'Prices', icon: <DollarSign size={20} />, roles: ['admin'] },
  { to: '/employees', label: 'Employees', shortLabel: 'Staff', icon: <Users size={20} />, roles: ['admin'] },
];

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link to="/" className="flex items-center gap-2.5">
      <img
        src="/images/logo.jpeg"
        alt="Extreme Auto Carwash"
        className={`${compact ? 'h-9 w-9' : 'h-10 w-10'} rounded-xl object-cover ring-1 ring-black/5 dark:ring-white/10`}
      />
      <div className="leading-tight">
        <p className="text-[13px] font-extrabold tracking-[0.14em] text-slate-900 dark:text-white">EXTREME</p>
        <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-brand-600 dark:text-brand-300">
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

  const activeItem = items.find((item) => item.to === location.pathname);
  const activeLabel = activeItem?.label ?? 'Dashboard';

  // Keep the bottom bar light: at most three tabs plus "More".
  const bottomItems = items.slice(0, 3);

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

  const initial = (user.full_name || user.abbreviation || '?').charAt(0).toUpperCase();

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 transition-colors duration-200 dark:bg-slate-950 dark:text-slate-100">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-slate-200/80 bg-white dark:border-white/10 dark:bg-slate-900/70 dark:backdrop-blur-xl lg:flex">
        <div className="flex h-16 items-center border-b border-slate-200/80 px-5 dark:border-white/10">
          <Brand />
        </div>

        <nav className="flex-1 space-y-1 p-3">
          <p className="px-3 pb-2 pt-2 text-[10px] font-extrabold uppercase tracking-[0.2em] text-slate-400">Workspace</p>
          {items.map((item) => {
            const active = location.pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`group flex min-h-[44px] items-center gap-3 rounded-xl px-3 text-sm font-bold transition ${
                  active
                    ? 'bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-200'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-white'
                }`}
              >
                <span className={active ? 'text-brand-600 dark:text-brand-300' : 'text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-200'}>
                  {item.icon}
                </span>
                {item.label}
              </Link>
            );
          })}

          <div className="pt-4">
            <p className="px-3 pb-2 text-[10px] font-extrabold uppercase tracking-[0.2em] text-slate-400">Account</p>
            <button
              onClick={() => setShowPwModal(true)}
              className="flex min-h-[44px] w-full items-center gap-3 rounded-xl px-3 text-sm font-bold text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-white"
            >
              <KeyRound size={19} className="text-slate-400" /> Change password
            </button>
            <button
              onClick={() => setDarkMode((v) => !v)}
              className="flex min-h-[44px] w-full items-center gap-3 rounded-xl px-3 text-sm font-bold text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-white"
            >
              {darkMode ? <Sun size={19} className="text-amber-400" /> : <Moon size={19} className="text-slate-400" />}
              {darkMode ? 'Light mode' : 'Dark mode'}
            </button>
          </div>
        </nav>

        <div className="border-t border-slate-200/80 p-3 dark:border-white/10">
          <div className="flex items-center gap-3 rounded-2xl bg-slate-100/70 p-2.5 dark:bg-white/5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-cyan-500 text-sm font-extrabold text-white">
              {initial}
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

      {/* Mobile drawer / sheet */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-x-0 bottom-0 flex max-h-[85vh] flex-col overflow-y-auto rounded-t-3xl border-t border-slate-200 bg-white p-4 pb-safe shadow-2xl dark:border-white/10 dark:bg-slate-900">
            <div className="mb-3 flex items-center justify-between">
              <Brand compact />
              <button onClick={() => setMobileOpen(false)} className="btn-icon" aria-label="Close menu">
                <X size={18} />
              </button>
            </div>
            <nav className="grid grid-cols-1 gap-1">
              {items.map((item) => {
                const active = location.pathname === item.to;
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={`flex min-h-[48px] items-center gap-3 rounded-xl px-3 text-sm font-bold ${
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
                className="flex min-h-[48px] w-full items-center gap-3 rounded-xl px-3 text-sm font-bold text-slate-600 dark:text-slate-300"
              >
                <KeyRound size={20} /> Change password
              </button>
              <button
                onClick={() => setDarkMode((v) => !v)}
                className="flex min-h-[48px] w-full items-center gap-3 rounded-xl px-3 text-sm font-bold text-slate-600 dark:text-slate-300"
              >
                {darkMode ? <Sun size={20} /> : <Moon size={20} />} {darkMode ? 'Light mode' : 'Dark mode'}
              </button>
            </nav>
            <div className="mt-4 flex items-center gap-3 border-t border-slate-200 pt-4 dark:border-white/10">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-cyan-500 text-sm font-extrabold text-white">
                {initial}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold">{user.full_name || user.abbreviation}</p>
                <p className="text-[11px] capitalize text-slate-500 dark:text-slate-400">{user.role}</p>
              </div>
              <button onClick={logout} className="btn-danger btn-sm">
                <LogOut size={16} /> Sign out
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Main column */}
      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-2 border-b border-slate-200/80 bg-white/85 px-3 backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/80 sm:px-5 lg:h-16">
          <div className="flex min-w-0 items-center gap-2">
            <div className="lg:hidden">
              <Brand compact />
            </div>
            <div className="hidden min-w-0 lg:block">
              <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-slate-400">Extreme Auto Carwash</p>
              <h1 className="truncate text-base font-extrabold tracking-tight text-slate-900 dark:text-white">{activeLabel}</h1>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setDarkMode((v) => !v)}
              className="btn-icon"
              aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {darkMode ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <button
              onClick={() => setMobileOpen(true)}
              className="btn-icon lg:hidden"
              aria-label="Open menu"
            >
              <MoreHorizontal size={20} />
            </button>
            <div className="hidden items-center gap-2 rounded-full border border-slate-200 py-1 pl-1 pr-2.5 dark:border-white/10 sm:flex">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-cyan-500 text-[11px] font-extrabold text-white">
                {initial}
              </div>
              <span className="text-xs font-bold">{user.abbreviation}</span>
            </div>
          </div>
        </header>

        <main className="mx-auto min-h-[calc(100vh-3.5rem)] max-w-[1500px] px-3 py-4 pb-28 sm:px-5 sm:py-5 lg:px-8 lg:py-7 lg:pb-10">
          <Routes>
            <Route
              path="/"
              element={
                user.role === 'admin' ? <AdminDashboard /> :
                user.role === 'manager' ? <Navigate to="/manage" replace /> :
                <EmployeeDashboard />
              }
            />
            <Route path="/login" element={<Navigate to="/" replace />} />
            <Route path="/manage" element={user.role === 'admin' || user.role === 'manager' ? <ManagerPanel /> : <Navigate to="/" replace />} />
            <Route path="/carpets" element={<CarpetsPanel />} />
            <Route path="/prices" element={user.role === 'admin' ? <PricesPanel /> : <Navigate to="/" replace />} />
            <Route path="/employees" element={user.role === 'admin' ? <EmployeeManagement /> : <Navigate to="/" replace />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>

      {/* Mobile bottom navigation */}
      <nav className="bottom-nav">
        <div className="mx-auto flex max-w-lg items-stretch">
          {bottomItems.map((item) => {
            const active = location.pathname === item.to ||
              (item.to === '/' && user.role === 'manager' && location.pathname === '/manage');
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`bottom-nav-item ${active ? 'bottom-nav-item-active' : ''}`}
              >
                <span className="bottom-nav-pill">{item.icon}</span>
                <span className="truncate">{item.shortLabel}</span>
              </Link>
            );
          })}
          <button
            onClick={() => setMobileOpen(true)}
            className="bottom-nav-item"
            aria-label="More options"
          >
            <span className="bottom-nav-pill"><Menu size={20} /></span>
            <span>More</span>
          </button>
        </div>
      </nav>

      {showPwModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/60 backdrop-blur-sm sm:items-center sm:p-4">
          <div className="w-full max-w-md rounded-t-3xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-white/10 dark:bg-slate-900 sm:rounded-3xl">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-extrabold tracking-tight">Change password</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Use at least 4 characters.</p>
              </div>
              <button onClick={() => setShowPwModal(false)} className="btn-icon" aria-label="Close">
                <X size={18} />
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
                className="btn-primary w-full"
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
