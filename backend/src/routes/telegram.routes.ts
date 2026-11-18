import { Router } from 'express';
import {
  createLinkCode,
  getStatus,
  disconnect,
  webhook,
} from '../controllers/telegram.controller';
import { authenticate, requireActive } from '../middlewares/auth.middleware';
import { telegramLinkLimiter } from '../middlewares/rateLimit.middleware';

const router = Router();

// Webhook Telegram: autentikasi via secret header, bukan JWT.
// Tidak ada endpoint pengiriman pesan bebas di sini.
router.post('/webhook', webhook);

// Endpoint pengguna (wajib JWT); pengguna hanya dapat mengelola akunnya sendiri.
router.get('/status', authenticate, getStatus);
router.post('/link-code', authenticate, requireActive, telegramLinkLimiter, createLinkCode);
router.delete('/link', authenticate, requireActive, disconnect);

export default router;
