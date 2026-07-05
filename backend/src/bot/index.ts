import { Telegraf, Context, Markup } from 'telegraf';
import * as dotenv from 'dotenv';
dotenv.config();

import { prisma } from '../utils/prisma';
import { detectPlatform, isValidUrl, downloader } from '../downloader';
import { enqueueDownload, formatBytes, formatDuration, getQueueStats } from '../queue/processor';
import logger from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

const BOT_TOKEN = process.env.BOT_TOKEN || '';
if (!BOT_TOKEN) throw new Error('BOT_TOKEN is required in .env');

export const bot = new Telegraf(BOT_TOKEN);

const PLATFORM_EMOJIS: Record<string, string> = {
  youtube: '🎬 YouTube',
  instagram: '📸 Instagram',
  tiktok: '🎵 TikTok',
  twitter: '🐦 Twitter/X',
  unknown: '🌐 Unknown'
};


bot.use(async (ctx, next) => {
  const chatId = String(ctx.chat?.id);
  const user = ctx.from;
  if (chatId && user) {
    await prisma.userSession.upsert({
      where: { chatId },
      create: {
        chatId,
        username: user.username,
        firstName: user.first_name,
        lastName: user.last_name,
        lastSeen: new Date()
      },
      update: {
        username: user.username,
        firstName: user.first_name,
        lastSeen: new Date()
      }
    });
  }
  return next();
});


bot.command('start', async (ctx) => {
  const name = ctx.from?.first_name || 'User';
    const buttons: any[] = [];
    if (process.env.NODE_ENV === 'production' && process.env.FRONTEND_URL && !process.env.FRONTEND_URL.includes('localhost')) {
      buttons.push([Markup.button.url('🌐 Web Interface', process.env.FRONTEND_URL)]);
    }

    await ctx.replyWithHTML(
      `👋 Hello <b>${name}</b>!\n\n` +
      `🎯 Welcome to <b>Bmbtech</b>! You can download content from the following platforms:\n\n` +
      `🎬 <b>YouTube</b> — Video & Music\n` +
      `📸 <b>Instagram</b> — Reels & Video\n` +
      `🎵 <b>TikTok</b> — Video\n` +
      `🐦 <b>Twitter/X</b> — Video\n\n` +
      `📌 Usage:\n` +
      `Just send a URL, I'll handle the rest!\n\n` +
      `⚙️ Commands:\n` +
      `/start — This message\n` +
      `/help — Help\n` +
      `/stats — My stats\n` +
      `/queue — Queue status`,
      Markup.inlineKeyboard(buttons)
    );
});


bot.command('help', async (ctx) => {
  await ctx.replyWithHTML(
    `📖 <b>Bmbtech Help</b>\n\n` +
    `<b>How to use it?</b>\n` +
    `1. Copy a URL from YouTube, Instagram, TikTok or Twitter\n` +
    `2. Send it to me\n` +
    `3. Choose video or music option\n` +
    `4. The download starts automatically!\n\n` +
    `<b>Supported formats:</b>\n` +
    `• Video: MP4 (best quality)\n` +
    `• Music: MP3 (YouTube only)\n\n` +
    `<b>File size:</b>\n` +
    `• Maximum 2GB\n` +
    `• Files over 2GB are sent split into parts\n\n` +
    `<b>⚡ Tips:</b>\n` +
    `• Large files may take some time\n` +
    `• You can send multiple links at once`
  );
});


bot.command('stats', async (ctx) => {
  const chatId = String(ctx.chat?.id);
  const session = await prisma.userSession.findUnique({ where: { chatId } });

  await ctx.replyWithHTML(
    `📊 <b>My Stats</b>\n\n` +
    `📥 Total Downloads: <b>${session?.totalDownloads || 0}</b>\n` +
    `💾 Total Size: <b>${formatBytes(Number(session?.totalBytes || 0))}</b>\n` +
    `📅 Member Since: <b>${session?.createdAt ? new Date(session.createdAt).toLocaleDateString('en-US') : '?'}</b>`
  );
});


bot.command('queue', async (ctx) => {
  const stats = getQueueStats();
  const myDownloads = await prisma.download.findMany({
    where: { chatId: String(ctx.chat?.id), status: { in: ['pending', 'downloading', 'sending'] } },
    orderBy: { createdAt: 'desc' },
    take: 5
  });

  let text = `⏳ <b>Queue Status</b>\n\n` +
    `🔄 Active: <b>${stats.running}</b>\n` +
    `📋 Pending: <b>${stats.pending}</b>\n\n`;

  if (myDownloads.length > 0) {
    text += `📌 <b>My Active Downloads:</b>\n`;
    for (const d of myDownloads) {
      const statusEmoji = d.status === 'downloading' ? '⬇️' : d.status === 'sending' ? '📤' : '⏳';
      text += `${statusEmoji} ${d.status === 'downloading' ? `%${d.progress.toFixed(0)}` : d.status} — ${d.title || d.url.substring(0, 30)}...\n`;
    }
  }

  await ctx.replyWithHTML(text);
});


bot.on('text', async (ctx) => {
  const text = ctx.message.text.trim();
  const chatId = String(ctx.chat.id);

  
  if (text.startsWith('/')) return;

  
  if (!isValidUrl(text)) {
    await ctx.replyWithHTML(
      `❓ Please send a valid URL!\n\n` +
      `Supported platforms: YouTube, Instagram, TikTok, Twitter/X\n\n` +
      `Example: <code>https://www.youtube.com/watch?v=...</code>`
    );
    return;
  }

  const platform = detectPlatform(text);
  if (platform === 'unknown') {
    await ctx.replyWithHTML(
      `⚠️ <b>Unsupported platform!</b>\n\n` +
      `Only these platforms are supported:\n` +
      `• YouTube\n• Instagram\n• TikTok\n• Twitter/X`
    );
    return;
  }

  const downloadId = uuidv4();

  
  await prisma.download.create({
    data: {
      id: downloadId,
      url: text,
      platform,
      type: 'video',
      quality: 'best',
      status: 'metadata_fetched',
      chatId,
      username: ctx.from?.username,
      firstName: ctx.from?.first_name
    }
  });

  const waitMsg = await ctx.replyWithHTML(`🔍 <b>Checking link, fetching info...</b>`);

  try {
    const meta = await downloader.getMetadata(text);
    
    const buttons = [
      [Markup.button.callback('🎬 Best Quality', `dl:vid:best:${downloadId}`)],
      [
        Markup.button.callback('1080p', `dl:vid:1080p:${downloadId}`),
        Markup.button.callback('720p', `dl:vid:720p:${downloadId}`),
        Markup.button.callback('480p', `dl:vid:480p:${downloadId}`)
      ]
    ];

    if (platform === 'youtube') {
      buttons.push([Markup.button.callback('🎵 MP3 Only', `dl:aud:best:${downloadId}`)]);
    }

    const titleText = meta?.title ? `<b>${meta.title}</b>\n` : '';
    const durationText = meta?.duration ? `⏱ ${formatDuration(meta.duration)}\n` : '';

    await ctx.telegram.editMessageText(
      chatId, 
      waitMsg.message_id, 
      undefined,
      `${PLATFORM_EMOJIS[platform]} detected!\n\n` +
      titleText + durationText +
      `🔗 <code>${text.substring(0, 50)}${text.length > 50 ? '...' : ''}</code>\n\n` +
      `Please choose the download quality:`,
      {
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: buttons }
      }
    );
  } catch (err) {
    await ctx.telegram.editMessageText(chatId, waitMsg.message_id, undefined, `❌ Could not fetch info. Please check the URL.`);
  }
});


bot.action(/^dl:(vid|aud):(.+):(.+)$/, async (ctx) => {
  await ctx.answerCbQuery();
  
  const type = ctx.match[1] === 'vid' ? 'video' : 'audio';
  const quality = ctx.match[2];
  const downloadId = ctx.match[3];
  const chatId = String(ctx.chat?.id);

  const download = await prisma.download.findUnique({ where: { id: downloadId } });
  
  if (!download) {
    return ctx.reply('⚠️ This download request has expired or was not found. Please send the link again.');
  }

  await prisma.download.update({
    where: { id: downloadId },
    data: { type, quality, status: 'pending' }
  });

  await ctx.editMessageText(
    `✅ Selection received, download added to queue!\n\n` +
    `🆔 ID: <code>${downloadId.substring(0, 8)}</code>\n` +
    `📥 Type: ${type === 'video' ? `🎬 Video (${quality})` : '🎵 Music'}\n\n` +
    `⏳ Starting...`,
    { parse_mode: 'HTML' }
  );

  
  await enqueueDownload({
    downloadId,
    url: download.url,
    type: type as any,
    quality,
    chatId
  });
});


bot.catch((err: any, ctx) => {
  logger.error('Bot error', { error: err.message, ctx: ctx.updateType });
});

export default bot;
