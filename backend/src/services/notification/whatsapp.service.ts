import crypto from 'crypto';
import { config } from '../../config';
import prisma from '../../utils/db';
import { normalizePhone, maskPhone } from '../../utils/phone';
import { logger } from '../../utils/logger';
import { isFonnteChannelActive, getFonnteRuntimeConfig, FonnteRuntimeConfig } from '../integration/settings.service';

export interface WhatsAppMessagePayload {
  to: string;                    // International format without + (e.g., 6283190039713)
  type: 'text' | 'template';
  text?: { body: string };
  template?: {
    name: string;
    language: { code: string; policy?: 'deterministic' };
    components?: Array<
      | {
          type: 'header' | 'body' | 'footer';
          parameters?: Array<{ type: 'text' | 'currency' | 'date_time'; text?: string; currency?: { fallback_value: string; code: string; amount_1000: number }; date_time?: string }>;
        }
      | {
          type: 'button';
          sub_type?: 'url' | 'quick_reply';
          index?: string;
          parameters?: Array<{ type: 'payload'; payload: string }>;
        }
    >;
  };
}

/**
 * Status pengiriman.
 * - `pending`  : request sedang dicoba / belum ada jawaban API.
 * - `sent`     : API Fonnte MENERIMA permintaan (pesan masuk antrean).
 *                BUKAN bukti bahwa pesan sudah sampai ke perangkat penerima.
 * - `failed`   : semua percobaan gagal.
 * Tidak ada status `delivered` karena API Fonnte tidakprovides bukti delivery.
 */
export type WhatsAppDeliveryStatus = 'pending' | 'sent' | 'failed';

export type WhatsAppSkipReason =
  | 'disabled'
  | 'not-configured'
  | 'invalid-recipient'
  | 'duplicate'
  | 'rate-limited';

export interface WhatsAppSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
  providerResponse?: unknown;
  status?: WhatsAppDeliveryStatus;
  skipped?: WhatsAppSkipReason;
  /** Status antrean dari provider (Fonnte: "pending"/"sent"). */
  providerProcess?: string;
}

export interface WhatsAppTemplateComponent {
  type: 'header' | 'body' | 'footer' | 'button';
  parameters?: Array<{ type: 'text'; text: string }>;
}

export interface WhatsAppStatus {
  provider: string;
  /** Master switch dari environment (WHATSAPP_ENABLED). */
  masterEnabled: boolean;
  /** Switch khusus Fonnte dari environment (FONNTE_ENABLED). */
  fonnteEnabled: boolean;
  /** Token tersedia di environment server (nilainya tidak pernah ditampilkan). */
  tokenConfigured: boolean;
  /** Semua syarat terpenuhi sehingga pesan boleh dikirim. */
  ready: boolean;
  reason: string;
  adminRecipients: string[];
  apiUrl: string;
}

interface FonnteSendResponse {
  status?: boolean;
  detail?: string;
  reason?: string;
  message?: string;
  process?: string;
  requestid?: number;
  id?: string[] | string;
  target?: string[];
  data?: { id?: string | string[] };
}

/**
 * Layanan WhatsApp terpusat.
 * Provider: Fonnte (utama), Meta Cloud API, Twilio, Custom webhook.
 *
 * - Token/secret TIDAK PERNAH dicetak ke log atau dikembalikan ke frontend.
 * - Idempotency key mencegah pengiriman ganda untuk satu event.
 * - Riwayat pengiriman disimpan di `whatsapp_message_logs` dengan nomor MASKED.
 * - Retry terbatas + anti-spam (jarak minimum per nomor & kuota per menit).
 */
export class WhatsAppService {
  private isEnabled: boolean;
  private provider: 'meta' | 'twilio' | 'custom' | 'fonte' | 'fonnte';
  /** Timestamp pengiriman terakhir per nomor (anti-spam). */
  private lastSentAt = new Map<string, number>();
  /** Token yang sedang dipakai (untuk sanitasi pesan error). */
  private activeToken: string | null = null;

  constructor() {
    this.provider = config.whatsapp.provider;
    this.isEnabled = this.computeEnabled();

    if (this.isEnabled) {
      logger.info('WhatsApp service initialized', { provider: this.provider });
    } else {
      logger.warn('WhatsApp service is DISABLED', {
        provider: this.provider,
        reason: this.disabledReason(),
      });
    }
  }

  /** Provider Fonnte (ex-Fonte). */
  private get isFonnte(): boolean {
    return this.provider === 'fonte' || this.provider === 'fonnte';
  }

  private get fonteConfig() {
    return config.whatsapp.fonte as {
      enabled?: boolean;
      apiUrl?: string;
      apiToken?: string;
      adminRecipients?: string[];
      timeoutMs?: number;
      maxRetries?: number;
      retryDelayMs?: number;
      countryCode?: string;
      minIntervalMs?: number;
      maxPerMinute?: number;
    };
  }

  private get maxRetries(): number {
    if (this.isFonnte && this.fonteConfig.maxRetries !== undefined) {
      return this.fonteConfig.maxRetries;
    }
    return config.whatsapp.maxRetries;
  }

  private get retryDelayMs(): number {
    if (this.isFonnte && this.fonteConfig.retryDelayMs !== undefined) {
      return this.fonteConfig.retryDelayMs;
    }
    return config.whatsapp.retryDelayMs;
  }

  private get timeoutMs(): number {
    if (this.isFonnte && this.fonteConfig.timeoutMs !== undefined) {
      return this.fonteConfig.timeoutMs;
    }
    return 15000;
  }

  /** Nomor admin penerima notifikasi (masked di log, mentah hanya di memory). */
  private async adminRecipients(): Promise<string[]> {
    const cfg = await getFonnteRuntimeConfig();
    if (cfg.adminRecipients.length > 0) return cfg.adminRecipients;
    const legacy = config.whatsapp.adminNumber;
    return legacy ? [legacy] : [];
  }

  /**
   * Status konfigurasi kanal WhatsApp (runtime: DB → env).
   * Token hanya dilaporkan sebagai "ada/tidak" — nilainya tidak pernah keluar.
   */
  async status(): Promise<WhatsAppStatus> {
    const masterEnabled = config.whatsapp.enabled;
    const cfg = await getFonnteRuntimeConfig();
    const ready = cfg.enabled && cfg.tokenConfigured && masterEnabled;

    let reason = 'Siap digunakan';
    if (!cfg.enabled) reason = 'Gateway WhatsApp dinonaktifkan';
    else if (!cfg.tokenConfigured) reason = 'Token Fonnte belum diisi (konfigurasi belum lengkap)';
    else if (!masterEnabled) reason = 'WHATSAPP_ENABLED=false (master switch off)';
    else if (!this.isFonnte) reason = 'Provider non-Fonnte aktif';

    return {
      provider: this.provider,
      masterEnabled,
      fonnteEnabled: cfg.enabled,
      tokenConfigured: cfg.tokenConfigured,
      ready,
      reason,
      adminRecipients: cfg.adminRecipients.map(maskPhone),
      apiUrl: cfg.apiUrl,
    };
  }

  private computeEnabled(): boolean {
    if (!config.whatsapp.enabled) return false;
    if (this.isFonnte) {
      const f = this.fonteConfig;
      // `enabled` undefined = dianggap aktif (kompatibilitas env lama),
      // tetapi token WAJIB ada agar tidak pernah mengklaim pesan terkirim.
      if (f.enabled === false) return false;
      if (!f.apiToken) return false;
    }
    return true;
  }

  private disabledReason(): string {
    if (!config.whatsapp.enabled) return 'WHATSAPP_ENABLED=false';
    if (this.isFonnte) {
      if (this.fonteConfig.enabled === false) return 'FONNTE_ENABLED=false';
      if (!this.fonteConfig.apiToken) return 'FONNTE_TOKEN belum diisi';
    }
    return 'konfigurasi belum lengkap';
  }

  /**
   * Hilangkan jejak token/kredensial dari pesan error sebelum disimpan/log.
   */
  private sanitizeError(message: string): string {
    let out = message;
    const secrets = [this.fonteConfig.apiToken, this.activeToken].filter(
      (s): s is string => Boolean(s)
    );
    for (const secret of secrets) {
      if (secret.length >= 8) out = out.split(secret).join('[REDACTED]');
    }
    return out.slice(0, 500);
  }

  /** Hash nomor penerima (untuk dedup/anti-spam tanpa menyimpan nomor mentah). */
  private static hashOf(normalized: string): string {
    return crypto.createHash('sha256').update(normalized).digest('hex').slice(0, 32);
  }

  /**
   * Anti-spam: jarak minimum antar pesan ke nomor yang sama + kuota per menit.
   */
  private async isRateLimited(
    recipientNormalized: string,
    cfg?: FonnteRuntimeConfig
  ): Promise<boolean> {
    const hash = WhatsAppService.hashOf(recipientNormalized);
    const now = Date.now();
    const minInterval = cfg?.minIntervalMs ?? this.fonteConfig.minIntervalMs ?? 2000;
    const maxPerMinute = cfg?.maxPerMinute ?? this.fonteConfig.maxPerMinute ?? 20;

    const last = this.lastSentAt.get(hash);
    if (last !== undefined && now - last < minInterval) {
      return true;
    }

    // Cek juga database (survive restart) memakai hash, bukan nomor mentah.
    try {
      const since = new Date(now - 60_000);
      const recent = await prisma.whatsapp_message_logs.count({
        where: { recipient_hash: hash, created_at: { gte: since } },
      });
      if (recent >= maxPerMinute) return true;
    } catch {
      // Bila pengecekan DB gagal, jangan memblokir pengiriman.
    }

    return false;
  }

  /**
   * Kirim pesan WhatsApp.
   * - Service disabled / belum dikonfigurasi: tidak ada permintaan ke provider.
   * - Nomor tidak valid: ditolak tanpa memanggil provider.
   * - Idempotency: event yang sama tidak dikirim dua kali.
   */
  async sendMessage(
    payload: WhatsAppMessagePayload,
    opts: {
      eventType: string;
      reportId?: string;
      userId?: string;
      idempotencyKey?: string;
    }
  ): Promise<WhatsAppSendResult> {
    const { eventType, reportId, userId, idempotencyKey } = opts;
    const recipientNormalized = normalizePhone(payload.to);

    if (!recipientNormalized) {
      logger.warn('WhatsApp skipped: nomor penerima tidak valid', { eventType });
      return {
        success: false,
        error: 'Nomor penerima WhatsApp tidak valid',
        status: 'failed',
        skipped: 'invalid-recipient',
      };
    }

    // Konfigurasi runtime: database (tersimpan admin) → environment → fallback.
    const cfg = await getFonnteRuntimeConfig();
    this.activeToken = cfg.token || null;

    if (!cfg.enabled || !cfg.tokenConfigured) {
      const notConfigured = cfg.tokenConfigured === false;
      logger.debug('WhatsApp skipped: kanal tidak aktif', {
        eventType,
        reason: cfg.reason,
      });
      return {
        success: false,
        error: `WhatsApp tidak aktif (${cfg.reason})`,
        status: 'failed',
        skipped: notConfigured ? 'not-configured' : 'disabled',
      };
    }

    // Anti-spam
    if (await this.isRateLimited(recipientNormalized, cfg)) {
      logger.warn('WhatsApp skipped: rate limit', { eventType, recipient: maskPhone(recipientNormalized) });
      return {
        success: false,
        error: 'Rate limit: terlalu banyak pesan ke nomor ini',
        status: 'failed',
        skipped: 'rate-limited',
      };
    }

    const recipientMasked = maskPhone(recipientNormalized);
    const recipientHash = WhatsAppService.hashOf(recipientNormalized);

    // Cek duplikasi via idempotency key
    if (idempotencyKey) {
      const existing = await prisma.whatsapp_message_logs.findUnique({
        where: { idempotency_key: idempotencyKey },
        select: { id: true, provider_message_id: true, delivery_status: true },
      });
      if (existing) {
        logger.info('WhatsApp duplicate send prevented', {
          eventType,
          idempotencyKey,
          existingStatus: existing.delivery_status,
        });
        return {
          success: true,
          messageId: existing.provider_message_id ?? undefined,
          status: existing.delivery_status === 'failed' ? 'failed' : 'sent',
          skipped: 'duplicate',
          providerResponse: { duplicate: true },
        };
      }
    }

    // Buat log entry awal (pending). Nomor disimpan dalam bentuk MASKED.
    const logEntry = await prisma.whatsapp_message_logs.create({
      data: {
        event_type: eventType,
        report_id: reportId ?? null,
        user_id: userId ?? null,
        recipient_number: recipientMasked,
        recipient_masked: recipientMasked,
        recipient_hash: recipientHash,
        message_template: JSON.stringify(payload),
        provider: this.provider,
        delivery_status: 'pending',
        attempt_count: 0,
        idempotency_key: idempotencyKey ?? null,
      },
    });

    let attempt = 0;
    const maxRetries = this.isFonnte ? cfg.maxRetries : this.maxRetries;

    while (attempt <= maxRetries) {
      attempt++;
      try {
        await prisma.whatsapp_message_logs.update({
          where: { id: logEntry.id },
          data: { attempt_count: attempt },
        });

        const result = await this.sendViaProvider(payload, recipientNormalized, cfg);

        if (result.success) {
          this.lastSentAt.set(recipientHash, Date.now());
          await prisma.whatsapp_message_logs.update({
            where: { id: logEntry.id },
            data: {
              delivery_status: 'sent',
              provider_message_id: result.messageId ?? null,
              provider_process: result.providerProcess ?? null,
              sent_at: new Date(),
              last_error: null,
            },
          });
          logger.info('WhatsApp message accepted by provider', {
            eventType,
            recipient: recipientMasked,
            messageId: result.messageId,
            providerProcess: result.providerProcess,
            attempt,
          });
          return { ...result, status: 'sent' };
        }

        // Provider mengembalikan error tanpa melempar exception.
        throw new Error(result.error ?? 'Provider mengembalikan kegagalan tanpa pesan error');
      } catch (err) {
        const errorMsg = this.sanitizeError(err instanceof Error ? err.message : String(err));
        const isLastAttempt = attempt >= maxRetries;

        await prisma.whatsapp_message_logs.update({
          where: { id: logEntry.id },
          data: {
            delivery_status: isLastAttempt ? 'failed' : 'pending',
            last_error: errorMsg,
          },
        });

        if (!isLastAttempt) {
          const delay = (this.isFonnte ? cfg.retryDelayMs : this.retryDelayMs) * Math.pow(2, attempt - 1);
          logger.warn('WhatsApp send failed, retrying', {
            eventType,
            recipient: recipientMasked,
            attempt,
            maxRetries,
            error: errorMsg,
            nextRetryMs: delay,
          });
          await new Promise((r) => setTimeout(r, delay));
          continue;
        }

        logger.error('WhatsApp send failed permanently', {
          eventType,
          recipient: recipientMasked,
          attempts: attempt,
          error: errorMsg,
        });
        return { success: false, error: errorMsg, status: 'failed', providerResponse: err };
      }
    }

    return { success: false, error: 'Maksimum percobaan pengiriman terlampaui', status: 'failed' };
  }

  /**
   * Kirim via provider yang dikonfigurasi.
   */
  private async sendViaProvider(
    payload: WhatsAppMessagePayload,
    recipientNormalized: string,
    cfg?: FonnteRuntimeConfig
  ): Promise<WhatsAppSendResult> {
    switch (this.provider) {
      case 'meta':
        return this.sendViaMeta(payload, recipientNormalized);
      case 'twilio':
        return this.sendViaTwilio(payload, recipientNormalized);
      case 'fonte':
      case 'fonnte':
        return this.sendViaFonnte(payload, recipientNormalized, cfg);
      case 'custom':
        return this.sendViaCustom(payload, recipientNormalized);
      default:
        throw new Error(`Provider WhatsApp tidak didukung: ${this.provider}`);
    }
  }

  /**
   * Meta WhatsApp Cloud API (WhatsApp Business Platform).
   * Docs: https://developers.facebook.com/docs/whatsapp/cloud-api/messages
   */
  private async sendViaMeta(
    payload: WhatsAppMessagePayload,
    recipientNormalized: string
  ): Promise<WhatsAppSendResult> {
    const { meta } = config.whatsapp;
    if (!meta.accessToken || !meta.phoneNumberId) {
      return { success: false, error: 'Kredensial Meta WhatsApp belum dikonfigurasi' };
    }

    const url = `https://graph.facebook.com/${meta.apiVersion}/${meta.phoneNumberId}/messages`;
    const body = {
      messaging_product: 'whatsapp',
      to: recipientNormalized,
      ...(payload.type === 'text'
        ? { type: 'text', text: { body: payload.text!.body } }
        : {
            type: 'template',
            template: {
              name: payload.template!.name,
              language: payload.template!.language,
              components: payload.template!.components ?? [],
            },
          }),
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${meta.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      const data = (await response.json()) as { error?: { message?: string }; messages?: Array<{ id: string }> };

      if (!response.ok) {
        const err = data.error ?? { message: 'Meta API error tidak diketahui' };
        logger.error('Meta WhatsApp API error', {
          status: response.status,
          error: err,
          recipient: maskPhone(recipientNormalized),
        });
        return { success: false, error: err.message ?? `HTTP ${response.status}`, providerResponse: data };
      }

      const messageId = data.messages?.[0]?.id;
      return { success: true, messageId, providerResponse: data };
    } catch (err) {
      clearTimeout(timeout);
      if (err instanceof Error && err.name === 'AbortError') {
        return { success: false, error: 'Meta WhatsApp API timeout' };
      }
      throw err;
    }
  }

  /**
   * Twilio WhatsApp API.
   * Docs: https://www.twilio.com/docs/whatsapp/api
   */
  private async sendViaTwilio(
    payload: WhatsAppMessagePayload,
    recipientNormalized: string
  ): Promise<WhatsAppSendResult> {
    const { twilio } = config.whatsapp;
    if (!twilio.accountSid || !twilio.authToken || !twilio.fromNumber) {
      return { success: false, error: 'Kredensial Twilio WhatsApp belum dikonfigurasi' };
    }

    const to = `whatsapp:+${recipientNormalized}`;
    const from = `whatsapp:${twilio.fromNumber}`;

    const url = `https://api.twilio.com/2010-04-01/Accounts/${twilio.accountSid}/Messages.json`;

    let bodyParams: Record<string, string> = { To: to, From: from };

    if (payload.type === 'text') {
      bodyParams.Body = payload.text!.body;
    } else {
      bodyParams.ContentSid = payload.template!.name;
      if (payload.template?.components) {
        const vars: Record<string, string> = {};
        payload.template.components.forEach((c, i) => {
          if (c.type === 'body' && c.parameters) {
            c.parameters.forEach((p, pIdx) => {
              if (p.type === 'text' && p.text) vars[`${pIdx + 1}`] = p.text;
            });
            void i;
          }
        });
        if (Object.keys(vars).length > 0) {
          bodyParams.ContentVariables = JSON.stringify(vars);
        }
      }
    }

    const auth = Buffer.from(`${twilio.accountSid}:${twilio.authToken}`).toString('base64');

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams(bodyParams),
        signal: controller.signal,
      });

      clearTimeout(timeout);
      const data = (await response.json()) as { message?: string; sid?: string };

      if (!response.ok) {
        return { success: false, error: data.message ?? `HTTP ${response.status}`, providerResponse: data };
      }

      return { success: true, messageId: data.sid, providerResponse: data };
    } catch (err) {
      clearTimeout(timeout);
      if (err instanceof Error && err.name === 'AbortError') {
        return { success: false, error: 'Twilio API timeout' };
      }
      throw err;
    }
  }

  /**
   * Custom HTTP webhook provider.
   * Expected payload: { to, type, text?, template? }
   * Expected response: { success: boolean, messageId?: string, error?: string }
   */
  private async sendViaCustom(
    payload: WhatsAppMessagePayload,
    recipientNormalized: string
  ): Promise<WhatsAppSendResult> {
    const { custom } = config.whatsapp;
    if (!custom.apiUrl) {
      return { success: false, error: 'URL custom WhatsApp provider belum dikonfigurasi' };
    }

    const body = { ...payload, to: recipientNormalized };
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (custom.apiKey) headers.Authorization = `Bearer ${custom.apiKey}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(custom.apiUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timeout);
      const data = (await response.json()) as { error?: string; messageId?: string };

      if (!response.ok) {
        return { success: false, error: data.error ?? `HTTP ${response.status}`, providerResponse: data };
      }

      return { success: true, messageId: data.messageId, providerResponse: data };
    } catch (err) {
      clearTimeout(timeout);
      if (err instanceof Error && err.name === 'AbortError') {
        return { success: false, error: 'Custom WhatsApp provider timeout' };
      }
      throw err;
    }
  }

  /**
   * Fonnte WhatsApp API (dokumentasi: https://docs.fonnte.com/api-send-message/).
   *
   * - Endpoint : POST {apiUrl}/send
   * - Auth     : header `Authorization: TOKEN` (TANPA "Bearer")
   * - Body     : form-data `target`, `message`, `countryCode` (string)
   * - Sukses   : { status: true, id: ["..."], process: "pending" }
   * - Gagal    : { status: false, reason: "token invalid" }
   *
   * Catatan: status `sent` berarti API MENERIMA permintaan (antrean), BUKAN
   * bukti pesan sampai ke perangkat penerima.
   */
  private async sendViaFonnte(
    payload: WhatsAppMessagePayload,
    recipientNormalized: string,
    cfg?: FonnteRuntimeConfig
  ): Promise<WhatsAppSendResult> {
    const f = this.fonteConfig;
    const token = cfg?.token || f.apiToken;
    const apiUrl = cfg?.apiUrl || f.apiUrl || 'https://api.fonnte.com';
    const countryCode = cfg?.countryCode ?? f.countryCode;
    const timeoutMs = cfg?.timeoutMs ?? this.timeoutMs;

    if (!token) {
      return { success: false, error: 'Token Fonnte belum diisi (konfigurasi belum lengkap)' };
    }

    const url = `${apiUrl.replace(/\/+$/, '')}/send`;

    const formData = new FormData();
    formData.append('target', recipientNormalized);

    if (payload.type === 'text') {
      formData.append('message', payload.text!.body);
    } else {
      // Fonnte hanya memerlukan field `message` (template dikirim sebagai teks).
      formData.append('message', JSON.stringify(payload.template));
    }
    if (countryCode) {
      formData.append('countryCode', String(countryCode));
    }

    const headers: Record<string, string> = {
      Authorization: token, // TANPA "Bearer"
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: formData,
        signal: controller.signal,
      });

      clearTimeout(timeout);

      let data: FonnteSendResponse = {};
      try {
        data = (await response.json()) as FonnteSendResponse;
      } catch {
        data = {};
      }

      const reason = data.reason ?? data.message ?? data.detail ?? '';
      const failed = !response.ok || data.status === false;

      if (failed) {
        const errorMessage = this.sanitizeError(
          reason || `Fonnte API error (HTTP ${response.status})`
        );
        logger.warn('Fonnte API menolak permintaan', {
          status: response.status,
          reason: errorMessage,
          recipient: maskPhone(recipientNormalized),
        });
        return { success: false, error: errorMessage, providerResponse: data };
      }

      // Sukses: `id` berupa array (["80367170"]) pada dokumentasi Fonnte.
      const rawId = data.id ?? data.data?.id;
      const messageId = Array.isArray(rawId) ? rawId[0] : rawId;

      return {
        success: true,
        messageId: messageId ? String(messageId) : undefined,
        providerProcess: data.process,
        providerResponse: { status: true, process: data.process, requestid: data.requestid },
      };
    } catch (err) {
      clearTimeout(timeout);
      if (err instanceof Error && err.name === 'AbortError') {
        return { success: false, error: 'Fonnte API timeout' };
      }
      throw err;
    }
  }

  /**
   * Uji koneksi ke Fonnte (POST /device).
   * Tidak mengirim pesan apa pun ke penerima; hanya memvalidasi token & device.
   * Token tidak pernah dikembalikan ke caller.
   */
  async testConnection(): Promise<{
    ok: boolean;
    reason?: string;
    deviceStatus?: string;
    deviceMasked?: string;
    quota?: string;
    expiresAt?: string;
    packageName?: string;
  }> {
    const cfg = await getFonnteRuntimeConfig();
    const f = this.fonteConfig;
    const token = cfg.token || f.apiToken;
    const apiUrl = cfg.apiUrl || f.apiUrl || 'https://api.fonnte.com';

    if (!this.isFonnte) {
      return { ok: false, reason: 'Provider aktif bukan Fonnte' };
    }
    if (!cfg.enabled) {
      return { ok: false, reason: 'Gateway WhatsApp dinonaktifkan' };
    }
    if (!token) {
      return { ok: false, reason: 'Token Fonnte belum diisi (konfigurasi belum lengkap)' };
    }

    const url = `${apiUrl.replace(/\/+$/, '')}/device`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), cfg.timeoutMs || this.timeoutMs);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { Authorization: token },
        signal: controller.signal,
      });
      clearTimeout(timeout);

      let data: Record<string, unknown> = {};
      try {
        data = (await response.json()) as Record<string, unknown>;
      } catch {
        data = {};
      }

      const ok = response.ok && data.status !== false;
      if (!ok) {
        const reason = this.sanitizeError(
          String(data.reason ?? data.message ?? `HTTP ${response.status}`)
        );
        return { ok: false, reason };
      }

      return {
        ok: true,
        deviceStatus: data.device_status ? String(data.device_status) : undefined,
        deviceMasked: data.device ? maskPhone(String(data.device)) : undefined,
        quota: data.quota !== undefined ? String(data.quota) : undefined,
        expiresAt: data.expired ? String(data.expired) : undefined,
        packageName: data.package ? String(data.package) : undefined,
      };
    } catch (err) {
      clearTimeout(timeout);
      if (err instanceof Error && err.name === 'AbortError') {
        return { ok: false, reason: 'Fonnte API timeout saat uji koneksi' };
      }
      return { ok: false, reason: this.sanitizeError(err instanceof Error ? err.message : String(err)) };
    }
  }

  /**
   * Kirim pesan yang sama ke seluruh nomor admin yang dikonfigurasi.
   * Setiap nomor punya idempotency key sendiri agar riwayat tetap rapi.
   */
  async sendToAdmins(
    text: string,
    opts: { eventType: string; reportId?: string; idempotencySuffix?: string }
  ): Promise<WhatsAppSendResult[]> {
    const recipients = await this.adminRecipients();
    const results: WhatsAppSendResult[] = [];

    for (const to of recipients) {
      const normalized = normalizePhone(to);
      if (!normalized) {
        results.push({
          success: false,
          error: 'Nomor admin tidak valid',
          status: 'failed',
          skipped: 'invalid-recipient',
        });
        continue;
      }

      const suffix = opts.idempotencySuffix ?? '';
      results.push(
        await this.sendMessage(
          { to: normalized, type: 'text', text: { body: text } },
          {
            eventType: opts.eventType,
            reportId: opts.reportId,
            idempotencyKey: `wa:${opts.eventType}:${opts.reportId ?? 'general'}:${suffix}:${WhatsAppService.hashOf(normalized)}`,
          }
        )
      );
    }

    return results;
  }

  /**
   * Helper: kirim template ke nomor admin.
   */
  async sendToAdmin(
    templateName: string,
    components: WhatsAppTemplateComponent[],
    opts: { eventType: string; reportId?: string; userId?: string }
  ): Promise<WhatsAppSendResult> {
    return this.sendMessage(
      {
        to: config.whatsapp.adminNumber,
        type: 'template',
        template: {
          name: templateName,
          language: { code: 'id', policy: 'deterministic' },
          components: components as Array<
            | { type: 'header' | 'body' | 'footer'; parameters?: Array<{ type: 'text' | 'currency' | 'date_time'; text?: string; currency?: { fallback_value: string; code: string; amount_1000: number }; date_time?: string }> }
            | { type: 'button'; sub_type?: 'url' | 'quick_reply'; index?: string; parameters?: Array<{ type: 'payload'; payload: string }> }
          >,
        },
      },
      opts
    );
  }

  /**
   * Helper: kirim teks biasa ke nomor admin (hanya dalam 24h window).
   */
  async sendTextToAdmin(
    text: string,
    opts: { eventType: string; reportId?: string; userId?: string }
  ): Promise<WhatsAppSendResult> {
    return this.sendMessage(
      { to: config.whatsapp.adminNumber, type: 'text', text: { body: text } },
      opts
    );
  }

  /**
   * Cek apakah service enabled.
   */
  get enabled(): boolean {
    return this.isEnabled;
  }
}

export const whatsappService = new WhatsAppService();
