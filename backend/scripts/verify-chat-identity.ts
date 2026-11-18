/**
 * Uji nyata fitur identitas chatbot (AI sungguhan + database sungguhan).
 *
 * Jalankan:
 *   $env:ADMIN_LOGIN_EMAIL='abrilpasyapratama@gmail.com'
 *   $env:ADMIN_LOGIN_PASSWORD='<password awal admin>'
 *   npx ts-node scripts/verify-chat-identity.ts
 */
import request from 'supertest';
import app from '../src/index';
import prisma from '../src/utils/db';

const EMAIL = process.env.ADMIN_LOGIN_EMAIL || 'abrilpasyapratama@gmail.com';
const PASSWORD = process.env.ADMIN_LOGIN_PASSWORD || '';

const QUESTIONS = [
  'Siapa saya?',
  'Apa email akun saya?',
  'Apa role saya?',
  'Bagaimana profil administrator saya?',
];

async function main(): Promise<void> {
  if (!PASSWORD) {
    console.error('ADMIN_LOGIN_PASSWORD wajib diisi.');
    process.exit(1);
  }

  const login = await request(app).post('/api/auth/login').send({
    email: EMAIL,
    password: PASSWORD,
  });
  if (login.status !== 200) {
    console.error('Login gagal: HTTP ' + login.status);
    process.exit(1);
  }
  const token: string = login.body?.data?.token;
  console.log('Login OK sebagai: ' + login.body?.data?.user?.nama + ' (' + login.body?.data?.user?.role + ')');
  console.log('='.repeat(70));

  for (const q of QUESTIONS) {
    const res = await request(app)
      .post('/api/chat')
      .set('Authorization', `Bearer ${token}`)
      .send({ message: q });

    console.log('\nTANYAAN : ' + q);
    console.log('TOOLS   : ' + JSON.stringify(res.body?.data?.tools_used));
    console.log('JAWABAN : ' + res.body?.data?.reply);
  }

  const profile = await prisma.users.findUnique({
    where: { email: EMAIL },
    select: { nama: true, email: true, no_hp: true, role: true },
  });
  console.log('\n' + '='.repeat(70));
  console.log('PROFIL DB (acuan jawaban): ' + JSON.stringify(profile));
}

main()
  .catch((e: Error) => {
    console.error('GAGAL: ' + e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
