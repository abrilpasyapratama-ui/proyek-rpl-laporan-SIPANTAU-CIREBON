/**
 * Cek status konfigurasi integrasi (WhatsApp Fonnte + AI Chatbot).
 * Tidak pernah mencetak token/API key — hanya status konfigurasi.
 *
 * Jalankan: npx ts-node scripts/check-integration-config.ts
 */
import request from 'supertest';
import app from '../src/index';
import prisma from '../src/utils/db';
import { generateToken } from '../src/utils/jwt';

async function main(): Promise<void> {
  const admin = await prisma.users.findFirst({ where: { role: 'admin' } });
  if (!admin) {
    console.error('Tidak ada akun admin.');
    process.exit(1);
  }

  const token = generateToken({ userId: admin.id, role: admin.role });
  const auth = { Authorization: `Bearer ${token}` };

  const wa = await request(app).get('/api/admin/integrations/whatsapp/status').set(auth);
  const ai = await request(app).get('/api/admin/integrations/ai/status').set(auth);

  console.log('=== WHATSAPP GATEWAY (Fonnte) ===');
  const w = wa.body?.data ?? {};
  console.log('provider            :', w.provider);
  console.log('api url             :', w.apiUrl);
  console.log('gateway             :', w.enabled ? 'aktif' : 'nonaktif');
  console.log('token               :', w.tokenConfigured ? `tersedia (sumber: ${w.tokenSource})` : 'belum diisi');
  console.log('siap mengirim       :', w.ready);
  console.log('alasan              :', w.reason);
  console.log('penerima admin      :', JSON.stringify(w.adminRecipients));
  console.log('jenis notifikasi    :', (w.events ?? []).filter((e: { enabled: boolean }) => e.enabled).length, 'aktif');
  console.log('enkripsi tersedia   :', w.encryptionAvailable);
  console.log('sumber konfigurasi  :', w.source);

  console.log('\n=== AI CHATBOT PROVIDER ===');
  const a = ai.body?.data ?? {};
  console.log('chatbot             :', a.enabled ? 'aktif' : 'nonaktif');
  console.log('provider            :', a.provider);
  console.log('base url            :', a.baseUrl);
  console.log('model               :', a.model);
  console.log('temperature         :', a.temperature);
  console.log('max tokens          :', a.maxTokens);
  console.log('timeout (ms)        :', a.timeoutMs);
  console.log('api key             :', a.apiKeyConfigured ? `tersedia (sumber: ${a.apiKeySource})` : 'belum diisi');
  console.log('siap dipakai        :', a.ready);
  console.log('alasan              :', a.reason);
  console.log('sumber konfigurasi  :', a.source);

  const raw = JSON.stringify({ w, a });
  const leaks = ['token":', 'apiKey":', 'api_key', 'secret'].filter((k) => raw.includes(k));
  console.log('\ncek kebocoran secret di respons:', leaks.length === 0 ? 'bersih' : 'PERHATIAN ' + leaks.join(','));
}

main()
  .catch((e: Error) => {
    console.error('GAGAL:', e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
