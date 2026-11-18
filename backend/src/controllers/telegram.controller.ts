import crypto from 'crypto';
import { Request, Response } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import { config } from '../config';
import { logger } from '../utils/logger';
import { telegramLinkService, TelegramLinkFailureReason } from '../services/telegram/telegram-link.service';
import { telegramService } from '../services/telegram/telegram.service';

/** Perbandingan string constant-time untuk secret webhook. */
function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

interface TelegramWebhookMessage {
  message_id?: number;
  from?: { id?: number; is_bot?: boolean; username?: string };
  chat?: { id?: number; type?: string };
  text?: string;
}

interface TelegramWebhookUpdate {
  update_id?: number;
  message?: TelegramWebhookMessage;
}

/**
 * Ambil kode dari teks Telegram.
 * Mendukung `/start <kode>`, `/start@NamaBot <kode>`, atau kode polos.
 */
function parseLinkPayload(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith('/start')) {
    const parts = trimmed.split(/\s+/);
    return parts.length >= 2 ? parts[1] : null;
  }

  if (trimmed.startsWith('/')) return null;

  if (/^[A-Za-z0-9_-]{8,128}$/.test(trimmed)) {
    return trimmed;
  }

  return null;
}

function failureMessage(reason?: TelegramLinkFailureReason): string {
  switch (reason) {
    case 'chat_already_linked':
      return 'Chat Telegram ini sudah terhubung ke akun SIPANTAU CIREBON lain. Putuskan hubungan dari akun tersebut terlebih dahulu.';
    case 'expired':
      return 'Kode penghubung sudah kedaluwarsa. Silakan buat kode baru dari halaman Profil SIPANTAU CIREBON.';
    case 'used':
      return 'Kode penghubung sudah pernah digunakan. Silakan buat kode baru dari halaman Profil SIPANTAU CIREBON.';
    case 'too_many_attempts':
      return 'Terlalu banyak percobaan. Kode penghubung diblokir. Silakan buat kode baru dari halaman Profil SIPANTAU CIREBON.';
    case 'invalid_chat':
      return 'Penghubungan hanya dapat dilakukan melalui chat pribadi dengan bot ini.';
    default:
      return 'Kode penghubung tidak valid atau sudah kedaluwarsa. Silakan buat kode baru dari halaman Profil SIPANTAU CIREBON.';
  }
}

/** Throttle balasan webhook per chat agar bot tidak dipakai spam. */
const replyWindows = new Map<string, { count: number; resetAt: number }>();
const REPLY_WINDOW_MS = 60 * 1000;
const MAX_REPLIES_PER_WINDOW = 10;

function canReply(chatId: string): boolean {
  const now = Date.now();
  const entry = replyWindows.get(chatId);
  if (!entry || now > entry.resetAt) {
    replyWindows.set(chatId, { count: 1, resetAt: now + REPLY_WINDOW_MS });
    return true;
  }
  if (entry.count >= MAX_REPLIES_PER_WINDOW) return false;
  entry.count += 1;
  return true;
}

async function reply(chatId: string, text: string, eventKey?: string): Promise<void> {
  if (!canReply(chatId)) return;
  try {
    await telegramService.sendUserMessage(chatId, text, eventKey);
  } catch (err) {
    logger.warn('Gagal mengirim balasan webhook Telegram', { error: errorMessage(err) });
  }
}

/** POST /api/telegram/link-code — hanya untuk pemilik akun (JWT). */
export const createLinkCode = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ status: 'error', message: 'Unauthorized' });
    }

    const result = await telegramLinkService.generateLinkCode(userId);

    return res.status(201).json({
      status: 'success',
      data: {
        code: result.code,
        expiresAt: result.expiresAt.toISOString(),
        deepLink: result.deepLink,
        botUsername: config.telegram.botUsername.replace(/^@/, '') || null,
        instructions:
          'Buka bot Telegram SIPANTAU, tekan Start, lalu kirim kode ini (atau gunakan tautan yang tersedia).',
      },
    });
  } catch (err) {
    if (err instanceof Error && err.message === 'USER_NOT_FOUND') {
      return res.status(404).json({ status: 'error', message: 'Pengguna tidak ditemukan' });
    }
    logger.error('Gagal membuat kode penghubung Telegram', { error: errorMessage(err) });
    return res.status(500).json({ status: 'error', message: 'Gagal membuat kode penghubung Telegram' });
  }
};

/** GET /api/telegram/status — status penghubungan milik pengguna sendiri. */
export const getStatus = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ status: 'error', message: 'Unauthorized' });
    }

    const status = await telegramLinkService.getStatus(userId);
    return res.status(200).json({ status: 'success', data: status });
  } catch (err) {
    logger.error('Gagal mengambil status Telegram', { error: errorMessage(err) });
    return res.status(500).json({ status: 'error', message: 'Gagal mengambil status Telegram' });
  }
};

/** DELETE /api/telegram/link — putuskan Telegram milik pengguna sendiri. */
export const disconnect = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ status: 'error', message: 'Unauthorized' });
    }

    const result = await telegramLinkService.disconnect(userId);

    if (result.wasConnected && result.chatId) {
      const text = telegramService.formatMessage(
        '🔌 TELEGRAM DIPUTUSKAN',
        [{ label: 'Akun', value: 'SIPANTAU CIREBON' }],
        'Akun Telegram ini tidak lagi menerima notifikasi personal. Hubungkan kembali melalui halaman Profil bila diperlukan.'
      );
      telegramService
        .sendUserMessage(result.chatId, text, 'telegram-disconnect:' + userId)
        .catch((err: unknown) => {
          logger.warn('Gagal mengirim konfirmasi pemutusan Telegram', { error: errorMessage(err) });
        });
    }

    return res.status(200).json({
      status: 'success',
      message: 'Akun Telegram berhasil diputuskan',
      data: { connected: false },
    });
  } catch (err) {
    logger.error('Gagal memutuskan Telegram', { error: errorMessage(err) });
    return res.status(500).json({ status: 'error', message: 'Gagal memutuskan Telegram' });
  }
};

/**
 * POST /api/telegram/webhook
 *
 * Endpoint ini dipanggil Telegram, bukan pengguna, sehingga tidak memakai JWT.
 * Autentikasi dilakukan dengan secret header resmi Telegram
 * `X-Telegram-Bot-Api-Secret-Token`.
 */
export const webhook = async (req: Request, res: Response) => {
  const secret = config.telegram.webhookSecret;
  if (!secret) {
    logger.warn('Webhook Telegram dipanggil tetapi TELEGRAM_WEBHOOK_SECRET belum diatur');
    return res.status(503).json({ ok: false, description: 'Webhook belum dikonfigurasi' });
  }

  const provided = req.header('x-telegram-bot-api-secret-token') || '';
  if (!safeEqual(provided, secret)) {
    logger.warn('Webhook Telegram ditolak: secret tidak valid', { ip: req.ip });
    return res.status(401).json({ ok: false });
  }

  try {
    const update = req.body as TelegramWebhookUpdate;
    if (!update || typeof update !== 'object' || !update.message) {
      return res.status(200).json({ ok: true });
    }

    const message = update.message;
    if (message.from?.is_bot) {
      return res.status(200).json({ ok: true });
    }

    const chat = message.chat;
    if (!chat || chat.type !== 'private' || typeof chat.id !== 'number') {
      return res.status(200).json({ ok: true });
    }

    const chatId = String(chat.id);
    const text = typeof message.text === 'string' ? message.text.trim() : '';
    if (!text) {
      return res.status(200).json({ ok: true });
    }

    const payload = parseLinkPayload(text);
    if (!payload) {
      await reply(
        chatId,
        telegramService.formatMessage(
          '🔗 HUBUNGKAN AKUN SIPANTAU',
          [
            { label: 'Langkah 1', value: 'Login ke aplikasi SIPANTAU CIREBON' },
            { label: 'Langkah 2', value: 'Buka halaman Profil, pilih Hubungkan Telegram' },
            { label: 'Langkah 3', value: 'Kirim kode penghubung ke chat ini' },
          ],
          'Belum punya kode? Buat kode baru dari halaman Profil SIPANTAU CIREBON.'
        ),
        update.update_id ? 'telegram-help:' + update.update_id : undefined
      );
      return res.status(200).json({ ok: true });
    }

    const result = await telegramLinkService.linkByCode(payload, chatId);

    if (result.ok) {
      await reply(
        chatId,
        telegramService.formatMessage(
          '✅ TELEGRAM BERHASIL TERHUBUNG',
          [
            { label: 'Akun', value: result.userName || 'SIPANTAU CIREBON' },
            { label: 'Status', value: 'Terhubung' },
          ],
          'Anda akan menerima notifikasi personal terkait laporan Anda. Kembali ke aplikasi untuk melihat status terbaru.'
        ),
        'telegram-link-ok:' + result.userId
      );
    } else {
      await reply(
        chatId,
        telegramService.formatMessage(
          '⚠️ PENGHUBUNGAN GAGAL',
          [{ label: 'Keterangan', value: failureMessage(result.reason) }],
          'Buka halaman Profil SIPANTAU CIREBON untuk membuat kode baru.'
        ),
        update.update_id ? 'telegram-link-fail:' + update.update_id : undefined
      );
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    logger.error('Webhook Telegram error', { error: errorMessage(err) });
    // Tetap 200 agar Telegram tidak melakukan retry berulang untuk error internal.
    return res.status(200).json({ ok: true });
  }
};
