import React, { useEffect, useState } from 'react';
import {
  UserCircle,
  Mail,
  ShieldCheck,
  FileText,
  Send,
  Link2,
  Unlink,
  Copy,
  ExternalLink,
  RefreshCw,
  Loader2,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import api from '../../services/api';
import { extractErrorMessage } from '../../utils/apiError';

interface ProfileUser {
  id: string;
  nama: string;
  username?: string | null;
  email: string;
  no_hp?: string | null;
  role: string;
  created_at: string;
}

interface TelegramStatus {
  connected: boolean;
  status: 'DISCONNECTED' | 'PENDING' | 'CONNECTED';
  connectedAt: string | null;
  chatIdMasked: string | null;
  botUsername: string | null;
}

interface TelegramLinkCode {
  code: string;
  expiresAt: string;
  deepLink: string | null;
  botUsername: string | null;
  instructions: string;
}

const ProfilePage: React.FC = () => {
  const [user, setUser] = useState<ProfileUser | null>(null);
  const [reportCount, setReportCount] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const [telegram, setTelegram] = useState<TelegramStatus | null>(null);
  const [linkCode, setLinkCode] = useState<TelegramLinkCode | null>(null);
  const [telegramLoading, setTelegramLoading] = useState(false);
  const [telegramError, setTelegramError] = useState('');
  const [telegramSuccess, setTelegramSuccess] = useState('');
  const [copied, setCopied] = useState(false);
  const [now, setNow] = useState(Date.now());

  const loadTelegramStatus = async (silent = false) => {
    try {
      const res = await api.get('/telegram/status');
      setTelegram(res.data.data);
      return res.data.data as TelegramStatus;
    } catch (err) {
      if (!silent) setTelegramError(extractErrorMessage(err));
      return null;
    }
  };

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      try {
        const res = await api.get('/auth/me');
        setUser(res.data.data);
        if (res.data.data.role === 'masyarakat') {
          try {
            const stats = await api.get('/reports/mystats');
            setReportCount(stats.data.data.total);
          } catch {
            // abaikan
          }
        }
      } catch {
        setError('Gagal memuat profil');
      } finally {
        setIsLoading(false);
      }
    };
    load();
    void loadTelegramStatus(true);
  }, []);

  // Polling status selama kode penghubung masih aktif.
  useEffect(() => {
    if (!linkCode) return;
    const tick = setInterval(() => setNow(Date.now()), 1000);
    const poll = setInterval(async () => {
      const status = await loadTelegramStatus(true);
      if (status?.connected) {
        setLinkCode(null);
        setTelegramSuccess('Telegram berhasil terhubung. Notifikasi personal sudah aktif.');
      }
    }, 4000);
    return () => {
      clearInterval(tick);
      clearInterval(poll);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linkCode]);

  if (isLoading) {
    return <div className="h-64 rounded-2xl bg-slate-200 animate-pulse" />;
  }

  if (error || !user) {
    return <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error || 'Profil tidak ditemukan'}</div>;
  }

  const roleLabel = (role: string) => {
    switch (role) {
      case 'admin': return 'Administrator';
      case 'petugas': return 'Petugas Lapangan';
      default: return 'Masyarakat';
    }
  };

  const handleConnect = async () => {
    setTelegramLoading(true);
    setTelegramError('');
    setTelegramSuccess('');
    setCopied(false);
    try {
      const res = await api.post('/telegram/link-code');
      setLinkCode(res.data.data);
      setNow(Date.now());
    } catch (err) {
      setTelegramError(extractErrorMessage(err));
    } finally {
      setTelegramLoading(false);
    }
  };

  const handleDisconnect = async () => {
    if (!window.confirm('Putuskan hubungan Telegram? Anda tidak akan menerima notifikasi personal sampai menghubungkan kembali.')) {
      return;
    }
    setTelegramLoading(true);
    setTelegramError('');
    setTelegramSuccess('');
    try {
      await api.delete('/telegram/link');
      setLinkCode(null);
      setTelegram((prev) => prev
        ? { ...prev, connected: false, status: 'DISCONNECTED', connectedAt: null, chatIdMasked: null }
        : prev);
      setTelegramSuccess('Akun Telegram berhasil diputuskan.');
    } catch (err) {
      setTelegramError(extractErrorMessage(err));
    } finally {
      setTelegramLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!linkCode) return;
    try {
      await navigator.clipboard.writeText(linkCode.code);
      setCopied(true);
      setTelegramError('');
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setTelegramError('Gagal menyalin kode. Salin kode secara manual.');
    }
  };

  const handleRefreshStatus = async () => {
    setTelegramLoading(true);
    setTelegramError('');
    const status = await loadTelegramStatus();
    if (status?.connected) {
      setLinkCode(null);
      setTelegramSuccess('Telegram berhasil terhubung. Notifikasi personal sudah aktif.');
    } else if (status) {
      setTelegramError('Akun Telegram belum terhubung. Pastikan kode sudah dikirim ke bot.');
    }
    setTelegramLoading(false);
  };

  const statusBadge = (() => {
    if (telegram?.connected) {
      return { label: 'Terhubung', className: 'bg-emerald-50 text-emerald-700 ring-emerald-100' };
    }
    if (telegram?.status === 'PENDING') {
      return { label: 'Menunggu Verifikasi', className: 'bg-amber-50 text-amber-700 ring-amber-100' };
    }
    return { label: 'Belum Terhubung', className: 'bg-slate-100 text-slate-600 ring-slate-200' };
  })();

  const expiresAt = linkCode ? new Date(linkCode.expiresAt).getTime() : 0;
  const remainingMs = Math.max(0, expiresAt - now);
  const remainingMinutes = Math.floor(remainingMs / 60000);
  const remainingSeconds = Math.floor((remainingMs % 60000) / 1000);
  const isExpired = Boolean(linkCode) && remainingMs <= 0;
  const botUsername = linkCode?.botUsername || telegram?.botUsername;
  const deepLink = linkCode?.deepLink || (botUsername ? 'https://t.me/' + botUsername : null);

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h2 className="text-xl font-extrabold text-slate-900">Profil Saya</h2>
        <p className="text-sm text-slate-500">Informasi akun Anda</p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm text-center">
        <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-blue-600 text-white">
          <UserCircle size={44} />
        </div>
        <h3 className="text-lg font-extrabold text-slate-900">{user.nama}</h3>
        <span className="mt-2 inline-block rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
          {roleLabel(user.role)}
        </span>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-slate-50 p-2.5 ring-1 ring-slate-100">
            <Mail size={18} className="text-slate-500" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-400">Email</p>
            <p className="text-sm font-semibold text-slate-800">{user.email}</p>
          </div>
        </div>
        {user.no_hp && (
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-slate-50 p-2.5 ring-1 ring-slate-100">
              <UserCircle size={18} className="text-slate-500" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-400">Nomor HP</p>
              <p className="text-sm font-semibold text-slate-800">{user.no_hp}</p>
            </div>
          </div>
        )}
        {user.username && (
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-slate-50 p-2.5 ring-1 ring-slate-100">
              <UserCircle size={18} className="text-slate-500" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-400">Username</p>
              <p className="text-sm font-semibold text-slate-800">{user.username}</p>
            </div>
          </div>
        )}
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-slate-50 p-2.5 ring-1 ring-slate-100">
            <ShieldCheck size={18} className="text-slate-500" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-400">Peran</p>
            <p className="text-sm font-semibold text-slate-800">{roleLabel(user.role)}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-slate-50 p-2.5 ring-1 ring-slate-100">
            <FileText size={18} className="text-slate-500" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-400">Terdaftar Sejak</p>
            <p className="text-sm font-semibold text-slate-800">
              {new Date(user.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          </div>
        </div>
        {reportCount !== null && (
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-slate-50 p-2.5 ring-1 ring-slate-100">
              <FileText size={18} className="text-slate-500" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-400">Total Laporan</p>
              <p className="text-sm font-semibold text-slate-800">{reportCount} laporan</p>
            </div>
          </div>
        )}
      </div>

      {/* ==================== TELEGRAM ==================== */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-sky-50 p-2.5 ring-1 ring-sky-100">
              <Send size={18} className="text-sky-600" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-slate-900">Telegram</h3>
              <p className="text-xs text-slate-500">Notifikasi personal untuk laporan Anda</p>
            </div>
          </div>
          <span className={'inline-flex w-fit items-center rounded-full px-3 py-1 text-xs font-bold ring-1 ' + statusBadge.className}>
            {statusBadge.label}
          </span>
        </div>

        {telegram?.connected ? (
          <div className="mt-4 space-y-4">
            <div className="flex items-start gap-3 rounded-xl border border-emerald-100 bg-emerald-50 p-3">
              <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-emerald-600" />
              <div className="text-sm text-emerald-800">
                <p className="font-semibold">Telegram terhubung</p>
                <p className="text-xs text-emerald-700">
                  Chat: {telegram.chatIdMasked}
                  {telegram.connectedAt
                    ? ' • sejak ' + new Date(telegram.connectedAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
                    : ''}
                </p>
              </div>
            </div>
            <p className="text-xs text-slate-500">
              Anda akan menerima notifikasi hanya untuk laporan milik Anda sendiri. Admin tetap menerima notifikasi aktivitas sistem.
            </p>
            <button
              type="button"
              onClick={handleDisconnect}
              disabled={telegramLoading}
              className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {telegramLoading ? <Loader2 size={16} className="animate-spin" /> : <Unlink size={16} />}
              Putuskan Telegram
            </button>
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            <ol className="list-decimal space-y-1 pl-5 text-xs text-slate-600">
              <li>Tekan tombol Hubungkan Telegram di bawah.</li>
              <li>
                Buka bot {botUsername ? <span className="font-semibold">@{botUsername}</span> : 'SIPANTAU CIREBON'} di Telegram, lalu tekan Start.
              </li>
              <li>Kirim kode penghubung yang muncul ke chat bot.</li>
              <li>Status akan berubah menjadi Terhubung secara otomatis.</li>
            </ol>

            <button
              type="button"
              onClick={handleConnect}
              disabled={telegramLoading}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {telegramLoading ? <Loader2 size={16} className="animate-spin" /> : <Link2 size={16} />}
              Hubungkan Telegram
            </button>

            {linkCode && (
              <div className="space-y-3 rounded-xl border border-blue-100 bg-blue-50/70 p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm font-semibold text-slate-800">
                    {isExpired ? 'Kode kedaluwarsa' : 'Kode penghubung Anda'}
                  </p>
                  <p className="text-xs font-semibold text-blue-700">
                    {isExpired
                      ? 'Silakan buat kode baru'
                      : 'Berlaku ' + remainingMinutes + ':' + String(remainingSeconds).padStart(2, '0')}
                  </p>
                </div>

                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <code className="flex-1 break-all rounded-lg border border-blue-100 bg-white px-3 py-2 font-mono text-base font-bold tracking-wider text-slate-800">
                    {linkCode.code}
                  </code>
                  <button
                    type="button"
                    onClick={handleCopy}
                    disabled={isExpired}
                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-blue-200 bg-white px-3 py-2 text-xs font-semibold text-blue-700 transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {copied ? <CheckCircle2 size={14} /> : <Copy size={14} />}
                    {copied ? 'Tersalin' : 'Salin'}
                  </button>
                </div>

                <p className="text-xs text-slate-600">
                  {linkCode.instructions}
                </p>

                <div className="flex flex-col gap-2 sm:flex-row">
                  {deepLink && (
                    <a
                      href={deepLink}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-blue-700"
                    >
                      <ExternalLink size={14} />
                      Buka Bot Telegram
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={handleRefreshStatus}
                    disabled={telegramLoading}
                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {telegramLoading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                    Perbarui Status
                  </button>
                  {isExpired && (
                    <button
                      type="button"
                      onClick={handleConnect}
                      disabled={telegramLoading}
                      className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60"
                    >
                      Buat Kode Baru
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {telegramError && (
          <div className="mt-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            <span>{telegramError}</span>
          </div>
        )}

        {telegramSuccess && (
          <div className="mt-4 flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-700">
            <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
            <span>{telegramSuccess}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProfilePage;
