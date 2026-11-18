import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../src/utils/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import { TelegramService, TelegramConfig } from '../src/services/telegram/telegram.service';

const BOT_TOKEN = '123456789:ABCDEFGHIJKLMNOPQRSTUVWXYZabcdef';
const ADMIN_CHAT_ID = '8305289318';

const baseConfig: TelegramConfig = {
  enabled: true,
  botToken: BOT_TOKEN,
  adminChatId: ADMIN_CHAT_ID,
};

function createService(overrides: Partial<TelegramConfig> = {}): TelegramService {
  return new TelegramService(
    { ...baseConfig, ...overrides },
    { allowInTest: true, idempotencyTtlMs: 60_000 }
  );
}

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

describe('TelegramService', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe('konfigurasi', () => {
    it('tidak mengirim saat TELEGRAM_ENABLED=false', async () => {
      const service = createService({ enabled: false });

      const result = await service.sendMessage('Halo');

      expect(result.success).toBe(false);
      expect(result.skipped).toBe('disabled');
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('tidak mengirim saat token kosong', async () => {
      const service = createService({ botToken: '' });

      const result = await service.sendMessage('Halo');

      expect(result.success).toBe(false);
      expect(result.skipped).toBe('not-configured');
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('tidak mengirim saat chat ID kosong', async () => {
      const service = createService({ adminChatId: '' });

      const result = await service.sendMessage('Halo');

      expect(result.success).toBe(false);
      expect(result.skipped).toBe('not-configured');
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('validateConfig melaporkan masalah tanpa membocorkan nilai rahasia', () => {
      const service = new TelegramService(
        { enabled: true, botToken: '', adminChatId: 'abc' },
        { allowInTest: true }
      );

      const status = service.validateConfig();

      expect(status.enabled).toBe(true);
      expect(status.ready).toBe(false);
      expect(status.issues.length).toBeGreaterThanOrEqual(2);
      expect(status.issues.join(' ')).not.toContain(BOT_TOKEN);
    });

    it('validateConfig siap saat konfigurasi lengkap', () => {
      const status = createService().validateConfig();

      expect(status.ready).toBe(true);
      expect(status.issues).toHaveLength(0);
    });
  });

  describe('validasi input', () => {
    it('menolak chat ID tidak valid', async () => {
      const service = createService();

      const result = await service.sendMessage('Halo', { chatId: 'bukan-chat-id' });

      expect(result.success).toBe(false);
      expect(result.skipped).toBe('invalid-chat-id');
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('menolak pesan kosong', async () => {
      const service = createService();

      const result = await service.sendMessage('   ');

      expect(result.success).toBe(false);
      expect(result.skipped).toBe('invalid-text');
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('meng-escape karakter khusus HTML pada formatMessage', () => {
      const service = createService();

      const message = service.formatMessage(
        'Judul <penting>',
        [{ label: 'Lokasi & Alamat', value: '<Jalan "Merdeka">' }],
        "Segera periksa 'laporan'"
      );

      expect(message).toContain('&lt;penting&gt;');
      expect(message).toContain('Lokasi &amp; Alamat');
      expect(message).toContain('&lt;Jalan &quot;Merdeka&quot;&gt;');
      expect(message).toContain('&#39;laporan&#39;');
      expect(message).not.toContain('<penting>');
    });
  });

  describe('pengiriman', () => {
    it('mengirim pesan berhasil sesuai respons mock', async () => {
      const service = createService();
      fetchMock.mockResolvedValue(jsonResponse({ ok: true, result: { message_id: 99 } }));

      const result = await service.sendMessage('Halo admin');

      expect(result).toEqual({ success: true, messageId: 99 });
      expect(fetchMock).toHaveBeenCalledTimes(1);

      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`);
      const body = JSON.parse((init as RequestInit).body as string);
      expect(body.chat_id).toBe(ADMIN_CHAT_ID);
      expect(body.text).toBe('Halo admin');
      expect(body.parse_mode).toBe('HTML');
    });

    it('menangani respons ok:false tanpa retry', async () => {
      const service = createService();
      fetchMock.mockResolvedValue(
        jsonResponse(
          { ok: false, error_code: 400, description: 'Bad Request: chat not found' },
          400
        )
      );

      const result = await service.sendMessage('Halo admin');

      expect(result.success).toBe(false);
      expect(result.error).toContain('chat not found');
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('retry terbatas untuk HTTP 500 lalu berhasil', async () => {
      const service = createService();
      fetchMock
        .mockResolvedValueOnce(jsonResponse({ ok: false, description: 'Internal Server Error' }, 500))
        .mockResolvedValueOnce(jsonResponse({ ok: false, description: 'Internal Server Error' }, 500))
        .mockResolvedValueOnce(jsonResponse({ ok: true, result: { message_id: 7 } }));

      const result = await service.sendMessage('Halo', { retryBaseDelayMs: 0 });

      expect(result.success).toBe(true);
      expect(result.messageId).toBe(7);
      expect(fetchMock).toHaveBeenCalledTimes(3);
    });

    it('berhenti setelah batas retry pada kegagalan jaringan', async () => {
      const service = createService();
      fetchMock.mockRejectedValue(new Error('ECONNRESET'));

      const result = await service.sendMessage('Halo', {
        maxRetries: 1,
        retryBaseDelayMs: 0,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('ECONNRESET');
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('menangani timeout (AbortError)', async () => {
      const service = createService();
      const abortError = new Error('The operation was aborted');
      abortError.name = 'AbortError';
      fetchMock.mockRejectedValue(abortError);

      const result = await service.sendMessage('Halo', {
        maxRetries: 0,
        retryBaseDelayMs: 0,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('timeout');
    });
  });

  describe('idempotensi', () => {
    it('tidak mengirim pesan ganda untuk event yang sama', async () => {
      const service = createService();
      fetchMock.mockResolvedValue(jsonResponse({ ok: true, result: { message_id: 1 } }));

      const first = await service.sendMessage('Laporan baru', { eventKey: 'report-new:r1' });
      const second = await service.sendMessage('Laporan baru', { eventKey: 'report-new:r1' });

      expect(first.success).toBe(true);
      expect(second.success).toBe(false);
      expect(second.skipped).toBe('duplicate');
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('mengizinkan percobaan ulang bila pengiriman sebelumnya gagal', async () => {
      const service = createService();
      fetchMock
        .mockResolvedValueOnce(
          jsonResponse({ ok: false, description: 'Bad Request: chat not found' }, 400)
        )
        .mockResolvedValueOnce(jsonResponse({ ok: true, result: { message_id: 2 } }));

      const first = await service.sendMessage('Halo', { eventKey: 'report-new:r2' });
      const second = await service.sendMessage('Halo', { eventKey: 'report-new:r2' });

      expect(first.success).toBe(false);
      expect(second.success).toBe(true);
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('resetIdempotency memungkinkan pengiriman ulang', async () => {
      const service = createService();
      fetchMock.mockResolvedValue(jsonResponse({ ok: true, result: { message_id: 3 } }));

      await service.sendMessage('Halo', { eventKey: 'report-new:r3' });
      service.resetIdempotency();
      const result = await service.sendMessage('Halo', { eventKey: 'report-new:r3' });

      expect(result.success).toBe(true);
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });
  });
});
