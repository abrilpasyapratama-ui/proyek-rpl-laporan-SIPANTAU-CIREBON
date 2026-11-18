# LAPORAN FITUR REGISTRASI MULTIROLE

**Tanggal:** 2026-10-16

## 1. File yang Diubah

**Database** — `backend/prisma/schema.prisma`: enum `UserStatus` (AKTIF, MENUNGGU_VERIFIKASI, DITOLAK); `users` += `status` (default AKTIF, data lama otomatis AKTIF), `no_hp/nip/instansi/wilayah` (nullable). Diterapkan via `prisma db push` (migrate dev rusak sejak lama — shadow DB, di luar cakupan).

**Backend** — `validation/schemas.ts` (register: role masyarakat/petugas + profil; `verifyPetugasSchema`) · `controllers/auth.controller.ts` (register: tolak admin 403, petugas→MENUNGGU_VERIFIKASI; login: blokir non-AKTIF 403 dengan pesan spesifik; select status/profil) · `middlewares/auth.middleware.ts` (`requireActive` + status di req.user) · routes report/petugas/admin/notification/chat (+requireActive) · `controllers/admin.controller.ts` (`listPendingPetugas`, `verifyPetugas` + audit + notifikasi in-app) · `routes/admin.routes.ts` (GET/PATCH `/verifications`) · `tests/api.test.ts` (+8 test).

**Frontend** — `pages/auth/Register.tsx` (kartu peran keyboard-accessible, form per peran, checkbox privasi, pesan sukses per peran) · `pages/auth/Login.tsx` (tampilkan pesan 403 server) · `store/useAuthStore.ts` (field status) · `components/ProtectedRoute.tsx` (tendang sesi non-AKTIF) · `pages/admin/VerifikasiPetugasPage.tsx` (baru) + route + menu sidebar · tests: Register (+4), Login (+1), ProtectedRoute (+1), VerifikasiPetugasPage (baru, 3).

## 2. Halaman & Navigasi

`/register` (kartu Masyarakat/Petugas, link login + beranda) · `/admin/verifications` (guard admin, daftar + Setujui/Tolak + empty state) · menu sidebar "Verifikasi Petugas". Navigasi lain tidak berubah.

## 3. Endpoint & Database

Baru: `GET /api/admin/verifications`, `PATCH /api/admin/verifications/:id`. Diubah: `POST /api/auth/register` (role+profil, tolak admin), `POST /api/auth/login` (blokir non-AKTIF), `GET /api/auth/me` (+status/profil). Semua endpoint operasional kini berlapis `authenticate → requireActive → authorizeRole`. Skema: +enum UserStatus, +5 kolom nullable (aman, tanpa hapus data).

## 4. Alur Registrasi Masyarakat

Form → validasi → `POST /auth/register {role:masyarakat}` → 201 AKTIF → redirect `/login` → login → `/dashboard`. Live: 201, duplikat 409, invalid 400.

## 5. Alur Pengajuan & Verifikasi Petugas

Form petugas (HP/instansi/wilayah wajib, NIP opsional, consent) → 201 MENUNGGU_VERIFIKASI ("menunggu verifikasi Admin") → login ditolak 403 → admin lihat di `/admin/verifications` → Setujui (AKTIF + notifikasi in-app + audit) / Tolak (DITOLAK + notifikasi) → petugas disetujui login → `/officer/dashboard`, tugas miliknya saja. Live teruji penuh.

## 6. Hasil Pengujian (dijalankan)

| Perintah | Hasil |
|---|---|
| backend `npm run build` | ✅ |
| backend `npm test` | ✅ 5 file, **51 passed** (43+8) |
| frontend `npm run lint` | ✅ 0 |
| frontend `npm run build` | ✅ |
| frontend `npm test` | ✅ 11 file, **68 passed** (59+9... 59 lama→68: +9 test baru/pecah) |
| Live E2E | ✅ register masyarakat/petugas/admin-ditolak, login pending 403, approve→login→tasks, reject→403, masyarakat→verifications 403, petugas lain→404 report |

## 7. Bug yang Diperbaiki

- Regresi 16 test backend oleh `requireActive` (mock tanpa status) → mock dilengkapi `status AKTIF`; temuan إدارة: mock `findUnique` ganda perlu rantai Once.
- 1 test consent gagal (teks ganda) → assertion string eksak.
- Data E2E (3 user + notifikasi) dibersihkan dari DB.

## 8. Kendala / Sisa Konfigurasi

- `prisma migrate dev` tetap rusak (baseline migration lama) — gunakan `db push` sesuai praktik proyek.
- Akun petugas demo belum ada di seed (perlu verifikasi manual bila diinginkan).
- Cek visual halaman register/verifikasi di browser disarankan (headless terbatas).
