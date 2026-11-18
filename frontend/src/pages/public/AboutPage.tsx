import React from 'react';
import { Link } from 'react-router-dom';
import { Target, Eye, Cpu, Users, ArrowRight } from 'lucide-react';

const AboutPage: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
      <div className="text-center mb-12">
        <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900">Tentang Sistem</h1>
        <p className="mt-3 text-slate-500 max-w-2xl mx-auto text-sm sm:text-base">
          SIPANTAU CIREBON — Sistem Pelaporan Fasilitas Umum Rusak Kota/Kabupaten Cirebon dengan AI
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-3 inline-flex rounded-xl bg-blue-50 p-3 ring-1 ring-blue-100">
            <Target size={22} className="text-blue-600" />
          </div>
          <h3 className="text-base font-bold text-slate-900">Misi Kami</h3>
          <p className="mt-2 text-sm text-slate-500 leading-relaxed">
            Menghubungkan masyarakat dengan pemerintah daerah dalam penanganan fasilitas umum rusak
            secara cepat, transparan, dan terukur.
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-3 inline-flex rounded-xl bg-blue-50 p-3 ring-1 ring-blue-100">
            <Eye size={22} className="text-blue-600" />
          </div>
          <h3 className="text-base font-bold text-slate-900">Transparansi</h3>
          <p className="mt-2 text-sm text-slate-500 leading-relaxed">
            Setiap laporan dapat dipantau statusnya secara real-time, mulai dari verifikasi,
            penugasan petugas, hingga penyelesaian perbaikan.
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-3 inline-flex rounded-xl bg-amber-50 p-3 ring-1 ring-amber-100">
            <Cpu size={22} className="text-amber-600" />
          </div>
          <h3 className="text-base font-bold text-slate-900">Teknologi AI</h3>
          <p className="mt-2 text-sm text-slate-500 leading-relaxed">
            Kecerdasan buatan mengklasifikasikan kategori laporan dan menentukan tingkat prioritas
            penanganan agar sumber daya digunakan secara efisien.
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-3 inline-flex rounded-xl bg-purple-50 p-3 ring-1 ring-purple-100">
            <Users size={22} className="text-purple-600" />
          </div>
          <h3 className="text-base font-bold text-slate-900">Partisipasi Publik</h3>
          <p className="mt-2 text-sm text-slate-500 leading-relaxed">
            Masyarakat berperan aktif sebagai pengawas fasilitas publik. Setiap laporan
            berkontribusi pada perbaikan lingkungan bersama.
          </p>
        </div>
      </div>

      <div className="rounded-2xl bg-slate-50 border border-slate-200 p-6 sm:p-8">
        <h2 className="text-lg font-bold text-slate-900 mb-4">Alur Penanganan Laporan</h2>
        <ol className="space-y-3 text-sm text-slate-600">
          {[
            'Masyarakat melaporkan kerusakan melalui formulir online dengan foto dan lokasi GPS.',
            'Sistem AI menganalisis kategori dan prioritas laporan secara otomatis.',
            'Admin memverifikasi laporan dan menugaskan petugas lapangan yang kompeten.',
            'Petugas menangani perbaikan dan memperbarui progres secara berkala.',
            'Laporan ditandai selesai dan masyarakat menerima notifikasi penyelesaian.',
          ].map((step, i) => (
            <li key={i} className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
                {i + 1}
              </span>
              <span className="leading-relaxed">{step}</span>
            </li>
          ))}
        </ol>
        <div className="mt-6 text-center">
          <Link
            to="/register"
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-blue-600/25 hover:bg-blue-700 transition"
          >
            Daftar & Mulai Melaporkan
            <ArrowRight size={16} />
          </Link>
        </div>
      </div>
    </div>
  );
};

export default AboutPage;
