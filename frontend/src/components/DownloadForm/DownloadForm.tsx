'use client';
import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import toast from 'react-hot-toast';
import styles from './DownloadForm.module.css';
import { detectPlatformClient } from '@/lib/utils';

interface FormState {
  url: string;
  type: 'video' | 'audio';
  quality: string;
}

interface MetadataResult {
  title?: string;
  duration?: number;
  thumbnail?: string;
  platform?: string;
}

interface DownloadFormProps {
  onDownloadStarted: (id: string) => void;
}

const PLATFORM_INFO: Record<string, { label: string; color: string; emoji: string }> = {
  youtube: { label: 'YouTube', color: '#ff0000', emoji: '🎬' },
  instagram: { label: 'Instagram', color: '#e1306c', emoji: '📸' },
  tiktok: { label: 'TikTok', color: '#69C9D0', emoji: '🎵' },
  twitter: { label: 'Twitter/X', color: '#1DA1F2', emoji: '🐦' },
  unknown: { label: 'Unknown', color: '#64748b', emoji: '🌐' }
};

function formatDuration(seconds: number): string {
  if (!seconds) return '';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function DownloadForm({ onDownloadStarted }: DownloadFormProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [form, setForm] = useState<FormState>({ url: '', type: 'video', quality: 'best' });
  const [detectedPlatform, setDetectedPlatform] = useState<string>('');
  const [metadata, setMetadata] = useState<MetadataResult | null>(null);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  
  useEffect(() => {
    if (step === 1) {
      const p = detectPlatformClient(form.url);
      setDetectedPlatform(p);
      if (p !== 'youtube' && form.type === 'audio') {
        setForm(f => ({ ...f, type: 'video' }));
      }
    }
  }, [form.url, form.type, step]);

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text.startsWith('http')) {
        setForm(f => ({ ...f, url: text.trim() }));
      }
    } catch {}
  };

  const handleFetchMetadata = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.url.trim()) return;

    setLoading(true);
    try {
      const API = process.env.NEXT_PUBLIC_API_URL || '';
      const res = await axios.post(`${API}/api/metadata`, { url: form.url.trim() });
      setMetadata(res.data);
      setStep(2);
    } catch (err: any) {
      const msg = err.response?.data?.error || 'Could not fetch info, please check the link.';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    setLoading(true);
    try {
      const API = process.env.NEXT_PUBLIC_API_URL || '';
      const res = await axios.post(`${API}/api/download`, {
        url: form.url.trim(),
        type: form.type,
        quality: form.quality
      });

      toast.success('Download added to queue! 🚀');
      onDownloadStarted(res.data.downloadId);
      
      
      setStep(1);
      setForm(f => ({ ...f, url: '' }));
      setDetectedPlatform('');
      setMetadata(null);
    } catch (err: any) {
      const msg = err.response?.data?.error || 'An error occurred';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const platform = PLATFORM_INFO[detectedPlatform] || null;

  return (
    <div className={styles.formContainer}>
      <AnimatePresence mode="wait">
        {step === 1 && (
          <motion.form 
            key="step1"
            onSubmit={handleFetchMetadata} 
            className={styles.form}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
          >
            {}
            <div className={styles.inputGroup}>
              <div className={styles.inputWrapper}>
                <input
                  ref={inputRef}
                  type="url"
                  value={form.url}
                  onChange={e => setForm(f => ({ ...f, url: e.target.value }))}
                  placeholder="Paste a YouTube, Instagram, TikTok or Twitter URL..."
                  className={`input ${styles.urlInput}`}
                  id="url-input"
                  autoComplete="off"
                  spellCheck={false}
                />
                <button type="button" onClick={handlePaste} className={styles.pasteBtn} title="Paste from clipboard">
                  📋
                </button>
              </div>

              {}
              <AnimatePresence>
                {platform && detectedPlatform !== 'unknown' && form.url && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8, x: -10 }}
                    animate={{ opacity: 1, scale: 1, x: 0 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    className={styles.platformBadge}
                    style={{ '--platform-color': platform.color } as any}
                  >
                    {platform.emoji} {platform.label} detected
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {}
            <motion.button
              type="submit"
              className={`btn btn-primary ${styles.submitBtn}`}
              disabled={loading || !form.url || detectedPlatform === 'unknown'}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              {loading ? (
                <>
                  <span className={styles.spinner} />
                  Searching...
                </>
              ) : (
                <>🔍 Find & Continue</>
              )}
            </motion.button>
          </motion.form>
        )}

        {step === 2 && metadata && (
          <motion.div
            key="step2"
            className={styles.step2Container}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.2 }}
          >
            {}
            <div className={styles.metadataCard}>
              {metadata.thumbnail ? (
                
                <img 
                  src={metadata.thumbnail} 
                  alt="Thumbnail" 
                  className={styles.thumbnail} 
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className={styles.thumbnailPlaceholder}>🎥</div>
              )}
              <div className={styles.metadataInfo}>
                <h3 className={styles.metadataTitle} title={metadata.title || form.url}>
                  {metadata.title || form.url}
                </h3>
                <div className={styles.metadataRow}>
                  <span className={styles.metadataPlatform}>
                    {platform?.emoji} {platform?.label}
                  </span>
                  {metadata.duration ? (
                    <span className={styles.metadataDuration}>⏱ {formatDuration(metadata.duration)}</span>
                  ) : null}
                </div>
              </div>
            </div>

            {}
            <div className={styles.optionsRow}>
              {}
              <div className={styles.typeSelector}>
                <button
                  type="button"
                  className={`${styles.typeBtn} ${form.type === 'video' ? styles.active : ''}`}
                  onClick={() => setForm(f => ({ ...f, type: 'video' }))}
                >
                  🎬 Video
                </button>
                <button
                  type="button"
                  className={`${styles.typeBtn} ${form.type === 'audio' ? styles.active : ''} ${detectedPlatform !== 'youtube' ? styles.disabled : ''}`}
                  onClick={() => detectedPlatform === 'youtube' && setForm(f => ({ ...f, type: 'audio' }))}
                  title={detectedPlatform !== 'youtube' ? 'YouTube only' : ''}
                >
                  🎵 Music
                </button>
              </div>

              {}
              <select
                value={form.quality}
                onChange={e => setForm(f => ({ ...f, quality: e.target.value }))}
                className={`input ${styles.qualitySelect}`}
                disabled={form.type === 'audio'}
              >
                <option value="best">🏆 Best Quality</option>
                <option value="1080p">📺 1080p</option>
                <option value="720p">📱 720p</option>
                <option value="480p">📡 480p</option>
              </select>
            </div>

            {}
            <div className={styles.actionsRow}>
              <button 
                type="button" 
                className={`btn ${styles.backBtn}`}
                onClick={() => setStep(1)}
                disabled={loading}
              >
                Go Back
              </button>
              <motion.button
                type="button"
                className={`btn btn-primary ${styles.downloadActionBtn}`}
                onClick={handleDownload}
                disabled={loading}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                {loading ? (
                  <>
                    <span className={styles.spinner} />
                    Starting...
                  </>
                ) : (
                  <>⚡ Start Download</>
                )}
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
