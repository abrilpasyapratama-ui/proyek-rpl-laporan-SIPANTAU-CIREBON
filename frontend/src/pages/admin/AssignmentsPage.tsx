import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ClipboardList, Inbox, ChevronLeft, ChevronRight } from 'lucide-react';
import api from '../../services/api';
import { extractErrorMessage } from '../../utils/apiError';

interface AssignmentRow {
  id: string;
  assigned_at: string;
  petugas: { id: string; nama: string; email: string };
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

const STATUSES = ['ALL', 'MENUNGGU_VERIFIKASI', 'DIPROSES', 'DALAM_PERBAIKAN', 'SELESAI', 'DITOLAK'];

const statusColor = (s: string) => {
  switch (s) {
    case 'MENUNGGU_VERIFIKASI': return 'bg-yellow-100 text-yellow-800';
    case 'DIPROSES': return 'bg-blue-100 text-blue-800';
    case 'DALAM_PERBAIKAN': return 'bg-purple-100 text-purple-800';
    case 'SELESAI': return 'bg-green-100 text-green-800';
    case 'DITOLAK': return 'bg-red-100 text-red-800';
    default: return 'bg-slate-100 text-slate-700';
  }
};

const AssignmentsPage: React.FC = () => {
  const [items, setItems] = useState<AssignmentRow[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      setError('');
      try {
        const res = await api.get('/admin/assignments', {
          params: { page, limit: 10, status: statusFilter === 'ALL' ? undefined : statusFilter },
        });
        setItems(res.data.data || []);
        setTotalPages(res.data.meta?.totalPages || 1);
        setTotal(res.data.meta?.total || 0);
      } catch (err) {
        console.error('Gagal memuat penugasan:', extractErrorMessage(err));
        setError('Gagal memuat daftar penugasan. Silakan refresh halaman.');
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [page, statusFilter]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-extrabold text-slate-900">
            <ClipboardList size={22} className="text-blue-600" /> Penugasan Petugas
          </h2>
          <p className="text-sm text-slate-500">{total} penugasan tercatat</p>
        </div>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          aria-label="Filter status laporan"
          className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>{s === 'ALL' ? 'Semua Status' : s.replace(/_/g, ' ')}</option>
          ))}
        </select>
      </div>

      {error && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700" role="alert">{error}</div>}

      {isLoading ? (
        <div className="h-64 rounded-2xl bg-slate-200 animate-pulse" aria-label="Memuat penugasan" />
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center">
          <Inbox size={32} className="mx-auto text-slate-300 mb-2" />
          <p className="text-sm text-slate-500">Belum ada penugasan.</p>
          <Link to="/admin/reports" className="mt-2 inline-block text-sm font-semibold text-blue-600 hover:underline">
            Tugaskan dari daftar laporan
          </Link>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-5 py-3 font-semibold">Laporan</th>
                  <th className="px-5 py-3 font-semibold">Petugas</th>
                  <th className="px-5 py-3 font-semibold">Status</th>
                  <th className="px-5 py-3 font-semibold">Ditugaskan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((a) => (
                  <tr key={a.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3">
                      <p className="font-semibold text-slate-800">{a.report.judul}</p>
                      <p className="text-xs text-slate-400">{a.report.kategori} · {a.report.lokasi}</p>
                    </td>
                    <td className="px-5 py-3 text-slate-600">{a.petugas.nama}</td>
                    <td className="px-5 py-3">
                      <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${statusColor(a.report.status)}`}>
                        {a.report.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-xs text-slate-500">
                      {new Date(a.assigned_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between text-sm">
            <p className="text-xs text-slate-500">Halaman {page} dari {totalPages}</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                aria-label="Halaman sebelumnya"
                className="flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
              >
                <ChevronLeft size={14} /> Sebelumnya
              </button>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                aria-label="Halaman berikutnya"
                className="flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
              >
                Berikutnya <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default AssignmentsPage;
