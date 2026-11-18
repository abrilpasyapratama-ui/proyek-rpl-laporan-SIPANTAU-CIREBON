/**
 * Uji manual pengiriman Telegram ke admin.
 *
 * Skrip ini sengaja membuat instance service dengan `enabled: true` agar bisa
 * diuji TANPA mengubah TELEGRAM_ENABLED di .env. Token tetap hanya dibaca dari
 * environment backend dan tidak pernah dicetak ke output.
 *
 * Jalankan: npm run telegram:test
 */
import { config } from '../src/config';
import { TelegramService } from '../src/services/telegram/telegram.service';

async function main(): Promise<void> {
  const service = new TelegramService(
    {
      enabled: true,
      botToken: config.telegram.botToken,
      adminChatId: config.telegram.adminChatId,
    },
    { allowInTest: true }
  );

  const status = service.validateConfig();
  if (!status.ready) {
    console.error('Konfigurasi Telegram belum siap:');
    for (const issue of status.issues) {
      console.error('- ' + issue);
    }
    console.error('\nIsi TELEGRAM_BOT_TOKEN dan TELEGRAM_ADMIN_CHAT_ID di backend/.env.');
    process.exitCode = 1;
    return;
  }

  const text = service.formatMessage(
    '🔔 TES KONEKSI TELEGRAM',
    [
      { label: 'Status', value: 'Bot SIPANTAU CIREBON aktif' },
      { label: 'Waktu', value: new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' }) + ' WIB' },
    ],
    'Jika Anda menerima pesan ini, konfigurasi notifikasi Telegram sudah benar.'
  );

  const result = await service.sendMessage(text, {
    eventKey: 'manual-test:' + Date.now(),
  });

  if (result.success) {
    console.log('✅ Pesan uji berhasil dikirim ke admin (message_id: ' + result.messageId + ').');
    console.log('Setelah ini Anda dapat mengatur TELEGRAM_ENABLED=true di backend/.env.');
    return;
  }

  console.error('❌ Pesan uji gagal dikirim.');
  if (result.skipped) {
    console.error('Alasan: ' + result.skipped);
  } else if (result.error) {
    console.error('Error: ' + result.error);
  }
  console.error('\nPastikan Anda sudah membuka @SIPANTAU_CIREBON_Bot di Telegram dan menekan Start.');
  process.exitCode = 1;
}

main().catch((err: unknown) => {
  console.error('Terjadi kesalahan tak terduga:', err instanceof Error ? err.message : String(err));
  process.exitCode = 1;
});
