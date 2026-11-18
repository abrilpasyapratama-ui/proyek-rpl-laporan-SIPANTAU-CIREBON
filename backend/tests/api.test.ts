import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

// Mock prisma before importing app
vi.mock('../src/utils/db', () => {
  const mockPrisma: any = {
    users: {
      findUnique: vi.fn(),
      create: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    reports: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
    },
    notifications: {
      create: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
    },
    assignments: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      count: vi.fn(),
    },
    report_updates: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
    $queryRaw: vi.fn().mockResolvedValue([{ '?column?': 1 }]),
    $transaction: vi.fn(),
    $disconnect: vi.fn(),
  };
  return { default: mockPrisma };
});

import app from '../src/index';
import prisma from '../src/utils/db';

const mockPrisma = prisma as any;

describe('API - auth & security', () => {
  beforeEach(() => vi.clearAllMocks());

  it('GET /health returns ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('POST /api/auth/register rejects invalid body (zod)', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ nama: 'A', email: 'bukan-email', password: '123' });
    expect(res.status).toBe(400);
    expect(res.body.status).toBe('error');
  });

  it('POST /api/auth/register returns 409 for duplicate email', async () => {
    mockPrisma.users.findUnique.mockResolvedValue({ id: 'u1' });
    const res = await request(app)
      .post('/api/auth/register')
      .send({ nama: 'Budi Santoso', email: 'budi@example.com', password: 'Rahasia123' });
    expect(res.status).toBe(409);
  });

  it('POST /api/auth/login returns 401 for unknown user', async () => {
    mockPrisma.users.findUnique.mockResolvedValue(null);
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'x@y.com', password: 'apapun123' });
    expect(res.status).toBe(401);
  });

  it('POST /api/reports without token returns 401', async () => {
    const res = await request(app).post('/api/reports').send({});
    expect(res.status).toBe(401);
  });

  it('POST /api/reports rejects invalid payload when authenticated', async () => {
    mockPrisma.users.findUnique.mockResolvedValue({ id: 'u1', role: 'masyarakat', status: 'AKTIF', email: 'a@b.com', nama: 'A' });
    const { generateToken } = await import('../src/utils/jwt');
    const token = generateToken({ userId: 'u1', role: 'masyarakat' });

    const res = await request(app)
      .post('/api/reports')
      .set('Authorization', `Bearer ${token}`)
      .send({ judul: 'abc' });
    expect(res.status).toBe(400);
  });

  it('GET /api/admin/reports forbids masyarakat role', async () => {
    mockPrisma.users.findUnique.mockResolvedValue({ id: 'u1', role: 'masyarakat', status: 'AKTIF', email: 'a@b.com', nama: 'A' });
    const { generateToken } = await import('../src/utils/jwt');
    const token = generateToken({ userId: 'u1', role: 'masyarakat' });

    const res = await request(app)
      .get('/api/admin/reports')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it('PATCH /api/admin/reports/:id/priority rejects invalid priority', async () => {
    mockPrisma.users.findUnique.mockResolvedValue({ id: 'admin1', role: 'admin', status: 'AKTIF', email: 'a@b.com', nama: 'Admin' });
    const { generateToken } = await import('../src/utils/jwt');
    const token = generateToken({ userId: 'admin1', role: 'admin' });

    const res = await request(app)
      .patch('/api/admin/reports/r1/priority')
      .set('Authorization', `Bearer ${token}`)
      .send({ priority: 'MEGA_URGENT!!!' });
    expect(res.status).toBe(400);
  });

  it('unknown route returns 404 JSON', async () => {
    const res = await request(app).get('/api/tidak-ada');
    expect(res.status).toBe(404);
    expect(res.body.status).toBe('error');
  });

  it('POST /api/petugas/tasks/:id/update forbids unassigned petugas', async () => {
    mockPrisma.users.findUnique.mockResolvedValue({ id: 'p1', role: 'petugas', status: 'AKTIF', email: 'p@b.com', nama: 'P' });
    mockPrisma.assignments.findUnique.mockResolvedValue(null);
    const { generateToken } = await import('../src/utils/jwt');
    const token = generateToken({ userId: 'p1', role: 'petugas' });

    const res = await request(app)
      .post('/api/petugas/tasks/r1/update')
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'DALAM_PERBAIKAN' });
    expect(res.status).toBe(403);
  });

  it('GET /api/reports/:id returns own report for masyarakat', async () => {
    mockPrisma.users.findUnique.mockResolvedValue({ id: 'u1', role: 'masyarakat', status: 'AKTIF', email: 'a@b.com', nama: 'A' });
    mockPrisma.reports.findFirst.mockResolvedValue({ id: 'r1', user_id: 'u1', judul: 'Lampu mati' });
    const { generateToken } = await import('../src/utils/jwt');
    const token = generateToken({ userId: 'u1', role: 'masyarakat' });

    const res = await request(app)
      .get('/api/reports/r1')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(mockPrisma.reports.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'r1', user_id: 'u1' } })
    );
  });

  it('GET /api/reports/:id returns 404 for other user report', async () => {
    mockPrisma.users.findUnique.mockResolvedValue({ id: 'u2', role: 'masyarakat', status: 'AKTIF', email: 'b@b.com', nama: 'B' });
    mockPrisma.reports.findFirst.mockResolvedValue(null);
    const { generateToken } = await import('../src/utils/jwt');
    const token = generateToken({ userId: 'u2', role: 'masyarakat' });

    const res = await request(app)
      .get('/api/reports/r1')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

  it('PUT /api/admin/reports/:id/verify rejects REJECT without reason', async () => {
    mockPrisma.users.findUnique.mockResolvedValue({ id: 'admin1', role: 'admin', status: 'AKTIF', email: 'a@b.com', nama: 'Admin' });
    const { generateToken } = await import('../src/utils/jwt');
    const token = generateToken({ userId: 'admin1', role: 'admin' });

    const res = await request(app)
      .put('/api/admin/reports/r1/verify')
      .set('Authorization', `Bearer ${token}`)
      .send({ action: 'REJECT' });
    expect(res.status).toBe(400);
  });

  it('GET /api/admin/assignments returns assignment list for admin', async () => {
    mockPrisma.users.findUnique.mockResolvedValue({ id: 'admin1', role: 'admin', status: 'AKTIF', email: 'a@b.com', nama: 'Admin' });
    mockPrisma.assignments.findMany.mockResolvedValue([]);
    mockPrisma.assignments.count.mockResolvedValue(0);
    const { generateToken } = await import('../src/utils/jwt');
    const token = generateToken({ userId: 'admin1', role: 'admin' });

    const res = await request(app)
      .get('/api/admin/assignments')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.meta.total).toBe(0);
  });

  it('PATCH /api/admin/users/:id/role forbids self-demotion', async () => {
    mockPrisma.users.findUnique.mockResolvedValue({ id: 'admin1', role: 'admin', status: 'AKTIF', email: 'a@b.com', nama: 'Admin' });
    const { generateToken } = await import('../src/utils/jwt');
    const token = generateToken({ userId: 'admin1', role: 'admin' });

    const res = await request(app)
      .patch('/api/admin/users/admin1/role')
      .set('Authorization', `Bearer ${token}`)
      .send({ role: 'masyarakat' });
    expect(res.status).toBe(403);
  });

  it('PATCH /api/admin/users/:id/role updates other user role', async () => {
    mockPrisma.users.findUnique.mockResolvedValue({ id: 'admin1', role: 'admin', status: 'AKTIF', email: 'a@b.com', nama: 'Admin' });
    mockPrisma.users.update.mockResolvedValue({ id: 'u9', role: 'petugas' });
    const { generateToken } = await import('../src/utils/jwt');
    const token = generateToken({ userId: 'admin1', role: 'admin' });

    // findUnique dipanggil authenticate + updateUserRole; siapkan hasil berurutan
    mockPrisma.users.findUnique
      .mockResolvedValueOnce({ id: 'admin1', role: 'admin', status: 'AKTIF', email: 'a@b.com', nama: 'Admin' })
      .mockResolvedValueOnce({ id: 'u9', role: 'masyarakat', email: 'u@b.com', nama: 'U' });

    const res = await request(app)
      .patch('/api/admin/users/u9/role')
      .set('Authorization', `Bearer ${token}`)
      .send({ role: 'petugas' });
    expect(res.status).toBe(200);
  });

  it('PATCH /api/auth/profile updates own nama', async () => {
    mockPrisma.users.findUnique.mockResolvedValue({ id: 'u1', role: 'masyarakat', status: 'AKTIF', email: 'a@b.com', nama: 'A' });
    mockPrisma.users.update.mockResolvedValue({ id: 'u1', nama: 'Budi Baru' });
    const { generateToken } = await import('../src/utils/jwt');
    const token = generateToken({ userId: 'u1', role: 'masyarakat' });

    const res = await request(app)
      .patch('/api/auth/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ nama: 'Budi Baru' });
    expect(res.status).toBe(200);
  });

  it('PATCH /api/auth/password rejects wrong current password', async () => {
    const bcrypt = await import('bcryptjs');
    mockPrisma.users.findUnique.mockResolvedValue({
      id: 'u1', role: 'masyarakat', status: 'AKTIF', email: 'a@b.com', nama: 'A',
      password: await bcrypt.hash('Lama1234', 10),
    });
    const { generateToken } = await import('../src/utils/jwt');
    const token = generateToken({ userId: 'u1', role: 'masyarakat' });

    const res = await request(app)
      .patch('/api/auth/password')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: 'Salah1234', newPassword: 'Baru1234' });
    expect(res.status).toBe(401);
  });

  it('POST /api/auth/login includes must_change_password flag', async () => {
    const bcrypt = await import('bcryptjs');
    mockPrisma.users.findUnique.mockResolvedValue({
      id: 'a1', role: 'admin', status: 'AKTIF', email: 'a@b.com', nama: 'A',
      must_change_password: true,
      password: await bcrypt.hash('Rahasia123', 10),
    });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'a@b.com', password: 'Rahasia123' });
    expect(res.status).toBe(200);
    expect(res.body.data.user.must_change_password).toBe(true);
  });

  it('PATCH /api/auth/password clears must_change_password flag', async () => {
    const bcrypt = await import('bcryptjs');
    mockPrisma.users.findUnique.mockResolvedValue({
      id: 'a1', role: 'admin', status: 'AKTIF', email: 'a@b.com', nama: 'A',
      password: await bcrypt.hash('Lama1234', 10),
    });
    const { generateToken } = await import('../src/utils/jwt');
    const token = generateToken({ userId: 'a1', role: 'admin' });

    const res = await request(app)
      .patch('/api/auth/password')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: 'Lama1234', newPassword: 'Baru1234' });
    expect(res.status).toBe(200);
    expect(mockPrisma.users.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ must_change_password: false }) })
    );
  });
});

describe('API - registrasi multirole & verifikasi petugas', () => {
  beforeEach(() => vi.clearAllMocks());

  const tokenFor = async (userId: string, role: string, status = 'AKTIF') => {
    mockPrisma.users.findUnique.mockResolvedValue({ id: userId, role, status, email: `${userId}@x.id`, nama: 'U' });
    const { generateToken } = await import('../src/utils/jwt');
    return generateToken({ userId, role });
  };

  it('POST /api/auth/register petugas creates MENUNGGU_VERIFIKASI account', async () => {
    mockPrisma.users.findUnique.mockResolvedValue(null);
    mockPrisma.users.create.mockResolvedValue({ id: 'p9', role: 'petugas', status: 'MENUNGGU_VERIFIKASI' });

    const res = await request(app)
      .post('/api/auth/register')
      .send({ nama: 'Petugas Baru', email: 'p9@x.id', password: 'Rahasia123', role: 'petugas', instansi: 'Dinas PU' });

    expect(res.status).toBe(201);
    expect(res.body.message).toMatch(/menunggu verifikasi/i);
    expect(mockPrisma.users.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ role: 'petugas', status: 'MENUNGGU_VERIFIKASI', instansi: 'Dinas PU' }),
      })
    );
  });

  it('POST /api/auth/register rejects admin role (schema 400 + controller guard)', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ nama: 'Hacker', email: 'h@x.id', password: 'Rahasia123', role: 'admin' });

    // Zod menolak 'admin' di lapisan validasi (400); controller juga
    // menjaga dengan 403 bila nilai lolos validasi.
    expect([400, 403]).toContain(res.status);
    expect(mockPrisma.users.create).not.toHaveBeenCalled();
  });

  it('POST /api/auth/login blocks pending petugas with 403', async () => {
    const bcrypt = await import('bcryptjs');
    mockPrisma.users.findUnique.mockResolvedValue({
      id: 'p1', role: 'petugas', status: 'MENUNGGU_VERIFIKASI', email: 'p@x.id', nama: 'P',
      password: await bcrypt.hash('Rahasia123', 10),
    });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'p@x.id', password: 'Rahasia123' });

    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/menunggu verifikasi/i);
  });

  it('GET /api/petugas/tasks blocks pending account even with valid token', async () => {
    const token = await tokenFor('p1', 'petugas', 'MENUNGGU_VERIFIKASI');

    const res = await request(app)
      .get('/api/petugas/tasks')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  it('GET /api/admin/verifications lists pending petugas for admin', async () => {
    const token = await tokenFor('admin1', 'admin');
    mockPrisma.users.findMany.mockResolvedValue([]);
    mockPrisma.users.count.mockResolvedValue(0);

    const res = await request(app)
      .get('/api/admin/verifications')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(mockPrisma.users.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { role: 'petugas', status: 'MENUNGGU_VERIFIKASI' } })
    );
  });

  it('GET /api/admin/verifications forbids non-admin', async () => {
    const token = await tokenFor('u1', 'masyarakat');

    const res = await request(app)
      .get('/api/admin/verifications')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  it('PATCH /api/admin/verifications/:id approves petugas + notifies', async () => {
    const token = await tokenFor('admin1', 'admin');
    mockPrisma.users.findUnique
      .mockResolvedValueOnce({ id: 'admin1', role: 'admin', status: 'AKTIF', email: 'a@b.com', nama: 'Admin' })
      .mockResolvedValueOnce({ id: 'p9', role: 'petugas', status: 'MENUNGGU_VERIFIKASI' });
    mockPrisma.users.update.mockResolvedValue({ id: 'p9', role: 'petugas', status: 'AKTIF' });

    const res = await request(app)
      .patch('/api/admin/verifications/p9')
      .set('Authorization', `Bearer ${token}`)
      .send({ action: 'APPROVE' });

    expect(res.status).toBe(200);
    expect(mockPrisma.users.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'AKTIF' } })
    );
    expect(mockPrisma.notifications.create).toHaveBeenCalled();
  });

  it('PATCH /api/admin/verifications/:id rejects non-pending account with 400', async () => {
    const token = await tokenFor('admin1', 'admin');
    mockPrisma.users.findUnique
      .mockResolvedValueOnce({ id: 'admin1', role: 'admin', status: 'AKTIF', email: 'a@b.com', nama: 'Admin' })
      .mockResolvedValueOnce({ id: 'p9', role: 'petugas', status: 'AKTIF' });

    const res = await request(app)
      .patch('/api/admin/verifications/p9')
      .set('Authorization', `Bearer ${token}`)
      .send({ action: 'APPROVE' });

    expect(res.status).toBe(400);
  });
});
