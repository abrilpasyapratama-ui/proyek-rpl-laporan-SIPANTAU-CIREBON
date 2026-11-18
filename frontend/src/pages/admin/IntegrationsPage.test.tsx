import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import IntegrationsPage from './IntegrationsPage';
import api from '../../services/api';

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), patch: vi.fn(), post: vi.fn() },
}));

const getMock = vi.mocked(api.get);
const patchMock = vi.mocked(api.patch);
const postMock = vi.mocked(api.post);

const WA_STATUS = {
  provider: 'fonnte',
  apiUrl: 'https://api.fonnte.com',
  masterEnabled: true,
  enabled: true,
  tokenConfigured: true,
  tokenSource: 'database',
  ready: true,
  reason: 'Siap digunakan',
  adminRecipients: ['6285****2749'],
  adminRecipientCount: 1,
  source: 'database',
  events: [
    { key: 'USER_REGISTRATION', label: 'Pendaftaran akun berhasil (masyarakat)', enabled: true },
    { key: 'REPORT_RECEIVED', label: 'Laporan berhasil dikirim (masyarakat)', enabled: true },
    { key: 'OFFICER_ASSIGNED', label: 'Penugasan laporan baru (petugas)', enabled: true },
    { key: 'ADMIN_NEW_REPORT', label: 'Laporan baru (admin)', enabled: false },
  ],
  telegramEnabled: true,
  encryptionAvailable: true,
  lastTest: null,
};

const AI_STATUS = {
  enabled: true,
  provider: 'openrouter',
  baseUrl: 'https://openrouter.ai/api/v1',
  model: 'openai/gpt-4o-mini',
  temperature: 0.3,
  maxTokens: 800,
  timeoutMs: 30000,
  systemPrompt: '',
  apiKeyConfigured: true,
  apiKeySource: 'database',
  ready: true,
  reason: 'Siap digunakan',
  source: 'database',
  encryptionAvailable: true,
  providerOptions: [
    { value: 'openrouter', label: 'OpenRouter', defaultBaseUrl: 'https://openrouter.ai/api/v1', defaultModel: 'openai/gpt-4o-mini' },
    { value: 'openai', label: 'OpenAI', defaultBaseUrl: 'https://api.openai.com/v1', defaultModel: 'gpt-4o-mini' },
    { value: 'custom', label: 'Custom (OpenAI-compatible)', defaultBaseUrl: '', defaultModel: '' },
  ],
  modelSuggestions: ['openai/gpt-4o-mini', 'google/gemini-2.5-flash', 'anthropic/claude-sonnet-4'],
  lastTest: null,
};

beforeEach(() => {
  vi.clearAllMocks();

  getMock.mockImplementation(async (url: string) => {
    if (String(url).includes('/whatsapp/status')) {
      return { data: { status: 'success', data: WA_STATUS } } as any;
    }
    if (String(url).includes('/ai/status')) {
      return { data: { status: 'success', data: AI_STATUS } } as any;
    }
    if (String(url).includes('/whatsapp/history')) {
      return { data: { status: 'success', data: [] } } as any;
    }
    return { data: { status: 'success', data: [] } } as any;
  });

  patchMock.mockImplementation(async () => ({
    data: { status: 'success', data: WA_STATUS },
  }) as any);

  postMock.mockImplementation(async (url: string) => {
    if (String(url).includes('test-chat')) {
      return {
        data: {
          status: 'success',
          message: 'Uji chatbot berhasil',
          data: { reply: 'SIPANTAU adalah aplikasi pelaporan fasilitas umum.', responseTimeMs: 842 },
        },
      } as any;
    }
    return {
      data: { status: 'success', message: 'Koneksi berhasil', data: { ok: true } },
    } as any;
  });
});

const openAiTab = async () => {
  await waitFor(() => expect(screen.getByText('AI Chatbot Provider')).toBeTruthy());
  fireEvent.click(screen.getByText('AI Chatbot Provider'));
  await waitFor(() => expect(screen.getByLabelText('Model AI')).toBeTruthy());
};

describe('IntegrationsPage — Konfigurasi Integrasi', () => {
  it('menampilkan dua tab: WhatsApp Gateway & AI Chatbot Provider', async () => {
    render(<IntegrationsPage />);
    await waitFor(() => expect(screen.getByText('WhatsApp Gateway')).toBeTruthy());
    expect(screen.getByText('AI Chatbot Provider')).toBeTruthy();
  });

  it('menampilkan status token tanpa pernah menampilkan nilainya', async () => {
    render(<IntegrationsPage />);
    await waitFor(() => expect(screen.getByText('Tersedia (database)')).toBeTruthy());

    const tokenInput = screen.getByLabelText('API Token Fonnte') as HTMLInputElement;
    expect(tokenInput.type).toBe('password');
    expect(tokenInput.value).toBe('');
    expect(document.body.textContent).not.toMatch(/sk-or-v1-/);
  });

  it('tombol tampilkan/sembunyikan token mengubah jenis input', async () => {
    render(<IntegrationsPage />);
    await waitFor(() => expect(screen.getByLabelText('API Token Fonnte')).toBeTruthy());

    const input = screen.getByLabelText('API Token Fonnte') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'token-baru-123' } });
    fireEvent.click(screen.getByLabelText('Tampilkan token'));
    expect((screen.getByLabelText('API Token Fonnte') as HTMLInputElement).type).toBe('text');
    fireEvent.click(screen.getByLabelText('Sembunyikan token'));
    expect((screen.getByLabelText('API Token Fonnte') as HTMLInputElement).type).toBe('password');
  });

  it('menyimpan konfigurasi WhatsApp (token + event)', async () => {
    render(<IntegrationsPage />);
    await waitFor(() => expect(screen.getByLabelText('API Token Fonnte')).toBeTruthy());

    fireEvent.change(screen.getByLabelText('API Token Fonnte'), { target: { value: 'token-baru-123' } });
    fireEvent.click(screen.getByText('Simpan Konfigurasi'));

    await waitFor(() =>
      expect(patchMock).toHaveBeenCalledWith(
        '/admin/integrations/whatsapp/settings',
        expect.objectContaining({ token: 'token-baru-123', enabled: true })
      )
    );
  });

  it('menguji koneksi Fonnte', async () => {
    render(<IntegrationsPage />);
    await waitFor(() => expect(screen.getByText('Uji Koneksi')).toBeTruthy());

    fireEvent.click(screen.getByText('Uji Koneksi'));
    await waitFor(() =>
      expect(postMock).toHaveBeenCalledWith('/admin/integrations/whatsapp/test-connection')
    );
  });

  it('mengirim pesan percobaan WhatsApp', async () => {
    render(<IntegrationsPage />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Kirim Pesan Percobaan' })).toBeTruthy());

    fireEvent.click(screen.getByRole('button', { name: 'Kirim Pesan Percobaan' }));
    await waitFor(() =>
      expect(postMock).toHaveBeenCalledWith('/admin/integrations/whatsapp/test-message', {
        message: undefined,
        target: undefined,
      })
    );
  });

  it('menonaktifkan gateway WhatsApp', async () => {
    render(<IntegrationsPage />);
    await waitFor(() => expect(screen.getByText('Matikan Gateway')).toBeTruthy());

    fireEvent.click(screen.getByText('Matikan Gateway'));
    fireEvent.click(screen.getByText('Simpan Konfigurasi'));

    await waitFor(() =>
      expect(patchMock).toHaveBeenCalledWith(
        '/admin/integrations/whatsapp/settings',
        expect.objectContaining({ enabled: false })
      )
    );
  });

  it('menyimpan konfigurasi AI & mengganti model', async () => {
    render(<IntegrationsPage />);
    await openAiTab();

    fireEvent.change(screen.getByLabelText('Model AI'), { target: { value: 'google/gemini-2.5-flash' } });
    fireEvent.change(screen.getByLabelText('Temperature'), { target: { value: '0.7' } });
    fireEvent.click(screen.getByText('Simpan Konfigurasi'));

    await waitFor(() =>
      expect(patchMock).toHaveBeenCalledWith(
        '/admin/integrations/ai/settings',
        expect.objectContaining({ model: 'google/gemini-2.5-flash', temperature: 0.7 })
      )
    );
  });

  it('memilih provider AI lain & menyesuaikan default', async () => {
    render(<IntegrationsPage />);
    await openAiTab();

    fireEvent.change(screen.getByLabelText('Provider AI'), { target: { value: 'openai' } });
    await waitFor(() =>
      expect((screen.getByLabelText('Base URL') as HTMLInputElement).value).toBe('https://api.openai.com/v1')
    );
    expect((screen.getByLabelText('Model AI') as HTMLInputElement).value).toBe('gpt-4o-mini');
  });

  it('menguji koneksi AI', async () => {
    render(<IntegrationsPage />);
    await openAiTab();

    fireEvent.click(screen.getByText('Uji Koneksi'));
    await waitFor(() => expect(postMock).toHaveBeenCalledWith('/admin/integrations/ai/test-connection'));
  });

  it('menguji chatbot: menampilkan jawaban, waktu respons, dan status', async () => {
    render(<IntegrationsPage />);
    await openAiTab();

    fireEvent.change(screen.getByLabelText('Pesan uji chatbot'), { target: { value: 'Halo' } });
    fireEvent.click(screen.getByText('Kirim Pesan'));

    await waitFor(() =>
      expect(postMock).toHaveBeenCalledWith('/admin/integrations/ai/test-chat', { message: 'Halo' })
    );
    expect(await screen.findByText('Uji chatbot berhasil')).toBeTruthy();
    expect(screen.getByText(/SIPANTAU adalah aplikasi pelaporan/)).toBeTruthy();
    expect(screen.getByText(/842 ms/)).toBeTruthy();
  });

  it('API key tidak pernah ditampilkan di halaman', async () => {
    render(<IntegrationsPage />);
    await openAiTab();

    const keyInput = screen.getByLabelText('API Key') as HTMLInputElement;
    expect(keyInput.type).toBe('password');
    expect(keyInput.value).toBe('');
    expect(document.body.textContent).not.toMatch(/sk-or-v1-/);
  });

  it('mengaktifkan/menonaktifkan jenis notifikasi secara independen', async () => {
    render(<IntegrationsPage />);
    await waitFor(() => expect(screen.getByText('Simpan Konfigurasi')).toBeTruthy());

    const checkbox = screen.getByLabelText('Laporan baru (admin)') as HTMLInputElement;
    expect(checkbox.checked).toBe(false);

    fireEvent.click(checkbox);
    fireEvent.click(screen.getByText('Simpan Konfigurasi'));

    await waitFor(() => {
      const call = patchMock.mock.calls.find(
        (c) => c[0] === '/admin/integrations/whatsapp/settings'
      );
      const events = (call?.[1] as { events?: string[] })?.events ?? [];
      expect(events).toContain('ADMIN_NEW_REPORT');
    });
  });
});
