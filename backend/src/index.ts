import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import swaggerUi from 'swagger-ui-express';
import cron from 'node-cron';
import * as fs from 'fs';
import path from 'path';

import { prisma } from './utils/prisma';
import logger from './utils/logger';
import { initSocketIO } from './socket';
import { bot } from './bot';
import apiRouter from './routes/api';
import { swaggerSpec } from './swagger/config';
import { getMtprotoClient } from './mtproto/client';

const app = express();
const httpServer = createServer(app);


app.set('trust proxy', 1);

const PORT = parseInt(process.env.PORT || '3001');
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';


app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));
app.use(cors({
  origin: [FRONTEND_URL, 'http://localhost:3344', 'http://localhost:3355', 'https://download.bmntech.site'],
  credentials: true
}));
app.use(morgan('combined', { stream: { write: (msg) => logger.info(msg.trim()) } }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));


const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000'),
  max: parseInt(process.env.RATE_LIMIT_MAX || '30'),
  message: { error: 'Too many requests, please wait a minute.' },
  standardHeaders: true,
  legacyHeaders: false
});
app.use('/api', limiter);


app.use('/api', apiRouter);


app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customCss: '.swagger-ui .topbar { background: #1a0a2e; }',
  customSiteTitle: 'Bmbtech API Docs',
  customfavIcon: '/favicon.ico'
}));


app.get('/api/openapi.json', (_req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});


app.get('/', (_req, res) => {
  res.json({ name: 'Bmbtech API', version: '1.0.0', status: 'running' });
});


initSocketIO(httpServer, FRONTEND_URL);


async function start() {
  try {
    
    await prisma.$connect();
    logger.info('Database connected');

    
    const tempDir = process.env.TEMP_DIR || '/tmp/bmbtech';
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    
    getMtprotoClient().then(() => {
      logger.info('MTProto client initialized');
    }).catch(err => {
      logger.warn('MTProto init failed (bot-mode only)', { error: err.message });
    });

    
    if (process.env.NODE_ENV === 'production' && process.env.WEBHOOK_URL) {
      const webhookUrl = `${process.env.WEBHOOK_URL}/telegram-webhook`;
      await bot.telegram.setWebhook(webhookUrl);
      app.use('/telegram-webhook', bot.webhookCallback('/telegram-webhook'));
      logger.info('Bot started with webhook', { url: webhookUrl });
    } else {
      bot.launch({ dropPendingUpdates: true });
      logger.info('Bot started with long polling');
    }

    
    cron.schedule('0 * * * *', async () => {
      const tempDir = process.env.TEMP_DIR || '/tmp/bmbtech';
      const hoursLimit = 24;
      const cutoff = new Date(Date.now() - hoursLimit * 60 * 60 * 1000);

      try {
        
        const oldDownloads = await prisma.download.findMany({
          where: {
            createdAt: { lt: cutoff },
            status: { in: ['done', 'error', 'cancelled'] }
          }
        });

        for (const d of oldDownloads) {
          try {
            
            if (d.filePath && fs.existsSync(d.filePath)) {
              const dirPath = path.dirname(d.filePath);
              fs.rmSync(dirPath, { recursive: true, force: true });
            } else {
              const dirPath = path.join(tempDir, d.id);
              if (fs.existsSync(dirPath)) {
                fs.rmSync(dirPath, { recursive: true, force: true });
              }
            }
          } catch { }
        }

        
        const deleted = await prisma.download.deleteMany({
          where: {
            id: { in: oldDownloads.map(d => d.id) }
          }
        });

        if (deleted.count > 0) {
          logger.info('Auto-cleanup completed', { deletedCount: deleted.count });
        }

        
        if (fs.existsSync(tempDir)) {
          const dirs = fs.readdirSync(tempDir);
          const now = Date.now();
          for (const dir of dirs) {
            const dirPath = path.join(tempDir, dir);
            try {
              const stat = fs.statSync(dirPath);
              if (now - stat.mtimeMs > hoursLimit * 60 * 60 * 1000) {
                fs.rmSync(dirPath, { recursive: true, force: true });
              }
            } catch { }
          }
        }
      } catch (e) {
        logger.warn('Cleanup job error', { error: e });
      }
    });

    
    httpServer.listen(PORT, '0.0.0.0', () => {
      logger.info(`🚀 Bmbtech API running on port ${PORT}`);
      logger.info(`📖 Swagger UI: http://localhost:${PORT}/api/docs`);
    });

  } catch (err) {
    logger.error('Startup failed', { error: err });
    process.exit(1);
  }
}


process.once('SIGINT', () => {
  bot.stop('SIGINT');
  httpServer.close(() => {
    prisma.$disconnect();
    process.exit(0);
  });
});

process.once('SIGTERM', () => {
  bot.stop('SIGTERM');
  httpServer.close(() => {
    prisma.$disconnect();
    process.exit(0);
  });
});

start();
