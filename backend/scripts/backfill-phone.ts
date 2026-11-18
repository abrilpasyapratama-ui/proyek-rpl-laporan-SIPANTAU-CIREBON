/**
 * Backfill `users.no_hp_normalized` dari `users.no_hp`.
 *
 * Aman & idempotent:
 *  - tidak mengubah `no_hp` asli (hanya kolom turunan),
 *  - melewati nomor tidak valid (dilaporkan),
 *  - berhenti bila ada dua akun dengan nomor yang sama (tidak menimpa),
 *  - dapat dijalankan berulang.
 *
 * Jalankan: npm run phone:backfill
 */
import prisma from '../src/utils/db';
import { normalizePhone, maskPhone } from '../src/utils/phone';

export interface BackfillResult {
  scanned: number;
  updated: number;
  alreadyNormalized: number;
  skippedInvalid: number;
  conflicts: string[];
}

export async function backfillPhoneNormalized(): Promise<BackfillResult> {
  const users = await prisma.users.findMany({
    where: { no_hp: { not: null } },
    select: { id: true, no_hp: true, no_hp_normalized: true },
  });

  const seen = new Map<string, string>();
  const conflicts: string[] = [];
  const updates: Array<{ id: string; normalized: string }> = [];
  let skippedInvalid = 0;
  let alreadyNormalized = 0;

  for (const u of users) {
    const normalized = normalizePhone(u.no_hp);
    if (!normalized) {
      skippedInvalid += 1;
      continue;
    }
    const otherId = seen.get(normalized);
    if (otherId) {
      conflicts.push(maskPhone(normalized));
      continue;
    }
    seen.set(normalized, u.id);

    if (u.no_hp_normalized === normalized) {
      alreadyNormalized += 1;
      continue;
    }
    updates.push({ id: u.id, normalized });
  }

  if (conflicts.length > 0) {
    throw new Error(
      `Ditemukan nomor duplikat (${conflicts.join(', ')}). Selesaikan duplikasi secara manual sebelum backfill.`
    );
  }

  for (const u of updates) {
    await prisma.users.update({
      where: { id: u.id },
      data: { no_hp_normalized: u.normalized },
    });
  }

  return {
    scanned: users.length,
    updated: updates.length,
    alreadyNormalized,
    skippedInvalid,
    conflicts,
  };
}

const isMain = typeof require !== 'undefined' && require.main === module;
if (isMain) {
  backfillPhoneNormalized()
    .then((r) => {
      console.log(
        `OK: dipindai=${r.scanned} diperbarui=${r.updated} sudah_normal=${r.alreadyNormalized} tidak_valid=${r.skippedInvalid}`
      );
      process.exit(0);
    })
    .catch((e: Error) => {
      console.error(`GAGAL: ${e.message}`);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
