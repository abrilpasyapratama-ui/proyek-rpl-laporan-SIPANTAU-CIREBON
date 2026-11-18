import React, { useEffect, useState } from 'react';
import api from '../../services/api';
import { extractErrorMessage } from '../../utils/apiError';
import { resolveUploadUrl } from '../../utils/uploadUrl';

interface Petugas {
  id: string;
  nama: string;
}

interface Assignment {
  id: string;
  assigned_at: string;
  petugas: { nama: string };
}

interface ReportDetail {
  id: string;
  judul: string;
  deskripsi: string;
  kategori: string;
  lokasi: string;
  latitude: number | null;
  longitude: number | null;
  foto: string | null;
  status: string;
  ai_kategori: string | null;
  ai_confidence: number | null;
  ai_priority: string | null;
  user: { nama: string; email: string };
  assignments: Assignment[];
}

interface ReportDetailModalProps {
  reportId: string;
  onClose: () => void;
  onSuccess: () => void; // Trigger refresh on parent
}

const ReportDetailModal: React.FC<ReportDetailModalProps> = ({ reportId, onClose, onSuccess }) => {
  const [report, setReport] = useState<ReportDetail | null>(null);
  const [petugasList, setPetugasList] = useState<Petugas[]>([]);
  const [selectedPetugas, setSelectedPetugas] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [reportRes, petugasRes] = await Promise.all([
          api.get(`/admin/reports/${reportId}`),
          api.get(`/admin/petugas`)
        ]);
        setReport(reportRes.data.data);
        setPetugasList(petugasRes.data.data);
      } catch (err) {
        setError('Gagal memuat detail laporan');
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [reportId]);

  const handleVerify = async (action: 'APPROVE' | 'REJECT') => {
    if (action === 'REJECT' && rejectReason.trim().length < 3) {
      setError('Alasan penolakan wajib diisi (minimal 3 karakter)');
      return;
    }
    setIsSubmitting(true);
    try {
      await api.put(`/admin/reports/${reportId}/verify`, {
        action,
        ...(action === 'REJECT' ? { reason: rejectReason.trim() } : {}),
      });
      onSuccess();
    } catch (err) {
      setError(extractErrorMessage(err) || 'Gagal memverifikasi');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAssign = async () => {
    if (!selectedPetugas) return;
    setIsSubmitting(true);
    try {
      await api.post(`/admin/reports/${reportId}/assign`, { petugas_id: selectedPetugas });
      onSuccess();
    } catch (err) {
      setError(extractErrorMessage(err) || 'Gagal menugaskan petugas');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) return <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"><div className="bg-white p-6 rounded-lg">Memuat...</div></div>;
  if (!report) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center p-6 border-b">
          <h2 className="text-xl font-bold">Detail Laporan</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-2xl font-bold">&times;</button>
        </div>
        
        <div className="p-6">
          {error && <div className="mb-4 p-3 bg-red-100 text-red-700 rounded">{error}</div>}
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-lg font-semibold mb-2">{report.judul}</h3>
              <p className="text-sm text-gray-500 mb-4">Kategori: {report.kategori} | Status: <span className="font-bold">{report.status.replace('_', ' ')}</span></p>
              
              <div className="mb-4">
                <p className="text-sm font-semibold text-gray-700">Pelapor:</p>
                <p className="text-sm">{report.user.nama} ({report.user.email})</p>
              </div>

              <div className="mb-4">
                <p className="text-sm font-semibold text-gray-700">Deskripsi:</p>
                <p className="text-sm whitespace-pre-wrap">{report.deskripsi}</p>
              </div>

              <div className="mb-4">
                <p className="text-sm font-semibold text-gray-700">Lokasi:</p>
                <p className="text-sm">{report.lokasi}</p>
                <p className="text-xs text-gray-500">Lat: {report.latitude}, Lng: {report.longitude}</p>
              </div>
            </div>

            <div>
              {report.foto ? (
                <img src={resolveUploadUrl(report.foto) || ''} alt="Bukti Laporan" className="w-full h-64 object-cover rounded-md border" />
              ) : (
                <div className="w-full h-64 bg-gray-100 rounded-md flex items-center justify-center text-gray-400 border">Tidak ada foto</div>
              )}

              {/* AI Analysis Panel */}
              {report.ai_priority && (
                <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4 shadow-sm">
                  <div className="flex items-center mb-2">
                    <span className="text-xl mr-2">🤖</span>
                    <h4 className="font-bold text-blue-900">Analisis AI</h4>
                  </div>
                  <div className="space-y-2 text-sm text-blue-800">
                    <p><span className="font-semibold">Kategori Prediksi:</span> {report.ai_kategori}</p>
                    <p className="flex items-center">
                      <span className="font-semibold mr-2">Prioritas:</span>
                      <span className={`px-2 py-1 rounded text-xs font-bold text-white ${
                        report.ai_priority === 'Darurat' ? 'bg-red-600' :
                        report.ai_priority === 'Tinggi' ? 'bg-orange-500' :
                        report.ai_priority === 'Sedang' ? 'bg-yellow-500' : 'bg-green-500'
                      }`}>
                        {report.ai_priority}
                      </span>
                    </p>
                    <div className="mt-2">
                      <div className="flex justify-between text-xs mb-1">
                        <span>Confidence Score</span>
                        <span>{Math.round((report.ai_confidence ?? 0) * 100)}%</span>
                      </div>
                      <div className="w-full bg-blue-200 rounded-full h-2">
                        <div className="bg-blue-600 h-2 rounded-full" style={{ width: `${(report.ai_confidence ?? 0) * 100}%` }}></div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <hr className="my-6" />

          {/* Action Area */}
          <div className="bg-gray-50 p-4 rounded-md border">
            <h4 className="font-semibold mb-3">Tindakan Admin</h4>
            
            {report.status === 'MENUNGGU_VERIFIKASI' && (
              <div className="mb-4 space-y-3">
                <div className="flex space-x-3">
                  <button onClick={() => handleVerify('APPROVE')} disabled={isSubmitting} className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white px-4 py-2 rounded shadow-sm text-sm font-medium">Terima & Proses</button>
                  <button onClick={() => setShowRejectForm((v) => !v)} disabled={isSubmitting} className="bg-red-600 hover:bg-red-700 disabled:bg-red-300 text-white px-4 py-2 rounded shadow-sm text-sm font-medium">Tolak Laporan</button>
                </div>
                {showRejectForm && (
                  <div className="rounded-md border border-red-200 bg-white p-3">
                    <label htmlFor="reject-reason" className="block text-sm font-medium text-gray-700 mb-1">
                      Alasan penolakan <span className="text-red-600">*</span>
                    </label>
                    <textarea
                      id="reject-reason"
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      rows={3}
                      maxLength={1000}
                      placeholder="Jelaskan mengapa laporan ditolak..."
                      className="w-full border-gray-300 rounded-md shadow-sm p-2 border text-sm focus:outline-none focus:ring-2 focus:ring-red-200"
                    />
                    <button onClick={() => handleVerify('REJECT')} disabled={isSubmitting || rejectReason.trim().length < 3} className="mt-2 bg-red-600 hover:bg-red-700 disabled:bg-red-300 text-white px-4 py-2 rounded shadow-sm text-sm font-medium">
                      Konfirmasi Penolakan
                    </button>
                  </div>
                )}
              </div>
            )}

            {['DIPROSES', 'DALAM_PERBAIKAN'].includes(report.status) && (
              <div className="flex items-end space-x-3">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tugaskan ke Petugas</label>
                  <select value={selectedPetugas} onChange={(e) => setSelectedPetugas(e.target.value)} className="w-full border-gray-300 rounded-md shadow-sm p-2 border">
                    <option value="">-- Pilih Petugas --</option>
                    {petugasList.map(p => (
                      <option key={p.id} value={p.id}>{p.nama}</option>
                    ))}
                  </select>
                </div>
                <button onClick={handleAssign} disabled={isSubmitting || !selectedPetugas} className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white px-4 py-2 rounded shadow-sm text-sm font-medium">
                  Assign
                </button>
              </div>
            )}
            
            {/* Display Assignments */}
            {report.assignments && report.assignments.length > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <p className="text-sm font-semibold text-gray-700 mb-2">Petugas yang Ditugaskan:</p>
                <ul className="list-disc pl-5 text-sm text-gray-600">
                  {report.assignments.map((a) => (
                    <li key={a.id}>{a.petugas.nama} (Diberikan pada: {new Date(a.assigned_at).toLocaleDateString()})</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
};

export default ReportDetailModal;
