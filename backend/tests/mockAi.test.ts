import { describe, it, expect } from 'vitest';
import { MockAIService } from '../src/services/ai/mock.ai.service';

describe('MockAIService', () => {
  const ai = new MockAIService();

  it('detects jalan rusak', async () => {
    const r = await ai.analyze('Jalan depan rumah saya rusak dan berlubang');
    expect(r.kategori).toBe('Jalan Rusak');
    expect(r.prioritas).toBe('Tinggi');
    expect(r.confidence).toBeGreaterThan(0.5);
    expect(r.confidence).toBeLessThanOrEqual(0.99);
  });

  it('detects drainase/banjir as Darurat', async () => {
    const r = await ai.analyze('Selokan mampet, banjir di jalan');
    expect(r.kategori).toBe('Drainase Rusak');
    expect(r.prioritas).toBe('Darurat');
  });

  it('falls back to generic category', async () => {
    const r = await ai.analyze('Ada masalah kecil di taman');
    expect(r.kategori).toBe('Fasilitas Umum Lainnya');
  });
});
