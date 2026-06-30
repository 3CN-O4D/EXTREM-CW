import React, { useEffect, useState } from 'react';
import api from '../services/api';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

import { format, startOfWeek, addDays, isSameDay } from 'date-fns';

export default function AdminDashboard() {
  const [summary, setSummary] = useState<any>(null);
  const [employees, setEmployees] = useState<any[]>([]);
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);

  const fetchStats = async () => {
    const params: any = {};
    if (selectedDay) {
      params.day = format(selectedDay, 'yyyy-MM-dd');
    }
    const summaryRes = await api.get('/stats/summary', { params });
    const employeesRes = await api.get('/stats/employees', { params });
    setSummary(summaryRes.data);
    setEmployees(employeesRes.data);
  };

  useEffect(() => {
    fetchStats();
  }, [selectedDay]);

  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const weekDays = [...Array(7)].map((_, i) => addDays(weekStart, i));

  if (!summary) return <div>Loading...</div>;

  const generateWeeklyReport = () => {
    window.print(); // Basic implementation
  };

  return (
    <div className="p-6 space-y-6 print:p-0">
      <div className="flex justify-between items-center print:hidden">
        <h1 className="text-2xl font-bold">Business Overview</h1>
        <button
          onClick={generateWeeklyReport}
          className="bg-primary-600 text-white px-4 py-2 rounded hover:bg-primary-700"
        >
          Generate Report
        </button>
      </div>

      <div className="flex space-x-2 print:hidden overflow-x-auto pb-2">
        <button
          onClick={() => setSelectedDay(null)}
          className={`px-4 py-2 rounded ${!selectedDay ? 'bg-primary-600 text-white' : 'bg-gray-200 dark:bg-slate-700'}`}
        >
          Full Week
        </button>
        {weekDays.map(day => (
          <button
            key={day.toISOString()}
            onClick={() => setSelectedDay(day)}
            className={`px-4 py-2 rounded whitespace-nowrap ${selectedDay && isSameDay(selectedDay, day) ? 'bg-primary-600 text-white' : 'bg-gray-200 dark:bg-slate-700'}`}
          >
            {format(day, 'EEE (dd/MM)')}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard title="Revenue" value={`Ksh ${summary.total_revenue}`} color="bg-blue-500" />
        <StatCard title="Expenses" value={`Ksh ${summary.total_expenses}`} color="bg-red-500" />
        <StatCard title="Labor" value={`Ksh ${summary.total_labor_expense}`} color="bg-orange-500" />
        <StatCard title="Net Profit" value={`Ksh ${summary.net_profit}`} color="bg-green-500" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4 text-primary-600">Service Counts</h2>
          <div className="grid grid-cols-2 gap-4">
            {Object.entries(summary.category_counts).map(([cat, count]: any) => (
              <div key={cat} className="flex justify-between p-3 border rounded dark:border-slate-700">
                <span className="capitalize">{cat}</span>
                <span className="font-bold">{count}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow">
           <h2 className="text-xl font-semibold mb-4">Financial Status</h2>
           <div className="space-y-2">
              <div className="flex justify-between"><span>Gross Revenue</span> <span className="font-mono">Ksh {summary.total_revenue}</span></div>
              <div className="flex justify-between"><span>Labor Expense</span> <span className="font-mono">Ksh {summary.total_labor_expense}</span></div>
              <div className="flex justify-between"><span>Operating Expenses</span> <span className="font-mono">Ksh {summary.total_expenses}</span></div>
              <div className="border-t pt-2 flex justify-between font-bold text-lg"><span>Net Profit</span> <span className={summary.net_profit >=0 ? 'text-green-500' : 'text-red-500'}>Ksh {summary.net_profit}</span></div>
           </div>
        </div>
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
                <td className="py-2 text-right">
                  <button
                    onClick={() => {
                      alert(`Generating detailed receipt for ${emp.name}...`);
                      window.print();
                    }}
                    className="text-primary-600 hover:underline text-sm"
                  >
                    View Receipt
                  </button>
                </td>
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
