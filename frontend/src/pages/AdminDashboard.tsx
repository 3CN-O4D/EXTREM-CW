import React, { useEffect, useState } from 'react';
import api from '../services/api';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { format, startOfWeek, addDays, isSameDay, addWeeks } from 'date-fns';
import { Link } from 'react-router-dom';
import {
  Banknote, Calculator, Calendar, Car, Check, ChevronDown, ChevronRight, Coins,
  Loader2, Pencil, PiggyBank, Plus, Printer, ReceiptText, RefreshCw, Sparkles,
  Trash2, TrendingUp, Users, Wallet, X,
} from 'lucide-react';
import { PageError, PageLoading, InlineError } from '../components/States';

const logoImg = '/images/logo.jpeg';

const EXPENSE_CATEGORIES = ['General', 'Soap', 'Water', 'Electricity', 'Rent', 'Salary', 'Chai', 'Other'];

const toNum = (v: any) => {
  const n = parseFloat(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

export default function AdminDashboard() {
  const [summary, setSummary] = useState<any>(null);
  const [employees, setEmployees] = useState<any[]>([]);
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [weekOffset, setWeekOffset] = useState(0);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [debts, setDebts] = useState<any[]>([]);
  const [repayments, setRepayments] = useState<any[]>([]);
  const [expandedEmp, setExpandedEmp] = useState<number | null>(null);
  const [empTxns, setEmpTxns] = useState<any[]>([]);
  const [empDebts, setEmpDebts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // expense tracking
  const [showExpense, setShowExpense] = useState(false);
  const [expenseForm, setExpenseForm] = useState({ description: '', amount: 0, category: 'General' });
  const [expenseSaving, setExpenseSaving] = useState(false);
  const [editingExp, setEditingExp] = useState<number | null>(null);
  const [expEdit, setExpEdit] = useState({ description: '', amount: 0, category: 'General' });

  const weekStart = startOfWeek(addWeeks(new Date(), weekOffset), { weekStartsOn: 1 });
  const weekId = format(weekStart, 'yyyy-II');
  const weekDays = [...Array(7)].map((_, i) => addDays(weekStart, i));

  const fetchStats = async () => {
    setLoading(true);
    setError('');
    const params: any = {};
    const txParams: any = {};
    if (selectedDay) {
      params.day = format(selectedDay, 'yyyy-MM-dd');
      txParams.day = params.day;
    } else {
      params.week_id = weekId;
      txParams.week_id = weekId;
    }
    try {
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
    } catch (err: any) {
      setError(
        err?.response?.data?.detail ||
        (err?.code === 'ECONNABORTED'
          ? 'The server took too long to respond.'
          : 'Could not reach the server. Check your connection and try again.')
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDay, weekOffset]);

  const loadEmployeeDetails = async (emp: any) => {
    if (expandedEmp === emp.id) { setExpandedEmp(null); setEmpTxns([]); setEmpDebts([]); return; }
    const q: any = { washer_id: emp.id };
    if (selectedDay) q.day = format(selectedDay, 'yyyy-MM-dd');
    else q.week_id = weekId;
    try {
      const [txRes, debtRes] = await Promise.all([
        api.get('/transactions/', { params: q }),
        api.get('/debts/', { params: { employee_id: emp.id } })
      ]);
      setEmpTxns(txRes.data);
      setEmpDebts(debtRes.data);
      setExpandedEmp(emp.id);
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Could not load employee details.');
    }
  };

  const addExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    setExpenseSaving(true);
    try {
      await api.post('/expenses/', expenseForm);
      setExpenseForm({ description: '', amount: 0, category: 'General' });
      setShowExpense(false);
      void fetchStats();
    } catch {
      alert('Could not log the expense');
    } finally {
      setExpenseSaving(false);
    }
  };

  const saveExpenseEdit = async (id: number) => {
    try {
      await api.put(`/expenses/${id}`, expEdit);
      setEditingExp(null);
      void fetchStats();
    } catch {
      alert('Could not update the expense');
    }
  };

  const deleteExpense = async (id: number) => {
    if (!confirm('Delete this expense?')) return;
    try {
      await api.delete(`/expenses/${id}`);
      void fetchStats();
    } catch {
      alert('Could not delete the expense');
    }
  };

  if (!summary && loading) return <PageLoading label="Loading the business overview..." />;
  if (!summary && error) return <PageError message={error} onRetry={fetchStats} />;
  if (!summary) return <PageError message="No summary came back from the server." onRetry={fetchStats} />;

  const totalJobs = employees.reduce((s, e) => s + (e.jobs_count || 0), 0);
  const mpesaTotal = Math.max(0, (summary.total_revenue || 0) - (summary.total_cash_received || 0));
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

  const scopeLabel = selectedDay
    ? `${format(selectedDay, 'EEEE, dd MMM yyyy')}`
    : `Week of ${format(weekStart, 'dd MMM')} — ${format(addDays(weekStart, 6), 'dd MMM yyyy')} (${weekId})`;

  const statGroups = [
    {
      label: 'Money in',
      items: [
        { title: 'Cash received', value: `Ksh ${summary.total_cash_received}`, icon: <Wallet size={14} />, cls: 'text-sky-600 dark:text-sky-400' },
        { title: 'M-Pesa received', value: `Ksh ${mpesaTotal}`, icon: <Banknote size={14} />, cls: 'text-brand-600 dark:text-brand-300' },
        { title: 'Total revenue', value: `Ksh ${summary.total_revenue}`, icon: <TrendingUp size={14} />, cls: 'text-emerald-600 dark:text-emerald-400' },
        { title: 'Misc income', value: `Ksh ${summary.misc_total ?? 0}`, icon: <Sparkles size={14} />, cls: 'text-indigo-600 dark:text-indigo-300' },
      ],
    },
    {
      label: 'Money out & profit',
      items: [
        { title: 'Expenses', value: `Ksh ${summary.total_expenses}`, icon: <ReceiptText size={14} />, cls: 'text-red-600 dark:text-red-400' },
        { title: 'Labor (gross)', value: `Ksh ${summary.total_labor_gross ?? summary.total_labor_expense}`, icon: <PiggyBank size={14} />, cls: 'text-violet-600 dark:text-violet-300' },
        { title: 'Shortfall withheld', value: `Ksh ${summary.total_shortfall_withheld ?? 0}`, icon: <PiggyBank size={14} />, cls: 'text-red-600 dark:text-red-400' },
        { title: 'Net wages', value: `Ksh ${summary.net_labor_wages ?? summary.total_labor_expense}`, icon: <PiggyBank size={14} />, cls: 'text-violet-600 dark:text-violet-300' },
        { title: 'Net cash', value: `Ksh ${summary.total_cash_received - summary.total_expenses}`, icon: <Wallet size={14} />, cls: (summary.total_cash_received - summary.total_expenses) >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400' },
        { title: 'Balance', value: `Ksh ${summary.balance}`, icon: <Coins size={14} />, cls: (summary.balance ?? 0) >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400' },
      ],
    },
    {
      label: 'Operations',
      items: [
        { title: 'Jobs', value: totalJobs, icon: <Car size={14} />, cls: 'text-slate-900 dark:text-white' },
        { title: 'Employee debts', value: `Ksh ${summary.total_debts}`, icon: <PiggyBank size={14} />, cls: 'text-orange-600 dark:text-orange-400' },
        { title: 'Client debts', value: `Ksh ${summary.total_client_debts ?? 0}`, icon: <PiggyBank size={14} />, cls: 'text-rose-600 dark:text-rose-400' },
        { title: 'Debtors', value: debtors.length, icon: <Users size={14} />, cls: 'text-fuchsia-600 dark:text-fuchsia-400' },
        { title: 'Repayments', value: `Ksh ${repayments.reduce((s, r) => s + r.amount, 0)}`, icon: <Coins size={14} />, cls: 'text-teal-600 dark:text-teal-400' },
      ],
    },
  ];

  return (
    <div className="space-y-6 print:p-0">
      {error && <InlineError message={error} onRetry={fetchStats} />}

      {/* Print header */}
      <div className="hidden print:flex print:items-center print:justify-center print:gap-4 print:mb-4 print:border-b print:pb-4">
        <img src={logoImg} alt="EXTREME" className="h-16 object-contain" />
        <div className="text-center">
          <h1 className="text-2xl font-bold text-blue-600">EXTREME AUTO CARWASH</h1>
          <p className="text-sm text-gray-600">Eldoret, Annex, Jamboni</p>
          <p className="text-xs text-gray-500">+254 728 597 862</p>
        </div>
      </div>

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-brand-600 dark:text-brand-400">
            Admin overview
          </p>
          <h1 className="section-title mt-1">Business Overview</h1>
          <p className="muted mt-0.5 text-xs">{scopeLabel}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => void fetchStats()} className="btn-secondary px-3 py-2 text-xs">
            <RefreshCw size={13} /> Refresh
          </button>
          <button onClick={() => setShowExpense(true)} className="btn-primary px-3 py-2 text-xs">
            <Plus size={13} /> Add expense
          </button>
          <Link to="/manage" className="btn-secondary px-3 py-2 text-xs">
            <Calculator size={13} /> Manager panel
          </Link>
          <Link to="/employees" className="btn-secondary px-3 py-2 text-xs">
            <Users size={13} /> Employees
          </Link>
          <button onClick={() => window.print()} className="btn-secondary px-3 py-2 text-xs">
            <Printer size={13} /> Report
          </button>
        </div>
      </div>

      {/* Scope navigation */}
      <div className="flex flex-wrap items-center gap-2 print:hidden">
        <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white p-1 dark:border-white/10 dark:bg-slate-900/60">
          <button
            onClick={() => { setSelectedDay(null); setWeekOffset(o => o - 1); }}
            className="rounded-lg px-2.5 py-1.5 text-sm font-bold text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10"
          >&lt;</button>
          <span className="whitespace-nowrap px-1 text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
            <Calendar size={12} className="mr-1 inline -translate-y-px" />
            Week {weekId}
          </span>
          <button
            onClick={() => { setSelectedDay(null); setWeekOffset(o => o + 1); }}
            className="rounded-lg px-2.5 py-1.5 text-sm font-bold text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10"
          >&gt;</button>
        </div>
        <button
          onClick={() => { setSelectedDay(null); setWeekOffset(0); }}
          className={`rounded-xl px-3 py-2 text-xs font-bold transition ${
            !selectedDay && weekOffset === 0
              ? 'bg-brand-600 text-white shadow-md shadow-brand-500/20'
              : 'border border-slate-200 bg-white text-slate-600 hover:border-brand-300 dark:border-white/10 dark:bg-white/5 dark:text-slate-300'
          }`}
        >
          This week
        </button>
        {weekDays.map(day => (
          <button
            key={day.toISOString()}
            onClick={() => setSelectedDay(day)}
            className={`whitespace-nowrap rounded-xl px-3 py-2 text-xs font-bold transition ${
              selectedDay && isSameDay(selectedDay, day)
                ? 'bg-brand-600 text-white shadow-md shadow-brand-500/20'
                : 'border border-slate-200 bg-white text-slate-600 hover:border-brand-300 dark:border-white/10 dark:bg-white/5 dark:text-slate-300'
            }`}
          >
            {format(day, 'EEE (dd/MM)')}
          </button>
        ))}
      </div>

      {/* Stats, grouped so the numbers read in a sensible order */}
      <section className="card-pad space-y-4">
        {statGroups.map(group => (
          <div key={group.label}>
            <div className="mb-2 flex items-center gap-2">
              <h2 className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-slate-400">{group.label}</h2>
              <span className="h-px flex-1 bg-slate-100 dark:bg-white/10" />
            </div>
            <div className="stat-grid xl:grid-cols-4">
              {group.items.map(s => (
                <StatCard key={s.title} title={s.title} value={s.value} icon={s.icon} cls={s.cls} />
              ))}
            </div>
          </div>
        ))}
      </section>

      {/* Quick actions */}
      <div className="flex flex-wrap gap-2 print:hidden">
        <button onClick={() => setShowExpense(true)} className="btn-primary px-3 py-2 text-xs">
          <Plus size={13} /> Add expense
        </button>
        <button onClick={() => { setSelectedDay(null); setWeekOffset(0); }} className="btn-secondary px-3 py-2 text-xs">
          <Calendar size={13} /> Current week
        </button>
        <Link to="/manage" className="btn-secondary px-3 py-2 text-xs">
          <Calculator size={13} /> Open day sheet
        </Link>
      </div>

      {/* Expenses tracker */}
      <div className="card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/80 px-5 py-4 dark:border-white/10">
          <div>
            <h2 className="text-lg font-black tracking-tight">Expenses tracker</h2>
            <p className="muted text-xs">Every shilling out, editable and deletable.</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-bold text-red-600 dark:bg-red-500/10 dark:text-red-300">
              Total: Ksh {expenses.reduce((s, e) => s + e.amount, 0)}
            </span>
            <button onClick={() => setShowExpense(true)} className="btn-primary px-3 py-1.5 text-xs">
              <Plus size={13} /> Add
            </button>
          </div>
        </div>

        {Object.keys(expByCat).length > 0 && (
          <div className="flex flex-wrap gap-1.5 border-b border-slate-200/80 px-5 py-3 dark:border-white/10">
            {Object.entries(expByCat).map(([cat, amt]: any) => (
              <span key={cat} className="rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-semibold text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
                {cat}: Ksh {amt}
              </span>
            ))}
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200/80 bg-slate-50 dark:border-white/10 dark:bg-white/5">
                <th className="px-4 py-2 text-xs font-bold uppercase tracking-wider text-slate-500">Time</th>
                <th className="px-4 py-2 text-xs font-bold uppercase tracking-wider text-slate-500">Description</th>
                <th className="px-4 py-2 text-xs font-bold uppercase tracking-wider text-slate-500">Category</th>
                <th className="px-4 py-2 text-right text-xs font-bold uppercase tracking-wider text-slate-500">Amount</th>
                <th className="px-2 py-2 text-right text-xs font-bold uppercase tracking-wider text-slate-500">Actions</th>
              </tr>
            </thead>
            <tbody>
              {expenses.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">No expenses this period.</td></tr>
              )}
              {expenses.map(e => (
                editingExp === e.id ? (
                  <tr key={e.id} className="border-b border-slate-200/70 bg-amber-50/60 dark:border-white/10 dark:bg-amber-400/5">
                    <td className="px-4 py-2 text-xs">{format(new Date(e.timestamp), 'EEE dd/MM HH:mm')}</td>
                    <td className="px-4 py-2">
                      <input className="input-base px-2 py-1 text-sm" value={expEdit.description}
                        onChange={ev => setExpEdit({ ...expEdit, description: ev.target.value })} />
                    </td>
                    <td className="px-4 py-2">
                      <select className="input-base px-2 py-1 text-sm" value={expEdit.category}
                        onChange={ev => setExpEdit({ ...expEdit, category: ev.target.value })}>
                        {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </td>
                    <td className="px-4 py-2 text-right">
                      <input type="number" min="0" className="input-base w-24 px-2 py-1 text-right font-mono text-sm" value={expEdit.amount}
                        onChange={ev => setExpEdit({ ...expEdit, amount: toNum(ev.target.value) })} />
                    </td>
                    <td className="px-2 py-2 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => saveExpenseEdit(e.id)} title="Save"
                          className="rounded-lg bg-emerald-600 p-1.5 text-white transition hover:bg-emerald-700"><Check size={13} /></button>
                        <button onClick={() => setEditingExp(null)} title="Cancel"
                          className="rounded-lg bg-slate-400 p-1.5 text-white transition hover:bg-slate-500"><X size={13} /></button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  <tr key={e.id} className="border-b border-slate-200/70 transition hover:bg-slate-50/70 dark:border-white/10 dark:hover:bg-white/[0.03]">
                    <td className="px-4 py-2 text-xs">{format(new Date(e.timestamp), 'EEE dd/MM HH:mm')}</td>
                    <td className="px-4 py-2 font-medium">{e.description}</td>
                    <td className="px-4 py-2">
                      <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-700 dark:bg-red-500/10 dark:text-red-300">{e.category}</span>
                    </td>
                    <td className="px-4 py-2 text-right font-mono font-bold text-red-600 dark:text-red-400">Ksh {e.amount}</td>
                    <td className="px-2 py-2 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => { setEditingExp(e.id); setExpEdit({ description: e.description, amount: e.amount, category: e.category }); }} title="Edit expense"
                          className="rounded-lg p-1.5 text-slate-400 transition hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-500/10 dark:hover:text-blue-300"><Pencil size={14} /></button>
                        <button onClick={() => deleteExpense(e.id)} title="Delete expense"
                          className="rounded-lg p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10 dark:hover:text-red-300"><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                )
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Service counts + financial status */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="card-pad">
          <h2 className="text-lg font-black tracking-tight text-brand-600 dark:text-brand-300">Service counts</h2>
          <div className="mt-4 grid grid-cols-2 gap-3">
            {Object.entries(summary.category_counts || {}).map(([cat, count]: any) => (
              <div key={cat} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 dark:border-white/10 dark:bg-white/5">
                <span className="text-sm font-semibold capitalize">{cat === 'other' ? 'Others' : cat}</span>
                <span className="rounded-lg bg-brand-50 px-2.5 py-1 text-sm font-black text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">{count}</span>
              </div>
            ))}
            {Object.keys(summary.category_counts || {}).length === 0 && (
              <p className="muted col-span-2 text-sm">No jobs logged in this period.</p>
            )}
          </div>
        </div>

        <div className="card-pad">
          <h2 className="text-lg font-black tracking-tight">Financial status</h2>
          <div className="mt-4 space-y-2.5">
            <div className="flex justify-between text-sm"><span className="muted">Cash received</span> <span className="font-mono font-bold">Ksh {summary.total_cash_received}</span></div>
            <div className="flex justify-between text-sm"><span className="muted">M-Pesa received</span> <span className="font-mono font-bold">Ksh {mpesaTotal}</span></div>
            <div className="flex justify-between text-sm"><span className="muted">Operating expenses</span> <span className="font-mono font-bold text-red-600">Ksh {summary.total_expenses}</span></div>
            <div className="flex justify-between text-sm"><span className="muted">Misc income</span> <span className="font-mono font-bold">Ksh {summary.misc_total ?? 0}</span></div>
            <div className="flex justify-between border-t border-slate-200 pt-3 text-base font-black dark:border-white/10">
              <span>Balance</span>
              <span className={summary.balance >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}>Ksh {summary.balance}</span>
            </div>
          </div>
          <div className="mt-5 border-t border-slate-200 pt-4 dark:border-white/10">
            <h3 className="mb-2 text-sm font-black uppercase tracking-wider text-slate-500">Labor breakdown</h3>
            {summary.labor_breakdown && summary.labor_breakdown.length > 0 ? (
              <div className="space-y-1.5">
                {summary.labor_breakdown.map((e: any) => (
                  <div key={e.abbreviation} className="flex justify-between text-sm">
                    <span>{e.name} <span className="muted">({e.abbreviation})</span></span>
                    <span className="font-mono">
                      Ksh {e.gross ?? e.wages}
                      {Number(e.shortfall) > 0 && (
                        <span className="ml-1 text-xs text-red-600 dark:text-red-400">−{e.shortfall}</span>
                      )}
                    </span>
                  </div>
                ))}
                <div className="flex justify-between border-t border-slate-200 pt-2 text-sm font-black dark:border-white/10">
                  <span>Gross wages</span>
                  <span className="font-mono">Ksh {summary.total_labor_gross ?? summary.total_labor_expense}</span>
                </div>
                <div className="flex justify-between text-sm font-bold text-red-600 dark:text-red-400">
                  <span>Shortfall withheld</span>
                  <span className="font-mono">−Ksh {summary.total_shortfall_withheld ?? 0}</span>
                </div>
                <div className="flex justify-between text-sm font-black">
                  <span>Net wages</span>
                  <span className="font-mono">Ksh {summary.net_labor_wages ?? summary.total_labor_expense}</span>
                </div>
              </div>
            ) : <p className="muted text-sm">No labor costs.</p>}
          </div>
        </div>
      </div>

      {/* Misc income */}
      <div className="card overflow-hidden">
        <div className="border-b border-slate-200/80 px-5 py-4 dark:border-white/10">
          <h2 className="text-lg font-black tracking-tight text-indigo-600 dark:text-indigo-300">Miscellaneous income</h2>
          <p className="muted text-xs">Extra income such as custom jobs logged by the team.</p>
        </div>
        {summary.misc_items && summary.misc_items.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200/80 bg-slate-50 dark:border-white/10 dark:bg-white/5">
                  <th className="px-4 py-2 text-xs font-bold uppercase tracking-wider text-slate-500">Date</th>
                  <th className="px-4 py-2 text-xs font-bold uppercase tracking-wider text-slate-500">Description</th>
                  <th className="px-4 py-2 text-xs font-bold uppercase tracking-wider text-slate-500">Vehicle</th>
                  <th className="px-4 py-2 text-xs font-bold uppercase tracking-wider text-slate-500">Washer</th>
                  <th className="px-4 py-2 text-right text-xs font-bold uppercase tracking-wider text-slate-500">Amount</th>
                </tr>
              </thead>
              <tbody>
                {summary.misc_items.map((m: any) => (
                  <tr key={m.id} className="border-b border-slate-200/70 transition hover:bg-slate-50/70 dark:border-white/10 dark:hover:bg-white/[0.03]">
                    <td className="px-4 py-2 text-xs">{format(new Date(m.timestamp), 'EEE dd/MM HH:mm')}</td>
                    <td className="px-4 py-2">{m.description || '-'}</td>
                    <td className="px-4 py-2 font-mono text-xs text-slate-500">{m.plate_number || (m.custom_category || m.category)}</td>
                    <td className="px-4 py-2 text-xs">{m.washer || '-'}</td>
                    <td className="px-4 py-2 text-right font-mono font-bold">Ksh {m.amount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="muted px-5 py-6 text-sm">No miscellaneous income in this period.</p>}
      </div>

      {/* Debts & debtors */}
      <div className="card overflow-hidden">
        <div className="border-b border-slate-200/80 px-5 py-4 dark:border-white/10">
          <h2 className="text-lg font-black tracking-tight text-orange-500">Debts & debtors</h2>
          <p className="muted text-xs">Employee advances and shortfalls, with repayments in the period.</p>
        </div>
        {debtors.length > 0 ? (
          <div className="flex flex-wrap gap-2 px-5 py-3">
            {debtors.map((d: any) => (
              <span key={d.name} className="rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-xs font-semibold text-orange-700 dark:border-orange-500/30 dark:bg-orange-500/10 dark:text-orange-300">
                {d.name}: <b>Ksh {d.total}</b>
              </span>
            ))}
          </div>
        ) : <p className="muted px-5 py-3 text-sm">No outstanding debts. All clear!</p>}

        {Object.keys(debtByEmp).length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200/80 bg-slate-50 dark:border-white/10 dark:bg-white/5">
                  <th className="px-4 py-2 text-xs font-bold uppercase tracking-wider text-slate-500">Loan date</th>
                  <th className="px-4 py-2 text-xs font-bold uppercase tracking-wider text-slate-500">Employee</th>
                  <th className="px-4 py-2 text-xs font-bold uppercase tracking-wider text-slate-500">Service</th>
                  <th className="px-4 py-2 text-xs font-bold uppercase tracking-wider text-slate-500">Notes</th>
                  <th className="px-4 py-2 text-right text-xs font-bold uppercase tracking-wider text-slate-500">Amount</th>
                  <th className="px-4 py-2 text-right text-xs font-bold uppercase tracking-wider text-slate-500">Paid</th>
                  <th className="px-4 py-2 text-right text-xs font-bold uppercase tracking-wider text-slate-500">Balance</th>
                </tr>
              </thead>
              <tbody>
                {Object.values(debtByEmp).flatMap((d: any) => d.items).map(d => (
                  <tr key={d.id} className="border-b border-slate-200/70 transition hover:bg-slate-50/70 dark:border-white/10 dark:hover:bg-white/[0.03]">
                    <td className="px-4 py-2 text-xs">{format(new Date(d.date), 'EEE dd/MM/yyyy')}</td>
                    <td className="px-4 py-2 font-medium">{empName(d.employee_id)}</td>
                    <td className="px-4 py-2">{d.service || 'Loan'}</td>
                    <td className="px-4 py-2 text-xs text-slate-500">{d.notes || '-'}</td>
                    <td className="px-4 py-2 text-right font-mono">Ksh {d.amount}</td>
                    <td className="px-4 py-2 text-right font-mono">Ksh {d.paid}</td>
                    <td className="px-4 py-2 text-right font-mono font-bold text-orange-600 dark:text-orange-400">Ksh {d.balance}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="border-t border-slate-200/80 px-5 py-4 dark:border-white/10">
          <h3 className="mb-3 text-sm font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Repayments this period</h3>
          {repayments.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200/80 dark:border-white/10">
                    <th className="py-2 text-xs font-bold uppercase tracking-wider text-slate-500">Date</th>
                    <th className="py-2 text-xs font-bold uppercase tracking-wider text-slate-500">Employee</th>
                    <th className="py-2 text-right text-xs font-bold uppercase tracking-wider text-slate-500">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {repayments.map(r => (
                    <tr key={r.id} className="border-b border-slate-200/70 dark:border-white/10">
                      <td className="py-2 text-xs">{format(new Date(r.timestamp), 'EEE dd/MM HH:mm')}</td>
                      <td className="py-2">{r.employee_name} ({r.abbreviation})</td>
                      <td className="py-2 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">Ksh {r.amount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <p className="muted text-sm">No repayments this period.</p>}
        </div>
      </div>

      {/* Employee performance */}
      <div className="card-pad">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-black tracking-tight">Employee performance</h2>
          <span className="muted text-xs">{employees.length} employees</span>
        </div>
        <div className="mt-4 h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={employees}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(100,116,139,0.2)" />
              <XAxis dataKey="abbreviation" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="revenue_generated" fill="#09b3ff" name="Revenue" radius={[6, 6, 0, 0]} />
              <Bar dataKey="wages_earned" fill="#10b981" name="Wages" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200/80 dark:border-white/10">
                <th className="py-2 text-xs font-bold uppercase tracking-wider text-slate-500">Employee</th>
                <th className="py-2 text-right text-xs font-bold uppercase tracking-wider text-slate-500">Jobs</th>
                <th className="py-2 text-right text-xs font-bold uppercase tracking-wider text-slate-500">Revenue</th>
                <th className="py-2 text-right text-xs font-bold uppercase tracking-wider text-slate-500">Wages</th>
                <th className="py-2 text-right text-xs font-bold uppercase tracking-wider text-slate-500">Shortfall</th>
                <th className="py-2 text-right text-xs font-bold uppercase tracking-wider text-slate-500">Debt</th>
                <th className="py-2 text-right text-xs font-bold uppercase tracking-wider text-slate-500">Carpets Rcv/Rel</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {employees.map(emp => (
                <React.Fragment key={emp.id}>
                  <tr className="border-b border-slate-200/70 transition hover:bg-slate-50/70 dark:border-white/10 dark:hover:bg-white/[0.03]">
                    <td className="py-2 font-medium">{emp.name} <span className="muted text-xs">({emp.abbreviation})</span></td>
                    <td className="py-2 text-right font-mono">{emp.jobs_count}</td>
                    <td className="py-2 text-right font-mono">Ksh {emp.revenue_generated}</td>
                    <td className="py-2 text-right font-mono text-emerald-600 dark:text-emerald-400">Ksh {emp.wages_earned}</td>
                    <td className="py-2 text-right font-mono text-red-500">Ksh {emp.shortfall_total}</td>
                    <td className="py-2 text-right font-mono text-orange-500">Ksh {emp.current_debt}</td>
                    <td className="py-2 text-right font-mono">{emp.carpets_received}/{emp.carpets_released}</td>
                    <td className="py-2 text-right">
                      <button onClick={() => loadEmployeeDetails(emp)} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold text-brand-600 transition hover:bg-brand-50 dark:text-brand-300 dark:hover:bg-brand-500/10">
                        {expandedEmp === emp.id ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        {expandedEmp === emp.id ? 'Hide' : 'Details'}
                      </button>
                    </td>
                  </tr>
                  {expandedEmp === emp.id && (
                    <tr className="border-b border-slate-200/70 bg-slate-50/70 dark:border-white/10 dark:bg-white/[0.03]">
                      <td colSpan={8} className="p-4">
                        <h4 className="mb-2 text-sm font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Wage breakdown (per day)</h4>
                        {emp.wage_breakdown?.length > 0 ? (
                          <div className="mb-4 flex flex-wrap gap-2">
                            {emp.wage_breakdown.map((d: any) => (
                              <span key={d.day} className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">
                                {format(new Date(d.day), 'EEE dd/MM')}: <b>Ksh {d.wages}</b>
                              </span>
                            ))}
                          </div>
                        ) : <p className="muted mb-3 text-sm">No wages this period.</p>}

                        <h4 className="mb-2 text-sm font-black uppercase tracking-wider text-slate-500">Jobs this period</h4>
                        {empTxns.length > 0 ? (
                          <div className="mb-4 overflow-x-auto">
                            <table className="w-full text-left text-sm">
                              <thead>
                                <tr className="border-b border-slate-200/80 dark:border-white/10">
                                  <th className="py-1 text-xs font-bold uppercase tracking-wider text-slate-500">Time</th>
                                  <th className="py-1 text-xs font-bold uppercase tracking-wider text-slate-500">Category</th>
                                  <th className="py-1 text-xs font-bold uppercase tracking-wider text-slate-500">Plate/Item</th>
                                  <th className="py-1 text-right text-xs font-bold uppercase tracking-wider text-slate-500">Expected</th>
                                  <th className="py-1 text-right text-xs font-bold uppercase tracking-wider text-slate-500">Paid</th>
                                  <th className="py-1 text-right text-xs font-bold uppercase tracking-wider text-slate-500">Shortfall</th>
                                  <th className="py-1 text-right text-xs font-bold uppercase tracking-wider text-slate-500">Payout</th>
                                </tr>
                              </thead>
                              <tbody>
                                {empTxns.map(tx => (
                                  <tr key={tx.id} className="border-b border-slate-200/70 dark:border-white/10">
                                    <td className="py-1 text-xs">{format(new Date(tx.timestamp), 'EEE dd/MM HH:mm')}</td>
                                    <td className="py-1 capitalize">{tx.custom_category || tx.category}</td>
                                    <td className="py-1 font-mono text-xs">{tx.category === 'other' ? (tx.custom_category || '-') : (tx.plate_number || '-')}</td>
                                    <td className="py-1 text-right font-mono">Ksh {tx.expected_price}</td>
                                    <td className="py-1 text-right font-mono">Ksh {tx.total_paid}</td>
                                    <td className="py-1 text-right font-mono text-red-500">{(tx.shortfall || 0) > 0 ? `Ksh ${tx.shortfall}` : '-'}</td>
                                    <td className="py-1 text-right font-mono font-bold">{tx.final_payout < 0 ? (
                                      <span className="text-red-500">Ksh 0 · Debt Ksh {Math.abs(tx.final_payout)}</span>
                                    ) : `Ksh ${tx.final_payout}`}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ) : <p className="muted mb-3 text-sm">No jobs this period.</p>}

                        <h4 className="mb-2 text-sm font-black uppercase tracking-wider text-orange-500">Loans / debts</h4>
                        {empDebts.filter(d => (d.balance || 0) > 0).length > 0 ? (
                          <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                              <thead>
                                <tr className="border-b border-slate-200/80 dark:border-white/10">
                                  <th className="py-1 text-xs font-bold uppercase tracking-wider text-slate-500">Date</th>
                                  <th className="py-1 text-xs font-bold uppercase tracking-wider text-slate-500">Service</th>
                                  <th className="py-1 text-xs font-bold uppercase tracking-wider text-slate-500">Notes</th>
                                  <th className="py-1 text-right text-xs font-bold uppercase tracking-wider text-slate-500">Amount</th>
                                  <th className="py-1 text-right text-xs font-bold uppercase tracking-wider text-slate-500">Balance</th>
                                </tr>
                              </thead>
                              <tbody>
                                {empDebts.filter(d => (d.balance || 0) > 0).map(d => (
                                  <tr key={d.id} className="border-b border-slate-200/70 dark:border-white/10">
                                    <td className="py-1">{format(new Date(d.date), 'dd/MM/yyyy')}</td>
                                    <td className="py-1">{d.service || 'Loan'}</td>
                                    <td className="py-1 text-xs text-slate-500">{d.notes || '-'}</td>
                                    <td className="py-1 text-right font-mono">Ksh {d.amount}</td>
                                    <td className="py-1 text-right font-mono font-bold text-orange-600 dark:text-orange-400">Ksh {d.balance}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ) : <p className="muted text-sm">No outstanding loans.</p>}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add-expense modal */}
      {showExpense && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm print:hidden">
          <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-white/10 dark:bg-slate-900">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-black tracking-tight">Log a business expense</h3>
                <p className="muted text-xs">Water, soap, rent, chai — track every shilling out.</p>
              </div>
              <button onClick={() => setShowExpense(false)} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={addExpense} className="space-y-4">
              <label className="block">
                <span className="mb-1 block text-sm font-semibold text-slate-700 dark:text-slate-300">Description</span>
                <input className="input-base" placeholder="e.g. Soap bucket, water refill" value={expenseForm.description}
                  onChange={e => setExpenseForm({ ...expenseForm, description: e.target.value })} required />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="mb-1 block text-sm font-semibold text-slate-700 dark:text-slate-300">Amount (Ksh)</span>
                  <input type="number" min="0" className="input-base" value={expenseForm.amount}
                    onChange={e => setExpenseForm({ ...expenseForm, amount: toNum(e.target.value) })} required />
                </label>
                <label className="block">
                  <span className="mb-1 block text-sm font-semibold text-slate-700 dark:text-slate-300">Category</span>
                  <select className="input-base" value={expenseForm.category}
                    onChange={e => setExpenseForm({ ...expenseForm, category: e.target.value })}>
                    {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </label>
              </div>
              <button type="submit" disabled={expenseSaving} className="btn-primary w-full justify-center py-3">
                {expenseSaving ? <Loader2 size={15} className="animate-spin" /> : <ReceiptText size={15} />}
                Save expense
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ title, value, icon, cls }: any) {
  return (
    <div className="stat-tile">
      <div className="flex items-center gap-1.5">
        <span className="shrink-0 text-slate-400 dark:text-slate-500">{icon}</span>
        <span className="stat-label">{title}</span>
      </div>
      <p className={`mt-1 truncate text-base font-extrabold tracking-tight sm:text-lg ${cls}`}>{value}</p>
    </div>
  );
}
