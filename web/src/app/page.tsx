export default function Home() {
  return (
    <main className="holdingWrap">
      <section className="holdingCard">
        <img
          className="holdingImage"
          src="https://64.media.tumblr.com/420261ac2ab7f1f25b6293134b079477/tumblr_nxkc8pSib01qzbs6po1_500.jpg"
          alt="The Whatever preview"
        />
        <h1>We&apos;re posting on X right now.</h1>
        <a
          className="holdingButton"
          href="https://x.com/thewhatever"
          target="_blank"
          rel="noopener noreferrer"
        >
          <span className="xLogo" aria-hidden="true">𝕏</span>
          <span>Follow @thewhatever on X</span>
        </a>
      </section>
    </main>
  );
}
