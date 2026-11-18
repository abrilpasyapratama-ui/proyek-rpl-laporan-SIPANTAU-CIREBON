import api from './api';
import { GisResponse, GisFilterState, MapBounds } from '../types/gis';

export interface GisQueryParams {
  status?: string;
  kategori?: string;
  priority?: string;
  q?: string;
  bbox?: string;
  minLat?: number;
  maxLat?: number;
  minLng?: number;
  maxLng?: number;
  limit?: number;
  format?: 'json' | 'geojson';
}

export const fetchGisReports = async (
  filters?: Partial<GisFilterState>,
  bounds?: MapBounds | null,
  limit: number = 2000
): Promise<GisResponse> => {
  const params: GisQueryParams = {
    limit
  };

  if (filters?.status && filters.status !== 'ALL') {
    params.status = filters.status;
  }

  if (filters?.kategori && filters.kategori !== 'ALL') {
    params.kategori = filters.kategori;
  }

  if (filters?.priority && filters.priority !== 'ALL') {
    params.priority = filters.priority;
  }

  if (filters?.searchQuery && filters.searchQuery.trim() !== '') {
    params.q = filters.searchQuery.trim();
  }

  if (bounds) {
    params.minLat = bounds.minLat;
    params.maxLat = bounds.maxLat;
    params.minLng = bounds.minLng;
    params.maxLng = bounds.maxLng;
  }

  const response = await api.get<GisResponse>('/gis', { params });
  return response.data;
};

export const fetchGisCategories = async (): Promise<{ kategori: string; count: number }[]> => {
  const response = await api.get<{ status: string; data: { kategori: string; count: number }[] }>('/gis/categories');
  return response.data.data;
};
