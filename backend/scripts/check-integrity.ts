/** Cek integritas data log & undangan setelah penataan ulang admin. */
import prisma from '../src/utils/db';

const DELETED_IDS = [
  '336e33c3-930f-44dd-bd85-c5d5238b2401',
  'c431e661-a638-45cf-b753-12af52f762fd',
  'ac49ebc3-cb14-4e95-9900-b5016f34a949',
  '9a2a5643-7fdc-43da-a9f0-69e4a0399666',
];
const NEW_ADMIN_ID = '49bb9d1b-993f-455d-9d14-5dff4153a337';

async function main() {
  const waTotal = await prisma.whatsapp_message_logs.count();
  const waDangling = await prisma.whatsapp_message_logs.findMany({
    where: { user_id: { in: DELETED_IDS } },
    select: { id: true, event_type: true, user_id: true },
  });
  const tgTotal = await prisma.telegram_message_logs.count();
  const tgNull = await prisma.telegram_message_logs.count({ where: { user_id: null } });
  const tgAdmin = await prisma.telegram_message_logs.count({ where: { user_id: NEW_ADMIN_ID } });
  const invites = await prisma.admin_invitations.findMany({
    select: { phone_normalized: true, used_at: true, used_by: true },
  });

  console.log('whatsapp_message_logs total = ' + waTotal + ' (baris milik akun terhapus: ' + waDangling.length + ')');
  console.log('telegram_message_logs total  = ' + tgTotal + ' (user_id null=' + tgNull + ', milik admin baru=' + tgAdmin + ')');
  console.log('admin_invitations             = ' + JSON.stringify(invites));

  const orphanNotifications = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*)::bigint AS count FROM "notifications" n
    LEFT JOIN "users" u ON u.id = n.user_id WHERE u.id IS NULL`;
  console.log('notifikasi tanpa pemilik = ' + Number(orphanNotifications[0]?.count ?? 0));

  const orphanUpdates = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*)::bigint AS count FROM "report_updates" ru
    LEFT JOIN "users" u ON u.id = ru.petugas_id WHERE u.id IS NULL`;
  console.log('report_updates tanpa petugas = ' + Number(orphanUpdates[0]?.count ?? 0));

  const orphanConversations = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*)::bigint AS count FROM "conversations" c
    LEFT JOIN "users" u ON u.id = c.user_id WHERE u.id IS NULL`;
  console.log('conversations tanpa pemilik = ' + Number(orphanConversations[0]?.count ?? 0));
}

main()
  .catch((e: Error) => {
    console.error('GAGAL:', e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
