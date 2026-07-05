import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { EventEmitter } from 'events';
import logger from '../utils/logger';

export type Platform = 'youtube' | 'instagram' | 'tiktok' | 'twitter' | 'unknown';
export type DownloadType = 'video' | 'audio';

export interface DownloadOptions {
  url: string;
  type: DownloadType;
  quality?: string;
  downloadId: string;
}

export interface DownloadResult {
  filePath: string;
  fileName: string;
  fileSize: number;
  title?: string;
  duration?: number;
  thumbnail?: string;
}

export interface DownloadProgress {
  percent: number;
  speed?: string;
  eta?: string;
  size?: string;
}

export function detectPlatform(url: string): Platform {
  if (/youtube\.com|youtu\.be/.test(url)) return 'youtube';
  if (/instagram\.com/.test(url)) return 'instagram';
  if (/tiktok\.com/.test(url)) return 'tiktok';
  if (/twitter\.com|x\.com/.test(url)) return 'twitter';
  return 'unknown';
}

export function isValidUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return ['http:', 'https:'].includes(u.protocol);
  } catch {
    return false;
  }
}

export class Downloader extends EventEmitter {
  private tempDir: string;

  constructor() {
    super();
    this.tempDir = process.env.TEMP_DIR || path.join(os.tmpdir(), 'bmbtech');
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
  }

  async download(options: DownloadOptions): Promise<DownloadResult> {
    const { url, type, quality = 'best', downloadId } = options;
    const outputDir = path.join(this.tempDir, downloadId);
    fs.mkdirSync(outputDir, { recursive: true });

    const outputTemplate = path.join(outputDir, '%(title)s.%(ext)s');
    const args = this.buildArgs(url, type, quality, outputTemplate);

    logger.info('Starting download', { url, type, quality, downloadId, command: 'yt-dlp', args });

    return new Promise((resolve, reject) => {
      let lastProgress = 0;
      let metaTitle = '';
      let metaDuration = 0;
      let metaThumbnail = '';
      let stderrBuffer = '';

      const proc = spawn('yt-dlp', args, { stdio: ['pipe', 'pipe', 'pipe'] });

      proc.stdout.on('data', (data: Buffer) => {
        const line = data.toString();
        
        
        const progressMatch = line.match(/\[download\]\s+([\d.]+)%\s+of\s+([\d.]+\w+)\s+at\s+([\d.]+\w+\/s)\s+ETA\s+([\d:]+)/);
        if (progressMatch) {
          const percent = parseFloat(progressMatch[1]);
          if (percent !== lastProgress) {
            lastProgress = percent;
            const progress: DownloadProgress = {
              percent,
              size: progressMatch[2],
              speed: progressMatch[3],
              eta: progressMatch[4]
            };
            this.emit('progress', downloadId, progress);
          }
        }

        
        if (line.includes('[info]')) {
          const titleMatch = line.match(/: (.+)$/);
          if (titleMatch) metaTitle = titleMatch[1].trim();
        }
      });

      proc.stderr.on('data', (data: Buffer) => {
        const line = data.toString();
        stderrBuffer += line;
        logger.debug('yt-dlp stderr', { line: line.trim() });
      });

      proc.on('close', (code) => {
        if (code !== 0) {
          this.cleanupDir(outputDir);
          
          const lines = stderrBuffer.split('\n');
          const cleanError = lines
            .filter(l => l.includes('ERROR:') || l.includes('WARNING:') || l.includes('SyntaxError:'))
            .map(l => l.replace(/ERROR: \[.*?\] /i, ''))
            .join(' ')
            .trim() || lines.pop()?.trim() || `yt-dlp exited with code ${code}`;
          
          return reject(new Error(cleanError));
        }

        
        const files = fs.readdirSync(outputDir);
        if (files.length === 0) {
          return reject(new Error('No file was downloaded'));
        }

        const filePath = path.join(outputDir, files[0]);
        const stats = fs.statSync(filePath);
        const fileName = files[0];

        
        this.getMetadata(url).then(meta => {
          resolve({
            filePath,
            fileName,
            fileSize: stats.size,
            title: meta?.title || metaTitle || fileName,
            duration: meta?.duration || metaDuration,
            thumbnail: meta?.thumbnail || metaThumbnail
          });
        }).catch(() => {
          resolve({
            filePath,
            fileName,
            fileSize: stats.size,
            title: metaTitle || fileName,
            duration: metaDuration,
            thumbnail: metaThumbnail
          });
        });
      });

      proc.on('error', (err) => {
        this.cleanupDir(outputDir);
        reject(new Error(`Failed to spawn yt-dlp: ${err.message}. Make sure yt-dlp is installed.`));
      });
    });
  }

  private buildArgs(url: string, type: DownloadType, quality: string, outputTemplate: string): string[] {
    const args: string[] = [
      '--no-playlist',
      '--no-warnings',
      '--progress',
      '-o', outputTemplate,
      '--merge-output-format', 'mp4',
    ];

    
    const cookiesPath = path.join(process.cwd(), 'cookies', 'cookies.txt');
    if (fs.existsSync(cookiesPath)) {
      args.push('--cookies', cookiesPath);
    }

    
    const platform = detectPlatform(url);

    if (type === 'audio') {
      args.push(
        '-x',
        '--audio-format', 'mp3',
        '--audio-quality', '0'
      );
    } else {
      
      
      if (platform === 'youtube') {
        if (quality === 'best' || quality === '1080p') {
          args.push('-f', 'bestvideo[vcodec^=avc][ext=mp4]+bestaudio[ext=m4a]/bestvideo[ext=mp4]+bestaudio[ext=m4a]/bestvideo+bestaudio/best');
        } else if (quality === '720p') {
          args.push('-f', 'bestvideo[vcodec^=avc][height<=720][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<=720][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<=720]+bestaudio/best[height<=720]/best');
        } else if (quality === '480p') {
          args.push('-f', 'bestvideo[vcodec^=avc][height<=480][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<=480][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<=480]+bestaudio/best[height<=480]/best');
        } else {
          args.push('-f', 'bestvideo[vcodec^=avc][ext=mp4]+bestaudio[ext=m4a]/bestvideo+bestaudio/best');
        }
      } else {
        
        
        args.push('-f', 'bestvideo+bestaudio/best');
      }
    }

    
    const ffmpegPath = process.env.FFMPEG_PATH;
    if (ffmpegPath) {
      args.push('--ffmpeg-location', ffmpegPath);
    }

    
    if (platform === 'instagram' || platform === 'tiktok') {
      args.push(
        '--extractor-retries', '5', 
        '--sleep-requests', '1', 
        '--sleep-interval', '1', 
        '--max-sleep-interval', '3',
        '--user-agent', 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
        '--add-header', 'Referer:https://www.instagram.com/',
        '--add-header', 'Accept-Language:tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7'
      );
    } else if (platform === 'youtube') {
      
      args.push('--sleep-requests', '1', '--sleep-interval', '1', '--max-sleep-interval', '3');
    }

    args.push(url);
    return args;
  }

  async getMetadata(url: string): Promise<{ title?: string; duration?: number; thumbnail?: string } | null> {
    return new Promise((resolve) => {
      const proc = spawn('yt-dlp', [
        '--dump-json',
        '--no-playlist',
        '--no-warnings',
        url
      ]);

      let output = '';
      proc.stdout.on('data', (d: Buffer) => { output += d.toString(); });
      proc.on('close', (code) => {
        if (code !== 0 || !output.trim()) return resolve(null);
        try {
          const meta = JSON.parse(output.trim().split('\n')[0]);
          resolve({
            title: meta.title,
            duration: meta.duration,
            thumbnail: meta.thumbnail
          });
        } catch {
          resolve(null);
        }
      });
      proc.on('error', () => resolve(null));
    });
  }

  cleanupDir(dir: string): void {
    try {
      if (fs.existsSync(dir)) {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    } catch (e) {
      logger.warn('Failed to cleanup directory', { dir, error: e });
    }
  }

  cleanupFile(filePath: string): void {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        
        const dir = path.dirname(filePath);
        const files = fs.readdirSync(dir);
        if (files.length === 0) {
          fs.rmdirSync(dir);
        }
      }
    } catch (e) {
      logger.warn('Failed to cleanup file', { filePath, error: e });
    }
  }
}

export const downloader = new Downloader();
