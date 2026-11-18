import { IAIService } from './ai.interface';
import { MockAIService } from './mock.ai.service';

// Di masa depan, Anda bisa menggunakan environment variable untuk memilih AI engine
// const aiEngine = process.env.AI_ENGINE || 'mock';
// export const aiService: IAIService = aiEngine === 'openai' ? new OpenAIService() : new MockAIService();

export const aiService: IAIService = new MockAIService();
