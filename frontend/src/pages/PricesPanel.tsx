import { useCallback, useEffect, useState } from 'react';
import { Save } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { InlineError, PageError, PageLoading } from '../components/States';

const CATEGORY_LABELS: Record<string, string> = {
  bicycle: 'Bicycle', motorcycle: 'Motorcycle', taxi: 'Taxi', car: 'Car',
  midrange: 'Midrange', lorry: 'Lorry', carpet: 'Carpet',
  vacuum: 'Vacuum', engine: 'Engine Wash', other: 'Other',
};

export interface PriceRow {
  id: number;
  category: string;
  min_price: number;
  max_price: number;
  commission_percent: number;
  is_active: boolean;
}

export default function PricesPanel() {
  const [prices, setPrices] = useState<PriceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState<Set<number>>(new Set());
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const fetchPrices = useCallback(async () => {
    try {
      const res = await api.get('/prices/');
      setPrices(res.data);
      setError('');
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Could not load prices.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchPrices();
  }, [fetchPrices]);

  const toNum = (v: any) => { const n = parseFloat(v); return Number.isFinite(n) ? n : 0; };

  const savePrice = async (id: number, field: string, value: any) => {
    const price = prices.find((p) => p.id === id);
    if (!price) return;
    setSaving((prev) => new Set([...prev, id]));
    try {
      const updates: Record<string, any> = { ...price, [field]: value };
      await api.put(`/prices/${price.category}`, {
        min_price: toNum(updates.min_price),
        max_price: toNum(updates.max_price),
        commission_percent: toNum(updates.commission_percent),
        is_active: updates.is_active,
      });
      setPrices((prev) => prev.map((p) => (p.id === id ? { ...p, [field]: value } : p)));
    } catch (err: any) {
      alert(err?.response?.data?.detail || 'Could not save price');
    } finally {
      setSaving((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const toggleActive = async (id: number) => {
    const price = prices.find((p) => p.id === id);
    if (!price) return;
    await savePrice(id, 'is_active', !price.is_active);
  };

  if (loading) return <PageLoading label="Loading prices..." />;
  if (error && prices.length === 0) return <PageError message={error} onRetry={fetchPrices} />;

  return (
    <div className="space-y-5">
      {error && <InlineError message={error} onRetry={fetchPrices} />}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="eyebrow">Configuration</p>
          <h1 className="section-title mt-0.5">Service prices</h1>
          <p className="muted text-xs">Edit min, expected and commission — applies to new day-sheet rows.</p>
        </div>
        <button onClick={fetchPrices} className="btn-secondary btn-sm">
          <Save size={15} /> Refresh
        </button>
      </div>

      <div className="stat-grid xl:grid-cols-4">
        {[
          { label: 'Services', value: prices.length, cls: 'text-slate-900 dark:text-white' },
          { label: 'Active', value: prices.filter((p) => p.is_active).length, cls: 'text-emerald-600 dark:text-emerald-400' },
          { label: 'Inactive', value: prices.filter((p) => !p.is_active).length, cls: 'text-red-600 dark:text-red-400' },
          {
            label: 'Avg commission',
            value: `${prices.length ? Math.round(prices.reduce((s, p) => s + p.commission_percent, 0) / prices.length) : 0}%`,
            cls: 'text-violet-600 dark:text-violet-300',
          },
        ].map((s) => (
          <div key={s.label} className="stat-tile">
            <p className="stat-label">{s.label}</p>
            <p className={`stat-value ${s.cls}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {!isAdmin && (
        <div className="card-pad rounded-2xl bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/30">
          <p className="text-sm text-amber-700 dark:text-amber-400">
            <b>View only.</b> Only admin can edit prices. Manager can view but not change them.
          </p>
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="divide-y divide-slate-100 dark:divide-white/5">
          {prices.length === 0 && (
            <p className="px-4 py-8 text-center text-sm text-slate-400">No price config.</p>
          )}
          {prices.map((p) => (
            <div key={p.id} className={`px-3 py-3 sm:px-4 ${!p.is_active ? 'bg-red-50/40 dark:bg-red-500/5' : ''}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold">{CATEGORY_LABELS[p.category] || p.category}</p>
                  <p className="muted text-[11px]">
                    Min {p.min_price} · Max {p.max_price} · {p.commission_percent}% commission
                  </p>
                </div>
                <button
                  onClick={() => toggleActive(p.id)}
                  disabled={saving.has(p.id) || !isAdmin}
                  className={`chip ${!isAdmin
                    ? 'cursor-not-allowed opacity-60'
                    : p.is_active
                      ? 'border-emerald-600 bg-emerald-600 text-white'
                      : ''
                  }`}
                >
                  {p.is_active ? 'Active' : 'Inactive'}
                </button>
              </div>

              <div className="mt-2 grid grid-cols-3 gap-2">
                <label className="block">
                  <span className="label">Min price</span>
                  <input
                    type="number" min="0"
                    value={p.min_price}
                    onChange={(e) => savePrice(p.id, 'min_price', toNum(e.target.value))}
                    disabled={saving.has(p.id) || !isAdmin}
                    className={`input-base input-sm text-right font-mono ${!isAdmin ? 'cursor-not-allowed bg-slate-100 text-slate-400' : ''}`}
                  />
                </label>
                <label className="block">
                  <span className="label">Max / expected</span>
                  <input
                    type="number" min="0"
                    value={p.max_price}
                    onChange={(e) => savePrice(p.id, 'max_price', toNum(e.target.value))}
                    disabled={saving.has(p.id) || !isAdmin}
                    className={`input-base input-sm text-right font-mono ${!isAdmin ? 'cursor-not-allowed bg-slate-100 text-slate-400' : ''}`}
                  />
                </label>
                <label className="block">
                  <span className="label">Commission %</span>
                  <input
                    type="number" min="0" max="100"
                    value={p.commission_percent}
                    onChange={(e) => savePrice(p.id, 'commission_percent', toNum(e.target.value))}
                    disabled={saving.has(p.id) || !isAdmin}
                    className={`input-base input-sm text-right font-mono ${!isAdmin ? 'cursor-not-allowed bg-slate-100 text-slate-400' : ''}`}
                  />
                </label>
              </div>

              {saving.has(p.id) && (
                <p className="mt-1 text-[11px] font-semibold text-brand-600 dark:text-brand-300">Saving…</p>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="card-pad rounded-2xl border border-slate-200/80">
        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-3">How it works</h3>
        <ul className="space-y-1 text-sm text-slate-600 dark:text-slate-400 list-disc pl-5">
          <li><b>Min price</b> — below this, shortfall starts being deducted from the washer's wages.</li>
          <li><b>Max price</b> — the expected price shown in the Day Sheet when adding a row.</li>
          <li><b>Commission %</b> — percentage of max price paid as commission to the washer.</li>
          <li><b>Inactive</b> — hides the service from the Day Sheet add-row list.</li>
        </ul>
      </div>
    </div>
  );
}
