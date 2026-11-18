import React, { useState, useEffect } from 'react';
import { Search, Filter, Eye } from 'lucide-react';
import api from '../../services/api';
import ReportDetailModal from './ReportDetailModal';

interface ReportRow {
  id: string;
  created_at: string;
  judul: string;
  kategori: string;
  status: string;
  ai_priority: string | null;
  user: { nama: string };
}

interface PaginationMeta {
  page: number;
  limit: number;
  totalPages: number;
  total?: number;
}

interface ReportManagementProps {
  /** Status awal filter — dipakai route /admin/reports/verification */
  initialStatus?: string;
  /** Judul halaman — default "Manajemen Laporan" */
  title?: string;
}

const ReportManagement: React.FC<ReportManagementProps> = ({ initialStatus = 'ALL', title = 'Manajemen Laporan' }) => {
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [meta, setMeta] = useState<PaginationMeta>({ page: 1, limit: 10, totalPages: 1 });
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(initialStatus);
  const [kategoriFilter, setKategoriFilter] = useState('');
  const [lokasiFilter, setLokasiFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);

  const fetchReports = async () => {
    setIsLoading(true);
    try {
      const res = await api.get('/admin/reports', {
        params: {
          page: meta.page,
          limit: meta.limit,
          q: search || undefined,
          status: statusFilter,
          kategori: kategoriFilter || undefined,
          lokasi: lokasiFilter || undefined,
          from: fromDate || undefined,
          to: toDate || undefined,
        }
      });
      setReports(res.data.data);
      setMeta(res.data.meta);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  // Debounce search effect implicitly by tying to form submit or explicit filter button
  useEffect(() => {
    fetchReports();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meta.page, statusFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (meta.page !== 1) setMeta({ ...meta, page: 1 }); // reset to page 1 on search
    else fetchReports();
  };

  const handleResetFilter = () => {
    setSearch('');
    setStatusFilter(initialStatus);
    setKategoriFilter('');
    setLokasiFilter('');
    setFromDate('');
    setToDate('');
    setMeta((m) => ({ ...m, page: 1 }));
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'MENUNGGU_VERIFIKASI': return 'bg-yellow-100 text-yellow-800';
      case 'DIPROSES': return 'bg-blue-100 text-blue-800';
      case 'DALAM_PERBAIKAN': return 'bg-purple-100 text-purple-800';
      case 'SELESAI': return 'bg-green-100 text-green-800';
      case 'DITOLAK': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-100 flex flex-col h-full min-h-[600px]">
      <div className="p-6 border-b border-gray-100 flex flex-col gap-4">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <h1 className="text-xl font-bold text-gray-800">{title}</h1>

          <form onSubmit={handleSearchSubmit} className="flex gap-2 w-full md:w-auto">
            <div className="relative flex-1 md:w-64">
              <input
                type="text"
                placeholder="Cari laporan..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Cari laporan"
                className="w-full pl-10 pr-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setMeta({ ...meta, page: 1 }); }}
              aria-label="Filter status"
              className="border rounded-md px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            >
              <option value="ALL">Semua Status</option>
              <option value="MENUNGGU_VERIFIKASI">Menunggu</option>
              <option value="DIPROSES">Diproses</option>
              <option value="DALAM_PERBAIKAN">Dalam Perbaikan</option>
              <option value="SELESAI">Selesai</option>
              <option value="DITOLAK">Ditolak</option>
            </select>
            <button type="submit" aria-label="Terapkan pencarian" className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-md"><Filter size={18} /></button>
          </form>
        </div>

        {/* Filter lanjutan: kategori, lokasi, rentang tanggal */}
        <form onSubmit={handleSearchSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
          <input
            type="text"
            placeholder="Kategori (mis. Jalan)"
            value={kategoriFilter}
            onChange={(e) => setKategoriFilter(e.target.value)}
            aria-label="Filter kategori"
            className="px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <input
            type="text"
            placeholder="Lokasi (mis. Siliwangi)"
            value={lokasiFilter}
            onChange={(e) => setLokasiFilter(e.target.value)}
            aria-label="Filter lokasi"
            className="px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <input
            type="date"
            value={fromDate}
            max={toDate || undefined}
            onChange={(e) => setFromDate(e.target.value)}
            aria-label="Dari tanggal"
            className="px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <input
            type="date"
            value={toDate}
            min={fromDate || undefined}
            onChange={(e) => setToDate(e.target.value)}
            aria-label="Sampai tanggal"
            className="px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <div className="flex gap-2">
            <button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-semibold transition">
              Terapkan
            </button>
            <button type="button" onClick={handleResetFilter} className="flex-1 border border-slate-300 hover:bg-slate-50 px-4 py-2 rounded-md text-sm font-semibold text-slate-600 transition">
              Reset
            </button>
          </div>
        </form>
      </div>

      <div className="flex-1 overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200 text-xs uppercase tracking-wider text-gray-500">
              <th className="p-4 font-medium">Tanggal</th>
              <th className="p-4 font-medium">Pelapor</th>
              <th className="p-4 font-medium">Judul</th>
              <th className="p-4 font-medium">Kategori</th>
              <th className="p-4 font-medium">Status</th>
              <th className="p-4 font-medium text-center">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 text-sm">
            {isLoading ? (
              <tr><td colSpan={6} className="p-8 text-center text-gray-500">Memuat data...</td></tr>
            ) : reports.length === 0 ? (
              <tr><td colSpan={6} className="p-8 text-center text-gray-500">Tidak ada laporan ditemukan.</td></tr>
            ) : (
              reports.map((report) => (
                <tr key={report.id} className="hover:bg-gray-50 transition-colors">
                  <td className="p-4 text-gray-600">{new Date(report.created_at).toLocaleDateString('id-ID')}</td>
                  <td className="p-4 font-medium text-gray-800">{report.user.nama}</td>
                  <td className="p-4 text-gray-700 max-w-xs truncate" title={report.judul}>
                    {report.judul}
                    {report.ai_priority && (
                      <span className={`ml-2 px-2 py-0.5 rounded text-[10px] font-bold text-white ${
                        report.ai_priority === 'Darurat' ? 'bg-red-600' :
                        report.ai_priority === 'Tinggi' ? 'bg-orange-500' :
                        report.ai_priority === 'Sedang' ? 'bg-yellow-500' : 'bg-green-500'
                      }`}>
                        {report.ai_priority}
                      </span>
                    )}
                  </td>
                  <td className="p-4"><span className="bg-gray-100 text-gray-600 px-2 py-1 rounded text-xs">{report.kategori}</span></td>
                  <td className="p-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusBadgeColor(report.status)}`}>
                      {report.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="p-4 text-center">
                    <button 
                      onClick={() => setSelectedReportId(report.id)}
                      className="text-blue-600 hover:text-blue-800 hover:bg-blue-50 p-2 rounded transition-colors"
                      title="Lihat Detail"
                    >
                      <Eye size={18} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      <div className="p-4 border-t border-gray-100 flex items-center justify-between bg-gray-50 rounded-b-lg">
        <span className="text-sm text-gray-600">
          Menampilkan Halaman {meta.page} dari {meta.totalPages}
        </span>
        <div className="flex space-x-2">
          <button 
            disabled={meta.page <= 1}
            onClick={() => setMeta({ ...meta, page: meta.page - 1 })}
            className="px-3 py-1 border rounded bg-white text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 text-sm"
          >
            Sebelumnya
          </button>
          <button 
            disabled={meta.page >= meta.totalPages}
            onClick={() => setMeta({ ...meta, page: meta.page + 1 })}
            className="px-3 py-1 border rounded bg-white text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 text-sm"
          >
            Selanjutnya
          </button>
        </div>
      </div>

      {selectedReportId && (
        <ReportDetailModal 
          reportId={selectedReportId} 
          onClose={() => setSelectedReportId(null)} 
          onSuccess={() => { setSelectedReportId(null); fetchReports(); }} 
        />
      )}
    </div>
  );
};

export default ReportManagement;
