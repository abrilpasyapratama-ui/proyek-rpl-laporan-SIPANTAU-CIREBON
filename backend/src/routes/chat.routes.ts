import { Router } from 'express';
import {
  postChat,
  listConversations,
  getConversation,
  deleteConversation,
  getAnalyticsSummary,
} from '../controllers/chat.controller';
import { authenticate, authorizeRole, requireActive } from '../middlewares/auth.middleware';
import { validateBody } from '../middlewares/validate.middleware';
import { chatLimiter } from '../middlewares/rateLimit.middleware';
import { chatRequestSchema } from '../validation/schemas';

const router = Router();

// Semua endpoint chat wajib login dengan akun aktif
router.use(authenticate, requireActive);

// Analitik (admin only) — didefinisikan sebelum route :id agar tidak tertukar
router.get('/analytics/summary', authorizeRole(['admin']), getAnalyticsSummary);

// Memory percakapan
router.get('/conversations', listConversations);
router.get('/conversations/:id', getConversation);
router.delete('/conversations/:id', deleteConversation);

// Giliran chat (rate-limited + validasi Zod)
router.post('/', chatLimiter, validateBody(chatRequestSchema), postChat);

export default router;
