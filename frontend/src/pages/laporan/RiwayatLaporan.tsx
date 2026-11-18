import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import NotificationBell from '../../components/notifications/NotificationBell';
import { resolveUploadUrl } from '../../utils/uploadUrl';

interface Report {
  id: string;
  judul: string;
  kategori: string;
  status: string;
  foto: string | null;
  created_at: string;
}

const RiwayatLaporan: React.FC = () => {
  const [reports, setReports] = useState<Report[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const response = await api.get('/reports/history');
        setReports(response.data.data);
      } catch (err) {
        setError('Gagal memuat riwayat laporan');
      } finally {
        setIsLoading(false);
      }
    };

    fetchHistory();
  }, []);

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'MENUNGGU_VERIFIKASI': return 'bg-yellow-100 text-yellow-800';
      case 'DIPROSES': return 'bg-blue-100 text-blue-800';
      case 'DALAM_PERBAIKAN': return 'bg-purple-100 text-purple-800';
      case 'SELESAI': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusLabel = (status: string) => {
    return status.replace('_', ' ');
  };

  return (
    <div className="max-w-6xl mx-auto p-6 mt-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Riwayat Laporan Saya</h1>
          <p className="text-xs text-gray-500 mt-1">Pantau perkembangan status penanganan laporan fasilitas Anda</p>
        </div>
        <div className="flex items-center gap-3 self-end sm:self-auto">
          <NotificationBell centerPath="/notifications" />
          <Link to="/map" className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-3.5 py-2 rounded-xl font-semibold text-xs transition flex items-center gap-1.5 border border-slate-200">
            🗺️ Peta GIS
          </Link>
          <Link to="/reports/create" className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-xs font-semibold shadow-sm transition">
            + Buat Laporan Baru
          </Link>
        </div>
      </div>

      {error && <div className="p-4 bg-red-100 text-red-700 rounded mb-4">{error}</div>}

      {isLoading ? (
        <div className="text-center py-10">Memuat data...</div>
      ) : reports.length === 0 ? (
        <div className="text-center py-10 bg-white rounded-lg shadow-sm border border-gray-200">
          <p className="text-gray-500 mb-4">Anda belum pernah membuat laporan.</p>
          <Link to="/reports/create" className="text-blue-600 hover:underline">Mulai laporkan kerusakan fasilitas sekarang</Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {reports.map((report) => (
            <div key={report.id} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden flex flex-col">
              {report.foto ? (
                <img src={resolveUploadUrl(report.foto) || ''} alt={report.judul} className="w-full h-48 object-cover" />
              ) : (
                <div className="w-full h-48 bg-gray-200 flex items-center justify-center text-gray-400">Tidak ada foto</div>
              )}
              <div className="p-5 flex-1 flex flex-col">
                <div className="flex justify-between items-start mb-2">
                  <span className="text-xs font-semibold text-gray-500 uppercase">{report.kategori}</span>
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${getStatusBadgeColor(report.status)}`}>
                    {getStatusLabel(report.status)}
                  </span>
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-1">{report.judul}</h3>
                <p className="text-sm text-gray-500 mb-4 flex-1">Dilaporkan pada: {new Date(report.created_at).toLocaleDateString('id-ID')}</p>
                
                <Link
                  to={`/reports/${report.id}`}
                  className="block w-full py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 text-center hover:bg-gray-50 transition-colors"
                >
                  Lihat Detail
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default RiwayatLaporan;
