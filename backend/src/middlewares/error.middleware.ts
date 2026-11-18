import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { logger } from '../utils/logger';

export class ApiError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
  }
}

/** Wrap async route handlers so rejections reach the error middleware. */
export const asyncHandler =
  (fn: (req: any, res: Response, next: NextFunction) => Promise<any>) =>
  (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };

export const notFoundHandler = (req: Request, res: Response) => {
  res.status(404).json({ status: 'error', message: `Route ${req.method} ${req.path} not found` });
};

export const errorHandler = (err: any, req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof ZodError) {
    return res.status(400).json({
      status: 'error',
      message: 'Validasi input gagal',
      errors: (err.issues ?? []).map((e: any) => ({
        path: Array.isArray(e.path) ? e.path.join('.') : String(e.path ?? ''),
        message: e.message,
      })),
    });
  }

  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({ status: 'error', message: err.message });
  }

  // Multer errors (file too large, wrong type, etc.)
  if (err && (err.name === 'MulterError' || err.message?.includes('Format file'))) {
    return res.status(400).json({ status: 'error', message: err.message });
  }

  // Prisma known errors
  if (err?.code === 'P2025') {
    return res.status(404).json({ status: 'error', message: 'Data tidak ditemukan' });
  }
  if (err?.code === 'P2002') {
    return res.status(409).json({ status: 'error', message: 'Data sudah ada (duplikat)' });
  }

  logger.error('Unhandled error', { error: err?.message, stack: err?.stack, path: req.path });
  return res.status(500).json({ status: 'error', message: 'Terjadi kesalahan pada server' });
};
