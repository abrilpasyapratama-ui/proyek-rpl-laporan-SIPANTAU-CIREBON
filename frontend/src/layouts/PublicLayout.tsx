import React, { useState } from 'react';
import { Outlet, Link, NavLink, useNavigate } from 'react-router-dom';
import { Menu, X, LogIn, UserPlus, LayoutDashboard } from 'lucide-react';
import Logo from '../components/Logo';
import { useAuthStore } from '../store/useAuthStore';

const roleHome: Record<string, string> = {
  admin: '/admin/dashboard',
  petugas: '/officer/dashboard',
  masyarakat: '/dashboard',
};

/**
 * Layout publik: background gradasi biru muda yang lembut,
 * navbar putih melayang (rounded + bayangan halus), konten + footer.
 */
const PublicLayout: React.FC = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuthStore();

  const navLinks = [
    { name: 'Beranda', path: '/' },
    { name: 'Peta GIS', path: '/map' },
    { name: 'Tentang', path: '/about' },
    { name: 'Kontak', path: '/contact' },
  ];

  const dashboardPath = user ? roleHome[user.role] || '/dashboard' : '/dashboard';
  const go = (path: string) => {
    setIsMenuOpen(false);
    navigate(path);
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-slate-50 via-blue-50/40 to-slate-100">
      {/* Navbar melayang */}
      <div className="sticky top-0 z-50 px-3 sm:px-6 pt-3 sm:pt-4">
        <header className="max-w-7xl mx-auto rounded-2xl bg-white/95 backdrop-blur-md shadow-lg shadow-blue-900/5 ring-1 ring-slate-900/5">
          <nav className="px-4 sm:px-6">
            <div className="flex items-center justify-between h-16">
              {/* Logo */}
              <Link to="/" className="flex items-center gap-2.5 group">
                <Logo size={36} />
                <div className="flex flex-col">
                  <span className="text-sm font-extrabold tracking-tight text-slate-900 leading-tight group-hover:text-blue-700 transition">
                    SIPANTAU CIREBON
                  </span>
                  <span className="text-[10px] text-slate-500 leading-tight hidden sm:block">
                    Fasilitas Umum Rusak
                  </span>
                </div>
              </Link>

              {/* Desktop Nav */}
              <div className="hidden md:flex items-center gap-1">
                {navLinks.map((link) => (
                  <NavLink
                    key={link.path}
                    to={link.path}
                    end={link.path === '/'}
                    className={({ isActive }) =>
                      `px-4 py-2 rounded-xl text-sm font-semibold transition ${
                        isActive
                          ? 'text-blue-700 bg-blue-50'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                      }`
                    }
                  >
                    {link.name}
                  </NavLink>
                ))}
              </div>

              {/* Auth Buttons (Desktop) */}
              <div className="hidden md:flex items-center gap-2">
                {isAuthenticated ? (
                  <button
                    onClick={() => go(dashboardPath)}
                    className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-600/25 transition"
                  >
                    <LayoutDashboard size={16} />
                    Dashboard
                  </button>
                ) : (
                  <>
                    <button
                      onClick={() => go('/login')}
                      className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-100 transition"
                    >
                      <LogIn size={16} />
                      Masuk
                    </button>
                    <button
                      onClick={() => go('/register')}
                      className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-600/25 transition"
                    >
                      <UserPlus size={16} />
                      Daftar
                    </button>
                  </>
                )}
              </div>

              {/* Mobile Menu Button */}
              <button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="md:hidden p-2 rounded-xl text-slate-600 hover:bg-slate-100 transition"
                aria-label="Toggle menu"
                aria-expanded={isMenuOpen}
              >
                {isMenuOpen ? <X size={22} /> : <Menu size={22} />}
              </button>
            </div>
          </nav>

          {/* Mobile Menu */}
          {isMenuOpen && (
            <div className="md:hidden border-t border-slate-100 px-4 py-3 space-y-1">
              {navLinks.map((link) => (
                <NavLink
                  key={link.path}
                  to={link.path}
                  end={link.path === '/'}
                  onClick={() => setIsMenuOpen(false)}
                  className={({ isActive }) =>
                    `block px-4 py-2.5 rounded-xl text-sm font-semibold transition ${
                      isActive
                        ? 'text-blue-700 bg-blue-50'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`
                  }
                >
                  {link.name}
                </NavLink>
              ))}
              <div className="pt-2 border-t border-slate-100 flex gap-2">
                {isAuthenticated ? (
                  <button
                    onClick={() => go(dashboardPath)}
                    className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 transition"
                  >
                    <LayoutDashboard size={16} />
                    Dashboard
                  </button>
                ) : (
                  <>
                    <button
                      onClick={() => go('/login')}
                      className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-700 border border-slate-300 hover:bg-slate-50 transition"
                    >
                      <LogIn size={16} />
                      Masuk
                    </button>
                    <button
                      onClick={() => go('/register')}
                      className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 transition"
                    >
                      <UserPlus size={16} />
                      Daftar
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
        </header>
      </div>

      {/* Main Content */}
      <main className="flex-1">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-400">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Logo size={32} />
                <span className="text-sm font-extrabold text-white">SIPANTAU CIREBON</span>
              </div>
              <p className="text-xs leading-relaxed">
                Sistem Pelaporan Fasilitas Umum Rusak Kota/Kabupaten Cirebon dengan AI.
                Laporan Anda membantu mewujudkan fasilitas publik yang lebih baik.
              </p>
            </div>
            <div>
              <h4 className="text-sm font-bold text-white mb-3">Navigasi</h4>
              <ul className="space-y-2 text-xs">
                {navLinks.map((l) => (
                  <li key={l.path}>
                    <Link to={l.path} className="hover:text-white transition">{l.name}</Link>
                  </li>
                ))}
                {isAuthenticated ? (
                  <li><Link to={dashboardPath} className="hover:text-white transition">Dashboard</Link></li>
                ) : (
                  <>
                    <li><Link to="/login" className="hover:text-white transition">Masuk</Link></li>
                    <li><Link to="/register" className="hover:text-white transition">Daftar</Link></li>
                  </>
                )}
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-bold text-white mb-3">Kontak</h4>
              <ul className="space-y-2 text-xs">
                <li>Dinas Pekerjaan Umum Cirebon</li>
                <li>Email: pengaduan@cirebonkota.go.id</li>
                <li>Telepon: (0231) 123-456</li>
              </ul>
            </div>
          </div>
          <div className="mt-8 pt-6 border-t border-slate-800 text-center text-xs">
            &copy; {new Date().getFullYear()} Pemerintah Kota/Kabupaten Cirebon. Seluruh hak cipta dilindungi.
          </div>
        </div>
      </footer>
    </div>
  );
};

export default PublicLayout;
