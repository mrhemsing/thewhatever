import fs from 'node:fs/promises';
import path from 'node:path';

const BLOG = 'https://www.thewhatever.com';
const API = `${BLOG}/api/read/json`;
const PAGE_SIZE = 50;
const OUT_DIR = path.resolve('archive');

function stripJsonp(raw) {
  const prefix = 'var tumblr_api_read = ';
  let s = raw.trim();
  if (s.startsWith(prefix)) s = s.slice(prefix.length);
  if (s.endsWith(';')) s = s.slice(0, -1);
  return JSON.parse(s);
}

async function fetchPage(start, num = PAGE_SIZE) {
  const url = `${API}?start=${start}&num=${num}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed ${url}: ${res.status}`);
  const raw = await res.text();
  return stripJsonp(raw);
}

function captionFor(post) {
  const parts = [];
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
    post['body']
  ].filter(Boolean);

  if (candidates.length) parts.push(candidates[0]);
  return parts.join('\n');
}

function mediaFor(post) {
  const out = [];

  if (Array.isArray(post.photos) && post.photos.length) {
    for (const p of post.photos) {
      const url = p['photo-url-1280'] || p['photo-url-500'] || p['photo-url-400'] || p['photo-url-250'];
      if (url) out.push(`<img src="${url}" loading="lazy" alt="" />`);
    }
  } else if (post['photo-url-1280'] || post['photo-url-500']) {
    const url = post['photo-url-1280'] || post['photo-url-500'];
    out.push(`<img src="${url}" loading="lazy" alt="" />`);
  }

  if (Array.isArray(post['video-player']) && post['video-player'].length) {
    const embed = post['video-player'][post['video-player'].length - 1]?.['embed-code'];
    if (embed) out.push(embed);
  } else if (post['video-player']) {
    out.push(post['video-player']);
  }

  if (post['audio-player']) out.push(post['audio-player']);

  if (post.type === 'link' && post['link-url']) {
    const txt = post['link-text'] || post['link-url'];
    out.push(`<p><a href="${post['link-url']}" target="_blank" rel="noopener noreferrer">${txt}</a></p>`);
  }

  return out.join('\n');
}

function esc(s) {
  return String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function postCard(post) {
  const caption = captionFor(post);
  const media = mediaFor(post);
  const date = post.date || post['date-gmt'] || '';
  const tags = Array.isArray(post.tags) ? post.tags : [];

  return `
    <article class="card" id="p-${post.id}">
      <header>
        <div class="meta">${esc(date)} · ${esc(post.type || 'post')}</div>
        <div><a href="${post.url}" target="_blank" rel="noopener noreferrer">Original post ↗</a></div>
      </header>
      ${media ? `<div class="media">${media}</div>` : ''}
      <div class="caption">${caption || '<p>(no caption)</p>'}</div>
      ${tags.length ? `<div class="tags">${tags.map((t) => `#${esc(t)}`).join(' ')}</div>` : ''}
    </article>
  `;
}

function pageHtml(posts, page, totalPages, totalPosts) {
  const prev = page > 1 ? `page-${page - 1}.html` : null;
  const next = page < totalPages ? `page-${page + 1}.html` : null;

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>The Whatever Archive · Page ${page}</title>
  <style>
    body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;background:#0b0f14;color:#e5e7eb;margin:0;padding:24px}
    .wrap{max-width:920px;margin:0 auto}
    h1{margin:0 0 8px;font-size:28px}
    .sub{color:#9ca3af;margin-bottom:20px}
    .nav{display:flex;gap:12px;align-items:center;margin-bottom:16px}
    .nav a{color:#93c5fd}
    .card{background:#111827;border:1px solid #1f2937;border-radius:14px;padding:14px;margin:14px 0}
    .card header{display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:10px}
    .meta{color:#9ca3af;font-size:13px}
    .caption{line-height:1.5}
    .caption img,.media img{max-width:100%;height:auto;border-radius:10px}
    .media iframe{max-width:100%}
    .tags{margin-top:10px;color:#9ca3af;font-size:13px}
  </style>
</head>
<body>
  <main class="wrap">
    <h1>The Whatever — Archive</h1>
    <div class="sub">Read-only archive. ${totalPosts} posts preserved from Tumblr.</div>
    <div class="nav">
      ${prev ? `<a href="${prev}">← Newer</a>` : '<span></span>'}
      <span>Page ${page} / ${totalPages}</span>
      ${next ? `<a href="${next}">Older →</a>` : '<span></span>'}
    </div>
    ${posts.map(postCard).join('\n')}
  </main>
</body>
</html>`;
}

async function main() {
  console.log('Fetching Tumblr posts...');
  const first = await fetchPage(0, PAGE_SIZE);
  const total = Number(first['posts-total'] || 0);
  const posts = [...(first.posts || [])];

  for (let start = PAGE_SIZE; start < total; start += PAGE_SIZE) {
    process.stdout.write(`\rFetched ${Math.min(start, total)} / ${total}`);
    const page = await fetchPage(start, PAGE_SIZE);
    posts.push(...(page.posts || []));
  }
  process.stdout.write(`\rFetched ${posts.length} / ${total}\n`);

  await fs.mkdir(OUT_DIR, { recursive: true });
  await fs.writeFile(path.join(OUT_DIR, 'posts.json'), JSON.stringify(posts, null, 2), 'utf8');

  const perPage = 150;
  const totalPages = Math.max(1, Math.ceil(posts.length / perPage));
  for (let i = 0; i < totalPages; i++) {
    const chunk = posts.slice(i * perPage, (i + 1) * perPage);
    const html = pageHtml(chunk, i + 1, totalPages, posts.length);
    const file = i === 0 ? 'index.html' : `page-${i + 1}.html`;
    await fs.writeFile(path.join(OUT_DIR, file), html, 'utf8');
  }

  console.log(`Wrote archive to ${OUT_DIR}`);
  console.log(`Open: ${path.join(OUT_DIR, 'index.html')}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
