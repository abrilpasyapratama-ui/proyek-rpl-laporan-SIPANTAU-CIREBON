import dotenv from 'dotenv';

dotenv.config();

const isProduction = process.env.NODE_ENV === 'production';

function required(name: string, devFallback: string): string {
  const value = process.env[name];
  if (value && value.length > 0) return value;
  if (isProduction) {
    throw new Error(`Environment variable ${name} is required in production`);
  }
  return devFallback;
}

export const config = {
  env: process.env.NODE_ENV || 'development',
  isProduction,
  isTest: process.env.NODE_ENV === 'test' || !!process.env.VITEST,
  port: parseInt(process.env.PORT || '5000', 10),
  databaseUrl: required('DATABASE_URL', 'postgresql://postgres:postgres@localhost:5432/laporan_fasilitas?schema=public'),
  jwtSecret: required('JWT_SECRET', 'dev-only-insecure-secret-change-me'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1d',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
  // Comma-separated list of allowed CORS origins
  corsOrigins: (process.env.CORS_ORIGINS || process.env.FRONTEND_URL || 'http://localhost:5173')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),
  aiMockDelayMs: parseInt(process.env.AI_MOCK_DELAY_MS || (process.env.NODE_ENV === 'test' ? '0' : '800'), 10),
  enableEmailNotification: process.env.ENABLE_EMAIL_NOTIFICATION !== 'false',

  /**
   * Konfigurasi chatbot AI (provider OpenAI-compatible).
   * Nilai di sini adalah FALLBACK. Konfigurasi yang disimpan admin di
   * database (terenkripsi) selalu-win bila tersedia.
   */
  ai: {
    enabled: process.env.AI_CHATBOT_ENABLED !== 'false',
    provider: (process.env.AI_PROVIDER || 'openrouter') as 'openrouter' | 'openai' | 'custom',
    baseUrl:
      process.env.AI_BASE_URL ||
      (process.env.AI_PROVIDER === 'openai'
        ? 'https://api.openai.com/v1'
        : process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1'),
    apiKey: process.env.AI_API_KEY || process.env.OPENROUTER_API_KEY || '',
    model: process.env.AI_MODEL || process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini',
    temperature: parseFloat(process.env.AI_TEMPERATURE || '0.3'),
    maxTokens: parseInt(process.env.AI_MAX_TOKENS || '800', 10),
    timeoutMs: parseInt(process.env.AI_TIMEOUT_MS || '30000', 10),
    systemPrompt: process.env.AI_SYSTEM_PROMPT || '',
  },

  /** Kunci enkripsi untuk rahasia integrasi (AES-256-GCM). */
  integration: {
    encryptionKey: process.env.INTEGRATION_ENCRYPTION_KEY || '',
  },

  openrouterApiKey: process.env.OPENROUTER_API_KEY || '',
  openrouterModel: process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini',
  openrouterBaseUrl: (process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1').replace(/\/+$/, ''),
  // Telegram Bot API configuration
  telegram: {
    enabled: process.env.TELEGRAM_ENABLED === 'true',
    botToken: process.env.TELEGRAM_BOT_TOKEN || '',
    adminChatId: process.env.TELEGRAM_ADMIN_CHAT_ID || '',
    // Username bot (tanpa @) untuk membuat deep link t.me/<username>?start=<kode>.
    botUsername: process.env.TELEGRAM_BOT_USERNAME || '',
    // Secret wajib untuk webhook: Telegram mengirimkannya di header
    // X-Telegram-Bot-Api-Secret-Token. Bila kosong, webhook menolak semua request.
    webhookSecret: process.env.TELEGRAM_WEBHOOK_SECRET || '',
    linkCodeTtlMinutes: parseInt(process.env.TELEGRAM_LINK_CODE_TTL_MINUTES || '15', 10),
    maxLinkAttempts: parseInt(process.env.TELEGRAM_MAX_LINK_ATTEMPTS || '5', 10),
  },

  // WhatsApp Business Platform / Cloud API configuration
  whatsapp: {
    enabled: process.env.WHATSAPP_ENABLED === 'true',
    provider: (process.env.WHATSAPP_PROVIDER || 'meta') as 'meta' | 'twilio' | 'custom' | 'fonte' | 'fonnte',
    // Meta WhatsApp Cloud API
    meta: {
      accessToken: process.env.WHATSAPP_META_ACCESS_TOKEN || '',
      phoneNumberId: process.env.WHATSAPP_META_PHONE_NUMBER_ID || '',
      appSecret: process.env.WHATSAPP_META_APP_SECRET || '',
      apiVersion: process.env.WHATSAPP_META_API_VERSION || 'v20.0',
    },
    // Twilio WhatsApp
    twilio: {
      accountSid: process.env.WHATSAPP_TWILIO_ACCOUNT_SID || '',
      authToken: process.env.WHATSAPP_TWILIO_AUTH_TOKEN || '',
      fromNumber: process.env.WHATSAPP_TWILIO_FROM_NUMBER || '',
    },
    // Custom webhook provider (generic)
    custom: {
      apiUrl: process.env.WHATSAPP_CUSTOM_API_URL || '',
      apiKey: process.env.WHATSAPP_CUSTOM_API_KEY || '',
    },
    // Fonnte (ex-Fonte) WhatsApp Gateway — docs: https://docs.fonnte.com/api-send-message/
    // Token WAJIB diisi sendiri administrator lewat environment server.
    // Token TIDAK PERNAH masuk source code, log, API response, atau frontend.
    fonte: {
      enabled: process.env.FONNTE_ENABLED === 'true',
      apiUrl: (process.env.FONNTE_API_URL || 'https://api.fonnte.com').replace(/\/+$/, ''),
      apiToken: process.env.FONNTE_TOKEN || '',
      // Device ID tidak diperlukan untuk API v1 (1 token = 1 device)
      webhookSecret: process.env.FONTE_WEBHOOK_SECRET || '',
      // Daftar nomor penerima admin (dipisah koma). Fallback ke ADMIN_WHATSAPP_NUMBER.
      adminRecipients: (
        process.env.FONNTE_ADMIN_RECIPIENTS || process.env.ADMIN_WHATSAPP_NUMBER || ''
      )
        .split(',')
        .map((n) => n.trim())
        .filter((n) => n.length > 0),
      timeoutMs: parseInt(process.env.FONNTE_TIMEOUT_MS || '15000', 10),
      maxRetries: parseInt(process.env.FONNTE_MAX_RETRIES || '3', 10),
      retryDelayMs: parseInt(process.env.FONNTE_RETRY_DELAY_MS || '5000', 10),
      countryCode: process.env.FONNTE_COUNTRY_CODE || '62',
      // Anti-spam: jarak minimum antar pesan per nomor & kuota per menit
      minIntervalMs: parseInt(process.env.FONNTE_MIN_INTERVAL_MS || '2000', 10),
      maxPerMinute: parseInt(process.env.FONNTE_MAX_PER_MINUTE || '20', 10),
    },
    // Admin WhatsApp number for notifications (international format without +)
    adminNumber: process.env.ADMIN_WHATSAPP_NUMBER || '6283190039713',
    // Template names for outside 24-hour window
    templates: {
      newReportAdmin: process.env.WHATSAPP_TPL_NEW_REPORT_ADMIN || 'new_report_admin',
      newReportUser: process.env.WHATSAPP_TPL_NEW_REPORT_USER || 'new_report_user',
      statusUpdate: process.env.WHATSAPP_TPL_STATUS_UPDATE || 'status_update',
      reportSolvedAdmin: process.env.WHATSAPP_TPL_REPORT_SOLVED_ADMIN || 'report_solved_admin',
      reportSolvedUser: process.env.WHATSAPP_TPL_REPORT_SOLVED_USER || 'report_solved_user',
      userRegistrationAdmin: process.env.WHATSAPP_TPL_REG_ADMIN || 'user_registration_admin',
      userRegistrationUser: process.env.WHATSAPP_TPL_REG_USER || 'user_registration_user',
      loginAlert: process.env.WHATSAPP_TPL_LOGIN_ALERT || 'login_alert',
    },
    // Retry configuration
    maxRetries: parseInt(process.env.WHATSAPP_MAX_RETRIES || '3', 10),
    retryDelayMs: parseInt(process.env.WHATSAPP_RETRY_DELAY_MS || '5000', 10),
  },
} as const;
