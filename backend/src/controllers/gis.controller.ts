import { Request, Response } from 'express';
import prisma from '../utils/db';

/**
 * Controller untuk GIS Dashboard Laporan Fasilitas
 * Dioptimalkan untuk performa tinggi dengan:
 * 1. Lean projection (hanya select field esensial untuk peta)
 * 2. Spatial bounding-box query memanfaatkan indeks (latitude, longitude)
 * 3. Dukungan format output JSON standar dan RFC 7946 GeoJSON
 * 4. Aggregasi ringkasan status & kategori dalam 1 round-trip
 * 5. HTTP Cache-Control header
 */

export const getGisReports = async (req: Request, res: Response) => {
  try {
    const {
      status,
      kategori,
      q,
      priority,
      bbox,
      minLat,
      maxLat,
      minLng,
      maxLng,
      limit = '2000',
      format = 'json'
    } = req.query;

    const whereClause: any = {
      latitude: { not: null },
      longitude: { not: null }
    };

    // Filter status (bisa single atau multiple dipisah koma, contoh: DIPROSES,DALAM_PERBAIKAN)
    if (status && status !== 'ALL') {
      const statuses = (status as string).split(',').map((s) => s.trim());
      if (statuses.length === 1) {
        whereClause.status = statuses[0];
      } else {
        whereClause.status = { in: statuses };
      }
    }

    // Filter kategori
    if (kategori && kategori !== 'ALL') {
      whereClause.kategori = {
        equals: (kategori as string).trim(),
        mode: 'insensitive'
      };
    }

    // Filter prioritas AI
    if (priority && priority !== 'ALL') {
      whereClause.ai_priority = {
        equals: (priority as string).trim(),
        mode: 'insensitive'
      };
    }

    // Filter pencarian teks judul / lokasi
    if (q && typeof q === 'string' && q.trim() !== '') {
      const searchTerm = q.trim();
      whereClause.OR = [
        { judul: { contains: searchTerm, mode: 'insensitive' } },
        { lokasi: { contains: searchTerm, mode: 'insensitive' } }
      ];
    }

    // Filter Bounding Box (Viewport GIS)
    // Format bbox: minLng,minLat,maxLng,maxLat (standar Leaflet/BBox)
    let parsedMinLat: number | null = null;
    let parsedMaxLat: number | null = null;
    let parsedMinLng: number | null = null;
    let parsedMaxLng: number | null = null;

    if (bbox && typeof bbox === 'string') {
      const parts = bbox.split(',').map(Number);
      if (parts.length === 4 && !parts.some(isNaN)) {
        [parsedMinLng, parsedMinLat, parsedMaxLng, parsedMaxLat] = parts;
      }
    } else {
      if (minLat && maxLat) {
        parsedMinLat = parseFloat(minLat as string);
        parsedMaxLat = parseFloat(maxLat as string);
      }
      if (minLng && maxLng) {
        parsedMinLng = parseFloat(minLng as string);
        parsedMaxLng = parseFloat(maxLng as string);
      }
    }

    if (
      parsedMinLat !== null &&
      parsedMaxLat !== null &&
      !isNaN(parsedMinLat) &&
      !isNaN(parsedMaxLat)
    ) {
      whereClause.latitude = {
        ...whereClause.latitude,
        gte: Math.min(parsedMinLat, parsedMaxLat),
        lte: Math.max(parsedMinLat, parsedMaxLat)
      };
    }

    if (
      parsedMinLng !== null &&
      parsedMaxLng !== null &&
      !isNaN(parsedMinLng) &&
      !isNaN(parsedMaxLng)
    ) {
      whereClause.longitude = {
        ...whereClause.longitude,
        gte: Math.min(parsedMinLng, parsedMaxLng),
        lte: Math.max(parsedMinLng, parsedMaxLng)
      };
    }

    const takeLimit = Math.min(Math.max(parseInt(limit as string) || 1000, 1), 5000);

    // Lean Projection: hindari query data berat yang tidak dibutuhkan peta
    const reports = await prisma.reports.findMany({
      where: whereClause,
      select: {
        id: true,
        judul: true,
        kategori: true,
        status: true,
        lokasi: true,
        latitude: true,
        longitude: true,
        foto: true,
        ai_priority: true,
        ai_confidence: true,
        created_at: true,
        user: {
          select: {
            id: true,
            nama: true
          }
        }
      },
      orderBy: { created_at: 'desc' },
      take: takeLimit
    });

    // Hitung ringkasan statistik status & kategori secara in-memory (sangat cepat untuk < 5000 item)
    const summary = {
      total: reports.length,
      byStatus: {
        MENUNGGU_VERIFIKASI: 0,
        DIPROSES: 0,
        DALAM_PERBAIKAN: 0,
        SELESAI: 0
      } as Record<string, number>,
      byCategory: {} as Record<string, number>
    };

    reports.forEach((r) => {
      // Hitung per status
      if (summary.byStatus[r.status] !== undefined) {
        summary.byStatus[r.status]++;
      } else {
        summary.byStatus[r.status] = 1;
      }

      // Hitung per kategori
      const cat = r.kategori || 'Lainnya';
      summary.byCategory[cat] = (summary.byCategory[cat] || 0) + 1;
    });

    // Set cache header untuk optimalisasi performa (10 detik cache, stale 30s)
    res.setHeader('Cache-Control', 'public, max-age=10, stale-while-revalidate=30');

    // Jika client meminta format GeoJSON
    if (format === 'geojson') {
      const geojson = {
        type: 'FeatureCollection',
        summary,
        features: reports.map((r) => ({
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [r.longitude, r.latitude]
          },
          properties: {
            id: r.id,
            judul: r.judul,
            kategori: r.kategori,
            status: r.status,
            lokasi: r.lokasi,
            foto: r.foto,
            ai_priority: r.ai_priority,
            created_at: r.created_at,
            pelapor: r.user?.nama || 'Anonim'
          }
        }))
      };

      return res.status(200).json(geojson);
    }

    // Format JSON standar default
    return res.status(200).json({
      status: 'success',
      meta: {
        count: reports.length,
        limit: takeLimit,
        filtered: Boolean(status || kategori || q || priority || bbox || minLat)
      },
      summary,
      data: reports
    });
  } catch (error: any) {
    console.error('Error fetching GIS reports:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Gagal mengambil data peta GIS laporan'
    });
  }
};

/**
 * Endpoint ringkasan kategori & statistik spasial GIS
 */
export const getGisCategories = async (req: Request, res: Response) => {
  try {
    const categories = await prisma.reports.groupBy({
      by: ['kategori'],
      _count: {
        id: true
      },
      where: {
        latitude: { not: null },
        longitude: { not: null }
      }
    });

    return res.status(200).json({
      status: 'success',
      data: categories.map((c) => ({
        kategori: c.kategori,
        count: c._count.id
      }))
    });
  } catch (error: any) {
    return res.status(500).json({
      status: 'error',
      message: 'Gagal mengambil kategori GIS'
    });
  }
};
