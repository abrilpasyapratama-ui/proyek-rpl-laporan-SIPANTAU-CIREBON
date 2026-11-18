# AI CHATBOT ARCHITECTURE — SIPANTAU Cirebon

**Tanggal:** 2026-10-08
**Pola:** AI → Tool Calling → Service Layer → Database (LLM tidak pernah query database langsung)

---

## 1. Arsitektur Chatbot

```
┌─────────────┐     ┌──────────────┐     ┌────────────────────┐
│  Frontend   │     │   Chat API   │     │     AI Service     │
│ Chat Widget │────▶│ POST /api/   │────▶│ Orkestrator Agen   │
│ (3 layout)  │◀────│ chat         │◀────│ (agentic loop)     │
└─────────────┘     └──────────────┘     └────────┬───────────┘
      │ memory via                          tool_call│
      │ conversation_id                     JSON    │
      ▼                                     ▼      │
┌─────────────┐                        ┌────────────┴───────────┐
│ PostgreSQL  │◀─── Prisma only ───────│ Query Service          │
│ conversat.  │   (tanpa SQL mentah)   │ + Permission Layer     │
│ chat_msg    │                        │ (RBAC + validasi)      │
│ chat_analyt.│                        └────────────────────────┘
└─────────────┘
```

**Alur request → response** (`POST /api/chat { message, conversation_id? }`):

1. `authenticate` — JWT wajib (401 jika tidak ada/tidak valid).
2. `chatLimiter` — 30 req/15 mnt per IP (429 jika berlebih).
3. `validateBody(chatRequestSchema)` — Zod: message 1–2000 char, conversation_id UUID opsional (400 jika invalid).
4. Controller: resolve/buat conversation (ownership check — 404 jika milik user lain) → muat 40 pesan terakhir sebagai history (context memory).
5. Orkestrator: system prompt (role-aware) + history + pesan → `completeChat` (OpenRouter) dengan daftar tool yang diizinkan role tersebut.
6. Jika model mengembalikan `tool_calls` (maks 4 iterasi): tiap tool dieksekusi via `executeChatTool` (assert RBAC → validasi argumen Zod → repository Prisma) → hasil JSON dikembalikan ke model → model menyusun jawaban akhir Bahasa Indonesia.
7. Simpan pesan user + jawaban (memory), catat analitik + audit log → respons `{ reply, conversation_id, tools_used }`.
8. Error: tool gagal → hasil `{ error }` ke model (loop lanjut); provider gagal → 502; key kosong → 503.

**File backend:**

| Layer | File |
|---|---|
| Tool definitions | `src/services/chat/tools.ts` (7 tools, format OpenAI functions) |
| Permission (RBAC) | `src/services/chat/chatPermissions.ts` (`ROLE_TOOLS`, `reportScopeWhere`, `canViewReport`) |
| Repository | `src/services/chat/chatRepository.ts` (Prisma only, select whitelist tanpa password) |
| Query service | `src/services/chat/chatQuery.service.ts` (validasi argumen + eksekusi tool) |
| Orkestrator | `src/services/chat/chatOrchestrator.ts` (agentic loop, max 4 iterasi) |
| LLM client | `src/services/ai/openrouter.chat.service.ts` (`completeChat`, timeout 30 dtk) |
| Controller | `src/controllers/chat.controller.ts` (chat + CRUD conversation + analitik) |
| Routes | `src/routes/chat.routes.ts` |
| Validasi | `src/validation/schemas.ts` (`chatRequestSchema`) |

**File frontend:**

| Komponen | File |
|---|---|
| Widget (floating button, window, riwayat, loading, error, responsif) | `src/components/chat/ChatbotWidget.tsx` |
| Service | `src/services/chatService.ts` |
| Mount | `MasyarakatLayout`, `AdminLayout`, `OfficerLayout` |

---

## 2. Integrasi Database

**Analisis schema yang ada** (`prisma/schema.prisma`):

| Tabel | Kolom relevan chatbot |
|---|---|
| `users` | id, nama, email, role (masyarakat/admin/petugas) |
| `reports` | id, user_id, judul, deskripsi, **kategori (string, bukan tabel relasi)**, lokasi, latitude/longitude, foto, status, ai_kategori/confidence/priority, created_at |
| `assignments` | report_id, petugas_id, assigned_at |
| `report_updates` | report_id, petugas_id, catatan, foto_bukti, status, created_at |
| `notifications` | user_id, report_id, type, judul, pesan, is_read, created_at |

**Catatan jujur:** tidak ada tabel `categories` — kategori adalah kolom string pada `reports` (tool memakai pencocokan teks case-insensitive). Tidak ada kolom `kecamatan` — "laporan per kecamatan" dilayani via pencocokan kata kunci pada kolom `lokasi` (`getReportsByLocation`).

**Tabel baru chatbot** (via `prisma db push`):

| Tabel | Fungsi |
|---|---|
| `conversations` | session chat (id, user_id, title, created/updated_at; cascade dari users) |
| `chat_messages` | riwayat percakapan (role user/assistant, content, tool_calls JSON) |
| `chat_analytics` | intent, tools_used JSON, response_time_ms, success |

**Jaminan keamanan akses data:**

- LLM hanya menerima *definisi* tool (JSON schema) — tidak ada kredensial DB, tidak ada SQL.
- Repository memakai Prisma ORM (parameterized) dengan `select` whitelist — kolom `password` tidak pernah di-select.
- Hasil tool dipotong 4000 char sebelum dikirim ke model (hemat token, cegah eksfiltrasi massal).
- API key OpenRouter hanya di `backend/.env`, tidak pernah ke respons/frontend.

---

## 3. Hak Akses per Role

| Tool | Masyarakat | Petugas | Admin |
|---|---|---|---|
| `getReportStatus` | miliknya | yang ditugaskan | semua |
| `getReportsByCategory` | miliknya | yang ditugaskan | semua |
| `getReportsByLocation` | miliknya | yang ditugaskan | semua |
| `getUserReports` | miliknya | yang ditugaskan | semua terbaru |
| `getDashboardStatistics` | statistik pribadi | statistik tugas (aktif/selesai/terlambat) | global + performa petugas |
| `getOfficerTasks` | ❌ ditolak | tugasnya | semua penugasan |
| `getNotifications` | miliknya | miliknya | miliknya |

Penegakan 3 lapis: (1) model hanya diberi tool sesuai role; (2) `assertToolAllowed` menolak tool terlarang; (3) `reportScopeWhere`/`canViewReport` memfilter di level query (masyarakat `user_id = id`, petugas `assignments.some(petugas_id = id)`, admin tanpa filter). Pelanggaran → hasil `{ error }` ke model, bukan crash.

---

## 4. Daftar Tools / Functions

| # | Nama | Argumen | Kemampuan |
|---|---|---|---|
| 1 | `getReportStatus` | `report_id?`, `limit?` | cek status laporan (detail + progres terakhir, atau daftar terbaru) |
| 2 | `getReportsByCategory` | `kategori*`, `status?`, `limit?` | cari laporan per kategori |
| 3 | `getReportsByLocation` | `lokasi*`, `status?`, `limit?` | cari laporan per lokasi/kecamatan |
| 4 | `getUserReports` | `status?`, `limit?` | ringkasan laporan + hitungan per status |
| 5 | `getDashboardStatistics` | — | ringkasan dashboard (pribadi/tugas/global+performa) |
| 6 | `getOfficerTasks` | `status?`, `limit?` | daftar tugas (petugas: miliknya; admin: semua) |
| 7 | `getNotifications` | `unread_only?`, `limit?` | ringkasan notifikasi (unread count + terbaru) |

FAQ/panduan sistem dijawab langsung dari system prompt (tanpa tool). Definisi "terlambat": ditugaskan > 7 hari dan laporan belum SELESAI. "Belum ditangani": `MENUNGGU_VERIFIKASI` tanpa assignment. "Prioritas tinggi": `ai_priority` Tinggi/Darurat dan belum selesai/ditolak.

---

## 5. Endpoint API

| Method & Path | Auth | Fungsi |
|---|---|---|
| `POST /api/chat` | login + chatLimiter | giliran chat → `{ reply, conversation_id, tools_used }` |
| `GET /api/chat/conversations` | login | daftar percakapan milik user (20 terbaru) |
| `GET /api/chat/conversations/:id` | login + ownership | isi percakapan (40 pesan) |
| `DELETE /api/chat/conversations/:id` | login + ownership | hapus percakapan |
| `GET /api/chat/analytics/summary` | admin | total, intent teratas, rata-rata respons, success rate (30 hari) |

Kode status: 200 sukses · 400 validasi/UUID · 401 tanpa token · 403 lintas-role/lintas-user · 404 conversation tidak ada · 429 rate limit · 502 provider AI gagal · 503 key belum dikonfigurasi.

---

## 6. Memory, Analitik, Audit

- **Session chat:** `conversations` (satu user banyak session; judul = 60 char pesan pertama).
- **Context pengguna:** nama + role disuntik ke system prompt tiap giliran.
- **Riwayat:** 40 pesan terakhir dimuat dari DB; 20 terakhir dikirim ke model; widget menyimpan `conversation_id` di localStorage + panel riwayat (buka/hapus).
- **Analitik** (`chat_analytics` per giliran asisten): intent = tool pertama / `general`, `tools_used`, `response_time_ms`, `success`. Ringkasan via `groupBy` + agregat.
- **Audit log** (JSON logger): `chat_tool_call` (user, role, tool) dan `chat_message` (user, role, conversation, intent, tools, response time) — tanpa isi pesan (privasi).

---

## 7. Batasan & Rekomendasi

1. Model default `openai/gpt-4o-mini` (dapat diganti via `OPENROUTER_MODEL`); wajib model yang mendukung function calling.
2. Risiko interpretasi LLM: pada satu pengujian, model salah membaca angka `belum_ditangani` dari hasil tool (data tool benar: 1). Mitigasi permanen yang diterapkan: temperature rendah (0.3), instruksi fidelitas angka di system prompt, pemotongan hasil tool 4000 char, dan audit log `chat_tool_call` sehingga setiap jawaban dapat diverifikasi ulang terhadap data aktual. Untuk angka kritis, verifikasi via endpoint terkait (`/api/admin/stats`, dsb.).
3. Tanpa refresh token / JWT masih di localStorage (utang lama, lihat SYSTEM_FIX_REPORT.md).
4. Kolom `kecamatan` dan tabel `categories` tidak ada — pencarian memakai substring `lokasi`/`kategori`.
5. Email notifikasi & monitoring eksternal tetap mengikuti status sebelumnya.
