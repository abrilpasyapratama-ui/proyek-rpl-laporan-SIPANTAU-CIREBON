import { config } from '../../config';
import { logger } from '../../utils/logger';
import { prismaTelegramEventStore, TelegramEventStore } from './telegram.store';

/**
 * Konfigurasi minimum yang dibutuhkan service Telegram.
 * Nilai diambil dari environment backend dan tidak pernah dikirim ke frontend.
 */
export interface TelegramConfig {
  enabled: boolean;
  botToken: string;
  adminChatId: string;
}

export type TelegramParseMode = 'HTML' | 'none';

export interface TelegramSendOptions {
  /** Tujuan pengiriman. Default: TELEGRAM_ADMIN_CHAT_ID. */
  chatId?: string;
  /**
   * Kunci idempotensi. Bila event dengan kunci sama sudah berhasil dikirim
   * dalam rentang TTL, pengiriman berikutnya dilewati.
   */
  eventKey?: string;
  parseMode?: TelegramParseMode;
  timeoutMs?: number;
  /** Jumlah retry maksimum untuk kegagalan sementara. Default 2. */
  maxRetries?: number;
  retryBaseDelayMs?: number;
  /** Metadata non-sensitif untuk log deduplikasi persisten. */
  userId?: string;
  reportId?: string;
}

export type TelegramSkipReason =
  | 'disabled'
  | 'not-configured'
  | 'invalid-chat-id'
  | 'invalid-text'
  | 'duplicate'
  | 'test-env';

export interface TelegramSendResult {
  success: boolean;
  messageId?: number;
  error?: string;
  skipped?: TelegramSkipReason;
}

export interface TelegramMessageRow {
  label: string;
  value?: string | number | null;
}

export interface TelegramConfigStatus {
  enabled: boolean;
  ready: boolean;
  issues: string[];
}

const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_RETRIES = 2;
const DEFAULT_RETRY_BASE_DELAY_MS = 500;
const DEFAULT_IDEMPOTENCY_TTL_MS = 10 * 60 * 1000;
const MAX_MESSAGE_LENGTH = 4096;

const CHAT_ID_PATTERN = /^-?\d{5,20}$/;
const CHANNEL_USERNAME_PATTERN = /^@[A-Za-z][A-Za-z0-9_]{4,31}$/;
const BOT_TOKEN_PATTERN = /^\d{5,}:[A-Za-z0-9_-]{20,}$/;

const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function delay(ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Sembunyikan Chat ID di log; hanya 4 karakter terakhir yang ditampilkan. */
function maskChatId(chatId: string): string {
  if (chatId.length <= 4) return '***';
  return '***' + chatId.slice(-4);
}

interface TelegramApiResponse {
  ok?: boolean;
  result?: { message_id?: number };
  description?: string;
  error_code?: number;
  parameters?: { retry_after?: number };
}

/**
 * Klien Telegram Bot API.
 *
 * Prinsip:
 * - Hanya berjalan di backend. Token tidak pernah ditulis ke log atau response.
 * - Kegagalan Telegram tidak melempar error ke pemanggil; hasil dikembalikan
 *   sebagai objek agar alur utama aplikasi tetap berjalan.
 * - Idempotensi in-memory (TTL) mencegah pesan ganda untuk event yang sama
 *   pada satu instance backend.
 */
export class TelegramService {
  private readonly cfg: TelegramConfig;
  private readonly allowInTest: boolean;
  private readonly idempotencyTtlMs: number;
  private readonly store: TelegramEventStore | null;

  private readonly sentEvents = new Map<string, number>();
  private readonly pendingEvents = new Set<string>();

  constructor(
    cfg: TelegramConfig = config.telegram,
    options: {
      allowInTest?: boolean;
      idempotencyTtlMs?: number;
      /** Default null (in-memory saja). Singleton aplikasi memakai store Prisma. */
      store?: TelegramEventStore | null;
    } = {}
  ) {
    this.cfg = cfg;
    this.allowInTest = options.allowInTest ?? false;
    this.idempotencyTtlMs = options.idempotencyTtlMs ?? DEFAULT_IDEMPOTENCY_TTL_MS;
    this.store = options.store ?? null;
  }

  get enabled(): boolean {
    return this.cfg.enabled;
  }

  get adminChatId(): string {
    return this.cfg.adminChatId;
  }

  /**
   * Validasi konfigurasi saat startup. Tidak pernah mengembalikan nilai rahasia.
   */
  validateConfig(): TelegramConfigStatus {
    const issues: string[] = [];

    if (!this.cfg.botToken) {
      issues.push('TELEGRAM_BOT_TOKEN belum diisi');
    } else if (!BOT_TOKEN_PATTERN.test(this.cfg.botToken)) {
      issues.push('TELEGRAM_BOT_TOKEN formatnya tidak valid');
    }

    if (!this.cfg.adminChatId) {
      issues.push('TELEGRAM_ADMIN_CHAT_ID belum diisi');
    } else if (!this.isValidChatId(this.cfg.adminChatId)) {
      issues.push('TELEGRAM_ADMIN_CHAT_ID formatnya tidak valid');
    }

    return {
      enabled: this.cfg.enabled,
      ready: this.cfg.enabled && issues.length === 0,
      issues,
    };
  }

  isValidChatId(chatId: string): boolean {
    return CHAT_ID_PATTERN.test(chatId) || CHANNEL_USERNAME_PATTERN.test(chatId);
  }

  /** Escape karakter khusus agar aman dengan parse_mode HTML. */
  escapeHtml(value: string): string {
    return value.replace(/[&<>"']/g, (ch) => HTML_ESCAPES[ch] ?? ch);
  }

  /**
   * Susun pesan HTML dari judul + baris label/nilai.
   * Baris dengan nilai kosong otomatis dilewati.
   */
  formatMessage(title: string, rows: TelegramMessageRow[], footer?: string): string {
    const lines: string[] = ['<b>' + this.escapeHtml(title) + '</b>', ''];

    for (const row of rows) {
      if (row.value === undefined || row.value === null || row.value === '') continue;
      lines.push(this.escapeHtml(row.label) + ': ' + this.escapeHtml(String(row.value)));
    }

    if (footer) {
      lines.push('', this.escapeHtml(footer));
    }

    return lines.join('\n');
  }

  /** Bersihkan cache idempotensi. Dipakai oleh test. */
  resetIdempotency(): void {
    this.sentEvents.clear();
    this.pendingEvents.clear();
  }

  private purgeExpiredEvents(now: number): void {
    for (const [key, timestamp] of this.sentEvents) {
      if (now - timestamp > this.idempotencyTtlMs) {
        this.sentEvents.delete(key);
      }
    }
  }

  private isDuplicate(eventKey?: string): boolean {
    if (!eventKey) return false;
    const now = Date.now();
    this.purgeExpiredEvents(now);

    const sentAt = this.sentEvents.get(eventKey);
    if (sentAt !== undefined && now - sentAt <= this.idempotencyTtlMs) {
      return true;
    }

    return this.pendingEvents.has(eventKey);
  }

  private markPending(eventKey?: string): void {
    if (eventKey) this.pendingEvents.add(eventKey);
  }

  private clearPending(eventKey?: string): void {
    if (eventKey) this.pendingEvents.delete(eventKey);
  }

  private markSent(eventKey?: string): void {
    if (!eventKey) return;
    this.pendingEvents.delete(eventKey);
    this.sentEvents.set(eventKey, Date.now());
  }

  /** Catat keberhasilan ke store persisten (tidak pernah melempar error). */
  private async persistSent(eventKey?: string, messageId?: number): Promise<void> {
    if (!eventKey || !this.store) return;
    try {
      await this.store.markSent(eventKey, messageId);
    } catch (err) {
      logger.warn('Telegram event store gagal menandai terkirim', { error: errorMessage(err) });
    }
  }

  /** Catat kegagalan agar event yang sama boleh dicoba lagi nanti. */
  private async persistFailed(eventKey?: string, error?: string): Promise<void> {
    if (!eventKey || !this.store) return;
    try {
      await this.store.markFailed(eventKey, error);
    } catch (err) {
      logger.warn('Telegram event store gagal menandai gagal', { error: errorMessage(err) });
    }
  }

  /**
   * Kirim pesan teks ke Telegram.
   * Mengembalikan `{ success: false, skipped }` bila pengiriman tidak dilakukan.
   */
  async sendMessage(text: string, options: TelegramSendOptions = {}): Promise<TelegramSendResult> {
    const {
      chatId = this.cfg.adminChatId,
      eventKey,
      parseMode = 'HTML',
      timeoutMs = DEFAULT_TIMEOUT_MS,
      maxRetries = DEFAULT_MAX_RETRIES,
      retryBaseDelayMs = DEFAULT_RETRY_BASE_DELAY_MS,
      userId,
      reportId,
    } = options;

    if (!this.cfg.enabled) {
      return { success: false, skipped: 'disabled' };
    }

    if (config.isTest && !this.allowInTest) {
      return { success: false, skipped: 'test-env' };
    }

    if (!this.cfg.botToken || !chatId) {
      logger.warn('Telegram tidak terkirim: konfigurasi belum lengkap');
      return { success: false, skipped: 'not-configured' };
    }

    if (!this.isValidChatId(chatId)) {
      logger.warn('Telegram tidak terkirim: chat_id tidak valid', { chat: maskChatId(chatId) });
      return { success: false, skipped: 'invalid-chat-id' };
    }

    const normalizedText = typeof text === 'string' ? text.trim() : '';
    if (!normalizedText) {
      logger.warn('Telegram tidak terkirim: teks pesan kosong');
      return { success: false, skipped: 'invalid-text' };
    }

    if (this.isDuplicate(eventKey)) {
      logger.debug('Telegram dilewati: event sudah dikirim', { eventKey });
      return { success: false, skipped: 'duplicate' };
    }

    // Klaim event di penyimpanan persisten (bila tersedia) agar deduplikasi
    // tetap berlaku setelah restart / antar request.
    if (eventKey && this.store) {
      try {
        const claimed = await this.store.claim(eventKey, {
          userId,
          reportId,
          chatIdMasked: maskChatId(chatId),
        });
        if (!claimed) {
          logger.debug('Telegram dilewati: event sudah tercatat', { eventKey });
          return { success: false, skipped: 'duplicate' };
        }
      } catch (err) {
        logger.warn('Telegram dedupe store error, melanjutkan pengiriman', {
          error: errorMessage(err),
        });
      }
    }

    this.markPending(eventKey);

    const payload: Record<string, unknown> = {
      chat_id: chatId,
      text:
        normalizedText.length > MAX_MESSAGE_LENGTH
          ? normalizedText.slice(0, MAX_MESSAGE_LENGTH - 1) + '…'
          : normalizedText,
    };
    if (parseMode !== 'none') {
      payload.parse_mode = parseMode;
    }

    const url = 'https://api.telegram.org/bot' + this.cfg.botToken + '/sendMessage';

    try {
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);

        try {
          const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal: controller.signal,
          });

          const raw = await response.text();
          let data: TelegramApiResponse | null = null;
          try {
            data = raw ? (JSON.parse(raw) as TelegramApiResponse) : null;
          } catch {
            data = null;
          }

          if (response.ok && data?.ok === true) {
            this.markSent(eventKey);
            await this.persistSent(eventKey, data.result?.message_id);
            logger.info('Pesan Telegram terkirim', {
              chat: maskChatId(chatId),
              messageId: data.result?.message_id,
            });
            return { success: true, messageId: data.result?.message_id };
          }

          const description = data?.description || `HTTP ${response.status}`;
          const retriable = response.status === 429 || response.status >= 500;

          if (!retriable || attempt === maxRetries) {
            this.clearPending(eventKey);
            await this.persistFailed(eventKey, description);
            logger.warn('Telegram API menolak pesan', {
              status: response.status,
              description,
            });
            return { success: false, error: description };
          }

          const retryAfterMs = data?.parameters?.retry_after
            ? data.parameters.retry_after * 1000
            : retryBaseDelayMs * Math.pow(2, attempt);

          logger.warn('Telegram gagal sementara, mencoba ulang', {
            status: response.status,
            attempt: attempt + 1,
            maxRetries,
          });
          await delay(retryAfterMs);
        } catch (err) {
          const isAbort = err instanceof Error && err.name === 'AbortError';
          const message = isAbort ? 'timeout' : errorMessage(err);

          if (attempt === maxRetries) {
            this.clearPending(eventKey);
            await this.persistFailed(eventKey, message);
            logger.warn('Telegram request gagal', { error: message, attempt: attempt + 1 });
            return { success: false, error: message };
          }

          logger.warn('Telegram request gagal, mencoba ulang', {
            error: message,
            attempt: attempt + 1,
            maxRetries,
          });
          await delay(retryBaseDelayMs * Math.pow(2, attempt));
        } finally {
          clearTimeout(timer);
        }
      }

      this.clearPending(eventKey);
      await this.persistFailed(eventKey, 'Batas percobaan habis');
      return { success: false, error: 'Batas percobaan habis' };
    } catch (err) {
      this.clearPending(eventKey);
      await this.persistFailed(eventKey, errorMessage(err));
      logger.error('Telegram tidak terkirim', { error: errorMessage(err) });
      return { success: false, error: errorMessage(err) };
    }
  }

  /** Kirim pesan ke admin, dengan idempotensi berbasis `eventKey`. */
  async sendAdminMessage(
    text: string,
    eventKey?: string,
    options: Omit<TelegramSendOptions, 'chatId' | 'eventKey'> = {}
  ): Promise<TelegramSendResult> {
    return this.sendMessage(text, { ...options, chatId: this.cfg.adminChatId, eventKey });
  }

  /** Kirim pesan personal ke chat pengguna yang sudah terhubung. */
  async sendUserMessage(
    chatId: string,
    text: string,
    eventKey?: string,
    options: Omit<TelegramSendOptions, 'chatId' | 'eventKey'> = {}
  ): Promise<TelegramSendResult> {
    return this.sendMessage(text, { ...options, chatId, eventKey });
  }
}

export const telegramService = new TelegramService(config.telegram, {
  store: prismaTelegramEventStore,
});
