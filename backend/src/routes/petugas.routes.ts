import { Router } from 'express';
import { 
  getAssignedTasks, 
  getTaskDetail, 
  addProgressUpdate,
  getOfficerHistory 
} from '../controllers/petugas.controller';
import { authenticate, authorizeRole, requireActive } from '../middlewares/auth.middleware';
import { upload } from '../middlewares/upload.middleware';
import { validateBody } from '../middlewares/validate.middleware';
import { uploadLimiter } from '../middlewares/rateLimit.middleware';
import { progressUpdateSchema } from '../validation/schemas';

const router = Router();

// Semua rute petugas harus login, aktif, dan ber-role petugas
router.use(authenticate, requireActive, authorizeRole(['petugas']));

router.get('/tasks', getAssignedTasks);
router.get('/tasks/:id', getTaskDetail);
router.post('/tasks/:id/update', uploadLimiter, upload.single('foto_bukti'), validateBody(progressUpdateSchema), addProgressUpdate);
router.get('/history', getOfficerHistory);

export default router;
