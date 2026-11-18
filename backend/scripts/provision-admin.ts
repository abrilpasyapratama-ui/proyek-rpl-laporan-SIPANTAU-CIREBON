/**
 * Provisioning akun administrator — HANYA via CLI server, BUKAN endpoint publik.
 *
 * Penggunaan (PowerShell, rahasia hanya di environment proses ini):
 *   $env:ADMIN_USERNAME='my.admin'; $env:ADMIN_EMAIL='admin123@gmail.com'
 *   $env:ADMIN_PASSWORD='...'  # min 8 char, upper+lower+angka
 *   npm run provision:admin
 *
 * Opsional: $env:ADMIN_NAMA, $env:ADMIN_FORCE_RESET='true' (reset password
 * akun admin yang sudah ada — default TIDAK menimpa password).
 *
 * Idempotent: akun yang sudah ada (cocok email) hanya dilengkapi
 * username/status-nya; password tidak disentuh kecuali ADMIN_FORCE_RESET.
 */
import bcrypt from 'bcryptjs';
import prisma from '../src/utils/db';
import { logger } from '../src/utils/logger';

export interface ProvisionInput {
  username: string;
  email: string;
  password: string;
  nama?: string;
  forceReset?: boolean;
}

export type ProvisionResult =
  | { outcome: 'created'; id: string }
  | { outcome: 'exists_unchanged'; id: string }
  | { outcome: 'updated'; id: string; changes: string[] };

export function validateAdminPassword(password: string): string | null {
  if (!password || password.length < 8) return 'Password minimal 8 karakter';
  if (password.length > 100) return 'Password maksimal 100 karakter';
  if (!/[A-Z]/.test(password)) return 'Password harus mengandung huruf besar';
  if (!/[a-z]/.test(password)) return 'Password harus mengandung huruf kecil';
  if (!/[0-9]/.test(password)) return 'Password harus mengandung angka';
  return null;
}

export async function provisionAdmin(input: ProvisionInput): Promise<ProvisionResult> {
  const username = input.username.trim();
  const email = input.email.trim().toLowerCase();
  if (!username) throw new Error('ADMIN_USERNAME wajib diisi');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('ADMIN_EMAIL tidak valid');

  const pwError = validateAdminPassword(input.password);
  if (pwError) throw new Error(pwError);

  const existing = await prisma.users.findUnique({ where: { email } });
  if (!existing) {
    const hashed = await bcrypt.hash(input.password, 10);
    const created = await prisma.users.create({
      data: {
        nama: input.nama?.trim() || username,
        username,
        email,
        password: hashed,
        role: 'admin',
        status: 'AKTIF',
        must_change_password: true,
      },
      select: { id: true },
    });
    logger.audit('admin_provisioned', { userId: created.id, email });
    return { outcome: 'created', id: created.id };
  }

  // Akun sudah ada — jangan timpa sembarangan.
  if (existing.role !== 'admin') {
    throw new Error(`Email sudah dipakai akun role '${existing.role}'. Provisioning dibatalkan demi keamanan.`);
  }
  const changes: string[] = [];
  const data: Record<string, unknown> = {};
  if (!existing.username) {
    data.username = username;
    changes.push('username');
  }
  if ((existing as { status?: string }).status !== 'AKTIF') {
    data.status = 'AKTIF';
    changes.push('status');
  }
  if (input.forceReset) {
    data.password = await bcrypt.hash(input.password, 10);
    data.must_change_password = true;
    changes.push('password');
  }
  if (changes.length === 0) return { outcome: 'exists_unchanged', id: existing.id };
  await prisma.users.update({ where: { id: existing.id }, data: data as never });
  logger.audit('admin_provisioned_update', { userId: existing.id, email, changes });
  return { outcome: 'updated', id: existing.id, changes };
}

// CLI entrypoint — hanya saat dijalankan langsung, bukan saat diimpor test.
const isMain = typeof require !== 'undefined' && require.main === module;
if (isMain) {
  provisionAdmin({
    username: process.env.ADMIN_USERNAME || '',
    email: process.env.ADMIN_EMAIL || '',
    password: process.env.ADMIN_PASSWORD || '',
    nama: process.env.ADMIN_NAMA,
    forceReset: process.env.ADMIN_FORCE_RESET === 'true',
  })
    .then((r) => {
      // Sengaja tanpa kredensial di output.
      console.log(`OK: ${r.outcome}`);
      process.exit(0);
    })
    .catch((e: Error) => {
      console.error(`GAGAL: ${e.message}`);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
