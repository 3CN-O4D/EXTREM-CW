import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { format, startOfWeek, addDays, isSameDay, addWeeks } from 'date-fns';
import { Calendar, ChevronLeft, ChevronRight, Loader2, Trash2, X } from 'lucide-react';
import { InlineError } from '../components/States';
import DaySheet from '../components/DaySheet';
import DayStats from '../components/DayStats';
import PricesPanel from './PricesPanel';

const toNum = (v: any) => { const n = parseInt(v); return isNaN(n) ? 0 : Math.max(0, n); };

const EXPENSE_CATEGORIES = ['General', 'Soap', 'Water', 'Electricity', 'Rent', 'Salary'];

export default function ManagerPanel() {
  const [employees, setEmployees] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [selectedDay, setSelectedDay] = useState<Date>(new Date());
  const [viewMode, setViewMode] = useState<'day' | 'week'>('day');
  const [weekOffset, setWeekOffset] = useState(0);
  const [editingTx, setEditingTx] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<any>({});
  const [loadError, setLoadError] = useState('');

  const [tipForm, setTipForm] = useState({ employee_id: '', amount: 0, method: 'wages' });
  const [expenseForm, setExpenseForm] = useState({ description: '', amount: 0, category: 'General' });
  const [expenses, setExpenses] = useState<any[]>([]);
  const [repaymentForm, setRepaymentForm] = useState({ employee_id: '', amount: 0 });
  const [activeTab, setActiveTab] = useState<'sheet' | 'expense' | 'repayment' | 'tip' | 'debt' | 'payday' | 'client-debts' | 'arrivals' | 'prices'>('sheet');
  const [debts, setDebts] = useState<any[]>([]);
  const [debtForm, setDebtForm] = useState({
    debtor_type: 'employee', employee_id: '', other_name: '', amount: 0, service: '', paid: 0, paid_date: '', notes: ''
  });
  const [editingDebt, setEditingDebt] = useState<number | null>(null);
  const [debtEdit, setDebtEdit] = useState({ amount: 0, paid: 0 });
  const [arrivals, setArrivals] = useState<any[]>([]);
  const [settlementLogs, setSettlementLogs] = useState<any[]>([]);
  const [settlementResult, setSettlementResult] = useState<any>(null);
  const [clientDebts, setClientDebts] = useState<any[]>([]);
  const [clientDebtForm, setClientDebtForm] = useState({
    client_name: '', customer_phone: '', description: '', amount: 0, date: format(new Date(), 'yyyy-MM-dd')
  });
  const [summary, setSummary] = useState<any>(null);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [dayCarpets, setDayCarpets] = useState<any>(null);
  const [dailySummaries, setDailySummaries] = useState<any[]>([]);

  const empMap = Object.fromEntries(employees.map(e => [e.id, e.name]));
  const abbrMap = Object.fromEntries(employees.map(e => [e.id, e.abbreviation]));

  useEffect(() => {
    api.get('/stats/employees', { params: { basic: 1 } })
      .then(res => setEmployees(res.data))
      .catch((err: any) => setLoadError(err?.response?.data?.detail || 'Could not load employees.'));
  }, []);

  const fetchTransactions = async () => {
    const params: any = {};
    if (viewMode === 'day') {
      params.day = format(selectedDay, 'yyyy-MM-dd');
    } else {
      const weekStart = startOfWeek(addWeeks(new Date(), weekOffset), { weekStartsOn: 1 });
      params.week_id = format(weekStart, 'yyyy-II');
    }
    try {
      const res = await api.get('/transactions/', { params });
      setTransactions(res.data);
      setLoadError('');
    } catch (err: any) {
      setLoadError(
        err?.response?.data?.detail ||
        (err?.code === 'ECONNABORTED'
          ? 'The server took too long to respond.'
          : 'Could not reach the server. Check your connection and try again.')
      );
    }
  };

  const fetchSummary = async () => {
    const params: any = {};
    if (viewMode === 'day') {
      params.day = format(selectedDay, 'yyyy-MM-dd');
    } else {
      const weekStart = startOfWeek(addWeeks(new Date(), weekOffset), { weekStartsOn: 1 });
      params.week_id = format(weekStart, 'yyyy-II');
    }
    try {
      const res = await api.get('/stats/summary', { params });
      setSummary(res.data);
    } catch {}
  };

  // Carpets received / released for the selected day (or the live aggregate
  // while in week view).
  const fetchDayCarpets = async () => {
    const params: any = {};
    if (viewMode === 'day') {
      params.day = format(selectedDay, 'yyyy-MM-dd');
    } else {
      const weekStart = startOfWeek(addWeeks(new Date(), weekOffset), { weekStartsOn: 1 });
      params.week_id = format(weekStart, 'yyyy-II');
    }
    try {
      const res = await api.get('/carpets/stats', { params });
      setDayCarpets(res.data);
    } catch {
      setDayCarpets(null);
    }
  };

  const fetchDailySummaries = async () => {
    if (viewMode !== 'week') {
      setDailySummaries([]);
      return;
    }
    const weekStart = startOfWeek(addWeeks(new Date(), weekOffset), { weekStartsOn: 1 });
    const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
    try {
      const results = await Promise.all(
        days.map((d) =>
          api
            .get('/stats/summary', { params: { day: format(d, 'yyyy-MM-dd') } })
            .then((res) => ({ date: format(d, 'yyyy-MM-dd'), data: res.data }))
            .catch(() => ({ date: format(d, 'yyyy-MM-dd'), data: null }))
        )
      );
      setDailySummaries(results);
    } catch {
      setDailySummaries([]);
    }
  };

  useEffect(() => {
    fetchTransactions();
    fetchSummary();
    fetchDayCarpets();
    fetchDailySummaries();
  }, [selectedDay, viewMode, weekOffset]);

  const fetchDebts = async () => {
    try {
      const res = await api.get('/debts/');
      setDebts(res.data);
    } catch {}
  };

  useEffect(() => { if (activeTab === 'debt') fetchDebts(); }, [activeTab]);

  // ---------- tab data loads lazily so /manage opens with only what it needs ----------

  const handleExpenseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/expenses/', expenseForm);
      alert('Expense logged!');
      setExpenseForm({ description: '', amount: 0, category: 'General' });
      const params = viewMode === 'day' ? { day: format(selectedDay, 'yyyy-MM-dd') } : {};
      api.get('/expenses/', { params }).then(r => setExpenses(r.data));
    } catch { alert('Error logging expense'); }
  };

  const handleDeleteExpense = async (id: number) => {
    if (!confirm('Delete this expense?')) return;
    try {
      await api.delete(`/expenses/${id}`);
      const params = viewMode === 'day' ? { day: format(selectedDay, 'yyyy-MM-dd') } : {};
      api.get('/expenses/', { params }).then(r => setExpenses(r.data));
    } catch { alert('Could not delete the expense'); }
  };

  const handleRepaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/repayments/', {
        employee_id: toNum(repaymentForm.employee_id),
        amount: toNum(repaymentForm.amount)
      });
      alert('Repayment logged!');
      setRepaymentForm({ employee_id: '', amount: 0 });
      api.get('/stats/employees', { params: { basic: 1 } }).then(res => setEmployees(res.data));
    } catch { alert('Error logging repayment'); }
  };

  const handleTipSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/tips/', {
        employee_id: toNum(tipForm.employee_id),
        amount: toNum(tipForm.amount),
        method: tipForm.method
      });
      alert('Tip logged!');
      setTipForm({ employee_id: '', amount: 0, method: 'wages' });
      api.get('/stats/employees', { params: { basic: 1 } }).then(res => setEmployees(res.data));
    } catch { alert('Error logging tip'); }
  };

  const fetchArrivals = async () => {
    try { const res = await api.get('/vehicles/'); setArrivals(res.data); } catch {}
  };

  useEffect(() => { if (activeTab === 'arrivals') fetchArrivals(); }, [activeTab]);

  const settleArrivalFor = async (id: number, cash: number, mpesa: number, washerId: number | null) => {
    try {
      await api.post(`/vehicles/${id}/settle`, {
        cash_paid: cash,
        mpesa_paid: mpesa,
        ...(washerId ? { washer_id: washerId } : {}),
      });
      fetchArrivals();
      fetchTransactions();
    } catch (e: any) { alert(e.response?.data?.detail || 'Could not record the payment'); }
  };

  const handleDebtSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload: any = {
        amount: toNum(debtForm.amount),
        service: debtForm.service || null,
        paid: toNum(debtForm.paid),
        paid_date: debtForm.paid_date || null,
      };
      if (debtForm.debtor_type === 'employee') {
        payload.employee_id = toNum(debtForm.employee_id) || null;
      } else {
        payload.employee_id = null;
        payload.other_name = debtForm.other_name || null;
      }
      await api.post('/debts/', payload);
      alert('Debt logged!');
      setDebtForm({ debtor_type: 'employee', employee_id: '', other_name: '', amount: 0, service: '', paid: 0, paid_date: '', notes: '' });
      fetchDebts();
    } catch { alert('Error logging debt'); }
  };

  const weekStart = startOfWeek(addWeeks(new Date(), weekOffset), { weekStartsOn: 1 });
  const weekDays = [...Array(7)].map((_, i) => addDays(weekStart, i));
  const weekId = format(weekStart, 'yyyy-II');

  const fetchSettlements = async () => {
    try { const res = await api.get('/settlements/'); setSettlementLogs(res.data); } catch {}
  };
  const fetchClientDebts = async () => {
    try { const res = await api.get('/client-debts/'); setClientDebts(res.data); } catch {}
  };

  useEffect(() => { if (activeTab === 'payday') fetchSettlements(); }, [activeTab]);
  useEffect(() => { if (activeTab === 'client-debts') fetchClientDebts(); }, [activeTab]);
  useEffect(() => {
    if (activeTab !== 'expense') return;
    const params = viewMode === 'day' ? { day: format(selectedDay, 'yyyy-MM-dd') } : {};
    api.get('/expenses/', { params }).then((r) => setExpenses(r.data)).catch(() => {});
  }, [activeTab, viewMode, selectedDay]);

  const handleSettleWeek = async () => {
    if (!confirm(`Run payday for the week of ${format(weekStart, 'PPP')} (${weekId})?\n\nEveryone's weekly wages are paid out after covering ALL open debts. Anything short carries forward; payable balance resets to zero so Monday starts fresh. A week can only be settled once.\n\nContinue?`)) return;
    try {
      const res = await api.post('/settlements/', { week_id: weekId });
      setSettlementResult(res.data);
      alert('Payday complete! See the breakdown below.');
      fetchSettlements();
      api.get('/stats/employees', { params: { basic: 1 } }).then(r => setEmployees(r.data));
    } catch (err: any) {
      alert(err?.response?.data?.detail || 'Could not settle this week');
      fetchSettlements();
    }
  };

  const handleClientDebtSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/client-debts/', {
        client_name: clientDebtForm.client_name,
        customer_phone: clientDebtForm.customer_phone || null,
        description: clientDebtForm.description || null,
        amount: toNum(clientDebtForm.amount),
        date: clientDebtForm.date || null
      });
      alert('Client debt logged!');
      setClientDebtForm({ client_name: '', customer_phone: '', description: '', amount: 0, date: format(new Date(), 'yyyy-MM-dd') });
      fetchClientDebts();
    } catch { alert('Error logging client debt'); }
  };

  const handleClientDebtPaid = async (cd: any) => {
    const extra = prompt(`Extra payment for ${cd.client_name} (paid so far Ksh ${cd.paid}, balance Ksh ${cd.balance}):`, String(cd.balance));
    if (extra === null) return;
    try {
      await api.put(`/client-debts/${cd.id}`, { paid: cd.paid + toNum(extra), paid_date: format(new Date(), 'yyyy-MM-dd') });
      fetchClientDebts();
    } catch { alert('Error recording payment'); }
  };

  const handleClientDebtDelete = async (cd: any) => {
    if (!confirm(`Delete client debt for "${cd.client_name}"? This removes the record.`)) return;
    try {
      await api.delete(`/client-debts/${cd.id}`);
      fetchClientDebts();
    } catch { alert('Error deleting client debt'); }
  };

  const saveDebtEdit = async (debtId: number) => {
    try {
      await api.put(`/debts/${debtId}`, { amount: toNum(debtEdit.amount), paid: toNum(debtEdit.paid) });
      setEditingDebt(null);
      fetchDebts();
      api.get('/stats/employees', { params: { basic: 1 } }).then(res => setEmployees(res.data));
    } catch (e: any) { alert(e.response?.data?.detail || 'Could not update the debt'); }
  };

  const markDebtPaid = async (debtId: number, full: boolean, amount: number) => {
    try {
      await api.put(`/debts/${debtId}`, { paid: full ? amount : Math.floor(amount / 2) });
      fetchDebts();
      api.get('/stats/employees', { params: { basic: 1 } }).then(res => setEmployees(res.data));
    } catch (e: any) { alert(e.response?.data?.detail || 'Could not update the debt'); }
  };

  const deleteDebt = async (debtId: number) => {
    if (!confirm('Remove this debt/shortfall record?')) return;
    try {
      await api.delete(`/debts/${debtId}`);
      fetchDebts();
      api.get('/stats/employees', { params: { basic: 1 } }).then(res => setEmployees(res.data));
    } catch { alert('Error removing debt'); }
  };

  const handleEdit = (tx: any) => {
    setEditingTx(tx.id);
    setEditForm({
      washer_id: tx.washer_id.toString(),
      category: tx.category,
      expected_price: tx.expected_price,
      cash_paid: tx.cash_paid,
      mpesa_paid: tx.mpesa_paid,
      mpesa_transaction_id: tx.mpesa_transaction_id || '',
      mpesa_sender_name: tx.mpesa_sender_name || '',
      manual_tip: tx.manual_tip || 0,
      tip_method: tx.tip_method || 'cash',
      misc_amount: tx.misc_amount || 0,
      misc_description: tx.misc_description || '',
      has_car_wash: tx.has_car_wash || false,
      has_vacuum: tx.has_vacuum || false,
      has_engine_wash: tx.has_engine_wash || false,
      plate_number: tx.plate_number || '',
      custom_category: tx.custom_category || '',
      receiver_id: tx.receiver_id?.toString() || '',
      customer_phone: tx.customer_phone || ''
    });
  };

  const handleEditSave = async (txId: number) => {
    try {
      const payload: any = {};
      if (editForm.washer_id && editForm.washer_id !== '') {
        const wid = parseInt(editForm.washer_id);
        if (!Number.isInteger(wid) || wid <= 0) {
          alert('Please select a valid washer');
          return;
        }
        payload.washer_id = wid;
      }
      if (editForm.category) payload.category = editForm.category;
      if (editForm.expected_price) payload.expected_price = parseFloat(editForm.expected_price);
      if (editForm.cash_paid !== undefined) payload.cash_paid = parseFloat(editForm.cash_paid);
      if (editForm.mpesa_paid !== undefined) payload.mpesa_paid = parseFloat(editForm.mpesa_paid);
      payload.mpesa_transaction_id = editForm.mpesa_transaction_id || null;
      payload.mpesa_sender_name = editForm.mpesa_sender_name || null;
      payload.manual_tip = parseFloat(editForm.manual_tip) || 0;
      payload.tip_method = editForm.tip_method;
      payload.misc_amount = parseFloat(editForm.misc_amount) || 0;
      payload.misc_description = editForm.misc_description || null;
      payload.has_car_wash = editForm.has_car_wash;
      payload.has_vacuum = editForm.has_vacuum;
      payload.has_engine_wash = editForm.has_engine_wash;
      payload.plate_number = editForm.plate_number || null;
      payload.custom_category = editForm.custom_category || null;
      await api.put(`/transactions/${txId}`, payload);
      alert('Transaction updated!');
      setEditingTx(null);
      fetchTransactions();
    } catch (err: any) {
      alert(err?.response?.data?.detail || 'Error updating transaction');
    }
  };

  const handleDelete = async (txId: number) => {
    if (!confirm('Delete this transaction? This will reverse balances.')) return;
    try {
      await api.delete(`/transactions/${txId}`);
      alert('Transaction deleted');
      fetchTransactions();
    } catch { alert('Error deleting transaction'); }
  };

  const tabs: Array<{ id: typeof activeTab; label: string }> = [
    { id: 'sheet', label: 'Day Sheet' },
    { id: 'expense', label: 'Expenses' },
    { id: 'repayment', label: 'Debt Repayment' },
    { id: 'tip', label: 'Log Tip' },
    { id: 'debt', label: 'Log Debt' },
    { id: 'payday', label: 'Payday' },
    { id: 'client-debts', label: 'Client Debts' },
    { id: 'arrivals', label: 'Arrivals' },
    { id: 'prices', label: 'Prices' },
  ];

  const expByCat = expenses.reduce((acc: any, e) => {
    acc[e.category] = (acc[e.category] || 0) + e.amount;
    return acc;
  }, {});

  return (
    <div className="mx-auto max-w-[1500px] space-y-6 px-1 py-1 sm:px-2 lg:px-0">
      {loadError && <InlineError message={loadError} onRetry={fetchTransactions} />}
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-brand-600 dark:text-brand-400">Manager workspace</p>
        <h1 className="section-title mt-1">Run the day, one sheet at a time.</h1>
      </div>

      <div className="hscroll -mx-1 px-1 pb-1 print:hidden">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`chip ${activeTab === tab.id ? 'chip-active' : ''}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="hscroll items-center pb-2 print:hidden">
        <button onClick={() => setViewMode(viewMode === 'day' ? 'week' : 'day')} className="chip">
          <Calendar size={13} /> {viewMode === 'day' ? 'Week view' : 'Day view'}
        </button>
        {viewMode === 'day' ? weekDays.map(day => (
          <button key={day.toISOString()} onClick={() => setSelectedDay(day)}
            className={`chip ${isSameDay(selectedDay, day) ? 'chip-active' : ''}`}>
            {format(day, 'EEE dd/MM')}
          </button>
        )) : (
          <>
            <button onClick={() => setWeekOffset(w => w - 1)} aria-label="Previous week" className="btn-secondary btn-sm px-2.5"><ChevronLeft size={16} /></button>
            <span className="whitespace-nowrap px-2 text-sm font-bold">{format(weekStart, "'Week' w, yyyy")}</span>
            <button onClick={() => setWeekOffset(w => w + 1)} aria-label="Next week" className="btn-secondary btn-sm px-2.5"><ChevronRight size={16} /></button>
          </>
        )}
      </div>

      {activeTab === 'sheet' ? (
        <div className="space-y-5">
          <DaySheet employees={employees} selectedDay={selectedDay} onOpenSummary={() => setSummaryOpen(true)} />
          <DayStats summary={summary} carpets={dayCarpets} dailySummaries={dailySummaries} selectedDay={selectedDay} weekStart={weekStart} mode={viewMode} />
        </div>
      ) : activeTab === 'expense' ? (
        <div className="space-y-4">
          <form onSubmit={handleExpenseSubmit} className="card-pad space-y-4">
            <h2 className="section-title">Log business expense</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="sm:col-span-1">
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">Description</label>
                <input className="input-base mt-1" placeholder="e.g. Soap bucket, water refill"
                  value={expenseForm.description}
                  onChange={e => setExpenseForm({ ...expenseForm, description: e.target.value })} required />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">Amount</label>
                <input type="number" min="0" className="input-base mt-1" value={expenseForm.amount}
                  onChange={e => setExpenseForm({ ...expenseForm, amount: toNum(e.target.value) })} required />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">Category</label>
                <select className="input-base mt-1" value={expenseForm.category}
                  onChange={e => setExpenseForm({ ...expenseForm, category: e.target.value })}>
                  {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <button type="submit" className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-red-500/20 transition hover:bg-red-700">
              <Loader2 size={0} /> Log Expense
            </button>
          </form>

          <div className="card overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-200/80 px-5 py-4 dark:border-white/10">
              <div>
                <h2 className="text-lg font-black tracking-tight">Expenses this period</h2>
                <p className="muted text-xs">Track every shilling out. Delete a mistaken entry.</p>
              </div>
              <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-bold text-red-600 dark:bg-red-500/10 dark:text-red-300">
                Total: Ksh {expenses.reduce((s, e) => s + e.amount, 0)}
              </span>
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
                    <th className="px-2 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {expenses.length === 0 && (
                    <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">No expenses yet this period.</td></tr>
                  )}
                  {expenses.map(e => (
                    <tr key={e.id} className="border-b border-slate-200/70 transition hover:bg-slate-50/70 dark:border-white/10 dark:hover:bg-white/[0.03]">
                      <td className="px-4 py-2 text-xs">{format(new Date(e.timestamp), 'EEE dd/MM HH:mm')}</td>
                      <td className="px-4 py-2 font-medium">{e.description}</td>
                      <td className="px-4 py-2">
                        <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-700 dark:bg-red-500/10 dark:text-red-300">{e.category}</span>
                      </td>
                      <td className="px-4 py-2 text-right font-mono font-bold text-red-600 dark:text-red-400">Ksh {e.amount}</td>
                      <td className="px-2 py-2 text-right">
                        <button onClick={() => handleDeleteExpense(e.id)} title="Delete expense"
                          className="rounded-lg p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10 dark:hover:text-red-300">
                          <Trash2 size={15} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : activeTab === 'tip' ? (
        <form onSubmit={handleTipSubmit} className="card-pad space-y-4">
          <h2 className="section-title text-violet-600 dark:text-violet-400">Log employee tip</h2>
          <p className="muted text-sm">Add it to their wages, or hand it in cash and log it as a "Chai" expense.</p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-sm font-semibold text-slate-700 dark:text-slate-300">Employee</span>
              <select className="input-base" value={tipForm.employee_id}
                onChange={e => setTipForm({ ...tipForm, employee_id: e.target.value })} required>
                <option value="">Select Employee</option>
                {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-semibold text-slate-700 dark:text-slate-300">Tip amount (Ksh)</span>
              <input type="number" min="0" className="input-base" value={tipForm.amount}
                onChange={e => setTipForm({ ...tipForm, amount: toNum(e.target.value) })} required />
            </label>
          </div>
          <div>
            <span className="mb-1 block text-sm font-semibold text-slate-700 dark:text-slate-300">Method</span>
            <div className="mt-1 flex flex-wrap gap-4">
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input type="radio" name="tip_method" value="wages" checked={tipForm.method === 'wages'}
                  onChange={e => setTipForm({ ...tipForm, method: e.target.value })} />
                <span>Add to wages</span>
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input type="radio" name="tip_method" value="cash" checked={tipForm.method === 'cash'}
                  onChange={e => setTipForm({ ...tipForm, method: e.target.value })} />
                <span>Give cash (log as Chai expense)</span>
              </label>
            </div>
          </div>
          <button type="submit" className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-violet-500/20 transition hover:bg-violet-700">
            Log Tip
          </button>
        </form>
      ) : activeTab === 'debt' ? (
        <div className="space-y-4">
          <form onSubmit={handleDebtSubmit} className="card-pad space-y-4">
            <h2 className="section-title text-red-600 dark:text-red-400">Log debt</h2>
            <p className="muted text-sm">Record a debt/advance for an employee or an "other" debtor. Debts persist until fully paid.</p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-sm font-semibold text-slate-700 dark:text-slate-300">Debtor</span>
                <select className="input-base" value={debtForm.debtor_type}
                  onChange={e => setDebtForm({ ...debtForm, debtor_type: e.target.value, employee_id: '', other_name: '' })}>
                  <option value="employee">Employee</option>
                  <option value="other">Other (specify name)</option>
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-semibold text-slate-700 dark:text-slate-300">Amount (Ksh)</span>
                <input type="number" min="0" className="input-base" value={debtForm.amount}
                  onChange={e => setDebtForm({ ...debtForm, amount: toNum(e.target.value) })} required />
              </label>
              {debtForm.debtor_type === 'employee' && (
                <label className="block sm:col-span-2">
                  <span className="mb-1 block text-sm font-semibold text-slate-700 dark:text-slate-300">Employee</span>
                  <select className="input-base" value={debtForm.employee_id}
                    onChange={e => setDebtForm({ ...debtForm, employee_id: e.target.value })} required>
                    <option value="">Select Employee</option>
                    {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                  </select>
                </label>
              )}
              {debtForm.debtor_type === 'other' && (
                <label className="block sm:col-span-2">
                  <span className="mb-1 block text-sm font-semibold text-slate-700 dark:text-slate-300">Debtor name</span>
                  <input className="input-base" placeholder="e.g. John Doe"
                    value={debtForm.other_name} onChange={e => setDebtForm({ ...debtForm, other_name: e.target.value })} />
                </label>
              )}
              <label className="block">
                <span className="mb-1 block text-sm font-semibold text-slate-700 dark:text-slate-300">Service (optional)</span>
                <input className="input-base" placeholder="e.g. advance, loan"
                  value={debtForm.service} onChange={e => setDebtForm({ ...debtForm, service: e.target.value })} />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-semibold text-slate-700 dark:text-slate-300">Initial paid (Ksh)</span>
                <input type="number" min="0" className="input-base" value={debtForm.paid}
                  onChange={e => setDebtForm({ ...debtForm, paid: toNum(e.target.value) })} />
              </label>
            </div>
            <button type="submit" className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-red-500/20 transition hover:bg-red-700">
              Log Debt
            </button>
          </form>

          <div className="card-pad">
            <h2 className="text-lg font-black tracking-tight">Debt records</h2>
            <p className="muted mb-4 mt-1 text-sm">
              Includes shortfalls calculated automatically. Correct the amount, or mark any of them paid in full or in part.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200/80 dark:border-white/10">
                    <th className="py-2">Employee</th>
                    <th className="py-2 text-right">Amount</th>
                    <th className="py-2">Service</th>
                    <th className="py-2">Date</th>
                    <th className="py-2 text-right">Paid</th>
                    <th className="py-2 text-right">Balance</th>
                    <th className="py-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {debts.length === 0 && <tr><td colSpan={7} className="py-8 text-center text-slate-400">No debts on record.</td></tr>}
                  {debts.map(d => (
                    <tr key={d.id} className="border-b border-slate-200/70 dark:border-white/10">
                      <td className="py-2 font-medium">{d.other_name || empMap[d.employee_id] || d.employee_id}</td>
                      {editingDebt === d.id ? (
                        <>
                          <td className="py-2">
                            <input type="number" min="0" className="input-base w-24 px-2 py-1 text-sm"
                              value={debtEdit.amount} onChange={e => setDebtEdit({ ...debtEdit, amount: toNum(e.target.value) })} />
                          </td>
                          <td className="py-2 text-xs text-slate-500" colSpan={2}>
                            {d.service || '-'}{d.notes ? <div className="text-slate-400">{d.notes}</div> : null}
                          </td>
                          <td className="py-2">
                            <input type="number" min="0" className="input-base w-24 px-2 py-1 text-sm"
                              value={debtEdit.paid} onChange={e => setDebtEdit({ ...debtEdit, paid: toNum(e.target.value) })} />
                          </td>
                          <td className="py-2 font-bold text-red-600">Ksh {Math.max(0, debtEdit.amount - debtEdit.paid)}</td>
                          <td className="py-2">
                            <div className="flex gap-1">
                              <button onClick={() => saveDebtEdit(d.id)} className="rounded-lg bg-green-600 px-2 py-1 text-xs font-bold text-white hover:bg-green-700">Save</button>
                              <button onClick={() => setEditingDebt(null)} className="rounded-lg bg-gray-400 px-2 py-1 text-xs font-bold text-white hover:bg-gray-500">Cancel</button>
                            </div>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="py-2 font-mono">Ksh {d.amount}</td>
                          <td className="py-2">
                            {d.service || '-'}
                            {d.notes ? <div className="text-xs text-slate-400">{d.notes}</div> : null}
                          </td>
                          <td className="py-2 text-sm">{format(new Date(d.date), 'EEE dd/MM/yy')}</td>
                          <td className="py-2 font-mono">Ksh {d.paid}</td>
                          <td className="py-2 font-bold text-red-600">Ksh {d.balance}</td>
                          <td className="py-2">
                            <div className="flex flex-wrap gap-1">
                              <button onClick={() => { setEditingDebt(d.id); setDebtEdit({ amount: d.amount, paid: d.paid }); }}
                                className="rounded-lg bg-blue-600 px-2 py-1 text-xs font-bold text-white hover:bg-blue-700">Edit</button>
                              {d.balance > 0 && (
                                <>
                                  <button onClick={() => markDebtPaid(d.id, true, d.amount)}
                                    className="rounded-lg bg-green-600 px-2 py-1 text-xs font-bold text-white hover:bg-green-700">Paid</button>
                                  <button onClick={() => markDebtPaid(d.id, false, d.balance)}
                                    className="rounded-lg bg-emerald-700 px-2 py-1 text-xs font-bold text-white hover:bg-emerald-800">Half</button>
                                </>
                              )}
                              <button onClick={() => deleteDebt(d.id)} className="rounded-lg bg-red-600 px-2 py-1 text-xs font-bold text-white hover:bg-red-700">Del</button>
                            </div>
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : activeTab === 'repayment' ? (
        <form onSubmit={handleRepaymentSubmit} className="card-pad space-y-4">
          <h2 className="section-title text-emerald-600 dark:text-emerald-400">Record debt repayment</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-sm font-semibold text-slate-700 dark:text-slate-300">Employee</span>
              <select className="input-base" value={repaymentForm.employee_id}
                onChange={e => setRepaymentForm({ ...repaymentForm, employee_id: e.target.value })} required>
                <option value="">Select Employee</option>
                {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-semibold text-slate-700 dark:text-slate-300">Repayment amount (Ksh)</span>
              <input type="number" min="0" className="input-base" value={repaymentForm.amount}
                onChange={e => setRepaymentForm({ ...repaymentForm, amount: toNum(e.target.value) })} required />
            </label>
          </div>
          <button type="submit" className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-700">
            Confirm Repayment
          </button>
        </form>
      ) : activeTab === 'payday' ? (
        <div className="space-y-4">
          <div className="card-pad space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="section-title text-emerald-600 dark:text-emerald-400">Weekly payday</h2>
                <p className="muted text-sm">Week {weekId} · {format(weekStart, 'EEE dd/MM/yyyy')} → {format(addDays(weekStart, 6), 'EEE dd/MM/yyyy')}</p>
              </div>
              <button onClick={handleSettleWeek} className="rounded-xl bg-emerald-600 px-5 py-2.5 font-bold text-white shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-700">
                Settle {weekId}
              </button>
            </div>
            <p className="muted text-sm">
              Sunday-evening payday: each employee's weekly wages (commission + wages-tips) are paid out after covering
              ALL open debts. Anything short carries forward; payable balance resets to zero so Monday starts fresh.
              A week can only be settled once.
            </p>
          </div>

          {settlementResult && (
            <div className="card-pad space-y-3">
              <h3 className="text-lg font-black tracking-tight">Payday result — Week {settlementResult.week_id}</h3>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div className="rounded-2xl bg-slate-50 p-4 text-center dark:bg-white/5">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Cash paid out</p>
                  <p className="mt-1 text-xl font-black font-mono text-emerald-600 dark:text-emerald-400">Ksh {settlementResult.cash_paid_total}</p>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4 text-center dark:bg-white/5">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Debt carried forward</p>
                  <p className="mt-1 text-xl font-black font-mono text-amber-600 dark:text-amber-400">Ksh {settlementResult.debt_carried_total}</p>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4 text-center dark:bg-white/5">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Week profit</p>
                  <p className="mt-1 text-xl font-black font-mono text-blue-600 dark:text-blue-400">Ksh {settlementResult.total_profit}</p>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200/80 dark:border-white/10">
                      <th className="py-2">Employee</th>
                      <th className="py-2 text-right">Wages (tx)</th>
                      <th className="py-2 text-right">Wages (tips)</th>
                      <th className="py-2 text-right">Debts covered</th>
                      <th className="py-2 text-right">Cash paid</th>
                      <th className="py-2 text-right">Carried forward</th>
                    </tr>
                  </thead>
                  <tbody>
                    {settlementResult.employees.map((e: any) => (
                      <tr key={e.id} className="border-b border-slate-200/70 dark:border-white/10">
                        <td className="py-2 font-medium">{e.full_name} <span className="text-xs text-slate-400">({e.abbreviation})</span></td>
                        <td className="py-2 text-right font-mono">{e.wages}</td>
                        <td className="py-2 text-right font-mono">{e.tips_wages}</td>
                        <td className="py-2 text-right font-mono text-red-600">{e.debts_covered}</td>
                        <td className="py-2 text-right font-mono text-emerald-600">{e.cash_paid}</td>
                        <td className="py-2 text-right font-mono text-amber-600">{e.carried_forward}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="card-pad">
            <h2 className="text-lg font-black tracking-tight">Settlement history</h2>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200/80 dark:border-white/10">
                    <th className="py-2">Week</th>
                    <th className="py-2">Range</th>
                    <th className="py-2 text-right">Revenue</th>
                    <th className="py-2 text-right">Expenses</th>
                    <th className="py-2 text-right">Labor</th>
                    <th className="py-2 text-right">Profit</th>
                    <th className="py-2 text-right">Cash paid</th>
                    <th className="py-2 text-right">Debt carried</th>
                  </tr>
                </thead>
                <tbody>
                  {settlementLogs.length === 0 && (
                    <tr><td colSpan={8} className="py-8 text-center text-slate-400">No weeks settled yet.</td></tr>
                  )}
                  {settlementLogs.map((log: any) => (
                    <tr key={log.id} className="border-b border-slate-200/70 dark:border-white/10">
                      <td className="py-2 font-mono">{log.week_id}</td>
                      <td className="py-2 text-xs">{format(new Date(log.start_date), 'dd/MM/yy')} → {format(new Date(log.end_date), 'dd/MM/yy')}</td>
                      <td className="py-2 text-right font-mono">{log.total_revenue}</td>
                      <td className="py-2 text-right font-mono text-red-600">{log.total_expenses}</td>
                      <td className="py-2 text-right font-mono">{log.total_labor_expense}</td>
                      <td className="py-2 text-right font-mono text-blue-600">{log.total_profit}</td>
                      <td className="py-2 text-right font-mono text-emerald-600">{log.data?.cash_paid_total ?? '-'}</td>
                      <td className="py-2 text-right font-mono text-amber-600">{log.data?.debt_carried_total ?? '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : activeTab === 'client-debts' ? (
        <div className="space-y-4">
          <form onSubmit={handleClientDebtSubmit} className="card-pad space-y-4">
            <h2 className="section-title text-indigo-600 dark:text-indigo-400">Log client debt</h2>
            <p className="muted text-sm">Money a customer owes the business (e.g. unpaid carpet wash). Cleared any day — separate from employee debts.</p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-sm font-semibold text-slate-700 dark:text-slate-300">Client name</span>
                <input className="input-base" value={clientDebtForm.client_name}
                  onChange={e => setClientDebtForm({ ...clientDebtForm, client_name: e.target.value })} required />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-semibold text-slate-700 dark:text-slate-300">Amount (Ksh)</span>
                <input type="number" min="0" className="input-base" value={clientDebtForm.amount}
                  onChange={e => setClientDebtForm({ ...clientDebtForm, amount: toNum(e.target.value) })} required />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-semibold text-slate-700 dark:text-slate-300">Phone (optional)</span>
                <input className="input-base" placeholder="0712 345 678"
                  value={clientDebtForm.customer_phone} onChange={e => setClientDebtForm({ ...clientDebtForm, customer_phone: e.target.value })} />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-semibold text-slate-700 dark:text-slate-300">Date</span>
                <input type="date" className="input-base" value={clientDebtForm.date}
                  onChange={e => setClientDebtForm({ ...clientDebtForm, date: e.target.value })} />
              </label>
            </div>
            <label className="block">
              <span className="mb-1 block text-sm font-semibold text-slate-700 dark:text-slate-300">Description (optional)</span>
              <input className="input-base" placeholder="e.g. Carpet wash, missed payment"
                value={clientDebtForm.description} onChange={e => setClientDebtForm({ ...clientDebtForm, description: e.target.value })} />
            </label>
            <button type="submit" className="btn-primary w-full justify-center py-3">Log Client Debt</button>
          </form>

          <div className="card-pad">
            <h2 className="text-lg font-black tracking-tight">Client debt records</h2>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200/80 dark:border-white/10">
                    <th className="py-2">Date</th>
                    <th className="py-2">Client</th>
                    <th className="py-2">Description</th>
                    <th className="py-2 text-right">Amount</th>
                    <th className="py-2 text-right">Paid</th>
                    <th className="py-2 text-right">Balance</th>
                    <th className="py-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {clientDebts.length === 0 && (
                    <tr><td colSpan={7} className="py-8 text-center text-slate-400">No client debts logged.</td></tr>
                  )}
                  {clientDebts.map(cd => (
                    <tr key={cd.id} className="border-b border-slate-200/70 dark:border-white/10">
                      <td className="py-2 text-xs">{format(new Date(cd.date), 'EEE dd/MM/yy')}</td>
                      <td className="py-2 font-medium">{cd.client_name}</td>
                      <td className="py-2">{cd.description || '-'}</td>
                      <td className="py-2 text-right font-mono">Ksh {cd.amount}</td>
                      <td className="py-2 text-right font-mono text-emerald-600">Ksh {cd.paid}</td>
                      <td className="py-2 text-right font-mono font-bold text-red-600">Ksh {cd.balance}</td>
                      <td className="py-2">
                        <div className="flex gap-1">
                          <button onClick={() => handleClientDebtPaid(cd)} className="rounded-lg bg-emerald-600 px-2 py-1 text-xs font-bold text-white hover:bg-emerald-700">Pay</button>
                          <button onClick={() => handleClientDebtDelete(cd)} className="rounded-lg bg-red-600 px-2 py-1 text-xs font-bold text-white hover:bg-red-700">Del</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : activeTab === 'arrivals' ? (
        <div className="card-pad">
          <h2 className="text-lg font-black tracking-tight text-sky-600 dark:text-sky-400">Vehicles waiting for payment</h2>
          <p className="muted mb-4 mt-1 text-sm">
            Every employee sees their own arrivals; this is the full list. Red rows passed 24 hours and have
            already been charged to that employee as a shortfall.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200/80 dark:border-white/10">
                  <th className="py-2">Arrived</th>
                  <th className="py-2">Plate</th>
                  <th className="py-2">Type</th>
                  <th className="py-2">Logged by</th>
                  <th className="py-2 text-right">Expected</th>
                  <th className="py-2 text-right">Paid</th>
                  <th className="py-2">Status</th>
                  <th className="py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {arrivals.length === 0 && (
                  <tr><td colSpan={8} className="py-8 text-center text-slate-400">No arrivals logged.</td></tr>
                )}
                {arrivals.map(a => (
                  <tr key={a.id} className={`border-b border-slate-200/70 dark:border-white/10 ${a.status === 'settled' ? '' : a.overdue ? 'bg-red-100 dark:bg-red-900/40' : ''}`}>
                    <td className="py-2 text-xs">{format(new Date(a.created_at), 'EEE dd/MM HH:mm')}</td>
                    <td className="py-2 font-mono">{a.plate_number}</td>
                    <td className="py-2 capitalize">{a.category}</td>
                    <td className="py-2">{abbrMap[a.submitter_id] || empMap[a.submitter_id] || a.submitter_id}</td>
                    <td className="py-2 text-right font-mono">Ksh {a.expected_price}</td>
                    <td className="py-2 text-right font-mono">Ksh {(a.cash_paid || 0) + (a.mpesa_paid || 0)}</td>
                    <td className="py-2 text-xs">
                      {a.status === 'settled' ? <span className="font-semibold text-emerald-600">Paid</span>
                        : a.status === 'expired' ? <span className="font-semibold text-red-600">Overdue (charged)</span>
                        : a.overdue ? <span className="font-semibold text-red-600">Overdue</span>
                        : <span className="font-semibold text-amber-600">Waiting</span>}
                    </td>
                    <td className="py-2">
                      {a.status !== 'settled' && (
                        <button onClick={() => {
                          const cash = prompt(`Payment for ${a.plate_number} — cash (Ksh):`, '0');
                          if (cash === null) return;
                          const mpesa = prompt('M-Pesa (Ksh):', '0');
                          if (mpesa === null) return;
                          const who = prompt(
                            `Washer for the commission (1-${employees.length}, blank = whoever logged it):`,
                            a.washer_id ? String(employees.findIndex((e: any) => e.id === a.washer_id) + 1) : '',
                          );
                          if (who === null) return;
                          const idx = parseInt(who, 10);
                          const picked = Number.isInteger(idx) && idx >= 1 && idx <= employees.length ? employees[idx - 1].id : null;
                          settleArrivalFor(a.id, toNum(cash), toNum(mpesa), picked);
                        }} className="rounded-lg bg-emerald-600 px-2 py-1 text-xs font-bold text-white hover:bg-emerald-700">Take payment</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : activeTab === 'prices' ? (
        <PricesPanel />
      ) : null}

      {activeTab !== 'sheet' && (
        <div className="card-pad">
          <h3 className="text-lg font-black tracking-tight">Recent transactions</h3>
          <p className="muted mb-3 mt-1 text-xs">{viewMode === 'day' ? `Day: ${format(selectedDay, 'EEEE, dd MMM yyyy')}` : `Week: ${format(weekStart, "'Week' w, yyyy")}`}</p>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200/80 dark:border-white/10">
                  <th className="py-2">Time</th>
                  <th className="py-2">Washer</th>
                  <th className="py-2">Category</th>
                  <th className="py-2">Plate</th>
                  <th className="py-2 text-right">Paid</th>
                  <th className="py-2 text-right">Shortfall</th>
                  <th className="py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {transactions.length === 0 && (
                  <tr><td colSpan={7} className="py-8 text-center text-slate-400">No transactions in this period.</td></tr>
                )}
                {transactions.map(tx => (
                  editingTx === tx.id ? (
                    <tr key={tx.id} className="border-b border-slate-200/70 bg-yellow-50 dark:border-white/10 dark:bg-yellow-900/20">
                      <td className="py-2 text-xs">{format(new Date(tx.timestamp), 'EEE HH:mm')}</td>
                      <td className="py-2">
                        <select className="input-base px-2 py-1 text-xs" value={editForm.washer_id || ''}
                          onChange={e => setEditForm({ ...editForm, washer_id: e.target.value })}>
                          <option value="">—</option>
                          {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                        </select>
                      </td>
                      <td className="py-2">
                        <select className="input-base px-2 py-1 text-xs" value={editForm.category}
                          onChange={e => setEditForm({ ...editForm, category: e.target.value })}>
                          <option value="bicycle">Bicycle</option>
                          <option value="motorcycle">Motorcycle</option>
                          <option value="taxi">Taxi</option>
                          <option value="car">Car</option>
                          <option value="midrange">Midrange</option>
                          <option value="lorry">Lorry</option>
                          <option value="carpet">Carpet</option>
                          <option value="vacuum">Vacuum</option>
                          <option value="engine">Engine wash</option>
                          <option value="other">Other</option>
                        </select>
                      </td>
                      <td className="py-2">
                        {editForm.category !== 'motorcycle' && editForm.category !== 'other' && editForm.category !== 'bicycle' ? (
                          <input type="text" className="input-base px-2 py-1 text-xs font-mono uppercase"
                            value={editForm.plate_number} onChange={e => setEditForm({ ...editForm, plate_number: e.target.value.toUpperCase() })} />
                        ) : editForm.category === 'other' ? (
                          <input type="text" className="input-base px-2 py-1 text-xs"
                            placeholder="Custom name" value={editForm.custom_category}
                            onChange={e => setEditForm({ ...editForm, custom_category: e.target.value })} />
                        ) : <span className="text-xs">-</span>}
                      </td>
                      <td className="py-2">
                        <div className="flex gap-1">
                          <input type="number" className="input-base w-16 px-2 py-1 text-xs"
                            value={editForm.cash_paid} onChange={e => setEditForm({ ...editForm, cash_paid: parseInt(e.target.value) })} />
                          <input type="number" className="input-base w-16 px-2 py-1 text-xs"
                            value={editForm.mpesa_paid} onChange={e => setEditForm({ ...editForm, mpesa_paid: parseInt(e.target.value) })} />
                        </div>
                      </td>
                      <td className="py-2 text-xs">-</td>
                      <td className="py-2">
                        <div className="flex gap-1">
                          <button onClick={() => handleEditSave(tx.id)} className="rounded-lg bg-emerald-600 px-2 py-1 text-xs font-bold text-white hover:bg-emerald-700">Save</button>
                          <button onClick={() => setEditingTx(null)} className="rounded-lg bg-slate-400 px-2 py-1 text-xs font-bold text-white hover:bg-slate-500">Cancel</button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    <tr key={tx.id} className="border-b border-slate-200/70 transition hover:bg-slate-50/70 dark:border-white/10 dark:hover:bg-white/[0.03]">
                      <td className="py-2 text-xs">{format(new Date(tx.timestamp), 'EEE HH:mm')}</td>
                      <td className="py-2 font-medium">{empMap[tx.washer_id] || tx.washer_id}</td>
                      <td className="py-2 capitalize">{tx.custom_category || tx.category}</td>
                      <td className="py-2 font-mono text-xs">{tx.category === 'other' ? '-' : (tx.plate_number || '-')}</td>
                      <td className="py-2 font-mono">Ksh {tx.total_paid}
                        {tx.isolated_tip > 0 && (
                          <span className={`ml-1 rounded px-1 py-0.5 text-[10px] font-medium ${tx.tip_method === 'wages' ? 'bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-900 dark:text-fuchsia-300' : 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300'}`}
                            title={tx.tip_method === 'wages' ? 'Tip added to wages (payday)' : 'Tip given as cash (logged as expense)'}>
                            ❤ Tip {tx.isolated_tip} · {tx.tip_method === 'wages' ? 'Wages' : 'Cash'}
                          </span>
                        )}
                        {tx.misc_amount > 0 && (
                          <span className="ml-1 rounded bg-amber-100 px-1 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-900 dark:text-amber-300" title={tx.misc_description || 'Misc'}>
                            Misc {tx.misc_amount}{tx.misc_description ? ` · ${tx.misc_description}` : ''}
                          </span>
                        )}
                      </td>
                      <td className="py-2 font-mono text-red-500">{tx.shortfall > 0 ? `Ksh ${tx.shortfall}` : '-'}</td>
                      <td className="py-2">
                        <div className="flex gap-1">
                          <button onClick={() => handleEdit(tx)} className="rounded-lg bg-blue-600 px-2 py-1 text-xs font-bold text-white hover:bg-blue-700">Edit</button>
                          <button onClick={() => handleDelete(tx.id)} className="rounded-lg bg-red-600 px-2 py-1 text-xs font-bold text-white hover:bg-red-700">Del</button>
                        </div>
                      </td>
                    </tr>
                  )
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Day/Week summary popup */}
      {summaryOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-3 backdrop-blur-sm sm:p-6" onClick={() => setSummaryOpen(false)}>
          <div
            className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-2xl bg-slate-50 shadow-2xl dark:bg-slate-950"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur dark:border-white/10 dark:bg-slate-900/95">
              <h2 className="section-title">
                {viewMode === 'day' ? 'Day summary' : 'Week summary'}
              </h2>
              <button
                onClick={() => setSummaryOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10"
                aria-label="Close summary"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-3 sm:p-4">
              <DayStats
                summary={summary}
                carpets={dayCarpets}
                dailySummaries={dailySummaries}
                selectedDay={selectedDay}
                weekStart={weekStart}
                mode={viewMode}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
