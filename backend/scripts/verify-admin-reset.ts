/**
 * Verifikasi hasil penataan ulang akun admin.
 * Semua pengujian memakai HTTP level aplikasi (supertest) terhadap app nyata.
 *
 * Jalankan:
 *   $env:ADMIN_LOGIN_PASSWORD='<password awal admin>'
 *   npx ts-node scripts/verify-admin-reset.ts
 */
import request from 'supertest';
import app from '../src/index';
import prisma from '../src/utils/db';
import { generateToken } from '../src/utils/jwt';

const ADMIN_EMAIL = 'abrilpasyapratama@gmail.com';
const OLD_EMAILS = ['admin@sipantau.id', 'admin123@gmail.com', 'waadmin@example.com'];

let pass = 0;
let fail = 0;

function check(name: string, condition: boolean, detail = ''): void {
  if (condition) {
    pass += 1;
    console.log('  PASS  ' + name + (detail ? ' -> ' + detail : ''));
  } else {
    fail += 1;
    console.log('  FAIL  ' + name + (detail ? ' -> ' + detail : ''));
  }
}

async function main(): Promise<void> {
  const password = process.env.ADMIN_LOGIN_PASSWORD || '';
  if (!password) {
    console.error('ADMIN_LOGIN_PASSWORD wajib diisi untuk verifikasi login.');
    process.exit(1);
  }

  console.log('=== 1. LOGIN AKUN ADMIN BARU ===');
  const login = await request(app).post('/api/auth/login').send({
    email: ADMIN_EMAIL,
    password,
  });
  check('login admin baru berhasil', login.status === 200, 'HTTP ' + login.status);
  check('role akun baru = admin', login.body?.data?.user?.role === 'admin', String(login.body?.data?.user?.role));
  check('email akun baru sesuai', login.body?.data?.user?.email === ADMIN_EMAIL, String(login.body?.data?.user?.email));
  check('nama akun baru sesuai', login.body?.data?.user?.nama === 'Abril Pasya Pratama', String(login.body?.data?.user?.nama));
  check('wajib ganti password aktif', login.body?.data?.user?.must_change_password === true, String(login.body?.data?.user?.must_change_password));
  const token: string = login.body?.data?.token || '';

  console.log('\n=== 2. AKUN ADMIN DI DATABASE ===');
  const admins = await prisma.users.findMany({
    where: { role: 'admin' },
    select: { id: true, nama: true, email: true, no_hp: true, status: true, must_change_password: true },
  });
  check('tepat 1 akun admin', admins.length === 1, 'jumlah=' + admins.length);
  const admin = admins[0];
  check('nama admin', admin?.nama === 'Abril Pasya Pratama', String(admin?.nama));
  check('email admin', admin?.email === ADMIN_EMAIL, String(admin?.email));
  check('nomor HP admin', admin?.no_hp === '085147722749', String(admin?.no_hp));
  check('status admin AKTIF', admin?.status === 'AKTIF', String(admin?.status));
  check('must_change_password = true', admin?.must_change_password === true, String(admin?.must_change_password));

  console.log('\n=== 3. AKUN ADMIN LAMA SUDAH HILANG ===');
  for (const email of OLD_EMAILS) {
    const found = await prisma.users.findUnique({ where: { email } });
    check('akun lama ' + email + ' tidak ada', found === null, found ? 'masih ada' : 'hilang');
  }
  const oldTarget = await prisma.users.findUnique({
    where: { id: '9a2a5643-7fdc-43da-a9f0-69e4a0399666' },
  });
  check('user_id lama masyarakat target dihapus', oldTarget === null);

  console.log('\n=== 4. DASHBOARD & ENDPOINT ADMIN (dengan token admin) ===');
  const adminEndpoints = ['/api/admin/stats', '/api/admin/users', '/api/admin/reports', '/api/admin/petugas', '/api/admin/assignments', '/api/admin/activity'];
  for (const ep of adminEndpoints) {
    const res = await request(app).get(ep).set('Authorization', 'Bearer ' + token);
    check('GET ' + ep + ' -> 200', res.status === 200, 'HTTP ' + res.status);
  }

  const reportsRes = await request(app)
    .get('/api/admin/reports')
    .set('Authorization', 'Bearer ' + token);
  const reportList = Array.isArray(reportsRes.body?.data) ? reportsRes.body.data : reportsRes.body?.data?.reports || [];
  check('daftar laporan masih tersedia', reportList.length >= 9, 'jumlah=' + reportList.length);

  console.log('\n=== 5. PROTEKSI ENDPOINT ADMIN ===');
  const noAuth = await request(app).get('/api/admin/users');
  check('tanpa token -> 401', noAuth.status === 401, 'HTTP ' + noAuth.status);

  const petugas = await prisma.users.findFirst({ where: { role: 'petugas', status: 'AKTIF' } });
  const masyarakat = await prisma.users.findFirst({ where: { role: 'masyarakat', status: 'AKTIF' } });
  if (petugas) {
    const petugasToken = generateToken({ userId: petugas.id, role: 'petugas' });
    const res = await request(app).get('/api/admin/users').set('Authorization', 'Bearer ' + petugasToken);
    check('token petugas ke endpoint admin -> 403', res.status === 403, 'HTTP ' + res.status);
  }
  if (masyarakat) {
    const masyarakatToken = generateToken({ userId: masyarakat.id, role: 'masyarakat' });
    const res = await request(app).get('/api/admin/users').set('Authorization', 'Bearer ' + masyarakatToken);
    check('token masyarakat ke endpoint admin -> 403', res.status === 403, 'HTTP ' + res.status);
    const own = await request(app).get('/api/reports/mystats').set('Authorization', 'Bearer ' + masyarakatToken);
    check('endpoint masyarakat tetap berfungsi -> 200', own.status === 200, 'HTTP ' + own.status);
  }

  console.log('\n=== 6. DATA OPERASIONAL UTUH ===');
  const counts = {
    reports: await prisma.reports.count(),
    reportUpdates: await prisma.report_updates.count(),
    notifications: await prisma.notifications.count(),
    assignments: await prisma.assignments.count(),
    masyarakat: await prisma.users.count({ where: { role: 'masyarakat' } }),
    petugas: await prisma.users.count({ where: { role: 'petugas' } }),
  };
  check('laporan = 9', counts.reports === 9, String(counts.reports));
  check('riwayat status = 3', counts.reportUpdates === 3, String(counts.reportUpdates));
  check('notifikasi = 26', counts.notifications === 26, String(counts.notifications));
  check('penugasan = 1', counts.assignments === 1, String(counts.assignments));
  check('masyarakat = 5 (1 akun diganti admin)', counts.masyarakat === 5, String(counts.masyarakat));
  check('petugas = 2 (tetap utuh)', counts.petugas === 2, String(counts.petugas));

  const orphanRows = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*)::bigint AS count
    FROM "reports" r
    LEFT JOIN "users" u ON u.id = r.user_id
    WHERE u.id IS NULL
  `;
  const orphanReports = Number(orphanRows[0]?.count ?? 0);
  check('tidak ada laporan tanpa pemilik', orphanReports === 0, String(orphanReports));

  console.log('\n=====================================');
  console.log('HASIL: ' + pass + ' PASS, ' + fail + ' FAIL');
  console.log('=====================================');
  process.exitCode = fail === 0 ? 0 : 1;
}

main()
  .catch((e: Error) => {
    console.error('GAGAL: ' + e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
