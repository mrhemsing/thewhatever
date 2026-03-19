import fs from 'node:fs/promises';
import path from 'node:path';

export type QueueStatus = 'inbox' | 'approved' | 'posted' | 'rejected';

export type QueueItem = {
  order: number;
  id: string;
  sourceType: string;
  postUrl: string;
  slug: string;
  date: string;
  unixTimestamp: number | null;
  imageUrl: string;
  caption: string;
  captionLength: number;
  noteCount: number;
  tags: string[];
  reviewStatus: QueueStatus;
  skipReason: string | null;
  approvedText: string | null;
  platformNotes: string[];
  importedAt?: string;
  updatedAt?: string;
};

type ReviewQueueFile = {
  candidates: QueueItem[];
};

type QueueStateFile = {
  generatedAt: string;
  updatedAt: string;
  items: QueueItem[];
};

type TumblrPost = {
  id: string | number;
  type?: string;
  url?: string;
  slug?: string;
  date?: string;
  tags?: string[];
  photos?: Array<Record<string, string>>;
  ['unix-timestamp']?: number;
  ['note-count']?: string | number;
  ['photo-caption']?: string;
  ['video-caption']?: string;
  ['photo-url-500']?: string;
  ['video-player-500']?: string;
};

const dataDir = path.join(process.cwd(), '..', 'data');
const reviewPath = path.join(dataDir, 'x-review-queue.json');
const statePath = path.join(dataDir, 'x-queue-state.json');
const archivePath = path.join(process.cwd(), '..', 'archive', 'posts.json');

function stripHtml(html = '') {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/blockquote>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/�/g, "'")
    .replace(/\r/g, '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n')
    .trim();
}

function getImageUrl(post: TumblrPost) {
  if (post['photo-url-500']) return post['photo-url-500'];
  if (Array.isArray(post.photos) && post.photos[0]) {
    return post.photos[0]['photo-url-500'] || post.photos[0]['photo-url-1280'] || null;
  }
  const player500 = post['video-player-500'] || '';
  const posterMatch = player500.match(/poster='([^']+)'/) || player500.match(/poster="([^"]+)"/);
  return posterMatch?.[1] || null;
}

function getCaption(post: TumblrPost) {
  const raw = post['photo-caption'] || post['video-caption'] || '';
  return stripHtml(raw);
}

function getSourceType(post: TumblrPost) {
  if (post.type === 'photo') return 'image';
  if (post.type === 'video') return 'video-still';
  return post.type || 'unknown';
}

async function readArchiveCandidates(): Promise<QueueItem[]> {
  const raw = await fs.readFile(archivePath, 'utf8');
  const posts = JSON.parse(raw) as TumblrPost[];
  return posts
    .map((post) => {
      const caption = getCaption(post);
      const imageUrl = getImageUrl(post);
      if (!caption || !imageUrl || !post.url || !post.date) return null;
      return {
        order: 0,
        id: String(post.id),
        sourceType: getSourceType(post),
        postUrl: post.url,
        slug: post.slug || '',
        date: post.date,
        unixTimestamp: post['unix-timestamp'] || null,
        imageUrl,
        caption,
        captionLength: caption.length,
        noteCount: Number.parseInt(String(post['note-count'] || '0'), 10) || 0,
        tags: Array.isArray(post.tags) ? post.tags : [],
        reviewStatus: 'inbox' as QueueStatus,
        skipReason: null,
        approvedText: null,
        platformNotes: [],
        importedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } satisfies QueueItem;
    })
    .filter(Boolean) as QueueItem[];
}

async function readReviewCandidates(): Promise<QueueItem[]> {
  const raw = await fs.readFile(reviewPath, 'utf8');
  const parsed = JSON.parse(raw) as ReviewQueueFile;
  return (parsed.candidates ?? []).map((item) => ({
    ...item,
    reviewStatus: (item.reviewStatus as QueueStatus) || 'inbox',
    importedAt: item.importedAt || new Date().toISOString(),
    updatedAt: item.updatedAt || new Date().toISOString(),
  }));
}

function sortAndRenumber(items: QueueItem[]) {
  return items
    .slice()
    .sort((a, b) => {
      if ((b.noteCount || 0) !== (a.noteCount || 0)) return (b.noteCount || 0) - (a.noteCount || 0);
      return (b.unixTimestamp || 0) - (a.unixTimestamp || 0);
    })
    .map((item, index) => ({ ...item, order: index + 1 }));
}

export async function loadQueueState(): Promise<QueueStateFile> {
  try {
    const raw = await fs.readFile(statePath, 'utf8');
    return JSON.parse(raw) as QueueStateFile;
  } catch {
    const candidates = await readReviewCandidates();
    const initial: QueueStateFile = {
      generatedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      items: sortAndRenumber(candidates.map((item) => ({ ...item, reviewStatus: 'inbox' }))),
    };
    await saveQueueState(initial);
    return initial;
  }
}

export async function saveQueueState(state: QueueStateFile) {
  await fs.mkdir(dataDir, { recursive: true });
  await fs.writeFile(statePath, JSON.stringify(state, null, 2) + '\n', 'utf8');
}

export async function moveQueueItem(id: string, reviewStatus: QueueStatus) {
  const state = await loadQueueState();
  const next = state.items.map((item) =>
    String(item.id) === String(id)
      ? { ...item, reviewStatus, updatedAt: new Date().toISOString() }
      : item,
  );
  const updated: QueueStateFile = {
    ...state,
    updatedAt: new Date().toISOString(),
    items: sortAndRenumber(next),
  };
  await saveQueueState(updated);
}

export async function refreshQueueFromArchive() {
  const state = await loadQueueState();
  const archiveItems = await readArchiveCandidates();
  const existingIds = new Set(state.items.map((item) => String(item.id)));
  const newItems = archiveItems
    .filter((item) => !existingIds.has(String(item.id)))
    .map((item) => ({ ...item, reviewStatus: 'inbox' as QueueStatus, importedAt: new Date().toISOString(), updatedAt: new Date().toISOString() }));

  const updated: QueueStateFile = {
    ...state,
    updatedAt: new Date().toISOString(),
    items: sortAndRenumber([...state.items, ...newItems]),
  };
  await saveQueueState(updated);
  return { added: newItems.length, total: updated.items.length };
}

export function groupQueueItems(items: QueueItem[]) {
  return {
    inbox: items.filter((item) => item.reviewStatus === 'inbox'),
    approved: items.filter((item) => item.reviewStatus === 'approved'),
    posted: items.filter((item) => item.reviewStatus === 'posted'),
    rejected: items.filter((item) => item.reviewStatus === 'rejected'),
  };
}
