import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Calendar,
  Check,
  Image as ImageIcon,
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
import { compressVariants } from '../utils/image';
import { InlineError } from './States';

export interface DaySheetProps {
  employees: any[];
  selectedDay: Date;
  mode?: 'day' | 'week';
  weekId?: string;
  onOpenSummary?: () => void;
  onDataChanged?: () => void;
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
  custom_category?: string | null;
  carpet_characteristics?: string | null;
};
function nowHHmm(): string {
  return format(new Date(), 'HH:mm');
}

const toNum = (v: any) => {
  const n = parseFloat(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

const isCarpetItem = (v?: string | null) => (v || '').trim().toUpperCase().startsWith('CARPET');

// An "Other" row whose item reads CARPET is an untracked carpet: it is priced
// and counted as a carpet, but it never enters the tracked carpets board.
function normalizeCategory(cat: string, item?: string | null): string {
  return cat === 'other' && isCarpetItem(item) ? 'carpet' : cat;
}

function txToRow(tx: any): SheetRow {
  const item = tx.category === 'carpet'
    ? (tx.carpet_characteristics || tx.custom_category || 'Carpet')
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
    custom_category: tx.custom_category || null,
    carpet_characteristics: tx.carpet_characteristics || null,
  };
}

export default function DaySheet({ employees, selectedDay, mode = 'day', weekId, onOpenSummary, onDataChanged }: DaySheetProps) {
  const [rows, setRows] = useState<SheetRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [savingAll, setSavingAll] = useState(false);
  const [prices, setPrices] = useState<Record<string, any>>({});
  // drafts & popovers
  const [smsOpen, setSmsOpen] = useState<string | null>(null);
  const [smsText, setSmsText] = useState('');
  const [editOpen, setEditOpen] = useState<SheetRow | null>(null);
  const [editForm, setEditForm] = useState<any>({});

  // Carpet receive / release flows launched from the add-row toolbar.
  const [releaseOpen, setReleaseOpen] = useState(false);
  const [carpetList, setCarpetList] = useState<any[]>([]);
  const [selectedCarpetId, setSelectedCarpetId] = useState('');
  const [releaseCash, setReleaseCash] = useState('');
  const [releaseMpesa, setReleaseMpesa] = useState('');
  const [releaseWasher, setReleaseWasher] = useState('');
  const [releaseBusy, setReleaseBusy] = useState(false);
  const [receiveOpen, setReceiveOpen] = useState(false);
  const [receiveBusy, setReceiveBusy] = useState(false);
  const [receiveCompressing, setReceiveCompressing] = useState(false);
  const [receiveError, setReceiveError] = useState('');
  const [receive, setReceive] = useState({
    image: '', thumb: '', characteristics: '', client_name: '', customer_phone: '', receiver_id: '', expected_price: '',
  });

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

  // Apply an add-on change locally and, when the row already exists on the
  // server, persist it right away so add-ons always stick.
  const applyAddon = (key: string, patch: Partial<SheetRow>) => {
    setRows((prev) => prev.map((r) => (r._key === key ? { ...r, ...patch, draft: true } : r)));
    const existing = rows.find((r) => r._key === key);
    if (existing?.id != null) flushSave(key, patch);
  };

  // Flip one add-on on/off while keeping the other, then re-price the row from
  // its category + new flags.
  const toggleAddonFlag = (key: string, type: 'vacuum' | 'engine') => {
    const row = rows.find((r) => r._key === key);
    if (!row) return;
    const hasVac = type === 'vacuum' ? !row.has_vacuum : !!row.has_vacuum;
    const hasEng = type === 'engine' ? !row.has_engine_wash : !!row.has_engine_wash;
    let expected = row.expected || 0;
    if (row.category === 'car') {
      expected = 200 + (hasVac ? 300 : 0) + (hasEng ? 300 : 0);
      if (hasVac && hasEng) expected = 800; // full package
    } else if (PLATE_CATS.includes(row.category)) {
      expected = STANDARD[row.category] + (hasVac ? 300 : 0) + (hasEng ? 300 : 0);
    }
    applyAddon(key, { has_vacuum: hasVac, has_engine_wash: hasEng, expected });
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
      has_vacuum: !!row.has_vacuum,
      has_engine_wash: !!row.has_engine_wash,
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
    const rawCat = editForm.category || 'car';
    const item = editForm.item || '';
    const cat = normalizeCategory(rawCat, item);
    const untrackedCarpet = cat === 'carpet' && !editOpen.carpet_characteristics;
    const expected = Number(editForm.expected) || (cat !== rawCat ? STANDARD[cat] || 0 : 0);
    const hasVac = !!(editForm.has_vacuum || cat === 'vacuum');
    const hasEng = !!(editForm.has_engine_wash || cat === 'engine');
    try {
      const payload: any = {
        ...(washerId ? { washer_id: washerId } : {}),
        category: cat,
        expected_price: expected,
        cash_paid: editForm.cash || 0,
        mpesa_paid: editForm.mpesa || 0,
        mpesa_transaction_id: editForm.ref || null,
        mpesa_sender_name: editForm.sender || null,
        manual_tip: 0,
        tip_method: 'cash',
        misc_amount: 0,
        misc_description: null,
        has_car_wash: PLATE_CATS.includes(cat),
        has_vacuum: hasVac,
        has_engine_wash: hasEng,
        plate_number: PLATE_CATS.includes(cat) ? item || null : null,
        custom_category: cat === 'other'
          ? item || null
          : untrackedCarpet
            ? item || editOpen.custom_category || 'CARPET'
            : null,
      };
      if (editOpen.id) {
        await api.put(`/transactions/${editOpen.id}`, payload);
      } else {
        await api.post('/transactions/', payload);
      }
      closeEdit();
      // Pull the authoritative recalculated row + totals back from the server.
      await reload({ fresh: true });
      onDataChanged?.();
    } catch (err: any) {
      alert(err?.response?.data?.detail || 'Save failed');
    }
  };

  const dayStr = format(selectedDay, 'yyyy-MM-dd');
  const periodKey = mode === 'week' ? `week:${weekId ?? ''}` : `day:${dayStr}`;

  const reload = useCallback(async (opts: { fresh?: boolean; keepDrafts?: boolean } = {}) => {
    const params = mode === 'week' && weekId
      ? { week_id: weekId }
      : { day: format(selectedDay, 'yyyy-MM-dd') };
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
  }, [periodKey]);

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
      const rawCat = merged.category || 'car';
      const cat = normalizeCategory(rawCat, merged.item);
      const untrackedCarpet = cat === 'carpet' && !merged.carpet_characteristics;
      const expected = merged.expected || STANDARD[cat] || (merged.cash || 0) + (merged.mpesa || 0);
      const washerId = merged.washer_id == null || merged.washer_id === '' ? null : Number(merged.washer_id);
      const customCategory = cat === 'other'
        ? merged.item || null
        : untrackedCarpet
          ? merged.item || merged.custom_category || 'CARPET'
          : null;
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
        custom_category: customCategory,
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
            prev.map((r) =>
              r._key === key
                ? { ...r, id: newId, draft: false, saving: false, category: cat, custom_category: customCategory }
                : r,
            ),
          );
        } else {
          // Existing row was updated via PUT. Mark as saved.
          setRows((prev) =>
            prev.map((r) =>
              r._key === key
                ? { ...r, draft: false, saving: false, category: cat, custom_category: customCategory }
                : r,
            ),
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
      persistRow(key, patch)
        .then(() => onDataChanged?.())
        .catch((err: any) => {
          setRows((prev) =>
            prev.map((r) =>
              r._key === key
                ? { ...r, saving: false, error: err?.response?.data?.detail || 'Save failed' }
                : r,
            ),
          );
        });
    },
    [persistRow, onDataChanged],
  );

  const patchRow = (key: string, patch: Partial<SheetRow>) => {
    setRows((r) =>
      r.map((x) => {
        if (x._key !== key) return x;
        const updated = { ...x, ...patch };
        // Typing CARPET in an "Other" row turns it into an untracked carpet.
        if (updated.category === 'other' && isCarpetItem(updated.item)) {
          updated.category = 'carpet';
          updated.custom_category = updated.item;
          if (!updated.expected) {
            updated.expected = Number(prices.carpet?.max_price ?? STANDARD.carpet ?? 300);
          }
        }
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
      onDataChanged?.();
    } catch (err: any) {
      alert(err?.response?.data?.detail || 'Could not delete the row');
    }
  };

  const saveDraftNow = (key: string) => {
    const row = rows.find((r) => r._key === key);
    if (!row) return;
    flushSave(key, {});
  };

  const syncAll = async () => {
    const drafts = rows.filter((r) => r.draft);
    if (drafts.length === 0) {
      await reload();
      return;
    }
    setSavingAll(true);
    try {
      await Promise.all(drafts.map((d) => persistRow(d._key, {})));
      await reload();
      onDataChanged?.();
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

  // ---------- Carpets: receive / release from the add-row toolbar ----------

  const openRelease = async () => {
    setSelectedCarpetId('');
    setReleaseCash('');
    setReleaseMpesa('');
    setReleaseWasher('');
    try {
      const res = await api.get('/carpets/', { skipCache: true });
      setCarpetList((res.data || []).filter((c: any) => c.status !== 'released'));
    } catch {
      setCarpetList([]);
    }
    setReleaseOpen(true);
  };

  const selectedCarpet = carpetList.find((c) => String(c.id) === String(selectedCarpetId)) || null;

  const chooseCarpet = (id: string) => {
    setSelectedCarpetId(id);
    const c = carpetList.find((x) => String(x.id) === String(id));
    if (c) {
      setReleaseCash(String(c.expected_price ?? ''));
      setReleaseMpesa('');
      setReleaseWasher(c.receiver_id ? String(c.receiver_id) : '');
    }
  };

  const submitReleaseCarpet = async () => {
    if (!selectedCarpet) {
      alert('Pick the carpet being released first');
      return;
    }
    setReleaseBusy(true);
    try {
      await api.post(`/carpets/${selectedCarpet.id}/release`, {
        cash_paid: toNum(releaseCash),
        mpesa_paid: toNum(releaseMpesa),
        washer_id: releaseWasher ? Number(releaseWasher) : null,
      });
      setReleaseOpen(false);
      await reload({ fresh: true });
      onDataChanged?.();
    } catch (err: any) {
      alert(err?.response?.data?.detail || 'Could not release the carpet');
    } finally {
      setReleaseBusy(false);
    }
  };

  const submitReceiveCarpet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!receive.image) {
      alert('A photo of the carpet is required on arrival');
      return;
    }
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
      setReceiveOpen(false);
      setReceive({ image: '', thumb: '', characteristics: '', client_name: '', customer_phone: '', receiver_id: '', expected_price: '' });
      onDataChanged?.();
    } catch (err: any) {
      setReceiveError(err?.response?.data?.detail || 'Could not save the carpet — your photo is kept, tap Save again to retry.');
    } finally {
      setReceiveBusy(false);
    }
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
          {isFutureDay && mode === 'day' ? (
            <>
              <Calendar size={20} />
              <span>No activity yet — {format(selectedDay, 'EEEE dd MMM yyyy')} hasn't arrived.</span>
            </>
          ) : (
            <>
              <AlertCircle size={20} />
              <span>
                {mode === 'week'
                  ? 'No transactions recorded for this week yet.'
                  : `No transactions recorded for ${format(selectedDay, 'EEEE dd MMM yyyy')} yet.`}
              </span>
            </>
          )}
        </div>
      )}

      {/* Category chips */}
      <div className="flex flex-wrap gap-1.5">
        {Object.entries(totals.counts).length === 0 ? (
          <span className="muted text-xs">{mode === 'week' ? 'No jobs logged this week.' : 'No jobs logged yet today.'}</span>
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
              {mode === 'week'
                ? `Week sheet — combined transactions`
                : `Day sheet — ${format(selectedDay, 'EEEE, dd MMM yyyy')}`}
            </h2>
            <p className="muted text-xs">
              {mode === 'week'
                ? 'Every transaction in the selected week, combined. Edits save straight to the server.'
                : 'Edit inline. Tap the tick on a row to save it, or Sync to save every pending row.'}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {onOpenSummary && (
              <button onClick={onOpenSummary} className="btn-secondary btn-sm">
                <MessageSquareText size={14} /> {mode === 'week' ? 'Week summary' : 'Day summary'}
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

        {rows.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <p className="text-sm font-bold text-slate-500 dark:text-slate-400">No rows yet</p>
            <p className="muted mt-1 text-xs">Use the add-row chips below to start logging the day.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1080px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200/80 bg-slate-50/80 text-[10px] font-extrabold uppercase tracking-[0.12em] text-slate-400 whitespace-nowrap dark:border-white/10 dark:bg-white/5">
                  <th className="w-8 px-2 py-2 text-center">#</th>
                  <th className="w-14 px-2 py-2">Time</th>
                  <th className="min-w-[170px] px-2 py-2">Item / plate</th>
                  <th className="w-24 px-2 py-2">Type</th>
                  <th className="w-36 px-2 py-2">Washer</th>
                  <th className="w-24 px-2 py-2 text-right">Cash</th>
                  <th className="w-32 px-2 py-2 text-right">M-Pesa</th>
                  <th className="w-36 px-2 py-2">Payer</th>
                  <th className="w-24 px-2 py-2 text-right">Paid</th>
                  <th className="w-24 px-2 py-2">Add-ons</th>
                  <th className="w-28 px-2 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => (
                  <RowLine
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
                    onToggleAddonFlag={(type: 'vacuum' | 'engine') => toggleAddonFlag(row._key, type)}
                    onEdit={() => openEdit(row)}
                    isDuplicate={duplicates.has(row._key)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}

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
            <button
              onClick={() => {
                setReceive({
                  image: '', thumb: '', characteristics: '', client_name: '', customer_phone: '',
                  receiver_id: '', expected_price: String(prices.carpet?.min_price ?? 300),
                });
                setReceiveError('');
                setReceiveOpen(true);
              }}
              className="chip border-violet-300 bg-violet-50 text-violet-700 dark:border-violet-400/30 dark:bg-violet-500/10 dark:text-violet-300"
            >
              <Plus size={12} /> Receive carpet
            </button>
            <button
              onClick={() => void openRelease()}
              className="chip border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-400/30 dark:bg-blue-500/10 dark:text-blue-300"
            >
              <Calendar size={12} /> Release carpet
            </button>
            <Link to="/carpets" className="ml-2 inline-flex items-center gap-1.5 rounded-xl border border-brand-200 bg-white px-3 py-1.5 text-xs font-bold text-brand-700 transition hover:border-brand-300 hover:text-brand-900 dark:border-white/10 dark:bg-white/5 dark:text-brand-300 dark:hover:text-brand-200">
              <Calendar size={12} /> Carpets board
            </Link>
          </div>
        </div>
      </div>

      {/* Edit row modal */}
      {editOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="card-pad max-h-[90vh] w-full max-w-md space-y-4 overflow-y-auto overscroll-contain rounded-3xl bg-white dark:bg-slate-900">
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
            {PLATE_CATS.includes(editForm.category) && (
              <div className="flex flex-wrap gap-4 rounded-xl bg-slate-50 px-3 py-2 dark:bg-white/5">
                <label className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={!!editForm.has_vacuum}
                    onChange={(e) => setEditForm({ ...editForm, has_vacuum: e.target.checked })}
                  />
                  Vacuum <span className="text-xs font-normal text-slate-400">+300</span>
                </label>
                <label className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={!!editForm.has_engine_wash}
                    onChange={(e) => setEditForm({ ...editForm, has_engine_wash: e.target.checked })}
                  />
                  Engine wash <span className="text-xs font-normal text-slate-400">+300</span>
                </label>
              </div>
            )}
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

      {/* Release carpet modal */}
      {releaseOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="card-pad max-h-[90vh] w-full max-w-md space-y-4 overflow-y-auto overscroll-contain rounded-3xl bg-white dark:bg-slate-900">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-black tracking-tight">Release a carpet</h3>
              <button onClick={() => setReleaseOpen(false)} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5"><X size={18} /></button>
            </div>
            <label className="block">
              <span className="mb-1 block text-sm font-semibold text-slate-700 dark:text-slate-300">Which carpet is being collected?</span>
              <select className="input-base" value={selectedCarpetId} onChange={(e) => chooseCarpet(e.target.value)}>
                <option value="">Choose a carpet…</option>
                {carpetList.map((c) => (
                  <option key={c.id} value={c.id}>
                    #{c.id} · {c.characteristics || 'Carpet'} · {c.status}{c.client_name ? ` · ${c.client_name}` : ''}
                  </option>
                ))}
              </select>
            </label>
            {carpetList.length === 0 && (
              <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
                Nothing to release right now — receive a carpet first.
              </p>
            )}
            {selectedCarpet && (
              <div className="flex gap-3 rounded-xl bg-slate-50 p-2 dark:bg-white/5">
                <div className="h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-slate-200 dark:bg-white/10">
                  {selectedCarpet.image_thumb ? (
                    <img src={selectedCarpet.image_thumb} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center text-slate-400"><ImageIcon size={22} /></span>
                  )}
                </div>
                <div className="min-w-0 text-xs text-slate-600 dark:text-slate-300">
                  <p className="font-bold text-slate-900 dark:text-white">{selectedCarpet.characteristics || 'Carpet'}</p>
                  <p>Client: {selectedCarpet.client_name || '—'}</p>
                  <p>Status: <span className="font-semibold capitalize">{selectedCarpet.status}</span></p>
                  <p>Price: Ksh {selectedCarpet.expected_price ?? 0}</p>
                </div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="mb-1 block text-sm font-semibold text-slate-700 dark:text-slate-300">Cash (Ksh)</span>
                <input type="number" min="0" className="input-base" value={releaseCash} onChange={(e) => setReleaseCash(e.target.value)} />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-semibold text-slate-700 dark:text-slate-300">M-Pesa (Ksh)</span>
                <input type="number" min="0" className="input-base" value={releaseMpesa} onChange={(e) => setReleaseMpesa(e.target.value)} />
              </label>
            </div>
            <label className="block">
              <span className="mb-1 block text-sm font-semibold text-slate-700 dark:text-slate-300">Washer</span>
              <select className="input-base" value={releaseWasher} onChange={(e) => setReleaseWasher(e.target.value)}>
                <option value="">Use the receiver</option>
                {employees.map((e) => <option key={e.id} value={e.id}>{e.name || e.abbreviation}</option>)}
              </select>
            </label>
            <div className="flex gap-2">
              <button onClick={submitReleaseCarpet} disabled={releaseBusy || !selectedCarpet} className="btn-primary flex-1 justify-center">
                {releaseBusy && <Loader2 size={15} className="animate-spin" />} Release carpet
              </button>
              <button onClick={() => setReleaseOpen(false)} className="btn-secondary flex-1 justify-center">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Receive carpet modal */}
      {receiveOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <form onSubmit={submitReceiveCarpet} className="card-pad max-h-[90vh] w-full max-w-md space-y-4 overflow-y-auto overscroll-contain rounded-3xl bg-white dark:bg-slate-900">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-black tracking-tight">Receive a carpet</h3>
              <button type="button" onClick={() => setReceiveOpen(false)} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5"><X size={18} /></button>
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
                  onChange={(e) => setReceive({ ...receive, expected_price: e.target.value })} />
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
                  {employees.map((e) => <option key={e.id} value={e.id}>{e.name || e.abbreviation}</option>)}
                </select>
              </label>
            </div>
            {receiveError && <p className="text-xs font-semibold text-red-600 dark:text-red-400">{receiveError}</p>}
            <div className="flex gap-2">
              <button type="submit" disabled={receiveBusy} className="btn-primary flex-1 justify-center">
                {receiveBusy && <Loader2 size={15} className="animate-spin" />} Save carpet
              </button>
              <button type="button" onClick={() => setReceiveOpen(false)} className="btn-secondary flex-1 justify-center">Cancel</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}



function RowLine({
  row, rowNumber, employees, isPlate, isOther, saving, error,
  smsOpen, smsText, onSmsText, onOpenSms, onFillSms, onPatch, onSaveDraft, onDelete,
  onToggleAddonFlag,
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
  onToggleAddonFlag: (type: 'vacuum' | 'engine') => void;
  onEdit: () => void;
  isDuplicate: boolean;
}) {
  const dirty = row.draft;
  const cell = 'border-b border-slate-100 px-2 py-1.5 align-middle dark:border-white/5';
  return (
    <>
      <tr
        className={
          isDuplicate
            ? 'bg-red-100 dark:bg-red-900/30'
            : error
              ? 'bg-red-50 dark:bg-red-500/5'
              : dirty
                ? 'bg-amber-50/60 dark:bg-amber-400/5'
                : ''
        }
      >
        <td className={`${cell} text-center text-[11px] font-black text-slate-400`}>{rowNumber}</td>
        <td className={`${cell} whitespace-nowrap font-mono text-[11px] text-slate-400`}>{row.time}</td>
        <td className={cell}>
          <div className="flex items-center gap-1.5">
            <input
              value={row.item}
              placeholder={isOther ? 'What was it?' : isPlate ? 'Plate e.g. KCA182M' : 'Details'}
              className={`input-base input-sm w-full min-w-[140px] font-mono uppercase ${
                row.category === 'carpet' ? 'text-violet-600 dark:text-violet-300' : ''
              }`}
              onBlur={() => onPatch({ item: row.item.toUpperCase() })}
              onChange={(e) => onPatch({ item: e.target.value.toUpperCase() })}
              onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
            />
            {isDuplicate && (
              <span
                title="Possible duplicate"
                className="inline-flex shrink-0 items-center gap-1 rounded-full bg-red-600 px-1.5 py-0.5 text-[10px] font-bold text-white"
              >
                <AlertTriangle size={10} /> Dup
              </span>
            )}
            {saving && <Loader2 size={13} className="shrink-0 animate-spin text-brand-500" />}
          </div>
        </td>
        <td className={`${cell} whitespace-nowrap`}>
          <span className="chip chip-soft pointer-events-none">
            {CATEGORY_LABELS[row.category] || row.category}
          </span>
        </td>
        <td className={cell}>
          <select
            value={row.washer_id}
            onChange={(e) => onPatch({ washer_id: e.target.value })}
            className="input-base input-sm w-full min-w-[120px]"
          >
            <option value="">—</option>
            {employees.length === 0 && <option value="" disabled>No staff loaded</option>}
            {employees.map((e) => (
              <option key={e.id} value={e.id}>{e.name || e.full_name} ({e.abbreviation})</option>
            ))}
          </select>
        </td>
        <td className={cell}>
          <input
            type="number" min="0" value={row.cash}
            className="input-base input-sm w-full min-w-[70px] text-right font-mono"
            onBlur={(e) => onPatch({ cash: toNum(e.target.value) })}
            onChange={(e) => onPatch({ cash: toNum(e.target.value) })}
          />
        </td>
        <td className={cell}>
          <div className="flex items-center justify-end gap-1">
            <input
              type="number" min="0" value={row.mpesa}
              className="input-base input-sm w-full min-w-[80px] text-right font-mono"
              onBlur={(e) => onPatch({ mpesa: toNum(e.target.value) })}
              onChange={(e) => onPatch({ mpesa: toNum(e.target.value) })}
            />
            <button
              onClick={onOpenSms}
              title="Paste M-Pesa message to fill amount & name"
              aria-label="Paste M-Pesa message"
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition ${
                smsOpen
                  ? 'border-brand-500 bg-brand-50 text-brand-700 dark:border-brand-400/40 dark:bg-brand-500/20 dark:text-brand-300'
                  : 'border-slate-200 bg-white text-slate-400 hover:border-brand-300 hover:text-brand-600 dark:border-white/10 dark:bg-white/5 dark:hover:text-brand-300'
              }`}
            >
              <MessageSquareText size={15} />
            </button>
          </div>
        </td>
        <td className={cell}>
          <input
            value={row.sender}
            placeholder={row.mpesa > 0 ? 'Payer name' : '—'}
            className="input-base input-sm w-full min-w-[110px]"
            onBlur={() => onPatch({ sender: row.sender })}
            onChange={(e) => onPatch({ sender: e.target.value })}
          />
        </td>
        <td className={`${cell} whitespace-nowrap text-right font-mono text-xs font-bold`}>
          {row.total_paid !== undefined ? (
            <span className={row.shortfall ? 'text-red-600 dark:text-red-400' : 'text-slate-900 dark:text-white'}>
              {row.total_paid}
              {row.shortfall ? <span className="ml-1 text-[10px] font-bold">short {row.shortfall}</span> : null}
            </span>
          ) : saving ? (
            <Loader2 size={13} className="inline animate-spin text-brand-500" />
          ) : (
            <span className="text-slate-300 dark:text-slate-600">—</span>
          )}
        </td>
        <td className={`${cell} whitespace-nowrap`}>
          {isPlate ? (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => onToggleAddonFlag('vacuum')}
                title="Toggle vacuum (+300)"
                className={`rounded-lg border px-2 py-1 text-[10px] font-bold transition ${
                  row.has_vacuum
                    ? 'border-blue-300 bg-blue-100 text-blue-700 dark:border-blue-400/30 dark:bg-blue-500/15 dark:text-blue-300'
                    : 'border-slate-200 bg-white text-slate-400 hover:border-blue-300 hover:text-blue-600 dark:border-white/10 dark:bg-white/5 dark:hover:text-blue-300'
                }`}
              >
                Vac
              </button>
              <button
                type="button"
                onClick={() => onToggleAddonFlag('engine')}
                title="Toggle engine wash (+300)"
                className={`rounded-lg border px-2 py-1 text-[10px] font-bold transition ${
                  row.has_engine_wash
                    ? 'border-amber-300 bg-amber-100 text-amber-700 dark:border-amber-400/30 dark:bg-amber-500/15 dark:text-amber-300'
                    : 'border-slate-200 bg-white text-slate-400 hover:border-amber-300 hover:text-amber-600 dark:border-white/10 dark:bg-white/5 dark:hover:text-amber-300'
                }`}
              >
                Eng
              </button>
            </div>
          ) : (
            <span className="text-slate-300 dark:text-slate-600">—</span>
          )}
        </td>
        <td className={cell}>
          <div className="flex items-center justify-end gap-1">
            <button
              onClick={onSaveDraft}
              disabled={saving}
              title="Save this row"
              className={`btn-sm ${dirty ? 'btn-primary' : 'btn-secondary'}`}
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            </button>
            <button onClick={onEdit} title="Edit this row" className="btn-secondary btn-sm">
              <Pencil size={14} />
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
        </td>
      </tr>

      {smsOpen && (
        <tr>
          <td colSpan={11} className="border-b border-slate-100 bg-brand-50/60 px-3 py-2 dark:border-white/5 dark:bg-brand-500/5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
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
          </td>
        </tr>
      )}

      {error && (
        <tr>
          <td colSpan={11} className="border-b border-slate-100 bg-red-50 px-3 py-1.5 dark:border-white/5 dark:bg-red-500/5">
            <p className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-600 dark:text-red-400">
              <AlertTriangle size={13} /> {error}
            </p>
          </td>
        </tr>
      )}
    </>
  );
}
