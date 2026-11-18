import prisma from '../../utils/db';
import { logger } from '../../utils/logger';

/** Metadata non-sensitif yang dicatat bersama event Telegram. */
export interface TelegramEventMeta {
  userId?: string;
  reportId?: string;
  chatIdMasked: string;
}

/**
 * Penyimpanan deduplikasi event Telegram.
 * `claim` mengembalikan false bila event sudah pernah dikirim (atau sedang
 * diproses) sehingga pesan tidak dikirim dua kali, termasuk setelah restart.
 */
export interface TelegramEventStore {
  claim(eventKey: string, meta: TelegramEventMeta): Promise<boolean>;
  markSent(eventKey: string, messageId?: number): Promise<void>;
  markFailed(eventKey: string, error?: string): Promise<void>;
}

const STALE_PENDING_MS = 10 * 60 * 1000;
const MAX_ERROR_LENGTH = 500;

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    (err as { code?: string }).code === 'P2002'
  );
}

function safeError(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  return message.slice(0, MAX_ERROR_LENGTH);
}

export class PrismaTelegramEventStore implements TelegramEventStore {
  async claim(eventKey: string, meta: TelegramEventMeta): Promise<boolean> {
    try {
      await prisma.telegram_message_logs.create({
        data: {
          event_key: eventKey,
          user_id: meta.userId ?? null,
          report_id: meta.reportId ?? null,
          chat_id_masked: meta.chatIdMasked,
          status: 'pending',
        },
      });
      return true;
    } catch (err) {
      if (!isUniqueViolation(err)) {
        // Database bermasalah: jangan blokir notifikasi, andalkan dedupe in-memory.
        logger.warn('Telegram event store tidak tersedia, lanjut tanpa dedupe persisten', {
          error: safeError(err),
        });
        return true;
      }

      try {
        const existing = await prisma.telegram_message_logs.findUnique({
          where: { event_key: eventKey },
        });

        if (!existing) return true;
        if (existing.status === 'sent') return false;
        if (
          existing.status === 'pending' &&
          Date.now() - existing.created_at.getTime() < STALE_PENDING_MS
        ) {
          return false;
        }

        // Status failed atau pending yang sudah basi boleh dicoba kembali.
        const reclaimed = await prisma.telegram_message_logs.updateMany({
          where: {
            event_key: eventKey,
            OR: [
              { status: 'failed' },
              { status: 'pending', created_at: { lt: new Date(Date.now() - STALE_PENDING_MS) } },
            ],
          },
          data: {
            status: 'pending',
            error: null,
            sent_at: null,
            chat_id_masked: meta.chatIdMasked,
          },
        });
        return reclaimed.count === 1;
      } catch (innerErr) {
        logger.warn('Telegram event store gagal memeriksa duplikat', {
          error: safeError(innerErr),
        });
        return true;
      }
    }
  }

  async markSent(eventKey: string, messageId?: number): Promise<void> {
    try {
      await prisma.telegram_message_logs.update({
        where: { event_key: eventKey },
        data: {
          status: 'sent',
          message_id: messageId ?? null,
          sent_at: new Date(),
          error: null,
        },
      });
    } catch (err) {
      logger.warn('Telegram event store gagal menandai terkirim', { error: safeError(err) });
    }
  }

  async markFailed(eventKey: string, error?: string): Promise<void> {
    try {
      await prisma.telegram_message_logs.update({
        where: { event_key: eventKey },
        data: { status: 'failed', error: error ? error.slice(0, MAX_ERROR_LENGTH) : null },
      });
    } catch (err) {
      logger.warn('Telegram event store gagal menandai gagal', { error: safeError(err) });
    }
  }
}

export const prismaTelegramEventStore = new PrismaTelegramEventStore();
