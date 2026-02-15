import Link from 'next/link';
import { notFound } from 'next/navigation';
import PostView from '@/components/PostView';
import { firstLastDate, getAllPosts, pageCount, pageSlice } from '@/lib/posts';

export default async function PageN({ params }: { params: Promise<{ page: string }> }) {
  const { page } = await params;
  const n = Number(page);
  if (!Number.isFinite(n) || n < 2) return notFound();

  const posts = await getAllPosts();
  const totalPages = pageCount(posts.length);
  if (n > totalPages) return notFound();

  const chunk = pageSlice(posts, n);
  const range = firstLastDate(posts);
  const prevHref = n - 1 === 1 ? '/' : `/${n - 1}`;
  const nextHref = n < totalPages ? `/${n + 1}` : null;

  return (
    <main className="wrap">
      <section className="mainBlock">
        <section className="intro"></section>

        <PostView posts={chunk} totalPosts={posts.length} pageOffset={(n - 1) * 150} nextPageHref={nextHref} />

        <div className="pager">
          <Link href={prevHref}>← Newer</Link>
          <span>Page {n} / {totalPages}</span>
          {nextHref ? <Link href={nextHref}>Older →</Link> : <span />}
        </div>
      </section>
    </main>
  );
}
