import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { format } from 'date-fns';
const logoImg = '/src/images/carwashlogo.svg';

export default function EmployeeDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);

  useEffect(() => {
    const fetchEmpData = async () => {
      const res = await api.get('/stats/me');
      setStats(res.data);

      const txRes = await api.get('/transactions/', { params: { washer_id: res.data.id } });
      setTransactions(txRes.data);
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
        <h1 className="text-2xl font-bold">My Performance</h1>
        <button onClick={() => window.print()} className="bg-primary-600 text-white px-4 py-2 rounded print:hidden">
           Generate My Receipt
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 print:grid-cols-3">
         <StatCard title="Wages Earned" value={`Ksh ${stats.wages_earned}`} color="bg-green-600" />
         <StatCard title="Current Debt" value={`Ksh ${stats.current_debt}`} color="bg-red-600" />
         <StatCard title="Total Revenue" value={`Ksh ${stats.revenue_generated}`} color="bg-blue-600" />
      </div>

      <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-4 text-primary-600">Service Breakdown</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Object.entries(stats.service_counts).map(([cat, count]: any) => (
              <div key={cat} className="flex justify-between p-3 border rounded dark:border-slate-700">
                <span className="capitalize">{cat}</span>
                <span className="font-bold">{count}</span>
              </div>
            ))}
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-4 text-red-600">My Debts</h2>
        {stats.debt_sources && stats.debt_sources.length > 0 ? (
          <ul className="space-y-2">
            {stats.debt_sources.map((d: any) => (
              <li key={d.id} className="flex justify-between p-2 border border-red-200 rounded bg-red-50 dark:bg-red-900/20 dark:border-red-800">
                <span className="text-sm">
                  {d.category}{d.plate_number ? ` (${d.plate_number})` : ''} — {new Date(d.timestamp).toLocaleDateString()}
                </span>
                <span className="font-bold text-red-600">Ksh {d.shortfall}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-gray-400 text-sm">No debts</p>
        )}
      </div>

      <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow overflow-hidden">
         <h2 className="text-xl font-semibold mb-4">My Recent Washes</h2>
         <div className="overflow-x-auto">
            <table className="w-full text-left">
               <thead>
                  <tr className="border-b">
                     <th className="py-2">Date</th>
                     <th className="py-2">Category</th>
                     <th className="py-2">Plate</th>
                     <th className="py-2">Expected</th>
                     <th className="py-2">My Payout</th>
                  </tr>
               </thead>
               <tbody>
                  {transactions.slice(0, 10).map(tx => (
                     <tr key={tx.id} className="border-b">
                        <td className="py-2 text-sm">{format(new Date(tx.timestamp), 'dd MMM, HH:mm')}</td>
                        <td className="py-2 capitalize">{tx.category}</td>
                        <td className="py-2 text-xs font-mono">{tx.plate_number || '-'}</td>
                        <td className="py-2 font-mono text-sm">Ksh {tx.expected_price}</td>
                        <td className="py-2 font-bold text-sm">Ksh {tx.final_payout}</td>
                     </tr>
                  ))}
               </tbody>
            </table>
         </div>
      </div>
    </div>
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
