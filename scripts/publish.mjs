// Uploads the video + poster to Ghost and creates (or updates) the lesson as a DRAFT.
// Nothing goes live until you press Publish in Ghost.
//
// Needs two environment variables (Ghost Admin → Settings → Integrations → Add custom integration):
//   GHOST_URL=https://your-site.com
//   GHOST_ADMIN_API_KEY=<id>:<secret>
// Run: npm run publish -- <course>/<lesson>
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {buildPost} from './build-post.mjs';
import {lessonDir, loadLesson, loadSite} from './lib.mjs';

const {GHOST_URL, GHOST_ADMIN_API_KEY} = process.env;
if (!GHOST_URL || !GHOST_ADMIN_API_KEY) throw new Error('Set GHOST_URL and GHOST_ADMIN_API_KEY first (see the comment at the top of this file).');
const api = `${GHOST_URL.replace(/\/$/, '')}/ghost/api/admin`;

function token() {
  const [id, secret] = GHOST_ADMIN_API_KEY.split(':');
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const unsigned = `${b64({alg: 'HS256', typ: 'JWT', kid: id})}.${b64({iat: now, exp: now + 300, aud: '/admin/'})}`;
  const sig = crypto.createHmac('sha256', Buffer.from(secret, 'hex')).update(unsigned).digest('base64url');
  return `${unsigned}.${sig}`;
}

async function call(method, url, body) {
  const res = await fetch(`${api}${url}`, {
    method,
    headers: {Authorization: `Ghost ${token()}`, 'Accept-Version': 'v5.0', ...(body instanceof FormData ? {} : {'Content-Type': 'application/json'})},
    body: body instanceof FormData ? body : body && JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${method} ${url} -> ${res.status}: ${JSON.stringify(json.errors ?? json)}`);
  return json;
}

async function upload(kind, file, type) {
  const form = new FormData();
  form.append('file', new Blob([fs.readFileSync(file)], {type}), path.basename(file));
  const res = await call('POST', `/${kind}/upload/`, form);
  return (res.media ?? res.images)[0].url;
}

const arg = process.argv[2];
const {id, lesson} = loadLesson(lessonDir(arg));

// A person signs off on every lesson before it can reach the site.
if (lesson.status !== 'reviewed') throw new Error(`lesson.yml says status: ${lesson.status}. Read and edit it, then set status: reviewed.`);
if (!loadSite().author) throw new Error('Add your name as `author` in site.yml (it goes in the credit line).');
try {
  execFileSync(process.execPath, [path.join(path.dirname(new URL(import.meta.url).pathname), 'check-quotes.mjs'), arg], {stdio: 'inherit'});
} catch {
  throw new Error('Quotation check failed; fix the quotes above before publishing.');
}
const dist = path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'dist', id);
for (const f of ['lesson.mp4', 'poster.jpg']) {
  if (!fs.existsSync(path.join(dist, f))) throw new Error(`Missing ${f}; run npm run render -- ${arg} first`);
}

console.log('Uploading video…');
const videoUrl = await upload('media', path.join(dist, 'lesson.mp4'), 'video/mp4');
const posterUrl = await upload('images', path.join(dist, 'poster.jpg'), 'image/jpeg');
const {html, meta} = buildPost(arg, {videoUrl, posterUrl});

const post = {
  title: meta.title, slug: meta.slug, custom_excerpt: meta.custom_excerpt, html,
  tags: meta.tags.map((name) => ({name})), feature_image: posterUrl, status: 'draft',
};
const existing = await call('GET', `/posts/slug/${meta.slug}/`).catch(() => null);
let saved;
if (existing) {
  const cur = existing.posts[0];
  if (cur.status !== 'draft') throw new Error(`"${meta.slug}" is already ${cur.status}; refusing to overwrite a live post. Change the slug or edit it in Ghost.`);
  saved = await call('PUT', `/posts/${cur.id}/?source=html`, {posts: [{...post, updated_at: cur.updated_at}]});
} else {
  saved = await call('POST', '/posts/?source=html', {posts: [post]});
}
const p = saved.posts[0];
console.log(`Draft saved: ${GHOST_URL.replace(/\/$/, '')}/ghost/#/editor/post/${p.id}`);
