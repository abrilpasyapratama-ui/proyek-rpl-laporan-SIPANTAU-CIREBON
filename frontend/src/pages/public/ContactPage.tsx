import React, { useState } from 'react';
import { Phone, Mail, MapPinned, Clock, Send } from 'lucide-react';

const ContactPage: React.FC = () => {
  const [form, setForm] = useState({ nama: '', email: '', pesan: '' });

  // Tanpa endpoint backend pesan-kontak, form membuka email client
  // menuju alamat pengaduan resmi (fungsional, bukan simulasi).
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const subject = encodeURIComponent(`Pesan SIPANTAU dari ${form.nama}`);
    const body = encodeURIComponent(`${form.pesan}\n\n— ${form.nama} (${form.email})`);
    window.location.href = `mailto:pengaduan@cirebonkota.go.id?subject=${subject}&body=${body}`;
  };

  const contacts = [
    { icon: <Phone size={20} className="text-blue-600" />, title: 'Telepon', value: '(0231) 123-456', desc: 'Senin–Jumat, 08.00–15.00 WIB' },
    { icon: <Mail size={20} className="text-blue-600" />, title: 'Email', value: 'pengaduan@cirebonkota.go.id', desc: 'Balasan dalam 1×24 jam' },
    { icon: <MapPinned size={20} className="text-blue-600" />, title: 'Alamat', value: 'Dinas PU Cirebon', desc: 'Jl. Cirebon, Jawa Barat' },
    { icon: <Clock size={20} className="text-blue-600" />, title: 'Jam Layanan', value: '08.00 – 15.00 WIB', desc: 'Senin s.d. Jumat' },
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
      <div className="text-center mb-12">
        <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900">Hubungi Kami</h1>
        <p className="mt-3 text-slate-500 max-w-xl mx-auto text-sm sm:text-base">
          Punya pertanyaan atau kendala dalam melaporkan fasilitas umum? Hubungi tim kami.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        {contacts.map((c) => (
          <div key={c.title} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm text-center">
            <div className="mx-auto mb-3 inline-flex rounded-xl bg-blue-50 p-3 ring-1 ring-blue-100">{c.icon}</div>
            <h3 className="text-sm font-bold text-slate-900">{c.title}</h3>
            <p className="mt-1 text-sm font-semibold text-blue-700">{c.value}</p>
            <p className="mt-1 text-xs text-slate-400">{c.desc}</p>
          </div>
        ))}
      </div>

      <div className="max-w-2xl mx-auto rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm">
        <h2 className="text-lg font-bold text-slate-900 mb-1">Kirim Pesan</h2>
        <p className="text-sm text-slate-500 mb-6">Isi formulir di bawah untuk membuka email menuju tim pengaduan resmi.</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="kontak-nama" className="mb-1.5 block text-sm font-semibold text-slate-700">Nama</label>
            <input
              id="kontak-nama"
              type="text"
              required
              value={form.nama}
              onChange={(e) => setForm({ ...form, nama: e.target.value })}
              className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
              placeholder="Nama Anda"
            />
          </div>
          <div>
            <label htmlFor="kontak-email" className="mb-1.5 block text-sm font-semibold text-slate-700">Email</label>
            <input
              id="kontak-email"
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
              placeholder="nama@email.com"
            />
          </div>
          <div>
            <label htmlFor="kontak-pesan" className="mb-1.5 block text-sm font-semibold text-slate-700">Pesan</label>
            <textarea
              id="kontak-pesan"
              required
              rows={4}
              value={form.pesan}
              onChange={(e) => setForm({ ...form, pesan: e.target.value })}
              className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
              placeholder="Tulis pesan Anda..."
            />
          </div>
          <button
            type="submit"
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 text-sm font-bold text-white shadow-lg shadow-blue-600/25 hover:bg-blue-700 transition"
          >
            <Send size={16} />
            Kirim Pesan
          </button>
        </form>
      </div>
    </div>
  );
};

export default ContactPage;
