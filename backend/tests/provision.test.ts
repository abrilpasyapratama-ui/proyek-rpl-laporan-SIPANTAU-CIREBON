import { describe, it, expect, vi, beforeEach } from 'vitest';
import bcrypt from 'bcryptjs';

vi.mock('../src/utils/db', () => ({
  default: {
    users: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    $disconnect: vi.fn(),
  },
}));

import prisma from '../src/utils/db';
import { provisionAdmin, validateAdminPassword } from '../scripts/provision-admin';

const mockPrisma = prisma as unknown as {
  users: { findUnique: ReturnType<typeof vi.fn>; create: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };
};

describe('provision-admin', () => {
  beforeEach(() => vi.clearAllMocks());

  it('rejects weak passwords without touching db', async () => {
    await expect(
      provisionAdmin({ username: 'my.admin', email: 'a@b.id', password: 'lemah' })
    ).rejects.toThrow(/minimal 8 karakter/);
    expect(mockPrisma.users.create).not.toHaveBeenCalled();
  });

  it('creates admin with bcrypt hash and force-change flag', async () => {
    mockPrisma.users.findUnique.mockResolvedValue(null);
    mockPrisma.users.create.mockResolvedValue({ id: 'adm1' });

    const res = await provisionAdmin({ username: 'my.admin', email: 'admin123@gmail.com', password: 'Admin112' });

    expect(res.outcome).toBe('created');
    const data = mockPrisma.users.create.mock.calls[0][0].data;
    expect(data.role).toBe('admin');
    expect(data.status).toBe('AKTIF');
    expect(data.must_change_password).toBe(true);
    expect(data.password).not.toBe('Admin112');
    expect(await bcrypt.compare('Admin112', data.password)).toBe(true);
  });

  it('is idempotent: existing admin untouched without force flag', async () => {
    mockPrisma.users.findUnique.mockResolvedValue({
      id: 'adm1', role: 'admin', status: 'AKTIF', username: 'my.admin',
    });

    const res = await provisionAdmin({ username: 'my.admin', email: 'admin123@gmail.com', password: 'Admin112' });

    expect(res.outcome).toBe('exists_unchanged');
    expect(mockPrisma.users.update).not.toHaveBeenCalled();
  });

  it('refuses to hijack non-admin email', async () => {
    mockPrisma.users.findUnique.mockResolvedValue({ id: 'u1', role: 'masyarakat', status: 'AKTIF' });

    await expect(
      provisionAdmin({ username: 'x', email: 'u@x.id', password: 'Admin112' })
    ).rejects.toThrow(/bukan|dibatalkan|dipakai/i);
    expect(mockPrisma.users.create).not.toHaveBeenCalled();
    expect(mockPrisma.users.update).not.toHaveBeenCalled();
  });
});
