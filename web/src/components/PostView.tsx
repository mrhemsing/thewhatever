'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { TumblrPost } from '@/lib/posts';

export default function PostView({ posts, totalPosts, pageOffset = 0, nextPageHref, prevPageHref }: { posts: TumblrPost[]; totalPosts: number; pageOffset?: number; nextPageHref?: string | null; prevPageHref?: string | null }) {
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const slidesRef = useRef<Array<HTMLElement | null>>([]);
  const jumpRowRef = useRef<HTMLDivElement | null>(null);
  const navLockRef = useRef(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const router = useRouter();

  const goTo = (idx: number) => {
    const s = scrollerRef.current;
    const el = slidesRef.current[idx];
    if (!s || !el) return;
    s.scrollTo({ top: el.offsetTop, behavior: 'smooth' });
  };

  const captionHtmlFor = (p: TumblrPost) => {
    const raw = (p['regular-title'] ? `<h2>${p['regular-title']}</h2>` : '') +
      (p['regular-body'] || p['photo-caption'] || p['video-caption'] || p['audio-caption'] || p['link-description'] || p['quote-source'] || p['conversation-text'] || p.answer || p.body || '<p>(no caption)</p>');
    return /<blockquote[\s>]/i.test(raw) ? raw : `<blockquote>${raw}</blockquote>`;
  };

  const mediaHtmlFor = (p: TumblrPost) => {
    const closeTo375 = (h: any) => {
      const n = Number(h);
      return Number.isFinite(n) && Math.abs(n - 375) <= 85;
    };

    if (Array.isArray((p as any).photos) && (p as any).photos.length) {
      const filtered = (p as any).photos.filter((x: any) => closeTo375(x.height ?? (p as any).height));
      if (!filtered.length) return '';
      return filtered
        .map((x: any) => `<img src=\"${x['photo-url-500'] || x['photo-url-400'] || x['photo-url-250']}\" loading=\"lazy\"/>`)
        .join('');
    }

    if (closeTo375((p as any).height) && ((p as any)['photo-url-500'] || (p as any)['photo-url-400'] || (p as any)['photo-url-250'])) {
      return `<img src=\"${(p as any)['photo-url-500'] || (p as any)['photo-url-400'] || (p as any)['photo-url-250']}\" loading=\"lazy\"/>`;
    }

    const v500 = String((p as any)['video-player-500'] || '');
    const vh = Number(v500.match(/height=['\"](\d+)['\"]/i)?.[1] || NaN);
    if (Number.isFinite(vh) && Math.abs(vh - 375) <= 50) return v500;

    return '';
  };

  const visiblePosts = useMemo(() => posts.filter((p) => !!mediaHtmlFor(p)), [posts]);

  const thumbs = useMemo(() => visiblePosts.map((p) => {
    const imgThumb = Array.isArray(p.photos) && p.photos.length
      ? (p.photos[0]['photo-url-250'] || p.photos[0]['photo-url-400'] || p.photos[0]['photo-url-500'])
      : (p['photo-url-250'] || p['photo-url-400'] || p['photo-url-500']);

    if (imgThumb) return imgThumb;

    const videoHtml = String(p['video-player-500'] || p['video-player'] || '');
    const poster = videoHtml.match(/poster=['\"]([^'\"]+)['\"]/i)?.[1];
    return poster || null;
  }), [visiblePosts]);

  useEffect(() => {
    const s = scrollerRef.current;
    if (!s) return;
    try {
      if (sessionStorage.getItem('thewhatever-scroll-target') === 'last') {
        sessionStorage.removeItem('thewhatever-scroll-target');
        requestAnimationFrame(() => {
          s.scrollTop = s.scrollHeight;
          setActiveIdx(Math.max(0, visiblePosts.length - 1));
        });
      }
    } catch {}
  }, [visiblePosts.length]);

  useEffect(() => {
    const s = scrollerRef.current;
    if (!s) return;

    const onScroll = () => {
      const top = s.scrollTop;
      let best = 0;
      let bestDist = Number.POSITIVE_INFINITY;
      for (let i = 0; i < slidesRef.current.length; i++) {
        const el = slidesRef.current[i];
        if (!el) continue;
        const d = Math.abs(el.offsetTop - top);
        if (d < bestDist) {
          bestDist = d;
          best = i;
        }
      }
      setActiveIdx(best);
    };

    onScroll();
    s.addEventListener('scroll', onScroll, { passive: true });
    return () => s.removeEventListener('scroll', onScroll);
  }, [visiblePosts]);

  useEffect(() => {
    const row = jumpRowRef.current;
    if (!row) return;
    const btn = row.querySelectorAll('button')[activeIdx] as HTMLButtonElement | undefined;
    if (!btn) return;
    btn.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }, [activeIdx]);

  useEffect(() => {
    const onWheel = (e: WheelEvent) => {
      const s = scrollerRef.current;
      if (!s) return;
      const t = e.target as HTMLElement | null;
      if (t?.closest('.jumpRow')) return;

      const atTop = s.scrollTop <= 2;
      const atBottom = s.scrollTop + s.clientHeight >= s.scrollHeight - 2;

      if (e.deltaY < 0 && atTop && prevPageHref && !navLockRef.current) {
        navLockRef.current = true;
        try { sessionStorage.setItem('thewhatever-scroll-target', 'last'); } catch {}
        router.push(prevPageHref);
        return;
      }

      if (e.deltaY > 0 && atBottom && nextPageHref && !navLockRef.current) {
        navLockRef.current = true;
        router.push(nextPageHref);
        return;
      }

      s.scrollBy({ top: e.deltaY, behavior: 'auto' });
      e.preventDefault();
    };

    window.addEventListener('wheel', onWheel, { passive: false });
    return () => window.removeEventListener('wheel', onWheel);
  }, [nextPageHref, prevPageHref, router]);

  useEffect(() => {
    let startY = 0;

    const onTouchStart = (e: TouchEvent) => {
      startY = e.touches[0]?.clientY ?? 0;
    };

    const onTouchEnd = (e: TouchEvent) => {
      const s = scrollerRef.current;
      if (!s || navLockRef.current) return;
      const endY = e.changedTouches[0]?.clientY ?? startY;
      const dy = endY - startY;
      const atTop = s.scrollTop <= 2;
      if (dy > 45 && atTop && prevPageHref) {
        navLockRef.current = true;
        try { sessionStorage.setItem('thewhatever-scroll-target', 'last'); } catch {}
        router.push(prevPageHref);
      }
    };

    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchend', onTouchEnd, { passive: true });
    return () => {
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchend', onTouchEnd);
    };
  }, [prevPageHref, router]);

  return (
    <>
      <aside className="sideMeta" aria-hidden>
        <a className="sideBrand" href="/">THE WHATEVER</a>
        <div className="sideTop">Your First Stop to a Shameful Browser History</div>
        <img className="sidePhoto" src="/sidebar-queen.jpg" alt="" />
        <div className="sideBottom">A collection of posts from April 21, 2009 to November 18, 2015.</div>
        <div className="sideSeen">
          <div className="sideSeenLabel">AS SEEN ON:</div>
          <img className="sideTumblr" src="https://upload.wikimedia.org/wikipedia/commons/4/43/Tumblr.svg" alt="Tumblr" />
        </div>
        {/* moved post label to card header */}
      </aside>
      <div className="mobileIntro" aria-hidden>
        <a className="mobileBrand" href="/">THE WHATEVER</a>
        <div className="mobileTop">Your First Stop to a Shameful Browser History</div>
        <div className="mobileBottom">A collection of <img className="mobileBottomIcon" src="/mobile-tumblr-icon.svg" alt="" /> posts from 04/21/09 to 11/18/15.</div>
      </div>
      <div className="scroller" ref={scrollerRef}>
        {visiblePosts.map((p, i) => (
          <section key={p.id} className="slide" ref={(el) => { slidesRef.current[i] = el; }}>
            <article className="card">
              <header className="cardHead">
                <a className="cardPostLabel" href={`/post/${p.id}`}><span className="sideCountWord">Post</span> <span className="sideCountNum">{Math.min(totalPosts, pageOffset + activeIdx + 1)}/{totalPosts}</span></a>
                <div className="meta">
                  <span>{p.date}</span>
                  {/* removed post type */}
                  {p['note-count'] ? <span>{` · ${p['note-count']} notes`}</span> : null}
                </div>
              </header>
              <a href={`/post/${p.id}`} className="mediaLink">
                <div suppressHydrationWarning className="media" dangerouslySetInnerHTML={{ __html: mediaHtmlFor(p) }} />
              </a>
              <div suppressHydrationWarning className="caption" dangerouslySetInnerHTML={{ __html: captionHtmlFor(p) }} />
            </article>
          </section>
        ))}
      </div>
      <div className="scrollHint" aria-hidden><span className="hintArrow">‹</span> SCROLL <span className="hintArrow">›</span></div>
      <div className="jumpWrap">
        <div className="jumpRow" ref={jumpRowRef}>
          {thumbs.map((t, i) => (
            <button
              key={i}
              className={`thumbBtn ${i === activeIdx ? 'active' : ''}`}
              onClick={() => {
                goTo(i);
                setActiveIdx(i);
              }}
            >
              {t ? <img src={t} alt="" /> : <span>{i + 1}</span>}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
