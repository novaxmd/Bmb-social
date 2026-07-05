import { Router, Request, Response } from 'express';
import { prisma } from '../utils/prisma';
import { detectPlatform, isValidUrl, downloader } from '../downloader';
import { enqueueDownload, getQueueStats } from '../queue/processor';
import { isMtprotoAvailable } from '../mtproto/client';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
import logger from '../utils/logger';

const router = Router();


router.get('/proxy', async (req: Request, res: Response) => {
  const { url } = req.query;
  if (!url || typeof url !== 'string') return res.status(400).send('URL required');

  try {
    const response = await axios.get(url, {
      responseType: 'stream',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://www.instagram.com/'
      }
    });
    
    
    res.setHeader('Content-Type', response.headers['content-type'] || 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    
    response.data.pipe(res);
  } catch (err) {
    res.status(500).send('Proxy error');
  }
});


router.get('/health', async (_req: Request, res: Response) => {
  const mtproto = await isMtprotoAvailable();
  const queue = getQueueStats();
  const dbOk = await prisma.$queryRaw`SELECT 1`.then(() => true).catch(() => false);

  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    services: {
      database: dbOk ? 'ok' : 'error',
      mtproto: mtproto ? 'authenticated' : 'bot-mode',
      queue: {
        ...queue,
        status: 'ok'
      }
    }
  });
});


router.post('/metadata', async (req: Request, res: Response) => {
  const { url } = req.body;

  if (!url || !isValidUrl(url)) {
    return res.status(400).json({ error: 'A valid URL is required' });
  }

  const platform = detectPlatform(url);
  if (platform === 'unknown') {
    return res.status(400).json({ error: 'Unsupported platform' });
  }

  try {
    const meta = await downloader.getMetadata(url) || {};
    
    
    let thumbnail = meta.thumbnail;
    if (thumbnail && (thumbnail.includes('fbcdn.net') || thumbnail.includes('instagram.com'))) {
      const BASE_URL = process.env.API_BASE_URL || `http://localhost:${process.env.PORT || 3355}`;
      thumbnail = `${BASE_URL}/api/proxy?url=${encodeURIComponent(thumbnail)}`;
    }

    res.json({ platform, title: meta.title, duration: meta.duration, thumbnail });
  } catch (err: any) {
    res.status(500).json({ error: 'Could not fetch metadata: ' + err.message });
  }
});


router.post('/download', async (req: Request, res: Response) => {
  const { url, chatId, type = 'video', quality = 'best' } = req.body;

  if (!url || !isValidUrl(url)) {
    return res.status(400).json({ error: 'A valid URL is required' });
  }

  const platform = detectPlatform(url);
  if (platform === 'unknown') {
    return res.status(400).json({ error: 'Unsupported platform' });
  }

  if (type === 'audio' && platform !== 'youtube') {
    return res.status(400).json({ error: 'Music download is only supported for YouTube' });
  }

  const downloadId = uuidv4();

  await prisma.download.create({
    data: {
      id: downloadId,
      url,
      platform,
      type,
      quality,
      status: 'pending',
      chatId: chatId ? String(chatId) : null
    }
  });

  await enqueueDownload({ downloadId, url, type, quality, chatId: chatId ? String(chatId) : undefined });

  res.json({ downloadId, status: 'pending', platform });
});


router.get('/download/:id', async (req: Request, res: Response) => {
  const download = await prisma.download.findUnique({
    where: { id: req.params.id }
  });

  if (!download) {
    return res.status(404).json({ error: 'Download not found' });
  }

  res.json({
    ...download,
    fileSize: download.fileSize ? Number(download.fileSize) : null,
    totalBytes: download.fileSize ? Number(download.fileSize) : null
  });
});


router.get('/download/:id/file', async (req: Request, res: Response) => {
  const download = await prisma.download.findUnique({
    where: { id: req.params.id }
  });

  if (!download || !download.filePath || download.status !== 'done') {
    return res.status(404).json({ error: 'File not found or not ready yet' });
  }

  res.download(download.filePath, download.fileName || 'download', (err) => {
    if (err) {
      logger.error('File download error', { error: err });
    }
  });
});


router.get('/downloads', async (req: Request, res: Response) => {
  const page = parseInt(String(req.query.page || '1'));
  const limit = Math.min(parseInt(String(req.query.limit || '20')), 100);
  const skip = (page - 1) * limit;

  const where: any = {};
  if (req.query.status) where.status = req.query.status;
  if (req.query.platform) where.platform = req.query.platform;
  if (req.query.chatId) where.chatId = String(req.query.chatId);

  const [downloads, total] = await Promise.all([
    prisma.download.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit
    }),
    prisma.download.count({ where })
  ]);

  res.json({
    data: downloads.map((d: any) => ({
      ...d,
      fileSize: d.fileSize ? Number(d.fileSize) : null
    })),
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    }
  });
});


router.delete('/downloads', async (_req: Request, res: Response) => {
  try {
    const toDelete = await prisma.download.findMany({
      where: {
        status: { in: ['done', 'error', 'cancelled'] }
      }
    });

    
    for (const d of toDelete) {
      if (d.filePath) {
        
        downloader.cleanupFile(d.filePath);
      } else {
        
        const tempDir = process.env.TEMP_DIR || '/tmp/bmbtech';
        downloader.cleanupDir(`${tempDir}/${d.id}`);
      }
    }

    
    await prisma.download.deleteMany({
      where: {
        id: { in: toDelete.map(d => d.id) }
      }
    });

    res.json({ success: true, count: toDelete.length });
  } catch (err: any) {
    logger.error('Clear history error', { error: err.message });
    res.status(500).json({ error: 'An error occurred while clearing history' });
  }
});


router.delete('/download/:id', async (req: Request, res: Response) => {
  try {
    const download = await prisma.download.findUnique({
      where: { id: req.params.id }
    });

    if (!download) {
      return res.status(404).json({ error: 'Download not found' });
    }

    
    if (download.filePath) {
      downloader.cleanupFile(download.filePath);
    } else {
      const tempDir = process.env.TEMP_DIR || '/tmp/bmbtech';
      downloader.cleanupDir(`${tempDir}/${download.id}`);
    }

    
    await prisma.download.delete({
      where: { id: req.params.id }
    });

    res.json({ success: true, message: 'Download deleted' });
  } catch (err: any) {
    logger.error('Delete download error', { error: err.message });
    res.status(500).json({ error: 'An error occurred while deleting the download' });
  }
});


router.get('/stats', async (_req: Request, res: Response) => {
  const [total, done, pending, errors, byPlatform] = await Promise.all([
    prisma.download.count(),
    prisma.download.count({ where: { status: 'done' } }),
    prisma.download.count({ where: { status: { in: ['pending', 'downloading', 'sending'] } } }),
    prisma.download.count({ where: { status: 'error' } }),
    prisma.download.groupBy({
      by: ['platform'],
      _count: { id: true }
    })
  ]);

  const users = await prisma.userSession.count();

  res.json({
    downloads: { total, done, pending, errors },
    byPlatform: Object.fromEntries(byPlatform.map((p: any) => [p.platform, p._count.id])),
    users,
    queue: getQueueStats()
  });
});

export default router;
