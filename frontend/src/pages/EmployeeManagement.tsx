import React, { useState, useEffect } from 'react';
import { Loader2, Pencil, Plus, Trash2, UserRound, X } from 'lucide-react';
import api from '../services/api';
import { InlineError } from '../components/States';

const EMPTY_FORM = { full_name: '', abbreviation: '', role: 'employee', password: '' };

export default function EmployeeManagement() {
  const [users, setUsers] = useState<any[]>([]);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const fetchUsers = async () => {
    setError('');
    try {
      const res = await api.get('/auth/users');
      setUsers(res.data);
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Could not load staff. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchUsers();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      if (editingUser) {
        const payload: any = { ...form };
        if (!payload.password) delete payload.password;
        await api.put(`/auth/users/${editingUser.id}`, payload);
      } else {
        await api.post('/auth/users', form);
      }
      setEditingUser(null);
      setForm({ ...EMPTY_FORM });
      await fetchUsers();
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Could not save this user.');
    } finally {
      setBusy(false);
    }
  };

  const handleEdit = (user: any) => {
    setEditingUser(user);
    setForm({
      full_name: user.full_name,
      abbreviation: user.abbreviation,
      role: user.role,
      password: '',
    });
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Delete this user?')) return;
    setError('');
    try {
      await api.delete(`/auth/users/${id}`);
      await fetchUsers();
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Could not delete this user.');
    }
  };

  const cancelEdit = () => {
    setEditingUser(null);
    setForm({ ...EMPTY_FORM });
  };

  return (
    <div className="mx-auto max-w-[1300px] space-y-6 px-1 py-1 sm:px-2 lg:px-0">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-brand-600 dark:text-brand-400">Team</p>
        <h1 className="section-title mt-1">Employee management</h1>
        <p className="muted mt-1 text-sm">Add staff, set roles and reset passwords.</p>
      </div>

      {error && <InlineError message={error} onRetry={fetchUsers} />}

      <div className="stat-grid xl:grid-cols-4">
        {[
          { label: 'Accounts', value: users.length, cls: 'text-slate-900 dark:text-white' },
          { label: 'Admins', value: users.filter((u) => u.role === 'admin').length, cls: 'text-red-600 dark:text-red-400' },
          { label: 'Managers', value: users.filter((u) => u.role === 'manager').length, cls: 'text-brand-600 dark:text-brand-300' },
          { label: 'Employees', value: users.filter((u) => u.role === 'employee').length, cls: 'text-emerald-600 dark:text-emerald-400' },
        ].map((s) => (
          <div key={s.label} className="stat-tile">
            <p className="stat-label">{s.label}</p>
            <p className={`stat-value ${s.cls}`}>{s.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        {/* Form */}
        <div className="card-pad h-fit">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-black tracking-tight">
                {editingUser ? 'Edit user' : 'Add new user'}
              </h2>
              <p className="muted text-xs">
                {editingUser ? `Updating ${editingUser.full_name}` : 'Create a login for a staff member.'}
              </p>
            </div>
            <span className="rounded-xl bg-brand-50 p-2.5 text-brand-600 dark:bg-brand-500/10 dark:text-brand-300">
              {editingUser ? <Pencil size={18} /> : <Plus size={18} />}
            </span>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-300">Full name</span>
              <input
                placeholder="e.g. John Kariuki"
                className="input-base"
                value={form.full_name}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                required
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-300">Abbreviation (login)</span>
              <input
                placeholder="e.g. JK"
                className="input-base"
                value={form.abbreviation}
                onChange={(e) => setForm({ ...form, abbreviation: e.target.value })}
                required
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-300">Role</span>
              <select
                className="input-base"
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
              >
                <option value="employee">Employee</option>
                <option value="manager">Manager</option>
                <option value="admin">Admin</option>
              </select>
            </label>

            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-300">Password</span>
              <input
                type="password"
                placeholder={editingUser ? 'Leave blank to keep the same' : 'Set a password'}
                className="input-base"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                required={!editingUser}
              />
            </label>

            <div className="flex gap-2 pt-1">
              <button type="submit" disabled={busy} className="btn-primary flex-1 justify-center py-2.5">
                {busy && <Loader2 size={16} className="animate-spin" />}
                {busy ? 'Saving…' : editingUser ? 'Update user' : 'Create user'}
              </button>
              {editingUser && (
                <button type="button" onClick={cancelEdit} className="btn-secondary justify-center">
                  <X size={16} /> Cancel
                </button>
              )}
            </div>
          </form>
        </div>

        {/* List */}
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-200/80 px-5 py-4 dark:border-white/10">
            <div>
              <h2 className="text-lg font-black tracking-tight">Current staff</h2>
              <p className="muted text-xs">{users.length} {users.length === 1 ? 'account' : 'accounts'}</p>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600 dark:bg-white/5 dark:text-slate-300">
              {users.length}
            </span>
          </div>

          {loading ? (
            <div className="flex items-center gap-3 px-5 py-12 text-sm font-medium text-slate-500 dark:text-slate-400">
              <Loader2 size={18} className="animate-spin text-brand-500" /> Loading staff…
            </div>
          ) : users.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 dark:bg-white/5">
                <UserRound size={22} />
              </span>
              <p className="mt-3 text-sm font-bold">No staff yet</p>
              <p className="muted mt-1 text-xs">Use the form to create the first account.</p>
            </div>
          ) : (
            <ul className="divide-y divide-slate-200/70 dark:divide-white/10">
              {users.map((u) => (
                <li key={u.id} className="flex items-center gap-3 px-5 py-3.5 transition hover:bg-slate-50/80 dark:hover:bg-white/[0.03]">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-cyan-500 text-sm font-black text-white">
                    {(u.full_name || u.abbreviation || '?').charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold">{u.full_name}</p>
                    <p className="muted text-xs">
                      <span className="font-mono">{u.abbreviation}</span>
                      <span className="mx-1.5">·</span>
                      <span className="capitalize">{u.role}</span>
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleEdit(u)}
                      title="Edit user"
                      className="rounded-lg p-2 text-slate-400 transition hover:bg-brand-50 hover:text-brand-600 dark:hover:bg-brand-500/10 dark:hover:text-brand-300"
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      onClick={() => handleDelete(u.id)}
                      title="Delete user"
                      className="rounded-lg p-2 text-slate-400 transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10 dark:hover:text-red-300"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
