import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.cwd());
const postsPath = path.join(root, 'archive', 'posts.json');
const outDir = path.join(root, 'data');
const outPath = path.join(outDir, 'x-review-queue.json');

const DEFAULT_LIMIT = 25;
const limitArg = Number.parseInt(process.argv[2] ?? '', 10);
const limit = Number.isFinite(limitArg) && limitArg > 0 ? limitArg : DEFAULT_LIMIT;

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

function getImageUrl(post) {
  if (post['photo-url-500']) return post['photo-url-500'];
  if (Array.isArray(post.photos) && post.photos[0]) {
    return post.photos[0]['photo-url-500'] || post.photos[0]['photo-url-1280'] || null;
  }
  const player500 = post['video-player-500'] || '';
  const posterMatch = player500.match(/poster='([^']+)'/) || player500.match(/poster="([^"]+)"/);
  return posterMatch?.[1] || null;
}

function getCaption(post) {
  const raw = post['photo-caption'] || post['video-caption'] || '';
  return stripHtml(raw);
}

function getPostType(post) {
  if (post.type === 'photo') return 'image';
  if (post.type === 'video') return 'video-still';
  return post.type || 'unknown';
}

const raw = fs.readFileSync(postsPath, 'utf8');
const posts = JSON.parse(raw);

const candidates = posts
  .map((post) => {
    const caption = getCaption(post);
    const imageUrl = getImageUrl(post);
    if (!caption || !imageUrl) return null;

    return {
      id: post.id,
      sourceType: getPostType(post),
      postUrl: post.url,
      slug: post.slug || '',
      date: post.date,
      unixTimestamp: post['unix-timestamp'] || null,
      imageUrl,
      caption,
      captionLength: caption.length,
      noteCount: Number.parseInt(post['note-count'] || '0', 10) || 0,
      tags: Array.isArray(post.tags) ? post.tags : [],
      reviewStatus: 'pending',
      skipReason: null,
      approvedText: null,
      platformNotes: [],
    };
  })
  .filter(Boolean)
  .sort((a, b) => {
    if (b.noteCount !== a.noteCount) return b.noteCount - a.noteCount;
    return (b.unixTimestamp || 0) - (a.unixTimestamp || 0);
  })
  .slice(0, limit)
  .map((item, index) => ({ order: index + 1, ...item }));

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(
  outPath,
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      source: 'archive/posts.json',
      platform: 'x',
      totalCandidates: candidates.length,
      candidates,
    },
    null,
    2,
  ) + '\n',
  'utf8',
);

console.log(`Wrote ${candidates.length} X review candidates to ${path.relative(root, outPath)}`);
