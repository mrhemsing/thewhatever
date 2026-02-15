import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const ROOT = path.resolve('.');
const POSTS_PATH = path.join(ROOT, 'archive', 'posts.json');

const {
  R2_ACCOUNT_ID,
  R2_BUCKET,
  R2_ACCESS_KEY_ID,
  R2_SECRET_ACCESS_KEY,
  R2_PUBLIC_BASE_URL,
} = process.env;

if (!R2_ACCOUNT_ID || !R2_BUCKET || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_PUBLIC_BASE_URL) {
  console.error('Missing required env vars: R2_ACCOUNT_ID, R2_BUCKET, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_PUBLIC_BASE_URL');
  process.exit(1);
}

const endpoint = `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
const client = new S3Client({
  region: 'auto',
  endpoint,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

const MEDIA_FIELDS = ['photo-url-1280', 'photo-url-500', 'photo-url-400', 'photo-url-250'];

function cleanBase(url) {
  return String(url).replace(/\/+$/, '');
}

function extFromUrlOrType(url, contentType = '') {
  const u = String(url || '').split('?')[0].toLowerCase();
  const m = u.match(/\.(jpg|jpeg|png|gif|webp|bmp|avif|svg)$/i);
  if (m) return `.${m[1].toLowerCase()}`;
  const ct = String(contentType).toLowerCase();
  if (ct.includes('jpeg')) return '.jpg';
  if (ct.includes('png')) return '.png';
  if (ct.includes('gif')) return '.gif';
  if (ct.includes('webp')) return '.webp';
  if (ct.includes('bmp')) return '.bmp';
  if (ct.includes('avif')) return '.avif';
  if (ct.includes('svg')) return '.svg';
  return '.bin';
}

function hashUrl(url) {
  return crypto.createHash('sha1').update(url).digest('hex');
}

async function fetchBuffer(url) {
  const r = await fetch(url, { redirect: 'follow' });
  if (!r.ok) throw new Error(`Fetch failed ${r.status} ${url}`);
  const ab = await r.arrayBuffer();
  return {
    body: Buffer.from(ab),
    contentType: r.headers.get('content-type') || 'application/octet-stream',
  };
}

async function uploadToR2(key, body, contentType) {
  await client.send(new PutObjectCommand({
    Bucket: R2_BUCKET,
    Key: key,
    Body: body,
    ContentType: contentType,
    CacheControl: 'public, max-age=31536000, immutable',
  }));
}

function* mediaTargets(post) {
  for (const field of MEDIA_FIELDS) {
    if (post?.[field]) yield { obj: post, field, url: post[field] };
  }
  if (Array.isArray(post?.photos)) {
    for (const p of post.photos) {
      for (const field of MEDIA_FIELDS) {
        if (p?.[field]) yield { obj: p, field, url: p[field] };
      }
    }
  }
}

async function main() {
  const base = cleanBase(R2_PUBLIC_BASE_URL);
  const raw = await fs.readFile(POSTS_PATH, 'utf8');
  const posts = JSON.parse(raw);

  const cache = new Map();
  let scanned = 0;
  let rewritten = 0;
  let uploaded = 0;
  let skipped = 0;
  let failed = 0;

  for (const post of posts) {
    for (const t of mediaTargets(post)) {
      scanned += 1;
      const oldUrl = String(t.url || '');
      if (!oldUrl.startsWith('http')) {
        skipped += 1;
        continue;
      }
      if (oldUrl.startsWith(base + '/')) {
        skipped += 1;
        continue;
      }

      try {
        let newUrl = cache.get(oldUrl);
        if (!newUrl) {
          const { body, contentType } = await fetchBuffer(oldUrl);
          const ext = extFromUrlOrType(oldUrl, contentType);
          const key = `tumblr/${hashUrl(oldUrl)}${ext}`;
          await uploadToR2(key, body, contentType);
          newUrl = `${base}/${key}`;
          cache.set(oldUrl, newUrl);
          uploaded += 1;
        }
        t.obj[t.field] = newUrl;
        rewritten += 1;
      } catch (err) {
        failed += 1;
        if (failed < 20) console.warn(`warn: ${oldUrl} -> ${err.message}`);
      }
    }
  }

  const backup = POSTS_PATH + `.bak-${Date.now()}`;
  await fs.copyFile(POSTS_PATH, backup);
  await fs.writeFile(POSTS_PATH, JSON.stringify(posts, null, 2), 'utf8');

  console.log(`Done.`);
  console.log(`Scanned refs: ${scanned}`);
  console.log(`Uploaded unique files: ${uploaded}`);
  console.log(`Rewritten refs: ${rewritten}`);
  console.log(`Skipped: ${skipped}`);
  console.log(`Failed: ${failed}`);
  console.log(`Backup: ${backup}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
