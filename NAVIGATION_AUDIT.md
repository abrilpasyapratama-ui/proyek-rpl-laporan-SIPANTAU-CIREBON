# NAVIGATION AUDIT — SIPANTAU CIREBON

**Tanggal:** 2026-10-09
**Stack aktual (terverifikasi):** React 18 + TypeScript + Vite 5 + React Router 6 + Zustand (persist localStorage) + Axios · Express 4 + Prisma 5 + PostgreSQL 17 + JWT (header Bearer) + Zod + Multer + Nodemailer.
**Metode:** baca seluruh `frontend/src` (router, layouts, pages, services, store), `backend/src` (routes, controllers, middlewares, validation), `prisma/schema.prisma`, plus probe live API.

## 1. Kondisi Umum (yang sudah benar, dipertahankan)

- Auth: register (bcrypt, 409 duplikat, role default `masyarakat` dari DB, tanpa role dari input) · login (JWT userId+role) · `authenticate` (verifikasi token + cek user di DB) · `authorizeRole` per route group · axios interceptor (sisip token, auto-logout + redirect `/login` saat 401) · `ProtectedRoute` (belum login → `/login` + `state.from`; role salah → `/unauthorized` 403) · `*` → 404.
- Dashboard 3 role terisi dari DB aktual, pola fetch per-seksi tahan parsial.
- Endpoint inti teruji: `/api/auth/*`, `/api/reports/*`, `/api/admin/*`, `/api/petugas/*`, `/api/notifications/*`, `/api/gis/*`, `/api/chat/*`.
- GIS publik, notifikasi per user, verifikasi + assign + progres + upload bukti (backend) sudah ada.

## 2. Temuan Bug & Kekurangan (A = akan diperbaiki)

| # | Severity | Lokasi | Temuan |
|---|----------|--------|--------|
| A1 | **High** | `frontend/src/router/index.tsx:125` | Redirect mati + self-redirect: `{ path: '/admin/gis', Navigate to="/admin/gis" }` (route sudah ada di children admin; tak terjangkau & membingungkan). |
| A2 | **High** | Publik `/map` → `GisDashboard` → `ReportDetailModal` | Modal admin (Approve/Reject/Assign, fetch `/admin/*`) terbuka untuk pengunjung publik → 403 + tombol admin terlihat publik. Perlu mode read-only. |
| A3 | **High** | `AdminLayout` + `OfficerLayout` `notificationPath="/notifications"` | `/notifications` hanya guard `masyarakat` → admin/petugas klik bell "Lihat Semua" mental ke 403. Perlu `/admin/notifications`, `/officer/notifications`. |
| A4 | **High** | Router | Route wajib spec belum ada: `/reports/:id`, `/admin/reports/verification`, `/admin/assignments`, `/admin/map`, `/officer/map`, `/officer/notifications`. Sidebar admin/petugas belum memuatnya. |
| A5 | **Medium** | `PublicLayout` navbar | Menu "Peta GIS" tidak ada (wajib spec). Saat sudah login tetap tampil Masuk/Daftar (harus: tombol Dashboard sesuai role). |
| A6 | **Medium** | Backend `GET /api/reports/:id` | Belum ada endpoint detail milik sendiri untuk masyarakat (dibutuhkan `/reports/:id`). |
| A7 | **Medium** | Backend `GET /api/admin/assignments` | Belum ada endpoint daftar penugasan (dibutuhkan halaman Penugasan). |
| A8 | **Medium** | `OfficerTaskDetail.tsx:81` | Update progres kirim JSON `{ catatan, status }` — input file bukti TIDAK ADA (backend mendukung `foto_bukti` via Multer). Fitur "unggah foto bukti" mati di UI. |
| A9 | **Medium** | 4 file (`GisMap`, `GisReportList`, `ReportDetailModal`, `RiwayatLaporan`) + `OfficerTaskDetail` | URL foto hardcode `http://localhost:5000` → rusak di production. Perlu helper berbasis `VITE_API_URL`. |
| A10 | **Medium** | `SettingsPage.tsx` | Form dekoratif: "Simpan" hanya set state lokal. Diubah jadi Pengaturan Profil nyata (`PATCH /auth/profile`, `PATCH /auth/password` — endpoint baru). |
| A11 | **Medium** | `UsersPage.tsx` + backend | Tidak ada kelola role (spec: "mengelola akun dan role"). Tambah `PATCH /api/admin/users/:id/role` (larang ubah role diri sendiri) + dropdown di UI. |
| A12 | **Medium** | `verifyReport` + `verifyReportSchema` | Penolakan tanpa alasan (spec: "menolak dengan alasan"). Skema `action` saja. Solusi tanpa migrasi: reason wajib saat REJECT → simpan sebagai `report_updates` status DITOLAK. |
| A13 | **Medium** | `adminReportsQuerySchema` + `getReports` + `ReportManagement` | Filter hanya status + search. Spec minta kategori, tanggal, lokasi. Tambah `kategori`, `lokasi`, `from`, `to` + input UI. |
| A14 | **Low** | `NotificationBell` navigasi klik | Masyarakat dikirim ke `/dashboard` generik (lebih tepat: `/reports/history`); admin → `/admin/reports` (lebih tepat: `/admin/reports/verification` untuk tipe verifikasi). |
| A15 | **Low** | Proses ganda | Ditemukan 2 proses nodemon backend berebut port 5000 (satu EADDRINUSE). Dibersihkan saat audit. |

## 3. Registrasi (verifikasi khusus)

- Navbar publik: menu **Daftar** ada (desktop + mobile + footer) → `/register`. ✅
- Halaman `/register`: Nama lengkap, Email, Password + Konfirmasi (tanpa telepon — schema `users` tidak punya kolom telepon, sesuai ketentuan "opsional jika sesuai schema"). ✅
- Validasi client: wajib isi, email valid, password (min 8, upper, lower, angka) + strength meter, konfirmasi cocok, blur-validation, cegah double submit, loading/success/error state, link "Masuk di sini" → `/login`, responsif. ✅
- Backend: Zod `registerSchema`, 409 email duplikat, bcrypt(10), role default `masyarakat` (tanpa input role). ✅ Sukses → pesan + redirect `/login` 2 dtk. ✅
- Test: `Register.test.tsx` 14 test (sukses, double submit, 409, 500, offline). Akan diuji live (registrasi asli + duplikat + invalid) pada Tahap 5.

## 4. Rencana Perbaikan (dipetakan ke Tahap 2–4)

- Router: hapus A1; tambah 6 route (A4); `ReportManagement` prop `initialStatus`.
- Backend: endpoint A6, A7, A10 (profile/password), A11 (role), A12 (reason), A13 (filter) + skema Zod + test.
- Frontend: navbar publik (A5); sidebar admin/petugas + notificationPath (A3, A4); halaman detail laporan + penugasan (A4, A6, A7); modal GIS read-only (A2); upload bukti (A8); helper URL upload (A9); settings profil nyata (A10); kelola role (A11); alasan penolakan (A12); filter admin (A13); navigasi bell (A14).
- Tahap 5: lint, typecheck(build), test FE+BE, probe live per role + registrasi live.
