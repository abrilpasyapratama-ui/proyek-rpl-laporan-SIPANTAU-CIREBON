import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';

/** Kunci enkripsi dummy untuk test (hex 64 karakter). */
const TEST_KEY = 'a'.repeat(64);
const SECRET_TOKEN = 'token-fonnte-rahasia-123';
const SECRET_API_KEY = 'sk-or-v1-rahasia-456';

vi.mock('../src/config', () => ({
  config: {
    env: 'test',
    isProduction: false,
    isTest: true,
    frontendUrl: 'http://localhost:5173',
    jwtSecret: 'test-jwt-secret',
    jwtExpiresIn: '1d',
    databaseUrl: 'postgresql://localhost/test',
    port: 5000,
    corsOrigins: ['http://localhost:5173'],
    enableEmailNotification: false,
    aiMockDelayMs: 0,
    openrouterApiKey: '',
    openrouterModel: 'openai/gpt-4o-mini',
    openrouterBaseUrl: 'https://openrouter.ai/api/v1',
    integration: { encryptionKey: 'a'.repeat(64) },
    telegram: {
      enabled: false,
      botToken: '',
      adminChatId: '',
      botUsername: '',
      webhookSecret: '',
      linkCodeTtlMinutes: 15,
      maxLinkAttempts: 5,
    },
    whatsapp: {
      enabled: true,
      provider: 'fonte',
      meta: { accessToken: '', phoneNumberId: '', appSecret: '', apiVersion: 'v20.0' },
      twilio: { accountSid: '', authToken: '', fromNumber: '' },
      custom: { apiUrl: '', apiKey: '' },
      fonte: {
        enabled: true,
        apiUrl: 'https://api.fonnte.com',
        apiToken: '',
        adminRecipients: ['628111111111'],
        timeoutMs: 1000,
        maxRetries: 1,
        retryDelayMs: 10,
        countryCode: '62',
        minIntervalMs: 0,
        maxPerMinute: 100,
      },
      adminNumber: '628111111111',
      maxRetries: 1,
      retryDelayMs: 10,
    },
    ai: {
      enabled: true,
      provider: 'openrouter',
      baseUrl: 'https://openrouter.ai/api/v1',
      apiKey: '',
      model: 'openai/gpt-4o-mini',
      temperature: 0.3,
      maxTokens: 800,
      timeoutMs: 5000,
      systemPrompt: '',
    },
  },
}));

vi.mock('../src/utils/db', () => ({
  default: {
    integration_settings: { findMany: vi.fn(), upsert: vi.fn() },
    integration_config_history: { create: vi.fn(), findMany: vi.fn() },
    users: { findUnique: vi.fn(), findMany: vi.fn() },
    conversations: { findMany: vi.fn(), create: vi.fn(), count: vi.fn() },
    chat_messages: { create: vi.fn(), count: vi.fn() },
    chat_analytics: { create: vi.fn(), count: vi.fn() },
    whatsapp_message_logs: { findMany: vi.fn(), count: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    user_whatsapp_preferences: { findUnique: vi.fn() },
    notifications: { create: vi.fn() },
    reports: { findMany: vi.fn(), count: vi.fn() },
    assignments: { findMany: vi.fn(), count: vi.fn() },
    $disconnect: vi.fn(),
  },
}));

vi.mock('../src/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    audit: vi.fn(),
  },
}));

import app from '../src/index';
import prisma from '../src/utils/db';
import { generateToken } from '../src/utils/jwt';
import { logger } from '../src/utils/logger';
import { clearIntegrationSettingsCache } from '../src/services/integration/settings.service';
import { encryptSecret, decryptSecret } from '../src/services/integration/secret.service';

const mockPrisma = prisma as unknown as Record<string, any>;

const ADMIN = {
  id: 'admin1',
  nama: 'Admin Utama',
  email: 'admin@example.com',
  role: 'admin',
  status: 'AKTIF',
  password: 'hash',
};

/** Simulasi tabel integration_settings (key → value). */
let store: Record<string, string> = {};

const adminToken = () => generateToken({ userId: ADMIN.id, role: 'admin' });
const auth = () => ({ Authorization: `Bearer ${adminToken()}` });

beforeEach(() => {
  vi.clearAllMocks();
  clearIntegrationSettingsCache();
  store = {};

  mockPrisma.integration_settings.findMany.mockImplementation(async () =>
    Object.entries(store).map(([key, value]) => ({ key, value }))
  );
  mockPrisma.integration_settings.upsert.mockImplementation(async (args: any) => {
    const payload = args.update ?? args.create;
    store[args.where.key] = payload.value;
    return { key: args.where.key, value: payload.value };
  });
  mockPrisma.integration_config_history.create.mockResolvedValue({ id: 'hist-1' });
  mockPrisma.integration_config_history.findMany.mockResolvedValue([]);
  mockPrisma.users.findUnique.mockImplementation(async (args: any) =>
    args?.where?.id === ADMIN.id ? { ...ADMIN } : null
  );
  mockPrisma.conversations.count.mockResolvedValue(0);
  mockPrisma.chat_messages.count.mockResolvedValue(0);
  mockPrisma.chat_analytics.count.mockResolvedValue(0);
  mockPrisma.conversations.create.mockResolvedValue({ id: 'conv-1' });
  mockPrisma.chat_messages.create.mockResolvedValue({});
  mockPrisma.chat_analytics.create.mockResolvedValue({});
  mockPrisma.whatsapp_message_logs.findMany.mockResolvedValue([]);
  mockPrisma.whatsapp_message_logs.count.mockResolvedValue(0);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Akses halaman konfigurasi integrasi', () => {
  it('admin dapat membuka status WhatsApp & AI', async () => {
    const wa = await request(app).get('/api/admin/integrations/whatsapp/status').set(auth());
    expect(wa.status).toBe(200);
    expect(wa.body.data).toHaveProperty('tokenConfigured');

    const ai = await request(app).get('/api/admin/integrations/ai/status').set(auth());
    expect(ai.status).toBe(200);
    expect(ai.body.data).toHaveProperty('apiKeyConfigured');
  });

  it('masyarakat dan petugas tidak dapat mengakses (403)', async () => {
    for (const role of ['masyarakat', 'petugas']) {
      mockPrisma.users.findUnique.mockResolvedValue({ id: 'x', role, status: 'AKTIF' } as any);
      const token = generateToken({ userId: 'x', role });
      for (const url of [
        '/api/admin/integrations/whatsapp/status',
        '/api/admin/integrations/ai/status',
        '/api/admin/integrations/history',
      ]) {
        const res = await request(app).get(url).set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(403);
      }
    }
  });

  it('tidak ada akses tanpa token (401)', async () => {
    const res = await request(app).get('/api/admin/integrations/whatsapp/status');
    expect(res.status).toBe(401);
  });
});

describe('Enkripsi rahasia (AES-256-GCM)', () => {
  it('enkripsi & dekripsi menghasilkan nilai asli', () => {
    const encrypted = encryptSecret(SECRET_TOKEN);
    expect(encrypted).toBeTruthy();
    expect(encrypted).not.toContain(SECRET_TOKEN);
    expect(encrypted?.startsWith('v1:')).toBe(true);
    expect(decryptSecret(encrypted as string)).toBe(SECRET_TOKEN);
  });

  it('nilai terenkripsi berbeda tiap kali (IV acak)', () => {
    const a = encryptSecret(SECRET_TOKEN);
    const b = encryptSecret(SECRET_TOKEN);
    expect(a).not.toBe(b);
    expect(decryptSecret(a as string)).toBe(SECRET_TOKEN);
    expect(decryptSecret(b as string)).toBe(SECRET_TOKEN);
  });
});

describe('Konfigurasi WhatsApp (Fonnte)', () => {
  it('menyimpan token terenkripsi & tidak pernah mengirimkannya kembali', async () => {
    const res = await request(app)
      .patch('/api/admin/integrations/whatsapp/settings')
      .set(auth())
      .send({ token: SECRET_TOKEN, enabled: true, adminRecipients: ['6285147722749'] });

    expect(res.status).toBe(200);
    expect(JSON.stringify(res.body)).not.toContain(SECRET_TOKEN);
    expect(res.body.data.tokenConfigured).toBe(true);
    expect(res.body.data.tokenSource).toBe('database');

    // tersimpan terenkripsi di database
    const saved = store['fonnte_token'];
    expect(saved).toBeTruthy();
    expect(saved).not.toContain(SECRET_TOKEN);
    expect(decryptSecret(saved)).toBe(SECRET_TOKEN);
  });

  it('token kosong mempertahankan token lama', async () => {
    store['fonnte_token'] = encryptSecret(SECRET_TOKEN) as string;

    const res = await request(app)
      .patch('/api/admin/integrations/whatsapp/settings')
      .set(auth())
      .send({ enabled: true });

    expect(res.status).toBe(200);
    expect(store['fonnte_token']).toBeTruthy();
    expect(decryptSecret(store['fonnte_token'])).toBe(SECRET_TOKEN);
  });

  it('clearToken menghapus token tersimpan', async () => {
    store['fonnte_token'] = encryptSecret(SECRET_TOKEN) as string;

    const res = await request(app)
      .patch('/api/admin/integrations/whatsapp/settings')
      .set(auth())
      .send({ clearToken: true });

    expect(res.status).toBe(200);
    expect(store['fonnte_token']).toBe('');
    expect(res.body.data.tokenConfigured).toBe(false);
  });

  it('menolak nomor penerima admin yang tidak valid', async () => {
    const res = await request(app)
      .patch('/api/admin/integrations/whatsapp/settings')
      .set(auth())
      .send({ adminRecipients: ['bukan-nomor'] });

    expect(res.status).toBe(400);
  });

  it('menolak jenis notifikasi yang tidak dikenal', async () => {
    const res = await request(app)
      .patch('/api/admin/integrations/whatsapp/settings')
      .set(auth())
      .send({ events: ['EVENT_TIDAK_ADA'] });

    expect(res.status).toBe(400);
  });

  it('menyimpan status gateway aktif/nonaktif', async () => {
    const res = await request(app)
      .patch('/api/admin/integrations/whatsapp/settings')
      .set(auth())
      .send({ enabled: false });

    expect(res.status).toBe(200);
    expect(res.body.data.enabled).toBe(false);
    expect(store['fonnte_enabled']).toBe('false');
  });

  it('mencatat riwayat perubahan tanpa nilai rahasia', async () => {
    await request(app)
      .patch('/api/admin/integrations/whatsapp/settings')
      .set(auth())
      .send({ token: SECRET_TOKEN, enabled: true });

    const historyCall = mockPrisma.integration_config_history.create.mock.calls[0][0].data;
    expect(historyCall.config_type).toBe('whatsapp');
    expect(historyCall.admin_email).toBe('admin@example.com');
    expect(historyCall.changed_fields).not.toContain(SECRET_TOKEN);
    expect(historyCall.changed_fields).toContain('token');
  });
});

describe('Konfigurasi AI Chatbot Provider', () => {
  it('menyimpan API key terenkripsi & tidak mengirimkannya kembali', async () => {
    const res = await request(app)
      .patch('/api/admin/integrations/ai/settings')
      .set(auth())
      .send({ apiKey: SECRET_API_KEY, provider: 'openrouter', model: 'google/gemini-2.5-flash' });

    expect(res.status).toBe(200);
    expect(JSON.stringify(res.body)).not.toContain(SECRET_API_KEY);
    expect(res.body.data.apiKeyConfigured).toBe(true);
    expect(res.body.data.model).toBe('google/gemini-2.5-flash');

    const saved = store['ai_api_key'];
    expect(saved).toBeTruthy();
    expect(saved).not.toContain(SECRET_API_KEY);
    expect(decryptSecret(saved)).toBe(SECRET_API_KEY);
  });

  it('menyimpan parameter model (temperature, max tokens, timeout, system prompt)', async () => {
    const res = await request(app)
      .patch('/api/admin/integrations/ai/settings')
      .set(auth())
      .send({
        provider: 'custom',
        baseUrl: 'https://ai.example.com/v1',
        model: 'anthropic/claude-sonnet-4',
        temperature: 0.7,
        maxTokens: 2048,
        timeoutMs: 45000,
        systemPrompt: 'Jawab singkat.',
      });

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      provider: 'custom',
      baseUrl: 'https://ai.example.com/v1',
      model: 'anthropic/claude-sonnet-4',
      temperature: 0.7,
      maxTokens: 2048,
      timeoutMs: 45000,
      systemPrompt: 'Jawab singkat.',
    });
  });

  it('token kosong mempertahankan API key lama', async () => {
    store['ai_api_key'] = encryptSecret(SECRET_API_KEY) as string;

    await request(app).patch('/api/admin/integrations/ai/settings').set(auth()).send({ model: 'x/y' });

    expect(decryptSecret(store['ai_api_key'])).toBe(SECRET_API_KEY);
  });

  it('clearApiKey menghapus API key tersimpan', async () => {
    store['ai_api_key'] = encryptSecret(SECRET_API_KEY) as string;

    const res = await request(app)
      .patch('/api/admin/integrations/ai/settings')
      .set(auth())
      .send({ clearApiKey: true });

    expect(res.status).toBe(200);
    expect(store['ai_api_key']).toBe('');
  });

  it('menolak provider AI yang tidak dikenal', async () => {
    const res = await request(app)
      .patch('/api/admin/integrations/ai/settings')
      .set(auth())
      .send({ provider: 'pakai-hp' });

    expect(res.status).toBe(400);
  });
});

describe('Pengujian chatbot (tanpa riwayat palsu)', () => {
  it('menguji chatbot tanpa membuat percakapan/pesan/analitik', async () => {
    store['ai_api_key'] = encryptSecret(SECRET_API_KEY) as string;

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ choices: [{ message: { content: 'Halo dari model uji.' } }] }),
    });

    const res = await request(app)
      .post('/api/admin/integrations/ai/test-chat')
      .set(auth())
      .send({ message: 'Halo' });

    expect(res.status).toBe(200);
    expect(res.body.data.reply).toContain('Halo dari model uji.');
    expect(res.body.data.responseTimeMs).toBeGreaterThanOrEqual(0);

    // tidak boleh ada data riwayat yang dibuat
    expect(mockPrisma.conversations.create).not.toHaveBeenCalled();
    expect(mockPrisma.chat_messages.create).not.toHaveBeenCalled();
    expect(mockPrisma.chat_analytics.create).not.toHaveBeenCalled();
  });

  it('menggunakan konfigurasi provider yang tersimpan', async () => {
    store['ai_model'] = 'google/gemini-2.5-flash';
    store['ai_base_url'] = 'https://openrouter.ai/api/v1';
    store['ai_api_key'] = encryptSecret(SECRET_API_KEY) as string;

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ choices: [{ message: { content: 'ok' } }] }),
    });

    await request(app).post('/api/admin/integrations/ai/test-chat').set(auth()).send({ message: 'hi' });

    const body = JSON.parse((global.fetch as any).mock.calls[0][1].body);
    expect(body.model).toBe('google/gemini-2.5-flash');
    expect((global.fetch as any).mock.calls[0][0]).toBe('https://openrouter.ai/api/v1/chat/completions');
  });

  it('gagal dengan pesan error bila provider menolak (tanpa membocorkan API key)', async () => {
    store['ai_api_key'] = encryptSecret(SECRET_API_KEY) as string;

    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ error: { message: 'Invalid API key ' + SECRET_API_KEY } }),
    });

    const res = await request(app).post('/api/admin/integrations/ai/test-chat').set(auth()).send({});

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('error');
    expect(res.body.message).not.toContain(SECRET_API_KEY);
  });
});

describe('Prioritas konfigurasi & keamanan', () => {
  it('konfigurasi database menang atas environment', async () => {
    store['fonnte_enabled'] = 'false';
    const res = await request(app).get('/api/admin/integrations/whatsapp/status').set(auth());
    expect(res.body.data.enabled).toBe(false);
    expect(res.body.data.source).toBe('database');
  });

  it('fallback ke environment bila database kosong', async () => {
    const res = await request(app).get('/api/admin/integrations/whatsapp/status').set(auth());
    expect(res.body.data.source).toBe('env');
    expect(res.body.data.enabled).toBe(true);
    expect(res.body.data.adminRecipientCount).toBe(1);
  });

  it('token tidak pernah masuk ke log', async () => {
    store['fonnte_token'] = encryptSecret(SECRET_TOKEN) as string;

    await request(app).patch('/api/admin/integrations/whatsapp/settings').set(auth()).send({ enabled: true });

    const logDump = JSON.stringify([
      (logger.info as any).mock.calls,
      (logger.warn as any).mock.calls,
      (logger.error as any).mock.calls,
      (logger.debug as any).mock.calls,
      (logger.audit as any).mock.calls,
    ]);
    expect(logDump).not.toContain(SECRET_TOKEN);
    expect(logDump).not.toContain(SECRET_API_KEY);
  });

  it('riwayat konfigurasi tidak menyimpan nilai rahasia', async () => {
    await request(app)
      .patch('/api/admin/integrations/ai/settings')
      .set(auth())
      .send({ apiKey: SECRET_API_KEY });

    const saved = JSON.stringify(mockPrisma.integration_config_history.create.mock.calls[0][0].data);
    expect(saved).not.toContain(SECRET_API_KEY);
  });
});
