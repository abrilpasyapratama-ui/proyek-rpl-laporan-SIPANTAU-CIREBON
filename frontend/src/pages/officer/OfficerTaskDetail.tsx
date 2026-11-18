import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  MapPin,
  Clock,
  CheckCircle2,
  Send,
  Loader2,
  Inbox,
  Camera,
} from 'lucide-react';
import api from '../../services/api';
import { extractErrorMessage } from '../../utils/apiError';
import { resolveUploadUrl } from '../../utils/uploadUrl';

interface TaskDetail {
  id: string;
  judul: string;
  deskripsi: string;
  kategori: string;
  lokasi: string;
  status: string;
  foto: string | null;
  ai_priority: string | null;
  ai_kategori: string | null;
  ai_confidence: number | null;
  created_at: string;
  user: { nama: string };
  updates: {
    id: string;
    catatan: string | null;
    status: string;
    foto_bukti: string | null;
    created_at: string;
    petugas: { nama: string };
  }[];
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

const OfficerTaskDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [task, setTask] = useState<TaskDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const [catatan, setCatatan] = useState('');
  const [status, setStatus] = useState<'DALAM_PERBAIKAN' | 'SELESAI'>('DALAM_PERBAIKAN');
  const [fotoBukti, setFotoBukti] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submitSuccess, setSubmitSuccess] = useState(false);

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      try {
        const res = await api.get(`/petugas/tasks/${id}`);
        setTask(res.data.data);
      } catch (err) {
        setError(extractErrorMessage(err) || 'Gagal memuat detail tugas');
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [id]);

  const handleFotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    if (!file) {
      setFotoBukti(null);
      return;
    }
    const allowed = ['image/jpeg', 'image/png', 'image/jpg'];
    if (!allowed.includes(file.type)) {
      setSubmitError('Foto bukti harus berformat JPG atau PNG.');
      setFotoBukti(null);
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setSubmitError('Ukuran foto bukti maksimal 5MB.');
      setFotoBukti(null);
      return;
    }
    setSubmitError('');
    setFotoBukti(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    setSubmitError('');
    setSubmitSuccess(false);
    try {
      const formData = new FormData();
      formData.append('status', status);
      if (catatan.trim()) formData.append('catatan', catatan.trim());
      if (fotoBukti) formData.append('foto_bukti', fotoBukti);
      await api.post(`/petugas/tasks/${id}/update`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setSubmitSuccess(true);
      setCatatan('');
      setFotoBukti(null);
      // Reload task
      const res = await api.get(`/petugas/tasks/${id}`);
      setTask(res.data.data);
    } catch (err) {
      setSubmitError(extractErrorMessage(err) || 'Gagal memperbarui progres');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return <div className="h-64 rounded-2xl bg-slate-200 animate-pulse" />;
  }

  if (error || !task) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        {error || 'Tugas tidak ditemukan'}
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-6">
      <Link to="/officer/tasks" className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-600 hover:text-blue-800">
        <ArrowLeft size={16} />
        Kembali ke Daftar Tugas
      </Link>

      {/* Info tugas */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between gap-3 mb-4">
          <h2 className="text-lg font-extrabold text-slate-900">{task.judul}</h2>
          <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${statusColor(task.status)}`}>
            {statusLabel(task.status)}
          </span>
        </div>
        <p className="text-sm text-slate-600 leading-relaxed mb-4">{task.deskripsi}</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <p className="flex items-center gap-2 text-slate-500">
            <MapPin size={15} className="text-slate-400" /> {task.lokasi}
          </p>
          <p className="flex items-center gap-2 text-slate-500">
            <Clock size={15} className="text-slate-400" />
            {new Date(task.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
          <p className="text-slate-500">Kategori: <span className="font-semibold text-slate-700">{task.kategori}</span></p>
          <p className="text-slate-500">Pelapor: <span className="font-semibold text-slate-700">{task.user.nama}</span></p>
          {task.ai_priority && (
            <p className="text-slate-500">
              Prioritas AI: <span className="font-bold text-orange-600">{task.ai_priority}</span>
              {task.ai_confidence && <span className="text-xs text-slate-400"> (confidence {(task.ai_confidence * 100).toFixed(0)}%)</span>}
            </p>
          )}
        </div>
        {task.foto && (
          <img src={resolveUploadUrl(task.foto) || ''} alt={task.judul} className="mt-4 rounded-xl border border-slate-200 max-h-64 object-cover" />
        )}
      </div>

      {/* Form update progres */}
      {task.status !== 'SELESAI' && (
        <form onSubmit={handleSubmit} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-slate-800">Update Progres</h3>

          {submitSuccess && (
            <div role="status" className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              <CheckCircle2 size={16} /> Progres berhasil diperbarui.
            </div>
          )}
          {submitError && (
            <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {submitError}
            </div>
          )}

          <div>
            <label htmlFor="catatan" className="mb-1.5 block text-sm font-semibold text-slate-700">Catatan</label>
            <textarea
              id="catatan"
              rows={3}
              value={catatan}
              onChange={(e) => setCatatan(e.target.value)}
              placeholder="Tulis catatan progres perbaikan..."
              className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <div>
            <label htmlFor="status-update" className="mb-1.5 block text-sm font-semibold text-slate-700">Status</label>
            <select
              id="status-update"
              value={status}
              onChange={(e) => setStatus(e.target.value as 'DALAM_PERBAIKAN' | 'SELESAI')}
              className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 bg-white"
            >
              <option value="DALAM_PERBAIKAN">Dalam Perbaikan</option>
              <option value="SELESAI">Selesai</option>
            </select>
          </div>

          <div>
            <label htmlFor="foto-bukti" className="mb-1.5 block text-sm font-semibold text-slate-700">
              Foto Bukti <span className="font-normal text-slate-400">(JPG/PNG, maks 5MB, opsional)</span>
            </label>
            <label
              htmlFor="foto-bukti"
              className="flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-600 hover:bg-slate-100 transition"
            >
              <Camera size={16} className="text-slate-400" />
              {fotoBukti ? fotoBukti.name : 'Pilih foto bukti...'}
            </label>
            <input
              id="foto-bukti"
              type="file"
              accept="image/jpeg,image/png,image/jpg"
              onChange={handleFotoChange}
              className="sr-only"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-sm font-bold text-white shadow hover:bg-blue-700 transition disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            {isSubmitting ? 'Mengirim...' : 'Kirim Update'}
          </button>
        </form>
      )}

      {/* Riwayat update */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-4">
          <h3 className="text-sm font-bold text-slate-800">Riwayat Progres</h3>
        </div>
        {task.updates.length === 0 ? (
          <div className="p-10 text-center">
            <Inbox size={32} className="mx-auto text-slate-300 mb-2" />
            <p className="text-sm text-slate-500">Belum ada progres.</p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {task.updates.map((u) => (
              <li key={u.id} className="px-5 py-4">
                <div className="flex items-center justify-between gap-3 mb-1">
                  <p className="text-xs font-bold text-slate-700">{u.petugas.nama}</p>
                  <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${statusColor(u.status)}`}>
                    {statusLabel(u.status)}
                  </span>
                </div>
                {u.catatan && <p className="text-sm text-slate-600">{u.catatan}</p>}
                {u.foto_bukti && (
                  <img
                    src={resolveUploadUrl(u.foto_bukti) || ''}
                    alt="Bukti penanganan"
                    className="mt-2 h-32 rounded-lg border border-slate-200 object-cover"
                  />
                )}
                <p className="text-xs text-slate-400 mt-1">
                  {new Date(u.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default OfficerTaskDetail;
