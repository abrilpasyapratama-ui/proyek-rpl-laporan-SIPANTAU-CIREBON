/**
 * Audit lanjutan: relasi akun masyarakat target + konflik unik
 * (email / no_hp_normalized / username) sebelum operasi admin.
 *
 * Jalankan: npx ts-node scripts/audit-admin-target.ts
 */
import prisma from '../src/utils/db';

const TARGET_EMAIL = 'abrilpasyapratama@gmail.com';
const TARGET_PHONE = '085147722749';

async function main() {
  const target = await prisma.users.findUnique({
    where: { email: TARGET_EMAIL },
    select: {
      id: true,
      nama: true,
      email: true,
      role: true,
      status: true,
      username: true,
      no_hp: true,
      no_hp_normalized: true,
      created_at: true,
    },
  });

  console.log('=== AKUN TARGET ===');
  console.log(target ? JSON.stringify(target, null, 2) : 'TIDAK ADA');

  if (target) {
    const reports = await prisma.reports.findMany({
      where: { user_id: target.id },
      select: { id: true, judul: true, status: true, created_at: true },
      orderBy: { created_at: 'desc' },
    });
    console.log('\n=== LAPORAN DIMILIKI AKUN TARGET: ' + reports.length + ' ===');
    for (const r of reports) console.log(`- ${r.id} "${r.judul}" [${r.status}] ${r.created_at.toISOString()}`);

    console.log('notifications=' + (await prisma.notifications.count({ where: { user_id: target.id } })));
    console.log('assignments=' + (await prisma.assignments.count({ where: { petugas_id: target.id } })));
    console.log('report_updates=' + (await prisma.report_updates.count({ where: { petugas_id: target.id } })));
    console.log('conversations=' + (await prisma.conversations.count({ where: { user_id: target.id } })));
    console.log('chat_analytics=' + (await prisma.chat_analytics.count({ where: { user_id: target.id } })));
    console.log('wa_prefs=' + (await prisma.user_whatsapp_preferences.count({ where: { user_id: target.id } })));
  }

  console.log('\n=== KONFLIK NO_HP 085147722749 ===');
  const digits = TARGET_PHONE.replace(/\D/g, '');
  const normalized = digits.startsWith('0') ? '62' + digits.slice(1) : digits;
  console.log('normalisasi: ' + normalized);
  const phoneUsers = await prisma.users.findMany({
    where: { OR: [{ no_hp_normalized: normalized }, { no_hp: { in: [TARGET_PHONE, normalized, '0' + digits.slice(1)] } }] },
    select: { id: true, nama: true, email: true, role: true, no_hp: true, no_hp_normalized: true },
  });
  console.log(phoneUsers.length ? JSON.stringify(phoneUsers, null, 2) : 'TIDAK ADA konflik');

  console.log('\n=== ADMIN INVITATIONS ===');
  const invites = await prisma.admin_invitations.findMany({
    select: { id: true, phone_normalized: true, used_at: true, used_by: true, created_at: true },
  });
  console.log(JSON.stringify(invites, null, 2));

  console.log('\n=== WHATSAPP MESSAGE LOGS (user_id admin lama) ===');
  const adminIds = (await prisma.users.findMany({ where: { role: 'admin' }, select: { id: true, email: true } }));
  console.log('admin ids: ' + JSON.stringify(adminIds));
  const waLogs = await prisma.whatsapp_message_logs.findMany({
    where: { user_id: { in: adminIds.map((a) => a.id) } },
    select: { id: true, event_type: true, user_id: true, delivery_status: true, created_at: true },
  });
  console.log('wa_logs milik admin: ' + waLogs.length);
}

main()
  .catch((e: Error) => {
    console.error('GAGAL:', e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
