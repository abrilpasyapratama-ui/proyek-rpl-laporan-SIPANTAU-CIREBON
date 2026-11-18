import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  MessageCircle,
  X,
  Send,
  Loader2,
  Bot,
  Plus,
  History,
  Trash2,
  ArrowLeft,
  RotateCcw,
  ExternalLink,
} from 'lucide-react';
import {
  sendChatMessage,
  listConversations,
  getConversation,
  deleteConversation,
  ConversationItem,
} from '../../services/chatService';
import { extractErrorMessage } from '../../utils/apiError';
import { useAuthStore } from '../../store/useAuthStore';

interface QuickLink {
  label: string;
  to: string;
}

interface ChatBubble {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  links?: QuickLink[];
}

const GREETING =
  'Halo! Saya Asisten SIPANTAU. Saya dapat mengecek status laporan, mencari laporan, menampilkan statistik, tugas, dan notifikasi Anda. Ada yang bisa saya bantu?';

const STORAGE_KEY = 'sipantau-chat-id';

// Contoh pertanyaan awal — disesuaikan dengan peran pengguna.
const EXAMPLE_QUESTIONS: Record<string, string[]> = {
  masyarakat: [
    'Siapa saya?',
    'Apa email akun saya?',
    'Berapa total laporan saya?',
    'Apa status laporan saya?',
    'Tampilkan laporan prioritas tinggi saya',
    'Ringkasan penanganan bulan ini',
  ],
  petugas: [
    'Siapa saya?',
    'Apa role saya?',
    'Tugas aktif saya apa saja?',
    'Tugas mana yang terlambat lebih dari 7 hari?',
    'Berapa tugas yang sudah saya selesaikan?',
    'Tampilkan ringkasan penanganan bulan ini',
  ],
  admin: [
    'Siapa saya?',
    'Apa email akun saya?',
    'Apa role dan jabatan saya?',
    'Bagaimana profil administrator saya?',
    'Berapa total laporan saat ini?',
    'Tampilkan laporan prioritas tinggi yang belum selesai',
    'Kategori kerusakan apa yang paling sering dilaporkan?',
    'Wilayah mana yang memiliki laporan terbanyak?',
    'Tampilkan ringkasan penanganan bulan ini',
  ],
};

const REPORT_TOOLS = [
  'getReportStatus',
  'searchReports',
  'getReportsByCategory',
  'getUserReports',
  'getHighPriorityReports',
  'getUnassignedReports',
];
const GIS_TOOLS = ['getReportsByLocation', 'getReportsNearby'];
const TASK_TOOLS = ['getOfficerTasks'];
const STATS_TOOLS = ['getReportAnalytics', 'getReportPeriodSummary', 'getResolutionTime'];

/** Tautan kontekstual ke halaman nyata berdasarkan role + tool yang dipakai. */
function linksForTools(role: string, tools: string[]): QuickLink[] {
  const reportPath = role === 'admin' ? '/admin/reports' : role === 'petugas' ? '/officer/history' : '/reports/history';
  const gisPath = role === 'admin' ? '/admin/map' : role === 'petugas' ? '/officer/map' : '/map';
  const taskPath = role === 'petugas' ? '/officer/tasks' : '/admin/reports';
  const statsPath = role === 'admin' ? '/admin/statistics' : role === 'petugas' ? '/officer/dashboard' : '/dashboard';

  const links: QuickLink[] = [];
  if (tools.some((t) => REPORT_TOOLS.includes(t))) links.push({ label: 'Lihat laporan', to: reportPath });
  if (tools.some((t) => GIS_TOOLS.includes(t))) links.push({ label: 'Buka Peta GIS', to: gisPath });
  if (tools.some((t) => TASK_TOOLS.includes(t)))
    links.push({ label: role === 'petugas' ? 'Tugas saya' : 'Penugasan', to: taskPath });
  if (tools.some((t) => STATS_TOOLS.includes(t)))
    links.push({ label: 'Lihat statistik', to: statsPath });

  // hilangkan duplikat (path sama)
  return links.filter((l, i) => links.findIndex((x) => x.to === l.to) === i);
}

const ChatbotWidget: React.FC = () => {
  const { user } = useAuthStore();
  const role = user?.role ?? 'masyarakat';
  const examples = EXAMPLE_QUESTIONS[role] ?? EXAMPLE_QUESTIONS.masyarakat;

  const [isOpen, setIsOpen] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [messages, setMessages] = useState<ChatBubble[]>([{ id: 'greet', role: 'assistant', content: GREETING }]);
  const [historyList, setHistoryList] = useState<ConversationItem[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [lastFailed, setLastFailed] = useState('');
  const [restored, setRestored] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, isSending, isOpen, showHistory]);

  // Kembalikan percakapan terakhir saat widget pertama dibuka (context memory)
  useEffect(() => {
    if (!isOpen || restored) return;
    setRestored(true);
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return;
    setIsLoading(true);
    getConversation(stored)
      .then((conv) => {
        setConversationId(conv.id);
        const loaded = conv.messages
          .filter((m) => m.role === 'user' || m.role === 'assistant')
          .map((m) => ({ id: m.id, role: m.role as 'user' | 'assistant', content: m.content }));
        if (loaded.length > 0) setMessages(loaded);
      })
      .catch(() => {
        localStorage.removeItem(STORAGE_KEY);
      })
      .finally(() => setIsLoading(false));
  }, [isOpen, restored]);

  const startNewChat = () => {
    setConversationId(null);
    localStorage.removeItem(STORAGE_KEY);
    setMessages([{ id: 'greet', role: 'assistant', content: GREETING }]);
    setError('');
    setLastFailed('');
    setShowHistory(false);
  };

  const openHistory = async () => {
    setShowHistory(true);
    setError('');
    try {
      setHistoryList(await listConversations());
    } catch (err) {
      setError(extractErrorMessage(err) || 'Gagal memuat riwayat percakapan.');
    }
  };

  const openConversation = async (id: string) => {
    setIsLoading(true);
    setError('');
    try {
      const conv = await getConversation(id);
      setConversationId(conv.id);
      localStorage.setItem(STORAGE_KEY, conv.id);
      const loaded = conv.messages
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .map((m) => ({ id: m.id, role: m.role as 'user' | 'assistant', content: m.content }));
      setMessages(loaded.length > 0 ? loaded : [{ id: 'greet', role: 'assistant', content: GREETING }]);
      setShowHistory(false);
    } catch (err) {
      setError(extractErrorMessage(err) || 'Gagal membuka percakapan.');
    } finally {
      setIsLoading(false);
    }
  };

  const removeConversation = async (id: string) => {
    try {
      await deleteConversation(id);
      setHistoryList((prev) => prev.filter((h) => h.id !== id));
      if (id === conversationId) startNewChat();
    } catch (err) {
      setError(extractErrorMessage(err) || 'Gagal menghapus percakapan.');
    }
  };

  const handleSend = async (preset?: string) => {
    const text = (preset ?? input).trim();
    if (!text || isSending) return;

    setError('');
    setLastFailed('');
    setInput('');
    setMessages((prev) => [...prev, { id: `u-${Date.now()}`, role: 'user', content: text }]);
    setIsSending(true);

    try {
      const res = await sendChatMessage(text, conversationId ?? undefined);
      setConversationId(res.conversation_id);
      localStorage.setItem(STORAGE_KEY, res.conversation_id);
      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: 'assistant',
          content: res.reply,
          links: linksForTools(role, res.tools_used ?? []),
        },
      ]);
    } catch (err) {
      setError(extractErrorMessage(err) || 'Gagal mendapatkan jawaban. Silakan coba lagi.');
      setLastFailed(text);
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

  const showExamples = !isLoading && messages.length === 1 && !isSending;

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end gap-3">
      {isOpen && (
        <div className="flex h-[min(80vh,520px)] w-[min(92vw,380px)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
          {/* Header */}
          <div className="flex items-center gap-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-3 text-white">
            {showHistory ? (
              <button type="button" onClick={() => setShowHistory(false)} aria-label="Kembali ke chat" className="rounded-lg p-1.5 hover:bg-white/20 transition">
                <ArrowLeft size={18} />
              </button>
            ) : (
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20">
                <Bot size={20} />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold leading-tight">{showHistory ? 'Riwayat Percakapan' : 'Asisten SIPANTAU'}</p>
              <p className="text-[11px] text-blue-100">{showHistory ? 'Pilih untuk melanjutkan' : 'Online — siap membantu'}</p>
            </div>
            {!showHistory && (
              <>
                <button type="button" onClick={openHistory} aria-label="Riwayat percakapan" className="rounded-lg p-1.5 hover:bg-white/20 transition">
                  <History size={17} />
                </button>
                <button type="button" onClick={startNewChat} aria-label="Percakapan baru" className="rounded-lg p-1.5 hover:bg-white/20 transition">
                  <Plus size={18} />
                </button>
              </>
            )}
            <button type="button" onClick={() => setIsOpen(false)} aria-label="Tutup chatbot" className="rounded-lg p-1.5 hover:bg-white/20 transition">
              <X size={18} />
            </button>
          </div>

          {showHistory ? (
            <div className="flex-1 overflow-y-auto bg-slate-50 px-3 py-3">
              {historyList.length === 0 ? (
                <p className="px-2 py-8 text-center text-sm text-slate-400">Belum ada riwayat percakapan.</p>
              ) : (
                <ul className="space-y-2">
                  {historyList.map((h) => (
                    <li key={h.id} className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 ${h.id === conversationId ? 'border-blue-300 bg-blue-50' : 'border-slate-200 bg-white'}`}>
                      <button type="button" onClick={() => void openConversation(h.id)} className="min-w-0 flex-1 text-left">
                        <p className="truncate text-sm font-semibold text-slate-800">{h.title}</p>
                        <p className="text-[11px] text-slate-400">{formatDate(h.updated_at)}</p>
                      </button>
                      <button type="button" onClick={() => void removeConversation(h.id)} aria-label={`Hapus ${h.title}`} className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 transition">
                        <Trash2 size={15} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : (
            <>
              <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto bg-slate-50 px-4 py-4">
                {isLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 size={22} className="animate-spin text-slate-400" />
                  </div>
                ) : (
                  messages.map((m) => (
                    <div key={m.id} className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
                      <div className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed shadow-sm ${m.role === 'user' ? 'rounded-br-md bg-blue-600 text-white' : 'rounded-bl-md border border-slate-200 bg-white text-slate-800'}`}>
                        {m.content}
                      </div>
                      {m.links && m.links.length > 0 && (
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          {m.links.map((l) => (
                            <Link
                              key={l.to}
                              to={l.to}
                              className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-700 hover:bg-blue-100 transition"
                            >
                              <ExternalLink size={11} />
                              {l.label}
                            </Link>
                          ))}
                        </div>
                      )}
                    </div>
                  ))
                )}

                {showExamples && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {examples.map((q) => (
                      <button
                        key={q}
                        type="button"
                        onClick={() => void handleSend(q)}
                        className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-left text-[11px] font-medium text-slate-600 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 transition"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                )}

                {isSending && (
                  <div className="flex justify-start">
                    <div className="flex items-center gap-2 rounded-2xl rounded-bl-md border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-500 shadow-sm">
                      <Loader2 size={15} className="animate-spin" />
                      Mengetik...
                    </div>
                  </div>
                )}
              </div>

              {error && (
                <div className="flex items-center justify-between gap-2 border-t border-red-100 bg-red-50 px-4 py-2 text-xs text-red-600">
                  <span>{error}</span>
                  {lastFailed && (
                    <button
                      type="button"
                      onClick={() => void handleSend(lastFailed)}
                      className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-red-200 bg-white px-2 py-1 font-semibold text-red-600 hover:bg-red-100 transition"
                    >
                      <RotateCcw size={11} />
                      Coba lagi
                    </button>
                  )}
                </div>
              )}

              <div className="border-t border-slate-200 bg-white p-3">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Tulis pertanyaan..."
                    maxLength={2000}
                    disabled={isSending}
                    aria-label="Tulis pertanyaan untuk chatbot"
                    className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 disabled:opacity-60"
                  />
                  <button
                    type="button"
                    onClick={() => void handleSend()}
                    disabled={!input.trim() || isSending}
                    aria-label="Kirim pesan"
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow hover:bg-blue-700 transition disabled:bg-slate-300"
                  >
                    {isSending ? <Loader2 size={17} className="animate-spin" /> : <Send size={17} />}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        aria-label={isOpen ? 'Tutup chatbot' : 'Buka chatbot Asisten SIPANTAU'}
        className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-xl ring-4 ring-blue-100 hover:scale-105 transition"
      >
        {isOpen ? <X size={24} /> : <MessageCircle size={24} />}
      </button>
    </div>
  );
};

export default ChatbotWidget;
