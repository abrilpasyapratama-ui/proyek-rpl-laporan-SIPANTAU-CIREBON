/**
 * Basis origin server API tanpa akhiran /api, misal:
 * VITE_API_URL=http://localhost:5000/api -> http://localhost:5000
 * Dipakai untuk membentuk URL file statis (/uploads/...) agar tidak
 * hardcode localhost dan tetap benar di production.
 */
const apiUrl = (import.meta.env?.VITE_API_URL as string | undefined) || 'http://localhost:5000/api';

export const API_ORIGIN = apiUrl.replace(/\/api\/?$/, '');

/** Ubah path relatif /uploads/... menjadi URL absolut. Kembalikan null bila kosong. */
export const resolveUploadUrl = (path?: string | null): string | null => {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  return `${API_ORIGIN}${path.startsWith('/') ? path : `/${path}`}`;
};
