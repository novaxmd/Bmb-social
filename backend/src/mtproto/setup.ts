
import { TelegramClient, sessions } from 'telegram';
import * as readline from 'readline';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const { StringSession } = sessions;

const API_ID = parseInt(process.env.API_ID || '0');
const API_HASH = process.env.API_HASH || '';

function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => rl.question(question, ans => { rl.close(); resolve(ans); }));
}

async function main() {
  console.log('\n🔐 MTProto Session Setup for Bmbtech');
  console.log('=====================================');
  console.log('This only needs to be run ONCE on your VDS.');
  console.log('After this, sessions are stored in the database.\n');

  if (!API_ID || !API_HASH) {
    console.error('❌ API_ID or API_HASH not found in .env file!');
    process.exit(1);
  }

  const client = new TelegramClient(new StringSession(''), API_ID, API_HASH, {
    connectionRetries: 5
  });

  await client.start({
    phoneNumber: async () => await prompt('📱 Phone number (with country code, e.g. +905xxxxxxxxx): '),
    password: async () => await prompt('🔑 2FA Password (leave empty if none): '),
    phoneCode: async () => await prompt('📨 OTP code from Telegram: '),
    onError: (err) => console.error('Auth error:', err)
  });

  const sessionStr = (client.session as any).save() as string;

  
  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient();

  await prisma.mtprotoSession.deleteMany();
  await prisma.mtprotoSession.create({
    data: { sessionStr }
  });

  await prisma.$disconnect();

  console.log('\n✅ MTProto session saved to database successfully!');
  console.log('📁 Session string (backup): ', sessionStr.substring(0, 30) + '...');
  console.log('\nYou can now restart the backend service. 2GB file uploads are enabled!');

  await client.disconnect();
  process.exit(0);
}

main().catch(err => {
  console.error('Setup failed:', err);
  process.exit(1);
});
