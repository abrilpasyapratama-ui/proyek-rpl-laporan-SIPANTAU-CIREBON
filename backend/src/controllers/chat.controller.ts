import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import { runChatTurn } from '../services/chat/chatOrchestrator';
import { ChatUser } from '../services/chat/chatPermissions';
import * as repo from '../services/chat/chatRepository';
import { logger } from '../utils/logger';
import prisma from '../utils/db';
import { getAiRuntimeConfig } from '../services/integration/settings.service';

function toChatUser(req: AuthRequest): ChatUser | null {
  if (!req.user?.id) return null;
  return { id: req.user.id, role: req.user.role };
}

function conversationTitle(message: string): string {
  const t = message.trim().replace(/\s+/g, ' ');
  return t.length > 60 ? t.slice(0, 60) + '...' : t || 'Percakapan baru';
}

/**
 * POST /api/chat — satu giliran chat dengan memory percakapan.
 * Body: { message, conversation_id? } → { reply, conversation_id, tools_used }
 */
export const postChat = async (req: AuthRequest, res: Response) => {
  const user = toChatUser(req);
  if (!user) {
    return res.status(401).json({ status: 'error', message: 'Unauthorized' });
  }

  const { message, conversation_id } = req.body as {
    message: string;
    conversation_id?: string;
  };

  let conversationId: string | undefined = conversation_id;
  let history: Array<{ role: 'user' | 'assistant'; content: string }> = [];

  // Chatbot AI dapat dimatikan administrator lewat Konfigurasi Integrasi.
  const aiConfig = await getAiRuntimeConfig();
  if (!aiConfig.enabled) {
    return res.status(503).json({
      status: 'error',
      message: 'Asisten AI sedang dinonaktifkan oleh administrator.',
    });
  }
  if (!aiConfig.apiKeyConfigured) {
    return res.status(503).json({
      status: 'error',
      message: 'Asisten AI belum dikonfigurasi (API Key belum diisi).',
    });
  }

  try {
    // 1. Resolve / buat conversation (milik user — ownership check)
    if (conversationId) {
      const existing = await repo.getConversationOwned(conversationId, user.id);
      if (!existing) {
        return res.status(404).json({ status: 'error', message: 'Percakapan tidak ditemukan' });
      }
      history = existing.messages
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));
    } else {
      const created = await repo.createConversation(user.id, conversationTitle(message));
      conversationId = created.id;
    }

    // 2. Konteks pengguna untuk prompt (identitas diambil dari database,
    //    berdasarkan user.id dari JWT — bukan dari input frontend).
    const dbUser = await prisma.users.findUnique({
      where: { id: user.id },
      select: { nama: true, role: true, username: true, created_at: true },
    });
    const chatUser: ChatUser = {
      id: user.id,
      role: user.role,
      nama: dbUser?.nama,
      username: dbUser?.username ?? null,
      createdAt: dbUser?.created_at ?? null,
    };

    // 3. Orkestrasi agen (LLM + tools)
    const turn = await runChatTurn(chatUser, message.trim(), history);

    // 4. Simpan memory + analitik + audit
    await repo.addChatMessage(conversationId as string, 'user', message.trim());
    await repo.addChatMessage(conversationId as string, 'assistant', turn.reply, turn.toolsUsed);
    await repo.touchConversation(conversationId as string);
    await repo.recordChatAnalytics({
      userId: user.id,
      conversationId: conversationId as string,
      intent: turn.intent,
      toolsUsed: turn.toolsUsed,
      responseTimeMs: turn.responseTimeMs,
      success: true,
    });
    logger.audit('chat_message', {
      userId: user.id,
      role: user.role,
      conversationId,
      intent: turn.intent,
      tools: turn.toolsUsed,
      responseTimeMs: turn.responseTimeMs,
    });

    return res.status(200).json({
      status: 'success',
      data: {
        reply: turn.reply,
        conversation_id: conversationId,
        tools_used: turn.toolsUsed,
      },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'unknown';
    try {
      await repo.recordChatAnalytics({
        userId: user.id,
        conversationId,
        intent: 'error',
        toolsUsed: [],
        responseTimeMs: 0,
        success: false,
      });
    } catch {
      // analitik tidak boleh menggagalkan respons
    }
    logger.error('Chat error', { message: msg });
    if (msg.includes('belum dikonfigurasi')) {
      return res.status(503).json({ status: 'error', message: 'Layanan chatbot belum tersedia' });
    }
    return res.status(502).json({ status: 'error', message: 'Gagal mendapatkan jawaban AI, silakan coba lagi' });
  }
};

/** GET /api/chat/conversations — daftar percakapan milik user */
export const listConversations = async (req: AuthRequest, res: Response) => {
  const user = toChatUser(req);
  if (!user) return res.status(401).json({ status: 'error', message: 'Unauthorized' });
  const items = await repo.listConversations(user.id);
  return res.status(200).json({ status: 'success', data: items });
};

/** GET /api/chat/conversations/:id — isi percakapan milik user */
export const getConversation = async (req: AuthRequest, res: Response) => {
  const user = toChatUser(req);
  if (!user) return res.status(401).json({ status: 'error', message: 'Unauthorized' });
  const { id } = req.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return res.status(400).json({ status: 'error', message: 'ID percakapan tidak valid' });
  }
  const conversation = await repo.getConversationOwned(id, user.id);
  if (!conversation) {
    return res.status(404).json({ status: 'error', message: 'Percakapan tidak ditemukan' });
  }
  return res.status(200).json({ status: 'success', data: conversation });
};

/** DELETE /api/chat/conversations/:id — hapus percakapan milik user */
export const deleteConversation = async (req: AuthRequest, res: Response) => {
  const user = toChatUser(req);
  if (!user) return res.status(401).json({ status: 'error', message: 'Unauthorized' });
  const { id } = req.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return res.status(400).json({ status: 'error', message: 'ID percakapan tidak valid' });
  }
  const deleted = await repo.deleteConversationOwned(id, user.id);
  if (deleted.count === 0) {
    return res.status(404).json({ status: 'error', message: 'Percakapan tidak ditemukan' });
  }
  logger.audit('chat_conversation_deleted', { userId: user.id, conversationId: id });
  return res.status(200).json({ status: 'success', data: { deleted: true } });
};

/** GET /api/chat/analytics/summary — ringkasan analitik (admin only) */
export const getAnalyticsSummary = async (req: AuthRequest, res: Response) => {
  const user = toChatUser(req);
  if (!user) return res.status(401).json({ status: 'error', message: 'Unauthorized' });
  const summary = await repo.analyticsSummary(30);
  return res.status(200).json({ status: 'success', data: summary });
};
