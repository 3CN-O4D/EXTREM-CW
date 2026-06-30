import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { format } from 'date-fns';

export default function EmployeeDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);

  useEffect(() => {
    const fetchEmpData = async () => {
      // Find this employee in the list
      const res = await api.get('/stats/employees');
      const me = res.data.find((e: any) => e.abbreviation === user?.abbreviation);
      setStats(me);

      const txRes = await api.get('/transactions/', { params: { washer_id: me.id } });
      setTransactions(txRes.data);
    };
    fetchEmpData();
  }, [user]);

  if (!stats) return <div className="p-6">Loading your stats...</div>;

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">My Performance</h1>
        <button onClick={() => window.print()} className="bg-primary-600 text-white px-4 py-2 rounded">
           Generate My Receipt
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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

      <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow overflow-hidden">
         <h2 className="text-xl font-semibold mb-4">My Recent Washes</h2>
         <div className="overflow-x-auto">
            <table className="w-full text-left">
               <thead>
                  <tr className="border-b">
                     <th className="py-2">Date</th>
                     <th className="py-2">Category</th>
                     <th className="py-2">Expected</th>
                     <th className="py-2">My Payout</th>
                  </tr>
               </thead>
               <tbody>
                  {transactions.slice(0, 10).map(tx => (
                     <tr key={tx.id} className="border-b">
                        <td className="py-2 text-sm">{format(new Date(tx.timestamp), 'dd MMM, HH:mm')}</td>
                        <td className="py-2 capitalize">{tx.category}</td>
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
