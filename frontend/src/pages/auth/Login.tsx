import React, { useRef, useState } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { Eye, EyeOff, Loader2, AlertCircle, Mail, Lock, LogIn } from 'lucide-react';
import api from '../../services/api';
import { useAuthStore } from '../../store/useAuthStore';
import Logo from '../../components/Logo';

const SYSTEM_NAME = 'SIPANTAU CIREBON';
const SYSTEM_DESC =
  'Sistem Pelaporan Fasilitas Umum Rusak Kota/Kabupaten Cirebon dengan AI';

const roleHome: Record<string, string> = {
  admin: '/admin/dashboard',
  petugas: '/officer/dashboard',
  masyarakat: '/dashboard',
};

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();
  const login = useAuthStore((state) => state.login);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const user = useAuthStore((state) => state.user);

  const submittingRef = useRef(false);

  // Jika sudah login, langsung ke dashboard sesuai role
  if (isAuthenticated && user) {
    const home = roleHome[user.role] || '/dashboard';
    navigate(home, { replace: true });
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submittingRef.current) return;

    setError('');
    if (!email.trim() || !password) {
      setError('Email dan password wajib diisi');
      return;
    }

    submittingRef.current = true;
    setIsLoading(true);

    try {
      // Role pengguna ditentukan sepenuhnya oleh backend
      // dari data akun terverifikasi (token). Tidak ada
      // pemilihan role di halaman ini.
      const response = await api.post('/auth/login', {
        email: email.trim(),
        password,
      });
      const { token, user: userData } = response.data.data;

      login(userData, token);

      // Wajib ganti password awal → arahkan ke pengaturan profil dulu.
      if (userData.must_change_password) {
        navigate(userData.role === 'admin' ? '/admin/settings' : '/profile', {
          replace: true,
          state: { forcePasswordChange: true },
        });
        return;
      }

      // Redirect: ke halaman asal (jika ada) atau dashboard sesuai role
      const locationState = location.state as { from?: string } | null;
      const from = locationState?.from;
      if (from && roleHome[userData.role]) {
        navigate(from, { replace: true });
      } else {
        navigate(roleHome[userData.role] || '/dashboard', { replace: true });
      }
    } catch (err) {
      // Narrowing struktural (bukan axios.isAxiosError) agar konsisten
      // dengan mock plain-object pada test.
      const response = (err as { response?: { status?: number; data?: { message?: string } } }).response;
      const status = response?.status;
      if (status === 401) {
        setError('Kredensial tidak valid. Periksa email dan password Anda.');
      } else if (status === 403 && response?.data?.message) {
        setError(response.data.message);
      } else if (!response) {
        setError('Tidak dapat terhubung ke server. Periksa koneksi Anda.');
      } else {
        setError('Terjadi kesalahan pada server. Silakan coba lagi nanti.');
      }
    } finally {
      submittingRef.current = false;
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-blue-50/40 to-slate-100 px-4 py-8 sm:px-6 flex items-center justify-center">
      <div className="w-full max-w-md">
        {/* Card */}
        <div className="rounded-3xl bg-white p-6 sm:p-8 shadow-xl shadow-blue-900/10 ring-1 ring-slate-900/5">
          {/* Header branding */}
          <div className="mb-6 flex flex-col items-center text-center">
            <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 shadow-sm ring-1 ring-blue-100">
              <Logo size={40} />
            </div>
            <h1 className="text-xl font-extrabold tracking-tight text-slate-900 sm:text-2xl">
              {SYSTEM_NAME}
            </h1>
            <p className="mt-1.5 max-w-sm text-xs leading-relaxed text-slate-500 sm:text-sm">
              {SYSTEM_DESC}
            </p>
          </div>

          <h2 className="text-center text-base font-bold text-slate-900">Masuk ke Akun Anda</h2>
          <p className="mt-1 mb-5 text-center text-sm text-slate-500">
            Masukkan email dan password untuk melanjutkan
          </p>

          {error && (
            <div
              role="alert"
              className="mt-4 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate className="mt-5 space-y-4">
            {/* Email */}
            <div>
              <label htmlFor="email" className="mb-1.5 block text-sm font-semibold text-slate-700">
                Email
              </label>
              <div className="relative">
                <Mail
                  className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                  aria-hidden="true"
                />
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  placeholder="nama@email.com"
                  value={email}
                  disabled={isLoading}
                  onChange={(e) => setEmail(e.target.value)}
                  aria-invalid={!!error}
                  className={`w-full rounded-xl border bg-slate-50/50 py-2.5 pl-10 pr-4 text-sm text-slate-900 placeholder-slate-400 transition focus:bg-white focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:opacity-60 ${
                    error
                      ? 'border-red-300 focus:border-red-400 focus:ring-red-100'
                      : 'border-slate-300 focus:border-blue-500 focus:ring-blue-100'
                  }`}
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="mb-1.5 block text-sm font-semibold text-slate-700">
                Password
              </label>
              <div className="relative">
                <Lock
                  className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                  aria-hidden="true"
                />
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="Password Anda"
                  value={password}
                  disabled={isLoading}
                  onChange={(e) => setPassword(e.target.value)}
                  aria-invalid={!!error}
                  className={`w-full rounded-xl border bg-slate-50/50 py-2.5 pl-10 pr-11 text-sm text-slate-900 placeholder-slate-400 transition focus:bg-white focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:opacity-60 ${
                    error
                      ? 'border-red-300 focus:border-red-400 focus:ring-red-100'
                      : 'border-slate-300 focus:border-blue-500 focus:ring-blue-100'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                  aria-pressed={showPassword}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 transition hover:text-slate-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isLoading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 text-sm font-bold text-white shadow-lg shadow-blue-600/25 transition hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-blue-400 disabled:shadow-none"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  Memproses...
                </>
              ) : (
                <>
                  <LogIn className="h-4 w-4" aria-hidden="true" />
                  Masuk
                </>
              )}
            </button>
          </form>

          <p className="mt-5 text-center text-sm text-slate-500">
            Belum punya akun?{' '}
            <Link
              to="/register"
              className="font-semibold text-blue-700 transition hover:text-blue-800 hover:underline rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              Daftar di sini
            </Link>
          </p>
        </div>

        <p className="mt-6 text-center text-xs text-slate-500">
          <Link to="/" className="font-semibold hover:text-blue-700 transition">
            &larr; Kembali ke Beranda
          </Link>
        </p>
      </div>
    </div>
  );
};

export default Login;
