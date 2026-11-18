import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  FileText,
  Clock,
  RefreshCw,
  CheckCircle2,
  ArrowRight,
  Activity,
  Inbox,
} from 'lucide-react';
import api from '../../services/api';
import { extractErrorMessage } from '../../utils/apiError';

interface DashboardStats {
  total: number;
  menunggu: number;
  diproses: number;
  selesai: number;
}

interface RecentReport {
  id: string;
  judul: string;
  kategori: string;
  status: string;
  created_at: string;
  user?: { nama: string };
}

interface Activity {
  id: string;
  status: string;
  created_at: string;
  petugas: { id: string; nama: string };
  report: { id: string; judul: string; status: string; kategori: string };
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

const DashboardAdmin: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentReports, setRecentReports] = useState<RecentReport[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      const failedSections: string[] = [];

      // Statistik global
      try {
        const res = await api.get<{ status: string; data: DashboardStats }>('/admin/stats');
        setStats(res.data.data);
      } catch (err) {
        console.error('Gagal memuat statistik admin:', extractErrorMessage(err));
        failedSections.push('statistik');
      }

      // Laporan terbaru
      try {
        const res = await api.get<{ status: string; data: RecentReport[] }>('/admin/reports', { params: { limit: 5 } });
        setRecentReports(res.data.data || []);
      } catch (err) {
        console.error('Gagal memuat laporan terbaru:', extractErrorMessage(err));
        failedSections.push('laporan terbaru');
      }

      // Aktivitas petugas
      try {
        const res = await api.get<{ status: string; data: Activity[] }>('/admin/activity');
        setActivities(res.data.data || []);
      } catch (err) {
        console.error('Gagal memuat aktivitas petugas:', extractErrorMessage(err));
        failedSections.push('aktivitas petugas');
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-28 rounded-2xl bg-slate-200 animate-pulse" />
        ))}
      </div>
    );
  }

  const statCards = [
    { title: 'Total Laporan', value: stats?.total ?? 0, icon: <FileText size={22} />, color: 'bg-blue-500' },
    { title: 'Menunggu Verifikasi', value: stats?.menunggu ?? 0, icon: <Clock size={22} />, color: 'bg-yellow-500' },
    { title: 'Dalam Proses', value: stats?.diproses ?? 0, icon: <RefreshCw size={22} />, color: 'bg-purple-500' },
    { title: 'Selesai', value: stats?.selesai ?? 0, icon: <CheckCircle2 size={22} />, color: 'bg-emerald-500' },
  ];

  // Grafik batang sederhana berbasis lebar persentase
  const maxVal = Math.max(stats?.total ?? 1, 1);
  const chartBars = [
    { label: 'Menunggu', value: stats?.menunggu ?? 0, color: 'bg-yellow-500' },
    { label: 'Diproses', value: stats?.diproses ?? 0, color: 'bg-purple-500' },
    { label: 'Selesai', value: stats?.selesai ?? 0, color: 'bg-emerald-500' },
  ];

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
          {error}
        </div>
      )}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900">Ringkasan Statistik</h2>
          <p className="text-sm text-slate-500">Pantau seluruh laporan fasilitas umum</p>
        </div>
        <Link
          to="/admin/reports"
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white shadow hover:bg-blue-700 transition shrink-0"
        >
          Verifikasi Laporan
          <ArrowRight size={16} />
        </Link>
      </div>

      {/* Stat widgets */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
        {/* Grafik + Laporan terbaru */}
        <div className="lg:col-span-2 space-y-6">
          {/* Grafik statistik */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-sm font-bold text-slate-800 mb-4">Grafik Status Laporan</h3>
            <div className="space-y-3">
              {chartBars.map((bar) => (
                <div key={bar.label}>
                  <div className="flex justify-between text-xs font-semibold text-slate-500 mb-1">
                    <span>{bar.label}</span>
                    <span>{bar.value}</span>
                  </div>
                  <div className="h-3 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${bar.color} transition-all duration-500`}
                      style={{ width: `${maxVal > 0 ? (bar.value / maxVal) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Laporan terbaru */}
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <h3 className="text-sm font-bold text-slate-800">Laporan Terbaru</h3>
              <Link to="/admin/reports" className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800">
                Lihat Semua <ArrowRight size={13} />
              </Link>
            </div>
            {recentReports.length === 0 ? (
              <div className="p-10 text-center">
                <Inbox size={32} className="mx-auto text-slate-300 mb-2" />
                <p className="text-sm text-slate-500">Belum ada laporan masuk.</p>
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {recentReports.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-3 px-5 py-3.5 hover:bg-slate-50 transition">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-800 truncate">{r.judul}</p>
                      <p className="text-xs text-slate-400">
                        {r.kategori} &middot; {r.user?.nama || 'Anonim'}
                      </p>
                    </div>
                    <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${statusColor(r.status)}`}>
                      {statusLabel(r.status)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Aktivitas petugas */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-4">
            <Activity size={16} className="text-blue-600" />
            <h3 className="text-sm font-bold text-slate-800">Aktivitas Petugas</h3>
          </div>
          {activities.length === 0 ? (
            <div className="p-10 text-center">
              <p className="text-sm text-slate-500">Belum ada aktivitas petugas.</p>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {activities.map((a) => (
                <li key={a.id} className="px-5 py-3.5">
                  <p className="text-xs text-slate-500">
                    <span className="font-bold text-slate-800">{a.petugas.nama}</span> memperbarui progres
                  </p>
                  <p className="text-xs font-semibold text-slate-700 truncate mt-0.5">{a.report.judul}</p>
                  <div className="flex items-center justify-between mt-1">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${statusColor(a.status)}`}>
                      {statusLabel(a.status)}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {new Date(a.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                    </span>
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

export default DashboardAdmin;
