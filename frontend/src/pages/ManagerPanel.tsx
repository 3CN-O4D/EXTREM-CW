import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { format, startOfWeek, addDays, isSameDay } from 'date-fns';

export default function ManagerPanel() {
  const [employees, setEmployees] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [selectedDay, setSelectedDay] = useState<Date>(new Date());
  const standardPrices: any = {
    bicycle: 50,
    motorcycle: 70,
    taxi: 150,
    car: 200,
    midrange: 300,
    lorry: 500,
    carpet: 300
  };

  const [form, setForm] = useState({
    washer_id: '',
    category: 'car',
    expected_price: 200,
    cash_paid: 0,
    mpesa_paid: 0,
    tip_method: 'cash',
    has_car_wash: true,
    has_vacuum: false,
    has_engine_wash: false,
    manual_tip: 0,
    carpet_characteristics: '',
    receiver_id: ''
  });

  useEffect(() => {
    api.get('/stats/employees').then(res => setEmployees(res.data));
    fetchTransactions();
  }, [selectedDay]);

  const fetchTransactions = async () => {
    const res = await api.get('/transactions/', {
      params: { day: format(selectedDay, 'yyyy-MM-dd') }
    });
    setTransactions(res.data);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        ...form,
        washer_id: parseInt(form.washer_id),
        expected_price: parseFloat(form.expected_price.toString()),
        cash_paid: parseFloat(form.cash_paid.toString()),
        mpesa_paid: parseFloat(form.mpesa_paid.toString()),
        manual_tip: parseFloat(form.manual_tip.toString()),
        carpet_metadata: form.category === 'carpet' ? {
          characteristics: form.carpet_characteristics,
          receiver_id: parseInt(form.receiver_id)
        } : null
      };
      await api.post('/transactions/', payload);
      alert('Transaction logged successfully!');
      // Reset form
    } catch (err) {
      alert('Error logging transaction');
    }
  };

  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const weekDays = [...Array(7)].map((_, i) => addDays(weekStart, i));

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8">
      <h1 className="text-2xl font-bold mb-6">Manager Workspace</h1>

      <div className="flex space-x-2 overflow-x-auto pb-2">
        {weekDays.map(day => (
          <button
            key={day.toISOString()}
            onClick={() => setSelectedDay(day)}
            className={`px-4 py-2 rounded whitespace-nowrap transition ${isSameDay(selectedDay, day) ? 'bg-primary-600 text-white' : 'bg-gray-200 dark:bg-slate-700'}`}
          >
            {format(day, 'EEE (dd/MM)')}
          </button>
        ))}
      </div>
      <form onSubmit={handleSubmit} className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium">Washer</label>
            <select
              className="w-full p-2 border rounded dark:bg-slate-700"
              value={form.washer_id}
              onChange={e => setForm({...form, washer_id: e.target.value})}
              required
            >
              <option value="">Select Employee</option>
              {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium">Category</label>
            <select
              className="w-full p-2 border rounded dark:bg-slate-700"
              value={form.category}
              onChange={e => {
                const cat = e.target.value;
                setForm({...form, category: cat, expected_price: standardPrices[cat] || 0});
              }}
            >
              <option value="bicycle">Bicycle</option>
              <option value="motorcycle">Motorcycle</option>
              <option value="taxi">Taxi</option>
              <option value="car">Normal Car</option>
              <option value="midrange">Midrange</option>
              <option value="lorry">Lorry</option>
              <option value="carpet">Carpet</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium">Expected Price</label>
            <input
              type="number"
              className="w-full p-2 border rounded dark:bg-slate-700"
              value={form.expected_price}
              onChange={e => setForm({...form, expected_price: parseInt(e.target.value)})}
            />
          </div>
          <div>
            <label className="block text-sm font-medium">Cash Paid</label>
            <input
              type="number"
              className="w-full p-2 border rounded dark:bg-slate-700"
              value={form.cash_paid}
              onChange={e => setForm({...form, cash_paid: parseInt(e.target.value)})}
            />
          </div>
          <div>
            <label className="block text-sm font-medium">M-Pesa Paid</label>
            <input
              type="number"
              className="w-full p-2 border rounded dark:bg-slate-700"
              value={form.mpesa_paid}
              onChange={e => setForm({...form, mpesa_paid: parseInt(e.target.value)})}
            />
          </div>
        </div>

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

        {form.category === 'carpet' && (
           <div className="space-y-4 p-4 border rounded bg-blue-50 dark:bg-slate-900">
             <h3 className="font-bold">Carpet Metadata</h3>
             <textarea
                placeholder="Characteristics (Mandatory)"
                className="w-full p-2 border rounded dark:bg-slate-700"
                value={form.carpet_characteristics}
                onChange={e => setForm({...form, carpet_characteristics: e.target.value})}
                required
             />
             <select
              className="w-full p-2 border rounded dark:bg-slate-700"
              value={form.receiver_id}
              onChange={e => setForm({...form, receiver_id: e.target.value})}
              required
            >
              <option value="">Receiver ID (Employee)</option>
              {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
           </div>
        )}

        <button type="submit" className="w-full bg-primary-600 text-white font-bold py-3 rounded hover:bg-primary-700">
          Submit Transaction
        </button>
      </form>

      <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow">
         <h2 className="text-xl font-semibold mb-4">Transactions for {format(selectedDay, 'PPPP')}</h2>
         <div className="overflow-x-auto">
           <table className="w-full text-left">
             <thead>
               <tr className="border-b">
                 <th className="py-2">Time</th>
                 <th className="py-2">Washer</th>
                 <th className="py-2">Category</th>
                 <th className="py-2">Paid</th>
                 <th className="py-2">Shortfall</th>
               </tr>
             </thead>
             <tbody>
               {transactions.map(tx => (
                 <tr key={tx.id} className="border-b">
                   <td className="py-2">{format(new Date(tx.timestamp), 'HH:mm')}</td>
                   <td className="py-2 font-medium">{tx.washer_id}</td>
                   <td className="py-2 capitalize">{tx.category}</td>
                   <td className="py-2 font-mono">Ksh {tx.total_paid}</td>
                   <td className="py-2 text-red-500 font-mono">{tx.shortfall > 0 ? `Ksh ${tx.shortfall}` : '-'}</td>
                 </tr>
               ))}
             </tbody>
           </table>
         </div>
      </div>
    </div>
  );
}
