import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import path from 'path';

import { config } from './config';
import { logger } from './utils/logger';
import prisma from './utils/db';
import { telegramService } from './services/telegram/telegram.service';
import { errorHandler, notFoundHandler } from './middlewares/error.middleware';
import { globalLimiter } from './middlewares/rateLimit.middleware';

import authRoutes from './routes/auth.routes';
import reportRoutes from './routes/report.routes';
import adminRoutes from './routes/admin.routes';
import petugasRoutes from './routes/petugas.routes';
import gisRoutes from './routes/gis.routes';
import notificationRoutes from './routes/notification.routes';
import chatRoutes from './routes/chat.routes';
import telegramRoutes from './routes/telegram.routes';

const app: Express = express();

// Validasi konfigurasi Telegram saat startup tanpa menampilkan nilai rahasia.
const telegramStatus = telegramService.validateConfig();
if (telegramStatus.enabled && !telegramStatus.ready) {
  logger.warn('Telegram diaktifkan tetapi konfigurasi belum lengkap', {
    issues: telegramStatus.issues,
  });
} else if (telegramStatus.ready) {
  logger.info('Telegram notification service aktif');
} else {
  logger.info('Telegram notification service nonaktif (TELEGRAM_ENABLED=false)');
}

if (telegramStatus.enabled && !config.telegram.webhookSecret) {
  logger.warn('TELEGRAM_WEBHOOK_SECRET belum diatur; endpoint webhook Telegram akan menolak semua request');
}
if (telegramStatus.enabled && !config.telegram.botUsername) {
  logger.warn('TELEGRAM_BOT_USERNAME belum diatur; deep link Telegram tidak tersedia (kode tetap bisa dikirim manual)');
}

app.disable('x-powered-by');
app.set('trust proxy', 1);

// Middleware
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow non-browser clients (no Origin) and whitelisted origins
      if (!origin || config.corsOrigins.includes(origin)) return callback(null, true);
      // Development: reflect any local/preview origin so the app works via
      // 127.0.0.1, LAN IP, or tunneled preview URLs. Production stays strict.
      if (!config.isProduction) return callback(null, origin);
      return callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
  })
);
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(cookieParser());
app.use(globalLimiter);

// Serve static uploads
app.use('/uploads', express.static(path.join(__dirname, '../public/uploads')));

// Health check endpoint (liveness & readiness)
app.get('/health', async (req: Request, res: Response) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({ status: 'ok', database: 'up', uptime: process.uptime() });
  } catch {
    res.status(503).json({ status: 'error', database: 'down' });
  }
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/gis', gisRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/petugas', petugasRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/telegram', telegramRoutes);

app.get('/', (req: Request, res: Response) => {
  res.send('API Sistem Pelaporan Fasilitas Umum is running!');
});

app.use(notFoundHandler);
app.use(errorHandler);

export default app;

// Start server only when run directly (not in tests)
if (require.main === module) {
  const server = app.listen(config.port, () => {
    logger.info(`Server is running at http://localhost:${config.port}`, { env: config.env });
  });

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    logger.info(`${signal} received, shutting down gracefully`);
    server.close(async () => {
      await prisma.$disconnect();
      process.exit(0);
    });
    // Force exit after 10s
    setTimeout(() => process.exit(1), 10000).unref();
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}
