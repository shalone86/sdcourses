// Image search for the studio: free, credit-tracked sources. Each adapter
// returns the same shape, so the page can show one grid:
//   {source, id, title, creator, license, licenseUrl, page, thumb, full, width, height, download?}
// Only sources that need no API key: her gallery (sdcason.com), Wikimedia
// Commons, the Art Institute of Chicago and the Cleveland Museum of Art.
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';

const UA = 'sdcourses-lesson-studio/1.0 (https://courses.sdcason.com; Shalone Cason)';
const get = async (url, headers = {}) => {
  const res = await fetch(url, {headers: {'User-Agent': UA, Accept: 'application/json', ...headers}, signal: AbortSignal.timeout(15000)});
  if (!res.ok) throw new Error(`${new URL(url).host} answered ${res.status}`);
  return res.json();
};
let sdcasonKey = null;
const strip = (html) => String(html ?? '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;|&#160;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();

export const SOURCES = {
  wikimedia: {label: 'Wikimedia Commons', key: null, async search(q, _key, page = 0) {
    const url = 'https://commons.wikimedia.org/w/api.php?' + new URLSearchParams({action: 'query', format: 'json', generator: 'search', gsrnamespace: '6',
      gsrsearch: `${q} filetype:bitmap`, gsrlimit: '24', gsroffset: String(page * 24), prop: 'imageinfo', iiprop: 'url|size|extmetadata', iiurlwidth: '480', origin: '*'});
    const d = await get(url);
    return Object.values(d.query?.pages ?? {}).map((p) => {
      const i = p.imageinfo?.[0] ?? {};
      const m = i.extmetadata ?? {};
      return {source: 'wikimedia', id: String(p.pageid), title: strip(m.ObjectName?.value) || p.title.replace(/^File:|\.\w+$/g, ''), creator: strip(m.Artist?.value) || 'Unknown',
        license: strip(m.LicenseShortName?.value) || 'See page', licenseUrl: m.LicenseUrl?.value ?? '', page: i.descriptionurl, thumb: i.thumburl, full: i.url, width: i.width, height: i.height};
    }).filter((x) => x.thumb && /\.(jpe?g|png|webp|tiff?)(\?|$)/i.test(x.full));
  }},
  // The Met: its search API answers 410 Gone (checked 2026-10-17); add it back if it returns.
  sdcason: {label: 'The Free Catholic Gallery (sdcason.com)', key: null, async search(q, _key, page = 0) {
    // Her own Ghost site: the read-only Content API key it already publishes for its search box.
    sdcasonKey ??= (async () => {
      const html = await (await fetch('https://sdcason.com/', {headers: {'User-Agent': UA}})).text();
      const k = /data-key="([0-9a-f]{20,})"/.exec(html)?.[1];
      if (!k) throw new Error('could not find the gallery\'s search key');
      return k;
    })().catch((e) => { sdcasonKey = null; throw e; });
    const key = await sdcasonKey;
    const safe = q.replace(/['"\\]/g, ' ').trim();
    const filter = `feature_image:-null+(title:~'${safe}',tag:~'${safe}',custom_excerpt:~'${safe}')`;
    const d = await get(`https://sdcason.com/ghost/api/content/posts/?key=${key}&limit=24&page=${page + 1}&fields=id,title,url,feature_image,custom_excerpt&filter=${encodeURIComponent(filter)}`);
    return (d.posts ?? []).map((p) => ({source: 'sdcason', id: p.id, title: p.title, creator: 'The Free Catholic Gallery', license: 'Public domain (per the gallery)', licenseUrl: '',
      page: p.url, thumb: p.feature_image.replace('/content/images/', '/content/images/size/w600/'), full: p.feature_image}));
  }},
  artic: {label: 'Art Institute of Chicago', key: null, async search(q, _key, page = 0) {
    const d = await get(`https://api.artic.edu/api/v1/artworks/search?q=${encodeURIComponent(q)}&query[term][is_public_domain]=true&fields=id,title,artist_display,image_id,thumbnail&limit=24&page=${page + 1}`);
    const base = d.config?.iiif_url ?? 'https://www.artic.edu/iiif/2';
    return (d.data ?? []).filter((a) => a.image_id).map((a) => ({source: 'artic', id: String(a.id), title: a.title, creator: strip(a.artist_display).split('\n')[0] || 'Unknown',
      license: 'Public domain (CC0)', licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/', page: `https://www.artic.edu/artworks/${a.id}`,
      thumb: `${base}/${a.image_id}/full/400,/0/default.jpg`, full: `${base}/${a.image_id}/full/1686,/0/default.jpg`}));
  }},
  cleveland: {label: 'Cleveland Museum of Art', key: null, async search(q, _key, page = 0) {
    const d = await get(`https://openaccess-api.clevelandart.org/api/artworks/?q=${encodeURIComponent(q)}&has_image=1&cc0=1&limit=24&skip=${page * 24}`);
    return (d.data ?? []).filter((a) => a.images?.web?.url).map((a) => ({source: 'cleveland', id: String(a.id), title: a.title, creator: a.creators?.[0]?.description || a.culture?.[0] || 'Unknown',
      license: 'Public domain (CC0)', licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/', page: a.url, thumb: a.images.web.url, full: a.images.print?.url ?? a.images.web.url}));
  }},
  // Sources that need API keys (Rijksmuseum, Pexels, Pixabay, Unsplash) were left out on purpose: no keys to manage.
};

/** Which sources are usable (and why not). */
export function sourceList() {
  return Object.entries(SOURCES).map(([id, s]) => ({id, label: s.label, ready: !s.key || !!process.env[s.key], needs: s.key}));
}

/** Search one source, or every ready one ("all"). Failures of one source don't hide the others. */
export async function searchImages(q, source = 'all', page = 0) {
  const ids = source === 'all' ? Object.keys(SOURCES).filter((k) => !SOURCES[k].key || process.env[SOURCES[k].key]) : [source];
  const out = await Promise.all(ids.map(async (id) => {
    const s = SOURCES[id];
    if (!s) return {id, error: 'Unknown source'};
    if (s.key && !process.env[s.key]) return {id, error: `Add ${s.key} to .env to search ${s.label}`};
    try { return {id, results: await s.search(q, process.env[s.key ?? ''], page)}; } catch (e) { return {id, error: e.message}; }
  }));
  return {results: out.flatMap((o) => o.results ?? []), errors: out.filter((o) => o.error).map((o) => `${SOURCES[o.id]?.label ?? o.id}: ${o.error}`)};
}

/**
 * Bring a chosen image into the lesson: download, shrink to video size (max 1920 wide, JPEG),
 * save as <lesson>/images/<name>.jpg and record its credit in images/credits.json.
 * Returns the scene path ("images/<name>.jpg") and the credit.
 */
export async function importImage(dir, img) {
  if (!SOURCES[img.source]) throw new Error('Unknown source');
  const allowed = new URL(img.full).protocol === 'https:';
  if (!allowed) throw new Error('Only https images');
  const res = await fetch(img.full, {headers: {'User-Agent': UA}});
  if (!res.ok) throw new Error(`Couldn't download the image (${res.status})`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > 60e6) throw new Error('That image is too large');
  const imagesDir = path.join(dir, 'images');
  fs.mkdirSync(imagesDir, {recursive: true});
  const base = `${img.source}-${String(img.title || 'image').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'image'}-${String(img.id).replace(/[^a-z0-9]/gi, '').slice(-10)}`;
  const raw = path.join(imagesDir, `.${base}.download`);
  const out = path.join(imagesDir, `${base}.jpg`);
  fs.writeFileSync(raw, buf);
  try {
    execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', raw, '-vf', "scale='min(1920,iw)':-2", '-q:v', '3', '-frames:v', '1', out]);
  } finally { fs.rmSync(raw, {force: true}); }
  const [w, h] = String(execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', out])).trim().split(',').map(Number);
  const credit = {file: `images/${base}.jpg`, aspect: Math.round((w / h) * 1000) / 1000, title: img.title, creator: img.creator, source: SOURCES[img.source].label, license: img.license, license_url: img.licenseUrl, page: img.page};
  const creditsFile = path.join(imagesDir, 'credits.json');
  const all = fs.existsSync(creditsFile) ? JSON.parse(fs.readFileSync(creditsFile, 'utf8')) : {};
  all[credit.file] = credit;
  fs.writeFileSync(creditsFile, JSON.stringify(all, null, 2));
  return credit;
}

/** A picture from her own Mac: shrink to video size, save in the lesson's images/ and record it as her own. */
export function importUpload(dir, buf, filename) {
  if (!buf.length) throw new Error('That file is empty');
  const imagesDir = path.join(dir, 'images');
  fs.mkdirSync(imagesDir, {recursive: true});
  const stem = String(filename || 'picture').replace(/\.[a-z0-9]+$/i, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'picture';
  const base = `mine-${stem}-${Date.now().toString(36)}`;
  const raw = path.join(imagesDir, `.${base}.upload`);
  const out = path.join(imagesDir, `${base}.jpg`);
  fs.writeFileSync(raw, buf);
  try {
    execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', raw, '-vf', "scale='min(1920,iw)':-2", '-q:v', '3', '-frames:v', '1', out]);
  } catch { throw new Error('That doesn\'t look like a picture the studio can read (try JPG, PNG or WebP)'); } finally { fs.rmSync(raw, {force: true}); }
  const [w, h] = String(execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', out])).trim().split(',').map(Number);
  const credit = {file: `images/${base}.jpg`, aspect: Math.round((w / h) * 1000) / 1000, title: String(filename || 'Picture').slice(0, 80), creator: 'Shalone Cason', source: 'Her own picture', license: '', license_url: '', page: '', own: true};
  const creditsFile = path.join(imagesDir, 'credits.json');
  const all = fs.existsSync(creditsFile) ? JSON.parse(fs.readFileSync(creditsFile, 'utf8')) : {};
  all[credit.file] = credit;
  fs.writeFileSync(creditsFile, JSON.stringify(all, null, 2));
  return credit;
}
