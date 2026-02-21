'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { TumblrPost } from '@/lib/posts';

function dateNoTime(s?: string) {
  const raw = String(s || '').trim();
  // Expected: "Thu, 12 Nov 2015 11:46:08" -> "Thu, 12 Nov 2015"
  return raw.replace(/\s+\d{1,2}:\d{2}:\d{2}(\s.*)?$/, '').trim();
}

export default function PostView({ posts, totalPosts, pageOffset = 0, nextPageHref, prevPageHref, initialPostId }: { posts: TumblrPost[]; totalPosts: number; pageOffset?: number; nextPageHref?: string | null; prevPageHref?: string | null; initialPostId?: string | null }) {
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const slidesRef = useRef<Array<HTMLElement | null>>([]);
  const jumpRowRef = useRef<HTMLDivElement | null>(null);
  const navLockRef = useRef(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const copyTimerRef = useRef<number | null>(null);
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

    // For /post/[id] route: jump to the post within the surrounding page slice.
    if (initialPostId) {
      const idx = visiblePosts.findIndex((p) => String(p.id) === String(initialPostId));
      if (idx >= 0) {
        requestAnimationFrame(() => {
          const el = slidesRef.current[idx];
          if (!el) return;
          s.scrollTop = el.offsetTop;
          setActiveIdx(idx);
        });
        return;
      }
    }

    try {
      if (sessionStorage.getItem('thewhatever-scroll-target') === 'last') {
        sessionStorage.removeItem('thewhatever-scroll-target');
        requestAnimationFrame(() => {
          s.scrollTop = s.scrollHeight;
          setActiveIdx(Math.max(0, visiblePosts.length - 1));
        });
      }
    } catch {}
  }, [initialPostId, visiblePosts]);

  useEffect(() => {
    const s = scrollerRef.current;
    if (!s) return;

    let lastId = '';
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

      const p = visiblePosts[best];
      const id = p?.id ? String(p.id) : '';
      if (id && id !== lastId) {
        lastId = id;
        try {
          window.history.replaceState({}, '', `/post/${id}`);
        } catch {}
      }
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

    const onKeyDown = (e: KeyboardEvent) => {
      const s = scrollerRef.current;
      if (!s || navLockRef.current) return;

      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || target?.isContentEditable) return;

      const atTop = s.scrollTop <= 2;
      const atBottom = s.scrollTop + s.clientHeight >= s.scrollHeight - 2;

      if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (atTop && prevPageHref) {
          navLockRef.current = true;
          try { sessionStorage.setItem('thewhatever-scroll-target', 'last'); } catch {}
          router.push(prevPageHref);
          return;
        }
        s.scrollBy({ top: -92, behavior: 'smooth' });
        return;
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (atBottom && nextPageHref) {
          navLockRef.current = true;
          router.push(nextPageHref);
          return;
        }
        s.scrollBy({ top: 92, behavior: 'smooth' });
      }
    };

    window.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [nextPageHref, prevPageHref, router]);

  useEffect(() => {
    // clear any pending copy bubble timer on unmount
    return () => {
      if (copyTimerRef.current) window.clearTimeout(copyTimerRef.current);
    };
  }, []);

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
      const atBottom = s.scrollTop + s.clientHeight >= s.scrollHeight - 2;

      if (dy > 45 && atTop && prevPageHref) {
        navLockRef.current = true;
        try { sessionStorage.setItem('thewhatever-scroll-target', 'last'); } catch {}
        router.push(prevPageHref);
        return;
      }

      if (dy < -45 && atBottom && nextPageHref) {
        navLockRef.current = true;
        router.push(nextPageHref);
      }
    };

    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchend', onTouchEnd, { passive: true });
    return () => {
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchend', onTouchEnd);
    };
  }, [nextPageHref, prevPageHref, router]);

  return (
    <>
      <aside className="sideMeta" aria-hidden>
        <a className="sideBrand" href="/">THE WHATEVER</a>
        <div className="sideTop">Your First Stop to a Shameful Browser History</div>
        <div className="sideBottom sideBottomTight">A collection of posts from April 21, 2009 to November 18, 2015.</div>
        <div className="sideSeen">
          <div className="sideSeenLabel">AS SEEN ON:</div>
          <img className="sideTumblr" src="https://upload.wikimedia.org/wikipedia/commons/4/43/Tumblr.svg" alt="Tumblr" />
        </div>
        <div className="sideBottom desktopOnly"><a href="https://www.b-average.com/" target="_blank" rel="noopener noreferrer">B Average</a></div>
        {/* moved post label to card header */}
      </aside>
      <div className="mobileIntro">
        <div className="mobileTopRow">
          <a className="mobileBrand" href="/">THE WHATEVER</a>
          <button
            type="button"
            className="mobileHamburger"
            aria-label="Open menu"
            aria-expanded={mobileMenuOpen}
            onClick={() => setMobileMenuOpen((v) => !v)}
          >
            ☰
          </button>
        </div>
        {mobileMenuOpen ? (
          <div className="mobileMenu">
            <a href="https://www.b-average.com/" target="_blank" rel="noopener noreferrer">Contact</a>
          </div>
        ) : null}
        <div className="mobileTop">Your First Stop to a Shameful Browser History</div>
        <div className="mobileBottom">A collection of <img className="mobileBottomIcon" src="/mobile-tumblr-icon.svg" alt="" /> posts from 2009 to 2015.</div>
      </div>
      <div className="scroller" ref={scrollerRef}>
        {visiblePosts.map((p, i) => (
          <section key={p.id} className="slide" ref={(el) => { slidesRef.current[i] = el; }}>
            <article className="card">
              <header className="cardHead">
                <div className="cardLeft">
                  {copiedId === String(p.id) ? <span className="copyBubble" role="status">Link copied</span> : null}
                  <a className="cardPostLabel" href={`/post/${p.id}`}><span className="sideCountWord">Post</span> <span className="sideCountNum">{Math.min(totalPosts, pageOffset + activeIdx + 1)}/{totalPosts}</span></a>
                  <button
                    type="button"
                    className="shareBtn"
                    aria-label="Copy link"
                    title="Copy link"
                    onClick={async () => {
                      const url = `${location.origin}/post/${p.id}`;
                      try {
                        await navigator.clipboard.writeText(url);
                        setCopiedId(String(p.id));
                        if (copyTimerRef.current) window.clearTimeout(copyTimerRef.current);
                        copyTimerRef.current = window.setTimeout(() => setCopiedId(null), 1100);
                      } catch {
                        // ignore
                      }
                    }}
                  >
                    <span className="desktopOnly">
                      <svg className="linkGlyph" width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                        <path d="M10 13a5 5 0 0 1 0-7l1.5-1.5a5 5 0 0 1 7 7L17 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M14 11a5 5 0 0 1 0 7L12.5 19.5a5 5 0 0 1-7-7L7 11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </span>
                    <span className="mobileOnly linkGlyph" aria-hidden>🔗</span>
                  </button>
                </div>
                {/* removed original link */}
                <div className="meta">
                  <span className="metaDate"><span className="mobileOnly">{dateNoTime(p.date)}</span><span className="desktopOnly">{p.date}</span></span>
                  {/* removed post type */}
                  {p['note-count'] ? <span>{` · ${p['note-count']} notes`}</span> : null}
                </div>
              </header>
              <div className="mediaLink">
                <div suppressHydrationWarning className="media" dangerouslySetInnerHTML={{ __html: mediaHtmlFor(p) }} />
              </div>
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
