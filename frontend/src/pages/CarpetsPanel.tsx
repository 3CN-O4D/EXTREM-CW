import { useCallback, useEffect, useState } from 'react';
import { ImageIcon, Loader2, Phone, Plus, Trash2, X } from 'lucide-react';
import { addDays, format, startOfWeek } from 'date-fns';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { compressVariants } from '../utils/image';
import { InlineError, PageError, PageLoading } from '../components/States';

const STATUS_FLOW = ['received', 'washed', 'dried', 'ready', 'released'] as const;
type Status = (typeof STATUS_FLOW)[number];

const STATUS_META: Record<Status, { label: string; cls: string }> = {
  received: { label: 'Received', cls: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300' },
  washed: { label: 'Washed', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300' },
  dried: { label: 'Dried', cls: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-300' },
  ready: { label: 'Ready', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300' },
  released: { label: 'Released', cls: 'bg-slate-200 text-slate-600 dark:bg-white/10 dark:text-slate-300' },
};

const toNum = (v: any) => { const n = parseInt(v); return isNaN(n) ? 0 : Math.max(0, n); };

const EMPTY_RECEIVE = {
  image: '', thumb: '', characteristics: '', client_name: '', customer_phone: '',
  receiver_id: '', expected_price: 300,
};

export default function CarpetsPanel() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const isManager = user?.role === 'manager';
  const isEmployee = user?.role === 'employee';
  const canManage = isAdmin || isManager;

  const [carpets, setCarpets] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [filter, setFilter] = useState<'all' | Status>('all');
  const [employeeFilter, setEmployeeFilter] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [weekOffset, setWeekOffset] = useState(0);
  const [boardTab, setBoardTab] = useState<'board' | 'released'>('board');
  const [selectedDayIdx, setSelectedDayIdx] = useState(() => {
    const today = new Date();
    const start = startOfWeek(today, { weekStartsOn: 1 });
    const idx = Math.floor((today.getTime() - start.getTime()) / 86400000);
    return idx >= 0 && idx < 5 ? idx : 0;
  });
  const [viewCarpet, setViewCarpet] = useState<any>(null);
  const [viewImage, setViewImage] = useState<string | null>(null);
  const [viewLoading, setViewLoading] = useState(false);

  // receive carpet
  const [showReceive, setShowReceive] = useState(false);
  const [receive, setReceive] = useState({ ...EMPTY_RECEIVE });
  const [receiveBusy, setReceiveBusy] = useState(false);
  const [receiveCompressing, setReceiveCompressing] = useState(false);
  const [receiveError, setReceiveError] = useState('');

  // change status (washed / ready) with optional photo
  const [statusModal, setStatusModal] = useState<{ carpet: any; status: 'washed' | 'dried' | 'ready'; image: string; thumb: string } | null>(null);
  const [statusBusy, setStatusBusy] = useState(false);
  const [statusCompressing, setStatusCompressing] = useState(false);

  // release
  const [releaseModal, setReleaseModal] = useState<{ carpet: any; cash: string; mpesa: string; washer: string } | null>(null);
  const [releaseBusy, setReleaseBusy] = useState(false);

  // edit carpet fields
  const [editModal, setEditModal] = useState<{ carpet: any; receiver_id: string; characteristics: string; client_name: string; customer_phone: string; expected_price: string; status: string; image: string; thumb: string } | null>(null);
  const [editBusy, setEditBusy] = useState(false);
  const [editCompressing, setEditCompressing] = useState(false);

  const empName = (id: any) => employees.find((e) => e.id === id)?.name;

  const fetchCarpets = useCallback(async () => {
    try {
      const carpetsRes = await api.get('/carpets/');
      // Employees see only their own carpets (read-only)
      const allCarpets = carpetsRes.data;
      const myCarpets = isEmployee
        ? allCarpets.filter((c: any) => c.receiver_id === user?.id || c.submitter_id === user?.id)
        : allCarpets;
      setCarpets(myCarpets);
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Could not load carpets.');
    }
    setLoading(false);
  }, [user?.id, isEmployee]);

  useEffect(() => {
    void fetchCarpets();
    api.get('/stats/employees', { params: { basic: 1 } })
      .then((r) => setEmployees(r.data))
      .catch(() => {
        setEmployees([]);
      });
  }, [fetchCarpets]);

  const openPhoto = async (c: any) => {
    // Open the detail modal immediately (list data is already available) and
    // load the full-resolution photo in the background.
    setViewCarpet(c);
    setViewImage(null);
    setViewLoading(true);
    try {
      const res = await api.get(`/carpets/${c.id}`);
      setViewImage(res.data.image_data || res.data.image_washed || res.data.image_ready || c.image_thumb || null);
    } catch {
      setViewImage(c.image_thumb || c.image_washed_thumb || c.image_ready_thumb || null);
    } finally {
      setViewLoading(false);
    }
  };

  const submitReceive = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!receive.image) { alert('A photo of the carpet is required on arrival'); return; }
    setReceiveBusy(true);
    setReceiveError('');
    try {
      await api.post('/carpets/', {
        image_data: receive.image,
        image_thumb: receive.thumb || receive.image,
        characteristics: receive.characteristics || null,
        client_name: receive.client_name || null,
        customer_phone: receive.customer_phone || null,
        receiver_id: receive.receiver_id || null,
        expected_price: toNum(receive.expected_price),
      });
      setShowReceive(false);
      setReceive({ ...EMPTY_RECEIVE });
      setReceiveError('');
      await fetchCarpets();
    } catch (err: any) {
      setReceiveError(err?.response?.data?.detail || 'Could not save the carpet — your photo is kept, tap Save carpet again to retry.');
    } finally {
      setReceiveBusy(false);
    }
  };

  const submitStatus = async () => {
    if (!statusModal) return;
    setStatusBusy(true);
    try {
      const { carpet, status, image, thumb } = statusModal;
      const payload: any = { status };
      if (image) {
        if (status === 'washed') {
          payload.image_washed = image;
          payload.image_washed_thumb = thumb || image;
        } else if (status === 'ready') {
          payload.image_ready = image;
          payload.image_ready_thumb = thumb || image;
        }
      }
      await api.patch(`/carpets/${carpet.id}`, payload);
      setStatusModal(null);
      await fetchCarpets();
    } catch (err: any) {
      alert(err?.response?.data?.detail || 'Could not update the status — your photo is kept, tap Confirm again to retry.');
    } finally {
      setStatusBusy(false);
    }
  };

  const submitRelease = async () => {
    if (!releaseModal) return;
    setReleaseBusy(true);
    try {
      const { carpet, cash, mpesa, washer } = releaseModal;
      await api.post(`/carpets/${carpet.id}/release`, {
        cash_paid: toNum(cash),
        mpesa_paid: toNum(mpesa),
        washer_id: washer || null,
      });
      setReleaseModal(null);
      await fetchCarpets();
    } catch (err: any) {
      alert(err?.response?.data?.detail || 'Could not release the carpet');
    } finally {
      setReleaseBusy(false);
    }
  };

  const submitEdit = async () => {
    if (!editModal) return;
    setEditBusy(true);
    try {
      const { carpet, receiver_id, characteristics, client_name, customer_phone, expected_price, status, image, thumb } = editModal;
      // Releasing needs the payment flow, so hand off to the release modal.
      if (status === 'released' && carpet.status !== 'released') {
        setEditModal(null);
        setReleaseModal({
          carpet,
          cash: String(carpet.expected_price || ''),
          mpesa: '',
          washer: carpet.receiver_id ? String(carpet.receiver_id) : '',
        });
        return;
      }
      const payload: any = {
        receiver_id: receiver_id || null,
        characteristics: characteristics || null,
        client_name: client_name || null,
        customer_phone: customer_phone || null,
        expected_price: toNum(expected_price),
        status,
      };
      if (image) {
        payload.image_data = image;
        payload.image_thumb = thumb || image;
      }
      await api.patch(`/carpets/${carpet.id}`, payload);
      setEditModal(null);
      await fetchCarpets();
    } catch (err: any) {
      alert(err?.response?.data?.detail || 'Could not update the carpet');
    } finally {
      setEditBusy(false);
    }
  };

  const deleteCarpet = async (c: any) => {
    if (!confirm('Delete this carpet record?')) return;
    try {
      await api.delete(`/carpets/${c.id}`);
      await fetchCarpets();
    } catch {
      alert('Could not delete the carpet');
    }
  };

  const filtered = carpets.filter((c) => {
    if (filter !== 'all' && c.status !== filter) return false;
    if (employeeFilter !== null && c.receiver_id !== employeeFilter) return false;
    return true;
  });
  const readyCarpets = carpets.filter((c) => c.status === 'ready');
  const countFor = (s: 'all' | Status) => (s === 'all' ? carpets.length : carpets.filter((c) => c.status === s).length);
  const countForEmployee = (empId: number) => carpets.filter((c) => c.receiver_id === empId).length;

  // ---- Day / week carpet stats (computed from the list already loaded) ----
  const weekStart = startOfWeek(addDays(new Date(), weekOffset * 7), { weekStartsOn: 1 });
  const weekEnd = addDays(weekStart, 7);
  const weekDays = Array.from({ length: 5 }, (_, i) => addDays(weekStart, i));
  const keyOf = (d: Date) => format(d, 'yyyy-MM-dd');
  const inWeek = (ts: string | null | undefined) => {
    if (!ts) return false;
    const d = new Date(ts);
    return d >= weekStart && d < weekEnd;
  };
  const tappedOn = (ts: string | null | undefined, key: string) => !!ts && keyOf(new Date(ts)) === key;

  // Carpets handed over during the selected week, newest first.
  const releasedThisWeek = carpets
    .filter((c) => c.status === 'released' && inWeek(c.released_at))
    .sort((a, b) => new Date(b.released_at).getTime() - new Date(a.released_at).getTime());
  const releasedTotals = releasedThisWeek.reduce(
    (acc, c) => {
      acc.cash += Number(c.cash_paid || 0);
      acc.mpesa += Number(c.mpesa_paid || 0);
      acc.paid += Number(c.cash_paid || 0) + Number(c.mpesa_paid || 0);
      return acc;
    },
    { cash: 0, mpesa: 0, paid: 0 },
  );

  // Managers/admins get the full staff list; an employee only sees their own row.
  const statEmployees = (employees.length > 0
    ? employees
    : user
      ? [{ id: user.id, name: user.full_name, abbreviation: user.abbreviation }]
      : []
  ).map((e: any) => ({ id: e.id, name: e.name || e.full_name, abbreviation: e.abbreviation }));

  const dayStats = weekDays.map((d) => {
    const key = keyOf(d);
    return {
      date: d,
      key,
      received: carpets.filter((c) => tappedOn(c.created_at, key)).length,
      washed: carpets.filter((c) => tappedOn(c.washed_at, key)).length,
      dried: carpets.filter((c) => tappedOn(c.dried_at, key)).length,
      ready: carpets.filter((c) => tappedOn(c.ready_at, key)).length,
      released: carpets.filter((c) => tappedOn(c.released_at, key)).length,
    };
  });

  const selectedDay = dayStats[Math.min(selectedDayIdx, dayStats.length - 1)] ?? dayStats[0];

  const dayRows = statEmployees.map((e: any) => {
    const mine = carpets.filter((c) => c.receiver_id === e.id);
    return {
      ...e,
      received: mine.filter((c) => tappedOn(c.created_at, selectedDay.key)).length,
      washed: mine.filter((c) => tappedOn(c.washed_at, selectedDay.key)).length,
      dried: mine.filter((c) => tappedOn(c.dried_at, selectedDay.key)).length,
      ready: mine.filter((c) => tappedOn(c.ready_at, selectedDay.key)).length,
      released: mine.filter((c) => tappedOn(c.released_at, selectedDay.key)).length,
    };
  });

  const weekRows = statEmployees.map((e: any) => {
    const mine = carpets.filter((c) => c.receiver_id === e.id);
    return {
      ...e,
      received: mine.filter((c) => inWeek(c.created_at)).length,
      washed: mine.filter((c) => inWeek(c.washed_at)).length,
      dried: mine.filter((c) => inWeek(c.dried_at)).length,
      ready: mine.filter((c) => inWeek(c.ready_at)).length,
      released: mine.filter((c) => inWeek(c.released_at)).length,
      holding: mine.filter((c) => c.status !== 'released').length,
      total: mine.length,
    };
  });

  const weekTotals = weekRows.reduce(
    (acc: any, e: any) => {
      acc.received += e.received;
      acc.washed += e.washed;
      acc.dried += e.dried;
      acc.ready += e.ready;
      acc.released += e.released;
      acc.holding += e.holding;
      acc.total += e.total;
      return acc;
    },
    { received: 0, washed: 0, dried: 0, ready: 0, released: 0, holding: 0, total: 0 },
  );

  if (loading) return <PageLoading label="Loading carpets..." />;
  if (error && carpets.length === 0) return <PageError message={error} onRetry={fetchCarpets} />;

  return (
    <div className="space-y-5">
      {error && <InlineError message={error} />}

      {/* At-a-glance KPIs */}
      <div className="stat-grid xl:grid-cols-4">
        {[
          { label: 'In the shop', value: carpets.filter((c) => c.status !== 'released').length, cls: 'text-brand-600 dark:text-brand-300' },
          { label: 'Ready', value: readyCarpets.length, cls: 'text-emerald-600 dark:text-emerald-400' },
          { label: 'Released', value: countFor('released'), cls: 'text-violet-600 dark:text-violet-300' },
          { label: 'All records', value: carpets.length, cls: 'text-slate-900 dark:text-white' },
        ].map((s) => (
          <div key={s.label} className="stat-tile">
            <p className="stat-label">{s.label}</p>
            <p className={`stat-value ${s.cls}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Carpet stats: Mon–Fri daily buttons + weekly breakdown */}
      <div className="card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/80 bg-slate-50 px-5 py-3 dark:border-white/10 dark:bg-white/5">
          <div>
            <h3 className="text-sm font-black tracking-tight text-slate-900 dark:text-white">Carpet Stats</h3>
            <p className="muted text-xs text-slate-500 dark:text-slate-400">Pick a weekday for that day's counts, then see the weekly totals.</p>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setWeekOffset((o) => o - 1)}
              className="rounded-lg border border-slate-200 px-2 py-1 text-sm font-bold text-slate-500 hover:bg-white dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10"
              aria-label="Previous week"
            >
              ‹
            </button>
            <span className="rounded-lg bg-white px-2.5 py-1 text-xs font-bold text-slate-600 dark:bg-white/5 dark:text-slate-300">
              {format(weekStart, 'dd MMM')} – {format(addDays(weekStart, 6), 'dd MMM yyyy')}
            </span>
            <button
              onClick={() => setWeekOffset((o) => o + 1)}
              className="rounded-lg border border-slate-200 px-2 py-1 text-sm font-bold text-slate-500 hover:bg-white dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10"
              aria-label="Next week"
            >
              ›
            </button>
          </div>
        </div>

        {/* Day buttons */}
        <div className="flex gap-2 overflow-x-auto px-4 py-3">
          {dayStats.map((d, i) => {
            const active = i === selectedDayIdx;
            return (
              <button
                key={d.key}
                onClick={() => setSelectedDayIdx(i)}
                className={`min-w-[92px] rounded-xl border px-3 py-2 text-left transition ${
                  active
                    ? 'border-brand-500 bg-brand-50 text-brand-700 dark:border-brand-500 dark:bg-brand-500/15 dark:text-brand-200'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-brand-300 dark:border-white/10 dark:bg-white/5 dark:text-slate-300'
                }`}
              >
                <span className="block text-[10px] font-bold uppercase tracking-wider opacity-70">{format(d.date, 'EEE')}</span>
                <span className="block text-sm font-black">{format(d.date, 'dd/MM')}</span>
                <span className="block text-[10px] opacity-70">{d.received} in · {d.released} out</span>
              </button>
            );
          })}
        </div>

        {/* Selected day summary */}
        <div className="grid grid-cols-2 gap-3 px-4 pb-4 sm:grid-cols-5">
          {[
            { label: 'Received', value: selectedDay.received, cls: 'text-blue-600 dark:text-blue-400' },
            { label: 'Washed', value: selectedDay.washed, cls: 'text-amber-600 dark:text-amber-400' },
            { label: 'Dried', value: selectedDay.dried, cls: 'text-cyan-600 dark:text-cyan-400' },
            { label: 'Ready', value: selectedDay.ready, cls: 'text-emerald-600 dark:text-emerald-400' },
            { label: 'Released', value: selectedDay.released, cls: 'text-violet-600 dark:text-violet-300' },
          ].map((s) => (
            <div key={s.label} className="rounded-xl border border-slate-200 px-3 py-2 dark:border-white/10">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{s.label}</p>
              <p className={`mt-0.5 text-lg font-black ${s.cls}`}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Per-employee for selected day */}
        <div className="overflow-x-auto border-t border-slate-200/70 dark:border-white/10">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="bg-white dark:bg-slate-900/50">
                <th className="py-2 pr-3 pl-4 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">{format(selectedDay.date, 'EEE dd MMM')} — employee</th>
                <th className="py-2 pr-3 text-right text-[11px] font-bold uppercase tracking-wider text-slate-500">Received</th>
                <th className="py-2 pr-3 text-right text-[11px] font-bold uppercase tracking-wider text-slate-500">Washed</th>
                <th className="py-2 pr-3 text-right text-[11px] font-bold uppercase tracking-wider text-slate-500">Dried</th>
                <th className="py-2 pr-3 text-right text-[11px] font-bold uppercase tracking-wider text-slate-500">Ready</th>
                <th className="py-2 pr-4 text-right text-[11px] font-bold uppercase tracking-wider text-slate-500">Released</th>
              </tr>
            </thead>
            <tbody>
              {dayRows.map((e: any) => (
                <tr key={e.id} className="border-t border-slate-200/70 dark:border-white/10">
                  <td className="py-2 pr-3 pl-4 text-xs font-semibold text-slate-700 dark:text-slate-300">
                    {e.name} {e.abbreviation ? `(${e.abbreviation})` : ''}
                  </td>
                  <td className="py-2 pr-3 text-right text-xs text-blue-600 dark:text-blue-400">{e.received}</td>
                  <td className="py-2 pr-3 text-right text-xs text-amber-600 dark:text-amber-400">{e.washed}</td>
                  <td className="py-2 pr-3 text-right text-xs text-cyan-600 dark:text-cyan-400">{e.dried}</td>
                  <td className="py-2 pr-3 text-right text-xs text-emerald-600 dark:text-emerald-400">{e.ready}</td>
                  <td className="py-2 pr-4 text-right text-xs text-violet-600 dark:text-violet-300">{e.released}</td>
                </tr>
              ))}
              {dayRows.length === 0 && (
                <tr><td colSpan={6} className="py-4 text-center text-xs text-slate-400">No staff records.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Weekly carpet stats */}
      <div className="card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/80 bg-slate-50 px-5 py-3 dark:border-white/10 dark:bg-white/5">
          <div>
            <h3 className="text-sm font-black tracking-tight text-slate-900 dark:text-white">Weekly Stats</h3>
            <p className="muted text-xs text-slate-500 dark:text-slate-400">Who received / released how many, and who is holding how many now.</p>
          </div>
          <span className="rounded-lg bg-white px-2.5 py-1 text-xs font-bold text-slate-600 dark:bg-white/5 dark:text-slate-300">
            {format(weekStart, 'dd MMM')} – {format(addDays(weekStart, 6), 'dd MMM yyyy')}
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="bg-white dark:bg-slate-900/50">
                <th className="py-3 pr-3 pl-4 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">Employee</th>
                <th className="py-3 pr-3 text-right text-[11px] font-bold uppercase tracking-wider text-slate-500">Received</th>
                <th className="py-3 pr-3 text-right text-[11px] font-bold uppercase tracking-wider text-slate-500">Washed</th>
                <th className="py-3 pr-3 text-right text-[11px] font-bold uppercase tracking-wider text-slate-500">Dried</th>
                <th className="py-3 pr-3 text-right text-[11px] font-bold uppercase tracking-wider text-slate-500">Ready</th>
                <th className="py-3 pr-3 text-right text-[11px] font-bold uppercase tracking-wider text-slate-500">Released</th>
                <th className="py-3 pr-3 text-right text-[11px] font-bold uppercase tracking-wider text-slate-500">Holding now</th>
                <th className="py-3 pr-4 text-right text-[11px] font-bold uppercase tracking-wider text-slate-500">All time</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-slate-200/70 bg-brand-50 font-bold dark:bg-brand-500/10">
                <td className="py-3 pr-3 pl-4 text-xs text-slate-700 dark:text-slate-300">All staff</td>
                <td className="py-3 pr-3 text-right text-xs text-blue-600 dark:text-blue-400">{weekTotals.received}</td>
                <td className="py-3 pr-3 text-right text-xs text-amber-600 dark:text-amber-400">{weekTotals.washed}</td>
                <td className="py-3 pr-3 text-right text-xs text-cyan-600 dark:text-cyan-400">{weekTotals.dried}</td>
                <td className="py-3 pr-3 text-right text-xs text-emerald-600 dark:text-emerald-400">{weekTotals.ready}</td>
                <td className="py-3 pr-3 text-right text-xs text-violet-600 dark:text-violet-300">{weekTotals.released}</td>
                <td className="py-3 pr-3 text-right text-xs text-slate-900 dark:text-white">{weekTotals.holding}</td>
                <td className="py-3 pr-4 text-right text-xs text-slate-900 dark:text-white">{weekTotals.total}</td>
              </tr>
              {weekRows.map((e: any) => (
                <tr key={e.id} className="border-t border-slate-200/70 hover:bg-slate-50/70 dark:border-white/10 dark:hover:bg-white/[0.03]">
                  <td className="py-3 pr-3 pl-4 text-xs font-medium text-slate-700 dark:text-slate-300">
                    {e.name} {e.abbreviation ? `(${e.abbreviation})` : ''}
                  </td>
                  <td className="py-3 pr-3 text-right text-xs text-blue-600 dark:text-blue-400">{e.received}</td>
                  <td className="py-3 pr-3 text-right text-xs text-amber-600 dark:text-amber-400">{e.washed}</td>
                  <td className="py-3 pr-3 text-right text-xs text-cyan-600 dark:text-cyan-400">{e.dried}</td>
                  <td className="py-3 pr-3 text-right text-xs text-emerald-600 dark:text-emerald-400">{e.ready}</td>
                  <td className="py-3 pr-3 text-right text-xs text-violet-600 dark:text-violet-300">{e.released}</td>
                  <td className="py-3 pr-3 text-right text-xs font-bold text-slate-900 dark:text-white">{e.holding}</td>
                  <td className="py-3 pr-4 text-right text-xs text-slate-500 dark:text-slate-400">{e.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Ready for pickup — plain table, no inline photos */}
      {readyCarpets.length > 0 && (
        <div className="card overflow-hidden border-l-4 border-emerald-500">
          <div className="border-b border-slate-200/80 px-5 py-3 dark:border-white/10">
            <h2 className="section-title text-emerald-600 dark:text-emerald-400">Ready for pickup ({readyCarpets.length})</h2>
            <p className="muted text-xs">Dry and ready — call the owners to come collect.</p>
          </div>
          <div className="table-wrap">
            <table className="table-clean">
              <thead>
                <tr>
                  <th>Carpet</th>
                  <th>Client</th>
                  <th>Phone</th>
                  <th>Receiver</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {readyCarpets.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <p className="font-bold">{c.characteristics || 'Carpet'}</p>
                      <p className="text-[11px] font-mono text-slate-400">#{c.id}</p>
                    </td>
                    <td>{c.client_name || 'Client'}</td>
                    <td>
                      {c.customer_phone ? (
                        <a href={`tel:${c.customer_phone}`} className="font-semibold text-brand-600 hover:underline dark:text-brand-300">{c.customer_phone}</a>
                      ) : <span className="text-slate-400">—</span>}
                    </td>
                    <td className="text-xs">{empName(c.receiver_id) || 'Unassigned'}</td>
                    <td>
                      <div className="flex flex-wrap justify-end gap-1.5">
                        {c.customer_phone && (
                          <a href={`tel:${c.customer_phone}`} className="btn btn-sm bg-emerald-600 text-white hover:bg-emerald-700">
                            <Phone size={12} /> Call
                          </a>
                        )}
                        <button onClick={() => openPhoto(c)} className="btn-secondary btn-sm">View</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Released this week tab */}
      <div className="flex items-center gap-2 mb-2">
        <button
          onClick={() => setBoardTab('board')}
          className={`flex h-10 items-center justify-center rounded-xl border px-3 text-xs font-bold transition ${boardTab === 'board' ? 'border-brand-500 bg-brand-50 text-brand-700 dark:border-brand-500 dark:bg-brand-500/15 dark:text-brand-200' : 'border-slate-200 bg-white text-slate-600 hover:border-brand-300 dark:border-white/10 dark:bg-white/5 dark:text-slate-300'}`}
        >
          Board
        </button>
        <button
          onClick={() => setBoardTab('released')}
          className={`flex h-10 items-center justify-center rounded-xl border px-3 text-xs font-bold transition ${boardTab === 'released' ? 'border-violet-500 bg-violet-50 text-violet-700 dark:border-violet-500 dark:bg-violet-500/15 dark:text-violet-200' : 'border-slate-200 bg-white text-slate-600 hover:border-violet-300 dark:border-white/10 dark:bg-white/5 dark:text-slate-300'}`}
        >
          Released this week ({releasedThisWeek.length}) · Ksh {releasedTotals.paid} paid
        </button>
      </div>

      {boardTab === 'released' && (
        <div className="card overflow-hidden border-l-4 border-violet-500">
          <div className="border-b border-slate-200/80 px-5 py-3 dark:border-white/10">
            <h2 className="section-title text-violet-600 dark:text-violet-400">Released carpets — week of {format(weekStart, 'dd MMM yyyy')}</h2>
            <p className="muted text-xs">Carps handed over to clients, when they left, who washed them, and what was paid.</p>
          </div>
          <div className="table-wrap">
            <table className="table-clean">
              <thead>
                <tr>
                  <th>Carpet</th>
                  <th>Client</th>
                  <th>Released</th>
                  <th>Washer</th>
                  <th className="text-right">Cash</th>
                  <th className="text-right">M-Pesa</th>
                  <th className="text-right">Paid</th>
                </tr>
              </thead>
              <tbody>
                {releasedThisWeek.length === 0 ? (
                  <tr><td colSpan={7} className="py-6 text-center text-xs text-slate-400">No carpets released this week.</td></tr>
                ) : (
                  releasedThisWeek.map((c) => (
                    <tr key={c.id}>
                      <td>
                        <p className="font-bold">{c.characteristics || 'Carpet'}</p>
                        <p className="text-[11px] font-mono text-slate-400">#{c.id}</p>
                      </td>
                      <td>{c.client_name || 'Client'}</td>
                      <td className="whitespace-nowrap text-xs">{c.released_at ? format(new Date(c.released_at), 'dd MMM HH:mm') : '—'}</td>
                      <td className="text-xs">{c.washer_id ? (empName(c.washer_id) || `Staff #${c.washer_id}`) : '—'}</td>
                      <td className="text-right font-mono">Ksh {Number(c.cash_paid || 0)}</td>
                      <td className="text-right font-mono">Ksh {Number(c.mpesa_paid || 0)}</td>
                      <td className="text-right font-mono text-bold">Ksh {Number(c.cash_paid || 0) + Number(c.mpesa_paid || 0)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {(['all', ...STATUS_FLOW] as const).map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`chip capitalize ${filter === s ? 'chip-active' : ''}`}
            >
              {s === 'all' ? 'All' : STATUS_META[s].label}
              <span className={`ml-1.5 rounded-full px-1.5 text-[10px] ${filter === s ? 'bg-white/25' : 'bg-slate-200 text-slate-500 dark:bg-white/10 dark:text-slate-400'}`}>
                {countFor(s)}
              </span>
            </button>
          ))}
          {employees.map((e) => (
            <button
              key={e.id}
              onClick={() => setEmployeeFilter(employeeFilter === e.id ? null : e.id)}
              className={`chip capitalize ${employeeFilter === e.id ? 'chip-active' : ''}`}
            >
              {e.abbreviation || e.name.charAt(0).toUpperCase()}
              <span className={`ml-1.5 rounded-full px-1.5 text-[10px] ${employeeFilter === e.id ? 'bg-white/25' : 'bg-slate-200 text-slate-500 dark:bg-white/10 dark:text-slate-400'}`}>
                {countForEmployee(e.id)}
              </span>
            </button>
          ))}
        </div>
        <button onClick={() => setShowReceive(true)} className={`btn-primary inline-flex items-center gap-2 ${!canManage ? 'hidden' : ''}`}>
          <Plus size={16} /> Receive carpet
        </button>
      </div>

      {/* Carpet list — plain table; photos open in the viewer */}
      <div className="card overflow-hidden">
        {filtered.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-slate-400">
            No carpets{filter !== 'all' ? ` ${STATUS_META[filter].label.toLowerCase()}` : ''} right now.
          </p>
        ) : (
          <div className="table-wrap">
            <table className="table-clean">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Carpet</th>
                  <th>Client</th>
                  <th>Receiver</th>
                  <th>Status</th>
                  <th className="text-right">Expected</th>
                  <th className="text-right">Paid</th>
                  <th>Received</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <tr key={c.id}>
                    <td className="font-mono text-xs text-slate-400">#{c.id}</td>
                    <td>
                      <p className="font-bold">{c.characteristics || 'Carpet'}</p>
                      <p className="text-[11px] text-slate-400">{c.is_washed ? 'Washed' : 'Not washed'}</p>
                    </td>
                    <td>
                      <p className="font-medium">{c.client_name || '—'}</p>
                      {c.customer_phone && (
                        <a href={`tel:${c.customer_phone}`} className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand-600 hover:underline dark:text-brand-300">
                          <Phone size={10} /> {c.customer_phone}
                        </a>
                      )}
                    </td>
                    <td className="text-xs">{empName(c.receiver_id) || 'Unassigned'}</td>
                    <td>
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${STATUS_META[c.status as Status]?.cls || ''}`}>
                        {STATUS_META[c.status as Status]?.label || c.status}
                      </span>
                    </td>
                    <td className="text-right font-mono">Ksh {Number(c.expected_price || 0)}</td>
                    <td className="text-right font-mono">Ksh {Number(c.cash_paid || 0) + Number(c.mpesa_paid || 0)}</td>
                    <td className="whitespace-nowrap text-xs">{format(new Date(c.created_at), 'dd MMM HH:mm')}</td>
                    <td>
                      <div className="flex flex-wrap justify-end gap-1.5">
                        {canManage && (
                          <>
                            {c.status === 'received' && (
                              <button onClick={() => setStatusModal({ carpet: c, status: 'washed', image: '', thumb: '' })}
                                className="btn btn-sm bg-amber-600 text-white hover:bg-amber-700">Wash</button>
                            )}
                            {c.status === 'washed' && (
                              <button onClick={() => setStatusModal({ carpet: c, status: 'dried', image: '', thumb: '' })}
                                className="btn btn-sm bg-cyan-600 text-white hover:bg-cyan-700">Dry</button>
                            )}
                            {c.status === 'dried' && (
                              <button onClick={() => setStatusModal({ carpet: c, status: 'ready', image: '', thumb: '' })}
                                className="btn btn-sm bg-emerald-600 text-white hover:bg-emerald-700">Ready</button>
                            )}
                            {c.status !== 'released' && (
                              <button onClick={() => setReleaseModal({ carpet: c, cash: String(c.expected_price || ''), mpesa: '', washer: '' })}
                                className="btn btn-sm bg-blue-600 text-white hover:bg-blue-700">Release</button>
                            )}
                          </>
                        )}
                        <button onClick={() => openPhoto(c)} className="btn-secondary btn-sm">View</button>
                        {canManage && (
                          <>
                            <button onClick={() => setEditModal({
                              carpet: c,
                              receiver_id: String(c.receiver_id || ''),
                              characteristics: c.characteristics || '',
                              client_name: c.client_name || '',
                              customer_phone: c.customer_phone || '',
                              expected_price: String(c.expected_price || ''),
                              status: c.status || 'received',
                              image: c.image_data || '',
                              thumb: c.image_thumb || '',
                            })} className="btn-ghost btn-sm">Edit</button>
                            <button onClick={() => deleteCarpet(c)} aria-label="Delete carpet"
                              className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10 dark:hover:text-red-300">
                              <Trash2 size={14} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Receive carpet modal */}
      {showReceive && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <form onSubmit={submitReceive} className="card-pad w-full max-w-md space-y-4 rounded-3xl bg-white dark:bg-slate-900">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-black tracking-tight">Receive a carpet</h3>
              <button type="button" onClick={() => setShowReceive(false)} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5"><X size={18} /></button>
            </div>
            <label className="block">
              <span className="mb-1 block text-sm font-semibold">Carpet photo (required)</span>
              <p className="mb-1 text-xs text-slate-500 dark:text-slate-400">Take a photo now or choose one from your gallery / files.</p>
              <input
                type="file" accept="image/*"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setReceiveCompressing(true);
                  setReceiveError('');
                  try {
                    const { data, thumb } = await compressVariants(file);
                    setReceive((r) => ({ ...r, image: data, thumb }));
                  } catch {
                    setReceiveError('Could not process the image. Try a smaller file.');
                  } finally {
                    setReceiveCompressing(false);
                  }
                }}
                className="input-base file:mr-2 file:rounded-lg file:border-0 file:bg-violet-600 file:px-3 file:py-1.5 file:text-sm file:font-bold file:text-white"
              />
              {receiveCompressing && <span className="mt-1 text-xs text-brand-600 dark:text-brand-300">Compressing image…</span>}
              {receive.image && <img src={receive.image} alt="" className="mt-2 h-24 w-24 rounded-xl object-cover ring-1 ring-violet-300" />}
            </label>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-sm font-semibold">Description</span>
                <input className="input-base" placeholder="e.g. purple rug, 6x8" value={receive.characteristics}
                  onChange={(e) => setReceive({ ...receive, characteristics: e.target.value })} />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-semibold">Expected price (Ksh)</span>
                <input type="number" min="0" className="input-base" value={receive.expected_price}
                  onChange={(e) => setReceive({ ...receive, expected_price: toNum(e.target.value) })} />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-semibold">Client name</span>
                <input className="input-base" placeholder="e.g. Mary J." value={receive.client_name}
                  onChange={(e) => setReceive({ ...receive, client_name: e.target.value })} />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-semibold">Client phone</span>
                <input className="input-base" placeholder="07xx xxx xxx" value={receive.customer_phone}
                  onChange={(e) => setReceive({ ...receive, customer_phone: e.target.value })} />
              </label>
              <label className="block sm:col-span-2">
                <span className="mb-1 block text-sm font-semibold">Receiver (washer)</span>
                <select className="input-base" value={receive.receiver_id}
                  onChange={(e) => setReceive({ ...receive, receiver_id: e.target.value })}>
                  <option value="">Not assigned yet</option>
                  {employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
              </label>
            </div>
            {receiveError && (
              <div className="col-span-2">
                <span className="text-xs text-red-600 dark:text-red-400">{receiveError}</span>
              </div>
            )}
            <div className="flex gap-2">
              <button type="submit" disabled={receiveBusy} className="btn-primary flex-1 justify-center">
                {receiveBusy && <Loader2 size={15} className="animate-spin" />} Save carpet
              </button>
              <button type="button" onClick={() => setShowReceive(false)} className="btn-secondary"><X size={15} /> Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* Change status modal */}
      {statusModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="card-pad w-full max-w-md space-y-4 rounded-3xl bg-white dark:bg-slate-900">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-black tracking-tight">
                Mark as {STATUS_META[statusModal.status].label}
              </h3>
              <button onClick={() => setStatusModal(null)} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5"><X size={18} /></button>
            </div>
            <div className="rounded-xl bg-slate-50 p-3 text-sm dark:bg-white/5">
              <p className="font-semibold">{statusModal.carpet.characteristics || 'Carpet'} #{statusModal.carpet.id}</p>
              <p className="text-xs text-slate-500">{statusModal.carpet.client_name || 'No client name'} · {statusModal.carpet.customer_phone || 'no phone'}</p>
              <p className="mt-1 text-xs">Current: <b>{STATUS_META[statusModal.carpet.status as Status]?.label}</b></p>
            </div>
            {statusModal.status === 'dried' ? (
              <div className="rounded-xl border border-cyan-200 bg-cyan-50 p-3 text-xs text-cyan-800 dark:border-cyan-500/30 dark:bg-cyan-500/10 dark:text-cyan-200">
                Hang the carpet out in the sun to air-dry completely. Mark it <b>Ready</b> only after it is fully dry.
              </div>
            ) : (
              <label className="block">
                <span className="mb-1 block text-sm font-semibold">Photo for "{STATUS_META[statusModal.status].label}" (optional)</span>
                <p className="mb-1 text-xs text-slate-500 dark:text-slate-400">Take a new photo or choose one from your gallery / files.</p>
                <input
                  type="file" accept="image/*"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setStatusCompressing(true);
                    try {
                      const { data, thumb } = await compressVariants(file);
                      setStatusModal((m) => (m ? { ...m, image: data, thumb } : m));
                    } catch {
                      alert('Could not process the image. Try a smaller file.');
                    } finally {
                      setStatusCompressing(false);
                    }
                  }}
                  className="input-base file:mr-2 file:rounded-lg file:border-0 file:bg-violet-600 file:px-3 file:py-1.5 file:text-sm file:font-bold file:text-white"
                />
                {statusCompressing && <span className="mt-1 text-xs text-brand-600 dark:text-brand-300">Compressing image…</span>}
                {statusModal.image && <img src={statusModal.image} alt="" className="mt-2 h-24 w-24 rounded-xl object-cover ring-1 ring-violet-300" />}
              </label>
            )}
            <div className="flex gap-2">
              <button onClick={submitStatus} disabled={statusBusy} className="btn-primary flex-1 justify-center">
                {statusBusy && <Loader2 size={15} className="animate-spin" />}
                Confirm {STATUS_META[statusModal.status].label}
              </button>
              <button onClick={() => setStatusModal(null)} className="btn-secondary"><X size={15} /> Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Release modal */}
      {releaseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="card-pad w-full max-w-md space-y-4 rounded-3xl bg-white dark:bg-slate-900">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-black tracking-tight">Release carpet</h3>
              <button onClick={() => setReleaseModal(null)} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5"><X size={18} /></button>
            </div>
            <div className="rounded-xl bg-slate-50 p-3 text-sm dark:bg-white/5">
              <p className="font-semibold">{releaseModal.carpet.characteristics || 'Carpet'} #{releaseModal.carpet.id}</p>
              <p className="text-xs text-slate-500">Expected Ksh {releaseModal.carpet.expected_price}</p>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-sm font-semibold">Cash received (Ksh)</span>
                <input type="number" min="0" className="input-base" value={releaseModal.cash}
                  onChange={(e) => setReleaseModal({ ...releaseModal, cash: e.target.value })} />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-semibold">M-Pesa received (Ksh)</span>
                <input type="number" min="0" className="input-base" value={releaseModal.mpesa}
                  onChange={(e) => setReleaseModal({ ...releaseModal, mpesa: e.target.value })} />
              </label>
              <label className="block sm:col-span-2">
                <span className="mb-1 block text-sm font-semibold">Washer</span>
                <select className="input-base" value={releaseModal.washer}
                  onChange={(e) => setReleaseModal({ ...releaseModal, washer: e.target.value })}>
                  <option value="">{releaseModal.carpet.receiver_id ? empName(releaseModal.carpet.receiver_id) || 'Receiver' : 'Pick a washer...'}</option>
                  {employees.length === 0 && <option value="" disabled>No staff loaded</option>}
                  {employees.map((e) => <option key={e.id} value={e.id}>{e.name || e.full_name}</option>)}
                </select>
              </label>
            </div>
            <div className="flex gap-2">
              <button onClick={submitRelease} disabled={releaseBusy} className="btn-primary flex-1 justify-center">
                {releaseBusy && <Loader2 size={15} className="animate-spin" />} Release carpet
              </button>
              <button onClick={() => setReleaseModal(null)} className="btn-secondary"><X size={15} /> Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit carpet modal */}
      {editModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="card-pad w-full max-w-md space-y-4 rounded-3xl bg-white dark:bg-slate-900">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-black tracking-tight">Edit carpet</h3>
              <button onClick={() => setEditModal(null)} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5"><X size={18} /></button>
            </div>
            <div className="rounded-xl bg-slate-50 p-3 text-sm dark:bg-white/5">
              <p className="font-semibold">{editModal.carpet.characteristics || 'Carpet'} #{editModal.carpet.id}</p>
              <p className="text-xs text-slate-500">Current status: {STATUS_META[editModal.carpet.status as Status]?.label}</p>
            </div>
            <label className="block">
              <span className="mb-1 block text-sm font-semibold">Status</span>
              <select className="input-base" value={editModal.status}
                onChange={(e) => setEditModal({ ...editModal, status: e.target.value })}>
                {STATUS_FLOW.map((s) => (
                  <option key={s} value={s}>{STATUS_META[s].label}</option>
                ))}
              </select>
              {editModal.status === 'released' && editModal.carpet.status !== 'released' && (
                <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                  Choosing Released opens the release form so you can record the payment and washer.
                </p>
              )}
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-semibold">Carpet photo</span>
              <p className="mb-1 text-xs text-slate-500 dark:text-slate-400">Take a new photo or choose one from your gallery / files.</p>
              <input
                type="file" accept="image/*"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setEditCompressing(true);
                  try {
                    const { data, thumb } = await compressVariants(file);
                    setEditModal((m) => (m ? { ...m, image: data, thumb } : m));
                  } catch {
                    alert('Could not process the image. Try a smaller file.');
                  } finally {
                    setEditCompressing(false);
                  }
                }}
                className="input-base file:mr-2 file:rounded-lg file:border-0 file:bg-violet-600 file:px-3 file:py-1.5 file:text-sm file:font-bold file:text-white"
              />
              {editCompressing && <span className="mt-1 text-xs text-brand-600 dark:text-brand-300">Compressing image…</span>}
              {(editModal.thumb || editModal.image) && (
                <img src={editModal.thumb || editModal.image} alt="" className="mt-2 h-24 w-24 rounded-xl object-cover ring-1 ring-violet-300" />
              )}
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-semibold">Owner / Receiver</span>
              <select className="input-base" value={editModal.receiver_id}
                onChange={(e) => setEditModal({ ...editModal, receiver_id: e.target.value })}>
                <option value="">Unassigned</option>
                {employees.length === 0 && <option value="" disabled>No staff loaded</option>}
                {employees.map((e) => <option key={e.id} value={e.id}>{e.name || e.full_name}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-semibold">Characteristics</span>
              <input className="input-base" value={editModal.characteristics}
                onChange={(e) => setEditModal({ ...editModal, characteristics: e.target.value })} />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-semibold">Client name</span>
              <input className="input-base" value={editModal.client_name}
                onChange={(e) => setEditModal({ ...editModal, client_name: e.target.value })} />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-semibold">Client phone</span>
              <input className="input-base" value={editModal.customer_phone}
                onChange={(e) => setEditModal({ ...editModal, customer_phone: e.target.value })} />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-semibold">Expected price (Ksh)</span>
              <input type="number" min="0" className="input-base" value={editModal.expected_price}
                onChange={(e) => setEditModal({ ...editModal, expected_price: e.target.value })} />
            </label>
            <div className="flex gap-2">
              <button onClick={submitEdit} disabled={editBusy} className="btn-primary flex-1 justify-center">
                {editBusy && <Loader2 size={15} className="animate-spin" />}
                Save changes
              </button>
              <button onClick={() => setEditModal(null)} className="btn-secondary"><X size={15} /> Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Carpet detail / photo viewer */}
      {viewCarpet && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setViewCarpet(null)}>
          <div
            className="relative max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white p-4 shadow-2xl dark:bg-slate-900 sm:p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setViewCarpet(null)}
              className="absolute right-2 top-2 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-red-600 font-bold text-white"
              aria-label="Close"
            >
              ×
            </button>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="flex min-h-[220px] items-center justify-center overflow-hidden rounded-xl bg-slate-100 dark:bg-white/5">
                {viewLoading ? (
                  <div className="flex flex-col items-center gap-2 text-sm font-semibold text-slate-500 dark:text-slate-400">
                    <Loader2 size={22} className="animate-spin text-violet-600 dark:text-violet-300" />
                    Loading photo…
                  </div>
                ) : viewImage ? (
                  <img src={viewImage} alt="carpet" className="max-h-[70vh] w-full object-contain" />
                ) : (
                  <div className="flex flex-col items-center gap-2 text-sm text-slate-400">
                    <ImageIcon size={26} />
                    No photo for this carpet
                  </div>
                )}
              </div>

              <div className="space-y-3 text-sm">
                <div>
                  <h3 className="pr-8 text-lg font-black tracking-tight">{viewCarpet.characteristics || 'Carpet'} #{viewCarpet.id}</h3>
                  <span className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[11px] font-bold ${STATUS_META[viewCarpet.status as Status]?.cls || ''}`}>
                    {STATUS_META[viewCarpet.status as Status]?.label || viewCarpet.status}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 rounded-xl border border-slate-200 p-3 dark:border-white/10">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Client</p>
                    <p className="font-semibold">{viewCarpet.client_name || '—'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Phone</p>
                    {viewCarpet.customer_phone ? (
                      <a href={`tel:${viewCarpet.customer_phone}`} className="font-semibold text-brand-600 hover:underline dark:text-brand-300">
                        {viewCarpet.customer_phone}
                      </a>
                    ) : (
                      <p className="text-slate-400">—</p>
                    )}
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Receiver</p>
                    <p className="font-semibold">{empName(viewCarpet.receiver_id) || 'Unassigned'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Expected price</p>
                    <p className="font-mono font-semibold">Ksh {viewCarpet.expected_price}</p>
                  </div>
                </div>

                <div className="space-y-1 rounded-xl border border-slate-200 p-3 dark:border-white/10">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Timeline</p>
                  {[
                    ['Received', viewCarpet.created_at],
                    ['Washed', viewCarpet.washed_at],
                    ['Dried', viewCarpet.dried_at],
                    ['Ready', viewCarpet.ready_at],
                    ['Released', viewCarpet.released_at],
                  ].map(([label, ts]) => (
                    <div key={String(label)} className="flex items-center justify-between gap-3 text-xs">
                      <span className="font-semibold text-slate-500 dark:text-slate-400">{label}</span>
                      <span className="font-mono">{ts ? format(new Date(ts as string), 'dd MMM yyyy HH:mm') : '—'}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
