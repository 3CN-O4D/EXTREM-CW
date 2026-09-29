import React, { useState, useEffect, useMemo } from 'react';
import api from '../services/api';
import { format, startOfWeek, addDays, isSameDay, addWeeks } from 'date-fns';
import { parsePaymentSms, type ParsedPaymentSms } from '../utils/smsParser';

const toNum = (v: any) => { const n = parseInt(v); return isNaN(n) ? 0 : Math.max(0, n); };
const toF = (v: any) => { const n = parseFloat(v); return isNaN(n) ? 0 : Math.max(0, n); };

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
    midrange: 300, lorry: 500, carpet: 300, other: 0
  };
  const VACUUM_TIERS = [0, 300];
  const ENGINE_TIERS = [0, 300];
  const COMBO_PRICE = 600;
  const TAXI_TIER = 150;

  const [form, setForm] = useState({
    washer_id: '', category: 'car', expected_price: 200,
    cash_paid: 0, mpesa_paid: 0, mpesa_transaction_id: '',
    mpesa_sender_name: '', tip_method: 'cash',
    has_car_wash: true, vacuum_tier: 0, engine_tier: 0,
    manual_tip: 0, plate_number: '', customer_phone: '',
    carpet_characteristics: '', receiver_id: '', custom_category: '', client_name: ''
  });
  const [carpetImage, setCarpetImage] = useState('');
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [smsInput, setSmsInput] = useState('');
  const [smsPreview, setSmsPreview] = useState<ParsedPaymentSms | null>(null);
  const [extraChoice, setExtraChoice] = useState<'tip' | 'misc'>('tip');
  const [miscAmount, setMiscAmount] = useState(0);
  const [miscDesc, setMiscDesc] = useState('');

  const extra = Math.max(0, toNum(form.cash_paid) + toNum(form.mpesa_paid) - toNum(form.expected_price));
  const effectiveMisc = extraChoice === 'misc' && extra > 0 ? Math.min(toF(miscAmount), extra) : 0;

  const vacuumTiers = form.category === 'taxi' ? [0, TAXI_TIER, ...VACUUM_TIERS.filter(t => t > 0)] : VACUUM_TIERS;
  const engineTiers = form.category === 'taxi' ? [0, TAXI_TIER, ...ENGINE_TIERS.filter(t => t > 0)] : ENGINE_TIERS;

  const computePrice = (cat: any, vacuum: number, engine: number) => {
    if (vacuum > 0 && engine > 0) return COMBO_PRICE;
    if (vacuum > 0 || engine > 0) return (standardPrices[cat] || 0) + (vacuum > 0 ? vacuum : engine);
    return standardPrices[cat] || 0;
  };

  const setTier = (key: 'vacuum_tier' | 'engine_tier', value: number) => {
    setForm(f => {
      const vacuum = key === 'vacuum_tier' ? value : f.vacuum_tier;
      const engine = key === 'engine_tier' ? value : f.engine_tier;
      return { ...f, [key]: value, expected_price: computePrice(f.category, vacuum, engine) };
    });
  };

  const setCat = (cat: any) => {
    setForm(f => {
      const vacuum = f.vacuum_tier === TAXI_TIER && cat !== 'taxi' ? 0 : f.vacuum_tier;
      const engine = f.engine_tier === TAXI_TIER && cat !== 'taxi' ? 0 : f.engine_tier;
      return { ...f, category: cat, vacuum_tier: vacuum, engine_tier: engine, expected_price: computePrice(cat, vacuum, engine) };
    });
  };

  const [carpetMode, setCarpetMode] = useState<'received' | 'released'>('received');
  const [heldCarpets, setHeldCarpets] = useState<any[]>([]);
  const [releaseCarpetId, setReleaseCarpetId] = useState('');
  const [carpets, setCarpets] = useState<any[]>([]);

  const [tipForm, setTipForm] = useState({ employee_id: '', amount: 0, method: 'wages' });
  const [expenseForm, setExpenseForm] = useState({ description: '', amount: 0, category: 'General' });
  const [repaymentForm, setRepaymentForm] = useState({ employee_id: '', amount: 0 });
  const [activeTab, setActiveTab] = useState<'transaction' | 'expense' | 'repayment' | 'tip' | 'debt' | 'sheet' | 'carpets' | 'payday' | 'client-debts' | 'arrivals'>('transaction');
  const [debts, setDebts] = useState<any[]>([]);
  const [debtForm, setDebtForm] = useState({
    employee_id: '', amount: 0, service: '', paid: 0, paid_date: '', notes: ''
  });
  // Auto-calculated shortfalls can be corrected too: edit the amount, or mark
  // them paid in full or in part.
  const [editingDebt, setEditingDebt] = useState<number | null>(null);
  const [debtEdit, setDebtEdit] = useState({ amount: 0, paid: 0 });
  const [arrivals, setArrivals] = useState<any[]>([]);
  const [sheet, setSheet] = useState<any>({ summary: null, employees: [], expenses: [] });
  const [settlementLogs, setSettlementLogs] = useState<any[]>([]);
  const [settlementResult, setSettlementResult] = useState<any>(null);
  const [clientDebts, setClientDebts] = useState<any[]>([]);
  const [clientDebtForm, setClientDebtForm] = useState({
    client_name: '', customer_phone: '', description: '', amount: 0, date: format(new Date(), 'yyyy-MM-dd')
  });

  const empMap = Object.fromEntries(employees.map(e => [e.id, e.name]));
  const abbrMap = Object.fromEntries(employees.map(e => [e.id, e.abbreviation]));
  const plateCategories = ['car', 'taxi', 'midrange', 'lorry'];
  const showsPlate = plateCategories.includes(form.category);

  // Duplicate guard for the day sheet: same plate, same employee, same expected
  // price, same total paid. These rows are almost always double-taps, so they
  // are tinted yellow for the manager to edit, remove, or keep as they are.
  const duplicateTxIds = useMemo(() => {
    const seen = new Map<string, number[]>();
    transactions.forEach((tx: any) => {
      const item = tx.category === 'carpet'
        ? (tx.carpet_characteristics || 'Carpet')
        : (tx.plate_number || tx.custom_category || '-');
      const key = [item, tx.washer_id, tx.expected_price, tx.total_paid].join('|');
      seen.set(key, [...(seen.get(key) || []), tx.id]);
    });
    const dupes = new Set<number>();
    seen.forEach(ids => { if (ids.length > 1) ids.forEach(id => dupes.add(id)); });
    return dupes;
  }, [transactions]);

  useEffect(() => {
    api.get('/stats/employees').then(res => setEmployees(res.data));
  }, []);

  useEffect(() => {
    fetchTransactions();
  }, [selectedDay, viewMode, weekOffset]);

  useEffect(() => {
    const params = viewMode === 'day' ? { day: format(selectedDay, 'yyyy-MM-dd') } : {};
    Promise.all([
      api.get('/stats/summary', { params }),
      api.get('/stats/employees', { params }),
      api.get('/expenses/', { params })
    ]).then(([s, e, x]) => setSheet({ summary: s.data, employees: e.data, expenses: x.data }))
      .catch(() => {});
  }, [selectedDay, viewMode, weekOffset]);

  const fetchTransactions = async () => {
    const params: any = {};
    if (viewMode === 'day') {
      params.day = format(selectedDay, 'yyyy-MM-dd');
    } else {
      const weekStart = startOfWeek(addWeeks(new Date(), weekOffset), { weekStartsOn: 1 });
      params.week_id = format(weekStart, 'yyyy-II');
    }
    const res = await api.get('/transactions/', { params });
    setTransactions(res.data);
  };

  useEffect(() => {
    fetchCarpets();
  }, []);

  const compressImage = (file: File, maxW = 800, quality = 0.72): Promise<string> =>
    new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        const scale = Math.min(1, maxW / img.width);
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(url);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = reject;
      img.src = url;
    });

  const fetchCarpets = async () => {
    try {
      const res = await api.get('/carpets/');
      setCarpets(res.data);
      setHeldCarpets(res.data.filter((c: any) => c.status === 'received'));
    } catch {}
  };

  const handleParseSms = () => {
    const parsed = parsePaymentSms(smsInput);
    if (!parsed) {
      setSmsPreview(null);
      alert('Could not parse this message. Use a M-Pesa "Confirmed" or the bank "Dear ..." announcement.');
      return;
    }
    setSmsPreview(parsed);
    setForm(f => ({
      ...f,
      mpesa_paid: parsed.amount,
      mpesa_sender_name: parsed.senderName,
      mpesa_transaction_id: parsed.transactionId
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (form.category === 'carpet') {
        if (carpetMode === 'received') {
          if (!carpetImage) {
            alert('Take a photo of the carpet first — it is required on arrival.');
            return;
          }
          await api.post('/carpets/', {
            receiver_id: form.receiver_id ? toNum(form.receiver_id) : null,
            characteristics: form.carpet_characteristics,
            client_name: form.client_name || null,
            customer_phone: form.customer_phone || null,
            image_data: carpetImage,
            expected_price: toNum(form.expected_price),
            cash_paid: toNum(form.cash_paid),
            mpesa_paid: toNum(form.mpesa_paid)
          });
          alert('Carpet logged as Received!');
        } else {
          await api.post(`/carpets/${releaseCarpetId}/release`, {
            cash_paid: toNum(form.cash_paid),
            mpesa_paid: toNum(form.mpesa_paid),
            client_name: form.client_name || null,
            customer_phone: form.customer_phone || null
          });
          alert('Carpet released!');
        }
        fetchCarpets();
      } else {
        const payload = {
          ...form, washer_id: toNum(form.washer_id),
          expected_price: toNum(form.expected_price),
          cash_paid: toNum(form.cash_paid),
          mpesa_paid: toNum(form.mpesa_paid),
          manual_tip: toNum(form.manual_tip),
          misc_amount: form.category === 'carpet' ? 0 : effectiveMisc,
          misc_description: form.category === 'carpet' || effectiveMisc === 0 ? null : (miscDesc || null),
          has_vacuum: form.vacuum_tier > 0,
          has_engine_wash: form.engine_tier > 0,
          plate_number: form.plate_number || null,
          custom_category: form.custom_category || null,
          carpet_metadata: null
        };
        await api.post('/transactions/', payload);
        alert('Transaction logged!');
        fetchTransactions();
      }
      setForm({ ...form, cash_paid: 0, mpesa_paid: 0, mpesa_transaction_id: '', mpesa_sender_name: '', manual_tip: 0, plate_number: '', custom_category: '', client_name: '' });
      setCarpetImage('');
      setSmsInput('');
      setSmsPreview(null);
      setExtraChoice('tip');
      setMiscAmount(0);
      setMiscDesc('');
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
      misc_amount: tx.misc_amount || 0,
      misc_description: tx.misc_description || '',
      has_car_wash: tx.has_car_wash || false,
      has_vacuum: tx.has_vacuum || false,
      has_engine_wash: tx.has_engine_wash || false,
      plate_number: tx.plate_number || '',
      custom_category: tx.custom_category || '',
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
      payload.misc_amount = parseFloat(editForm.misc_amount) || 0;
      payload.misc_description = editForm.misc_description || null;
      payload.has_car_wash = editForm.has_car_wash;
      payload.has_vacuum = editForm.has_vacuum;
      payload.has_engine_wash = editForm.has_engine_wash;
      payload.plate_number = editForm.plate_number || null;
      payload.custom_category = editForm.custom_category || null;
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

  // Compact in-place fix for a row in the day sheet (used to correct a duplicate
  // or a mistyped amount without leaving the sheet).
  const saveSheetEdit = async (txId: number) => {
    try {
      await api.put(`/transactions/${txId}`, {
        washer_id: parseInt(editForm.washer_id),
        expected_price: toNum(editForm.expected_price),
        cash_paid: toNum(editForm.cash_paid),
        mpesa_paid: toNum(editForm.mpesa_paid),
      });
      setEditingTx(null);
      fetchTransactions();
    } catch (e: any) { alert(e.response?.data?.detail || 'Error updating transaction'); }
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

  const handleCarpetWash = async (carpetId: number) => {
    try {
      await api.patch(`/carpets/${carpetId}/wash`);
      fetchCarpets();
      alert('Marked as washed');
    } catch { alert('Error marking carpet'); }
  };

  // The receiver can be assigned days after the carpet arrived.
  const handleCarpetAssign = async (carpetId: number, employeeId: string) => {
    try {
      await api.patch(`/carpets/${carpetId}`, {
        receiver_id: employeeId === '' ? null : Number(employeeId),
      });
      fetchCarpets();
    } catch (e: any) { alert(e.response?.data?.detail || 'Error assigning carpet'); }
  };

  // Releasing does not require a wash or a full payment — whoever does the work
  // gets the commission, and any unpaid balance goes to the client-debt list.
  const handleCarpetRelease = async (carpetId: number, price: number, washerId: number | null) => {
    const amount = prompt(`Release carpet — Cash received (Ksh, expected ${price}). Enter 0 if unpaid:`, String(price));
    if (amount === null) return;
    const who = prompt(
      `Who washed it? Enter 1-${employees.length} for the employee number, or leave blank to use the receiver.`,
      washerId ? String(employees.findIndex((e: any) => e.id === washerId) + 1) : '',
    );
    if (who === null) return;
    const idx = parseInt(who, 10);
    const picked = Number.isInteger(idx) && idx >= 1 && idx <= employees.length ? employees[idx - 1].id : washerId;
    try {
      await api.post(`/carpets/${carpetId}/release`, {
        cash_paid: toNum(amount),
        washer_id: picked ?? null,
      });
      fetchCarpets();
      alert('Carpet released (auto-deletes after 1 day)');
    } catch (e: any) { alert(e.response?.data?.detail || 'Error releasing carpet'); }
  };

  const handleCarpetDelete = async (carpetId: number) => {
    if (!confirm('Delete this carpet record?')) return;
    try {
      await api.delete(`/carpets/${carpetId}`);
      fetchCarpets();
    } catch { alert('Error deleting carpet'); }
  };

  const fetchDebts = async () => {
    try {
      const res = await api.get('/debts/');
      setDebts(res.data);
    } catch {}
  };

  useEffect(() => { fetchDebts(); }, []);

  // Edit an auto-calculated shortfall (or any debt): fix the amount, or mark it
  // paid in full or in part.
  const saveDebtEdit = async (debtId: number) => {
    try {
      await api.put(`/debts/${debtId}`, { amount: toNum(debtEdit.amount), paid: toNum(debtEdit.paid) });
      setEditingDebt(null);
      fetchDebts();
      api.get('/stats/employees').then(res => setEmployees(res.data));
    } catch (e: any) { alert(e.response?.data?.detail || 'Could not update the debt'); }
  };

  const markDebtPaid = async (debtId: number, full: boolean, amount: number) => {
    try {
      await api.put(`/debts/${debtId}`, { paid: full ? amount : Math.floor(amount / 2) });
      fetchDebts();
      api.get('/stats/employees').then(res => setEmployees(res.data));
    } catch (e: any) { alert(e.response?.data?.detail || 'Could not update the debt'); }
  };

  const deleteDebt = async (debtId: number) => {
    if (!confirm('Remove this debt/shortfall record?')) return;
    try {
      await api.delete(`/debts/${debtId}`);
      fetchDebts();
      api.get('/stats/employees').then(res => setEmployees(res.data));
    } catch { alert('Error removing debt'); }
  };

  const fetchArrivals = async () => {
    try { const res = await api.get('/vehicles/'); setArrivals(res.data); } catch {}
  };

  useEffect(() => { fetchArrivals(); }, [activeTab]);

  // Manager can take the payment on behalf of the employee who logged it.
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
  const weekId = format(weekStart, 'yyyy-II');

  const fetchSettlements = async () => {
    try { const res = await api.get('/settlements/'); setSettlementLogs(res.data); } catch {}
  };
  const fetchClientDebts = async () => {
    try { const res = await api.get('/client-debts/'); setClientDebts(res.data); } catch {}
  };

  useEffect(() => { fetchSettlements(); fetchClientDebts(); }, []);

  const handleSettleWeek = async () => {
    if (!confirm(`Run payday for the week of ${format(weekStart, 'PPP')} (${weekId})?\n\nEveryone's weekly wages are paid out after covering ALL open debts. Anything short carries forward; payable balance resets to zero so Monday starts fresh. A week can only be settled once.\n\nContinue?`)) return;
    try {
      const res = await api.post('/settlements/', { week_id: weekId });
      setSettlementResult(res.data);
      alert('Payday complete! See the breakdown below.');
      fetchSettlements();
      api.get('/stats/employees').then(r => setEmployees(r.data));
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

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8">
      <h1 className="text-2xl font-bold mb-6">Manager Workspace</h1>

      <div className="flex border-b dark:border-slate-700">
        <button onClick={() => setActiveTab('transaction')} className={`px-6 py-2 font-medium ${activeTab === 'transaction' ? 'border-b-2 border-primary-600 text-primary-600' : 'text-gray-500'}`}>New Transaction</button>
        <button onClick={() => setActiveTab('expense')} className={`px-6 py-2 font-medium ${activeTab === 'expense' ? 'border-b-2 border-primary-600 text-primary-600' : 'text-gray-500'}`}>Log Expenses</button>
        <button onClick={() => setActiveTab('repayment')} className={`px-6 py-2 font-medium ${activeTab === 'repayment' ? 'border-b-2 border-primary-600 text-primary-600' : 'text-gray-500'}`}>Debt Repayment</button>
        <button onClick={() => setActiveTab('tip')} className={`px-6 py-2 font-medium ${activeTab === 'tip' ? 'border-b-2 border-primary-600 text-primary-600' : 'text-gray-500'}`}>Log Tip</button>
        <button onClick={() => setActiveTab('debt')} className={`px-6 py-2 font-medium ${activeTab === 'debt' ? 'border-b-2 border-primary-600 text-primary-600' : 'text-gray-500'}`}>Log Debt</button>
        <button onClick={() => setActiveTab('sheet')} className={`px-6 py-2 font-medium ${activeTab === 'sheet' ? 'border-b-2 border-primary-600 text-primary-600' : 'text-gray-500'}`}>Day Sheet</button>
        <button onClick={() => setActiveTab('carpets')} className={`px-6 py-2 font-medium ${activeTab === 'carpets' ? 'border-b-2 border-primary-600 text-primary-600' : 'text-gray-500'}`}>Carpets</button>
        <button onClick={() => setActiveTab('payday')} className={`px-6 py-2 font-medium ${activeTab === 'payday' ? 'border-b-2 border-primary-600 text-primary-600' : 'text-gray-500'}`}>Payday</button>
        <button onClick={() => setActiveTab('client-debts')} className={`px-6 py-2 font-medium ${activeTab === 'client-debts' ? 'border-b-2 border-primary-600 text-primary-600' : 'text-gray-500'}`}>Client Debts</button>
        <button onClick={() => setActiveTab('arrivals')} className={`px-6 py-2 font-medium ${activeTab === 'arrivals' ? 'border-b-2 border-primary-600 text-primary-600' : 'text-gray-500'}`}>Arrivals</button>
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
              onChange={e => { const cat = e.target.value; setCat(cat); }}>
              <option value="bicycle">Bicycle</option>
              <option value="motorcycle">Motorcycle</option>
              <option value="taxi">Taxi</option>
              <option value="car">Normal Car</option>
              <option value="midrange">Midrange</option>
              <option value="lorry">Lorry</option>
              <option value="carpet">Carpet</option>
              <option value="other">Other</option>
            </select>
            <div className="flex flex-wrap gap-1.5">
              {[{k:'motorcycle',l:'Bike'},{k:'taxi',l:'Taxi'},{k:'car',l:'Car'},{k:'midrange',l:'Mid'},{k:'lorry',l:'Lorry'},{k:'carpet',l:'Carpet'},{k:'bicycle',l:'Cycle'},{k:'other',l:'Other'}].map(({k,l}) => (
                <button key={k} type="button" onClick={() => setCat(k)}
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

        {form.category !== 'carpet' && (
          <div className="p-4 border rounded bg-indigo-50 dark:bg-slate-900 border-indigo-200 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-semibold">✉️ Log Payment from SMS</label>
              {smsPreview && <span className="text-xs font-medium text-green-600">Filled from {smsPreview.source === 'mpesa' ? 'M-Pesa' : 'bank'} message</span>}
            </div>
            <textarea className="w-full p-2 border rounded dark:bg-slate-700 text-sm" rows={2}
              placeholder="Paste the M-Pesa or bank (NCBA) payment message here..."
              value={smsInput} onChange={e => setSmsInput(e.target.value)} />
            <button type="button" onClick={handleParseSms} className="px-3 py-1.5 bg-indigo-600 text-white text-sm rounded hover:bg-indigo-700">
              Parse SMS
            </button>
            {smsPreview && (
              <div className="text-xs space-y-0.5">
                <div>Sender: <b>{smsPreview.senderName}</b> · Amount: <b>Ksh {smsPreview.amount}</b> · Ref: <b>{smsPreview.transactionId}</b></div>
                {smsPreview.amount < toNum(form.expected_price) ? (
                  <div className="text-amber-600 dark:text-amber-400 font-medium">
                    Amount is Ksh {toNum(form.expected_price) - smsPreview.amount} short of expected — add cash alongside, otherwise it counts as the employee's shortfall.
                  </div>
                ) : smsPreview.amount === toNum(form.expected_price) ? (
                  <div className="text-green-600 font-medium">Exact expected amount — settled.</div>
                ) : (
                  <div className="text-green-600 font-medium">Overpaid — decide below what the extra is.</div>
                )}
              </div>
            )}
          </div>
        )}

        {form.category !== 'carpet' && extra > 0 && (
          <div className="p-4 border rounded bg-amber-50 dark:bg-slate-900 border-amber-200 space-y-2">
            <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">Extra of Ksh {extra} beyond the expected price</p>
            <div className="flex flex-wrap gap-x-6 gap-y-1">
              <label className="flex items-center space-x-2 text-sm">
                <input type="radio" checked={extraChoice === 'tip'} onChange={() => setExtraChoice('tip')} />
                <span>Tip (default — isolated from business revenue)</span>
              </label>
              <label className="flex items-center space-x-2 text-sm">
                <input type="radio" checked={extraChoice === 'misc'} onChange={() => setExtraChoice('misc')} />
                <span>Miscellaneous income (goes to the business)</span>
              </label>
            </div>
            {extraChoice === 'misc' && (
              <div className="grid grid-cols-2 gap-2">
                <input type="number" min="0" className="w-full p-2 border rounded dark:bg-slate-700 text-sm"
                  value={miscAmount} onChange={e => setMiscAmount(toF(e.target.value))} placeholder={`Amount (max Ksh ${extra})`} />
                <input type="text" className="w-full p-2 border rounded dark:bg-slate-700 text-sm" placeholder="What for? e.g. Buffing, Polish, Change"
                  value={miscDesc} onChange={e => setMiscDesc(e.target.value)} />
              </div>
            )}
          </div>
        )}

        {form.category !== 'carpet' && (
          <div className="p-4 border rounded bg-fuchsia-50 dark:bg-slate-900 border-fuchsia-200 space-y-2">
            <p className="text-sm font-semibold text-fuchsia-700 dark:text-fuchsia-400">💵 Employee Tip</p>
            <div className="flex flex-wrap gap-x-6 gap-y-1">
              <label className="flex items-center space-x-2 text-sm">
                <input type="radio" name="tip_method" value="cash" checked={form.tip_method === 'cash'}
                  onChange={e => setForm({...form, tip_method: e.target.value})} />
                <span>Cash tip — hand it over now, auto-logged as an expense</span>
              </label>
              <label className="flex items-center space-x-2 text-sm">
                <input type="radio" name="tip_method" value="wages" checked={form.tip_method === 'wages'}
                  onChange={e => setForm({...form, tip_method: e.target.value})} />
                <span>Add to wages (paid out on payday)</span>
              </label>
            </div>
            <div className="grid grid-cols-2 gap-2 items-end">
              <div>
                <label className="block text-xs font-medium">Tip amount (Ksh)</label>
                <input type="number" min="0" className="w-full p-2 border rounded dark:bg-slate-700 text-sm"
                  value={form.manual_tip} onChange={e => setForm({...form, manual_tip: toNum(e.target.value)})}
                  placeholder="e.g. 50" />
              </div>
              <p className="text-xs text-gray-500">
                {extra > 0 && extraChoice === 'tip'
                  ? `The Ksh ${extra} overpayment above is also a tip and follows this choice.`
                  : 'Overpayments count as tips by default (see the Extra box above).'}
              </p>
            </div>
          </div>
        )}

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

        {form.category !== 'carpet' && (
        <div className="flex flex-wrap items-center gap-x-8 gap-y-2 py-2">
          <div className="flex items-center space-x-1.5">
            <span className="text-sm font-medium mr-1">Vacuum:</span>
            {vacuumTiers.map(t => (
              <button key={t} type="button" onClick={() => setTier('vacuum_tier', t)}
                className={`px-2.5 py-1 rounded text-xs font-medium transition ${
                  form.vacuum_tier === t ? 'bg-primary-600 text-white' : 'bg-gray-100 dark:bg-slate-700 hover:bg-gray-200'
                }`}>{t === 0 ? 'None' : `Ksh ${t}`}</button>
            ))}
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="text-sm font-medium mr-1">Engine Wash:</span>
            {engineTiers.map(t => (
              <button key={t} type="button" onClick={() => setTier('engine_tier', t)}
                className={`px-2.5 py-1 rounded text-xs font-medium transition ${
                  form.engine_tier === t ? 'bg-primary-600 text-white' : 'bg-gray-100 dark:bg-slate-700 hover:bg-gray-200'
                }`}>{t === 0 ? 'None' : `Ksh ${t}`}</button>
            ))}
          </div>
          <span className="text-xs text-gray-400">
            {form.vacuum_tier > 0 && form.engine_tier > 0 ? `Full Package: Ksh ${toNum(form.expected_price)}` : `Total: Ksh ${toNum(form.expected_price)}`}
          </span>
        </div>
        )}

        {showsPlate && (
          <div><label className="block text-sm font-medium">Plate Number <span className="text-red-500">*</span></label>
            <input type="text" required pattern="[A-Z0-9][A-Z0-9 -]{2,}"
              title="Standard Kenyan plate (e.g. KCA182M), plant-operator, NGO/Government, or East African plate (e.g. UAA123X)"
              className="w-full p-2 border rounded dark:bg-slate-700 font-mono uppercase"
              placeholder="e.g. KCA182M, KDG200A, NGO123A, UAA123X" value={form.plate_number}
              onChange={e => setForm({...form, plate_number: e.target.value.toUpperCase()})} />
            <p className="text-xs text-gray-400 mt-1">Kenyan, plant operator, NGO/Government &amp; East African plates accepted</p>
          </div>
        )}

        {form.category === 'other' && (
          <div><label className="block text-sm font-medium">Custom Service Name</label>
            <input type="text" className="w-full p-2 border rounded dark:bg-slate-700"
              placeholder="e.g. Drying, Buffing, Polishing" value={form.custom_category}
              onChange={e => setForm({...form, custom_category: e.target.value})} required /></div>
        )}

        {form.category === 'carpet' && (
          <div className="space-y-4 p-4 border rounded bg-blue-50 dark:bg-slate-900">
            <h3 className="font-bold">Carpet</h3>
            <div className="flex space-x-6">
              <label className="flex items-center space-x-2">
                <input type="radio" name="carpet_mode" value="received" checked={carpetMode === 'received'}
                  onChange={e => setCarpetMode(e.target.value as any)} />
                <span>Received (payment optional)</span>
              </label>
              <label className="flex items-center space-x-2">
                <input type="radio" name="carpet_mode" value="released" checked={carpetMode === 'released'}
                  onChange={e => setCarpetMode(e.target.value as any)} />
                <span>Released</span>
              </label>
            </div>

            {carpetMode === 'received' ? (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <input type="text" placeholder="Client Name (optional)"
                    className="w-full p-2 border rounded dark:bg-slate-700" value={form.client_name}
                    onChange={e => setForm({...form, client_name: e.target.value})} />
                  <input type="tel" placeholder="Client Phone (optional — for pickup)"
                    className="w-full p-2 border rounded dark:bg-slate-700" value={form.customer_phone}
                    onChange={e => setForm({...form, customer_phone: e.target.value})} />
                </div>
                <textarea placeholder="Characteristics (Mandatory)" className="w-full p-2 border rounded dark:bg-slate-700"
                  value={form.carpet_characteristics} onChange={e => setForm({...form, carpet_characteristics: e.target.value})} required
                  onFocus={() => fetchCarpets()} />
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 px-3 py-2 border rounded bg-white dark:bg-slate-800 cursor-pointer text-sm">
                    📷 {carpetImage ? 'Change Photo' : 'Add Carpet Photo'}
                    <input type="file" accept="image/*" capture="environment"
                      className="hidden" onChange={e => {
                        const f = e.target.files?.[0];
                        if (f) compressImage(f).then(setCarpetImage).catch(() => alert('Could not read image'));
                      }} />
                  </label>
                  {carpetImage ? (
                    <img src={carpetImage} alt="carpet" className="h-14 w-14 object-cover rounded border" />
                  ) : (
                    <span className="text-xs text-red-500 font-medium">A photo is required on arrival</span>
                  )}
                </div>
                <select className="w-full p-2 border rounded dark:bg-slate-700" value={form.receiver_id}
                  onChange={e => setForm({...form, receiver_id: e.target.value})}>
                  <option value="">Receiver — pick now or later</option>
                  {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
              </>
            ) : (
              <>
                <select className="w-full p-2 border rounded dark:bg-slate-700" value={releaseCarpetId}
                  onChange={e => setReleaseCarpetId(e.target.value)} required>
                  <option value="">Select Held Carpet</option>
                  {heldCarpets.map(c => <option key={c.id} value={c.id}>{c.characteristics || 'Carpet'} — {abbrMap[c.receiver_id] || c.receiver_id}</option>)}
                </select>
                <input type="tel" placeholder="Customer Phone (optional)"
                  className="w-full p-2 border rounded dark:bg-slate-700" value={form.customer_phone}
                  onChange={e => setForm({...form, customer_phone: e.target.value})} />
                <div className="grid grid-cols-2 gap-2">
                  <input type="number" min="0" placeholder="Cash Received" className="w-full p-2 border rounded dark:bg-slate-700"
                    value={form.cash_paid} onChange={e => setForm({...form, cash_paid: toNum(e.target.value)})} />
                  <input type="number" min="0" placeholder="M-Pesa Received" className="w-full p-2 border rounded dark:bg-slate-700"
                    value={form.mpesa_paid} onChange={e => setForm({...form, mpesa_paid: toNum(e.target.value)})} />
                </div>
              </>
            )}
          </div>
        )}

        <button type="submit" className="w-full bg-primary-600 text-white font-bold py-3 rounded hover:bg-primary-700">
          {form.category === 'carpet' ? (carpetMode === 'received' ? 'Log Received Carpet' : 'Release Carpet') : 'Submit Transaction'}
        </button>
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
          <h2 className="text-xl font-semibold mb-1">Debt Records</h2>
          <p className="text-sm text-gray-500 mb-4">
            Includes shortfalls calculated automatically. Correct the amount if the maths was wrong, or mark
            any of them paid in full or in part.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b">
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
                {debts.map(d => (
                  <tr key={d.id} className="border-b">
                    <td className="py-2">{empMap[d.employee_id] || d.employee_id}</td>
                    {editingDebt === d.id ? (
                      <>
                        <td className="py-2">
                          <input type="number" min="0" className="w-24 p-1 text-sm border rounded dark:bg-slate-700"
                            value={debtEdit.amount} onChange={e => setDebtEdit({...debtEdit, amount: toNum(e.target.value)})} />
                        </td>
                        <td className="py-2 text-xs text-gray-500" colSpan={2}>
                          {d.service || '-'}{d.notes ? <div className="text-gray-400">{d.notes}</div> : null}
                        </td>
                        <td className="py-2">
                          <input type="number" min="0" className="w-24 p-1 text-sm border rounded dark:bg-slate-700"
                            value={debtEdit.paid} onChange={e => setDebtEdit({...debtEdit, paid: toNum(e.target.value)})} />
                        </td>
                        <td className="py-2 font-bold text-red-600">Ksh {Math.max(0, debtEdit.amount - debtEdit.paid)}</td>
                        <td className="py-2">
                          <div className="flex space-x-1">
                            <button onClick={() => saveDebtEdit(d.id)} className="px-2 py-1 text-xs bg-green-600 text-white rounded">Save</button>
                            <button onClick={() => setEditingDebt(null)} className="px-2 py-1 text-xs bg-gray-400 text-white rounded">Cancel</button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="py-2 font-mono">Ksh {d.amount}</td>
                        <td className="py-2">
                          {d.service || '-'}
                          {d.notes ? <div className="text-xs text-gray-400">{d.notes}</div> : null}
                        </td>
                        <td className="py-2 text-sm">{format(new Date(d.date), 'EEE dd/MM/yy')}</td>
                        <td className="py-2 font-mono">Ksh {d.paid}</td>
                        <td className="py-2 font-bold text-red-600">Ksh {d.balance}</td>
                        <td className="py-2">
                          <div className="flex flex-wrap space-x-1">
                            <button onClick={() => { setEditingDebt(d.id); setDebtEdit({ amount: d.amount, paid: d.paid }); }}
                              className="px-2 py-1 text-xs bg-blue-600 text-white rounded">Edit</button>
                            {d.balance > 0 && (
                              <>
                                <button onClick={() => markDebtPaid(d.id, true, d.amount)}
                                  className="px-2 py-1 text-xs bg-green-600 text-white rounded">Paid</button>
                                <button onClick={() => markDebtPaid(d.id, false, d.balance)}
                                  className="px-2 py-1 text-xs bg-emerald-700 text-white rounded">Half</button>
                              </>
                            )}
                            <button onClick={() => deleteDebt(d.id)} className="px-2 py-1 text-xs bg-red-600 text-white rounded">Del</button>
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
      ) : activeTab === 'payday' ? (
      <div className="space-y-4">
        <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h2 className="text-xl font-bold text-emerald-600">Weekly Payday</h2>
              <p className="text-sm text-gray-500">Week {weekId} · {format(weekStart, 'EEE dd/MM/yyyy')} → {format(addDays(weekStart, 6), 'EEE dd/MM/yyyy')}</p>
            </div>
            <button onClick={handleSettleWeek} className="bg-emerald-600 text-white font-bold px-5 py-2.5 rounded hover:bg-emerald-700 whitespace-nowrap">
              Settle {weekId}
            </button>
          </div>
          <p className="text-sm text-gray-500">
            Sunday-evening payday: each employee's weekly wages (commission + wages-tips) are paid out after covering
            ALL open debts. Anything short carries forward; payable balance resets to zero so Monday starts fresh.
            A week can only be settled once.
          </p>
        </div>

        {settlementResult && (
          <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow space-y-3">
            <h3 className="text-lg font-semibold">Payday result — Week {settlementResult.week_id}</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-gray-50 dark:bg-slate-900 p-3 rounded text-center">
                <p className="text-xs text-gray-500">Cash Paid Out</p>
                <p className="text-xl font-bold font-mono text-green-600">Ksh {settlementResult.cash_paid_total}</p>
              </div>
              <div className="bg-gray-50 dark:bg-slate-900 p-3 rounded text-center">
                <p className="text-xs text-gray-500">Debt Carried Forward</p>
                <p className="text-xl font-bold font-mono text-amber-600">Ksh {settlementResult.debt_carried_total}</p>
              </div>
              <div className="bg-gray-50 dark:bg-slate-900 p-3 rounded text-center">
                <p className="text-xs text-gray-500">Week Profit</p>
                <p className="text-xl font-bold font-mono text-blue-600">Ksh {settlementResult.total_profit}</p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="py-2">Employee</th>
                    <th className="py-2 text-right">Wages (tx)</th>
                    <th className="py-2 text-right">Wages (tips)</th>
                    <th className="py-2 text-right">Debts Covered</th>
                    <th className="py-2 text-right">Cash Paid</th>
                    <th className="py-2 text-right">Carried Forward</th>
                  </tr>
                </thead>
                <tbody>
                  {settlementResult.employees.map((e: any) => (
                    <tr key={e.id} className="border-b">
                      <td className="py-2 font-medium">{e.full_name} <span className="text-gray-400 text-xs">({e.abbreviation})</span></td>
                      <td className="py-2 font-mono text-right">{e.wages}</td>
                      <td className="py-2 font-mono text-right">{e.tips_wages}</td>
                      <td className="py-2 font-mono text-right text-red-600">{e.debts_covered}</td>
                      <td className="py-2 font-mono text-right text-green-600">{e.cash_paid}</td>
                      <td className="py-2 font-mono text-right text-amber-600">{e.carried_forward}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">Settlement History</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b">
                  <th className="py-2">Week</th>
                  <th className="py-2">Range</th>
                  <th className="py-2 text-right">Revenue</th>
                  <th className="py-2 text-right">Expenses</th>
                  <th className="py-2 text-right">Labor</th>
                  <th className="py-2 text-right">Profit</th>
                  <th className="py-2 text-right">Cash Paid</th>
                  <th className="py-2 text-right">Debt Carried</th>
                </tr>
              </thead>
              <tbody>
                {settlementLogs.length === 0 && (
                  <tr><td colSpan={8} className="py-6 text-center text-gray-400">No weeks settled yet.</td></tr>
                )}
                {settlementLogs.map((log: any) => (
                  <tr key={log.id} className="border-b">
                    <td className="py-2 font-mono">{log.week_id}</td>
                    <td className="py-2 text-xs">{format(new Date(log.start_date), 'dd/MM/yy')} → {format(new Date(log.end_date), 'dd/MM/yy')}</td>
                    <td className="py-2 font-mono text-right">{log.total_revenue}</td>
                    <td className="py-2 font-mono text-right text-red-600">{log.total_expenses}</td>
                    <td className="py-2 font-mono text-right">{log.total_labor_expense}</td>
                    <td className="py-2 font-mono text-right text-blue-600">{log.total_profit}</td>
                    <td className="py-2 font-mono text-right text-green-600">{log.data?.cash_paid_total ?? '-'}</td>
                    <td className="py-2 font-mono text-right text-amber-600">{log.data?.debt_carried_total ?? '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      ) : activeTab === 'client-debts' ? (
      <div className="space-y-4">
        <form onSubmit={handleClientDebtSubmit} className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow space-y-4">
          <h2 className="text-xl font-bold text-indigo-600">Log Client Debt</h2>
          <p className="text-sm text-gray-500">Money a customer owes the business (e.g. unpaid carpet wash). Cleared any day — separate from employee debts.</p>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium">Client Name</label>
              <input className="w-full p-2 border rounded dark:bg-slate-700" value={clientDebtForm.client_name}
                onChange={e => setClientDebtForm({...clientDebtForm, client_name: e.target.value})} required /></div>
            <div><label className="block text-sm font-medium">Amount (Ksh)</label>
              <input type="number" min="0" className="w-full p-2 border rounded dark:bg-slate-700" value={clientDebtForm.amount}
                onChange={e => setClientDebtForm({...clientDebtForm, amount: toNum(e.target.value)})} required /></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium">Phone (optional)</label>
              <input className="w-full p-2 border rounded dark:bg-slate-700" placeholder="0712 345 678"
                value={clientDebtForm.customer_phone} onChange={e => setClientDebtForm({...clientDebtForm, customer_phone: e.target.value})} /></div>
            <div><label className="block text-sm font-medium">Date</label>
              <input type="date" className="w-full p-2 border rounded dark:bg-slate-700" value={clientDebtForm.date}
                onChange={e => setClientDebtForm({...clientDebtForm, date: e.target.value})} /></div>
          </div>
          <div><label className="block text-sm font-medium">Description (optional)</label>
            <input className="w-full p-2 border rounded dark:bg-slate-700" placeholder="e.g. Carpet wash, missed payment"
              value={clientDebtForm.description} onChange={e => setClientDebtForm({...clientDebtForm, description: e.target.value})} /></div>
          <button type="submit" className="w-full bg-indigo-600 text-white font-bold py-3 rounded hover:bg-indigo-700">Log Client Debt</button>
        </form>

        <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">Client Debt Records</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b">
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
                  <tr><td colSpan={7} className="py-6 text-center text-gray-400">No client debts logged.</td></tr>
                )}
                {clientDebts.map(cd => (
                  <tr key={cd.id} className="border-b">
                    <td className="py-2 text-xs">{format(new Date(cd.date), 'EEE dd/MM/yy')}</td>
                    <td className="py-2 font-medium">{cd.client_name}</td>
                    <td className="py-2">{cd.description || '-'}</td>
                    <td className="py-2 font-mono text-right">Ksh {cd.amount}</td>
                    <td className="py-2 font-mono text-right text-green-600">Ksh {cd.paid}</td>
                    <td className="py-2 font-mono text-right font-bold text-red-600">Ksh {cd.balance}</td>
                    <td className="py-2">
                      <div className="flex space-x-1">
                        <button onClick={() => handleClientDebtPaid(cd)}
                          className="px-2 py-1 text-xs bg-green-600 text-white rounded">Pay</button>
                        <button onClick={() => handleClientDebtDelete(cd)}
                          className="px-2 py-1 text-xs bg-red-600 text-white rounded">Del</button>
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
      <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow">
        <h2 className="text-xl font-bold text-sky-600 mb-1">Vehicles Waiting for Payment</h2>
        <p className="text-sm text-gray-500 mb-4">
          Every employee sees their own arrivals; this is the full list. Red rows passed 24 hours and have
          already been charged to that employee as a shortfall.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b">
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
                <tr><td colSpan={8} className="py-6 text-center text-gray-400">No arrivals logged.</td></tr>
              )}
              {arrivals.map(a => (
                <tr key={a.id} className={`border-b ${a.status === 'settled' ? '' : a.overdue ? 'bg-red-100 dark:bg-red-900/40' : ''}`}>
                  <td className="py-2 text-xs">{format(new Date(a.created_at), 'EEE dd/MM HH:mm')}</td>
                  <td className="py-2 font-mono">{a.plate_number}</td>
                  <td className="py-2 capitalize">{a.category}</td>
                  <td className="py-2">{abbrMap[a.submitter_id] || empMap[a.submitter_id] || a.submitter_id}</td>
                  <td className="py-2 font-mono text-right">Ksh {a.expected_price}</td>
                  <td className="py-2 font-mono text-right">Ksh {(a.cash_paid || 0) + (a.mpesa_paid || 0)}</td>
                  <td className="py-2 text-xs">
                    {a.status === 'settled' ? <span className="text-green-600">Paid</span>
                      : a.status === 'expired' ? <span className="text-red-600 font-semibold">Overdue (charged)</span>
                      : a.overdue ? <span className="text-red-600 font-semibold">Overdue</span>
                      : <span className="text-amber-600">Waiting</span>}
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
                      }} className="px-2 py-1 text-xs bg-emerald-600 text-white rounded">Take payment</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      ) : null}

      {activeTab === 'carpets' && (
        <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Carpets Log</h2>
            <span className="text-xs text-gray-400">Released carpets auto-delete after 1 day</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b">
                  <th className="py-2">Received</th>
                  <th className="py-2">Carpet</th>
                  <th className="py-2">Client</th>
                  <th className="py-2">Photo</th>
                  <th className="py-2">Receiver</th>
                  <th className="py-2 text-right">Expected</th>
                  <th className="py-2 text-right">Paid</th>
                  <th className="py-2">Washed</th>
                  <th className="py-2">Status</th>
                  <th className="py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {carpets.length === 0 && (
                  <tr><td colSpan={10} className="py-6 text-center text-gray-400">No carpets logged.</td></tr>
                )}
                {carpets.map(c => (
                  <tr key={c.id} className="border-b">
                    <td className="py-2 text-sm">{format(new Date(c.created_at), 'EEE dd/MM HH:mm')}</td>
                    <td className="py-2">{c.characteristics || '-'}</td>
                    <td className="py-2">
                      {c.client_name ? <div className="font-medium">{c.client_name}</div> : <div className="text-gray-400">—</div>}
                      {c.customer_phone ? <div className="text-xs text-gray-500">{c.customer_phone}</div> : null}
                    </td>
                    <td className="py-2">
                      {c.image_data ? (
                        <img src={c.image_data} alt="carpet" onClick={() => setPhotoPreview(c.image_data)}
                          className="h-12 w-12 object-cover rounded border cursor-pointer" />
                      ) : <span className="text-gray-400">—</span>}
                    </td>
                    <td className="py-2">
                      {c.status === 'received' ? (
                        <select value={c.receiver_id ?? ''} onChange={e => handleCarpetAssign(c.id, e.target.value)}
                          className="text-xs p-1 border rounded dark:bg-slate-700">
                          <option value="">Pick receiver…</option>
                          {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                        </select>
                      ) : (
                        <span className="font-medium">{empMap[c.receiver_id] || '—'}</span>
                      )}
                      {c.submitter_id && <div className="text-xs text-gray-400">logged by {abbrMap[c.submitter_id] || empMap[c.submitter_id]}</div>}
                    </td>
                    <td className="py-2 font-mono text-right">Ksh {c.expected_price}</td>
                    <td className="py-2 font-mono text-right">Ksh {c.cash_paid + c.mpesa_paid}</td>
                    <td className="py-2">
                      <button onClick={() => handleCarpetWash(c.id)}
                        className={`px-2 py-1 text-xs rounded ${c.is_washed ? 'bg-green-600 text-white' : 'bg-gray-300 dark:bg-slate-700 text-gray-700 dark:text-gray-200'}`}>
                        {c.is_washed ? 'Washed' : 'Mark Washed'}
                      </button>
                    </td>
                    <td className="py-2">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${c.status === 'received' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900' : 'bg-gray-200 text-gray-600 dark:bg-slate-700'}`}>
                        {c.status}
                      </span>
                    </td>
                    <td className="py-2">
                      <div className="flex space-x-1">
                        {c.status === 'received' && (
                          <button onClick={() => handleCarpetRelease(c.id, c.expected_price, c.receiver_id)}
                            className="px-2 py-1 text-xs bg-green-600 text-white rounded">Release</button>
                        )}
                        <button onClick={() => handleCarpetDelete(c.id)} className="px-2 py-1 text-xs bg-red-600 text-white rounded">Del</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'sheet' && (
        <div className="space-y-4">
          {/* Excel-like day sheet */}
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow overflow-hidden">
            <div className="px-6 pt-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold">Day Sheet {viewMode === 'day' ? `- ${format(selectedDay, 'PPPP')}` : `- Week ${format(weekStart, 'w yyyy')}`}</h2>
              <span className="text-xs text-gray-400">e.g. car KCA182M-L 200ksh → Car | KCA182M | L | Ksh 200</span>
            </div>
            {duplicateTxIds.size > 0 && (
              <div className="px-6 pt-2 text-xs text-amber-700 dark:text-amber-400">
                {duplicateTxIds.size} highlighted row(s) look like duplicates (same plate, employee, expected and paid).
                Edit or remove the extra one — or leave them if they are genuinely separate jobs.
              </div>
            )}
            <div className="overflow-x-auto mt-3">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-gray-100 dark:bg-slate-700 text-left">
                    <th className="border border-gray-300 dark:border-slate-600 px-2 py-1.5 w-10 text-center text-gray-500">#</th>
                    <th className="border border-gray-300 dark:border-slate-600 px-3 py-1.5">Time</th>
                    <th className="border border-gray-300 dark:border-slate-600 px-3 py-1.5">Category</th>
                    <th className="border border-gray-300 dark:border-slate-600 px-3 py-1.5">Item / Plate</th>
                    <th className="border border-gray-300 dark:border-slate-600 px-3 py-1.5">Emp</th>
                    <th className="border border-gray-300 dark:border-slate-600 px-3 py-1.5 text-right">Paid (Ksh)</th>
                    <th className="border border-gray-300 dark:border-slate-600 px-3 py-1.5 text-right">Shortfall (Ksh)</th>
                    <th className="border border-gray-300 dark:border-slate-600 px-3 py-1.5">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.length === 0 && (
                    <tr><td colSpan={8} className="border border-gray-300 dark:border-slate-600 text-center py-6 text-gray-400">No activities recorded.</td></tr>
                  )}
                  {transactions.map((tx, i) => editingTx === tx.id ? (
                    <tr key={tx.id} className="bg-yellow-100 dark:bg-yellow-900/30">
                      <td className="border border-gray-300 dark:border-slate-600 px-2 py-1 text-center text-gray-400" colSpan={2}>Fixing</td>
                      <td className="border border-gray-300 dark:border-slate-600 px-2 py-1" colSpan={2}>
                        <select className="w-full p-1 text-xs border rounded dark:bg-slate-700" value={editForm.washer_id}
                          onChange={e => setEditForm({ ...editForm, washer_id: e.target.value })}>
                          {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                        </select>
                      </td>
                      <td className="border border-gray-300 dark:border-slate-600 px-2 py-1 font-mono text-xs" colSpan={2}>
                        {tx.plate_number || tx.custom_category || tx.carpet_characteristics || '-'}
                      </td>
                      <td className="border border-gray-300 dark:border-slate-600 px-2 py-1" colSpan={3}>
                        <div className="flex flex-wrap items-center gap-1">
                          <input type="number" min="0" title="Expected" className="w-20 p-1 text-xs border rounded dark:bg-slate-700"
                            value={editForm.expected_price} onChange={e => setEditForm({ ...editForm, expected_price: e.target.value })} />
                          <input type="number" min="0" title="Cash" className="w-20 p-1 text-xs border rounded dark:bg-slate-700"
                            value={editForm.cash_paid} onChange={e => setEditForm({ ...editForm, cash_paid: e.target.value })} />
                          <input type="number" min="0" title="M-Pesa" className="w-20 p-1 text-xs border rounded dark:bg-slate-700"
                            value={editForm.mpesa_paid} onChange={e => setEditForm({ ...editForm, mpesa_paid: e.target.value })} />
                          <button onClick={() => saveSheetEdit(tx.id)} className="px-2 py-0.5 text-xs bg-green-600 text-white rounded">Save</button>
                          <button onClick={() => setEditingTx(null)} className="px-2 py-0.5 text-xs bg-gray-400 text-white rounded">Cancel</button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    <tr key={tx.id} className={duplicateTxIds.has(tx.id) ? 'bg-yellow-200 dark:bg-yellow-900/50' : ''}>
                      <td className="border border-gray-300 dark:border-slate-600 px-2 py-1 text-center text-gray-400">
                        {i + 1}{duplicateTxIds.has(tx.id) ? ' ⚠' : ''}
                      </td>
                      <td className="border border-gray-300 dark:border-slate-600 px-3 py-1 font-mono text-xs">{format(new Date(tx.timestamp), 'EEE HH:mm')}</td>
                      <td className="border border-gray-300 dark:border-slate-600 px-3 py-1 capitalize">{tx.custom_category || tx.category}</td>
                      <td className="border border-gray-300 dark:border-slate-600 px-3 py-1 font-mono text-xs">
                        {tx.category === 'carpet' ? (tx.carpet_characteristics || 'Carpet') + (tx.customer_phone ? ` (${tx.customer_phone})` : '')
                          : tx.category === 'other' ? (tx.custom_category || 'Other')
                          : tx.plate_number || '-'}
                      </td>
                      <td className="border border-gray-300 dark:border-slate-600 px-3 py-1 font-bold">{abbrMap[tx.washer_id] || empMap[tx.washer_id] || tx.washer_id}</td>
                      <td className="border border-gray-300 dark:border-slate-600 px-3 py-1 font-mono text-right">{tx.total_paid}</td>
                      <td className="border border-gray-300 dark:border-slate-600 px-3 py-1 font-mono text-right text-red-600">{tx.shortfall > 0 ? tx.shortfall : ''}</td>
                      <td className="border border-gray-300 dark:border-slate-600 px-3 py-1">
                        <div className="flex space-x-1">
                          <button onClick={() => handleEdit(tx)} className="px-2 py-0.5 text-xs bg-blue-600 text-white rounded">Edit</button>
                          <button onClick={() => handleDelete(tx.id)} className="px-2 py-0.5 text-xs bg-red-600 text-white rounded">Remove</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {transactions.length > 0 && (
                    <tr className="bg-gray-100 dark:bg-slate-700 font-bold">
                      <td className="border border-gray-300 dark:border-slate-600 px-2 py-1.5 text-center text-gray-500" colSpan={5}>Total</td>
                      <td className="border border-gray-300 dark:border-slate-600 px-3 py-1.5 font-mono text-right">{transactions.reduce((s, t) => s + (t.total_paid || 0), 0)}</td>
                      <td className="border border-gray-300 dark:border-slate-600 px-3 py-1.5 font-mono text-right text-red-600">{transactions.reduce((s, t) => s + (t.shortfall > 0 ? t.shortfall : 0), 0) || ''}</td>
                      <td className="border border-gray-300 dark:border-slate-600" />
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Per-employee stats */}
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow overflow-hidden">
            <h3 className="text-lg font-semibold px-6 pt-4">Employee Earnings</h3>
            <div className="overflow-x-auto mt-2">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-gray-100 dark:bg-slate-700 text-left">
                    <th className="border border-gray-300 dark:border-slate-600 px-3 py-1.5">Emp</th>
                    <th className="border border-gray-300 dark:border-slate-600 px-3 py-1.5">Employee</th>
                    <th className="border border-gray-300 dark:border-slate-600 px-3 py-1.5 text-right">Revenue (Ksh)</th>
                    <th className="border border-gray-300 dark:border-slate-600 px-3 py-1.5 text-right">Earnings (Ksh)</th>
                    <th className="border border-gray-300 dark:border-slate-600 px-3 py-1.5 text-right">Payable (Ksh)</th>
                    <th className="border border-gray-300 dark:border-slate-600 px-3 py-1.5">Jobs</th>
                  </tr>
                </thead>
                <tbody>
                  {sheet.employees.length === 0 && (
                    <tr><td colSpan={6} className="border border-gray-300 dark:border-slate-600 text-center py-4 text-gray-400">No employees.</td></tr>
                  )}
                  {sheet.employees.map((e: any) => (
                    <tr key={e.id}>
                      <td className="border border-gray-300 dark:border-slate-600 px-3 py-1.5 font-bold">{e.abbreviation}</td>
                      <td className="border border-gray-300 dark:border-slate-600 px-3 py-1.5">{e.name}</td>
                      <td className="border border-gray-300 dark:border-slate-600 px-3 py-1.5 font-mono text-right">{e.revenue_generated}</td>
                      <td className="border border-gray-300 dark:border-slate-600 px-3 py-1.5 font-mono text-right">{e.wages_earned}</td>
                      <td className="border border-gray-300 dark:border-slate-600 px-3 py-1.5 font-mono text-right text-red-600">{e.payable_balance > 0 ? e.payable_balance : '-'}</td>
                      <td className="border border-gray-300 dark:border-slate-600 px-3 py-1.5 text-right">{[...new Set(transactions.filter(t => t.washer_id === e.id).map(t => t.custom_category || t.category))].join(', ')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Money summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow p-4">
              <p className="text-sm text-gray-500">Total Cash</p>
              <p className="text-xl font-bold font-mono text-green-600">Ksh {sheet.summary?.total_cash_received ?? 0}</p>
              <p className="text-xs text-gray-400 mt-1">{Object.entries(sheet.summary?.category_counts || {}).map(([k, v]) => `${k === 'other' ? 'Others' : k}: ${v}`).join(' | ')}</p>
            </div>
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow p-4">
              <p className="text-sm text-gray-500">Expenses</p>
              <p className="text-xl font-bold font-mono text-red-600">Ksh {sheet.summary?.total_expenses ?? 0}</p>
              <div className="mt-1 text-xs text-gray-500 max-h-16 overflow-y-auto">
                {sheet.expenses.map((x: any) => <div key={x.id}>{x.description}: Ksh {x.amount}</div>)}
              </div>
            </div>
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow p-4">
              <p className="text-sm text-gray-500">Balance</p>
              <p className={`text-xl font-bold font-mono ${(sheet.summary?.balance ?? 0) >= 0 ? 'text-blue-600' : 'text-red-600'}`}>Ksh {sheet.summary?.balance ?? 0}</p>
              <p className="text-xs text-gray-400 mt-1">Labor: Ksh {sheet.summary?.total_labor_expense ?? 0}</p>
            </div>
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow p-4">
              <p className="text-sm text-gray-500">Revenue</p>
              <p className="text-xl font-bold font-mono">Ksh {sheet.summary?.total_revenue ?? 0}</p>
              <p className="text-xs text-gray-400 mt-1">Outstanding Debts: Ksh {sheet.summary?.total_debts ?? 0}</p>
            </div>
          </div>
        </div>
      )}

      {activeTab !== 'sheet' && (
      <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow">
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
                     <td className="py-2 text-xs">{format(new Date(tx.timestamp), 'EEE HH:mm')}</td>
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
                          <option value="other">Other</option>
                        </select>
                     </td>
                     <td className="py-2">
                        {editForm.category !== 'motorcycle' && editForm.category !== 'carpet' && editForm.category !== 'other' && editForm.category !== 'bicycle' ? (
                          <input type="text" className="w-full p-1 text-xs border rounded dark:bg-slate-700 font-mono uppercase"
                            value={editForm.plate_number} onChange={e => setEditForm({...editForm, plate_number: e.target.value.toUpperCase()})} />
                        ) : editForm.category === 'other' ? (
                          <input type="text" className="w-full p-1 text-xs border rounded dark:bg-slate-700"
                            placeholder="Custom name" value={editForm.custom_category}
                            onChange={e => setEditForm({...editForm, custom_category: e.target.value})} />
                        ) : <span className="text-xs">-</span>}
                     </td>
<td className="py-2">
                        <div className="flex space-x-1">
                          <input type="number" className="w-16 p-1 text-xs border rounded dark:bg-slate-700"
                            value={editForm.cash_paid} onChange={e => setEditForm({...editForm, cash_paid: parseInt(e.target.value)})} />
                          <input type="number" className="w-16 p-1 text-xs border rounded dark:bg-slate-700"
                            value={editForm.mpesa_paid} onChange={e => setEditForm({...editForm, mpesa_paid: parseInt(e.target.value)})} />
                        </div>
                        {editForm.category !== 'carpet' && (
                          <div className="flex items-center gap-1 mt-1">
                            <input type="number" min="0" className="w-16 p-1 text-xs border rounded dark:bg-slate-700"
                              title="Miscellaneous amount" placeholder="Misc"
                              value={editForm.misc_amount} onChange={e => setEditForm({...editForm, misc_amount: e.target.value})} />
                            <input type="text" className="flex-1 p-1 text-xs border rounded dark:bg-slate-700"
                              title="Miscellaneous description" placeholder="misc description"
                              value={editForm.misc_description} onChange={e => setEditForm({...editForm, misc_description: e.target.value})} />
                          </div>
                        )}
                        {editForm.category !== 'carpet' && (
                          <div className="flex items-center gap-1 mt-1">
                            <input type="number" min="0" className="w-16 p-1 text-xs border rounded dark:bg-slate-700"
                              title="Manual tip amount" placeholder="Tip"
                              value={editForm.manual_tip} onChange={e => setEditForm({...editForm, manual_tip: e.target.value})} />
                            <select className="p-1 text-xs border rounded dark:bg-slate-700" title="Tip handling"
                              value={editForm.tip_method} onChange={e => setEditForm({...editForm, tip_method: e.target.value})}>
                              <option value="cash">Cash (expense)</option>
                              <option value="wages">Wages</option>
                            </select>
                          </div>
                        )}
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
                     <td className="py-2">{format(new Date(tx.timestamp), 'EEE HH:mm')}</td>
                     <td className="py-2 font-medium">{empMap[tx.washer_id] || tx.washer_id}</td>
                     <td className="py-2 capitalize">{tx.custom_category || tx.category}</td>
                     <td className="py-2 font-mono text-xs">{tx.category === 'carpet' || tx.category === 'other' ? '-' : (tx.plate_number || '-')}</td>
<td className="py-2 font-mono">Ksh {tx.total_paid}
                      {tx.isolated_tip > 0 && (
                        <span className={`ml-1 text-[10px] rounded px-1 py-0.5 font-medium ${tx.tip_method === 'wages' ? 'bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-900 dark:text-fuchsia-300' : 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300'}`}
                          title={tx.tip_method === 'wages' ? 'Tip added to wages (payday)' : 'Tip given as cash (logged as expense)'}>
                          ❤ Tip {tx.isolated_tip} · {tx.tip_method === 'wages' ? 'Wages' : 'Cash'}
                        </span>
                      )}
                      {tx.misc_amount > 0 && (
                        <span className="ml-1 text-[10px] bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300 rounded px-1 py-0.5 font-medium" title={tx.misc_description || 'Misc'}>
                          Misc {tx.misc_amount}{tx.misc_description ? ` · ${tx.misc_description}` : ''}
                        </span>
                      )}
                    </td>
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
       )}

      {photoPreview && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={() => setPhotoPreview(null)}>
          <div className="relative max-w-3xl w-full" onClick={e => e.stopPropagation()}>
            <button onClick={() => setPhotoPreview(null)}
              className="absolute -top-3 -right-3 bg-red-600 text-white w-8 h-8 rounded-full font-bold">×</button>
            <img src={photoPreview} alt="carpet preview" className="w-full rounded-lg shadow-2xl" />
          </div>
        </div>
      )}
    </div>
  );
}
