import { CHAT_TOOL_NAMES } from './tools';

export type ChatRole = 'masyarakat' | 'admin' | 'petugas';

export interface ChatUser {
  id: string;
  role: string;
  nama?: string;
  username?: string | null;
  /** Tanggal pendaftaran akun (dari database), dipakai untuk konteks prompt. */
  createdAt?: Date | string | null;
}

/** Jabatan yang ditampilkan ke pengguna sesuai role-nya. */
export const CHAT_ROLE_TITLES: Record<string, string> = {
  admin: 'Administrator SIPANTAU CIREBON',
  petugas: 'Petugas Lapangan',
  masyarakat: 'Masyarakat',
};

/** Ringkasan hak akses per role (dipakai sebagai konteks, bukan sbg pengganti RBAC). */
export const CHAT_ROLE_CAPABILITIES: Record<string, string[]> = {
  admin: [
    'melihat seluruh laporan dan statistik sistem',
    'memverifikasi atau menolak laporan',
    'mengelola pengguna, petugas, dan penugasan',
    'mengakses analitik percakapan',
  ],
  petugas: ['melihat dan menangani tugas lapangan yang ditugaskan padanya'],
  masyarakat: ['melihat dan membuat laporan miliknya sendiri'],
};

/**
 * Matriks hak akses tools per role.
 * - masyarakat: hanya data miliknya sendiri (tidak ada getOfficerTasks)
 * - petugas: data tugasnya sendiri + laporan yang ditugaskan padanya
 * - admin: seluruh data
 */
export const ROLE_TOOLS: Record<ChatRole, string[]> = {
  masyarakat: [
    'getReportStatus',
    'searchReports',
    'getReportsByCategory',
    'getReportsByLocation',
    'getReportsNearby',
    'getUserReports',
    'getReportAnalytics',
    'getReportPeriodSummary',
    'getResolutionTime',
    'getHighPriorityReports',
    'getDashboardStatistics',
    'getNotifications',
    'getMyProfile',
  ],
  petugas: [
    'getReportStatus',
    'searchReports',
    'getReportsByCategory',
    'getReportsByLocation',
    'getReportsNearby',
    'getUserReports',
    'getReportAnalytics',
    'getReportPeriodSummary',
    'getResolutionTime',
    'getHighPriorityReports',
    'getDashboardStatistics',
    'getOfficerTasks',
    'getNotifications',
    'getMyProfile',
  ],
  admin: [
    'getReportStatus',
    'searchReports',
    'getReportsByCategory',
    'getReportsByLocation',
    'getReportsNearby',
    'getUserReports',
    'getReportAnalytics',
    'getReportPeriodSummary',
    'getResolutionTime',
    'getHighPriorityReports',
    'getUnassignedReports',
    'getDashboardStatistics',
    'getOfficerTasks',
    'getOfficerSummary',
    'getUserSummary',
    'getNotifications',
    'getMyProfile',
    'getAdminProfile',
  ],
};

export class ForbiddenError extends Error {
  constructor(message = 'Akses ditolak untuk peran Anda') {
    super(message);
    this.name = 'ForbiddenError';
  }
}

/** Menolak tool yang tidak dikenal atau tidak diizinkan untuk role pemanggil. */
export function assertToolAllowed(role: string, toolName: string): void {
  if (!CHAT_TOOL_NAMES.includes(toolName)) {
    throw new ForbiddenError(`Tool '${toolName}' tidak tersedia`);
  }
  const allowed = (ROLE_TOOLS as Record<string, string[]>)[role] ?? [];
  if (!allowed.includes(toolName)) {
    throw new ForbiddenError(`Tool '${toolName}' tidak tersedia untuk peran '${role}'`);
  }
}

/**
 * Pemeriksaan role ADMIN di backend.
 * Dipakai untuk fitur yang hanya relevan bagi administrator (mis. profil
 * administrator). Menolak peran lain SEBELUM query database dijalankan.
 */
export function assertAdminAccess(user: ChatUser): void {
  if (user.role !== 'admin') {
    throw new ForbiddenError('Informasi administrator hanya dapat diakses oleh akun dengan role ADMIN');
  }
}

/**
 * Klausa scope Prisma untuk tabel reports berdasarkan role.
 * - masyarakat: hanya laporan miliknya (user_id)
 * - petugas: hanya laporan yang ditugaskan padanya
 * - admin: semua laporan
 */
export function reportScopeWhere(user: ChatUser): Record<string, unknown> {
  if (user.role === 'masyarakat') return { user_id: user.id };
  if (user.role === 'petugas') return { assignments: { some: { petugas_id: user.id } } };
  return {};
}

/** Apakah user boleh melihat detail satu laporan (dipakai setelah fetch). */
export function canViewReport(
  user: ChatUser,
  report: { user_id: string; assignments?: Array<{ petugas_id: string }> }
): boolean {
  if (user.role === 'admin') return true;
  if (user.role === 'masyarakat') return report.user_id === user.id;
  if (user.role === 'petugas') {
    return (report.assignments ?? []).some((a) => a.petugas_id === user.id);
  }
  return false;
}
