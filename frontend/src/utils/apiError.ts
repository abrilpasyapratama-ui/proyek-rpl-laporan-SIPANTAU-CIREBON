import axios from 'axios';

/**
 * Mengekstrak pesan error dari error axios / unknown secara type-safe.
 * Dipakai di seluruh catch block agar error asli tetap tercatat
 * tanpa menggunakan `any`.
 */
export function extractErrorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data;
    if (typeof data === 'string') return data;
    if (data && typeof data === 'object') {
      const message = (data as { message?: unknown }).message;
      if (typeof message === 'string') return message;
    }
    return err.message;
  }
  return err instanceof Error ? err.message : String(err);
}
