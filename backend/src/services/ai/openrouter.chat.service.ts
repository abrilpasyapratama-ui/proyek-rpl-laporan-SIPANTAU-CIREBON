/**
 * Wrapper kompatibilitas.
 *
 * Implementasi chat completion multi-provider (OpenRouter / OpenAI / Custom)
 * kini berada di `chatProvider.service.ts`. File ini dipertahankan agar
 * import lama (`../ai/openrouter.chat.service`) tetap bekerja tanpa duplikasi.
 */
export {
  completeChat,
  resolveAiConfig,
  listAiModels,
  testAiConnection,
} from './chatProvider.service';

export type {
  ChatCompletionMessage,
  ToolCall,
  AiProviderConfig,
  AiConnectionResult,
} from './chatProvider.service';
