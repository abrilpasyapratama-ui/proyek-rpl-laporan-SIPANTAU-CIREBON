import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

// Mock Prisma sebelum mengimpor app.
vi.mock('../src/utils/db', () => {
  const mock: any = {
    users: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    reports: { count: vi.fn() },
    assignments: { count: vi.fn() },
    report_updates: { count: vi.fn() },
    notifications: { count: vi.fn(), create: vi.fn() },
    conversations: { count: vi.fn() },
    chat_analytics: { count: vi.fn() },
    user_whatsapp_preferences: { count: vi.fn() },
    telegram_link_codes: { count: vi.fn() },
    telegram_message_logs: { count: vi.fn() },
    $transaction: vi.fn(),
    $disconnect: vi.fn(),
  };
  return { default: mock };
});

import app from '../src/index';
import prisma from '../src/utils/db';
import { generateToken } from '../src/utils/jwt';

const mockPrisma = prisma as unknown as Record<string, any>;

const ADMIN_ID = 'admin1';
const SECOND_ADMIN_ID = 'admin2';
const TARGET_ID = 'u1';

const publicUser = (over: Record<string, unknown> = {}) => ({
  id: TARGET_ID,
  nama: 'Warga Cirebon',
  username: 'warga.cirebon',
  email: 'warga@example.com',
  no_hp: '081234567890',
  no_hp_normalized: '6281234567890',
  role: 'masyarakat',
  status: 'AKTIF',
  created_at: new Date('2026-05-01T00:00:00.000Z'),
  _count: { reports: 2 },
  ...over,
});

const adminUser = (over: Record<string, unknown> = {}) => ({
  id: ADMIN_ID,
  nama: 'Admin Utama',
  username: 'admin.utama',
  email: 'admin1@example.com',
  no_hp: '081111111111',
  no_hp_normalized: '6281111111111',
  role: 'admin',
  status: 'AKTIF',
  password: '$2a$10$hashrahasia',
  created_at: new Date('2026-01-01T00:00:00.000Z'),
  _count: { reports: 0 },
  ...over,
});

let db: Record<string, any>;

const token = () => generateToken({ userId: ADMIN_ID, role: 'admin' });
const auth = () => ({ Authorization: `Bearer ${token()}` });

beforeEach(() => {
  vi.clearAllMocks();

  db = {
    [ADMIN_ID]: adminUser(),
    [SECOND_ADMIN_ID]: adminUser({ id: SECOND_ADMIN_ID, nama: 'Admin Kedua', email: 'admin2@example.com' }),
    [TARGET_ID]: publicUser(),
  };

  mockPrisma.users.findUnique.mockImplementation(async (args: any) => {
    const row = db[args?.where?.id];
    return row ? { ...row } : null;
  });
  mockPrisma.users.findFirst.mockResolvedValue(null);
  mockPrisma.users.findMany.mockResolvedValue([]);
  mockPrisma.users.count.mockResolvedValue(2);
  mockPrisma.users.update.mockImplementation(async (args: any) => ({
    ...publicUser(),
    ...args.data,
  }));
  mockPrisma.users.delete.mockResolvedValue({ id: TARGET_ID });

  for (const model of [
    'reports',
    'assignments',
    'report_updates',
    'notifications',
    'conversations',
    'chat_analytics',
    'user_whatsapp_preferences',
    'telegram_link_codes',
    'telegram_message_logs',
  ]) {
    mockPrisma[model].count.mockResolvedValue(0);
  }
  mockPrisma.notifications.create.mockResolvedValue({ id: 'n1' });

  mockPrisma.$transaction.mockImplementation(async (arg: any) => {
    if (typeof arg === 'function') return arg(mockPrisma);
    return Promise.all(arg);
  });
});

describe('GET /api/admin/users', () => {
  it('menampilkan SEMUA role dan tidak memilih kolom password', async () => {
    mockPrisma.users.findMany.mockResolvedValue([
      publicUser(),
      adminUser({ password: undefined }),
    ]);

    const res = await request(app).get('/api/admin/users').set(auth());

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.data[0]).not.toHaveProperty('password');

    const select = mockPrisma.users.findMany.mock.calls[0][0].select;
    expect(select.password).toBeUndefined();
    // tidak ada filter role=masyarakat lagi
    expect(mockPrisma.users.findMany.mock.calls[0][0].where.role).toBeUndefined();
  });

  it('mendukung filter role dan pencarian', async () => {
    mockPrisma.users.findMany.mockResolvedValue([]);
    const res = await request(app).get('/api/admin/users?role=petugas&q=bella').set(auth());

    expect(res.status).toBe(200);
    expect(mockPrisma.users.findMany.mock.calls[0][0].where.role).toBe('petugas');
    expect(mockPrisma.users.findMany.mock.calls[0][0].where.OR).toBeTruthy();
  });

  it('menolak masyarakat dan petugas (403)', async () => {
    db['warga-x'] = { id: 'warga-x', role: 'masyarakat', status: 'AKTIF', nama: 'W', email: 'w@x.id' };
    db['petugas-x'] = { id: 'petugas-x', role: 'petugas', status: 'AKTIF', nama: 'P', email: 'p@x.id' };

    for (const [id, role] of [['warga-x', 'masyarakat'], ['petugas-x', 'petugas']]) {
      const t = generateToken({ userId: id, role });
      const res = await request(app).get('/api/admin/users').set('Authorization', `Bearer ${t}`);
      expect(res.status).toBe(403);
    }
  });
});

describe('GET /api/admin/users/:id', () => {
  it('mengembalikan detail pengguna tanpa password', async () => {
    const res = await request(app).get(`/api/admin/users/${TARGET_ID}`).set(auth());
    expect(res.status).toBe(200);
    expect(res.body.data.email).toBe('warga@example.com');
    expect(res.body.data).not.toHaveProperty('password');
  });

  it('404 jika pengguna tidak ada', async () => {
    const res = await request(app).get('/api/admin/users/tidak-ada').set(auth());
    expect(res.status).toBe(404);
  });
});

describe('PATCH /api/admin/users/:id — edit pengguna', () => {
  it('mengubah nama, email, dan nomor HP tanpa menyentuh password', async () => {
    mockPrisma.users.findMany.mockResolvedValue([]);
    mockPrisma.users.update.mockImplementation(async (args: any) => ({
      ...publicUser(),
      ...args.data,
    }));

    const res = await request(app)
      .patch(`/api/admin/users/${TARGET_ID}`)
      .set(auth())
      .send({ nama: 'Nama Baru', email: 'baru@example.com', no_hp: '0813-9876-5432' });

    expect(res.status).toBe(200);
    expect(res.body.data.nama).toBe('Nama Baru');
    expect(res.body.data.email).toBe('baru@example.com');
    expect(res.body.data).not.toHaveProperty('password');

    const updateArgs = mockPrisma.users.update.mock.calls[0][0];
    expect(updateArgs.data.password).toBeUndefined();
    expect(updateArgs.data.nama).toBe('Nama Baru');
    expect(updateArgs.data.no_hp_normalized).toBe('6281398765432');
  });

  it('menolak email duplikat dengan pesan jelas (409)', async () => {
    mockPrisma.users.findMany.mockResolvedValue([
      { email: 'dipakai@example.com', username: null, no_hp_normalized: null },
    ]);

    const res = await request(app)
      .patch(`/api/admin/users/${TARGET_ID}`)
      .set(auth())
      .send({ email: 'dipakai@example.com' });

    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/email sudah digunakan/i);
    expect(mockPrisma.users.update).not.toHaveBeenCalled();
  });

  it('menolak username duplikat dengan pesan jelas (409)', async () => {
    mockPrisma.users.findMany.mockResolvedValue([
      { email: 'lain@example.com', username: 'dipakai', no_hp_normalized: null },
    ]);

    const res = await request(app)
      .patch(`/api/admin/users/${TARGET_ID}`)
      .set(auth())
      .send({ username: 'dipakai' });

    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/username sudah digunakan/i);
  });

  it('menolak nomor HP dengan format tidak valid (400)', async () => {
    const res = await request(app)
      .patch(`/api/admin/users/${TARGET_ID}`)
      .set(auth())
      .send({ no_hp: '12345' });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/nomor hp tidak valid/i);
    expect(mockPrisma.users.update).not.toHaveBeenCalled();
  });

  it('mengubah role pengguna lain dan mengirim notifikasi', async () => {
    const res = await request(app)
      .patch(`/api/admin/users/${TARGET_ID}`)
      .set(auth())
      .send({ role: 'petugas' });

    expect(res.status).toBe(200);
    expect(mockPrisma.users.update.mock.calls[0][0].data.role).toBe('petugas');
    expect(mockPrisma.notifications.create).toHaveBeenCalled();
  });

  it('role petugas pending yang diubah menjadi masyarakat otomatis AKTIF', async () => {
    db['p-pending'] = {
      id: 'p-pending',
      nama: 'Petugas Pending',
      username: null,
      email: 'pending@example.com',
      no_hp: null,
      role: 'petugas',
      status: 'MENUNGGU_VERIFIKASI',
      created_at: new Date('2026-06-01T00:00:00.000Z'),
    };

    const res = await request(app)
      .patch('/api/admin/users/p-pending')
      .set(auth())
      .send({ role: 'masyarakat' });

    expect(res.status).toBe(200);
    expect(mockPrisma.users.update.mock.calls[0][0].data).toMatchObject({
      role: 'masyarakat',
      status: 'AKTIF',
    });
  });

  it('menonaktifkan pengguna (status NONAKTIF) dan memberi notifikasi', async () => {
    const res = await request(app)
      .patch(`/api/admin/users/${TARGET_ID}`)
      .set(auth())
      .send({ status: 'NONAKTIF' });

    expect(res.status).toBe(200);
    expect(mockPrisma.users.update.mock.calls[0][0].data.status).toBe('NONAKTIF');
    expect(mockPrisma.notifications.create).toHaveBeenCalled();
  });

  it('admin tidak dapat mengubah role akun sendiri (403)', async () => {
    const res = await request(app)
      .patch(`/api/admin/users/${ADMIN_ID}`)
      .set(auth())
      .send({ role: 'masyarakat' });

    expect(res.status).toBe(403);
    expect(mockPrisma.users.update).not.toHaveBeenCalled();
  });

  it('admin tidak dapat menonaktifkan akun sendiri (403)', async () => {
    const res = await request(app)
      .patch(`/api/admin/users/${ADMIN_ID}`)
      .set(auth())
      .send({ status: 'NONAKTIF' });

    expect(res.status).toBe(403);
    expect(mockPrisma.users.update).not.toHaveBeenCalled();
  });

  it('admin aktif terakhir tidak dapat diturunkan role-nya (403)', async () => {
    mockPrisma.users.count.mockResolvedValue(1);

    const res = await request(app)
      .patch(`/api/admin/users/${SECOND_ADMIN_ID}`)
      .set(auth())
      .send({ role: 'masyarakat' });

    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/minimal satu akun ADMIN aktif/i);
    expect(mockPrisma.users.update).not.toHaveBeenCalled();
  });

  it('admin terakhir tidak dapat dinonaktifkan (403)', async () => {
    mockPrisma.users.count.mockResolvedValue(1);

    const res = await request(app)
      .patch(`/api/admin/users/${SECOND_ADMIN_ID}`)
      .set(auth())
      .send({ status: 'NONAKTIF' });

    expect(res.status).toBe(403);
    expect(mockPrisma.users.update).not.toHaveBeenCalled();
  });

  it('masyarakat/petugas tidak dapat mengakses endpoint (403)', async () => {
    db['warga-x'] = { id: 'warga-x', role: 'masyarakat', status: 'AKTIF', nama: 'W', email: 'w@x.id' };
    const t = generateToken({ userId: 'warga-x', role: 'masyarakat' });

    const res = await request(app)
      .patch(`/api/admin/users/${TARGET_ID}`)
      .set('Authorization', `Bearer ${t}`)
      .send({ nama: 'Hack Nama' });

    expect(res.status).toBe(403);
  });
});

describe('DELETE /api/admin/users/:id — hapus / nonaktifkan', () => {
  it('admin tidak dapat menghapus akun sendiri (403)', async () => {
    const res = await request(app).delete(`/api/admin/users/${ADMIN_ID}`).set(auth());
    expect(res.status).toBe(403);
    expect(mockPrisma.users.delete).not.toHaveBeenCalled();
  });

  it('admin aktif terakhir tidak dapat dihapus (403)', async () => {
    mockPrisma.users.count.mockResolvedValue(1);
    const res = await request(app).delete(`/api/admin/users/${SECOND_ADMIN_ID}`).set(auth());
    expect(res.status).toBe(403);
    expect(mockPrisma.users.delete).not.toHaveBeenCalled();
  });

  it('akun dengan laporan/riwayat dinonaktifkan (soft delete) dan data tidak dihapus', async () => {
    mockPrisma.reports.count.mockResolvedValue(4);
    mockPrisma.notifications.count.mockResolvedValue(13);
    mockPrisma.conversations.count.mockResolvedValue(7);

    const res = await request(app).delete(`/api/admin/users/${TARGET_ID}`).set(auth());

    expect(res.status).toBe(200);
    expect(res.body.mode).toBe('soft_delete');
    expect(res.body.relations.reports).toBe(4);
    expect(mockPrisma.users.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'NONAKTIF' } })
    );
    expect(mockPrisma.users.delete).not.toHaveBeenCalled();
    expect(mockPrisma.reports.count).toHaveBeenCalled();
  });

  it('akun tanpa relasi dihapus permanen dalam transaksi', async () => {
    const res = await request(app).delete(`/api/admin/users/${TARGET_ID}`).set(auth());

    expect(res.status).toBe(200);
    expect(res.body.mode).toBe('hard_delete');
    expect(mockPrisma.$transaction).toHaveBeenCalled();
    expect(mockPrisma.users.delete).toHaveBeenCalledWith({ where: { id: TARGET_ID } });
  });

  it('masyarakat/petugas tidak dapat menghapus pengguna (403)', async () => {
    db['petugas-x'] = { id: 'petugas-x', role: 'petugas', status: 'AKTIF', nama: 'P', email: 'p@x.id' };
    const t = generateToken({ userId: 'petugas-x', role: 'petugas' });

    const res = await request(app)
      .delete(`/api/admin/users/${TARGET_ID}`)
      .set('Authorization', `Bearer ${t}`);

    expect(res.status).toBe(403);
    expect(mockPrisma.users.delete).not.toHaveBeenCalled();
  });
});

describe('PATCH /api/auth/profile — edit profil sendiri', () => {
  it('dapat mengubah nama, email, nomor HP, dan username tanpa password', async () => {
    db[ADMIN_ID] = adminUser();
    mockPrisma.users.findFirst.mockResolvedValue(null);
    mockPrisma.users.update.mockImplementation(async (args: any) => ({
      id: ADMIN_ID,
      nama: args.data.nama ?? 'Admin Utama',
      username: args.data.username ?? 'admin.utama',
      email: args.data.email ?? 'admin1@example.com',
      no_hp: args.data.no_hp ?? '081111111111',
      role: 'admin',
      status: 'AKTIF',
      must_change_password: false,
      created_at: new Date('2026-01-01T00:00:00.000Z'),
    }));

    const res = await request(app)
      .patch('/api/auth/profile')
      .set(auth())
      .send({
        nama: 'Abril Pasya Pratama',
        email: 'admin.baru@example.com',
        no_hp: '085147722749',
        username: 'april.pratama',
      });

    expect(res.status).toBe(200);
    expect(res.body.data.nama).toBe('Abril Pasya Pratama');
    expect(res.body.data.email).toBe('admin.baru@example.com');
    expect(res.body.data).not.toHaveProperty('password');

    const updateArgs = mockPrisma.users.update.mock.calls[0][0];
    expect(updateArgs.data.password).toBeUndefined();
    expect(updateArgs.data.no_hp_normalized).toBe('6285147722749');
    expect(updateArgs.data.role).toBeUndefined();
    expect(updateArgs.data.status).toBeUndefined();
  });

  it('menolak email milik akun lain (409)', async () => {
    mockPrisma.users.findFirst.mockResolvedValue({
      email: 'sudah@example.com',
      username: null,
      no_hp_normalized: null,
    });

    const res = await request(app)
      .patch('/api/auth/profile')
      .set(auth())
      .send({ email: 'sudah@example.com' });

    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/email sudah digunakan/i);
  });

  it('menolak format nomor HP tidak valid (400)', async () => {
    const res = await request(app)
      .patch('/api/auth/profile')
      .set(auth())
      .send({ no_hp: 'bukan-nomor' });

    expect(res.status).toBe(400);
  });
});
