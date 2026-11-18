# PRODUCTION_CHECKLIST.md

## Security Checklist

- [x] JWT secret via environment variable, tanpa fallback hardcoded di production
- [x] Password di-hash dengan bcrypt (cost 10)
- [x] Validasi seluruh body request API dengan Zod
- [x] Sanitasi string input (trim, strip `<>`)
- [x] Proteksi SQL Injection via Prisma parameterized queries (hindari raw query)
- [x] React escaping otomatis untuk XSS; helmet diaktifkan
- [x] CORS whitelist via `CORS_ORIGINS`
- [x] Rate limiting: global, auth (login/register), upload
- [x] Secure file upload: mime-type JPEG/PNG, batas 5MB, nama file acak
- [x] RBAC di semua rute admin/petugas; petugas hanya bisa update tugas miliknya
- [x] Audit log aktivitas penting (login, registrasi, login gagal)
- [x] Error handler global — tidak membocorkan stack trace ke client
- [x] `x-powered-by` dimatikan, `trust proxy` dikonfigurasi
- [ ] HTTPS wajib di lingkungan production (di-handle oleh reverse proxy/Vercel/Railway)
- [ ] Secret SMTP & JWT tidak boleh di-commit (gunakan `.env` non-repo)

## Performance Checklist

- [x] Indeks Prisma pada `reports(status)`, `reports(user_id)`, `reports(latitude, longitude)`, `notifications(user_id, is_read)`
- [x] Endpoint GIS: lean projection, bbox filter, limit maksimal 5000, Cache-Control header
- [x] Pagination konsisten pada admin reports, riwayat, notifikasi
- [x] Query stats menggunakan `Promise.all` & `count` paralel
- [x] Delay mock AI dapat diatur via env (0 di test/production mock)
- [x] Frontend: manualChunks (react & leaflet vendor split)
- [ ] Tambahkan CDN untuk aset & uploads di production
- [ ] Pertimbangkan caching Redis untuk endpoint GIS bila traffic tinggi

## Monitoring Checklist

- [x] Structured JSON logging (`utils/logger`) — siap dikirim ke Sentry/Datadog
- [x] `/health` endpoint (liveness + DB readiness) untuk health check Docker/Railway
- [x] Error tracking hook: `componentDidCatch` di ErrorBoundary, logger.error di backend
- [x] Audit log untuk auth events
- [ ] Pasang Sentry/LogTTL/Better Stack di production
- [ ] Alert untuk error rate & response time

## Deployment Checklist

- [x] Dockerfile frontend (multi-stage + nginx + healthcheck)
- [x] Dockerfile backend (multi-stage, non-root user, healthcheck)
- [x] docker-compose.yml (db, backend, frontend, healthchecks, volume)
- [x] GitHub Actions CI: lint, test, build, security scan, docker build
- [x] `.env.example` untuk frontend & backend
- [x] `.gitignore` untuk `.env`, `node_modules`, `dist`
- [x] Migrasi database ter-version (`prisma/migrations`)
- [ ] Set secret `JWT_SECRET`, `DATABASE_URL`, `CORS_ORIGINS` di platform deploy
- [ ] Jalankan `npx prisma migrate deploy` saat deploy
- [ ] Smoke test endpoint `/health` & login setelah deploy
- [ ] Jadwal backup database harian
