import { useCallback, useEffect, useState } from 'react';
import { Save, Trash2 } from 'lucide-react';
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
          <h2 className="text-lg font-black tracking-tight">Service Prices</h2>
          <p className="muted text-sm">
            Admin can edit min price, max (expected) price and commission % for each service.
            Changes apply to new Day Sheet rows and commission calculations.
          </p>
        </div>
        <button onClick={fetchPrices} className="btn-secondary inline-flex items-center gap-2">
          <Save size={15} /> Refresh
        </button>
      </div>

      <div className="card-pad overflow-x-auto rounded-2xl">
        <table className="w-full text-left text-sm border-collapse">
          <thead>
            <tr className="border-b border-slate-200/80 text-xs uppercase tracking-wider text-slate-400 dark:border-white/10">
              <th className="py-2 pr-3">Service</th>
              <th className="py-2 pr-3 text-right">Min Price (Ksh)</th>
              <th className="py-2 pr-3 text-right">Max / Expected (Ksh)</th>
              <th className="py-2 pr-3 text-right">Commission %</th>
              <th className="py-2 pr-3 text-center">Active</th>
              <th className="py-2 text-right" />
            </tr>
          </thead>
          <tbody>
            {prices.length === 0 && (
              <tr><td colSpan={6} className="py-8 text-center text-slate-400">No price config.</td></tr>
            )}
            {prices.map((p) => (
              <tr key={p.id} className={`border-b border-slate-200/70 dark:border-white/10 ${!p.is_active ? 'bg-red-50/20 dark:bg-red-900/10' : ''}`}>
                <td className="py-3 pr-3 font-medium">{CATEGORY_LABELS[p.category] || p.category}</td>
                <td className="py-3 pr-3 text-right font-mono">
                  <input
                    type="number" min="0"
                    value={p.min_price}
                    onChange={(e) => savePrice(p.id, 'min_price', toNum(e.target.value))}
                    disabled={saving.has(p.id)}
                    className="input-base w-20 text-right px-2 py-1 text-xs"
                  />
                </td>
                <td className="py-3 pr-3 text-right font-mono">
                  <input
                    type="number" min="0"
                    value={p.max_price}
                    onChange={(e) => savePrice(p.id, 'max_price', toNum(e.target.value))}
                    disabled={saving.has(p.id)}
                    className="input-base w-20 text-right px-2 py-1 text-xs"
                  />
                </td>
                <td className="py-3 pr-3 text-right font-mono">
                  <input
                    type="number" min="0" max="100"
                    value={p.commission_percent}
                    onChange={(e) => savePrice(p.id, 'commission_percent', toNum(e.target.value))}
                    disabled={saving.has(p.id)}
                    className="input-base w-20 text-right px-2 py-1 text-xs"
                  />
                </td>
                <td className="py-3 pr-3 text-center">
                  <button
                    onClick={() => toggleActive(p.id)}
                    disabled={saving.has(p.id)}
                    className={`rounded-full px-2.5 py-1 text-xs font-bold transition ${p.is_active
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-200 text-slate-700 dark:bg-white/10 dark:text-slate-200'
                    }`}
                  >
                    {p.is_active ? 'Active' : 'Inactive'}
                  </button>
                </td>
                <td className="py-3 text-right">
                  {saving.has(p.id) && <span className="text-xs text-brand-600 animate-pulse">Saving…</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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
