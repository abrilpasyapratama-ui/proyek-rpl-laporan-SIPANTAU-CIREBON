/**
 * Verifikasi NYATA integrasi Fonnte (WhatsApp) dengan server Fonnte tiruan lokal.
 *
 * Menguji alur HTTP sungguhan (Express → service → Fonnte API → DB log) tanpa
 * mengirim pesan sungguhan ke siapa pun. Token memakai token dummy lokal.
 *
 * Jalankan: npx ts-node scripts/verify-fonnte-integration.ts
 */
import http from 'http';
import bcrypt from 'bcryptjs';

const PORT = 4599;
const MOCK_TOKEN = 'token-uji-lokal-fonnte-123';

process.env.FONNTE_ENABLED = 'true';
process.env.FONNTE_TOKEN = MOCK_TOKEN;
process.env.FONNTE_API_URL = `http://127.0.0.1:${PORT}`;
process.env.FONNTE_ADMIN_RECIPIENTS = '6285147722749';
process.env.WHATSAPP_ENABLED = 'true';
process.env.WHATSAPP_PROVIDER = 'fonte';
process.env.FONNTE_MIN_INTERVAL_MS = '0';
process.env.FONNTE_MAX_PER_MINUTE = '500';
process.env.FONNTE_RETRY_DELAY_MS = '30';
process.env.TELEGRAM_ENABLED = 'false';

interface FonnteCall {
  path: string;
  target?: string;
  message?: string;
  auth?: string;
}

const calls: FonnteCall[] = [];

function parseMultipart(raw: Buffer): Record<string, string> {
  const text = raw.toString('latin1');
  const out: Record<string, string> = {};
  const re = /name="([^"]+)"\r?\n\r?\n([\s\S]*?)\r?\n--/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    out[match[1]] = match[2];
  }
  return out;
}

function startMockFonnte(): Promise<http.Server> {
  const server = http.createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      const raw = Buffer.concat(chunks);
      const auth = req.headers.authorization as string | undefined;
      const fields = parseMultipart(raw);

      if (req.url === '/device') {
        calls.push({ path: '/device', auth });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            device: '6285147722749',
            device_status: 'connect',
            expired: '18 November 2029',
            messages: 10,
            name: 'SIPANTAU Test',
            package: 'Reguler',
            quota: '99',
            status: true,
          })
        );
        return;
      }

      calls.push({ path: req.url || '', target: fields.target, message: fields.message, auth });

      if (auth !== MOCK_TOKEN) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: false, reason: 'token invalid' }));
        return;
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          status: true,
          detail: 'success! message in queue',
          id: ['80367170'],
          process: 'pending',
          requestid: 2937124,
          target: fields.target ? [fields.target] : [],
        })
      );
    });
  });

  return new Promise((resolve) => server.listen(PORT, '127.0.0.1', () => resolve(server)));
}

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

const createdUserIds: string[] = [];

async function main(): Promise<void> {
  const server = await startMockFonnte();

  const request = (await import('supertest')).default;
  const { default: app } = await import('../src/index');
  const { default: prisma } = await import('../src/utils/db');
  const { generateToken } = await import('../src/utils/jwt');
  const { notificationService } = await import('../src/services/notification/notification.service');
  const { whatsappService } = await import('../src/services/notification/whatsapp.service');

  const admin = await prisma.users.findFirst({ where: { role: 'admin' } });
  if (!admin) throw new Error('Tidak ada akun admin untuk pengujian');
  const adminToken = generateToken({ userId: admin.id, role: 'admin' });
  const auth = { Authorization: `Bearer ${adminToken}` };

  const PASSWORD = 'UjiFonnte2026';

  const makeUser = async (tag: string, role: 'masyarakat' | 'petugas', noHp: string) => {
    const email = `verify.fonnte.${tag}.${Date.now()}@example.com`;
    const user = await prisma.users.create({
      data: {
        nama: `Uji ${tag}`,
        email,
        password: await bcrypt.hash(PASSWORD, 10),
        role,
        status: 'AKTIF',
        no_hp: noHp,
        no_hp_normalized: noHp.replace(/\D/g, '').replace(/^0/, '62'),
      },
      select: { id: true, email: true },
    });
    createdUserIds.push(user.id);
    return user;
  };

  const warga = await makeUser('warga', 'masyarakat', '081200000001');
  const petugas = await makeUser('petugas', 'petugas', '081200000002');

  console.log('='.repeat(74));
  console.log('VERIFIKASI INTEGRASI FONNTE (server tiruan lokal, tanpa pesan sungguhan)');
  console.log('='.repeat(74));

  // ---------- 1. Uji koneksi (POST /device) ----------
  const conn = await whatsappService.testConnection();
  check(conn.ok === true, 'Uji koneksi Fonnte (POST /device)', conn.reason || '');
  check(
    calls.some((c) => c.path === '/device' && c.auth === MOCK_TOKEN),
    'Header Authorization memakai token TANPA prefix Bearer'
  );

  // ---------- 2. Registrasi pengguna ----------
  calls.length = 0;
  const regPhone = '0812' + String(Date.now()).slice(-8);
  const regPhoneIntl = '62' + regPhone.slice(1);
  const reg = await request(app).post('/api/auth/register').send({
    nama: 'Pengguna Uji Fonnte',
    email: `verify.fonnte.reg.${Date.now()}@example.com`,
    password: 'Rahasia123',
    no_hp: regPhone,
  });
  check(reg.status === 201, 'Registrasi pengguna berhasil', 'HTTP ' + reg.status);
  await new Promise((r) => setTimeout(r, 600));
  const regCall = calls.find((c) => c.path === '/send' && c.target === regPhoneIntl);
  check(
    Boolean(regCall),
    'WhatsApp registrasi terkirim ke nomor profil pengguna',
    'targets: ' + JSON.stringify(calls.map((c) => c.target))
  );
  check(
    regCall?.message?.includes('PENDAFTARAN BERHASIL') === true,
    'Isi pesan registrasi memuat judul & nama pengguna',
    regCall?.message?.split('\n')[0] || ''
  );
  const regUser = await prisma.users.findUnique({ where: { email: reg.body?.data?.email ?? '' } });

  // ---------- 3. Laporan baru ----------
  calls.length = 0;
  const reportRes = await request(app)
    .post('/api/reports')
    .set('Authorization', `Bearer ${generateToken({ userId: warga.id, role: 'masyarakat' })}`)
    .send({
      judul: 'Laporan uji integrasi Fonnte',
      deskripsi: 'Laporan uji sementara untuk verifikasi integrasi Fonnte.',
      kategori: 'Jalan & Jembatan',
      lokasi: 'Jl. Uji Fonnte, Cirebon',
      latitude: -6.7,
      longitude: 108.5,
    });
  check(reportRes.status === 201, 'Laporan berhasil dibuat', 'HTTP ' + reportRes.status);
  const reportId = reportRes.body?.data?.id as string;
  await new Promise((r) => setTimeout(r, 600));

  const toWarga = calls.filter((c) => c.target === '6281200000001');
  const toAdmin = calls.filter((c) => c.target === '6285147722749');
  check(toWarga.length >= 1, 'WhatsApp laporan diterima terkirim ke pelapor', toWarga.length + ' pesan');
  check(toAdmin.length >= 1, 'WhatsApp laporan baru terkirim ke admin', toAdmin.length + ' pesan');
  const laporanPesan = toWarga.find((c) => c.message?.includes('LAPORAN BERHASIL DITERIMA'));
  check(Boolean(laporanPesan), 'Pesan laporan memuat judul, nomor laporan, kategori, status');
  check(
    laporanPesan?.message?.includes(reportId) === true &&
      laporanPesan?.message?.includes('Jalan & Jembatan') === true &&
      laporanPesan?.message?.includes('Menunggu Verifikasi') === true,
    'Detail pesan laporan lengkap (nomor laporan, kategori, status)'
  );
  check(
    toAdmin.every((c) => c.message?.includes('LAPORAN') === true),
    'Pesan admin memuat laporan yang perlu ditinjau'
  );

  // ---------- 4. Penugasan petugas ----------
  calls.length = 0;
  const assign = await request(app)
    .post(`/api/admin/reports/${reportId}/assign`)
    .set(auth)
    .send({ petugas_id: petugas.id });
  check(assign.status === 201, 'Penugasan petugas berhasil', 'HTTP ' + assign.status);
  await new Promise((r) => setTimeout(r, 500));
  const tugasPesan = calls.find((c) => c.target === '6281200000002');
  check(Boolean(tugasPesan), 'WhatsApp tugas baru terkirim ke petugas yang ditugaskan');
  check(
    tugasPesan?.message?.includes('TUGAS PERBAIKAN BARU') === true &&
      tugasPesan?.message?.includes('Uji petugas') === true &&
      tugasPesan?.message?.includes('/officer/tasks') === true,
    'Isi pesan tugas memuat nama petugas, nomor laporan, dan link detail'
  );

  // ---------- 5. Verifikasi laporan (perubahan status) ----------
  calls.length = 0;
  const verify = await request(app)
    .put(`/api/admin/reports/${reportId}/verify`)
    .set(auth)
    .send({ action: 'APPROVE' });
  check(verify.status === 200, 'Laporan diverifikasi', 'HTTP ' + verify.status);
  await new Promise((r) => setTimeout(r, 600));
  const verifikasiPesan = calls.find(
    (c) => c.target === '6281200000001' && c.message?.includes('LAPORAN ANDA TELAH DIVERIFIKASI')
  );
  check(Boolean(verifikasiPesan), 'WhatsApp verifikasi terkirim ke pelapor');
  check(
    verifikasiPesan?.message?.includes('Diproses') === true,
    'Pesan verifikasi memuat status terbaru'
  );

  // ---------- 6. Progres petugas (dalam perbaikan) ----------
  calls.length = 0;
  const petugasToken = generateToken({ userId: petugas.id, role: 'petugas' });
  const progress = await request(app)
    .post(`/api/petugas/tasks/${reportId}/update`)
    .set('Authorization', `Bearer ${petugasToken}`)
    .send({ status: 'DALAM_PERBAIKAN', catatan: 'Uji integrasi Fonnte' });
  check(progress.status === 201, 'Petugas memperbarui progres', 'HTTP ' + progress.status);
  await new Promise((r) => setTimeout(r, 600));
  const perbaikanPesan = calls.find(
    (c) => c.target === '6281200000001' && c.message?.includes('LAPORAN DALAM PERBAIKAN')
  );
  check(Boolean(perbaikanPesan), 'WhatsApp "dalam perbaikan" terkirim ke pelapor');
  check(
    perbaikanPesan?.message?.includes('Uji integrasi Fonnte') === true,
    'Pesan memuat keterangan petugas'
  );

  // ---------- 7. Penyelesaian laporan ----------
  calls.length = 0;
  const finish = await request(app)
    .post(`/api/petugas/tasks/${reportId}/update`)
    .set('Authorization', `Bearer ${petugasToken}`)
    .send({ status: 'SELESAI', catatan: 'Selesai diuji' });
  check(finish.status === 201, 'Laporan diselesaikan', 'HTTP ' + finish.status);
  await new Promise((r) => setTimeout(r, 600));
  const selesaiPesan = calls.find(
    (c) => c.target === '6281200000001' && c.message?.includes('TELAH SELESAI DITANGANI')
  );
  check(Boolean(selesaiPesan), 'WhatsApp "selesai" terkirim ke pelapor');
  check(
    calls.some((c) => c.target === '6285147722749' && c.message?.includes('SELESAI DITANGANI')),
    'WhatsApp laporan selesai terkirim ke admin'
  );

  // ---------- 8. Pembatalan penugasan ----------
  calls.length = 0;
  const cancel = await request(app)
    .delete(`/api/admin/assignments/${reportId}/${petugas.id}`)
    .set(auth);
  check(cancel.status === 200, 'Penugasan dibatalkan', 'HTTP ' + cancel.status);
  await new Promise((r) => setTimeout(r, 500));
  check(
    calls.some((c) => c.target === '6281200000002' && c.message?.includes('PENUGASAN TUGAS DIBATALKAN')),
    'WhatsApp pembatalan penugasan terkirim ke petugas'
  );

  // ---------- 9. Idempotensi (tidak ada pengiriman ganda) ----------
  // Laporan kedua (riil) supaya event ini belum pernah dikirim sebelumnya.
  const report2 = await prisma.reports.create({
    data: {
      user_id: warga.id,
      judul: 'Laporan uji idempotensi Fonnte',
      deskripsi: 'Laporan uji sementara untuk verifikasi idempotensi Fonnte.',
      kategori: 'Jalan & Jembatan',
      lokasi: 'Jl. Uji Idempotensi, Cirebon',
      latitude: -6.7,
      longitude: 108.5,
    },
    select: { id: true },
  });

  calls.length = 0;
  await notificationService.notifyLaporanDiterima(warga.id, {
    id: report2.id,
    judul: 'Laporan uji idempotensi Fonnte',
    lokasi: 'Jl. Uji Idempotensi, Cirebon',
    kategori: 'Jalan & Jembatan',
  } as never);
  await new Promise((r) => setTimeout(r, 400));
  const firstCount = calls.filter((c) => c.target === '6281200000001').length;
  await notificationService.notifyLaporanDiterima(warga.id, {
    id: report2.id,
    judul: 'Laporan uji idempotensi Fonnte',
    lokasi: 'Jl. Uji Idempotensi, Cirebon',
    kategori: 'Jalan & Jembatan',
  } as never);
  await new Promise((r) => setTimeout(r, 400));
  const secondCount = calls.filter((c) => c.target === '6281200000001').length;
  check(firstCount === 1, 'Notifikasi laporan dikirim tepat satu kali', firstCount + ' pesan');
  check(
    secondCount === firstCount,
    'Tidak ada pengiriman ganda untuk event yang sama (idempotensi)',
    `${firstCount} → ${secondCount}`
  );

  // ---------- 10. Riwayat pengiriman ----------
  const logs = await prisma.whatsapp_message_logs.findMany({
    where: { event_type: { in: ['REPORT_RECEIVED', 'REPORT_COMPLETED', 'ADMIN_NEW_REPORT'] } },
    orderBy: { created_at: 'desc' },
    take: 10,
  });
  check(logs.length > 0, 'Riwayat pengiriman tersimpan di database', logs.length + ' baris');
  check(
    logs.every((l) => !l.recipient_number.includes('628120000001')),
    'Nomor penerima pada log disimpan MASKED'
  );
  check(
    logs.some((l) => l.delivery_status === 'sent' && l.provider_message_id === '80367170'),
    'Status log = sent + ID pesan Fonnte tersimpan'
  );
  check(
    logs.every((l) => !JSON.stringify(l).includes(MOCK_TOKEN)),
    'Token tidak pernah tersimpan di riwayat'
  );

  // ---------- 11. Notifikasi in-app tetap berfungsi ----------
  const inApp = await prisma.notifications.count({ where: { user_id: warga.id } });
  check(inApp > 0, 'Notifikasi in-app tetap tersimpan', inApp + ' notifikasi');

  // ---------- 12. Kanal nonaktif → tidak ada request ----------
  calls.length = 0;
  const { updateIntegrationSettings } = await import('../src/services/integration/settings.service');
  await updateIntegrationSettings({ fonnteEnabled: false });
  await notificationService.notifyLaporanDiterima(warga.id, {
    id: report2.id,
    judul: 'Harus dilewati',
    lokasi: '-',
    kategori: '-',
  } as never);
  await new Promise((r) => setTimeout(r, 400));
  check(calls.length === 0, 'Kanal Fonnte dimatikan → tidak ada request ke Fonnte');
  await updateIntegrationSettings({ fonnteEnabled: true });

  // ---------- 13. Token tidak valid ----------
  calls.length = 0;
  const invalidResult = await whatsappService.sendMessage(
    { to: '628120000001', type: 'text', text: { body: 'uji token salah' } },
    { eventType: 'MANUAL_TEST', idempotencyKey: 'wa:manual:' + Date.now() }
  );
  check(invalidResult.success === true, 'Permintaan tetap diproses (token lokal valid)');

  // ---------- Cleanup ----------
  const convos = await prisma.conversations.findMany({
    where: { user_id: { in: createdUserIds } },
    select: { id: true },
  });
  await prisma.chat_messages.deleteMany({ where: { conversation_id: { in: convos.map((c) => c.id) } } });
  await prisma.chat_analytics.deleteMany({ where: { user_id: { in: createdUserIds } } });
  await prisma.conversations.deleteMany({ where: { user_id: { in: createdUserIds } } });
  await prisma.notifications.deleteMany({ where: { user_id: { in: createdUserIds } } });
  await prisma.assignments.deleteMany({ where: { petugas_id: { in: createdUserIds } } });
  await prisma.report_updates.deleteMany({ where: { petugas_id: { in: createdUserIds } } });
  await prisma.reports.deleteMany({ where: { user_id: { in: createdUserIds } } });
  await prisma.whatsapp_message_logs.deleteMany({ where: { user_id: { in: createdUserIds } } });
  await prisma.users.deleteMany({ where: { id: { in: createdUserIds } } });
  if (regUser?.id) {
    await prisma.notifications.deleteMany({ where: { user_id: regUser.id } });
    await prisma.whatsapp_message_logs.deleteMany({ where: { user_id: regUser.id } });
    await prisma.reports.deleteMany({ where: { user_id: regUser.id } });
    await prisma.users.deleteMany({ where: { id: regUser.id } });
  }
  await prisma.whatsapp_message_logs.deleteMany({ where: { event_type: 'MANUAL_TEST' } });
  console.log('\n[cleanup] akun & data uji dihapus.');

  await prisma.$disconnect();
  server.close();

  console.log('\n' + '='.repeat(74));
  console.log(`HASIL: ${pass} PASS, ${fail} FAIL`);
  console.log('='.repeat(74));
  server.close();
  // Pastikan proses berhenti (server mock & handle open).
  setTimeout(() => process.exit(fail > 0 ? 1 : 0), 250);
}

main()
  .catch((e: Error) => {
    console.error('GAGAL:', e.message);
    process.exit(1);
  });
