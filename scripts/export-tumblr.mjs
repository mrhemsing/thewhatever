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

function thumbnailUrlFor(post) {
  if (Array.isArray(post.photos) && post.photos.length) {
    const p = post.photos[0];
    return p['photo-url-250'] || p['photo-url-400'] || p['photo-url-500'] || p['photo-url-1280'] || null;
  }
  if (post['photo-url-250'] || post['photo-url-400'] || post['photo-url-500'] || post['photo-url-1280']) {
    return post['photo-url-250'] || post['photo-url-400'] || post['photo-url-500'] || post['photo-url-1280'];
  }
  return null;
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
    <section class="slide">
      <article class="card" id="p-${post.id}">
        <header>
          <div class="meta">${esc(date)} · ${esc(post.type || 'post')}</div>
          <div><a href="${post.url}" target="_blank" rel="noopener noreferrer">Original post ↗</a></div>
        </header>
        ${media ? `<div class="media">${media}</div>` : ''}
        <div class="caption">${caption || '<p>(no caption)</p>'}</div>
        ${tags.length ? `<div class="tags">${tags.map((t) => `#${esc(t)}`).join(' ')}</div>` : ''}
      </article>
    </section>
  `;
}

function pageHref(n) {
  return n === 1 ? './index.html' : `./${n}/`;
}

function pageHtml(posts, page, totalPages, totalPosts, firstDateLabel, lastDateLabel) {
  const prev = page > 1 ? pageHref(page - 1) : null;
  const next = page < totalPages ? pageHref(page + 1) : null;
  const jumpThumbs = posts.map((p, idx) => {
    const date = esc(p.date || p['date-gmt'] || 'Unknown date');
    const thumb = thumbnailUrlFor(p);
    if (thumb) {
      return `<button class="jumpThumb" data-idx="${idx}" title="${date}"><img src="${thumb}" loading="lazy" alt="" /><span>${idx + 1}</span></button>`;
    }
    return `<button class="jumpThumb jumpThumbFallback" data-idx="${idx}" title="${date}"><span>${idx + 1}</span></button>`;
  }).join('');

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>The Whatever Archive · Page ${page}</title>
  <style>
    body{font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;background:radial-gradient(1200px 600px at 10% -10%,rgba(96,165,250,0.16),transparent 55%),radial-gradient(1000px 500px at 95% 110%,rgba(168,85,247,0.12),transparent 60%),linear-gradient(180deg,#070b13,#0b1220);color:#e5e7eb;margin:0;padding:24px;height:100vh;overflow:hidden}
    .wrap{max-width:920px;margin:0 auto;height:100%;display:flex;flex-direction:column}
    .mainBlock{max-width:520px;width:100%;margin:0 auto;height:100%;display:flex;flex-direction:column;justify-content:flex-start}
    h1{margin:0 0 8px;font-size:28px}
    .sub{color:#9ca3af;margin-bottom:20px}
    .topBlock{margin:0 0 25px}
    .intro{margin:0}
    .intro h1{margin:0 0 8px;font-size:28px}
    .intro .sub{color:#9ca3af;margin-bottom:8px}
    .modeNav{display:flex;gap:8px;margin:0 0 10px}
    .modeNav a{display:inline-flex;align-items:center;padding:7px 12px;border-radius:999px;border:1px solid rgba(148,163,184,0.28);background:rgba(15,23,42,0.45);backdrop-filter:blur(8px);color:#cbd5e1;text-decoration:none;font-size:13px;transition:all .18s ease}
    .modeNav a:hover{border-color:rgba(147,197,253,0.55);color:#e2e8f0;transform:translateY(-1px)}
    .modeNav a.active{background:linear-gradient(180deg,rgba(59,130,246,0.28),rgba(30,64,175,0.22));border-color:rgba(96,165,250,0.65);color:#e2e8f0}
    .jumpWrap{margin:0 0 10px}
    .jumpWrap label{display:block;font-size:12px;color:#94a3b8;margin-top:10px;margin-bottom:10px}
    .jumpThumbRow{display:grid;grid-auto-flow:column;grid-auto-columns:64px;gap:8px;overflow-x:auto;margin-top:16px;padding-bottom:4px;scrollbar-width:thin;scrollbar-color:rgba(148,163,184,0.65) rgba(15,23,42,0.55)}
    .jumpThumbRow::-webkit-scrollbar{height:8px}
    .jumpThumbRow::-webkit-scrollbar-track{background:rgba(15,23,42,0.55);border-radius:999px}
    .jumpThumbRow::-webkit-scrollbar-thumb{background:rgba(148,163,184,0.65);border-radius:999px}
    .jumpThumb{position:relative;appearance:none;border:1px solid rgba(148,163,184,0.28);border-radius:12px;padding:0;background:#0f172a;cursor:pointer;overflow:hidden;height:64px;transition:transform .15s ease,border-color .15s ease,box-shadow .15s ease}
    .jumpThumb img{width:100%;height:100%;object-fit:cover;display:block}
    .jumpThumb span{position:absolute;right:4px;bottom:4px;font-size:10px;line-height:1;padding:2px 4px;border-radius:999px;background:rgba(2,6,23,0.72);color:#e2e8f0}
    .jumpThumbFallback{display:flex;align-items:center;justify-content:center;color:#94a3b8}
    .jumpThumb:hover{transform:translateY(-1px);border-color:rgba(147,197,253,0.55);box-shadow:0 8px 20px rgba(2,6,23,0.45)}
    .jumpThumb.active{outline:2px solid #60a5fa;outline-offset:0}
    .navBottom{margin:10px 0 0;display:flex;justify-content:center;gap:14px;align-items:center}
    .nav a{color:#93c5fd}
    .postsScroller{height:min(70vh,760px);overflow-y:auto;scroll-snap-type:y mandatory;scroll-behavior:smooth;padding-right:4px;scrollbar-width:none;-ms-overflow-style:none;overscroll-behavior:contain}
    .postsScroller::-webkit-scrollbar{display:none}
    .slide{height:100%;min-height:100%;overflow:hidden;scroll-snap-align:start;scroll-snap-stop:always;display:flex;align-items:center;justify-content:center}
    .card{background:linear-gradient(180deg,rgba(15,23,42,0.88),rgba(15,23,42,0.74));border:1px solid rgba(148,163,184,0.22);backdrop-filter:blur(10px);border-radius:16px;padding:12px 10px 14px;margin:0 auto;max-width:520px;width:100%;display:flex;flex-direction:column;justify-content:flex-start;box-shadow:0 14px 34px rgba(2,6,23,0.45)}
    .card header{display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;margin-bottom:8px}
    .meta{color:#a7b4c8;font-size:12px;letter-spacing:.02em}
    .caption{line-height:1.5;text-align:left}
    .caption img,.media img{display:block;width:100%;max-width:100%;height:auto;border-radius:10px;margin:0}
    .media{margin-left:-2px;margin-right:-2px}
    .media{text-align:center}
    .media iframe{max-width:100%}
    .tags{margin-top:10px;color:#9ca3af;font-size:13px}
    .scrollHint{
      position: fixed;
      left: 50%;
      top: 50%;
      transform: translate(288px, -50%);
      writing-mode: vertical-rl;
      text-orientation: mixed;
      letter-spacing: 0.22em;
      font-size: 11px;
      color: rgba(229,231,235,0.62);
      user-select: none;
      pointer-events: none;
      text-shadow: 0 0 10px rgba(0,0,0,0.45);
    }
    @media (max-width: 820px){
      .scrollHint{display:none}
    }
  </style>
</head>
<body>
  <main class="wrap">
    <div class="scrollHint">‹ SCROLL ›</div>
    <section class="mainBlock">
      <section class="topBlock">
        <nav class="modeNav" aria-label="Archive navigation">
          <a class="active" href="./index.html">Post view</a>
          <a href="./gallery.html">Gallery</a>
        </nav>
        <section class="intro">
          <h1>The Whatever — Archive</h1>
          <div class="sub">A collection of blog posts from ${firstDateLabel} to ${lastDateLabel}.</div>
          <div class="sub">Read-only archive. ${totalPosts} posts preserved from Tumblr. <a href="./gallery.html">Open gallery →</a></div>
        </section>
      </section>
      <section class="postsScroller" id="postsScroller">
        ${posts.map(postCard).join('\n')}
      </section>
      <div class="jumpWrap">
        <label>Jump to post on this page</label>
        <div class="jumpThumbRow" id="jumpPost">
          ${jumpThumbs}
        </div>
      </div>
      <div class="navBottom">
        ${prev ? `<a href="${prev}">← Newer</a>` : '<span></span>'}
        <span>Page ${page} / ${totalPages}</span>
        ${next ? `<a href="${next}">Older →</a>` : '<span></span>'}
      </div>
    </section>
  </main>
  <script>
    (() => {
      if (window.matchMedia('(max-width: 820px)').matches) return;
      const scroller = document.getElementById('postsScroller');
      const jump = document.getElementById('jumpPost');
      if (!scroller) return;

      const thumbs = jump ? Array.from(jump.querySelectorAll('.jumpThumb')) : [];

      const goToIndex = (idx) => {
        const slides = scroller.querySelectorAll('.slide');
        const target = slides[idx];
        if (!target) return;
        scroller.scrollTo({ top: target.offsetTop, behavior: 'smooth' });
      };

      if (thumbs.length) {
        thumbs.forEach((el) => {
          el.addEventListener('click', () => {
            const idx = Number(el.dataset.idx || 0);
            goToIndex(idx);
          });
        });
      }

      let wheelLocked = false;
      const onWheel = (e) => {
        const deltaY = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
        if (Math.abs(deltaY) < 1) return;
        e.preventDefault();
        if (wheelLocked) return;
        wheelLocked = true;
        const viewport = scroller.clientHeight;
        scroller.scrollBy({ top: deltaY > 0 ? viewport : -viewport, behavior: 'smooth' });
        window.setTimeout(() => { wheelLocked = false; }, 420);
      };
      scroller.addEventListener('wheel', onWheel, { passive: false });
      window.addEventListener('wheel', onWheel, { passive: false });

      if (thumbs.length) {
        const setActive = (idx) => {
          thumbs.forEach((el, i) => el.classList.toggle('active', i === idx));
          const active = thumbs[idx];
          if (active) active.scrollIntoView({ block: 'nearest', inline: 'center' });
        };

        setActive(0);

        scroller.addEventListener('scroll', () => {
          const viewport = scroller.clientHeight || 1;
          const idx = Math.max(0, Math.round(scroller.scrollTop / viewport));
          setActive(idx);
        }, { passive: true });
      }
    })();
  </script>
</body>
</html>`;
}

function galleryHtml(posts, firstDateLabel, lastDateLabel) {
  const sorted = [...posts].sort((a, b) => Number(b['unix-timestamp'] || 0) - Number(a['unix-timestamp'] || 0));
  const byMonth = new Map();

  for (const p of sorted) {
    const ts = Number(p['unix-timestamp'] || 0);
    if (!Number.isFinite(ts) || ts <= 0) continue;
    const d = new Date(ts * 1000);
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const arr = byMonth.get(ym) || [];
    arr.push(p);
    byMonth.set(ym, arr);
  }

  const monthBlocks = [...byMonth.entries()].map(([ym, items]) => {
    const [y, m] = ym.split('-').map(Number);
    const monthLabel = new Date(y, (m || 1) - 1, 1).toLocaleDateString('en-US', { year: 'numeric', month: 'long' });

    const tiles = items.map((p) => {
      const thumb = thumbnailUrlFor(p);
      if (!thumb) return '';
      return `<a class="tile" href="${p.url}" target="_blank" rel="noopener noreferrer"><img src="${thumb}" loading="lazy" alt="" /></a>`;
    }).filter(Boolean).join('');

    if (!tiles) return '';
    return `<section class="month"><h2>${monthLabel}</h2><div class="thumbGrid">${tiles}</div></section>`;
  }).filter(Boolean).join('\n');

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>The Whatever Archive · Gallery</title>
  <style>
    body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;background:#0b0f14;color:#e5e7eb;margin:0;padding:24px}
    .wrap{max-width:1100px;margin:0 auto}
    a{color:#93c5fd}
    .top{max-width:760px;margin:0 auto 18px}
    .sub{color:#9ca3af}
    .modeNav{display:flex;gap:8px;margin:0 0 10px}
    .modeNav a{display:inline-flex;align-items:center;padding:7px 12px;border-radius:999px;border:1px solid rgba(148,163,184,0.28);background:rgba(15,23,42,0.45);backdrop-filter:blur(8px);color:#cbd5e1;text-decoration:none;font-size:13px;transition:all .18s ease}
    .modeNav a:hover{border-color:rgba(147,197,253,0.55);color:#e2e8f0;transform:translateY(-1px)}
    .modeNav a.active{background:linear-gradient(180deg,rgba(59,130,246,0.28),rgba(30,64,175,0.22));border-color:rgba(96,165,250,0.65);color:#e2e8f0}
    .month{margin:22px 0}
    .month h2{margin:0 0 10px;font-size:18px;color:#d1d5db}
    .thumbGrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:10px}
    .tile{display:block;border:1px solid #1f2937;border-radius:10px;overflow:hidden;background:#111827;aspect-ratio:1/1}
    .tile img{width:100%;height:100%;object-fit:cover;display:block}
  </style>
</head>
<body>
  <main class="wrap">
    <section class="top">
      <nav class="modeNav" aria-label="Archive navigation">
        <a href="./index.html">Post view</a>
        <a class="active" href="./gallery.html">Gallery</a>
      </nav>
      <h1>The Whatever — Gallery</h1>
      <div class="sub">Thumbnail archive from ${firstDateLabel} to ${lastDateLabel}.</div>
    </section>
    ${monthBlocks || '<p class="sub">No image thumbnails found.</p>'}
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

  const oldest = posts.reduce((a, p) => (!a || Number(p['unix-timestamp']) < Number(a['unix-timestamp']) ? p : a), null);
  const newest = posts.reduce((a, p) => (!a || Number(p['unix-timestamp']) > Number(a['unix-timestamp']) ? p : a), null);
  const fmt = (p) => {
    const ts = Number(p?.['unix-timestamp'] || 0);
    const d = new Date(ts * 1000);
    return Number.isFinite(ts) ? d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : 'Unknown';
  };
  const firstDateLabel = fmt(oldest);
  const lastDateLabel = fmt(newest);

  for (let i = 0; i < totalPages; i++) {
    const pageNum = i + 1;
    const chunk = posts.slice(i * perPage, (i + 1) * perPage);
    const html = pageHtml(chunk, pageNum, totalPages, posts.length, firstDateLabel, lastDateLabel);

    if (pageNum === 1) {
      await fs.writeFile(path.join(OUT_DIR, 'index.html'), html, 'utf8');
    } else {
      const dir = path.join(OUT_DIR, String(pageNum));
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(path.join(dir, 'index.html'), html, 'utf8');
    }
  }

  const gallery = galleryHtml(posts, firstDateLabel, lastDateLabel);
  await fs.writeFile(path.join(OUT_DIR, 'gallery.html'), gallery, 'utf8');

  console.log(`Wrote archive to ${OUT_DIR}`);
  console.log(`Open: ${path.join(OUT_DIR, 'index.html')}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
