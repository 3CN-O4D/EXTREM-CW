import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { Check, Image as ImageIcon, Plus, Printer, Trash2 } from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { PageError, PageLoading, InlineError } from '../components/States';
const logoImg = '/images/logo.jpeg';

const weekId = format(new Date(), 'yyyy-II');

const VEHICLE_CATEGORIES = [
  { key: 'bicycle', label: 'Bicycle', price: 50 },
  { key: 'motorcycle', label: 'Motorcycle', price: 70 },
  { key: 'taxi', label: 'Taxi', price: 150 },
  { key: 'car', label: 'Car', price: 200 },
  { key: 'midrange', label: 'Midrange', price: 300 },
  { key: 'lorry', label: 'Lorry', price: 500 },
  { key: 'other', label: 'Other', price: 0 },
];

export default function EmployeeDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [carpets, setCarpets] = useState<any[]>([]);
  const [debts, setDebts] = useState<any[]>([]);
  const [repayments, setRepayments] = useState<any[]>([]);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Arrivals: log a vehicle when it arrives, take the money later.
  const [arrivals, setArrivals] = useState<any[]>([]);
  const [plate, setPlate] = useState('');
  const [arrivalCategory, setArrivalCategory] = useState('car');
  const [arrivalPrice, setArrivalPrice] = useState('200');
  const [arrivalMsg, setArrivalMsg] = useState('');
  const [settleRow, setSettleRow] = useState<number | null>(null);
  const [settleCash, setSettleCash] = useState('');
  const [settleMpesa, setSettleMpesa] = useState('');

  const loadArrivals = async () => {
    try {
      const res = await api.get('/vehicles/');
      setArrivals(res.data);
    } catch {
      // The arrivals widget should not block the rest of the dashboard.
    }
  };

  const fetchEmpData = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/stats/me');
      setStats(res.data);

      const myId = res.data.id;
      const [txRes, carpetRes, debtRes, repRes] = await Promise.all([
        api.get('/transactions/', { params: { washer_id: myId, week_id: weekId } }),
        api.get('/carpets/'),
        api.get('/debts/'),
        api.get('/repayments/')
      ]);
      setTransactions(txRes.data);
      setCarpets(carpetRes.data);
      setDebts(debtRes.data);
      setRepayments(repRes.data);
    } catch (err: any) {
      setError(
        err?.response?.data?.detail ||
        (err?.code === 'ECONNABORTED'
          ? 'The server took too long to respond.'
          : 'Could not reach the server. Check your connection and try again.')
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchEmpData();
    void loadArrivals();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const logArrival = async (e: any) => {
    e.preventDefault();
    setArrivalMsg('');
    try {
      await api.post('/vehicles/', {
        plate_number: plate,
        category: arrivalCategory,
        expected_price: Number(arrivalPrice) || 0,
      });
      setPlate('');
      setArrivalMsg('Arrival logged.');
      await loadArrivals();
    } catch (err: any) {
      setArrivalMsg(err.response?.data?.detail || 'Could not log the arrival');
    }
  };

  const settleArrival = async (id: number) => {
    setArrivalMsg('');
    try {
      const res = await api.post(`/vehicles/${id}/settle`, {
        cash_paid: Number(settleCash) || 0,
        mpesa_paid: Number(settleMpesa) || 0,
      });
      setSettleRow(null);
      setSettleCash('');
      setSettleMpesa('');
      setArrivalMsg('Payment recorded.');
      setReceipt(res.data);
      await loadArrivals();
    } catch (err: any) {
      setArrivalMsg(err.response?.data?.detail || 'Could not record the payment');
    }
  };

  const deleteArrival = async (id: number) => {
    setArrivalMsg('');
    try {
      await api.delete(`/vehicles/${id}`);
      setArrivalMsg('Arrival removed.');
      await loadArrivals();
    } catch (err: any) {
      setArrivalMsg(err.response?.data?.detail || 'Could not remove the arrival');
    }
  };

  // Lists return small thumbnails; fetch the full photo only when it's tapped.
  const openCarpetPhoto = async (c: any) => {
    try {
      const res = await api.get(`/carpets/${c.id}`);
      setPhotoPreview(res.data.image_data || res.data.image_thumb || null);
    } catch {
      setPhotoPreview(c.image_thumb || c.image_data || null);
    }
  };

  const printReceipt = () => {
    document.body.classList.add('printing-receipt');
    window.print();
    document.body.classList.remove('printing-receipt');
  };

  if (!stats && loading) return <PageLoading label="Loading your performance…" />;
  if (!stats && error) return <PageError message={error} onRetry={fetchEmpData} />;
  if (!stats) return <PageError message="No stats came back from the server." onRetry={fetchEmpData} />;

  const pendingArrivals = arrivals.filter(a => a.status !== 'settled');

  return (
    <div className="space-y-4 sm:space-y-5">
      {error && <InlineError message={error} onRetry={fetchEmpData} />}

      <div className="hidden print:flex print:items-center print:justify-center print:gap-4 print:mb-4 print:border-b print:pb-4">
        <img src={logoImg} alt="EXTREME" className="h-16 object-contain" />
        <div className="text-center">
          <h1 className="text-2xl font-bold text-blue-600">EXTREME AUTO CARWASH</h1>
          <p className="text-sm text-gray-600">Eldoret, Annex, Jamboni</p>
          <p className="text-xs text-gray-500">+254 728 597 862</p>
        </div>
      </div>

      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="eyebrow">My week · {weekId}</p>
          <h1 className="mt-0.5 text-xl font-extrabold tracking-tight sm:text-2xl">
            {user?.full_name ? `Hi, ${String(user.full_name).split(' ')[0]}` : 'My performance'}
          </h1>
          <p className="muted text-xs">
            {stats.jobs_count} jobs · Ksh {stats.revenue_generated} generated this week
          </p>
        </div>
        <button onClick={() => window.print()} className="btn-secondary btn-sm print:hidden">
          <Printer size={15} /> My receipt
        </button>
      </div>

      {/* Stats */}
      <div className="stat-grid">
        {[
          { label: 'Wages', value: `Ksh ${stats.wages_earned}`, cls: 'text-emerald-600 dark:text-emerald-400' },
          { label: 'Jobs', value: stats.jobs_count, cls: 'text-slate-900 dark:text-white' },
          { label: 'Revenue', value: `Ksh ${stats.revenue_generated}`, cls: 'text-brand-600 dark:text-brand-300' },
          { label: 'Debt', value: `Ksh ${stats.current_debt}`, cls: 'text-red-600 dark:text-red-400' },
          { label: 'Shortfalls', value: `Ksh ${stats.shortfall_total}`, cls: 'text-red-600 dark:text-red-400' },
          { label: 'Carpets in', value: stats.carpets_received, cls: 'text-amber-600 dark:text-amber-400' },
          { label: 'Carpets out', value: stats.carpets_released, cls: 'text-violet-600 dark:text-violet-300' },
          { label: 'Payable', value: `Ksh ${stats.payable_balance}`, cls: 'text-emerald-600 dark:text-emerald-400' },
        ].map((s) => (
          <div key={s.label} className="stat-tile">
            <p className="stat-label">{s.label}</p>
            <p className={`stat-value ${s.cls}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {(user?.role === 'admin' || user?.role === 'manager') && (
        <section className="card overflow-hidden">
          <div className="section-head border-b border-slate-200/80 px-4 py-3 dark:border-white/10">
            <div>
              <h2 className="text-sm font-black tracking-tight">Vehicles waiting</h2>
              <p className="muted text-xs">Log on arrival, take payment before 24h.</p>
            </div>
            <span className="chip chip-soft pointer-events-none">
              {pendingArrivals.length} waiting
            </span>
          </div>

          <form onSubmit={logArrival} className="grid grid-cols-2 gap-2 border-b border-slate-200/80 px-4 py-3 dark:border-white/10 sm:grid-cols-4 sm:items-end">
            <label className="block">
              <span className="label">Plate</span>
              <input value={plate} onChange={e => setPlate(e.target.value)} placeholder="KDY 123A"
                className="input-base input-sm uppercase" required />
            </label>
            <label className="block">
              <span className="label">Type</span>
              <select value={arrivalCategory} onChange={e => {
                setArrivalCategory(e.target.value);
                const c = VEHICLE_CATEGORIES.find(x => x.key === e.target.value);
                if (c) setArrivalPrice(String(c.price));
              }} className="input-base input-sm">
                {VEHICLE_CATEGORIES.map(c => <option key={c.key} value={c.key}>{c.label} · {c.price}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="label">Expected (Ksh)</span>
              <input type="number" min="0" value={arrivalPrice} onChange={e => setArrivalPrice(e.target.value)}
                className="input-base input-sm" />
            </label>
            <button type="submit" className="btn-primary btn-sm col-span-2 sm:col-span-1">
              <Plus size={15} /> Log arrival
            </button>
          </form>

          {arrivalMsg && <p className="border-b border-slate-200/80 px-4 py-2 text-xs font-semibold text-brand-700 dark:border-white/10 dark:text-brand-300">{arrivalMsg}</p>}

          <div className="divide-y divide-slate-100 dark:divide-white/5">
            {pendingArrivals.length === 0 && (
              <p className="px-4 py-6 text-center text-sm text-slate-400">No vehicles waiting.</p>
            )}
            {pendingArrivals.map(a => {
              const paid = (a.cash_paid || 0) + (a.mpesa_paid || 0);
              const overdue = a.status === 'expired' || a.overdue;
              const settling = settleRow === a.id;
              return (
                <div key={a.id} className={`px-4 py-3 ${overdue ? 'bg-red-50 dark:bg-red-500/5' : ''}`}>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-lg bg-slate-100 px-2 py-1 font-mono text-xs font-bold uppercase dark:bg-white/10">
                      {a.plate_number}
                    </span>
                    <span className="text-xs font-semibold capitalize text-slate-600 dark:text-slate-300">{a.category}</span>
                    <span className="muted text-[11px]">{format(new Date(a.created_at), 'dd/MM HH:mm')}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      overdue
                        ? 'bg-red-600 text-white'
                        : 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300'
                    }`}>
                      {overdue ? 'Overdue' : 'Awaiting payment'}
                    </span>
                    <span className="ml-auto font-mono text-sm font-bold">Ksh {a.expected_price}</span>
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <span className="muted text-xs">Paid Ksh {paid}</span>
                    <div className="ml-auto flex items-center gap-1">
                      <button onClick={() => {
                        setSettleRow(settling ? null : a.id);
                        setSettleCash('');
                        setSettleMpesa('');
                      }} className="btn-primary btn-sm">
                        {settling ? 'Cancel' : 'Take payment'}
                      </button>
                      <button onClick={() => deleteArrival(a.id)} aria-label="Remove arrival"
                        className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10">
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>

                  {settling && (
                    <div className="mt-2 rounded-xl border border-brand-200 bg-brand-50/60 p-2 dark:border-brand-400/20 dark:bg-brand-500/5">
                      <p className="mb-2 text-xs font-bold">
                        Payment for {a.plate_number} — cash + M-Pesa
                      </p>
                      <div className="flex flex-wrap items-end gap-2">
                        <label className="block min-w-[92px] flex-1">
                          <span className="label">Cash</span>
                          <input type="number" min="0" value={settleCash} onChange={e => setSettleCash(e.target.value)}
                            className="input-base input-sm" />
                        </label>
                        <label className="block min-w-[92px] flex-1">
                          <span className="label">M-Pesa</span>
                          <input type="number" min="0" value={settleMpesa} onChange={e => setSettleMpesa(e.target.value)}
                            className="input-base input-sm" />
                        </label>
                        <button onClick={() => settleArrival(a.id)} className="btn-success btn-sm">
                          <Check size={15} /> Record
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Wage breakdown */}
      <section className="card overflow-hidden">
        <div className="section-head border-b border-slate-200/80 px-4 py-3 dark:border-white/10">
          <div>
            <h2 className="text-sm font-black tracking-tight">Wage breakdown</h2>
            <p className="muted text-xs">What each day of this week paid.</p>
          </div>
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
            Ksh {stats.wages_earned}
          </span>
        </div>
        {stats.wage_breakdown.length > 0 ? (
          <div className="divide-y divide-slate-100 dark:divide-white/5">
            {stats.wage_breakdown.map((d: any) => {
              const width = stats.wages_earned > 0 ? Math.max(4, Math.round((Number(d.wages) / Number(stats.wages_earned)) * 100)) : 0;
              return (
                <div key={d.day} className="flex items-center gap-3 px-4 py-2.5">
                  <span className="w-20 shrink-0 text-xs font-semibold text-slate-500 dark:text-slate-400">
                    {format(new Date(d.day), 'EEE dd MMM')}
                  </span>
                  <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-white/10">
                    <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400" style={{ width: `${width}%` }} />
                  </div>
                  <span className="w-20 shrink-0 text-right font-mono text-sm font-bold">Ksh {d.wages}</span>
                </div>
              );
            })}
            <div className="flex items-center justify-between bg-slate-50/80 px-4 py-3 dark:bg-white/5">
              <span className="text-xs font-black uppercase tracking-wider text-slate-400">Total · {stats.jobs_count} jobs</span>
              <span className="font-mono text-base font-black">Ksh {stats.wages_earned}</span>
            </div>
          </div>
        ) : (
          <p className="px-4 py-6 text-center text-sm text-slate-400">No wages logged this week yet.</p>
        )}
      </section>

      {/* Service breakdown */}
      <section className="card-pad">
        <div className="section-head mb-3">
          <div>
            <h2 className="text-sm font-black tracking-tight">Service breakdown</h2>
            <p className="muted text-xs">Jobs by category this week.</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {Object.entries(stats.service_counts).map(([cat, count]: any) => (
            <div key={cat} className="flex items-center justify-between rounded-xl border border-slate-200/80 px-3 py-2 dark:border-white/10">
              <span className="truncate text-xs font-semibold capitalize text-slate-600 dark:text-slate-300">
                {cat === 'other' ? 'Others' : cat}
              </span>
              <span className="ml-2 rounded-full bg-brand-50 px-2 py-0.5 text-xs font-black text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">
                {count}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Cars washed */}
      <section className="card overflow-hidden">
        <div className="section-head border-b border-slate-200/80 px-4 py-3 dark:border-white/10">
          <div>
            <h2 className="text-sm font-black tracking-tight">Cars washed</h2>
            <p className="muted text-xs">Every job you logged this week.</p>
          </div>
          <span className="chip chip-soft pointer-events-none">{transactions.length}</span>
        </div>

        <div className="divide-y divide-slate-100 dark:divide-white/5">
          {transactions.length === 0 && (
            <p className="px-4 py-6 text-center text-sm text-slate-400">No washes this week.</p>
          )}
          {transactions.map(tx => (
            <div key={tx.id} className="px-4 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs font-bold uppercase">
                  {tx.category === 'other' ? tx.custom_category || 'Other' : tx.plate_number || '—'}
                </span>
                <span className="chip chip-soft pointer-events-none capitalize">
                  {tx.custom_category || tx.category}
                </span>
                <span className="muted ml-auto text-[11px]">{format(new Date(tx.timestamp), 'EEE dd/MM HH:mm')}</span>
              </div>
              <div className="mt-2 grid grid-cols-4 gap-2 text-xs">
                <div>
                  <p className="stat-label">Expected</p>
                  <p className="font-mono font-semibold">Ksh {tx.expected_price}</p>
                </div>
                <div>
                  <p className="stat-label">Paid</p>
                  <p className="font-mono font-semibold">Ksh {tx.total_paid}</p>
                </div>
                <div>
                  <p className="stat-label">Shortfall</p>
                  <p className={`font-mono font-semibold ${(tx.shortfall || 0) > 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-400'}`}>
                    {(tx.shortfall || 0) > 0 ? `Ksh ${tx.shortfall}` : '—'}
                  </p>
                </div>
                <div className="text-right">
                  <p className="stat-label">My payout</p>
                  <p className={`font-mono font-bold ${tx.final_payout < 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                    {tx.final_payout < 0 ? `−Ksh ${Math.abs(tx.final_payout)}` : `Ksh ${tx.final_payout}`}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Carpets */}
      <section className="card overflow-hidden">
        <div className="section-head border-b border-slate-200/80 px-4 py-3 dark:border-white/10">
          <div>
            <h2 className="text-sm font-black tracking-tight">My carpets</h2>
            <p className="muted text-xs">Received → washed → dried → ready → released.</p>
          </div>
          <Link to="/carpets" className="btn-secondary btn-sm">Open board</Link>
        </div>

        <div className="divide-y divide-slate-100 dark:divide-white/5">
          {carpets.length === 0 && (
            <p className="px-4 py-6 text-center text-sm text-slate-400">No carpets assigned to you.</p>
          )}
          {carpets.map(c => {
            const STATUS_COLOR: Record<string, string> = {
              received: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300',
              washed: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
              dried: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-300',
              ready: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
              released: 'bg-slate-200 text-slate-600 dark:bg-white/10 dark:text-slate-300',
            };
            const cells: Array<[string, string | null]> = [
              ['Received', c.created_at],
              ['Washed', c.washed_at],
              ['Ready', c.ready_at],
              ['Released', c.released_at],
            ];
            return (
              <div key={c.id} className="flex gap-3 px-4 py-3">
                {c.image_thumb ? (
                  <img src={c.image_thumb} alt="carpet" onClick={() => openCarpetPhoto(c)}
                    className="h-14 w-14 shrink-0 cursor-pointer rounded-xl border border-slate-200 object-cover dark:border-white/10" />
                ) : (
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-400 dark:bg-white/5">
                    <ImageIcon size={18} />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <p className="truncate text-sm font-bold">{c.characteristics || 'Carpet'}</p>
                    <span className="text-[10px] font-semibold text-slate-400">#{c.id}</span>
                    <span className={`ml-auto rounded-full px-2 py-0.5 text-[10px] font-bold capitalize ${STATUS_COLOR[c.status] || ''}`}>
                      {c.status}
                    </span>
                  </div>
                  <p className="muted mt-0.5 truncate text-xs">
                    {c.client_name || 'No client name'}{c.customer_phone ? ` · ${c.customer_phone}` : ''}
                  </p>
                  <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-slate-500 dark:text-slate-400">
                    {cells.filter(([, ts]) => ts).map(([label, ts]) => (
                      <span key={label}>
                        <span className="font-bold text-slate-400">{label}</span> {format(new Date(ts as string), 'dd/MM HH:mm')}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <p className="stat-label">Paid</p>
                  <p className="font-mono text-sm font-bold">Ksh {c.cash_paid + c.mpesa_paid}</p>
                  <p className="mt-1 text-[10px] text-slate-400">of {c.expected_price}</p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Debts */}
      <section className="card overflow-hidden">
        <div className="section-head border-b border-slate-200/80 px-4 py-3 dark:border-white/10">
          <div>
            <h2 className="text-sm font-black tracking-tight">My debts</h2>
            <p className="muted text-xs">Loans and shortfalls still owed.</p>
          </div>
          <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-bold text-red-600 dark:bg-red-500/10 dark:text-red-300">
            Ksh {stats.current_debt}
          </span>
        </div>

        <div className="divide-y divide-slate-100 dark:divide-white/5">
          {debts.length === 0 && (
            <p className="px-4 py-5 text-center text-sm text-slate-400">No loans on record.</p>
          )}
          {debts.map(d => (
            <div key={d.id} className="flex flex-wrap items-center gap-2 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold">{d.service || 'Loan'}</p>
                <p className="muted text-xs">{format(new Date(d.date), 'dd MMM yyyy')}{d.notes ? ` · ${d.notes}` : ''}</p>
              </div>
              <div className="text-right">
                <p className="font-mono text-sm font-bold text-red-600 dark:text-red-400">Ksh {d.balance}</p>
                <p className="text-[10px] text-slate-400">paid {d.paid} of {d.amount}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="border-t border-slate-200/80 px-4 py-3 dark:border-white/10">
          <h3 className="mb-2 text-[10px] font-extrabold uppercase tracking-[0.16em] text-slate-400">Shortfall debts (auto)</h3>
          {stats.debt_sources && stats.debt_sources.length > 0 ? (
            <div className="space-y-1.5">
              {stats.debt_sources.map((d: any) => (
                <div key={d.id} className="flex items-center justify-between rounded-xl border border-red-200 bg-red-50 px-3 py-2 dark:border-red-500/30 dark:bg-red-500/10">
                  <span className="min-w-0 truncate text-xs font-semibold">
                    {d.custom_category || d.category}{d.plate_number ? ` (${d.plate_number})` : ''} — {new Date(d.timestamp).toLocaleDateString()}
                  </span>
                  <span className="ml-2 font-mono text-sm font-bold text-red-600 dark:text-red-400">Ksh {d.shortfall}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-400">No shortfall debts.</p>
          )}
        </div>
      </section>

      {/* Repayments */}
      <section className="card overflow-hidden">
        <div className="section-head border-b border-slate-200/80 px-4 py-3 dark:border-white/10">
          <div>
            <h2 className="text-sm font-black tracking-tight">My repayments</h2>
            <p className="muted text-xs">Money paid back this week.</p>
          </div>
        </div>
        {repayments.length > 0 ? (
          <div className="divide-y divide-slate-100 dark:divide-white/5">
            {repayments.map(r => (
              <div key={r.id} className="flex items-center justify-between px-4 py-2.5">
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                  {format(new Date(r.timestamp), 'dd MMM yyyy HH:mm')}
                </span>
                <span className="font-mono text-sm font-bold text-emerald-600 dark:text-emerald-400">Ksh {r.amount}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="px-4 py-5 text-center text-sm text-slate-400">No repayments this week.</p>
        )}
      </section>

      {photoPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setPhotoPreview(null)}>
          <div className="relative w-full max-w-3xl" onClick={e => e.stopPropagation()}>
            <button onClick={() => setPhotoPreview(null)}
              aria-label="Close photo"
              className="absolute -right-2 -top-2 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-red-600 font-bold text-white shadow-lg">×</button>
            <img src={photoPreview} alt="carpet preview" className="w-full rounded-2xl shadow-2xl" />
          </div>
        </div>
      )}

      {receipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
          <div className="receipt-print-area w-full max-w-md rounded-3xl bg-white p-6 text-slate-900 shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-200 pb-4">
              <div>
                <p className="text-lg font-black tracking-wide text-blue-700">EXTREME AUTO CARWASH</p>
                <p className="text-xs text-slate-500">Eldoret, Annex, Jamboni</p>
                <p className="text-xs text-slate-500">+254 728 597 862</p>
              </div>
              <span className="rounded-lg bg-emerald-100 px-2 py-1 text-xs font-bold uppercase tracking-wide text-emerald-700">Paid</span>
            </div>
            <div className="py-4 text-center">
              <p className="text-sm font-bold uppercase tracking-[0.2em] text-slate-400">Payment Receipt</p>
              <p className="mt-1 font-mono text-xs text-slate-500">No. RCP-{String(receipt.id).padStart(4, '0')}</p>
            </div>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-slate-500">Date</dt>
                <dd className="font-mono">{receipt.settled_at ? format(new Date(receipt.settled_at), 'dd/MM/yyyy HH:mm') : format(new Date(), 'dd/MM/yyyy HH:mm')}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Vehicle</dt>
                <dd className="font-mono">{receipt.plate_number}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Service</dt>
                <dd className="capitalize">{receipt.category}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Cash</dt>
                <dd className="font-mono">Ksh {receipt.cash_paid}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">M-Pesa</dt>
                <dd className="font-mono">Ksh {receipt.mpesa_paid}</dd>
              </div>
              <div className="flex justify-between border-t border-slate-200 pt-2 text-base font-bold">
                <dt>Total paid</dt>
                <dd className="font-mono">Ksh {receipt.cash_paid + receipt.mpesa_paid}</dd>
              </div>
            </dl>
            <p className="mt-4 text-center text-xs text-slate-400">Thank you for washing with Extreme!</p>
            <div className="mt-4 flex gap-2 print:hidden">
              <button onClick={printReceipt} className="btn-primary flex-1">
                <Printer size={15} /> Print
              </button>
              <button onClick={() => setReceipt(null)} className="btn-secondary flex-1">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
