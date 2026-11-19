// Her voxel characters: MagicaVoxel models (.vox) she uploads on Angelio's Drawings page (angelio.org/studio/draw/),
// one file per pose (priest-idle, priest-walk-slow…), each with its speed. That's their one home; this studio keeps a
// copy so videos render the same every time and work offline:
//   voxels/<slug>.vox      the model, as uploaded
//   voxels/index.json      {slug: {saved, fps, frames, size}}: what's here (from angelio.org/api/art)
// syncVoxels() brings over new and changed ones (the studio does it when the Timing tab asks; or `npm run voxels`).
// A `voxel` scene ({type: 'voxel', voxel: 'priest-walk-slow', view, move, size, caption}) gets the model in `art`
// from voxelArt(), and video/voxel-draw.js draws it.
import fs from 'node:fs';
import path from 'node:path';
import {ROOT} from './lib.mjs';
import {readVox} from './vox.mjs';

export const VOXELS = path.join(ROOT, 'voxels');
const INDEX = path.join(VOXELS, 'index.json');
const SITE = (process.env.ANGELIO_URL || 'https://angelio.org').replace(/\/$/, '');
const slugOk = (s) => /^[a-z0-9][a-z0-9-]{0,59}$/.test(String(s ?? ''));

export const readIndex = () => { try { return JSON.parse(fs.readFileSync(INDEX, 'utf8')); } catch { return {}; } };

let last = 0, running = null;
/**
 * Copy new and changed models from angelio.org into voxels/. Returns {added, changed, removed, offline}.
 * At most once every 20 seconds (the Timing tab asks often); `force` skips that wait.
 */
export function syncVoxels({force = false} = {}) {
  if (running) return running;
  if (!force && Date.now() - last < 20000) return Promise.resolve({added: [], changed: [], removed: [], skipped: true});
  running = (async () => {
    const out = {added: [], changed: [], removed: [], offline: false};
    let list;
    try {
      const r = await fetch(`${SITE}/api/art`, {signal: AbortSignal.timeout(10000)});
      if (!r.ok) throw new Error('HTTP ' + r.status);
      list = (await r.json()).voxels ?? {};
    } catch { out.offline = true; return out; }
    fs.mkdirSync(VOXELS, {recursive: true});
    const index = readIndex();
    for (const [slug, v] of Object.entries(list)) {
      if (!slugOk(slug)) continue;
      const have = index[slug];
      const file = path.join(VOXELS, `${slug}.vox`);
      if (have?.saved !== v.saved || !fs.existsSync(file)) {
        const r = await fetch(`${SITE}/api/art/vox?slug=${slug}&v=${encodeURIComponent(v.saved)}`, {signal: AbortSignal.timeout(20000)});
        if (!r.ok) continue;
        const bytes = new Uint8Array(await r.arrayBuffer());
        try { readVox(bytes); } catch { continue; } // (a broken file stays out)
        fs.writeFileSync(file, bytes);
        (have ? out.changed : out.added).push(slug);
      }
      index[slug] = {saved: v.saved, fps: v.fps ?? 4, frames: v.frames, size: v.size};
    }
    // Removed there: kept here (a lesson may still use it), but marked.
    for (const slug of Object.keys(index)) if (!list[slug] && !index[slug].removed) { index[slug].removed = true; out.removed.push(slug); }
    for (const slug of Object.keys(list)) if (index[slug]) delete index[slug].removed;
    fs.writeFileSync(INDEX, JSON.stringify(index, null, 1) + '\n');
    last = Date.now();
    return out;
  })().finally(() => { running = null; });
  return running;
}

/** Every model here, for the Timing tab: [{slug, who, pose, fps, frames, size, removed}]. */
export function listVoxels() {
  const index = readIndex();
  return Object.entries(index).filter(([slug]) => fs.existsSync(path.join(VOXELS, `${slug}.vox`))).sort(([a], [b]) => a.localeCompare(b))
    .map(([slug, v]) => {
      // priest-mass-walk → who "priest mass", pose "walk" (the pose is the last word, or the last two for walk-fast etc.)
      const m = /^(.*?)-((?:walk|run)-(?:fast|slow)|[a-z]+)$/.exec(slug);
      return {slug, who: (m ? m[1] : slug).replace(/-/g, ' '), pose: (m ? m[2] : '').replace(/-/g, ' '), fps: v.fps ?? 4, frames: v.frames, size: v.size, ...(v.removed ? {removed: true} : {})};
    });
}

/** A model as the video draws it (see video/voxel-draw.js). */
export function voxelArt(slug) {
  if (!slugOk(slug)) throw new Error(`"${slug}" isn't a voxel model name`);
  const file = path.join(VOXELS, `${slug}.vox`);
  if (!fs.existsSync(file)) throw new Error(`No voxel model "${slug}" here yet. Upload it on angelio.org/studio/draw/, then open the Timing tab (or run npm run voxels) to bring it over.`);
  const vox = readVox(new Uint8Array(fs.readFileSync(file)));
  return {kind: 'voxel', fps: readIndex()[slug]?.fps ?? 4, size: vox.frames[0].size, palette: vox.palette, frames: vox.frames.map((f) => f.voxels)};
}

// npm run voxels: bring over new and changed models now.
if (import.meta.url === `file://${process.argv[1]}`) {
  const r = await syncVoxels({force: true});
  if (r.offline) console.log(`Couldn't reach ${SITE}; the models here stay as they are.`);
  else console.log(`Voxel models: ${r.added.length} new, ${r.changed.length} changed${r.removed.length ? `, ${r.removed.length} removed there (kept here)` : ''}. ${listVoxels().length} in voxels/.`);
}
