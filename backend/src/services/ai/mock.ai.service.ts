import { IAIService, AIAnalysisResult } from './ai.interface';

export class MockAIService implements IAIService {
  private categories = [
    'Jalan Rusak',
    'Lampu Jalan Mati',
    'Drainase Rusak',
    'Trotoar Rusak',
    'Rambu Lalu Lintas Rusak',
    'Fasilitas Umum Lainnya'
  ];

  async analyze(deskripsi: string, imagePath?: string): Promise<AIAnalysisResult> {
    // Simulasi delay proses AI (dapat dinonaktifkan via AI_MOCK_DELAY_MS / NODE_ENV=test)
    const delay = parseInt(process.env.AI_MOCK_DELAY_MS ?? (process.env.NODE_ENV === 'test' ? '0' : '800'), 10);
    if (delay > 0) {
      await new Promise(resolve => setTimeout(resolve, delay));
    }

    const lowerDesc = deskripsi.toLowerCase();
    
    let kategori = 'Fasilitas Umum Lainnya';
    let prioritas: AIAnalysisResult['prioritas'] = 'Rendah';
    let confidence = 0.6 + (Math.random() * 0.3); // 0.6 - 0.9

    // Heuristik sederhana
    if (lowerDesc.includes('jalan') && (lowerDesc.includes('lubang') || lowerDesc.includes('rusak'))) {
      kategori = 'Jalan Rusak';
      prioritas = 'Tinggi';
      confidence += 0.1;
    } else if (lowerDesc.includes('lampu') && lowerDesc.includes('mati')) {
      kategori = 'Lampu Jalan Mati';
      prioritas = 'Sedang';
    } else if (lowerDesc.includes('banjir') || lowerDesc.includes('selokan') || lowerDesc.includes('drainase')) {
      kategori = 'Drainase Rusak';
      prioritas = 'Darurat';
      confidence += 0.15;
    } else if (lowerDesc.includes('rambu') || lowerDesc.includes('lampu merah')) {
      kategori = 'Rambu Lalu Lintas Rusak';
      prioritas = 'Tinggi';
    } else if (lowerDesc.includes('trotoar')) {
      kategori = 'Trotoar Rusak';
      prioritas = 'Sedang';
    }

    // Pastikan confidence tidak lewat 0.99
    confidence = Math.min(confidence, 0.99);

    return {
      kategori,
      prioritas,
      confidence
    };
  }
}
