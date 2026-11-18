import api from './api';

export interface ChatTurnResponse {
  reply: string;
  conversation_id: string;
  tools_used: string[];
}

export interface ConversationItem {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface ConversationMessage {
  id: string;
  role: string;
  content: string;
  created_at: string;
}

export interface ConversationDetail extends ConversationItem {
  messages: ConversationMessage[];
}

/**
 * Satu giliran chat ke Asisten SIPANTAU.
 * Memory percakapan disimpan di server (conversation_id) — frontend
 * tidak perlu mengirim riwayat. API key tetap di server.
 */
export const sendChatMessage = async (
  message: string,
  conversationId?: string
): Promise<ChatTurnResponse> => {
  const response = await api.post<{ status: string; data: ChatTurnResponse }>(
    '/chat',
    conversationId ? { message, conversation_id: conversationId } : { message }
  );
  return response.data.data;
};

export const listConversations = async (): Promise<ConversationItem[]> => {
  const response = await api.get<{ status: string; data: ConversationItem[] }>(
    '/chat/conversations'
  );
  return response.data.data;
};

export const getConversation = async (id: string): Promise<ConversationDetail> => {
  const response = await api.get<{ status: string; data: ConversationDetail }>(
    `/chat/conversations/${id}`
  );
  return response.data.data;
};

export const deleteConversation = async (id: string): Promise<void> => {
  await api.delete(`/chat/conversations/${id}`);
};
