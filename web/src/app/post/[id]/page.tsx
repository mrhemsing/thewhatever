import Link from 'next/link';
import { notFound } from 'next/navigation';
import PostView from '@/components/PostView';
import { getAllPosts, pageCount, pageSlice, perPage } from '@/lib/posts';

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

export default async function PostIdPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const posts = await getAllPosts();
  const idx = posts.findIndex((p) => String(p.id) === String(id));
  if (idx < 0) return notFound();

  const page = Math.floor(idx / perPage()) + 1;
  const chunk = pageSlice(posts, page);
  const totalPages = pageCount(posts.length);
  const prevPageHref = page > 1 ? (page - 1 === 1 ? '/' : `/${page - 1}`) : null;
  const nextPageHref = page < totalPages ? `/${page + 1}` : null;
  const pages = pageWindow(totalPages, page, 6);

  return (
    <main className="wrap">
      <section className="mainBlock">
        <section className="intro"></section>

        <PostView
          posts={chunk}
          totalPosts={posts.length}
          pageOffset={(page - 1) * perPage()}
          prevPageHref={prevPageHref}
          nextPageHref={nextPageHref}
          initialPostId={id}
        />

        <div className="pager">
          <div className="pagerInner">
            {prevPageHref ? <Link href={prevPageHref} className="pagerArrow">❮</Link> : <span className="pagerArrow disabled">❮</span>}
            {pages[0] > 1 ? <span className="pagerDots">…</span> : null}
            {pages.map((p) => (
              <Link key={p} href={p === 1 ? '/' : `/${p}`} className={`pagerNum ${p === page ? 'active' : ''}`}>
                {p}
              </Link>
            ))}
            {totalPages > pages[pages.length - 1] ? <span className="pagerDots">…</span> : null}
            {nextPageHref ? <Link href={nextPageHref} className="pagerArrow">❯</Link> : <span className="pagerArrow disabled">❯</span>}
          </div>
        </div>
      </section>
    </main>
  );
}
