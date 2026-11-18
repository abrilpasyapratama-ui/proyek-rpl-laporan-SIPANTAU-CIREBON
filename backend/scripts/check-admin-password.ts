/** Cek apakah password awal admin masih cocok dengan hash di database. */
import bcrypt from 'bcryptjs';
import prisma from '../src/utils/db';

async function main() {
  const u = await prisma.users.findUnique({
    where: { email: 'abrilpasyapratama@gmail.com' },
    select: { password: true, status: true, must_change_password: true, role: true },
  });

  if (!u) {
    console.log('akun tidak ditemukan');
    return;
  }

  const cocok = await bcrypt.compare(process.env.CHECK_PASSWORD || '', u.password);
  console.log('akun ditemukan | role=' + u.role + ' | status=' + u.status);
  console.log('wajib ganti password = ' + u.must_change_password);
  console.log('password awal cocok = ' + cocok);
}

main()
  .catch((e: Error) => {
    console.error('GAGAL:', e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
