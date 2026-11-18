/**
 * Penataan ulang akun administrator SIPANTAU CIREBON.
 *
 * TUJUAN
 *  Pastikan tepat satu akun dengan role `admin`:
 *   - nama  : Abril Pasya Pratama
 *   - email : abrilpasyapratama@gmail.com
 *   - no_hp : 085147722749
 *   Password awal dibaca dari environment variable INITIAL_ADMIN_PASSWORD
 *   (tidak pernah ditulis ke source code, log, atau file plaintext).
 *
 * ALUR
 *  1. Akun admin BARU dibuat lebih dulu memakai email sementara, sehingga
 *     email target tidak pernah bentrok dan tidak pernah kosong.
 *  2. Semua baris yang merujuk akun lama (laporan, penugasan, riwayat status,
 *     notifikasi, riwayat chat) PINDAH ke akun admin baru - TIDAK dihapus.
 *     Tidak ada cascade delete terhadap data operasional.
 *  3. Akun lama (akun dengan email target + seluruh akun admin sebelumnya)
 *     dihapus setelah dependensinya dipindahkan.
 *  4. Email admin baru diubah ke email target, lalu diverifikasi.
 *
 * KEAMANAN
 *  - Hanya CLI server, tidak ada endpoint HTTP.
 *  - Wajib backup (pg_dump) sebelum dijalankan.
 *  - Password tidak pernah dicetak oleh skrip ini.
 *
 * PEMAKAIAN (PowerShell)
 *   $env:INITIAL_ADMIN_PASSWORD='...'
 *   $env:ADMIN_RESET_CONFIRM='YES'
 *   npm run reset:admin
 */
import bcrypt from 'bcryptjs';
import prisma from '../src/utils/db';
import { logger } from '../src/utils/logger';
import { normalizePhone } from '../src/utils/phone';
import { validateAdminPassword } from './provision-admin';

const DEFAULT_NAMA = 'Abril Pasya Pratama';
const DEFAULT_EMAIL = 'abrilpasyapratama@gmail.com';
const DEFAULT_NO_HP = '085147722749';
const DEFAULT_USERNAME = 'abril.pratama';

interface MovedRows {
  reports: number;
  assignments: number;
  reportUpdates: number;
  notifications: number;
  conversations: number;
  chatAnalytics: number;
  whatsappPrefs: number;
  telegramLinkCodes: number;
}

/** Pindahkan seluruh baris turunan dari `fromUserId` ke `toUserId`. */
async function moveDependentRows(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  fromUserId: string,
  toUserId: string
): Promise<MovedRows> {
  const moved: MovedRows = {
    reports: 0,
    assignments: 0,
    reportUpdates: 0,
    notifications: 0,
    conversations: 0,
    chatAnalytics: 0,
    whatsappPrefs: 0,
    telegramLinkCodes: 0,
  };

  moved.reports = (
    await tx.reports.updateMany({ where: { user_id: fromUserId }, data: { user_id: toUserId } })
  ).count;
  moved.assignments = (
    await tx.assignments.updateMany({
      where: { petugas_id: fromUserId },
      data: { petugas_id: toUserId },
    })
  ).count;
  moved.reportUpdates = (
    await tx.report_updates.updateMany({
      where: { petugas_id: fromUserId },
      data: { petugas_id: toUserId },
    })
  ).count;
  moved.notifications = (
    await tx.notifications.updateMany({
      where: { user_id: fromUserId },
      data: { user_id: toUserId },
    })
  ).count;
  moved.conversations = (
    await tx.conversations.updateMany({
      where: { user_id: fromUserId },
      data: { user_id: toUserId },
    })
  ).count;
  moved.chatAnalytics = (
    await tx.chat_analytics.updateMany({
      where: { user_id: fromUserId },
      data: { user_id: toUserId },
    })
  ).count;
  moved.whatsappPrefs = (
    await tx.user_whatsapp_preferences.updateMany({
      where: { user_id: fromUserId },
      data: { user_id: toUserId },
    })
  ).count;

  // Kode penghubung Telegram = kredensial sekali pakai (bukan data
  // operasional) -> dibersihkan, tidak dipindahkan.
  moved.telegramLinkCodes = (
    await tx.telegram_link_codes.deleteMany({ where: { user_id: fromUserId } })
  ).count;

  return moved;
}

function addMoved(target: MovedRows, source: MovedRows): MovedRows {
  target.reports += source.reports;
  target.assignments += source.assignments;
  target.reportUpdates += source.reportUpdates;
  target.notifications += source.notifications;
  target.conversations += source.conversations;
  target.chatAnalytics += source.chatAnalytics;
  target.whatsappPrefs += source.whatsappPrefs;
  target.telegramLinkCodes += source.telegramLinkCodes;
  return target;
}

async function main(): Promise<void> {
  if (process.env.ADMIN_RESET_CONFIRM !== 'YES') {
    console.error(
      'Dibatalkan: set ADMIN_RESET_CONFIRM=YES untuk mengonfirmasi penataan ulang akun admin.'
    );
    process.exit(1);
  }

  const password = process.env.INITIAL_ADMIN_PASSWORD || '';
  const pwError = validateAdminPassword(password);
  if (pwError) {
    console.error('Dibatalkan: INITIAL_ADMIN_PASSWORD tidak valid - ' + pwError);
    process.exit(1);
  }

  const nama = (process.env.ADMIN_NAMA || DEFAULT_NAMA).trim();
  const email = (process.env.ADMIN_EMAIL || DEFAULT_EMAIL).trim().toLowerCase();
  const noHp = (process.env.ADMIN_NO_HP || DEFAULT_NO_HP).trim();
  const phoneNormalized = normalizePhone(noHp);
  if (!phoneNormalized) {
    console.error('Dibatalkan: nomor HP tidak valid.');
    process.exit(1);
  }

  const hashed = await bcrypt.hash(password, 10);

  const before = {
    admins: await prisma.users.count({ where: { role: 'admin' } }),
    users: await prisma.users.count(),
    masyarakat: await prisma.users.count({ where: { role: 'masyarakat' } }),
    petugas: await prisma.users.count({ where: { role: 'petugas' } }),
    reports: await prisma.reports.count(),
    reportUpdates: await prisma.report_updates.count(),
    notifications: await prisma.notifications.count(),
    assignments: await prisma.assignments.count(),
  };

  const result = await prisma.$transaction(async (tx) => {
    // ---------- 1. Akun admin baru (email sementara agar target tidak bentrok) ----------
    const tempEmail = 'admin-reset-' + Date.now() + '@sipantau.local';

    let username = (process.env.ADMIN_USERNAME || DEFAULT_USERNAME).trim();
    const usernameTaken = await tx.users.findUnique({ where: { username } });
    if (usernameTaken) {
      username = username + '.' + Date.now().toString().slice(-5);
    }

    const newAdmin = await tx.users.create({
      data: {
        nama,
        username,
        email: tempEmail,
        password: hashed,
        role: 'admin',
        status: 'AKTIF',
        must_change_password: true,
        no_hp: noHp,
        no_hp_normalized: phoneNormalized,
      },
      select: { id: true, email: true },
    });

    const moved: MovedRows = {
      reports: 0,
      assignments: 0,
      reportUpdates: 0,
      notifications: 0,
      conversations: 0,
      chatAnalytics: 0,
      whatsappPrefs: 0,
      telegramLinkCodes: 0,
    };

    const removed: Array<{ id: string; email: string; role: string }> = [];

    // ---------- 2. Akun dengan email target (lama) ----------
    const targetAccount = await tx.users.findUnique({ where: { email } });
    if (targetAccount) {
      addMoved(moved, await moveDependentRows(tx, targetAccount.id, newAdmin.id));
      await tx.users.delete({ where: { id: targetAccount.id } });
      removed.push({ id: targetAccount.id, email: targetAccount.email, role: targetAccount.role });
    }

    // ---------- 3. Seluruh akun admin lama lainnya ----------
    const oldAdmins = await tx.users.findMany({
      where: { role: 'admin', NOT: { id: newAdmin.id } },
      select: { id: true, email: true, role: true },
    });
    for (const old of oldAdmins) {
      addMoved(moved, await moveDependentRows(tx, old.id, newAdmin.id));
      await tx.users.delete({ where: { id: old.id } });
      removed.push({ id: old.id, email: old.email, role: old.role });
    }

    // ---------- 4. Email akhir akun admin baru ----------
    await tx.users.update({
      where: { id: newAdmin.id },
      data: { email },
    });

    return { newAdminId: newAdmin.id, moved, removed };
  });

  // ---------- 5. Verifikasi akhir ----------
  const adminsAfter = await prisma.users.findMany({
    where: { role: 'admin' },
    select: {
      id: true,
      nama: true,
      email: true,
      role: true,
      status: true,
      must_change_password: true,
      no_hp: true,
      username: true,
    },
  });

  const after = {
    admins: adminsAfter.length,
    users: await prisma.users.count(),
    masyarakat: await prisma.users.count({ where: { role: 'masyarakat' } }),
    petugas: await prisma.users.count({ where: { role: 'petugas' } }),
    reports: await prisma.reports.count(),
    reportUpdates: await prisma.report_updates.count(),
    notifications: await prisma.notifications.count(),
    assignments: await prisma.assignments.count(),
  };

  logger.audit('admin_accounts_reset', {
    newAdminId: result.newAdminId,
    removedAccountCount: result.removed.length,
    moved: result.moved,
  });

  console.log('=== HASIL PENATAAN ULANG ADMIN ===');
  console.log('Admin baru dibuat : ' + email);
  console.log('Akun dihapus       : ' + result.removed.length);
  for (const r of result.removed) console.log('  - ' + r.email + ' [role=' + r.role + ', id=' + r.id + ']');
  console.log('Baris dipindahkan ke admin baru (tidak dihapus):');
  console.log(
    '  reports=' +
      result.moved.reports +
      ' assignments=' +
      result.moved.assignments +
      ' report_updates=' +
      result.moved.reportUpdates +
      ' notifications=' +
      result.moved.notifications +
      ' conversations=' +
      result.moved.conversations +
      ' chat_analytics=' +
      result.moved.chatAnalytics +
      ' whatsapp_prefs=' +
      result.moved.whatsappPrefs
  );
  console.log('Kode penghubung Telegram dibersihkan: ' + result.moved.telegramLinkCodes);

  console.log('\n=== VERIFIKASI COUNT ===');
  console.log('admin         : ' + before.admins + ' -> ' + after.admins);
  console.log('users         : ' + before.users + ' -> ' + after.users);
  console.log('masyarakat    : ' + before.masyarakat + ' -> ' + after.masyarakat);
  console.log('petugas       : ' + before.petugas + ' -> ' + after.petugas);
  console.log('reports       : ' + before.reports + ' -> ' + after.reports);
  console.log('report_updates: ' + before.reportUpdates + ' -> ' + after.reportUpdates);
  console.log('notifications : ' + before.notifications + ' -> ' + after.notifications);
  console.log('assignments   : ' + before.assignments + ' -> ' + after.assignments);

  console.log('\n=== AKUN ADMIN FINAL ===');
  for (const a of adminsAfter) {
    console.log(
      '- ' + a.nama + ' | ' + a.email + ' | ' + a.no_hp + ' | username=' + a.username +
        ' | role=' + a.role + ' | status=' + a.status + ' | wajib ganti password=' + a.must_change_password
    );
  }
}

main()
  .then(() => process.exit(0))
  .catch((e: Error) => {
    console.error('GAGAL: ' + e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
