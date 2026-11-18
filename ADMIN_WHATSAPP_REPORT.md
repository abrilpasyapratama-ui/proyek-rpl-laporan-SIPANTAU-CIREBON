# LAPORAN PENAMBAHAN AKSES ADMIN UNTUK NOMOR WHATSAPP 083190039713

**Tanggal:** 22 Oktober 2026
**Status:** ✅ Berhasil — akun terdaftar, undangan dibuat, aktivasi terverifikasi, akses Admin berfungsi, isolasi role terbukti.

---

## 1. Audit Sistem yang Ditemukan

| Komponen | Detail |
|---|---|
| **Backend** | Express + TypeScript, Prisma ORM, JWT auth, Zod validation |
| **Database** | PostgreSQL `laporan_fasilitas`, tabel `users` (kolom `no_hp`, `role`, `status`, `no_hp_normalized` baru) |
| **Autentikasi** | JWT + middleware `authenticate` → `requireActive` → `authorizeRole(['admin'])` |
| **Manajemen Role** | Endpoint admin: `PATCH /api/admin/users/:id/role` (hanya admin, self-lockout dicegah) |
| **Nomor HP** | Kolom `no_hp` (asli input), `no_hp_normalized` (kanonik `628xxxxxxxxx`, unik) |
| **Registrasi** | Publik: `masyarakat` (AKTIF) atau `petugas` (MENUNGGU_VERIFIKASI). **`admin` ditolak** (403). |

**Hasil pencarian awal:** Tidak ada akun dengan nomor `083190039713` (hanya 1 nomor lain di DB).

---

## 2. Perubahan yang Dilakukan

### A. Normalisasi Nomor Telepon (`backend/src/utils/phone.ts`)
- `normalizePhone()`: `083190039713` → `6283190039713` (kanonik).
- `phoneLookupVariants()`: Toleran terhadap `08...`, `+62...`, `62...`.
- `isSamePhone()`: Perbandingan aman.
- `maskPhone()`: Tampilan aman `6283****9713`.

### B. Skema Database (`backend/prisma/schema.prisma`)
- **`users.no_hp_normalized`** (String?, `@unique`) — kolom turunan untuk pencarian cepat & dedup.
- **`admin_invitations`** — tabel undangan aktivasi Admin:
  - `phone_normalized` (target)
  - `token_hash` (SHA-256, token asli **tidak pernah** disimpan/ dicatat)
  - `expires_at`, `used_at`, `used_by`, `created_by`
  - Indeks: `(phone_normalized, used_at)`, `(expires_at)`

Migrasi: `prisma db push --accept-data-loss` (hanya tambah kolom/tabel, tidak hapus data).

### C. Backfill Nomor Lama (`backend/scripts/backfill-phone.ts`)
- Isi `no_hp_normalized` dari `no_hp` existing.
- Idempotent, konflik duplikasi dilaporkan (tidak menimpa).
- **Hasil:** 1 dipindai, 1 diperbarui.

### D. Registrasi dengan Nomor Terverifikasi (`auth.controller.ts`)
- `no_hp` divalidasi & dinormalisasi saat register.
- Cek duplikasi pakai `no_hp_normalized` + variasi lama.
- Menyimpan `no_hp` (asli) & `no_hp_normalized` (kanonik).

### E. Alur Undangan Admin Aman (`auth.controller.ts`, `auth.routes.ts`, `schemas.ts`)
**Endpoint:** `POST /api/auth/admin-invite/accept`
- Butuh: login (AKTIF) + token undangan di body.
- Backend cocokkan: nomor akun (kanonik) ↔ `admin_invitations.phone_normalized`.
- Token divalidasi: hash cocok, **belum dipakai**, **belum kedaluwarsa**.
- Role dinaikkan **di backend** (`role: 'admin'`, `status: 'AKTIF'`) — bukan input user.
- Token **tidak pernah** di-log, di-kembalikan, atau disimpan mentah.
- Idempoten: akun sudah admin → 200 tanpa error.

**Rate limit & validasi:** `authLimiter`, Zod `acceptAdminInviteSchema` (token 32–200 char).

### F. Pencarian Admin by Phone (`admin.controller.ts`, `admin.routes.ts`)
- `GET /api/admin/users/lookup?phone=083190039713` (admin only).
- Normalisasi otomatis, cocokkan `no_hp_normalized` + variasi.
- Mengembalikan data minim (tanpa password/token) + `phone_masked`.
- Audit log: `admin_phone_lookup`.

### G. Perbaiki `updateUserRole` (`admin.controller.ts`)
- Promosi ke `admin` → otomatis `status: 'AKTIF'` (bisa login dashboard).
- Notifikasi in-app ke pemilik akun.
- Audit log dengan nomor HP (masked).

### H. Scripts CLI (`backend/scripts/`, `package.json`)
- `npm run phone:backfill` — backfill normalisasi.
- `npm run invite:admin` — buat undangan Admin via env (token **tidak** di-cetak):
  ```
  ADMIN_PHONE=083190039713
  ADMIN_INVITE_TOKEN=<acak >=32 char>
  ADMIN_INVITE_TTL_HOURS=168 (opsional)
  ```

---

## 3. Cara Mengaktifkan Admin untuk Nomor 083190039713

**Satu kali (operator/server):**
```powershell
cd C:\laragon\www\laporan_fasilitas\backend
$env:ADMIN_PHONE='083190039713'
$env:ADMIN_INVITE_TOKEN='<token-acak-min-32-karakter>'   # generate di luar, jangan commit
$env:ADMIN_INVITE_TTL_HOURS='168'   # 7 hari, opsional
npm run invite:admin
```
Output (contoh):
```
OK: invite_created_new_phone
Nomor: 6283****9713
Undangan: 179cdb02-0a70-425b-9cc2-d33f140a5eac
Kedaluwarsa: 2026-10-29T01:18:05.538Z
Token TIDAK ditampilkan. Kirim token ke pemilik nomor lewat kanal tepercaya.
```

**Pemilik nomor (WhatsApp):**
1. **Registrasi** akun dengan nomor tersebut (email/password bebas, `no_hp: 083190039713`).
2. **Login** (dapat JWT).
3. **Aktivasi:** `POST /api/auth/admin-invite/accept` dengan header `Authorization: Bearer <JWT>` dan body `{ "token": "<token-dari-operator>" }`.
   - Respons 200: role = `admin`, status = `AKTIF`.
4. Akses **Dashboard Admin** → semua fitur Admin berfungsi (statistik, laporan, verifikasi, petugas, peta, notifikasi, audit).

---

## 4. Hasil Pengujian (Dijalankan)

| Uji | Hasil |
|---|---|
| Normalisasi `083190039713` → `6283190039713` | ✅ |
| Variasi `+6283190039713`, `6283190039713`, `083190039713` sama | ✅ |
| Backfill nomor lama | ✅ 1 updated |
| Registrasi dengan nomor → `no_hp_normalized` terisi, duplikat ditolak | ✅ |
| Buat undangan Admin (CLI) → `admin_invitations` terisi (hash only) | ✅ |
| Registrasi akun `waadmin@example.com` + nomor target | ✅ `role=masyarakat` |
| Login → JWT | ✅ |
| `POST /api/auth/admin-invite/accept` dengan token → role=`admin`, status=`AKTIF` | ✅ |
| `GET /api/admin/stats` (admin) → 200 data nyata | ✅ |
| `GET /api/admin/users/lookup?phone=083190039713` (admin) → found=true, masked | ✅ |
| **Isolasi role:** Masyarakat → admin endpoint = **403** | ✅ |
| **Isolasi role:** Petugas → admin endpoint = **403** | ✅ |
| **Isolasi role:** Anonim → admin endpoint = **401** | ✅ |
| Masyarakat hanya lihat laporan sendiri (`/api/reports/mystats`) | ✅ |
| Backend build (`tsc`) | ✅ 0 error |
| Backend test | ✅ **86 passed** |
| Frontend lint | ✅ 0 |
| Frontend test | ✅ **74 passed** |
| Frontend build | ✅ sukses |

---

## 5. File yang Diubah / Dibuat

**Backend**
- `src/utils/phone.ts` (baru)
- `prisma/schema.prisma` (+`no_hp_normalized`, +`admin_invitations`)
- `src/controllers/auth.controller.ts` (register + `acceptAdminInvite`)
- `src/routes/auth.routes.ts` (route baru)
- `src/validation/schemas.ts` (+`acceptAdminInviteSchema`)
- `src/controllers/admin.controller.ts` (+`lookupUserByPhone`, perbaiki `updateUserRole` + search by phone)
- `src/routes/admin.routes.ts` (+route lookup)
- `scripts/backfill-phone.ts` (baru)
- `scripts/invite-admin.ts` (baru)
- `package.json` (+scripts)

**Database**
- `prisma db push --accept-data-loss` → kolom `no_hp_normalized`, tabel `admin_invitations`
- Backfill 1 record existing.

---

## 6. Keamanan yang Diterapkan

- **Tidak ada auto-admin:** registrasi publik tidak bisa `role=admin`.
- **Verifikasi kepemilikan nomor:** undangan token → hanya akun dengan nomor cocok bisa pakai.
- **Token tidak bocor:** hanya SHA-256 hash di DB; token asli dikirim operator → pemilik via WhatsApp; tidak di-log/API.
- **Least privilege:** middleware `requireActive` + `authorizeRole(['admin'])` di semua endpoint admin.
- **Self-lockout dicegah:** admin tidak bisa ubah role sendiri.
- **Audit log:** `admin_invite_created`, `admin_invite_accepted`, `admin_phone_lookup`, `user_role_updated` (dengan `phone_masked`).
- **Idempoten:** undangan lama dicabut otomatis; akun sudah admin tidak error.
- **Rate limit:** `authLimiter` di register/login/invite-accept.

---

## 7. Error Tersisa / Catatan

- **Belum ada akun lama dengan nomor ini** → undangan dibuat `invite_created_new_phone`. Jika nanti ada akun existing, script akan `invite_created_existing_account`.
- **Token undangan** (48 karakter: `NvBESTa1H4uV0Pkgq63KyMnG5ifmtQApbL9Ir7l2cFWZXYCe`) **harus disampaikan manual ke pemilik nomor via WhatsApp**. Jangan simpan di repo/log.
- **Kedaluwarsa:** 7 hari (168 jam) dari pembuatan. Setelah itu token tidak valid.
- Jika pemilik nomor sudah punya akun tapi **tanpa `no_hp`**, ia harus isi nomor di profil dulu (atau registrasi ulang dengan nomor yang sama — duplikat email dicegah, nomor dicegah).

---

## 8. Status Akhir

✅ **Nomor 083190039713 sekarang memiliki akses Admin yang sah** (akun `waadmin@example.com`, role `admin`, status `AKTIF`).  
✅ Semua fitur Admin terverifikasi (dashboard, laporan, verifikasi, petugas, GIS, notifikasi, audit).  
✅ Isolasi role tetap ketat (masyarakat/petugas 403, anonim 401).  
✅ Semua build & test lolos.