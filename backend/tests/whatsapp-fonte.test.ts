import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock config and dependencies
vi.mock('../src/config', () => ({
  config: {
    frontendUrl: 'http://localhost:5173',
    telegram: { enabled: false, botToken: '', adminChatId: '', botUsername: '', webhookSecret: '' },
    whatsapp: {
      enabled: true,
      provider: 'fonte',
      fonte: {
        enabled: true,
        apiUrl: 'https://api.fonnte.com',
        apiToken: 'test-token',
        adminRecipients: ['6283190039713'],
        timeoutMs: 5000,
        maxRetries: 3,
        retryDelayMs: 10, // Short delay for tests
        countryCode: '62',
        minIntervalMs: 0, // tanpa jeda anti-spam pada test
        maxPerMinute: 1000,
        webhookSecret: 'test-secret',
      },
      adminNumber: '6283190039713',
      maxRetries: 3,
      retryDelayMs: 10,
    },
  },
}));

vi.mock('../src/utils/db', () => ({
  default: {
    whatsapp_message_logs: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    integration_settings: {
      findMany: vi.fn().mockResolvedValue([]),
      upsert: vi.fn(),
    },
    $disconnect: vi.fn(),
  },
}));

vi.mock('../src/utils/phone', () => ({
  normalizePhone: vi.fn((input) => {
    if (!input) return null;
    let digits = String(input).replace(/\D/g, '');
    if (digits.startsWith('0')) digits = `62${digits.slice(1)}`;
    else if (!digits.startsWith('62')) digits = `62${digits}`;
    return digits;
  }),
  maskPhone: vi.fn((input) => {
    if (!input) return '—';
    const norm = String(input);
    if (norm.length <= 8) return norm.slice(0, 2) + '****';
    return norm.slice(0, 4) + '****' + norm.slice(-4);
  }),
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

import { WhatsAppService } from '../src/services/notification/whatsapp.service';
import prisma from '../src/utils/db';
import { normalizePhone, maskPhone } from '../src/utils/phone';
import { logger } from '../src/utils/logger';

const mockPrisma = prisma as unknown as {
  whatsapp_message_logs: {
    findUnique: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
};

describe('WhatsAppService - Fonte Provider', () => {
  let service: WhatsAppService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new WhatsAppService();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('should initialize with Fonte provider', () => {
    expect(service.enabled).toBe(true);
  });

  it('should send text message via Fonte API', async () => {
    // Mock successful API response
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: true, message: 'Success', data: { id: 'msg-123' } }),
    });

    mockPrisma.whatsapp_message_logs.findUnique.mockResolvedValue(null);
    mockPrisma.whatsapp_message_logs.create.mockResolvedValue({ id: 'log-1' });
    mockPrisma.whatsapp_message_logs.update.mockResolvedValue({});
    mockPrisma.whatsapp_message_logs.count.mockResolvedValue(0);

    const result = await service.sendMessage(
      {
        to: '6283190039713',
        type: 'text',
        text: { body: 'Test message' },
      },
      {
        eventType: 'TEST_EVENT',
        reportId: 'report-1',
        userId: 'user-1',
        idempotencyKey: 'test-key-1',
      }
    );

    expect(result.success).toBe(true);
    expect(result.messageId).toBe('msg-123');

    // Verify log was created (nomor disimpan dalam bentuk MASKED)
    expect(mockPrisma.whatsapp_message_logs.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          event_type: 'TEST_EVENT',
          recipient_number: '6283****9713',
          recipient_masked: '6283****9713',
          provider: 'fonte',
        }),
      })
    );

    // Verify log was updated to sent
    expect(mockPrisma.whatsapp_message_logs.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'log-1' },
        data: expect.objectContaining({
          delivery_status: 'sent',
          provider_message_id: 'msg-123',
        }),
      })
    );
  });

  it('should send template message via Fonte API', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: true, message: 'Success', data: { id: 'msg-456' } }),
    });

    mockPrisma.whatsapp_message_logs.findUnique.mockResolvedValue(null);
    mockPrisma.whatsapp_message_logs.create.mockResolvedValue({ id: 'log-2' });
    mockPrisma.whatsapp_message_logs.update.mockResolvedValue({});

    const result = await service.sendMessage(
      {
        to: '6283190039713',
        type: 'template',
        template: {
          name: 'new_report_admin',
          language: { code: 'id', policy: 'deterministic' },
          components: [
            {
              type: 'body',
              parameters: [
                { type: 'text', text: 'Test Report' },
                { type: 'text', text: 'Jalan Rusak' },
              ],
            },
          ],
        },
      },
      {
        eventType: 'NEW_REPORT_ADMIN',
        reportId: 'report-1',
      }
    );

    expect(result.success).toBe(true);
    expect(result.messageId).toBe('msg-456');

    // Verify correct payload was sent to Fonte (FormData)
    const fetchCall = vi.mocked(global.fetch).mock.calls[0];
    const formData = fetchCall[1]?.body as FormData;
    expect(formData.get('target')).toBe('6283190039713');
    expect(formData.get('message')).toContain('new_report_admin');
  });

  it('should handle Fonte API error after retries', async () => {
    // Mock all 3 attempts to fail
    global.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({ status: false, message: 'Invalid token' }) })
      .mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({ status: false, message: 'Invalid token' }) })
      .mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({ status: false, message: 'Invalid token' }) });

    mockPrisma.whatsapp_message_logs.findUnique.mockResolvedValue(null);
    mockPrisma.whatsapp_message_logs.create.mockResolvedValue({ id: 'log-3' });
    mockPrisma.whatsapp_message_logs.update.mockResolvedValue({});

    const result = await service.sendMessage(
      {
        to: '6283190039713',
        type: 'text',
        text: { body: 'Test' },
      },
      { eventType: 'TEST' }
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid token');
    expect(vi.mocked(global.fetch)).toHaveBeenCalledTimes(3); // 1 initial + 2 retries
  }, 10000);

  it('should handle network timeout', async () => {
    const abortError = new Error('Aborted');
    abortError.name = 'AbortError';
    global.fetch = vi.fn().mockRejectedValue(abortError);

    mockPrisma.whatsapp_message_logs.findUnique.mockResolvedValue(null);
    mockPrisma.whatsapp_message_logs.create.mockResolvedValue({ id: 'log-4' });
    mockPrisma.whatsapp_message_logs.update.mockResolvedValue({});

    const result = await service.sendMessage(
      {
        to: '6283190039713',
        type: 'text',
        text: { body: 'Test' },
      },
      { eventType: 'TEST' }
    );

    expect(result.success).toBe(false);
    expect(result.error).toBe('Fonnte API timeout');
  }, 10000);

  it('should retry on failure up to maxRetries', async () => {
    // First 2 calls fail, 3rd succeeds
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({ status: false, message: 'Server error' }) })
      .mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({ status: false, message: 'Server error' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ status: true, message: 'Success', data: { id: 'msg-retry' } }) });

    mockPrisma.whatsapp_message_logs.findUnique.mockResolvedValue(null);
    mockPrisma.whatsapp_message_logs.create.mockResolvedValue({ id: 'log-5' });
    mockPrisma.whatsapp_message_logs.update.mockResolvedValue({});

    const result = await service.sendMessage(
      {
        to: '6283190039713',
        type: 'text',
        text: { body: 'Test' },
      },
      { eventType: 'TEST_RETRY' }
    );

    expect(result.success).toBe(true);
    expect(result.messageId).toBe('msg-retry');
    // Should have been called 3 times (1 initial + 2 retries)
    expect(vi.mocked(global.fetch)).toHaveBeenCalledTimes(3);
  }, 10000);

  it('should prevent duplicate sends with idempotency key', async () => {
    mockPrisma.whatsapp_message_logs.findUnique.mockResolvedValue({
      id: 'existing-log',
      provider_message_id: 'msg-existing',
      delivery_status: 'sent',
    });

    const result = await service.sendMessage(
      {
        to: '6283190039713',
        type: 'text',
        text: { body: 'Test' },
      },
      { eventType: 'TEST', idempotencyKey: 'duplicate-key' }
    );

    expect(result.success).toBe(true);
    expect(result.messageId).toBe('msg-existing');
    expect(result.providerResponse).toEqual({ duplicate: true });
    // Should not call fetch at all
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('should return error for invalid phone number', async () => {
    // Ensure create returns a valid log entry
    mockPrisma.whatsapp_message_logs.create.mockResolvedValue({ id: 'log-invalid' });
    mockPrisma.whatsapp_message_logs.update.mockResolvedValue({});

    const result = await service.sendMessage(
      {
        to: 'invalid',
        type: 'text',
        text: { body: 'Test' },
      },
      { eventType: 'TEST' }
    );

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });
});