import React, { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { GisReport, ReportStatus, MapBounds } from '../../types/gis';
import { Layers, Maximize2, Minimize2, Navigation, ZoomIn, ZoomOut } from 'lucide-react';
import { API_ORIGIN } from '../../utils/uploadUrl';

interface GisMapProps {
  reports: GisReport[];
  selectedReportId: string | null;
  onSelectReport: (report: GisReport) => void;
  onOpenDetail: (reportId: string) => void;
  onBoundsChange?: (bounds: MapBounds) => void;
  enableViewportFiltering?: boolean;
}

// Konfigurasi visual marker berdasarkan status laporan
const STATUS_CONFIG: Record<
  ReportStatus,
  {
    label: string;
    bgClass: string;
    badgeClass: string;
    pinColor: string;
    iconSvg: string;
  }
> = {
  MENUNGGU_VERIFIKASI: {
    label: 'Menunggu Verifikasi',
    bgClass: 'bg-amber-500',
    badgeClass: 'bg-amber-100 text-amber-800 border border-amber-200',
    pinColor: '#F59E0B',
    iconSvg: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`
  },
  DIPROSES: {
    label: 'Diproses',
    bgClass: 'bg-blue-600',
    badgeClass: 'bg-blue-100 text-blue-800 border border-blue-200',
    pinColor: '#2563EB',
    iconSvg: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v4"/><path d="m4.93 4.93 2.83 2.83"/><path d="M2 12h4"/><path d="m4.93 19.07 2.83-2.83"/><path d="M12 22v-4"/><path d="m19.07 19.07-2.83-2.83"/><path d="M22 12h-4"/><path d="m19.07 4.93-2.83 2.83"/></svg>`
  },
  DALAM_PERBAIKAN: {
    label: 'Dalam Perbaikan',
    bgClass: 'bg-purple-600',
    badgeClass: 'bg-purple-100 text-purple-800 border border-purple-200',
    pinColor: '#7C3AED',
    iconSvg: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m15 12-8.5 8.5c-.83.83-2.17.83-3 0 0 0 0 0 0 0a2.12 2.12 0 0 1 0-3L12 9"/><path d="M17.64 15 22 10.64"/><path d="m20.91 3.26-1.57-1.57a2 2 0 0 0-2.83 0l-3.35 3.35a2 2 0 0 0 0 2.83l.85.85-5.63 5.63"/></svg>`
  },
  SELESAI: {
    label: 'Selesai',
    bgClass: 'bg-emerald-600',
    badgeClass: 'bg-emerald-100 text-emerald-800 border border-emerald-200',
    pinColor: '#059669',
    iconSvg: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>`
  }
};

// Pilihan Base Tile Layers untuk GIS
const TILE_PROVIDERS = [
  {
    name: 'OpenStreetMap',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
  },
  {
    name: 'CartoDB Positron (Terang)',
    url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; <a href="https://carto.com/">CARTO</a>'
  },
  {
    name: 'CartoDB Dark (Gelap)',
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; <a href="https://carto.com/">CARTO</a>'
  },
  {
    name: 'Citra Satelit Esri',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye'
  }
];

export const GisMap: React.FC<GisMapProps> = ({
  reports,
  selectedReportId,
  onSelectReport,
  onOpenDetail,
  onBoundsChange,
  enableViewportFiltering = false
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const markerMapRef = useRef<Map<string, L.Marker>>(new Map());

  const [currentTileIndex, setCurrentTileIndex] = useState(1); // default CartoDB Positron
  const [showTileMenu, setShowTileMenu] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Inisialisasi peta Leaflet
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return;

    // Default center ke Indonesia (koordinat Cirebon / Jawa Barat)
    const map = L.map(mapContainerRef.current, {
      center: [-6.732, 108.5523],
      zoom: 13,
      zoomControl: false,
      preferCanvas: true // Optimasi performa render canvas
    });

    const activeTile = TILE_PROVIDERS[currentTileIndex];
    const tileLayer = L.tileLayer(activeTile.url, {
      attribution: activeTile.attribution,
      maxZoom: 19
    }).addTo(map);

    const markersGroup = L.layerGroup().addTo(map);

    mapInstanceRef.current = map;
    tileLayerRef.current = tileLayer;
    markersLayerRef.current = markersGroup;

    // Listener Bounding Box untuk optimasi spasial
    const handleMoveEnd = () => {
      if (!enableViewportFiltering || !onBoundsChange) return;
      const b = map.getBounds();
      onBoundsChange({
        minLat: b.getSouth(),
        maxLat: b.getNorth(),
        minLng: b.getWest(),
        maxLng: b.getEast()
      });
    };

    map.on('moveend', handleMoveEnd);

    // Event delegation untuk tombol detail pada popup Leaflet
    map.on('popupopen', (e) => {
      const popupNode = e.popup.getElement();
      if (!popupNode) return;

      const btn = popupNode.querySelector('.leaflet-popup-detail-btn');
      if (btn) {
        const id = btn.getAttribute('data-report-id');
        if (id) {
          btn.addEventListener(
            'click',
            () => {
              onOpenDetail(id);
            },
            { once: true }
          );
        }
      }
    });

    return () => {
      map.off('moveend', handleMoveEnd);
      map.remove();
      mapInstanceRef.current = null;
    };
    // Effect ini sengaja hanya berjalan sekali saat mount: inisialisasi
    // Leaflet tidak boleh diulang saat prop berubah (instance peta
    // akan terbuang dan marker hilang). Lihat changeTileLayer untuk
    // update tile tanpa re-init.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update base tile layer ketika pengguna mengganti pilihan tema peta
  const changeTileLayer = (index: number) => {
    if (!mapInstanceRef.current) return;
    setCurrentTileIndex(index);
    setShowTileMenu(false);

    if (tileLayerRef.current) {
      mapInstanceRef.current.removeLayer(tileLayerRef.current);
    }

    const nextTile = TILE_PROVIDERS[index];
    const newLayer = L.tileLayer(nextTile.url, {
      attribution: nextTile.attribution,
      maxZoom: 19
    }).addTo(mapInstanceRef.current);

    tileLayerRef.current = newLayer;
  };

  // Helper untuk membuat HTML Popup yang kaya informasi
  const createPopupContent = useCallback((report: GisReport): string => {
    const config = STATUS_CONFIG[report.status] || STATUS_CONFIG.MENUNGGU_VERIFIKASI;
    const formattedDate = new Date(report.created_at).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    const fotoImg = report.foto
      ? `<div class="mb-2.5 rounded-lg overflow-hidden border border-slate-200 bg-slate-100 max-h-36">
           <img src="${API_ORIGIN}${report.foto}" alt="${report.judul}" class="w-full h-36 object-cover hover:scale-105 transition duration-300" onerror="this.onerror=null; this.src='https://placehold.co/400x200?text=Foto+Tidak+Tersedia';" />
         </div>`
      : '';

    const priorityBadge = report.ai_priority
      ? `<span class="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold ${
          report.ai_priority === 'Darurat'
            ? 'bg-red-500 text-white animate-pulse'
            : report.ai_priority === 'Tinggi'
            ? 'bg-orange-500 text-white'
            : report.ai_priority === 'Sedang'
            ? 'bg-yellow-400 text-slate-900'
            : 'bg-emerald-500 text-white'
        }">
          Prioritas: ${report.ai_priority}
        </span>`
      : '';

    return `
      <div class="gis-popup-card font-sans text-slate-800 p-1" style="min-width: 250px; max-width: 290px;">
        ${fotoImg}
        <div class="flex items-center gap-1.5 flex-wrap mb-2">
          <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold ${config.badgeClass}">
            ${config.label}
          </span>
          <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
            ${report.kategori}
          </span>
          ${priorityBadge}
        </div>
        <h4 class="font-bold text-slate-900 text-sm leading-snug mb-1">
          ${report.judul.replace(/"/g, '&quot;')}
        </h4>
        <p class="text-xs text-slate-600 mb-2 flex items-start gap-1">
          <span class="text-slate-400 mt-0.5">📍</span>
          <span class="line-clamp-2">${report.lokasi.replace(/"/g, '&quot;')}</span>
        </p>
        <div class="text-[11px] text-slate-500 mb-3 border-t border-slate-100 pt-1.5 flex justify-between items-center">
          <span>Oleh: <strong class="text-slate-700">${(report.user?.nama || 'Masyarakat').replace(/"/g, '&quot;')}</strong></span>
          <span>${formattedDate}</span>
        </div>
        <div class="flex gap-2">
          <button data-report-id="${report.id}" class="leaflet-popup-detail-btn flex-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold py-1.5 px-3 rounded-lg shadow-sm transition active:scale-95 cursor-pointer">
            Detail Laporan
          </button>
          <a href="https://www.google.com/maps/dir/?api=1&destination=${report.latitude},${report.longitude}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center justify-center bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold py-1.5 px-2.5 rounded-lg border border-slate-200 transition" title="Petunjuk Arah Google Maps">
            🧭 Rute
          </a>
        </div>
      </div>
    `;
  }, []);

  // Update marker ketika data laporan berubah
  useEffect(() => {
    const map = mapInstanceRef.current;
    const markersGroup = markersLayerRef.current;
    if (!map || !markersGroup) return;

    // Bersihkan marker lama
    markersGroup.clearLayers();
    markerMapRef.current.clear();

    if (!reports || reports.length === 0) return;

    const latLngBounds = L.latLngBounds([]);

    reports.forEach((report) => {
      if (typeof report.latitude !== 'number' || typeof report.longitude !== 'number') return;
      if (isNaN(report.latitude) || isNaN(report.longitude)) return;

      const config = STATUS_CONFIG[report.status] || STATUS_CONFIG.MENUNGGU_VERIFIKASI;
      const isUrgent = report.ai_priority === 'Darurat' || report.status === 'MENUNGGU_VERIFIKASI';

      // Custom DivIcon dengan Tailwind styling & SVG icon tajam tanpa beban aset eksternal
      const customIcon = L.divIcon({
        className: 'custom-gis-marker',
        html: `
          <div class="relative flex items-center justify-center group cursor-pointer">
            ${
              isUrgent
                ? `<span class="absolute inline-flex h-8 w-8 rounded-full ${config.bgClass} opacity-40 animate-ping"></span>`
                : ''
            }
            <div class="w-8 h-8 rounded-full shadow-md border-2 border-white flex items-center justify-center ${config.bgClass} text-white transition-transform duration-200 hover:scale-125 hover:shadow-xl">
              ${config.iconSvg}
            </div>
            <div class="absolute -bottom-1 w-2 h-2 ${config.bgClass} rotate-45 border-r border-b border-white"></div>
          </div>
        `,
        iconSize: [32, 36],
        iconAnchor: [16, 36],
        popupAnchor: [0, -36]
      });

      const marker = L.marker([report.latitude, report.longitude], {
        icon: customIcon,
        title: report.judul
      });

      // Bind rich popup
      marker.bindPopup(createPopupContent(report), {
        maxWidth: 320,
        className: 'modern-gis-popup'
      });

      marker.on('click', () => {
        onSelectReport(report);
      });

      marker.addTo(markersGroup);
      markerMapRef.current.set(report.id, marker);
      latLngBounds.extend([report.latitude, report.longitude]);
    });

    // Sesuaikan zoom dan batas peta secara halus jika ada titik marker
    if (latLngBounds.isValid()) {
      map.fitBounds(latLngBounds, { padding: [40, 40], maxZoom: 16 });
    }
  }, [reports, createPopupContent, onSelectReport]);

  // Pantau seleksi marker dari luar (misal klik di drawer/list laporan)
  useEffect(() => {
    if (!selectedReportId || !mapInstanceRef.current) return;
    const marker = markerMapRef.current.get(selectedReportId);
    if (marker) {
      const latLng = marker.getLatLng();
      mapInstanceRef.current.flyTo(latLng, 16, {
        duration: 1.2
      });
      marker.openPopup();
    }
  }, [selectedReportId]);

  // Tombol aksi peta
  const handleZoomIn = () => mapInstanceRef.current?.zoomIn();
  const handleZoomOut = () => mapInstanceRef.current?.zoomOut();

  const handleCenterAll = () => {
    if (!mapInstanceRef.current || reports.length === 0) return;
    const bounds = L.latLngBounds(
      reports
        .filter((r) => typeof r.latitude === 'number' && typeof r.longitude === 'number')
        .map((r) => [r.latitude, r.longitude] as [number, number])
    );
    if (bounds.isValid()) {
      mapInstanceRef.current.fitBounds(bounds, { padding: [50, 50] });
    }
  };

  const toggleFullscreen = () => {
    if (!mapContainerRef.current) return;
    if (!document.fullscreenElement) {
      mapContainerRef.current.requestFullscreen?.().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.().catch(() => {});
      setIsFullscreen(false);
    }
  };

  return (
    <div className="relative w-full h-full min-h-[500px] overflow-hidden rounded-xl shadow-inner border border-slate-200">
      {/* Kontainer Leaflet Peta */}
      <div ref={mapContainerRef} className="w-full h-full z-0 bg-slate-100" />

      {/* Floating Control Toolbar di Sudut Kanan Atas */}
      <div className="absolute top-4 right-4 z-[400] flex flex-col gap-2">
        {/* Kontrol Zoom */}
        <div className="bg-white/95 backdrop-blur-md rounded-xl shadow-lg border border-slate-200 p-1 flex flex-col gap-1">
          <button
            onClick={handleZoomIn}
            className="p-2 text-slate-700 hover:text-blue-600 hover:bg-slate-100 rounded-lg transition"
            title="Perbesar Peta"
          >
            <ZoomIn size={18} />
          </button>
          <div className="h-px bg-slate-200 mx-1"></div>
          <button
            onClick={handleZoomOut}
            className="p-2 text-slate-700 hover:text-blue-600 hover:bg-slate-100 rounded-lg transition"
            title="Perkecil Peta"
          >
            <ZoomOut size={18} />
          </button>
        </div>

        {/* Tombol Fokus Semua Titik */}
        <button
          onClick={handleCenterAll}
          className="bg-white/95 backdrop-blur-md p-2.5 text-slate-700 hover:text-blue-600 hover:bg-slate-100 rounded-xl shadow-lg border border-slate-200 transition flex items-center justify-center"
          title="Fokus Seluruh Titik Laporan"
        >
          <Navigation size={18} />
        </button>

        {/* Pemilih Lapisan Peta (Base Layer Switcher) */}
        <div className="relative">
          <button
            onClick={() => setShowTileMenu(!showTileMenu)}
            className="bg-white/95 backdrop-blur-md p-2.5 text-slate-700 hover:text-blue-600 hover:bg-slate-100 rounded-xl shadow-lg border border-slate-200 transition flex items-center justify-center"
            title="Ganti Lapisan Peta"
          >
            <Layers size={18} />
          </button>

          {showTileMenu && (
            <div className="absolute right-0 mt-2 w-52 bg-white rounded-xl shadow-2xl border border-slate-200 p-2 z-[410] animate-in fade-in slide-in-from-top-2 duration-150">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider px-2 py-1 mb-1">
                Pilihan Lapisan Peta
              </p>
              <div className="space-y-1">
                {TILE_PROVIDERS.map((tile, idx) => (
                  <button
                    key={idx}
                    onClick={() => changeTileLayer(idx)}
                    className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-medium transition flex items-center justify-between ${
                      currentTileIndex === idx
                        ? 'bg-blue-50 text-blue-700 font-bold border border-blue-200'
                        : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <span>{tile.name}</span>
                    {currentTileIndex === idx && <span className="text-blue-600 font-bold">✓</span>}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Layar Penuh (Fullscreen) */}
        <button
          onClick={toggleFullscreen}
          className="bg-white/95 backdrop-blur-md p-2.5 text-slate-700 hover:text-blue-600 hover:bg-slate-100 rounded-xl shadow-lg border border-slate-200 transition flex items-center justify-center"
          title={isFullscreen ? 'Keluar Layar Penuh' : 'Layar Penuh'}
        >
          {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
        </button>
      </div>

      {/* Floating Counter Badge di Kiri Atas Peta */}
      <div className="absolute top-4 left-4 z-[400] bg-white/95 backdrop-blur-md px-3.5 py-2 rounded-xl shadow-md border border-slate-200 flex items-center gap-2">
        <span className="relative flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-600"></span>
        </span>
        <span className="text-xs font-semibold text-slate-700">
          Menampilkan <strong className="text-blue-700 font-bold">{reports.length}</strong> titik lokasi
        </span>
      </div>
    </div>
  );
};

export default GisMap;
