/**
 * Uji pengiriman nyata ke Fonnte (API sungguhan) ke nomor admin.
 *
 * - Tidak pernah mencetak/menulis token Fonnte.
 * - Hanya mengirim SATU pesan uji ke nomor admin yang dikonfigurasi.
 * - Tidak mengubah data pengguna maupun laporan.
 *
 * Jalankan: npx ts-node scripts/test-fonnte-delivery.ts
 */
import prisma from '../src/utils/db';
import { config } from '../src/config';
import { whatsappService } from '../src/services/notification/whatsapp.service';
import { normalizeWhatsAppNumber, isValidWhatsAppNumber } from '../src/utils/phone';

const TARGET = '6285147722749';

async function main(): Promise<void> {
  console.log('='.repeat(72));
  console.log('UJI PENGIRIMAN FONNTE — SIPANTAU CIREBON');
  console.log('='.repeat(72));

  // ---------- 1. Konfigurasi ----------
  const f = config.whatsapp.fonte;
  console.log('1. KONFIGURASI');
  console.log('   FONNTE_ENABLED      :', f.enabled === true ? 'true' : 'false');
  console.log('   token terbaca       :', Boolean(f.apiToken) ? 'ya (nilai tidak ditampilkan)' : 'TIDAK');
  console.log('   api url             :', f.apiUrl);
  console.log('   service enabled     :', whatsappService.enabled);
  console.log('   status reason       :', whatsappService.status().reason);

  // ---------- 2. Validasi nomor admin ----------
  console.log('\n2. VALIDASI NOMOR ADMIN');
  const recipients = f.adminRecipients || [];
  console.log('   FONNTE_ADMIN_RECIPIENTS :', JSON.stringify(recipients));
  const normalized = normalizeWhatsAppNumber(TARGET);
  console.log('   target                 :', TARGET);
  console.log('   valid (format RI)      :', isValidWhatsAppNumber(TARGET));
  console.log('   normalisasi            :', normalized ?? '(gagal)');
  console.log('   terdaftar di config    :', recipients.map(normalizeWhatsAppNumber).includes(normalized));

  if (!f.apiToken) {
    console.log('\nHASIL: GAGAL — FONNTE_TOKEN belum diisi. Tidak ada pesan yang dikirim.');
    return;
  }
  if (!normalized) {
    console.log('\nHASIL: GAGAL — nomor admin tidak valid. Tidak ada pesan yang dikirim.');
    return;
  }

  // ---------- 3. Uji koneksi (POST /device) ----------
  console.log('\n3. UJI KONEKSI KE API FONNTE (POST /device)');
  const before = await whatsappService.testConnection();
  console.log('   ok           :', before.ok);
  console.log('   device status:', before.deviceStatus ?? '-');
  console.log('   device       :', before.deviceMasked ?? '-');
  console.log('   kuota        :', before.quota ?? '-');
  console.log('   masa aktif   :', before.expiresAt ?? '-');
  console.log('   paket        :', before.packageName ?? '-');
  if (!before.ok) {
    console.log('   alasan gagal :', before.reason ?? '-');
    console.log('\nHASIL: GAGAL — koneksi/token tidak valid. Tidak ada pesan yang dikirim.');
    return;
  }

  // ---------- 4. Kirim SATU pesan uji ----------
  console.log('\n4. MENGIRIM SATU PESAN UJI');
  const text =
    'Tes notifikasi SIPANTAU CIREBON. Pesan ini dikirim dari server untuk memverifikasi integrasi Fonnte. ' +
    new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' }) +
    ' WIB.';

  const result = await whatsappService.sendMessage(
    { to: normalized, type: 'text', text: { body: text } },
    {
      eventType: 'ADMIN_TEST_MESSAGE',
      idempotencyKey: 'wa:ADMIN_TEST_MESSAGE:manual:' + Date.now(),
    }
  );

  console.log('   success          :', result.success);
  console.log('   status           :', result.status);
  console.log('   message id       :', result.messageId ?? '-');
  console.log('   proses antrean   :', result.providerProcess ?? '-');
  if (result.error) console.log('   error            :', result.error);

  // ---------- 5. Riwayat di database ----------
  console.log('\n5. RIWAYAT PENGIRIMAN (whatsapp_message_logs)');
  const log = await prisma.whatsapp_message_logs.findFirst({
    where: { event_type: 'ADMIN_TEST_MESSAGE' },
    orderBy: { created_at: 'desc' },
    select: {
      event_type: true,
      recipient_number: true,
      recipient_masked: true,
      delivery_status: true,
      provider: true,
      provider_process: true,
      provider_message_id: true,
      attempt_count: true,
      last_error: true,
      created_at: true,
      sent_at: true,
    },
  });
  if (log) {
    console.log('   event        :', log.event_type);
    console.log('   penerima     :', log.recipient_masked ?? log.recipient_number, '(masked)');
    console.log('   status       :', log.delivery_status);
    console.log('   provider     :', log.provider);
    console.log('   proses       :', log.provider_process ?? '-');
    console.log('   message id   :', log.provider_message_id ?? '-');
    console.log('   percobaan    :', log.attempt_count);
    console.log('   error        :', log.last_error ?? '-');
    console.log('   waktu        :', log.created_at.toISOString());
  } else {
    console.log('   (tidak ada baris log)');
  }

  // ---------- 6. Sinyal antrean/kuota ----------
  console.log('\n6. SINYAL PENERIMAAN (device quota/messages sebelum vs sesudah)');
  const after = await whatsappService.testConnection();
  console.log('   ok sesudah    :', after.ok);
  console.log('   device status :', after.deviceStatus ?? '-');
  console.log('   kuota         :', after.quota ?? '-');

  // ---------- 7. Tidak ada token bocor ----------
  console.log('\n7. KEAMANAN');
  const token = f.apiToken || '';
  const logText = JSON.stringify(log ?? {});
  console.log('   token ada di log DB     :', token ? logText.includes(token) : 'n/a');
  console.log('   nomor di log DB         :', log ? log.recipient_number : '-');

  console.log('\n' + '='.repeat(72));
  if (result.success) {
    console.log('HASIL: API Fonnte MENERIMA permintaan (status sent / antrean).');
    console.log('      Pesan DIANTREKAN ke device Fonnte. Status "delivered" belum dapat');
    console.log('      dikonfirmasi tanpa webhook status Fonnte — jadi belum diklaim sampai.');
  } else {
    console.log('HASIL: GAGAL — pesan tidak diterima API Fonnte.');
    console.log('      Penyebab:', result.error ?? 'tidak diketahui');
  }
  console.log('='.repeat(72));
}

main()
  .catch((e: Error) => {
    console.error('GAGAL:', e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
