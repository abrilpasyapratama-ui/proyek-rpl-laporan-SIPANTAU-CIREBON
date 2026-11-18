import React, { useState } from 'react';
import { Info, ChevronDown, ChevronUp } from 'lucide-react';
import { GisSummary } from '../../types/gis';

interface GisLegendProps {
  summary?: GisSummary;
}

export const GisLegend: React.FC<GisLegendProps> = ({ summary }) => {
  const [isExpanded, setIsExpanded] = useState(true);

  const legendItems = [
    {
      status: 'Menunggu Verifikasi',
      color: 'bg-amber-500',
      ring: 'ring-amber-200',
      description: 'Laporan baru menunggu validasi admin',
      count: summary?.byStatus?.MENUNGGU_VERIFIKASI ?? 0
    },
    {
      status: 'Diproses',
      color: 'bg-blue-600',
      ring: 'ring-blue-200',
      description: 'Laporan diverifikasi & dijadwalkan',
      count: summary?.byStatus?.DIPROSES ?? 0
    },
    {
      status: 'Dalam Perbaikan',
      color: 'bg-purple-600',
      ring: 'ring-purple-200',
      description: 'Petugas lapangan sedang melakukan perbaikan',
      count: summary?.byStatus?.DALAM_PERBAIKAN ?? 0
    },
    {
      status: 'Selesai',
      color: 'bg-emerald-600',
      ring: 'ring-emerald-200',
      description: 'Perbaikan tuntas terverifikasi',
      count: summary?.byStatus?.SELESAI ?? 0
    }
  ];

  return (
    <div className="bg-white/95 backdrop-blur-md rounded-xl shadow-lg border border-slate-200 p-3 w-64 text-xs transition-all duration-300">
      <div
        className="flex items-center justify-between cursor-pointer select-none font-bold text-slate-800"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <span className="flex items-center gap-1.5">
          <Info size={14} className="text-blue-600" />
          <span>Legenda Status GIS</span>
        </span>
        <button className="text-slate-400 hover:text-slate-600">
          {isExpanded ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
        </button>
      </div>

      {isExpanded && (
        <div className="mt-2.5 space-y-2 border-t border-slate-100 pt-2 animate-in fade-in duration-200">
          {legendItems.map((item, idx) => (
            <div key={idx} className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className={`w-3 h-3 rounded-full ${item.color} ring-2 ${item.ring} shrink-0`}></span>
                <span className="text-slate-700 font-medium">{item.status}</span>
              </div>
              <span className="text-[11px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded-full">
                {item.count}
              </span>
            </div>
          ))}

          <div className="pt-1.5 border-t border-slate-100 text-[10px] text-slate-500 leading-tight">
            <span className="inline-block w-2 h-2 rounded-full bg-red-500 animate-ping mr-1"></span>
            Marker berdenyut menandakan prioritas darurat / belum diverifikasi.
          </div>
        </div>
      )}
    </div>
  );
};

export default GisLegend;
