import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ClipboardList, MapPin, Clock } from 'lucide-react';
import api from '../../services/api';

interface Task {
  id: string;
  assigned_at: string;
  report: {
    id: string;
    judul: string;
    kategori: string;
    status: string;
    lokasi: string;
    foto: string | null;
    ai_priority: string | null;
    created_at: string;
  };
}

const statusLabel = (s: string) => s.replace(/_/g, ' ');

const statusColor = (s: string) => {
  switch (s) {
    case 'DIPROSES': return 'bg-blue-100 text-blue-800';
    case 'DALAM_PERBAIKAN': return 'bg-purple-100 text-purple-800';
    case 'SELESAI': return 'bg-green-100 text-green-800';
    default: return 'bg-slate-100 text-slate-700';
  }
};

const priorityColor = (p: string | null) => {
  switch (p) {
    case 'Darurat': return 'bg-red-100 text-red-700';
    case 'Tinggi': return 'bg-orange-100 text-orange-700';
    case 'Sedang': return 'bg-yellow-100 text-yellow-700';
    default: return 'bg-slate-100 text-slate-600';
  }
};

const TasksPage: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      try {
        const res = await api.get('/petugas/tasks');
        setTasks(res.data.data || []);
      } catch (err) {
        setError('Gagal memuat tugas');
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, []);

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-32 rounded-2xl bg-slate-200 animate-pulse" />
        ))}
      </div>
    );
  }

  if (error) {
    return <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>;
  }

  if (tasks.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-sm">
        <ClipboardList size={36} className="mx-auto text-slate-300 mb-3" />
        <p className="text-sm font-semibold text-slate-600">Belum ada tugas ditugaskan</p>
        <p className="text-xs text-slate-400 mt-1">Tugas baru akan muncul di sini setelah admin menugaskan Anda.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-extrabold text-slate-900">Tugas Saya</h2>
        <p className="text-sm text-slate-500">{tasks.length} tugas aktif</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {tasks.map((t) => (
          <div key={t.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md transition">
            <div className="flex items-start justify-between gap-3 mb-3">
              <h3 className="text-sm font-bold text-slate-800 leading-snug">{t.report.judul}</h3>
              {t.report.ai_priority && (
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${priorityColor(t.report.ai_priority)}`}>
                  {t.report.ai_priority}
                </span>
              )}
            </div>
            <div className="space-y-1.5 text-xs text-slate-500 mb-4">
              <p className="flex items-center gap-1.5">
                <MapPin size={13} className="text-slate-400" />
                {t.report.lokasi}
              </p>
              <p className="flex items-center gap-1.5">
                <Clock size={13} className="text-slate-400" />
                Ditugaskan {new Date(t.assigned_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
              </p>
            </div>
            <div className="flex items-center justify-between">
              <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${statusColor(t.report.status)}`}>
                {statusLabel(t.report.status)}
              </span>
              <Link
                to={`/officer/tasks/${t.report.id}`}
                className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700 transition"
              >
                Detail & Update
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TasksPage;
