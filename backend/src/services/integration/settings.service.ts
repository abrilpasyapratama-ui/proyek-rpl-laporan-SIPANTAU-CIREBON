import prisma from '../../utils/db';
import { config } from '../../config';
import { logger } from '../../utils/logger';
import { decryptSecret, encryptSecret } from './secret.service';

/**
 * Daftar jenis notifikasi WhatsApp (Fonnte) yang dapat diaktifkan/dimatikan
 * oleh administrator. Kunci ini dipakai juga sebagai idempotency prefix.
 */
export const FONNTE_EVENT_KEYS = [
  // Masyarakat
  'USER_REGISTRATION',
  'REPORT_RECEIVED',
  'REPORT_VERIFIED',
  'REPORT_PROCESSING',
  'REPORT_IN_PROGRESS',
  'REPORT_COMPLETED',
  'REPORT_REJECTED',
  'REPORT_UPDATED',
  'LOGIN_ALERT',
  // Petugas
  'OFFICER_ASSIGNED',
  'OFFICER_ASSIGNMENT_CHANGED',
  'OFFICER_ASSIGNMENT_CANCELLED',
  'OFFICER_PRIORITY_CHANGED',
  // Admin
  'ADMIN_NEW_USER',
  'ADMIN_NEW_REPORT',
  'ADMIN_REPORT_COMPLETED',
  'ADMIN_SYSTEM_ACTIVITY',
] as const;

export type FonnteEventKey = (typeof FONNTE_EVENT_KEYS)[number];

export type AiProvider = 'openrouter' | 'openai' | 'custom';

const KEY_ENABLED = 'fonnte_enabled';
const KEY_RECIPIENTS = 'fonnte_admin_recipients';
const KEY_EVENTS = 'fonnte_events';
const KEY_TELEGRAM = 'telegram_enabled';
const KEY_FONNTE_PROVIDER = 'fonnte_provider';
const KEY_FONNTE_API_URL = 'fonnte_api_url';
const KEY_FONNTE_TOKEN = 'fonnte_token'; // terenkripsi (AES-256-GCM)
const KEY_FONNTE_LAST_TEST = 'fonnte_last_test';

const KEY_AI_ENABLED = 'ai_enabled';
const KEY_AI_PROVIDER = 'ai_provider';
const KEY_AI_BASE_URL = 'ai_base_url';
const KEY_AI_MODEL = 'ai_model';
const KEY_AI_TEMPERATURE = 'ai_temperature';
const KEY_AI_MAX_TOKENS = 'ai_max_tokens';
const KEY_AI_TIMEOUT = 'ai_timeout_ms';
const KEY_AI_SYSTEM_PROMPT = 'ai_system_prompt';
const KEY_AI_API_KEY = 'ai_api_key'; // terenkripsi (AES-256-GCM)
const KEY_AI_LAST_TEST = 'ai_last_test';

export interface IntegrationSettings {
  fonnteEnabled: boolean;
  fonnteTokenConfigured: boolean;
  fonnteAdminRecipients: string[];
  fonnteEvents: FonnteEventKey[];
  telegramEnabled: boolean;
  source: {
    fonnteEnabled: 'env' | 'runtime';
    adminRecipients: 'env' | 'runtime';
    events: 'env' | 'runtime';
    telegramEnabled: 'env' | 'runtime';
  };
}

/** Konfigurasi Fonnte yang dipakai runtime (gabungan DB → env). */
export interface FonnteRuntimeConfig {
  enabled: boolean;
  provider: string;
  apiUrl: string;
  /** Token plaintext — HANYA di sisi server, tidak pernah dikirim frontend. */
  token: string;
  tokenConfigured: boolean;
  tokenSource: 'database' | 'env' | 'none';
  adminRecipients: string[];
  events: FonnteEventKey[];
  timeoutMs: number;
  maxRetries: number;
  retryDelayMs: number;
  countryCode: string;
  minIntervalMs: number;
  maxPerMinute: number;
  source: 'database' | 'env';
  /** Alasan singkat bila konfigurasi belum lengkap. */
  reason: string;
}

/** Konfigurasi penyedia AI yang dipakai runtime (gabungan DB → env). */
export interface AiRuntimeConfig {
  enabled: boolean;
  provider: AiProvider;
  baseUrl: string;
  /** API key plaintext — HANYA di sisi server. */
  apiKey: string;
  apiKeyConfigured: boolean;
  apiKeySource: 'database' | 'env' | 'none';
  model: string;
  temperature: number;
  maxTokens: number;
  timeoutMs: number;
  systemPrompt: string;
  source: 'database' | 'env';
  reason: string;
}

export interface LastTestStatus {
  ok: boolean;
  testedAt: string;
  provider: string;
  detail?: string;
  error?: string;
}

interface RawSettings {
  [key: string]: string | undefined;
}

let cache: { value: RawSettings; expiresAt: number } | null = null;
const CACHE_TTL_MS = 10_000;

async function readRaw(): Promise<RawSettings> {
  if (cache && cache.expiresAt > Date.now()) return cache.value;

  let rows: Array<{ key: string; value: string }> = [];
  try {
    const result = await prisma.integration_settings.findMany({
      select: { key: true, value: true },
    });
    rows = Array.isArray(result) ? result : [];
  } catch (err) {
    logger.error('Gagal membaca integration_settings', {
      error: err instanceof Error ? err.message : String(err),
    });
    rows = [];
  }

  const value: RawSettings = {};
  for (const row of rows) {
    value[row.key] = row.value;
  }
  cache = { value, expiresAt: Date.now() + CACHE_TTL_MS };
  return value;
}

export function clearIntegrationSettingsCache(): void {
  cache = null;
}

function parseList(raw: string | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter((v): v is string => typeof v === 'string').map((v) => v.trim()).filter(Boolean);
    }
  } catch {
    // fallback: daftar dipisah koma
  }
  return raw
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
}

function parseEvents(raw: string | undefined): FonnteEventKey[] | null {
  if (!raw) return null;
  const list = parseList(raw);
  return list.filter((e): e is FonnteEventKey =>
    (FONNTE_EVENT_KEYS as readonly string[]).includes(e)
  );
}

async function writeSetting(key: string, value: string, adminId?: string): Promise<void> {
  await prisma.integration_settings.upsert({
    where: { key },
    create: { key, value, updated_by: adminId ?? null },
    update: { value, updated_by: adminId ?? null },
  });
}

/**
 * Effective settings: env server sebagai default, override runtime (database)
 * menang bila diisi. Token HANYA dibaca dari env atau database terenkripsi.
 */
export async function getIntegrationSettings(): Promise<IntegrationSettings> {
  const raw = await readRaw();

  const envFonnteEnabled = config.whatsapp.fonte.enabled === true;
  const runtimeEnabled = raw[KEY_ENABLED] === undefined ? null : raw[KEY_ENABLED] === 'true';

  const envRecipients = Array.isArray(config.whatsapp.fonte.adminRecipients)
    ? config.whatsapp.fonte.adminRecipients
    : [];
  const runtimeRecipients =
    raw[KEY_RECIPIENTS] === undefined ? null : parseList(raw[KEY_RECIPIENTS]);

  const runtimeEvents = parseEvents(raw[KEY_EVENTS]);
  const envEvents = [...FONNTE_EVENT_KEYS];

  const envTelegram = config.telegram.enabled;
  const runtimeTelegram = raw[KEY_TELEGRAM] === undefined ? null : raw[KEY_TELEGRAM] === 'true';

  const dbToken = raw[KEY_FONNTE_TOKEN] ? decryptSecret(raw[KEY_FONNTE_TOKEN] as string) : null;

  return {
    fonnteEnabled: runtimeEnabled === null ? envFonnteEnabled : runtimeEnabled,
    fonnteTokenConfigured: Boolean(dbToken || config.whatsapp.fonte.apiToken),
    fonnteAdminRecipients:
      runtimeRecipients && runtimeRecipients.length > 0 ? runtimeRecipients : envRecipients,
    fonnteEvents: runtimeEvents && runtimeEvents.length > 0 ? runtimeEvents : envEvents,
    telegramEnabled: runtimeTelegram === null ? envTelegram : runtimeTelegram,
    source: {
      fonnteEnabled: runtimeEnabled === null ? 'env' : 'runtime',
      adminRecipients: runtimeRecipients && runtimeRecipients.length > 0 ? 'runtime' : 'env',
      events: runtimeEvents && runtimeEvents.length > 0 ? 'runtime' : 'env',
      telegramEnabled: runtimeTelegram === null ? 'env' : 'runtime',
    },
  };
}

/**
 * Konfigurasi Fonnte runtime.
 * Prioritas: 1) tersimpan di database, 2) environment variable, 3) belum dikonfigurasi.
 */
export async function getFonnteRuntimeConfig(): Promise<FonnteRuntimeConfig> {
  const raw = await readRaw();
  const env = config.whatsapp.fonte;

  const dbEnabled = raw[KEY_ENABLED] === undefined ? null : raw[KEY_ENABLED] === 'true';
  const enabled = dbEnabled === null ? env.enabled === true && config.whatsapp.enabled : dbEnabled;

  const dbToken = raw[KEY_FONNTE_TOKEN] ? decryptSecret(raw[KEY_FONNTE_TOKEN] as string) : null;
  const token = dbToken || env.apiToken || '';
  const tokenSource: 'database' | 'env' | 'none' = dbToken ? 'database' : env.apiToken ? 'env' : 'none';

  const dbRecipients = raw[KEY_RECIPIENTS] === undefined ? null : parseList(raw[KEY_RECIPIENTS]);
  const dbEvents = parseEvents(raw[KEY_EVENTS]);

  const apiUrl = raw[KEY_FONNTE_API_URL] || env.apiUrl || 'https://api.fonnte.com';
  const provider = raw[KEY_FONNTE_PROVIDER] || 'fonnte';

  let reason = 'Siap digunakan';
  if (!enabled) reason = 'Gateway WhatsApp dinonaktifkan';
  else if (!token) reason = 'Token Fonnte belum diisi (konfigurasi belum lengkap)';
  else if (dbRecipients !== null && dbRecipients.length === 0 && (env.adminRecipients ?? []).length === 0) {
    reason = 'Belum ada nomor penerima admin';
  }

  return {
    enabled,
    provider,
    apiUrl,
    token,
    tokenConfigured: Boolean(token),
    tokenSource,
    adminRecipients:
      dbRecipients && dbRecipients.length > 0 ? dbRecipients : env.adminRecipients ?? [],
    events: dbEvents && dbEvents.length > 0 ? dbEvents : [...FONNTE_EVENT_KEYS],
    timeoutMs: env.timeoutMs ?? 15000,
    maxRetries: env.maxRetries ?? 3,
    retryDelayMs: env.retryDelayMs ?? 5000,
    countryCode: env.countryCode ?? '62',
    minIntervalMs: env.minIntervalMs ?? 2000,
    maxPerMinute: env.maxPerMinute ?? 20,
    source: dbEnabled === null ? 'env' : 'database',
    reason,
  };
}

/** Konfigurasi penyedia AI runtime (DB → env). */
export async function getAiRuntimeConfig(): Promise<AiRuntimeConfig> {
  const raw = await readRaw();
  const env = config.ai;

  const dbEnabled = raw[KEY_AI_ENABLED] === undefined ? null : raw[KEY_AI_ENABLED] === 'true';
  const enabled = dbEnabled === null ? env.enabled : dbEnabled;

  const dbKey = raw[KEY_AI_API_KEY] ? decryptSecret(raw[KEY_AI_API_KEY] as string) : null;
  const apiKey = dbKey || env.apiKey || '';
  const apiKeySource: 'database' | 'env' | 'none' = dbKey ? 'database' : env.apiKey ? 'env' : 'none';

  const provider = (raw[KEY_AI_PROVIDER] || env.provider || 'openrouter') as AiProvider;
  const baseUrl = raw[KEY_AI_BASE_URL] || env.baseUrl || 'https://openrouter.ai/api/v1';
  const model = raw[KEY_AI_MODEL] || env.model || 'openai/gpt-4o-mini';
  const temperature = raw[KEY_AI_TEMPERATURE] ? parseFloat(raw[KEY_AI_TEMPERATURE]) : env.temperature;
  const maxTokens = raw[KEY_AI_MAX_TOKENS] ? parseInt(raw[KEY_AI_MAX_TOKENS], 10) : env.maxTokens;
  const timeoutMs = raw[KEY_AI_TIMEOUT] ? parseInt(raw[KEY_AI_TIMEOUT], 10) : env.timeoutMs;
  const systemPrompt = raw[KEY_AI_SYSTEM_PROMPT] ?? env.systemPrompt ?? '';

  let reason = 'Siap digunakan';
  if (!enabled) reason = 'Chatbot AI dinonaktifkan';
  else if (!apiKey) reason = 'API Key belum diisi (konfigurasi belum lengkap)';
  else if (!model) reason = 'Model belum dipilih';

  return {
    enabled,
    provider,
    baseUrl,
    apiKey,
    apiKeyConfigured: Boolean(apiKey),
    apiKeySource,
    model,
    temperature: Number.isFinite(temperature) ? temperature : 0.3,
    maxTokens: Number.isFinite(maxTokens) && maxTokens > 0 ? maxTokens : 800,
    timeoutMs: Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 30000,
    systemPrompt,
    source: dbEnabled === null ? 'env' : 'database',
    reason,
  };
}

/**
 * Simpan pengaturan WhatsApp (Fonnte).
 * `token` kosong → token lama DIPERTAHANKAN. `clearToken` → token dihapus.
 * Token disimpan terenkripsi (AES-256-GCM); plaintext tidak pernah disimpan.
 */
export async function saveFonnteSettings(
  patch: {
    enabled?: boolean;
    provider?: string;
    apiUrl?: string;
    token?: string;
    clearToken?: boolean;
    adminRecipients?: string[];
    events?: FonnteEventKey[];
  },
  adminId?: string
): Promise<{ changedFields: string[] }> {
  const changed: string[] = [];

  if (patch.enabled !== undefined) {
    await writeSetting(KEY_ENABLED, patch.enabled ? 'true' : 'false', adminId);
    changed.push('enabled');
  }
  if (patch.provider !== undefined) {
    await writeSetting(KEY_FONNTE_PROVIDER, patch.provider, adminId);
    changed.push('provider');
  }
  if (patch.apiUrl !== undefined) {
    await writeSetting(KEY_FONNTE_API_URL, patch.apiUrl, adminId);
    changed.push('apiUrl');
  }
  if (patch.adminRecipients !== undefined) {
    await writeSetting(KEY_RECIPIENTS, JSON.stringify(patch.adminRecipients), adminId);
    changed.push('adminRecipients');
  }
  if (patch.events !== undefined) {
    await writeSetting(KEY_EVENTS, JSON.stringify(patch.events), adminId);
    changed.push('events');
  }
  if (patch.clearToken) {
    await writeSetting(KEY_FONNTE_TOKEN, '', adminId);
    changed.push('token_removed');
  } else if (patch.token) {
    const encrypted = encryptSecret(patch.token);
    if (encrypted) {
      await writeSetting(KEY_FONNTE_TOKEN, encrypted, adminId);
      changed.push('token');
    }
  }

  clearIntegrationSettingsCache();
  return { changedFields: changed };
}

/**
 * Simpan pengaturan penyedia AI chatbot.
 * API key dienkripsi; plaintext tidak pernah disimpan di database.
 */
export async function saveAiSettings(
  patch: {
    enabled?: boolean;
    provider?: AiProvider;
    baseUrl?: string;
    model?: string;
    temperature?: number;
    maxTokens?: number;
    timeoutMs?: number;
    systemPrompt?: string;
    apiKey?: string;
    clearApiKey?: boolean;
  },
  adminId?: string
): Promise<{ changedFields: string[] }> {
  const changed: string[] = [];

  if (patch.enabled !== undefined) {
    await writeSetting(KEY_AI_ENABLED, patch.enabled ? 'true' : 'false', adminId);
    changed.push('enabled');
  }
  if (patch.provider !== undefined) {
    await writeSetting(KEY_AI_PROVIDER, patch.provider, adminId);
    changed.push('provider');
  }
  if (patch.baseUrl !== undefined) {
    await writeSetting(KEY_AI_BASE_URL, patch.baseUrl, adminId);
    changed.push('baseUrl');
  }
  if (patch.model !== undefined) {
    await writeSetting(KEY_AI_MODEL, patch.model, adminId);
    changed.push('model');
  }
  if (patch.temperature !== undefined) {
    await writeSetting(KEY_AI_TEMPERATURE, String(patch.temperature), adminId);
    changed.push('temperature');
  }
  if (patch.maxTokens !== undefined) {
    await writeSetting(KEY_AI_MAX_TOKENS, String(patch.maxTokens), adminId);
    changed.push('maxTokens');
  }
  if (patch.timeoutMs !== undefined) {
    await writeSetting(KEY_AI_TIMEOUT, String(patch.timeoutMs), adminId);
    changed.push('timeoutMs');
  }
  if (patch.systemPrompt !== undefined) {
    await writeSetting(KEY_AI_SYSTEM_PROMPT, patch.systemPrompt, adminId);
    changed.push('systemPrompt');
  }
  if (patch.clearApiKey) {
    await writeSetting(KEY_AI_API_KEY, '', adminId);
    changed.push('apiKey_removed');
  } else if (patch.apiKey) {
    const encrypted = encryptSecret(patch.apiKey);
    if (encrypted) {
      await writeSetting(KEY_AI_API_KEY, encrypted, adminId);
      changed.push('apiKey');
    }
  }

  clearIntegrationSettingsCache();
  return { changedFields: changed };
}

/** Catat riwayat perubahan konfigurasi (tanpa nilai rahasia). */
export async function recordConfigHistory(entry: {
  configType: 'whatsapp' | 'ai';
  provider?: string | null;
  adminId?: string | null;
  adminEmail?: string | null;
  changedFields: string[];
  status?: 'saved' | 'test_ok' | 'test_failed';
  note?: string | null;
}): Promise<void> {
  try {
    await prisma.integration_config_history.create({
      data: {
        config_type: entry.configType,
        provider: entry.provider ?? null,
        admin_id: entry.adminId ?? null,
        admin_email: entry.adminEmail ?? null,
        // Hanya NAMA field — nilai rahasia tidak pernah ikut.
        changed_fields: JSON.stringify(entry.changedFields),
        status: entry.status ?? 'saved',
        note: entry.note ?? null,
      },
    });
  } catch (err) {
    logger.error('Gagal menyimpan riwayat konfigurasi', {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

export async function getConfigHistory(limit = 25) {
  return prisma.integration_config_history.findMany({
    orderBy: { created_at: 'desc' },
    take: Math.min(Math.max(limit, 1), 100),
  });
}

/** Simpan status pengujian terakhir (tanpa data sensitif provider). */
export async function saveLastTestStatus(
  type: 'whatsapp' | 'ai',
  status: LastTestStatus
): Promise<void> {
  await writeSetting(type === 'whatsapp' ? KEY_FONNTE_LAST_TEST : KEY_AI_LAST_TEST, JSON.stringify(status));
  clearIntegrationSettingsCache();
}

export async function getLastTestStatus(type: 'whatsapp' | 'ai'): Promise<LastTestStatus | null> {
  const raw = await readRaw();
  const value = type === 'whatsapp' ? raw[KEY_FONNTE_LAST_TEST] : raw[KEY_AI_LAST_TEST];
  if (!value) return null;
  try {
    return JSON.parse(value) as LastTestStatus;
  } catch {
    return null;
  }
}

/**
 * Apakah kanal WhatsApp (Fonnte) boleh mengirim sekarang?
 * Bukan hanya switch: token juga harus ada agar konfigurasi dianggap lengkap.
 */
export async function isFonnteChannelActive(): Promise<boolean> {
  const cfg = await getFonnteRuntimeConfig();
  return cfg.enabled && cfg.tokenConfigured;
}

/** Apakah jenis notifikasi tertentu diaktifkan? */
export async function isFonnteEventEnabled(event: FonnteEventKey): Promise<boolean> {
  const cfg = await getFonnteRuntimeConfig();
  return cfg.events.includes(event);
}

/** Apakah notifikasi Telegram boleh dikirim? (dapat dimatikan terpisah) */
export async function isTelegramChannelActive(): Promise<boolean> {
  if (!config.telegram.enabled) return false;
  const settings = await getIntegrationSettings();
  return settings.telegramEnabled;
}

/**
 * Simpan pengaturan umum (dipakai controller lama).
 * @deprecated Gunakan saveFonnteSettings / saveAiSettings.
 */
export async function updateIntegrationSettings(
  patch: {
    fonnteEnabled?: boolean;
    fonnteAdminRecipients?: string[];
    fonnteEvents?: FonnteEventKey[];
    telegramEnabled?: boolean;
  },
  adminId?: string
): Promise<void> {
  const writes: Array<{ key: string; value: string }> = [];

  if (patch.fonnteEnabled !== undefined) {
    writes.push({ key: KEY_ENABLED, value: patch.fonnteEnabled ? 'true' : 'false' });
  }
  if (patch.fonnteAdminRecipients !== undefined) {
    writes.push({ key: KEY_RECIPIENTS, value: JSON.stringify(patch.fonnteAdminRecipients) });
  }
  if (patch.fonnteEvents !== undefined) {
    writes.push({ key: KEY_EVENTS, value: JSON.stringify(patch.fonnteEvents) });
  }
  if (patch.telegramEnabled !== undefined) {
    writes.push({ key: KEY_TELEGRAM, value: patch.telegramEnabled ? 'true' : 'false' });
  }

  for (const write of writes) {
    await writeSetting(write.key, write.value, adminId);
  }

  clearIntegrationSettingsCache();
}
