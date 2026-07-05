export function detectPlatformClient(url: string): string {
  try {
    const u = new URL(url);
    if (u.hostname.includes('youtube.com') || u.hostname.includes('youtu.be')) return 'youtube';
    if (u.hostname.includes('instagram.com')) return 'instagram';
    if (u.hostname.includes('tiktok.com')) return 'tiktok';
    if (u.hostname.includes('twitter.com') || u.hostname.includes('x.com')) return 'twitter';
    return 'unknown';
  } catch {
    return '';
  }
}
