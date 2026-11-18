import { Router } from 'express';
import { createReport, getMyHistory, getMyStats, getMyReportById } from '../controllers/report.controller';
import { getGisReports } from '../controllers/gis.controller';
import { authenticate, authorizeRole, requireActive } from '../middlewares/auth.middleware';
import { upload } from '../middlewares/upload.middleware';
import { validateBody } from '../middlewares/validate.middleware';
import { uploadLimiter } from '../middlewares/rateLimit.middleware';
import { createReportSchema } from '../validation/schemas';

const router = Router();

// Endpoint peta GIS laporan
router.get('/map', getGisReports);

// Endpoint untuk mendapatkan riwayat laporan sendiri
router.get('/history', authenticate, requireActive, getMyHistory);

// Endpoint statistik laporan pribadi (dashboard masyarakat)
router.get('/mystats', authenticate, requireActive, getMyStats);

// Endpoint detail satu laporan milik sendiri (ditempatkan setelah route statis)
router.get('/:id', authenticate, requireActive, getMyReportById);

// Endpoint untuk membuat laporan (Hanya untuk masyarakat)
router.post(
  '/',
  authenticate,
  requireActive,
  authorizeRole(['masyarakat']),
  uploadLimiter,
  upload.single('foto'),
  validateBody(createReportSchema),
  createReport
);

export default router;
