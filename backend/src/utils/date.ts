/**
 * Format tanggal & umur akun dalam Bahasa Indonesia (WIB).
 * Dipakai chatbot untuk menjelaskan data profil secara mudah dibaca.
 */

/** Tanggal mudah dibaca, contoh: "12 November 2026". */
export function humanDate(value: Date | string | null | undefined): string {
  if (!value) return '-';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Jakarta',
  });
}

/** Umur akun dalam bahasa manusia, contoh: "3 hari lalu". */
export function accountAge(value: Date | string | null | undefined): string {
  if (!value) return '-';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  const days = Math.max(0, Math.floor((Date.now() - date.getTime()) / 86400000));
  if (days === 0) return 'hari ini';
  if (days === 1) return '1 hari lalu';
  if (days < 30) return days + ' hari lalu';
  const months = Math.floor(days / 30);
  if (months < 12) return months + ' bulan lalu';
  const years = Math.floor(days / 365);
  return years + ' tahun lalu';
}
