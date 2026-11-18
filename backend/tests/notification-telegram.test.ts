import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../src/utils/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
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

const report: ReportSummary = {
  id: 'r1',
  judul: 'Lampu Jalan Mati',
  lokasi: 'Jl. Merdeka No. 10',
  kategori: 'Penerangan Jalan',
  ai_priority: 'TINGGI',
  created_at: '2026-10-29T01:00:00.000Z',
};

const reporter = {
  nama: 'Budi',
  email: 'budi@example.com',
  no_hp: '08123456789',
};

describe('Notifikasi Telegram untuk event SIPANTAU', () => {
  let sendAdminSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.notifications.create.mockResolvedValue({ id: 'notif-1' });
    mockPrisma.users.findUnique.mockResolvedValue({
      email: 'fallback@example.com',
      nama: 'Fallback',
    });
    mockPrisma.user_whatsapp_preferences.findUnique.mockResolvedValue(null);

    sendAdminSpy = vi
      .spyOn(telegramService, 'sendAdminMessage')
      .mockResolvedValue({ success: true, messageId: 1 });
  });

  it('A. mengirim notifikasi pendaftaran pengguna baru ke admin', async () => {
    await notificationService.notifyUserRegistrationAdmin({
      id: 'u1',
      nama: 'Budi Santoso',
      email: 'budi@example.com',
      role: 'masyarakat',
      status: 'AKTIF',
    });

    expect(sendAdminSpy).toHaveBeenCalledTimes(1);
    const [text, eventKey] = sendAdminSpy.mock.calls[0];
    expect(eventKey).toBe('user-registration:u1');
    expect(text).toContain('PENDAFTARAN PENGGUNA BARU');
    expect(text).toContain('Budi Santoso');
    expect(text).toContain('u1');
  });

  it('B. mengirim notifikasi laporan baru ke admin', async () => {
    await notificationService.notifyNewReportAdmin(report, reporter);

    expect(sendAdminSpy).toHaveBeenCalledTimes(1);
    const [text, eventKey] = sendAdminSpy.mock.calls[0];
    expect(eventKey).toBe('report-new:r1');
    expect(text).toContain('LAPORAN FASILITAS BARU');
    expect(text).toContain('Lampu Jalan Mati');
    expect(text).toContain('Penerangan Jalan');
    expect(text).toContain('Jl. Merdeka No. 10');
    expect(text).toContain('TINGGI');
  });

  it('C. mengirim notifikasi verifikasi disetujui ke admin', async () => {
    await notificationService.notifyLaporanDiverifikasi(
      'u1',
      report,
      true,
      'budi@example.com',
      'Budi'
    );

    const [text, eventKey] = sendAdminSpy.mock.calls[0];
    expect(eventKey).toBe('report-status:r1:DIPROSES');
    expect(text).toContain('VERIFIKASI LAPORAN');
    expect(text).toContain('Disetujui untuk diproses');
    expect(mockPrisma.notifications.create).toHaveBeenCalledTimes(1);
  });

  it('C. menyertakan alasan penolakan pada verifikasi yang ditolak', async () => {
    await notificationService.notifyLaporanDiverifikasi(
      'u1',
      report,
      false,
      'budi@example.com',
      'Budi',
      'Lokasi tidak jelas'
    );

    const [text, eventKey] = sendAdminSpy.mock.calls[0];
    expect(eventKey).toBe('report-status:r1:DITOLAK');
    expect(text).toContain('Ditolak');
    expect(text).toContain('Lokasi tidak jelas');
  });

  it('D. mengirim notifikasi perubahan status laporan', async () => {
    await notificationService.notifyReportStatusChange(
      'u1',
      report,
      'DIPROSES',
      'DALAM_PERBAIKAN',
      'Petugas sedang di lokasi',
      'budi@example.com',
      'Budi'
    );

    const [text, eventKey] = sendAdminSpy.mock.calls[0];
    expect(eventKey).toBe('report-status:r1:DALAM_PERBAIKAN');
    expect(text).toContain('PERUBAHAN STATUS LAPORAN');
    expect(text).toContain('Diproses');
    expect(text).toContain('Dalam Perbaikan');
    expect(text).toContain('Petugas sedang di lokasi');
  });

  it('D. tidak mengirim apa pun bila status tidak berubah', async () => {
    const result = await notificationService.notifyReportStatusChange(
      'u1',
      report,
      'DIPROSES',
      'DIPROSES'
    );

    expect(result).toBeNull();
    expect(sendAdminSpy).not.toHaveBeenCalled();
    expect(mockPrisma.notifications.create).not.toHaveBeenCalled();
  });

  it('E. mengirim satu notifikasi khusus saat laporan selesai', async () => {
    await notificationService.notifyLaporanSelesai(
      'u1',
      report,
      'Lampu sudah diganti',
      'budi@example.com',
      'Budi'
    );

    expect(sendAdminSpy).toHaveBeenCalledTimes(1);
    const [text, eventKey] = sendAdminSpy.mock.calls[0];
    expect(eventKey).toBe('report-solved:r1');
    expect(text).toContain('LAPORAN SELESAI');
    expect(text).toContain('Lampu sudah diganti');
  });

  it('kegagalan Telegram tidak membatalkan penyimpanan notifikasi/laporan', async () => {
    sendAdminSpy.mockRejectedValue(new Error('network down'));

    await expect(
      notificationService.notifyLaporanDiverifikasi(
        'u1',
        report,
        true,
        'budi@example.com',
        'Budi'
      )
    ).resolves.toBeDefined();

    expect(mockPrisma.notifications.create).toHaveBeenCalledTimes(1);
  });

  it('meneruskan metadata notifikasi ke database', async () => {
    await notificationService.createNotification({
      userId: 'u1',
      reportId: 'r1',
      type: 'LAPORAN_DITERIMA',
      judul: 'Laporan Diterima',
      pesan: 'Terima kasih',
      metadata: { reportTitle: report.judul, reportStatus: 'MENUNGGU_VERIFIKASI' },
      recipientEmail: 'budi@example.com',
      recipientName: 'Budi',
    });

    expect(mockPrisma.notifications.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        user_id: 'u1',
        report_id: 'r1',
        judul: 'Laporan Diterima',
        metadata: {
          reportTitle: 'Lampu Jalan Mati',
          reportStatus: 'MENUNGGU_VERIFIKASI',
        },
      }),
    });
  });
});
