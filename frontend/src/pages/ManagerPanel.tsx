import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { format, startOfWeek, addDays, isSameDay, addWeeks } from 'date-fns';

const toNum = (v: any) => { const n = parseInt(v); return isNaN(n) ? 0 : Math.max(0, n); };

export default function ManagerPanel() {
  const [employees, setEmployees] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [selectedDay, setSelectedDay] = useState<Date>(new Date());
  const [viewMode, setViewMode] = useState<'day' | 'week'>('day');
  const [weekOffset, setWeekOffset] = useState(0);
  const [editingTx, setEditingTx] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<any>({});
  const standardPrices: any = {
    bicycle: 50, motorcycle: 70, taxi: 150, car: 200,
    midrange: 300, lorry: 500, carpet: 300
  };

  const [form, setForm] = useState({
    washer_id: '', category: 'car', expected_price: 200,
    cash_paid: 0, mpesa_paid: 0, mpesa_transaction_id: '',
    mpesa_sender_name: '', tip_method: 'cash',
    has_car_wash: true, has_vacuum: false, has_engine_wash: false,
    manual_tip: 0, plate_number: '', customer_phone: '',
    carpet_characteristics: '', receiver_id: ''
  });

  const [tipForm, setTipForm] = useState({ employee_id: '', amount: 0, method: 'wages' });
  const [expenseForm, setExpenseForm] = useState({ description: '', amount: 0, category: 'General' });
  const [repaymentForm, setRepaymentForm] = useState({ employee_id: '', amount: 0 });
  const [activeTab, setActiveTab] = useState<'transaction' | 'expense' | 'repayment' | 'tip' | 'debt'>('transaction');
  const [debts, setDebts] = useState<any[]>([]);
  const [debtForm, setDebtForm] = useState({
    employee_id: '', amount: 0, service: '', paid: 0, paid_date: '', notes: ''
  });

  const empMap = Object.fromEntries(employees.map(e => [e.id, e.name]));

  useEffect(() => {
    api.get('/stats/employees').then(res => setEmployees(res.data));
  }, []);

  useEffect(() => {
    fetchTransactions();
  }, [selectedDay, viewMode, weekOffset]);

  const fetchTransactions = async () => {
    const params: any = {};
    if (viewMode === 'day') {
      params.day = format(selectedDay, 'yyyy-MM-dd');
    } else {
      const weekStart = startOfWeek(addWeeks(new Date(), weekOffset), { weekStartsOn: 1 });
      const weekEnd = addDays(weekStart, 6);
      params.week_id = format(weekStart, 'yyyy-II');
    }
    const res = await api.get('/transactions/', { params });
    setTransactions(res.data);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        ...form, washer_id: toNum(form.washer_id),
        expected_price: toNum(form.expected_price),
        cash_paid: toNum(form.cash_paid),
        mpesa_paid: toNum(form.mpesa_paid),
        manual_tip: toNum(form.manual_tip),
        plate_number: form.plate_number || null,
        carpet_metadata: form.category === 'carpet' ? {
          characteristics: form.carpet_characteristics,
          receiver_id: parseInt(form.receiver_id),
          customer_phone: form.customer_phone || null
        } : null
      };
      await api.post('/transactions/', payload);
      alert('Transaction logged!');
      fetchTransactions();
      setForm({ ...form, cash_paid: 0, mpesa_paid: 0, mpesa_transaction_id: '', mpesa_sender_name: '', manual_tip: 0, plate_number: '' });
    } catch { alert('Error logging transaction'); }
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
      has_car_wash: tx.has_car_wash || false,
      has_vacuum: tx.has_vacuum || false,
      has_engine_wash: tx.has_engine_wash || false,
      plate_number: tx.plate_number || '',
      carpet_characteristics: tx.carpet_characteristics || '',
      receiver_id: tx.receiver_id?.toString() || '',
      customer_phone: tx.customer_phone || ''
    });
  };

  const handleEditSave = async (txId: number) => {
    try {
      const payload: any = {};
      if (editForm.washer_id) payload.washer_id = parseInt(editForm.washer_id);
      if (editForm.category) payload.category = editForm.category;
      if (editForm.expected_price) payload.expected_price = parseFloat(editForm.expected_price);
      if (editForm.cash_paid !== undefined) payload.cash_paid = parseFloat(editForm.cash_paid);
      if (editForm.mpesa_paid !== undefined) payload.mpesa_paid = parseFloat(editForm.mpesa_paid);
      payload.mpesa_transaction_id = editForm.mpesa_transaction_id || null;
      payload.mpesa_sender_name = editForm.mpesa_sender_name || null;
      payload.manual_tip = parseFloat(editForm.manual_tip) || 0;
      payload.tip_method = editForm.tip_method;
      payload.has_car_wash = editForm.has_car_wash;
      payload.has_vacuum = editForm.has_vacuum;
      payload.has_engine_wash = editForm.has_engine_wash;
      payload.plate_number = editForm.plate_number || null;
      if (editForm.category === 'carpet') {
        payload.carpet_metadata = {
          characteristics: editForm.carpet_characteristics,
          receiver_id: parseInt(editForm.receiver_id),
          customer_phone: editForm.customer_phone || null
        };
      }
      await api.put(`/transactions/${txId}`, payload);
      alert('Transaction updated!');
      setEditingTx(null);
      fetchTransactions();
    } catch { alert('Error updating transaction'); }
  };

  const handleDelete = async (txId: number) => {
    if (!confirm('Delete this transaction? This will reverse balances.')) return;
    try {
      await api.delete(`/transactions/${txId}`);
      alert('Transaction deleted');
      fetchTransactions();
    } catch { alert('Error deleting transaction'); }
  };

  const handleExpenseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/expenses/', expenseForm);
      alert('Expense logged!');
      setExpenseForm({ description: '', amount: 0, category: 'General' });
    } catch { alert('Error logging expense'); }
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
      api.get('/stats/employees').then(res => setEmployees(res.data));
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
      api.get('/stats/employees').then(res => setEmployees(res.data));
    } catch { alert('Error logging tip'); }
  };

  const fetchDebts = async () => {
    try {
      const res = await api.get('/debts/');
      setDebts(res.data);
    } catch {}
  };

  useEffect(() => { fetchDebts(); }, []);

  const handleDebtSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/debts/', {
        employee_id: toNum(debtForm.employee_id),
        amount: toNum(debtForm.amount),
        service: debtForm.service || null,
        paid: toNum(debtForm.paid),
        paid_date: debtForm.paid_date || null
      });
      alert('Debt logged!');
      setDebtForm({ employee_id: '', amount: 0, service: '', paid: 0, paid_date: '', notes: '' });
      fetchDebts();
    } catch { alert('Error logging debt'); }
  };

  const weekStart = startOfWeek(addWeeks(new Date(), weekOffset), { weekStartsOn: 1 });
  const weekDays = [...Array(7)].map((_, i) => addDays(weekStart, i));

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8">
      <h1 className="text-2xl font-bold mb-6">Manager Workspace</h1>

      <div className="flex border-b dark:border-slate-700">
        <button onClick={() => setActiveTab('transaction')} className={`px-6 py-2 font-medium ${activeTab === 'transaction' ? 'border-b-2 border-primary-600 text-primary-600' : 'text-gray-500'}`}>New Transaction</button>
        <button onClick={() => setActiveTab('expense')} className={`px-6 py-2 font-medium ${activeTab === 'expense' ? 'border-b-2 border-primary-600 text-primary-600' : 'text-gray-500'}`}>Log Expenses</button>
        <button onClick={() => setActiveTab('repayment')} className={`px-6 py-2 font-medium ${activeTab === 'repayment' ? 'border-b-2 border-primary-600 text-primary-600' : 'text-gray-500'}`}>Debt Repayment</button>
        <button onClick={() => setActiveTab('tip')} className={`px-6 py-2 font-medium ${activeTab === 'tip' ? 'border-b-2 border-primary-600 text-primary-600' : 'text-gray-500'}`}>Log Tip</button>
        <button onClick={() => setActiveTab('debt')} className={`px-6 py-2 font-medium ${activeTab === 'debt' ? 'border-b-2 border-primary-600 text-primary-600' : 'text-gray-500'}`}>Log Debt</button>
      </div>

      <div className="flex items-center space-x-2 overflow-x-auto pb-2">
        <button onClick={() => setViewMode(viewMode === 'day' ? 'week' : 'day')} className="px-3 py-1 text-xs bg-gray-200 dark:bg-slate-700 rounded">
          {viewMode === 'day' ? 'Week View' : 'Day View'}
        </button>
        {viewMode === 'day' ? weekDays.map(day => (
          <button key={day.toISOString()} onClick={() => setSelectedDay(day)}
            className={`px-4 py-2 rounded whitespace-nowrap transition ${isSameDay(selectedDay, day) ? 'bg-primary-600 text-white' : 'bg-gray-200 dark:bg-slate-700'}`}>
            {format(day, 'EEE (dd/MM)')}
          </button>
        )) : (
          <>
            <button onClick={() => setWeekOffset(w => w - 1)} className="px-3 py-2 bg-gray-200 dark:bg-slate-700 rounded">&lt;</button>
            <span className="font-medium">{format(weekStart, "'W' w, yyyy")}</span>
            <button onClick={() => setWeekOffset(w => w + 1)} className="px-3 py-2 bg-gray-200 dark:bg-slate-700 rounded">&gt;</button>
          </>
        )}
      </div>

      {activeTab === 'transaction' ? (
      <form onSubmit={handleSubmit} className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">Washer</label>
            <select className="w-full p-2 border rounded dark:bg-slate-700 mb-2" value={form.washer_id}
              onChange={e => setForm({...form, washer_id: e.target.value})}>
              <option value="">Select Employee</option>
              {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
            <div className="flex flex-wrap gap-1.5">
              {employees.map(e => (
                <button key={e.id} type="button" onClick={() => setForm({...form, washer_id: e.id.toString()})}
                  className={`px-3 py-1.5 rounded text-xs font-medium transition ${
                    form.washer_id === e.id.toString() ? 'bg-primary-600 text-white' : 'bg-gray-100 dark:bg-slate-700 hover:bg-gray-200'
                  }`}>{e.name}</button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Category</label>
            <select className="w-full p-2 border rounded dark:bg-slate-700 mb-2" value={form.category}
              onChange={e => { const cat = e.target.value; setForm({...form, category: cat, expected_price: standardPrices[cat] || 0}); }}>
              <option value="bicycle">Bicycle</option>
              <option value="motorcycle">Motorcycle</option>
              <option value="taxi">Taxi</option>
              <option value="car">Normal Car</option>
              <option value="midrange">Midrange</option>
              <option value="lorry">Lorry</option>
              <option value="carpet">Carpet</option>
            </select>
            <div className="flex flex-wrap gap-1.5">
              {[{k:'motorcycle',l:'Bike'},{k:'taxi',l:'Taxi'},{k:'car',l:'Car'},{k:'midrange',l:'Mid'},{k:'lorry',l:'Lorry'},{k:'carpet',l:'Carpet'},{k:'bicycle',l:'Cycle'}].map(({k,l}) => (
                <button key={k} type="button" onClick={() => setForm({...form, category: k, expected_price: standardPrices[k] || 0})}
                  className={`px-3 py-1.5 rounded text-xs font-medium transition ${
                    form.category === k ? 'bg-primary-600 text-white' : 'bg-gray-100 dark:bg-slate-700 hover:bg-gray-200'
                  }`}>{l}</button>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium">Expected Price</label>
            <input type="number" min="0" className="w-full p-2 border rounded dark:bg-slate-700" value={form.expected_price}
              onChange={e => setForm({...form, expected_price: toNum(e.target.value)})} />
            <div className="flex flex-wrap gap-1 mt-1">
              {[50,70,100,150,200,300,500,600].map(p => (
                <button key={p} type="button" onClick={() => setForm({...form, expected_price: p})}
                  className={`px-2 py-0.5 rounded text-xs transition ${
                    form.expected_price === p ? 'bg-primary-600 text-white' : 'bg-gray-100 dark:bg-slate-700 hover:bg-gray-200'
                  }`}>Ksh {p}</button>
              ))}
            </div>
          </div>
          <div><label className="block text-sm font-medium">Cash Paid</label>
            <input type="number" min="0" className="w-full p-2 border rounded dark:bg-slate-700" value={form.cash_paid}
              onChange={e => setForm({...form, cash_paid: toNum(e.target.value)})} />
            <div className="flex flex-wrap gap-1 mt-1">
              {[50,70,100,150,200,300,500].map(p => (
                <button key={p} type="button" onClick={() => setForm({...form, cash_paid: p})}
                  className={`px-2 py-0.5 rounded text-xs transition ${
                    form.cash_paid === p ? 'bg-green-600 text-white' : 'bg-gray-100 dark:bg-slate-700 hover:bg-gray-200'
                  }`}>Ksh {p}</button>
              ))}
            </div>
          </div>
          <div><label className="block text-sm font-medium">M-Pesa Paid</label>
            <input type="number" min="0" className="w-full p-2 border rounded dark:bg-slate-700" value={form.mpesa_paid}
              onChange={e => setForm({...form, mpesa_paid: toNum(e.target.value)})} />
            <div className="flex flex-wrap gap-1 mt-1">
              {[50,70,100,150,200,300,500].map(p => (
                <button key={p} type="button" onClick={() => setForm({...form, mpesa_paid: p})}
                  className={`px-2 py-0.5 rounded text-xs transition ${
                    form.mpesa_paid === p ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-slate-700 hover:bg-gray-200'
                  }`}>Ksh {p}</button>
              ))}
            </div>
          </div>
        </div>

        {form.mpesa_paid > 0 && (
          <div className="grid grid-cols-2 gap-4 p-4 border rounded bg-green-50 dark:bg-slate-900 border-green-200">
            <div><label className="block text-sm font-medium">M-Pesa Sender Name</label>
              <input placeholder="Sender Name" className="w-full p-2 border rounded dark:bg-slate-700"
                value={form.mpesa_sender_name} onChange={e => setForm({...form, mpesa_sender_name: e.target.value})} required /></div>
            <div><label className="block text-sm font-medium">Transaction ID</label>
              <input placeholder="ABC123XYZ" className="w-full p-2 border rounded dark:bg-slate-700"
                value={form.mpesa_transaction_id} onChange={e => setForm({...form, mpesa_transaction_id: e.target.value})} required /></div>
          </div>
        )}

        <div className="flex space-x-6 py-2">
          <label className="flex items-center space-x-2">
            <input type="checkbox" checked={form.has_vacuum} onChange={e => setForm({...form, has_vacuum: e.target.checked})} />
            <span>Vacuum</span>
          </label>
          <label className="flex items-center space-x-2">
            <input type="checkbox" checked={form.has_engine_wash} onChange={e => setForm({...form, has_engine_wash: e.target.checked})} />
            <span>Engine Wash</span>
          </label>
        </div>

        {form.category !== 'motorcycle' && (
          <div><label className="block text-sm font-medium">Plate Number (e.g. KCA001A)</label>
            <input type="text" className="w-full p-2 border rounded dark:bg-slate-700 font-mono uppercase"
              placeholder="KCA001A" value={form.plate_number}
              onChange={e => setForm({...form, plate_number: e.target.value.toUpperCase()})} /></div>
        )}

        {form.category === 'carpet' && (
          <div className="space-y-4 p-4 border rounded bg-blue-50 dark:bg-slate-900">
            <h3 className="font-bold">Carpet Metadata</h3>
            <textarea placeholder="Characteristics (Mandatory)" className="w-full p-2 border rounded dark:bg-slate-700"
              value={form.carpet_characteristics} onChange={e => setForm({...form, carpet_characteristics: e.target.value})} required />
            <input type="tel" placeholder="Customer Phone (optional — for pickup)"
              className="w-full p-2 border rounded dark:bg-slate-700" value={form.customer_phone}
              onChange={e => setForm({...form, customer_phone: e.target.value})} />
            <select className="w-full p-2 border rounded dark:bg-slate-700" value={form.receiver_id}
              onChange={e => setForm({...form, receiver_id: e.target.value})} required>
              <option value="">Receiver (Employee)</option>
              {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          </div>
        )}

        <button type="submit" className="w-full bg-primary-600 text-white font-bold py-3 rounded hover:bg-primary-700">Submit Transaction</button>
      </form>
      ) : activeTab === 'expense' ? (
      <form onSubmit={handleExpenseSubmit} className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow space-y-4">
        <h2 className="text-xl font-bold">Log Business Expense</h2>
        <div className="grid grid-cols-2 gap-4">
          <div><label className="block text-sm font-medium">Description</label>
            <input className="w-full p-2 border rounded dark:bg-slate-700" value={expenseForm.description}
              onChange={e => setExpenseForm({...expenseForm, description: e.target.value})} required /></div>
          <div><label className="block text-sm font-medium">Amount</label>
            <input type="number" className="w-full p-2 border rounded dark:bg-slate-700"                 value={expenseForm.amount}
              onChange={e => setExpenseForm({...expenseForm, amount: toNum(e.target.value)})} required /></div>
        </div>
        <div><label className="block text-sm font-medium">Category</label>
          <select className="w-full p-2 border rounded dark:bg-slate-700" value={expenseForm.category}
            onChange={e => setExpenseForm({...expenseForm, category: e.target.value})}>
            <option value="General">General</option>
            <option value="Soap">Soap/Chemicals</option>
            <option value="Water">Water</option>
            <option value="Electricity">Electricity</option>
            <option value="Rent">Rent</option>
            <option value="Salary">Salary Advance</option>
          </select></div>
        <button type="submit" className="w-full bg-red-600 text-white font-bold py-3 rounded hover:bg-red-700">Log Expense</button>
      </form>
      ) : activeTab === 'tip' ? (
      <form onSubmit={handleTipSubmit} className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow space-y-4">
        <h2 className="text-xl font-bold text-purple-600">Log Employee Tip</h2>
        <p className="text-sm text-gray-500">Record a tip for an employee. Choose to add it to their wages or give cash and log as "Chai" expense.</p>
        <div className="grid grid-cols-2 gap-4">
          <div><label className="block text-sm font-medium">Employee</label>
            <select className="w-full p-2 border rounded dark:bg-slate-700" value={tipForm.employee_id}
              onChange={e => setTipForm({...tipForm, employee_id: e.target.value})} required>
              <option value="">Select Employee</option>
              {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select></div>
          <div><label className="block text-sm font-medium">Tip Amount (Ksh)</label>
            <input type="number" className="w-full p-2 border rounded dark:bg-slate-700"               value={tipForm.amount}
              onChange={e => setTipForm({...tipForm, amount: toNum(e.target.value)})} required /></div>
        </div>
        <div><label className="block text-sm font-medium">Method</label>
          <div className="flex space-x-4 mt-1">
            <label className="flex items-center space-x-2">
              <input type="radio" name="tip_method" value="wages" checked={tipForm.method === 'wages'}
                onChange={e => setTipForm({...tipForm, method: e.target.value})} />
              <span>Add to Wages</span>
            </label>
            <label className="flex items-center space-x-2">
              <input type="radio" name="tip_method" value="cash" checked={tipForm.method === 'cash'}
                onChange={e => setTipForm({...tipForm, method: e.target.value})} />
              <span>Give Cash (log as Chai expense)</span>
            </label>
          </div></div>
        <button type="submit" className="w-full bg-purple-600 text-white font-bold py-3 rounded hover:bg-purple-700">Log Tip</button>
      </form>
      ) : activeTab === 'debt' ? (
      <div className="space-y-4">
        <form onSubmit={handleDebtSubmit} className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow space-y-4">
          <h2 className="text-xl font-bold text-red-600">Log Employee Debt</h2>
          <p className="text-sm text-gray-500">Record a debt/advance for an employee. Debts persist until fully paid.</p>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium">Employee</label>
              <select className="w-full p-2 border rounded dark:bg-slate-700" value={debtForm.employee_id}
                onChange={e => setDebtForm({...debtForm, employee_id: e.target.value})} required>
                <option value="">Select Employee</option>
                {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select></div>
            <div><label className="block text-sm font-medium">Amount (Ksh)</label>
              <input type="number" min="0" className="w-full p-2 border rounded dark:bg-slate-700" value={debtForm.amount}
                onChange={e => setDebtForm({...debtForm, amount: toNum(e.target.value)})} required /></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium">Service (optional)</label>
              <input className="w-full p-2 border rounded dark:bg-slate-700" placeholder="e.g. advance, loan"
                value={debtForm.service} onChange={e => setDebtForm({...debtForm, service: e.target.value})} /></div>
            <div><label className="block text-sm font-medium">Initial Paid (Ksh)</label>
              <input type="number" min="0" className="w-full p-2 border rounded dark:bg-slate-700" value={debtForm.paid}
                onChange={e => setDebtForm({...debtForm, paid: toNum(e.target.value)})} /></div>
          </div>
          <div><label className="block text-sm font-medium">Paid Date (optional)</label>
            <input type="date" className="w-full p-2 border rounded dark:bg-slate-700" value={debtForm.paid_date}
              onChange={e => setDebtForm({...debtForm, paid_date: e.target.value})} /></div>
          <button type="submit" className="w-full bg-red-600 text-white font-bold py-3 rounded hover:bg-red-700">Log Debt</button>
        </form>
        <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">Debt Records</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b">
                  <th className="py-2">Employee</th>
                  <th className="py-2">Amount</th>
                  <th className="py-2">Service</th>
                  <th className="py-2">Date</th>
                  <th className="py-2">Paid</th>
                  <th className="py-2">Paid Date</th>
                  <th className="py-2">Balance</th>
                </tr>
              </thead>
              <tbody>
                {debts.map(d => (
                  <tr key={d.id} className="border-b">
                    <td className="py-2">{empMap[d.employee_id] || d.employee_id}</td>
                    <td className="py-2 font-mono">Ksh {d.amount}</td>
                    <td className="py-2">{d.service || '-'}</td>
                    <td className="py-2 text-sm">{format(new Date(d.date), 'dd/MM/yy')}</td>
                    <td className="py-2 font-mono">Ksh {d.paid}</td>
                    <td className="py-2 text-sm">{d.paid_date ? format(new Date(d.paid_date), 'dd/MM/yy') : '-'}</td>
                    <td className="py-2 font-bold text-red-600">Ksh {d.balance}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      ) : (
      <form onSubmit={handleRepaymentSubmit} className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow space-y-4">
        <h2 className="text-xl font-bold text-green-600">Record Debt Repayment</h2>
        <div className="grid grid-cols-2 gap-4">
          <div><label className="block text-sm font-medium">Employee</label>
            <select className="w-full p-2 border rounded dark:bg-slate-700" value={repaymentForm.employee_id}
              onChange={e => setRepaymentForm({...repaymentForm, employee_id: e.target.value})} required>
              <option value="">Select Employee</option>
              {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select></div>
          <div><label className="block text-sm font-medium">Repayment Amount (Ksh)</label>
            <input type="number" className="w-full p-2 border rounded dark:bg-slate-700"               value={repaymentForm.amount}
              onChange={e => setRepaymentForm({...repaymentForm, amount: toNum(e.target.value)})} required /></div>
        </div>
        <button type="submit" className="w-full bg-green-600 text-white font-bold py-3 rounded hover:bg-green-700">Confirm Repayment</button>
      </form>
      )}

      <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow">
         <h2 className="text-xl font-semibold mb-4">Transactions {viewMode === 'day' ? `for ${format(selectedDay, 'PPPP')}` : `W${format(weekStart, 'w yyyy')}`}</h2>
         <div className="overflow-x-auto">
           <table className="w-full text-left">
             <thead>
               <tr className="border-b">
                 <th className="py-2">Time</th>
                 <th className="py-2">Washer</th>
                 <th className="py-2">Category</th>
                 <th className="py-2">Plate</th>
                 <th className="py-2">Paid</th>
                 <th className="py-2">Shortfall</th>
                 <th className="py-2">Actions</th>
               </tr>
             </thead>
             <tbody>
               {transactions.map(tx => (
                 editingTx === tx.id ? (
                   <tr key={tx.id} className="border-b bg-yellow-50 dark:bg-yellow-900/20">
                     <td className="py-2 text-xs">{format(new Date(tx.timestamp), 'HH:mm')}</td>
                     <td className="py-2">
                       <select className="w-full p-1 text-xs border rounded dark:bg-slate-700" value={editForm.washer_id}
                         onChange={e => setEditForm({...editForm, washer_id: e.target.value})}>
                         {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                       </select>
                     </td>
                     <td className="py-2">
                       <select className="w-full p-1 text-xs border rounded dark:bg-slate-700" value={editForm.category}
                         onChange={e => { const cat = e.target.value; setEditForm({...editForm, category: cat}); }}>
                         <option value="bicycle">Bicycle</option>
                         <option value="motorcycle">Motorcycle</option>
                         <option value="taxi">Taxi</option>
                         <option value="car">Car</option>
                         <option value="midrange">Midrange</option>
                         <option value="lorry">Lorry</option>
                         <option value="carpet">Carpet</option>
                       </select>
                     </td>
                     <td className="py-2">
                       {editForm.category !== 'motorcycle' ? (
                         <input type="text" className="w-full p-1 text-xs border rounded dark:bg-slate-700 font-mono uppercase"
                           value={editForm.plate_number} onChange={e => setEditForm({...editForm, plate_number: e.target.value.toUpperCase()})} />
                       ) : <span className="text-xs">-</span>}
                     </td>
                     <td className="py-2">
                       <div className="flex space-x-1">
                         <input type="number" className="w-16 p-1 text-xs border rounded dark:bg-slate-700"
                           value={editForm.cash_paid} onChange={e => setEditForm({...editForm, cash_paid: parseInt(e.target.value)})} />
                         <input type="number" className="w-16 p-1 text-xs border rounded dark:bg-slate-700"
                           value={editForm.mpesa_paid} onChange={e => setEditForm({...editForm, mpesa_paid: parseInt(e.target.value)})} />
                       </div>
                     </td>
                     <td className="py-2 text-xs">-</td>
                     <td className="py-2">
                       <div className="flex space-x-1">
                         <button onClick={() => handleEditSave(tx.id)} className="px-2 py-1 text-xs bg-green-600 text-white rounded">Save</button>
                         <button onClick={() => setEditingTx(null)} className="px-2 py-1 text-xs bg-gray-400 text-white rounded">Cancel</button>
                       </div>
                     </td>
                   </tr>
                 ) : (
                   <tr key={tx.id} className="border-b">
                     <td className="py-2">{format(new Date(tx.timestamp), 'HH:mm')}</td>
                     <td className="py-2 font-medium">{empMap[tx.washer_id] || tx.washer_id}</td>
                     <td className="py-2 capitalize">{tx.category}</td>
                     <td className="py-2 font-mono text-xs">{tx.plate_number || '-'}</td>
                     <td className="py-2 font-mono">Ksh {tx.total_paid}</td>
                     <td className="py-2 text-red-500 font-mono">{tx.shortfall > 0 ? `Ksh ${tx.shortfall}` : '-'}</td>
                     <td className="py-2">
                       <div className="flex space-x-1">
                         <button onClick={() => handleEdit(tx)} className="px-2 py-1 text-xs bg-blue-600 text-white rounded">Edit</button>
                         <button onClick={() => handleDelete(tx.id)} className="px-2 py-1 text-xs bg-red-600 text-white rounded">Del</button>
                       </div>
                     </td>
                   </tr>
                 )
               ))}
             </tbody>
           </table>
         </div>
      </div>
    </div>
  );
}
