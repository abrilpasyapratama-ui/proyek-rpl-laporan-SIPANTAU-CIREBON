import { Response } from 'express';
import prisma from '../utils/db';
import { AuthRequest } from '../middlewares/auth.middleware';
import { whatsappService } from '../services/notification/whatsapp.service';
import { completeChat, resolveAiConfig, testAiConnection } from '../services/ai/chatProvider.service';
import {
  FONNTE_EVENT_KEYS,
  FonnteEventKey,
  AiProvider,
  getFonnteRuntimeConfig,
  getAiRuntimeConfig,
  getConfigHistory,
  getIntegrationSettings,
  getLastTestStatus,
  recordConfigHistory,
  saveAiSettings,
  saveFonnteSettings,
  saveLastTestStatus,
  updateIntegrationSettings,
} from '../services/integration/settings.service';
import { isEncryptionAvailable } from '../services/integration/secret.service';
import { maskPhone, normalizeWhatsAppNumber } from '../utils/phone';
import { logger } from '../utils/logger';

/** Label jenis notifikasi (ditampilkan di halaman Integrasi). */
const EVENT_LABELS: Record<string, string> = {
  USER_REGISTRATION: 'Pendaftaran akun berhasil (masyarakat)',
  REPORT_RECEIVED: 'Laporan berhasil dikirim (masyarakat)',
  REPORT_VERIFIED: 'Laporan diverifikasi (masyarakat)',
  REPORT_PROCESSING: 'Laporan diproses (masyarakat)',
  REPORT_IN_PROGRESS: 'Laporan dalam perbaikan (masyarakat)',
  REPORT_COMPLETED: 'Laporan selesai (masyarakat)',
  REPORT_REJECTED: 'Laporan ditolak (masyarakat)',
  REPORT_UPDATED: 'Perubahan penting pada laporan (masyarakat)',
  LOGIN_ALERT: 'Notifikasi login baru (pengguna)',
  OFFICER_ASSIGNED: 'Penugasan laporan baru (petugas)',
  OFFICER_ASSIGNMENT_CHANGED: 'Perubahan penugasan (petugas)',
  OFFICER_ASSIGNMENT_CANCELLED: 'Pembatalan penugasan (petugas)',
  OFFICER_PRIORITY_CHANGED: 'Perubahan prioritas tugas (petugas)',
  ADMIN_NEW_USER: 'Pengguna baru mendaftar (admin)',
  ADMIN_NEW_REPORT: 'Laporan baru (admin)',
  ADMIN_REPORT_COMPLETED: 'Laporan selesai (admin)',
  ADMIN_SYSTEM_ACTIVITY: 'Aktivitas penting (admin)',
};

/** Provider AI yang didukung. */
const AI_PROVIDERS: Array<{ value: AiProvider; label: string; defaultBaseUrl: string; defaultModel: string }> = [
  {
    value: 'openrouter',
    label: 'OpenRouter',
    defaultBaseUrl: 'https://openrouter.ai/api/v1',
    defaultModel: 'openai/gpt-4o-mini',
  },
  {
    value: 'openai',
    label: 'OpenAI',
    defaultBaseUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o-mini',
  },
  {
    value: 'custom',
    label: 'Custom (OpenAI-compatible)',
    defaultBaseUrl: '',
    defaultModel: '',
  },
];

/** Saran model yang bisa dipilih admin (fleksibel — model apa pun bisa diisi). */
const MODEL_SUGGESTIONS = [
  'openai/gpt-4o-mini',
  'openai/gpt-4.1-mini',
  'google/gemini-2.5-flash',
  'anthropic/claude-sonnet-4',
  'openai/gpt-4o',
  'meta-llama/llama-3.3-70b-instruct',
];

/** Identitas admin untuk audit (email diambil dari database, bukan dari body). */
async function adminInfo(req: AuthRequest): Promise<{ adminId: string | null; adminEmail: string | null }> {
  let email: string | null = null;
  if (req.user?.id) {
    const user = await prisma.users.findUnique({
      where: { id: req.user.id },
      select: { email: true },
    });
    email = user?.email ?? null;
  }
  return { adminId: req.user?.id ?? null, adminEmail: email };
}

/**
 * GET /api/admin/integrations/whatsapp/status
 *
 * Status konfigurasi kanal WhatsApp (Fonnte).
 * Token TIDAK PERNAH dikembalikan — hanya status "terkonfigurasi / belum".
 */
export const getWhatsAppStatus = async (req: AuthRequest, res: Response) => {
  try {
    const cfg = await getFonnteRuntimeConfig();
    const serviceStatus = await whatsappService.status();
    const lastTest = await getLastTestStatus('whatsapp');

    const events = FONNTE_EVENT_KEYS.map((key) => ({
      key,
      label: EVENT_LABELS[key] || key,
      enabled: cfg.events.includes(key),
    }));

    return res.status(200).json({
      status: 'success',
      data: {
        provider: cfg.provider,
        apiUrl: cfg.apiUrl,
        masterEnabled: serviceStatus.masterEnabled,
        enabled: cfg.enabled,
        tokenConfigured: cfg.tokenConfigured,
        tokenSource: cfg.tokenSource,
        ready: serviceStatus.ready,
        reason: cfg.reason,
        // Nomor admin ditampilkan dalam bentuk MASKED (tidak pernah mentah).
        adminRecipients: cfg.adminRecipients.map(maskPhone),
        adminRecipientCount: cfg.adminRecipients.length,
        source: cfg.source,
        events,
        telegramEnabled: (await getIntegrationSettings()).telegramEnabled,
        encryptionAvailable: isEncryptionAvailable(),
        lastTest,
      },
    });
  } catch (error: any) {
    logger.error('Gagal mengambil status integrasi WhatsApp', {
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(500).json({ status: 'error', message: 'Gagal mengambil status integrasi' });
  }
};

/**
 * PATCH /api/admin/integrations/whatsapp/settings
 *
 * Menyimpan konfigurasi gateway WhatsApp.
 * - Token kosong → token lama DIPERTAHANKAN.
 * - `clearToken: true` → token dihapus.
 * - Token disimpan terenkripsi (AES-256-GCM) bila kunci enkripsi tersedia.
 */
export const updateWhatsAppSettings = async (req: AuthRequest, res: Response) => {
  try {
    const body = req.body as {
      enabled?: boolean;
      provider?: string;
      apiUrl?: string;
      token?: string;
      clearToken?: boolean;
      adminRecipients?: string[];
      events?: string[];
      telegramEnabled?: boolean;
    };

    if (body.token && !isEncryptionAvailable()) {
      return res.status(400).json({
        status: 'error',
        message:
          'INTEGRATION_ENCRYPTION_KEY belum dikonfigurasi di server, token tidak dapat disimpan dengan aman.',
      });
    }

    if (body.events) {
      const invalid = body.events.filter(
        (e) => !(FONNTE_EVENT_KEYS as readonly string[]).includes(e)
      );
      if (invalid.length > 0) {
        return res.status(400).json({
          status: 'error',
          message: 'Jenis notifikasi tidak dikenal: ' + invalid.join(', '),
        });
      }
    }

    if (body.adminRecipients) {
      const normalized: string[] = [];
      for (const raw of body.adminRecipients) {
        const value = normalizeWhatsAppNumber(raw);
        if (!value) {
          return res.status(400).json({
            status: 'error',
            message: 'Nomor penerima admin tidak valid: ' + raw,
          });
        }
        if (!normalized.includes(value)) normalized.push(value);
      }
      body.adminRecipients = normalized;
    }

    const { changedFields } = await saveFonnteSettings(
      {
        enabled: body.enabled,
        provider: body.provider,
        apiUrl: body.apiUrl,
        token: body.token,
        clearToken: body.clearToken,
        adminRecipients: body.adminRecipients,
        events: body.events as FonnteEventKey[] | undefined,
      },
      req.user?.id
    );

    if (body.telegramEnabled !== undefined) {
      await updateIntegrationSettings({ telegramEnabled: body.telegramEnabled }, req.user?.id);
      changedFields.push('telegramEnabled');
    }

    const cfg = await getFonnteRuntimeConfig();
    await recordConfigHistory({
      configType: 'whatsapp',
      provider: cfg.provider,
      ...(await adminInfo(req)),
      changedFields,
      status: 'saved',
    });

    logger.audit('integration_whatsapp_settings_updated', {
      adminId: req.user?.id,
      changedFields,
      // token TIDAK pernah ikut dicatat
    });

    return getWhatsAppStatus(req, res);
  } catch (error: any) {
    logger.error('Gagal menyimpan pengaturan integrasi WhatsApp', {
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(500).json({ status: 'error', message: 'Gagal menyimpan pengaturan integrasi' });
  }
};

/**
 * POST /api/admin/integrations/whatsapp/test-connection
 *
 * Menguji token & device Fonnte (POST /device). Tidak mengirim pesan.
 */
export const testWhatsAppConnection = async (req: AuthRequest, res: Response) => {
  try {
    const result = await whatsappService.testConnection();

    await saveLastTestStatus('whatsapp', {
      ok: result.ok,
      testedAt: new Date().toISOString(),
      provider: 'fonnte',
      detail: result.ok
        ? `device ${result.deviceStatus ?? '-'} | kuota ${result.quota ?? '-'}`
        : undefined,
      error: result.ok ? undefined : result.reason,
    });

    await recordConfigHistory({
      configType: 'whatsapp',
      provider: 'fonnte',
      ...(await adminInfo(req)),
      changedFields: ['connection_test'],
      status: result.ok ? 'test_ok' : 'test_failed',
      note: result.ok ? 'Uji koneksi berhasil' : 'Uji koneksi gagal',
    });

    logger.audit('integration_connection_test', {
      adminId: req.user?.id,
      ok: result.ok,
      deviceStatus: result.deviceStatus,
    });

    return res.status(200).json({
      status: result.ok ? 'success' : 'error',
      message: result.ok
        ? 'Koneksi ke Fonnte berhasil'
        : 'Koneksi ke Fonnte gagal: ' + (result.reason || 'alasan tidak diketahui'),
      data: result,
    });
  } catch (error: any) {
    return res.status(500).json({ status: 'error', message: 'Gagal menguji koneksi Fonnte' });
  }
};

/**
 * POST /api/admin/integrations/whatsapp/test-message
 *
 * Mengirim pesan percobaan ke nomor penerima admin yang dikonfigurasi.
 */
export const sendWhatsAppTestMessage = async (req: AuthRequest, res: Response) => {
  try {
    const body = req.body as { message?: string; target?: string };
    const message =
      body.message?.trim() ||
      'Tes notifikasi SIPANTAU CIREBON. Pesan ini dikirim dari halaman Konfigurasi Integrasi.';

    if (message.length > 1000) {
      return res.status(400).json({ status: 'error', message: 'Pesan maksimal 1000 karakter' });
    }

    const cfg = await getFonnteRuntimeConfig();
    if (!cfg.tokenConfigured) {
      return res.status(400).json({
        status: 'error',
        message: 'Konfigurasi belum lengkap: token Fonnte belum diisi.',
      });
    }

    let targets = cfg.adminRecipients;
    if (body.target) {
      const normalized = normalizeWhatsAppNumber(body.target);
      if (!normalized) {
        return res.status(400).json({ status: 'error', message: 'Nomor tujuan tidak valid' });
      }
      targets = [normalized];
    }

    if (targets.length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Tidak ada nomor penerima admin yang dikonfigurasi.',
      });
    }

    const results: Array<{ recipient: string; success: boolean; messageId?: string; error?: string }> = [];

    for (const raw of targets) {
      const to = normalizeWhatsAppNumber(raw);
      if (!to) continue;
      const result = await whatsappService.sendMessage(
        { to, type: 'text', text: { body: message } },
        {
          eventType: 'ADMIN_TEST_MESSAGE',
          idempotencyKey: 'wa:ADMIN_TEST_MESSAGE:' + maskPhone(to) + ':' + Date.now(),
        }
      );
      results.push({
        recipient: maskPhone(to),
        success: result.success,
        messageId: result.messageId,
        error: result.error,
      });
    }

    const sent = results.filter((r) => r.success).length;
    await recordConfigHistory({
      configType: 'whatsapp',
      provider: 'fonnte',
      ...(await adminInfo(req)),
      changedFields: ['test_message'],
      status: sent > 0 ? 'test_ok' : 'test_failed',
      note: `${sent}/${results.length} pesan diterima API`,
    });

    return res.status(200).json({
      status: sent > 0 ? 'success' : 'error',
      message:
        sent > 0
          ? `Permintaan pesan percobaan diterima Fonnte untuk ${sent} dari ${results.length} nomor.`
          : 'Pesan percobaan gagal dikirim. Lihat riwayat pengiriman untuk detail.',
      data: results,
    });
  } catch (error: any) {
    logger.error('Gagal mengirim pesan percobaan', {
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(500).json({ status: 'error', message: 'Gagal mengirim pesan percobaan' });
  }
};

/**
 * GET /api/admin/integrations/whatsapp/history
 *
 * Riwayat pengiriman WhatsApp. Nomor penerima ditampilkan MASKED.
 */
export const getWhatsAppHistory = async (req: AuthRequest, res: Response) => {
  try {
    const page = Math.max(parseInt(req.query.page as string) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit as string) || 20, 1), 100);
    const status = req.query.status as string | undefined;

    const where: Record<string, unknown> = {};
    if (status && ['pending', 'sent', 'failed'].includes(status)) {
      where.delivery_status = status;
    }

    const [logs, total] = await Promise.all([
      prisma.whatsapp_message_logs.findMany({
        where,
        select: {
          id: true,
          event_type: true,
          report_id: true,
          user_id: true,
          recipient_number: true,
          recipient_masked: true,
          delivery_status: true,
          provider: true,
          provider_process: true,
          provider_message_id: true,
          attempt_count: true,
          last_error: true,
          created_at: true,
          sent_at: true,
        },
        orderBy: { created_at: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.whatsapp_message_logs.count({ where }),
    ]);

    return res.status(200).json({
      status: 'success',
      data: logs,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (error: any) {
    return res.status(500).json({ status: 'error', message: 'Gagal mengambil riwayat pengiriman' });
  }
};

/* ==================== AI CHATBOT PROVIDER ==================== */

/**
 * GET /api/admin/integrations/ai/status
 *
 * Konfigurasi penyedia AI chatbot. API key TIDAK pernah dikembalikan —
 * hanya status "terkonfigurasi / belum".
 */
export const getAiStatus = async (req: AuthRequest, res: Response) => {
  try {
    const cfg = await getAiRuntimeConfig();
    const lastTest = await getLastTestStatus('ai');

    return res.status(200).json({
      status: 'success',
      data: {
        enabled: cfg.enabled,
        provider: cfg.provider,
        baseUrl: cfg.baseUrl,
        model: cfg.model,
        temperature: cfg.temperature,
        maxTokens: cfg.maxTokens,
        timeoutMs: cfg.timeoutMs,
        systemPrompt: cfg.systemPrompt,
        apiKeyConfigured: cfg.apiKeyConfigured,
        apiKeySource: cfg.apiKeySource,
        ready: cfg.enabled && cfg.apiKeyConfigured && Boolean(cfg.model),
        reason: cfg.reason,
        source: cfg.source,
        encryptionAvailable: isEncryptionAvailable(),
        providerOptions: AI_PROVIDERS.map((p) => ({
          value: p.value,
          label: p.label,
          defaultBaseUrl: p.defaultBaseUrl,
          defaultModel: p.defaultModel,
        })),
        modelSuggestions: MODEL_SUGGESTIONS,
        lastTest,
      },
    });
  } catch (error: any) {
    logger.error('Gagal mengambil status konfigurasi AI', {
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(500).json({ status: 'error', message: 'Gagal mengambil status konfigurasi AI' });
  }
};

/**
 * PATCH /api/admin/integrations/ai/settings
 *
 * Menyimpan konfigurasi penyedia AI. API key dienkripsi; plaintext tidak
 * pernah disimpan di database maupun dikirim kembali ke frontend.
 */
export const updateAiSettings = async (req: AuthRequest, res: Response) => {
  try {
    const body = req.body as {
      enabled?: boolean;
      provider?: AiProvider;
      baseUrl?: string;
      model?: string;
      temperature?: number;
      maxTokens?: number;
      timeoutMs?: number;
      systemPrompt?: string;
      apiKey?: string;
      clearApiKey?: boolean;
    };

    if (body.apiKey && !isEncryptionAvailable()) {
      return res.status(400).json({
        status: 'error',
        message:
          'INTEGRATION_ENCRYPTION_KEY belum dikonfigurasi di server, API Key tidak dapat disimpan dengan aman.',
      });
    }

    const { changedFields } = await saveAiSettings(
      {
        enabled: body.enabled,
        provider: body.provider,
        baseUrl: body.baseUrl,
        model: body.model,
        temperature: body.temperature,
        maxTokens: body.maxTokens,
        timeoutMs: body.timeoutMs,
        systemPrompt: body.systemPrompt,
        apiKey: body.apiKey,
        clearApiKey: body.clearApiKey,
      },
      req.user?.id
    );

    const cfg = await getAiRuntimeConfig();
    await recordConfigHistory({
      configType: 'ai',
      provider: cfg.provider,
      ...(await adminInfo(req)),
      changedFields,
      status: 'saved',
    });

    logger.audit('integration_ai_settings_updated', {
      adminId: req.user?.id,
      changedFields,
      provider: cfg.provider,
      model: cfg.model,
      // API key TIDAK pernah ikut dicatat
    });

    return getAiStatus(req, res);
  } catch (error: any) {
    logger.error('Gagal menyimpan konfigurasi AI', {
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(500).json({ status: 'error', message: 'Gagal menyimpan konfigurasi AI' });
  }
};

/**
 * POST /api/admin/integrations/ai/test-connection
 *
 * Menguji API key & ketersediaan model pada penyedia AI.
 */
export const testAiProviderConnection = async (req: AuthRequest, res: Response) => {
  try {
    const result = await testAiConnection();

    await saveLastTestStatus('ai', {
      ok: result.ok,
      testedAt: new Date().toISOString(),
      provider: result.provider,
      detail: result.ok
        ? `model ${result.model ?? '-'} | tersedia: ${result.modelAvailable === false ? 'tidak' : 'ya'}`
        : undefined,
      error: result.ok ? undefined : result.reason,
    });

    await recordConfigHistory({
      configType: 'ai',
      provider: result.provider,
      ...(await adminInfo(req)),
      changedFields: ['connection_test'],
      status: result.ok ? 'test_ok' : 'test_failed',
      note: result.ok ? 'Uji koneksi AI berhasil' : 'Uji koneksi AI gagal',
    });

    logger.audit('integration_ai_connection_test', {
      adminId: req.user?.id,
      ok: result.ok,
      provider: result.provider,
      model: result.model,
    });

    return res.status(200).json({
      status: result.ok ? 'success' : 'error',
      message: result.ok
        ? 'Koneksi ke penyedia AI berhasil'
        : 'Koneksi ke penyedia AI gagal: ' + (result.reason || 'alasan tidak diketahui'),
      data: result,
    });
  } catch (error: any) {
    return res.status(500).json({ status: 'error', message: 'Gagal menguji koneksi penyedia AI' });
  }
};

/**
 * POST /api/admin/integrations/ai/test-chat
 *
 * Menguji chatbot dengan konfigurasi provider yang TERSIMPAN.
 * TIDAK membuat percakapan/pesan di riwayat pengguna (tanpa tool, tanpa DB write).
 */
export const testAiChat = async (req: AuthRequest, res: Response) => {
  try {
    const body = req.body as { message?: string };
    const message = body.message?.trim() || 'Halo! Jawab singkat: apa itu SIPANTAU CIREBON?';

    if (message.length > 1000) {
      return res.status(400).json({ status: 'error', message: 'Pesan maksimal 1000 karakter' });
    }

    const cfg = await resolveAiConfig();
    if (!cfg.apiKey) {
      return res.status(400).json({
        status: 'error',
        message: 'Konfigurasi belum lengkap: API Key belum diisi.',
      });
    }
    if (!cfg.model) {
      return res.status(400).json({ status: 'error', message: 'Model AI belum dipilih.' });
    }

    const startedAt = Date.now();
    const runtime = await getAiRuntimeConfig();

    const systemParts = [
      'Kamu adalah asisten pengujian chatbot SIPANTAU CIREBON. Jawab singkat, ramah, dan dalam Bahasa Indonesia.',
    ];
    if (runtime.systemPrompt?.trim()) {
      systemParts.push(
        'Aturan tambahan dari administrator:\n' + runtime.systemPrompt.trim().slice(0, 2000)
      );
    }

    const reply = await completeChat(
      [
        { role: 'system', content: systemParts.join('\n\n') },
        { role: 'user', content: message },
      ],
      undefined
    );

    const responseTimeMs = Date.now() - startedAt;

    await recordConfigHistory({
      configType: 'ai',
      provider: cfg.provider,
      ...(await adminInfo(req)),
      changedFields: ['test_chat'],
      status: 'test_ok',
      note: `Model ${cfg.model} | ${responseTimeMs} ms`,
    });

    return res.status(200).json({
      status: 'success',
      message: 'Uji chatbot berhasil',
      data: {
        reply: reply.content,
        responseTimeMs,
        provider: cfg.provider,
        model: cfg.model,
      },
    });
  } catch (error: any) {
    const reason = error instanceof Error ? error.message : String(error);

    await recordConfigHistory({
      configType: 'ai',
      provider: 'unknown',
      ...(await adminInfo(req)),
      changedFields: ['test_chat'],
      status: 'test_failed',
      note: 'Uji chatbot gagal',
    });

    logger.error('Uji chatbot AI gagal', {
      adminId: req.user?.id,
      error: reason,
    });

    return res.status(200).json({
      status: 'error',
      message: 'Uji chatbot gagal: ' + reason,
      data: { reply: '', responseTimeMs: 0 },
    });
  }
};

/**
 * GET /api/admin/integrations/history
 *
 * Riwayat perubahan konfigurasi integrasi (audit). Tidak menyimpan rahasia.
 */
export const getIntegrationHistory = async (req: AuthRequest, res: Response) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit as string) || 25, 1), 100);
    const rows = await getConfigHistory(limit);

    const data = rows.map((row) => {
      let changedFields: string[] = [];
      try {
        const parsed = JSON.parse(row.changed_fields);
        if (Array.isArray(parsed)) changedFields = parsed;
      } catch {
        changedFields = [];
      }
      return {
        id: row.id,
        configType: row.config_type,
        provider: row.provider,
        adminEmail: row.admin_email,
        changedFields,
        status: row.status,
        note: row.note,
        createdAt: row.created_at,
      };
    });

    return res.status(200).json({ status: 'success', data });
  } catch (error: any) {
    return res.status(500).json({ status: 'error', message: 'Gagal mengambil riwayat konfigurasi' });
  }
};
