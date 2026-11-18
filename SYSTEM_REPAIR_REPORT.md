# SYSTEM REPAIR REPORT — SIPANTAU CIREBON

**Tanggal:** 2026-10-09
**Cakupan:** Tahap 1 (audit) → Tahap 5 (pengujian + regresi). Temuan pra-perbaikan: `NAVIGATION_AUDIT.md`.

## 1. Ringkasan Masalah Awal

Navigasi tidak lengkap (route spec belum ada, sidebar admin/petugas minim), 1 redirect rusak (`/admin/gis` → dirinya sendiri), modal admin bocor ke peta publik, bell notifikasi admin/petugas mengarah ke route 403, form Pengaturan dekoratif, tanpa halaman detail laporan milik sendiri, tanpa halaman penugasan, tanpa kelola role, penolakan tanpa alasan, filter admin minim, URL foto hardcode localhost, dan update progres tanpa upload bukti di UI.

## 2. Akar Penyebab

- Route baru tidak ditambahkan saat fitur dibutuhkan; redirect lama (`/admin/gis`) tertinggal dan menunjuk dirinya sendiri.
- `GisDashboard` dipakai ulang untuk publik tanpa mode akses — modal admin selalu dirender.
- `notificationPath="/notifications"` disalin ke semua layout padahal route-nya guard `masyarakat`.
- Endpoint yang belum ada: detail milik sendiri, daftar penugasan, profil/password, role, alasan tolak, filter lanjutan.
- Foto: base URL ditulis manual per file, bukan dari `VITE_API_URL`.

## 3. File yang Diperbaiki / Dibuat

**Backend** — `validation/schemas.ts` (reason wajib saat REJECT, filter kategori/lokasi/from/to, profile/password/role schema) · `controllers/auth.controller.ts` (+`updateProfile`, `changePassword`) · `routes/auth.routes.ts` (PATCH /profile, PATCH /password) · `controllers/report.controller.ts` (+`getMyReportById`, ownership `findFirst`) · `routes/report.routes.ts` (GET /:id setelah route statis) · `controllers/admin.controller.ts` (filter lanjutan, alasan tolak → `report_updates`, +`getAssignments`, +`updateUserRole` cegah self-demote) · `routes/admin.routes.ts` (GET /assignments, PATCH /users/:id/role) · `tests/api.test.ts` (+8 test).

**Frontend (baru)** — `pages/laporan/ReportDetailPage.tsx` (+test) · `pages/admin/AssignmentsPage.tsx` (+test) · `utils/uploadUrl.ts` (+test).
**Frontend (diperbaiki)** — `router/index.tsx` (hapus self-redirect; +6 route: `/reports/:id`, `/admin/reports/verification`, `/admin/assignments`, `/admin/map`, `/admin/notifications`, `/officer/map`, `/officer/notifications`) · `layouts/PublicLayout.tsx` (+Peta GIS, tombol Dashboard saat login) · `layouts/AdminLayout.tsx` (10 menu + notificationPath) · `layouts/OfficerLayout.tsx` (6 menu + notificationPath) · `pages/admin/ReportManagement.tsx` (prop `initialStatus`/`title`, filter kategori/lokasi/tanggal + reset) · `pages/admin/ReportDetailModal.tsx` (alasan penolakan wajib) · `pages/admin/UsersPage.tsx` (dropdown role, proteksi diri sendiri) · `pages/admin/SettingsPage.tsx` (ditulis ulang: profil + password nyata) · `pages/laporan/RiwayatLaporan.tsx` (tombol Detail → Link, URL foto helper) · `pages/officer/OfficerTaskDetail.tsx` (upload foto_bukti FormData + validasi, tampil bukti) · `pages/admin/GisDashboard.tsx` (prop `readonly` + modal publik) · `components/gis/{GisMap,GisReportList}.tsx`, `ReportDetailModal`, `RiwayatLaporan` (helper URL) · `components/notifications/NotificationBell.tsx` (navigasi per tipe + area role).

## 4. Route yang Ditambahkan / Diperbaiki

Ditambah: `/reports/:id`, `/admin/reports/verification`, `/admin/assignments`, `/admin/map`, `/admin/notifications`, `/officer/map`, `/officer/notifications`. Diperbaiki: hapus self-redirect `/admin/gis` (dialihkan ke `/admin/map`); `/map` publik kini read-only. Dinamis vs statis aman (`/:id` setelah route statis; ranking React Router memprioritaskan statis).

## 5. Fitur Terintegrasi End-to-End (teruji live)

Registrasi (201/409/400) → login → buat laporan multipart+AI (201) → detail owner (200) & non-owner (404) → tolak-tanpa-alasan (400) → approve (DIPROSES) → assign (201, duplikat 400) → progres+foto bukti (201, file tersimpan /uploads) → selesai → owner lihat 2 update → profil/password/notifikasi → role petugas→masyarakat kembali. Filter admin `kategori/lokasi/from/to` → 200.

## 6. Masalah Database dan API

Tidak ada perubahan schema/migrasi (alasan tolak memakai `report_updates`, sesuai larangan reset). FK `report_updates.petugas_id` untuk catatan admin valid (referensi users). Satu-satunya anomali: 2 proses nodemon berebut port 5000 saat audit — dibersihkan, tersisa 1 instance.

## 7. Hasil Pengujian

| Perintah | Hasil |
|---|---|
| `backend: npm run build` (tsc) | ✅ 0 error |
| `backend: npm test` (vitest) | ✅ 5 file, **43 passed** (35 lama + 8 baru) |
| `frontend: npm run lint` (max-warnings 0) | ✅ 0 error |
| `frontend: npm run build` (tsc -b + vite) | ✅ 0 error |
| `frontend: npm test` (vitest) | ✅ 9 file, **55 passed** (47 lama + 8 baru) |
| Probe live 20+ kasus (3 role + anonim) | ✅ semua sesuai harapan (401/403/404/400/200/201) |

## 8. Error yang Masih Tersisa

Tidak ada error critical/high. Catatan non-blocking: warning React Router future-flag + `act(...)` di output test (pre-existing, bukan failure); email SMTP belum dikonfigurasi (notifikasi in-app tetap jalan); JWT di localStorage + tanpa refresh token (utang lama, sudah didokumentasikan sebelumnya).

## 9. Langkah Manual yang Masih Diperlukan

1. Set `VITE_API_URL` + `CORS_ORIGINS` produksi; ganti `JWT_SECRET`; konfigurasi SMTP bila ingin email aktif.
2. Data uji E2E berlabel `[TEST E2E]` (1 laporan SELESAI + 1 user `e2e.*@test.id`) tertinggal di DB — hapus manual bila tidak diperlukan.
3. Verifikasi visual responsif mobile/tablet di browser (tidak dapat dilakukan headless dari sini).
