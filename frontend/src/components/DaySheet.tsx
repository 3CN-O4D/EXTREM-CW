import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Check,
  Loader2,
  MessageSquareText,
  Plus,
  Pencil,
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

export default function DaySheet({ employees, selectedDay }: DaySheetProps) {
  const [rows, setRows] = useState<SheetRow[]>([]);
  const [carpetStats, setCarpetStats] = useState<any>(null);
  const [summary, setSummary] = useState<any>(null);
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

  const computeDuplicates = (rowsToCheck: SheetRow[]) => {
    const seen = new Map<string, string[]>();
    rowsToCheck.forEach((r) => {
      if (r.draft && !r.id) return; // skip unsaved drafts without server id
      const key = `${r.category}|${(r.item || '').toUpperCase()}`;
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
    try {
      const payload: any = {
        category: editForm.category,
        expected_price: editForm.expected,
        cash_paid: editForm.cash || 0,
        mpesa_paid: editForm.mpesa || 0,
        mpesa_transaction_id: editForm.ref || null,
        mpesa_sender_name: editForm.sender || null,
        manual_tip: 0,
        tip_method: 'cash',
        misc_amount: 0,
        misc_description: null,
        has_car_wash: PLATE_CATS.includes(editForm.category),
        has_vacuum: editForm.category === 'vacuum',
        has_engine_wash: editForm.category === 'engine',
        plate_number: PLATE_CATS.includes(editForm.category) ? editForm.item || null : null,
        custom_category: editForm.category === 'other' ? editForm.item || null : null,
        carpet_metadata: null,
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

  const [eodOpen, setEodOpen] = useState(false);

  const dayStr = format(selectedDay, 'yyyy-MM-dd');

  const reload = useCallback(async () => {
    const params = { day: format(selectedDay, 'yyyy-MM-dd') };
    try {
      const [txRes, sumRes, priceRes, carpetStatsRes] = await Promise.all([
        api.get('/transactions/', { params }),
        api.get('/stats/summary', { params }),
        api.get('/prices/'),
        // Stats only — never the carpet list/images. The full board lives on /carpets.
        api.get('/carpets/stats').catch(() => null),
      ]);
      setRows((prev) => {
        // Merge server rows with local drafts / just-saved rows by id, so a row
        // that was just POSTed keeps its local _key (no focus loss) and is never
        // duplicated. Subsequent keystrokes PUT to this id instead of POSTing.
        const serverRows: SheetRow[] = txRes.data.map(txToRow);
        const serverById = new Map<number, SheetRow>();
        for (const sr of serverRows) if (sr.id != null) serverById.set(sr.id, sr);

        const result: SheetRow[] = [];
        const seenIds = new Set<number>();

        for (const local of prev) {
          if (local.id != null && serverById.has(local.id)) {
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
      setSummary(sumRes.data);
      setCarpetStats(carpetStatsRes?.data ?? null);
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
    void reload();
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
      const payload: any = {
        ...(merged.washer_id && { washer_id: Number(merged.washer_id) }),
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
        carpet_metadata: null,
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

      {/* Live stats bar */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
        {[
          { label: 'Cash', value: `Ksh ${totals.cash}`, cls: 'text-emerald-600 dark:text-emerald-400' },
          { label: 'M-Pesa', value: `Ksh ${totals.mpesa}`, cls: 'text-brand-600 dark:text-brand-300' },
          { label: 'Total paid', value: `Ksh ${totals.paid}`, cls: 'text-slate-900 dark:text-white' },
          { label: 'Wages', value: `Ksh ${totals.wages}`, cls: ((totals.wages ?? 0) >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400') },
          { label: 'Shortfall', value: `Ksh ${shortfall0(totals.shortfall)}`, cls: 'text-red-600 dark:text-red-400' },
          { label: 'Jobs', value: `${rows.filter((r) => !r.draft).length}`, cls: 'text-slate-900 dark:text-white' },
          { label: 'Carpets in', value: `${carpetStats ? Number(carpetStats.received) + Number(carpetStats.washed) + Number(carpetStats.ready) : 0}`, cls: 'text-violet-600 dark:text-violet-300' },
          { label: 'Carpets ready', value: `${carpetStats?.ready ?? 0}`, cls: 'text-emerald-600 dark:text-emerald-400' },
          { label: 'Expenses', value: `Ksh ${summary?.total_expenses ?? 0}`, cls: 'text-red-600 dark:text-red-400' },
          { label: 'Net Cash', value: `Ksh ${(summary?.total_cash_received ?? 0) - (summary?.total_expenses ?? 0)}`, cls: ((summary?.total_cash_received ?? 0) - (summary?.total_expenses ?? 0)) >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400' },
          { label: 'Balance', value: `Ksh ${summary?.balance ?? 0}`, cls: (summary?.balance ?? 0) >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400' },
        ].map((s) => (
          <div key={s.label} className="card px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">{s.label}</p>
            <p className={`mt-1 truncate text-lg font-black ${s.cls}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Category chips */}
      <div className="flex flex-wrap gap-1.5">
        {Object.entries(totals.counts).length === 0 ? (
          <span className="muted text-xs">No jobs logged yet today.</span>
        ) : (
          Object.entries(totals.counts).map(([cat, n]) => (
            <span key={cat} className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-bold text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
              {CATEGORY_LABELS[cat] || cat}: {n}
            </span>
          ))
        )}
        {pendingDrafts > 0 && (
          <span className="rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-300">
            {pendingDrafts} unsaved {pendingDrafts === 1 ? 'row' : 'rows'}
          </span>
        )}
      </div>

      {/* Spreadsheet */}
      <div className="card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/80 px-5 py-3 dark:border-white/10">
          <div>
            <h2 className="text-lg font-black tracking-tight">Day Sheet — {format(selectedDay, 'EEEE, dd MMM yyyy')}</h2>
            <p className="muted text-xs">Edit any cell — changes are local. Tap Sync to save all pending rows.</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setEodOpen((v) => !v)} className="btn-secondary px-3 py-2 text-xs">
              <MessageSquareText size={14} /> Day summary
            </button>
            <button onClick={syncAll} disabled={savingAll} className="btn-primary px-3 py-2 text-xs">
              {savingAll ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              {pendingDrafts > 0 ? ` Sync (${pendingDrafts})` : 'Sync'}
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50 text-left dark:bg-white/5">
                <th className="border-b border-slate-200/70 px-2 py-2 text-center text-xs font-bold uppercase tracking-wider text-slate-500 dark:border-white/10 w-12">#</th>
                <th className="border-b border-slate-200/70 px-3 py-2 text-xs font-bold uppercase tracking-wider text-slate-500 dark:border-white/10">ITEM</th>
                <th className="border-b border-slate-200/70 px-3 py-2 text-xs font-bold uppercase tracking-wider text-slate-500 dark:border-white/10">WASHER</th>
                <th className="border-b border-slate-200/70 px-3 py-2 text-right text-xs font-bold uppercase tracking-wider text-slate-500 dark:border-white/10">CASH</th>
                <th className="border-b border-slate-200/70 px-3 py-2 text-right text-xs font-bold uppercase tracking-wider text-slate-500 dark:border-white/10">M-PESA</th>
                <th className="border-b border-slate-200/70 px-3 py-2 text-xs font-bold uppercase tracking-wider text-slate-500 dark:border-white/10">MPESA NAME</th>
                <th className="border-b border-slate-200/70 px-3 py-2 text-right text-xs font-bold uppercase tracking-wider text-slate-500 dark:border-white/10">PAYOUT</th>
                <th className="border-b border-slate-200/70 px-3 py-2 text-xs font-bold uppercase tracking-wider text-slate-500 dark:border-white/10">ADD-ONS</th>
                <th className="border-b border-slate-200/70 px-2 py-2 dark:border-white/10" />
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-5 py-12 text-center">
                    <p className="text-sm font-bold text-slate-500 dark:text-slate-400">No rows yet</p>
                    <p className="muted mt-1 text-xs">Use the buttons below the table to start logging the day.</p>
                  </td>
                </tr>
              )}
              {rows.map((row, idx) => {
                const saving = row.saving;
                const editingMpesa = smsOpen === row._key;
                const isPlate = PLATE_CATS.includes(row.category);
                const isOther = row.category === 'other';
                return (
                  <RowFragment
                    key={row._key}
                    row={row}
                    rowNumber={idx + 1}
                    employees={employees}
                    isPlate={isPlate}
                    isOther={isOther}
                    saving={!!saving}
                    error={row.error}
                    smsOpen={editingMpesa}
                    smsText={smsText}
                    onSmsText={setSmsText}
                    onOpenSms={() => { setSmsOpen(editingMpesa ? null : row._key); setSmsText(''); }}
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
                );
              })}
              {rows.length > 0 && (
                <tr className="bg-slate-50 font-bold dark:bg-white/5">
                  <td className="border-b border-slate-200/70 px-2 py-2 text-center text-slate-500 dark:border-white/10" colSpan={2}>
                    Totals
                  </td>
                  <td className="border-b border-slate-200/70 px-3 py-2 text-slate-500 dark:border-white/10">—</td>
                  <td className="border-b border-slate-200/70 px-3 py-2 text-right font-mono text-emerald-600 dark:border-white/10 dark:text-emerald-400">{totals.cash}</td>
                  <td className="border-b border-slate-200/70 px-3 py-2 text-right font-mono text-brand-600 dark:border-white/10 dark:text-brand-300">{totals.mpesa}</td>
                  <td className="border-b border-slate-200/70 px-3 py-2 text-slate-500 dark:border-white/10">—</td>
                  <td className="border-b border-slate-200/70 px-3 py-2 text-right font-mono text-slate-900 dark:border-white/10 dark:text-white">{totals.paid}</td>
                  <td className="border-b border-slate-200/70 px-2 py-2 dark:border-white/10" />
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Add-row toolbar */}
        <div className="flex flex-wrap items-center gap-1.5 border-t border-slate-200/80 bg-white px-4 py-3 dark:border-white/10 dark:bg-slate-900/60">
          <span className="mr-1 text-xs font-bold uppercase tracking-wider text-slate-400">Add row:</span>
          {[
            { cat: 'car', label: 'Car · 200', expected: 200 },
            { cat: 'taxi', label: 'Taxi · 150', expected: 150 },
            { cat: 'midrange', label: 'Mid · 300', expected: 300 },
            { cat: 'lorry', label: 'Lorry · 500', expected: 500 },
            { cat: 'exterior', label: `Exterior · ${prices.exterior?.min_price ?? 150}`, expected: Number(prices.exterior?.min_price ?? 150) },
            { cat: 'motorcycle', label: 'Bike · 70', expected: 70 },
            { cat: 'bicycle', label: 'Cycle · 50', expected: 50 },
            { cat: 'other', label: 'Other', expected: 0 },
            { cat: 'vacuum', label: 'Vacuum · 300', expected: 300 },
            { cat: 'vacuum', label: 'Vacuum · 200', expected: 200 },
            { cat: 'engine', label: 'Engine · 300', expected: 300 },
            { cat: 'engine', label: 'Engine · 200', expected: 200 },
          ].map(({ cat, label, expected }) => (
            <button
              key={`${cat}-${expected}`}
              onClick={() => addDraft(cat, expected)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-brand-300 hover:text-brand-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:text-white"
            >
              <Plus size={12} className="mr-1 inline" />{label}
            </button>
          ))}
        </div>
      </div>

      {/* Carpet stats only — the full board (photos, statuses, release) is on /carpets */}
      {carpetStats && (
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-200/80 px-5 py-3 dark:border-white/10">
            <div>
              <h3 className="text-sm font-black tracking-tight">Carpet stats</h3>
              <p className="muted text-xs">Counts only — open Carpets for photos, statuses and release.</p>
            </div>
            <Link to="/carpets" className="btn-secondary px-3 py-1.5 text-xs">Open Carpets</Link>
          </div>
          <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-4">
            {[
              { label: 'Received', value: carpetStats.received, cls: 'text-blue-600 dark:text-blue-400' },
              { label: 'Washed', value: carpetStats.washed, cls: 'text-amber-600 dark:text-amber-400' },
              { label: 'Ready', value: carpetStats.ready, cls: 'text-emerald-600 dark:text-emerald-400' },
              { label: 'Released', value: carpetStats.released, cls: 'text-slate-600 dark:text-slate-400' },
            ].map((s) => (
              <div key={s.label} className="rounded-xl border border-slate-200 px-3 py-2 dark:border-white/10">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{s.label}</p>
                <p className={`mt-0.5 text-lg font-black ${s.cls}`}>{s.value}</p>
              </div>
            ))}
          </div>
          {carpetStats.employees?.length > 0 && (
            <div className="border-t border-slate-200/80 px-4 py-3 dark:border-white/10">
              <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">How many each employee holds</p>
              <div className="flex flex-wrap gap-1.5">
                {carpetStats.employees.map((e: any) => {
                  const held = Number(e.received) + Number(e.washed) + Number(e.ready);
                  return (
                    <span key={e.id} className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
                      {e.full_name || e.name} <span className="font-black text-violet-600 dark:text-violet-300">{held}</span>
                      <span className="ml-1 text-[10px] text-slate-400">({e.received} in · {e.ready} ready)</span>
                    </span>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Day summary / end-of-day */}
      {eodOpen && summary && (
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-200/80 bg-gradient-to-r from-brand-500/10 to-cyan-500/10 px-5 py-4 dark:border-white/10">
            <div>
              <h3 className="text-lg font-black tracking-tight">End of day — {format(selectedDay, 'dd MMM yyyy')}</h3>
              <p className="muted text-xs">Wages are calculated from what is saved in the sheet.</p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => window.print()} className="btn-secondary px-3 py-1.5 text-xs">Print</button>
              <button onClick={() => setEodOpen(false)} className="rounded-xl p-2 text-slate-400 hover:bg-white/5"><X size={16} /></button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-px bg-slate-200 dark:bg-white/10 md:grid-cols-3">
            {[
              { label: 'Cash received', value: `Ksh ${summary.total_cash_received}`, cls: 'text-emerald-600' },
              { label: 'M-Pesa received', value: `Ksh ${totals.mpesa}`, cls: 'text-brand-600' },
              { label: 'Expenses', value: `Ksh ${summary.total_expenses}`, cls: 'text-red-600' },
              { label: 'Gross wages', value: `Ksh ${summary.total_labor_gross ?? summary.total_labor_expense}`, cls: 'text-violet-600' },
              { label: 'Shortfall withheld', value: `Ksh ${summary.total_shortfall_withheld ?? 0}`, cls: 'text-red-600' },
              { label: 'Net wages', value: `Ksh ${summary.net_labor_wages ?? summary.total_labor_expense}`, cls: 'text-violet-600' },
            ].map((s) => (
              <div key={s.label} className="bg-white p-4 dark:bg-slate-900">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{s.label}</p>
                <p className={`mt-1 text-xl font-black ${s.cls}`}>{s.value}</p>
              </div>
            ))}
          </div>
          <div className="p-4">
            <p className="mb-2 text-sm font-black">Wages by washer</p>
            {summary.labor_breakdown?.length ? (
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {summary.labor_breakdown.map((e: any) => (
                  <div key={e.abbreviation} className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2 dark:border-white/10">
                    <span className="text-sm font-semibold">{e.name} <span className="muted">({e.abbreviation})</span></span>
                    <span className="text-right font-mono text-sm font-black text-emerald-600 dark:text-emerald-400">
                      Ksh {e.wages}
                      {Number(e.shortfall) > 0 && (
                        <span className="block text-[11px] font-semibold text-red-500 dark:text-red-400">
                          {e.gross} − {e.shortfall}
                        </span>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="muted text-sm">No wages recorded yet.</p>
            )}
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-white/10 dark:bg-white/5">
              <span className="text-sm font-black">Business balance</span>
              <span className={`text-2xl font-black ${summary.balance >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                Ksh {summary.balance}
              </span>
            </div>
          </div>
        </div>
      )}

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

function shortfall0(v: number): number {
  return v || 0;
}

function RowFragment({
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
  const display = row.total_paid !== undefined ? `Ksh ${row.total_paid}` : '';
  return (
    <>
      <tr className={`group transition ${dirty ? 'bg-amber-50/60 dark:bg-amber-400/5' : ''} ${error ? 'bg-red-50 dark:bg-red-500/5' : ''} ${isDuplicate ? 'bg-red-100 dark:bg-red-900/30' : ''} ${!isDuplicate && !dirty && !error ? 'hover:bg-slate-50/70 dark:hover:bg-white/[0.03]' : ''}`}>
        <td className="border-b border-slate-200/70 px-2 py-1.5 text-center align-middle dark:border-white/10">
          {rowNumber}
        </td>
        <td className="border-b border-slate-200/70 px-2 py-1.5 dark:border-white/10">
          <div className="flex items-center gap-1.5">
            <input
              value={row.item}
              placeholder={isOther ? 'What was it?' : isPlate ? 'Plate e.g. KCA182M' : 'Details'}
              className={`input-base w-36 px-2 py-1 text-xs font-mono uppercase ${row.category === 'carpet' ? 'text-violet-600 dark:text-violet-300' : ''}`}
              onBlur={() => onPatch({ item: row.item.toUpperCase() })}
              onChange={(e) => onPatch({ item: e.target.value.toUpperCase() })}
              onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
            />
            <span className="hidden rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold capitalize text-slate-500 sm:inline dark:bg-white/5 dark:text-slate-400">
              {CATEGORY_LABELS[row.category] || row.category}
            </span>
            {row.has_vacuum && (
              <span className="ml-1 inline rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] font-bold text-blue-700 dark:bg-blue-500/15 dark:text-blue-300">⚪ Vacuum</span>
            )}
            {row.has_engine_wash && (
              <span className="ml-1 inline rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">⚙️ Engine</span>
            )}
          </div>
        </td>
        <td className="border-b border-slate-200/70 px-2 py-1.5 dark:border-white/10">
          <select
            value={row.washer_id}
            onChange={(e) => onPatch({ washer_id: e.target.value })}
            className="input-base w-32 px-2 py-1 text-xs"
          >
            <option value="">—</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>{e.name} ({e.abbreviation})</option>
            ))}
          </select>
        </td>
        <td className="border-b border-slate-200/70 px-2 py-1.5 text-right dark:border-white/10">
          <input
            type="number" min="0" value={row.cash}
            className="input-base w-20 px-2 py-1 text-right font-mono text-xs"
            onBlur={(e) => onPatch({ cash: toNum(e.target.value) })}
            onChange={(e) => onPatch({ cash: toNum(e.target.value) })}
          />
        </td>
        <td className="border-b border-slate-200/70 px-2 py-1.5 text-right dark:border-white/10">
          <div className="flex items-center justify-end gap-1">
            <input
              type="number" min="0" value={row.mpesa}
              className="input-base w-20 px-2 py-1 text-right font-mono text-xs"
              onBlur={(e) => onPatch({ mpesa: toNum(e.target.value) })}
              onChange={(e) => onPatch({ mpesa: toNum(e.target.value) })}
            />
            <button
              onClick={onOpenSms}
              title="Paste M-Pesa message to fill amount & name"
              className={`rounded-lg p-1.5 transition ${smsOpen ? 'bg-brand-100 text-brand-700 dark:bg-brand-500/20 dark:text-brand-300' : 'text-slate-400 hover:bg-brand-50 hover:text-brand-600 dark:hover:bg-brand-500/10'}`}
            >
              <MessageSquareText size={14} />
            </button>
          </div>
        </td>
        <td className="border-b border-slate-200/70 px-2 py-1.5 dark:border-white/10">
          <input
            value={row.sender}
            placeholder={row.mpesa > 0 ? 'Payer name' : '—'}
            className="input-base w-36 px-2 py-1 text-xs"
            onBlur={() => onPatch({ sender: row.sender })}
            onChange={(e) => onPatch({ sender: e.target.value })}
          />
        </td>
        <td className="border-b border-slate-200/70 px-2 py-1.5 text-right font-mono text-xs dark:border-white/10">
          {row.total_paid !== undefined ? (
            <span className={row.shortfall ? 'text-red-600 dark:text-red-400' : 'text-slate-900 dark:text-white'}>
              {display}{row.shortfall ? <span className="block text-[10px] font-bold">short {row.shortfall}</span> : null}
            </span>
          ) : saving ? (
            <Loader2 size={14} className="ml-auto animate-spin text-brand-500" />
          ) : (
            <span className="text-slate-300 dark:text-slate-600">—</span>
          )}
        </td>
        <td className="border-b border-slate-200/70 px-3 py-1.5 text-right dark:border-white/10">
          {isPlate && (
            <div className="flex items-center justify-end gap-1">
              {addonOpen ? (
                <div className="flex flex-col items-end gap-1">
                  <button onClick={onToggleAddon} className="rounded-lg p-1.5 text-violet-600 hover:bg-violet-50 dark:text-violet-400 dark:hover:bg-violet-500/10">
                    <Plus size={13} />
                  </button>
                  <div className="absolute right-0 mt-1 w-32 rounded-lg border border-slate-200 bg-white shadow-lg dark:border-white/10 dark:bg-slate-800 z-20">
                    <button
                      onClick={() => onSelectAddon('vacuum')}
                      className="w-full text-left px-2 py-1.5 text-xs text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-white/10 border-b border-slate-100 dark:border-white/5 last:border-0"
                    >
                      Vacuum (+Ksh 300)
                    </button>
                    <button
                      onClick={() => onSelectAddon('engine')}
                      className="w-full text-left px-2 py-1.5 text-xs text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-white/10 border-b border-slate-100 dark:border-white/5 last:border-0"
                    >
                      Engine (+Ksh 300)
                    </button>
                    <button
                      onClick={() => onSelectAddon('engine+vacuum')}
                      className="w-full text-left px-2 py-1.5 text-xs text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-white/10"
                    >
                      Engine + Vacuum (+Ksh 600)
                    </button>
                  </div>
                </div>
              ) : (
                <button onClick={onToggleAddon} className="rounded-lg p-1.5 text-violet-600 hover:bg-violet-50 dark:text-violet-400 dark:hover:bg-violet-500/10">
                  <Plus size={13} />
                </button>
              )}
              {(row.has_vacuum || row.has_engine_wash) && (
                <div className="flex items-center gap-1 ml-1">
                  {row.has_vacuum && (
                    <button onClick={() => onRemoveAddon('vacuum')} className="rounded px-1 py-0.5 text-[10px] text-blue-600 bg-blue-50 hover:bg-blue-100 dark:text-blue-400 dark:bg-blue-900/20">
                      ✕ Vacuum
                    </button>
                  )}
                  {row.has_engine_wash && (
                    <button onClick={() => onRemoveAddon('engine')} className="rounded px-1 py-0.5 text-[10px] text-amber-600 bg-amber-50 hover:bg-amber-100 dark:text-amber-400 dark:bg-amber-900/20">
                      ✕ Engine
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </td>
        <td className="border-b border-slate-200/70 px-2 py-1.5 text-right dark:border-white/10">
          <div className="flex items-center justify-end gap-1">
            {!saving && (
              <button onClick={onSaveDraft} title="Save this row" className="rounded-lg bg-brand-600 p-1.5 text-white transition hover:bg-brand-700">
                <Check size={13} />
              </button>
            )}
            <button onClick={onEdit} title="Edit this row" className="rounded-lg bg-indigo-600 p-1.5 text-white transition hover:bg-indigo-700">
              <Pencil size={13} />
            </button>
            <button onClick={onDelete} title="Delete row" className="rounded-lg p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10 dark:hover:text-red-300">
              <Trash2 size={14} />
            </button>
          </div>
        </td>
      </tr>
      {smsOpen && (
        <tr className="bg-brand-50/60 dark:bg-brand-500/5">
          <td colSpan={8} className="px-3 py-2">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <textarea
                rows={1}
                autoFocus
                placeholder="Paste the M-Pesa/bank payment message here — amount and payer name fill in automatically…"
                className="input-base flex-1 resize-none font-mono text-xs"
                value={smsText}
                onChange={(e) => onSmsText(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onFillSms(); } }}
              />
              <div className="flex gap-1.5">
                <button onClick={onFillSms} className="btn-primary px-3 py-1.5 text-xs">
                  <Check size={13} /> Fill
                </button>
                <button onClick={onOpenSms} className="btn-secondary px-3 py-1.5 text-xs">Close</button>
              </div>
            </div>
          </td>
        </tr>
      )}
      {error && (
        <tr>
          <td colSpan={8} className="px-3 py-1.5">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-600 dark:text-red-400">
              <AlertTriangle size={13} /> {error}
            </span>
          </td>
        </tr>
      )}
    </>
  );
}
