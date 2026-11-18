import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * Token dummy untuk simulasi. TIDAK pernah dicetak ke log/response.
 */
const TEST_TOKEN = 'fonnte-dummy-token-abcdef';

vi.mock('../src/config', () => ({
  config: {
    env: 'test',
    isProduction: false,
    isTest: true,
    frontendUrl: 'http://localhost:5173',
    telegram: {
      enabled: false,
      botToken: '',
      adminChatId: '',
      botUsername: '',
      webhookSecret: '',
      linkCodeTtlMinutes: 15,
      maxLinkAttempts: 5,
    },
    whatsapp: {
      enabled: true,
      provider: 'fonte',
      meta: { accessToken: '', phoneNumberId: '', appSecret: '', apiVersion: 'v20.0' },
      twilio: { accountSid: '', authToken: '', fromNumber: '' },
      custom: { apiUrl: '', apiKey: '' },
      fonte: {
        enabled: true,
        apiUrl: 'https://api.fonnte.com',
        apiToken: 'fonnte-dummy-token-abcdef',
        adminRecipients: ['6285147722749'],
        timeoutMs: 1000,
        maxRetries: 2,
        retryDelayMs: 1,
        countryCode: '62',
        minIntervalMs: 0,
        maxPerMinute: 100,
      },
      adminNumber: '6285147722749',
      maxRetries: 2,
      retryDelayMs: 1,
    },
  },
}));

vi.mock('../src/utils/db', () => ({
  default: {
    whatsapp_message_logs: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
      findMany: vi.fn(),
    },
    users: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    user_whatsapp_preferences: { findUnique: vi.fn(), upsert: vi.fn(), findMany: vi.fn() },
    notifications: { create: vi.fn() },
    integration_settings: { findMany: vi.fn(), upsert: vi.fn() },
    reports: { findMany: vi.fn(), count: vi.fn() },
    assignments: { findMany: vi.fn(), count: vi.fn() },
    $disconnect: vi.fn(),
  },
}));

vi.mock('../src/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    audit: vi.fn(),
  },
}));

import prisma from '../src/utils/db';
import { logger } from '../src/utils/logger';
import { whatsappService } from '../src/services/notification/whatsapp.service';
import { notificationService } from '../src/services/notification/notification.service';
import {
  clearIntegrationSettingsCache,
  getIntegrationSettings,
  updateIntegrationSettings,
} from '../src/services/integration/settings.service';

const mockPrisma = prisma as unknown as Record<string, any>;

const USER_DB = {
  id: 'u-warga',
  nama: 'Warga Cirebon',
  email: 'warga@example.com',
  no_hp: '081234567890',
  no_hp_normalized: '6281234567890',
};

const REPORT = {
  id: 'lap-123',
  user_id: USER_DB.id,
  judul: 'Jalan berlubang di Jl. Karanggetas',
  lokasi: 'Jl. Karanggetas, Cirebon',
  kategori: 'Jalan & Jembatan',
  ai_priority: 'Tinggi',
  status: 'MENUNGGU_VERIFIKASI',
  created_at: new Date('2026-11-15T02:00:00.000Z'),
};

/** Mock fetch Fonnte yang sukses. */
const mockFonnteSuccess = () =>
  vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({
      status: true,
      detail: 'success! message in queue',
      id: ['80367170'],
      process: 'pending',
      requestid: 2937124,
      target: ['6281234567890'],
    }),
  });

const sentTargets = () =>
  vi
    .mocked(global.fetch)
    .mock.calls.map((call) => {
      const form = call[1]?.body as FormData;
      return form?.get('target') as string;
    });

const sentMessages = () =>
  vi
    .mocked(global.fetch)
    .mock.calls.map((call) => {
      const form = call[1]?.body as FormData;
      return (form?.get('message') as string) || '';
    });

let settingsStore: Record<string, string> = {};

beforeEach(() => {
  vi.clearAllMocks();
  clearIntegrationSettingsCache();
  settingsStore = {};

  mockPrisma.users.findUnique.mockResolvedValue(USER_DB);
  mockPrisma.user_whatsapp_preferences.findUnique.mockResolvedValue(null);
  mockPrisma.notifications.create.mockResolvedValue({ id: 'notif-1' });
  mockPrisma.integration_settings.findMany.mockImplementation(async () =>
    Object.entries(settingsStore).map(([key, value]) => ({ key, value }))
  );
  mockPrisma.integration_settings.upsert.mockImplementation(async (args: any) => {
    const payload = args.update ?? args.create;
    settingsStore[args.where.key] = payload.value;
    return { key: args.where.key, value: payload.value };
  });
  mockPrisma.whatsapp_message_logs.findUnique.mockResolvedValue(null);
  mockPrisma.whatsapp_message_logs.create.mockResolvedValue({ id: 'log-1' });
  mockPrisma.whatsapp_message_logs.update.mockResolvedValue({});
  mockPrisma.whatsapp_message_logs.count.mockResolvedValue(0);
  mockPrisma.whatsapp_message_logs.findMany.mockResolvedValue([]);

  global.fetch = mockFonnteSuccess();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('1. Fonnte aktif dengan token valid', () => {
  it('mengirim pesan ke Fonnte dan mencatat status sent', async () => {
    const result = await whatsappService.sendMessage(
      { to: '081234567890', type: 'text', text: { body: 'Halo Fonnte' } },
      { eventType: 'TEST', idempotencyKey: 'wa:test:1' }
    );

    expect(result.success).toBe(true);
    expect(result.status).toBe('sent');
    // Dokumentasi Fonnte: `id` berupa array
    expect(result.messageId).toBe('80367170');
    expect(sentTargets()).toEqual(['6281234567890']);

    const headers = vi.mocked(global.fetch).mock.calls[0][1]?.headers as Record<string, string>;
    expect(headers.Authorization).toBe(TEST_TOKEN);
    expect(headers.Authorization).not.toMatch(/^Bearer /);
  });

  it('menyimpan nomor penerima dalam bentuk MASKED + hash', async () => {
    await whatsappService.sendMessage(
      { to: '081234567890', type: 'text', text: { body: 'Halo' } },
      { eventType: 'TEST', idempotencyKey: 'wa:test:2' }
    );

    const createArgs = mockPrisma.whatsapp_message_logs.create.mock.calls[0][0].data;
    expect(createArgs.recipient_number).toBe('6281****7890');
    expect(createArgs.recipient_masked).toBe('6281****7890');
    expect(createArgs.recipient_hash).toEqual(expect.any(String));
    expect(createArgs.provider).toBe('fonte');
  });
});

describe('2. Fonnte nonaktif', () => {
  it('tidak memanggil Fonnte sama sekali', async () => {
    await updateIntegrationSettings({ fonnteEnabled: false });

    const result = await whatsappService.sendMessage(
      { to: '081234567890', type: 'text', text: { body: 'Halo' } },
      { eventType: 'TEST' }
    );

    expect(result.success).toBe(false);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('status konfigurasi melaporkan kanal belum lengkap', async () => {
    await updateIntegrationSettings({ fonnteEnabled: false });
    const settings = await getIntegrationSettings();
    expect(settings.fonnteEnabled).toBe(false);
    expect(settings.fonnteTokenConfigured).toBe(true);
  });
});

describe('3. Token tidak valid', () => {
  it('gagal dengan pesan dari Fonnte dan status failed', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ status: false, reason: 'token invalid', requestid: 1 }),
    });

    const result = await whatsappService.sendMessage(
      { to: '081234567890', type: 'text', text: { body: 'Halo' } },
      { eventType: 'TEST' }
    );

    expect(result.success).toBe(false);
    expect(result.status).toBe('failed');
    expect(result.error).toContain('token invalid');
    // Total percobaan = maxRetries (2 pada konfigurasi test)
    expect(vi.mocked(global.fetch)).toHaveBeenCalledTimes(2);
  });
});

describe('4. Nomor telepon tidak valid', () => {
  it('ditolak tanpa memanggil Fonnte', async () => {
    const result = await whatsappService.sendMessage(
      { to: 'bukan-nomor', type: 'text', text: { body: 'Halo' } },
      { eventType: 'TEST' }
    );

    expect(result.success).toBe(false);
    expect(result.skipped).toBe('invalid-recipient');
    expect(global.fetch).not.toHaveBeenCalled();
  });
});

describe('5-9. Notifikasi per event (masyarakat, petugas, admin)', () => {
  it('registrasi pengguna → WhatsApp ke nomor profil di database', async () => {
    await notificationService.notifyUserRegistrationUser(
      USER_DB.id,
      { nama: USER_DB.nama, email: USER_DB.email, role: 'masyarakat', status: 'AKTIF' },
      USER_DB.email,
      USER_DB.nama
    );

    await vi.waitFor(() => expect(global.fetch).toHaveBeenCalled());
    const message = sentMessages()[0];
    expect(sentTargets()).toEqual(['6281234567890']);
    expect(message).toContain('PENDAFTARAN BERHASIL');
    expect(message).toContain(USER_DB.nama);
  });

  it('laporan baru → WhatsApp ke pelapor (nama, nomor laporan, kategori, status)', async () => {
    await notificationService.notifyLaporanDiterima(USER_DB.id, REPORT, USER_DB.email, USER_DB.nama);

    await vi.waitFor(() => expect(global.fetch).toHaveBeenCalled());
    const message = sentMessages()[0];
    expect(sentTargets()).toEqual(['6281234567890']);
    expect(message).toContain('LAPORAN BERHASIL DITERIMA');
    expect(message).toContain(USER_DB.nama);
    expect(message).toContain(REPORT.id);
    expect(message).toContain(REPORT.kategori);
    expect(message).toContain('Menunggu Verifikasi');
  });

  it('perubahan status → WhatsApp ke pelapor', async () => {
    await notificationService.notifyReportStatusChange(
      USER_DB.id,
      REPORT,
      'DIPROSES',
      'DALAM_PERBAIKAN',
      'Sudah dikerjakan petugas',
      USER_DB.email,
      USER_DB.nama
    );

    await vi.waitFor(() => expect(global.fetch).toHaveBeenCalled());
    const message = sentMessages()[0];
    expect(message).toContain('PEMBARUAN STATUS LAPORAN');
    expect(message).toContain('Dalam Perbaikan');
    expect(message).toContain('Sudah dikerjakan petugas');
  });

  it('transisi verifikasi tidak mengirim pesan status ganda (sudah dikirim notifikasi verifikasi)', async () => {
    await notificationService.notifyLaporanDiverifikasi(
      USER_DB.id,
      REPORT,
      true,
      USER_DB.email,
      USER_DB.nama
    );
    await vi.waitFor(() => expect(global.fetch).toHaveBeenCalled());
    const verifyCalls = vi.mocked(global.fetch).mock.calls.length;

    // Perubahan status untuk transisi yang sama TIDAK boleh mengirim pesan kedua
    await notificationService.notifyReportStatusChange(
      USER_DB.id,
      REPORT,
      'MENUNGGU_VERIFIKASI',
      'DIPROSES',
      null,
      USER_DB.email,
      USER_DB.nama
    );
    await new Promise((r) => setTimeout(r, 50));

    expect(vi.mocked(global.fetch).mock.calls.length).toBe(verifyCalls);
    expect(sentMessages()[0]).toContain('LAPORAN ANDA TELAH DIVERIFIKASI');
  });

  it('penugasan petugas → WhatsApp hanya ke petugas yang ditugaskan', async () => {
    await notificationService.notifyTugasBaru(
      'p-1',
      REPORT,
      'petugas@example.com',
      'Petugas Satu'
    );

    await vi.waitFor(() => expect(global.fetch).toHaveBeenCalled());
    expect(sentTargets()).toEqual(['6281234567890']);
    const message = sentMessages()[0];
    expect(message).toContain('TUGAS PERBAIKAN BARU');
    expect(message).toContain('Petugas Satu');
    expect(message).toContain(REPORT.lokasi);
    expect(message).toContain('/officer/tasks');
  });

  it('notifikasi admin → WhatsApp ke nomor penerima admin terkonfigurasi', async () => {
    await notificationService.notifyNewReportAdmin(REPORT, {
      nama: USER_DB.nama,
      email: USER_DB.email,
      no_hp: USER_DB.no_hp,
    });

    await vi.waitFor(() => expect(global.fetch).toHaveBeenCalled());
    expect(sentTargets()).toEqual(['6285147722749']);
    const message = sentMessages()[0];
    expect(message).toContain('LAPORAN PENTING MASUK');
    expect(message).toContain('Tinggi');
    expect(message).toContain(REPORT.judul);
    // Data pelapor tidak overexpos: email pelapor tidak ikut dikirim
    expect(message).not.toContain(USER_DB.email);
  });

  it('pengguna baru → notifikasi ke admin', async () => {
    await notificationService.notifyUserRegistrationAdmin({
      id: 'u-baru',
      nama: 'Pengguna Baru',
      email: 'baru@example.com',
      role: 'masyarakat',
      status: 'AKTIF',
      no_hp: '081200000000',
      created_at: new Date(),
    });

    await vi.waitFor(() => expect(global.fetch).toHaveBeenCalled());
    expect(sentTargets()).toEqual(['6285147722749']);
    expect(sentMessages()[0]).toContain('PENDAFTARAN PENGGUNA BARU');
  });
});

describe('10-13. Kegagalan, retry, idempotensi, dan notifikasi in-app', () => {
  it('kegagalan Fonnte tidak menggagalkan notifikasi in-app', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('network down'));

    await notificationService.notifyLaporanDiterima(USER_DB.id, REPORT, USER_DB.email, USER_DB.nama);

    await vi.waitFor(() => expect(mockPrisma.notifications.create).toHaveBeenCalled());
    const notif = mockPrisma.notifications.create.mock.calls[0][0].data;
    expect(notif.type).toBe('LAPORAN_DITERIMA');
    expect(notif.user_id).toBe(USER_DB.id);

    // Tunggu pengiriman WhatsApp latar selesai (retry) agar tidak bocor ke tes berikutnya.
    await vi.waitFor(() =>
      expect(vi.mocked(global.fetch).mock.calls.length).toBeGreaterThanOrEqual(2)
    );
    await new Promise((r) => setTimeout(r, 30));
  });

  it('retry: mencoba ulang sampai batas maksimum lalu berstatus failed', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ status: false, reason: 'server error' }),
    });

    const result = await whatsappService.sendMessage(
      { to: '081234567890', type: 'text', text: { body: 'Halo' } },
      { eventType: 'TEST' }
    );

    expect(result.success).toBe(false);
    expect(vi.mocked(global.fetch)).toHaveBeenCalledTimes(2);
    const lastUpdate = mockPrisma.whatsapp_message_logs.update.mock.calls.at(-1)![0];
    expect(lastUpdate.data.delivery_status).toBe('failed');
  });

  it('idempotensi: event yang sama tidak dikirim dua kali', async () => {
    await whatsappService.sendMessage(
      { to: '081234567890', type: 'text', text: { body: 'Halo' } },
      { eventType: 'TEST', idempotencyKey: 'wa:stable:key' }
    );
    expect(global.fetch).toHaveBeenCalledTimes(1);

    // Pemanggilan kedua dengan key sama: log sudah ada (status sent)
    mockPrisma.whatsapp_message_logs.findUnique.mockResolvedValue({
      id: 'log-1',
      provider_message_id: '80367170',
      delivery_status: 'sent',
    });

    const second = await whatsappService.sendMessage(
      { to: '081234567890', type: 'text', text: { body: 'Halo' } },
      { eventType: 'TEST', idempotencyKey: 'wa:stable:key' }
    );

    expect(second.success).toBe(true);
    expect(second.skipped).toBe('duplicate');
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('idempotensi stabil antar pemanggilan notifikasi untuk laporan yang sama', async () => {
    await notificationService.notifyLaporanDiterima(USER_DB.id, REPORT, USER_DB.email, USER_DB.nama);
    await vi.waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));

    // Log idempotency sudah ada → tidak terkirim ulang
    mockPrisma.whatsapp_message_logs.findUnique.mockResolvedValue({
      id: 'log-1',
      provider_message_id: '80367170',
      delivery_status: 'sent',
    });

    await notificationService.notifyLaporanDiterima(USER_DB.id, REPORT, USER_DB.email, USER_DB.nama);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});

describe('14. Nomor penerima tidak bisa dimanipulasi dari request', () => {
  it('selalu memakai nomor dari database, bukan dari input eksternal', async () => {
    // Prefensi pengguna──────────────────────────────────────────────
    mockPrisma.user_whatsapp_preferences.findUnique.mockResolvedValue({
      whatsapp_normalized: '6289999999999',
      is_verified: true,
      receive_notifications: true,
      receive_report_updates: true,
      receive_login_alerts: true,
    });

    await notificationService.notifyLaporanDiterima(USER_DB.id, REPORT, USER_DB.email, USER_DB.nama);

    await vi.waitFor(() => expect(global.fetch).toHaveBeenCalled());
    // Nomor profil (6281234567890) yang dipakai, bukan nomor dari prefs/param
    expect(sentTargets()).toEqual(['6281234567890']);
  });

  it('nomor tidak valid di database tidak menyebabkan pengiriman', async () => {
    mockPrisma.users.findUnique.mockResolvedValue({
      ...USER_DB,
      no_hp: null,
      no_hp_normalized: null,
    });
    mockPrisma.user_whatsapp_preferences.findUnique.mockResolvedValue(null);

    await notificationService.notifyLaporanDiterima(USER_DB.id, REPORT, USER_DB.email, USER_DB.nama);

    await new Promise((r) => setTimeout(r, 20));
    expect(global.fetch).not.toHaveBeenCalled();
  });
});

describe('15. Token tidak pernah bocor', () => {
  it('tidak muncul di log', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ status: false, reason: 'token invalid' }),
    });

    await whatsappService.sendMessage(
      { to: '081234567890', type: 'text', text: { body: 'Halo' } },
      { eventType: 'TEST' }
    );

    const logDump = JSON.stringify(
      (logger.info as any).mock.calls.concat(
        (logger.warn as any).mock.calls,
        (logger.error as any).mock.calls,
        (logger.debug as any).mock.calls
      )
    );
    expect(logDump).not.toContain(TEST_TOKEN);
  });

  it('tidak muncul di respons error yang disimpan di riwayat', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('gagal hubungi ' + TEST_TOKEN));

    const result = await whatsappService.sendMessage(
      { to: '081234567890', type: 'text', text: { body: 'Halo' } },
      { eventType: 'TEST' }
    );

    expect(result.error).not.toContain(TEST_TOKEN);
    const lastUpdate = mockPrisma.whatsapp_message_logs.update.mock.calls.at(-1)![0];
    expect(lastUpdate.data.last_error).not.toContain(TEST_TOKEN);
  });

  it('status layanan hanya melaporkan token ada/tidak, tanpa nilainya', async () => {
    const status = await whatsappService.status();
    expect(status.tokenConfigured).toBe(true);
    expect(JSON.stringify(status)).not.toContain(TEST_TOKEN);
  });
});
