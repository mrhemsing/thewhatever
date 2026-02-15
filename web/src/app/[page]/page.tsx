import Link from 'next/link';
import { notFound } from 'next/navigation';
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

export default async function PageN({ params }: { params: Promise<{ page: string }> }) {
  const { page } = await params;
  const n = Number(page);
  if (!Number.isFinite(n) || n < 2) return notFound();

  const posts = await getAllPosts();
  const totalPages = pageCount(posts.length);
  if (n > totalPages) return notFound();

  const chunk = pageSlice(posts, n);
  const prevHref = n - 1 === 1 ? '/' : `/${n - 1}`;
  const nextHref = n < totalPages ? `/${n + 1}` : null;
  const pages = pageWindow(totalPages, n, 6);

  return (
    <main className="wrap">
      <section className="mainBlock">
        <section className="intro"></section>

        <PostView posts={chunk} totalPosts={posts.length} pageOffset={(n - 1) * 150} prevPageHref={prevHref} nextPageHref={nextHref} />

        <div className="pager">
          <div className="pagerInner">
            <Link href={prevHref} className="pagerArrow">❮</Link>
            {pages[0] > 1 ? <span className="pagerDots">…</span> : null}
            {pages.map((p) => (
              <Link key={p} href={p === 1 ? '/' : `/${p}`} className={`pagerNum ${p === n ? 'active' : ''}`}>
                {p}
              </Link>
            ))}
            {totalPages > pages[pages.length - 1] ? <span className="pagerDots">…</span> : null}
            {nextHref ? <Link href={nextHref} className="pagerArrow">❯</Link> : <span className="pagerArrow disabled">❯</span>}
          </div>
        </div>
      </section>
    </main>
  );
}
