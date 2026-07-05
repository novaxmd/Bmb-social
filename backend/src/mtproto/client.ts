import { TelegramClient, sessions } from 'telegram';
import { NewMessage, NewMessageEvent } from 'telegram/events';
import { Api } from 'telegram/tl';
import * as fs from 'fs';
import * as path from 'path';
import { prisma } from '../utils/prisma';
import logger from '../utils/logger';

const { StringSession } = sessions;

const API_ID = parseInt(process.env.API_ID || '0');
const API_HASH = process.env.API_HASH || '';

let client: TelegramClient | null = null;

export async function getMtprotoClient(): Promise<TelegramClient> {
  if (client && client.connected) {
    return client;
  }

  
  const sessionRecord = await prisma.mtprotoSession.findFirst({
    orderBy: { createdAt: 'desc' }
  });

  const sessionString = sessionRecord?.sessionStr || '';
  const stringSession = new StringSession(sessionString);

  client = new TelegramClient(stringSession, API_ID, API_HASH, {
    connectionRetries: 5,
    retryDelay: 1000,
    autoReconnect: true,
    baseLogger: {
      isEnabled: () => false,
      setLevel: () => {},
      canSend: () => false,
      log: () => {},
      info: () => {},
      warn: () => {},
      error: () => {},
      debug: () => {}
    } as any
  });

  if (!sessionRecord?.sessionStr) {
    logger.warn('No MTProto session found. Bot mode only (50MB limit) will be used for file sending.');
    logger.warn('Run: cd backend && npx ts-node src/mtproto/setup.ts to authenticate MTProto');
    return client;
  }

  try {
    await client.connect();
    logger.info('MTProto client connected successfully');
  } catch (err) {
    logger.error('MTProto connect failed', { error: err });
  }

  return client;
}

export async function sendFileViaMtproto(
  chatId: string | number,
  filePath: string,
  caption: string,
  onProgress?: (progress: number) => void
): Promise<void> {
  const mtClient = await getMtprotoClient();

  if (!mtClient.connected) {
    throw new Error('MTProto client not connected');
  }

  const fileSize = fs.statSync(filePath).size;
  const fileName = path.basename(filePath);
  logger.info('Sending file via MTProto', { chatId, fileName, fileSize });

  await mtClient.sendFile(chatId, {
    file: filePath,
    caption,
    progressCallback: (progress: number) => {
      const pct = Math.round(progress * 100);
      onProgress?.(pct);
    },
    forceDocument: false,
    attributes: []
  });

  logger.info('File sent via MTProto successfully', { chatId, fileName });
}

export async function sendFilePartsMtproto(
  chatId: string | number,
  parts: string[],
  baseCaption: string,
  onProgress?: (partIndex: number, progress: number) => void
): Promise<void> {
  for (let i = 0; i < parts.length; i++) {
    const partPath = parts[i];
    const caption = `${baseCaption}\n📦 Part ${i + 1}/${parts.length}`;
    await sendFileViaMtproto(chatId, partPath, caption, (pct) => {
      onProgress?.(i, pct);
    });
  }
}

export async function saveSession(sessionStr: string, phone?: string): Promise<void> {
  await prisma.mtprotoSession.deleteMany();
  await prisma.mtprotoSession.create({
    data: { sessionStr, phone }
  });
}

export async function isMtprotoAvailable(): Promise<boolean> {
  try {
    const session = await prisma.mtprotoSession.findFirst();
    return !!session?.sessionStr;
  } catch {
    return false;
  }
}
