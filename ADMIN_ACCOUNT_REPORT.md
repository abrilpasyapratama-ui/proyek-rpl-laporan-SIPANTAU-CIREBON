# LAPORAN AKUN ADMINISTRATOR

**Tanggal:** 2026-10-16

## 1. File yang Diubah

**Database** — `backend/prisma/schema.prisma`: `users.username` (unik, nullable), `users.must_change_password` (default false). Diterapkan via `prisma db push --accept-data-loss` (hanya peringatan unique constraint; NULL ganda diizinkan Postgres — tanpa hapus data).

**Backend** — `controllers/auth.controller.ts` (payload login/me/profile += username/status/must_change_password; changePassword menghapus flag) · `scripts/provision-admin.ts` (baru: CLI env-only, bcrypt-10, validasi kebijakan password, idempotent, tolak hijack email non-admin) · `package.json` (`provision:admin`) · `tests/provision.test.ts` (baru, 4 test) · `tests/api.test.ts` (+2 test flag).

**Frontend** — `store/useAuthStore.ts` (+username/must_change_password) · `pages/auth/Login.tsx` (redirect paksa ke `/admin/settings` saat flag) · `pages/admin/SettingsPage.tsx` (banner wajib ganti password + hapus flag) · `pages/auth/Login.test.tsx` (+1 test redirect).

## 2. Tabel & Proses

Tabel `users` (kolom baru di atas). Proses: `npm run provision:admin` dengan env `ADMIN_USERNAME/ADMIN_EMAIL/ADMIN_PASSWORD[/ADMIN_NAMA][/ADMIN_FORCE_RESET=true]` — tanpa endpoint publik, tanpa password di source/config/VC/log. Hasil: `OK: created` (id `c431e661-…`, audit `admin_provisioned`). Env dibersihkan setelah jalan.

## 3. Cara Menjalankan Ulang

```powershell
cd C:\laragon\www\laporan_fasilitas\backend
$env:ADMIN_USERNAME='my.admin'; $env:ADMIN_EMAIL='admin123@gmail.com'
$env:ADMIN_PASSWORD='<rahasia-min-8-upper-lower-angka>'
npm run provision:admin   # idempotent; tambah ADMIN_FORCE_RESET='true' untuk reset
```

## 4. Hasil Pengujian (dijalankan)

| Uji | Hasil |
|---|---|
| Provisioning | ✅ `created`, bcrypt terverifikasi via test |
| Login benar (admin123@gmail.com) | ✅ role admin, username my.admin, must_change=true, `/api/admin/stats` 200 |
| Login salah | ✅ 401 "Kredensial tidak valid" |
| Backend build/test | ✅ tsc 0 error; **57 passed** (6 file) |
| Frontend lint/build/test | ✅ 0; sukses; **69 passed** (11 file) |
| Guard lintas-role live | ✅ petugas→admin 403, masyarakat→petugas 403, anonim 401, petugas→verifications 403 |
| Redirect flag | ✅ unit test ke `/admin/settings` + state |

## 5. Yang Belum / Tindakan Anda

- **Wajib:** login pertama sebagai admin lalu ganti password awal `Admin112` di Pengaturan (sistem memaksa + memberi banner; flag hilang otomatis). Jangan bagikan password awal lewat kanal tidak aman.
- Tidak ada endpoint publik pembuatan admin; satu-satunya jalur adalah skrip CLI + (sudah ada) panel kelola role oleh admin aktif.
