import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Calendar,
  Check,
  Loader2,
  MessageSquareText,
  Plus,
  Pencil,
  RefreshCw,
  Save,
  Trash2,
  X,
} from 'lucide-react';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { parsePaymentSms } from '../utils/smsParser';
import { InlineError } from './States';

export interface DaySheetProps {
  employees: any[];
  selectedDay: Date;
  onOpenSummary?: () => void;
}

const STANDARD: Record<string, number> = {
  bicycle: 50, motorcycle: 70, taxi: 150, car: 200, midrange: 300, lorry: 500, carpet: 300, vacuum: 300, engine: 300, exterior: 150, other: 0,
};
const CATEGORY_LABELS: Record<string, string> = {
  bicycle: 'Bicycle', motorcycle: 'Motorcycle', taxi: 'Taxi', car: 'Car',
  midrange: 'Midrange', lorry: 'Lorry', carpet: 'Carpet', vacuum: 'Vacuum', engine: 'Engine Wash', exterior: 'Exterior Wash', other: 'Other',
};
const PLATE_CATS = ['car', 'taxi', 'midrange', 'lorry', 'exterior', 'motorcycle'];

type SheetRow = {
  _key: string;
  kind: 'tx';
  draft?: boolean;
  id?: number;
  category: string;
  item: string;
  washer_id: string;
  cash: number;
  mpesa: number;
  sender: string;
  ref: string;
  time: string;
  expected: number;
  shortfall?: number;
  total_paid?: number;
  final_payout?: number;
  saving?: boolean;
  error?: string;
  has_vacuum?: boolean;
  has_engine_wash?: boolean;
};
function nowHHmm(): string {
  return format(new Date(), 'HH:mm');
}

const toNum = (v: any) => {
  const n = parseFloat(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

function txToRow(tx: any): SheetRow {
  const item = tx.category === 'carpet'
    ? (tx.carpet_characteristics || 'Carpet')
    : tx.category === 'other'
      ? (tx.custom_category || 'Other')
      : (tx.plate_number || '');
  return {
    _key: `tx-${tx.id}`,
    kind: 'tx',
    id: tx.id,
    category: tx.category,
    item,
    washer_id: tx.washer_id ? String(tx.washer_id) : '',
    cash: tx.cash_paid || 0,
    mpesa: tx.mpesa_paid || 0,
    sender: tx.mpesa_sender_name || '',
    ref: tx.mpesa_transaction_id || '',
    time: format(new Date(tx.timestamp), 'HH:mm'),
    expected: tx.expected_price,
    shortfall: tx.shortfall || 0,
    total_paid: tx.total_paid || 0,
    final_payout: tx.final_payout || 0,
    has_vacuum: tx.has_vacuum || false,
    has_engine_wash: tx.has_engine_wash || false,
  };
}

export default function DaySheet({ employees, selectedDay, onOpenSummary }: DaySheetProps) {
  const [rows, setRows] = useState<SheetRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [savingAll, setSavingAll] = useState(false);
  const [prices, setPrices] = useState<Record<string, any>>({});
  // drafts & popovers
  const [smsOpen, setSmsOpen] = useState<string | null>(null);
  const [smsText, setSmsText] = useState('');
  const [addonOpen, setAddonOpen] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState<SheetRow | null>(null);
  const [editForm, setEditForm] = useState<any>({});

  const [duplicates, setDuplicates] = useState<Set<string>>(new Set());

  const normalizeKey = (s: string) => (s || '').replace(/\s/g, '').toUpperCase();

  // A row is a true duplicate only when the plate number, payment details
  // (cash + mpesa) and payer name all match. Strip spaces from the plate and
  // payer name before comparing so "KCA 123" and "KCA123" are treated the same.
  const computeDuplicates = (rowsToCheck: SheetRow[]) => {
    const seen = new Map<string, string[]>();
    rowsToCheck.forEach((r) => {
      if (r.draft && !r.id) return; // skip unsaved drafts without server id
      const plate = normalizeKey(r.item);
      const payer = normalizeKey(r.sender);
      const key = `${r.category}|${plate}|${r.cash}|${r.mpesa}|${payer}`;
      if (!seen.has(key)) seen.set(key, []);
      seen.get(key)!.push(r._key);
    });
    const dupes = new Set<string>();
    seen.forEach((keys) => {
      if (keys.length > 1) keys.forEach((k) => dupes.add(k));
    });
    setDuplicates(dupes);
  };

  // Recompute duplicates whenever rows change
  useEffect(() => {
    computeDuplicates(rows);
  }, [rows]);

  const toggleAddon = (key: string) => setAddonOpen(addonOpen === key ? null : key);

  const selectAddon = (key: string, type: 'vacuum' | 'engine' | 'engine+vacuum') => {
    const row = rows.find((r) => r._key === key);
    if (!row) return;
    const isVac = type === 'vacuum' || type === 'engine+vacuum';
    const isEng = type === 'engine' || type === 'engine+vacuum';
    setRows((prev) =>
      prev.map((r) => {
        if (r._key !== key) return r;
        // Recompute expected from category + new add-on flags
        let expected = 0;
        if (r.category === 'car') {
          expected = 200 + (isVac ? 300 : 0) + (isEng ? 300 : 0);
          if (isVac && isEng) expected = 800; // full package
        } else if (PLATE_CATS.includes(r.category)) {
          expected = STANDARD[r.category] + (isVac ? 300 : 0) + (isEng ? 300 : 0);
        } else {
          expected = r.expected || 0;
        }
        return {
          ...r,
          has_vacuum: isVac,
          has_engine_wash: isEng,
          expected,
        };
      }),
    );
    setAddonOpen(null);
  };

  const removeAddon = (key: string, type: 'vacuum' | 'engine') => {
    setRows((prev) =>
      prev.map((r) => {
        if (r._key !== key) return r;
        const newVac = type === 'vacuum' ? false : r.has_vacuum;
        const newEng = type === 'engine' ? false : r.has_engine_wash;
        let expected = 0;
        if (r.category === 'car') {
          expected = 200 + (newVac ? 300 : 0) + (newEng ? 300 : 0);
          if (newVac && newEng) expected = 800;
        } else if (PLATE_CATS.includes(r.category)) {
          expected = STANDARD[r.category] + (newVac ? 300 : 0) + (newEng ? 300 : 0);
        } else {
          expected = r.expected || 0;
        }
        return {
          ...r,
          has_vacuum: newVac,
          has_engine_wash: newEng,
          expected,
        };
      }),
    );
    setAddonOpen(null);
  };

  const openEdit = (row: SheetRow) => {
    setEditForm({
      category: row.category,
      item: row.item || '',
      washer_id: row.washer_id || '',
      cash: row.cash || 0,
      mpesa: row.mpesa || 0,
      sender: row.sender || '',
      ref: row.ref || '',
      expected: row.expected || 0,
    });
    setEditOpen(row);
  };

  const closeEdit = () => {
    setEditOpen(null);
    setEditForm({});
  };

  const saveEdit = async () => {
    if (!editOpen) return;
    const washerId = editForm.washer_id ? Number(editForm.washer_id) : undefined;
    if (!editOpen.id && !washerId) {
      alert('Pick a washer first');
      return;
    }
    if (washerId !== undefined && (!Number.isInteger(washerId) || washerId <= 0)) {
      alert('Please select a valid washer');
      return;
    }
    const cat = editForm.category || 'car';
    const item = editForm.item || '';
    try {
      const payload: any = {
        ...(washerId ? { washer_id: washerId } : {}),
        category: cat,
        expected_price: editForm.expected,
        cash_paid: editForm.cash || 0,
        mpesa_paid: editForm.mpesa || 0,
        mpesa_transaction_id: editForm.ref || null,
        mpesa_sender_name: editForm.sender || null,
        manual_tip: 0,
        tip_method: 'cash',
        misc_amount: 0,
        misc_description: null,
        has_car_wash: PLATE_CATS.includes(cat),
        has_vacuum: cat === 'vacuum',
        has_engine_wash: cat === 'engine',
        plate_number: PLATE_CATS.includes(cat) ? item || null : null,
        custom_category: cat === 'other' ? item || null : null,
        carpet_metadata: cat === 'carpet' && washerId
          ? { characteristics: item || 'Carpet', receiver_id: washerId }
          : null,
      };
      if (editOpen.id) {
        await api.put(`/transactions/${editOpen.id}`, payload);
      } else {
        await api.post('/transactions/', payload);
      }
      closeEdit();
      await reload();
    } catch (err: any) {
      alert(err?.response?.data?.detail || 'Save failed');
    }
  };

  const dayStr = format(selectedDay, 'yyyy-MM-dd');

  const reload = useCallback(async (opts: { fresh?: boolean; keepDrafts?: boolean } = {}) => {
    const params = { day: format(selectedDay, 'yyyy-MM-dd') };
    const cfg = (extra: any = {}) => ({ ...extra, skipCache: opts.fresh });
    try {
      const [txRes, priceRes] = await Promise.all([
        api.get('/transactions/', cfg({ params })),
        api.get('/prices/', cfg()),
      ]);
      setRows((prev) => {
        // Merge server rows with local drafts / just-saved rows by id, so a row
        // that was just POSTed keeps its local _key (no focus loss) and is never
        // duplicated. Subsequent keystrokes PUT to this id instead of POSTing.
        const serverRows: SheetRow[] = txRes.data.map(txToRow);
        // A fresh day load replaces the whole sheet. A manual refresh keeps
        // anything the user has typed but not synced yet.
        if (opts.fresh && !opts.keepDrafts) return serverRows;
        const serverById = new Map<number, SheetRow>();
        for (const sr of serverRows) if (sr.id != null) serverById.set(sr.id, sr);

        const result: SheetRow[] = [];
        const seenIds = new Set<number>();

        for (const local of prev) {
          // Never overwrite unsaved edits with the server copy.
          if (local.draft) {
            result.push(local);
            if (local.id != null) seenIds.add(local.id);
          } else if (local.id != null && serverById.has(local.id)) {
            result.push({ ...serverById.get(local.id)!, _key: local._key });
            seenIds.add(local.id);
          } else {
            result.push(local);
          }
        }
        for (const sr of serverRows) {
          if (sr.id != null && !seenIds.has(sr.id)) result.push(sr);
        }
        return result;
      });
      // Index prices by category for quick lookup
      const priceMap: Record<string, any> = {};
      for (const p of priceRes.data) priceMap[p.category] = p;
      setPrices(priceMap);
      setLoadError('');
    } catch (err: any) {
      setRows((prev) => prev.map((r) => ({ ...r, saving: false })));
      setLoadError(
        err?.response?.data?.detail ||
        (err?.code === 'ECONNABORTED' ? 'The server took too long to respond.' : 'Could not reach the server.'),
      );
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dayStr]);

  useEffect(() => {
    // Switching days must hit the server so the table actually changes —
    // never serve a stale cached copy for a different day. This is the only
    // automatic fetch: the sheet never refreshes while you are typing.
    void reload({ fresh: true });
  }, [reload]);

  const persistRow = useCallback(
    (key: string, patch: Partial<SheetRow>): Promise<unknown> => {
      const existing = rows.find((r) => r._key === key);
      // A row that has an id was already saved to the server. Treat it as
      // "saved" so edits PUT to the existing row instead of POSTing a duplicate.
      const saved = existing && existing.id != null ? existing : undefined;
      const merged = { ...(existing || { _key: key, kind: 'tx' as const, draft: true, cash: 0, mpesa: 0, sender: '', ref: '', time: nowHHmm(), expected: 0, category: 'car' }), ...patch };
      const cat = merged.category || 'car';
      const expected = merged.expected || STANDARD[cat] || (merged.cash || 0) + (merged.mpesa || 0);
      const washerId = merged.washer_id == null || merged.washer_id === '' ? null : Number(merged.washer_id);
      const payload: any = {
        ...(washerId != null && Number.isFinite(washerId) && { washer_id: washerId }),
        category: cat,
        expected_price: expected,
        cash_paid: merged.cash || 0,
        mpesa_paid: merged.mpesa || 0,
        mpesa_transaction_id: merged.ref || null,
        mpesa_sender_name: merged.sender || null,
        manual_tip: 0,
        tip_method: 'cash',
        misc_amount: 0,
        misc_description: null,
        has_car_wash: PLATE_CATS.includes(cat),
        has_vacuum: merged.has_vacuum ?? cat === 'vacuum',
        has_engine_wash: merged.has_engine_wash ?? cat === 'engine',
        plate_number: PLATE_CATS.includes(cat) ? merged.item || null : null,
        custom_category: cat === 'other' ? merged.item || null : null,
        carpet_metadata: cat === 'carpet' && merged.washer_id
          ? { characteristics: merged.item || 'Carpet', receiver_id: Number(merged.washer_id) }
          : null,
      };
      const save = saved
        ? api.put(`/transactions/${saved.id}`, payload)
        : api.post('/transactions/', payload);
      return save.then((response) => {
        if (!saved) {
          // Draft was just created on the server. Stamp it with the real id and
          // mark as saved so subsequent edits PUT to this row instead of
          // POSTing a brand-new transaction.
          const newId = response.data?.id;
          setRows((prev) =>
            prev.map((r) => (r._key === key ? { ...r, id: newId, draft: false, saving: false } : r)),
          );
        } else {
          // Existing row was updated via PUT. Mark as saved.
          setRows((prev) =>
            prev.map((r) => (r._key === key ? { ...r, draft: false, saving: false } : r)),
          );
        }
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows, reload],
  );

  const flushSave = useCallback(
    (key: string, patch: Partial<SheetRow>) => {
      setRows((prev) => prev.map((r) => (r._key === key ? { ...r, ...patch, saving: true, error: '' } : r)));
      persistRow(key, patch).catch((err: any) => {
        setRows((prev) =>
          prev.map((r) =>
            r._key === key
              ? { ...r, saving: false, error: err?.response?.data?.detail || 'Save failed' }
              : r,
          ),
        );
      });
    },
    [persistRow],
  );

  const patchRow = (key: string, patch: Partial<SheetRow>) => {
    setRows((r) =>
      r.map((x) => {
        if (x._key !== key) return x;
        const updated = { ...x, ...patch };
        // Mark saved rows as draft when edited so they get synced
        if (!x.draft && x.id !== null) {
          updated.draft = true;
        }
        return updated;
      }),
    );
  };

  const addDraft = (category: string, expected?: number) => {
    const defaultExpected = expected !== undefined
      ? expected
      : (prices[category]?.max_price ?? STANDARD[category] ?? 0);
    setRows((prev) => [
      ...prev,
      {
        _key: `draft-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        kind: 'tx',
        draft: true,
        category,
        item: category === 'motorcycle' ? 'PIKIPIKI' : category === 'carpet' ? 'CARPET' : '',
        washer_id: '',
        cash: 0,
        mpesa: 0,
        sender: '',
        ref: '',
        time: nowHHmm(),
        expected: defaultExpected,
      },
    ]);
  };

  const deleteRow = async (row: SheetRow) => {
    if (!row.id) {
      setRows((prev) => prev.filter((r) => r._key !== row._key));
      return;
    }
    if (!confirm('Delete this row? This reverses the employee balance and removes the record.')) return;
    try {
      await api.delete(`/transactions/${row.id}`);
      await reload();
    } catch (err: any) {
      alert(err?.response?.data?.detail || 'Could not delete the row');
    }
  };

  const saveDraftNow = (key: string) => {
    const row = rows.find((r) => r._key === key);
    if (!row) return;
    if (row.draft && !row.washer_id) {
      setRows((prev) =>
        prev.map((r) => (r._key === key ? { ...r, error: 'Pick a washer first' } : r)),
      );
      return;
    }
    flushSave(key, {});
  };

  const syncAll = async () => {
    const drafts = rows.filter((r) => r.draft && r.washer_id);
    if (drafts.length === 0) {
      await reload();
      return;
    }
    setSavingAll(true);
    try {
      await Promise.all(drafts.map((d) => persistRow(d._key, {})));
      await reload();
    } catch (err: any) {
      alert(err?.response?.data?.detail || 'Sync failed');
    } finally {
      setSavingAll(false);
    }
  };

  const fillSms = (key: string) => {
    const parsed = parsePaymentSms(smsText);
    if (!parsed) {
      alert('Could not parse this message. Use an M-Pesa "Confirmed" or the bank "Dear..." announcement.');
      return;
    }
    patchRow(key, {
      mpesa: parsed.amount,
      sender: parsed.senderName,
      ref: parsed.transactionId,
    });
    setSmsOpen(null);
    setSmsText('');
  };

  const totals = useMemo(() => {
    let cash = 0, mpesa = 0, paid = 0, shortfall = 0, wages = 0;
    const counts: Record<string, number> = {};
    for (const r of rows) {
      if (r.draft) continue;
      cash += r.cash;
      mpesa += r.mpesa;
      paid += r.total_paid || 0;
      shortfall += r.shortfall || 0;
      wages += r.final_payout || 0;
      counts[r.category] = (counts[r.category] || 0) + 1;
    }
    return { cash, mpesa, paid, shortfall, wages, counts };
  }, [rows]);

  const pendingDrafts = rows.filter((r) => r.draft).length;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const selected = new Date(selectedDay);
  selected.setHours(0, 0, 0, 0);
  const isFutureDay = selected > today;

  if (loading && rows.length === 0) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-6 text-sm font-medium text-slate-500 dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-400">
        <Loader2 size={18} className="animate-spin text-brand-500" /> Loading the day sheet…
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {loadError && <InlineError message={loadError} onRetry={() => reload()} />}

      {/* Empty day wording */}
      {rows.length === 0 && (
        <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-12 text-center text-sm font-medium text-slate-500 dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-400">
          {isFutureDay ? (
            <>
              <Calendar size={20} />
              <span>No activity yet — {format(selectedDay, 'EEEE dd MMM yyyy')} hasn't arrived.</span>
            </>
          ) : (
            <>
              <AlertCircle size={20} />
              <span>No transactions recorded for {format(selectedDay, 'EEEE dd MMM yyyy')} yet.</span>
            </>
          )}
        </div>
      )}

      {/* Category chips */}
      <div className="flex flex-wrap gap-1.5">
        {Object.entries(totals.counts).length === 0 ? (
          <span className="muted text-xs">No jobs logged yet today.</span>
        ) : (
          Object.entries(totals.counts).map(([cat, n]) => (
            <span key={cat} className="chip">
              {CATEGORY_LABELS[cat] || cat}: {n}
            </span>
          ))
        )}
        {pendingDrafts > 0 && (
          <span className="chip border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-300">
            {pendingDrafts} unsaved {pendingDrafts === 1 ? 'row' : 'rows'}
          </span>
        )}
      </div>

      {/* Day sheet */}
      <div className="card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/80 px-4 py-3 dark:border-white/10">
          <div className="min-w-0">
            <h2 className="truncate text-base font-black tracking-tight sm:text-lg">
              Day sheet — {format(selectedDay, 'EEEE, dd MMM yyyy')}
            </h2>
            <p className="muted text-xs">Edit inline. Tap Sync to save every pending row.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {onOpenSummary && (
              <button onClick={onOpenSummary} className="btn-secondary btn-sm">
                <MessageSquareText size={14} /> Day summary
              </button>
            )}
            <button onClick={() => void reload({ fresh: true, keepDrafts: true })} className="btn-secondary btn-sm" title="Reload from the server (keeps unsaved rows)">
              <RefreshCw size={14} /> Refresh
            </button>
            <button onClick={syncAll} disabled={savingAll} className="btn-primary btn-sm">
              {savingAll ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              {pendingDrafts > 0 ? `Sync (${pendingDrafts})` : 'Sync'}
            </button>
          </div>
        </div>

        <div className="divide-y divide-slate-100 dark:divide-white/5">
          {rows.length === 0 && (
            <div className="px-4 py-10 text-center">
              <p className="text-sm font-bold text-slate-500 dark:text-slate-400">No rows yet</p>
              <p className="muted mt-1 text-xs">Use the add-row chips below to start logging the day.</p>
            </div>
          )}
          {rows.map((row, idx) => (
            <RowCard
              key={row._key}
              row={row}
              rowNumber={idx + 1}
              employees={employees}
              isPlate={PLATE_CATS.includes(row.category)}
              isOther={row.category === 'other'}
              saving={!!row.saving}
              error={row.error}
              smsOpen={smsOpen === row._key}
              smsText={smsText}
              onSmsText={setSmsText}
              onOpenSms={() => { setSmsOpen(smsOpen === row._key ? null : row._key); setSmsText(''); }}
              onFillSms={() => fillSms(row._key)}
              onPatch={(patch) => patchRow(row._key, patch)}
              onSaveDraft={() => saveDraftNow(row._key)}
              onDelete={() => deleteRow(row)}
              addonOpen={addonOpen === row._key}
              onToggleAddon={() => toggleAddon(row._key)}
              onSelectAddon={(type: 'vacuum' | 'engine' | 'engine+vacuum') => selectAddon(row._key, type)}
              onRemoveAddon={(type: 'vacuum' | 'engine') => removeAddon(row._key, type)}
              onEdit={() => openEdit(row)}
              isDuplicate={duplicates.has(row._key)}
            />
          ))}
        </div>

        {rows.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200/80 bg-slate-50/80 px-4 py-3 dark:border-white/10 dark:bg-white/5">
            <span className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-slate-400">Totals</span>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm font-black">
              <span className="text-emerald-600 dark:text-emerald-400">Cash {totals.cash}</span>
              <span className="text-brand-600 dark:text-brand-300">M-Pesa {totals.mpesa}</span>
              <span>Paid {totals.paid}</span>
            </div>
          </div>
        )}

        {/* Add-row toolbar */}
        <div className="border-t border-slate-200/80 px-3 py-3 dark:border-white/10">
          <p className="mb-2 text-[10px] font-extrabold uppercase tracking-[0.16em] text-slate-400">Add row</p>
          <div className="hscroll">
            {[
              { cat: 'car', label: 'Car · 200', expected: 200 },
              { cat: 'taxi', label: 'Taxi · 150', expected: 150 },
              { cat: 'midrange', label: 'Mid · 300', expected: 300 },
              { cat: 'lorry', label: 'Lorry · 500', expected: 500 },
              { cat: 'exterior', label: `Exterior · ${prices.exterior?.min_price ?? 150}`, expected: Number(prices.exterior?.min_price ?? 150) },
              { cat: 'motorcycle', label: 'Bike · 70', expected: 70 },
              { cat: 'bicycle', label: 'Cycle · 50', expected: 50 },
              { cat: 'other', label: 'Other', expected: 0 },
              { cat: 'carpet', label: `Receive carpet · ${prices.carpet?.min_price ?? 300}`, expected: Number(prices.carpet?.min_price ?? 300) },
              { cat: 'carpet', label: `Release carpet · ${prices.carpet?.min_price ?? 300}`, expected: Number(prices.carpet?.min_price ?? 300) },
              { cat: 'vacuum', label: 'Vacuum · 300', expected: 300 },
              { cat: 'vacuum', label: 'Vacuum · 200', expected: 200 },
              { cat: 'engine', label: 'Engine · 300', expected: 300 },
              { cat: 'engine', label: 'Engine · 200', expected: 200 },
            ].map(({ cat, label, expected }) => (
              <button
                key={`${cat}-${expected}`}
                onClick={() => addDraft(cat, expected)}
                className="chip"
              >
                <Plus size={12} /> {label}
              </button>
            ))}
            <Link to="/carpets" className="ml-2 inline-flex items-center gap-1.5 rounded-xl border border-brand-200 bg-white px-3 py-1.5 text-xs font-bold text-brand-700 transition hover:border-brand-300 hover:text-brand-900 dark:border-white/10 dark:bg-white/5 dark:text-brand-300 dark:hover:text-brand-200">
              <Calendar size={12} /> Carpets board
            </Link>
          </div>
        </div>
      </div>

      {/* Edit row modal */}
      {editOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="card-pad w-full max-w-md space-y-4 rounded-3xl bg-white dark:bg-slate-900">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-black tracking-tight">Edit Row</h3>
              <button onClick={closeEdit} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5"><X size={18} /></button>
            </div>
            <label className="block">
              <span className="mb-1 block text-sm font-semibold text-slate-700 dark:text-slate-300">Category</span>
              <select className="input-base" value={editForm.category} onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}>
                {['car', 'taxi', 'midrange', 'lorry', 'exterior', 'motorcycle', 'bicycle', 'carpet', 'vacuum', 'engine', 'other'].map((cat) => (
                  <option key={cat} value={cat}>{CATEGORY_LABELS[cat] || cat}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-semibold text-slate-700 dark:text-slate-300">Plate / Item</span>
              <input className="input-base" value={editForm.item} onChange={(e) => setEditForm({ ...editForm, item: e.target.value.toUpperCase() })} />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-semibold text-slate-700 dark:text-slate-300">Washer</span>
              <select className="input-base" value={editForm.washer_id} onChange={(e) => setEditForm({ ...editForm, washer_id: e.target.value })}>
                <option value="">—</option>
                {employees.map((e) => <option key={e.id} value={e.id}>{e.name} ({e.abbreviation})</option>)}
              </select>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="mb-1 block text-sm font-semibold text-slate-700 dark:text-slate-300">Cash (Ksh)</span>
                <input type="number" min="0" className="input-base" value={editForm.cash} onChange={(e) => setEditForm({ ...editForm, cash: toNum(e.target.value) })} />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-semibold text-slate-700 dark:text-slate-300">M-Pesa (Ksh)</span>
                <input type="number" min="0" className="input-base" value={editForm.mpesa} onChange={(e) => setEditForm({ ...editForm, mpesa: toNum(e.target.value) })} />
              </label>
            </div>
            <label className="block">
              <span className="mb-1 block text-sm font-semibold text-slate-700 dark:text-slate-300">Payer Name</span>
              <input className="input-base" value={editForm.sender} onChange={(e) => setEditForm({ ...editForm, sender: e.target.value })} />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-semibold text-slate-700 dark:text-slate-300">Transaction ID</span>
              <input className="input-base" value={editForm.ref} onChange={(e) => setEditForm({ ...editForm, ref: e.target.value })} />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-semibold text-slate-700 dark:text-slate-300">Expected Price (Ksh)</span>
              <input type="number" min="0" className="input-base" value={editForm.expected} onChange={(e) => setEditForm({ ...editForm, expected: toNum(e.target.value) })} />
            </label>
            <div className="flex gap-2">
              <button onClick={saveEdit} className="btn-primary flex-1 justify-center bg-brand-600">
                Save Changes
              </button>
              <button onClick={closeEdit} className="btn-secondary flex-1 justify-center">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}



function RowCard({
  row, rowNumber, employees, isPlate, isOther, saving, error,
  smsOpen, smsText, onSmsText, onOpenSms, onFillSms, onPatch, onSaveDraft, onDelete,
  addonOpen, onToggleAddon, onSelectAddon, onRemoveAddon,
  onEdit, isDuplicate,
}: {
  row: SheetRow;
  rowNumber: number;
  employees: any[];
  isPlate: boolean;
  isOther: boolean;
  saving: boolean;
  error?: string;
  smsOpen: boolean;
  smsText: string;
  onSmsText: (v: string) => void;
  onOpenSms: () => void;
  onFillSms: () => void;
  onPatch: (patch: Partial<SheetRow>) => void;
  onSaveDraft: () => void;
  onDelete: () => void;
  addonOpen: boolean;
  onToggleAddon: () => void;
  onSelectAddon: (type: 'vacuum' | 'engine' | 'engine+vacuum') => void;
  onRemoveAddon: (type: 'vacuum' | 'engine') => void;
  onEdit: () => void;
  isDuplicate: boolean;
}) {
  const dirty = row.draft;
  return (
    <div
      className={`px-3 py-3 transition sm:px-4 ${
        isDuplicate ? 'bg-red-100 dark:bg-red-900/30' : dirty ? 'bg-amber-50/60 dark:bg-amber-400/5' : ''
      } ${error ? 'bg-red-50 dark:bg-red-500/5' : ''}`}
    >
      <div className="flex items-start gap-2">
        <span className="mt-2.5 w-5 shrink-0 text-center text-[11px] font-black text-slate-400">{rowNumber}</span>

        <div className="min-w-0 flex-1">
          {/* Item + category */}
          <div className="flex flex-wrap items-center gap-1.5">
            <input
              value={row.item}
              placeholder={isOther ? 'What was it?' : isPlate ? 'Plate e.g. KCA182M' : 'Details'}
              className={`input-base input-sm min-w-0 flex-1 font-mono uppercase sm:max-w-[220px] ${
                row.category === 'carpet' ? 'text-violet-600 dark:text-violet-300' : ''
              }`}
              onBlur={() => onPatch({ item: row.item.toUpperCase() })}
              onChange={(e) => onPatch({ item: e.target.value.toUpperCase() })}
              onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
            />
            <span className="chip chip-soft pointer-events-none">
              {CATEGORY_LABELS[row.category] || row.category}
            </span>
            {row.has_vacuum && (
              <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-700 dark:bg-blue-500/15 dark:text-blue-300">Vacuum</span>
            )}
            {row.has_engine_wash && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">Engine</span>
            )}
            {isDuplicate && (
              <span className="inline-flex items-center gap-1 rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-bold text-white">
                <AlertTriangle size={11} /> Duplicate?
              </span>
            )}
            {saving && <Loader2 size={14} className="animate-spin text-brand-500" />}
          </div>

          {/* Money + washer grid */}
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <label className="block">
              <span className="label">Washer</span>
              <select
                value={row.washer_id}
                onChange={(e) => onPatch({ washer_id: e.target.value })}
                className="input-base input-sm"
              >
                <option value="">—</option>
                {employees.length === 0 && <option value="" disabled>No staff loaded</option>}
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>{e.name || e.full_name} ({e.abbreviation})</option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="label">Cash</span>
              <input
                type="number" min="0" value={row.cash}
                className="input-base input-sm text-right font-mono"
                onBlur={(e) => onPatch({ cash: toNum(e.target.value) })}
                onChange={(e) => onPatch({ cash: toNum(e.target.value) })}
              />
            </label>

            <label className="block">
              <span className="label">M-Pesa</span>
              <div className="flex items-center gap-1">
                <input
                  type="number" min="0" value={row.mpesa}
                  className="input-base input-sm min-w-0 flex-1 text-right font-mono"
                  onBlur={(e) => onPatch({ mpesa: toNum(e.target.value) })}
                  onChange={(e) => onPatch({ mpesa: toNum(e.target.value) })}
                />
                <button
                  onClick={onOpenSms}
                  title="Paste M-Pesa message to fill amount & name"
                  aria-label="Paste M-Pesa message"
                  className={`flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-lg border transition sm:h-[34px] sm:w-[34px] ${
                    smsOpen
                      ? 'border-brand-500 bg-brand-50 text-brand-700 dark:border-brand-400/40 dark:bg-brand-500/20 dark:text-brand-300'
                      : 'border-slate-200 bg-white text-slate-400 hover:border-brand-300 hover:text-brand-600 dark:border-white/10 dark:bg-white/5 dark:hover:text-brand-300'
                  }`}
                >
                  <MessageSquareText size={15} />
                </button>
              </div>
            </label>

            <div className="block">
              <span className="label">Paid</span>
              <div className="flex min-h-[38px] items-center rounded-lg border border-slate-100 bg-slate-50 px-2.5 font-mono text-sm font-bold dark:border-white/5 dark:bg-white/5 sm:min-h-[34px]">
                {row.total_paid !== undefined ? (
                  <span className={row.shortfall ? 'text-red-600 dark:text-red-400' : 'text-slate-900 dark:text-white'}>
                    {`Ksh ${row.total_paid}`}
                    {row.shortfall ? (
                      <span className="ml-1 text-[10px] font-bold">short {row.shortfall}</span>
                    ) : null}
                  </span>
                ) : saving ? (
                  <Loader2 size={14} className="animate-spin text-brand-500" />
                ) : (
                  <span className="text-slate-300 dark:text-slate-600">—</span>
                )}
              </div>
            </div>
          </div>

          {/* Payer + add-ons + row actions */}
          <div className="mt-2 flex flex-wrap items-end gap-2">
            <label className="block min-w-0 flex-1 sm:max-w-[260px]">
              <span className="label">Payer name</span>
              <input
                value={row.sender}
                placeholder={row.mpesa > 0 ? 'Payer name' : '—'}
                className="input-base input-sm"
                onBlur={() => onPatch({ sender: row.sender })}
                onChange={(e) => onPatch({ sender: e.target.value })}
              />
            </label>

            {isPlate && (
              <div className="relative flex items-center gap-1">
                <button onClick={onToggleAddon} className="btn-secondary btn-sm">
                  <Plus size={13} /> Add-on
                </button>
                {addonOpen && (
                  <div className="absolute bottom-full right-0 z-30 mb-1 w-48 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-white/10 dark:bg-slate-800">
                    <button
                      onClick={() => onSelectAddon('vacuum')}
                      className="w-full border-b border-slate-100 px-3 py-2.5 text-left text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-white/5 dark:text-slate-300 dark:hover:bg-white/10"
                    >
                      Vacuum <span className="text-slate-400">+300</span>
                    </button>
                    <button
                      onClick={() => onSelectAddon('engine')}
                      className="w-full border-b border-slate-100 px-3 py-2.5 text-left text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-white/5 dark:text-slate-300 dark:hover:bg-white/10"
                    >
                      Engine wash <span className="text-slate-400">+300</span>
                    </button>
                    <button
                      onClick={() => onSelectAddon('engine+vacuum')}
                      className="w-full px-3 py-2.5 text-left text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-white/10"
                    >
                      Engine + Vacuum <span className="text-slate-400">+600</span>
                    </button>
                  </div>
                )}
                {row.has_vacuum && (
                  <button
                    onClick={() => onRemoveAddon('vacuum')}
                    className="rounded-full bg-blue-50 px-2 py-1 text-[10px] font-bold text-blue-600 hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-400"
                  >
                    ✕ Vacuum
                  </button>
                )}
                {row.has_engine_wash && (
                  <button
                    onClick={() => onRemoveAddon('engine')}
                    className="rounded-full bg-amber-50 px-2 py-1 text-[10px] font-bold text-amber-600 hover:bg-amber-100 dark:bg-amber-900/20 dark:text-amber-400"
                  >
                    ✕ Engine
                  </button>
                )}
              </div>
            )}

            <div className="ml-auto flex items-center gap-1">
              {dirty && !saving && (
                <button onClick={onSaveDraft} title="Save this row" className="btn-primary btn-sm">
                  <Check size={14} /> Save
                </button>
              )}
              <button onClick={onEdit} title="Edit this row" className="btn-secondary btn-sm">
                <Pencil size={14} /> Edit
              </button>
              <button
                onClick={onDelete}
                title="Delete row"
                aria-label="Delete row"
                className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10 dark:hover:text-red-300"
              >
                <Trash2 size={15} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {smsOpen && (
        <div className="mt-2 flex flex-col gap-2 rounded-xl border border-brand-200 bg-brand-50/60 p-2 dark:border-brand-400/20 dark:bg-brand-500/5 sm:flex-row sm:items-center">
          <textarea
            rows={2}
            autoFocus
            placeholder="Paste the M-Pesa/bank payment message here — amount and payer name fill in automatically…"
            className="input-base input-sm flex-1 resize-none font-mono"
            value={smsText}
            onChange={(e) => onSmsText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onFillSms(); } }}
          />
          <div className="flex gap-1.5">
            <button onClick={onFillSms} className="btn-primary btn-sm flex-1">
              <Check size={14} /> Fill
            </button>
            <button onClick={onOpenSms} className="btn-secondary btn-sm flex-1">Close</button>
          </div>
        </div>
      )}

      {error && (
        <p className="mt-2 inline-flex items-center gap-1.5 pl-7 text-xs font-semibold text-red-600 dark:text-red-400">
          <AlertTriangle size={13} /> {error}
        </p>
      )}
    </div>
  );
}
