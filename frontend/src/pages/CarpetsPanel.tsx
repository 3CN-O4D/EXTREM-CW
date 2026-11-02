import { useCallback, useEffect, useState } from 'react';
import { ImageIcon, Loader2, Phone, Plus, Trash2, X } from 'lucide-react';
import { format } from 'date-fns';
import api from '../services/api';
import { compressVariants } from '../utils/image';
import { InlineError, PageError, PageLoading } from '../components/States';

const STATUS_FLOW = ['received', 'washed', 'ready', 'released'] as const;
type Status = (typeof STATUS_FLOW)[number];

const STATUS_META: Record<Status, { label: string; cls: string }> = {
  received: { label: 'Received', cls: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300' },
  washed: { label: 'Washed', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300' },
  ready: { label: 'Ready', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300' },
  released: { label: 'Released', cls: 'bg-slate-200 text-slate-600 dark:bg-white/10 dark:text-slate-300' },
};

const toNum = (v: any) => { const n = parseInt(v); return isNaN(n) ? 0 : Math.max(0, n); };

const EMPTY_RECEIVE = {
  image: '', thumb: '', characteristics: '', client_name: '', customer_phone: '',
  receiver_id: '', expected_price: 300,
};

export default function CarpetsPanel() {
  const [carpets, setCarpets] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [filter, setFilter] = useState<'all' | Status>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  // receive carpet
  const [showReceive, setShowReceive] = useState(false);
  const [receive, setReceive] = useState({ ...EMPTY_RECEIVE });
  const [receiveBusy, setReceiveBusy] = useState(false);
  const [receiveCompressing, setReceiveCompressing] = useState(false);
  const [receiveError, setReceiveError] = useState('');

  // change status (washed / ready) with optional photo
  const [statusModal, setStatusModal] = useState<{ carpet: any; status: 'washed' | 'ready'; image: string; thumb: string } | null>(null);
  const [statusBusy, setStatusBusy] = useState(false);
  const [statusCompressing, setStatusCompressing] = useState(false);

  // release
  const [releaseModal, setReleaseModal] = useState<{ carpet: any; cash: string; mpesa: string; washer: string } | null>(null);
  const [releaseBusy, setReleaseBusy] = useState(false);

  // edit carpet fields
  const [editModal, setEditModal] = useState<{ carpet: any; receiver_id: string; characteristics: string; client_name: string; customer_phone: string; expected_price: string } | null>(null);
  const [editBusy, setEditBusy] = useState(false);

  const empName = (id: any) => employees.find((e) => e.id === id)?.name;

  const fetchCarpets = useCallback(async () => {
    try {
      const res = await api.get('/carpets/');
      setCarpets(res.data);
      setError('');
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Could not load carpets.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchCarpets();
    api.get('/stats/employees')
      .then((r) => setEmployees(r.data))
      .catch(() => {});
  }, [fetchCarpets]);

  const openPhoto = async (c: any) => {
    try {
      const res = await api.get(`/carpets/${c.id}`);
      setPhotoPreview(res.data.image_data || res.data.image_washed || res.data.image_ready || null);
    } catch {
      setPhotoPreview(c.image_thumb || c.image_washed_thumb || c.image_ready_thumb || null);
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
        } else {
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
      const { carpet, receiver_id, characteristics, client_name, customer_phone, expected_price } = editModal;
      await api.patch(`/carpets/${carpet.id}`, {
        receiver_id: receiver_id || null,
        characteristics: characteristics || null,
        client_name: client_name || null,
        customer_phone: customer_phone || null,
        expected_price: toNum(expected_price),
      });
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

  const filtered = filter === 'all' ? carpets : carpets.filter((c) => c.status === filter);
  const readyCarpets = carpets.filter((c) => c.status === 'ready');
  const countFor = (s: 'all' | Status) => (s === 'all' ? carpets.length : carpets.filter((c) => c.status === s).length);

  const timeline = (c: any) => {
    const cells: Array<[string, string | null]> = [
      ['Received', c.created_at],
      ['Washed', c.washed_at],
      ['Ready', c.ready_at],
      ['Released', c.released_at],
    ];
    return (
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400">
        {cells.map(([label, ts]) => (
          <span key={label}>
            <span className="font-bold text-slate-400 dark:text-slate-500">{label}</span>{' '}
            {ts ? format(new Date(ts), 'dd/MM HH:mm') : '—'}
          </span>
        ))}
      </div>
    );
  };

  const thumbs = (c: any) => (
    <div className="flex gap-1">
      {[c.image_thumb, c.image_washed_thumb, c.image_ready_thumb].map((src, i) => (
        <div key={i} className="relative h-12 w-12 overflow-hidden rounded-lg border border-slate-200 bg-slate-100 dark:border-white/10 dark:bg-white/5">
          {src ? (
            <img
              src={src}
              alt=""
              onClick={() => openPhoto(c)}
              className="h-full w-full cursor-pointer object-cover"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-slate-300 dark:text-slate-600"><ImageIcon size={14} /></span>
          )}
        </div>
      ))}
    </div>
  );

  if (loading) return <PageLoading label="Loading carpets..." />;
  if (error && carpets.length === 0) return <PageError message={error} onRetry={fetchCarpets} />;

  return (
    <div className="space-y-5">
      {error && <InlineError message={error} />}

      {/* Ready for pickup banner */}
      {readyCarpets.length > 0 && (
        <div className="card-pad rounded-2xl border-l-4 border-emerald-500">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="section-title text-emerald-600 dark:text-emerald-400">Ready for pickup ({readyCarpets.length})</h2>
              <p className="muted text-sm">Dry and ready — call the owners to come collect.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {readyCarpets.slice(0, 5).map((c) => (
                <div key={c.id} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-1.5 dark:border-white/10 dark:bg-white/5">
                  {c.image_thumb && (
                    <img
                      src={c.image_thumb}
                      alt=""
                      className="h-8 w-8 rounded-lg object-cover"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                  )}
                  <div className="text-xs">
                    <p className="font-bold">{c.client_name || 'Client'}</p>
                    <p className="text-slate-500">{c.characteristics || 'Carpet'}</p>
                  </div>
                  {c.customer_phone && (
                    <a href={`tel:${c.customer_phone}`} className="ml-1 inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2 py-1 text-xs font-bold text-white hover:bg-emerald-700">
                      <Phone size={12} /> Call
                    </a>
                  )}
                  <button onClick={() => openPhoto(c)} className="ml-1 inline-flex items-center gap-1 rounded-lg bg-violet-600 px-2 py-1 text-xs font-bold text-white hover:bg-violet-700">
                    View
                  </button>
                </div>
              ))}
              {readyCarpets.length > 5 && <span className="self-center text-xs text-slate-500">+{readyCarpets.length - 5} more</span>}
            </div>
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
              className={`rounded-full px-3 py-1.5 text-xs font-bold capitalize transition ${
                filter === s
                  ? 'bg-brand-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10'
              }`}
            >
              {s === 'all' ? 'All' : STATUS_META[s].label}
              <span className={`ml-1.5 rounded-full px-1.5 text-[10px] ${filter === s ? 'bg-white/25' : 'bg-slate-200 text-slate-500 dark:bg-white/10 dark:text-slate-400'}`}>
                {countFor(s)}
              </span>
            </button>
          ))}
        </div>
        <button onClick={() => setShowReceive(true)} className="btn-primary inline-flex items-center gap-2">
          <Plus size={16} /> Receive carpet
        </button>
      </div>

      {/* Table */}
      <div className="card-pad overflow-x-auto rounded-2xl">
        {filtered.length === 0 ? (
          <p className="py-10 text-center text-sm text-slate-400">No carpets{filter !== 'all' ? ` ${STATUS_META[filter].label.toLowerCase()}` : ''} right now.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200/80 text-xs uppercase tracking-wider text-slate-400 dark:border-white/10">
                <th className="py-2 pr-3">Photos</th>
                <th className="py-2 pr-3">Carpet</th>
                <th className="py-2 pr-3">Client</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 pr-3">Timeline</th>
                <th className="py-2 pr-3 text-right">Price</th>
                <th className="py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id} className="border-b border-slate-200/70 dark:border-white/10">
                  <td className="py-3 pr-3">{thumbs(c)}</td>
                  <td className="py-3 pr-3">
                    <p className="font-semibold">{c.characteristics || 'Carpet'}</p>
                    <p className="text-xs text-slate-400">#{c.id} · receiver {empName(c.receiver_id) || '—'}</p>
                  </td>
                  <td className="py-3 pr-3">
                    {c.client_name ? <p className="font-medium">{c.client_name}</p> : <p className="text-slate-400">—</p>}
                    {c.customer_phone ? (
                      <a href={`tel:${c.customer_phone}`} className="inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:underline dark:text-brand-300">
                        <Phone size={11} /> {c.customer_phone}
                      </a>
                    ) : null}
                  </td>
                  <td className="py-3 pr-3">
                    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-bold ${STATUS_META[c.status as Status]?.cls || ''}`}>
                      {STATUS_META[c.status as Status]?.label || c.status}
                    </span>
                  </td>
                  <td className="py-3 pr-3">{timeline(c)}</td>
                  <td className="py-3 pr-3 text-right font-mono">
                    <div>Ksh {c.expected_price}</div>
                    <div className="text-xs text-slate-400">paid {c.cash_paid + c.mpesa_paid}</div>
                  </td>
                  <td className="py-3 text-right">
                    <div className="flex flex-wrap justify-end gap-1">
                      {c.status === 'received' && (
                        <button onClick={() => setStatusModal({ carpet: c, status: 'washed', image: '', thumb: '' })}
                          className="rounded-lg bg-amber-600 px-2 py-1 text-xs font-bold text-white hover:bg-amber-700">Wash</button>
                      )}
                      {c.status === 'washed' && (
                        <button onClick={() => setStatusModal({ carpet: c, status: 'ready', image: '', thumb: '' })}
                          className="rounded-lg bg-emerald-600 px-2 py-1 text-xs font-bold text-white hover:bg-emerald-700">Ready</button>
                      )}
                      {c.status !== 'released' && (
                        <>
                          <button onClick={() => setReleaseModal({ carpet: c, cash: String(c.expected_price || ''), mpesa: '', washer: '' })}
                            className="rounded-lg bg-blue-600 px-2 py-1 text-xs font-bold text-white hover:bg-blue-700">Release</button>
                          <button onClick={() => setStatusModal({ carpet: c, status: c.status === 'received' ? 'washed' : 'ready', image: '', thumb: '' })}
                            className="rounded-lg bg-slate-200 px-2 py-1 text-xs font-bold text-slate-700 hover:bg-slate-300 dark:bg-white/10 dark:text-slate-200">Status</button>
                        </>
                      )}
                      <button onClick={() => openPhoto(c)}
                        className="rounded-lg bg-violet-600 px-2 py-1 text-xs font-bold text-white hover:bg-violet-700">View</button>
                      <button onClick={() => setEditModal({
                        carpet: c,
                        receiver_id: String(c.receiver_id || ''),
                        characteristics: c.characteristics || '',
                        client_name: c.client_name || '',
                        customer_phone: c.customer_phone || '',
                        expected_price: String(c.expected_price || ''),
                      })}
                        className="rounded-lg bg-indigo-600 px-2 py-1 text-xs font-bold text-white hover:bg-indigo-700">Edit</button>
                      <button onClick={() => deleteCarpet(c)} className="rounded-lg bg-red-600 px-2 py-1 text-xs font-bold text-white hover:bg-red-700"><Trash2 size={12} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
              <input
                type="file" accept="image/*" capture="environment"
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
            <label className="block">
              <span className="mb-1 block text-sm font-semibold">Photo for "{STATUS_META[statusModal.status].label}" (optional)</span>
              <input
                type="file" accept="image/*" capture="environment"
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
                  {employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
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
              <p className="text-xs text-slate-500">Status: {STATUS_META[editModal.carpet.status as Status]?.label}</p>
            </div>
            <label className="block">
              <span className="mb-1 block text-sm font-semibold">Owner / Receiver</span>
              <select className="input-base" value={editModal.receiver_id}
                onChange={(e) => setEditModal({ ...editModal, receiver_id: e.target.value })}>
                <option value="">Unassigned</option>
                {employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
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

      {/* Photo preview */}
      {photoPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setPhotoPreview(null)}>
          <div className="relative max-w-3xl w-full" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setPhotoPreview(null)}
              className="absolute -right-3 -top-3 flex h-8 w-8 items-center justify-center rounded-full bg-red-600 text-white font-bold">×</button>
            <img src={photoPreview} alt="carpet preview" className="w-full rounded-lg shadow-2xl" />
          </div>
        </div>
      )}
    </div>
  );
}
