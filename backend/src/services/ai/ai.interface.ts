export interface AIAnalysisResult {
  kategori: string;
  prioritas: 'Rendah' | 'Sedang' | 'Tinggi' | 'Darurat';
  confidence: number; // 0 to 1
}

export interface IAIService {
  analyze(deskripsi: string, imagePath?: string): Promise<AIAnalysisResult>;
}
