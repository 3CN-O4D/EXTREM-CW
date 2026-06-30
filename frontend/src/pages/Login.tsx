import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { useNavigate } from 'react-router-dom';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const formData = new FormData();
      formData.append('username', username);
      formData.append('password', password);

      const response = await api.post('/auth/token', formData);
      const { access_token } = response.data;

      // Basic decode of JWT to get role and sub (abbreviation)
      const payload = JSON.parse(atob(access_token.split('.')[1]));
      const user = {
        abbreviation: payload.sub,
        role: payload.role,
        full_name: payload.sub
      };

      login(access_token, user);
      navigate('/');
    } catch (err: any) {
      setError('Invalid credentials');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-slate-900">
      <div className="max-w-md w-full p-8 bg-white dark:bg-slate-800 rounded-lg shadow-lg">
        <h2 className="text-3xl font-bold text-center mb-8 text-primary-600">Carwash POS</h2>
        {error && <div className="bg-red-100 text-red-700 p-3 rounded mb-4">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium mb-1">Abbreviation (Username)</label>
            <input
              type="text"
              className="w-full p-2 border rounded dark:bg-slate-700"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Password</label>
            <input
              type="password"
              className="w-full p-2 border rounded dark:bg-slate-700"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <button
            type="submit"
            className="w-full bg-primary-600 hover:bg-primary-700 text-white font-bold py-2 px-4 rounded transition"
          >
            Sign In
          </button>
        </form>
      </div>
    </div>
  );
}
