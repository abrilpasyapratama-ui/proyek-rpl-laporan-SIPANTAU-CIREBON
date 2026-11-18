import { NotificationType, Prisma } from '@prisma/client';
import prisma from '../../utils/db';
import { emailService } from './email.service';
import { whatsappService } from './whatsapp.service';
import { telegramService } from '../telegram/telegram.service';
import {
  getIntegrationSettings,
  isFonnteChannelActive,
  isFonnteEventEnabled,
  isTelegramChannelActive,
  FonnteEventKey,
} from '../integration/settings.service';
import { maskPhone, normalizeWhatsAppNumber } from '../../utils/phone';
import { logger } from '../../utils/logger';
import { config } from '../../config';

/** Metadata tambahan yang disimpan bersama notifikasi (kolom JSON). */
export interface NotificationMetadata {
  reportTitle?: string;
  reportLocation?: string;
  reportStatus?: string;
  oldStatus?: string;
  catatan?: string;
  kategori?: string | null;
  priority?: string | null;
  isApproved?: boolean;
  prioritasLama?: string;
  prioritasBaru?: string;
  role?: string;
  status?: string;
  [key: string]: unknown;
}

export interface CreateNotificationParams {
  userId: string;
  reportId?: string | null;
  type: NotificationType;
  judul: string;
  pesan: string;
  metadata?: NotificationMetadata;
  recipientEmail?: string | null;
  recipientName?: string | null;
  actionUrl?: string;
  actionText?: string;
  sendEmail?: boolean;
  sendWhatsApp?: boolean;
}

/** Ringkasan laporan yang dibutuhkan untuk menyusun pesan notifikasi. */
export interface ReportSummary {
  id: string;
  user_id?: string | null;
  judul: string;
  lokasi: string;
  kategori?: string | null;
  ai_priority?: string | null;
  status?: string | null;
  created_at?: Date | string | null;
}

export interface ReporterSummary {
  nama: string;
  email: string;
  no_hp?: string | null;
}

export interface NewUserSummary {
  id: string;
  nama: string;
  email: string;
  role: string;
  status: string;
  no_hp?: string | null;
  created_at?: Date | string | null;
}

export interface RegistrationUserData {
  nama: string;
  email: string;
  role: string;
  status: string;
}

export interface LoginInfo {
  ip?: string;
  userAgent?: string;
  location?: string;
  timestamp: Date;
}

/** Label status laporan (sesuai enum ReportStatus pada schema Prisma). */
const REPORT_STATUS_LABELS: Record<string, string> = {
  MENUNGGU_VERIFIKASI: 'Menunggu Verifikasi',
  DIPROSES: 'Diproses',
  DALAM_PERBAIKAN: 'Dalam Perbaikan',
  SELESAI: 'Selesai',
  DITOLAK: 'Ditolak',
};

const ROLE_LABELS: Record<string, string> = {
  masyarakat: 'Masyarakat',
  petugas: 'Petugas',
  admin: 'Admin',
};

function statusLabel(status: string): string {
  return REPORT_STATUS_LABELS[status] || status;
}

function roleLabel(role: string): string {
  return ROLE_LABELS[role] || role;
}

/** Format waktu ke zona Asia/Jakarta, aman untuk nilai kosong/tidak valid. */
function formatWaktu(value?: Date | string | null): string {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) {
    return new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' }) + ' WIB';
  }
  return date.toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' }) + ' WIB';
}

/** Buang nilai `undefined` agar metadata valid sebagai Prisma JSON. */
function toPrismaJson(metadata?: NotificationMetadata): Prisma.InputJsonValue {
  if (!metadata) return {};
  const clean: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (value !== undefined) clean[key] = value;
  }
  return clean as Prisma.InputJsonValue;
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/** Susun pesan personal dengan sapaan di antara judul dan rincian. */
function formatPersonalMessage(
  title: string,
  greeting: string | null,
  rows: Array<{ label: string; value?: string | number | null }>,
  footer: string
): string {
  const lines: string[] = ['<b>' + telegramService.escapeHtml(title) + '</b>'];

  if (greeting) {
    lines.push('', telegramService.escapeHtml(greeting));
  }

  lines.push('');
  for (const row of rows) {
    if (row.value === undefined || row.value === null || row.value === '') continue;
    lines.push(
      telegramService.escapeHtml(row.label) + ': ' + telegramService.escapeHtml(String(row.value))
    );
  }

  if (footer) {
    lines.push('', telegramService.escapeHtml(footer));
  }

  return lines.join('\n');
}

/** Pesan personal untuk perubahan status laporan. */
function buildPersonalStatusMessage(
  report: ReportSummary,
  userName: string | null | undefined,
  status: string,
  catatan?: string | null
): string {
  const greeting = userName ? 'Halo ' + userName + ',' : 'Halo,';
  const baseRows: Array<{ label: string; value?: string | number | null }> = [
    { label: 'Nomor laporan', value: report.id },
    { label: 'Judul', value: report.judul },
    { label: 'Status', value: statusLabel(status) },
  ];

  switch (status) {
    case 'DIPROSES':
      return formatPersonalMessage(
        '🔄 LAPORAN ANDA SEDANG DIPROSES',
        greeting,
        baseRows,
        'Laporan Anda telah diverifikasi dan diteruskan untuk ditangani. Terima kasih telah menggunakan SIPANTAU CIREBON.'
      );
    case 'DALAM_PERBAIKAN':
      return formatPersonalMessage(
        '🔧 LAPORAN DALAM PERBAIKAN',
        greeting,
        [...baseRows, { label: 'Keterangan', value: catatan || 'Petugas sedang menangani perbaikan' }],
        'Silakan pantau perkembangan melalui aplikasi SIPANTAU CIREBON.'
      );
    case 'SELESAI':
      return formatPersonalMessage(
        '✅ LAPORAN SELESAI DITANGANI',
        greeting,
        [...baseRows, { label: 'Penyelesaian', value: catatan || 'Perbaikan telah diselesaikan' }],
        'Terima kasih atas kepedulian Anda menjaga fasilitas publik.'
      );
    case 'DITOLAK':
      return formatPersonalMessage(
        '❌ LAPORAN TIDAK DAPAT DIPROSES',
        greeting,
        [...baseRows, { label: 'Alasan', value: catatan || 'Tidak disebutkan' }],
        'Anda dapat membuat laporan baru dengan informasi yang lebih lengkap.'
      );
    default:
      return formatPersonalMessage(
        'ℹ️ PEMBARUAN STATUS LAPORAN',
        greeting,
        [...baseRows, { label: 'Keterangan', value: catatan || null }],
        'Silakan buka aplikasi SIPANTAU CIREBON untuk detail lengkap.'
      );
  }
}

export class NotificationService {
  /**
   * Kirim notifikasi admin ke Telegram tanpa pernah menggagalkan alur utama.
   * Kegagalan jaringan/API hanya dicatat ke log.
   */
  private async sendAdminTelegram(eventKey: string, text: string): Promise<void> {
    try {
      if (!(await isTelegramChannelActive())) {
        logger.debug('Notifikasi Telegram admin dilewati (kanal dimatikan)', { eventKey });
        return;
      }
      const result = await telegramService.sendAdminMessage(text, eventKey);
      if (!result.success && !result.skipped) {
        logger.warn('Notifikasi Telegram admin gagal', { eventKey, error: result.error });
      }
    } catch (err) {
      logger.error('Notifikasi Telegram admin error', { eventKey, error: errorMessage(err) });
    }
  }

  /**
   * Kirim notifikasi personal HANYA ke Telegram milik `userId`.
   * Pengguna yang belum terhubung dilewati tanpa menggagalkan alur utama.
   */
  private async sendPersonalTelegram(
    userId: string,
    eventKey: string,
    text: string,
    reportId?: string | null
  ): Promise<void> {
    if (!telegramService.enabled || !(await isTelegramChannelActive())) {
      logger.debug('Telegram nonaktif, notifikasi personal dilewati', { userId, reportId });
      return;
    }

    try {
      const user = await prisma.users.findUnique({
        where: { id: userId },
        select: { telegram_chat_id: true, telegram_status: true },
      });

      if (!user || user.telegram_status !== 'CONNECTED' || !user.telegram_chat_id) {
        logger.debug('Pengguna belum menghubungkan Telegram, notifikasi personal dilewati', {
          userId,
          reportId,
        });
        return;
      }

      const result = await telegramService.sendUserMessage(
        user.telegram_chat_id,
        text,
        eventKey,
        { userId, reportId: reportId ?? undefined }
      );

      if (!result.success && !result.skipped) {
        logger.warn('Notifikasi Telegram personal gagal', {
          userId,
          reportId,
          error: result.error,
        });
      }
    } catch (err) {
      logger.error('Notifikasi Telegram personal error', {
        userId,
        reportId,
        error: errorMessage(err),
      });
    }
  }

  async createNotification(params: CreateNotificationParams) {
    try {
      const notification = await prisma.notifications.create({
        data: {
          user_id: params.userId,
          report_id: params.reportId || null,
          type: params.type,
          judul: params.judul,
          pesan: params.pesan,
          metadata: toPrismaJson(params.metadata),
        },
      });

      if (params.sendEmail !== false) {
        let email = params.recipientEmail ?? undefined;
        let name = params.recipientName ?? undefined;

        if (!email || !name) {
          const user = await prisma.users.findUnique({
            where: { id: params.userId },
            select: { email: true, nama: true },
          });
          if (user) {
            email = user.email;
            name = user.nama;
          }
        }

        if (email) {
          emailService
            .sendNotificationEmail({
              to: email,
              recipientName: name || 'Pengguna',
              subject: '[Notifikasi] ' + params.judul,
              headline: params.judul,
              content: params.pesan,
              reportTitle: params.metadata?.reportTitle,
              reportLocation: params.metadata?.reportLocation,
              reportStatus: params.metadata?.reportStatus,
              actionUrl: params.actionUrl,
              actionText: params.actionText,
            })
            .catch((e: unknown) => {
              logger.error('Email error', { error: errorMessage(e) });
            });
        }
      }

      // WhatsApp (Fonnte) TIDAK dikirim otomatis dari sini.
      // Pengiriman WhatsApp dilakukan eksplisit pada tiap event agar isi pesan,
      // jenis event, dan idempotensinya terkontrol (lihat sendWhatsAppToUser).
      return notification;
    } catch (error) {
      logger.error('NotificationService error', { error: errorMessage(error) });
      return null;
    }
  }

  /**
   * Tentukan nomor WhatsApp penerima dari DATABASE.
   *
   * Prioritas:
   *  1. `users.no_hp_normalized` (profil pemilik laporan / akun).
   *  2. `user_whatsapp_preferences.whatsapp_normalized` (bila terverifikasi).
   *
   * Nomor TIDAK PERNAH berasal dari input request/frontend.
   * Pref opt-out (receive_notifications / receive_report_updates) dihormati.
   */
  private async resolveRecipient(
    userId: string,
    opts: { requireReportUpdates?: boolean; requireLoginAlerts?: boolean } = {}
  ): Promise<string | null> {
    const [user, pref] = await Promise.all([
      prisma.users.findUnique({
        where: { id: userId },
        select: { no_hp: true, no_hp_normalized: true },
      }),
      prisma.user_whatsapp_preferences.findUnique({
        where: { user_id: userId },
        select: {
          whatsapp_normalized: true,
          is_verified: true,
          receive_notifications: true,
          receive_report_updates: true,
          receive_login_alerts: true,
        },
      }),
    ]);

    if (pref && pref.receive_notifications === false) {
      return null;
    }
    if (opts.requireReportUpdates && pref && pref.receive_report_updates === false) {
      return null;
    }
    if (opts.requireLoginAlerts && pref && pref.receive_login_alerts === false) {
      return null;
    }

    const fromProfile =
      user?.no_hp_normalized ?? normalizeWhatsAppNumber(user?.no_hp) ?? null;
    const fromPreference = pref?.is_verified ? pref.whatsapp_normalized : null;
    const chosen = fromProfile ?? fromPreference ?? null;

    return chosen ? normalizeWhatsAppNumber(chosen) : null;
  }

  /**
   * Susun pesan WhatsApp (teks sederhana, format Fonnte).
   */
  buildWhatsAppText(
    title: string,
    greeting: string | null,
    rows: Array<{ label: string; value?: string | number | null }>,
    footer?: string | null
  ): string {
    const lines: string[] = ['*' + title + '*', ''];

    if (greeting) {
      lines.push(greeting, '');
    }

    for (const row of rows) {
      if (row.value === undefined || row.value === null || row.value === '') continue;
      lines.push('*' + row.label + ':* ' + String(row.value));
    }

    if (footer) {
      lines.push('', footer);
    }

    return lines.join('\n');
  }

  /**
   * Kirim WhatsApp (Fonnte) ke satu pengguna.
   *
   * - Nomor penerima diambil dari database.
 * - Idempotency key STABIL per event — tidak ada pengiriman ganda.
   * - Kegagalan tidak pernah menggagalkan alur utama (notifikasi in-app/email).
   */
  private async sendWhatsAppToUser(
    userId: string,
    event: FonnteEventKey,
    text: string,
    opts: { reportId?: string | null; keySuffix?: string; requireReportUpdates?: boolean; requireLoginAlerts?: boolean } = {}
  ): Promise<void> {
    try {
      if (!(await isFonnteChannelActive())) return;
      if (!(await isFonnteEventEnabled(event))) {
        logger.debug('WhatsApp dilewati: jenis notifikasi dimatikan', { event, userId });
        return;
      }

      const to = await this.resolveRecipient(userId, opts);
      if (!to) {
        logger.debug('WhatsApp dilewati: penerima tidak memiliki nomor WhatsApp valid', {
          event,
          userId,
        });
        return;
      }

      const idempotencyKey = [
        'wa',
        event,
        opts.reportId || 'general',
        userId,
        opts.keySuffix || '',
      ].join(':');

      await whatsappService.sendMessage(
        { to, type: 'text', text: { body: text } },
        {
          eventType: event,
          reportId: opts.reportId ?? undefined,
          userId,
          idempotencyKey,
        }
      );
    } catch (err) {
      logger.error('Gagal mengirim notifikasi WhatsApp ke pengguna', {
        event,
        userId,
        error: errorMessage(err),
      });
    }
  }

  /**
   * Kirim WhatsApp (Fonnte) ke seluruh nomor admin yang dikonfigurasi.
   * Nomor diambil dari konfigurasi server (env) atau override runtime.
   */
  private async sendWhatsAppToAdmins(
    event: FonnteEventKey,
    text: string,
    opts: { reportId?: string | null; keySuffix?: string } = {}
  ): Promise<void> {
    try {
      if (!(await isFonnteChannelActive())) return;
      if (!(await isFonnteEventEnabled(event))) {
        logger.debug('WhatsApp admin dilewati: jenis notifikasi dimatikan', { event });
        return;
      }

      const settings = await getIntegrationSettings();
      const recipients = settings.fonnteAdminRecipients || [];
      if (recipients.length === 0) {
        logger.debug('WhatsApp admin dilewati: tidak ada nomor penerima admin terkonfigurasi');
        return;
      }

      for (const raw of recipients) {
        const to = normalizeWhatsAppNumber(raw);
        if (!to) {
          logger.warn('Nomor penerima admin tidak valid, dilewati');
          continue;
        }
        const idempotencyKey = [
          'wa',
          event,
          opts.reportId || 'general',
          opts.keySuffix || '',
          maskPhone(to),
        ].join(':');

        await whatsappService.sendMessage(
          { to, type: 'text', text: { body: text } },
          {
            eventType: event,
            reportId: opts.reportId ?? undefined,
            idempotencyKey,
          }
        );
      }
    } catch (err) {
      logger.error('Gagal mengirim notifikasi WhatsApp ke admin', {
        event,
        error: errorMessage(err),
      });
    }
  }

  notifyLaporanDiterima(
    userId: string,
    report: ReportSummary,
    userEmail?: string | null,
    userName?: string | null
  ) {
    // WhatsApp (Fonnte) ke pelapor: laporan berhasil dikirim.
    void this.sendWhatsAppToUser(
      userId,
      'REPORT_RECEIVED',
      this.buildWhatsAppText(
        'LAPORAN BERHASIL DITERIMA',
        userName ? 'Halo ' + userName + ',' : null,
        [
          { label: 'Nama', value: userName },
          { label: 'Nomor laporan', value: report.id },
          { label: 'Judul', value: report.judul },
          { label: 'Kategori', value: report.kategori },
          { label: 'Lokasi', value: report.lokasi },
          { label: 'Status', value: statusLabel('MENUNGGU_VERIFIKASI') },
        ],
        'Laporan Anda menunggu verifikasi Admin. Pantau di ' + config.frontendUrl + '/reports/history'
      ),
      { reportId: report.id }
    );

    return this.createNotification({
      userId,
      reportId: report.id,
      type: NotificationType.LAPORAN_DITERIMA,
      judul: 'Laporan Berhasil Diterima',
      pesan:
        'Laporan Anda mengenai "' +
        report.judul +
        '" di ' +
        report.lokasi +
        ' telah berhasil masuk ke sistem kami dan sedang menunggu proses verifikasi oleh tim dinas terkait.',
      metadata: {
        reportTitle: report.judul,
        reportLocation: report.lokasi,
        reportStatus: 'MENUNGGU_VERIFIKASI',
        kategori: report.kategori,
      },
      recipientEmail: userEmail,
      recipientName: userName,
      actionUrl: config.frontendUrl + '/dashboard',
      actionText: 'Pantau Riwayat Laporan',
    });
  }

  /**
 * Event C: verifikasi laporan (disetujui/ditolak) — notifikasi admin via Telegram.
   * Event key sama dengan perubahan status agar tidak ada pesan ganda.
   */
  async notifyLaporanDiverifikasi(
    userId: string,
    report: ReportSummary,
    isApproved: boolean,
    userEmail?: string | null,
    userName?: string | null,
    reason?: string | null
  ) {
    const judul = isApproved ? 'Laporan Telah Diverifikasi' : 'Status Verifikasi Laporan';
    const pesan = isApproved
      ? 'Kabar baik! Laporan Anda "' +
        report.judul +
        '" telah diverifikasi dan disetujui untuk segera ditindaklanjuti oleh petugas perbaikan.'
      : 'Laporan Anda "' +
        report.judul +
        '" telah ditinjau, namun saat ini belum dapat diproses lebih lanjut.';

    const status = isApproved ? 'DIPROSES' : 'DITOLAK';

    const telegramMessage = telegramService.formatMessage(
      isApproved ? '✅ VERIFIKASI LAPORAN' : '⛔ VERIFIKASI LAPORAN',
      [
        { label: 'Nomor', value: report.id },
        { label: 'Judul', value: report.judul },
        { label: 'Keputusan', value: isApproved ? 'Disetujui untuk diproses' : 'Ditolak' },
        { label: 'Status terbaru', value: statusLabel(status) },
        { label: 'Alasan penolakan', value: isApproved ? null : reason || 'Tidak disebutkan' },
        { label: 'Waktu', value: formatWaktu() },
      ],
      'Silakan buka dashboard SIPANTAU CIREBON untuk meninjau laporan.'
    );

    await this.sendAdminTelegram('report-status:' + report.id + ':' + status, telegramMessage);

    await this.sendPersonalTelegram(
      userId,
      'personal-report-status:' + report.id + ':' + status + ':' + userId,
      buildPersonalStatusMessage(report, userName, status, reason),
      report.id
    );

    // WhatsApp (Fonnte) ke pelapor: laporan diverifikasi atau ditolak.
    void this.sendWhatsAppToUser(
      userId,
      isApproved ? 'REPORT_VERIFIED' : 'REPORT_REJECTED',
      this.buildWhatsAppText(
        isApproved ? 'LAPORAN ANDA TELAH DIVERIFIKASI' : 'LAPORAN ANDA BELUM DAPAT DIPROSES',
        userName ? 'Halo ' + userName + ',' : null,
        [
          { label: 'Nama', value: userName },
          { label: 'Nomor laporan', value: report.id },
          { label: 'Judul', value: report.judul },
          { label: 'Kategori', value: report.kategori },
          { label: 'Status', value: statusLabel(status) },
          { label: 'Keterangan', value: isApproved ? 'Disetujui untuk ditangani petugas' : reason || 'Tidak disebutkan' },
        ],
        isApproved
          ? 'Terima kasih telah membantu fasilitas publik. Pantau di ' + config.frontendUrl + '/reports/history'
          : 'Anda dapat membuat laporan baru dengan informasi lebih lengkap.'
      ),
      { reportId: report.id }
    );

    return this.createNotification({
      userId,
      reportId: report.id,
      type: NotificationType.LAPORAN_DIVERIFIKASI,
      judul,
      pesan,
      metadata: {
        reportTitle: report.judul,
        reportLocation: report.lokasi,
        reportStatus: status,
        isApproved,
      },
      recipientEmail: userEmail,
      recipientName: userName,
      actionUrl: config.frontendUrl + '/dashboard',
      actionText: 'Lihat Status Laporan',
    });
  }

  /** Event D (DALAM_PERBAIKAN): laporan mulai ditangani petugas. */
  async notifyLaporanDiproses(
    userId: string,
    report: ReportSummary,
    catatan?: string | null,
    userEmail?: string | null,
    userName?: string | null
  ) {
    const noteText = catatan ? ' Catatan petugas: "' + catatan + '".' : '';

    const telegramMessage = telegramService.formatMessage(
      '🔧 LAPORAN DALAM PERBAIKAN',
      [
        { label: 'Nomor', value: report.id },
        { label: 'Judul', value: report.judul },
        { label: 'Lokasi', value: report.lokasi },
        { label: 'Catatan', value: catatan || 'Tidak ada catatan' },
        { label: 'Waktu', value: formatWaktu() },
      ],
      'Silakan buka dashboard SIPANTAU CIREBON untuk memantau progres.'
    );

    await this.sendAdminTelegram('report-status:' + report.id + ':DALAM_PERBAIKAN', telegramMessage);

    await this.sendPersonalTelegram(
      userId,
      'personal-report-status:' + report.id + ':DALAM_PERBAIKAN:' + userId,
      buildPersonalStatusMessage(report, userName, 'DALAM_PERBAIKAN', catatan),
      report.id
    );

    // WhatsApp (Fonnte) ke pelapor: laporan dalam perbaikan.
    void this.sendWhatsAppToUser(
      userId,
      'REPORT_IN_PROGRESS',
      this.buildWhatsAppText(
        'LAPORAN DALAM PERBAIKAN',
        userName ? 'Halo ' + userName + ',' : null,
        [
          { label: 'Nama', value: userName },
          { label: 'Nomor laporan', value: report.id },
          { label: 'Judul', value: report.judul },
          { label: 'Kategori', value: report.kategori },
          { label: 'Lokasi', value: report.lokasi },
          { label: 'Status', value: statusLabel('DALAM_PERBAIKAN') },
          { label: 'Keterangan petugas', value: catatan || 'Petugas sedang menangani perbaikan' },
        ],
        'Silakan pantau perkembangan di ' + config.frontendUrl + '/reports/history'
      ),
      { reportId: report.id, requireReportUpdates: true }
    );

    return this.createNotification({
      userId,
      reportId: report.id,
      type: NotificationType.LAPORAN_DALAM_PERBAIKAN,
      judul: 'Laporan Sedang Dalam Perbaikan',
      pesan:
        'Petugas lapangan telah mulai menangani perbaikan fasilitas pada laporan "' +
        report.judul +
        '".' +
        noteText,
      metadata: {
        reportTitle: report.judul,
        reportLocation: report.lokasi,
        reportStatus: 'DALAM_PERBAIKAN',
        catatan: catatan ?? undefined,
      },
      recipientEmail: userEmail,
      recipientName: userName,
      actionUrl: config.frontendUrl + '/dashboard',
      actionText: 'Pantau Perkembangan',
    });
  }

  /** Event E: laporan selesai — satu pesan khusus untuk admin. */
  async notifyLaporanSelesai(
    userId: string,
    report: ReportSummary,
    catatan?: string | null,
    userEmail?: string | null,
    userName?: string | null
  ) {
    const s1 =
      'Perbaikan fasilitas publik untuk laporan "' +
      report.judul +
      '" telah selesai dikerjakan dengan tuntas.';
    const s2 = catatan ? ' Catatan penyelesaian: "' + catatan + '".' : '';
    const s3 = ' Terima kasih atas kepedulian Anda dalam menjaga fasilitas bersama.';

    const telegramMessage = telegramService.formatMessage(
      '✅ LAPORAN SELESAI',
      [
        { label: 'Nomor', value: report.id },
        { label: 'Judul', value: report.judul },
        { label: 'Lokasi', value: report.lokasi },
        { label: 'Ringkasan penyelesaian', value: catatan || 'Tidak ada catatan' },
        { label: 'Waktu selesai', value: formatWaktu() },
      ],
      'Silakan buka dashboard SIPANTAU CIREBON untuk meninjau hasil perbaikan.'
    );

    await this.sendAdminTelegram('report-solved:' + report.id, telegramMessage);

    await this.sendPersonalTelegram(
      userId,
      'personal-report-status:' + report.id + ':SELESAI:' + userId,
      buildPersonalStatusMessage(report, userName, 'SELESAI', catatan),
      report.id
    );

    // WhatsApp (Fonnte) ke pelapor: laporan selesai.
    void this.sendWhatsAppToUser(
      userId,
      'REPORT_COMPLETED',
      this.buildWhatsAppText(
        'LAPORAN ANDA TELAH SELESAI DITANGANI',
        userName ? 'Halo ' + userName + ',' : null,
        [
          { label: 'Nama', value: userName },
          { label: 'Nomor laporan', value: report.id },
          { label: 'Judul', value: report.judul },
          { label: 'Kategori', value: report.kategori },
          { label: 'Lokasi', value: report.lokasi },
          { label: 'Status', value: statusLabel('SELESAI') },
          { label: 'Keterangan petugas', value: catatan || 'Perbaikan telah diselesaikan' },
        ],
        'Terima kasih atas kepedulian Anda menjaga fasilitas publik. Detail: ' +
          config.frontendUrl +
          '/reports/history'
      ),
      { reportId: report.id, requireReportUpdates: true }
    );

    return this.createNotification({
      userId,
      reportId: report.id,
      type: NotificationType.LAPORAN_SELESAI,
      judul: 'Laporan Telah Selesai Dikerjakan!',
      pesan: s1 + s2 + s3,
      metadata: {
        reportTitle: report.judul,
        reportLocation: report.lokasi,
        reportStatus: 'SELESAI',
        catatan: catatan ?? undefined,
      },
      recipientEmail: userEmail,
      recipientName: userName,
      actionUrl: config.frontendUrl + '/dashboard',
      actionText: 'Lihat Bukti Penyelesaian',
    });
  }

  notifyTugasBaru(
    petugasId: string,
    report: ReportSummary,
    petugasEmail?: string | null,
    petugasName?: string | null
  ) {
    const priorityText = report.ai_priority
      ? ' Prioritas penanganan: [' + report.ai_priority + '].'
      : '';

    // WhatsApp (Fonnte) ke petugas yang benar-benar ditugaskan.
    void this.sendWhatsAppToUser(
      petugasId,
      'OFFICER_ASSIGNED',
      this.buildWhatsAppText(
        'TUGAS PERBAIKAN BARU',
        petugasName ? 'Halo ' + petugasName + ',' : null,
        [
          { label: 'Nama petugas', value: petugasName },
          { label: 'Nomor laporan', value: report.id },
          { label: 'Judul', value: report.judul },
          { label: 'Kategori', value: report.kategori },
          { label: 'Lokasi', value: report.lokasi },
          { label: 'Status', value: statusLabel('DIPROSES') },
          { label: 'Prioritas', value: report.ai_priority || 'Normal' },
          { label: 'Keterangan penugasan', value: 'Anda ditugaskan menangani laporan ini' },
        ],
        'Buka detail tugas: ' + config.frontendUrl + '/officer/tasks'
      ),
      { reportId: report.id }
    );

    return this.createNotification({
      userId: petugasId,
      reportId: report.id,
      type: NotificationType.TUGAS_BARU,
      judul: 'Penugasan Perbaikan Baru',
      pesan:
        'Anda telah ditugaskan untuk menangani laporan perbaikan "' +
        report.judul +
        '" di lokasi ' +
        report.lokasi +
        '.' +
        priorityText +
        ' Harap segera periksa rincian tugas.',
      metadata: {
        reportTitle: report.judul,
        reportLocation: report.lokasi,
        reportStatus: 'DIPROSES',
        kategori: report.kategori,
        priority: report.ai_priority,
      },
      recipientEmail: petugasEmail,
      recipientName: petugasName,
      actionUrl: config.frontendUrl + '/petugas',
      actionText: 'Buka Tugas Lapangan',
    });
  }

  notifyPerubahanPrioritas(
    petugasId: string,
    report: ReportSummary,
    prioritasLama: string | null | undefined,
    prioritasBaru: string,
    petugasEmail?: string | null,
    petugasName?: string | null
  ) {
    // WhatsApp (Fonnte) ke petugas: perubahan prioritas tugas.
    void this.sendWhatsAppToUser(
      petugasId,
      'OFFICER_PRIORITY_CHANGED',
      this.buildWhatsAppText(
        'PERUBAHAN PRIORITAS TUGAS',
        petugasName ? 'Halo ' + petugasName + ',' : null,
        [
          { label: 'Nama petugas', value: petugasName },
          { label: 'Nomor laporan', value: report.id },
          { label: 'Judul', value: report.judul },
          { label: 'Kategori', value: report.kategori },
          { label: 'Lokasi', value: report.lokasi },
          { label: 'Prioritas lama', value: prioritasLama || 'Normal' },
          { label: 'Prioritas baru', value: prioritasBaru },
          { label: 'Keterangan', value: 'Sesuaikan jadwal tindakan lapangan Anda' },
        ],
        'Tinjau perubahan: ' + config.frontendUrl + '/officer/tasks'
      ),
      { reportId: report.id, keySuffix: prioritasBaru }
    );

    return this.createNotification({
      userId: petugasId,
      reportId: report.id,
      type: NotificationType.PERUBAHAN_PRIORITAS,
      judul: 'Perubahan Prioritas: ' + prioritasBaru,
      pesan:
        'Tingkat urgensi laporan "' +
        report.judul +
        '" telah diperbarui dari [' +
        (prioritasLama || 'Normal') +
        '] menjadi [' +
        prioritasBaru +
        ']. Harap sesuaikan jadwal tindakan lapangan Anda.',
      metadata: {
        reportTitle: report.judul,
        reportLocation: report.lokasi,
        prioritasLama: prioritasLama ?? 'Normal',
        prioritasBaru,
      },
      recipientEmail: petugasEmail,
      recipientName: petugasName,
      actionUrl: config.frontendUrl + '/petugas',
      actionText: 'Tinjau Perubahan Tugas',
    });
  }

  /** Event A: pendaftaran pengguna baru — notifikasi admin. */
  async notifyUserRegistrationAdmin(
    newUser: NewUserSummary,
    /** @deprecated Nomor admin kini diambil dari konfigurasi penerima (bukan argumen). */
    _adminNumber?: string
  ): Promise<void> {
    const telegramMessage = telegramService.formatMessage(
      '🆕 PENDAFTARAN PENGGUNA BARU',
      [
        { label: 'Nama', value: newUser.nama },
        { label: 'Email', value: newUser.email },
        { label: 'Peran', value: roleLabel(newUser.role) },
        { label: 'Status', value: newUser.status === 'AKTIF' ? 'Aktif' : statusLabel(newUser.status) },
        { label: 'Waktu pendaftaran', value: formatWaktu(newUser.created_at) },
        { label: 'ID pengguna', value: newUser.id },
      ],
      'Silakan buka dashboard SIPANTAU CIREBON untuk meninjau pendaftaran.'
    );

    await this.sendAdminTelegram('user-registration:' + newUser.id, telegramMessage);

    // WhatsApp (Fonnte) ke admin: pengguna baru mendaftar.
    await this.sendWhatsAppToAdmins(
      'ADMIN_NEW_USER',
      this.buildWhatsAppText(
        'PENDAFTARAN PENGGUNA BARU',
        null,
        [
          { label: 'Nama', value: newUser.nama },
          { label: 'Email', value: newUser.email },
          { label: 'Peran', value: roleLabel(newUser.role) },
          { label: 'Status', value: newUser.status === 'AKTIF' ? 'Aktif' : statusLabel(newUser.status) },
          { label: 'WhatsApp', value: newUser.no_hp ? maskPhone(newUser.no_hp) : 'Tidak diisi' },
          { label: 'Waktu', value: formatWaktu(newUser.created_at) },
        ],
        'Tinjau di dashboard Admin: ' + config.frontendUrl + '/admin/users'
      ),
      { keySuffix: newUser.id }
    );
  }

  async notifyUserRegistrationUser(
    userId: string,
    userData: RegistrationUserData,
    userEmail?: string | null,
    userName?: string | null
  ) {
    const registrationStatusLabel =
      userData.status === 'AKTIF'
        ? 'Aktif'
        : userData.status === 'MENUNGGU_VERIFIKASI'
        ? 'Menunggu Verifikasi'
        : 'Ditolak';

    await this.sendPersonalTelegram(
      userId,
      'personal-registration:' + userId,
      formatPersonalMessage(
      '🎉 PENDAFTARAN BERHASIL',
        'Selamat datang di SIPANTAU CIREBON.',
        [
          { label: 'Nama', value: userData.nama },
          { label: 'Peran', value: roleLabel(userData.role) },
          { label: 'Status', value: registrationStatusLabel },
        ],
        userData.role === 'petugas'
          ? 'Akun petugas Anda menunggu verifikasi Admin. Anda akan menerima notifikasi setelah disetujui.'
          : 'Akun Anda berhasil dibuat. Silakan gunakan aplikasi untuk melaporkan kerusakan fasilitas publik.'
      )
    );

    // WhatsApp (Fonnte) ke pengguna: registrasi berhasil.
    await this.sendWhatsAppToUser(
      userId,
      'USER_REGISTRATION',
      this.buildWhatsAppText(
        'PENDAFTARAN BERHASIL',
        'Halo ' + userData.nama + ',',
        [
          { label: 'Nama', value: userData.nama },
          { label: 'Peran', value: roleLabel(userData.role) },
          { label: 'Status', value: registrationStatusLabel },
        ],
        userData.role === 'petugas'
          ? 'Akun petugas Anda menunggu verifikasi Admin. Anda akan menerima notifikasi setelah disetujui.'
          : 'Akun Anda berhasil dibuat. Silakan login: ' + config.frontendUrl + '/login'
      ),
      { keySuffix: userId }
    );

    return this.createNotification({
      userId,
      type: NotificationType.SISTEM,
      judul: 'Selamat Datang di SIPANTAU Cirebon!',
      pesan:
        'Halo ' +
        userData.nama +
        ', akun Anda telah berhasil dibuat. ' +
        (userData.role === 'petugas'
          ? 'Akun petugas Anda menunggu verifikasi Admin.'
          : 'Anda dapat langsung login dan mulai melaporkan fasilitas umum rusak.'),
      metadata: { role: userData.role, status: userData.status },
      recipientEmail: userEmail,
      recipientName: userName,
      actionUrl: config.frontendUrl + '/login',
      actionText: 'Login Sekarang',
    });
  }

  async notifyUserLogin(userId: string, loginInfo: LoginInfo): Promise<void> {
    try {
      const deviceInfo = loginInfo.userAgent
        ? loginInfo.userAgent.indexOf('Mobile') >= 0
          ? 'Perangkat Mobile'
          : 'Desktop'
        : 'Perangkat tidak diketahui';

      // WhatsApp (Fonnte): notifikasi login baru (bila diizinkan pengguna).
      await this.sendWhatsAppToUser(
        userId,
        'LOGIN_ALERT',
        this.buildWhatsAppText(
          'NOTIFIKASI LOGIN BARU',
          null,
          [
            { label: 'Waktu', value: formatWaktu(loginInfo.timestamp) },
            { label: 'Perangkat', value: deviceInfo },
            { label: 'Lokasi', value: loginInfo.location ?? null },
            { label: 'IP', value: loginInfo.ip ?? null },
          ],
          'Jika ini bukan Anda, segera ubah password dan hubungi Admin.'
        ),
        { keySuffix: String(loginInfo.timestamp.getTime()), requireLoginAlerts: true }
      );
    } catch (err) {
      logger.error('WhatsApp login alert error', { error: errorMessage(err) });
    }
  }

  /** Event B: laporan baru — notifikasi admin. */
  async notifyNewReportAdmin(report: ReportSummary, reporter: ReporterSummary): Promise<void> {
    const priority = report.ai_priority || 'Normal';

    const telegramMessage = telegramService.formatMessage(
      '🔔 LAPORAN FASILITAS BARU',
      [
        { label: 'Nomor', value: report.id },
        { label: 'Judul', value: report.judul },
        { label: 'Kategori', value: report.kategori || '-' },
        { label: 'Lokasi', value: report.lokasi },
        { label: 'Prioritas', value: priority },
        { label: 'Waktu', value: formatWaktu(report.created_at) },
      ],
      'Silakan buka dashboard SIPANTAU CIREBON untuk meninjau laporan.'
    );

    await this.sendAdminTelegram('report-new:' + report.id, telegramMessage);

    if (report.user_id) {
      const personalText = formatPersonalMessage(
      '📢 LAPORAN BERHASIL DIBUAT',
        'Halo ' + reporter.nama + ',',
        [
          { label: 'Nomor laporan', value: report.id },
          { label: 'Judul', value: report.judul },
          { label: 'Kategori', value: report.kategori || '-' },
          { label: 'Lokasi', value: report.lokasi },
          { label: 'Prioritas', value: report.ai_priority || 'Normal' },
          { label: 'Status', value: statusLabel('MENUNGGU_VERIFIKASI') },
        ],
        'Laporan Anda berhasil dikirim ke SIPANTAU CIREBON. Terima kasih telah membantu meningkatkan fasilitas publik.'
      );

      await this.sendPersonalTelegram(
        report.user_id,
        'personal-report-new:' + report.id + ':' + report.user_id,
        personalText,
        report.id
      );
    }

    // WhatsApp (Fonnte) ke admin: laporan baru masuk.
    await this.sendWhatsAppToAdmins(
      'ADMIN_NEW_REPORT',
      this.buildWhatsAppText(
        priority === 'Tinggi' || priority === 'Darurat'
          ? 'LAPORAN PENTING MASUK (PRIORITAS ' + priority.toUpperCase() + ')'
          : 'LAPORAN BARU MASUK',
        null,
        [
          { label: 'Nomor laporan', value: report.id },
          { label: 'Judul', value: report.judul },
          { label: 'Kategori', value: report.kategori || '-' },
          { label: 'Lokasi', value: report.lokasi },
          { label: 'Prioritas', value: priority },
          { label: 'Pelapor', value: reporter.nama },
          { label: 'Waktu', value: formatWaktu(report.created_at) },
        ],
        'Tinjau laporan: ' + config.frontendUrl + '/admin/reports'
      ),
      { reportId: report.id }
    );
  }

  /** Event D: perubahan status laporan. Dilewati bila status tidak berubah. */
  async notifyReportStatusChange(
    userId: string,
    report: ReportSummary,
    oldStatus: string,
    newStatus: string,
    catatan?: string | null,
    userEmail?: string | null,
    userName?: string | null
  ) {
    if (oldStatus === newStatus) {
      logger.debug('Status laporan tidak berubah, notifikasi dilewati', {
        reportId: report.id,
        status: newStatus,
      });
      return null;
    }

    const ol = statusLabel(oldStatus);
    const nl = statusLabel(newStatus);

    const telegramMessage = telegramService.formatMessage(
      '🔄 PERUBAHAN STATUS LAPORAN',
      [
        { label: 'Nomor', value: report.id },
        { label: 'Judul', value: report.judul },
        { label: 'Status lama', value: ol },
        { label: 'Status baru', value: nl },
        { label: 'Catatan', value: catatan || null },
        { label: 'Waktu', value: formatWaktu() },
      ],
      'Silakan buka dashboard SIPANTAU CIREBON untuk meninjau laporan.'
    );

    await this.sendAdminTelegram('report-status:' + report.id + ':' + newStatus, telegramMessage);

    await this.sendPersonalTelegram(
      userId,
      'personal-report-status:' + report.id + ':' + newStatus + ':' + userId,
      buildPersonalStatusMessage(report, userName, newStatus, catatan),
      report.id
    );

    // WhatsApp (Fonnte) ke pelapor: perubahan status penting.
    // Transisi verifikasi (MENUNGGU_VERIFIKASI → DIPROSES/DITOLAK) sudah
    // dikirim oleh notifyLaporanDiverifikasi agar pelapor tidak menerima
    // dua pesan untuk satu aksi yang sama.
    const isVerificationTransition =
      oldStatus === 'MENUNGGU_VERIFIKASI' && (newStatus === 'DIPROSES' || newStatus === 'DITOLAK');

    if (!isVerificationTransition) {
      const statusEvent: FonnteEventKey =
        newStatus === 'DIPROSES'
          ? 'REPORT_PROCESSING'
          : newStatus === 'DALAM_PERBAIKAN'
            ? 'REPORT_IN_PROGRESS'
            : newStatus === 'SELESAI'
              ? 'REPORT_COMPLETED'
              : newStatus === 'DITOLAK'
                ? 'REPORT_REJECTED'
                : 'REPORT_UPDATED';

      await this.sendWhatsAppToUser(
        userId,
        statusEvent,
        this.buildWhatsAppText(
          'PEMBARUAN STATUS LAPORAN',
          userName ? 'Halo ' + userName + ',' : null,
          [
            { label: 'Nama', value: userName },
            { label: 'Nomor laporan', value: report.id },
            { label: 'Judul', value: report.judul },
            { label: 'Kategori', value: report.kategori },
            { label: 'Status lama', value: ol },
            { label: 'Status baru', value: nl },
            { label: 'Keterangan', value: catatan ?? null },
          ],
          'Cek detail: ' + config.frontendUrl + '/reports/history'
        ),
        { reportId: report.id, keySuffix: newStatus, requireReportUpdates: true }
      );
    }

    return this.createNotification({
      userId,
      reportId: report.id,
      type: this.getNotificationTypeForStatus(newStatus),
      judul: 'Status Laporan Berubah: ' + nl,
      pesan:
        'Status laporan "' +
        report.judul +
        '" di ' +
        report.lokasi +
        ' telah berubah dari *' +
        ol +
        '* menjadi *' +
        nl +
        '*.' +
        (catatan ? ' Catatan: "' + catatan + '"' : ''),
      metadata: {
        reportTitle: report.judul,
        reportLocation: report.lokasi,
        reportStatus: newStatus,
        oldStatus,
        catatan: catatan ?? undefined,
      },
      recipientEmail: userEmail,
      recipientName: userName,
      actionUrl: config.frontendUrl + '/dashboard',
      actionText: 'Lihat Detail',
    });
  }

  getNotificationTypeForStatus(status: string): NotificationType {
    switch (status) {
      case NotificationType.LAPORAN_DITERIMA:
        return NotificationType.LAPORAN_DITERIMA;
      case NotificationType.LAPORAN_DIVERIFIKASI:
        return NotificationType.LAPORAN_DIVERIFIKASI;
      case NotificationType.LAPORAN_DIPROSES:
        return NotificationType.LAPORAN_DIPROSES;
      case NotificationType.LAPORAN_DALAM_PERBAIKAN:
        return NotificationType.LAPORAN_DALAM_PERBAIKAN;
      case NotificationType.LAPORAN_SELESAI:
        return NotificationType.LAPORAN_SELESAI;
      default:
        return NotificationType.SISTEM;
    }
  }

  /**
   * Notifikasi WhatsApp ke admin saat laporan selesai.
   * Telegram untuk event ini sudah dikirim oleh `notifyLaporanSelesai`
   * (satu pesan per laporan, tanpa duplikasi).
   */
  async notifyReportSolvedAdmin(
    report: ReportSummary,
    reporter: ReporterSummary,
    petugas: { nama: string },
    catatan?: string | null
  ): Promise<void> {
    // WhatsApp (Fonnte) ke admin: laporan selesai ditangani.
    await this.sendWhatsAppToAdmins(
      'ADMIN_REPORT_COMPLETED',
      this.buildWhatsAppText(
        'LAPORAN TELAH SELESAI DITANGANI',
        null,
        [
          { label: 'Nomor laporan', value: report.id },
          { label: 'Judul', value: report.judul },
          { label: 'Kategori', value: report.kategori || '-' },
          { label: 'Lokasi', value: report.lokasi },
          { label: 'Pelapor', value: reporter.nama },
          { label: 'Petugas', value: petugas.nama },
          { label: 'Catatan', value: catatan ?? null },
          { label: 'Waktu', value: formatWaktu() },
        ],
        'Tinjau laporan: ' + config.frontendUrl + '/admin/reports'
      ),
      { reportId: report.id }
    );
  }

  /**
   * Notifikasi ke petugas: penugasan dibatalkan.
   */
  async notifyTugasDibatalkan(
    petugasId: string,
    report: ReportSummary,
    petugasEmail?: string | null,
    petugasName?: string | null
  ): Promise<void> {
    await this.sendWhatsAppToUser(
      petugasId,
      'OFFICER_ASSIGNMENT_CANCELLED',
      this.buildWhatsAppText(
        'PENUGASAN TUGAS DIBATALKAN',
        petugasName ? 'Halo ' + petugasName + ',' : null,
        [
          { label: 'Nama petugas', value: petugasName },
          { label: 'Nomor laporan', value: report.id },
          { label: 'Judul', value: report.judul },
          { label: 'Kategori', value: report.kategori },
          { label: 'Lokasi', value: report.lokasi },
          { label: 'Keterangan', value: 'Penugasan laporan ini telah dibatalkan oleh Admin' },
        ],
        'Daftar tugas Anda: ' + config.frontendUrl + '/officer/tasks'
      ),
      { reportId: report.id, keySuffix: 'cancelled' }
    );

    await this.createNotification({
      userId: petugasId,
      reportId: report.id,
      type: NotificationType.SISTEM,
      judul: 'Penugasan Tugas Dibatalkan',
      pesan:
        'Penugasan Anda untuk laporan "' +
        report.judul +
        '" telah dibatalkan oleh administrator.',
      metadata: {
        reportTitle: report.judul,
        reportLocation: report.lokasi,
        reportStatus: report.status ?? undefined,
      },
      recipientEmail: petugasEmail,
      recipientName: petugasName,
      actionUrl: config.frontendUrl + '/officer/tasks',
      actionText: 'Lihat Tugas Saya',
    });
  }

  /**
   * Notifikasi ke petugas: penugasan laporan berubah (pindah petugas).
   */
  async notifyPenugasanBerubah(
    petugasId: string,
    report: ReportSummary,
    keterangan: string,
    petugasEmail?: string | null,
    petugasName?: string | null
  ): Promise<void> {
    await this.sendWhatsAppToUser(
      petugasId,
      'OFFICER_ASSIGNMENT_CHANGED',
      this.buildWhatsAppText(
        'PERUBAHAN PENUGASAN TUGAS',
        petugasName ? 'Halo ' + petugasName + ',' : null,
        [
          { label: 'Nama petugas', value: petugasName },
          { label: 'Nomor laporan', value: report.id },
          { label: 'Judul', value: report.judul },
          { label: 'Kategori', value: report.kategori },
          { label: 'Lokasi', value: report.lokasi },
          { label: 'Keterangan penugasan', value: keterangan },
        ],
        'Buka detail tugas: ' + config.frontendUrl + '/officer/tasks'
      ),
      { reportId: report.id, keySuffix: 'changed' }
    );

    await this.createNotification({
      userId: petugasId,
      reportId: report.id,
      type: NotificationType.SISTEM,
      judul: 'Perubahan Penugasan Tugas',
      pesan:
        'Penugasan Anda untuk laporan "' + report.judul + '" telah diperbarui. ' + keterangan,
      metadata: {
        reportTitle: report.judul,
        reportLocation: report.lokasi,
        reportStatus: report.status ?? undefined,
      },
      recipientEmail: petugasEmail,
      recipientName: petugasName,
      actionUrl: config.frontendUrl + '/officer/tasks',
      actionText: 'Lihat Tugas Saya',
    });
  }
}

export const notificationService = new NotificationService();
