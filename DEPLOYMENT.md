# DEPLOYMENT.md

Panduan setup, build, deploy, rollback, dan backup untuk Sistem Pelaporan Fasilitas Umum.

## 1. Setup Lokal

Prasyarat: Node.js 22, PostgreSQL 15/16, npm.

```bash
# Backend
cd backend
cp .env.example .env        # sesuaikan DATABASE_URL dan JWT_SECRET
npm install
npx prisma generate
npx prisma migrate dev      # atau: npx prisma db push
npm run dev

# Frontend
cd frontend
cp .env.example .env        # VITE_API_URL=http://localhost:5000/api
npm install
npm run dev
```

Aplikasi: frontend http://localhost:5173, backend http://localhost:5000.

## 2. Testing

```bash
cd backend && npm test      # vitest: unit, validasi, API/auth tests
cd frontend && npm test     # vitest: store & ProtectedRoute tests
```

## 3. Build

```bash
cd backend && npm run build     # -> dist/
cd frontend && npm run build    # -> dist/
```

## 4. Environment Variables

### Backend (`backend/.env`)

| Variable | Wajib | Keterangan |
|---|---|---|
| `PORT` | tidak | Port server (default 5000) |
| `NODE_ENV` | ya (production) | `production` / `development` / `test` |
| `DATABASE_URL` | ya | URL PostgreSQL |
| `JWT_SECRET` | ya | Secret JWT — wajib di production, gunakan string acak panjang |
| `JWT_EXPIRES_IN` | tidak | Default `1d` |
| `FRONTEND_URL` | ya | URL frontend untuk CORS & link email |
| `CORS_ORIGINS` | ya | Daftar origin diizinkan (koma) |
| `AI_MOCK_DELAY_MS` | tidak | Delay simulasi AI (default 800, test 0) |
| `ENABLE_EMAIL_NOTIFICATION` | tidak | `true`/`false` |
| `SMTP_HOST/PORT/SECURE/USER/PASS/FROM` | jika email aktif | Konfigurasi SMTP |

### Frontend

| Variable | Keterangan |
|---|---|
| `VITE_API_URL` | Base URL API, mis. `https://api.example.com/api` |

## 5. Deploy

### Opsi A — Docker Compose (VPS)

```bash
docker compose up -d --build
```

Ini menjalankan: PostgreSQL, backend (`:5000`, healthcheck `/health`), frontend (nginx `:80`).
Volume: `pgdata` (database), `uploads` (foto laporan).

### Opsi B — Vercel (frontend) + Railway (backend)

1. **Backend di Railway**: buat project dari repo, set root directory `backend`, tambahkan env vars (lihat tabel), gunakan Dockerfile. Jalankan `npx prisma migrate deploy` sebagai pre-deploy command atau bagian start command.
2. **Frontend di Vercel**: import repo, root directory `frontend`, tambahkan env var `VITE_API_URL` menunjuk URL backend, lalu deploy.
3. **Database**: PostgreSQL terkelola (Railway/Neon/Supabase). Set `DATABASE_URL` di backend.

## 6. Health Check & Graceful Shutdown

- `GET /health` mengecek koneksi database; return 200 (`ok`) atau 503.
- Server menangani `SIGINT`/`SIGTERM`: menutup HTTP server, disconnect Prisma, lalu exit. Timeout paksa 10 detik.

## 7. Rollback

- **Docker Compose**: `docker compose down`, checkout commit sebelumnya, `docker compose up -d --build`.
- **Railway/Vercel**: gunakan fitur "Redeploy"/rollback ke deployment sebelumnya di dashboard.
- **Database**: migrasi bersifat aditif (mis. menambah enum value). Untuk rollback schema, revert migrasi dengan `prisma migrate resolve` + jalankan migrasi balikan, atau restore dari backup.

## 8. Backup & Restore Database

```bash
# Backup
docker exec <db_container> pg_dump -U postgres laporan_fasilitas > backup_$(date +%Y%m%d).sql

# Restore
docker exec -i <db_container> psql -U postgres laporan_fasilitas < backup_YYYYMMDD.sql
```

Rekomendasi: jadwalkan backup harian (cron) dan simpan di lokasi terpisah (object storage).
File upload (`backend/public/uploads` atau volume `uploads`) di-backup terpisah.

## 9. Catatan Migrasi DITOLAK

Migrasi `20261006000000_add_ditolak_status` menambah nilai enum `DITOLAK`.
Jika database produksi sudah ada (di-sync via `db push`), tandai migrasi baseline terlebih dahulu:

```bash
npx prisma migrate resolve --applied 20261006000000_add_ditolak_status
```
