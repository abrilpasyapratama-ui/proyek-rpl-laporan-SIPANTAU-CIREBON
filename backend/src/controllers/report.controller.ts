import { Response } from 'express';
import prisma from '../utils/db';
import { AuthRequest } from '../middlewares/auth.middleware';
import { aiService } from '../services/ai';
import { notificationService } from '../services/notification/notification.service';
import { logger } from '../utils/logger';

export const createReport = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ status: 'error', message: 'Unauthorized' });
    }

    const { judul, deskripsi, kategori, lokasi, latitude, longitude } = req.body;

    let fotoUrl = null;
    if (req.file) {
      fotoUrl = `/uploads/${req.file.filename}`;
    }

    // Call AI Analysis
    const aiResult = await aiService.analyze(deskripsi, fotoUrl || undefined);

    const report = await prisma.reports.create({
      data: {
        user_id: userId,
        judul,
        deskripsi,
        kategori,
        lokasi,
        latitude: Number(latitude),
        longitude: Number(longitude),
        foto: fotoUrl,
        ai_kategori: aiResult.kategori,
        ai_confidence: aiResult.confidence,
        ai_priority: aiResult.prioritas
    // Status is automatically 'MENUNGGU_VERIFIKASI' via default
      }
    });

    // Pemicu Notifikasi (In-App & Email): Laporan Diterima
    notificationService.notifyLaporanDiterima(userId, report).catch((err: unknown) => {
      console.error('[Notification] Gagal mengirim notifikasi laporan diterima:', err);
    });

    // Pemicu Notifikasi WhatsApp ke Admin: Laporan Baru
    const reporter = await prisma.users.findUnique({
      where: { id: userId },
      select: { nama: true, email: true, no_hp: true }
    });
    if (reporter) {
      notificationService.notifyNewReportAdmin(report, {
        nama: reporter.nama,
        email: reporter.email,
        no_hp: reporter.no_hp ?? undefined
      }).catch((err: unknown) => logger.error('WhatsApp new report admin notify error', { error: err instanceof Error ? err.message : String(err) }));
    }

    return res.status(201).json({
      status: 'success',
      message: 'Laporan berhasil dibuat',
      data: report
    });
  } catch (error: any) {
    return res.status(500).json({ status: 'error', message: error.message || 'Gagal membuat laporan' });
  }
};

export const getMyStats = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ status: 'error', message: 'Unauthorized' });
    }

    const [total, menunggu, diproses, perbaikan, selesai] = await Promise.all([
      prisma.reports.count({ where: { user_id: userId } }),
      prisma.reports.count({ where: { user_id: userId, status: 'MENUNGGU_VERIFIKASI' } }),
      prisma.reports.count({ where: { user_id: userId, status: 'DIPROSES' } }),
      prisma.reports.count({ where: { user_id: userId, status: 'DALAM_PERBAIKAN' } }),
      prisma.reports.count({ where: { user_id: userId, status: 'SELESAI' } }),
    ]);

    return res.status(200).json({
      status: 'success',
      data: { total, menunggu, diproses, perbaikan, selesai },
    });
  } catch (error: any) {
    return res.status(500).json({ status: 'error', message: 'Gagal mengambil statistik laporan' });
  }
};

export const getMyHistory = async (req: AuthRequest, res: Response) => {  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ status: 'error', message: 'Unauthorized' });
    }

    const page = Math.max(parseInt(req.query.page as string) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit as string) || 20, 1), 100);

    const [reports, total] = await Promise.all([
      prisma.reports.findMany({
        where: { user_id: userId },
        orderBy: { created_at: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.reports.count({ where: { user_id: userId } }),
    ]);

    return res.status(200).json({
      status: 'success',
      data: reports,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (error: any) {
    return res.status(500).json({ status: 'error', message: error.message || 'Gagal mengambil riwayat laporan' });
  }
};

export const getMyReportById = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ status: 'error', message: 'Unauthorized' });
    }

    const { id } = req.params;
    const report = await prisma.reports.findFirst({
      where: { id, user_id: userId },
      include: {
        assignments: {
          select: {
            assigned_at: true,
            petugas: { select: { nama: true } },
          },
        },
        updates: {
          orderBy: { created_at: 'desc' },
          select: { catatan: true, status: true, foto_bukti: true, created_at: true },
        },
      },
    });

    if (!report) {
      return res.status(404).json({ status: 'error', message: 'Laporan tidak ditemukan' });
    }

    return res.status(200).json({ status: 'success', data: report });
  } catch (error: any) {
    return res.status(500).json({ status: 'error', message: 'Gagal mengambil detail laporan' });
  }
};
