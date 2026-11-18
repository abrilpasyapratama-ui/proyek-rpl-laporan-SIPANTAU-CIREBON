import { z } from 'zod';
import {
  ChatUser,
  ForbiddenError,
  assertToolAllowed,
  assertAdminAccess,
  canViewReport,
  CHAT_ROLE_TITLES,
  CHAT_ROLE_CAPABILITIES,
} from './chatPermissions';
import * as repo from './chatRepository';
import type { GroupField } from './chatRepository';
import { humanDate, accountAge } from '../../utils/date';

const STATUSES = [
  'MENUNGGU_VERIFIKASI',
  'DIPROSES',
  'DALAM_PERBAIKAN',
  'SELESAI',
  'DITOLAK',
] as const;

const limitSchema = z.coerce.number().int().min(1).max(20).default(10);
const statusSchema = z.enum(STATUSES).optional();
const textSchema = (max: number) => z.string().trim().min(1).max(max);
const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal harus YYYY-MM-DD')
  .optional();

const toolArgsSchemas: Record<string, z.ZodTypeAny> = {
  getMyProfile: z.object({}),
  getAdminProfile: z.object({}),
  getReportStatus: z.object({
    report_id: z.string().uuid('ID laporan tidak valid').optional(),
    limit: limitSchema,
  }),
  searchReports: z.object({
    query: textSchema(200).optional(),
    kategori: textSchema(100).optional(),
    lokasi: textSchema(200).optional(),
    status: statusSchema,
    date_from: dateSchema,
    date_to: dateSchema,
    limit: limitSchema,
  }),
  getReportsByCategory: z.object({
    kategori: textSchema(100),
    status: statusSchema,
    limit: limitSchema,
  }),
  getReportsByLocation: z.object({
    lokasi: textSchema(200),
    status: statusSchema,
    limit: limitSchema,
  }),
  getReportsNearby: z.object({
    latitude: z.coerce.number().min(-90).max(90),
    longitude: z.coerce.number().min(-180).max(180),
    radius_km: z.coerce.number().min(0.5).max(50).default(3),
    limit: limitSchema,
  }),
  getUserReports: z.object({ status: statusSchema, limit: limitSchema }),
  getReportAnalytics: z.object({
    group_by: z.enum(['kategori', 'lokasi', 'prioritas', 'status']),
    status: statusSchema,
    period_days: z.coerce.number().int().min(1).max(3650).optional(),
    limit: limitSchema,
  }),
  getReportPeriodSummary: z.object({ period: z.enum(['hari', 'minggu', 'bulan']) }),
  getResolutionTime: z.object({
    period_days: z.coerce.number().int().min(1).max(3650).optional(),
  }),
  getHighPriorityReports: z.object({ limit: limitSchema }),
  getUnassignedReports: z.object({ limit: limitSchema }),
  getDashboardStatistics: z.object({}),
  getOfficerTasks: z.object({ status: statusSchema, limit: limitSchema }),
  getOfficerSummary: z.object({}),
  getUserSummary: z.object({}),
  getNotifications: z.object({
    unread_only: z.coerce.boolean().optional().default(false),
    limit: limitSchema,
  }),
};

type ToolResult = Record<string, unknown> | unknown[];

interface Args {
  [key: string]: string | number | boolean | undefined;
}

const DATA_SOURCE = 'database SIPANTAU Cirebon';
const now = () => new Date().toISOString();

interface ProfileRow {
  id: string;
  nama: string;
  username: string | null;
  email: string;
  no_hp: string | null;
  role: string;
  status: string;
  created_at: Date;
}

/**
 * Susun hasil profil.
 * Tidak pernah memuat password, hash, token, atau field sensitif lain.
 */
function buildProfileResult(profile: ProfileRow) {
  return {
    nama: profile.nama,
    email: profile.email,
    nomor_hp: profile.no_hp ?? null,
    peran: profile.role.toUpperCase(),
    jabatan: CHAT_ROLE_TITLES[profile.role] ?? profile.role,
    username: profile.username ?? null,
    status_akun: profile.status,
    terdaftar_sejak: profile.created_at.toISOString(),
    terdaftar_sejak_human: humanDate(profile.created_at),
    lama_terdaftar: accountAge(profile.created_at),
    sumber_data: DATA_SOURCE,
    diambil_pada: now(),
  };
}

function parseDateRange(args: Args): { from?: Date; to?: Date } {
  const from = typeof args.date_from === 'string' ? new Date(`${args.date_from}T00:00:00.000Z`) : undefined;
  const to = typeof args.date_to === 'string' ? new Date(`${args.date_to}T23:59:59.999Z`) : undefined;
  return {
    from: from && !Number.isNaN(from.getTime()) ? from : undefined,
    to: to && !Number.isNaN(to.getTime()) ? to : undefined,
  };
}

const GROUP_FIELD: Record<string, GroupField> = {
  kategori: 'kategori',
  lokasi: 'lokasi',
  prioritas: 'ai_priority',
  status: 'status',
};

const PERIOD_DAYS: Record<string, number> = { hari: 1, minggu: 7, bulan: 30 };

/**
 * Titik tunggal eksekusi tool:
 * LLM → nama tool + argumen JSON → validasi → permission → repository → hasil JSON.
 * Error tidak pernah melempar ke loop agen — dikembalikan sebagai hasil
 * agar model bisa menjelaskan / mencoba ulang.
 * Tidak ada jalur SQL bebas: hanya fungsi repository tervalidasi yang dijalankan.
 */
export async function executeChatTool(
  user: ChatUser,
  toolName: string,
  rawArgs: unknown
): Promise<ToolResult> {
  try {
    assertToolAllowed(user.role, toolName);
    // Pemeriksaan role ADMIN di backend untuk fitur khusus administrator.
    if (toolName === 'getAdminProfile') assertAdminAccess(user);
  } catch (err) {
    if (err instanceof ForbiddenError) return { error: err.message };
    throw err;
  }

  const schema = toolArgsSchemas[toolName];
  const parsed = schema.safeParse(rawArgs ?? {});
  if (!parsed.success) {
    return { error: `Argumen tidak valid untuk ${toolName}: ${parsed.error.issues[0]?.message ?? 'periksa parameter'}` };
  }
  const args = parsed.data as Args;

  try {
    return await runTool(user, toolName, args);
  } catch {
    return { error: 'Gagal mengambil data dari database. Silakan coba lagi sebentar lagi.' };
  }
}

async function runTool(user: ChatUser, toolName: string, args: Args): Promise<ToolResult> {
  switch (toolName) {
    case 'getMyProfile': {
      // Identitas SELALU milik pemanggil (user.id dari JWT), bukan dari argumen.
      const profile = await repo.findUserProfile(user.id);
      if (!profile) return { error: 'Profil tidak ditemukan' };
      return buildProfileResult(profile as ProfileRow);
    }

    case 'getAdminProfile': {
      // Role admin sudah dijamin oleh assertAdminAccess() di atas.
      const profile = await repo.findUserProfile(user.id);
      if (!profile) return { error: 'Profil administrator tidak ditemukan' };

      const [perRole, belumDitangani, prioritasTinggi] = await Promise.all([
        repo.countUsersByRole(),
        repo.countUnhandledReports(),
        repo.countHighPriorityReports(),
      ]);

      return {
        ...buildProfileResult(profile as ProfileRow),
        jabatan: CHAT_ROLE_TITLES.admin,
        hak_akses: CHAT_ROLE_CAPABILITIES.admin,
        ringkasan_sistem: {
          total_pengguna: Object.values(perRole).reduce((a, b) => a + b, 0),
          pengguna_per_peran: perRole,
          laporan_belum_ditangani: belumDitangani,
          laporan_prioritas_tinggi: prioritasTinggi,
        },
      };
    }

    case 'getReportStatus': {
      if (typeof args.report_id === 'string') {
        const report = await repo.findReportById(args.report_id);
        if (!report) return { error: 'Laporan tidak ditemukan' };
        if (!canViewReport(user, report)) {
          return { error: 'Akses ditolak: Anda tidak memiliki hak melihat laporan ini' };
        }
        return {
          id: report.id,
          judul: report.judul,
          kategori: report.kategori,
          status: report.status,
          lokasi: report.lokasi,
          prioritas_ai: report.ai_priority,
          pelapor: report.user.nama,
          petugas: report.assignments.map((a) => a.petugas.nama),
          progres_terakhir: report.updates[0] ?? null,
          riwayat_status: report.updates.map((u) => ({
            status: u.status,
            catatan: u.catatan,
            pada: u.created_at,
          })),
        };
      }
      const items = await repo.findReports(user, {
        status: undefined,
        kategori: undefined,
        lokasi: undefined,
        limit: Number(args.limit ?? 5),
      });
      return items.map((r) => ({ id: r.id, judul: r.judul, status: r.status, kategori: r.kategori }));
    }

    case 'searchReports': {
      const range = parseDateRange(args);
      const items = await repo.searchReports(user, {
        query: args.query as string | undefined,
        kategori: args.kategori as string | undefined,
        lokasi: args.lokasi as string | undefined,
        status: args.status as string | undefined,
        from: range.from,
        to: range.to,
        limit: Number(args.limit ?? 10),
      });
      return {
        kriteria: {
          query: args.query ?? null,
          kategori: args.kategori ?? null,
          lokasi: args.lokasi ?? null,
          status: args.status ?? null,
          dari: args.date_from ?? null,
          sampai: args.date_to ?? null,
        },
        jumlah: items.length,
        laporan: items,
      };
    }

    case 'getReportsByCategory': {
      const items = await repo.findReports(user, {
        status: args.status as string | undefined,
        kategori: args.kategori as string,
        lokasi: undefined,
        limit: Number(args.limit ?? 10),
      });
      return { kategori: args.kategori, jumlah: items.length, laporan: items };
    }

    case 'getReportsByLocation': {
      const items = await repo.findReports(user, {
        status: args.status as string | undefined,
        kategori: undefined,
        lokasi: args.lokasi as string,
        limit: Number(args.limit ?? 10),
      });
      return { lokasi: args.lokasi, jumlah: items.length, laporan: items };
    }

    case 'getReportsNearby': {
      const items = await repo.findReportsNearby(user, {
        lat: Number(args.latitude),
        lng: Number(args.longitude),
        radiusKm: Number(args.radius_km ?? 3),
        limit: Number(args.limit ?? 10),
      });
      return {
        pusat: { latitude: Number(args.latitude), longitude: Number(args.longitude) },
        radius_km: Number(args.radius_km ?? 3),
        jumlah: items.length,
        laporan: items,
      };
    }

    case 'getUserReports': {
      const items = await repo.findReports(user, {
        status: args.status as string | undefined,
        kategori: undefined,
        lokasi: undefined,
        limit: Number(args.limit ?? 10),
      });
      const counts = await repo.countReportsByStatus(user, [...STATUSES]);
      return { ringkasan: counts, jumlah: items.length, laporan: items };
    }

    case 'getReportAnalytics': {
      const field = GROUP_FIELD[args.group_by as string] ?? 'kategori';
      const periodDays = args.period_days ? Number(args.period_days) : undefined;
      const since = periodDays ? new Date(Date.now() - periodDays * 86400000) : undefined;
      const take = Number(args.limit ?? 10);

      const data = await repo.groupReportsBy(user, field, {
        status: args.status as string | undefined,
        from: since,
        take,
      });

      let sebelumnya: Array<{ nilai: string; jumlah: number }> | undefined;
      if (since && periodDays) {
        const prevFrom = new Date(since.getTime() - periodDays * 86400000);
        sebelumnya = await repo.groupReportsBy(user, field, {
          status: args.status as string | undefined,
          from: prevFrom,
          to: since,
          take,
        });
      }

      return {
        group_by: field,
        periode_hari: periodDays ?? null,
        data,
        periode_sebelumnya: sebelumnya ?? null,
        sumber_data: DATA_SOURCE,
        diambil_pada: now(),
      };
    }

    case 'getReportPeriodSummary': {
      const period = (args.period as string) ?? 'bulan';
      const days = PERIOD_DAYS[period] ?? 30;
      const since = new Date(Date.now() - days * 86400000);
      const prevFrom = new Date(since.getTime() - days * 86400000);

      const [totalNow, totalPrev, perStatus] = await Promise.all([
        repo.countReportsInRange(user, { from: since }),
        repo.countReportsInRange(user, { from: prevFrom, to: since }),
        repo.countReportsByStatus(user, [...STATUSES]),
      ]);

      return {
        periode: period,
        sejak: since.toISOString(),
        total_periode_ini: totalNow,
        total_periode_sebelumnya: totalPrev,
        selisih: totalNow - totalPrev,
        per_status: perStatus,
        sumber_data: DATA_SOURCE,
        diambil_pada: now(),
      };
    }

    case 'getResolutionTime': {
      const result = await repo.averageResolutionTime(user, {
        sinceDays: args.period_days ? Number(args.period_days) : undefined,
      });
      return { ...result, sumber_data: DATA_SOURCE, diambil_pada: now() };
    }

    case 'getHighPriorityReports': {
      const items = await repo.findHighPriorityReports(user, Number(args.limit ?? 10));
      return { jumlah: items.length, laporan: items };
    }

    case 'getUnassignedReports': {
      const items = await repo.findUnassignedReports(user, Number(args.limit ?? 10));
      return { jumlah: items.length, laporan: items };
    }

    case 'getDashboardStatistics': {
      if (user.role === 'masyarakat') {
        const counts = await repo.countReportsByStatus(user, [...STATUSES]);
        const total = Object.values(counts).reduce((a, b) => a + b, 0);
        return { total_laporan_saya: total, per_status: counts };
      }
      if (user.role === 'petugas') {
        const tasks = await repo.findOfficerTasks(user, { status: undefined, limit: 100 });
        const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
        const selesai = tasks.filter((t) => t.report.status === 'SELESAI').length;
        const terlambat = tasks.filter(
          (t) => t.report.status !== 'SELESAI' && new Date(t.assigned_at).getTime() < sevenDaysAgo
        ).length;
        return {
          total_tugas: tasks.length,
          selesai,
          aktif: tasks.length - selesai,
          terlambat,
        };
      }
      // admin
      const [counts, total, belumDitangani, prioritasTinggi, performaPetugas] = await Promise.all([
        repo.countReportsByStatus(user, [...STATUSES]),
        repo.countAllReports(),
        repo.countUnhandledReports(),
        repo.countHighPriorityReports(),
        repo.officerPerformance(),
      ]);
      return {
        total_laporan: total,
        per_status: counts,
        belum_ditangani: belumDitangani,
        prioritas_tinggi: prioritasTinggi,
        performa_petugas: performaPetugas,
      };
    }

    case 'getOfficerTasks': {
      const tasks = await repo.findOfficerTasks(user, {
        status: args.status as string | undefined,
        limit: Number(args.limit ?? 10),
      });
      return {
        jumlah: tasks.length,
        tugas: tasks.map((t) => ({
          id: t.id,
          ditugaskan_pada: t.assigned_at,
          petugas: t.petugas.nama,
          laporan: t.report,
        })),
      };
    }

    case 'getOfficerSummary': {
      const [perStatus, perRole, performa] = await Promise.all([
        repo.countPetugasByStatus(),
        repo.countUsersByRole(),
        repo.officerPerformance(),
      ]);
      const total = perRole.petugas ?? 0;
      return {
        total_petugas: total,
        per_status: perStatus,
        aktif: perStatus.AKTIF ?? 0,
        menunggu_verifikasi: perStatus.MENUNGGU_VERIFIKASI ?? 0,
        performa,
        sumber_data: DATA_SOURCE,
        diambil_pada: now(),
      };
    }

    case 'getUserSummary': {
      const perRole = await repo.countUsersByRole();
      const total = Object.values(perRole).reduce((a, b) => a + b, 0);
      return { total_pengguna: total, per_role: perRole, sumber_data: DATA_SOURCE, diambil_pada: now() };
    }

    case 'getNotifications': {
      return repo.findUserNotifications(user.id, {
        unreadOnly: Boolean(args.unread_only),
        limit: Number(args.limit ?? 5),
      });
    }

    default:
      return { error: `Tool '${toolName}' tidak dikenali` };
  }
}
