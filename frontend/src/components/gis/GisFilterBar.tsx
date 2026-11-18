import React, { useState, useEffect } from 'react';
import { Search, RotateCcw, LayoutGrid, Map as MapIcon } from 'lucide-react';
import { GisFilterState, GisSummary } from '../../types/gis';

interface GisFilterBarProps {
  filter: GisFilterState;
  summary?: GisSummary;
  categories: { kategori: string; count: number }[];
  viewMode: 'split' | 'map-only';
  onFilterChange: (newFilter: Partial<GisFilterState>) => void;
  onResetFilter: () => void;
  onRefresh: () => void;
  onToggleViewMode: () => void;
  isLoading?: boolean;
}

export const GisFilterBar: React.FC<GisFilterBarProps> = ({
  filter,
  summary,
  categories,
  viewMode,
  onFilterChange,
  onResetFilter,
  onRefresh,
  onToggleViewMode,
  isLoading = false
}) => {
  const [searchInput, setSearchInput] = useState(filter.searchQuery);

  // Debounce search input (300ms) untuk optimasi performa query
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchInput !== filter.searchQuery) {
        onFilterChange({ searchQuery: searchInput });
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchInput, filter.searchQuery, onFilterChange]);

  const statusTabs = [
    { key: 'ALL', label: 'Semua Status', count: summary?.total || 0, color: 'border-slate-400 text-slate-700' },
    { key: 'MENUNGGU_VERIFIKASI', label: 'Menunggu Verifikasi', count: summary?.byStatus?.MENUNGGU_VERIFIKASI || 0, color: 'border-amber-500 text-amber-700 bg-amber-50/50' },
    { key: 'DIPROSES', label: 'Diproses', count: summary?.byStatus?.DIPROSES || 0, color: 'border-blue-500 text-blue-700 bg-blue-50/50' },
    { key: 'DALAM_PERBAIKAN', label: 'Dalam Perbaikan', count: summary?.byStatus?.DALAM_PERBAIKAN || 0, color: 'border-purple-500 text-purple-700 bg-purple-50/50' },
    { key: 'SELESAI', label: 'Selesai', count: summary?.byStatus?.SELESAI || 0, color: 'border-emerald-500 text-emerald-700 bg-emerald-50/50' }
  ];

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 space-y-4">
      {/* Baris 1: Status Chips / Tabs dengan Counter Badge */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
        {statusTabs.map((tab) => {
          const isActive = filter.status === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => onFilterChange({ status: tab.key })}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition border ${
                isActive
                  ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                  : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                  isActive
                    ? 'bg-slate-700 text-white'
                    : 'bg-slate-200 text-slate-800'
                }`}
              >
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Baris 2: Kontrol Pencarian, Filter Kategori, Filter Prioritas & Tombol Aksi */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
        {/* Input Pencarian */}
        <div className="md:col-span-4 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input
            type="text"
            placeholder="Cari judul atau lokasi..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="w-full pl-9 pr-8 py-2 text-xs rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
          />
          {searchInput && (
            <button
              onClick={() => {
                setSearchInput('');
                onFilterChange({ searchQuery: '' });
              }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-sm font-bold"
            >
              &times;
            </button>
          )}
        </div>

        {/* Filter Kategori */}
        <div className="md:col-span-3">
          <select
            value={filter.kategori}
            onChange={(e) => onFilterChange({ kategori: e.target.value })}
            className="w-full py-2 px-3 text-xs rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium text-slate-700 cursor-pointer"
          >
            <option value="ALL">Semua Kategori</option>
            {categories.map((c) => (
              <option key={c.kategori} value={c.kategori}>
                {c.kategori} ({c.count})
              </option>
            ))}
          </select>
        </div>

        {/* Filter Prioritas AI */}
        <div className="md:col-span-2">
          <select
            value={filter.priority}
            onChange={(e) => onFilterChange({ priority: e.target.value })}
            className="w-full py-2 px-3 text-xs rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium text-slate-700 cursor-pointer"
          >
            <option value="ALL">Semua Prioritas</option>
            <option value="Darurat">🚨 Darurat</option>
            <option value="Tinggi">⚠️ Tinggi</option>
            <option value="Sedang">⚡ Sedang</option>
            <option value="Rendah">🟢 Rendah</option>
          </select>
        </div>

        {/* Action Buttons (Reset, Refresh, View Toggle) */}
        <div className="md:col-span-3 flex items-center justify-end gap-2">
          <button
            onClick={onResetFilter}
            className="p-2 text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs font-medium transition flex items-center gap-1.5"
            title="Reset Filter"
          >
            <RotateCcw size={14} />
            <span className="hidden sm:inline">Reset</span>
          </button>

          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="p-2 text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 disabled:opacity-50 rounded-lg text-xs font-medium transition flex items-center gap-1.5"
            title="Muat Ulang Data"
          >
            <span className={`inline-block ${isLoading ? 'animate-spin' : ''}`}>🔄</span>
            <span className="hidden sm:inline">Refresh</span>
          </button>

          <button
            onClick={onToggleViewMode}
            className="py-1.5 px-3 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold transition flex items-center gap-1.5 shadow-sm"
          >
            {viewMode === 'split' ? (
              <>
                <MapIcon size={14} />
                <span>Peta Penuh</span>
              </>
            ) : (
              <>
                <LayoutGrid size={14} />
                <span>Peta & Daftar</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default GisFilterBar;
