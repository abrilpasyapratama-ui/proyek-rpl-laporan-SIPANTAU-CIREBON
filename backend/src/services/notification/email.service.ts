import nodemailer, { Transporter } from 'nodemailer';

interface EmailPayload {
  to: string;
  recipientName: string;
  subject: string;
  headline: string;
  content: string;
  reportTitle?: string;
  reportLocation?: string;
  reportStatus?: string;
  actionUrl?: string;
  actionText?: string;
}

class EmailService {
  private transporter: Transporter | null = null;
  private isConfigured: boolean = false;

  constructor() {
    this.initTransporter();
  }

  private initTransporter() {
    const host = process.env.SMTP_HOST;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    const port = parseInt(process.env.SMTP_PORT || '587');
    const secure = process.env.SMTP_SECURE === 'true';

    if (host && user && pass) {
      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure,
        auth: { user, pass }
      });
      this.isConfigured = true;
    } else {
      // In development or when SMTP is not configured, we run in simulated log mode
      this.isConfigured = false;
    }
  }

  /**
   * Mengirim email dengan template HTML responsif & elegan.
   * Didesain non-blocking agar tidak mengganggu respon HTTP utama.
   */
  async sendNotificationEmail(payload: EmailPayload): Promise<boolean> {
    try {
      const from = process.env.SMTP_FROM || 'Sistem Pelaporan Fasilitas <no-reply@laporanfasilitas.id>';
      const appUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      const actionUrl = payload.actionUrl || appUrl;
      const actionText = payload.actionText || 'Lihat Detail di Aplikasi';

      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #1e293b; }
            .container { max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }
            .header { background: linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%); padding: 32px 28px; text-align: center; color: #ffffff; }
            .header h1 { margin: 0; font-size: 22px; font-weight: 800; letter-spacing: -0.5px; }
            .header p { margin: 6px 0 0 0; font-size: 13px; opacity: 0.9; }
            .content { padding: 32px 28px; }
            .greeting { font-size: 15px; font-weight: 600; color: #0f172a; margin-bottom: 12px; }
            .headline { font-size: 18px; font-weight: 700; color: #1e40af; margin-bottom: 16px; }
            .card { background-color: #f1f5f9; border-radius: 12px; padding: 18px; margin: 20px 0; border-left: 4px solid #3b82f6; }
            .card-item { margin-bottom: 8px; font-size: 13px; }
            .card-item:last-child { margin-bottom: 0; }
            .card-label { font-weight: 600; color: #475569; }
            .card-value { color: #0f172a; }
            .button { display: inline-block; background-color: #2563eb; color: #ffffff !important; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-weight: 600; font-size: 14px; margin-top: 16px; }
            .footer { background: #f8fafc; padding: 20px 28px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🏛️ Sistem Pelaporan Fasilitas</h1>
              <p>Pusat Notifikasi & Pemantauan Fasilitas Publik</p>
            </div>
            <div class="content">
              <div class="greeting">Halo, ${payload.recipientName}</div>
              <div class="headline">${payload.headline}</div>
              <p style="font-size: 14px; line-height: 1.6; color: #334155;">
                ${payload.content}
              </p>

              ${
                payload.reportTitle
                  ? `
                <div class="card">
                  <div class="card-item"><span class="card-label">Judul Laporan:</span> <span class="card-value font-semibold">${payload.reportTitle}</span></div>
                  ${payload.reportLocation ? `<div class="card-item"><span class="card-label">Lokasi:</span> <span class="card-value">${payload.reportLocation}</span></div>` : ''}
                  ${payload.reportStatus ? `<div class="card-item"><span class="card-label">Status Terkini:</span> <span class="card-value" style="color:#2563eb;font-weight:bold;">${payload.reportStatus}</span></div>` : ''}
                </div>
              `
                  : ''
              }

              <div style="text-align: center; margin-top: 24px;">
                <a href="${actionUrl}" class="button" target="_blank">${actionText}</a>
              </div>
            </div>
            <div class="footer">
              <p style="margin: 0;">Email ini dikirim secara otomatis oleh Sistem Pelaporan Fasilitas.</p>
              <p style="margin: 4px 0 0 0;">Mohon untuk tidak membalas email ini.</p>
            </div>
          </div>
        </body>
        </html>
      `;

      if (this.isConfigured && this.transporter) {
        await this.transporter.sendMail({
          from,
          to: payload.to,
          subject: payload.subject,
          html
        });
        console.log(`[EmailService] Email sent successfully to ${payload.to} with subject: "${payload.subject}"`);
      } else {
        // Mode Simulasi / Development Logging
        console.log(`\n======================================================`);
        console.log(`📧 [EMAIL NOTIFICATION SIMULATION]`);
        console.log(`To: ${payload.to} (${payload.recipientName})`);
        console.log(`Subject: ${payload.subject}`);
        console.log(`Headline: ${payload.headline}`);
        console.log(`Content: ${payload.content}`);
        if (payload.reportTitle) console.log(`Report: "${payload.reportTitle}"`);
        console.log(`Action Link: ${actionUrl}`);
        console.log(`======================================================\n`);
      }

      return true;
    } catch (error) {
      console.error('[EmailService] Gagal mengirim email notifikasi:', error);
      return false; // Jangan lempar exception agar flow utama tetap sukses
    }
  }
}

export const emailService = new EmailService();
