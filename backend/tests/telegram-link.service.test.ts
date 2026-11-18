import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../src/utils/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('../src/utils/db', () => ({
  default: {
    users: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    telegram_link_codes: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}));

import prisma from '../src/utils/db';
import { TelegramLinkService, TelegramLinkConfig } from '../src/services/telegram/telegram-link.service';

const prismaMock = prisma as unknown as {
  users: {
    findUnique: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  telegram_link_codes: {
    create: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    updateMany: ReturnType<typeof vi.fn>;
  };
};

const cfg: TelegramLinkConfig = {
  botUsername: 'SipantauTestBot',
  webhookSecret: 'test-secret',
  linkCodeTtlMinutes: 15,
  maxLinkAttempts: 3,
};

const CHAT_ID = '8305289318';

function codeRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'code-1',
    user_id: 'user-1',
    code_hash: 'hash',
    expires_at: new Date(Date.now() + 10 * 60 * 1000),
    used_at: null,
    attempts: 0,
    created_at: new Date(),
    ...overrides,
  };
}

describe('TelegramLinkService', () => {
  let service: TelegramLinkService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new TelegramLinkService(cfg);
    prismaMock.telegram_link_codes.create.mockResolvedValue({ id: 'code-1' });
    prismaMock.telegram_link_codes.update.mockResolvedValue({});
    prismaMock.telegram_link_codes.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.users.update.mockResolvedValue({ id: 'user-1', nama: 'Budi' });
  });

  it('membuat kode acak, menyimpan hash, dan deep link yang benar', async () => {
    prismaMock.users.findUnique.mockResolvedValue({
      id: 'user-1',
      telegram_status: 'DISCONNECTED',
    });

    const result = await service.generateLinkCode('user-1');

    expect(result.code).toHaveLength(32);
    expect(result.code).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(result.deepLink).toBe('https://t.me/SipantauTestBot?start=' + result.code);

    const createArgs = prismaMock.telegram_link_codes.create.mock.calls[0][0];
    expect(createArgs.data.code_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(createArgs.data.code_hash).not.toBe(result.code);
    expect(createArgs.data.expires_at.getTime()).toBeGreaterThan(Date.now() + 14 * 60 * 1000);

    expect(prismaMock.telegram_link_codes.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { user_id: 'user-1', used_at: null },
      })
    );
    expect(prismaMock.users.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { telegram_status: 'PENDING' },
      })
    );
  });

  it('menolak pembuatan kode untuk pengguna yang tidak ada', async () => {
    prismaMock.users.findUnique.mockResolvedValue(null);
    await expect(service.generateLinkCode('missing')).rejects.toThrow('USER_NOT_FOUND');
  });

  it('menghubungkan chat ID ke akun pemilik kode', async () => {
    prismaMock.telegram_link_codes.findUnique.mockResolvedValue(codeRow());
    prismaMock.users.findFirst.mockResolvedValue(null);

    const result = await service.linkByCode('kode-rahasia', CHAT_ID);

    expect(result).toEqual({
      ok: true,
      userId: 'user-1',
      userName: 'Budi',
      chatId: CHAT_ID,
    });

    expect(prismaMock.telegram_link_codes.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'code-1' },
        data: { attempts: 1 },
      })
    );
    expect(prismaMock.users.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'user-1' },
        data: expect.objectContaining({
          telegram_chat_id: CHAT_ID,
          telegram_status: 'CONNECTED',
        }),
      })
    );
    expect(prismaMock.telegram_link_codes.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'code-1', used_at: null },
        data: { used_at: expect.any(Date) },
      })
    );
  });

  it('menolak kode kedaluwarsa', async () => {
    prismaMock.telegram_link_codes.findUnique.mockResolvedValue(
      codeRow({ expires_at: new Date(Date.now() - 1000) })
    );

    const result = await service.linkByCode('kode', CHAT_ID);

    expect(result).toEqual({ ok: false, reason: 'expired' });
    expect(prismaMock.users.update).not.toHaveBeenCalled();
  });

  it('menolak kode yang sudah dipakai (single-use)', async () => {
    prismaMock.telegram_link_codes.findUnique.mockResolvedValue(
      codeRow({ used_at: new Date() })
    );

    const result = await service.linkByCode('kode', CHAT_ID);

    expect(result).toEqual({ ok: false, reason: 'used' });
    expect(prismaMock.users.update).not.toHaveBeenCalled();
  });

  it('memblokir kode setelah melebihi batas percobaan', async () => {
    prismaMock.telegram_link_codes.findUnique.mockResolvedValue(codeRow({ attempts: 3 }));

    const result = await service.linkByCode('kode', CHAT_ID);

    expect(result).toEqual({ ok: false, reason: 'too_many_attempts' });
    expect(prismaMock.telegram_link_codes.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { used_at: expect.any(Date) } })
    );
    expect(prismaMock.users.update).not.toHaveBeenCalled();
  });

  it('menolak chat ID yang sudah terhubung ke akun lain', async () => {
    prismaMock.telegram_link_codes.findUnique.mockResolvedValue(codeRow());
    prismaMock.users.findFirst.mockResolvedValue({ id: 'user-lain' });

    const result = await service.linkByCode('kode', CHAT_ID);

    expect(result).toEqual({ ok: false, reason: 'chat_already_linked' });
    expect(prismaMock.users.update).not.toHaveBeenCalled();
  });

  it('menolak kode tidak dikenal', async () => {
    prismaMock.telegram_link_codes.findUnique.mockResolvedValue(null);

    const result = await service.linkByCode('kode-palsu', CHAT_ID);

    expect(result).toEqual({ ok: false, reason: 'invalid' });
  });

  it('menolak chat ID yang bukan chat pribadi numerik', async () => {
    const result = await service.linkByCode('kode', '@channel');

    expect(result).toEqual({ ok: false, reason: 'invalid_chat' });
    expect(prismaMock.telegram_link_codes.findUnique).not.toHaveBeenCalled();
  });

  it('menolak bila kode dipakai bersamaan oleh request lain', async () => {
    prismaMock.telegram_link_codes.findUnique.mockResolvedValue(codeRow());
    prismaMock.users.findFirst.mockResolvedValue(null);
    prismaMock.telegram_link_codes.updateMany.mockResolvedValue({ count: 0 });

    const result = await service.linkByCode('kode', CHAT_ID);

    expect(result).toEqual({ ok: false, reason: 'used' });
    expect(prismaMock.users.update).not.toHaveBeenCalled();
  });

  it('memutuskan Telegram dan mengembalikan chat sebelumnya', async () => {
    prismaMock.users.findUnique.mockResolvedValue({ telegram_chat_id: CHAT_ID });

    const result = await service.disconnect('user-1');

    expect(result).toEqual({ wasConnected: true, chatId: CHAT_ID });
    expect(prismaMock.users.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          telegram_chat_id: null,
          telegram_connected_at: null,
          telegram_status: 'DISCONNECTED',
        },
      })
    );
  });

  it('mengembalikan status terhubung dengan chat ID tersamar', async () => {
    prismaMock.users.findUnique.mockResolvedValue({
      telegram_chat_id: CHAT_ID,
      telegram_connected_at: new Date('2026-10-01T00:00:00.000Z'),
      telegram_status: 'CONNECTED',
    });

    const result = await service.getStatus('user-1');

    expect(result.connected).toBe(true);
    expect(result.chatIdMasked).toBe('***9318');
    expect(result.chatIdMasked).not.toContain(CHAT_ID);
    expect(result.botUsername).toBe('SipantauTestBot');
  });

  it('deep link null bila username bot belum dikonfigurasi', () => {
    const withoutUsername = new TelegramLinkService({ ...cfg, botUsername: '' });
    expect(withoutUsername.buildDeepLink('kode')).toBeNull();
  });
});
