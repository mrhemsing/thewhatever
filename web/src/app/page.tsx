import Link from 'next/link';
import PostView from '@/components/PostView';
import { getAllPosts, pageCount, pageSlice } from '@/lib/posts';

function pageWindow(totalPages: number, currentPage: number, max = 6) {
  if (totalPages <= max) return Array.from({ length: totalPages }, (_, i) => i + 1);
  let start = Math.max(1, currentPage - Math.floor(max / 2));
  let end = start + max - 1;
  if (end > totalPages) {
    end = totalPages;
    start = end - max + 1;
  }
  return Array.from({ length: end - start + 1 }, (_, i) => start + i);
}

export default async function Home() {
  const posts = await getAllPosts();
  const chunk = pageSlice(posts, 1);
  const totalPages = pageCount(posts.length);
  const pages = pageWindow(totalPages, 1, 6);

  return (
    <main className="wrap">
      <section className="mainBlock">
        <section className="intro"></section>

        <PostView posts={chunk} totalPosts={posts.length} pageOffset={0} prevPageHref={null} nextPageHref={totalPages > 1 ? '/2' : null} />

        <div className="pager">
          <div className="pagerInner">
            <span className="pagerArrow disabled">❮</span>
            {pages.map((p) => (
              <Link key={p} href={p === 1 ? '/' : `/${p}`} className={`pagerNum ${p === 1 ? 'active' : ''}`}>
                {p}
              </Link>
            ))}
            {totalPages > pages[pages.length - 1] ? <span className="pagerDots">…</span> : null}
            {totalPages > 1 ? <Link href="/2" className="pagerArrow">❯</Link> : <span className="pagerArrow disabled">❯</span>}
          </div>
        </div>
      </section>
    </main>
  );
}
