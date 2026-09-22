import React, { useEffect, useState } from 'react';
import api from '../services/api';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { format, startOfWeek, addDays, isSameDay } from 'date-fns';
import { Link } from 'react-router-dom';
import { Users, ChevronDown, ChevronRight } from 'lucide-react';
const logoImg = '/src/images/logo.jpeg';

export default function AdminDashboard() {
  const [summary, setSummary] = useState<any>(null);
  const [employees, setEmployees] = useState<any[]>([]);
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [debts, setDebts] = useState<any[]>([]);
  const [repayments, setRepayments] = useState<any[]>([]);
  const [expandedEmp, setExpandedEmp] = useState<number | null>(null);
  const [empTxns, setEmpTxns] = useState<any[]>([]);
  const [empDebts, setEmpDebts] = useState<any[]>([]);

  const fetchStats = async () => {
    const params: any = {};
    const txParams: any = {};
    if (selectedDay) {
      params.day = format(selectedDay, 'yyyy-MM-dd');
      txParams.day = params.day;
    }
    const [summaryRes, employeesRes, expRes, debtsRes, repRes] = await Promise.all([
      api.get('/stats/summary', { params }),
      api.get('/stats/employees', { params }),
      api.get('/expenses/', { params: txParams }),
      api.get('/debts/'),
      api.get('/repayments/', { params: txParams })
    ]);
    setSummary(summaryRes.data);
    setEmployees(employeesRes.data);
    setExpenses(expRes.data);
    setDebts(debtsRes.data);
    setRepayments(repRes.data);
  };

  useEffect(() => {
    fetchStats();
  }, [selectedDay]);

  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const weekDays = [...Array(7)].map((_, i) => addDays(weekStart, i));

  const loadEmployeeDetails = async (emp: any) => {
    if (expandedEmp === emp.id) { setExpandedEmp(null); setEmpTxns([]); setEmpDebts([]); return; }
    const q: any = { washer_id: emp.id };
    if (selectedDay) q.day = format(selectedDay, 'yyyy-MM-dd');
    else if (summary?.week_id) q.week_id = summary.week_id;
    const [txRes, debtRes] = await Promise.all([
      api.get('/transactions/', { params: q }),
      api.get('/debts/', { params: { employee_id: emp.id } })
    ]);
    setEmpTxns(txRes.data);
    setEmpDebts(debtRes.data);
    setExpandedEmp(emp.id);
  };

  if (!summary) return <div className="p-6">Loading...</div>;

  const totalJobs = employees.reduce((s, e) => s + (e.jobs_count || 0), 0);
  const empName = (id: number) => {
    const e = employees.find(x => x.id === id);
    return e ? `${e.name} (${e.abbreviation})` : `#${id}`;
  };
  const debtByEmp = debts.reduce((acc: any, d) => {
    if ((d.balance || 0) > 0) {
      if (!acc[d.employee_id]) acc[d.employee_id] = { name: empName(d.employee_id), total: 0, items: [] };
      acc[d.employee_id].total += d.balance;
      acc[d.employee_id].items.push(d);
    }
    return acc;
  }, {});
  const debtors = Object.values(debtByEmp).sort((a: any, b: any) => b.total - a.total);
  const expByCat = expenses.reduce((acc: any, e) => {
    acc[e.category] = (acc[e.category] || 0) + e.amount;
    return acc;
  }, {});

  return (
    <div className="p-6 space-y-6 print:p-0">
      <div className="hidden print:flex print:items-center print:justify-center print:gap-4 print:mb-4 print:border-b print:pb-4">
        <img src={logoImg} alt="EXTREME" className="h-16 object-contain" />
        <div className="text-center">
          <h1 className="text-2xl font-bold text-blue-600">EXTREME AUTO CARWASH</h1>
          <p className="text-sm text-gray-600">Eldoret, Annex, Jamboni</p>
          <p className="text-xs text-gray-500">+254 728 597 862</p>
        </div>
      </div>
      <div className="flex justify-between items-center print:hidden">
        <h1 className="text-2xl font-bold">Business Overview</h1>
        <div className="flex items-center space-x-3">
          <Link to="/employees" className="bg-primary-600 text-white px-4 py-2 rounded hover:bg-primary-700 flex items-center gap-2">
            <Users size={18} /> Employee Management
          </Link>
          <button onClick={() => window.print()} className="bg-primary-600 text-white px-4 py-2 rounded hover:bg-primary-700">
            Generate Report
          </button>
        </div>
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
        <StatCard title="Total Cash Received" value={`Ksh ${summary.total_cash_received}`} color="bg-blue-500" />
        <StatCard title="Total Expenses" value={`Ksh ${summary.total_expenses}`} color="bg-red-500" />
        <StatCard title="Balance" value={`Ksh ${summary.balance}`} color="bg-green-500" />
        <StatCard title="Total Jobs" value={totalJobs} color="bg-cyan-600" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard title="Total Debts (All)" value={`Ksh ${summary.total_debts}`} color="bg-orange-500" />
        <StatCard title="Debtors" value={debtors.length} color="bg-rose-600" />
        <StatCard title="Repayments" value={`Ksh ${repayments.reduce((s, r) => s + r.amount, 0)}`} color="bg-emerald-600" />
        <StatCard title="Labor Costs" value={`Ksh ${summary.total_labor_expense}`} color="bg-slate-600" />
        <StatCard title="Misc Income" value={`Ksh ${summary.misc_total ?? 0}`} color="bg-violet-600" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4 text-primary-600">Service Counts</h2>
          <div className="grid grid-cols-2 gap-4">
            {Object.entries(summary.category_counts).map(([cat, count]: any) => (
              <div key={cat} className="flex justify-between p-3 border rounded dark:border-slate-700">
                <span className="capitalize">{cat === 'other' ? 'Others' : cat}</span>
                <span className="font-bold">{count}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">Financial Status</h2>
          <div className="space-y-2">
            <div className="flex justify-between"><span>Cash Received</span> <span className="font-mono">Ksh {summary.total_cash_received}</span></div>
            <div className="flex justify-between"><span>Operating Expenses</span> <span className="font-mono">Ksh {summary.total_expenses}</span></div>
            <div className="border-t pt-2 flex justify-between font-bold text-lg"><span>Balance</span> <span className={summary.balance >= 0 ? 'text-green-500' : 'text-red-500'}>Ksh {summary.balance}</span></div>
          </div>
          <div className="border-t mt-4 pt-4">
            <h3 className="font-semibold mb-2">Labor Breakdown</h3>
            {summary.labor_breakdown && summary.labor_breakdown.length > 0 ? (
              <div className="space-y-1">
                {summary.labor_breakdown.map((e: any) => (
                  <div key={e.abbreviation} className="flex justify-between text-sm">
                    <span>{e.name}</span>
                    <span className="font-mono">Ksh {e.wages}</span>
                  </div>
                ))}
                <div className="border-t pt-1 flex justify-between font-bold text-sm">
                  <span>Total Labor</span>
                  <span className="font-mono">Ksh {summary.total_labor_expense}</span>
                </div>
              </div>
            ) : <p className="text-gray-400 text-sm">No labor costs</p>}
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-4 text-red-500">Expenses Insight</h2>
        {expenses.length > 0 ? (
          <>
            <div className="flex flex-wrap gap-2 mb-4">
              {Object.entries(expByCat).map(([cat, amt]: any) => (
                <div key={cat} className="px-3 py-1 rounded bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-sm">
                  <span className="font-medium capitalize">{cat}</span>: <span className="font-mono">Ksh {amt}</span>
                </div>
              ))}
              <div className="px-3 py-1 rounded bg-red-100 dark:bg-red-900/50 text-sm font-bold">
                Total: <span className="font-mono">Ksh {summary.total_expenses}</span>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b"><th className="py-2">Date</th><th className="py-2">Description</th><th className="py-2">Category</th><th className="py-2 text-right">Amount</th></tr>
                </thead>
                <tbody>
                  {expenses.map(e => (
                    <tr key={e.id} className="border-b">
                      <td className="py-2 text-sm">{format(new Date(e.timestamp), 'EEE dd/MM HH:mm')}</td>
                      <td className="py-2">{e.description}</td>
                      <td className="py-2 capitalize">{e.category}</td>
                      <td className="py-2 font-mono text-right">Ksh {e.amount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : <p className="text-gray-400 text-sm">No expenses in this period.</p>}
      </div>

      <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-4 text-violet-600">Miscellaneous Income</h2>
        {summary.misc_items && summary.misc_items.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b"><th className="py-2">Date</th><th className="py-2">Description</th><th className="py-2">Vehicle</th><th className="py-2">Washer</th><th className="py-2 text-right">Amount</th></tr>
              </thead>
              <tbody>
                {summary.misc_items.map(m => (
                  <tr key={m.id} className="border-b">
                    <td className="py-2 text-sm">{format(new Date(m.timestamp), 'EEE dd/MM HH:mm')}</td>
                    <td className="py-2">{m.description || '-'}</td>
                    <td className="py-2 text-xs text-gray-500">{m.plate_number || (m.custom_category || m.category)}</td>
                    <td className="py-2 text-xs">{m.washer || '-'}</td>
                    <td className="py-2 font-mono text-right">Ksh {m.amount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="text-gray-400 text-sm">No miscellaneous income in this period.</p>}
      </div>

      <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-4 text-orange-500">Debts & Debtors</h2>
        {debtors.length > 0 ? (
          <>
            <div className="flex flex-wrap gap-2 mb-4">
              {debtors.map((d: any) => (
                <div key={d.name} className="px-3 py-1 rounded bg-orange-50 dark:bg-orange-900/30 border border-orange-200 dark:border-orange-800 text-sm">
                  {d.name}: <span className="font-bold font-mono">Ksh {d.total}</span>
                </div>
              ))}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b"><th className="py-2">Loan Date</th><th className="py-2">Employee</th><th className="py-2">Service</th><th className="py-2">Notes</th><th className="py-2 text-right">Amount</th><th className="py-2 text-right">Paid</th><th className="py-2 text-right">Balance</th></tr>
                </thead>
                <tbody>
                  {Object.values(debtByEmp).flatMap((d: any) => d.items).map(d => (
                    <tr key={d.id} className="border-b">
                      <td className="py-2 text-sm">{format(new Date(d.date), 'EEE dd/MM/yyyy')}</td>
                      <td className="py-2">{empName(d.employee_id)}</td>
                      <td className="py-2">{d.service || 'Loan'}</td>
                      <td className="py-2 text-xs text-gray-500">{d.notes || '-'}</td>
                      <td className="py-2 font-mono text-right">Ksh {d.amount}</td>
                      <td className="py-2 font-mono text-right">Ksh {d.paid}</td>
                      <td className="py-2 font-mono font-bold text-right text-orange-600">Ksh {d.balance}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : <p className="text-gray-400 text-sm">No outstanding debts. All clear!</p>}
        <div className="mt-5 border-t pt-4">
          <h3 className="font-semibold mb-2 text-emerald-600">Repayments This Period</h3>
          {repayments.length > 0 ? (
            <table className="w-full text-left">
              <thead>
                <tr className="border-b"><th className="py-2">Date</th><th className="py-2">Employee</th><th className="py-2 text-right">Amount</th></tr>
              </thead>
              <tbody>
                {repayments.map(r => (
                  <tr key={r.id} className="border-b">
                    <td className="py-2 text-sm">{format(new Date(r.timestamp), 'EEE dd/MM HH:mm')}</td>
                    <td className="py-2">{r.employee_name} ({r.abbreviation})</td>
                    <td className="py-2 font-mono text-right">Ksh {r.amount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <p className="text-gray-400 text-sm">No repayments this period.</p>}
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

        <div className="overflow-x-auto mt-4">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b">
                <th className="py-2">Employee</th>
                <th className="py-2 text-right">Jobs</th>
                <th className="py-2 text-right">Revenue</th>
                <th className="py-2 text-right">Wages</th>
                <th className="py-2 text-right">Shortfall</th>
                <th className="py-2 text-right">Debt</th>
                <th className="py-2 text-right">Carpets Rcv/Rel</th>
                <th className="py-2"></th>
              </tr>
            </thead>
            <tbody>
              {employees.map(emp => (
                <React.Fragment key={emp.id}>
                  <tr className="border-b">
                    <td className="py-2 font-medium">{emp.name} ({emp.abbreviation})</td>
                    <td className="py-2 font-mono text-right">{emp.jobs_count}</td>
                    <td className="py-2 font-mono text-right">Ksh {emp.revenue_generated}</td>
                    <td className="py-2 font-mono text-right text-green-600">Ksh {emp.wages_earned}</td>
                    <td className="py-2 font-mono text-right text-red-500">Ksh {emp.shortfall_total}</td>
                    <td className="py-2 font-mono text-right text-orange-500">Ksh {emp.current_debt}</td>
                    <td className="py-2 font-mono text-right">{emp.carpets_received}/{emp.carpets_released}</td>
                    <td className="py-2">
                      <button onClick={() => loadEmployeeDetails(emp)} className="text-blue-500 hover:underline flex items-center gap-1">
                        {expandedEmp === emp.id ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                        {expandedEmp === emp.id ? 'Hide' : 'Details'}
                      </button>
                    </td>
                  </tr>
                  {expandedEmp === emp.id && (
                    <tr className="border-b bg-gray-50 dark:bg-slate-900">
                      <td colSpan={8} className="p-4">
                        <h4 className="font-semibold mb-2">Wage Breakdown (per day)</h4>
                        {emp.wage_breakdown?.length > 0 ? (
                          <div className="flex flex-wrap gap-2 mb-4">
                            {emp.wage_breakdown.map((d: any) => (
                              <div key={d.day} className="px-3 py-1 rounded bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 text-sm">
                                {format(new Date(d.day), 'EEE dd/MM')}: <span className="font-mono font-bold">Ksh {d.wages}</span>
                              </div>
                            ))}
                          </div>
                        ) : <p className="text-gray-400 text-sm mb-3">No wages this period.</p>}

                        <h4 className="font-semibold mb-2">Jobs This Period</h4>
                        {empTxns.length > 0 ? (
                          <div className="overflow-x-auto mb-4">
                            <table className="w-full text-left text-sm">
                              <thead>
                                <tr className="border-b">
                                  <th className="py-1">Time</th><th className="py-1">Category</th><th className="py-1">Plate/Item</th>
                                  <th className="py-1 text-right">Expected</th><th className="py-1 text-right">Paid</th>
                                  <th className="py-1 text-right">Shortfall</th><th className="py-1 text-right">Payout</th>
                                </tr>
                              </thead>
                              <tbody>
                                {empTxns.map(tx => (
                                  <tr key={tx.id} className="border-b">
                                    <td className="py-1">{format(new Date(tx.timestamp), 'EEE dd/MM HH:mm')}</td>
                                    <td className="py-1 capitalize">{tx.custom_category || tx.category}</td>
                                    <td className="py-1 font-mono">{tx.category === 'other' ? (tx.custom_category || '-') : (tx.plate_number || '-')}</td>
                                    <td className="py-1 font-mono text-right">Ksh {tx.expected_price}</td>
                                    <td className="py-1 font-mono text-right">Ksh {tx.total_paid}</td>
                                    <td className="py-1 font-mono text-right text-red-500">{(tx.shortfall || 0) > 0 ? `Ksh ${tx.shortfall}` : '-'}</td>
                                    <td className="py-1 font-mono font-bold text-right">{tx.final_payout < 0 ? (
                                      <span className="text-red-500">Ksh 0 · Debt Ksh {Math.abs(tx.final_payout)}</span>
                                    ) : `Ksh ${tx.final_payout}`}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ) : <p className="text-gray-400 text-sm mb-3">No jobs this period.</p>}

                        <h4 className="font-semibold mb-2 text-orange-500">Loans / Debts</h4>
                        {empDebts.filter(d => (d.balance || 0) > 0).length > 0 ? (
                          <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                              <thead>
                                <tr className="border-b"><th className="py-1">Date</th><th className="py-1">Service</th><th className="py-1">Notes</th><th className="py-1 text-right">Amount</th><th className="py-1 text-right">Balance</th></tr>
                              </thead>
                              <tbody>
                                {empDebts.filter(d => (d.balance || 0) > 0).map(d => (
                                  <tr key={d.id} className="border-b">
                                    <td className="py-1">{format(new Date(d.date), 'dd/MM/yyyy')}</td>
                                    <td className="py-1">{d.service || 'Loan'}</td>
                                    <td className="py-1 text-xs text-gray-500">{d.notes || '-'}</td>
                                    <td className="py-1 font-mono text-right">Ksh {d.amount}</td>
                                    <td className="py-1 font-mono font-bold text-right text-orange-600">Ksh {d.balance}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ) : <p className="text-gray-400 text-sm">No outstanding loans.</p>}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
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