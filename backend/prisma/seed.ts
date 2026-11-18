import { PrismaClient, Role, ReportStatus, NotificationType } from '@prisma/client';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const prisma = new PrismaClient();

/** Password acak untuk akun seed (hanya dicetak sekali, tidak disimpan di source). */
function generatePassword(): string {
  const all = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = 'A';
  out += 'a';
  out += '7';
  for (let i = 0; i < 13; i++) out += all[crypto.randomInt(all.length)];
  return out;
}

async function main() {
  // Password seed dibaca dari environment (tidak ada plaintext di source code).
  // Bila kosong, password acak dibuat dan ditampilkan SATU KALI di akhir.
  const seedPassword = process.env.SEED_PASSWORD || '';
  const generated: string[] = [];

  const hashFor = async (email: string): Promise<string> => {
    const pw = seedPassword || generatePassword();
    if (!seedPassword) generated.push(email + ' -> ' + pw);
    return bcrypt.hash(pw, 10);
  };

  // 1. Admin: TIDAK dibuat ulang bila sudah ada admin lain.
  //    Menjaga invariant "tepat satu akun dengan role admin".
  const existingAdmin = await prisma.users.findFirst({ where: { role: Role.admin } });
  if (existingAdmin) {
    console.log(
      'Admin sudah ada (' + existingAdmin.email + ') - seed tidak membuat akun admin baru.'
    );
  } else {
    const password = await hashFor('admin@sipantau.id');
    await prisma.users.upsert({
      where: { email: 'admin@sipantau.id' },
      update: {},
      create: {
        nama: 'Administrator SIPANTAU',
        email: 'admin@sipantau.id',
        password,
        role: Role.admin,
      },
    });
  }

  // Pastikan akun contoh ada TANPA mengubah password akun yang sudah ada.
  const ensureUser = async (email: string, nama: string, role: Role) => {
    const existing = await prisma.users.findUnique({ where: { email } });
    if (existing) return existing;
    return prisma.users.create({
      data: { nama, email, password: await hashFor(email), role },
    });
  };

  const petugas = await ensureUser('petugas@sipantau.id', 'Petugas Lapangan Cirebon', Role.petugas);
  const masyarakat = await ensureUser('masyarakat@sipantau.id', 'Warga Cirebon', Role.masyarakat);

  // 2. Data contoh laporan (hanya jika belum ada data)
  const reportCount = await prisma.reports.count();
  if (reportCount === 0) {
    const r1 = await prisma.reports.create({
      data: {
        user_id: masyarakat.id,
        judul: 'Lampu jalan mati di Jl. Siliwangi',
        deskripsi:
          'Lampu penerangan jalan di depan SD Negeri 1 Cirebon tidak menyala selama 3 malam sehingga jalan gelap dan membahayakan pengguna jalan.',
        kategori: 'Penerangan Jalan',
        lokasi: 'Jl. Siliwangi, Cirebon',
        latitude: -6.7147,
        longitude: 108.5537,
        status: ReportStatus.MENUNGGU_VERIFIKASI,
        ai_priority: 'Sedang',
      },
    });

    const r2 = await prisma.reports.create({
      data: {
        user_id: masyarakat.id,
        judul: 'Jalan berlubang di Jl. Karanggetas',
        deskripsi:
          'Terdapat lubang besar di jalan utama yang menyebabkan kemacetan dan risiko kecelakaan bagi pengendara motor.',
        kategori: 'Jalan & Jembatan',
        lokasi: 'Jl. Karanggetas, Cirebon',
        latitude: -6.7181,
        longitude: 108.5565,
        status: ReportStatus.DIPROSES,
        ai_priority: 'Tinggi',
      },
    });

    const r3 = await prisma.reports.create({
      data: {
        user_id: masyarakat.id,
        judul: 'Air keruh di sumur umum',
        deskripsi:
          'Air dari sumur umum di alun-alun mengeluarkan bau tidak sedap dan berubah warna menjadi kecoklatan sejak seminggu lalu.',
        kategori: 'Air & Drainase',
        lokasi: 'Alun-Alun Cirebon',
        latitude: -6.7155,
        longitude: 108.5521,
        status: ReportStatus.SELESAI,
        ai_priority: 'Normal',
      },
    });

    // Penugasan petugas pada laporan yang diproses
    await prisma.assignments.create({
      data: { report_id: r2.id, petugas_id: petugas.id },
    });

    // Progres perbaikan
    await prisma.report_updates.create({
      data: {
        report_id: r2.id,
        petugas_id: petugas.id,
        catatan: 'Tim dikerahkan ke lokasi, pengukuran lubang dilakukan.',
        status: ReportStatus.DIPROSES,
      },
    });

    await prisma.report_updates.create({
      data: {
        report_id: r3.id,
        petugas_id: petugas.id,
        catatan: 'Laporan telah ditindaklanjuti dan selesai.',
        status: ReportStatus.SELESAI,
      },
    });

    // Notifikasi untuk masyarakat
    await prisma.notifications.create({
      data: {
        user_id: masyarakat.id,
        report_id: r2.id,
        type: NotificationType.LAPORAN_DIPROSES,
        judul: 'Laporan Sedang Diproses',
        pesan: 'Laporan "Jalan berlubang di Jl. Karanggetas" telah diverifikasi dan sedang diproses oleh petugas.',
      },
    });

    await prisma.notifications.create({
      data: {
        user_id: masyarakat.id,
        report_id: r3.id,
        type: NotificationType.LAPORAN_SELESAI,
        judul: 'Laporan Selesai',
        pesan: 'Laporan "Air keruh di sumur umum" telah selesai ditangani. Terima kasih atas laporannya.',
      },
    });

    // Tugas aktif untuk petugas
    await prisma.notifications.create({
      data: {
        user_id: petugas.id,
        report_id: r2.id,
        type: NotificationType.TUGAS_BARU,
        judul: 'Tugas Baru',
        pesan: 'Anda ditugaskan untuk menangani laporan "Jalan berlubang di Jl. Karanggetas".',
      },
    });
  }

  console.log('Seed selesai.');
  if (generated.length > 0) {
    console.log('Password akun seed (tampil sekali, ganti setelah login):');
    for (const line of generated) console.log('  ' + line);
  } else {
    console.log('Password akun seed diambil dari environment SEED_PASSWORD (tidak ditampilkan).');
  }
}

main()
  .catch((e) => {
    console.error('Seed gagal:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
