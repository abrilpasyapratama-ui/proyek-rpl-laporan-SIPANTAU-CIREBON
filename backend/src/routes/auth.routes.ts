import { Router } from 'express';
import {
  register,
  login,
  me,
  updateProfile,
  changePassword,
  acceptAdminInvite,
} from '../controllers/auth.controller';
import { authenticate, requireActive } from '../middlewares/auth.middleware';
import { validateBody } from '../middlewares/validate.middleware';
import { authLimiter } from '../middlewares/rateLimit.middleware';
import {
  loginSchema,
  registerSchema,
  updateProfileSchema,
  changePasswordSchema,
  acceptAdminInviteSchema,
} from '../validation/schemas';

const router = Router();

router.post('/register', authLimiter, validateBody(registerSchema), register);
router.post('/login', authLimiter, validateBody(loginSchema), login);
router.get('/me', authenticate, me);
router.patch('/profile', authenticate, validateBody(updateProfileSchema), updateProfile);
router.patch('/password', authenticate, authLimiter, validateBody(changePasswordSchema), changePassword);

// Aktivasi Admin via token undangan (nomor WhatsApp sudah dicocokkan di backend).
router.post(
  '/admin-invite/accept',
  authenticate,
  requireActive,
  authLimiter,
  validateBody(acceptAdminInviteSchema),
  acceptAdminInvite
);

export default router;
