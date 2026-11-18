import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ClipboardList,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Clock,
  Inbox,
} from 'lucide-react';
import api from '../../services/api';
import { extractErrorMessage } from '../../utils/apiError';

interface TaskStats {
  aktif: number;
  selesai: number;
  prioritasTinggi: number;
}

interface Task {
  id: string;
  assigned_at: string;
  report: {
    id: string;
    judul: string;
    kategori: string;
    status: string;
    lokasi: string;
    ai_priority: string | null;
    created_at: string;
  };
}

const priorityColor = (p: string | null) => {
  switch (p) {
    case 'Darurat': return 'bg-red-100 text-red-700';
    case 'Tinggi': return 'bg-orange-100 text-orange-700';
    case 'Sedang': return 'bg-yellow-100 text-yellow-700';
    default: return 'bg-slate-100 text-slate-600';
  }
};

const DashboardOfficer: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      try {
        const res = await api.get('/petugas/tasks', { params: { limit: 50 } });
        setTasks(res.data.data || []);
      } catch (err) {
        console.error('Gagal memuat tugas:', extractErrorMessage(err));
        setError('Gagal memuat tugas. Silakan refresh halaman.');
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, []);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-28 rounded-2xl bg-slate-200 animate-pulse" />
        ))}
      </div>
    );
  }

  if (error) {
    return <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>;
  }

  const stats: TaskStats = {
    aktif: tasks.filter((t) => t.report.status !== 'SELESAI').length,
    selesai: tasks.filter((t) => t.report.status === 'SELESAI').length,
    prioritasTinggi: tasks.filter((t) => t.report.ai_priority === 'Darurat' || t.report.ai_priority === 'Tinggi').length,
  };

  const today = new Date().toDateString();
  const todayTasks = tasks.filter(
    (t) => new Date(t.assigned_at).toDateString() === today
  );

  const statCards = [
    { title: 'Tugas Aktif', value: stats.aktif, icon: <ClipboardList size={22} />, color: 'bg-blue-500' },
    { title: 'Tugas Selesai', value: stats.selesai, icon: <CheckCircle2 size={22} />, color: 'bg-emerald-500' },
    { title: 'Prioritas Tinggi', value: stats.prioritasTinggi, icon: <AlertTriangle size={22} />, color: 'bg-red-500' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900">Dashboard Petugas</h2>
          <p className="text-sm text-slate-500">Kelola tugas perbaikan yang ditugaskan kepada Anda</p>
        </div>
        <Link
          to="/officer/tasks"
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white shadow hover:bg-blue-700 transition shrink-0"
        >
          Lihat Semua Tugas
          <ArrowRight size={16} />
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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

      {/* Tugas hari ini */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-4">
          <Clock size={16} className="text-blue-600" />
          <h3 className="text-sm font-bold text-slate-800">Tugas Hari Ini</h3>
        </div>
        {todayTasks.length === 0 ? (
          <div className="p-10 text-center">
            <Inbox size={32} className="mx-auto text-slate-300 mb-2" />
            <p className="text-sm text-slate-500">Tidak ada tugas baru hari ini.</p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {todayTasks.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-3 px-5 py-3.5 hover:bg-slate-50 transition">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-800 truncate">{t.report.judul}</p>
                  <p className="text-xs text-slate-400 truncate">{t.report.lokasi}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {t.report.ai_priority && (
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${priorityColor(t.report.ai_priority)}`}>
                      {t.report.ai_priority}
                    </span>
                  )}
                  <Link
                    to="/officer/tasks"
                    className="rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700 hover:bg-blue-100 transition"
                  >
                    Kerjakan
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Tugas prioritas tinggi */}
      {stats.prioritasTinggi > 0 && (
        <div className="rounded-2xl border border-red-200 bg-red-50/50 p-5">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={16} className="text-red-600" />
            <h3 className="text-sm font-bold text-red-800">Perlu Perhatian ({stats.prioritasTinggi})</h3>
          </div>
          <ul className="space-y-2">
            {tasks
              .filter((t) => t.report.ai_priority === 'Darurat' || t.report.ai_priority === 'Tinggi')
              .slice(0, 5)
              .map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-3 rounded-xl bg-white border border-red-100 px-4 py-2.5">
                  <p className="text-sm font-semibold text-slate-800 truncate">{t.report.judul}</p>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${priorityColor(t.report.ai_priority)}`}>
                    {t.report.ai_priority}
                  </span>
                </li>
              ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default DashboardOfficer;
