import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, MapPin, Calendar, User, Wrench, FileText } from 'lucide-react';
import api from '../../services/api';
import { extractErrorMessage } from '../../utils/apiError';
import { resolveUploadUrl } from '../../utils/uploadUrl';

interface Assignment {
  assigned_at: string;
  petugas: { nama: string };
}

interface ProgressUpdate {
  catatan: string | null;
  status: string;
  foto_bukti: string | null;
  created_at: string;
}

interface ReportDetail {
  id: string;
  judul: string;
  deskripsi: string;
  kategori: string;
  lokasi: string;
  latitude: number | null;
  longitude: number | null;
  foto: string | null;
  status: string;
  ai_kategori: string | null;
  ai_confidence: number | null;
  ai_priority: string | null;
  created_at: string;
  assignments: Assignment[];
  updates: ProgressUpdate[];
}

const statusLabel = (s: string) => s.replace(/_/g, ' ');

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

const STEPS = ['MENUNGGU_VERIFIKASI', 'DIPROSES', 'DALAM_PERBAIKAN', 'SELESAI'];

const ReportDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [report, setReport] = useState<ReportDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      try {
        const res = await api.get<{ status: string; data: ReportDetail }>(`/reports/${id}`);
        setReport(res.data.data);
      } catch (err) {
        console.error('Gagal memuat detail laporan:', extractErrorMessage(err));
        setError('Gagal memuat detail laporan. Laporan mungkin tidak ditemukan atau bukan milik Anda.');
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [id]);

  if (isLoading) {
    return <div className="h-64 rounded-2xl bg-slate-200 animate-pulse" aria-label="Memuat detail laporan" />;
  }

  if (error || !report) {
    return (
      <div className="space-y-4">
        <Link to="/reports/history" className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-600 hover:text-blue-800">
          <ArrowLeft size={15} /> Kembali ke Riwayat
        </Link>
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700" role="alert">{error}</div>
      </div>
    );
  }

  const stepIndex = STEPS.indexOf(report.status);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Link to="/reports/history" className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-600 hover:text-blue-800">
        <ArrowLeft size={15} /> Kembali ke Riwayat
      </Link>

      {/* Header */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{report.kategori}</p>
            <h1 className="mt-1 text-xl font-extrabold text-slate-900">{report.judul}</h1>
            <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
              <span className="inline-flex items-center gap-1"><Calendar size={13} /> {new Date(report.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
              <span className="inline-flex items-center gap-1"><MapPin size={13} /> {report.lokasi}</span>
            </p>
          </div>
          <span className={`rounded-full px-3 py-1.5 text-xs font-bold ${statusColor(report.status)}`}>
            {statusLabel(report.status)}
          </span>
        </div>

        {/* Progress steps */}
        {stepIndex >= 0 && (
          <ol className="mt-6 grid grid-cols-4 gap-1" aria-label="Tahapan penanganan">
            {STEPS.map((step, i) => (
              <li key={step}>
                <div className={`h-1.5 rounded-full ${i <= stepIndex ? 'bg-blue-600' : 'bg-slate-200'}`} />
                <p className={`mt-1.5 text-[10px] font-semibold ${i <= stepIndex ? 'text-blue-700' : 'text-slate-400'}`}>
                  {statusLabel(step)}
                </p>
              </li>
            ))}
          </ol>
        )}

        <p className="mt-5 text-sm leading-relaxed text-slate-700 whitespace-pre-wrap">{report.deskripsi}</p>

        {report.foto && (
          <img src={resolveUploadUrl(report.foto) || ''} alt={report.judul} className="mt-4 max-h-96 w-full rounded-xl border border-slate-200 object-cover" />
        )}

        {report.assignments.length > 0 && (
          <div className="mt-4 flex items-center gap-2 text-xs text-slate-500">
            <User size={13} />
            Ditangani oleh {report.assignments.map((a) => a.petugas.nama).join(', ')}
          </div>
        )}
      </div>

      {/* Riwayat progres */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="flex items-center gap-2 text-sm font-bold text-slate-800">
          <Wrench size={16} className="text-blue-600" /> Riwayat Penanganan
        </h2>
        {report.updates.length === 0 ? (
          <div className="mt-4 flex items-start gap-2.5 rounded-xl bg-slate-50 p-4 text-sm text-slate-500">
            <FileText size={16} className="mt-0.5 shrink-0 text-slate-400" />
            Belum ada pembaruan progres. Laporan Anda menunggu verifikasi admin.
          </div>
        ) : (
          <ol className="mt-4 space-y-4">
            {report.updates.map((u, i) => (
              <li key={`${u.created_at}-${i}`} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <span className="h-3 w-3 rounded-full bg-blue-600" />
                  {i < report.updates.length - 1 && <span className="w-0.5 flex-1 bg-slate-200" />}
                </div>
                <div className="pb-2">
                  <p className="text-xs font-bold text-slate-800">{statusLabel(u.status)}</p>
                  {u.catatan && <p className="mt-0.5 text-sm text-slate-600">{u.catatan}</p>}
                  <p className="mt-1 text-[11px] text-slate-400">
                    {new Date(u.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </p>
                  {u.foto_bukti && (
                    <img src={resolveUploadUrl(u.foto_bukti) || ''} alt="Bukti penanganan" className="mt-2 h-32 rounded-lg border border-slate-200 object-cover" />
                  )}
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
};

export default ReportDetailPage;
