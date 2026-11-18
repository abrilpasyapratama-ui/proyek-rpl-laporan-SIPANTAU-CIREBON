import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';

vi.mock('../src/utils/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(), audit: vi.fn() },
}));

// Paksa endpoint autentikasi JWT dilewati untuk pengujian rute.
// Endpoint Telegram milik pengguna hanya untuk pemiliknya sendiri; uji
// kepemilikan dilakukan pada tes layanan telegram-link.service.
vi.mock('../src/middlewares/auth.middleware', () => ({
  authenticate: (req: any, res: any, next: any) => {
    req.user = { id: 'test-user', role: 'masyarakat', status: 'AKTIF', nama: 'Test' };
    next();
  },
  requireActive: (req: any, res: any, next: any) => next(),
  authorizeRole: () => (req: any, res: any, next: any) => next(),
}));

vi.mock('../src/services/telegram/telegram-link.service', () => ({
  telegramLinkService: {
    generateLinkCode: vi.fn(),
    linkByCode: vi.fn(),
    disconnect: vi.fn(),
    getStatus: vi.fn(),
  },
}));

import app from '../src/index';
import { telegramLinkService } from '../src/services/telegram/telegram-link.service';

const linkMock = telegramLinkService as unknown as {
  generateLinkCode: ReturnType<typeof vi.fn>;
  linkByCode: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
  getStatus: ReturnType<typeof vi.fn>;
};

describe('Rute endpoint Telegram (JWT)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    linkMock.generateLinkCode.mockResolvedValue({
      code: 'abcdefghijklmnopqrstuvwxyz',
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      deepLink: 'https://t.me/SipantauTestBot?start=abcdefghijklmnopqrstuvwxyz',
      botUsername: 'SipantauTestBot',
      instructions: 'Buka bot dan kirim kode.',
    });
    linkMock.getStatus.mockResolvedValue({
      connected: false,
      status: 'DISCONNECTED',
      connectedAt: null,
      chatIdMasked: null,
      botUsername: 'SipantauTestBot',
    });
    linkMock.disconnect.mockResolvedValue({ wasConnected: false, chatId: null });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('POST /telegram/link-code menghasilkan kode untuk pemilik token', async () => {
    const res = await request(app).post('/api/telegram/link-code');

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('success');
    expect(res.body.data.code).toBe('abcdefghijklmnopqrstuvwxyz');
    expect(res.body.data.deepLink).toContain('t.me/SipantauTestBot?start=');
    expect(linkMock.generateLinkCode).toHaveBeenCalledWith('test-user');
  });

  it('GET /telegram/status mengembalikan status milik pengguna sendiri', async () => {
    const res = await request(app).get('/api/telegram/status');

    expect(res.status).toBe(200);
    expect(res.body.data.connected).toBe(false);
    expect(linkMock.getStatus).toHaveBeenCalledWith('test-user');
  });

  it('DELETE /telegram/link memutuskan akun pengguna sendiri', async () => {
    linkMock.disconnect.mockResolvedValue({ wasConnected: true, chatId: '***9318' });

    const res = await request(app).delete('/api/telegram/link');

    expect(res.status).toBe(200);
    expect(res.body.data.connected).toBe(false);
    expect(linkMock.disconnect).toHaveBeenCalledWith('test-user');
  });

  it('gagal membuat kode saat layanan gagal', async () => {
    linkMock.generateLinkCode.mockRejectedValue(new Error('down'));

    const res = await request(app).post('/api/telegram/link-code');

    expect(res.status).toBe(500);
    expect(res.body.status).toBe('error');
  });
});
