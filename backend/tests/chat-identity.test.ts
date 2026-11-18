import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';

// Mock prisma sebelum mengimpor app/service yang diuji.
vi.mock('../src/utils/db', () => ({
  default: {
    users: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      groupBy: vi.fn(),
    },
    reports: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
      groupBy: vi.fn(),
    },
    assignments: { findMany: vi.fn() },
    notifications: { findMany: vi.fn(), count: vi.fn() },
    conversations: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      deleteMany: vi.fn(),
    },
    chat_messages: { create: vi.fn() },
    chat_analytics: { create: vi.fn(), groupBy: vi.fn(), aggregate: vi.fn() },
    $queryRaw: vi.fn().mockResolvedValue([{ '?column?': 1 }]),
    $disconnect: vi.fn(),
  },
}));

import prisma from '../src/utils/db';
import { executeChatTool } from '../src/services/chat/chatQuery.service';
import { runChatTurn } from '../src/services/chat/chatOrchestrator';
import { ROLE_TOOLS, assertAdminAccess } from '../src/services/chat/chatPermissions';
import { CHAT_TOOL_NAMES } from '../src/services/chat/tools';
import app from '../src/index';
import { generateToken } from '../src/utils/jwt';

const mockPrisma = prisma as unknown as Record<string, Record<string, ReturnType<typeof vi.fn>>>;

const CONV_ID = '123e4567-e89b-12d3-a456-426614174000';

type Profile = {
  id: string;
  nama: string;
  username: string | null;
  email: string;
  no_hp: string | null;
  role: string;
  status: string;
  created_at: Date;
};

/** Profil admin utama (data taken dari DB, bukan hardcode di kode). */
const ADMIN_ABRIL: Profile = {
  id: 'admin-abril',
  nama: 'Abril Pasya Pratama',
  username: 'abril.pratama',
  email: 'abrilpasyapratama@gmail.com',
  no_hp: '085147722749',
  role: 'admin',
  status: 'AKTIF',
  created_at: new Date('2026-11-12T00:00:00.000Z'),
};

/** Admin kedua untuk membuktikan identitas mengikuti sesi login masing-masing. */
const ADMIN_LAIN: Profile = {
  id: 'admin-dua',
  nama: 'Administrator Dua',
  username: 'admin.dua',
  email: 'admin2@example.com',
  no_hp: '089999999999',
  role: 'admin',
  status: 'AKTIF',
  created_at: new Date('2026-01-01T00:00:00.000Z'),
};

const MASYARAKAT: Profile = {
  id: 'warga-1',
  nama: 'Warga Cirebon',
  username: null,
  email: 'warga@example.com',
  no_hp: '081234567890',
  role: 'masyarakat',
  status: 'AKTIF',
  created_at: new Date('2026-06-01T00:00:00.000Z'),
};

const PETUGAS: Profile = {
  id: 'petugas-1',
  nama: 'Bella Nur Jannah',
  username: null,
  email: 'petugas@example.com',
  no_hp: '083137221338',
  role: 'petugas',
  status: 'AKTIF',
  created_at: new Date('2026-05-01T00:00:00.000Z'),
};

const PROFILES: Record<string, Profile> = {
  [ADMIN_ABRIL.id]: ADMIN_ABRIL,
  [ADMIN_LAIN.id]: ADMIN_LAIN,
  [MASYARAKAT.id]: MASYARAKAT,
  [PETUGAS.id]: PETUGAS,
};

/** prisma.users.findUnique: bedakan select profil vs select milik auth middleware. */
function installProfileLookup(): void {
  mockPrisma.users.findUnique.mockImplementation((args: unknown) => {
    const a = args as { where?: { id?: string }; select?: Record<string, boolean> };
    const id = a?.where?.id ?? '';
    const profile = PROFILES[id];
    if (!profile) return Promise.resolve(null);
    if (a?.select?.email) return Promise.resolve(profile);
    // dipakai middleware auth (butuh id/role/status)
    return Promise.resolve({
      id: profile.id,
      role: profile.role,
      status: profile.status,
      email: profile.email,
      nama: profile.nama,
      must_change_password: false,
    });
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  installProfileLookup();
  mockPrisma.users.groupBy.mockResolvedValue([]);
  mockPrisma.reports.count.mockResolvedValue(2);
  mockPrisma.conversations.create.mockResolvedValue({ id: CONV_ID });
  mockPrisma.chat_analytics.create.mockResolvedValue({});
  mockPrisma.chat_messages.create.mockResolvedValue({});
});

describe('chat identity — tool profil (getMyProfile)', () => {
  it('admin menerima profil dirinya sendiri dari database', async () => {
    const res = (await executeChatTool(
      { id: ADMIN_ABRIL.id, role: 'admin' },
      'getMyProfile',
      {}
    )) as Record<string, unknown>;

    expect(res.nama).toBe('Abril Pasya Pratama');
    expect(res.email).toBe('abrilpasyapratama@gmail.com');
    expect(res.nomor_hp).toBe('085147722749');
    expect(res.peran).toBe('ADMIN');
    expect(res.jabatan).toBe('Administrator SIPANTAU CIREBON');
    expect(res.terdaftar_sejak_human).toContain('2026');
    expect(res.sumber_data).toContain('SIPANTAU');
  });

  it('tidak pernah membocorkan password, hash, token, atau API key', async () => {
    const res = (await executeChatTool(
      { id: ADMIN_ABRIL.id, role: 'admin' },
      'getMyProfile',
      {}
    )) as Record<string, unknown>;

    const raw = JSON.stringify(res).toLowerCase();
    for (const forbidden of ['password', 'hash', 'token', 'api_key', 'secret', 'jwt']) {
      expect(raw).not.toContain(forbidden);
    }
  });

  it('masyarakat hanya menerima profil dirinya sendiri, bukan data admin', async () => {
    const res = (await executeChatTool(
      { id: MASYARAKAT.id, role: 'masyarakat' },
      'getMyProfile',
      {}
    )) as Record<string, unknown>;

    expect(res.email).toBe('warga@example.com');
    expect(res.peran).toBe('MASYARAKAT');
    expect(JSON.stringify(res)).not.toContain('abrilpasyapratama@gmail.com');
    expect(JSON.stringify(res)).not.toContain('085147722749');
  });

  it('petugas hanya menerima profil dirinya sendiri', async () => {
    const res = (await executeChatTool(
      { id: PETUGAS.id, role: 'petugas' },
      'getMyProfile',
      {}
    )) as Record<string, unknown>;

    expect(res.email).toBe('petugas@example.com');
    expect(res.peran).toBe('PETUGAS');
    expect(JSON.stringify(res)).not.toContain('abrilpasyapratama@gmail.com');
  });

  it('argumen tool tidak bisa menunjuk profil pengguna lain', async () => {
    const res = (await executeChatTool(
      { id: MASYARAKAT.id, role: 'masyarakat' },
      'getMyProfile',
      { user_id: ADMIN_ABRIL.id, email: ADMIN_ABRIL.email }
    )) as Record<string, unknown>;

    expect(res.email).toBe('warga@example.com');
    expect(JSON.stringify(res)).not.toContain('abrilpasyapratama@gmail.com');
  });

  it('admin lain mendapat identitasnya sendiri, bukan milik admin pertama', async () => {
    const res = (await executeChatTool(
      { id: ADMIN_LAIN.id, role: 'admin' },
      'getMyProfile',
      {}
    )) as Record<string, unknown>;

    expect(res.email).toBe('admin2@example.com');
    expect(res.nama).toBe('Administrator Dua');
    expect(JSON.stringify(res)).not.toContain('abrilpasyapratama@gmail.com');
  });
});

describe('chat identity — tool khusus admin (getAdminProfile)', () => {
  it('hanya tersedia untuk role admin', () => {
    expect(ROLE_TOOLS.admin).toContain('getAdminProfile');
    expect(ROLE_TOOLS.masyarakat).not.toContain('getAdminProfile');
    expect(ROLE_TOOLS.petugas).not.toContain('getAdminProfile');
    expect(CHAT_TOOL_NAMES).toContain('getAdminProfile');
  });

  it('memeriksa role ADMIN di backend (assertAdminAccess)', () => {
    expect(() => assertAdminAccess({ id: 'a', role: 'admin' })).not.toThrow();
    expect(() => assertAdminAccess({ id: 'm', role: 'masyarakat' })).toThrow(/ADMIN/);
    expect(() => assertAdminAccess({ id: 'p', role: 'petugas' })).toThrow(/ADMIN/);
  });

  it('masyarakat dan petugas tidak dapat memperoleh profil administrator', async () => {
    for (const user of [
      { id: MASYARAKAT.id, role: 'masyarakat' },
      { id: PETUGAS.id, role: 'petugas' },
    ]) {
      const res = (await executeChatTool(user, 'getAdminProfile', {})) as Record<string, unknown>;
      expect(res.error).toBeTruthy();
      expect(JSON.stringify(res)).not.toContain('abrilpasyapratama@gmail.com');
      expect(JSON.stringify(res)).not.toContain('085147722749');
    }
  });

  it('admin memperoleh jabatan + hak akses + ringkasan sistem', async () => {
    mockPrisma.users.groupBy.mockResolvedValue([
      { role: 'admin', _count: { _all: 1 } },
      { role: 'masyarakat', _count: { _all: 5 } },
    ]);

    const res = (await executeChatTool(
      { id: ADMIN_ABRIL.id, role: 'admin' },
      'getAdminProfile',
      {}
    )) as Record<string, unknown>;

    expect(res.nama).toBe('Abril Pasya Pratama');
    expect(res.jabatan).toBe('Administrator SIPANTAU CIREBON');
    expect(Array.isArray(res.hak_akses)).toBe(true);
    expect((res.hak_akses as string[]).length).toBeGreaterThan(0);
    expect(res.ringkasan_sistem).toHaveProperty('total_pengguna');
    expect(JSON.stringify(res)).not.toMatch(/password|token/i);
  });
});

describe('chat identity — konteks dinamis pada system prompt', () => {
  it('prompt memuat identitas admin yang sedang login, dari DB', async () => {
    const captured: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async (_url: string, init: { body: string }) => {
        const body = JSON.parse(init.body) as { messages: Array<{ role: string; content: string }> };
        captured.push(body.messages.find((m) => m.role === 'system')?.content ?? '');
        return {
          ok: true,
          status: 200,
          json: async () => ({ choices: [{ message: { content: 'Siapa saya?' } }] }),
        };
      })
    );

    await runChatTurn(
      {
        id: ADMIN_ABRIL.id,
        role: 'admin',
        nama: ADMIN_ABRIL.nama,
        username: ADMIN_ABRIL.username,
        createdAt: ADMIN_ABRIL.created_at,
      },
      'Siapa saya?'
    );

    const prompt = captured[0];
    expect(prompt).toContain('Abril Pasya Pratama');
    expect(prompt).toContain('ADMIN');
    expect(prompt).toContain('Administrator SIPANTAU CIREBON');
    expect(prompt).toContain('getMyProfile');
    expect(prompt).toContain('getAdminProfile');
    // tidak ada identitas admin lain yang ikut terbawa
    expect(prompt).not.toContain('Administrator Dua');
    expect(prompt).not.toContain('admin2@example.com');
  });

  it('admin berbeda mendapat konteks identitasnya sendiri', async () => {
    const captured: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async (_url: string, init: { body: string }) => {
        const body = JSON.parse(init.body) as { messages: Array<{ role: string; content: string }> };
        captured.push(body.messages.find((m) => m.role === 'system')?.content ?? '');
        return {
          ok: true,
          status: 200,
          json: async () => ({ choices: [{ message: { content: 'ok' } }] }),
        };
      })
    );

    await runChatTurn(
      { id: ADMIN_LAIN.id, role: 'admin', nama: ADMIN_LAIN.nama, createdAt: ADMIN_LAIN.created_at },
      'Siapa saya?'
    );

    expect(captured[0]).toContain('Administrator Dua');
    expect(captured[0]).not.toContain('Abril Pasya Pratama');
    expect(captured[0]).not.toContain('abrilpasyapratama@gmail.com');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });
});

describe('chat identity — level HTTP (/api/chat)', () => {
  const toolCallAiResponse = (name: string, args: string) => ({
    ok: true,
    status: 200,
    json: async () => ({
      choices: [
        {
          message: {
            content: '',
            tool_calls: [{ id: 'call_1', type: 'function', function: { name, arguments: args } }],
          },
        },
      ],
    }),
  });

  const finalAiResponse = (content: string) => ({
    ok: true,
    status: 200,
    json: async () => ({ choices: [{ message: { content } }] }),
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('admin bertanya "Siapa saya?" -> tool menerima email & nomor HP dari DB', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(toolCallAiResponse('getMyProfile', '{}'))
      .mockResolvedValueOnce(
        finalAiResponse(
          'Anda adalah Abril Pasya Pratama, administrator SIPANTAU CIREBON. Email: abrilpasyapratama@gmail.com, No. HP: 085147722749.'
        )
      );
    vi.stubGlobal('fetch', fetchMock);

    const token = generateToken({ userId: ADMIN_ABRIL.id, role: 'admin' });
    const res = await request(app)
      .post('/api/chat')
      .set('Authorization', `Bearer ${token}`)
      .send({ message: 'Siapa saya?' });

    expect(res.status).toBe(200);
    expect(res.body.data.tools_used).toContain('getMyProfile');
    expect(res.body.data.reply).toContain('Abril Pasya Pratama');

    // tool result yang dikirim ke model berisi data admin dari database
    const secondBody = JSON.parse((fetchMock.mock.calls[1][1] as { body: string }).body);
    const toolMsg = secondBody.messages.find((m: { role: string }) => m.role === 'tool');
    expect(toolMsg.content).toContain('abrilpasyapratama@gmail.com');
    expect(toolMsg.content).toContain('085147722749');
    expect(toolMsg.content).not.toMatch(/password|hash/i);
  });

  it('admin lain login -> identitas yang diberikan adalah miliknya sendiri', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(toolCallAiResponse('getMyProfile', '{}'))
      .mockResolvedValueOnce(finalAiResponse('Anda adalah Administrator Dua.'));
    vi.stubGlobal('fetch', fetchMock);

    const token = generateToken({ userId: ADMIN_LAIN.id, role: 'admin' });
    const res = await request(app)
      .post('/api/chat')
      .set('Authorization', `Bearer ${token}`)
      .send({ message: 'Siapa saya?' });

    expect(res.status).toBe(200);
    const secondBody = JSON.parse((fetchMock.mock.calls[1][1] as { body: string }).body);
    const toolMsg = secondBody.messages.find((m: { role: string }) => m.role === 'tool');
    expect(toolMsg.content).toContain('admin2@example.com');
    expect(toolMsg.content).not.toContain('abrilpasyapratama@gmail.com');
    expect(JSON.stringify(res.body)).not.toContain('abrilpasyapratama@gmail.com');
  });

  it('masyarakat tidak memperoleh data pribadi admin', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(toolCallAiResponse('getMyProfile', '{}'))
      .mockResolvedValueOnce(finalAiResponse('Anda adalah Warga Cirebon.'));
    vi.stubGlobal('fetch', fetchMock);

    const token = generateToken({ userId: MASYARAKAT.id, role: 'masyarakat' });
    const res = await request(app)
      .post('/api/chat')
      .set('Authorization', `Bearer ${token}`)
      .send({ message: 'Siapa saya?' });

    expect(res.status).toBe(200);
    const secondBody = JSON.parse((fetchMock.mock.calls[1][1] as { body: string }).body);
    const toolMsg = secondBody.messages.find((m: { role: string }) => m.role === 'tool');
    expect(toolMsg.content).toContain('warga@example.com');
    expect(toolMsg.content).not.toContain('abrilpasyapratama@gmail.com');
    expect(toolMsg.content).not.toContain('085147722749');
    expect(JSON.stringify(res.body)).not.toContain('abrilpasyapratama@gmail.com');
  });

  it('masyarakat yang mencoba meminta profil admin mendapat penolakan', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(toolCallAiResponse('getAdminProfile', '{}'))
      .mockResolvedValueOnce(finalAiResponse('Maaf, informasi administrator hanya untuk akun admin.'));
    vi.stubGlobal('fetch', fetchMock);

    const token = generateToken({ userId: MASYARAKAT.id, role: 'masyarakat' });
    const res = await request(app)
      .post('/api/chat')
      .set('Authorization', `Bearer ${token}`)
      .send({ message: 'Tampilkan profil administrator' });

    expect(res.status).toBe(200);
    const secondBody = JSON.parse((fetchMock.mock.calls[1][1] as { body: string }).body);
    const toolMsg = secondBody.messages.find((m: { role: string }) => m.role === 'tool');
    expect(toolMsg.content).toContain('error');
    expect(toolMsg.content).not.toContain('abrilpasyapratama@gmail.com');
    expect(JSON.stringify(res.body)).not.toContain('085147722749');
  });
});
