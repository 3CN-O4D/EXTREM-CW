import React, { useEffect, useState } from 'react';
import api from '../services/api';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function AdminDashboard() {
  const [summary, setSummary] = useState<any>(null);
  const [employees, setEmployees] = useState<any[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      const summaryRes = await api.get('/stats/summary');
      const employeesRes = await api.get('/stats/employees');
      setSummary(summaryRes.data);
      setEmployees(employeesRes.data);
    };
    fetchData();
  }, []);

  if (!summary) return <div>Loading...</div>;

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Admin Overview</h1>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard title="Revenue" value={`Ksh ${summary.total_revenue}`} color="bg-blue-500" />
        <StatCard title="Expenses" value={`Ksh ${summary.total_expenses}`} color="bg-red-500" />
        <StatCard title="Labor" value={`Ksh ${summary.total_labor_expense}`} color="bg-orange-500" />
        <StatCard title="Net Profit" value={`Ksh ${summary.net_profit}`} color="bg-green-500" />
      </div>

      <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-4">Employee Performance</h2>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={employees}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="abbreviation" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="revenue_generated" fill="#0ea5e9" name="Revenue" />
              <Bar dataKey="wages_earned" fill="#10b981" name="Wages" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-4">Employee Debt Ledger</h2>
        <table className="w-full text-left">
          <thead>
            <tr className="border-b">
              <th className="py-2">Name</th>
              <th className="py-2">Current Debt</th>
              <th className="py-2">Payable Balance</th>
            </tr>
          </thead>
          <tbody>
            {employees.map(emp => (
              <tr key={emp.id} className="border-b">
                <td className="py-2">{emp.name} ({emp.abbreviation})</td>
                <td className="py-2 text-red-500 font-bold">Ksh {emp.current_debt}</td>
                <td className="py-2 text-green-500">Ksh {emp.payable_balance}</td>
              </tr>
            ))}
          </tbody>
        </table>
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
