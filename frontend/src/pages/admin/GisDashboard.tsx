import React, { useState, useEffect, useCallback } from 'react';
import GisMap from '../../components/gis/GisMap';
import GisFilterBar from '../../components/gis/GisFilterBar';
import GisReportList from '../../components/gis/GisReportList';
import GisLegend from '../../components/gis/GisLegend';
import ReportDetailModal from './ReportDetailModal';
import { fetchGisReports, fetchGisCategories } from '../../services/gisService';
import { GisReport, GisFilterState, GisSummary, MapBounds } from '../../types/gis';
import { MapPin, RefreshCw, AlertCircle, X } from 'lucide-react';
import { extractErrorMessage } from '../../utils/apiError';
import { resolveUploadUrl } from '../../utils/uploadUrl';

interface GisDashboardProps {
  /** Mode publik: modal detail read-only (tanpa aksi admin). Default false (admin). */
  readonly?: boolean;
}

const statusLabel = (s: string) => s.replace(/_/g, ' ');

export const GisDashboard: React.FC<GisDashboardProps> = ({ readonly = false }) => {
  const [reports, setReports] = useState<GisReport[]>([]);
  const [summary, setSummary] = useState<GisSummary | undefined>(undefined);
  const [categories, setCategories] = useState<{ kategori: string; count: number }[]>([]);
  const [selectedReport, setSelectedReport] = useState<GisReport | null>(null);
  const [detailModalReportId, setDetailModalReportId] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [viewMode, setViewMode] = useState<'split' | 'map-only'>('split');
  const [enableViewportFiltering, setEnableViewportFiltering] = useState<boolean>(false);
  const [currentBounds, setCurrentBounds] = useState<MapBounds | null>(null);

  const [filter, setFilter] = useState<GisFilterState>({
    status: 'ALL',
    kategori: 'ALL',
    priority: 'ALL',
    searchQuery: ''
  });

  // Load Categories on mount
  useEffect(() => {
    const loadCategories = async () => {
      try {
        const catData = await fetchGisCategories();
        setCategories(catData);
      } catch (err) {
        console.error('Failed to load categories:', err);
      }
    };
    loadCategories();
  }, []);

  // Fetch GIS Reports with active filters
  const loadReports = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const boundsToUse = enableViewportFiltering ? currentBounds : null;
      const res = await fetchGisReports(filter, boundsToUse, 2000);
      setReports(res.data || []);
      setSummary(res.summary);
    } catch (err) {
      setError(extractErrorMessage(err) || 'Gagal memuat data GIS laporan fasilitas');
    } finally {
      setIsLoading(false);
    }
  }, [filter, enableViewportFiltering, currentBounds]);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  // Handler update filter
  const handleFilterChange = (newFilter: Partial<GisFilterState>) => {
    setFilter((prev) => ({ ...prev, ...newFilter }));
  };

  // Handler reset filter
  const handleResetFilter = () => {
    setFilter({
      status: 'ALL',
      kategori: 'ALL',
      priority: 'ALL',
      searchQuery: ''
    });
    setCurrentBounds(null);
  };

  // Handler saat batas viewport peta bergeser
  const handleBoundsChange = (bounds: MapBounds) => {
    setCurrentBounds(bounds);
    if (enableViewportFiltering) {
      loadReports();
    }
  };

  return (
    <div className="space-y-4">
      {/* Header Dashboard GIS */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
              <MapPin size={24} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                Dashboard Geospasial (GIS)
              </h1>
              <p className="text-xs text-slate-500">
                Peta sebaran laporan kerusakan fasilitas publik secara real-time & interaktif
              </p>
            </div>
          </div>
        </div>

        {/* Info Banner Ringkas */}
        <div className="flex items-center gap-3 self-start md:self-auto">
          <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 p-2 rounded-xl border border-slate-200 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={enableViewportFiltering}
              onChange={(e) => setEnableViewportFiltering(e.target.checked)}
              className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
            />
            <span>Filter Sesuai Tampilan Peta (BBox)</span>
          </label>

          <button
            onClick={() => loadReports()}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-xl text-xs font-semibold shadow-sm transition"
          >
            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
            <span>Segarkan</span>
          </button>
        </div>
      </div>

      {/* Pesan Error jika terjadi kendala */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs flex items-center gap-2">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* Filter Bar Interaktif: Status, Kategori, Prioritas, & Pencarian */}
      <GisFilterBar
        filter={filter}
        summary={summary}
        categories={categories}
        viewMode={viewMode}
        onFilterChange={handleFilterChange}
        onResetFilter={handleResetFilter}
        onRefresh={loadReports}
        onToggleViewMode={() => setViewMode((prev) => (prev === 'split' ? 'map-only' : 'split'))}
        isLoading={isLoading}
      />

      {/* Konten Utama: Peta GIS & Daftar Laporan */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* Kolom Peta */}
        <div
          className={`transition-all duration-300 relative ${
            viewMode === 'split' ? 'lg:col-span-8 xl:col-span-8' : 'lg:col-span-12'
          } h-[650px]`}
        >
          <GisMap
            reports={reports}
            selectedReportId={selectedReport?.id || null}
            onSelectReport={(r) => setSelectedReport(r)}
            onOpenDetail={(id) => setDetailModalReportId(id)}
            onBoundsChange={handleBoundsChange}
            enableViewportFiltering={enableViewportFiltering}
          />

          {/* Floating Legenda di Sudut Kiri Bawah Peta */}
          <div className="absolute bottom-4 left-4 z-[400]">
            <GisLegend summary={summary} />
          </div>
        </div>

        {/* Kolom Daftar Laporan (Drawer Sinkron dengan Peta) */}
        {viewMode === 'split' && (
          <div className="lg:col-span-4 xl:col-span-4 space-y-3">
            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Daftar Laporan Terpilih
                </h3>
                <p className="text-[11px] text-slate-500">
                  Klik kartu untuk memusatkan marker di peta
                </p>
              </div>
              <span className="text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full">
                {reports.length} Laporan
              </span>
            </div>

            <GisReportList
              reports={reports}
              selectedReportId={selectedReport?.id || null}
              onSelectReport={(r) => setSelectedReport(r)}
              onOpenDetail={(id) => setDetailModalReportId(id)}
              isLoading={isLoading}
            />
          </div>
        )}
      </div>

      {/* Modal Detail Laporan (Action: Approve / Reject / Assign Petugas) */}
      {detailModalReportId && !readonly && (
        <ReportDetailModal
          reportId={detailModalReportId}
          onClose={() => setDetailModalReportId(null)}
          onSuccess={() => {
            setDetailModalReportId(null);
            loadReports();
          }}
        />
      )}

      {/* Modal Detail Read-Only (publik): data dari daftar yang sudah dimuat */}
      {detailModalReportId && readonly && (() => {
        const r = reports.find((x) => x.id === detailModalReportId);
        if (!r) return null;
        return (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true" aria-label="Detail laporan">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center p-5 border-b border-slate-100">
                <h2 className="text-base font-bold text-slate-900">Detail Laporan</h2>
                <button onClick={() => setDetailModalReportId(null)} aria-label="Tutup detail" className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700">
                  <X size={20} />
                </button>
              </div>
              <div className="p-5 space-y-3">
                {r.foto && (
                  <img src={resolveUploadUrl(r.foto) || ''} alt={r.judul} className="w-full h-56 object-cover rounded-xl border border-slate-200" />
                )}
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{r.kategori}</p>
                  <h3 className="text-lg font-extrabold text-slate-900">{r.judul}</h3>
                </div>
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 font-bold text-slate-700">{statusLabel(r.status)}</span>
                  {r.ai_priority && (
                    <span className="rounded-full bg-orange-100 px-2.5 py-1 font-bold text-orange-700">Prioritas: {r.ai_priority}</span>
                  )}
                </div>
                <p className="text-sm text-slate-600">{r.lokasi}</p>
                <p className="text-xs text-slate-400">
                  Dilaporkan {new Date(r.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                  {r.user?.nama ? ` oleh ${r.user.nama}` : ''}
                </p>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};

export default GisDashboard;
