import { z } from 'zod';

const sanitizeString = (s: string) => s.trim().replace(/[<>]/g, '');

export const registerSchema = z.object({
  nama: z.string().min(3, 'Nama minimal 3 karakter').max(100).transform(sanitizeString),
  email: z.string().email('Format email tidak valid').max(255).transform((s) => s.trim().toLowerCase()),
  password: z
    .string()
    .min(8, 'Password minimal 8 karakter')
    .max(100)
    .regex(/[A-Z]/, 'Password harus mengandung huruf besar')
    .regex(/[a-z]/, 'Password harus mengandung huruf kecil')
    .regex(/[0-9]/, 'Password harus mengandung angka'),
  // Peran yang boleh diminta dari registrasi publik. 'admin' DITOLAK di controller.
  role: z.enum(['masyarakat', 'petugas']).optional().default('masyarakat'),
  no_hp: z.string().trim().max(20).optional(),
  nip: z.string().trim().max(50).optional(),
  instansi: z.string().trim().max(150).transform(sanitizeString).optional(),
  wilayah: z.string().trim().max(150).transform(sanitizeString).optional(),
});

export const verifyPetugasSchema = z.object({
  action: z.enum(['APPROVE', 'REJECT']),
});

export const loginSchema = z.object({
  email: z.string().email('Format email tidak valid').transform((s) => s.trim().toLowerCase()),
  password: z.string().min(1, 'Password wajib diisi').max(100),
});

const latSchema = z.coerce.number().min(-90).max(90);
const lngSchema = z.coerce.number().min(-180).max(180);

export const createReportSchema = z.object({
  judul: z.string().min(3, 'Judul minimal 3 karakter').max(200).transform(sanitizeString),
  deskripsi: z.string().min(10, 'Deskripsi minimal 10 karakter').max(5000).transform(sanitizeString),
  kategori: z.string().min(2).max(100).transform(sanitizeString),
  lokasi: z.string().min(3).max(500).transform(sanitizeString),
  latitude: latSchema,
  longitude: lngSchema,
});

export const verifyReportSchema = z.object({
  action: z.enum(['APPROVE', 'REJECT']),
  reason: z.string().trim().max(1000).optional(),
}).refine(
  (v) => v.action === 'APPROVE' || (v.reason && v.reason.length >= 3),
  { message: 'Alasan penolakan wajib diisi (minimal 3 karakter)', path: ['reason'] }
);

export const prioritySchema = z.object({
  priority: z.enum(['Rendah', 'Sedang', 'Tinggi', 'Darurat', 'Normal']),
});

export const assignPetugasSchema = z.object({
  petugas_id: z.string().uuid('ID petugas tidak valid'),
});

export const progressUpdateSchema = z.object({
  catatan: z.string().max(2000).transform(sanitizeString).optional(),
  status: z.enum(['DALAM_PERBAIKAN', 'SELESAI']),
});

export const adminReportsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  q: z.string().max(200).optional(),
  status: z.enum(['MENUNGGU_VERIFIKASI', 'DIPROSES', 'DALAM_PERBAIKAN', 'SELESAI', 'DITOLAK', 'ALL']).optional(),
  kategori: z.string().max(100).optional(),
  lokasi: z.string().max(200).optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal from harus YYYY-MM-DD').optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal to harus YYYY-MM-DD').optional(),
});

export const chatRequestSchema = z.object({
  message: z.string().min(1, 'Pesan tidak boleh kosong').max(2000, 'Pesan maksimal 2000 karakter'),
  conversation_id: z.string().uuid('ID percakapan tidak valid').optional(),
});

const usernameSchema = z
  .string()
  .trim()
  .min(3, 'Username minimal 3 karakter')
  .max(50, 'Username maksimal 50 karakter')
  .regex(/^[a-zA-Z0-9._-]+$/, 'Username hanya boleh berisi huruf, angka, titik, garis bawah, atau tanda hubung');

const phoneSchema = z.string().trim().max(20, 'Nomor HP maksimal 20 karakter');

/**
 * Profil milik sendiri. Semua field opsional agar admin/pengguna bisa
 * memperbarui sebagian data saja, tetapi minimal satu field harus diisi.
 * Role/status TIDAK pernah diterima di sini (backend yang menentukan).
 */
export const updateProfileSchema = z
  .object({
    nama: z.string().min(3, 'Nama minimal 3 karakter').max(100).transform(sanitizeString).optional(),
    email: z
      .string()
      .email('Format email tidak valid')
      .max(255)
      .transform((s) => s.trim().toLowerCase())
      .optional(),
    no_hp: phoneSchema.nullable().optional(),
    username: usernameSchema.nullable().optional(),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), {
    message: 'Minimal satu data profil harus diisi',
  });

/**
 * Edit pengguna oleh ADMIN. Status yang boleh diatur dari halaman Kelola
 * Pengguna hanya AKTIF/NONAKTIF (verifikasi petugas punya alurnya sendiri).
 */
export const adminUpdateUserSchema = z
  .object({
    nama: z.string().min(3, 'Nama minimal 3 karakter').max(100).transform(sanitizeString).optional(),
    email: z
      .string()
      .email('Format email tidak valid')
      .max(255)
      .transform((s) => s.trim().toLowerCase())
      .optional(),
    no_hp: phoneSchema.nullable().optional(),
    username: usernameSchema.nullable().optional(),
    role: z.enum(['masyarakat', 'petugas', 'admin']).optional(),
    status: z.enum(['AKTIF', 'NONAKTIF']).optional(),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), {
    message: 'Minimal satu data pengguna harus diisi',
  });

export const adminUsersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  q: z.string().max(200).optional(),
  role: z.enum(['masyarakat', 'petugas', 'admin']).optional(),
  status: z.enum(['AKTIF', 'MENUNGGU_VERIFIKASI', 'DITOLAK', 'NONAKTIF']).optional(),
});

export const acceptAdminInviteSchema = z.object({
  token: z
    .string()
    .trim()
    .min(32, 'Token undangan tidak valid')
    .max(200, 'Token undangan tidak valid'),
});

const passwordPolicy = z
  .string()
  .min(8, 'Password minimal 8 karakter')
  .max(100)
  .regex(/[A-Z]/, 'Password harus mengandung huruf besar')
  .regex(/[a-z]/, 'Password harus mengandung huruf kecil')
  .regex(/[0-9]/, 'Password harus mengandung angka');

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Password saat ini wajib diisi').max(100),
  newPassword: passwordPolicy,
});

export const updateUserRoleSchema = z.object({
  role: z.enum(['masyarakat', 'petugas', 'admin']),
});

/**
 * Pengaturan integrasi (halaman Integrasi WhatsApp).
 * Token TIDAK dapat diubah lewat API — hanya lewat environment server.
 */
/**
 * Pengaturan integrasi generik (dipakai endpoint lama).
 * @deprecated Gunakan whatsappIntegrationSettingsSchema / aiIntegrationSettingsSchema.
 */
export const integrationSettingsSchema = z
  .object({
    fonnteEnabled: z.boolean().optional(),
    telegramEnabled: z.boolean().optional(),
    fonnteAdminRecipients: z.array(z.string().trim().min(8, 'Nomor penerima terlalu pendek').max(20)).max(10, 'Maksimal 10 nomor penerima admin').optional(),
    fonnteEvents: z.array(z.string().trim().min(3).max(60)).max(40).optional(),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), {
    message: 'Minimal satu pengaturan harus dikirim',
  });

export const integrationTestMessageSchema = z.object({
  message: z.string().trim().max(1000, 'Pesan maksimal 1000 karakter').optional(),
  target: z.string().trim().max(20, 'Nomor tujuan tidak valid').optional(),
});

/**
 * Konfigurasi gateway WhatsApp (Fonnte) dari halaman Konfigurasi Integrasi.
 * Token opsional: kosong = pertahankan token lama. `clearToken` untuk menghapus.
 */
export const whatsappIntegrationSettingsSchema = z
  .object({
    enabled: z.boolean().optional(),
    provider: z.string().trim().min(2).max(40).optional(),
    apiUrl: z.string().trim().url('Base URL tidak valid').max(300).optional(),
    token: z.string().trim().min(8, 'Token minimal 8 karakter').max(200).optional(),
    clearToken: z.boolean().optional(),
    adminRecipients: z.array(z.string().trim().min(8).max(20)).max(10, 'Maksimal 10 nomor penerima admin').optional(),
    events: z.array(z.string().trim().min(3).max(60)).max(40).optional(),
    telegramEnabled: z.boolean().optional(),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), {
    message: 'Minimal satu pengaturan harus dikirim',
  });

/**
 * Konfigurasi penyedia AI chatbot.
 * API key opsional: kosong = pertahankan API key lama.
 */
export const aiIntegrationSettingsSchema = z
  .object({
    enabled: z.boolean().optional(),
    provider: z.enum(['openrouter', 'openai', 'custom']).optional(),
    baseUrl: z.string().trim().url('Base URL tidak valid').max(300).optional(),
    model: z.string().trim().min(2, 'Model minimal 2 karakter').max(120).optional(),
    temperature: z.coerce.number().min(0).max(2).optional(),
    maxTokens: z.coerce.number().int().min(64).max(32000).optional(),
    timeoutMs: z.coerce.number().int().min(1000).max(300000).optional(),
    systemPrompt: z.string().trim().max(4000).optional(),
    apiKey: z.string().trim().min(8, 'API Key minimal 8 karakter').max(400).optional(),
    clearApiKey: z.boolean().optional(),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), {
    message: 'Minimal satu pengaturan harus dikirim',
  });

export const aiTestChatSchema = z.object({
  message: z.string().trim().max(1000, 'Pesan maksimal 1000 karakter').optional(),
});
