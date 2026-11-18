/**
 * Uji nyata chatbot untuk role MASYARAKAT & PETUGAS.
 *
 * Membuat akun sementara langsung di database (tanpa notifikasi), menguji
 * percakapan identitas, lalu MENGHAPUS akun & datanya kembali sehingga
 * database tidak berubah.
 *
 * Jalankan: npx ts-node scripts/verify-chat-identity-roles.ts
 */
import bcrypt from 'bcryptjs';
import request from 'supertest';
import app from '../src/index';
import prisma from '../src/utils/db';

const PASSWORD = 'Uji chatbot 2026';

async function runFor(role: 'masyarakat' | 'petugas'): Promise<void> {
  const email = `uji.chatbot.${role}.${Date.now()}@example.com`;
  const hashed = await bcrypt.hash(PASSWORD, 10);

  const user = await prisma.users.create({
    data: {
      nama: role === 'petugas' ? 'Uji Petugas' : 'Uji Masyarakat',
      email,
      password: hashed,
      role,
      status: 'AKTIF',
    },
    select: { id: true },
  });

  try {
    const login = await request(app).post('/api/auth/login').send({ email, password: PASSWORD });
    if (login.status !== 200) throw new Error('Login gagal: HTTP ' + login.status);
    const token: string = login.body?.data?.token;

    console.log('\n' + '='.repeat(70));
    console.log('ROLE: ' + role + ' (akun sementara ' + email + ')');
    console.log('='.repeat(70));

    for (const q of ['Siapa saya?', 'Siapa admin yang sedang login?', 'Tampilkan profil administrator']) {
      const res = await request(app)
        .post('/api/chat')
        .set('Authorization', `Bearer ${token}`)
        .send({ message: q });

      console.log('\nTANYAAN : ' + q);
      console.log('TOOLS   : ' + JSON.stringify(res.body?.data?.tools_used));
      console.log('JAWABAN : ' + res.body?.data?.reply);

      const raw = JSON.stringify(res.body);
      if (raw.includes('abrilpasyapratama@gmail.com') || raw.includes('085147722749')) {
        console.log('!!! BOCOR: data admin ikut muncul di respons');
      }
    }
  } finally {
    // Bersihkan data uji
    const convos = await prisma.conversations.findMany({
      where: { user_id: user.id },
      select: { id: true },
    });
    await prisma.chat_messages.deleteMany({
      where: { conversation_id: { in: convos.map((c) => c.id) } },
    });
    await prisma.chat_analytics.deleteMany({ where: { user_id: user.id } });
    await prisma.conversations.deleteMany({ where: { user_id: user.id } });
    await prisma.notifications.deleteMany({ where: { user_id: user.id } });
    await prisma.users.delete({ where: { id: user.id } });
    console.log('\n[akun sementara dihapus: ' + email + ']');
  }
}

async function main(): Promise<void> {
  await runFor('masyarakat');
  await runFor('petugas');
  console.log('\nSelesai. Cek tidak ada data uji tersisa.');
}

main()
  .catch((e: Error) => {
    console.error('GAGAL: ' + e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
