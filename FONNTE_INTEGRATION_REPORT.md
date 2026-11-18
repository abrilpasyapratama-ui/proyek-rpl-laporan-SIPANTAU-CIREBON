# LAPORAN INTEGRASI FONNTE WHATSAPP — SIPANTAU CIREBON

**Tanggal:** 15 November 2026
**Status:** Implementasi selesai, build & test lolos. Kanal **menunggu token Fonnte** diisi administrator.

---

## 1. Ringkasan

Integrasi Fonnte **sudah ada** di proyek (provider `fonte` pada `whatsapp.service.ts`).
Pekerjaan ini **menyempurnakan** integrasi tersebut (bukan membuat service baru):

| Aspek | Sebelum | Sesudah |
|---|---|---|
| Env | `FONTE_API_URL`, `FONTE_API_TOKEN` | `FONNTE_ENABLED`, `FONNTE_TOKEN`, `FONNTE_API_URL`, `FONNTE_ADMIN_RECIPIENTS`, + timeout/retry/anti-spam |
| Parsing respons Fonnte | `data.data.id` → ** kosong (Fonnte kirim `id: []`) | mendukung `id[]`, `id`, `data.id` |
| Pesan error Fonnte | `data.message` → ** kosong (Fonnte kirim `reason`) | `reason` → `message` → `detail` |
| Idempotensi | key berisi `Date.now()` → ** tidak pernah dedup | key stabil per event (tanpa timestamp) |
| Nomor penerima log | disimpan **mentah** (PII) | **MASKED** + `recipient_hash` (SHA-256) |
| Sumber nomor penerima | hanya `user_whatsapp_preferences` (verifikasi) | **profil `users.no_hp`** (fallback preferensi) |
| Penerima admin | 1 nomor (`ADMIN_WHATSAPP_NUMBER`) | **daftar nomor** (env + runtime) |
| Halaman admin | tidak ada | **/admin/integrations** (status, toggle, event, uji, riwayat) |
| Penugasan petugas | hanya "tugas baru" | + tugas berubah & pembatalan (+ endpoint) |
| Telegram | hanya env | + toggle runtime terpisah (tidak menghapus riwayat) |

---

## 2. Environment Variable

```env
WHATSAPP_ENABLED=true
WHATSAPP_PROVIDER=fonte

FONNTE_ENABLED=true
FONNTE_TOKEN=            # ISI SENDIRI dari dashboard Fonnte (https://fonnte.com)
FONNTE_API_URL=https://api.fonnte.com
FONNTE_ADMIN_RECIPIENTS=6285147722749
FONNTE_TIMEOUT_MS=15000
FONNTE_MAX_RETRIES=3
FONNTE_RETRY_DELAY_MS=5000
FONNTE_MIN_INTERVAL_MS=2000   # anti-spam: jarak minimum per nomor
FONNTE_MAX_PER_MINUTE=20      # anti-spam: kuota per menit per nomor
```

> Token **tidak** pernah ditulis di source code, log, respons API, frontend, atau Git.
> `FONTE_API_TOKEN` (lama) sudah dinonaktifkan — sebaiknya dirotasi/revoke di dashboard Fonnte.

---

## 3. Endpoint Fonnte yang Digunakan

| Endpoint | Kegunaan | Autentikasi |
|---|---|---|
| `POST https://api.fonnte.com/send` | kirim pesan (form-data: `target`, `message`, `countryCode`) | header `Authorization: TOKEN` (tanpa `Bearer`) |
| `POST https://api.fonnte.com/device` | uji koneksi/token/device + kuota | header `Authorization: TOKEN` |

Respons sukses: `{ status: true, id: ["80367170"], process: "pending" }`
Respons gagal: `{ status: false, reason: "token invalid" }`

Status `sent` di sistem = **API Fonnte menerima permintaan (antrean)**, bukan bukti pesan sampai
ke perangkat penerima. Tidak ada status `delivered` yang kami klaim.

---

## 4. Jenis Notifikasi (17 event)

**Masyarakat:** registrasi, laporan diterima, laporan diverifikasi, laporan diproses, dalam perbaikan,
selesai, ditolak, perubahan penting, notifikasi login.
**Petugas:** tugas baru, penugasan berubah, penugasan dibatalkan, perubahan prioritas.
**Admin:** pengguna baru, laporan baru masuk, laporan selesai, aktivitas sistem.

---

## 5. Endpoint API Baru (admin)

| Method | Endpoint |
|---|---|
| GET | `/api/admin/integrations/whatsapp/status` |
| PATCH | `/api/admin/integrations/whatsapp/settings` |
| POST | `/api/admin/integrations/whatsapp/test-connection` |
| POST | `/api/admin/integrations/whatsapp/test-message` |
| GET | `/api/admin/integrations/whatsapp/history` |
| PATCH | `/api/admin/assignments/:reportId` (pindah petugas) |
| DELETE | `/api/admin/assignments/:reportId/:petugasId` (batalkan penugasan) |

---

## 6. Pengujian

| Suite | Hasil |
|---|---|
| Backend `npm test` | 18 file / **220 tes lulus** |
| Frontend `npm test` | 14 file / **98 tes lulus** |
| `npm run build` (backend & frontend) | sukses |
| `scripts/verify-fonnte-integration.ts` (server Fonnte tiruan lokal) | **34 PASS, 0 FAIL** |
| `scripts/check-fonnte-status.ts` | status & keamanan token OK |

Belum ada pesan yang dikirim ke Fonnte **sungguhan** (token belum diisi & belum ada izin).

---

## 7. Cara Mengaktifkan

1. Ambil token di dashboard Fonnte → isi `FONNTE_TOKEN` di `backend/.env`.
2. `cd backend && npm run dev` (restart agar env terbaca).
3. Login admin → **/admin/integrations** → "Uji Koneksi" → "Kirim" (pesan percobaan).
4. Cek status: `npx ts-node scripts/check-fonnte-status.ts`.
