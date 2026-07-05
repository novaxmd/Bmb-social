import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Toaster } from 'react-hot-toast';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap'
});

export const viewport: Viewport = {
  themeColor: '#4facfe',
};

export const metadata: Metadata = {
  metadataBase: new URL('https://download.bmntech.site'),
  title: 'Bmbtech — Social Media Video & Music Downloader',
  description: 'Download YouTube, Instagram, TikTok and Twitter (X) content in high quality, ad-free and fast. Bmbtech is the most advanced media downloading tool.',
  keywords: ['video download', 'youtube mp4 download', 'instagram reels download', 'tiktok no watermark download', 'twitter video download', 'bmbtech'],
  authors: [{ name: 'Bmb Social Media' }],
  manifest: '/manifest.json',
  icons: {
    icon: '/favicon.ico',
    apple: '/icons/icon-192x192.png'
  },
  openGraph: {
    title: 'Bmbtech — Professional Media Downloader',
    description: 'Instantly download videos and music from YouTube, Instagram, TikTok and Twitter.',
    url: 'https://download.bmntech.site',
    siteName: 'Bmbtech',
    images: [
      {
        url: '/icons/icon-512x512.png',
        width: 512,
        height: 512,
        alt: 'Bmbtech Logo'
      }
    ],
    locale: 'en_US',
    type: 'website'
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Bmbtech — Video & Music Downloader',
    description: 'Download from all social media platforms in seconds.',
    images: ['/icons/icon-512x512.png']
  }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body>
        {children}
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: 'rgba(26, 10, 46, 0.95)',
              color: '#e2e8f0',
              border: '1px solid rgba(79, 172, 254, 0.3)',
              backdropFilter: 'blur(20px)',
              borderRadius: '12px',
              fontSize: '14px'
            },
            success: {
              iconTheme: { primary: '#4ade80', secondary: '#1a0a2e' }
            },
            error: {
              iconTheme: { primary: '#f87171', secondary: '#1a0a2e' }
            }
          }}
        />
      </body>
    </html>
  );
}
