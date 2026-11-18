import crypto from 'crypto';
import prisma from '../../utils/db';
import { config } from '../../config';
import { logger } from '../../utils/logger';

/**
 * Service penghubung akun Telegram.
 *
 * Keamanan:
 * - Kode dibuat acak (24 byte) dan hanya HASH-nya yang disimpan.
 * - Kode berlaku sekali, memiliki masa berlaku, dan dibatasi percobaannya.
 * - Chat ID personal hanya boleh terhubung ke satu akun.
 * - Kode asli tidak pernah dicatat ke log.
 */

export type TelegramLinkFailureReason =
  | 'invalid'
  | 'invalid_chat'
  | 'expired'
  | 'used'
  | 'too_many_attempts'
  | 'chat_already_linked';

export interface TelegramLinkResult {
  ok: boolean;
  reason?: TelegramLinkFailureReason;
  userId?: string;
  userName?: string;
  chatId?: string;
}

export interface TelegramLinkCodeResult {
  code: string;
  expiresAt: Date;
  deepLink: string | null;
}

export interface TelegramStatusResult {
  connected: boolean;
  status: 'DISCONNECTED' | 'PENDING' | 'CONNECTED';
  connectedAt: Date | null;
  chatIdMasked: string | null;
  botUsername: string | null;
}

export interface TelegramDisconnectResult {
  wasConnected: boolean;
  chatId: string | null;
}

const PERSONAL_CHAT_ID_PATTERN = /^\d{5,20}$/;
const CODE_BYTES = 24;
const MAX_CODE_LENGTH = 128;

export interface TelegramLinkConfig {
  botUsername: string;
  webhookSecret?: string;
  linkCodeTtlMinutes: number;
  maxLinkAttempts: number;
}

function hashCode(code: string): string {
  return crypto.createHash('sha256').update(code).digest('hex');
}

function maskChatId(chatId: string): string {
  if (chatId.length <= 4) return '***';
  return '***' + chatId.slice(-4);
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export class TelegramLinkService {
  private readonly cfg: TelegramLinkConfig;

  constructor(cfg: TelegramLinkConfig = config.telegram) {
    this.cfg = cfg;
  }

  /** Deep link resmi Telegram untuk membuka bot dengan kode penghubung. */
  buildDeepLink(code: string): string | null {
    const username = this.cfg.botUsername.replace(/^@/, '').trim();
    if (!username) return null;
    return 'https://t.me/' + encodeURIComponent(username) + '?start=' + encodeURIComponent(code);
  }

  /**
   * Buat kode penghubung baru untuk pengguna yang sedang login.
   * Kode lama yang belum dipakai otomatis dibatalkan.
   */
  async generateLinkCode(userId: string): Promise<TelegramLinkCodeResult> {
    const user = await prisma.users.findUnique({
      where: { id: userId },
      select: { id: true, telegram_status: true },
    });
    if (!user) {
      throw new Error('USER_NOT_FOUND');
    }

    const now = new Date();
    await prisma.telegram_link_codes.updateMany({
      where: { user_id: userId, used_at: null },
      data: { used_at: now },
    });

    const code = crypto.randomBytes(CODE_BYTES).toString('base64url');
    const ttlMinutes = Number.isFinite(this.cfg.linkCodeTtlMinutes) && this.cfg.linkCodeTtlMinutes > 0
      ? this.cfg.linkCodeTtlMinutes
      : 15;
    const expiresAt = new Date(now.getTime() + ttlMinutes * 60 * 1000);

    await prisma.telegram_link_codes.create({
      data: {
        user_id: userId,
        code_hash: hashCode(code),
        expires_at: expiresAt,
      },
    });

    if (user.telegram_status !== 'CONNECTED') {
      await prisma.users.update({
        where: { id: userId },
        data: { telegram_status: 'PENDING' },
      });
    }

    logger.info('Kode penghubung Telegram dibuat', { userId, expiresAt: expiresAt.toISOString() });

    return { code, expiresAt, deepLink: this.buildDeepLink(code) };
  }

  /**
   * Validasi kode yang dikirim pengguna dari Telegram, lalu hubungkan chat ID
   * ke akun pemilik kode. Chat ID berasal dari Telegram (bukan input bebas).
   */
  async linkByCode(rawCode: string, chatId: string): Promise<TelegramLinkResult> {
    if (!PERSONAL_CHAT_ID_PATTERN.test(chatId)) {
      return { ok: false, reason: 'invalid_chat' };
    }

    const code = typeof rawCode === 'string' ? rawCode.trim() : '';
    if (!code || code.length > MAX_CODE_LENGTH) {
      return { ok: false, reason: 'invalid' };
    }

    const row = await prisma.telegram_link_codes.findUnique({
      where: { code_hash: hashCode(code) },
    });
    if (!row) {
      logger.warn('Percobaan kode penghubung Telegram tidak dikenal', {
        chat: maskChatId(chatId),
      });
      return { ok: false, reason: 'invalid' };
    }

    const attempts = row.attempts + 1;
    const maxAttempts = Number.isFinite(this.cfg.maxLinkAttempts) && this.cfg.maxLinkAttempts > 0
      ? this.cfg.maxLinkAttempts
      : 5;

    if (attempts > maxAttempts) {
      if (!row.used_at) {
        await prisma.telegram_link_codes.update({
          where: { id: row.id },
          data: { used_at: new Date() },
        });
      }
      logger.warn('Kode penghubung Telegram diblokir karena terlalu banyak percobaan', {
        userId: row.user_id,
      });
      return { ok: false, reason: 'too_many_attempts' };
    }

    await prisma.telegram_link_codes.update({
      where: { id: row.id },
      data: { attempts },
    });

    if (row.used_at) {
      return { ok: false, reason: 'used' };
    }

    if (row.expires_at.getTime() <= Date.now()) {
      return { ok: false, reason: 'expired' };
    }

    const otherUser = await prisma.users.findFirst({
      where: {
        telegram_chat_id: chatId,
        NOT: { id: row.user_id },
      },
      select: { id: true },
    });
    if (otherUser) {
      logger.warn('Chat ID Telegram sudah terhubung ke akun lain', {
        chat: maskChatId(chatId),
      });
      return { ok: false, reason: 'chat_already_linked' };
    }

    // Klaim kode secara atomik agar tidak bisa dipakai dua request bersamaan.
    const claimed = await prisma.telegram_link_codes.updateMany({
      where: { id: row.id, used_at: null },
      data: { used_at: new Date() },
    });
    if (claimed.count !== 1) {
      return { ok: false, reason: 'used' };
    }

    try {
      const user = await prisma.users.update({
        where: { id: row.user_id },
        data: {
          telegram_chat_id: chatId,
          telegram_connected_at: new Date(),
          telegram_status: 'CONNECTED',
        },
        select: { id: true, nama: true },
      });

      // Batalkan sisa kode lain milik pengguna.
      await prisma.telegram_link_codes.updateMany({
        where: { user_id: row.user_id, used_at: null, NOT: { id: row.id } },
        data: { used_at: new Date() },
      });

      logger.info('Akun Telegram berhasil dihubungkan', {
        userId: user.id,
        chat: maskChatId(chatId),
      });

      return { ok: true, userId: user.id, userName: user.nama, chatId };
    } catch (err) {
      // Kembalikan kode agar pengguna bisa mencoba lagi bila gagal menyimpan.
      await prisma.telegram_link_codes
        .update({ where: { id: row.id }, data: { used_at: null } })
        .catch(() => undefined);

      if (typeof err === 'object' && err !== null && (err as { code?: string }).code === 'P2002') {
        return { ok: false, reason: 'chat_already_linked' };
      }
      logger.error('Gagal menghubungkan akun Telegram', { error: errorMessage(err) });
      throw err;
    }
  }

  /** Putuskan hubungan Telegram milik pengguna sendiri. */
  async disconnect(userId: string): Promise<TelegramDisconnectResult> {
    const user = await prisma.users.findUnique({
      where: { id: userId },
      select: { telegram_chat_id: true },
    });

    await prisma.users.update({
      where: { id: userId },
      data: {
        telegram_chat_id: null,
        telegram_connected_at: null,
        telegram_status: 'DISCONNECTED',
      },
    });

    await prisma.telegram_link_codes.updateMany({
      where: { user_id: userId, used_at: null },
      data: { used_at: new Date() },
    });

    logger.info('Akun Telegram diputuskan', { userId });

    return {
      wasConnected: Boolean(user?.telegram_chat_id),
      chatId: user?.telegram_chat_id ?? null,
    };
  }

  async getStatus(userId: string): Promise<TelegramStatusResult> {
    const user = await prisma.users.findUnique({
      where: { id: userId },
      select: {
        telegram_chat_id: true,
        telegram_connected_at: true,
        telegram_status: true,
      },
    });

    const chatId = user?.telegram_chat_id ?? null;
    const status = (user?.telegram_status ?? 'DISCONNECTED') as TelegramStatusResult['status'];

    return {
      connected: status === 'CONNECTED' && Boolean(chatId),
      status,
      connectedAt: user?.telegram_connected_at ?? null,
      chatIdMasked: chatId ? maskChatId(chatId) : null,
      botUsername: this.cfg.botUsername.replace(/^@/, '') || null,
    };
  }
}

export const telegramLinkService = new TelegramLinkService();
