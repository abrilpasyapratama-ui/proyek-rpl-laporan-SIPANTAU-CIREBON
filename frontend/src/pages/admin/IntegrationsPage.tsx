import React, { useCallback, useEffect, useState } from 'react';
import {
  MessageCircle,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Plug,
  Send,
  History,
  ShieldCheck,
  ToggleLeft,
  ToggleRight,
  RefreshCw,
  Eye,
  EyeOff,
  Sparkles,
  Bot,
  Save,
  Trash2,
} from 'lucide-react';
import api from '../../services/api';
import { extractErrorMessage } from '../../utils/apiError';

interface EventItem {
  key: string;
  label: string;
  enabled: boolean;
}

interface WhatsAppStatus {
  provider: string;
  apiUrl: string;
  masterEnabled: boolean;
  enabled: boolean;
  tokenConfigured: boolean;
  tokenSource: 'database' | 'env' | 'none';
  ready: boolean;
  reason: string;
  adminRecipients: string[];
  adminRecipientCount: number;
  source: 'database' | 'env';
  events: EventItem[];
  telegramEnabled: boolean;
  encryptionAvailable: boolean;
  lastTest: { ok: boolean; testedAt: string; provider: string; detail?: string; error?: string } | null;
}

interface AiStatus {
  enabled: boolean;
  provider: string;
  baseUrl: string;
  model: string;
  temperature: number;
  maxTokens: number;
  timeoutMs: number;
  systemPrompt: string;
  apiKeyConfigured: boolean;
  apiKeySource: 'database' | 'env' | 'none';
  ready: boolean;
  reason: string;
  source: 'database' | 'env';
  encryptionAvailable: boolean;
  providerOptions: Array<{ value: string; label: string; defaultBaseUrl: string; defaultModel: string }>;
  modelSuggestions: string[];
  lastTest: { ok: boolean; testedAt: string; provider: string; detail?: string; error?: string } | null;
}

interface HistoryRow {
  id: string;
  event_type: string;
  recipient_number: string;
  recipient_masked: string | null;
  delivery_status: string;
  provider: string | null;
  provider_process: string | null;
  provider_message_id: string | null;
  last_error: string | null;
  created_at: string;
}

interface ConfigHistoryRow {
  id: string;
  configType: string;
  provider: string | null;
  adminEmail: string | null;
  changedFields: string[];
  status: string;
  note: string | null;
  createdAt: string;
}

const STATUS_LABEL: Record<string, string> = {
  pending: 'Menunggu',
  sent: 'Diterima API',
  failed: 'Gagal',
};

const statusBadge = (status: string) => {
  switch (status) {
    case 'sent':
      return 'bg-emerald-50 text-emerald-700 ring-emerald-100';
    case 'failed':
      return 'bg-red-50 text-red-700 ring-red-100';
    default:
      return 'bg-amber-50 text-amber-700 ring-amber-100';
  }
};

const inputCls =
  'w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 disabled:bg-slate-50 disabled:text-slate-500';

const cardCls = 'rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4';

const IntegrationsPage: React.FC = () => {
  const [tab, setTab] = useState<'whatsapp' | 'ai'>('whatsapp');

  // --- WhatsApp ---
  const [wa, setWa] = useState<WhatsAppStatus | null>(null);
  const [waForm, setWaForm] = useState({
    enabled: true,
    provider: 'fonnte',
    apiUrl: 'https://api.fonnte.com',
    token: '',
    clearToken: false,
    adminRecipients: '',
    events: [] as string[],
  });
  const [showToken, setShowToken] = useState(false);
  const [waMessage, setWaMessage] = useState('');
  const [waTarget, setWaTarget] = useState('');

  // --- AI ---
  const [ai, setAi] = useState<AiStatus | null>(null);
  const [aiForm, setAiForm] = useState({
    enabled: true,
    provider: 'openrouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    model: 'openai/gpt-4o-mini',
    temperature: 0.3,
    maxTokens: 800,
    timeoutMs: 30000,
    systemPrompt: '',
    apiKey: '',
    clearApiKey: false,
  });
  const [showApiKey, setShowApiKey] = useState(false);
  const [chatInput, setChatInput] = useState('Halo! Jawab singkat: apa itu SIPANTAU CIREBON?');
  const [chatResult, setChatResult] = useState<{
    ok: boolean;
    reply: string;
    responseTimeMs: number;
    error?: string;
  } | null>(null);

  // --- Umum ---
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [configHistory, setConfigHistory] = useState<ConfigHistoryRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isChatting, setIsChatting] = useState(false);
  const [notice, setNotice] = useState({ type: '', text: '' });
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const [waRes, aiRes] = await Promise.all([
        api.get('/admin/integrations/whatsapp/status'),
        api.get('/admin/integrations/ai/status'),
      ]);

      const waData: WhatsAppStatus = waRes.data.data;
      setWa(waData);
      setWaForm((prev) => ({
        ...prev,
        enabled: waData.enabled,
        provider: waData.provider,
        apiUrl: waData.apiUrl,
        token: '',
        clearToken: false,
        adminRecipients: '',
        events: waData.events.filter((e) => e.enabled).map((e) => e.key),
      }));

      const aiData: AiStatus = aiRes.data.data;
      setAi(aiData);
      setAiForm((prev) => ({
        ...prev,
        enabled: aiData.enabled,
        provider: aiData.provider,
        baseUrl: aiData.baseUrl,
        model: aiData.model,
        temperature: aiData.temperature,
        maxTokens: aiData.maxTokens,
        timeoutMs: aiData.timeoutMs,
        systemPrompt: aiData.systemPrompt,
        apiKey: '',
        clearApiKey: false,
      }));
    } catch (err) {
      setError(extractErrorMessage(err) || 'Gagal memuat konfigurasi integrasi');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadHistory = useCallback(async () => {
    try {
      const [waRes, cfgRes] = await Promise.all([
        api.get('/admin/integrations/whatsapp/history', { params: { limit: 20 } }),
        api.get('/admin/integrations/history', { params: { limit: 15 } }),
      ]);
      setHistory(waRes.data.data || []);
      setConfigHistory(cfgRes.data.data || []);
    } catch {
      // riwayat bersifat informasi
    }
  }, []);

  useEffect(() => {
    load();
    loadHistory();
  }, [load, loadHistory]);

  const saveWhatsApp = async () => {
    setIsSaving(true);
    setNotice({ type: '', text: '' });
    setError('');
    try {
      const payload: Record<string, unknown> = {
        enabled: waForm.enabled,
        provider: waForm.provider,
        apiUrl: waForm.apiUrl,
        events: waForm.events,
      };
      if (waForm.token.trim()) payload.token = waForm.token.trim();
      if (waForm.clearToken) payload.clearToken = true;
      if (waForm.adminRecipients.trim()) {
        payload.adminRecipients = waForm.adminRecipients
          .split(',')
          .map((v) => v.trim())
          .filter(Boolean);
      }

      const res = await api.patch('/admin/integrations/whatsapp/settings', payload);
      const data: WhatsAppStatus = res.data.data;
      setWa(data);
      setWaForm((prev) => ({ ...prev, token: '', clearToken: false, adminRecipients: '' }));
      setNotice({ type: 'success', text: 'Konfigurasi WhatsApp tersimpan.' });
      await loadHistory();
    } catch (err) {
      setError(extractErrorMessage(err) || 'Gagal menyimpan konfigurasi WhatsApp.');
    } finally {
      setIsSaving(false);
    }
  };

  const saveAi = async () => {
    setIsSaving(true);
    setNotice({ type: '', text: '' });
    setError('');
    try {
      const payload: Record<string, unknown> = {
        enabled: aiForm.enabled,
        provider: aiForm.provider,
        baseUrl: aiForm.baseUrl,
        model: aiForm.model,
        temperature: Number(aiForm.temperature),
        maxTokens: Number(aiForm.maxTokens),
        timeoutMs: Number(aiForm.timeoutMs),
        systemPrompt: aiForm.systemPrompt,
      };
      if (aiForm.apiKey.trim()) payload.apiKey = aiForm.apiKey.trim();
      if (aiForm.clearApiKey) payload.clearApiKey = true;

      const res = await api.patch('/admin/integrations/ai/settings', payload);
      const data: AiStatus = res.data.data;
      setAi(data);
      setAiForm((prev) => ({ ...prev, apiKey: '', clearApiKey: false }));
      setNotice({ type: 'success', text: 'Konfigurasi AI Chatbot tersimpan.' });
      await loadHistory();
    } catch (err) {
      setError(extractErrorMessage(err) || 'Gagal menyimpan konfigurasi AI.');
    } finally {
      setIsSaving(false);
    }
  };

  const testWhatsAppConnection = async () => {
    setIsTesting(true);
    setNotice({ type: '', text: '' });
    setError('');
    try {
      const res = await api.post('/admin/integrations/whatsapp/test-connection');
      setNotice({
        type: res.data.data?.ok ? 'success' : 'error',
        text: res.data.message || 'Uji koneksi selesai.',
      });
      await loadHistory();
    } catch (err) {
      setError(extractErrorMessage(err) || 'Gagal menguji koneksi Fonnte.');
    } finally {
      setIsTesting(false);
    }
  };

  const sendWhatsAppTest = async () => {
    setIsSending(true);
    setNotice({ type: '', text: '' });
    setError('');
    try {
      const res = await api.post('/admin/integrations/whatsapp/test-message', {
        message: waMessage.trim() || undefined,
        target: waTarget.trim() || undefined,
      });
      setNotice({
        type: res.data.data?.some?.((r: { success: boolean }) => r.success) ? 'success' : 'error',
        text: res.data.message || 'Permintaan pesan percobaan diproses.',
      });
      await loadHistory();
    } catch (err) {
      setError(extractErrorMessage(err) || 'Gagal mengirim pesan percobaan.');
    } finally {
      setIsSending(false);
    }
  };

  const testAiConnection = async () => {
    setIsTesting(true);
    setNotice({ type: '', text: '' });
    setError('');
    try {
      const res = await api.post('/admin/integrations/ai/test-connection');
      const modelInfo = res.data.data?.modelAvailable === false
        ? ` (model ${res.data.data.model} tidak ada di daftar provider)`
        : '';
      setNotice({
        type: res.data.data?.ok ? 'success' : 'error',
        text: (res.data.message || 'Uji koneksi selesai.') + modelInfo,
      });
      await loadHistory();
    } catch (err) {
      setError(extractErrorMessage(err) || 'Gagal menguji koneksi penyedia AI.');
    } finally {
      setIsTesting(false);
    }
  };

  const testChat = async () => {
    setIsChatting(true);
    setChatResult(null);
    setError('');
    try {
      const res = await api.post('/admin/integrations/ai/test-chat', { message: chatInput });
      const data = res.data.data ?? {};
      setChatResult({
        ok: res.data.status === 'success',
        reply: data.reply ?? '',
        responseTimeMs: data.responseTimeMs ?? 0,
        error: res.data.status === 'success' ? undefined : res.data.message,
      });
      await loadHistory();
    } catch (err) {
      setChatResult({
        ok: false,
        reply: '',
        responseTimeMs: 0,
        error: extractErrorMessage(err) || 'Uji chatbot gagal.',
      });
    } finally {
      setIsChatting(false);
    }
  };

  const toggleEvent = (key: string) => {
    setWaForm((prev) => ({
      ...prev,
      events: prev.events.includes(key)
        ? prev.events.filter((k) => k !== key)
        : [...prev.events, key],
    }));
  };

  const toggleWhatsApp = () => setWaForm((prev) => ({ ...prev, enabled: !prev.enabled }));
  const toggleAi = () => setAiForm((prev) => ({ ...prev, enabled: !prev.enabled }));

  const onProviderChange = (value: string) => {
    const option = ai?.providerOptions.find((p) => p.value === value);
    setAiForm((prev) => ({
      ...prev,
      provider: value,
      baseUrl: option?.defaultBaseUrl || prev.baseUrl,
      model: option?.defaultModel || prev.model,
    }));
  };

  if (isLoading) {
    return <div className="h-64 rounded-2xl bg-slate-200 animate-pulse" />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-extrabold text-slate-900">Konfigurasi Integrasi</h2>
        <p className="text-sm text-slate-500">
          Kelola gateway WhatsApp dan penyedia model AI chatbot tanpa mengubah file .env.
        </p>
      </div>

      {/* Tab */}
      <div className="inline-flex rounded-2xl border border-slate-200 bg-white p-1 shadow-sm">
        <button
          type="button"
          onClick={() => setTab('whatsapp')}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition ${
            tab === 'whatsapp' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          <MessageCircle size={16} />
          WhatsApp Gateway
        </button>
        <button
          type="button"
          onClick={() => setTab('ai')}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition ${
            tab === 'ai' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          <Bot size={16} />
          AI Chatbot Provider
        </button>
      </div>

      {notice.text && (
        <div
          role={notice.type === 'success' ? 'status' : 'alert'}
          className={`flex items-start gap-2 rounded-xl border p-4 text-sm ${
            notice.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
              : 'border-red-200 bg-red-50 text-red-700'
          }`}
        >
          {notice.type === 'success' ? (
            <CheckCircle2 size={16} className="mt-0.5" />
          ) : (
            <AlertCircle size={16} className="mt-0.5" />
          )}
          <span>{notice.text}</span>
        </div>
      )}

      {error && (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {tab === 'whatsapp' ? (
        <>
          {/* Status */}
          <div className={cardCls}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-emerald-50 p-2.5 ring-1 ring-emerald-100">
                  <MessageCircle size={20} className="text-emerald-600" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900">Status WhatsApp Gateway</h3>
                  <p className="text-xs text-slate-500">Provider: {wa?.provider} · {wa?.apiUrl}</p>
                </div>
              </div>
              <span
                className={`inline-flex w-fit items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ring-1 ${
                  wa?.ready
                    ? 'bg-emerald-50 text-emerald-700 ring-emerald-100'
                    : 'bg-amber-50 text-amber-700 ring-amber-100'
                }`}
              >
                {wa?.ready ? 'Koneksi berhasil' : 'Belum dikonfigurasi'}
              </span>
            </div>

            <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                <dt className="text-xs font-semibold text-slate-500">Gateway</dt>
                <dd className="text-sm font-bold text-slate-800">{waForm.enabled ? 'Aktif' : 'Nonaktif'}</dd>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                <dt className="text-xs font-semibold text-slate-500">API Token</dt>
                <dd className="text-sm font-bold text-slate-800">
                  {wa?.tokenConfigured ? `Tersedia (${wa?.tokenSource})` : 'Belum diisi'}
                </dd>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                <dt className="text-xs font-semibold text-slate-500">Penerima Admin</dt>
                <dd className="text-sm font-bold text-slate-800">{wa?.adminRecipientCount ?? 0} nomor</dd>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                <dt className="text-xs font-semibold text-slate-500">Sumber Konfigurasi</dt>
                <dd className="text-sm font-bold text-slate-800">
                  {wa?.source === 'database' ? 'Database' : 'Environment'}
                </dd>
              </div>
            </dl>

            {wa?.lastTest && (
              <p className="text-xs text-slate-500">
                Uji koneksi terakhir: {new Date(wa.lastTest.testedAt).toLocaleString('id-ID')} ·{' '}
                <span className={wa.lastTest.ok ? 'text-emerald-700' : 'text-red-700'}>
                  {wa.lastTest.ok ? 'berhasil' : 'gagal'}
                </span>
                {wa.lastTest.detail ? ` · ${wa.lastTest.detail}` : ''}
                {wa.lastTest.error ? ` · ${wa.lastTest.error}` : ''}
              </p>
            )}

            {wa?.reason && wa.reason !== 'Siap digunakan' && (
              <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
                <AlertCircle size={15} className="mt-0.5 shrink-0" />
                <span>{wa.reason}</span>
              </div>
            )}
          </div>

          {/* Form konfigurasi */}
          <div className={cardCls}>
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-blue-50 p-2.5 ring-1 ring-blue-100">
                <ShieldCheck size={18} className="text-blue-600" />
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-slate-900">Konfigurasi Gateway</h3>
                <p className="text-xs text-slate-500">
                  Token disimpan terenkripsi di server dan tidak pernah dikembalikan ke browser.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="wa-provider" className="mb-1.5 block text-sm font-semibold text-slate-700">
                  Provider WhatsApp
                </label>
                <select
                  id="wa-provider"
                  value={waForm.provider}
                  onChange={(e) => setWaForm((p) => ({ ...p, provider: e.target.value }))}
                  className={inputCls}
                >
                  <option value="fonnte">Fonnte</option>
                </select>
              </div>
              <div>
                <label htmlFor="wa-apiurl" className="mb-1.5 block text-sm font-semibold text-slate-700">
                  Base URL API
                </label>
                <input
                  id="wa-apiurl"
                  type="text"
                  value={waForm.apiUrl}
                  onChange={(e) => setWaForm((p) => ({ ...p, apiUrl: e.target.value }))}
                  className={inputCls}
                />
              </div>
            </div>

            <div>
              <label htmlFor="wa-token" className="mb-1.5 block text-sm font-semibold text-slate-700">
                API Token Fonnte
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    id="wa-token"
                    type={showToken ? 'text' : 'password'}
                    value={waForm.token}
                    onChange={(e) => setWaForm((p) => ({ ...p, token: e.target.value, clearToken: false }))}
                    placeholder={wa?.tokenConfigured ? '•••••••• (token tersimpan, isi untuk mengganti)' : 'Tempel token dari dashboard Fonnte'}
                    autoComplete="new-password"
                    className={inputCls + ' pr-11'}
                  />
                  <button
                    type="button"
                    onClick={() => setShowToken((v) => !v)}
                    aria-label={showToken ? 'Sembunyikan token' : 'Tampilkan token'}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                  >
                    {showToken ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {wa?.tokenConfigured && (
                  <button
                    type="button"
                    onClick={() => setWaForm((p) => ({ ...p, token: '', clearToken: !p.clearToken }))}
                    className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2.5 text-xs font-bold transition ${
                      waForm.clearToken
                        ? 'border-red-300 bg-red-50 text-red-700'
                        : 'border-slate-300 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Trash2 size={14} />
                    {waForm.clearToken ? 'Hapus saat simpan' : 'Hapus token'}
                  </button>
                )}
              </div>
              <p className="mt-1 text-xs text-slate-400">
                {wa?.encryptionAvailable
                  ? 'Token dienkripsi (AES-256-GCM) sebelum disimpan di database.'
                  : 'Kunci enkripsi server belum tersedia — token hanya bisa dibaca dari environment.'}
              </p>
            </div>

            <div>
              <label htmlFor="wa-admin" className="mb-1.5 block text-sm font-semibold text-slate-700">
                Nomor WhatsApp Admin (penerima notifikasi)
              </label>
              <input
                id="wa-admin"
                type="text"
                value={waForm.adminRecipients}
                onChange={(e) => setWaForm((p) => ({ ...p, adminRecipients: e.target.value }))}
                placeholder="Kosongkan untuk mempertahankan | contoh: 6285147722749, 6281234567890"
                className={inputCls}
              />
              <div className="mt-2 flex flex-wrap gap-2">
                {(wa?.adminRecipients ?? []).length === 0 ? (
                  <span className="text-xs text-slate-400">Belum ada nomor penerima admin.</span>
                ) : (
                  (wa?.adminRecipients ?? []).map((r) => (
                    <span key={r} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
                      {r}
                    </span>
                  ))
                )}
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              <button
                type="button"
                onClick={toggleWhatsApp}
                disabled={isSaving}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
              >
                {waForm.enabled ? <ToggleRight size={18} className="text-emerald-600" /> : <ToggleLeft size={18} />}
                {waForm.enabled ? 'Matikan Gateway' : 'Aktifkan Gateway'}
              </button>
              <button
                type="button"
                onClick={saveWhatsApp}
                disabled={isSaving}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-blue-700 disabled:bg-blue-300"
              >
                {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                Simpan Konfigurasi
              </button>
              <button
                type="button"
                onClick={testWhatsAppConnection}
                disabled={isTesting}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-bold text-blue-700 transition hover:bg-blue-100 disabled:opacity-60"
              >
                {isTesting ? <Loader2 size={16} className="animate-spin" /> : <Plug size={16} />}
                Uji Koneksi
              </button>
            </div>
          </div>

          {/* Pesan percobaan */}
          <div className={cardCls}>
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-emerald-50 p-2.5 ring-1 ring-emerald-100">
                <Send size={18} className="text-emerald-600" />
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-slate-900">Kirim Pesan Percobaan</h3>
                <p className="text-xs text-slate-500">Dikirim lewat backend ke Fonnte.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="sm:col-span-2">
                <label htmlFor="wa-msg" className="mb-1.5 block text-sm font-semibold text-slate-700">
                  Isi pesan
                </label>
                <input
                  id="wa-msg"
                  type="text"
                  value={waMessage}
                  onChange={(e) => setWaMessage(e.target.value)}
                  placeholder="Pesan percobaan (opsional)"
                  className={inputCls}
                />
              </div>
              <div>
                <label htmlFor="wa-target" className="mb-1.5 block text-sm font-semibold text-slate-700">
                  Nomor tujuan (opsional)
                </label>
                <input
                  id="wa-target"
                  type="text"
                  value={waTarget}
                  onChange={(e) => setWaTarget(e.target.value)}
                  placeholder="Kosong = ke penerima admin"
                  className={inputCls}
                />
              </div>
            </div>

            <div>
              <button
                type="button"
                onClick={sendWhatsAppTest}
                disabled={isSending}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:bg-emerald-300"
              >
                {isSending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                {isSending ? 'Mengirim...' : 'Kirim Pesan Percobaan'}
              </button>
            </div>
          </div>

          {/* Jenis notifikasi */}
          <div className={cardCls}>
            <div>
              <h3 className="text-sm font-extrabold text-slate-900">Jenis Notifikasi WhatsApp</h3>
              <p className="text-xs text-slate-500">
                Aktif/nonaktifkan tiap jenis secara independen (perlu klik Simpan Konfigurasi).
              </p>
            </div>

            {['masyarakat', 'petugas', 'admin'].map((group) => {
              const items = (wa?.events ?? []).filter((e) => {
                const key = e.key.toLowerCase();
                if (group === 'masyarakat') return key.startsWith('report_') || key.startsWith('user_') || key.startsWith('login');
                if (group === 'petugas') return key.startsWith('officer_');
                return key.startsWith('admin_');
              });
              if (items.length === 0) return null;
              return (
                <div key={group} className="space-y-2">
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                    {group === 'masyarakat' ? 'Masyarakat' : group === 'petugas' ? 'Petugas' : 'Admin'}
                  </p>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {items.map((e) => (
                      <label
                        key={e.key}
                        className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-slate-200 px-3 py-2.5 transition hover:bg-slate-50"
                      >
                        <input
                          type="checkbox"
                          checked={waForm.events.includes(e.key)}
                          onChange={() => toggleEvent(e.key)}
                          aria-label={e.label}
                          className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-xs font-semibold text-slate-700">{e.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Riwayat pengiriman */}
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div className="flex items-center gap-2">
                <History size={18} className="text-slate-500" />
                <h3 className="text-sm font-extrabold text-slate-900">Riwayat Pengiriman</h3>
              </div>
              <button
                type="button"
                onClick={loadHistory}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
              >
                <RefreshCw size={13} />
                Muat ulang
              </button>
            </div>

            {history.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-slate-400">Belum ada riwayat pengiriman.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[820px] text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50 text-left text-xs font-bold text-slate-500 uppercase tracking-wide">
                      <th className="px-5 py-3">Event</th>
                      <th className="px-5 py-3">Penerima</th>
                      <th className="px-5 py-3">Status</th>
                      <th className="px-5 py-3">Waktu</th>
                      <th className="px-5 py-3">ID Pesan</th>
                      <th className="px-5 py-3">Keterangan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {history.map((row) => (
                      <tr key={row.id} className="hover:bg-slate-50 transition">
                        <td className="px-5 py-3 font-semibold text-slate-700">{row.event_type}</td>
                        <td className="px-5 py-3 text-slate-500">{row.recipient_masked || row.recipient_number}</td>
                        <td className="px-5 py-3">
                          <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ring-1 ${statusBadge(row.delivery_status)}`}>
                            {STATUS_LABEL[row.delivery_status] || row.delivery_status}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-xs text-slate-500 whitespace-nowrap">
                          {new Date(row.created_at).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })}
                        </td>
                        <td className="px-5 py-3 text-xs text-slate-500">{row.provider_message_id || '-'}</td>
                        <td className="px-5 py-3 text-xs text-slate-500">
                          {row.last_error || row.provider_process || '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      ) : (
        <>
          {/* Status AI */}
          <div className={cardCls}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-violet-50 p-2.5 ring-1 ring-violet-100">
                  <Sparkles size={20} className="text-violet-600" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900">Status AI Chatbot</h3>
                  <p className="text-xs text-slate-500">
                    Provider {ai?.provider} · Model {ai?.model}
                  </p>
                </div>
              </div>
              <span
                className={`inline-flex w-fit items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ring-1 ${
                  ai?.ready
                    ? 'bg-emerald-50 text-emerald-700 ring-emerald-100'
                    : 'bg-amber-50 text-amber-700 ring-amber-100'
                }`}
              >
                {ai?.ready ? 'Koneksi berhasil' : 'Belum dikonfigurasi'}
              </span>
            </div>

            <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                <dt className="text-xs font-semibold text-slate-500">Chatbot</dt>
                <dd className="text-sm font-bold text-slate-800">{aiForm.enabled ? 'Aktif' : 'Nonaktif'}</dd>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                <dt className="text-xs font-semibold text-slate-500">API Key</dt>
                <dd className="text-sm font-bold text-slate-800">
                  {ai?.apiKeyConfigured ? `Tersedia (${ai?.apiKeySource})` : 'Belum diisi'}
                </dd>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                <dt className="text-xs font-semibold text-slate-500">Model</dt>
                <dd className="truncate text-sm font-bold text-slate-800">{ai?.model || '-'}</dd>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                <dt className="text-xs font-semibold text-slate-500">Sumber Konfigurasi</dt>
                <dd className="text-sm font-bold text-slate-800">
                  {ai?.source === 'database' ? 'Database' : 'Environment'}
                </dd>
              </div>
            </dl>

            {ai?.lastTest && (
              <p className="text-xs text-slate-500">
                Uji koneksi terakhir: {new Date(ai.lastTest.testedAt).toLocaleString('id-ID')} ·{' '}
                <span className={ai.lastTest.ok ? 'text-emerald-700' : 'text-red-700'}>
                  {ai.lastTest.ok ? 'berhasil' : 'gagal'}
                </span>
                {ai.lastTest.detail ? ` · ${ai.lastTest.detail}` : ''}
              </p>
            )}

            {ai?.reason && ai.reason !== 'Siap digunakan' && (
              <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
                <AlertCircle size={15} className="mt-0.5 shrink-0" />
                <span>{ai.reason}</span>
              </div>
            )}
          </div>

          {/* Form AI */}
          <div className={cardCls}>
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-violet-50 p-2.5 ring-1 ring-violet-100">
                <Bot size={18} className="text-violet-600" />
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-slate-900">Konfigurasi Provider AI</h3>
                <p className="text-xs text-slate-500">
                  API key disimpan terenkripsi di server dan tidak pernah dikembalikan ke browser.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="ai-provider" className="mb-1.5 block text-sm font-semibold text-slate-700">
                  Provider AI
                </label>
                <select
                  id="ai-provider"
                  value={aiForm.provider}
                  onChange={(e) => onProviderChange(e.target.value)}
                  className={inputCls}
                >
                  {(ai?.providerOptions ?? []).map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="ai-baseurl" className="mb-1.5 block text-sm font-semibold text-slate-700">
                  Base URL
                </label>
                <input
                  id="ai-baseurl"
                  type="text"
                  value={aiForm.baseUrl}
                  onChange={(e) => setAiForm((p) => ({ ...p, baseUrl: e.target.value }))}
                  className={inputCls}
                />
              </div>
            </div>

            <div>
              <label htmlFor="ai-apikey" className="mb-1.5 block text-sm font-semibold text-slate-700">
                API Key
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    id="ai-apikey"
                    type={showApiKey ? 'text' : 'password'}
                    value={aiForm.apiKey}
                    onChange={(e) => setAiForm((p) => ({ ...p, apiKey: e.target.value, clearApiKey: false }))}
                    placeholder={ai?.apiKeyConfigured ? '•••••••• (API key tersimpan, isi untuk mengganti)' : 'Tempel API key provider'}
                    autoComplete="new-password"
                    className={inputCls + ' pr-11'}
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey((v) => !v)}
                    aria-label={showApiKey ? 'Sembunyikan API key' : 'Tampilkan API key'}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                  >
                    {showApiKey ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {ai?.apiKeyConfigured && (
                  <button
                    type="button"
                    onClick={() => setAiForm((p) => ({ ...p, apiKey: '', clearApiKey: !p.clearApiKey }))}
                    className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2.5 text-xs font-bold transition ${
                      aiForm.clearApiKey
                        ? 'border-red-300 bg-red-50 text-red-700'
                        : 'border-slate-300 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Trash2 size={14} />
                    {aiForm.clearApiKey ? 'Hapus saat simpan' : 'Hapus API key'}
                  </button>
                )}
              </div>
            </div>

            <div>
              <label htmlFor="ai-model" className="mb-1.5 block text-sm font-semibold text-slate-700">
                Model AI
              </label>
              <input
                id="ai-model"
                type="text"
                list="ai-model-suggestions"
                value={aiForm.model}
                onChange={(e) => setAiForm((p) => ({ ...p, model: e.target.value }))}
                placeholder="openai/gpt-4o-mini"
                className={inputCls}
              />
              <datalist id="ai-model-suggestions">
                {(ai?.modelSuggestions ?? []).map((m) => (
                  <option key={m} value={m} />
                ))}
              </datalist>
              <p className="mt-1 text-xs text-slate-400">
                Model bebas diisi. Ketersediaan model divalidasi saat Uji Koneksi.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <label htmlFor="ai-temperature" className="mb-1.5 block text-sm font-semibold text-slate-700">
                  Temperature
                </label>
                <input
                  id="ai-temperature"
                  type="number"
                  step="0.1"
                  min="0"
                  max="2"
                  value={aiForm.temperature}
                  onChange={(e) => setAiForm((p) => ({ ...p, temperature: Number(e.target.value) }))}
                  className={inputCls}
                />
              </div>
              <div>
                <label htmlFor="ai-maxtokens" className="mb-1.5 block text-sm font-semibold text-slate-700">
                  Maximum Tokens
                </label>
                <input
                  id="ai-maxtokens"
                  type="number"
                  min="64"
                  max="32000"
                  value={aiForm.maxTokens}
                  onChange={(e) => setAiForm((p) => ({ ...p, maxTokens: Number(e.target.value) }))}
                  className={inputCls}
                />
              </div>
              <div>
                <label htmlFor="ai-timeout" className="mb-1.5 block text-sm font-semibold text-slate-700">
                  Timeout (ms)
                </label>
                <input
                  id="ai-timeout"
                  type="number"
                  min="1000"
                  max="300000"
                  step="1000"
                  value={aiForm.timeoutMs}
                  onChange={(e) => setAiForm((p) => ({ ...p, timeoutMs: Number(e.target.value) }))}
                  className={inputCls}
                />
              </div>
            </div>

            <div>
              <label htmlFor="ai-prompt" className="mb-1.5 block text-sm font-semibold text-slate-700">
                System Prompt Tambahan
              </label>
              <textarea
                id="ai-prompt"
                rows={4}
                value={aiForm.systemPrompt}
                onChange={(e) => setAiForm((p) => ({ ...p, systemPrompt: e.target.value }))}
                placeholder="Contoh: Selalu jawab dalam Bahasa Indonesia yang singkat dan ramah."
                className={inputCls}
              />
              <p className="mt-1 text-xs text-slate-400">
                Ditambahkan pada system prompt chatbot (tidak menggantikan aturan keamanan bawaan).
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              <button
                type="button"
                onClick={toggleAi}
                disabled={isSaving}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
              >
                {aiForm.enabled ? <ToggleRight size={18} className="text-emerald-600" /> : <ToggleLeft size={18} />}
                {aiForm.enabled ? 'Matikan Chatbot' : 'Aktifkan Chatbot'}
              </button>
              <button
                type="button"
                onClick={saveAi}
                disabled={isSaving}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-blue-700 disabled:bg-blue-300"
              >
                {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                Simpan Konfigurasi
              </button>
              <button
                type="button"
                onClick={testAiConnection}
                disabled={isTesting}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-bold text-blue-700 transition hover:bg-blue-100 disabled:opacity-60"
              >
                {isTesting ? <Loader2 size={16} className="animate-spin" /> : <Plug size={16} />}
                Uji Koneksi
              </button>
            </div>
          </div>

          {/* Uji chatbot */}
          <div className={cardCls}>
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-violet-50 p-2.5 ring-1 ring-violet-100">
                <Sparkles size={18} className="text-violet-600" />
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-slate-900">Uji Chatbot</h3>
                <p className="text-xs text-slate-500">
                  Menggunakan konfigurasi tersimpan. Tidak membuat riwayat percakapan.
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                aria-label="Pesan uji chatbot"
                placeholder="Tulis pesan untuk diuji..."
                className={inputCls}
              />
              <button
                type="button"
                onClick={testChat}
                disabled={isChatting}
                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-violet-700 disabled:bg-violet-300"
              >
                {isChatting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                {isChatting ? 'Mengirim...' : 'Kirim Pesan'}
              </button>
            </div>

            {chatResult && (
              <div
                className={`rounded-xl border px-4 py-3 text-sm ${
                  chatResult.ok
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                    : 'border-red-200 bg-red-50 text-red-700'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold">{chatResult.ok ? 'Uji chatbot berhasil' : 'Uji chatbot gagal'}</span>
                  {chatResult.responseTimeMs > 0 && (
                    <span className="text-xs font-semibold">{chatResult.responseTimeMs} ms</span>
                  )}
                </div>
                {chatResult.reply && <p className="mt-2 whitespace-pre-wrap text-xs">{chatResult.reply}</p>}
                {chatResult.error && <p className="mt-2 text-xs">{chatResult.error}</p>}
              </div>
            )}
          </div>
        </>
      )}

      {/* Riwayat perubahan konfigurasi */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div className="flex items-center gap-2">
            <History size={18} className="text-slate-500" />
            <h3 className="text-sm font-extrabold text-slate-900">Riwayat Perubahan Konfigurasi</h3>
          </div>
          <button
            type="button"
            onClick={loadHistory}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
          >
            <RefreshCw size={13} />
            Muat ulang
          </button>
        </div>

        {configHistory.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-slate-400">Belum ada riwayat perubahan.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-left text-xs font-bold text-slate-500 uppercase tracking-wide">
                  <th className="px-5 py-3">Waktu</th>
                  <th className="px-5 py-3">Jenis</th>
                  <th className="px-5 py-3">Provider</th>
                  <th className="px-5 py-3">Perubahan</th>
                  <th className="px-5 py-3">Admin</th>
                  <th className="px-5 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {configHistory.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50 transition">
                    <td className="px-5 py-3 text-xs text-slate-500 whitespace-nowrap">
                      {new Date(row.createdAt).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })}
                    </td>
                    <td className="px-5 py-3 text-slate-700">{row.configType}</td>
                    <td className="px-5 py-3 text-slate-500">{row.provider || '-'}</td>
                    <td className="px-5 py-3 text-xs text-slate-500">{row.changedFields.join(', ') || '-'}</td>
                    <td className="px-5 py-3 text-xs text-slate-500">{row.adminEmail || '-'}</td>
                    <td className="px-5 py-3 text-xs font-semibold text-slate-600">{row.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="text-xs text-slate-400">
        Catatan: status <strong>Diterima API</strong> berarti Fonnte telah menerima permintaan (pesan masuk
        antrean). Itu belum merupakan bukti pesan sampai ke perangkat penerima.
      </p>
    </div>
  );
};

export default IntegrationsPage;
