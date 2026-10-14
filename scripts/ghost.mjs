// Minimal Ghost Admin API client (no dependencies).
// Reads COURSES_GHOST_URL and COURSES_GHOST_ADMIN_API_KEY (names specific to
// the courses site, so another Ghost site's key can live in the same
// environment without mix-ups); see README.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export function ghost() {
  const GHOST_URL = process.env.COURSES_GHOST_URL;
  const GHOST_ADMIN_API_KEY = process.env.COURSES_GHOST_ADMIN_API_KEY;
  if (!GHOST_URL || !GHOST_ADMIN_API_KEY) {
    throw new Error('COURSES_GHOST_URL and COURSES_GHOST_ADMIN_API_KEY are not set. On the Mac, put them in the .env file at the top of the project; in the cloud, in the environment settings (see README → Publishing from chat).');
  }
  const site = GHOST_URL.replace(/\/$/, '');
  const api = `${site}/ghost/api/admin`;

  const token = () => {
    const [id, secret] = GHOST_ADMIN_API_KEY.split(':');
    const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
    const now = Math.floor(Date.now() / 1000);
    const unsigned = `${b64({alg: 'HS256', typ: 'JWT', kid: id})}.${b64({iat: now, exp: now + 300, aud: '/admin/'})}`;
    return `${unsigned}.${crypto.createHmac('sha256', Buffer.from(secret, 'hex')).update(unsigned).digest('base64url')}`;
  };

  async function call(method, url, body) {
    const isForm = body instanceof FormData;
    const res = await fetch(`${api}${url}`, {
      method,
      headers: {Authorization: `Ghost ${token()}`, 'Accept-Version': 'v5.0', ...(isForm ? {} : {'Content-Type': 'application/json'})},
      body: isForm ? body : body && JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`${method} ${url} -> ${res.status}: ${JSON.stringify(json.errors ?? json)}`);
    return json;
  }
  const find = (resource, slug) => call('GET', `/${resource}/slug/${slug}/`).then((r) => r[resource][0]).catch(() => null);

  return {
    site,
    call,
    find,
    async upload(kind, file, type) {
      const form = new FormData();
      form.append('file', new Blob([fs.readFileSync(file)], {type}), path.basename(file));
      const res = await call('POST', `/${kind}/upload/`, form);
      return (res.media ?? res.images)[0].url;
    },
    /** Create or update a post/page by slug, always as a draft unless already live (then refuse). */
    async saveDraft(resource, doc) {
      const cur = await find(resource, doc.slug);
      if (cur && cur.status !== 'draft') throw new Error(`"${doc.slug}" is already ${cur.status}; refusing to overwrite it. Edit it in Ghost or use a new slug.`);
      const body = {[resource]: [{...doc, status: 'draft', ...(cur ? {updated_at: cur.updated_at} : {})}]};
      const res = cur ? await call('PUT', `/${resource}/${cur.id}/?source=html`, body) : await call('POST', `/${resource}/?source=html`, body);
      const saved = res[resource][0];
      return {...saved, editorUrl: `${site}/ghost/#/editor/${resource === 'pages' ? 'page' : 'post'}/${saved.id}`};
    },
    /** Create or update a tag (a course). Tags have no draft state; this only sets name/description. */
    async saveTag(tag) {
      const cur = await find('tags', tag.slug);
      const res = cur
        ? await call('PUT', `/tags/${cur.id}/`, {tags: [{...tag, updated_at: cur.updated_at}]})
        : await call('POST', '/tags/', {tags: [tag]});
      return res.tags[0];
    },
  };
}
