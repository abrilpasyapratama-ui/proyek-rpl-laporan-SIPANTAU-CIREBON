import React from 'react';
import { Link } from 'react-router-dom';
import {
  MapPin,
  FileText,
  Bell,
  CheckCircle2,
  ArrowRight,
  ShieldCheck,
  Zap,
  BarChart3,
  Phone,
  Mail,
  MapPinned,
} from 'lucide-react';
import Logo from '../../components/Logo';

const LandingPage: React.FC = () => {
  const features = [
    {
      icon: <FileText size={26} className="text-blue-600" />,
      title: 'Pelaporan Mudah',
      desc: 'Laporkan kerusakan fasilitas umum dalam hitungan detik dengan foto dan lokasi GPS otomatis.',
    },
    {
      icon: <Zap size={26} className="text-amber-500" />,
      title: 'Analisis AI',
      desc: 'Sistem AI mengklasifikasikan kategori dan menentukan prioritas penanganan secara otomatis.',
    },
    {
      icon: <MapPin size={26} className="text-blue-600" />,
      title: 'Peta GIS Interaktif',
      desc: 'Pantau sebaran laporan dan kerusakan fasilitas secara real-time melalui peta interaktif.',
    },
    {
      icon: <Bell size={26} className="text-purple-600" />,
      title: 'Notifikasi Real-Time',
      desc: 'Dapatkan pemberitahuan setiap ada pembaruan status laporan Anda.',
    },
    {
      icon: <ShieldCheck size={26} className="text-blue-600" />,
      title: 'Transparan & Terverifikasi',
      desc: 'Setiap laporan diverifikasi oleh admin sebelum ditindaklanjuti oleh petugas lapangan.',
    },
    {
      icon: <BarChart3 size={26} className="text-rose-600" />,
      title: 'Statistik Terbuka',
      desc: 'Dashboard statistik membantu pemerintah memantau kinerja penanganan fasilitas publik.',
    },
  ];

  const steps = [
    { num: '01', title: 'Buat Akun', desc: 'Daftarkan diri Anda sebagai masyarakat Kota/Kabupaten Cirebon.' },
    { num: '02', title: 'Laporkan', desc: 'Isi formulir laporan dengan foto, deskripsi, dan lokasi kerusakan.' },
    { num: '03', title: 'Diverifikasi', desc: 'Admin memverifikasi laporan Anda dan menugaskan petugas.' },
    { num: '04', title: 'Ditangani', desc: 'Petugas memperbaiki fasilitas dan Anda dipantau lewat notifikasi.' },
  ];

  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0" aria-hidden="true">
          <div className="absolute -top-32 -right-24 h-[28rem] w-[28rem] rounded-full bg-blue-200/50 blur-3xl" />
          <div className="absolute top-40 -left-32 h-[24rem] w-[24rem] rounded-full bg-blue-200/40 blur-3xl" />
          <div className="absolute bottom-0 right-1/3 h-72 w-72 rounded-full bg-indigo-200/30 blur-3xl" />
        </div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-1.5 text-xs font-bold text-blue-700 shadow-md shadow-blue-900/5 ring-1 ring-slate-900/5 mb-6">
              <Logo size={18} />
              SIPANTAU CIREBON
            </div>
            <h1 className="text-3xl sm:text-5xl font-extrabold leading-tight tracking-tight text-slate-900">
              Laporkan Fasilitas Umum Rusak,
              <span className="block text-blue-600">Wujudkan Cirebon Lebih Baik</span>
            </h1>
            <p className="mt-5 text-sm sm:text-lg text-slate-600 leading-relaxed max-w-2xl">
              Sistem Pelaporan Fasilitas Umum Rusak Kota/Kabupaten Cirebon dengan AI.
              Sampaikan laporan Anda — jalan rusak, lampu mati, drainase mampet —
              dan petugas kami akan menindaklanjutinya.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row gap-3">
              <Link
                to="/register"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-blue-600/30 hover:bg-blue-700 transition"
              >
                Mulai Melaporkan
                <ArrowRight size={17} />
              </Link>
              <Link
                to="/map"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-6 py-3.5 text-sm font-bold text-blue-700 shadow-md shadow-blue-900/5 ring-1 ring-slate-900/10 hover:bg-blue-50 transition"
              >
                <MapPinned size={17} />
                Lihat Peta Laporan
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Stats strip */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-4">
        <div className="rounded-2xl bg-white shadow-lg shadow-blue-900/5 ring-1 ring-slate-900/5 px-4 sm:px-6 py-8 grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          {[
            { value: 'AI', label: 'Klasifikasi Otomatis' },
            { value: '24/7', label: 'Pelaporan Online' },
            { value: 'GPS', label: 'Lokasi Akurat' },
            { value: '100%', label: 'Transparan' },
          ].map((s) => (
            <div key={s.label}>
              <p className="text-2xl sm:text-3xl font-extrabold text-blue-700">{s.value}</p>
              <p className="mt-1 text-xs sm:text-sm text-slate-500 font-medium">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
            Fitur Unggulan Sistem
          </h2>
          <p className="mt-3 text-sm sm:text-base text-slate-500">
            Dirancang untuk memudahkan masyarakat melaporkan dan memantau penanganan fasilitas umum.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((f) => (
            <div
              key={f.title}
              className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-md shadow-blue-900/5 hover:shadow-lg hover:border-blue-200 transition"
            >
              <div className="mb-4 inline-flex rounded-xl bg-blue-50 p-3 ring-1 ring-blue-100">
                {f.icon}
              </div>
              <h3 className="text-base font-bold text-slate-900">{f.title}</h3>
              <p className="mt-2 text-sm text-slate-500 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16 sm:pb-20">
        <div className="rounded-3xl bg-white shadow-lg shadow-blue-900/5 ring-1 ring-slate-900/5 px-6 sm:px-10 py-12 sm:py-14">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
              Cara Kerja Pelaporan
            </h2>
            <p className="mt-3 text-sm sm:text-base text-slate-500">
              Empat langkah sederhana dari laporan hingga penanganan.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {steps.map((s) => (
              <div key={s.num} className="relative rounded-2xl bg-gradient-to-b from-blue-50/60 to-white border border-blue-100 p-6">
                <span className="text-4xl font-extrabold text-blue-200">{s.num}</span>
                <h3 className="mt-3 text-base font-bold text-slate-900">{s.title}</h3>
                <p className="mt-2 text-sm text-slate-500 leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16 sm:pb-20">
        <div className="rounded-3xl bg-gradient-to-r from-blue-700 to-indigo-700 px-6 py-12 sm:px-12 text-center text-white shadow-xl shadow-blue-600/25">
          <CheckCircle2 size={40} className="mx-auto mb-4 text-blue-100" />
          <h2 className="text-2xl sm:text-3xl font-extrabold">
            Siap Menjadi Bagian dari Perubahan?
          </h2>
          <p className="mt-3 text-sm sm:text-base text-blue-50 max-w-xl mx-auto">
            Daftar sekarang dan laporkan kerusakan fasilitas umum di sekitar Anda.
            Setiap laporan berarti untuk publik.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              to="/register"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-6 py-3.5 text-sm font-bold text-blue-700 shadow-lg hover:bg-blue-50 transition"
            >
              Daftar Sekarang
              <ArrowRight size={17} />
            </Link>
            <Link
              to="/login"
              className="inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3.5 text-sm font-bold text-white ring-2 ring-white/40 hover:bg-white/10 transition"
            >
              Masuk ke Akun
            </Link>
          </div>
        </div>
      </section>

      {/* Contact strip */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { icon: <Phone size={20} className="text-blue-600" />, title: 'Telepon', value: '(0231) 123-456' },
            { icon: <Mail size={20} className="text-blue-600" />, title: 'Email', value: 'pengaduan@cirebonkota.go.id' },
            { icon: <MapPinned size={20} className="text-blue-600" />, title: 'Alamat', value: 'Dinas PU Cirebon, Jl. Cirebon' },
          ].map((c) => (
            <div key={c.title} className="flex items-center gap-4 rounded-2xl border border-slate-200/70 bg-white p-5 shadow-md shadow-blue-900/5">
              <div className="rounded-xl bg-blue-50 p-3 ring-1 ring-blue-100">{c.icon}</div>
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">{c.title}</p>
                <p className="text-sm font-bold text-slate-800">{c.value}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

export default LandingPage;
