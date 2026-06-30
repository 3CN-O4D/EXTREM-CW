import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Link, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import LandingPage from './pages/LandingPage';
import AdminDashboard from './pages/AdminDashboard';
import ManagerPanel from './pages/ManagerPanel';
import EmployeeManagement from './pages/EmployeeManagement';
import EmployeeDashboard from './pages/EmployeeDashboard';
import { Sun, Moon, LogOut, LayoutDashboard, Calculator, Users } from 'lucide-react';

function AppContent() {
  const { user, logout } = useAuth();
  const [darkMode, setDarkMode] = useState(false);

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
    document.documentElement.classList.toggle('dark');
  };

  return (
    <div className={`min-h-screen flex bg-gray-50 dark:bg-slate-900 transition-colors duration-200`}>
      {/* Sidebar - only show when logged in */}
      {user && (
      <aside className="w-64 bg-white dark:bg-slate-800 border-r border-gray-200 dark:border-slate-700 hidden md:flex flex-col">
        <div className="p-6 border-b border-gray-200 dark:border-slate-700">
          <h1 className="text-xl font-bold text-primary-600">Carwash POS</h1>
          <p className="text-xs text-gray-500 mt-1">v1.0.0 Pro Edition</p>
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
             <button onClick={logout} className="p-2 rounded-lg hover:bg-red-50 text-red-600">
               <LogOut size={20} />
             </button>
          </div>
        </div>
      </aside>
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
          <Route path="/manage" element={user ? <ManagerPanel /> : <Navigate to="/login" />} />
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
