# UI REDESIGN REPORT — SIPANTAU CIREBON (Gaya Referensi Mint/Toska)

**Tanggal:** 2026-10-09
**Catatan sumber:** file gambar referensi tidak ditemukan di pesan maupun workspace (hanya aset upload E2E + Leaflet). Desain dikerjakan dari deskripsi tertulis: navbar horizontal putih membulat, background gradasi hijau mint, card login putih tengah, tiga kartu role, tombol hijau toska. Tidak ada nama/logo/konten referensi yang disalin — identitas tetap SIPANTAU CIREBON + logo asli (bentuk pin-peta dipertahankan, gradasi diselaraskan ke toska).

## 1. Design System yang Diterapkan

| Elemen | Sebelum | Sesudah |
|---|---|---|
| Background publik/auth | putih / slate gradient | gradasi mint `emerald-50 → teal-50 → cyan-50` |
| Navbar | bar putih full-width sticky | kartu putih melayang `rounded-2xl shadow-lg` (sticky, responsif + drawer mobile) |
| Warna primer | blue-600 (`#2563eb`) | teal-600 toska (`#0d9488`), hover teal-700 |
| Card auth | `rounded-2xl` slate | `rounded-3xl` putih + ring + shadow teal |
| Logo | gradasi biru | gradasi toska (bentuk SVG tidak berubah) |
| Fokus input | ring biru | ring teal |

## 2. Halaman yang Diubah

- **Landing (`/`)**: hero terang dengan blob mint + badge putih, tombol toska/putih, strip statistik jadi kartu putih, fitur/CTA/kontak aksen teal. Konten & rute tautan tidak berubah.
- **Login (`/login`)**: card tengah + logo, **tiga kartu role** (Masyarakat/Admin/Petugas, radio + deskripsi kontekstual), email, password + show/hide, tombol Masuk toska, link registrasi, kembali ke beranda.
- **Registrasi (`/register`)**: gaya kartu sama; field & validasi tidak berubah.
- **Tentang/Kontak**: aksen teal mengikuti tema.
- **Kontak**: form "simulasi terkirim" yang menyesatkan diganti `mailto:` ke email pengaduan resmi (fungsional, jujur).

## 3. Keputusan Keamanan (penting)

Kartu role di login adalah **pemilih konteks tampilan, bukan otorisasi**: request login hanya mengirim email+password; redirect memakai role dari token backend. Diuji eksplisit: pilih kartu Admin + login akun masyarakat → tetap ke `/dashboard`. Registrasi publik tetap hanya menghasilkan `masyarakat` (backend mengabaikan role dari input — tidak ada field role). Proteksi role backend tidak diubah dan tetap enforced.

## 4. Cakupan yang Disengaja Tidak Diubah

Dasbor terotentikasi (sidebar + konten) tetap memakai identitas biru yang sudah ada dan teruji — menghindari regresi visual pada 20+ file. Jika diinginkan, penyelarasan penuh dapat dilakukan sebagai pekerjaan lanjutan.

## 5. Pengujian

| Perintah | Hasil |
|---|---|
| `frontend: npm run build` (tsc -b + vite) | ✅ 0 error |
| `frontend: npm run lint` (max-warnings 0) | ✅ 0 error |
| `frontend: npm test` | ✅ 10 file, **59 passed** (55 lama + 4 Login baru) |
| `backend: npm test` | ✅ **43 passed** (tidak ada perubahan backend) |
| Live `POST /api/auth/login` 3 role | ✅ role benar dari backend |
| Live `POST /api/auth/register` | ✅ 201, role `masyarakat` |

## 6. Sisa Pekerjaan Manual

1. Buka `http://localhost:5173` (dev server frontend dijalankan ulang setelah server restart) dan verifikasi visual desktop + mobile.
2. Jika gradasi logo toska tidak diinginkan, kembalikan `stopColor` di `Logo.tsx` ke `#2563eb`/`#1e40af`.
3. Set `VITE_API_URL` produksi saat deploy (foto & API mengikuti origin yang sama via helper yang sudah ada).
