import { notFound } from 'next/navigation';
import PostView from '@/components/PostView';
import { getAllPosts } from '@/lib/posts';

export default async function PostIdPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const posts = await getAllPosts();
  const post = posts.find((p) => String(p.id) === String(id));
  if (!post) return notFound();

  // Render as a single-post "page" while preserving the same UI.
  return (
    <main className="wrap">
      <section className="mainBlock">
        <section className="intro"></section>
        <PostView posts={[post]} totalPosts={posts.length} pageOffset={0} prevPageHref={null} nextPageHref={null} />
      </section>
    </main>
  );
}
