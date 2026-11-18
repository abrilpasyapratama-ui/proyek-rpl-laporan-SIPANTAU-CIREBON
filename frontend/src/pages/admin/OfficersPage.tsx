import React, { useEffect, useState } from 'react';
import { HardHat } from 'lucide-react';
import api from '../../services/api';

interface Officer {
  id: string;
  nama: string;
  email: string;
}

const OfficersPage: React.FC = () => {
  const [officers, setOfficers] = useState<Officer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      try {
        const res = await api.get('/admin/petugas');
        setOfficers(res.data.data || []);
      } catch (err) {
        setError('Gagal memuat daftar petugas');
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-extrabold text-slate-900">Kelola Petugas</h2>
        <p className="text-sm text-slate-500">Daftar petugas lapangan yang terdaftar</p>
      </div>

      {isLoading ? (
        <div className="h-40 rounded-2xl bg-slate-200 animate-pulse" />
      ) : error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
      ) : officers.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-sm">
          <HardHat size={36} className="mx-auto text-slate-300 mb-3" />
          <p className="text-sm text-slate-500">Belum ada petugas terdaftar.</p>
          <p className="text-xs text-slate-400 mt-1">
            Buat akun petugas baru melalui halaman register (atur role petugas oleh admin).
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {officers.map((o) => (
            <div key={o.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center text-lg font-extrabold shrink-0">
                {o.nama.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-slate-800 truncate">{o.nama}</p>
                <p className="text-xs text-slate-500 truncate">{o.email}</p>
                <span className="mt-1 inline-block rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                  Petugas
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default OfficersPage;
