import React, { useState, useEffect } from 'react';
import api from '../services/api';

export default function EmployeeManagement() {
  const [users, setUsers] = useState<any[]>([]);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [form, setForm] = useState({
    full_name: '',
    abbreviation: '',
    role: 'employee',
    password: ''
  });

  const fetchUsers = () => api.get('/auth/users').then(res => setUsers(res.data));

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingUser) {
      await api.put(`/auth/users/${editingUser.id}`, form);
    } else {
      await api.post('/auth/users', form);
    }
    setEditingUser(null);
    setForm({ full_name: '', abbreviation: '', role: 'employee', password: '' });
    fetchUsers();
  };

  const handleEdit = (user: any) => {
    setEditingUser(user);
    setForm({
      full_name: user.full_name,
      abbreviation: user.abbreviation,
      role: user.role,
      password: ''
    });
  };

  const handleDelete = async (id: number) => {
    if (window.confirm('Delete this user?')) {
      await api.delete(`/auth/users/${id}`);
      fetchUsers();
    }
  };

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Employee Management</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Form */}
        <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">{editingUser ? 'Edit User' : 'Add New User'}</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              placeholder="Full Name"
              className="w-full p-2 border rounded dark:bg-slate-700"
              value={form.full_name}
              onChange={e => setForm({...form, full_name: e.target.value})}
              required
            />
            <input
              placeholder="Abbreviation (Login)"
              className="w-full p-2 border rounded dark:bg-slate-700"
              value={form.abbreviation}
              onChange={e => setForm({...form, abbreviation: e.target.value})}
              required
            />
            <select
              className="w-full p-2 border rounded dark:bg-slate-700"
              value={form.role}
              onChange={e => setForm({...form, role: e.target.value})}
            >
              <option value="employee">Employee</option>
              <option value="manager">Manager</option>
              <option value="admin">Admin</option>
            </select>
            <input
              type="password"
              placeholder={editingUser ? "Leave blank to keep same" : "Password"}
              className="w-full p-2 border rounded dark:bg-slate-700"
              value={form.password}
              onChange={e => setForm({...form, password: e.target.value})}
              required={!editingUser}
            />
            <div className="flex space-x-2">
              <button type="submit" className="flex-1 bg-primary-600 text-white p-2 rounded hover:bg-primary-700">
                {editingUser ? 'Update' : 'Create'}
              </button>
              {editingUser && (
                <button type="button" onClick={() => setEditingUser(null)} className="bg-gray-500 text-white p-2 rounded">
                  Cancel
                </button>
              )}
            </div>
          </form>
        </div>

        {/* List */}
        <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">Current Staff</h2>
          <div className="space-y-4">
            {users.map(u => (
              <div key={u.id} className="flex justify-between items-center p-3 border-b dark:border-slate-700">
                <div>
                  <div className="font-bold">{u.full_name} ({u.abbreviation})</div>
                  <div className="text-sm text-gray-500 capitalize">{u.role}</div>
                </div>
                <div className="flex space-x-2">
                  <button onClick={() => handleEdit(u)} className="text-blue-500 hover:underline">Edit</button>
                  <button onClick={() => handleDelete(u.id)} className="text-red-500 hover:underline">Delete</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
