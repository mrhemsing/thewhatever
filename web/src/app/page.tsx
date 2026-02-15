import Link from 'next/link';
import PostView from '@/components/PostView';
import { firstLastDate, getAllPosts, pageCount, pageSlice } from '@/lib/posts';

export default async function Home() {
  const posts = await getAllPosts();
  const chunk = pageSlice(posts, 1);
  const totalPages = pageCount(posts.length);
  const range = firstLastDate(posts);

  return (
    <main className="wrap">
      <section className="mainBlock">
        <section className="intro"></section>

        <PostView posts={chunk} totalPosts={posts.length} pageOffset={0} nextPageHref={totalPages > 1 ? '/2' : null} />

        <div className="pager">
          <span>Page 1 / {totalPages}</span>
          {totalPages > 1 ? <Link href="/2">Older →</Link> : null}
        </div>
      </section>
    </main>
  );
}
