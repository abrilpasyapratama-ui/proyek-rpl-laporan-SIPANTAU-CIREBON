/**
 * Verifikasi nyata fitur "Konfigurasi Integrasi" (WhatsApp Fonnte + AI Chatbot).
 *
 * - Token/API key TIDAK pernah dicetak.
 * - Tidak menghapus data pengguna/laporan.
 * - Percakapan uji chatbot DIBERSIHKAN setelah verifikasi.
 */
import request from 'supertest';
import app from '../src/index';
import prisma from '../src/utils/db';
import { generateToken } from '../src/utils/jwt';
import { config } from '../src/config';
import { decryptSecret } from '../src/services/integration/secret.service';

let pass = 0;
let fail = 0;
const check = (ok: boolean, label: string, detail = '') => {
  if (ok) {
    pass += 1;
    console.log(`PASS  ${label}${detail ? ' — ' + detail : ''}`);
  } else {
    fail += 1;
    console.log(`FAIL  ${label}${detail ? ' — ' + detail : ''}`);
  }
};

async function main(): Promise<void> {
  const admin = await prisma.users.findFirst({ where: { role: 'admin' } });
  if (!admin) throw new Error('Akun admin tidak ditemukan');

  const token = generateToken({ userId: admin.id, role: admin.role });
  const auth = { Authorization: `Bearer ${token}` };

  const before = {
    users: await prisma.users.count(),
    reports: await prisma.reports.count(),
    notifications: await prisma.notifications.count(),
    conversations: await prisma.conversations.count(),
    chatMessages: await prisma.chat_messages.count(),
  };

  console.log('='.repeat(74));
  console.log('VERIFIKASI KONFIGURASI INTEGRASI (WhatsApp Fonnte + AI Chatbot)');
  console.log('='.repeat(74));

  // ---------- 1. Status awal ----------
  const waStatus0 = await request(app).get('/api/admin/integrations/whatsapp/status').set(auth);
  const aiStatus0 = await request(app).get('/api/admin/integrations/ai/status').set(auth);
  check(waStatus0.status === 200, 'GET status WhatsApp (admin)', 'HTTP ' + waStatus0.status);
  check(aiStatus0.status === 200, 'GET status AI (admin)', 'HTTP ' + aiStatus0.status);
  check(
    waStatus0.body.data.tokenSource === 'env',
    'Fallback environment masih dipakai sebelum admin menyimpan token',
    'sumber: ' + waStatus0.body.data.tokenSource
  );
  check(
    aiStatus0.body.data.apiKeySource === 'env',
    'AI memakai fallback environment',
    'sumber: ' + aiStatus0.body.data.apiKeySource
  );

  // ---------- 2. Simpan token Fonnte via API (seperti admin) ----------
  const envToken = config.whatsapp.fonte.apiToken;
  const saveWa = await request(app)
    .patch('/api/admin/integrations/whatsapp/settings')
    .set(auth)
    .send({ token: envToken, enabled: true });

  check(saveWa.status === 200, 'Simpan konfigurasi Fonnte', 'HTTP ' + saveWa.status);
  check(!JSON.stringify(saveWa.body).includes(envToken), 'Token tidak muncul di response API');

  const row = await prisma.integration_settings.findUnique({ where: { key: 'fonnte_token' } });
  const stored = row?.value ?? '';
  check(Boolean(stored), 'Token tersimpan di database');
  check(!stored.includes(envToken), 'Token tersimpan terenkripsi (bukan plaintext)');
  check(decryptSecret(stored) === envToken, 'Token dapat didekripsi kembali dengan kunci server');

  const waStatus1 = await request(app).get('/api/admin/integrations/whatsapp/status').set(auth);
  check(waStatus1.body.data.tokenSource === 'database', 'Konfigurasi database kini jadi prioritas');
  check(waStatus1.body.data.ready === true, 'Gateway siap dipakai', waStatus1.body.data.reason);

  // ---------- 3. Uji koneksi Fonnte (nyata) ----------
  const conn = await request(app).post('/api/admin/integrations/whatsapp/test-connection').set(auth);
  check(conn.body.data?.ok === true, 'Uji koneksi Fonnte', conn.body.message);
  check(
    conn.body.data?.deviceMasked === '6285****2749',
    'Device Fonnte = nomor admin',
    conn.body.data?.deviceMasked || '-'
  );

  // ---------- 4. Kirim satu pesan percobaan ----------
  const sent = await request(app)
    .post('/api/admin/integrations/whatsapp/test-message')
    .set(auth)
    .send({ message: 'Tes Konfigurasi Integrasi SIPANTAU CIREBON.' });
  check(sent.body.data?.[0]?.success === true, 'Pesan percobaan diterima Fonnte', sent.body.message);

  const waLog = await prisma.whatsapp_message_logs.findFirst({
    where: { event_type: 'ADMIN_TEST_MESSAGE' },
    orderBy: { created_at: 'desc' },
  });
  check(waLog?.delivery_status === 'sent', 'Riwayat pengiriman tercatat (status sent)');
  check(
    Boolean(waLog?.recipient_number) && !waLog!.recipient_number.includes('6285147722749'),
    'Nomor penerima pada log tersimpan masked'
  );

  // ---------- 5. AI: status, simpan model, uji koneksi ----------
  const saveAi = await request(app)
    .patch('/api/admin/integrations/ai/settings')
    .set(auth)
    .send({ provider: 'openrouter', model: 'openai/gpt-4o-mini', temperature: 0.3, maxTokens: 800 });
  check(saveAi.status === 200, 'Simpan konfigurasi AI', 'HTTP ' + saveAi.status);
  check(!JSON.stringify(saveAi.body).includes(config.ai.apiKey), 'API key tidak muncul di response API');

  const aiStatus1 = await request(app).get('/api/admin/integrations/ai/status').set(auth);
  check(aiStatus1.body.data.apiKeyConfigured === true, 'Status API key: terkonfigurasi');
  check(aiStatus1.body.data.model === 'openai/gpt-4o-mini', 'Model tersimpan', aiStatus1.body.data.model);

  const aiConn = await request(app).post('/api/admin/integrations/ai/test-connection').set(auth);
  check(aiConn.body.data?.ok === true, 'Uji koneksi penyedia AI', aiConn.body.message);
  check(
    aiConn.body.data?.modelAvailable === true,
    'Model terkonfirmasi tersedia di provider',
    'model: ' + (aiConn.body.data?.model || '-')
  );

  // ---------- 6. Uji chatbot (tanpa riwayat palsu) ----------
  const chatsBefore = await prisma.conversations.count();
  const msgsBefore = await prisma.chat_messages.count();
  const analyticsBefore = await prisma.chat_analytics.count();

  const chatTest = await request(app)
    .post('/api/admin/integrations/ai/test-chat')
    .set(auth)
    .send({ message: 'Sebutkan 1 kalimat apa itu SIPANTAU CIREBON.' });

  check(chatTest.body.data?.reply?.length > 0, 'Chatbot menjawab', chatTest.body.data?.reply?.slice(0, 80));
  check(
    typeof chatTest.body.data?.responseTimeMs === 'number',
    'Waktu respons dilaporkan',
    chatTest.body.data?.responseTimeMs + ' ms'
  );
  check(
    (await prisma.conversations.count()) === chatsBefore &&
      (await prisma.chat_messages.count()) === msgsBefore &&
      (await prisma.chat_analytics.count()) === analyticsBefore,
    'Uji chatbot tidak membuat riwayat percakapan/pesan/analitik'
  );

  // ---------- 7. Chatbot normal (dengan riwayat) ----------
  const chat = await request(app)
    .post('/api/chat')
    .set(auth)
    .send({ message: 'Siapa saya?' });

  check(chat.status === 200 && Boolean(chat.body.data?.reply), 'Chatbot normal masih berfungsi', chat.body.data?.reply?.slice(0, 60));
  const newConversationId = chat.body?.data?.conversation_id as string;
  const chatMessagesAfter = await prisma.chat_messages.count();
  check(chatMessagesAfter > msgsBefore, 'Riwayat percakapan tetap tersimpan');

  // Bersihkan percakapan uji (hanya milik admin & baru dibuat).
  if (newConversationId) {
    await prisma.chat_messages.deleteMany({ where: { conversation_id: newConversationId } });
    await prisma.chat_analytics.deleteMany({ where: { conversation_id: newConversationId } });
    await prisma.conversations.deleteMany({ where: { id: newConversationId } });
  }

  // ---------- 8. Riwayat audit konfigurasi ----------
  const history = await prisma.integration_config_history.findMany({
    orderBy: { created_at: 'desc' },
    take: 5,
  });
  check(history.length > 0, 'Riwayat perubahan konfigurasi tercatat', history.length + ' baris');
  const historyDump = JSON.stringify(history);
  check(!historyDump.includes(envToken), 'Audit log tidak menyimpan token');
  check(!historyDump.includes(config.ai.apiKey), 'Audit log tidak menyimpan API key');

  // ---------- 9. Akses non-admin ----------
  const masyarakat = await prisma.users.findFirst({ where: { role: 'masyarakat' } });
  if (masyarakat) {
    const t = generateToken({ userId: masyarakat.id, role: 'masyarakat' });
    const res = await request(app)
      .get('/api/admin/integrations/whatsapp/status')
      .set('Authorization', `Bearer ${t}`);
    check(res.status === 403, 'Masyarakat ditolak dari endpoint integrasi', 'HTTP ' + res.status);
  }

  // ---------- 10. Data pengguna & laporan utuh ----------
  const after = {
    users: await prisma.users.count(),
    reports: await prisma.reports.count(),
    notifications: await prisma.notifications.count(),
    conversations: await prisma.conversations.count(),
    chatMessages: await prisma.chat_messages.count(),
  };
  check(
    after.users === before.users && after.reports === before.reports && after.notifications === before.notifications,
    'Data pengguna, laporan, dan notifikasi tidak berubah',
    JSON.stringify(after)
  );
  check(
    after.conversations === before.conversations && after.chatMessages === before.chatMessages,
    'Riwayat percakapan kembali seperti semula (percakapan uji dibersihkan)'
  );

  console.log('\n' + '='.repeat(74));
  console.log(`HASIL: ${pass} PASS, ${fail} FAIL`);
  console.log('='.repeat(74));
  if (fail > 0) process.exitCode = 1;
}

main()
  .catch((e: Error) => {
    console.error('GAGAL:', e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
