import crypto from 'crypto';

/**
 * Utilitas normalisasi nomor telepon/WhatsApp Indonesia.
 *
 * Tujuan: format lokal (`083190039713`), internasional (`6283190039713`),
 * dan `+62 831-9003-9713` dikenali sebagai nomor yang SAMA.
 *
 * Bentuk kanonik yang disimpan: `62` + nomor tanpa awalan 0.
 * Contoh: `083190039713` → `6283190039713`.
 */

/** Normalisasi ke bentuk kanonik `62xxxxxxxxxxx`, atau null jika tidak valid. */
export function normalizePhone(input?: string | null): string | null {
  if (input === undefined || input === null) return null;
  let digits = String(input).replace(/\D/g, '');
  if (!digits) return null;

  // Buang awalan akses internasional 00 (mis. 0062...)
  if (digits.startsWith('0062')) digits = digits.slice(2);
  // 6208... (salah tulis umum) → 628...
  if (digits.startsWith('620')) digits = `62${digits.slice(3)}`;

  if (digits.startsWith('0')) {
    digits = `62${digits.slice(1)}`;
  } else if (digits.startsWith('8')) {
    digits = `62${digits}`;
  } else if (!digits.startsWith('62')) {
    // Bukan format Indonesia yang dikenali.
    return null;
  }

  // 62 + 8..13 digit (total 10–15 digit). Nomor seluler Indonesia diawali 8.
  if (!/^628\d{7,12}$/.test(digits)) return null;
  return digits;
}

/** Apakah dua nomor merujuk ke nomor yang sama (setelah normalisasi). */
export function isSamePhone(a?: string | null, b?: string | null): boolean {
  const na = normalizePhone(a);
  const nb = normalizePhone(b);
  return na !== null && nb !== null && na === nb;
}

/**
 * Variasi representasi untuk pencarian yang toleran terhadap data lama
 * yang mungkin belum dinormalisasi (mis. masih `0831...` atau `+62...`).
 */
export function phoneLookupVariants(input?: string | null): string[] {
  const norm = normalizePhone(input);
  if (!norm) return [];
  const local = `0${norm.slice(2)}`;
  return Array.from(new Set([norm, local, `+${norm}`, `62${norm.slice(2)}`]));
}

/** Masking untuk tampilan/log: 6283190039713 → 6283****9713 */
export function maskPhone(input?: string | null): string {
  const norm = normalizePhone(input);
  if (!norm) return '—';
  if (norm.length <= 8) return `${norm.slice(0, 2)}****`;
  return `${norm.slice(0, 4)}****${norm.slice(-4)}`;
}

/**
 * Normalisasi nomor WhatsApp untuk pengiriman pesan (Fonnte).
 * Bentuk kanonik: 62 + nomor tanpa awalan 0. Contoh:
 *   085147722749   → 6285147722749
 *   081234567890   → 6281234567890
 *   +628514772749  → 628514772749
 * Mengembalikan null bila nomor tidak valid/kosong (pesan tidak dikirim).
 */
export function normalizeWhatsAppNumber(input?: string | null): string | null {
  return normalizePhone(input);
}

/** Apakah nomor tersebut valid untuk pengiriman WhatsApp. */
export function isValidWhatsAppNumber(input?: string | null): boolean {
  return normalizePhone(input) !== null;
}

/**
 * Hash stabil untuk nomor penerima (dipakai untuk dedup & anti-spam tanpa
 * menyimpan nomor mentah di log). Nilai tidak dapat dibalik ke nomor asli.
 */
export function hashRecipient(input?: string | null): string | null {
  const norm = normalizePhone(input);
  if (!norm) return null;
  // SHA-256 (truncated) agar tetap aman tanpa dependensi tambahan.
  return crypto.createHash('sha256').update(norm).digest('hex').slice(0, 32);
}
