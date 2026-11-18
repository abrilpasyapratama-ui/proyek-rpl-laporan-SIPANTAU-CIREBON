/**
 * Cek status konfigurasi integrasi Fonnte dari sisi server.
 * Berguna untuk memastikan token & penerima admin sudah benar.
 *
 * Jalankan: npx ts-node scripts/check-fonnte-status.ts
 */
import request from 'supertest';
import app from '../src/index';
import prisma from '../src/utils/db';
import { generateToken } from '../src/utils/jwt';

async function main(): Promise<void> {
  const admin = await prisma.users.findFirst({ where: { role: 'admin' } });
  if (!admin) {
    console.error('Tidak ada akun admin.');
    process.exit(1);
  }

  const token = generateToken({ userId: admin.id, role: 'admin' });
  const res = await request(app)
    .get('/api/admin/integrations/whatsapp/status')
    .set('Authorization', `Bearer ${token}`);

  const data = res.body?.data ?? {};
  console.log('HTTP ' + res.status);
  console.log('provider            :', data.provider);
  console.log('api url             :', data.apiUrl);
  console.log('master switch       :', data.masterEnabled);
  console.log('FONNTE_ENABLED      :', data.fonnteEnabled);
  console.log('token terkonfigurasi:', data.tokenConfigured, '(nilai token tidak pernah ditampilkan)');
  console.log('siap mengirim       :', data.ready);
  console.log('alasan              :', data.reason);
  console.log('penerima admin      :', JSON.stringify(data.adminRecipients));
  console.log('telegram            :', data.telegramEnabled, '(' + data.telegramSource + ')');
  console.log('jenis notifikasi    :', (data.events ?? []).length, 'event');

  const raw = JSON.stringify(res.body);
  const tokenValue = process.env.FONNTE_TOKEN || '';
  if (tokenValue && raw.includes(tokenValue)) {
    console.error('PERINGATAN: token bocor di respons API!');
    process.exitCode = 1;
  } else {
    console.log('\n[aman] token tidak muncul di respons API.');
  }
}

main()
  .catch((e: Error) => {
    console.error('GAGAL:', e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
