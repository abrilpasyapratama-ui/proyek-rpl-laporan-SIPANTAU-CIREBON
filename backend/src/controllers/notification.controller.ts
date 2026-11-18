import { Response } from 'express';
import prisma from '../utils/db';
import { AuthRequest } from '../middlewares/auth.middleware';

/**
 * Controller untuk In-App Notification Center
 */

// 1. Mengambil daftar notifikasi milik pengguna yang sedang login
export const getMyNotifications = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ status: 'error', message: 'Unauthorized' });

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 15;
    const unreadOnly = req.query.unread_only === 'true';
    const type = req.query.type as any;

    const skip = (page - 1) * limit;

    const whereClause: any = { user_id: userId };
    if (unreadOnly) {
      whereClause.is_read = false;
    }
    if (type && type !== 'ALL') {
      whereClause.type = type;
    }

    const [notifications, total, unreadCount] = await Promise.all([
      prisma.notifications.findMany({
        where: whereClause,
        orderBy: { created_at: 'desc' },
        skip,
        take: limit,
        include: {
          report: {
            select: {
              id: true,
              judul: true,
              kategori: true,
              status: true,
              foto: true
            }
          }
        }
      }),
      prisma.notifications.count({ where: whereClause }),
      prisma.notifications.count({ where: { user_id: userId, is_read: false } })
    ]);

    return res.status(200).json({
      status: 'success',
      data: notifications,
      meta: {
        total,
        unreadCount,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error: any) {
    console.error('Error fetching notifications:', error);
    return res.status(500).json({ status: 'error', message: 'Gagal mengambil notifikasi' });
  }
};

// 2. Mengambil jumlah notifikasi yang belum dibaca (Unread Counter badge)
export const getUnreadCount = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ status: 'error', message: 'Unauthorized' });

    const unreadCount = await prisma.notifications.count({
      where: {
        user_id: userId,
        is_read: false
      }
    });

    return res.status(200).json({
      status: 'success',
      data: { unreadCount }
    });
  } catch (error: any) {
    return res.status(500).json({ status: 'error', message: 'Gagal menghitung notifikasi baru' });
  }
};

// 3. Menandai satu notifikasi sebagai sudah dibaca
export const markAsRead = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;
    if (!userId) return res.status(401).json({ status: 'error', message: 'Unauthorized' });

    const notification = await prisma.notifications.findUnique({
      where: { id }
    });

    if (!notification || notification.user_id !== userId) {
      return res.status(404).json({ status: 'error', message: 'Notifikasi tidak ditemukan' });
    }

    const updated = await prisma.notifications.update({
      where: { id },
      data: {
        is_read: true,
        read_at: new Date()
      }
    });

    return res.status(200).json({
      status: 'success',
      message: 'Notifikasi ditandai sudah dibaca',
      data: updated
    });
  } catch (error: any) {
    return res.status(500).json({ status: 'error', message: 'Gagal memperbarui status notifikasi' });
  }
};

// 4. Menandai semua notifikasi pengguna sebagai sudah dibaca
export const markAllAsRead = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ status: 'error', message: 'Unauthorized' });

    await prisma.notifications.updateMany({
      where: {
        user_id: userId,
        is_read: false
      },
      data: {
        is_read: true,
        read_at: new Date()
      }
    });

    return res.status(200).json({
      status: 'success',
      message: 'Semua notifikasi ditandai sudah dibaca'
    });
  } catch (error: any) {
    return res.status(500).json({ status: 'error', message: 'Gagal memperbarui semua notifikasi' });
  }
};

// 5. Menghapus satu notifikasi
export const deleteNotification = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;
    if (!userId) return res.status(401).json({ status: 'error', message: 'Unauthorized' });

    const notification = await prisma.notifications.findUnique({
      where: { id }
    });

    if (!notification || notification.user_id !== userId) {
      return res.status(404).json({ status: 'error', message: 'Notifikasi tidak ditemukan' });
    }

    await prisma.notifications.delete({
      where: { id }
    });

    return res.status(200).json({
      status: 'success',
      message: 'Notifikasi berhasil dihapus'
    });
  } catch (error: any) {
    return res.status(500).json({ status: 'error', message: 'Gagal menghapus notifikasi' });
  }
};

// 6. Membersihkan semua notifikasi pengguna
export const clearAllNotifications = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ status: 'error', message: 'Unauthorized' });

    await prisma.notifications.deleteMany({
      where: { user_id: userId }
    });

    return res.status(200).json({
      status: 'success',
      message: 'Semua notifikasi berhasil dibersihkan'
    });
  } catch (error: any) {
    return res.status(500).json({ status: 'error', message: 'Gagal membersihkan notifikasi' });
  }
};
