import { Router } from 'express';
import { 
  getStats, 
  getReports, 
  getReportDetail, 
  verifyReport, 
  getPetugasList, 
  assignPetugas,
  updateReportPriority,
  getUsersList,
  getUserDetail,
  updateUser,
  deleteUser,
  getActivityLog,
  getAssignments,
  updateUserRole,
  changeAssignmentPetugas,
  cancelAssignment,
  lookupUserByPhone,
  listPendingPetugas,
  verifyPetugas
} from '../controllers/admin.controller';
import { authenticate, authorizeRole, requireActive } from '../middlewares/auth.middleware';
import { validateBody, validateQuery } from '../middlewares/validate.middleware';
import { integrationTestLimiter } from '../middlewares/rateLimit.middleware';
import {
  getWhatsAppStatus,
  updateWhatsAppSettings,
  testWhatsAppConnection,
  sendWhatsAppTestMessage,
  getWhatsAppHistory,
  getAiStatus,
  updateAiSettings,
  testAiProviderConnection,
  testAiChat,
  getIntegrationHistory,
} from '../controllers/integration.controller';
import {
  adminReportsQuerySchema,
  adminUsersQuerySchema,
  adminUpdateUserSchema,
  assignPetugasSchema,
  aiIntegrationSettingsSchema,
  aiTestChatSchema,
  integrationTestMessageSchema,
  prioritySchema,
  verifyReportSchema,
  updateUserRoleSchema,
  verifyPetugasSchema,
  whatsappIntegrationSettingsSchema,
} from '../validation/schemas';

const router = Router();

// Semua rute admin harus login, aktif, dan ber-role admin
router.use(authenticate, requireActive, authorizeRole(['admin']));

router.get('/stats', getStats);
router.get('/reports', validateQuery(adminReportsQuerySchema), getReports);
router.get('/reports/:id', getReportDetail);
router.put('/reports/:id/verify', validateBody(verifyReportSchema), verifyReport);
router.patch('/reports/:id/priority', validateBody(prioritySchema), updateReportPriority);

router.get('/petugas', getPetugasList);
router.get('/verifications', listPendingPetugas);
router.patch('/verifications/:id', validateBody(verifyPetugasSchema), verifyPetugas);
router.get('/users', validateQuery(adminUsersQuerySchema), getUsersList);
router.get('/users/lookup', lookupUserByPhone);
router.get('/users/:id', getUserDetail);
router.patch('/users/:id', validateBody(adminUpdateUserSchema), updateUser);
router.delete('/users/:id', deleteUser);

// Integrasi WhatsApp (Fonnte) & AI Chatbot — hanya admin.
router.get('/integrations/whatsapp/status', getWhatsAppStatus);
router.patch(
  '/integrations/whatsapp/settings',
  validateBody(whatsappIntegrationSettingsSchema),
  updateWhatsAppSettings
);
router.post('/integrations/whatsapp/test-connection', integrationTestLimiter, testWhatsAppConnection);
router.post(
  '/integrations/whatsapp/test-message',
  integrationTestLimiter,
  validateBody(integrationTestMessageSchema),
  sendWhatsAppTestMessage
);
router.get('/integrations/whatsapp/history', getWhatsAppHistory);

router.get('/integrations/ai/status', getAiStatus);
router.patch('/integrations/ai/settings', validateBody(aiIntegrationSettingsSchema), updateAiSettings);
router.post('/integrations/ai/test-connection', integrationTestLimiter, testAiProviderConnection);
router.post(
  '/integrations/ai/test-chat',
  integrationTestLimiter,
  validateBody(aiTestChatSchema),
  testAiChat
);

router.get('/integrations/history', getIntegrationHistory);
router.get('/activity', getActivityLog);
router.get('/assignments', getAssignments);
router.patch('/users/:id/role', validateBody(updateUserRoleSchema), updateUserRole);
router.post('/reports/:id/assign', validateBody(assignPetugasSchema), assignPetugas);
router.patch('/assignments/:reportId', validateBody(assignPetugasSchema), changeAssignmentPetugas);
router.delete('/assignments/:reportId/:petugasId', cancelAssignment);

export default router;
