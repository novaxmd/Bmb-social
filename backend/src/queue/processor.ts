import PQueue from 'p-queue';
import * as fs from 'fs';
import { prisma } from '../utils/prisma';
import { downloader, detectPlatform, DownloadType } from '../downloader';
import { needsSplit, splitFile, cleanupSplitDir } from '../downloader/splitter';
import { getMtprotoClient, sendFileViaMtproto, isMtprotoAvailable } from '../mtproto/client';
import { getSocketIO } from '../socket';
import logger from '../utils/logger';
import { bot } from '../bot';


const queue = new PQueue({ concurrency: 3 });

export interface QueueJob {
  downloadId: string;
  url: string;
  type: DownloadType;
  quality: string;
  chatId?: string;
  messageId?: number;
  progressMsgId?: number;
}

const BOT_FILE_LIMIT = 50 * 1024 * 1024; 

export async function enqueueDownload(job: QueueJob): Promise<void> {
  logger.info('Enqueuing download', { downloadId: job.downloadId, url: job.url });

  queue.add(async () => {
    await processDownload(job);
  });
}

async function updateStatus(
  downloadId: string,
  status: string,
  extra: Record<string, any> = {}
): Promise<void> {
  await prisma.download.update({
    where: { id: downloadId },
    data: { status, updatedAt: new Date(), ...extra }
  });

  const io = getSocketIO();
  if (io) {
    
    const safeExtra = { ...extra };
    for (const key in safeExtra) {
      if (typeof safeExtra[key] === 'bigint') {
        safeExtra[key] = Number(safeExtra[key]);
      }
    }
    io.emit('download:update', { downloadId, status, ...safeExtra });
  }
}

async function sendProgressMsg(chatId: string | undefined, text: string, existingMsgId?: number): Promise<number | undefined> {
  if (!chatId) return undefined;
  try {
    if (existingMsgId) {
      await bot.telegram.editMessageText(chatId, existingMsgId, undefined, text, { parse_mode: 'HTML' });
      return existingMsgId;
    } else {
      const msg = await bot.telegram.sendMessage(chatId, text, { parse_mode: 'HTML' });
      return msg.message_id;
    }
  } catch (err) {
    logger.warn('Failed to update progress message', { err });
    return existingMsgId;
  }
}

async function processDownload(job: QueueJob): Promise<void> {
  const { downloadId, url, type, quality, chatId } = job;
  let progressMsgId: number | undefined;
  let downloadedFilePath: string | undefined;
  let splitDir: string | undefined;

  try {
    
    await updateStatus(downloadId, 'downloading', { progress: 0 });

    progressMsgId = await sendProgressMsg(
      chatId,
      `⏳ <b>Downloading...</b>\n🔗 ${url}\n\n📊 Preparing...`
    );

    
    downloader.on('progress', async (id: string, progress: any) => {
      if (id !== downloadId) return;

      await updateStatus(downloadId, 'downloading', { progress: progress.percent });

      if (progressMsgId) {
        const bar = buildProgressBar(progress.percent);
        await sendProgressMsg(
          chatId,
          `⏳ <b>Downloading...</b>\n\n${bar} ${progress.percent.toFixed(1)}%\n💾 Size: ${progress.size || '?'}\n⚡ Speed: ${progress.speed || '?'}\n⏱ ETA: ${progress.eta || '?'}`,
          progressMsgId
        );
      }
    });

    
    const result = await downloader.download({ url, type, quality, downloadId });
    downloadedFilePath = result.filePath;

    logger.info('Download complete', { downloadId, fileName: result.fileName, fileSize: result.fileSize });

    await updateStatus(downloadId, 'sending', {
      progress: 100,
      fileName: result.fileName,
      fileSize: BigInt(result.fileSize),
      title: result.title
    });

    await prisma.download.update({
      where: { id: downloadId },
      data: {
        fileName: result.fileName,
        fileSize: BigInt(result.fileSize),
        title: result.title,
        duration: result.duration,
        filePath: result.filePath
      }
    });

    if (!chatId) {
      
      await updateStatus(downloadId, 'done', { progress: 100 });
      logger.info('Web download job completed', { downloadId });
      
      downloadedFilePath = undefined; 
      return;
    }

    if (progressMsgId) {
      await sendProgressMsg(
        chatId,
        `📤 <b>Sending to Telegram...</b>\n📁 ${result.title || result.fileName}\n💾 ${formatBytes(result.fileSize)}`,
        progressMsgId
      );
    }

    
    const mtprotoAvailable = await isMtprotoAvailable();
    const fileSize = result.fileSize;

    if (fileSize > 2 * 1024 * 1024 * 1024) {
      
      const split = await splitFile(result.filePath);
      splitDir = split.outputDir;

      await prisma.download.update({
        where: { id: downloadId },
        data: { parts: split.partCount }
      });

      for (let i = 0; i < split.parts.length; i++) {
        const partPath = split.parts[i];
        const caption = `🎬 <b>${result.title || result.fileName}</b>\n📦 Part ${i + 1}/${split.partCount}`;

        if (progressMsgId) {
          await sendProgressMsg(
            chatId,
            `📤 Sending part ${i + 1}/${split.partCount}...`,
            progressMsgId
          );
        }

        if (mtprotoAvailable) {
          await sendFileViaMtproto(chatId, partPath, caption, async (pct) => {
            const io = getSocketIO();
            if (io) io.emit('download:update', { downloadId, status: 'sending', partProgress: pct, part: i + 1 });
          });
        } else {
          await bot.telegram.sendDocument(chatId, { source: partPath }, { caption, parse_mode: 'HTML' });
        }

        await prisma.download.update({
          where: { id: downloadId },
          data: { sentParts: i + 1 }
        });
      }

      cleanupSplitDir(splitDir);
      splitDir = undefined;

    } else if (fileSize > BOT_FILE_LIMIT && mtprotoAvailable) {
      
      const caption = `🎬 <b>${result.title || result.fileName}</b>\n💾 ${formatBytes(fileSize)}`;
      await sendFileViaMtproto(chatId, result.filePath, caption, async (pct) => {
        const io = getSocketIO();
        if (io) io.emit('download:update', { downloadId, status: 'sending', progress: pct });
        if (progressMsgId && pct % 20 === 0) {
          await sendProgressMsg(
            chatId,
            `📤 <b>Sending...</b>\n${buildProgressBar(pct)} ${pct}%`,
            progressMsgId
          );
        }
      });

    } else {
      
      const caption = `🎬 <b>${result.title || result.fileName}</b>\n💾 ${formatBytes(fileSize)}`;
      
      if (type === 'audio') {
        await bot.telegram.sendAudio(
          chatId,
          { source: result.filePath },
          { caption, parse_mode: 'HTML', title: result.title, duration: result.duration }
        );
      } else {
        await bot.telegram.sendVideo(
          chatId,
          { source: result.filePath },
          { caption, parse_mode: 'HTML', duration: result.duration, supports_streaming: true }
        );
      }
    }

    
    await updateStatus(downloadId, 'done', { progress: 100 });

    await prisma.userSession.updateMany({
      where: { chatId: String(chatId) },
      data: {
        totalDownloads: { increment: 1 },
        totalBytes: { increment: BigInt(fileSize) }
      }
    });

    const successText = `✅ <b>Completed!</b>\n\n📁 ${result.title || result.fileName}\n💾 ${formatBytes(fileSize)}\n⏱ Duration: ${result.duration ? formatDuration(result.duration) : '?'}`;

    if (progressMsgId) {
      await sendProgressMsg(chatId, successText, progressMsgId);
    } else {
      await bot.telegram.sendMessage(chatId, successText, { parse_mode: 'HTML' });
    }

    logger.info('Download job completed', { downloadId });

  } catch (err: any) {
    logger.error('Download job failed', { downloadId, error: err.message });

    await updateStatus(downloadId, 'error', { errorMsg: err.message });

    const errorText = `❌ <b>An error occurred!</b>\n\n${err.message || 'Unknown error'}\n\nPlease try again or send a different URL.`;
    
    if (progressMsgId) {
      await sendProgressMsg(chatId, errorText, progressMsgId).catch(() => {});
    } else if (chatId) {
      await bot.telegram.sendMessage(chatId, errorText, { parse_mode: 'HTML' }).catch(() => {});
    }
  } finally {
    
    if (downloadedFilePath && chatId) {
      downloader.cleanupFile(downloadedFilePath);
    }
    if (splitDir) {
      cleanupSplitDir(splitDir);
    }
    downloader.removeAllListeners('progress');
  }
}

function buildProgressBar(percent: number): string {
  const filled = Math.round(percent / 5);
  const empty = 20 - filled;
  return '█'.repeat(filled) + '░'.repeat(empty);
}

export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${bytes} B`;
}

export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function getQueueStats() {
  return {
    pending: queue.size,
    running: queue.pending,
    concurrency: queue.concurrency
  };
}
