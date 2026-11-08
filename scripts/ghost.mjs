// Minimal Ghost Admin API client (no dependencies). Two sites:
//   courses  courses.methodiusmedia.com  COURSES_GHOST_URL, COURSES_GHOST_ADMIN_API_KEY
//   kids     kids.methodiusmedia.com     KIDS_GHOST_URL, KIDS_GHOST_ADMIN_API_KEY
// (formerly courses. and kids.sdcason.com, which forward there; a site that has moved is followed, see `home`)
// (names specific to each site, so the keys live in the same .env without mix-ups); see README.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const PREFIX = {courses: 'COURSES', kids: 'KIDS'};

/** Is this site's key in the environment? */
export const ghostReady = (which = 'courses') => !!(process.env[`${PREFIX[which]}_GHOST_URL`] && process.env[`${PREFIX[which]}_GHOST_ADMIN_API_KEY`]);

export function ghost(which = 'courses') {
  const p = PREFIX[which];
  if (!p) throw new Error(`Unknown Ghost site "${which}"`);
  const GHOST_URL = process.env[`${p}_GHOST_URL`];
  const GHOST_ADMIN_API_KEY = process.env[`${p}_GHOST_ADMIN_API_KEY`];
  if (!GHOST_URL || !GHOST_ADMIN_API_KEY) {
    throw new Error(`${p}_GHOST_URL and ${p}_GHOST_ADMIN_API_KEY are not set. On the Mac, put them in the .env file at the top of the project; in the cloud, in the environment settings (see README → Publishing from chat).`);
  }
  let site = GHOST_URL.replace(/\/$/, '');
  // If the site has moved to a new address (the old one forwards), use the new one: a forwarded
  // request loses its key and a forwarded POST turns into a GET. Asked once, without the key.
  let moved;
  const home = () => (moved ??= fetch(`${site}/ghost/api/admin/site/`, {redirect: 'follow', signal: AbortSignal.timeout(20000)})
    .then((r) => { const now = new URL(r.url).origin; if (now !== new URL(site).origin) { console.log(`${which} Ghost site has moved: ${site} -> ${now} (update ${p}_GHOST_URL in .env)`); site = now; } })
    .catch(() => {}));

  const token = () => {
    const [id, secret] = GHOST_ADMIN_API_KEY.split(':');
    const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
    const now = Math.floor(Date.now() / 1000);
    const unsigned = `${b64({alg: 'HS256', typ: 'JWT', kid: id})}.${b64({iat: now, exp: now + 300, aud: '/admin/'})}`;
    return `${unsigned}.${crypto.createHmac('sha256', Buffer.from(secret, 'hex')).update(unsigned).digest('base64url')}`;
  };

  async function call(method, url, body) {
    await home();
    const isForm = body instanceof FormData;
    const res = await fetch(`${site}/ghost/api/admin${url}`, {
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
    get site() { return site; },
    call,
    find,
    async upload(kind, file, type) {
      const form = new FormData();
      form.append('file', new Blob([fs.readFileSync(file)], {type}), path.basename(file));
      const res = await call('POST', `/${kind}/upload/`, form);
      return (res.media ?? res.images ?? res.files)[0].url;
    },
    /** Create or update a post/page by slug, always as a draft unless already live (then refuse). */
    async saveDraft(resource, doc, {updateLive = false} = {}) {
      const cur = await find(resource, doc.slug);
      const live = cur && cur.status !== 'draft';
      if (live && !updateLive) throw new Error(`"${doc.slug}" is already ${cur.status}; refusing to overwrite it. Edit it in Ghost or use a new slug (or, when Shalone asks, npm run publish -- <lesson> --update-live).`);
      // A live post being updated stays published; everything else is saved as a draft.
      const body = {[resource]: [{...doc, ...(live ? {} : {status: 'draft'}), ...(cur ? {updated_at: cur.updated_at} : {})}]};
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
