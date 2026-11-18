import { describe, it, expect, vi } from 'vitest';
import api from './api';
import { sendChatMessage, listConversations, deleteConversation } from './chatService';

vi.mock('./api', () => ({
  default: { post: vi.fn(), get: vi.fn(), delete: vi.fn() },
}));

const postMock = vi.mocked(api.post);
const getMock = vi.mocked(api.get);
const deleteMock = vi.mocked(api.delete);

describe('chatService', () => {
  it('posts message and returns reply with conversation_id', async () => {
    postMock.mockResolvedValueOnce({
      data: { status: 'success', data: { reply: 'Halo!', conversation_id: 'c1', tools_used: [] } },
    });
    const res = await sendChatMessage('Halo');
    expect(res.reply).toBe('Halo!');
    expect(res.conversation_id).toBe('c1');
    expect(postMock).toHaveBeenCalledWith('/chat', { message: 'Halo' });
  });

  it('includes conversation_id when resuming', async () => {
    postMock.mockResolvedValueOnce({
      data: { status: 'success', data: { reply: 'Ok', conversation_id: 'c1', tools_used: ['getUserReports'] } },
    });
    await sendChatMessage('Lanjut', 'c1');
    expect(postMock).toHaveBeenCalledWith('/chat', { message: 'Lanjut', conversation_id: 'c1' });
  });

  it('lists and deletes conversations', async () => {
    getMock.mockResolvedValueOnce({ data: { status: 'success', data: [{ id: 'c1', title: 'Halo' }] } });
    const list = await listConversations();
    expect(list).toHaveLength(1);
    deleteMock.mockResolvedValueOnce({ data: { status: 'success', data: { deleted: true } } });
    await deleteConversation('c1');
    expect(deleteMock).toHaveBeenCalledWith('/chat/conversations/c1');
  });
});
