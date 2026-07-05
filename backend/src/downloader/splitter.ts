import * as fs from 'fs';
import * as path from 'path';
import { execSync, spawn } from 'child_process';
import logger from '../utils/logger';

const MAX_PART_SIZE = 1.9 * 1024 * 1024 * 1024; 

export interface SplitResult {
  parts: string[];
  partCount: number;
  outputDir: string;
}


export function needsSplit(filePath: string): boolean {
  const stats = fs.statSync(filePath);
  return stats.size > 2 * 1024 * 1024 * 1024;
}


export async function splitFile(filePath: string): Promise<SplitResult> {
  const dir = path.dirname(filePath);
  const ext = path.extname(filePath);
  const baseName = path.basename(filePath, ext);
  const outputDir = path.join(dir, `${baseName}_parts`);

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  
  const totalSize = fs.statSync(filePath).size;
  const numParts = Math.ceil(totalSize / MAX_PART_SIZE);

  
  const duration = await getVideoDuration(filePath);
  const secondsPerPart = Math.floor(duration / numParts);

  logger.info('Splitting file', { filePath, totalSize, numParts, duration, secondsPerPart });

  const outputPattern = path.join(outputDir, `part_%03d${ext}`);

  return new Promise((resolve, reject) => {
    const args = [
      '-i', filePath,
      '-c', 'copy',
      '-f', 'segment',
      '-segment_time', String(secondsPerPart),
      '-reset_timestamps', '1',
      '-avoid_negative_ts', 'make_zero',
      outputPattern
    ];

    const proc = spawn('ffmpeg', args, { stdio: ['pipe', 'pipe', 'pipe'] });

    proc.on('close', (code) => {
      if (code !== 0) {
        return reject(new Error(`ffmpeg split failed with code ${code}`));
      }

      const parts = fs.readdirSync(outputDir)
        .filter(f => f.startsWith('part_'))
        .sort()
        .map(f => path.join(outputDir, f));

      logger.info('File split complete', { parts: parts.length });
      resolve({ parts, partCount: parts.length, outputDir });
    });

    proc.on('error', (err) => {
      reject(new Error(`ffmpeg not found: ${err.message}. Install ffmpeg first.`));
    });
  });
}

async function getVideoDuration(filePath: string): Promise<number> {
  return new Promise((resolve) => {
    const proc = spawn('ffprobe', [
      '-v', 'quiet',
      '-print_format', 'json',
      '-show_format',
      filePath
    ]);

    let output = '';
    proc.stdout.on('data', (d: Buffer) => output += d.toString());
    proc.on('close', () => {
      try {
        const info = JSON.parse(output);
        resolve(parseFloat(info.format?.duration || '3600'));
      } catch {
        resolve(3600); 
      }
    });
    proc.on('error', () => resolve(3600));
  });
}

export function cleanupSplitDir(outputDir: string): void {
  try {
    if (fs.existsSync(outputDir)) {
      fs.rmSync(outputDir, { recursive: true, force: true });
    }
  } catch (e) {
    logger.warn('Failed to cleanup split dir', { outputDir });
  }
}
