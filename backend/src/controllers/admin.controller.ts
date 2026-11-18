import { Request, Response } from 'express';
import prisma from '../utils/db';
import { AuthRequest } from '../middlewares/auth.middleware';
import { notificationService } from '../services/notification/notification.service';
import { logger } from '../utils/logger';
import { normalizePhone, phoneLookupVariants, maskPhone } from '../utils/phone';

/**
 * Kolom pengguna yang aman dikirim ke frontend.
 * TIDAK pernah menyertakan password/hash, token, atau field rahasia lain.
 */
const USER_PUBLIC_SELECT = {
  id: true,
  nama: true,
  username: true,
  email: true,
  no_hp: true,
  no_hp_normalized: true,
  role: true,
  status: true,
  nip: true,
  instansi: true,
  wilayah: true,
  created_at: true,
  _count: { select: { reports: true } },
} as const;

/** Error dengan status HTTP agar bisa ditangani seragam di catch block. */
class HttpError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
    this.name = 'HttpError';
  }
}

/** Petakan pelanggaran unique constraint Prisma menjadi pesan yang jelas. */
function uniqueFieldMessage(error: any): string | null {
  if (error?.code !== 'P2002') return null;
  const target = Array.isArray(error?.meta?.target)
    ? error.meta.target.join(',')
    : String(error?.meta?.target ?? '');
  if (target.includes('email')) return 'Email sudah digunakan akun lain';
  if (target.includes('username')) return 'Username sudah digunakan akun lain';
  if (target.includes('no_hp_normalized')) return 'Nomor HP sudah digunakan akun lain';
  return 'Data tersebut sudah digunakan akun lain';
}

/**
 * Cek duplikasi email/username/nomor HP sebelum update, agar admin mendapat
 * pesan yang jelas (bukan error 500). Pengecekan tetap dibantu unique index DB.
 */
async function findUserConflict(
  excludeId: string,
  data: { email?: string; username?: string | null; phoneNormalized?: string | null }
): Promise<string | null> {
  const or: any[] = [];
  if (data.email) or.push({ email: { equals: data.email, mode: 'insensitive' } });
  if (data.username) or.push({ username: data.username });
  if (data.phoneNormalized) or.push({ no_hp_normalized: data.phoneNormalized });
  if (or.length === 0) return null;

  const rows = await prisma.users.findMany({
    where: { OR: or, NOT: { id: excludeId } },
    select: { email: true, username: true, no_hp_normalized: true },
  });

  for (const row of rows) {
    if (data.email && row.email.toLowerCase() === data.email.toLowerCase()) {
      return 'Email sudah digunakan akun lain';
    }
    if (data.username && row.username === data.username) {
      return 'Username sudah digunakan akun lain';
    }
    if (data.phoneNormalized && row.no_hp_normalized === data.phoneNormalized) {
      return 'Nomor HP sudah digunakan akun lain';
    }
  }
  return null;
}

/** Normalisasi input nomor HP. String kosong berarti menghapus nomor. */
function resolvePhoneInput(value: string | null | undefined): {
  provided: boolean;
  raw: string | null;
  normalized: string | null;
  valid: boolean;
} {
  if (value === undefined) {
    return { provided: false, raw: null, normalized: null, valid: true };
  }
  const raw = value === null ? '' : String(value).trim();
  if (!raw) return { provided: true, raw: null, normalized: null, valid: true };
  const normalized = normalizePhone(raw);
  return { provided: true, raw, normalized, valid: normalized !== null };
}


export const getStats = async (req: Request, res: Response) => {
  try {
    const total = await prisma.reports.count();
    const menunggu = await prisma.reports.count({ where: { status: 'MENUNGGU_VERIFIKASI' } });
    const diproses = await prisma.reports.count({ where: { status: 'DIPROSES' } });
    const selesai = await prisma.reports.count({ where: { status: 'SELESAI' } });

    return res.status(200).json({
      status: 'success',
      data: {
        total,
        menunggu,
        diproses,
        selesai
      }
    });
  } catch (error: any) {
    return res.status(500).json({ status: 'error', message: 'Gagal mengambil statistik' });
  }
};

export const getReports = async (req: Request, res: Response) => {
  try {
    const { page, limit, q: search, status, kategori, lokasi, from, to } = req.query as any;

    const skip = (page - 1) * limit;

    const whereClause: any = {};
    if (status && status !== 'ALL') {
      whereClause.status = status;
    }
    if (search) {
      whereClause.OR = [
        { judul: { contains: search, mode: 'insensitive' } },
        { deskripsi: { contains: search, mode: 'insensitive' } }
      ];
    }
    if (kategori && kategori !== 'ALL') {
      whereClause.kategori = { contains: kategori, mode: 'insensitive' };
    }
    if (lokasi) {
      whereClause.lokasi = { contains: lokasi, mode: 'insensitive' };
    }
    if (from || to) {
      whereClause.created_at = {};
      if (from) whereClause.created_at.gte = new Date(`${from}T00:00:00.000Z`);
      if (to) whereClause.created_at.lte = new Date(`${to}T23:59:59.999Z`);
    }

    const [reports, total] = await Promise.all([
      prisma.reports.findMany({
        where: whereClause,
        include: {
          user: { select: { nama: true } }
        },
        orderBy: { created_at: 'desc' },
        skip,
        take: limit
      }),
      prisma.reports.count({ where: whereClause })
    ]);

    return res.status(200).json({
      status: 'success',
      data: reports,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error: any) {
    return res.status(500).json({ status: 'error', message: 'Gagal mengambil data laporan' });
  }
};

export const getReportDetail = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const report = await prisma.reports.findUnique({
      where: { id },
      include: {
        user: { select: { nama: true, email: true } },
        assignments: {
          include: {
            petugas: { select: { nama: true } }
          }
        },
        updates: {
          orderBy: { created_at: 'desc' },
          include: {
            petugas: { select: { nama: true } }
          }
        }
      }
    });

    if (!report) {
      return res.status(404).json({ status: 'error', message: 'Laporan tidak ditemukan' });
    }

    return res.status(200).json({ status: 'success', data: report });
  } catch (error: any) {
    return res.status(500).json({ status: 'error', message: 'Gagal mengambil detail laporan' });
  }
};

export const verifyReport = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { action, reason } = req.body; // 'APPROVE' or 'REJECT' + alasan wajib saat REJECT (validated by zod)

    const newStatus = action === 'APPROVE' ? 'DIPROSES' : 'DITOLAK';

    const existing = await prisma.reports.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ status: 'error', message: 'Laporan tidak ditemukan' });
    }

    const updated = await prisma.reports.update({
      where: { id },
      data: { status: newStatus as any },
      include: {
        user: { select: { id: true, nama: true, email: true } }
      }
    });

    // Catat alasan penolakan sebagai report_updates agar terlacak (tanpa migrasi schema)
    if (action === 'REJECT') {
      await prisma.report_updates.create({
        data: {
          report_id: id,
          petugas_id: req.user?.id ?? updated.user_id,
          catatan: `Ditolak admin. Alasan: ${reason}`,
          status: 'DITOLAK' as any,
        },
      });
    }

    // Pemicu Notifikasi (In-App & Email): Laporan Diverifikasi
    notificationService.notifyLaporanDiverifikasi(
      updated.user_id,
      updated,
      action === 'APPROVE',
      updated.user.email,
      updated.user.nama,
      reason ?? undefined
    ).catch((err: unknown) => {
      console.error('[Notification] Gagal mengirim notifikasi verifikasi:', err);
    });

    // Notifikasi WhatsApp: Perubahan Status (dari MENUNGGU_VERIFIKASI ke DIPROSES/DITOLAK)
    notificationService.notifyReportStatusChange(
      updated.user_id,
      { id: updated.id, user_id: updated.user_id, judul: updated.judul, lokasi: updated.lokasi },
      'MENUNGGU_VERIFIKASI',
      newStatus,
      reason ?? undefined,
      updated.user.email,
      updated.user.nama
    ).catch((err: unknown) =>
      logger.error('WhatsApp status change notify error', { error: err instanceof Error ? err.message : String(err) })
    );

    return res.status(200).json({
      status: 'success',
      message: `Laporan berhasil di${action === 'APPROVE' ? 'verifikasi' : 'tolak'}`,
      data: updated
    });
  } catch (error: any) {
    return res.status(500).json({ status: 'error', message: 'Gagal memverifikasi laporan' });
  }
};

export const getPetugasList = async (req: Request, res: Response) => {
  try {
    const petugasList = await prisma.users.findMany({
      where: { role: 'petugas' },
      select: { id: true, nama: true, email: true }
    });

    return res.status(200).json({ status: 'success', data: petugasList });
  } catch (error: any) {
    return res.status(500).json({ status: 'error', message: 'Gagal mengambil daftar petugas' });
  }
};

export const getUsersList = async (req: Request, res: Response) => {
  try {
    const page = Math.max(parseInt(req.query.page as string) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit as string) || 50, 1), 100);
    const search = (req.query.q as string | undefined)?.trim();
    const role = req.query.role as string | undefined;
    const status = req.query.status as string | undefined;

    // Halaman Kelola Pengguna menampilkan SEMUA role (masyarakat, petugas, admin).
    const whereClause: any = {};
    if (role) whereClause.role = role;
    if (status) whereClause.status = status;
    if (search) {
      const phoneSearch = normalizePhone(search);
      whereClause.OR = [
        { nama: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { username: { contains: search, mode: 'insensitive' } },
        { no_hp: { contains: search, mode: 'insensitive' } },
        ...(phoneSearch ? [{ no_hp_normalized: phoneSearch }] : []),
      ];
    }

    const [users, total] = await Promise.all([
      prisma.users.findMany({
        where: whereClause,
        select: USER_PUBLIC_SELECT,
        orderBy: { created_at: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.users.count({ where: whereClause }),
    ]);

    return res.status(200).json({
      status: 'success',
      data: users,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (error: any) {
    return res.status(500).json({ status: 'error', message: 'Gagal mengambil daftar pengguna' });
  }
};

/** GET /api/admin/users/:id — detail satu pengguna (tanpa data sensitif). */
export const getUserDetail = async (req: AuthRequest, res: Response) => {
  try {
    const user = await prisma.users.findUnique({
      where: { id: req.params.id },
      select: USER_PUBLIC_SELECT,
    });

    if (!user) {
      return res.status(404).json({ status: 'error', message: 'Pengguna tidak ditemukan' });
    }

    return res.status(200).json({ status: 'success', data: user });
  } catch {
    return res.status(500).json({ status: 'error', message: 'Gagal mengambil detail pengguna' });
  }
};

/**
 * PATCH /api/admin/users/:id — edit profil pengguna oleh admin.
 *
 * Aturan keamanan:
 *  - admin tidak dapat mengubah role/status akunnya sendiri;
 *  - admin terakhir yang aktif tidak dapat diturunkan/dinonaktifkan;
 *  - email/username/nomor HP wajib unik;
 *  - password TIDAK pernah disentuh di endpoint ini.
 */
export const updateUser = async (req: AuthRequest, res: Response) => {
  try {
    const adminId = req.user?.id;
    if (!adminId) {
      return res.status(401).json({ status: 'error', message: 'Unauthorized' });
    }

    const { id } = req.params;
    const body = req.body as {
      nama?: string;
      email?: string;
      no_hp?: string | null;
      username?: string | null;
      role?: 'masyarakat' | 'petugas' | 'admin';
      status?: 'AKTIF' | 'NONAKTIF';
    };

    const existing = await prisma.users.findUnique({
      where: { id },
      select: { id: true, nama: true, email: true, username: true, no_hp: true, role: true, status: true },
    });
    if (!existing) {
      return res.status(404).json({ status: 'error', message: 'Pengguna tidak ditemukan' });
    }

    const isSelf = adminId === id;

    // Admin tidak boleh menurunkan role atau menonaktifkan akunnya sendiri.
    if (isSelf && body.role !== undefined && body.role !== existing.role) {
      return res.status(403).json({
        status: 'error',
        message: 'Tidak dapat mengubah role akun sendiri. Minta admin lain untuk melakukannya.',
      });
    }
    if (isSelf && body.status !== undefined && body.status !== existing.status) {
      return res.status(403).json({
        status: 'error',
        message: 'Tidak dapat mengubah status akun sendiri (mencegah akun terkunci).',
      });
    }

    const nextRole = body.role ?? existing.role;
    let nextStatus: string = body.status ?? existing.status;

    // Jika role diubah tanpa menyebut status, sesuaikan status agar akun tidak
    // "terjebak" pada status verifikasi petugas yang tidak relevan lagi.
    if (body.status === undefined && body.role !== undefined) {
      if (nextRole === 'admin' && existing.status !== 'NONAKTIF') {
        nextStatus = 'AKTIF';
      }
      if (nextRole === 'masyarakat' && ['MENUNGGU_VERIFIKASI', 'DITOLAK'].includes(existing.status)) {
        nextStatus = 'AKTIF';
      }
    }

    const wasActiveAdmin = existing.role === 'admin' && existing.status === 'AKTIF';
    const willBeActiveAdmin = nextRole === 'admin' && nextStatus === 'AKTIF';

    // Sistem wajib selalu memiliki minimal satu ADMIN aktif.
    if (wasActiveAdmin && !willBeActiveAdmin) {
      const activeAdmins = await prisma.users.count({ where: { role: 'admin', status: 'AKTIF' } });
      if (activeAdmins <= 1) {
        return res.status(403).json({
          status: 'error',
          message: 'Sistem harus memiliki minimal satu akun ADMIN aktif. Perubahan dibatalkan.',
        });
      }
    }

    const data: Record<string, unknown> = {};
    if (body.nama !== undefined) data.nama = body.nama;
    if (body.email !== undefined) data.email = body.email;
    if (body.role !== undefined) data.role = body.role;
    if (body.status !== undefined || nextStatus !== existing.status) data.status = nextStatus;
    if (body.username !== undefined) {
      const username = body.username === null ? '' : String(body.username).trim();
      data.username = username ? username : null;
    }

    const phone = resolvePhoneInput(body.no_hp);
    if (phone.provided) {
      if (!phone.valid) {
        return res.status(400).json({
          status: 'error',
          message: 'Format nomor HP tidak valid. Gunakan nomor Indonesia, contoh 081234567890.',
        });
      }
      data.no_hp = phone.raw;
      data.no_hp_normalized = phone.normalized;
    }

    const conflict = await findUserConflict(id, {
      email: data.email as string | undefined,
      username: data.username as string | null | undefined,
      phoneNormalized: data.no_hp_normalized as string | null | undefined,
    });
    if (conflict) {
      return res.status(409).json({ status: 'error', message: conflict });
    }

    const roleChanged = existing.role !== nextRole;
    const statusChanged = existing.status !== nextStatus;

    // Update + notifikasi dalam satu transaksi agar konsisten.
    const updated = await prisma.$transaction(async (tx) => {
      const row = await tx.users.update({
        where: { id },
        data,
        select: USER_PUBLIC_SELECT,
      });

      if (roleChanged || statusChanged) {
        const pesan =
          nextStatus === 'NONAKTIF'
            ? 'Akun Anda telah dinonaktifkan oleh administrator. Hubungi Admin untuk informasi lebih lanjut.'
            : roleChanged
              ? `Role akun Anda telah diubah menjadi ${nextRole} oleh administrator.`
              : 'Status akun Anda telah diperbarui oleh administrator.';
        await tx.notifications.create({
          data: {
            user_id: id,
            type: 'SISTEM',
            judul: 'Perubahan Akun',
            pesan,
          },
        });
      }

      return row;
    });

    logger.audit('admin_user_updated', {
      adminId,
      userId: id,
      fields: Object.keys(data),
      roleFrom: existing.role,
      roleTo: nextRole,
      statusFrom: existing.status,
      statusTo: nextStatus,
    });

    return res.status(200).json({
      status: 'success',
      message: 'Data pengguna berhasil diperbarui',
      data: updated,
    });
  } catch (error: any) {
    const unique = uniqueFieldMessage(error);
    if (unique) {
      return res.status(409).json({ status: 'error', message: unique });
    }
    if (error instanceof HttpError) {
      return res.status(error.statusCode).json({ status: 'error', message: error.message });
    }
    return res.status(500).json({ status: 'error', message: 'Gagal memperbarui data pengguna' });
  }
};

/**
 * DELETE /api/admin/users/:id
 *
 * Penghapusan dilakukan dengan audit relasi terlebih dahulu:
 *  - jika akun memiliki riwayat (laporan, notifikasi, percakapan, tugas,
 *    riwayat status, dll) → akun DINONAKTIFKAN (soft delete), data tetap utuh;
 *  - jika benar-benar tanpa relasi → hapus permanen dalam transaksi.
 * Laporan TIDAK PERNAH ikut terhapus.
 */
export const deleteUser = async (req: AuthRequest, res: Response) => {
  try {
    const adminId = req.user?.id;
    if (!adminId) {
      return res.status(401).json({ status: 'error', message: 'Unauthorized' });
    }

    const { id } = req.params;
    if (adminId === id) {
      return res.status(403).json({
        status: 'error',
        message: 'Tidak dapat menghapus akun sendiri yang sedang digunakan untuk login.',
      });
    }

    const target = await prisma.users.findUnique({
      where: { id },
      select: { id: true, nama: true, email: true, role: true, status: true },
    });
    if (!target) {
      return res.status(404).json({ status: 'error', message: 'Pengguna tidak ditemukan' });
    }

    // Admin terakhir yang aktif tidak boleh dihapus/dinonaktifkan.
    if (target.role === 'admin' && target.status === 'AKTIF') {
      const activeAdmins = await prisma.users.count({ where: { role: 'admin', status: 'AKTIF' } });
      if (activeAdmins <= 1) {
        return res.status(403).json({
          status: 'error',
          message: 'Sistem harus memiliki minimal satu akun ADMIN aktif. Akun ini tidak dapat dihapus.',
        });
      }
    }

    const [
      reports,
      assignments,
      reportUpdates,
      notifications,
      conversations,
      chatAnalytics,
      whatsappPreferences,
      telegramLinkCodes,
      telegramMessageLogs,
    ] = await Promise.all([
      prisma.reports.count({ where: { user_id: id } }),
      prisma.assignments.count({ where: { petugas_id: id } }),
      prisma.report_updates.count({ where: { petugas_id: id } }),
      prisma.notifications.count({ where: { user_id: id } }),
      prisma.conversations.count({ where: { user_id: id } }),
      prisma.chat_analytics.count({ where: { user_id: id } }),
      prisma.user_whatsapp_preferences.count({ where: { user_id: id } }),
      prisma.telegram_link_codes.count({ where: { user_id: id } }),
      prisma.telegram_message_logs.count({ where: { user_id: id } }),
    ]);

    const relations = {
      reports,
      assignments,
      report_updates: reportUpdates,
      notifications,
      conversations,
      chat_analytics: chatAnalytics,
      whatsapp_preferences: whatsappPreferences,
      telegram_link_codes: telegramLinkCodes,
      telegram_message_logs: telegramMessageLogs,
    };

    // Riwayat yang wajib dipertahankan (telegram_message_logs tidak dihitung:
    // FK-nya SET NULL sehingga log tetap ada setelah akun dihapus).
    const hasHistory =
      reports + assignments + reportUpdates + notifications + conversations +
      chatAnalytics + whatsappPreferences + telegramLinkCodes > 0;

    if (hasHistory) {
      const updated = await prisma.users.update({
        where: { id },
        data: { status: 'NONAKTIF' },
        select: { id: true, nama: true, email: true, role: true, status: true },
      });

      logger.audit('admin_user_deactivated', {
        adminId,
        userId: id,
        email: target.email,
        role: target.role,
        relations,
        mode: 'soft_delete',
      });

      return res.status(200).json({
        status: 'success',
        mode: 'soft_delete',
        message:
          'Akun dinonaktifkan karena memiliki riwayat data. Laporan, notifikasi, dan percakapan tetap tersimpan.',
        relations,
        data: updated,
      });
    }

    // Tidak ada relasi historis → aman dihapus permanen.
    await prisma.$transaction(async (tx) => {
      await tx.users.delete({ where: { id } });
    });

    logger.audit('admin_user_deleted', {
      adminId,
      userId: id,
      email: target.email,
      role: target.role,
      relations,
      mode: 'hard_delete',
    });

    return res.status(200).json({
      status: 'success',
      mode: 'hard_delete',
      message: 'Akun berhasil dihapus permanen.',
      relations,
    });
  } catch (error: any) {
    return res.status(500).json({ status: 'error', message: 'Gagal menghapus pengguna' });
  }
};


/**
 * GET /api/admin/users/lookup?phone=08...
 * Mencari akun berdasarkan nomor WhatsApp (semua role) untuk keperluan
 * verifikasi/elevasi. Hanya admin. Tidak mengembalikan data sensitif.
 */
export const lookupUserByPhone = async (req: Request, res: Response) => {
  try {
    const raw = typeof req.query.phone === 'string' ? req.query.phone : '';
    const normalized = normalizePhone(raw);
    if (!normalized) {
      return res.status(400).json({ status: 'error', message: 'Nomor WhatsApp tidak valid' });
    }

    const user = await prisma.users.findFirst({
      where: {
        OR: [
          { no_hp_normalized: normalized },
          { no_hp: { in: phoneLookupVariants(normalized) } },
        ],
      },
      select: {
        id: true,
        nama: true,
        email: true,
        role: true,
        status: true,
        no_hp: true,
        no_hp_normalized: true,
        created_at: true,
      },
    });

    logger.audit('admin_phone_lookup', {
      adminId: (req as any).user?.id,
      phone: maskPhone(normalized),
      found: Boolean(user),
    });

    if (!user) {
      return res.status(404).json({
        status: 'error',
        found: false,
        message: 'Tidak ada akun terdaftar dengan nomor WhatsApp tersebut',
      });
    }

    return res.status(200).json({
      status: 'success',
      found: true,
      data: { ...user, phone_masked: maskPhone(normalized) },
    });
  } catch (error: any) {
    return res.status(500).json({ status: 'error', message: 'Gagal mencari akun' });
  }
};

export const getActivityLog = async (req: Request, res: Response) => {
  try {
    const activities = await prisma.report_updates.findMany({
      include: {
        petugas: { select: { id: true, nama: true } },
        report: { select: { id: true, judul: true, status: true, kategori: true } },
      },
      orderBy: { created_at: 'desc' },
      take: 15,
    });

    return res.status(200).json({ status: 'success', data: activities });
  } catch (error: any) {
    return res.status(500).json({ status: 'error', message: 'Gagal mengambil aktivitas petugas' });
  }
};

export const assignPetugas = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { petugas_id } = req.body;

    if (!petugas_id) {
      return res.status(400).json({ status: 'error', message: 'ID Petugas wajib diisi' });
    }

    // Ambil data laporan dan petugas
    const [report, petugas] = await Promise.all([
      prisma.reports.findUnique({ where: { id } }),
      prisma.users.findUnique({ where: { id: petugas_id } })
    ]);

    if (!report) {
      return res.status(404).json({ status: 'error', message: 'Laporan tidak ditemukan' });
    }
    if (!petugas) {
      return res.status(404).json({ status: 'error', message: 'Petugas tidak ditemukan' });
    }
    if (petugas.role !== 'petugas') {
      return res.status(400).json({ status: 'error', message: 'User yang dipilih bukan petugas' });
    }

    // Assign petugas
    const assignment = await prisma.assignments.create({
      data: {
        report_id: id,
        petugas_id: petugas_id
      }
    });

    // Pemicu Notifikasi (In-App & Email): Tugas Baru untuk Petugas
    notificationService.notifyTugasBaru(
      petugas_id,
      report,
      petugas.email,
      petugas.nama
    ).catch((err: unknown) => {
      console.error('[Notification] Gagal mengirim notifikasi tugas baru:', err);
    });

    return res.status(201).json({
      status: 'success',
      message: 'Petugas berhasil ditugaskan',
      data: assignment
    });
  } catch (error: any) {
    // Catch unique constraint violation if already assigned
    if (error.code === 'P2002') {
      return res.status(400).json({ status: 'error', message: 'Petugas ini sudah ditugaskan pada laporan tersebut' });
    }
    return res.status(500).json({ status: 'error', message: 'Gagal menugaskan petugas' });
  }
};

/**
 * PATCH /api/admin/assignments/:reportId — pindah petugas penugasan.
 *
 * Notifikasi dikirim ke petugas lama (penugasan berubah) dan petugas baru
 * (tugas baru), lewat WhatsApp (Fonnte) + in-app.
 */
export const changeAssignmentPetugas = async (req: AuthRequest, res: Response) => {
  try {
    const { reportId } = req.params;
    const { petugas_id } = req.body as { petugas_id?: string };

    if (!petugas_id) {
      return res.status(400).json({ status: 'error', message: 'ID Petugas wajib diisi' });
    }

    const [report, assignment, petugasBaru] = await Promise.all([
      prisma.reports.findUnique({ where: { id: reportId } }),
      prisma.assignments.findFirst({
        where: { report_id: reportId },
        include: { petugas: { select: { id: true, nama: true, email: true } } },
      }),
      prisma.users.findUnique({ where: { id: petugas_id } }),
    ]);

    if (!report) {
      return res.status(404).json({ status: 'error', message: 'Laporan tidak ditemukan' });
    }
    if (!petugasBaru) {
      return res.status(404).json({ status: 'error', message: 'Petugas tidak ditemukan' });
    }
    if (petugasBaru.role !== 'petugas') {
      return res.status(400).json({ status: 'error', message: 'User yang dipilih bukan petugas' });
    }
    if (!assignment) {
      return res.status(404).json({ status: 'error', message: 'Laporan ini belum memiliki penugasan' });
    }
    if (assignment.petugas_id === petugas_id) {
      return res.status(200).json({
        status: 'success',
        message: 'Penugasan tetap pada petugas yang sama',
        data: assignment,
      });
    }

    const updated = await prisma.$transaction(async (tx) => {
      await tx.assignments.delete({ where: { id: assignment.id } });
      return tx.assignments.create({
        data: { report_id: reportId, petugas_id },
      });
    });

    // Petugas lama: penugasan berubah.
    notificationService.notifyPenugasanBerubah(
      assignment.petugas_id,
      report,
      'Penugasan laporan ini dipindahkan ke petugas lain.',
      assignment.petugas.email,
      assignment.petugas.nama
    ).catch((err: unknown) => logger.error('Notifikasi perubahan penugasan error', { error: err instanceof Error ? err.message : String(err) }));

    // Petugas baru: tugas baru.
    notificationService.notifyTugasBaru(
      petugas_id,
      report,
      petugasBaru.email,
      petugasBaru.nama
    ).catch((err: unknown) => logger.error('Notifikasi tugas baru error', { error: err instanceof Error ? err.message : String(err) }));

    logger.audit('assignment_changed', {
      adminId: req.user?.id,
      reportId,
      from: assignment.petugas_id,
      to: petugas_id,
    });

    return res.status(200).json({
      status: 'success',
      message: 'Penugasan petugas berhasil diperbarui',
      data: updated,
    });
  } catch (error: any) {
    if (error?.code === 'P2002') {
      return res.status(400).json({ status: 'error', message: 'Petugas ini sudah ditugaskan pada laporan tersebut' });
    }
    return res.status(500).json({ status: 'error', message: 'Gagal mengubah penugasan petugas' });
  }
};

/**
 * DELETE /api/admin/assignments/:reportId/:petugasId — batalkan penugasan.
 */
export const cancelAssignment = async (req: AuthRequest, res: Response) => {
  try {
    const { reportId, petugasId } = req.params;

    const [report, assignment] = await Promise.all([
      prisma.reports.findUnique({ where: { id: reportId } }),
      prisma.assignments.findFirst({
        where: { report_id: reportId, petugas_id: petugasId },
        include: { petugas: { select: { id: true, nama: true, email: true } } },
      }),
    ]);

    if (!report) {
      return res.status(404).json({ status: 'error', message: 'Laporan tidak ditemukan' });
    }
    if (!assignment) {
      return res.status(404).json({ status: 'error', message: 'Penugasan tidak ditemukan' });
    }

    await prisma.assignments.delete({ where: { id: assignment.id } });

    notificationService.notifyTugasDibatalkan(
      petugasId,
      report,
      assignment.petugas.email,
      assignment.petugas.nama
    ).catch((err: unknown) => logger.error('Notifikasi pembatalan penugasan error', { error: err instanceof Error ? err.message : String(err) }));

    logger.audit('assignment_cancelled', {
      adminId: req.user?.id,
      reportId,
      petugasId,
    });

    return res.status(200).json({
      status: 'success',
      message: 'Penugasan berhasil dibatalkan',
      data: { id: assignment.id, report_id: reportId, petugas_id: petugasId },
    });
  } catch (error: any) {
    return res.status(500).json({ status: 'error', message: 'Gagal membatalkan penugasan' });
  }
};

export const updateReportPriority = async (req: Request, res: Response) => {  try {
    const { id } = req.params;
    const { priority } = req.body; // zod-validated

    const existingReport = await prisma.reports.findUnique({
      where: { id },
      include: {
        assignments: {
          include: { petugas: { select: { id: true, nama: true, email: true } } }
        }
      }
    });

    if (!existingReport) {
      return res.status(404).json({ status: 'error', message: 'Laporan tidak ditemukan' });
    }

    const oldPriority = existingReport.ai_priority || 'Normal';

    const updated = await prisma.reports.update({
      where: { id },
      data: { ai_priority: priority }
    });

    // Pemicu Notifikasi (In-App & Email): Perubahan Prioritas untuk seluruh Petugas yang ditugaskan
    if (existingReport.assignments && existingReport.assignments.length > 0) {
      existingReport.assignments.forEach(a => {
        notificationService.notifyPerubahanPrioritas(
          a.petugas_id,
          updated,
          oldPriority,
          priority,
          a.petugas.email,
          a.petugas.nama
        ).catch((err: unknown) => {
          console.error('[Notification] Gagal mengirim notifikasi perubahan prioritas:', err);
        });
      });
    }

    return res.status(200).json({
      status: 'success',
      message: 'Prioritas laporan berhasil diperbarui',
      data: updated
    });
  } catch (error: any) {
    return res.status(500).json({ status: 'error', message: 'Gagal memperbarui prioritas laporan' });
  }
};

export const getAssignments = async (req: Request, res: Response) => {
  try {
    const page = Math.max(parseInt(req.query.page as string) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit as string) || 10, 1), 50);
    const status = req.query.status as string | undefined;

    const whereClause: any = {};
    if (status && status !== 'ALL') {
      whereClause.report = { status };
    }

    const [assignments, total] = await Promise.all([
      prisma.assignments.findMany({
        where: whereClause,
        include: {
          petugas: { select: { id: true, nama: true, email: true } },
          report: {
            select: {
              id: true,
              judul: true,
              kategori: true,
              status: true,
              lokasi: true,
              ai_priority: true,
              created_at: true,
            },
          },
        },
        orderBy: { assigned_at: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.assignments.count({ where: whereClause }),
    ]);

    return res.status(200).json({
      status: 'success',
      data: assignments,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (error: any) {
    return res.status(500).json({ status: 'error', message: 'Gagal mengambil daftar penugasan' });
  }
};

export const updateUserRole = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { role } = req.body as { role: 'masyarakat' | 'petugas' | 'admin' };

    // Defense in depth: validasi ulang di controller (selain Zod).
    if (!['masyarakat', 'petugas', 'admin'].includes(role)) {
      return res.status(400).json({ status: 'error', message: 'Role tidak valid' });
    }

    // Admin tidak boleh mengubah role dirinya sendiri (cegah lockout).
    if (req.user?.id === id) {
      return res.status(403).json({ status: 'error', message: 'Tidak dapat mengubah role akun sendiri' });
    }

    const existing = await prisma.users.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ status: 'error', message: 'Pengguna tidak ditemukan' });
    }

    if (existing.role === role) {
      return res.status(200).json({
        status: 'success',
        message: 'Role pengguna tidak berubah',
        data: { id: existing.id, nama: existing.nama, email: existing.email, role: existing.role, created_at: existing.created_at },
      });
    }

    // Sistem wajib selalu memiliki minimal satu ADMIN aktif.
    if (existing.role === 'admin' && existing.status === 'AKTIF' && role !== 'admin') {
      const activeAdmins = await prisma.users.count({ where: { role: 'admin', status: 'AKTIF' } });
      if (activeAdmins <= 1) {
        return res.status(403).json({
          status: 'error',
          message: 'Sistem harus memiliki minimal satu akun ADMIN aktif. Role akun ini tidak dapat diturunkan.',
        });
      }
    }

    // Promosi ke admin juga mengaktifkan akun (agar bisa login & memakai dashboard).
    const updated = await prisma.users.update({
      where: { id },
      data: role === 'admin' ? { role: role as any, status: 'AKTIF' } : { role: role as any },
      select: { id: true, nama: true, email: true, role: true, status: true, no_hp: true, created_at: true },
    });

    logger.audit('user_role_updated', {
      adminId: req.user?.id,
      userId: id,
      from: existing.role,
      to: role,
      phone: existing.no_hp_normalized ?? maskPhone(existing.no_hp),
    });

    // Beri tahu pemilik akun (in-app). Kegagalan notifikasi tidak membatalkan perubahan.
    try {
      await prisma.notifications.create({
        data: {
          user_id: id,
          type: 'SISTEM',
          judul: 'Perubahan Hak Akses Akun',
          pesan:
            role === 'admin'
              ? 'Hak akses akun Anda telah ditingkatkan menjadi Admin oleh administrator yang berwenang.'
              : `Role akun Anda telah diubah menjadi ${role} oleh administrator.`,
        },
      });
    } catch {
      // diabaikan
    }

    return res.status(200).json({ status: 'success', message: 'Role pengguna berhasil diperbarui', data: updated });
  } catch (error: any) {
    return res.status(500).json({ status: 'error', message: 'Gagal memperbarui role pengguna' });
  }
};

export const listPendingPetugas = async (req: Request, res: Response) => {
  try {
    const page = Math.max(parseInt(req.query.page as string) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit as string) || 10, 1), 50);

    const whereClause: any = { role: 'petugas', status: 'MENUNGGU_VERIFIKASI' };

    const [items, total] = await Promise.all([
      prisma.users.findMany({
        where: whereClause,
        select: {
          id: true,
          nama: true,
          email: true,
          role: true,
          status: true,
          no_hp: true,
          nip: true,
          instansi: true,
          wilayah: true,
          created_at: true,
        },
        orderBy: { created_at: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.users.count({ where: whereClause }),
    ]);

    return res.status(200).json({
      status: 'success',
      data: items,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (error: any) {
    return res.status(500).json({ status: 'error', message: 'Gagal mengambil pengajuan petugas' });
  }
};

export const verifyPetugas = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { action } = req.body as { action: 'APPROVE' | 'REJECT' };

    const target = await prisma.users.findUnique({ where: { id } });
    if (!target) {
      return res.status(404).json({ status: 'error', message: 'Pengguna tidak ditemukan' });
    }
    if (target.role !== 'petugas' || target.status !== 'MENUNGGU_VERIFIKASI') {
      return res.status(400).json({ status: 'error', message: 'Hanya pengajuan petugas yang menunggu verifikasi yang dapat diproses' });
    }

    const newStatus = action === 'APPROVE' ? 'AKTIF' : 'DITOLAK';
    const updated = await prisma.users.update({
      where: { id },
      data: { status: newStatus as any },
      select: { id: true, nama: true, email: true, role: true, status: true, created_at: true },
    });

    logger.audit('petugas_verified', { adminId: req.user?.id, userId: id, action, newStatus });

    // Beri tahu petugas lewat notifikasi in-app
    await prisma.notifications.create({
      data: {
        user_id: id,
        type: 'SISTEM',
        judul: action === 'APPROVE' ? 'Akun Petugas Disetujui' : 'Pengajuan Akun Ditolak',
        pesan:
          action === 'APPROVE'
            ? 'Selamat! Akun petugas Anda telah disetujui. Silakan login untuk mengakses Dashboard Petugas.'
            : 'Mohon maaf, pengajuan akun petugas Anda belum disetujui. Hubungi Admin untuk informasi lebih lanjut.',
      },
    });

    return res.status(200).json({
      status: 'success',
      message: action === 'APPROVE' ? 'Akun petugas disetujui' : 'Pengajuan petugas ditolak',
      data: updated,
    });
  } catch (error: any) {
    return res.status(500).json({ status: 'error', message: 'Gagal memverifikasi akun petugas' });
  }
};
