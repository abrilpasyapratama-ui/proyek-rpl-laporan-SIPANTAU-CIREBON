import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Save, CheckCircle2, AlertCircle, UserCircle, Lock, Loader2, KeyRound } from 'lucide-react';
import api from '../../services/api';
import { useAuthStore } from '../../store/useAuthStore';
import { extractErrorMessage } from '../../utils/apiError';

interface ProfileForm {
  nama: string;
  email: string;
  no_hp: string;
  username: string;
}

const EMPTY_FORM: ProfileForm = { nama: '', email: '', no_hp: '', username: '' };

const SettingsPage: React.FC = () => {
  const { user, login, token } = useAuthStore();
  const location = useLocation();
  const forced = (location.state as { forcePasswordChange?: boolean } | null)?.forcePasswordChange === true;

  const [form, setForm] = useState<ProfileForm>(EMPTY_FORM);
  const [role, setRole] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [isLoadingUser, setIsLoadingUser] = useState(true);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [profileMsg, setProfileMsg] = useState({ type: '', text: '' });
  const [passwordMsg, setPasswordMsg] = useState({ type: '', text: '' });

  useEffect(() => {
    const load = async () => {
      setIsLoadingUser(true);
      try {
        const res = await api.get('/auth/me');
        const data = res.data.data;
        setForm({
          nama: data.nama || '',
          email: data.email || '',
          no_hp: data.no_hp || '',
          username: data.username || '',
        });
        setRole(data.role || user?.role || '');
      } catch {
        setForm({
          nama: user?.nama || '',
          email: user?.email || '',
          no_hp: user?.no_hp || '',
          username: user?.username || '',
        });
        setRole(user?.role || '');
      } finally {
        setIsLoadingUser(false);
      }
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setField = (key: keyof ProfileForm, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileMsg({ type: '', text: '' });

    if (form.nama.trim().length < 3) {
      setProfileMsg({ type: 'error', text: 'Nama minimal 3 karakter.' });
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      setProfileMsg({ type: 'error', text: 'Format email tidak valid.' });
      return;
    }
    const phoneDigits = form.no_hp.replace(/\D/g, '');
    if (form.no_hp.trim() && !/^(0|62)?8\d{7,12}$/.test(phoneDigits)) {
      setProfileMsg({ type: 'error', text: 'Format nomor HP tidak valid. Contoh: 081234567890.' });
      return;
    }
    if (form.username.trim() && !/^[a-zA-Z0-9._-]{3,50}$/.test(form.username.trim())) {
      setProfileMsg({
        type: 'error',
        text: 'Username 3–50 karakter, hanya huruf, angka, titik, garis bawah, atau tanda hubung.',
      });
      return;
    }

    setIsSavingProfile(true);
    try {
      const res = await api.patch('/auth/profile', {
        nama: form.nama.trim(),
        email: form.email.trim(),
        no_hp: form.no_hp.trim() || null,
        username: form.username.trim() || null,
      });

      // Perbarui store agar nama di header & sidebar langsung berubah tanpa logout.
      if (user && token) {
        login(
          {
            ...user,
            nama: res.data.data.nama,
            email: res.data.data.email,
            username: res.data.data.username,
            no_hp: res.data.data.no_hp,
            role: res.data.data.role,
            status: res.data.data.status,
            must_change_password: res.data.data.must_change_password,
          },
          token
        );
      }

      setForm({
        nama: res.data.data.nama || '',
        email: res.data.data.email || '',
        no_hp: res.data.data.no_hp || '',
        username: res.data.data.username || '',
      });
      setProfileMsg({ type: 'success', text: 'Profil berhasil diperbarui.' });
    } catch (err) {
      setProfileMsg({ type: 'error', text: extractErrorMessage(err) || 'Gagal memperbarui profil.' });
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordMsg({ type: '', text: '' });
    if (!currentPassword) {
      setPasswordMsg({ type: 'error', text: 'Password saat ini wajib diisi.' });
      return;
    }
    if (newPassword.length < 8 || !/[A-Z]/.test(newPassword) || !/[a-z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      setPasswordMsg({ type: 'error', text: 'Password baru minimal 8 karakter, mengandung huruf besar, huruf kecil, dan angka.' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordMsg({ type: 'error', text: 'Konfirmasi password tidak cocok.' });
      return;
    }
    setIsSavingPassword(true);
    try {
      const res = await api.patch('/auth/password', { currentPassword, newPassword });
      if (user && token) login({ ...user, must_change_password: false }, token);
      setPasswordMsg({ type: 'success', text: res.data.message || 'Password berhasil diubah.' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setPasswordMsg({ type: 'error', text: extractErrorMessage(err) || 'Gagal mengubah password.' });
    } finally {
      setIsSavingPassword(false);
    }
  };

  const msgBox = (msg: { type: string; text: string }) => {
    if (!msg.text) return null;
    const ok = msg.type === 'success';
    return (
      <div
        role={ok ? 'status' : 'alert'}
        className={`flex items-center gap-2 rounded-xl border px-4 py-3 text-sm ${ok ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-red-200 bg-red-50 text-red-700'}`}
      >
        {ok ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
        {msg.text}
      </div>
    );
  };

  const inputCls =
    'w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 disabled:opacity-60';

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h2 className="text-xl font-extrabold text-slate-900">Pengaturan Profil</h2>
        <p className="text-sm text-slate-500">Kelola data pribadi dan password akun Anda</p>
      </div>

      {(forced || user?.must_change_password) && (
        <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800" role="alert">
          <KeyRound size={16} className="mt-0.5 shrink-0" />
          <span>
            Demi keamanan, Anda wajib mengganti password awal sebelum menggunakan sistem.
            Isi formulir "Ubah Password" di bawah.
          </span>
        </div>
      )}

      {/* Profil */}
      <form onSubmit={handleProfileSubmit} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-2">
          <UserCircle size={18} className="text-blue-600" />
          <h3 className="text-sm font-bold text-slate-800">Data Pribadi</h3>
        </div>
        {msgBox(profileMsg)}

        <div>
          <label htmlFor="settings-nama" className="mb-1.5 block text-sm font-semibold text-slate-700">
            Nama Lengkap
          </label>
          <input
            id="settings-nama"
            type="text"
            value={form.nama}
            onChange={(e) => setField('nama', e.target.value)}
            disabled={isLoadingUser || isSavingProfile}
            className={inputCls}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="settings-email" className="mb-1.5 block text-sm font-semibold text-slate-700">
              Email
            </label>
            <input
              id="settings-email"
              type="email"
              autoComplete="email"
              value={form.email}
              onChange={(e) => setField('email', e.target.value)}
              disabled={isLoadingUser || isSavingProfile}
              className={inputCls}
            />
          </div>
          <div>
            <label htmlFor="settings-username" className="mb-1.5 block text-sm font-semibold text-slate-700">
              Username <span className="font-normal text-slate-400">(opsional)</span>
            </label>
            <input
              id="settings-username"
              type="text"
              autoComplete="username"
              value={form.username}
              onChange={(e) => setField('username', e.target.value)}
              disabled={isLoadingUser || isSavingProfile}
              placeholder="contoh: abril.pratama"
              className={inputCls}
            />
          </div>
        </div>

        <div>
          <label htmlFor="settings-phone" className="mb-1.5 block text-sm font-semibold text-slate-700">
            Nomor HP <span className="font-normal text-slate-400">(opsional)</span>
          </label>
          <input
            id="settings-phone"
            type="tel"
            autoComplete="tel"
            value={form.no_hp}
            onChange={(e) => setField('no_hp', e.target.value)}
            disabled={isLoadingUser || isSavingProfile}
            placeholder="08xxxxxxxxxx"
            className={inputCls}
          />
        </div>

        <div>
          <span className="mb-1.5 block text-sm font-semibold text-slate-700">Peran</span>
          <p className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm capitalize text-slate-500">
            {role || '-'}
          </p>
          <p className="mt-1 text-xs text-slate-400">Peran hanya dapat diubah oleh administrator lain melalui Kelola Pengguna.</p>
        </div>

        <button
          type="submit"
          disabled={isSavingProfile || isLoadingUser}
          className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-bold text-white hover:bg-blue-700 transition disabled:bg-blue-300"
        >
          {isSavingProfile ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          Simpan Profil
        </button>
      </form>

      {/* Password */}
      <form onSubmit={handlePasswordSubmit} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-2">
          <Lock size={18} className="text-emerald-600" />
          <h3 className="text-sm font-bold text-slate-800">Ubah Password</h3>
        </div>
        {msgBox(passwordMsg)}
        <div>
          <label htmlFor="settings-current" className="mb-1.5 block text-sm font-semibold text-slate-700">
            Password Saat Ini
          </label>
          <input
            id="settings-current"
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            disabled={isSavingPassword}
            className={inputCls}
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="settings-new" className="mb-1.5 block text-sm font-semibold text-slate-700">
              Password Baru
            </label>
            <input
              id="settings-new"
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              disabled={isSavingPassword}
              placeholder="Min. 8 karakter"
              className={inputCls}
            />
          </div>
          <div>
            <label htmlFor="settings-confirm" className="mb-1.5 block text-sm font-semibold text-slate-700">
              Konfirmasi Password Baru
            </label>
            <input
              id="settings-confirm"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={isSavingPassword}
              className={inputCls}
            />
          </div>
        </div>
        <button
          type="submit"
          disabled={isSavingPassword}
          className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-6 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 transition disabled:bg-emerald-300"
        >
          {isSavingPassword ? <Loader2 size={16} className="animate-spin" /> : <Lock size={16} />}
          Ubah Password
        </button>
      </form>
    </div>
  );
};

export default SettingsPage;
