import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../src/utils/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('../src/utils/db', () => ({
  default: {
    notifications: { create: vi.fn() },
    users: { findUnique: vi.fn() },
    user_whatsapp_preferences: { findUnique: vi.fn() },
  },
}));

vi.mock('../src/services/notification/email.service', () => ({
  emailService: { sendNotificationEmail: vi.fn().mockResolvedValue(true) },
}));

vi.mock('../src/services/notification/whatsapp.service', () => ({
  whatsappService: { enabled: false, sendMessage: vi.fn() },
}));

import prisma from '../src/utils/db';
import { notificationService, ReportSummary } from '../src/services/notification/notification.service';
import { telegramService } from '../src/services/telegram/telegram.service';

const mockPrisma = prisma as unknown as {
  notifications: { create: ReturnType<typeof vi.fn> };
  users: { findUnique: ReturnType<typeof vi.fn> };
  user_whatsapp_preferences: { findUnique: ReturnType<typeof vi.fn> };
};

const connectedUser = {
  id: 'uA',
  telegram_chat_id: '1111111111',
  telegram_status: 'CONNECTED',
};

const disconnectedUser = {
  id: 'uB',
  telegram_chat_id: null,
  telegram_status: 'DISCONNECTED',
};

const reportA: ReportSummary = {
  id: 'rA',
  user_id: 'uA',
  judul: 'Lampu Jalan Mati A',
  lokasi: 'Jl. Merdeka A',
  kategori: 'Penerangan Jalan',
  ai_priority: 'TINGGI',
  created_at: '2026-10-29T01:00:00.000Z',
};

const reportB: ReportSummary = {
  id: 'rB',
  user_id: 'uB',
  judul: 'Kolam Bengkak',
  lokasi: 'Jl. Sudirman B',
  kategori: 'Drainase',
  created_at: '2026-10-29T02:00:00.000Z',
};

const reporterA = { nama: 'Ani', email: 'ani@example.com', no_hp: '08123456789' };

describe('Notifikasi Telegram personal', () => {
  let sendUserSpy: ReturnType<typeof vi.spyOn>;
  let sendAdminSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.notifications.create.mockResolvedValue({ id: 'notif-1' });
    mockPrisma.users.findUnique.mockResolvedValue(connectedUser);
    mockPrisma.user_whatsapp_preferences.findUnique.mockResolvedValue(null);

    sendUserSpy = vi
      .spyOn(telegramService, 'sendUserMessage')
      .mockResolvedValue({ success: true, messageId: 1 });
    sendAdminSpy = vi
      .spyOn(telegramService, 'sendAdminMessage')
      .mockResolvedValue({ success: true, messageId: 2 });
  });

  it('B. laporan baru hanya dikirim personal ke pemilik laporan + admin', async () => {
    await notificationService.notifyNewReportAdmin(reportA, reporterA);

    expect(sendUserSpy).toHaveBeenCalledTimes(1);
    const [chatId, text, eventKey] = sendUserSpy.mock.calls[0];
    expect(chatId).toBe('1111111111');
    expect(eventKey).toBe('personal-report-new:rA:uA');
    expect(text).toContain('LAPORAN BERHASIL DIBUAT');
    expect(text).toContain('Lampu Jalan Mati A');
    expect(text).toContain('TINGGI');

    expect(sendAdminSpy).toHaveBeenCalledTimes(1);
    expect(sendAdminSpy.mock.calls[0][1]).toBe('report-new:rA');
  });

  it('B. admin tetap menerima notifikasi bila pelapor belum terhubung Telegram', async () => {
    mockPrisma.users.findUnique.mockResolvedValue(disconnectedUser);

    await notificationService.notifyNewReportAdmin(reportB, reporterA);

    expect(sendUserSpy).not.toHaveBeenCalled();
    expect(sendAdminSpy).toHaveBeenCalledTimes(1);
    expect(mockPrisma.notifications.create).not.toHaveBeenCalled();
  });

  it('C. verifikasi disetujui kirim personal + admin; admin tidak duplikat', async () => {
    await notificationService.notifyLaporanDiverifikasi(
      'uA',
      reportA,
      true,
      'ani@example.com',
      'Ani'
    );

    expect(sendUserSpy).toHaveBeenCalledTimes(1);
    const [, text, eventKey] = sendUserSpy.mock.calls[0];
    expect(eventKey).toBe('personal-report-status:rA:DIPROSES:uA');
    expect(text).toContain('SEDANG DIPROSES');
    expect(text).toContain('Diproses');

    expect(sendAdminSpy).toHaveBeenCalledTimes(1);
    expect(sendAdminSpy.mock.calls[0][1]).toBe('report-status:rA:DIPROSES');
    expect(mockPrisma.notifications.create).toHaveBeenCalledTimes(1);
  });

  it('C. verifikasi ditolak menyertakan alasan pada personal dan admin', async () => {
    await notificationService.notifyLaporanDiverifikasi(
      'uA',
      reportA,
      false,
      'ani@example.com',
      'Ani',
      'Lokasi tidak jelas'
    );

    const [, text, eventKey] = sendUserSpy.mock.calls[0];
    expect(eventKey).toBe('personal-report-status:rA:DITOLAK:uA');
    expect(text).toContain('TIDAK DAPAT DIPROSES');
    expect(text).toContain('Lokasi tidak jelas');

    const [adminText] = sendAdminSpy.mock.calls[0];
    expect(adminText).toContain('Lokasi tidak jelas');
  });

  it('D. DALAM_PERBAIKAN dikirim personal ke pemilik', async () => {
    await notificationService.notifyLaporanDiproses(
      'uA',
      reportA,
      'Petugas di lokasi',
      'ani@example.com',
      'Ani'
    );

    expect(sendUserSpy).toHaveBeenCalledTimes(1);
    const [, text] = sendUserSpy.mock.calls[0];
    expect(text).toContain('DALAM PERBAIKAN');
    expect(text).toContain('Petugas di lokasi');
  });

  it('E. SELESAI dikirim personal dan admin (satu pesan masing-masing)', async () => {
    await notificationService.notifyLaporanSelesai(
      'uA',
      reportA,
      'Lampu diganti',
      'ani@example.com',
      'Ani'
    );

    expect(sendUserSpy).toHaveBeenCalledTimes(1);
    expect(sendUserSpy.mock.calls[0][2]).toBe('personal-report-status:rA:SELESAI:uA');
    const [, text] = sendUserSpy.mock.calls[0];
    expect(text).toContain('SELESAI DITANGANI');
    expect(text).toContain('Lampu diganti');

    expect(sendAdminSpy).toHaveBeenCalledTimes(1);
    expect(sendAdminSpy.mock.calls[0][1]).toBe('report-solved:rA');
  });

  it('D. tidak mengirim bila status tidak berubah', async () => {
    const result = await notificationService.notifyReportStatusChange(
      'uA',
      reportA,
      'DIPROSES',
      'DIPROSES'
    );

    expect(result).toBeNull();
    expect(sendUserSpy).not.toHaveBeenCalled();
    expect(sendAdminSpy).not.toHaveBeenCalled();
    expect(mockPrisma.notifications.create).not.toHaveBeenCalled();
  });

  it('event yang sama tidak mengirim pesan ganda ke pengguna yang sama', async () => {
    await notificationService.notifyNewReportAdmin(reportA, reporterA);
    await notificationService.notifyNewReportAdmin(reportA, reporterA);

    expect(sendUserSpy).toHaveBeenCalledTimes(2);
    expect(sendUserSpy.mock.calls[0][2]).toBe('personal-report-new:rA:uA');
    expect(sendUserSpy.mock.calls[1][2]).toBe('personal-report-new:rA:uA');
    expect(sendAdminSpy).toHaveBeenCalledTimes(2);
  });

  it('kegagalan Telegram personal tidak membatalkan notifikasi in-app', async () => {
    sendUserSpy.mockRejectedValue(new Error('jaringan putus'));

    await expect(
      notificationService.notifyLaporanDiverifikasi('uA', reportA, true, 'ani@example.com', 'Ani')
    ).resolves.toBeDefined();

    expect(mockPrisma.notifications.create).toHaveBeenCalledTimes(1);
  });

  it('A. pendaftaran kirim personal ke pengguna yang sudah terhubung', async () => {
    await notificationService.notifyUserRegistrationUser('uA', {
      nama: 'Budi',
      email: 'budi@example.com',
      role: 'masyarakat',
      status: 'AKTIF',
    });

    expect(sendUserSpy).toHaveBeenCalledTimes(1);
    const [, text] = sendUserSpy.mock.calls[0];
    expect(text).toContain('PENDAFTARAN BERHASIL');
    expect(text).toContain('Budi');
  });
});
