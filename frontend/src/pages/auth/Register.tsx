import React, { useRef, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Eye, EyeOff, Loader2, Check, X, AlertCircle, User, Mail, Lock, Phone, HardHat, Building2, MapPin, BadgeCheck } from 'lucide-react';
import api from '../../services/api';
import Logo from '../../components/Logo';
import {
  validateNama,
  validateEmail,
  validatePassword,
  validateConfirmPassword,
  getPasswordErrors,
  getPasswordStrength,
} from '../../utils/validation';

type RoleChoice = 'masyarakat' | 'petugas';

interface FieldErrors {
  nama?: string;
  email?: string;
  no_hp?: string;
  nip?: string;
  instansi?: string;
  wilayah?: string;
  password?: string;
  confirmPassword?: string;
  consent?: string;
}

const SYSTEM_NAME = 'SIPANTAU CIREBON';
const SYSTEM_DESC =
  'Sistem Pelaporan Fasilitas Umum Rusak Kota/Kabupaten Cirebon dengan AI';

const ROLE_CARDS: Array<{ key: RoleChoice; title: string; desc: string; icon: React.ReactNode }> = [
  {
    key: 'masyarakat',
    title: 'Masyarakat',
    desc: 'Daftarkan kerusakan fasilitas umum dan pantau status laporan.',
    icon: <User size={22} />,
  },
  {
    key: 'petugas',
    title: 'Petugas',
    desc: 'Akses penugasan dan kelola tindak lanjut laporan fasilitas umum.',
    icon: <HardHat size={22} />,
  },
];

const validatePhone = (v: string, required: boolean): string | null => {
  const t = v.trim();
  if (!t) return required ? 'Nomor HP wajib diisi' : null;
  if (!/^[0-9+\-\s()]{9,20}$/.test(t)) return 'Format nomor HP tidak valid';
  return null;
};

const Register: React.FC = () => {
  const navigate = useNavigate();

  const [role, setRole] = useState<RoleChoice>('masyarakat');
  const [nama, setNama] = useState('');
  const [email, setEmail] = useState('');
  const [noHp, setNoHp] = useState('');
  const [nip, setNip] = useState('');
  const [instansi, setInstansi] = useState('');
  const [wilayah, setWilayah] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [consent, setConsent] = useState(false);

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [errors, setErrors] = useState<FieldErrors>({});
  const [serverError, setServerError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  const submittingRef = useRef(false);

  const passwordErrors = getPasswordErrors(password);
  const strength = getPasswordStrength(password);

  const validateAll = (): boolean => {
    const next: FieldErrors = {
      nama: validateNama(nama) ?? undefined,
      email: validateEmail(email) ?? undefined,
      password: validatePassword(password) ?? undefined,
      confirmPassword: validateConfirmPassword(password, confirmPassword) ?? undefined,
    };
    const phoneMsg = validatePhone(noHp, role === 'petugas');
    if (phoneMsg) next.no_hp = phoneMsg;
    if (role === 'petugas') {
      if (!instansi.trim()) next.instansi = 'Instansi/unit kerja wajib diisi';
      else if (instansi.trim().length > 150) next.instansi = 'Instansi maksimal 150 karakter';
      if (!wilayah.trim()) next.wilayah = 'Wilayah tugas wajib diisi';
      else if (wilayah.trim().length > 150) next.wilayah = 'Wilayah maksimal 150 karakter';
      if (nip.trim() && nip.trim().length > 50) next.nip = 'NIP maksimal 50 karakter';
    }
    if (!consent) next.consent = 'Anda harus menyetujui kebijakan privasi';
    setErrors(next);
    return Object.values(next).every((v) => !v);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submittingRef.current) return;

    setServerError('');
    if (!validateAll()) return;

    submittingRef.current = true;
    setIsLoading(true);

    try {
      const res = await api.post('/auth/register', {
        nama: nama.trim(),
        email: email.trim(),
        password,
        role,
        ...(noHp.trim() ? { no_hp: noHp.trim() } : {}),
        ...(role === 'petugas'
          ? {
              ...(nip.trim() ? { nip: nip.trim() } : {}),
              instansi: instansi.trim(),
              wilayah: wilayah.trim(),
            }
          : {}),
      });
      setSuccessMessage(
        res.data?.message ||
          (role === 'petugas'
            ? 'Registrasi berhasil dikirim. Akun Anda menunggu verifikasi Admin.'
            : 'Registrasi berhasil! Mengalihkan ke halaman login...')
      );
      setIsSuccess(true);
      setTimeout(() => navigate('/login'), 2500);
    } catch (err) {
      const response = (err as { response?: { status?: number; data?: { message?: string } } })
        .response;
      const status = response?.status;
      const message = response?.data?.message;

      if (status === 409) {
        setErrors((prev) => ({ ...prev, email: 'Email sudah digunakan' }));
        setServerError('');
      } else if ((status === 400 || status === 403) && message) {
        setErrors({});
        setServerError(message);
      } else if (!response) {
        setServerError('Tidak dapat terhubung ke server. Periksa koneksi Anda.');
      } else {
        setServerError('Terjadi kesalahan pada server. Silakan coba lagi nanti.');
      }
    } finally {
      submittingRef.current = false;
      setIsLoading(false);
    }
  };

  const handleBlur = (field: 'nama' | 'email' | 'password' | 'confirmPassword') => {
    let msg: string | null = null;
    if (field === 'nama') msg = validateNama(nama);
    if (field === 'email') msg = validateEmail(email);
    if (field === 'password') msg = validatePassword(password);
    if (field === 'confirmPassword') msg = validateConfirmPassword(password, confirmPassword);
    setErrors((prev) => ({ ...prev, [field]: msg ?? undefined }));
  };

  const passwordCriteria = [
    { key: 'minLength', label: 'Minimal 8 karakter', ok: passwordErrors.minLength },
    { key: 'hasUpper', label: 'Huruf besar (A-Z)', ok: passwordErrors.hasUpper },
    { key: 'hasLower', label: 'Huruf kecil (a-z)', ok: passwordErrors.hasLower },
    { key: 'hasNumber', label: 'Angka (0-9)', ok: passwordErrors.hasNumber },
  ];

  const inputCls = (hasError?: string) =>
    `w-full rounded-xl border bg-slate-50/50 py-2.5 pl-10 pr-4 text-sm text-slate-900 placeholder-slate-400 transition focus:bg-white focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:opacity-60 ${
      hasError
        ? 'border-red-300 focus:border-red-400 focus:ring-red-100'
        : 'border-slate-300 focus:border-blue-500 focus:ring-blue-100'
    }`;

  const fieldError = (id: string, msg?: string) =>
    msg ? (
      <p id={id} role="alert" className="mt-1.5 flex items-center gap-1 text-xs font-medium text-red-600">
        <X className="h-3 w-3" aria-hidden="true" /> {msg}
      </p>
    ) : null;

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-slate-50 via-blue-50/40 to-slate-100 px-4 py-8 sm:px-6">
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-md ring-1 ring-slate-200">
            <Logo size={40} />
          </div>
          <h1 className="text-xl font-extrabold tracking-tight text-slate-900 sm:text-2xl">
            {SYSTEM_NAME}
          </h1>
          <p className="mt-1.5 max-w-sm text-xs leading-relaxed text-slate-500 sm:text-sm">
            {SYSTEM_DESC}
          </p>
        </div>

        <div className="rounded-3xl bg-white p-6 shadow-xl shadow-blue-900/10 ring-1 ring-slate-900/5 sm:p-8">
          <div className="mb-6">
            <h2 className="text-lg font-bold text-slate-900">Daftar Akun Baru</h2>
            <p className="mt-1 text-sm text-slate-500">
              Sudah punya akun?{' '}
              <Link
                to="/login"
                className="font-semibold text-blue-700 transition hover:text-blue-800 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded"
              >
                Masuk di sini
              </Link>
            </p>
          </div>

          {/* Pilihan peran */}
          <div className="mb-6">
            <p className="mb-2 text-sm font-semibold text-slate-700">Daftar sebagai</p>
            <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label="Pilih peran pendaftaran">
              {ROLE_CARDS.map((c) => {
                const active = role === c.key;
                return (
                  <button
                    key={c.key}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => {
                      setRole(c.key);
                      setErrors({});
                      setServerError('');
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
                        e.preventDefault();
                        setRole(c.key === 'masyarakat' ? 'petugas' : 'masyarakat');
                        setErrors({});
                        setServerError('');
                      }
                    }}
                    className={`rounded-2xl border-2 p-4 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                      active
                        ? 'border-blue-600 bg-blue-50 shadow-md shadow-blue-600/10'
                        : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <span className={active ? 'text-blue-700' : 'text-slate-400'} aria-hidden="true">
                      {c.icon}
                    </span>
                    <span className={`mt-2 block text-sm font-bold ${active ? 'text-blue-800' : 'text-slate-700'}`}>
                      {c.title}
                    </span>
                    <span className="mt-1 block text-[11px] leading-relaxed text-slate-500">{c.desc}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {serverError && (
            <div
              role="alert"
              className="mb-5 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
              <span>{serverError}</span>
            </div>
          )}

          {isSuccess && (
            <div
              role="status"
              className="mb-5 flex items-start gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700"
            >
              <Check className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
              <span>{successMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate className="space-y-5">
            <div>
              <label htmlFor="nama" className="mb-1.5 block text-sm font-semibold text-slate-700">
                Nama Lengkap
              </label>
              <div className="relative">
                <User className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                <input
                  id="nama" name="nama" type="text" autoComplete="name" placeholder="Nama lengkap Anda"
                  value={nama} disabled={isLoading || isSuccess}
                  onChange={(e) => setNama(e.target.value)} onBlur={() => handleBlur('nama')}
                  aria-invalid={!!errors.nama} aria-describedby={errors.nama ? 'nama-error' : undefined}
                  className={inputCls(errors.nama)}
                />
              </div>
              {fieldError('nama-error', errors.nama)}
            </div>

            <div>
              <label htmlFor="email" className="mb-1.5 block text-sm font-semibold text-slate-700">
                Email
              </label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                <input
                  id="email" name="email" type="email" autoComplete="email" placeholder="nama@email.com"
                  value={email} disabled={isLoading || isSuccess}
                  onChange={(e) => setEmail(e.target.value)} onBlur={() => handleBlur('email')}
                  aria-invalid={!!errors.email} aria-describedby={errors.email ? 'email-error' : undefined}
                  className={inputCls(errors.email)}
                />
              </div>
              {fieldError('email-error', errors.email)}
            </div>

            <div>
              <label htmlFor="no_hp" className="mb-1.5 block text-sm font-semibold text-slate-700">
                Nomor HP {role === 'masyarakat' ? <span className="font-normal text-slate-400">(opsional)</span> : null}
              </label>
              <div className="relative">
                <Phone className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                <input
                  id="no_hp" name="no_hp" type="tel" autoComplete="tel" placeholder="08xxxxxxxxxx"
                  value={noHp} disabled={isLoading || isSuccess}
                  onChange={(e) => setNoHp(e.target.value)}
                  aria-invalid={!!errors.no_hp} aria-describedby={errors.no_hp ? 'no_hp-error' : undefined}
                  className={inputCls(errors.no_hp)}
                />
              </div>
              {fieldError('no_hp-error', errors.no_hp)}
            </div>

            {role === 'petugas' && (
              <>
                <div>
                  <label htmlFor="nip" className="mb-1.5 block text-sm font-semibold text-slate-700">
                    NIP / Nomor Identitas <span className="font-normal text-slate-400">(opsional)</span>
                  </label>
                  <div className="relative">
                    <BadgeCheck className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                    <input
                      id="nip" name="nip" type="text" placeholder="Nomor induk pegawai (jika ada)"
                      value={nip} disabled={isLoading || isSuccess}
                      onChange={(e) => setNip(e.target.value)}
                      aria-invalid={!!errors.nip} aria-describedby={errors.nip ? 'nip-error' : undefined}
                      className={inputCls(errors.nip)}
                    />
                  </div>
                  {fieldError('nip-error', errors.nip)}
                </div>

                <div>
                  <label htmlFor="instansi" className="mb-1.5 block text-sm font-semibold text-slate-700">
                    Instansi / Unit Kerja
                  </label>
                  <div className="relative">
                    <Building2 className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                    <input
                      id="instansi" name="instansi" type="text" placeholder="cth. Dinas Pekerjaan Umum"
                      value={instansi} disabled={isLoading || isSuccess}
                      onChange={(e) => setInstansi(e.target.value)}
                      aria-invalid={!!errors.instansi} aria-describedby={errors.instansi ? 'instansi-error' : undefined}
                      className={inputCls(errors.instansi)}
                    />
                  </div>
                  {fieldError('instansi-error', errors.instansi)}
                </div>

                <div>
                  <label htmlFor="wilayah" className="mb-1.5 block text-sm font-semibold text-slate-700">
                    Kecamatan / Wilayah Tugas
                  </label>
                  <div className="relative">
                    <MapPin className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                    <input
                      id="wilayah" name="wilayah" type="text" placeholder="cth. Kejaksan"
                      value={wilayah} disabled={isLoading || isSuccess}
                      onChange={(e) => setWilayah(e.target.value)}
                      aria-invalid={!!errors.wilayah} aria-describedby={errors.wilayah ? 'wilayah-error' : undefined}
                      className={inputCls(errors.wilayah)}
                    />
                  </div>
                  {fieldError('wilayah-error', errors.wilayah)}
                </div>
              </>
            )}

            <div>
              <label htmlFor="password" className="mb-1.5 block text-sm font-semibold text-slate-700">
                Password
              </label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                <input
                  id="password" name="password" type={showPassword ? 'text' : 'password'} autoComplete="new-password"
                  placeholder="Minimal 8 karakter" value={password} disabled={isLoading || isSuccess}
                  onChange={(e) => setPassword(e.target.value)} onBlur={() => handleBlur('password')}
                  aria-invalid={!!errors.password} aria-describedby={errors.password ? 'password-error' : 'password-hint'}
                  className={`w-full rounded-xl border bg-slate-50/50 py-2.5 pl-10 pr-11 text-sm text-slate-900 placeholder-slate-400 transition focus:bg-white focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:opacity-60 ${
                    errors.password ? 'border-red-300 focus:border-red-400 focus:ring-red-100' : 'border-slate-300 focus:border-blue-500 focus:ring-blue-100'
                  }`}
                />
                <button
                  type="button" onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'} aria-pressed={showPassword}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 transition hover:text-slate-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>

              {password && (
                <div className="mt-2" aria-live="polite">
                  <div className="flex gap-1" aria-hidden="true">
                    {[1, 2, 3, 4].map((i) => (
                      <div key={i} className={`h-1.5 flex-1 rounded-full transition-colors ${i <= strength.level ? strength.color : 'bg-slate-200'}`} />
                    ))}
                  </div>
                  <p className={`mt-1 text-xs font-semibold ${strength.textColor}`}>Kekuatan: {strength.label}</p>
                </div>
              )}

              <ul id="password-hint" className="mt-2 grid grid-cols-1 gap-1 sm:grid-cols-2">
                {passwordCriteria.map((c) => (
                  <li key={c.key} className={`flex items-center gap-1.5 text-xs transition-colors ${c.ok ? 'text-emerald-600' : 'text-slate-400'}`}>
                    {c.ok ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : <X className="h-3.5 w-3.5" aria-hidden="true" />}
                    {c.label}
                  </li>
                ))}
              </ul>
              {fieldError('password-error', errors.password)}
            </div>

            <div>
              <label htmlFor="confirmPassword" className="mb-1.5 block text-sm font-semibold text-slate-700">
                Konfirmasi Password
              </label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                <input
                  id="confirmPassword" name="confirmPassword" type={showConfirm ? 'text' : 'password'} autoComplete="new-password"
                  placeholder="Ulangi password Anda" value={confirmPassword} disabled={isLoading || isSuccess}
                  onChange={(e) => setConfirmPassword(e.target.value)} onBlur={() => handleBlur('confirmPassword')}
                  aria-invalid={!!errors.confirmPassword} aria-describedby={errors.confirmPassword ? 'confirm-error' : undefined}
                  className={`w-full rounded-xl border bg-slate-50/50 py-2.5 pl-10 pr-11 text-sm text-slate-900 placeholder-slate-400 transition focus:bg-white focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:opacity-60 ${
                    errors.confirmPassword ? 'border-red-300 focus:border-red-400 focus:ring-red-100' : 'border-slate-300 focus:border-blue-500 focus:ring-blue-100'
                  }`}
                />
                <button
                  type="button" onClick={() => setShowConfirm((v) => !v)}
                  aria-label={showConfirm ? 'Sembunyikan konfirmasi password' : 'Tampilkan konfirmasi password'} aria-pressed={showConfirm}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 transition hover:text-slate-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                >
                  {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {fieldError('confirm-error', errors.confirmPassword)}
            </div>

            <div>
              <label className="flex cursor-pointer items-start gap-2.5 text-xs leading-relaxed text-slate-600">
                <input
                  type="checkbox" checked={consent} disabled={isLoading || isSuccess}
                  onChange={(e) => setConsent(e.target.checked)}
                  aria-invalid={!!errors.consent} aria-describedby={errors.consent ? 'consent-error' : undefined}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span>
                  Saya menyetujui kebijakan privasi dan penggunaan data untuk layanan SIPANTAU CIREBON
                  {role === 'petugas' ? ' serta bersedia diverifikasi oleh Admin sebelum akun aktif.' : '.'}
                </span>
              </label>
              {fieldError('consent-error', errors.consent)}
            </div>

            <button
              type="submit" disabled={isLoading || isSuccess}
              className="group relative flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 text-sm font-bold text-white shadow-lg shadow-blue-600/25 transition hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-blue-400 disabled:shadow-none"
            >
              {isLoading ? (
                <><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Memproses...</>
              ) : isSuccess ? (
                <><Check className="h-4 w-4" aria-hidden="true" /> Berhasil!</>
              ) : (
                role === 'petugas' ? 'Kirim Pengajuan' : 'Daftar Sekarang'
              )}
            </button>
          </form>
        </div>

        <p className="mt-6 text-center text-xs text-slate-500">
          <Link to="/" className="font-semibold hover:text-blue-700 transition">
            &larr; Kembali ke Beranda
          </Link>
        </p>
        <p className="mt-2 text-center text-xs text-slate-400">
          &copy; {new Date().getFullYear()} Pemerintah Kota/Kabupaten Cirebon
        </p>
      </div>
    </div>
  );
};

export default Register;
