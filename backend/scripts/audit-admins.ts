/**
 * Audit admin (read-only): daftar akun admin,email typo, dan relasi yang
 * berisiko bila akun dihapus.
 *
 * Jalankan: npx ts-node scripts/audit-admins.ts
 */
import prisma from '../src/utils/db';

async function main() {
  const admins = await prisma.users.findMany({
    where: { role: 'admin' },
    select: {
      id: true,
      nama: true,
      username: true,
      email: true,
      no_hp: true,
      status: true,
      must_change_password: true,
      created_at: true,
    },
    orderBy: { created_at: 'asc' },
  });

  console.log('=== TOTAL ADMIN: ' + admins.length + ' ===');
  for (const a of admins) {
    console.log(
      `- id=${a.id} nama="${a.nama}" email=${a.email} no_hp=${a.no_hp ?? '-'} status=${a.status} username=${a.username ?? '-'} mcp=${a.must_change_password} created=${a.created_at.toISOString()}`
    );
  }

  console.log('\n=== CEK EMAIL (tanpa spasi / dengan spasi) ===');
  const exact = await prisma.users.findUnique({ where: { email: 'abrilpasyapratama@gmail.com' } });
  console.log('abrilpasyapratama@gmail.com -> ' + (exact ? `${exact.id} role=${exact.role} status=${exact.status}` : 'TIDAK ADA'));
  const spaced = await prisma.users.findMany({
    where: { OR: [{ email: { contains: 'ilpasyapratama' } }, { email: { contains: 'abril' } }] },
    select: { id: true, nama: true, email: true, role: true, status: true },
  });
  console.log('cocok "abril"/"ilpasyapratama": ' + (spaced.length ? JSON.stringify(spaced) : 'TIDAK ADA'));

  console.log('\n=== RELASI PER ADMIN (risiko delete) ===');
  for (const a of admins) {
    const reports = await prisma.reports.count({ where: { user_id: a.id } });
    const assignments = await prisma.assignments.count({ where: { petugas_id: a.id } });
    const updates = await prisma.report_updates.count({ where: { petugas_id: a.id } });
    const notifications = await prisma.notifications.count({ where: { user_id: a.id } });
    const conversations = await prisma.conversations.count({ where: { user_id: a.id } });
    const chatAnalytics = await prisma.chat_analytics.count({ where: { user_id: a.id } });
    const waPrefs = await prisma.user_whatsapp_preferences.count({ where: { user_id: a.id } });
    const tgCodes = await prisma.telegram_link_codes.count({ where: { user_id: a.id } });
    const tgLogs = await prisma.telegram_message_logs.count({ where: { user_id: a.id } });
    console.log(
      `- ${a.email}: reports=${reports} assignments=${assignments} report_updates=${updates} notifications=${notifications} conversations=${conversations} chat_analytics=${chatAnalytics} wa_prefs=${waPrefs} tg_codes=${tgCodes} tg_logs=${tgLogs}`
    );
  }

  console.log('\n=== TOTAL DATA OPERASIONAL (harus utuh) ===');
  console.log('reports=' + (await prisma.reports.count()));
  console.log('report_updates=' + (await prisma.report_updates.count()));
  console.log('assignments=' + (await prisma.assignments.count()));
  console.log('notifications=' + (await prisma.notifications.count()));
  console.log('users total=' + (await prisma.users.count()));
  console.log('masyarakat=' + (await prisma.users.count({ where: { role: 'masyarakat' } })));
  console.log('petugas=' + (await prisma.users.count({ where: { role: 'petugas' } })));
}

main()
  .catch((e: Error) => {
    console.error('GAGAL:', e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
