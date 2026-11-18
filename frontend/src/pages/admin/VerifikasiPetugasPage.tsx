import React, { useEffect, useState } from 'react';
import { ShieldCheck, Inbox, Check, X, Loader2 } from 'lucide-react';
import api from '../../services/api';
import { extractErrorMessage } from '../../utils/apiError';

interface PendingPetugas {
  id: string;
  nama: string;
  email: string;
  no_hp: string | null;
  nip: string | null;
  instansi: string | null;
  wilayah: string | null;
  created_at: string;
}

const VerifikasiPetugasPage: React.FC = () => {
  const [items, setItems] = useState<PendingPetugas[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [processingId, setProcessingId] = useState<string | null>(null);

  const load = async () => {
    setIsLoading(true);
    setError('');
    try {
      const res = await api.get('/admin/verifications', { params: { limit: 50 } });
      setItems(res.data.data || []);
      setTotal(res.data.meta?.total || 0);
    } catch (err) {
      setError(extractErrorMessage(err) || 'Gagal memuat pengajuan petugas.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleVerify = async (id: string, action: 'APPROVE' | 'REJECT') => {
    setProcessingId(id);
    setNotice('');
    setError('');
    try {
      const res = await api.patch(`/admin/verifications/${id}`, { action });
      setItems((prev) => prev.filter((p) => p.id !== id));
      setTotal((t) => Math.max(0, t - 1));
      setNotice(res.data?.message || 'Verifikasi berhasil.');
    } catch (err) {
      setError(extractErrorMessage(err) || 'Gagal memverifikasi pengajuan.');
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="flex items-center gap-2 text-xl font-extrabold text-slate-900">
          <ShieldCheck size={22} className="text-blue-600" /> Verifikasi Petugas
        </h2>
        <p className="text-sm text-slate-500">{total} pengajuan menunggu persetujuan</p>
      </div>

      {notice && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700" role="status">
          {notice}
        </div>
      )}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700" role="alert">
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="h-40 rounded-2xl bg-slate-200 animate-pulse" aria-label="Memuat pengajuan" />
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-sm">
          <Inbox size={36} className="mx-auto text-slate-300 mb-3" />
          <p className="text-sm text-slate-500">Tidak ada pengajuan petugas yang menunggu.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {items.map((p) => (
            <div key={p.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-bold text-slate-900">{p.nama}</p>
                  <p className="text-xs text-slate-500">{p.email}</p>
                </div>
                <span className="shrink-0 rounded-full bg-yellow-100 px-2.5 py-1 text-[11px] font-bold text-yellow-800">
                  Menunggu
                </span>
              </div>
              <dl className="mt-3 space-y-1 text-xs text-slate-600">
                {p.no_hp && <div className="flex gap-2"><dt className="w-20 shrink-0 text-slate-400">No. HP</dt><dd>{p.no_hp}</dd></div>}
                {p.nip && <div className="flex gap-2"><dt className="w-20 shrink-0 text-slate-400">NIP</dt><dd>{p.nip}</dd></div>}
                {p.instansi && <div className="flex gap-2"><dt className="w-20 shrink-0 text-slate-400">Instansi</dt><dd>{p.instansi}</dd></div>}
                {p.wilayah && <div className="flex gap-2"><dt className="w-20 shrink-0 text-slate-400">Wilayah</dt><dd>{p.wilayah}</dd></div>}
                <div className="flex gap-2"><dt className="w-20 shrink-0 text-slate-400">Diajukan</dt><dd>{new Date(p.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</dd></div>
              </dl>
              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={() => handleVerify(p.id, 'APPROVE')}
                  disabled={processingId === p.id}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-emerald-700 transition disabled:opacity-60"
                >
                  {processingId === p.id ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                  Setujui
                </button>
                <button
                  type="button"
                  onClick={() => handleVerify(p.id, 'REJECT')}
                  disabled={processingId === p.id}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-red-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-red-700 transition disabled:opacity-60"
                >
                  {processingId === p.id ? <Loader2 size={14} className="animate-spin" /> : <X size={14} />}
                  Tolak
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default VerifikasiPetugasPage;
