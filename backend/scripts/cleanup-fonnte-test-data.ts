/** Membersihkan sisa akun/data uji dari skrip verifikasi Fonnte. */
import prisma from '../src/utils/db';

async function main() {
  const users = await prisma.users.findMany({
    where: { email: { startsWith: 'verify.fonnte' } },
    select: { id: true, email: true },
  });
  console.log('sisa akun uji:', JSON.stringify(users));

  for (const u of users) {
    await prisma.notifications.deleteMany({ where: { user_id: u.id } });
    await prisma.assignments.deleteMany({ where: { petugas_id: u.id } });
    await prisma.report_updates.deleteMany({ where: { petugas_id: u.id } });
    await prisma.reports.deleteMany({ where: { user_id: u.id } });
    await prisma.whatsapp_message_logs.deleteMany({ where: { user_id: u.id } });
    await prisma.users.delete({ where: { id: u.id } });
  }

  const logs = await prisma.whatsapp_message_logs.count({
    where: { event_type: { in: ['MANUAL_TEST', 'ADMIN_TEST_MESSAGE'] } },
  });
  if (logs > 0) {
    await prisma.whatsapp_message_logs.deleteMany({
      where: { event_type: { in: ['MANUAL_TEST', 'ADMIN_TEST_MESSAGE'] } },
    });
  }

  // --all-logs: menghapus SELURUH log (dipakai bila seluruh log berasal dari uji).
  if (process.argv.includes('--all-logs')) {
    const all = await prisma.whatsapp_message_logs.count();
    await prisma.whatsapp_message_logs.deleteMany({});
    console.log('seluruh log whatsapp dihapus:', all);
  }

  console.log('akun uji dihapus:', users.length, '| log uji dihapus:', logs);
}

main()
  .catch((e: Error) => {
    console.error('GAGAL:', e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
