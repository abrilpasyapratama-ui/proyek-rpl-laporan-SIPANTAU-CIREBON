import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FileText, Clock, RefreshCw, CheckCircle2, ArrowRight, Inbox } from 'lucide-react';
import api from '../../services/api';

interface DashboardStats {
  total: number;
  menunggu: number;
  diproses: number;
  selesai: number;
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

interface RecentReport {
  id: string;
  judul: string;
  kategori: string;
  status: string;
  created_at: string;
  user?: { nama: string };
}

const StatisticsPage: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [reports, setReports] = useState<RecentReport[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      try {
        const [statsRes, reportsRes] = await Promise.all([
          api.get('/admin/stats'),
          api.get('/admin/reports', { params: { limit: 100 } }),
        ]);
        setStats(statsRes.data.data);
        setReports(reportsRes.data.data || []);
      } catch (err) {
        setError('Gagal memuat statistik');
      } finally {
        setIsLoading(false);
      }
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

  if (error) {
    return <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>;
  }

  const statCards = [
    { title: 'Total Laporan', value: stats?.total ?? 0, icon: <FileText size={22} />, color: 'bg-blue-500' },
    { title: 'Menunggu Verifikasi', value: stats?.menunggu ?? 0, icon: <Clock size={22} />, color: 'bg-yellow-500' },
    { title: 'Dalam Proses', value: stats?.diproses ?? 0, icon: <RefreshCw size={22} />, color: 'bg-purple-500' },
    { title: 'Selesai', value: stats?.selesai ?? 0, icon: <CheckCircle2 size={22} />, color: 'bg-emerald-500' },
  ];

  const maxVal = Math.max(stats?.total ?? 1, 1);
  const chartBars = [
    { label: 'Menunggu Verifikasi', value: stats?.menunggu ?? 0, color: 'bg-yellow-500' },
    { label: 'Dalam Proses', value: stats?.diproses ?? 0, color: 'bg-purple-500' },
    { label: 'Selesai', value: stats?.selesai ?? 0, color: 'bg-emerald-500' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-extrabold text-slate-900">Statistik Laporan</h2>
        <p className="text-sm text-slate-500">Data agregat seluruh laporan fasilitas umum</p>
      </div>

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

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-bold text-slate-800 mb-4">Distribusi Status</h3>
        <div className="space-y-3">
          {chartBars.map((bar) => (
            <div key={bar.label}>
              <div className="flex justify-between text-xs font-semibold text-slate-500 mb-1">
                <span>{bar.label}</span>
                <span>{bar.value} ({maxVal > 0 ? Math.round((bar.value / maxVal) * 100) : 0}%)</span>
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

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h3 className="text-sm font-bold text-slate-800">Laporan Terbaru</h3>
          <Link to="/admin/reports" className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800">
            Kelola Laporan <ArrowRight size={13} />
          </Link>
        </div>
        {reports.length === 0 ? (
          <div className="p-10 text-center">
            <Inbox size={32} className="mx-auto text-slate-300 mb-2" />
            <p className="text-sm text-slate-500">Belum ada laporan.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs font-bold text-slate-500 uppercase tracking-wide">
                  <th className="px-5 py-3">Judul</th>
                  <th className="px-5 py-3">Kategori</th>
                  <th className="px-5 py-3">Pelapor</th>
                  <th className="px-5 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {reports.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50 transition">
                    <td className="px-5 py-3 font-semibold text-slate-800 max-w-[200px] truncate">{r.judul}</td>
                    <td className="px-5 py-3 text-slate-500">{r.kategori}</td>
                    <td className="px-5 py-3 text-slate-500">{r.user?.nama || 'Anonim'}</td>
                    <td className="px-5 py-3">
                      <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${statusColor(r.status)}`}>
                        {statusLabel(r.status)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default StatisticsPage;
