import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock prisma sebelum mengimpor service yang diuji.
vi.mock('../src/utils/db', () => ({
  default: {
    users: { findUnique: vi.fn(), findMany: vi.fn(), groupBy: vi.fn() },
    reports: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
      groupBy: vi.fn(),
    },
    assignments: { findMany: vi.fn() },
    notifications: { findMany: vi.fn(), count: vi.fn() },
    $disconnect: vi.fn(),
  },
}));

import prisma from '../src/utils/db';
import { executeChatTool } from '../src/services/chat/chatQuery.service';
import { CHAT_TOOL_NAMES } from '../src/services/chat/tools';
import { assertToolAllowed, ROLE_TOOLS } from '../src/services/chat/chatPermissions';

const mockPrisma = prisma as unknown as Record<string, Record<string, ReturnType<typeof vi.fn>>>;

const admin = { id: 'a1', role: 'admin', nama: 'Admin' };
const warga = { id: 'u1', role: 'masyarakat', nama: 'Warga' };
const petugas = { id: 'p1', role: 'petugas', nama: 'Petugas' };

const reportRow = (over: Record<string, unknown> = {}) => ({
  id: 'r1',
  judul: 'Jalan Berlubang',
  kategori: 'Jalan & Jembatan',
  status: 'MENUNGGU_VERIFIKASI',
  lokasi: 'Siliwangi',
  ai_priority: 'Tinggi',
  created_at: new Date().toISOString(),
  user: { nama: 'Warga' },
  ...over,
});

const REPORT_UUID = '123e4567-e89b-12d3-a456-426614174001';

beforeEach(() => {
  vi.clearAllMocks();
  // Default aman: tidak ada petugas (dipakai officerPerformance).
  mockPrisma.users.findMany.mockResolvedValue([]);
});

describe('chat tools — data laporan dasar & agregasi', () => {
  it('menghitung total & per-status untuk admin (agregasi)', async () => {
    // countReportsByStatus memanggil count 5x, lalu countAllReports.
    mockPrisma.reports.count.mockResolvedValue(2);
    const res = (await executeChatTool(admin, 'getDashboardStatistics', {})) as Record<string, unknown>;
    expect(res.total_laporan).toBe(2);
    expect((res.per_status as Record<string, number>).MENUNGGU_VERIFIKASI).toBe(2);
  });

  it('mengelompokkan laporan per kategori (grouping di database)', async () => {
    mockPrisma.reports.groupBy.mockResolvedValue([
      { kategori: 'Jalan & Jembatan', _count: { _all: 4 } },
      { kategori: 'Penerangan Jalan', _count: { _all: 1 } },
    ]);
    const res = (await executeChatTool(admin, 'getReportAnalytics', { group_by: 'kategori' })) as Record<
      string,
      unknown
    >;
    expect(res.data).toEqual([
      { nilai: 'Jalan & Jembatan', jumlah: 4 },
      { nilai: 'Penerangan Jalan', jumlah: 1 },
    ]);
    expect(res.sumber_data).toBeDefined();
    expect(res.diambil_pada).toBeDefined();
  });

  it('mengelompokkan per lokasi untuk pertanyaan wilayah terbanyak', async () => {
    mockPrisma.reports.groupBy.mockResolvedValue([{ lokasi: 'Kejaksan', _count: { _all: 7 } }]);
    const res = (await executeChatTool(admin, 'getReportAnalytics', { group_by: 'lokasi' })) as Record<
      string,
      unknown
    >;
    expect(res.data).toEqual([{ nilai: 'Kejaksan', jumlah: 7 }]);
  });
});

describe('chat tools — pencarian & filter', () => {
  it('mencari laporan berdasarkan ID dan menegakkan ownership', async () => {
    mockPrisma.reports.findUnique.mockResolvedValue({
      ...reportRow(),
      user_id: 'u1',
      deskripsi: 'berlubang',
      assignments: [],
      updates: [],
    });

    const own = (await executeChatTool(warga, 'getReportStatus', { report_id: REPORT_UUID })) as Record<string, unknown>;
    expect(own.id).toBe('r1');

    // masyarakat lain tidak boleh melihat
    const other = (await executeChatTool(
      { id: 'u2', role: 'masyarakat' },
      'getReportStatus',
      { report_id: REPORT_UUID }
    )) as Record<string, unknown>;
    expect(other.error).toMatch(/Akses ditolak|hak/i);
  });

  it('petugas tidak boleh melihat laporan yang tidak ditugaskan', async () => {
    mockPrisma.reports.findUnique.mockResolvedValue({
      ...reportRow(),
      user_id: 'u1',
      deskripsi: 'x',
      assignments: [{ petugas_id: 'p2', petugas: { nama: 'Lain' } }],
      updates: [],
    });
    const res = (await executeChatTool(petugas, 'getReportStatus', { report_id: REPORT_UUID })) as Record<string, unknown>;
    expect(res.error).toBeDefined();
  });

  it('mencari laporan dengan kata kunci + rentang tanggal (filter diterapkan ke query)', async () => {
    mockPrisma.reports.findMany.mockResolvedValue([reportRow()]);
    const res = (await executeChatTool(admin, 'searchReports', {
      query: 'lubang',
      date_from: '2026-01-01',
      date_to: '2026-01-31',
      limit: 5,
    })) as Record<string, unknown>;

    expect(res.jumlah).toBe(1);
    const where = mockPrisma.reports.findMany.mock.calls[0][0].where as Record<string, unknown>;
    expect(where.OR).toBeDefined();
    expect(where.created_at).toMatchObject({ gte: expect.any(Date), lte: expect.any(Date) });
  });

  it('membatasi scope masyarakat ke laporan miliknya sendiri', async () => {
    mockPrisma.reports.findMany.mockResolvedValue([]);
    await executeChatTool(warga, 'searchReports', { query: 'x' });
    const where = mockPrisma.reports.findMany.mock.calls[0][0].where as Record<string, unknown>;
    expect(where.user_id).toBe('u1');
  });

  it('membatasi scope petugas ke laporan yang ditugaskan padanya', async () => {
    mockPrisma.reports.findMany.mockResolvedValue([]);
    await executeChatTool(petugas, 'searchReports', { query: 'x' });
    const where = mockPrisma.reports.findMany.mock.calls[0][0].where as Record<string, unknown>;
    expect(where.assignments).toEqual({ some: { petugas_id: 'p1' } });
  });
});

describe('chat tools — join antar tabel', () => {
  it('getOfficerTasks menggabungkan assignments + reports + petugas', async () => {
    mockPrisma.assignments.findMany.mockResolvedValue([
      { id: 'as1', assigned_at: new Date().toISOString(), petugas: { nama: 'Petugas' }, report: reportRow() },
    ]);
    const res = (await executeChatTool(petugas, 'getOfficerTasks', {})) as Record<string, unknown>;
    const tugas = res.tugas as Array<Record<string, unknown>>;
    expect(tugas[0].petugas).toBe('Petugas');
    expect((tugas[0].laporan as Record<string, unknown>).judul).toBe('Jalan Berlubang');
  });

  it('getResolutionTime menghitung rata-rata durasi', async () => {
    const start = new Date('2026-01-01T00:00:00Z');
    const finish = new Date('2026-01-02T00:00:00Z'); // 24 jam
    mockPrisma.reports.findMany.mockResolvedValue([
      { created_at: start, updates: [{ created_at: finish }] },
    ]);
    const res = (await executeChatTool(admin, 'getResolutionTime', {})) as Record<string, unknown>;
    expect(res.jumlah_selesai).toBe(1);
    expect(res.rata_rata_jam).toBe(24);
    expect(res.rata_rata_hari).toBe(1);
  });
});

describe('chat tools — GIS', () => {
  it('menyaring laporan dalam radius koordinat', async () => {
    // Siliwangi sekitar -6.72, 108.56
    mockPrisma.reports.findMany.mockResolvedValue([
      { ...reportRow({ id: 'dekat' }), latitude: -6.7205, longitude: 108.5605 },
      { ...reportRow({ id: 'jauh' }), latitude: -6.9, longitude: 108.9 },
    ]);
    const res = (await executeChatTool(admin, 'getReportsNearby', {
      latitude: -6.72,
      longitude: 108.56,
      radius_km: 3,
    })) as Record<string, unknown>;
    const laporan = res.laporan as Array<Record<string, unknown>>;
    expect(laporan.map((l) => l.id)).toEqual(['dekat']);
    expect(laporan[0].jarak_km as number).toBeLessThanOrEqual(3);
  });
});

describe('chat tools — pengguna & petugas (admin only)', () => {
  it('getOfficerSummary mengembalikan jumlah petugas + performa', async () => {
    mockPrisma.users.groupBy.mockImplementation((args: { by: string[] }) => {
      if (args.by[0] === 'status') return Promise.resolve([{ status: 'AKTIF', _count: { _all: 3 } }]);
      return Promise.resolve([
        { role: 'petugas', _count: { _all: 3 } },
        { role: 'masyarakat', _count: { _all: 8 } },
      ]);
    });
    mockPrisma.users.findMany.mockResolvedValue([]);
    const res = (await executeChatTool(admin, 'getOfficerSummary', {})) as Record<string, unknown>;
    expect(res.total_petugas).toBe(3);
    expect(res.aktif).toBe(3);
  });

  it('masyarakat tidak boleh memanggil getOfficerSummary / getUserSummary', async () => {
    const a = (await executeChatTool(warga, 'getOfficerSummary', {})) as Record<string, unknown>;
    const b = (await executeChatTool(warga, 'getUserSummary', {})) as Record<string, unknown>;
    expect(a.error).toBeDefined();
    expect(b.error).toBeDefined();
  });

  it('masyarakat tidak boleh memanggil getUnassignedReports', async () => {
    const res = (await executeChatTool(warga, 'getUnassignedReports', {})) as Record<string, unknown>;
    expect(res.error).toBeDefined();
  });

  it('getUserSummary mengelompokkan per role', async () => {
    mockPrisma.users.groupBy.mockResolvedValue([
      { role: 'masyarakat', _count: { _all: 5 } },
      { role: 'admin', _count: { _all: 1 } },
    ]);
    const res = (await executeChatTool(admin, 'getUserSummary', {})) as Record<string, unknown>;
    expect(res.total_pengguna).toBe(6);
  });
});

describe('chat tools — database kosong & kegagalan koneksi', () => {
  it('database kosong → angka nol / data kosong (bukan error)', async () => {
    mockPrisma.reports.count.mockResolvedValue(0);
    mockPrisma.reports.groupBy.mockResolvedValue([]);
    mockPrisma.reports.findMany.mockResolvedValue([]);

    const stats = (await executeChatTool(admin, 'getDashboardStatistics', {})) as Record<string, unknown>;
    expect(stats.total_laporan).toBe(0);

    const analytics = (await executeChatTool(admin, 'getReportAnalytics', { group_by: 'kategori' })) as Record<
      string,
      unknown
    >;
    expect(analytics.data).toEqual([]);
  });

  it('kegagalan koneksi → error yang aman, bukan lemparan', async () => {
    mockPrisma.reports.findMany.mockRejectedValue(new Error('ECONNREFUSED raw db detail'));
    const res = (await executeChatTool(admin, 'searchReports', { query: 'apa' })) as Record<string, unknown>;
    expect(typeof res.error).toBe('string');
    expect(res.error as string).not.toMatch(/ECONNREFUSED/);
  });

  it('rata-rata waktu kosong saat tidak ada laporan selesai', async () => {
    mockPrisma.reports.findMany.mockResolvedValue([]);
    const res = (await executeChatTool(admin, 'getResolutionTime', {})) as Record<string, unknown>;
    expect(res.jumlah_selesai).toBe(0);
    expect(res.rata_rata_jam).toBeNull();
  });
});

describe('chat tools — keamanan & anti prompt-injection', () => {
  it('menolak nama tool yang tidak dikenal', async () => {
    const res = (await executeChatTool(admin, 'runSql', { sql: 'SELECT 1' })) as Record<string, unknown>;
    expect(res.error).toBeDefined();
  });

  it('tidak ada tool tulis/berbahaya yang terdaftar', () => {
    const forbidden = /delete|update|insert|drop|alter|truncate|exec|sql|write|create.*user/i;
    for (const name of CHAT_TOOL_NAMES) {
      expect(forbidden.test(name)).toBe(false);
    }
  });

  it('menolak akses tool lintas role', () => {
    expect(() => assertToolAllowed('masyarakat', 'getOfficerTasks')).toThrow();
    expect(() => assertToolAllowed('petugas', 'getUserSummary')).toThrow();
    expect(ROLE_TOOLS.masyarakat).not.toContain('getUnassignedReports');
  });

  it('argumen tidak valid dikembalikan sebagai error (bukan dieksekusi)', async () => {
    const res = (await executeChatTool(admin, 'getReportStatus', { report_id: 'bukan-uuid' })) as Record<
      string,
      unknown
    >;
    expect(res.error).toBeDefined();
    expect(mockPrisma.reports.findUnique).not.toHaveBeenCalled();
  });

  it('koordinat di luar rentang ditolak', async () => {
    const res = (await executeChatTool(admin, 'getReportsNearby', { latitude: 999, longitude: 999 })) as Record<
      string,
      unknown
    >;
    expect(res.error).toBeDefined();
    expect(mockPrisma.reports.findMany).not.toHaveBeenCalled();
  });
});
