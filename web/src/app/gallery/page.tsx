import Link from 'next/link';
import { firstLastDate, getAllPosts, thumbFor } from '@/lib/posts';

export default async function GalleryPage() {
  const posts = await getAllPosts();
  const range = firstLastDate(posts);
  const sorted = [...posts].sort((a, b) => Number(b['unix-timestamp'] || 0) - Number(a['unix-timestamp'] || 0));

  const byMonth = new Map<string, typeof posts>();
  for (const p of sorted) {
    const ts = Number(p['unix-timestamp'] || 0);
    if (!ts) continue;
    const d = new Date(ts * 1000);
    const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const arr = byMonth.get(k) || [];
    arr.push(p);
    byMonth.set(k, arr);
  }

  return (
    <main className="galleryWrap">
      <div className="modeNav">
        <Link href="/">Post view</Link>
        <Link className="active" href="/gallery">Gallery</Link>
      </div>
      <h1>The Whatever — Gallery</h1>
      <div className="sub">Thumbnail archive from {range.first} to {range.last}.</div>
      {[...byMonth.entries()].map(([k, items]) => {
        const [y, m] = k.split('-').map(Number);
        const label = new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        return (
          <section key={k} className="monthBlock">
            <h2>{label}</h2>
            <div className="thumbGrid">
              {items.map((p) => {
                const t = thumbFor(p);
                if (!t) return null;
                return (
                  <a key={p.id} className="tile" href={p.url} target="_blank" rel="noopener noreferrer">
                    <img src={t} alt="" />
                  </a>
                );
              })}
            </div>
          </section>
        );
      })}
    </main>
  );
}
