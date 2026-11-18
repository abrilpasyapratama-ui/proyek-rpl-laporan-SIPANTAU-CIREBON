/**
 * Membuat undangan aktivasi Admin untuk pemilik nomor WhatsApp — HANYA via CLI
 * server, BUKAN endpoint publik.
 *
 * Alur aman:
 *  1. Operator membuat token acak (>= 32 karakter) dan menjalankannya di sini.
 *     Yang disimpan hanya SHA-256(token); token TIDAK dicetak/di-log.
 *  2. Operator mengirim token ke pemilik nomor lewat kanal tepercaya (WhatsApp).
 *  3. Pemilik nomor mendaftar/masuk dengan nomor tersebut, lalu mengirim token
 *     ke POST /api/auth/admin-invite/accept. Role `admin` baru diberikan bila
 *     nomor akun cocok, token valid, belum dipakai, dan belum kedaluwarsa.
 *
 * Pemakaian (PowerShell):
 *   $env:ADMIN_PHONE='083190039713'
 *   $env:ADMIN_INVITE_TOKEN='<token-acak-min-32-karakter>'
 *   npm run invite:admin
 *
 * Opsional: ADMIN_INVITE_TTL_HOURS (default 48), ADMIN_INVITE_NOTE,
 *           ADMIN_CREATED_BY (label operator).
 */
import crypto from 'crypto';
import prisma from '../src/utils/db';
import { normalizePhone, maskPhone, phoneLookupVariants } from '../src/utils/phone';
import { logger } from '../src/utils/logger';

export interface InviteInput {
  phone: string;
  token: string;
  ttlHours?: number;
  note?: string;
  createdBy?: string;
}

export type InviteOutcome = 'invite_created_new_phone' | 'invite_created_existing_account' | 'already_admin';

export interface InviteResult {
  outcome: InviteOutcome;
  invitationId?: string;
  expiresAt?: Date;
  maskedPhone: string;
  targetUserId?: string;
}

export function hashInviteToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function validateInviteToken(token: string): string | null {
  if (!token) return 'ADMIN_INVITE_TOKEN wajib diisi';
  if (token.length < 32) return 'ADMIN_INVITE_TOKEN minimal 32 karakter';
  if (token.length > 200) return 'ADMIN_INVITE_TOKEN maksimal 200 karakter';
  return null;
}

export async function createAdminInvite(input: InviteInput): Promise<InviteResult> {
  const phone = normalizePhone(input.phone);
  if (!phone) throw new Error('ADMIN_PHONE tidak valid (contoh: 083190039713)');

  const tokenError = validateInviteToken(input.token);
  if (tokenError) throw new Error(tokenError);

  const existing = await prisma.users.findFirst({
    where: {
      OR: [
        { no_hp_normalized: phone },
        { no_hp: { in: phoneLookupVariants(phone) } },
      ],
    },
    select: { id: true, role: true },
  });

  if (existing?.role === 'admin') {
    return { outcome: 'already_admin', maskedPhone: maskPhone(phone), targetUserId: existing.id };
  }

  // Cabut undangan lama yang belum terpakai untuk nomor yang sama.
  await prisma.admin_invitations.deleteMany({
    where: { phone_normalized: phone, used_at: null },
  });

  const ttlHours = input.ttlHours && input.ttlHours > 0 ? input.ttlHours : 48;
  const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000);

  const invitation = await prisma.admin_invitations.create({
    data: {
      phone_normalized: phone,
      token_hash: hashInviteToken(input.token),
      note: input.note ?? null,
      expires_at: expiresAt,
      created_by: input.createdBy ?? 'cli',
    },
    select: { id: true, expires_at: true },
  });

  logger.audit('admin_invite_created', {
    invitationId: invitation.id,
    phone: maskPhone(phone),
    targetUserId: existing?.id ?? null,
    expiresAt: invitation.expires_at,
  });

  return {
    outcome: existing ? 'invite_created_existing_account' : 'invite_created_new_phone',
    invitationId: invitation.id,
    expiresAt: invitation.expires_at,
    maskedPhone: maskPhone(phone),
    targetUserId: existing?.id,
  };
}

const isMain = typeof require !== 'undefined' && require.main === module;
if (isMain) {
  createAdminInvite({
    phone: process.env.ADMIN_PHONE || '',
    token: process.env.ADMIN_INVITE_TOKEN || '',
    ttlHours: process.env.ADMIN_INVITE_TTL_HOURS ? Number(process.env.ADMIN_INVITE_TTL_HOURS) : undefined,
    note: process.env.ADMIN_INVITE_NOTE,
    createdBy: process.env.ADMIN_CREATED_BY,
  })
    .then((r) => {
      // Sengaja TIDAK mencetak token.
      console.log(`OK: ${r.outcome}`);
      console.log(`Nomor: ${r.maskedPhone}`);
      if (r.invitationId) console.log(`Undangan: ${r.invitationId}`);
      if (r.expiresAt) console.log(`Kedaluwarsa: ${r.expiresAt.toISOString()}`);
      if (r.outcome === 'invite_created_new_phone') {
        console.log('Catatan: belum ada akun dengan nomor ini. Pemilik harus mendaftar dengan nomor tersebut lalu menerima token.');
      }
      console.log('Token TIDAK ditampilkan. Kirim token ke pemilik nomor lewat kanal tepercaya.');
      process.exit(0);
    })
    .catch((e: Error) => {
      console.error(`GAGAL: ${e.message}`);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
