import React from 'react';
import { GisReport, ReportStatus } from '../../types/gis';
import { MapPin, Calendar, User, Eye, Navigation } from 'lucide-react';
import { resolveUploadUrl } from '../../utils/uploadUrl';

interface GisReportListProps {
  reports: GisReport[];
  selectedReportId: string | null;
  onSelectReport: (report: GisReport) => void;
  onOpenDetail: (reportId: string) => void;
  isLoading?: boolean;
}

const STATUS_BADGE_STYLE: Record<ReportStatus, { text: string; badgeClass: string; dotClass: string }> = {
  MENUNGGU_VERIFIKASI: {
    text: 'Menunggu',
    badgeClass: 'bg-amber-100 text-amber-800 border-amber-200',
    dotClass: 'bg-amber-500'
  },
  DIPROSES: {
    text: 'Diproses',
    badgeClass: 'bg-blue-100 text-blue-800 border-blue-200',
    dotClass: 'bg-blue-500'
  },
  DALAM_PERBAIKAN: {
    text: 'Perbaikan',
    badgeClass: 'bg-purple-100 text-purple-800 border-purple-200',
    dotClass: 'bg-purple-500'
  },
  SELESAI: {
    text: 'Selesai',
    badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    dotClass: 'bg-emerald-500'
  }
};

export const GisReportList: React.FC<GisReportListProps> = ({
  reports,
  selectedReportId,
  onSelectReport,
  onOpenDetail,
  isLoading = false
}) => {
  if (isLoading) {
    return (
      <div className="space-y-3 p-2">
        {[1, 2, 3, 4].map((n) => (
          <div key={n} className="bg-white p-4 rounded-xl border border-slate-200 animate-pulse space-y-3">
            <div className="flex justify-between items-center">
              <div className="h-4 bg-slate-200 rounded w-1/3"></div>
              <div className="h-4 bg-slate-200 rounded w-16"></div>
            </div>
            <div className="h-5 bg-slate-200 rounded w-3/4"></div>
            <div className="h-3 bg-slate-200 rounded w-1/2"></div>
          </div>
        ))}
      </div>
    );
  }

  if (reports.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-500">
        <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3 text-2xl">
          🗺️
        </div>
        <p className="font-semibold text-slate-700">Tidak ada laporan ditemukan</p>
        <p className="text-xs text-slate-500 mt-1">
          Coba sesuaikan filter status, kategori, atau kata kunci pencarian Anda.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3 overflow-y-auto max-h-[calc(100vh-280px)] pr-1 scrollbar-thin">
      {reports.map((report) => {
        const isSelected = selectedReportId === report.id;
        const statusConfig = STATUS_BADGE_STYLE[report.status] || STATUS_BADGE_STYLE.MENUNGGU_VERIFIKASI;
        const formattedDate = new Date(report.created_at).toLocaleDateString('id-ID', {
          day: 'numeric',
          month: 'short',
          year: 'numeric'
        });

        return (
          <div
            key={report.id}
            className={`p-3.5 rounded-xl border transition-all duration-200 bg-white hover:shadow-md cursor-pointer ${
              isSelected
                ? 'border-blue-500 ring-2 ring-blue-100 shadow-sm'
                : 'border-slate-200 hover:border-slate-300'
            }`}
            onClick={() => onSelectReport(report)}
          >
            {/* Header: Badges & Tanggal */}
            <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${statusConfig.badgeClass}`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${statusConfig.dotClass}`}></span>
                  {statusConfig.text}
                </span>

                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700">
                  {report.kategori}
                </span>

                {report.ai_priority && (
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                      report.ai_priority === 'Darurat'
                        ? 'bg-red-500 text-white'
                        : report.ai_priority === 'Tinggi'
                        ? 'bg-orange-500 text-white'
                        : 'bg-slate-200 text-slate-800'
                    }`}
                  >
                    {report.ai_priority}
                  </span>
                )}
              </div>

              <span className="text-[11px] text-slate-400 flex items-center gap-1">
                <Calendar size={12} />
                {formattedDate}
              </span>
            </div>

            {/* Judul & Foto Thumbnail */}
            <div className="flex gap-3 items-start">
              <div className="flex-1">
                <h4 className="font-bold text-slate-900 text-xs sm:text-sm line-clamp-1 leading-snug mb-1">
                  {report.judul}
                </h4>
                <p className="text-xs text-slate-600 line-clamp-2 flex items-start gap-1">
                  <MapPin size={12} className="text-slate-400 mt-0.5 shrink-0" />
                  <span>{report.lokasi}</span>
                </p>
              </div>

              {report.foto && (
                <div className="w-14 h-14 rounded-lg overflow-hidden border border-slate-200 bg-slate-100 shrink-0">
                  <img
                    src={resolveUploadUrl(report.foto) || ''}
                    alt="Preview"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                </div>
              )}
            </div>

            {/* Footer Aksi Card */}
            <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs">
              <span className="text-slate-500 flex items-center gap-1 text-[11px]">
                <User size={12} />
                <span className="truncate max-w-[120px]">{report.user?.nama || 'Masyarakat'}</span>
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectReport(report);
                  }}
                  className="px-2.5 py-1 text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 rounded-md text-[11px] font-semibold transition flex items-center gap-1"
                >
                  <Navigation size={12} />
                  <span>Fokus</span>
                </button>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenDetail(report.id);
                  }}
                  className="px-2.5 py-1 text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-md text-[11px] font-semibold transition flex items-center gap-1"
                >
                  <Eye size={12} />
                  <span>Detail</span>
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default GisReportList;
