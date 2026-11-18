/**
 * Atur webhook Telegram secara aman.
 *
 * Pemakaian:
 *   npm run telegram:webhook -- --url https://domain-anda.com
 *   npm run telegram:webhook -- --info
 *   npm run telegram:webhook -- --delete
 *
 * URL harus HTTPS dan dapat diakses publik oleh Telegram. Token dan secret
 * tidak pernah dicetak ke output.
 */
import { config } from '../src/config';

const token = config.telegram.botToken;
const secret = config.telegram.webhookSecret;

interface TelegramApiResult {
  ok?: boolean;
  description?: string;
  result?: {
    url?: string;
    pending_update_count?: number;
    last_error_message?: string;
    last_error_date?: number;
  };
}

function fail(message: string): never {
  console.error('❌ ' + message);
  process.exit(1);
}

async function callApi(method: string, payload?: Record<string, unknown>): Promise<TelegramApiResult> {
  if (!token) fail('TELEGRAM_BOT_TOKEN belum diisi di backend/.env');

  const response = await fetch('https://api.telegram.org/bot' + token + '/' + method, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload ?? {}),
  });

  const raw = await response.text();
  let data: TelegramApiResult = {};
  try {
    data = raw ? (JSON.parse(raw) as TelegramApiResult) : {};
  } catch {
    fail('Respons Telegram tidak dapat dibaca');
  }

  if (!response.ok || data.ok !== true) {
    fail('Telegram menolak permintaan: ' + (data.description || 'HTTP ' + response.status));
  }

  return data;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.includes('--info')) {
    const data = await callApi('getWebhookInfo');
    console.log('URL webhook:', data.result?.url || '(belum diset)');
    console.log('Pending update:', data.result?.pending_update_count ?? 0);
    if (data.result?.last_error_message) {
      console.log('Error terakhir:', data.result.last_error_message);
    }
    return;
  }

  if (args.includes('--delete')) {
    await callApi('deleteWebhook', { drop_pending_updates: true });
    console.log('✅ Webhook Telegram dihapus.');
    return;
  }

  const urlIndex = args.indexOf('--url');
  const publicUrl =
    (urlIndex >= 0 ? args[urlIndex + 1] : undefined) ||
    process.env.TELEGRAM_PUBLIC_URL ||
    '';

  if (!publicUrl) {
    fail('Sertakan --url https://domain-anda.com atau isi TELEGRAM_PUBLIC_URL.');
  }
  if (!publicUrl.startsWith('https://')) {
    fail('URL webhook wajib HTTPS.');
  }
  if (!secret) {
    fail('TELEGRAM_WEBHOOK_SECRET belum diisi. Buat secret acak terlebih dahulu.');
  }

  const webhookUrl = publicUrl.replace(/\/+$/, '') + '/api/telegram/webhook';

  await callApi('setWebhook', {
    url: webhookUrl,
    secret_token: secret,
    allowed_updates: ['message'],
    drop_pending_updates: true,
  });

  console.log('✅ Webhook Telegram berhasil diset:');
  console.log('   ' + webhookUrl);
  console.log('   Secret diverifikasi oleh backend (tidak ditampilkan).');
}

main().catch((err: unknown) => {
  console.error('Terjadi kesalahan:', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
