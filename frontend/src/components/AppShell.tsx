import React, { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { Menu, X, LogOut, ChevronRight } from 'lucide-react';
import Logo from './Logo';
import { useAuthStore } from '../store/useAuthStore';
import NotificationBell from '../components/notifications/NotificationBell';

export interface NavItem {
  name: string;
  path: string;
  icon: React.ReactNode;
  end?: boolean;
}

interface AppShellProps {
  title: string;
  navItems: NavItem[];
  notificationPath: string;
}

/**
 * Kerangka layout berbasis sidebar untuk Masyarakat, Admin, dan Petugas.
 * Responsif: sidebar jadi drawer di mobile, fixed di desktop.
 */
const AppShell: React.FC<AppShellProps> = ({ title, navItems, notificationPath }) => {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const sidebarContent = (
    <>
      {/* Brand */}
      <div className="flex items-center gap-2.5 px-5 h-16 border-b border-slate-800">
        <Logo size={34} />
        <div className="flex flex-col">
          <span className="text-sm font-extrabold text-white leading-tight">SIPANTAU</span>
          <span className="text-[10px] text-slate-400 leading-tight">{title}</span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.end}
            onClick={() => setSidebarOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-semibold transition ${
                isActive
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`
            }
          >
            {item.icon}
            {item.name}
          </NavLink>
        ))}
      </nav>

      {/* User + Logout */}
      <div className="border-t border-slate-800 p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-sm shrink-0">
            {user?.nama?.charAt(0)?.toUpperCase() || 'U'}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white truncate">{user?.nama}</p>
            <p className="text-xs text-slate-400 capitalize">{user?.role}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-2.5 px-4 py-2.5 rounded-xl text-sm font-semibold text-red-400 hover:bg-slate-800 hover:text-red-300 transition"
        >
          <LogOut size={17} />
          Keluar
        </button>
      </div>
    </>
  );

  return (
    <div className="flex h-screen bg-slate-100">
      {/* Sidebar Desktop */}
      <aside className="hidden lg:flex w-64 flex-col bg-slate-900 shrink-0">
        {sidebarContent}
      </aside>

      {/* Sidebar Mobile Drawer */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setSidebarOpen(false)}
            aria-hidden="true"
          />
          <aside className="absolute left-0 top-0 h-full w-72 max-w-[85vw] bg-slate-900 flex flex-col shadow-2xl animate-in slide-in-from-left">
            <button
              onClick={() => setSidebarOpen(false)}
              className="absolute right-3 top-4 p-1.5 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white transition"
              aria-label="Tutup menu"
            >
              <X size={20} />
            </button>
            {sidebarContent}
          </aside>
        </div>
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Topbar */}
        <header className="bg-white border-b border-slate-200 px-4 sm:px-6 h-16 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100 transition"
              aria-label="Buka menu"
            >
              <Menu size={22} />
            </button>
            <h1 className="text-base sm:text-lg font-bold text-slate-800">{title}</h1>
          </div>
          <div className="flex items-center gap-2">
            <NotificationBell centerPath={notificationPath} />
            <div className="hidden sm:flex items-center gap-2 pl-2 border-l border-slate-200">
              <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold">
                {user?.nama?.charAt(0)?.toUpperCase() || 'U'}
              </div>
              <span className="text-sm font-semibold text-slate-700 max-w-[140px] truncate">
                {user?.nama}
              </span>
            </div>
          </div>
        </header>

        {/* Page header strip */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-4 sm:px-6 py-3 flex items-center gap-1.5 text-blue-100 text-xs font-medium">
          <span>SIPANTAU CIREBON</span>
          <ChevronRight size={14} />
          <span className="text-white font-bold">{title}</span>
        </div>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AppShell;
