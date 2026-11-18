import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import prisma from '../utils/db';
import { generateToken } from '../utils/jwt';
import { AuthRequest } from '../middlewares/auth.middleware';
import { logger } from '../utils/logger';
import { normalizePhone, phoneLookupVariants, maskPhone } from '../utils/phone';
import { notificationService } from '../services/notification/notification.service';

export const register = async (req: Request, res: Response) => {
  try {
    const { nama, email, password, role, no_hp, nip, instansi, wilayah } = req.body;

    // Registrasi publik TIDAK boleh menghasilkan admin.
    // 'admin' ditolak eksplisit; hanya masyarakat (langsung aktif) dan
    // petugas (menunggu verifikasi admin) yang diizinkan.
    if (role === 'admin' || (role && !['masyarakat', 'petugas'].includes(role))) {
      logger.audit('register_rejected', { email, reason: 'role_not_allowed' });
      return res.status(403).json({ status: 'error', message: 'Peran tersebut tidak dapat didaftarkan secara publik' });
    }

    // Nomor WhatsApp opsional, tetapi bila diisi harus valid & dinormalisasi.
    const phoneNormalized = no_hp ? normalizePhone(no_hp) : null;
    if (no_hp && !phoneNormalized) {
      return res.status(400).json({ status: 'error', message: 'Format nomor WhatsApp tidak valid' });
    }

    const existingUser = await prisma.users.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(409).json({ status: 'error', message: 'Email sudah terdaftar' });
    }

    if (phoneNormalized) {
      const phoneTaken = await prisma.users.findFirst({
        where: {
          OR: [
            { no_hp_normalized: phoneNormalized },
            { no_hp: { in: phoneLookupVariants(phoneNormalized) } },
          ],
        },
        select: { id: true },
      });
      if (phoneTaken) {
        return res.status(409).json({ status: 'error', message: 'Nomor WhatsApp sudah terdaftar' });
      }
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // Petugas TIDAK langsung aktif — menunggu verifikasi admin.
    // Status ditentukan backend, tidak pernah dari input mentah.
    const isPetugas = role === 'petugas';
    const user = await prisma.users.create({
      data: {
        nama,
        email,
        password: hashedPassword,
        role: isPetugas ? 'petugas' : 'masyarakat',
        status: isPetugas ? 'MENUNGGU_VERIFIKASI' : 'AKTIF',
        no_hp: no_hp ? String(no_hp).trim() : null,
        no_hp_normalized: phoneNormalized,
        nip: nip || null,
        instansi: instansi || null,
        wilayah: wilayah || null,
      },
      select: { id: true, nama: true, email: true, role: true, status: true, no_hp: true, created_at: true },
    });

    logger.audit('user_register', { userId: user.id, email: user.email, role: user.role, status: user.status });

    // Kirim notifikasi registrasi (WhatsApp ke Admin & User)
    notificationService.notifyUserRegistrationAdmin({
      id: user.id,
      nama: user.nama,
      email: user.email,
      role: user.role,
      no_hp: user.no_hp ?? undefined,
      status: user.status,
      created_at: user.created_at,
    }).catch((err: unknown) => logger.error('Telegram registration admin notify error', { error: err instanceof Error ? err.message : String(err) }));

    notificationService.notifyUserRegistrationUser(
      user.id,
      { nama: user.nama, email: user.email, role: user.role, status: user.status },
      user.email,
      user.nama
    ).catch((err: unknown) => logger.error('WhatsApp registration user notify error', { error: err instanceof Error ? err.message : String(err) }));

    return res.status(201).json({
      status: 'success',
      message: isPetugas
        ? 'Registrasi berhasil dikirim. Akun Anda menunggu verifikasi Admin.'
        : 'Registrasi berhasil',
      data: user,
    });
  } catch (error: any) {
    return res.status(500).json({ status: 'error', message: 'Terjadi kesalahan pada server' });
  }
};

export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    const user = await prisma.users.findUnique({ where: { email } });
    if (!user) {
      logger.audit('login_failed', { email, reason: 'user_not_found' });
      return res.status(401).json({ status: 'error', message: 'Kredensial tidak valid' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      logger.audit('login_failed', { email, reason: 'bad_password' });
      return res.status(401).json({ status: 'error', message: 'Kredensial tidak valid' });
    }

    // Akun nonaktif tidak boleh masuk: petugas menunggu verifikasi / ditolak,
    // atau akun yang dinonaktifkan admin (NONAKTIF).
    if (user.status !== 'AKTIF') {
      logger.audit('login_failed', { email, reason: `account_${user.status}` });
      return res.status(403).json({
        status: 'error',
        message:
          user.status === 'MENUNGGU_VERIFIKASI'
            ? 'Akun Anda menunggu verifikasi Admin. Silakan coba lagi setelah disetujui.'
            : user.status === 'NONAKTIF'
              ? 'Akun Anda dinonaktifkan. Hubungi Admin untuk informasi lebih lanjut.'
              : 'Akun Anda ditolak. Hubungi Admin untuk informasi lebih lanjut.',
      });
    }

    const token = generateToken({ userId: user.id, role: user.role });
    logger.audit('login_success', { userId: user.id, email: user.email });

    // Kirim notifikasi login ke pengguna (jika diaktifkan di preferensi)
    const ua = req.headers['user-agent'];
    const ip = req.ip ?? req.socket.remoteAddress;
    notificationService.notifyUserLogin(user.id, {
      ip,
      userAgent: ua,
      timestamp: new Date(),
    }).catch((err: unknown) => logger.error('WhatsApp login notify error', { error: err instanceof Error ? err.message : String(err) }));

    return res.status(200).json({
      status: 'success',
      message: 'Login berhasil',
      data: {
        token,
        user: { id: user.id, nama: user.nama, username: user.username, email: user.email, role: user.role, status: user.status, must_change_password: user.must_change_password },
      },
    });
  } catch (error: any) {
    return res.status(500).json({ status: 'error', message: 'Terjadi kesalahan pada server' });
  }
};

export const me = async (req: AuthRequest, res: Response) => {  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ status: 'error', message: 'Unauthorized' });
    }

    const user = await prisma.users.findUnique({
      where: { id: userId },
      select: { id: true, nama: true, username: true, email: true, role: true, status: true, no_hp: true, nip: true, instansi: true, wilayah: true, created_at: true },
    });

    if (!user) {
      return res.status(404).json({ status: 'error', message: 'User tidak ditemukan' });
    }

    return res.status(200).json({ status: 'success', data: user });
  } catch (error: any) {
    return res.status(500).json({ status: 'error', message: 'Terjadi kesalahan pada server' });
  }
};

export const updateProfile = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ status: 'error', message: 'Unauthorized' });
    }

    const { nama, email, no_hp, username } = req.body as {
      nama?: string;
      email?: string;
      no_hp?: string | null;
      username?: string | null;
    };

    const data: Record<string, unknown> = {};
    if (nama !== undefined) data.nama = nama;
    if (email !== undefined) data.email = email;
    if (username !== undefined) {
      const uname = username === null ? '' : String(username).trim();
      data.username = uname ? uname : null;
    }
    if (no_hp !== undefined) {
      const raw = no_hp === null ? '' : String(no_hp).trim();
      if (!raw) {
        data.no_hp = null;
        data.no_hp_normalized = null;
      } else {
        const normalized = normalizePhone(raw);
        if (!normalized) {
          return res.status(400).json({
            status: 'error',
            message: 'Format nomor HP tidak valid. Gunakan nomor Indonesia, contoh 081234567890.',
          });
        }
        data.no_hp = raw;
        data.no_hp_normalized = normalized;
      }
    }

    // Cek konflik email/username/nomor HP dengan akun lain.
    const or: any[] = [];
    if (email) or.push({ email: { equals: email, mode: 'insensitive' } });
    if (data.username) or.push({ username: data.username });
    if (data.no_hp_normalized) or.push({ no_hp_normalized: data.no_hp_normalized });

    if (or.length > 0) {
      const conflict = await prisma.users.findFirst({
        where: { OR: or, NOT: { id: userId } },
        select: { email: true, username: true, no_hp_normalized: true },
      });
      if (conflict) {
        if (email && conflict.email.toLowerCase() === email.toLowerCase()) {
          return res.status(409).json({ status: 'error', message: 'Email sudah digunakan akun lain' });
        }
        if (data.username && conflict.username === data.username) {
          return res.status(409).json({ status: 'error', message: 'Username sudah digunakan akun lain' });
        }
        if (data.no_hp_normalized && conflict.no_hp_normalized === data.no_hp_normalized) {
          return res.status(409).json({ status: 'error', message: 'Nomor HP sudah digunakan akun lain' });
        }
      }
    }

    const user = await prisma.users.update({
      where: { id: userId },
      data,
      select: {
        id: true,
        nama: true,
        username: true,
        email: true,
        no_hp: true,
        role: true,
        status: true,
        must_change_password: true,
        created_at: true,
      },
    });

    logger.audit('profile_updated', { userId, fields: Object.keys(data) });

    return res.status(200).json({ status: 'success', message: 'Profil berhasil diperbarui', data: user });
  } catch (error: any) {
    if (error?.code === 'P2025') {
      return res.status(404).json({ status: 'error', message: 'User tidak ditemukan' });
    }
    if (error?.code === 'P2002') {
      const target = Array.isArray(error?.meta?.target) ? error.meta.target.join(',') : String(error?.meta?.target ?? '');
      const message = target.includes('email')
        ? 'Email sudah digunakan akun lain'
        : target.includes('username')
          ? 'Username sudah digunakan akun lain'
          : 'Nomor HP sudah digunakan akun lain';
      return res.status(409).json({ status: 'error', message });
    }
    return res.status(500).json({ status: 'error', message: 'Terjadi kesalahan pada server' });
  }
};

export const changePassword = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ status: 'error', message: 'Unauthorized' });
    }

    const { currentPassword, newPassword } = req.body as {
      currentPassword: string;
      newPassword: string;
    };

    const user = await prisma.users.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(404).json({ status: 'error', message: 'User tidak ditemukan' });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      logger.audit('password_change_failed', { userId, reason: 'bad_current_password' });
      return res.status(401).json({ status: 'error', message: 'Password saat ini salah' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await prisma.users.update({
      where: { id: userId },
      data: { password: hashedPassword, must_change_password: false },
    });

    logger.audit('password_changed', { userId });

    return res.status(200).json({ status: 'success', message: 'Password berhasil diubah' });
  } catch (error: any) {
    return res.status(500).json({ status: 'error', message: 'Terjadi kesalahan pada server' });
  }
};

// ---------- Undangan Admin berbasis nomor WhatsApp ----------

function hashInviteToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function safeHashEquals(a: string, b: string): boolean {
  try {
    const ba = Buffer.from(a, 'hex');
    const bb = Buffer.from(b, 'hex');
    return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}

/**
 * POST /api/auth/admin-invite/accept
 *
 * Menerima token undangan Admin yang diberikan operator di luar sistem
 * (mis. via WhatsApp). Syarat:
 *  - pengguna sudah login (akun AKTIF),
 *  - akun memiliki nomor WhatsApp yang cocok dengan undangan,
 *  - token cocok dengan hash, belum dipakai, dan belum kedaluwarsa.
 *
 * Role dinaikkan oleh BACKEND (bukan input pengguna). Token tidak pernah
 * disimpan mentah, dicatat di log, atau dikembalikan dalam respons.
 */
export const acceptAdminInvite = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ status: 'error', message: 'Unauthorized' });
    }

    const { token } = req.body as { token: string };
    const user = await prisma.users.findUnique({
      where: { id: userId },
      select: {
        id: true,
        nama: true,
        email: true,
        role: true,
        status: true,
        no_hp: true,
        no_hp_normalized: true,
      },
    });
    if (!user) {
      return res.status(404).json({ status: 'error', message: 'Pengguna tidak ditemukan' });
    }

    // Idempoten: akun yang sudah admin tidak perlu diproses lagi.
    if (user.role === 'admin') {
      return res.status(200).json({
        status: 'success',
        message: 'Akun ini sudah memiliki akses Admin',
        data: { id: user.id, nama: user.nama, email: user.email, role: 'admin', status: user.status },
      });
    }

    const phone = user.no_hp_normalized ?? normalizePhone(user.no_hp);
    if (!phone) {
      return res.status(400).json({
        status: 'error',
        message: 'Akun belum memiliki nomor WhatsApp. Lengkapi nomor pada profil/registrasi terlebih dahulu.',
      });
    }

    const now = new Date();
    const invites = await prisma.admin_invitations.findMany({
      where: { phone_normalized: phone, used_at: null, expires_at: { gt: now } },
      orderBy: { created_at: 'desc' },
      take: 10,
    });

    const providedHash = hashInviteToken(token);
    const match = invites.find((inv) => safeHashEquals(inv.token_hash, providedHash));

    if (!match) {
      logger.audit('admin_invite_rejected', {
        userId,
        phone: maskPhone(phone),
        reason: 'invalid_or_expired',
      });
      return res.status(403).json({
        status: 'error',
        message: 'Token undangan tidak valid atau sudah kedaluwarsa',
      });
    }

    const [updated] = await prisma.$transaction([
      prisma.users.update({
        where: { id: userId },
        data: { role: 'admin', status: 'AKTIF' },
        select: { id: true, nama: true, email: true, role: true, status: true },
      }),
      prisma.admin_invitations.update({
        where: { id: match.id },
        data: { used_at: now, used_by: userId },
      }),
    ]);

    logger.audit('admin_invite_accepted', {
      userId,
      invitationId: match.id,
      phone: maskPhone(phone),
    });

    // Notifikasi in-app (kegagalan notifikasi tidak membatalkan aktivasi).
    try {
      await prisma.notifications.create({
        data: {
          user_id: userId,
          type: 'SISTEM',
          judul: 'Akses Admin Diaktifkan',
          pesan:
            'Nomor WhatsApp Anda telah diverifikasi. Akun Anda kini memiliki akses Admin SIPANTAU Cirebon.',
        },
      });
    } catch {
      // diabaikan
    }

    return res.status(200).json({
      status: 'success',
      message: 'Akses Admin berhasil diaktifkan',
      data: updated,
    });
  } catch (error: any) {
    return res.status(500).json({ status: 'error', message: 'Terjadi kesalahan pada server' });
  }
};
