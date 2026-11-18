import { Router } from 'express';
import {
  getMyNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  clearAllNotifications
} from '../controllers/notification.controller';
import { authenticate, requireActive } from '../middlewares/auth.middleware';

const router = Router();

// Semua endpoint notifikasi memerlukan autentikasi login pengguna aktif
router.use(authenticate, requireActive);

router.get('/', getMyNotifications);
router.get('/unread-count', getUnreadCount);
router.patch('/mark-all-read', markAllAsRead);
router.patch('/:id/read', markAsRead);
router.delete('/clear-all', clearAllNotifications);
router.delete('/:id', deleteNotification);

export default router;
