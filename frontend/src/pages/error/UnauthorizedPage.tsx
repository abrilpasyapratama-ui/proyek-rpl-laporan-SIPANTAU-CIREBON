import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldAlert, LogIn } from 'lucide-react';

interface UnauthorizedPageProps {
  reason?: 'forbidden' | 'session';
}

const UnauthorizedPage: React.FC<UnauthorizedPageProps> = ({ reason = 'forbidden' }) => {
  const isSession = reason === 'session';
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-red-50">
          <ShieldAlert size={40} className="text-red-500" />
        </div>
        <h1 className="text-4xl font-extrabold text-slate-900">403</h1>
        <p className="mt-2 text-lg font-bold text-slate-700">
          {isSession ? 'Sesi Anda Telah Berakhir' : 'Akses Ditolak'}
        </p>
        <p className="mt-2 text-sm text-slate-500">
          {isSession
            ? 'Sesi login Anda telah berakhir atau token tidak valid. Silakan masuk kembali.'
            : 'Anda tidak memiliki izin untuk mengakses halaman ini.'}
        </p>
        <Link
          to="/login"
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-sm font-bold text-white shadow hover:bg-blue-700 transition"
        >
          <LogIn size={16} />
          Masuk Kembali
        </Link>
      </div>
    </div>
  );
};

export default UnauthorizedPage;
