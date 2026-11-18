import rateLimit from 'express-rate-limit';

const isTest = process.env.NODE_ENV === 'test' || !!process.env.VITEST;

/** Global limiter: 300 req / 15 min per IP */
export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isTest ? 100000 : 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { status: 'error', message: 'Terlalu banyak permintaan, coba lagi nanti' },
});

/** Strict limiter for auth endpoints: 20 req / 15 min per IP */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isTest ? 100000 : 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { status: 'error', message: 'Terlalu banyak percobaan login/registrasi, coba lagi nanti' },
});

/** Upload limiter: 30 req / 15 min per IP */
export const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isTest ? 100000 : 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { status: 'error', message: 'Terlalu banyak upload, coba lagi nanti' },
});

/** Chat limiter: 30 req / 15 min per IP (melindungi kuota API key AI) */
export const chatLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isTest ? 100000 : 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { status: 'error', message: 'Terlalu banyak permintaan chat, coba lagi nanti' },
});

/** Telegram link-code limiter: 10 req / 15 min per IP */
export const telegramLinkLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isTest ? 100000 : 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { status: 'error', message: 'Terlalu banyak permintaan kode penghubung, coba lagi nanti' },
});

/** Integration test limiter: 20 req / 15 min per IP (melindungi kuota Fonnte & API AI) */
export const integrationTestLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isTest ? 100000 : 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { status: 'error', message: 'Terlalu banyak permintaan uji integrasi, coba lagi nanti' },
});
