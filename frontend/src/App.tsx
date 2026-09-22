import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Link, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import api from './services/api';
import Login from './pages/Login';
import LandingPage from './pages/LandingPage';
import AdminDashboard from './pages/AdminDashboard';
import ManagerPanel from './pages/ManagerPanel';
import EmployeeManagement from './pages/EmployeeManagement';
import EmployeeDashboard from './pages/EmployeeDashboard';
import { Sun, Moon, LogOut, LayoutDashboard, Calculator, Users, KeyRound, X } from 'lucide-react';

function AppContent() {
  const { user, logout } = useAuth();
  const [darkMode, setDarkMode] = useState(false);
  const [showPwModal, setShowPwModal] = useState(false);
  const [pw, setPw] = useState({ current: '', next: '', confirm: '' });

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
    document.documentElement.classList.toggle('dark');
  };

  const submitPassword = async () => {
    if (pw.next !== pw.confirm) { alert('New passwords do not match'); return; }
    if (pw.next.length < 4) { alert('New password must be at least 4 characters'); return; }
    try {
      await api.post('/auth/change-password', {
        current_password: pw.current,
        new_password: pw.next
      });
      alert('Password changed successfully');
      setPw({ current: '', next: '', confirm: '' });
      setShowPwModal(false);
    } catch (e: any) {
      alert(e?.response?.data?.detail || 'Could not change password');
    }
  };

  return (
    <div className={`min-h-screen flex bg-gray-50 dark:bg-slate-900 transition-colors duration-200`}>
      {/* Sidebar - only show when logged in */}
      {user && (
      <aside className="w-64 bg-white dark:bg-slate-800 border-r border-gray-200 dark:border-slate-700 hidden md:flex flex-col">
        <div className="p-6 border-b border-gray-200 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <img src="/src/images/logo.jpeg" alt="EXTREME" className="h-10 w-10 rounded-full object-cover" />
            <div>
              <h1 className="text-lg font-bold text-primary-600 leading-tight">EXTREME<br/>AUTO CARWASH</h1>
              <p className="text-xs text-gray-500 mt-1">v1.0.0 Pro Edition</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          {user.role === 'admin' && (
            <SidebarLink to="/" icon={<LayoutDashboard size={20} />} label="Admin Dashboard" />
          )}
          {(user.role === 'admin' || user.role === 'manager') && (
            <SidebarLink to="/manage" icon={<Calculator size={20} />} label="Manager Panel" />
          )}
          {user.role === 'admin' && (
            <SidebarLink to="/employees" icon={<Users size={20} />} label="Employee Management" />
          )}
        </nav>

        <div className="p-4 border-t border-gray-200 dark:border-slate-700 space-y-4">
          <div className="flex items-center space-x-3 px-3 py-2">
            <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-bold">
              {user.abbreviation.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="text-sm font-medium truncate">{user.full_name}</p>
              <p className="text-xs text-gray-500 capitalize">{user.role}</p>
            </div>
          </div>

          <div className="flex justify-between items-center px-3">
             <button onClick={toggleDarkMode} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700">
               {darkMode ? <Sun size={20} /> : <Moon size={20} />}
             </button>
             <button onClick={() => setShowPwModal(true)} title="Change Password"
               className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-500 dark:text-gray-400">
               <KeyRound size={20} />
             </button>
             <button onClick={logout} className="p-2 rounded-lg hover:bg-red-50 text-red-600">
               <LogOut size={20} />
             </button>
          </div>
        </div>
      </aside>
      )}

      {showPwModal && user && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 print:hidden">
          <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-xl w-96 max-w-full">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">Change Password</h3>
              <button onClick={() => setShowPwModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            <div className="space-y-3">
              <input type="password" placeholder="Old password" value={pw.current}
                className="w-full p-2 border rounded dark:bg-slate-700"
                onChange={e => setPw({...pw, current: e.target.value})} />
              <input type="password" placeholder="New password" value={pw.next}
                className="w-full p-2 border rounded dark:bg-slate-700"
                onChange={e => setPw({...pw, next: e.target.value})} />
              <input type="password" placeholder="Confirm new password" value={pw.confirm}
                className="w-full p-2 border rounded dark:bg-slate-700"
                onChange={e => setPw({...pw, confirm: e.target.value})} />
              <button onClick={submitPassword}
                className="w-full bg-primary-600 text-white p-2 rounded hover:bg-primary-700">
                Save New Password
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <Routes>
          <Route path="/" element={
            !user ? <LandingPage /> :
            user.role === 'admin' ? <AdminDashboard /> :
            user.role === 'manager' ? <ManagerPanel /> :
            <EmployeeDashboard />
          } />
          <Route path="/login" element={!user ? <Login /> : <Navigate to="/" />} />
          <Route path="/manage" element={user?.role === 'admin' || user?.role === 'manager' ? <ManagerPanel /> : <Navigate to="/" />} />
          <Route path="/employees" element={user?.role === 'admin' ? <EmployeeManagement /> : <Navigate to="/" />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </main>
    </div>
  );
}

function SidebarLink({ to, icon, label }: any) {
  return (
    <Link to={to} className="flex items-center space-x-3 px-3 py-2 rounded-lg transition hover:bg-primary-50 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-300 hover:text-primary-600">
      {icon}
      <span className="font-medium text-sm">{label}</span>
    </Link>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppContent />
      </BrowserRouter>
    </AuthProvider>
  );
}
