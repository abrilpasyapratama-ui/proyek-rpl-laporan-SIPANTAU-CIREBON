import { config } from '../../config';
import { logger } from '../../utils/logger';
import { ToolDefinition } from '../chat/tools';
import { AiProvider, getAiRuntimeConfig } from '../integration/settings.service';

/**
 * Layanan chat completion multi-provider.
 *
 * Adapter:
 *  - `openrouter` : OpenRouter (default, kompatibel OpenAI + header tambahan).
 *  - `openai`     : OpenAI Chat Completions API.
 *  - `custom`     : API OpenAI-compatible (base URL sendiri).
 *
 * Konfigurasi (provider, base URL, model, key, temperature, max tokens,
 * timeout) diambil dari runtime: database (disimpan admin) → environment.
 * API key HANYA dibaca di sisi server.
 */

export interface ChatCompletionMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
  name?: string;
}

export interface ToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

export interface AiProviderConfig {
  provider: AiProvider;
  baseUrl: string;
  apiKey: string;
  model: string;
  temperature: number;
  maxTokens: number;
  timeoutMs: number;
}

interface ProviderChoice {
  message?: {
    content?: string | null;
    tool_calls?: ToolCall[];
  };
}

interface ProviderResponse {
  choices?: ProviderChoice[];
  error?: { message?: string; code?: string };
  message?: string;
}

export interface AiConnectionResult {
  ok: boolean;
  reason?: string;
  provider: string;
  model?: string;
  modelAvailable?: boolean;
  sampleModels?: string[];
  latencyMs?: number;
}

/** Header autentikasi per adapter. */
function buildHeaders(cfg: AiProviderConfig): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${cfg.apiKey}`,
  };

  if (cfg.provider === 'openrouter') {
    // OpenRouter menerima header atribusi tambahan (opsional).
    headers['HTTP-Referer'] = config.frontendUrl;
    headers['X-Title'] = 'SIPANTAU Cirebon';
  }

  return headers;
}

/** Endpoint chat completion per adapter. */
function chatEndpoint(cfg: AiProviderConfig): string {
  return `${cfg.baseUrl.replace(/\/+$/, '')}/chat/completions`;
}

/** Hilangkan jejak API key dari pesan error. */
function sanitize(cfg: AiProviderConfig, message: string): string {
  let out = message;
  if (cfg.apiKey && cfg.apiKey.length >= 8) {
    out = out.split(cfg.apiKey).join('[REDACTED]');
  }
  return out.slice(0, 500);
}

/** Ambil konfigurasi AI runtime (database → environment). */
export async function resolveAiConfig(): Promise<AiProviderConfig> {
  const cfg = await getAiRuntimeConfig();
  return {
    provider: cfg.provider,
    baseUrl: cfg.baseUrl,
    apiKey: cfg.apiKey,
    model: cfg.model,
    temperature: cfg.temperature,
    maxTokens: cfg.maxTokens,
    timeoutMs: cfg.timeoutMs,
  };
}

/**
 * Chat completion generik (OpenAI-compatible) untuk semua adapter.
 * Mendukung function calling: tool_calls WAJIB dieksekusi lewat service layer.
 */
export async function completeChat(
  messages: ChatCompletionMessage[],
  tools?: ToolDefinition[],
  override?: Partial<AiProviderConfig>
): Promise<ChatCompletionMessage> {
  const base = await resolveAiConfig();
  const cfg: AiProviderConfig = { ...base, ...override };

  if (!cfg.apiKey) {
    throw new Error('Layanan chatbot belum dikonfigurasi (API Key kosong)');
  }
  if (!cfg.model) {
    throw new Error('Model AI belum dikonfigurasi');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), cfg.timeoutMs || 30000);

  try {
    const response = await fetch(chatEndpoint(cfg), {
      method: 'POST',
      headers: buildHeaders(cfg),
      body: JSON.stringify({
        model: cfg.model,
        messages: messages.map((m) => {
          const payload: Record<string, unknown> = { role: m.role, content: m.content };
          if (m.tool_calls) payload.tool_calls = m.tool_calls;
          if (m.tool_call_id) payload.tool_call_id = m.tool_call_id;
          if (m.name) payload.name = m.name;
          return payload;
        }),
        ...(tools && tools.length > 0 ? { tools, tool_choice: 'auto' } : {}),
        max_tokens: cfg.maxTokens,
        temperature: cfg.temperature,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      let detail = '';
      try {
        const raw = (await response.json()) as ProviderResponse;
        detail = raw?.error?.message ?? raw?.message ?? '';
      } catch {
        detail = '';
      }
      logger.error('Permintaan AI gagal', {
        provider: cfg.provider,
        status: response.status,
        model: cfg.model,
        detail: detail ? sanitize(cfg, detail) : undefined,
      });
      throw new Error(
        `Penyedia AI mengembalikan status ${response.status}${detail ? ': ' + sanitize(cfg, detail) : ''}`
      );
    }

    const data = (await response.json()) as ProviderResponse;
    if (data.error) {
      throw new Error(`Penyedia AI error: ${sanitize(cfg, data.error.message || 'unknown')}`);
    }

    const msg = data.choices?.[0]?.message;
    if (!msg) {
      throw new Error('Penyedia AI tidak mengembalikan jawaban');
    }

    return {
      role: 'assistant',
      content: msg.content ?? '',
      tool_calls: msg.tool_calls,
    };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Permintaan ke AI habis waktu, silakan coba lagi');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Daftar model yang tersedia di provider (jika endpoint `/models` didukung).
 * OpenRouter & OpenAI sama-sama mendukungnya.
 */
export async function listAiModels(cfg: AiProviderConfig): Promise<string[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), cfg.timeoutMs || 30000);
  try {
    const response = await fetch(`${cfg.baseUrl.replace(/\/+$/, '')}/models`, {
      method: 'GET',
      headers: buildHeaders(cfg),
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const data = (await response.json()) as { data?: Array<{ id?: string }> };
    return (data.data ?? [])
      .map((m) => m.id)
      .filter((id): id is string => typeof id === 'string');
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('Permintaan ke AI habis waktu');
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Uji koneksi ke penyedia AI.
 * - Memastikan API key valid (memanggil `/models` bila didukung).
 * - Memeriksa apakah model yang dikonfigurasi tersedia.
 */
export async function testAiConnection(
  override?: Partial<AiProviderConfig>
): Promise<AiConnectionResult> {
  const base = await resolveAiConfig();
  const cfg: AiProviderConfig = { ...base, ...override };
  const startedAt = Date.now();

  if (!cfg.apiKey) {
    return { ok: false, reason: 'API Key belum diisi (konfigurasi belum lengkap)', provider: cfg.provider };
  }
  if (!cfg.model) {
    return { ok: false, reason: 'Model AI belum dipilih', provider: cfg.provider };
  }

  let models: string[] = [];
  try {
    models = await listAiModels(cfg);
  } catch (err) {
    // Endpoint /models tidak tersedia → coba chat completion minimal.
    try {
      await completeChat(
        [{ role: 'user', content: 'ping' }],
        undefined,
        { ...cfg, maxTokens: 16 }
      );
      return {
        ok: true,
        provider: cfg.provider,
        model: cfg.model,
        modelAvailable: undefined,
        latencyMs: Date.now() - startedAt,
      };
    } catch (chatErr) {
      return {
        ok: false,
        reason: sanitize(cfg, chatErr instanceof Error ? chatErr.message : String(chatErr)),
        provider: cfg.provider,
        model: cfg.model,
        latencyMs: Date.now() - startedAt,
      };
    }
  }

  const modelAvailable = models.includes(cfg.model);
  return {
    ok: true,
    provider: cfg.provider,
    model: cfg.model,
    modelAvailable,
    sampleModels: models.slice(0, 10),
    latencyMs: Date.now() - startedAt,
  };
}
