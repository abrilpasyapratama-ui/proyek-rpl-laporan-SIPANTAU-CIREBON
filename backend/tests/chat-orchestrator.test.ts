import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../src/services/ai/openrouter.chat.service', () => ({
  completeChat: vi.fn(),
}));
vi.mock('../src/services/chat/chatQuery.service', () => ({
  executeChatTool: vi.fn(),
}));

import { completeChat } from '../src/services/ai/openrouter.chat.service';
import { executeChatTool } from '../src/services/chat/chatQuery.service';
import { runChatTurn, truncateToolResult } from '../src/services/chat/chatOrchestrator';

const completeMock = vi.mocked(completeChat);
const execMock = vi.mocked(executeChatTool);

const user = { id: 'p1', role: 'petugas', nama: 'Petugas' };

const toolCall = (name: string, args = '{}') => ({
  role: 'assistant' as const,
  content: '',
  tool_calls: [{ id: 'c1', type: 'function' as const, function: { name, arguments: args } }],
});

beforeEach(() => vi.clearAllMocks());

describe('truncateToolResult', () => {
  it('mengembalikan JSON valid untuk hasil kecil', () => {
    expect(JSON.parse(truncateToolResult({ a: 1 }))).toEqual({ a: 1 });
  });

  it('tetap JSON valid saat hasil dipotong', () => {
    const big = { items: Array.from({ length: 5000 }, (_, i) => ({ i, judul: 'laporan '.repeat(5) })) };
    const out = truncateToolResult(big);
    expect(out.length).toBeLessThanOrEqual(4000);
    const parsed = JSON.parse(out) as { truncated: boolean; preview: string };
    expect(parsed.truncated).toBe(true);
    expect(typeof parsed.preview).toBe('string');
  });
});

describe('runChatTurn — repeat guard', () => {
  it('berhenti & menyusun jawaban saat model mengulang tool yang sama', async () => {
    execMock.mockResolvedValue({ jumlah: 4, tugas: [] });
    completeMock
      .mockResolvedValueOnce(toolCall('getOfficerTasks')) // iterasi 1 → eksekusi
      .mockResolvedValueOnce(toolCall('getOfficerTasks')) // iterasi 2 → sama → dianggap berulang
      .mockResolvedValueOnce({ role: 'assistant', content: 'Anda memiliki 4 tugas.' }); // jawaban akhir

    const res = await runChatTurn(user, 'Tugas aktif saya apa saja?');
    expect(res.reply).toBe('Anda memiliki 4 tugas.');
    // tool hanya dieksekusi sekali walau model memanggil dua kali
    expect(execMock).toHaveBeenCalledTimes(1);
  });

  it('menjawab langsung tanpa tool untuk pertanyaan umum', async () => {
    completeMock.mockResolvedValueOnce({ role: 'assistant', content: 'Cara membuat laporan: ...' });
    const res = await runChatTurn(user, 'Bagaimana cara buat laporan?');
    expect(res.reply).toContain('Cara membuat laporan');
    expect(execMock).not.toHaveBeenCalled();
  });
});
