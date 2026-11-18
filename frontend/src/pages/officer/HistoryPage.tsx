import React, { useEffect, useState } from 'react';
import { History, MapPin, CheckCircle2 } from 'lucide-react';
import api from '../../services/api';

interface HistoryItem {
  id: string;
  catatan: string | null;
  status: string;
  created_at: string;
  report: {
    id: string;
    judul: string;
    kategori: string;
    status: string;
    lokasi: string;
    foto: string | null;
  };
}

const statusLabel = (s: string) => s.replace(/_/g, ' ');

const statusColor = (s: string) => {
  switch (s) {
    case 'DALAM_PERBAIKAN': return 'bg-purple-100 text-purple-800';
    case 'SELESAI': return 'bg-green-100 text-green-800';
    default: return 'bg-slate-100 text-slate-700';
  }
};

const HistoryPage: React.FC = () => {
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      try {
        const res = await api.get('/petugas/history');
        setItems(res.data.data || []);
      } catch (err) {
        setError('Gagal memuat riwayat penanganan');
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
          <div key={i} className="h-28 rounded-2xl bg-slate-200 animate-pulse" />
        ))}
      </div>
    );
  }

  if (error) {
    return <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>;
  }

  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-sm">
        <History size={36} className="mx-auto text-slate-300 mb-3" />
        <p className="text-sm font-semibold text-slate-600">Belum ada riwayat penanganan</p>
        <p className="text-xs text-slate-400 mt-1">Riwayat update progres Anda akan muncul di sini.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-extrabold text-slate-900">Riwayat Penanganan</h2>
        <p className="text-sm text-slate-500">{items.length} update progres</p>
      </div>

      <div className="space-y-3">
        {items.map((item) => (
          <div key={item.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md transition">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-slate-800">{item.report.judul}</h3>
                <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
                  <MapPin size={12} /> {item.report.lokasi}
                </p>
              </div>
              <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${statusColor(item.status)}`}>
                {statusLabel(item.status)}
              </span>
            </div>
            {item.catatan && (
              <p className="mt-3 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600 border border-slate-100">
                {item.catatan}
              </p>
            )}
            <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
              <span>
                {new Date(item.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
              </span>
              <span className="flex items-center gap-1">
                <CheckCircle2 size={13} className="text-emerald-500" />
                Status laporan saat ini: {statusLabel(item.report.status)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default HistoryPage;
