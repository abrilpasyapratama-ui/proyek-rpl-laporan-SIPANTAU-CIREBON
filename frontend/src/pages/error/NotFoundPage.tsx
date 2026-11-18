import React from 'react';
import { Link } from 'react-router-dom';
import { Home, SearchX } from 'lucide-react';

const NotFoundPage: React.FC = () => (
  <div className="flex min-h-[60vh] items-center justify-center px-4">
    <div className="text-center">
      <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-slate-100">
        <SearchX size={40} className="text-slate-400" />
      </div>
      <h1 className="text-5xl font-extrabold text-slate-900">404</h1>
      <p className="mt-2 text-lg font-bold text-slate-700">Halaman Tidak Ditemukan</p>
      <p className="mt-2 text-sm text-slate-500 max-w-sm mx-auto">
        Halaman yang Anda cari tidak ada atau telah dipindahkan.
      </p>
      <Link
        to="/"
        className="mt-6 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-sm font-bold text-white shadow hover:bg-blue-700 transition"
      >
        <Home size={16} />
        Kembali ke Beranda
      </Link>
    </div>
  </div>
);

export default NotFoundPage;
