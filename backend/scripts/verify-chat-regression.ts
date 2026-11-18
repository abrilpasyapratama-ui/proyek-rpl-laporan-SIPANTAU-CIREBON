/**
 * Regresi: fitur chatbot lama (tool data laporan) tetap berfungsi.
 * Jalankan dengan env ADMIN_LOGIN_PASSWORD.
 */
import request from 'supertest';
import app from '../src/index';

const EMAIL = process.env.ADMIN_LOGIN_EMAIL || 'abrilpasyapratama@gmail.com';
const PASSWORD = process.env.ADMIN_LOGIN_PASSWORD || '';

const QUESTIONS = [
  'Berapa total laporan saat ini?',
  'Tampilkan 3 laporan prioritas tinggi yang belum selesai',
];

async function main(): Promise<void> {
  const login = await request(app).post('/api/auth/login').send({ email: EMAIL, password: PASSWORD });
  if (login.status !== 200) {
    console.error('Login gagal: HTTP ' + login.status);
    process.exit(1);
  }
  const token: string = login.body?.data?.token;

  for (const q of QUESTIONS) {
    const res = await request(app)
      .post('/api/chat')
      .set('Authorization', `Bearer ${token}`)
      .send({ message: q });
    console.log('\nTANYAAN : ' + q);
    console.log('TOOLS   : ' + JSON.stringify(res.body?.data?.tools_used));
    console.log('JAWABAN : ' + res.body?.data?.reply);
  }
}

main()
  .catch((e: Error) => {
    console.error('GAGAL: ' + e.message);
    process.exit(1);
  })
  .finally(() => {
    void import('../src/utils/db').then((m) => m.default.$disconnect());
  });
