'use client';
import { useEffect, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { AnimatePresence } from 'framer-motion';
import axios from 'axios';
import DownloadCard, { Download } from '../DownloadCard/DownloadCard';
import styles from './LiveFeed.module.css';

interface LiveFeedProps {
  newDownloadId?: string | null;
}

export default function LiveFeed({ newDownloadId }: LiveFeedProps) {
  const [downloads, setDownloads] = useState<Download[]>([]);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchDownloads = useCallback(async () => {
    try {
      const API = process.env.NEXT_PUBLIC_API_URL || '';
      const res = await axios.get(`${API}/api/downloads?limit=10`);
      setDownloads(res.data.data);
    } catch (err) {
      console.error('Failed to fetch downloads', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleClear = async () => {
    if (!window.confirm('This will delete all download history and files. Are you sure?')) return;
    
    try {
      const API = process.env.NEXT_PUBLIC_API_URL || '';
      await axios.delete(`${API}/api/downloads`);
      fetchDownloads();
    } catch (err) {
      console.error('Failed to clear history', err);
    }
  };

  useEffect(() => {
    fetchDownloads();
  }, [fetchDownloads]);

  useEffect(() => {
    if (newDownloadId) {
      setTimeout(() => fetchDownloads(), 1000); 
    }
  }, [newDownloadId, fetchDownloads]);

  useEffect(() => {
    const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3001';
    const s = io(WS_URL, { transports: ['websocket', 'polling'] });
    setSocket(s);

    s.on('connect', () => {
      console.log('Connected to WebSocket, refreshing pool...');
      fetchDownloads();
    });

    s.on('download:update', (data: any) => {
      setDownloads(prev => {
        const idx = prev.findIndex(d => d.id === data.downloadId);
        if (idx === -1) {
          
          fetchDownloads();
          return prev;
        }

        const updated = [...prev];
        updated[idx] = {
          ...updated[idx],
          status: data.status || updated[idx].status,
          progress: data.progress !== undefined ? data.progress : updated[idx].progress,
          parts: data.parts || updated[idx].parts,
          sentParts: data.part || updated[idx].sentParts,
          errorMsg: data.errorMsg || updated[idx].errorMsg,
          fileSize: data.fileSize || updated[idx].fileSize,
          fileName: data.fileName || updated[idx].fileName,
          title: data.title || updated[idx].title
        };
        return updated;
      });
    });

    return () => {
      s.disconnect();
    };
  }, [fetchDownloads]);

  if (loading) {
    return (
      <div className={styles.loading}>
        <div className={styles.spinner} />
        <p>Loading download history...</p>
      </div>
    );
  }

  if (downloads.length === 0) {
    return (
      <div className={styles.empty}>
        <div className={styles.emptyIcon}>📭</div>
        <p>No downloads yet.</p>
        <span>Paste a link above to get started!</span>
      </div>
    );
  }

  return (
    <div className={styles.feed}>
      <div className={styles.header}>
        <h3 className={styles.title}>
          <span className={styles.liveDot} />
          Live Downloads
        </h3>
        <div className={styles.headerActions}>
          <button className={styles.clearBtn} onClick={handleClear} title="Clear all completed history">
            🗑️ Clear History
          </button>
          <span className={styles.count}>{downloads.length} Records</span>
        </div>
      </div>

      <div className={styles.grid}>
        <AnimatePresence mode="popLayout">
          {downloads.map(d => (
            <DownloadCard 
              key={d.id} 
              download={d} 
              onDelete={(id) => setDownloads(prev => prev.filter(x => x.id !== id))}
            />
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
