/**
 * Verifikasi NYATA fitur Kelola Pengguna terhadap database sungguhan.
 *
 * - Memakai akun admin Abril Pasya Pratama (identitas diambil dari DB) namun
 *   TIDAK mengubah data admin tersebut.
 * - Membuat akun uji sementara (masyarakat/petugas/admin) lalu MENGHAPUS
 *   seluruh data uji di blok finally.
 * - Memastikan laporan/notifikasi/percakapan milik akun uji tidak menghilang
 *   saat akun dinonaktifkan (soft delete).
 *
 * Jalankan: npx ts-node scripts/verify-user-management.ts
 */
import bcrypt from 'bcryptjs';
import request from 'supertest';
import app from '../src/index';
import prisma from '../src/utils/db';
import { generateToken } from '../src/utils/jwt';

const ADMIN_EMAIL = process.env.ADMIN_LOGIN_EMAIL || 'abrilpasyapratama@gmail.com';
const STAMP = Date.now();
const PASSWORD = 'UjiUser2026A';

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

async function makeUser(
  tag: string,
  role: 'masyarakat' | 'petugas' | 'admin',
  extra: Record<string, unknown> = {}
) {
  const email = `verify.um.${STAMP}.${tag}@example.com`;
  const user = await prisma.users.create({
    data: {
      nama: `Uji ${tag}`,
      email,
      password: await bcrypt.hash(PASSWORD, 10),
      role,
      status: 'AKTIF',
      ...extra,
    },
    select: { id: true, email: true, password: true },
  });
  createdUserIds.push(user.id);
  return user;
}

async function cleanup(): Promise<void> {
  if (createdUserIds.length === 0) return;

  const convos = await prisma.conversations.findMany({
    where: { user_id: { in: createdUserIds } },
    select: { id: true },
  });
  await prisma.chat_messages.deleteMany({
    where: { conversation_id: { in: convos.map((c) => c.id) } },
  });
  await prisma.chat_analytics.deleteMany({ where: { user_id: { in: createdUserIds } } });
  await prisma.conversations.deleteMany({ where: { user_id: { in: createdUserIds } } });
  await prisma.notifications.deleteMany({ where: { user_id: { in: createdUserIds } } });
  await prisma.assignments.deleteMany({ where: { petugas_id: { in: createdUserIds } } });
  await prisma.report_updates.deleteMany({ where: { petugas_id: { in: createdUserIds } } });
  await prisma.reports.deleteMany({ where: { user_id: { in: createdUserIds } } });
  await prisma.user_whatsapp_preferences.deleteMany({ where: { user_id: { in: createdUserIds } } });
  await prisma.telegram_link_codes.deleteMany({ where: { user_id: { in: createdUserIds } } });
  await prisma.telegram_message_logs.deleteMany({ where: { user_id: { in: createdUserIds } } });
  await prisma.users.deleteMany({ where: { id: { in: createdUserIds } } });
  console.log(`\n[cleanup] ${createdUserIds.length} akun uji + seluruh data turunannya dihapus.`);
}

async function main(): Promise<void> {
  const admin = await prisma.users.findUnique({ where: { email: ADMIN_EMAIL } });
  if (!admin) {
    console.error('Akun admin utama tidak ditemukan: ' + ADMIN_EMAIL);
    process.exit(1);
  }

  const baseline = {
    admin: {
      nama: admin.nama,
      email: admin.email,
      no_hp: admin.no_hp,
      username: admin.username,
      role: admin.role,
      status: admin.status,
      password: admin.password,
    },
    users: await prisma.users.count(),
    reports: await prisma.reports.count(),
    notifications: await prisma.notifications.count(),
    conversations: await prisma.conversations.count(),
    reportUpdates: await prisma.report_updates.count(),
    assignments: await prisma.assignments.count(),
  };

  const token = generateToken({ userId: admin.id, role: admin.role });
  const auth = { Authorization: `Bearer ${token}` };

  console.log('='.repeat(74));
  console.log('VERIFIKASI KELOLA PENGGUNA — admin:', admin.nama, '(' + admin.email + ')');
  console.log('='.repeat(74));

  // ---------- Siapkan akun uji ----------
  const warga = await makeUser('warga', 'masyarakat', {
    username: `verify.${STAMP}`,
    no_hp: '081200000001',
    no_hp_normalized: '6281200000001',
  });
  const pemilikLaporan = await makeUser('pelapor', 'masyarakat', {
    no_hp: '081200000002',
    no_hp_normalized: '6281200000002',
  });
  const tanpaRelasi = await makeUser('tanparelasi', 'masyarakat');
  const adminUji = await makeUser('admin', 'admin', {
    no_hp: '081200000003',
    no_hp_normalized: '6281200000003',
  });

  const report = await prisma.reports.create({
    data: {
      user_id: pemilikLaporan.id,
      judul: 'Laporan uji fitur kelola pengguna',
      deskripsi: 'Data uji sementara, akan dibersihkan otomatis.',
      kategori: 'Fasilitas Umum Lainnya',
      lokasi: 'Cirebon',
      latitude: -6.7,
      longitude: 108.5,
    },
    select: { id: true },
  });

  // ---------- 1. Daftar & detail ----------
  const list = await request(app).get('/api/admin/users?q=verify.um.' + STAMP).set(auth);
  check(list.status === 200, 'GET /api/admin/users (semua role)', 'HTTP ' + list.status);
  const listed = (list.body.data || []) as Array<Record<string, unknown>>;
  check(listed.some((u) => u.id === warga.id), 'Akun masyarakat tampil di daftar');
  check(listed.some((u) => u.id === adminUji.id), 'Akun admin tampil di daftar');
  check(!JSON.stringify(list.body).toLowerCase().includes('"password"'), 'Daftar tidak mengirim password/hash');

  const detail = await request(app).get('/api/admin/users/' + warga.id).set(auth);
  check(detail.status === 200 && detail.body.data.email === warga.email, 'GET detail pengguna', 'HTTP ' + detail.status);

  // ---------- 2. Edit nama/email/HP/username ----------
  const hashBefore = warga.password;
  const edit = await request(app)
    .patch('/api/admin/users/' + warga.id)
    .set(auth)
    .send({
      nama: 'Nama Setelah Edit',
      email: `verify.um.${STAMP}.baru@example.com`,
      no_hp: '0813-9999-8888',
      username: `verify.baru.${STAMP}`,
    });
  check(edit.status === 200, 'PATCH edit nama/email/HP/username', 'HTTP ' + edit.status);
  check(edit.body.data.nama === 'Nama Setelah Edit', 'Nama baru tersimpan');
  check(edit.body.data.no_hp === '0813-9999-8888', 'Nomor HP tersimpan sesuai input');
  check(!('password' in edit.body.data), 'Respons edit tanpa password/hash');

  const afterEdit = await prisma.users.findUnique({ where: { id: warga.id } });
  check(afterEdit?.id === warga.id, 'ID pengguna tidak berubah');
  check(afterEdit?.password === hashBefore, 'Password TIDAK berubah saat edit profil');
  check(afterEdit?.no_hp_normalized === '6281399998888', 'Nomor HP ternormalisasi di database');

  // ---------- 3. Validasi ----------
  const badPhone = await request(app)
    .patch('/api/admin/users/' + warga.id)
    .set(auth)
    .send({ no_hp: '12345' });
  check(badPhone.status === 400 && /tidak valid/i.test(badPhone.body.message || ''), 'Tolak nomor HP tidak valid', 'HTTP ' + badPhone.status);

  const duplicate = await request(app)
    .patch('/api/admin/users/' + warga.id)
    .set(auth)
    .send({ email: pemilikLaporan.email });
  check(duplicate.status === 409 && /email sudah digunakan/i.test(duplicate.body.message || ''), 'Tolak email duplikat', 'HTTP ' + duplicate.status);

  // ---------- 4. Ubah role ----------
  const role = await request(app)
    .patch('/api/admin/users/' + warga.id)
    .set(auth)
    .send({ role: 'petugas' });
  check(role.status === 200 && role.body.data.role === 'petugas', 'Ubah role masyarakat → petugas', 'HTTP ' + role.status);

  // ---------- 5. Akses non-admin ----------
  const loginWarga = await request(app)
    .post('/api/auth/login')
    .send({ email: pemilikLaporan.email, password: PASSWORD });
  check(loginWarga.status === 200, 'Login akun masyarakat uji', 'HTTP ' + loginWarga.status);
  const wargaToken = loginWarga.body?.data?.token as string;

  const forbiddenList = await request(app)
    .get('/api/admin/users')
    .set('Authorization', `Bearer ${wargaToken}`);
  check(forbiddenList.status === 403, 'Masyarakat ditolak dari endpoint admin', 'HTTP ' + forbiddenList.status);

  // ---------- 6. Hapus akun dengan laporan → soft delete ----------
  const delSoft = await request(app).delete('/api/admin/users/' + pemilikLaporan.id).set(auth);
  check(delSoft.status === 200 && delSoft.body.mode === 'soft_delete', 'Akun dengan laporan → soft delete', 'HTTP ' + delSoft.status);
  const softUser = await prisma.users.findUnique({ where: { id: pemilikLaporan.id } });
  check(softUser?.status === 'NONAKTIF', 'Status akun menjadi NONAKTIF');
  const reportAfterDelete = await prisma.reports.findUnique({ where: { id: report.id } });
  check(Boolean(reportAfterDelete), 'Laporan TETAP ADA setelah akun dinonaktifkan');

  const loginNonaktif = await request(app)
    .post('/api/auth/login')
    .send({ email: pemilikLaporan.email, password: PASSWORD });
  check(
    loginNonaktif.status === 403 && /dinonaktifkan/i.test(loginNonaktif.body.message || ''),
    'Akun NONAKTIF tidak dapat login',
    'HTTP ' + loginNonaktif.status
  );

  // ---------- 7. Hapus akun tanpa relasi → hard delete ----------
  const delHard = await request(app).delete('/api/admin/users/' + tanpaRelasi.id).set(auth);
  check(delHard.status === 200 && delHard.body.mode === 'hard_delete', 'Akun tanpa relasi → hapus permanen', 'HTTP ' + delHard.status);
  const gone = await prisma.users.findUnique({ where: { id: tanpaRelasi.id } });
  check(gone === null, 'Akun tanpa relasi benar-benar terhapus');

  // ---------- 8. Perlindungan akun admin ----------
  const delSelf = await request(app).delete('/api/admin/users/' + admin.id).set(auth);
  check(delSelf.status === 403, 'Admin tidak dapat menghapus akun sendiri', 'HTTP ' + delSelf.status);

  const demoteSelf = await request(app)
    .patch('/api/admin/users/' + admin.id)
    .set(auth)
    .send({ role: 'masyarakat' });
  check(demoteSelf.status === 403, 'Admin tidak dapat menurunkan role sendiri', 'HTTP ' + demoteSelf.status);

  const deactivateSelf = await request(app)
    .patch('/api/admin/users/' + admin.id)
    .set(auth)
    .send({ status: 'NONAKTIF' });
  check(deactivateSelf.status === 403, 'Admin tidak dapat menonaktifkan akun sendiri', 'HTTP ' + deactivateSelf.status);

  const adminStill = await prisma.users.findUnique({ where: { id: admin.id } });
  check(
    adminStill?.role === 'admin' && adminStill?.status === 'AKTIF',
    'Akun admin Abril tetap ADMIN & AKTIF'
  );

  // ---------- 9. Edit profil sendiri + sesi tetap valid ----------
  const adminToken = generateToken({ userId: adminUji.id, role: 'admin' });
  const adminAuth = { Authorization: `Bearer ${adminToken}` };
  const adminHashBefore = adminUji.password;

  const profile = await request(app)
    .patch('/api/auth/profile')
    .set(adminAuth)
    .send({
      nama: 'Administrator Uji Baru',
      email: `verify.um.${STAMP}.adminbaru@example.com`,
      no_hp: '0851-0000-1111',
      username: `verify.admin.${STAMP}`,
    });
  check(profile.status === 200, 'Admin dapat mengedit profil sendiri', 'HTTP ' + profile.status);
  check(profile.body.data.nama === 'Administrator Uji Baru', 'Nama profil sendiri diperbarui');
  check(!('password' in profile.body.data), 'Respons profil tanpa password/hash');

  const me = await request(app).get('/api/auth/me').set(adminAuth);
  check(
    me.status === 200 && me.body.data.email === `verify.um.${STAMP}.adminbaru@example.com`,
    'Token lama tetap valid setelah edit profil (tanpa logout)',
    'HTTP ' + me.status
  );

  const adminAfterProfile = await prisma.users.findUnique({ where: { id: adminUji.id } });
  check(adminAfterProfile?.password === adminHashBefore, 'Password tidak berubah saat edit profil sendiri');

  // ---------- 10. Integritas data akhir ----------
  const adminAfter = await prisma.users.findUnique({ where: { id: admin.id } });
  check(
    JSON.stringify({
      nama: adminAfter?.nama,
      email: adminAfter?.email,
      no_hp: adminAfter?.no_hp,
      username: adminAfter?.username,
      role: adminAfter?.role,
      status: adminAfter?.status,
      password: adminAfter?.password,
    }) === JSON.stringify(baseline.admin),
    'Data admin Abril TIDAK berubah sama sekali'
  );

  await cleanup();
  createdUserIds.length = 0;

  const finalCounts = {
    users: await prisma.users.count(),
    reports: await prisma.reports.count(),
    notifications: await prisma.notifications.count(),
    conversations: await prisma.conversations.count(),
    reportUpdates: await prisma.report_updates.count(),
    assignments: await prisma.assignments.count(),
  };
  check(
    JSON.stringify(finalCounts) ===
      JSON.stringify({
        users: baseline.users,
        reports: baseline.reports,
        notifications: baseline.notifications,
        conversations: baseline.conversations,
        reportUpdates: baseline.reportUpdates,
        assignments: baseline.assignments,
      }),
    'Jumlah data kembali seperti sebelum pengujian',
    JSON.stringify(finalCounts)
  );

  console.log('\n' + '='.repeat(74));
  console.log(`HASIL: ${pass} PASS, ${fail} FAIL`);
  console.log('='.repeat(74));
  if (fail > 0) process.exitCode = 1;
}

main()
  .catch(async (e: Error) => {
    console.error('GAGAL:', e.message);
    try {
      await cleanup();
    } catch (cleanupError) {
      console.error('Cleanup gagal:', cleanupError);
    }
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
