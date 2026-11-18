# SIPANTAU CIREBON

**Sistem Informasi Pelaporan dan Pemantauan Kerusakan Fasilitas Umum**

Platform berbasis web yang memungkinkan masyarakat melaporkan kerusakan fasilitas umum, sementara petugas lapangan dan administrator dapat mengelola, memverifikasi, serta memantau tindak lanjut laporan dari penciptaan sampai penyelesaian.

[![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933?logo=nodedotjson)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react)](https://reactjs.org/)
[![Vite](https://img.shields.io/badge/Vite-5.x-646CFF?logo=vite)](https://vitejs.dev/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-336791?logo=postgresql)](https://www.postgresql.org/)
[![Prisma](https://img.shields.io/badge/Prisma-ORM-2D3748?logo=prisma)](https://www.prisma.io/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

## Daftar Isi

- [Tentang Aplikasi](#tentang-aplikasi)
- [Tentang Pengembang](#tentang-pengembang)
- [Tujuan Pembuatan](#tujuan-pembuatan)
- [Fitur Aplikasi](#fitur-aplikasi)
- [Role Pengguna](#role-pengguna)
- [Status Laporan](#status-laporan)
- [Teknologi yang Digunakan](#teknologi-yang-digunakan)
- [Persyaratan Sistem](#persyaratan-sistem)
- [Struktur Folder](#struktur-folder)
- [Instalasi dan Konfigurasi](#instalasi-dan-konfigurasi)
- [Environment Variables](#environment-variables)
- [Menjalankan Aplikasi](#menjalankan-aplikasi)
- [Dokumentasi API](#dokumentasi-api)
- [Integrasi WhatsApp Fonnte](#integrasi-whatsapp-fonnte)
- [Integrasi Chatbot AI OpenRouter](#integrasi-chatbot-ai-openrouter)
- [Pengujian](#pengujian)
- [Keamanan](#keamanan)
- [Troubleshooting](#troubleshooting)
- [Deployment](#deployment)
- [Kontribusi](#kontribusi)
- [Lisensi dan Kontak](#lisensi-dan-kontak)

## Tentang Aplikasi

### Latar Belakang

SIPANTAU CIREBON dirancang sebagai sistem terpusat untuk pelaporan dan pemantauan kerusakan fasilitas umum di wilayah Cirebon. Masyarakat dapat dengan mudah melaporkan kerusakan (misalnya jalan berlubang, lampu jalan mati, drainase tersumbat) melalui aplikasi, sementara petugas lapangan dan administrator dapat memantau, memverifikasi, dan mengelola laporan tersebut secara terstruktur.

### Permasalahan yang Diselesaikan

- Kurangnya saluran komunikasi langsung antara masyarakat dan dinas terkait terkait kerusakan fasilitas umum.
- Sulitnya memantau status laporan dari waktu ke waktu.
- Tidak adanya sistem terpadu yang mencakup pelaporan, verifikasi, penugasan petugas, dan notifikasi.

### Tujuan Aplikasi

1. Memberikan saluran pelaporan fasilitas umum yang mudah diakses masyarakat.
2. Mempercepat verifikasi dan penanganan laporan oleh petugas dan administrator.
3. Memberikan transparansi status laporan kepada pelapor.
4. Mengelola notifikasi WhatsApp dan chatbot AI untuk dukungan pengguna.

### Manfaat

| Pihak | Manfaat |
|---|---|
| **Masyarakat** | Melaporkan kerusakan, memantau status laporan, menerima notifikasi WhatsApp, dan berbicara dengan chatbot AI. |
| **Petugas** | Menerima penugasan laporan, memperbarui progres, dan mengelola riwayat tugas. |
| **Administrator** | Mengelola pengguna, memverifikasi laporan, mengonfigurasi integrasi WhatsApp & AI, dan memantau statistik sistem. |

## Tentang Pengembang

Aplikasi SIPANTAU CIREBON dikembangkan oleh:

| Item | Detail |
|---|---|
| Nama Lengkap | [ISI NAMA LENGKAP] |
| NIM | [ISI NIM JIKA ADA] |
| Kelas | [ISI KELAS JIKA ADA] |
| Program Studi | [ISI PROGRAM STUDI] |
| Fakultas | [ISI FAKULTAS JIKA ADA] |
| Institusi | [ISI NAMA INSTITUSI] |
| Kota | Cirebon |
| Peran dalam Proyek | [ISI PERAN: Product Owner / System Analyst / UI/UX Designer / Full Stack Developer] |
| Email | [ISI EMAIL JIKA INGIN DITAMPILKAN] |
| GitHub | [ISI URL PROFIL GITHUB] |
| LinkedIn | [ISI URL LINKEDIN JIKA ADA] |

> **Catatan:** Data di atas masih berupa placeholder. Silakan ubah sesuai dengan identitas pengembang yang sebenarnya. Jangan membuat alamat atau akun fiktif.

## Tujuan Pembuatan

Aplikasi SIPANTAU CIREBON dibuat untuk membantu masyarakat melaporkan kerusakan fasilitas umum serta membantu petugas dan administrator memantau, memverifikasi, dan mengelola tindak lanjut laporan dari penciptaan sampai penyelesaian.

## Fitur Aplikasi

Berikut fitur yang sudah diimplementasikan berdasarkan kode sumber aplikasi:

| Fitur | Deskripsi | Status |
|---|---|---|
| **Autentikasi & Login** | Registrasi, login, logout, dan manajemen profil pengguna dengan JWT. | ✅ Tersedia |
| **Hak Akses Berbasis Role** | Pembagian akses sesuai role: masyarakat, petugas, dan admin. | ✅ Tersedia |
| **Pelaporan Kerusakan** | Masyarakat membuat laporan dengan judul, deskripsi, kategori, lokasi, koordinat, dan foto. | ✅ Tersedia |
| **Riwayat Laporan** | Melihat daftar dan detail laporan milik sendiri. | ✅ Tersedia |
| **Detail Laporan** | Melihat detail lengkap laporan termasuk status dan riwayat pembaruan. | ✅ Tersedia |
| **GIS / Peta** | Melihat laporan pada peta interaktif (Leaflet). | ✅ Tersedia |
| **Verifikasi Laporan** | Admin menyetujui atau menolak laporan yang masuk. | ✅ Tersedia |
| **Penugasan Petugas** | Admin menugaskan petugas pada laporan tertentu. | ✅ Tersedia |
| **Progress Petugas** | Petugas memperbarui status dan menambahkan catatan/foto bukti perbaikan. | ✅ Tersedia |
| **Manajemen Pengguna** | Admin melihat, mengedit, dan menonaktifkan akun pengguna. | ✅ Tersedia |
| **Notifikasi In-App** | Notifikasi sistem untuk laporan, tugas, dan perubahan status. | ✅ Tersedia |
| **Notifikasi WhatsApp (Fonnte)** | Notifikasi otomatis via WhatsApp Gateway Fonnte untuk laporan, tugas, dan admin. | ✅ Tersedia |
| **Chatbot AI (OpenRouter)** | Asisten virtual untuk menjawab pertanyaan pengguna, termasuk profil admin. | ✅ Tersedia |
| **Konfigurasi Integrasi** | Halaman admin untuk mengelola pengaturan WhatsApp dan AI tanpa mengedit `.env`. | ✅ Tersedia |
| **Integrasi Telegram** | Bot Telegram untuk notifikasi dan penghubung akun pengguna. | ✅ Tersedia |
| **Manajemen Petugas** | Admin mengelola pengajuan dan verifikasi akun petugas lapangan. | ✅ Tersedia |
| **Statistik** | Dashboard statistik laporan dan penggunaan sistem. | ✅ Tersedia |
| **Ubah Password** | Pengguna dapat mengubah password dengan verifikasi password lama. | ✅ Tersedia |

> Fitur yang tercantum di atas berdasarkan inspeksi kode sumber. Fitur yang tertulis dalam laporan terpisah namun tidak terlihat dalam kode sumber aktif tidak dicantumkan sebagai fitur produksi.

## Role Pengguna

Aplikasi memiliki tiga role pengguna yang diatur dalam skema database:

| Role | Deskripsi | Akses Utama |
|---|---|---|
| **Masyarakat** | Pengguna umum yang melaporkan kerusakan fasilitas. | Buat laporan, lihat riwayat laporan sendiri, profil, notifikasi, chatbot. |
| **Petugas** | Petugas lapangan yang menangani perbaikan fasilitas. | Lihat tugas yang ditugaskan, update progres, riwayat tugas, profil. |
| **Admin** | Administrator sistem dengan akses penuh. | Kelola pengguna, verifikasi laporan, tugas petugas, statistik, konfigurasi integrasi, semua laporan. |

Role disimpan dalam enum `Role` pada Prisma schema (`masyarakat`, `admin`, `petugas`). Endpoint admin dilindungi oleh middleware `authorizeRole(['admin'])`.

## Status Laporan

Setiap laporan memiliki siklus status berikut:

| Status | Keterangan |
|---|---|
| `MENUNGGU_VERIFIKASI` | Laporan baru belum diverifikasi oleh admin. |
| `DIPROSES` | Laporan sudah diverifikasi dan sedang ditangani. |
| `DALAM_PERBAIKAN` | Petugas sedang melakukan perbaikan di lapangan. |
| `SELESAI` | Perbaikan telah diselesaikan. |
| `DITOLAK` | Laporan tidak dapat diproses (ditolak admin). |

Alur umum: `MENUNGGU_VERIFIKASI` → `DIPROSES` → `DALAM_PERBAIKAN` → `SELESAI`, dengan kemungkinan `DITOLAK` pada setiap tahap verifikasi.

## Teknologi yang Digunakan

### Frontend

| Teknologi | Fungsi | Keterangan |
|---|---|---|
| React 18 | Library antarmuka pengguna | SPA dengan Vite |
| TypeScript | Bahasa pemrograman | Typing statis untuk frontend |
| Vite | Build tool & dev server | Pengembangan cepat dan produksi build |
| React Router DOM | Routing klien | Navigasi halaman tanpa reload |
| Zustand | Manajemen state | State global autentikasi |
| React Hook Form + Zod | Form & validasi | Input form dengan skema validasi |
| Lucide React | Ikon | Ikon antarmuka pengguna |
| Leaflet + React Leaflet | Peta GIS | Tampilan peta laporan |
| Axios | HTTP client | Komunikasi ke backend API |
| Tailwind CSS | Styling | Desain antarmuka responsif |

### Backend

| Teknologi | Fungsi | Keterangan |
|---|---|---|
| Node.js | Runtime JavaScript | Server aplikasi |
| Express | Framework web | Routing dan middleware HTTP |
| TypeScript | Bahasa pemrograman | Typing statis untuk backend |
| Prisma ORM | ODM/ORM | Akses database PostgreSQL |
| PostgreSQL | Database relational | Penyimpanan data utama |
| JWT (jsonwebtoken) | Autentikasi | Token-based session |
| bcryptjs | Hashing password | Keamanan kata sandi |
| Zod | Validasi input | Skema validasi request |
| Nodemailer | Notifikasi email | Pengiriman email sistem |
| Express Rate Limit | Rate limiting | Perlindungan dari spam |
| Helmet | Keamanan HTTP | Header keamanan |
| Vitest | Framework pengujian | Unit & integration test |

### Integrasi Eksternal

| Layanan | Fungsi | Keterangan |
|---|---|---|
| Fonnte | WhatsApp Gateway | Notifikasi WhatsApp otomatis |
| OpenRouter | AI Chatbot Provider | Model AI untuk asisten virtual |
| Telegram Bot API | Notifikasi alternatif | Bot Telegram & penghubung akun |
| Nodemailer (SMTP) | Email | Notifikasi email opsional |

## Persyaratan Sistem

Sebelum menginstal, pastikan sistem memenuhi syarat berikut:

| Komponen | Versi Minimum | Keterangan |
|---|---|---|
| Node.js | 18+ | Runtime JavaScript |
| npm | 9+ | Manajer paket Node.js |
| PostgreSQL | 15+ | Database relational |
| Git | 2.x | Version control |
| Browser modern | Chrome/Firefox/Edge | Klien antarmuka pengguna |

## Struktur Folder

```text
laporan_fasilitas/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma          # Skema database Prisma
│   │   └── migrations/            # Migrasi database
│   ├── src/
│   │   ├── config.ts              # Konfigurasi aplikasi
│   │   ├── controllers/           # Kontroler logika bisnis
│   │   ├── middlewares/           # Auth, rate limit, validasi, error
│   │   ├── routes/                # Rute API
│   │   ├── services/              # Layanan bisnis (AI, WhatsApp, Telegram, dll)
│   │   ├── types/                 # TypeScript type definitions
│   │   ├── utils/                 # Utilitas (DB, JWT, logger, phone)
│   │   └── validation/            # Skema validasi Zod
│   ├── scripts/                   # Skrip utilitas & verifikasi
│   ├── tests/                     # Ujian otomatis (Vitest)
│   ├── .env                       # Variabel lingkungan (jangan di-commit)
│   ├── .env.example               # Contoh variabel lingkungan
│   ├── Dockerfile                 # Kontainerisasi backend
│   ├── package.json               # Dependency & skrip backend
│   └── tsconfig.json              # Konfigurasi TypeScript
├── frontend/
│   ├── src/
│   │   ├── components/            # Komponen UI dapat digunakan ulang
│   │   ├── features/              # Fitur-fitur aplikasi
│   │   ├── hooks/                 # Custom React hooks
│   │   ├── layouts/               # Tata letak halaman
│   │   ├── pages/                 # Halaman aplikasi
│   │   │   ├── admin/             # Halaman administrator
│   │   │   ├── auth/              # Login & registrasi
│   │   │   ├── error/             # Halaman kesalahan
│   │   │   ├── laporan/           # Halaman laporan
│   │   │   ├── masyarakat/        # Dashboard masyarakat
│   │   │   ├── notifications/     # Pusat notifikasi
│   │   │   ├── officer/           # Halaman petugas
│   │   │   ├── public/            # Halaman publik
│   │   │   └── shared/            # Halaman bersama (profil)
│   │   ├── router/                # Konfigurasi routing
│   │   ├── services/              # Layanan API frontend
│   │   ├── store/                 # State management (Zustand)
│   │   ├── types/                 # TypeScript type definitions
│   │   └── utils/                 # Utilitas frontend
│   ├── public/                    # Aset statis
│   ├── .env.example               # Contoh variabel lingkungan
│   ├── Dockerfile                 # Kontainerisasi frontend
│   ├── nginx.conf                 # Konfigurasi Nginx (produksi)
│   ├── package.json               # Dependency & skrip frontend
│   └── tsconfig.json              # Konfigurasi TypeScript
├── .gitignore                     # File & folder yang diabaikan Git
├── docker-compose.yml             # Orkes­trasi kontainer
├── package-lock.json              # Lock file root
└── README.md                      # Dokumentasi ini
```

> Catatan: Folder `backend/node_modules/`, `frontend/node_modules/`, `backend/dist/`, `frontend/dist/`, dan `*.env` biasanya diabaikan oleh Git (lihat `.gitignore`).

## Instalasi dan Konfigurasi

Ikuti langkah berikut untuk menjalankan aplikasi secara lokal:

### 1. Clone Repository

```bash
git clone <url-repositori>
cd laporan_fasilitas
```

### 2. Instal Dependency Backend

```bash
cd backend
npm install
```

### 3. Instal Dependency Frontend

```bash
cd ../frontend
npm install
```

### 4. Buat Database PostgreSQL

Buat database baru di PostgreSQL, misalnya `laporan_fasilitas`.

### 5. Konfigurasi Environment Variable

Salin contoh file `.env.example` ke `.env` pada backend dan frontend, lalu isi nilai yang sesuai.

**Backend:**
```bash
cd backend
cp .env.example .env
```

**Frontend:**
```bash
cd ../frontend
cp .env.example .env
```

Isi variabel penting di `backend/.env` (jangan menampilkan atau commit nilai asli):

- `DATABASE_URL` — String koneksi PostgreSQL.
- `JWT_SECRET` — Kunci rahasia untuk JWT (minimal 32 karakter).
- `INTEGRATION_ENCRYPTION_KEY` — Kunci enkripsi AES-256-GCM untuk token integrasi (64 karakter hex).
- `FONNTE_TOKEN` — Token WhatsApp Gateway Fonnte (diisi admin).
- `OPENROUTER_API_KEY` — API key OpenRouter (fallback untuk chatbot).
- `TELEGRAM_BOT_TOKEN` — Token bot Telegram (opsional).
- `SMTP_USER` / `SMTP_PASS` — Kredensial email (opsional).

### 6. Jalankan Migrasi Prisma

```bash
cd backend
npx prisma migrate dev
npx prisma generate
```

### 7. Jalankan Seed (Opsional)

Jika tersedia data awal:

```bash
npm run seed
```

### 8. Jalankan Backend

```bash
npm run dev
```

Backend akan berjalan di `http://localhost:5000`.

### 9. Jalankan Frontend

```bash
cd ../frontend
npm run dev
```

Frontend akan berjalan di `http://localhost:5173`.

## Environment Variables

Berikut variabel lingkungan yang digunakan aplikasi. Gunakan nilai placeholder, **jangan** memasukkan kredensial asli.

### Database

| Variabel | Fungsi | Wajib | Contoh |
|---|---|---|---|
| `DATABASE_URL` | String koneksi PostgreSQL | Ya | `postgresql://user:pass@localhost:5432/db` |

### Server & Auth

| Variabel | Fungsi | Wajib | Contoh |
|---|---|---|---|
| `PORT` | Port backend | Tidak | `5000` |
| `JWT_SECRET` | Kunci rahasia JWT | Ya | `your-super-secret-jwt-key-min-32-chars` |
| `JWT_EXPIRES_in` | Masa berlaku token | Tidak | `1d` |
| `NODE_ENV` | Lingkungan aplikasi | Tidak | `development` |
| `FRONTEND_URL` | URL frontend untuk CORS | Tidak | `http://localhost:5173` |
| `CORS_ORIGINS` | Origin yang diizinkan CORS | Tidak | `http://localhost:5173` |

### Email (Nodemailer, Opsional)

| Variabel | Fungsi | Wajib | Contoh |
|---|---|---|---|
| `ENABLE_EMAIL_NOTIFICATION` | Aktifkan notifikasi email | Tidak | `true` |
| `SMTP_HOST` | Host SMTP | Tidak | `smtp.gmail.com` |
| `SMTP_PORT` | Port SMTP | Tidak | `587` |
| `SMTP_USER` | Pengguna SMTP | Tidak | `your-email@gmail.com` |
| `SMTP_PASS` | Kata sandi aplikasi SMTP | Tidak | `your-app-password` |
| `SMTP_FROM` | Pengirim email | Tidak | `SIPANTAU CIREBON <no-reply@...>` |

### WhatsApp Fonnte

| Variabel | Fungsi | Wajib | Contoh |
|---|---|---|---|
| `WHATSAPP_ENABLED` | Aktifkan gateway WhatsApp | Tidak | `true` |
| `WHATSAPP_PROVIDER` | Provider WhatsApp | Tidak | `fonnte` |
| `FONNTE_ENABLED` | Aktifkan kanal Fonnte | Tidak | `true` |
| `FONNTE_TOKEN` | Token API Fonnte | Ya (untuk WhatsApp) | `your-fonnte-token` |
| `FONNTE_API_URL` | URL API Fonnte | Tidak | `https://api.fonnte.com` |
| `FONNTE_ADMIN_RECIPIENTS` | Nomor penerima admin (pisah koma) | Tidak | `6285147722749` |
| `FONNTE_TIMEOUT_MS` | Timeout request (ms) | Tidak | `15000` |
| `FONNTE_MAX_RETRIES` | Maksimal percobaan ulang | Tidak | `3` |

### AI Chatbot (OpenRouter)

| Variabel | Fungsi | Wajib | Contoh |
|---|---|---|---|
| `AI_CHATBOT_ENABLED` | Aktifkan chatbot AI | Tidak | `true` |
| `AI_PROVIDER` | Provider AI | Tidak | `openrouter` |
| `AI_BASE_URL` | URL endpoint AI | Tidak | `https://openrouter.ai/api/v1` |
| `AI_MODEL` | Model AI default | Tidak | `openai/gpt-4o-mini` |
| `AI_TEMPERATURE` | Suhu respons AI | Tidak | `0.3` |
| `AI_MAX_TOKENS` | Maksimal token respons | Tidak | `800` |
| `AI_TIMEOUT_MS` | Timeout request AI (ms) | Tidak | `30000` |
| `AI_API_KEY` | API key AI (fallback) | Tidak | `your-api-key` |

### Enkripsi Konfigurasi Integrasi

| Variabel | Fungsi | Wajib | Contoh |
|---|---|---|---|
| `INTEGRATION_ENCRYPTION_KEY` | Kunci AES-256-GCM untuk token integrasi | Ya (untuk menyimpan token di DB) | `64-karakter-hex` |

Buat kunci dengan:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Telegram (Opsional)

| Variabel | Fungsi | Wajib | Contoh |
|---|---|---|---|
| `TELEGRAM_ENABLED` | Aktifkan bot Telegram | Tidak | `false` |
| `TELEGRAM_BOT_TOKEN` | Token bot Telegram | Tidak | `123456:ABC-DEF...` |
| `TELEGRAM_ADMIN_CHAT_ID` | Chat ID admin | Tidak | `123456789` |
| `TELEGRAM_BOT_USERNAME` | Username bot (tanpa @) | Tidak | `SIPANTAU_CIREBON_Bot` |
| `TELEGRAM_WEBHOOK_SECRET` | Secret webhook Telegram | Tidak | `random-secret` |
| `TELEGRAM_PUBLIC_URL` | URL publik backend untuk webhook | Tidak | `https://api.domain.com` |

> **Penting:** Jangan pernah menampilkan atau commit nilai asli dari `JWT_SECRET`, `FONNTE_TOKEN`, `AI_API_KEY`, `TELEGRAM_BOT_TOKEN`, `SMTP_PASS`, atau `INTEGRATION_ENCRYPTION_KEY` ke version control. File `.env` sudah masuk `.gitignore`.

## Menjalankan Aplikasi

Jalankan backend dan frontend pada terminal terpisah:

**Terminal 1 — Backend:**
```bash
cd backend
npm run dev
```

**Terminal 2 — Frontend:**
```bash
cd frontend
npm run dev
```

Akses aplikasi di browser: `http://localhost:5173`

Backend API tersedia di: `http://localhost:5000`

## Dokumentasi API

Semua endpoint backend diawali dengan prefix `/api`. Endpoint admin memerlukan autentikasi JWT dengan role `admin`.

### Authentication

| Method | Endpoint | Deskripsi | Auth |
|---|---|---|---|
| POST | `/api/auth/register` | Registrasi pengguna baru | Tidak |
| POST | `/api/auth/login` | Login dan terima token JWT | Tidak |
| GET | `/api/auth/me` | Data pengguna saat ini | JWT |
| PATCH | `/api/auth/profile` | Perbarui profil sendiri | JWT |
| PATCH | `/api/auth/password` | Ubah password sendiri | JWT |

### Users (Admin)

| Method | Endpoint | Deskripsi | Auth |
|---|---|---|---|
| GET | `/api/admin/users` | Daftar semua pengguna | JWT + Admin |
| GET | `/api/admin/users/:id` | Detail satu pengguna | JWT + Admin |
| PATCH | `/api/admin/users/:id` | Edit data pengguna | JWT + Admin |
| DELETE | `/api/admin/users/:id` | Nonaktifkan/hapus pengguna | JWT + Admin |
| PATCH | `/api/admin/users/:id/role` | Ubah role pengguna | JWT + Admin |
| GET | `/api/admin/users/lookup` | Cari pengguna via nomor HP | JWT + Admin |

### Reports

| Method | Endpoint | Deskripsi | Auth |
|---|---|---|---|
| POST | `/api/reports` | Buat laporan baru | JWT |
| GET | `/api/reports` | Daftar laporan (admin) | JWT + Admin |
| GET | `/api/reports/map` | Data laporan untuk peta | Tidak |
| GET | `/api/reports/history` | Riwayat laporan sendiri | JWT |
| GET | `/api/reports/mystats` | Statistik laporan sendiri | JWT |
| GET | `/api/reports/:id` | Detail laporan | JWT |
| PUT | `/api/reports/:id/verify` | Verifikasi/tolak laporan | JWT + Admin |
| PATCH | `/api/reports/:id/priority` | Ubah prioritas laporan | JWT + Admin |

### Assignments (Petugas)

| Method | Endpoint | Deskripsi | Auth |
|---|---|---|---|
| GET | `/api/admin/assignments` | Daftar penugasan | JWT + Admin |
| POST | `/api/admin/reports/:id/assign` | Tugaskan petugas pada laporan | JWT + Admin |
| PATCH | `/api/admin/assignments/:reportId` | Ubah penugasan petugas | JWT + Admin |
| DELETE | `/api/admin/assignments/:reportId/:petugasId` | Batalkan penugasan | JWT + Admin |
| GET | `/api/petugas/tasks` | Tugas petugas sendiri | JWT |
| POST | `/api/petugas/tasks/:id/update` | Update progres tugas | JWT |

### Notifications

| Method | Endpoint | Deskripsi | Auth |
|---|---|---|---|
| GET | `/api/notifications` | Daftar notifikasi | JWT |
| GET | `/api/notifications/unread-count` | Jumlah belum dibaca | JWT |
| PATCH | `/api/notifications/:id/read` | Tandai dibaca | JWT |
| PATCH | `/api/notifications/mark-all-read` | Tandai semua dibaca | JWT |
| DELETE | `/api/notifications/:id` | Hapus notifikasi | JWT |
| DELETE | `/api/notifications/clear-all` | Hapus semua notifikasi | JWT |

### AI Chatbot

| Method | Endpoint | Deskripsi | Auth |
|---|---|---|---|
| POST | `/api/chat` | Kirim pesan ke chatbot | JWT |
| GET | `/api/chat/conversations` | Daftar percakapan | JWT |
| GET | `/api/chat/conversations/:id` | Detail percakapan | JWT |
| DELETE | `/api/chat/conversations/:id` | Hapus percakapan | JWT |
| GET | `/api/chat/analytics/summary` | Statistik percakapan (admin) | JWT + Admin |

### Settings / Integrations (Admin)

| Method | Endpoint | Deskripsi | Auth |
|---|---|---|---|
| GET | `/api/admin/integrations/whatsapp/status` | Status WhatsApp Gateway | JWT + Admin |
| PATCH | `/api/admin/integrations/whatsapp/settings` | Simpan pengaturan WhatsApp | JWT + Admin |
| POST | `/api/admin/integrations/whatsapp/test-connection` | Uji koneksi Fonnte | JWT + Admin |
| POST | `/api/admin/integrations/whatsapp/test-message` | Kirim pesan percobaan | JWT + Admin |
| GET | `/api/admin/integrations/whatsapp/history` | Riwayat pengiriman WhatsApp | JWT + Admin |
| GET | `/api/admin/integrations/ai/status` | Status konfigurasi AI | JWT + Admin |
| PATCH | `/api/admin/integrations/ai/settings` | Simpan pengaturan AI | JWT + Admin |
| POST | `/api/admin/integrations/ai/test-connection` | Uji koneksi penyedia AI | JWT + Admin |
| POST | `/api/admin/integrations/ai/test-chat` | Uji chatbot (tanpa riwayat) | JWT + Admin |
| GET | `/api/admin/integrations/history` | Riwayat perubahan konfigurasi | JWT + Admin |

### Admin Lainnya

| Method | Endpoint | Deskripsi | Auth |
|---|---|---|---|
| GET | `/api/admin/stats` | Statistik sistem | JWT + Admin |
| GET | `/api/admin/reports` | Kelola laporan (admin) | JWT + Admin |
| GET | `/api/admin/petugas` | Daftar petugas | JWT + Admin |
| GET | `/api/admin/verifications` | Pengajuan petugas | JWT + Admin |
| PATCH | `/api/admin/verifications/:id` | Setujui/tolak petugas | JWT + Admin |
| GET | `/api/admin/activity` | Log aktivitas | JWT + Admin |

## Integrasi WhatsApp Fonnte

### Fungsi

Integrasi WhatsApp menggunakan gateway **Fonnte** untuk mengirim notifikasi otomatis kepada masyarakat, petugas, dan administrator terkait laporan, tugas, dan aktivitas sistem.

### Cara Konfigurasi

1. Login sebagai administrator.
2. Buka halaman **Pengaturan → Konfigurasi Integrasi** → tab **WhatsApp Gateway**.
3. Isi **API Token Fonnte** (dapatkan dari dashboard Fonnte: https://fonnte.com).
4. Isi **Nomor WhatsApp Admin** (penerima notifikasi sistem, format internasional tanpa `+`, pisahkan koma bila beberapa).
5. Aktifkan jenis notifikasi yang diinginkan (registrasi, laporan, tugas, admin).
6. Klik **Simpan Konfigurasi**.
7. Klik **Uji Koneksi** untuk memastikan token dan device terhubung.
8. Klik **Kirim Pesan Percobaan** untuk memverifikasi pengiriman.

### Keamanan Token

- Token disimpan **terenkripsi (AES-256-GCM)** di database bila kunci `INTEGRATION_ENCRYPTION_KEY` tersedia.
- Token **tidak pernah** dikembalikan ke frontend, dicatat ke log, atau disertakan dalam respons API.
- Saat halaman konfigurasi dibuka, hanya ditampilkan status "tersedia/belum tersedia", bukan nilai token.
- Input token kosong saat mengedit berarti mempertahankan token lama.

### Pengujian Pengiriman

Gunakan tombol **Kirim Pesan Percobaan** di halaman konfigurasi. Status pengiriman dapat dipantau di bagian **Riwayat Pengiriman**. Status `sent` berarti API Fonnte telah menerima pesan (masuk antrean), bukan jaminan pesan telah sampai ke perangkat penerima.

## Integrasi Chatbot AI OpenRouter

### Fungsi

Chatbot AI ("Asisten SIPANTAU") membantu pengguna menanyakan informasi seputar aplikasi, termasuk profil admin, status laporan, dan panduan penggunaan sistem. Chatbot menggunakan fungsi pemanggilan alat (function calling) untuk mengakses data laporan, statistik, dan profil pengguna dengan batasan hak akses.

### Konfigurasi Provider

Didukung tiga provider:
- **OpenRouter** (default) — `https://openrouter.ai/api/v1`
- **OpenAI** — `https://api.openai.com/v1`
- **Custom** — endpoint OpenAI-compatible sendiri

Administrator dapat mengganti provider, model, temperature, max tokens, timeout, dan system prompt melalui halaman **Konfigurasi Integrasi → tab AI Chatbot Provider**.

### Model AI

Model default: `openai/gpt-4o-mini`. Model dapat diganti kapan saja tanpa mengubah kode sumber. Ketersediaan model divalidasi saat uji koneksi melalui endpoint `/models` penyedia.

### Cara Menguji

1. Login sebagai admin.
2. Buka halaman **Konfigurasi Integrasi → tab AI Chatbot Provider**.
3. Isi API Key dan pilih model.
4. Klik **Uji Koneksi** untuk memvalidasi API key dan model.
5. Klik **Uji Chatbot** untuk mengirim pesan uji dan melihat jawaban AI.

Uji chatbot **tidak membuat** percakapan atau pesan palsu di riwayat pengguna sebenarnya.

### Penanganan Error

- Jika API key belum diisi, chatbot mengembalikan status `503` dengan pesan konfigurasi belum lengkap.
- Jika provider menolak request, pesan error disanitasi (API key tidak terpapar) dan ditampilkan ke admin.
- Request memiliki timeout agar tidak menangguhkan respons antarmuka secara berlebihan.

## Pengujian

Aplikasi mencakup ujian otomatis dengan **Vitest** untuk backend dan frontend.

### Backend Tests

```bash
cd backend
npm test
```

Hasil terbaru: **19 file / 244 tes lulus** (termasuk ujian integrasi WhatsApp & AI).

### Frontend Tests

```bash
cd frontend
npm test
```

Hasil terbaru: **14 file / 103 tes lulus** (termasuk ujian halaman konfigurasi integrasi).

### Lint (Frontend)

```bash
cd frontend
npm run lint
```

### Build Semua

```bash
cd backend && npm run build
cd ../frontend && npm run build
```

> Pengujian nyata terhadap API Fonnte dan OpenRouter sungguhan hanya dilakukan jika kredensial dan izin telah tersedia. Ujian otomatis menggunakan mock API.

## Keamanan

Berikut praktik keamanan yang diterapkan:

- **Password** disimpan dalam bentuk hash bcrypt (tidak pernah plaintext di source code, log, atau database).
- **JWT** digunakan untuk autentikasi, dengan middleware `authenticate`, `requireActive`, dan `authorizeRole` melindungi endpoint.
- **Validasi input** menggunakan skema Zod pada seluruh endpoint yang menerima body.
- **Proteksi endpoint** berdasarkan role (`masyarakat`, `petugas`, `admin`). Admin tidak dapat mengubah/menonaktifkan akun sendiri, dan sistem wajib memiliki minimal satu admin aktif.
- **Perlindungan kredensial API**: token Fonnte dan API key OpenRouter tidak pernah dikembalikan ke frontend, dicatat ke log, atau disimpan dalam audit log. Nilai rahasia dienkripsi AES-256-GCM sebelum disimpan di database.
- **Pengelolaan file `.env`**: sudah masuk `.gitignore` dan tidak di-commit ke version control.
- **Backup database**: disarankan melakukan backup sebelum migrasi atau operasi yang mengubah data.

### Rekomendasi Belum Diterapkan

- Penggunaan HTTPS untuk deployment produksi (konfigurasi webhook Telegram memerlukan URL HTTPS publik).
- Rotasi rutin kunci enkripsi `INTEGRATION_ENCRYPTION_KEY`.

## Troubleshooting

| Masalah | Penyebab Kemungkinan | Solusi |
|---|---|---|
| Database gagal terkoneksi | `DATABASE_URL` salah atau Postgre belum aktif | Periksa `.env` dan pastikan PostgreSQL berjalan |
| Prisma migration gagal | Skema tidak sinkron dengan database | Jalankan `npx prisma migrate dev` atau reset database uji |
| Backend tidak berjalan | Port 5000 sudah digunakan atau error kompilasi | Periksa log konsol dan pastikan `npm run build` lulus |
| Frontend gagal terhubung ke backend | `VITE_API_URL` salah atau backend mati | Periksa `frontend/.env.example` dan URL backend |
| JWT/login bermasalah | `JWT_SECRET` kosong atau token kedaluwarsa | Isi `JWT_SECRET` di `.env` dan login ulang |
| Fonnte gagal mengirim pesan | `FONNTE_TOKEN` kosong atau device terputus | Isi token di `.env` atau halaman konfigurasi, lalu uji koneksi |
| OpenRouter gagal merespons | API key kosong atau model tidak tersedia | Isi `AI_API_KEY`/`OPENROUTER_API_KEY` dan pilih model yang valid |
| Port sudah digunakan | Proses lain menggunakan port 5000/5173 | Ganti port di `.env` atau `vite.config.ts` |

## Deployment

Konfigurasi deployment menggunakan Docker tersedia:

- `backend/Dockerfile` — kontainerisasi backend Node.js.
- `frontend/Dockerfile` — kontainerisasi frontend React.
- `docker-compose.yml` — orkestrasi layanan (backend, frontend, PostgreSQL).

Untuk produksi, disarankan:
1. Menggunakan variabel lingkungan produksi yang aman (bukan nilai development).
2. Mengaktifkan HTTPS untuk semua endpoint.
3. Mengonfigurasi `TELEGRAM_PUBLIC_URL` dan webhook Telegram bila notifikasi Telegram digunakan.
4. Melakukan backup database sebelum migrasi produksi.
5. Mengatur `INTEGRATION_ENCRYPTION_KEY` yang sama pada semua instance backend.

> Panduan deployment spesifik untuk penyedia cloud (Railway, AWS, dll.) belum tersedia dalam dokumentasi proyek. Gunakan panduan umum di atas dan disesuaikan dengan kebutuhan infrastruktur.

## Kontribusi

Developer lain yang ingin berkontribusi dapat mengikuti langkah berikut:

1. Fork repository ini.
2. Buat branch fitur baru (`git checkout -b fitur/nama-fitur`).
3. Lakukan perubahan dan pastikan semua tes lulus (`npm test` di backend dan frontend).
4. Commit perubahan dengan pesan yang jelas.
5. Dorong ke branch (`git push origin fitur/nama-fitur`).
6. Buat Pull Request untuk direview.

Pastikan perubahan tidak merusak data produksi dan selalu sertakan ujian otomatis untuk fitur baru.

## Lisensi dan Kontak

### Tentang Pengembang

Aplikasi SIPANTAU CIREBON dikembangkan oleh:

| Item | Detail |
|---|---|
| Nama Lengkap | [ABRIL PASYA PRATAMA] |
| NIM | [41257080] |
| Kelas | [1A-2025] |
| Program Studi | [TEKNIK INFORMATIKA] |
| Kota | Cirebon |
| Peran dalam Proyek | [ISI PERAN: Product Owner / System Analyst / UI/UX Designer / Full Stack Developer] |
| Email | [abrilpasyapratama@gmail.com] |

> **Catatan:** Data di atas masih berupa placeholder. Silakan ubah sesuai dengan identitas pengembang yang sebenarnya. Jangan membuat alamat atau akun fiktif.

### Informasi Proyek

- Nama Aplikasi: SIPANTAU CIREBON
- Kepanjangan: Sistem Informasi Pelaporan dan Pemantauan Kerusakan Fasilitas Umum
- Deskripsi: Platform berbasis web yang memungkinkan masyarakat melaporkan kerusakan fasilitas umum, sementara petugas lapangan dan administrator dapat mengelola, memverifikasi, serta memantau tindak lanjut laporan.
- Tujuan Pengembangan: Memberikan saluran pelaporan fasilitas umum yang mudah diakses masyarakat serta membantu petugas dan administrator memantau, memverifikasi, dan mengelola tindak lanjut laporan.
- Tahun Pengembangan: 2026

### Tujuan Pembuatan

Aplikasi ini dibuat untuk membantu masyarakat melaporkan kerusakan fasilitas umum serta membantu petugas memantau dan mengelola tindak lanjut laporan.

> **Catatan:** Jangan membuat alamat atau akun fiktif. Isi hanya data yang telah Anda berikan.

### Hak Cipta

Copyright © 2026 [NAMA PENGEMBANG]

Lisensi proyek belum ditentukan dalam berkas repository. Dilarang mengklaim lisensi tertentu jika belum ditentukan oleh pemilik proyek.

---

> **Catatan Penting:** Tidak ada berkas rahasia (`.env`, token, API key, kata sandi) yang dimasukkan ke dalam dokumentasi ini. Semua contoh nilai adalah placeholder. Dokumentasi ini berdasarkan inspeksi kode sumber aplikasi SIPANTAU CIREBON pada tanggal pembuatan.