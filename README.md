# thewhatever archive

One-time preservation archive for https://www.thewhatever.com (Tumblr).

## What this does

- Fetches **all posts** from Tumblr's read API
- Preserves each post's important **caption/body HTML**
- Generates a read-only static archive in `archive/`
- Keeps original post links + dates + tags

## Run

```bash
npm run archive
```

Then open:

- `archive/index.html`

## Notes

- This is designed as a **preservation export**, not a redesign.
- Media is linked from Tumblr-hosted URLs (fastest/safest first pass).
- Raw JSON export is saved to `archive/posts.json`.
