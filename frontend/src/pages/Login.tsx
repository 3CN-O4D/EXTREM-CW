import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Eye, EyeOff, Loader2, LockKeyhole, Sparkles, UserRound } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const formData = new URLSearchParams();
      formData.append('username', username.trim());
      formData.append('password', password);

      const response = await api.post('/auth/token', formData.toString(), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });
      const { access_token, user } = response.data;

      // Fall back to decoding the JWT for older API builds that do not return
      // the user object alongside the token.
      let profile = user;
      if (!profile) {
        const payload = JSON.parse(atob(access_token.split('.')[1]));
        profile = {
          abbreviation: payload.sub,
          role: payload.role,
          full_name: payload.sub,
        };
      }

      login(access_token, profile);
      navigate('/');
    } catch (err: any) {
      const status = err?.response?.status;
      if (status === 401) {
        setError('Incorrect username or password.');
      } else if (status === 403) {
        setError(err?.response?.data?.detail || 'This account has been deactivated.');
      } else if (err?.code === 'ECONNABORTED') {
        setError('The server took too long to respond. Please try again.');
      } else if (!err?.response) {
        setError('Cannot reach the server. Check your connection and try again.');
      } else {
        setError(err?.response?.data?.detail || 'Sign in failed. Please try again.');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950">
      {/* Backdrop */}
      <img
        src="/images/soapycarwashing.jpeg"
        alt=""
        className="absolute inset-0 h-full w-full object-cover opacity-30"
      />
      <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-950/90 to-brand-900/70" />
      <div className="absolute -left-32 top-1/4 h-96 w-96 rounded-full bg-brand-500/20 blur-3xl" />
      <div className="absolute -right-24 bottom-0 h-96 w-96 rounded-full bg-cyan-400/10 blur-3xl" />

      <div className="relative z-10 mx-auto flex min-h-screen max-w-6xl items-center px-6 py-12">
        <div className="grid w-full items-center gap-14 lg:grid-cols-2">
          {/* Brand side */}
          <div className="hidden lg:block">
            <Link to="/" className="inline-flex items-center gap-3">
              <img src="/images/logo.jpeg" alt="Extreme Auto Carwash" className="h-14 w-14 rounded-2xl object-cover ring-1 ring-white/20" />
              <div>
                <p className="text-xl font-black tracking-tight text-white">EXTREME</p>
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-brand-300">Auto Carwash</p>
              </div>
            </Link>

            <h1 className="mt-12 max-w-md text-5xl font-black leading-[1.05] tracking-tight text-white">
              Run the wash.
              <span className="block bg-gradient-to-r from-brand-300 to-cyan-300 bg-clip-text text-transparent">
                Own the numbers.
              </span>
            </h1>
            <p className="mt-5 max-w-md text-lg leading-relaxed text-slate-300">
              One workspace for the day sheet, staff wages, debts, carpets and weekly settlements.
            </p>

            <div className="mt-10 flex flex-wrap gap-3">
              {['Live day sheet', 'Wage settlement', 'Debt tracking'].map((item) => (
                <span key={item} className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200 backdrop-blur">
                  <Sparkles size={14} className="text-brand-300" /> {item}
                </span>
              ))}
            </div>
          </div>

          {/* Form side */}
          <div className="mx-auto w-full max-w-md">
            <Link to="/" className="mb-6 inline-flex items-center gap-2 text-sm text-slate-400 transition hover:text-white lg:hidden">
              <ArrowLeft size={16} /> Back to site
            </Link>

            <div className="rounded-3xl border border-white/10 bg-white/[0.07] p-7 shadow-2xl shadow-black/40 backdrop-blur-xl sm:p-9">
              <div className="mb-8 lg:hidden">
                <img src="/images/logo.jpeg" alt="Extreme Auto Carwash" className="h-12 w-12 rounded-xl object-cover" />
              </div>
              <p className="text-xs font-bold uppercase tracking-[0.3em] text-brand-300">Staff portal</p>
              <h2 className="mt-2 text-3xl font-black tracking-tight text-white">Welcome back</h2>
              <p className="mt-2 text-sm text-slate-400">Sign in with your staff abbreviation.</p>

              {error && (
                <div className="mt-6 rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="mt-7 space-y-5">
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-300">Abbreviation</span>
                  <div className="relative">
                    <UserRound size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                      type="text"
                      autoComplete="username"
                      className="w-full rounded-xl border border-white/10 bg-slate-900/60 py-3.5 pl-11 pr-4 text-white placeholder:text-slate-600 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-400/30"
                      placeholder="e.g. admin"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      required
                    />
                  </div>
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-300">Password</span>
                  <div className="relative">
                    <LockKeyhole size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      className="w-full rounded-xl border border-white/10 bg-slate-900/60 py-3.5 pl-11 pr-12 text-white placeholder:text-slate-600 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-400/30"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-2 text-slate-500 transition hover:bg-white/5 hover:text-slate-300"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </label>

                <button
                  type="submit"
                  disabled={busy}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-brand-500 to-cyan-500 py-3.5 text-sm font-bold text-white shadow-lg shadow-brand-500/25 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {busy && <Loader2 size={17} className="animate-spin" />}
                  {busy ? 'Signing in…' : 'Sign In'}
                </button>
              </form>

              <p className="mt-7 text-center text-xs text-slate-500">
                Trouble signing in? Ask the manager to reset your password.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
