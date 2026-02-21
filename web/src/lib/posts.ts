import fs from 'node:fs/promises';
import path from 'node:path';

export type TumblrPost = {
  id: string;
  url: string;
  type?: string;
  date?: string;
  tags?: string[];
  'unix-timestamp'?: number;
  'note-count'?: number;
  photos?: any[];
  'photo-url-1280'?: string;
  'photo-url-500'?: string;
  'photo-url-400'?: string;
  'photo-url-250'?: string;
  'regular-title'?: string;
  'regular-body'?: string;
  'photo-caption'?: string;
  'video-caption'?: string;
  'audio-caption'?: string;
  'link-description'?: string;
  'video-player-500'?: string;
  'video-player'?: string;
  'quote-source'?: string;
  'conversation-text'?: string;
  answer?: string;
  body?: string;
};

let cache: TumblrPost[] | null = null;
const PINNED_FIRST_POST_ID = '132885927778';
const HIDDEN_POST_IDS = new Set<string>([
  '21941351864',
  '131207074',
  '130989012',
  '133427163968',
  '133425401353',
  '129054910713',
  '48962062332',
  '55745608283',
  '90855799348',
  '70612824485',
]);

export async function getAllPosts(): Promise<TumblrPost[]> {
  if (cache) return cache;
  const p = path.resolve(process.cwd(), '..', 'archive', 'posts.json');
  const raw = await fs.readFile(p, 'utf8');
  const parsed0: TumblrPost[] = JSON.parse(raw) || [];
  const parsed: TumblrPost[] = parsed0.filter((p) => !HIDDEN_POST_IDS.has(String(p.id)));

  // After the domain cutover to Vercel, many exported `url` values still point at
  // `www.thewhatever.com`. Normalize original post URLs back to Tumblr.
  for (const post of parsed) {
    if (typeof post.url === 'string') {
      post.url = post.url.replace(/^https?:\/\/(www\.)?thewhatever\.com\b/i, 'https://thewhatever.tumblr.com');
    }
  }

  const idx = parsed.findIndex((post) => String(post.id) === PINNED_FIRST_POST_ID);
  if (idx > 0) {
    const [pinned] = parsed.splice(idx, 1);
    parsed.unshift(pinned);
  }

  const first = parsed[0];
  if (first && String(first.id) === PINNED_FIRST_POST_ID) {
    first.date = 'Tue, 18 Nov 2015 12:34:35';
  }

  cache = parsed;
  return cache;
}

export function perPage() {
  return 150;
}

export function pageCount(total: number) {
  return Math.max(1, Math.ceil(total / perPage()));
}

export function pageSlice(posts: TumblrPost[], page: number) {
  const p = Math.max(1, page);
  const start = (p - 1) * perPage();
  return posts.slice(start, start + perPage());
}

export function captionFor(post: TumblrPost) {
  const parts: string[] = [];
  if (post['regular-title']) parts.push(`<h2>${post['regular-title']}</h2>`);
  const candidates = [
    post['regular-body'],
    post['photo-caption'],
    post['video-caption'],
    post['audio-caption'],
    post['link-description'],
    post['quote-source'],
    post['conversation-text'],
    post['answer'],
    post['body'],
  ].filter(Boolean);
  if (candidates.length) parts.push(String(candidates[0]));
  return parts.join('\n') || '<p>(no caption)</p>';
}

export function mediaFor(post: TumblrPost) {
  const out: string[] = [];
  if (Array.isArray(post.photos) && post.photos.length) {
    for (const p of post.photos) {
      const url = p['photo-url-1280'] || p['photo-url-500'] || p['photo-url-400'] || p['photo-url-250'];
      if (url) out.push(`<img src="${url}" loading="lazy" alt="" />`);
    }
  } else {
    const url = post['photo-url-1280'] || post['photo-url-500'] || post['photo-url-400'] || post['photo-url-250'];
    if (url) out.push(`<img src="${url}" loading="lazy" alt="" />`);
  }
  return out.join('\n');
}

export function thumbFor(post: TumblrPost) {
  if (Array.isArray(post.photos) && post.photos.length) {
    const p = post.photos[0];
    return p['photo-url-250'] || p['photo-url-400'] || p['photo-url-500'] || p['photo-url-1280'] || null;
  }
  return post['photo-url-250'] || post['photo-url-400'] || post['photo-url-500'] || post['photo-url-1280'] || null;
}

export function firstLastDate(posts: TumblrPost[]) {
  if (!posts.length) return { first: 'Unknown', last: 'Unknown' };
  const sorted = [...posts].sort((a, b) => Number(a['unix-timestamp'] || 0) - Number(b['unix-timestamp'] || 0));
  const fmt = (p: TumblrPost) => new Date(Number(p['unix-timestamp'] || 0) * 1000).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  return { first: fmt(sorted[0]), last: fmt(sorted[sorted.length - 1]) };
}
