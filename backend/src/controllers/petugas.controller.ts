import { Response } from 'express';
import prisma from '../utils/db';
import { AuthRequest } from '../middlewares/auth.middleware';
import { notificationService } from '../services/notification/notification.service';
import { logger } from '../utils/logger';

/**
 * Riwayat penanganan petugas: semua update progres yang pernah dibuat petugas ini.
 */
export const getOfficerHistory = async (req: AuthRequest, res: Response) => {
  try {
    const petugasId = req.user?.id;
    if (!petugasId) return res.status(401).json({ status: 'error', message: 'Unauthorized' });

    const page = Math.max(parseInt(req.query.page as string) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit as string) || 10, 1), 50);

    const [updates, total] = await Promise.all([
      prisma.report_updates.findMany({
        where: { petugas_id: petugasId },
        include: {
          report: {
            select: {
              id: true,
              judul: true,
              kategori: true,
              status: true,
              lokasi: true,
              foto: true,
            },
          },
        },
        orderBy: { created_at: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.report_updates.count({ where: { petugas_id: petugasId } }),
    ]);

    return res.status(200).json({
      status: 'success',
      data: updates,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (error: any) {
    return res.status(500).json({ status: 'error', message: 'Gagal memuat riwayat penanganan' });
  }
};

export const getAssignedTasks = async (req: AuthRequest, res: Response) => {
  try {
    const petugasId = req.user?.id;
    if (!petugasId) return res.status(401).json({ status: 'error', message: 'Unauthorized' });

    const assignments = await prisma.assignments.findMany({
      where: { petugas_id: petugasId },
      include: {
        report: {
          select: {
            id: true,
            judul: true,
            kategori: true,
            status: true,
            foto: true,
            created_at: true,
            lokasi: true
          }
        }
      },
      orderBy: { assigned_at: 'desc' }
    });

    return res.status(200).json({ status: 'success', data: assignments });
  } catch (error: any) {
    return res.status(500).json({ status: 'error', message: 'Gagal memuat tugas' });
  }
};

export const getTaskDetail = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params; // report_id
    const petugasId = req.user?.id;

    // Pastikan petugas ini memang di-assign ke tugas tersebut
    const assignment = await prisma.assignments.findUnique({
      where: {
        report_id_petugas_id: {
          report_id: id,
          petugas_id: petugasId as string
        }
      }
    });

    if (!assignment) {
      return res.status(403).json({ status: 'error', message: 'Anda tidak memiliki akses ke laporan ini' });
    }

    const report = await prisma.reports.findUnique({
      where: { id },
      include: {
        user: { select: { nama: true } },
        updates: {
          orderBy: { created_at: 'desc' },
          include: {
            petugas: { select: { nama: true } }
          }
        }      }
    });

    return res.status(200).json({ status: 'success', data: report });
  } catch (error: any) {
    return res.status(500).json({ status: 'error', message: 'Gagal memuat detail tugas' });
  }
};

export const addProgressUpdate = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params; // report_id
    const petugasId = req.user?.id;
    if (!petugasId) return res.status(401).json({ status: 'error', message: 'Unauthorized' });

    const { catatan, status } = req.body; // zod-validated

    // Pastikan petugas ini memang di-assign ke tugas tersebut
    const assignment = await prisma.assignments.findUnique({
      where: { report_id_petugas_id: { report_id: id, petugas_id: petugasId } },
    });
    if (!assignment) {
      return res.status(403).json({ status: 'error', message: 'Anda tidak memiliki akses ke laporan ini' });
    }

    // Validasi transisi status: DALAM_PERBAIKAN lalu SELESAI
    const current = await prisma.reports.findUnique({ where: { id }, select: { status: true } });
    if (!current) {
      return res.status(404).json({ status: 'error', message: 'Laporan tidak ditemukan' });
    }
    const allowed: Record<string, string[]> = {
      DIPROSES: ['DALAM_PERBAIKAN'],
      DALAM_PERBAIKAN: ['SELESAI', 'DALAM_PERBAIKAN'],
    };
    if (!allowed[current.status]?.includes(status)) {
      return res.status(409).json({
        status: 'error',
        message: `Transisi status dari ${current.status} ke ${status} tidak diizinkan`,
      });
    }

    let fotoBuktiUrl = null;
    if (req.file) {
      fotoBuktiUrl = `/uploads/${req.file.filename}`;
    }

    // Gunakan transaction untuk memastikan atomicity
    const result = await prisma.$transaction(async (tx) => {
      // 1. Buat record di report_updates
      const updateRecord = await tx.report_updates.create({
        data: {
          report_id: id,
          petugas_id: petugasId,
          catatan,
          status,
          foto_bukti: fotoBuktiUrl
        }
      });

      // 2. Update status di tabel utama reports
      const updatedReport = await tx.reports.update({
        where: { id },
        data: { status },
        include: {
          user: { select: { id: true, nama: true, email: true, no_hp: true } }
        }
      });

      return { updateRecord, updatedReport };
    });

    // Pemicu Notifikasi (In-App & Email): Laporan Diproses / Selesai untuk Pelapor
    if (result.updatedReport.user) {
      if (status === 'DALAM_PERBAIKAN') {
        notificationService.notifyLaporanDiproses(
          result.updatedReport.user_id,
          result.updatedReport,
          catatan,
          result.updatedReport.user.email,
          result.updatedReport.user.nama
        ).catch((err: unknown) => {
          console.error('[Notification] Gagal mengirim notifikasi perbaikan:', err);
        });
      } else if (status === 'SELESAI') {
        notificationService.notifyLaporanSelesai(
          result.updatedReport.user_id,
          result.updatedReport,
          catatan,
          result.updatedReport.user.email,
          result.updatedReport.user.nama
        ).catch((err: unknown) => {
          console.error('[Notification] Gagal mengirim notifikasi laporan selesai:', err);
        });

        // Notifikasi WhatsApp ke Admin: Laporan Selesai
        if (result.updatedReport.user) {
          notificationService.notifyReportSolvedAdmin(
            result.updatedReport,
            { nama: result.updatedReport.user.nama, email: result.updatedReport.user.email, no_hp: result.updatedReport.user.no_hp ?? undefined },
            { nama: req.user?.nama ?? 'Petugas' },
            catatan
          ).catch((err: unknown) => logger.error('WhatsApp report solved admin notify error', { error: err instanceof Error ? err.message : String(err) }));
        }
      }
    }

    return res.status(201).json({
      status: 'success',
      message: 'Progres berhasil diperbarui',
      data: result.updateRecord
    });
  } catch (error: any) {
    return res.status(500).json({ status: 'error', message: 'Gagal memperbarui progres' });
  }
};
