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

const dataDir = path.join(process.cwd(), '..', 'data');
const reviewPath = path.join(dataDir, 'x-review-queue.json');
const statePath = path.join(dataDir, 'x-queue-state.json');

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

export async function loadQueueState(): Promise<QueueStateFile> {
  try {
    const raw = await fs.readFile(statePath, 'utf8');
    return JSON.parse(raw) as QueueStateFile;
  } catch {
    const candidates = await readReviewCandidates();
    const initial: QueueStateFile = {
      generatedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      items: candidates.map((item) => ({ ...item, reviewStatus: 'inbox' })),
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
  const updated: QueueStateFile = { ...state, updatedAt: new Date().toISOString(), items: next };
  await saveQueueState(updated);
}

export function groupQueueItems(items: QueueItem[]) {
  return {
    inbox: items.filter((item) => item.reviewStatus === 'inbox'),
    approved: items.filter((item) => item.reviewStatus === 'approved'),
    posted: items.filter((item) => item.reviewStatus === 'posted'),
    rejected: items.filter((item) => item.reviewStatus === 'rejected'),
  };
}
