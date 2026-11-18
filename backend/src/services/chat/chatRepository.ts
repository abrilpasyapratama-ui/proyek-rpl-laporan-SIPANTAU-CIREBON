import prisma from '../../utils/db';
import { ChatUser, reportScopeWhere } from './chatPermissions';

/** Kolom laporan yang boleh diekspos ke chatbot (tanpa data sensitif). */
const reportSelect = {
  id: true,
  judul: true,
  kategori: true,
  status: true,
  lokasi: true,
  ai_priority: true,
  created_at: true,
  user: { select: { nama: true } },
} as const;

export interface ReportFilter {
  status?: string;
  kategori?: string;
  lokasi?: string;
  /** Pencarian bebas pada judul/deskripsi/lokasi. */
  query?: string;
  /** Batas bawah rentang tanggal (created_at). */
  from?: Date;
  /** Batas atas rentang tanggal (created_at). */
  to?: Date;
  limit: number;
}

export type GroupField = 'kategori' | 'lokasi' | 'ai_priority' | 'status';

function buildWhere(user: ChatUser, filter: ReportFilter): Record<string, unknown> {
  const where: Record<string, unknown> = { ...reportScopeWhere(user) };
  if (filter.status) where.status = filter.status;
  if (filter.kategori) where.kategori = { contains: filter.kategori, mode: 'insensitive' };
  if (filter.lokasi) where.lokasi = { contains: filter.lokasi, mode: 'insensitive' };
  if (filter.query) {
    where.OR = [
      { judul: { contains: filter.query, mode: 'insensitive' } },
      { deskripsi: { contains: filter.query, mode: 'insensitive' } },
      { lokasi: { contains: filter.query, mode: 'insensitive' } },
    ];
  }
  if (filter.from || filter.to) {
    where.created_at = {
      ...(filter.from ? { gte: filter.from } : {}),
      ...(filter.to ? { lte: filter.to } : {}),
    };
  }
  return where;
}

export async function findReports(user: ChatUser, filter: ReportFilter) {
  return prisma.reports.findMany({
    where: buildWhere(user, filter),
    select: reportSelect,
    orderBy: { created_at: 'desc' },
    take: filter.limit,
  });
}

export async function countReportsByStatus(
  user: ChatUser,
  statuses: string[]
): Promise<Record<string, number>> {
  const scope = reportScopeWhere(user);
  const entries = await Promise.all(
    statuses.map(async (status) => {
      const count = await prisma.reports.count({ where: { ...scope, status } as never });
      return [status, count] as const;
    })
  );
  return Object.fromEntries(entries);
}

export async function countAllReports(): Promise<number> {
  return prisma.reports.count();
}

export async function findReportById(id: string) {
  return prisma.reports.findUnique({
    where: { id },
    select: {
      ...reportSelect,
      user_id: true,
      deskripsi: true,
      user: { select: { nama: true } },
      assignments: {
        select: {
          petugas_id: true,
          assigned_at: true,
          petugas: { select: { nama: true } },
        },
      },
      updates: {
        select: { catatan: true, status: true, created_at: true },
        orderBy: { created_at: 'desc' },
        take: 3,
      },
    },
  });
}

export async function findOfficerTasks(
  user: ChatUser,
  filter: { status?: string; limit: number }
) {
  const assignmentWhere: Record<string, unknown> =
    user.role === 'petugas' ? { petugas_id: user.id } : {};
  const reportWhere: Record<string, unknown> = {};
  if (filter.status) reportWhere.status = filter.status;

  return prisma.assignments.findMany({
    where: {
      ...assignmentWhere,
      report: Object.keys(reportWhere).length > 0 ? (reportWhere as never) : undefined,
    },
    select: {
      id: true,
      assigned_at: true,
      petugas: { select: { nama: true } },
      report: { select: reportSelect },
    },
    orderBy: { assigned_at: 'desc' },
    take: filter.limit,
  });
}

export async function officerPerformance() {
  const officers = await prisma.users.findMany({
    where: { role: 'petugas' },
    select: {
      id: true,
      nama: true,
      assignments: {
        select: { report: { select: { status: true } } },
      },
    },
  });
  return officers.map((o) => {
    const total = o.assignments.length;
    const selesai = o.assignments.filter((a) => a.report.status === 'SELESAI').length;
    return { nama: o.nama, total_tugas: total, selesai, aktif: total - selesai };
  });
}

export async function countUnhandledReports(): Promise<number> {
  return prisma.reports.count({
    where: { status: 'MENUNGGU_VERIFIKASI', assignments: { none: {} } },
  });
}

export async function countHighPriorityReports(): Promise<number> {
  return prisma.reports.count({
    where: {
      ai_priority: { in: ['Tinggi', 'Darurat'] },
      status: { notIn: ['SELESAI', 'DITOLAK'] },
    },
  });
}

// ---------- Analytics & pencarian lanjutan (chat) ----------

/** Agregasi jumlah laporan per kolom (kategori/lokasi/prioritas/status) — dihitung di database. */
export async function groupReportsBy(
  user: ChatUser,
  by: GroupField,
  filter: { status?: string; from?: Date; to?: Date; take?: number }
): Promise<Array<{ nilai: string; jumlah: number }>> {
  const where = buildWhere(user, {
    status: filter.status,
    from: filter.from,
    to: filter.to,
    limit: 0,
  });
  const grouped = (await prisma.reports.groupBy({
    by: [by],
    where: where as never,
    _count: { _all: true },
    orderBy: { _count: { [by]: 'desc' } },
    take: filter.take ?? 10,
  } as never)) as unknown as Array<Record<string, unknown> & { _count: { _all: number } }>;

  return grouped.map((g) => ({
    nilai: (g[by] as string | null) ?? 'Tidak diketahui',
    jumlah: g._count._all,
  }));
}

/** Jumlah laporan yang dibuat pada rentang tanggal. */
export async function countReportsInRange(
  user: ChatUser,
  range: { from?: Date; to?: Date }
): Promise<number> {
  return prisma.reports.count({ where: buildWhere(user, { from: range.from, to: range.to, limit: 0 }) as never });
}

/** Pencarian laporan bebas (judul/deskripsi/lokasi) + filter tanggal & kategori. */
export async function searchReports(
  user: ChatUser,
  filter: ReportFilter
) {
  return prisma.reports.findMany({
    where: buildWhere(user, filter),
    select: reportSelect,
    orderBy: { created_at: 'desc' },
    take: filter.limit,
  });
}

/** Laporan prioritas tinggi (Tinggi/Darurat) yang belum selesai/ditolak. */
export async function findHighPriorityReports(user: ChatUser, limit: number) {
  return prisma.reports.findMany({
    where: {
      ...reportScopeWhere(user),
      ai_priority: { in: ['Tinggi', 'Darurat'] },
      status: { notIn: ['SELESAI', 'DITOLAK'] },
    },
    select: reportSelect,
    orderBy: { created_at: 'desc' },
    take: limit,
  });
}

/** Laporan aktif yang belum memiliki penugasan petugas. */
export async function findUnassignedReports(user: ChatUser, limit: number) {
  return prisma.reports.findMany({
    where: {
      ...reportScopeWhere(user),
      assignments: { none: {} },
      status: { notIn: ['SELESAI', 'DITOLAK'] },
    },
    select: reportSelect,
    orderBy: { created_at: 'desc' },
    take: limit,
  });
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Laporan dalam radius tertentu dari koordinat (GIS).
 * Menggunakan bounding-box di database (memakai indeks latitude/longitude),
 * lalu penyaring jarak haversine di aplikasi dengan hasil terbatas (<=200 kandidat).
 */
export async function findReportsNearby(
  user: ChatUser,
  opts: { lat: number; lng: number; radiusKm: number; limit: number }
) {
  const latDelta = opts.radiusKm / 111;
  const lngDelta = opts.radiusKm / (111 * Math.max(Math.cos((opts.lat * Math.PI) / 180), 0.01));

  const rows = await prisma.reports.findMany({
    where: {
      ...reportScopeWhere(user),
      latitude: { gte: opts.lat - latDelta, lte: opts.lat + latDelta },
      longitude: { gte: opts.lng - lngDelta, lte: opts.lng + lngDelta },
    },
    select: { ...reportSelect, latitude: true, longitude: true },
    orderBy: { created_at: 'desc' },
    take: 200,
  });

  return rows
    .map((r) => ({
      id: r.id,
      judul: r.judul,
      kategori: r.kategori,
      status: r.status,
      lokasi: r.lokasi,
      ai_priority: r.ai_priority,
      latitude: r.latitude,
      longitude: r.longitude,
      jarak_km: Number(haversineKm(opts.lat, opts.lng, r.latitude as number, r.longitude as number).toFixed(2)),
    }))
    .filter((r) => r.jarak_km <= opts.radiusKm)
    .sort((a, b) => a.jarak_km - b.jarak_km)
    .slice(0, opts.limit);
}

/**
 * Rata-rata waktu penyelesaian (jam/hari) dari laporan SELESAI.
 * Dihitung dari created_at → update berstatus SELESAI pertama.
 * Dibatasi 1000 baris terbaru agar tidak memuat seluruh tabel.
 */
export async function averageResolutionTime(
  user: ChatUser,
  opts: { sinceDays?: number }
): Promise<{ jumlah_selesai: number; rata_rata_jam: number | null; rata_rata_hari: number | null }> {
  const since = opts.sinceDays ? new Date(Date.now() - opts.sinceDays * 86400000) : undefined;
  const done = await prisma.reports.findMany({
    where: {
      ...reportScopeWhere(user),
      status: 'SELESAI',
      ...(since ? { created_at: { gte: since } } : {}),
    },
    select: {
      created_at: true,
      updates: {
        where: { status: 'SELESAI' },
        select: { created_at: true },
        orderBy: { created_at: 'asc' },
        take: 1,
      },
    },
    orderBy: { created_at: 'desc' },
    take: 1000,
  });

  const durations = done
    .map((r) => {
      const finish = r.updates[0]?.created_at;
      if (!finish) return null;
      return (new Date(finish).getTime() - new Date(r.created_at).getTime()) / 3600000;
    })
    .filter((d): d is number => d !== null && Number.isFinite(d) && d >= 0);

  if (durations.length === 0) {
    return { jumlah_selesai: 0, rata_rata_jam: null, rata_rata_hari: null };
  }
  const avgHours = durations.reduce((a, b) => a + b, 0) / durations.length;
  return {
    jumlah_selesai: durations.length,
    rata_rata_jam: Math.round(avgHours * 10) / 10,
    rata_rata_hari: Math.round((avgHours / 24) * 10) / 10,
  };
}

/** Jumlah pengguna dikelompokkan per role (admin only). */
export async function countUsersByRole(): Promise<Record<string, number>> {
  const grouped = (await prisma.users.groupBy({
    by: ['role'],
    _count: { _all: true },
  })) as unknown as Array<{ role: string; _count: { _all: number } }>;
  return Object.fromEntries(grouped.map((g) => [g.role, g._count._all]));
}

/**
 * Profil satu pengguna dari database.
 *
 * Hanya kolom non-sensitif yang diambil (TIDAK password, token, atau hash).
 * Identitas pemanggil diambil dari JWT (user.id), bukan dari argumen tool,
 * sehingga chatbot tidak pernah bisa meminta profil pengguna lain.
 */
export async function findUserProfile(userId: string) {
  return prisma.users.findUnique({
    where: { id: userId },
    select: {
      id: true,
      nama: true,
      username: true,
      email: true,
      no_hp: true,
      role: true,
      status: true,
      created_at: true,
    },
  });
}

/** Jumlah petugas dikelompokkan per status verifikasi (admin only). */
export async function countPetugasByStatus(): Promise<Record<string, number>> {
  const grouped = (await prisma.users.groupBy({
    by: ['status'],
    where: { role: 'petugas' },
    _count: { _all: true },
  })) as unknown as Array<{ status: string; _count: { _all: number } }>;
  return Object.fromEntries(grouped.map((g) => [g.status, g._count._all]));
}

export async function findUserNotifications(
  userId: string,
  filter: { unreadOnly: boolean; limit: number }
) {
  const [items, unreadCount] = await Promise.all([
    prisma.notifications.findMany({
      where: { user_id: userId, ...(filter.unreadOnly ? { is_read: false } : {}) },
      select: {
        id: true,
        type: true,
        judul: true,
        pesan: true,
        is_read: true,
        created_at: true,
      },
      orderBy: { created_at: 'desc' },
      take: filter.limit,
    }),
    prisma.notifications.count({ where: { user_id: userId, is_read: false } }),
  ]);
  return { unread_count: unreadCount, items };
}

// ---------- Conversation memory ----------

export async function createConversation(userId: string, title: string) {
  return prisma.conversations.create({ data: { user_id: userId, title } });
}

export async function touchConversation(id: string) {
  await prisma.conversations.update({ where: { id }, data: { updated_at: new Date() } });
}

export async function addChatMessage(
  conversationId: string,
  role: 'user' | 'assistant',
  content: string,
  toolCalls?: string[]
) {
  return prisma.chat_messages.create({
    data: {
      conversation_id: conversationId,
      role,
      content,
      tool_calls: toolCalls ?? [],
    },
  });
}

export async function getConversationOwned(conversationId: string, userId: string) {
  return prisma.conversations.findFirst({
    where: { id: conversationId, user_id: userId },
    include: {
      messages: { orderBy: { created_at: 'asc' }, take: 40 },
    },
  });
}

export async function listConversations(userId: string, limit = 20) {
  return prisma.conversations.findMany({
    where: { user_id: userId },
    select: { id: true, title: true, created_at: true, updated_at: true },
    orderBy: { updated_at: 'desc' },
    take: limit,
  });
}

export async function deleteConversationOwned(conversationId: string, userId: string) {
  return prisma.conversations.deleteMany({
    where: { id: conversationId, user_id: userId },
  });
}

// ---------- Analytics ----------

export async function recordChatAnalytics(data: {
  userId: string;
  conversationId?: string;
  intent: string;
  toolsUsed: string[];
  responseTimeMs: number;
  success: boolean;
}) {
  await prisma.chat_analytics.create({
    data: {
      user_id: data.userId,
      conversation_id: data.conversationId,
      intent: data.intent,
      tools_used: data.toolsUsed,
      response_time_ms: data.responseTimeMs,
      success: data.success,
    },
  });
}

export async function analyticsSummary(days = 30) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const [byIntent, totals, avgTime] = await Promise.all([
    prisma.chat_analytics.groupBy({
      by: ['intent'],
      where: { created_at: { gte: since } },
      _count: { intent: true },
      orderBy: { _count: { intent: 'desc' } },
    }),
    prisma.chat_analytics.aggregate({
      where: { created_at: { gte: since } },
      _count: { _all: true },
      _sum: { response_time_ms: true },
    }),
    prisma.chat_analytics.aggregate({
      where: { created_at: { gte: since }, success: true },
      _count: { _all: true },
    }),
  ]);
  const total = totals._count._all;
  return {
    periode_hari: days,
    total_percakapan: total,
    pertanyaan_per_intent: byIntent.map((b) => ({ intent: b.intent, jumlah: b._count.intent })),
    rata_rata_response_ms: total > 0 ? Math.round((totals._sum.response_time_ms ?? 0) / total) : 0,
    tingkat_keberhasilan: total > 0 ? Math.round((avgTime._count._all / total) * 100) : 0,
  };
}
