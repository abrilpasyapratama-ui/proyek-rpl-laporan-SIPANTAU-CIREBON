import { describe, it, expect } from 'vitest';
import { createReportSchema, loginSchema, registerSchema } from '../src/validation/schemas';

describe('Validation schemas', () => {
  it('registerSchema accepts valid input and sanitizes', () => {
    const parsed = registerSchema.parse({
      nama: '  Budi <b>Santoso</b> ',
      email: 'Budi@Example.COM',
      password: 'Rahasia123',
    });
    expect(parsed.email).toBe('budi@example.com');
    expect(parsed.nama).toBe('Budi bSantoso/b');
  });

  it('registerSchema rejects weak password', () => {
    expect(() =>
      registerSchema.parse({ nama: 'Budi', email: 'a@b.com', password: 'rahasia123' })
    ).toThrow();
    expect(() =>
      registerSchema.parse({ nama: 'Budi', email: 'a@b.com', password: 'RAHASIA123' })
    ).toThrow();
    expect(() =>
      registerSchema.parse({ nama: 'Budi', email: 'a@b.com', password: 'Rahasia' })
    ).toThrow();
  });

  it('registerSchema rejects short nama', () => {
    expect(() =>
      registerSchema.parse({ nama: 'Al', email: 'a@b.com', password: 'Rahasia123' })
    ).toThrow();
  });

  it('registerSchema rejects short password', () => {
    expect(() =>
      registerSchema.parse({ nama: 'Budi', email: 'a@b.com', password: '123' })
    ).toThrow();
  });

  it('loginSchema requires password', () => {
    expect(() => loginSchema.parse({ email: 'a@b.com', password: '' })).toThrow();
  });

  it('createReportSchema coerces lat/long from strings (multipart)', () => {
    const parsed = createReportSchema.parse({
      judul: 'Jalan rusak parah',
      deskripsi: 'Ada lubang besar di tengah jalan',
      kategori: 'Jalan Rusak',
      lokasi: 'Jl. Merdeka No 1',
      latitude: '-6.2',
      longitude: '106.8',
    });
    expect(parsed.latitude).toBeCloseTo(-6.2);
    expect(parsed.longitude).toBeCloseTo(106.8);
  });

  it('createReportSchema rejects invalid coordinates', () => {
    expect(() =>
      createReportSchema.parse({
        judul: 'Jalan rusak parah',
        deskripsi: 'Ada lubang besar di tengah jalan',
        kategori: 'Jalan Rusak',
        lokasi: 'Jl. Merdeka No 1',
        latitude: '-200',
        longitude: '106.8',
      })
    ).toThrow();
  });
});
