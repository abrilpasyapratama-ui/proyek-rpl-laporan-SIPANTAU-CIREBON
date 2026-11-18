# ROUTING_AUDIT_REPORT.md

**Aplikasi:** SIPANTAU CIREBON — Sistem Pelaporan Fasilitas Umum Rusak Kota/Kabupaten Cirebon dengan AI  
**Tanggal Audit:** 2026-10-08  
**Auditor:** Senior Software Architect / Full Stack Engineer

---

## 1. Route yang Ditemukan (Sebelum Audit)

| Route | Status | Masalah |
|---|---|---|
| `/` | ❌ | Langsung redirect ke `/login` — tidak ada landing page |
| `/login` | ⚠️ | Ada tapi tidak ada link dari halaman lain |
| `/register` | ⚠️ | Ada tapi tidak ada link dari halaman lain |
| `/dashboard` | ⚠️ | Langsung menampilkan Riwayat Laporan, bukan dashboard |
| `/laporan/buat` | ⚠️ | Path tidak konsisten dengan struktur role |
| `/gis` | ⚠️ | Publik tapi path tidak intuitif |
| `/notifikasi` | ⚠️ | Path bahasa Indonesia campur |
| `/admin` | ⚠️ | Children: gis, laporan, notifikasi, pengguna (TBD) |
| `/petugas` | ❌ | Hanya dummy component "Dashboard Petugas (Protected)" |
| `/about` | ❌ | Tidak ada |
| `/contact` | ❌ | Tidak ada |
| `/unauthorized` | ❌ | Tidak ada — role check gagal hanya redirect ke `/` |
| `*` (404) | ❌ | Tidak ada — menampilkan halaman kosong |

---

## 2. Route yang Hilang (Sesuai PRD)

### Public
- `/` — Landing Page
- `/about` — Tentang Sistem
- `/contact` — Kontak

### Masyarakat
- `/dashboard` — Dashboard dengan widget statistik
- `/reports` — Redirect ke `/reports/history`
- `/reports/create` — Buat Laporan
- `/reports/history` — Riwayat Laporan
- `/map` — Peta GIS
- `/notifications` — Pusat Notifikasi
- `/profile` — Profil

### Admin
- `/admin/dashboard` — Dashboard Admin
- `/admin/reports` — Verifikasi & Manajemen Laporan
- `/admin/users` — Kelola Pengguna
- `/admin/officers` — Kelola Petugas
- `/admin/statistics` — Statistik
- `/admin/settings` — Pengaturan

### Petugas
- `/officer/dashboard` — Dashboard Petugas
- `/officer/tasks` — Tugas Saya
- `/officer/tasks/:id` — Detail & Update Progres
- `/officer/history` — Riwayat Penanganan
- `/officer/profile` — Profil

### Error
- `/unauthorized` — Akses ditolak (403)
- `/session-expired` — Sesi berakhir
- `*` — 404 Not Found

---

## 3. Route yang Diperbaiki

| Sebelum | Sesudah | Keterangan |
|---|---|---|
| `/` → redirect `/login` | `/` → Landing Page | Root menampilkan landing page publik |
| `/dashboard` → RiwayatLaporan | `/dashboard` → DashboardMasyarakat | Dashboard dengan widget statistik |
| `/laporan/buat` | `/reports/create` | Konsisten dengan struktur `/reports/*` |
| `/gis` | `/map` | Redirect `/gis` → `/map` untuk backward compatibility |
| `/notifikasi` | `/notifications` | Redirect `/notifikasi` → `/notifications` |
| `/admin` (children lama) | `/admin/dashboard` + 6 route baru | Struktur admin lengkap |
| `/petugas` (dummy) | `/officer/*` (4 route) | Dashboard petugas fungsional |
| Tidak ada | `/about`, `/contact` | Halaman publik baru |
| Tidak ada | `/unauthorized`, `/session-expired` | Halaman error 403 |
| Tidak ada | `*` → NotFoundPage | Halaman 404 |

---

## 4. Auth Flow

### Login Flow
1. User membuka `/login` (publik).
2. Form tervalidasi client-side (email format, password wajib diisi).
3. Request ke `POST /api/auth/login` (rate-limited 20/15mnt).
4. Server verifikasi bcrypt hash → menerbitkan JWT (exp 1d).
5. Token disimpan di Zustand persist (localStorage `auth-storage`).
6. Redirect otomatis sesuai role:
   - `admin` → `/admin/dashboard`
   - `petugas` → `/officer/dashboard`
   - `masyarakat` → `/dashboard`
7. Jika user sudah login dan membuka `/login`, otomatis redirect ke dashboard role-nya.

### Register Flow
1. User membuka `/register` (publik).
2. Validasi client-side: nama ≥3, email valid, password ≥8 + huruf besar/kecil/angka, konfirmasi cocok.
3. Password strength indicator real-time.
4. Request ke `POST /api/auth/register` (rate-limited).
5. Server: sanitasi input → cek duplikat email → bcrypt hash → simpan user (role `masyarakat`).
6. Error mapping: 409 → "Email sudah digunakan", 400 → pesan validasi, 500 → server error.

### Logout Flow
1. Tombol "Keluar" di sidebar semua layout.
2. `logout()` membersihkan Zustand store (user, token, isAuthenticated).
3. Redirect ke `/login`.

### JWT Storage
- Token disimpan di `localStorage` via Zustand persist (`auth-storage`).
- Axios interceptor menambahkan `Authorization: Bearer <token>` ke setiap request.
- Response 401 → auto logout + redirect ke `/login`.
- **Catatan keamanan:** localStorage rentan XSS. Rekomendasi fase berikutnya: httpOnly cookie + refresh token.

### Session Handling
- Tidak ada refresh token (JWT exp 1d).
- Saat token expired, API mengembalikan 401 → frontend logout otomatis.
- Halaman `/session-expired` tersedia untuk pesan sesi berakhir.

---

## 5. Navigation Flow

### Public Layout (PublicLayout)
- Navbar: Logo, Beranda, Tentang, Kontak, Masuk, Daftar
- Mobile: hamburger menu
- Footer: navigasi + kontak

### Masyarakat Layout (MasyarakatLayout)
- Sidebar: Dashboard, Buat Laporan, Riwayat Laporan, Peta GIS, Notifikasi, Profil, Keluar
- Mobile: drawer sidebar

### Admin Layout (AdminLayout)
- Sidebar: Dashboard, Verifikasi Laporan, Kelola Pengguna, Kelola Petugas, Statistik, Pengaturan, Keluar
- Mobile: drawer sidebar

### Petugas Layout (OfficerLayout)
- Sidebar: Dashboard, Tugas Saya, Riwayat Penanganan, Profil, Keluar
- Mobile: drawer sidebar

---

## 6. Role Flow

| Role | Home | Bisa Akses | Ditolak |
|---|---|---|---|
| `masyarakat` | `/dashboard` | `/dashboard`, `/reports/*`, `/map`, `/notifications`, `/profile` | `/admin/*`, `/officer/*` → 403 |
| `admin` | `/admin/dashboard` | `/admin/*`, `/map`, `/notifications` | `/officer/*`, `/dashboard` → 403 |
| `petugas` | `/officer/dashboard` | `/officer/*`, `/map`, `/notifications` | `/admin/*`, `/dashboard` → 403 |

### Implementasi
- `ProtectedRoute` membaca `isAuthenticated` dan `user.role` dari Zustand store.
- Belum login → redirect ke `/login` (dengan `state.from` untuk redirect back).
- Role tidak cocok → redirect ke `/unauthorized` (403).
- Sudak login membuka `/login` → redirect ke dashboard role-nya.

---

## 7. Endpoint Backend yang Ditambahkan

| Endpoint | Method | Keterangan |
|---|---|---|
| `/api/reports/mystats` | GET | Statistik laporan pribadi masyarakat |
| `/api/petugas/history` | GET | Riwayat penanganan petugas |
| `/api/admin/users` | GET | Daftar pengguna masyarakat (paginasi + search) |
| `/api/admin/activity` | GET | Aktivitas petugas terbaru |

---

## 8. Validasi

- [x] Tidak ada broken route — semua path mengarah ke komponen yang ada
- [x] Tidak ada menu yang hilang — semua item sidebar terhubung ke route
- [x] Login bekerja — redirect sesuai role
- [x] Register bekerja — validasi client + server
- [x] Logout bekerja — membersihkan session
- [x] Redirect sesuai role bekerja
- [x] Dashboard tampil sesuai role
- [x] Responsive mobile dan desktop — sidebar jadi drawer di mobile
- [x] 404 handler — route `*` menampilkan NotFoundPage
- [x] 403 handler — role tidak cocok menampilkan UnauthorizedPage
