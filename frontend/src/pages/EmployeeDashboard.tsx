import { useState, useEffect } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { format } from 'date-fns';
const logoImg = '/src/images/logo.jpeg';

const weekId = format(new Date(), 'yyyy-II');

export default function EmployeeDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [carpetsIn, setCarpetsIn] = useState<any[]>([]);
  const [carpetsOut, setCarpetsOut] = useState<any[]>([]);
  const [debts, setDebts] = useState<any[]>([]);
  const [repayments, setRepayments] = useState<any[]>([]);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  useEffect(() => {
    const fetchEmpData = async () => {
      const res = await api.get('/stats/me');
      setStats(res.data);

      const myId = res.data.id;
      const [txRes, inRes, outRes, debtRes, repRes] = await Promise.all([
        api.get('/transactions/', { params: { washer_id: myId, week_id: weekId } }),
        api.get('/carpets/', { params: { status: 'received' } }),
        api.get('/carpets/', { params: { status: 'released' } }),
        api.get('/debts/'),
        api.get('/repayments/')
      ]);
      setTransactions(txRes.data);
      setCarpetsIn(inRes.data);
      setCarpetsOut(outRes.data);
      setDebts(debtRes.data);
      setRepayments(repRes.data);
    };
    fetchEmpData();
  }, [user]);

  if (!stats) return <div className="p-6">Loading your stats...</div>;

  return (
    <div className="p-6 space-y-6">
      <div className="hidden print:flex print:items-center print:justify-center print:gap-4 print:mb-4 print:border-b print:pb-4">
        <img src={logoImg} alt="EXTREME" className="h-16 object-contain" />
        <div className="text-center">
          <h1 className="text-2xl font-bold text-blue-600">EXTREME AUTO CARWASH</h1>
          <p className="text-sm text-gray-600">Eldoret, Annex, Jamboni</p>
          <p className="text-xs text-gray-500">+254 728 597 862</p>
        </div>
      </div>
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">My Performance — Week {weekId}</h1>
        <button onClick={() => window.print()} className="bg-primary-600 text-white px-4 py-2 rounded print:hidden">
          Generate My Receipt
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 print:grid-cols-4">
        <StatCard title="Wages This Week" value={`Ksh ${stats.wages_earned}`} color="bg-green-600" />
        <StatCard title="Jobs This Week" value={stats.jobs_count} color="bg-sky-600" />
        <StatCard title="Revenue Generated" value={`Ksh ${stats.revenue_generated}`} color="bg-blue-600" />
        <StatCard title="Current Debt" value={`Ksh ${stats.current_debt}`} color="bg-red-600" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 print:grid-cols-4">
        <StatCard title="Shortfalls This Week" value={`Ksh ${stats.shortfall_total}`} color="bg-red-400" />
        <StatCard title="Carpets Received" value={stats.carpets_received} color="bg-amber-600" />
        <StatCard title="Carpets Released" value={stats.carpets_released} color="bg-purple-600" />
        <StatCard title="Payable Balance" value={`Ksh ${stats.payable_balance}`} color="bg-emerald-700" />
      </div>

      <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-4 text-primary-600">Wage Breakdown (per day)</h2>
        {stats.wage_breakdown.length > 0 ? (
          <table className="w-full text-left">
            <thead>
              <tr className="border-b"><th className="py-2">Day</th><th className="py-2">Wages</th></tr>
            </thead>
            <tbody>
              {stats.wage_breakdown.map((d: any) => (
                <tr key={d.day} className="border-b">
                  <td className="py-2">{format(new Date(d.day), 'EEE dd MMM')}</td>
                  <td className="py-2 font-mono">Ksh {d.wages}</td>
                </tr>
              ))}
              <tr>
                <td className="py-2 font-bold">Total ({stats.jobs_count} jobs)</td>
                <td className="py-2 font-mono font-bold">Ksh {stats.wages_earned}</td>
              </tr>
            </tbody>
          </table>
        ) : <p className="text-gray-400 text-sm">No wages logged this week yet.</p>}
      </div>

      <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-4 text-primary-600">Service Breakdown</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Object.entries(stats.service_counts).map(([cat, count]: any) => (
            <div key={cat} className="flex justify-between p-3 border rounded dark:border-slate-700">
              <span className="capitalize">{cat === 'other' ? 'Others' : cat}</span>
              <span className="font-bold">{count}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow overflow-hidden">
        <h2 className="text-xl font-semibold mb-4">Cars Washed This Week</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b">
                <th className="py-2">Time</th>
                <th className="py-2">Category</th>
                <th className="py-2">Plate / Item</th>
                <th className="py-2 text-right">Expected</th>
                <th className="py-2 text-right">Paid</th>
                <th className="py-2 text-right">Shortfall</th>
                <th className="py-2 text-right">My Payout</th>
              </tr>
            </thead>
            <tbody>
              {transactions.length === 0 && (
                <tr><td colSpan={7} className="py-6 text-center text-gray-400">No washes this week.</td></tr>
              )}
              {transactions.map(tx => (
                <tr key={tx.id} className="border-b">
                  <td className="py-2 text-sm">{format(new Date(tx.timestamp), 'EEE dd/MM HH:mm')}</td>
                  <td className="py-2 capitalize">{tx.custom_category || tx.category}</td>
                  <td className="py-2 text-xs font-mono">{tx.category === 'other' ? tx.custom_category || '-' : (tx.plate_number || '-')}</td>
                  <td className="py-2 font-mono text-right">Ksh {tx.expected_price}</td>
                  <td className="py-2 font-mono text-right">Ksh {tx.total_paid}</td>
                  <td className="py-2 font-mono text-right text-red-600">{(tx.shortfall || 0) > 0 ? `Ksh ${tx.shortfall}` : '-'}</td>
                  <td className="py-2 font-bold text-right">{tx.final_payout < 0 ? (
                    <span className="text-red-600">Debt Ksh {Math.abs(tx.final_payout)}</span>
                  ) : `Ksh ${tx.final_payout}`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow overflow-hidden">
          <h2 className="text-xl font-semibold mb-4 text-amber-600">My Carpets — Received</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b">
                  <th className="py-2">Received</th>
                  <th className="py-2">Carpet</th>
                  <th className="py-2">Client</th>
                  <th className="py-2 text-right">Expected</th>
                </tr>
              </thead>
              <tbody>
                {carpetsIn.length === 0 && <tr><td colSpan={4} className="py-4 text-center text-gray-400 text-sm">None received.</td></tr>}
                {carpetsIn.map(c => (
                  <tr key={c.id} className="border-b">
                    <td className="py-2 text-sm">{format(new Date(c.created_at), 'dd/MM HH:mm')}</td>
                    <td className="py-2 text-sm">
                      <span className="pr-2">{c.characteristics || 'Carpet'}</span>
                      {c.image_data && <img src={c.image_data} alt="carpet" onClick={() => setPhotoPreview(c.image_data)} className="inline h-8 w-8 object-cover rounded border cursor-pointer" />}
                    </td>
                    <td className="py-2 text-sm">
                      {c.client_name ? <div>{c.client_name}</div> : <div className="text-gray-400">—</div>}
                      {c.customer_phone && <div className="text-xs text-gray-500">{c.customer_phone}</div>}
                    </td>
                    <td className="py-2 font-mono text-right text-sm">Ksh {c.expected_price}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow overflow-hidden">
          <h2 className="text-xl font-semibold mb-4 text-purple-600">My Carpets — Released</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b">
                  <th className="py-2">Released</th>
                  <th className="py-2">Carpet</th>
                  <th className="py-2">Client</th>
                  <th className="py-2 text-right">Paid</th>
                </tr>
              </thead>
              <tbody>
                {carpetsOut.length === 0 && <tr><td colSpan={4} className="py-4 text-center text-gray-400 text-sm">None released.</td></tr>}
                {carpetsOut.map(c => (
                  <tr key={c.id} className="border-b">
                    <td className="py-2 text-sm">{c.released_at ? format(new Date(c.released_at), 'dd/MM HH:mm') : '-'}</td>
                    <td className="py-2 text-sm">{c.characteristics || 'Carpet'}</td>
                    <td className="py-2 text-sm">
                      {c.client_name ? <div>{c.client_name}</div> : <div className="text-gray-400">—</div>}
                      {c.customer_phone && <div className="text-xs text-gray-500">{c.customer_phone}</div>}
                    </td>
                    <td className="py-2 font-mono text-right text-sm">Ksh {c.cash_paid + c.mpesa_paid}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-4 text-red-600">My Debts</h2>
        {debts.length > 0 && (
          <table className="w-full text-left mb-4">
            <thead>
              <tr className="border-b">
                <th className="py-2">Date</th>
                <th className="py-2">Service</th>
                <th className="py-2">Notes / Description</th>
                <th className="py-2 text-right">Amount</th>
                <th className="py-2 text-right">Paid</th>
                <th className="py-2 text-right">Balance</th>
              </tr>
            </thead>
            <tbody>
              {debts.map(d => (
                <tr key={d.id} className="border-b">
                  <td className="py-2 text-sm">{format(new Date(d.date), 'dd/MM/yyyy')}</td>
                  <td className="py-2">{d.service || 'Loan'}</td>
                  <td className="py-2 text-xs text-gray-500">{d.notes || '-'}</td>
                  <td className="py-2 font-mono text-right">Ksh {d.amount}</td>
                  <td className="py-2 font-mono text-right">Ksh {d.paid}</td>
                  <td className="py-2 font-mono font-bold text-right text-red-600">Ksh {d.balance}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <h3 className="font-semibold mb-2">Shortfall Debts (auto)</h3>
        {stats.debt_sources && stats.debt_sources.length > 0 ? (
          <ul className="space-y-2">
            {stats.debt_sources.map((d: any) => (
              <li key={d.id} className="flex justify-between p-2 border border-red-200 rounded bg-red-50 dark:bg-red-900/20 dark:border-red-800">
                <span className="text-sm">
                  {d.custom_category || d.category}{d.plate_number ? ` (${d.plate_number})` : ''} — {new Date(d.timestamp).toLocaleDateString()}
                </span>
                <span className="font-bold text-red-600">Ksh {d.shortfall}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-gray-400 text-sm">No shortfall debts</p>
        )}
      </div>

      <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-4 text-emerald-600">My Repayments</h2>
        {repayments.length > 0 ? (
          <table className="w-full text-left">
            <thead>
              <tr className="border-b"><th className="py-2">Date</th><th className="py-2 text-right">Amount Paid Off</th></tr>
            </thead>
            <tbody>
              {repayments.map(r => (
                <tr key={r.id} className="border-b">
                  <td className="py-2 text-sm">{format(new Date(r.timestamp), 'dd MMM yyyy HH:mm')}</td>
                  <td className="py-2 font-mono text-right">Ksh {r.amount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <p className="text-gray-400 text-sm">No repayments this week.</p>}
      </div>
    </div>

      {photoPreview && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={() => setPhotoPreview(null)}>
          <div className="relative max-w-3xl w-full" onClick={e => e.stopPropagation()}>
            <button onClick={() => setPhotoPreview(null)}
              className="absolute -top-3 -right-3 bg-red-600 text-white w-8 h-8 rounded-full font-bold">×</button>
            <img src={photoPreview} alt="carpet preview" className="w-full rounded-lg shadow-2xl" />
          </div>
        </div>
      )}
  );
}

function StatCard({ title, value, color }: any) {
  return (
    <div className={`${color} p-4 rounded-lg shadow text-white`}>
      <div className="text-sm opacity-80">{title}</div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  );
}