import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  FileText,
  Clock,
  RefreshCw,
  Wrench,
  CheckCircle2,
  Plus,
  Bell,
  ArrowRight,
  Inbox,
} from 'lucide-react';
import api from '../../services/api';
import { extractErrorMessage } from '../../utils/apiError';
import { fetchNotifications } from '../../services/notificationService';
import { AppNotification } from '../../types/notification';
import { formatTimeAgo } from '../../utils/notificationUtils';

interface MyStats {
  total: number;
  menunggu: number;
  diproses: number;
  perbaikan: number;
  selesai: number;
}

interface MyReport {
  id: string;
  judul: string;
  kategori: string;
  status: string;
  created_at: string;
}

const statusLabel = (s: string) => s.replace(/_/g, ' ');

const statusColor = (s: string) => {
  switch (s) {
    case 'MENUNGGU_VERIFIKASI': return 'bg-yellow-100 text-yellow-800';
    case 'DIPROSES': return 'bg-blue-100 text-blue-800';
    case 'DALAM_PERBAIKAN': return 'bg-purple-100 text-purple-800';
    case 'SELESAI': return 'bg-green-100 text-green-800';
    default: return 'bg-slate-100 text-slate-700';
  }
};

const DashboardMasyarakat: React.FC = () => {
  const [stats, setStats] = useState<MyStats | null>(null);
  const [reports, setReports] = useState<MyReport[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      const failedSections: string[] = [];

      // Statistik laporan pribadi
      try {
        const res = await api.get<{ status: string; data: MyStats }>('/reports/mystats');
        setStats(res.data.data);
      } catch (err) {
        console.error('Gagal memuat statistik:', extractErrorMessage(err));
        failedSections.push('statistik');
      }

      // Riwayat laporan terbaru
      try {
        const res = await api.get<{ status: string; data: MyReport[] }>('/reports/history', { params: { limit: 5 } });
        setReports(res.data.data || []);
      } catch (err) {
        console.error('Gagal memuat riwayat laporan:', extractErrorMessage(err));
        failedSections.push('riwayat laporan');
      }

      // Notifikasi terbaru
      try {
        const res = await fetchNotifications({ limit: 5 });
        setNotifications(res.data || []);
      } catch (err) {
        console.error('Gagal memuat notifikasi:', extractErrorMessage(err));
        failedSections.push('notifikasi');
      }

      if (failedSections.length > 0) {
        setError(
          `Sebagian data gagal dimuat (${failedSections.join(', ')}). ` +
            'Data lain tetap ditampilkan. Silakan refresh halaman untuk memuat ulang.'
        );
      }
      setIsLoading(false);
    };
    load();
  }, []);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-28 rounded-2xl bg-slate-200 animate-pulse" />
        ))}
      </div>
    );
  }

  const statCards = [
    { title: 'Total Laporan', value: stats?.total ?? 0, icon: <FileText size={22} />, color: 'bg-blue-500', bg: 'bg-blue-50' },
    { title: 'Menunggu Verifikasi', value: stats?.menunggu ?? 0, icon: <Clock size={22} />, color: 'bg-yellow-500', bg: 'bg-yellow-50' },
    { title: 'Diproses', value: stats?.diproses ?? 0, icon: <RefreshCw size={22} />, color: 'bg-indigo-500', bg: 'bg-indigo-50' },
    { title: 'Dalam Perbaikan', value: stats?.perbaikan ?? 0, icon: <Wrench size={22} />, color: 'bg-purple-500', bg: 'bg-purple-50' },
    { title: 'Selesai', value: stats?.selesai ?? 0, icon: <CheckCircle2 size={22} />, color: 'bg-emerald-500', bg: 'bg-emerald-50' },
  ];

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
          {error}
        </div>
      )}
      {/* Welcome + CTA */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white shadow-lg">
        <div>
          <h2 className="text-xl font-extrabold">Selamat datang kembali!</h2>
          <p className="mt-1 text-sm text-blue-100">
            Laporkan kerusakan fasilitas umum di sekitar Anda dan pantau perkembangannya.
          </p>
        </div>
        <Link
          to="/reports/create"
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-bold text-blue-700 shadow hover:bg-blue-50 transition shrink-0"
        >
          <Plus size={17} />
          Buat Laporan
        </Link>
      </div>

      {/* Stat widgets */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {statCards.map((card) => (
          <div key={card.title} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm flex items-center gap-4">
            <div className={`p-3 rounded-xl text-white ${card.color}`}>{card.icon}</div>
            <div>
              <p className="text-xs font-semibold text-slate-500">{card.title}</p>
              <p className="text-2xl font-extrabold text-slate-900">{card.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Laporan terbaru */}
        <div className="lg:col-span-2 rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <h3 className="text-sm font-bold text-slate-800">Laporan Terbaru</h3>
            <Link to="/reports/history" className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800">
              Lihat Semua <ArrowRight size={13} />
            </Link>
          </div>
          {reports.length === 0 ? (
            <div className="p-10 text-center">
              <Inbox size={32} className="mx-auto text-slate-300 mb-2" />
              <p className="text-sm text-slate-500">Belum ada laporan.</p>
              <Link to="/reports/create" className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-blue-600 hover:underline">
                <Plus size={15} /> Buat laporan pertama
              </Link>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {reports.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3 px-5 py-3.5 hover:bg-slate-50 transition">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate">{r.judul}</p>
                    <p className="text-xs text-slate-400">{r.kategori} &middot; {formatTimeAgo(r.created_at)}</p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${statusColor(r.status)}`}>
                    {statusLabel(r.status)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Notifikasi terbaru */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <h3 className="text-sm font-bold text-slate-800">Notifikasi Terbaru</h3>
            <Link to="/notifications" className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800">
              Lihat Semua <ArrowRight size={13} />
            </Link>
          </div>
          {notifications.length === 0 ? (
            <div className="p-10 text-center">
              <Bell size={32} className="mx-auto text-slate-300 mb-2" />
              <p className="text-sm text-slate-500">Belum ada notifikasi.</p>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {notifications.map((n) => (
                <li key={n.id} className="px-5 py-3.5 hover:bg-slate-50 transition">
                  <div className="flex items-start gap-2.5">
                    {!n.is_read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-blue-600" />}
                    <div className="min-w-0">
                      <p className={`text-xs font-bold truncate ${n.is_read ? 'text-slate-600' : 'text-slate-900'}`}>{n.judul}</p>
                      <p className="text-xs text-slate-400 line-clamp-2 mt-0.5">{n.pesan}</p>
                      <p className="text-[10px] text-slate-400 mt-1">{formatTimeAgo(n.created_at)}</p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};

export default DashboardMasyarakat;
