import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';

vi.mock('../src/utils/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(), audit: vi.fn() },
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
import { telegramService } from '../src/services/telegram/telegram.service';

const SECRET = 'test-telegram-webhook-secret';
const linkMock = telegramLinkService as unknown as {
  linkByCode: ReturnType<typeof vi.fn>;
};

function updateBody(chatId: number, text: string, overrides: Record<string, unknown> = {}) {
  return {
    update_id: Math.floor(Math.random() * 1_000_000),
    message: {
      message_id: 1,
      from: { id: chatId, is_bot: false, username: 'pengguna' },
      chat: { id: chatId, type: 'private' },
      text,
      ...overrides,
    },
  };
}

describe('Webhook Telegram', () => {
  let sendSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    linkMock.linkByCode.mockResolvedValue({ ok: true, userId: 'user-1', userName: 'Budi' });
    sendSpy = vi
      .spyOn(telegramService, 'sendUserMessage')
      .mockResolvedValue({ success: true, messageId: 1 });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('menolak request tanpa secret', async () => {
    const res = await request(app)
      .post('/api/telegram/webhook')
      .send(updateBody(100000001, '/start kode'));

    expect(res.status).toBe(401);
    expect(linkMock.linkByCode).not.toHaveBeenCalled();
    expect(sendSpy).not.toHaveBeenCalled();
  });

  it('menolak request dengan secret salah', async () => {
    const res = await request(app)
      .post('/api/telegram/webhook')
      .set('X-Telegram-Bot-Api-Secret-Token', 'secret-palsu')
      .send(updateBody(100000002, '/start kode'));

    expect(res.status).toBe(401);
    expect(linkMock.linkByCode).not.toHaveBeenCalled();
  });

  it('menghubungkan akun dan mengirim konfirmasi ke chat pengirim', async () => {
    const res = await request(app)
      .post('/api/telegram/webhook')
      .set('X-Telegram-Bot-Api-Secret-Token', SECRET)
      .send(updateBody(100000003, '/start kode-valid'));

    expect(res.status).toBe(200);
    expect(linkMock.linkByCode).toHaveBeenCalledWith('kode-valid', '100000003');
    expect(sendSpy).toHaveBeenCalledTimes(1);

    const [chatId, text, eventKey] = sendSpy.mock.calls[0];
    expect(chatId).toBe('100000003');
    expect(text).toContain('TELEGRAM BERHASIL TERHUBUNG');
    expect(text).toContain('Budi');
    expect(eventKey).toBe('telegram-link-ok:user-1');
  });

  it('menerima kode polos tanpa perintah /start', async () => {
    await request(app)
      .post('/api/telegram/webhook')
      .set('X-Telegram-Bot-Api-Secret-Token', SECRET)
      .send(updateBody(100000004, 'kode-polos-123'));

    expect(linkMock.linkByCode).toHaveBeenCalledWith('kode-polos-123', '100000004');
  });

  it('membalas kode kedaluwarsa tanpa membocorkan detail internal', async () => {
    linkMock.linkByCode.mockResolvedValue({ ok: false, reason: 'expired' });

    await request(app)
      .post('/api/telegram/webhook')
      .set('X-Telegram-Bot-Api-Secret-Token', SECRET)
      .send(updateBody(100000005, '/start kode-lama'));

    const [, text] = sendSpy.mock.calls[0];
    expect(text).toContain('kedaluwarsa');
    expect(text).not.toContain('user-1');
  });

  it('memberi pesan khusus bila chat sudah terhubung ke akun lain', async () => {
    linkMock.linkByCode.mockResolvedValue({ ok: false, reason: 'chat_already_linked' });

    await request(app)
      .post('/api/telegram/webhook')
      .set('X-Telegram-Bot-Api-Secret-Token', SECRET)
      .send(updateBody(100000006, '/start kode'));

    const [, text] = sendSpy.mock.calls[0];
    expect(text).toContain('sudah terhubung ke akun SIPANTAU CIREBON lain');
  });

  it('mengabaikan update dari grup', async () => {
    const body = updateBody(100000007, '/start kode');
    (body.message.chat as { type: string }).type = 'group';

    const res = await request(app)
      .post('/api/telegram/webhook')
      .set('X-Telegram-Bot-Api-Secret-Token', SECRET)
      .send(body);

    expect(res.status).toBe(200);
    expect(linkMock.linkByCode).not.toHaveBeenCalled();
  });

  it('mengabaikan update dari bot lain', async () => {
    const body = updateBody(100000008, '/start kode');
    (body.message.from as { is_bot: boolean }).is_bot = true;

    const res = await request(app)
      .post('/api/telegram/webhook')
      .set('X-Telegram-Bot-Api-Secret-Token', SECRET)
      .send(body);

    expect(res.status).toBe(200);
    expect(linkMock.linkByCode).not.toHaveBeenCalled();
  });

  it('mengirim petunjuk bila /start tanpa kode', async () => {
    const res = await request(app)
      .post('/api/telegram/webhook')
      .set('X-Telegram-Bot-Api-Secret-Token', SECRET)
      .send(updateBody(100000009, '/start'));

    expect(res.status).toBe(200);
    expect(linkMock.linkByCode).not.toHaveBeenCalled();
    const [, text] = sendSpy.mock.calls[0];
    expect(text).toContain('HUBUNGKAN AKUN SIPANTAU');
  });

  it('mengabaikan update tanpa message', async () => {
    const res = await request(app)
      .post('/api/telegram/webhook')
      .set('X-Telegram-Bot-Api-Secret-Token', SECRET)
      .send({ update_id: 1 });

    expect(res.status).toBe(200);
    expect(linkMock.linkByCode).not.toHaveBeenCalled();
  });

  it('tetap 200 dan tidak crash saat terjadi error internal', async () => {
    linkMock.linkByCode.mockRejectedValue(new Error('database down'));

    const res = await request(app)
      .post('/api/telegram/webhook')
      .set('X-Telegram-Bot-Api-Secret-Token', SECRET)
      .send(updateBody(100000010, '/start kode'));

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });
});
