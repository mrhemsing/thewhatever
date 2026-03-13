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

## X review batch

A lightweight first step for social automation now exists.

Run:

```bash
npm run x:review
```

This generates:

- `data/x-review-queue.json`

The file contains candidate X posts built from `archive/posts.json`, including:

- source post id + URL
- image URL
- cleaned caption text
- note count
- tags
- review fields like `reviewStatus`, `approvedText`, and `platformNotes`

Default output is the top 25 candidates ranked by note count. You can also pass a custom limit:

```bash
node scripts/build-x-review-batch.mjs 50
```
