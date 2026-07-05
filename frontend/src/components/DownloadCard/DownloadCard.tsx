'use client';
import { forwardRef, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';
import axios from 'axios';
import toast from 'react-hot-toast';
import styles from './DownloadCard.module.css';

export interface Download {

  id: string;
  url: string;
  platform: string;
  type: string;
  status: string;
  progress: number;
  fileSize?: number | null;
  fileName?: string | null;
  title?: string | null;
  duration?: number | null;
  chatId?: string | null;
  parts?: number;
  sentParts?: number;
  errorMsg?: string | null;
  createdAt: string;
  updatedAt: string;
}

const PLATFORM_EMOJIS: Record<string, string> = {
  youtube: '🎬',
  instagram: '📸',
  tiktok: '🎵',
  twitter: '🐦',
  unknown: '🌐'
};

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  downloading: 'Downloading',
  sending: 'Sending',
  done: 'Completed',
  error: 'Error',
  cancelled: 'Cancelled'
};

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024).toFixed(0)} KB`;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

interface DownloadCardProps {
  download: Download;
  onDelete?: (id: string) => void;
}

const DownloadCard = forwardRef<HTMLDivElement, DownloadCardProps>(({ download, onDelete }, ref) => {
  const isActive = ['pending', 'downloading', 'sending'].includes(download.status);
  
  
  const progressPct = download.status === 'done' ? 100 : (download.progress || 0);

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('Delete this download record and its files?')) return;
    
    try {
      const API = process.env.NEXT_PUBLIC_API_URL || '';
      await axios.delete(`${API}/api/download/${download.id}`);
      toast.success('Record deleted');
      if (onDelete) onDelete(download.id);
    } catch (err) {
      toast.error('Delete operation failed');
    }
  };

  return (
    <motion.div
      ref={ref}
      layout
      initial={{ opacity: 0, y: 20, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.3 }}
      className={`glass-card ${styles.card}`}
    >
      {}
      <button className={styles.deleteBtn} onClick={handleDelete} title="Delete record">
        ✕
      </button>

      {}
      <div className={styles.header}>
        <div className={styles.platformInfo}>
          <span className={styles.platformEmoji}>
            {PLATFORM_EMOJIS[download.platform] || '🌐'}
          </span>
          <div>
            <p className={styles.title}>
              {download.title || download.fileName || 'Download'}
            </p>
            <p className={styles.url}>{download.url.substring(0, 50)}...</p>
          </div>
        </div>
        <div className={styles.badges}>
          <span className={`badge badge-${download.platform}`}>
            {download.platform}
          </span>
          <span className={`badge badge-${download.status}`}>
            {isActive && <span className={styles.activeDot} />}
            {STATUS_LABELS[download.status] || download.status}
          </span>
          {download.type === 'audio' && (
            <span className="badge" style={{ background: 'rgba(168,85,247,0.15)', color: '#a855f7', border: '1px solid rgba(168,85,247,0.2)' }}>
              🎵 MP3
            </span>
          )}
        </div>
      </div>

      {}
      {(isActive || download.status === 'done') && (
        <div className={styles.progressSection}>
          <div className="progress-bar">
            <motion.div
              className="progress-fill"
              initial={{ width: 0 }}
              animate={{ width: `${progressPct}%` }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
            />
          </div>
          <span className={styles.progressText}>
            {download.status === 'sending' && download.parts && download.parts > 1
              ? `Sending part ${download.sentParts || 0}/${download.parts}...`
              : `${progressPct.toFixed(0)}%`
            }
          </span>
        </div>
      )}

      {}
      {download.status === 'error' && download.errorMsg && (
        <div className={styles.errorBox}>
          ⚠️ {download.errorMsg}
        </div>
      )}

      {}
      <div className={styles.footer}>
        <div className={styles.meta}>
          {download.fileSize && (
            <span className={styles.metaItem}>💾 {formatBytes(download.fileSize)}</span>
          )}
          {download.duration && (
            <span className={styles.metaItem}>⏱ {formatDuration(download.duration)}</span>
          )}
        </div>
        
        {}
        {download.status === 'done' && !download.chatId && (
          <a
            href={`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/download/${download.id}/file`}
            download
            className={styles.directDownloadBtn}
            target="_blank"
            rel="noopener noreferrer"
          >
            ⬇️ Download File
          </a>
        )}
      </div>
    </motion.div>
  );
});

DownloadCard.displayName = 'DownloadCard';

export default DownloadCard;
