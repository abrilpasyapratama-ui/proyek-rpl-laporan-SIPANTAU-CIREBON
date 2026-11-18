# SYSTEM_ARCHITECTURE.md

## Diagram Arsitektur

```
┌────────────────────────────┐        HTTPS         ┌────────────────────────────┐
│  Frontend (React 18 + TS)  │  ──────────────────► │  Backend (Express + TS)    │
│  Vite, Tailwind, Leaflet,  │   REST /api/*        │  JWT auth, RBAC, Zod       │
│  Zustand, RR6              │ ◄──────────────────  │  validation, rate limiting │
└────────────┬───────────────┘                      │  multer upload, helmet     │
             │ deploy: Vercel                      └───────┬──────────┬──────────┘
                                                          │          │
                                              Prisma ORM  │          │ nodemailer
                                                          ▼          ▼
                                              ┌────────────────┐  ┌────────┐
                                              │  PostgreSQL 16 │  │  SMTP  │
                                              └────────────────┘  └────────┘
                                                          ▲
                                              deplop: Railway/VPS Docker
```

## Database Flow

- `users` (role: masyarakat | admin | petugas)
  - `reports` (user_id FK, status enum, koordinat lat/lng, ai_* fields)
  - `assignments` (report_id + petugas_id, unique pair)
  - `report_updates` (riwayat progres petugas, foto bukti)
  - `notifications` (per-user, is_read, metadata JSON)

Indeks: `reports(status)`, `reports(user_id)`, `reports(latitude,longitude)`,
`assignments(petugas_id)`, `report_updates(report_id)`, `notifications(user_id,is_read)`.

Status flow: `MENUNGGU_VERIFIKASI` → (admin verify) `DIPROSES` | `DITOLAK`
→ (petugas) `DALAM_PERBAIKAN` → `SELESAI`.

## API Flow

1. `POST /api/auth/register|login` (rate-limited, Zod-validated) → JWT (Bearer).
2. Client menyimpan token di Zustand (persist) dan mengirimkannya via Authorization header.
3. `authenticate` middleware memverifikasi JWT & cek user masih ada;
   `authorizeRole` membatasi akses admin/petugas.
4. `/api/admin/*`: stats, list (paginasi+search+filter status), verify, assign, priority.
5. `/api/petugas/*`: tasks, detail (hanya assignment miliknya), progress update (transaksi Prisma).
6. `/api/reports`: create (masyarakat, upload foto, AI analysis), history (paginasi).
7. `/api/gis/*`: publik, filter bbox/status/kategori/prioritas, format JSON & GeoJSON, Cache-Control.
8. `/api/notifications/*`: list, unread count, mark read, delete (hanya milik user).

Response standar: `{ status: 'success'|'error', message?, data?, meta? }`.

## AI Service Flow

- `IAIService.analyze(deskripsi, imagePath)` → `{ kategori, prioritas, confidence }`.
- Implementasi saat ini: `MockAIService` (heuristik kata kunci),
  delay simulasi via `AI_MOCK_DELAY_MS` (0 di test).
- Saat create report: hasil AI (`ai_kategori`, `ai_confidence`, `ai_priority`)
  disimpan bersama laporan; admin bisa menimpa dengan `PATCH /api/admin/reports/:id/priority`
  → memicu notifikasi `PERUBAHAN_PRIORITAS` ke petugas.
- Untuk mengganti ke provider nyata (OpenAI dsb.), implementasikan `IAIService`
  dan pilih via env di `services/ai/index.ts`.

## Notifikasi Flow

`notificationService` terpanggil oleh controller → simpan `notifications` row →
`emailService` mengirim email async (fire-and-forget; simulation log bila SMTP tidak dikonfigurasi).
Endpoint `/api/notifications` melayani in-app notification center.
