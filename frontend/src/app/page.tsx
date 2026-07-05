'use client';
import { useState } from 'react';
import { motion } from 'framer-motion';
import DownloadForm from '@/components/DownloadForm/DownloadForm';
import LiveFeed from '@/components/LiveFeed/LiveFeed';
import styles from './page.module.css';

export default function Home() {
  const [newDownloadId, setNewDownloadId] = useState<string | null>(null);

  return (
    <main className={styles.main}>
      {}
      <section className={styles.hero}>
        <div className="container">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className={styles.heroContent}
          >
            <div className={styles.badge_wrapper}>
              <span className={styles.badge}>
                <span className={styles.pulse_dot}></span>
                v1.0 Live
              </span>
            </div>
            
            <h1 className={styles.title}>
              The Limitless <br/>
              <span className="gradient-text">Video Downloader</span>
            </h1>
            
            <p className={styles.description}>
              Works in sync with Telegram. Download Instagram Reels, TikTok, YouTube and X videos without quality loss, <strong>straight to Telegram with one click.</strong> Bypass the 2GB limit.
            </p>
          </motion.div>
        </div>
      </section>

      {}
      <section className={styles.actionSection}>
        <div className="container">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            className={styles.formCard}
          >
            <div className={styles.cardHeader}>
              <div className={styles.icons}>
                <span>🎬</span><span>📸</span><span>🎵</span><span>🐦</span>
              </div>
              <h2>Paste Your Link</h2>
            </div>
            
            <DownloadForm onDownloadStarted={setNewDownloadId} />
          </motion.div>
        </div>
      </section>

      {}
      <section className={styles.feedSection}>
        <div className="container">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <LiveFeed newDownloadId={newDownloadId} />
          </motion.div>
        </div>
      </section>

      {}
      <footer className={styles.footer}>
        <p>Developed by <a href="https://download.bmntech.site" target="_blank" rel="noopener noreferrer">Bmb Social Media</a> &bull; Bmbtech</p>
      </footer>
    </main>
  );
}
