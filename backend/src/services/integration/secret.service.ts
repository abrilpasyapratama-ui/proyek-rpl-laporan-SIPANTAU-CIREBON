import crypto from 'crypto';
import { config } from '../../config';
import { logger } from '../../utils/logger';

/**
 * Enkripsi rahasia integrasi (API Key / token Fonnte).
 *
 * - Algoritma: AES-256-GCM (authenticated encryption).
 * - Kunci diambil dari environment server (`INTEGRATION_ENCRYPTION_KEY`),
 *   TIDAK pernah disimpan di database maupun frontend.
 * - Format simpan: `v1:<iv_b64>:<authTag_b64>:<cipher_b64>`
 * - Nilai plaintext tidak pernah masuk log.
 */

const PREFIX = 'v1';

function getKey(): Buffer | null {
  const raw = config.integration.encryptionKey;
  if (!raw) return null;

  // Accepted: 64 hex chars (32 byte) atau base64 32 byte.
  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    return Buffer.from(raw, 'hex');
  }
  const decoded = Buffer.from(raw, 'base64');
  if (decoded.length === 32) return decoded;

  return null;
}

/** Kunci enkripsi tersedia? (dicek tanpa membocorkan nilai) */
export function isEncryptionAvailable(): boolean {
  return getKey() !== null;
}

/**
 * Enkripsi string rahasia.
 * Mengembalikan null bila kunci enkripsi belum dikonfigurasi di server.
 */
export function encryptSecret(plain: string): string | null {
  const key = getKey();
  if (!key) {
    logger.warn('Enkripsi rahasia dilewati: INTEGRATION_ENCRYPTION_KEY belum dikonfigurasi');
    return null;
  }
  if (!plain) return null;

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [PREFIX, iv.toString('base64'), tag.toString('base64'), enc.toString('base64')].join(':');
}

/**
 * Dekripsi string rahasia. Mengembalikan null bila gagal / tidak terenkripsi.
 */
export function decryptSecret(payload: string): string | null {
  if (!payload) return null;
  if (!payload.startsWith(PREFIX + ':')) return null;

  const key = getKey();
  if (!key) return null;

  const parts = payload.split(':');
  if (parts.length !== 4) return null;

  try {
    const iv = Buffer.from(parts[1], 'base64');
    const tag = Buffer.from(parts[2], 'base64');
    const data = Buffer.from(parts[3], 'base64');
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
  } catch {
    // Token tidak bisa didekripsi (kunci berubah / data rusak).
    logger.warn('Dekripsi rahasia gagal (kunci tidak cocok atau data rusak)');
    return null;
  }
}

/** Buang nilai rahasia dari objek sebelum dikirim ke frontend/log. */
export function redactSecrets<T extends Record<string, unknown>>(obj: T): T {
  const clone: Record<string, unknown> = { ...obj };
  for (const key of Object.keys(clone)) {
    if (/token|apiKey|api_key|secret|password/i.test(key)) {
      clone[key] = undefined;
      delete clone[key];
    }
  }
  return clone as T;
}
