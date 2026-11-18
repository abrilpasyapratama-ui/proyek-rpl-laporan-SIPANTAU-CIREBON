export type ReportStatus = 'MENUNGGU_VERIFIKASI' | 'DIPROSES' | 'DALAM_PERBAIKAN' | 'SELESAI';

export interface GisReport {
  id: string;
  judul: string;
  kategori: string;
  status: ReportStatus;
  lokasi: string;
  latitude: number;
  longitude: number;
  foto?: string | null;
  ai_priority?: 'Darurat' | 'Tinggi' | 'Sedang' | 'Rendah' | string | null;
  ai_confidence?: number | null;
  created_at: string;
  user?: {
    id?: string;
    nama: string;
  };
}

export interface GisSummary {
  total: number;
  byStatus: {
    MENUNGGU_VERIFIKASI: number;
    DIPROSES: number;
    DALAM_PERBAIKAN: number;
    SELESAI: number;
    [key: string]: number;
  };
  byCategory: Record<string, number>;
}

export interface GisResponse {
  status: string;
  meta: {
    count: number;
    limit: number;
    filtered: boolean;
  };
  summary: GisSummary;
  data: GisReport[];
}

export interface GisFilterState {
  status: string;
  kategori: string;
  priority: string;
  searchQuery: string;
}

export interface MapBounds {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}
