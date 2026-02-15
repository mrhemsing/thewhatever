import { notFound } from 'next/navigation';
import PostView from '@/components/PostView';
import { getAllPosts, pageCount, pageSlice, perPage } from '@/lib/posts';

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
      </section>
    </main>
  );
}
