// COPY of Angelio's MagicaVoxel reader (shalone86/angelio hub/public/js/vox.js). Keep the two the same.
// MagicaVoxel files (.vox), read for the Studio's Drawings page, the Worker's checks and the games.
// A file holds models (each with its size and its voxels: x, y, z and a color number 1–255), a palette of 256
// colors, and a scene that says which model shows in which frame. MagicaVoxel's animations are keyframes: a frame
// shows the model of the latest keyframe at or before it, a copied frame points at the same model again, and old
// models it no longer uses can stay in the file. So frames are read from the scene (nTRN/nGRP/nSHP and META
// _anim_range), not from the list of models; a file with no scene (older MagicaVoxel) is one frame per model.
// MagicaVoxel's z is up; games turn that into their own y (see toScene).
// Pure: no DOM, used in the browser, the Worker and the tests.

export const MAX_VOX_BYTES = 2_000_000;

// MagicaVoxel's own palette, used when a file has no RGBA chunk (as 0xAABBGGRR numbers).
const DEFAULT = [0x00000000, 0xffffffff, 0xffccffff, 0xff99ffff, 0xff66ffff, 0xff33ffff, 0xff00ffff, 0xffffccff, 0xffccccff, 0xff99ccff, 0xff66ccff, 0xff33ccff, 0xff00ccff, 0xffff99ff, 0xffcc99ff, 0xff9999ff,
  0xff6699ff, 0xff3399ff, 0xff0099ff, 0xffff66ff, 0xffcc66ff, 0xff9966ff, 0xff6666ff, 0xff3366ff, 0xff0066ff, 0xffff33ff, 0xffcc33ff, 0xff9933ff, 0xff6633ff, 0xff3333ff, 0xff0033ff, 0xffff00ff,
  0xffcc00ff, 0xff9900ff, 0xff6600ff, 0xff3300ff, 0xff0000ff, 0xffffffcc, 0xffccffcc, 0xff99ffcc, 0xff66ffcc, 0xff33ffcc, 0xff00ffcc, 0xffffcccc, 0xffcccccc, 0xff99cccc, 0xff66cccc, 0xff33cccc,
  0xff00cccc, 0xffff99cc, 0xffcc99cc, 0xff9999cc, 0xff6699cc, 0xff3399cc, 0xff0099cc, 0xffff66cc, 0xffcc66cc, 0xff9966cc, 0xff6666cc, 0xff3366cc, 0xff0066cc, 0xffff33cc, 0xffcc33cc, 0xff9933cc,
  0xff6633cc, 0xff3333cc, 0xff0033cc, 0xffff00cc, 0xffcc00cc, 0xff9900cc, 0xff6600cc, 0xff3300cc, 0xff0000cc, 0xffffff99, 0xffccff99, 0xff99ff99, 0xff66ff99, 0xff33ff99, 0xff00ff99, 0xffffcc99,
  0xffcccc99, 0xff99cc99, 0xff66cc99, 0xff33cc99, 0xff00cc99, 0xffff9999, 0xffcc9999, 0xff999999, 0xff669999, 0xff339999, 0xff009999, 0xffff6699, 0xffcc6699, 0xff996699, 0xff666699, 0xff336699,
  0xff006699, 0xffff3399, 0xffcc3399, 0xff993399, 0xff663399, 0xff333399, 0xff003399, 0xffff0099, 0xffcc0099, 0xff990099, 0xff660099, 0xff330099, 0xff000099, 0xffffff66, 0xffccff66, 0xff99ff66,
  0xff66ff66, 0xff33ff66, 0xff00ff66, 0xffffcc66, 0xffcccc66, 0xff99cc66, 0xff66cc66, 0xff33cc66, 0xff00cc66, 0xffff9966, 0xffcc9966, 0xff999966, 0xff669966, 0xff339966, 0xff009966, 0xffff6666,
  0xffcc6666, 0xff996666, 0xff666666, 0xff336666, 0xff006666, 0xffff3366, 0xffcc3366, 0xff993366, 0xff663366, 0xff333366, 0xff003366, 0xffff0066, 0xffcc0066, 0xff990066, 0xff660066, 0xff330066,
  0xff000066, 0xffffff33, 0xffccff33, 0xff99ff33, 0xff66ff33, 0xff33ff33, 0xff00ff33, 0xffffcc33, 0xffcccc33, 0xff99cc33, 0xff66cc33, 0xff33cc33, 0xff00cc33, 0xffff9933, 0xffcc9933, 0xff999933,
  0xff669933, 0xff339933, 0xff009933, 0xffff6633, 0xffcc6633, 0xff996633, 0xff666633, 0xff336633, 0xff006633, 0xffff3333, 0xffcc3333, 0xff993333, 0xff663333, 0xff333333, 0xff003333, 0xffff0033,
  0xffcc0033, 0xff990033, 0xff660033, 0xff330033, 0xff000033, 0xffffff00, 0xffccff00, 0xff99ff00, 0xff66ff00, 0xff33ff00, 0xff00ff00, 0xffffcc00, 0xffcccc00, 0xff99cc00, 0xff66cc00, 0xff33cc00,
  0xff00cc00, 0xffff9900, 0xffcc9900, 0xff999900, 0xff669900, 0xff339900, 0xff009900, 0xffff6600, 0xffcc6600, 0xff996600, 0xff666600, 0xff336600, 0xff006600, 0xffff3300, 0xffcc3300, 0xff993300,
  0xff663300, 0xff333300, 0xff003300, 0xffff0000, 0xffcc0000, 0xff990000, 0xff660000, 0xff330000, 0xff0000ee, 0xff0000dd, 0xff0000bb, 0xff0000aa, 0xff000088, 0xff000077, 0xff000055, 0xff000044,
  0xff000022, 0xff000011, 0xff00ee00, 0xff00dd00, 0xff00bb00, 0xff00aa00, 0xff008800, 0xff007700, 0xff005500, 0xff004400, 0xff002200, 0xff001100, 0xffee0000, 0xffdd0000, 0xffbb0000, 0xffaa0000,
  0xff880000, 0xff770000, 0xff550000, 0xff440000, 0xff220000, 0xff110000, 0xffeeeeee, 0xffdddddd, 0xffbbbbbb, 0xffaaaaaa, 0xff888888, 0xff777777, 0xff555555, 0xff444444, 0xff222222, 0xff111111];
const hex = (r, g, b) => "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");

/**
 * Read a .vox file (ArrayBuffer or Uint8Array). Returns {frames: [{size: [x, y, z], voxels: [[x, y, z, c], …]}], palette}
 * where c is the color number (1–255) and palette[c] is its "#rrggbb". Throws an Error with a plain message.
 */
export function readVox(input) {
  const u8 = input instanceof Uint8Array ? input : new Uint8Array(input);
  if (u8.length < 20) throw new Error("That file is empty.");
  if (u8.length > MAX_VOX_BYTES) throw new Error("That file is too big (2 MB at most).");
  const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  const id = (o) => String.fromCharCode(u8[o], u8[o + 1], u8[o + 2], u8[o + 3]);
  const damaged = () => new Error("That .vox file looks damaged.");
  if (id(0) !== "VOX ") throw new Error("That isn't a MagicaVoxel (.vox) file.");
  if (id(8) !== "MAIN") throw damaged();
  // strings and dictionaries inside scene chunks
  const str = (o) => { const n = dv.getUint32(o, true); if (o + 4 + n > u8.length) throw damaged(); let t = ""; for (let i = 0; i < n; i++) t += String.fromCharCode(u8[o + 4 + i]); return [t, o + 4 + n]; };
  const dict = (o) => { const n = dv.getUint32(o, true); o += 4; const d = {}; for (let i = 0; i < n; i++) { let k, v; [k, o] = str(o); [v, o] = str(o); d[k] = v; } return [d, o]; };
  const models = [], nodes = new Map();
  let size = null, rgba = null, range = null;
  let o = 20 + dv.getUint32(12, true);
  const end = Math.min(u8.length, o + dv.getUint32(16, true));
  while (o + 12 <= end) {
    const cid = id(o), n = dv.getUint32(o + 4, true), kids = dv.getUint32(o + 8, true), at = o + 12;
    if (at + n > u8.length) throw new Error("That .vox file is cut short.");
    if (cid === "SIZE") size = [dv.getUint32(at, true), dv.getUint32(at + 4, true), dv.getUint32(at + 8, true)];
    else if (cid === "XYZI") {
      if (!size) throw damaged();
      const count = dv.getUint32(at, true);
      if (4 + count * 4 > n) throw damaged();
      const voxels = [];
      for (let i = 0; i < count; i++) { const p = at + 4 + i * 4; voxels.push([u8[p], u8[p + 1], u8[p + 2], u8[p + 3]]); }
      models.push({ size, voxels });
    } else if (cid === "RGBA") {
      rgba = [];
      for (let i = 0; i < 255; i++) rgba.push(hex(u8[at + i * 4], u8[at + i * 4 + 1], u8[at + i * 4 + 2]));
    } else if (cid === "META") {
      const r = /^(-?\d+)\s+(-?\d+)$/.exec(dict(at)[0]._anim_range ?? "");
      if (r) range = [Number(r[1]), Number(r[2])];
    } else if (cid === "nTRN") {
      const [, q] = dict(at + 4);
      const child = dv.getInt32(q, true), count = dv.getUint32(q + 12, true), keys = [];
      let r = q + 16;
      for (let i = 0; i < count; i++) { let d; [d, r] = dict(r); keys.push({ f: Number(d._f ?? 0), t: (d._t ?? "0 0 0").split(/\s+/).map(Number) }); }
      nodes.set(dv.getUint32(at, true), { kind: "trn", child, keys });
    } else if (cid === "nGRP") {
      const [, q] = dict(at + 4);
      const count = dv.getUint32(q, true), children = [];
      for (let i = 0; i < count; i++) children.push(dv.getUint32(q + 4 + i * 4, true));
      nodes.set(dv.getUint32(at, true), { kind: "grp", children });
    } else if (cid === "nSHP") {
      const [, q] = dict(at + 4);
      const count = dv.getUint32(q, true), keys = [];
      let r = q + 4;
      for (let i = 0; i < count; i++) { const model = dv.getUint32(r, true); let d; [d, r] = dict(r + 4); keys.push({ f: Number(d._f ?? 0), model }); }
      nodes.set(dv.getUint32(at, true), { kind: "shp", keys });
    }
    o = at + n + kids;
  }
  if (!models.length) throw new Error("That .vox file has nothing in it.");
  const palette = [null, ...(rgba ?? DEFAULT.slice(1).map((v) => hex(v & 255, (v >>> 8) & 255, (v >>> 16) & 255)))];
  if (!nodes.size) return { frames: models, palette }; // no scene: one frame per model

  // The keyframe at or before frame f (keys sorted by f); the first one before the first keyframe.
  const at = (keys, f) => { let k = keys[0]; for (const x of keys) if (x.f <= f) k = x; return k; };
  for (const nd of nodes.values()) if (nd.keys) nd.keys.sort((a, b) => a.f - b.f);
  const shapes = [...nodes.values()].filter((nd) => nd.kind === "shp");
  const last = Math.max(0, ...shapes.flatMap((sh) => sh.keys.map((k) => k.f)));
  const [first, final] = range && range[1] >= range[0] ? range : [0, last];
  if (final - first > 255) throw new Error("That animation is too long (256 frames at most).");
  // Every frame: walk the scene from the root (node 0), adding up each transform's move, and place each shape's
  // model there (MagicaVoxel puts a model's middle at its transform).
  const raw = [];
  for (let f = first; f <= final; f++) {
    const out = [], seen = new Set();
    const walk = (nid, ox, oy, oz) => {
      const nd = nodes.get(nid);
      if (!nd || seen.has(nid)) return;
      seen.add(nid);
      if (nd.kind === "trn") { const t = nd.keys.length ? at(nd.keys, f).t : [0, 0, 0]; walk(nd.child, ox + (t[0] || 0), oy + (t[1] || 0), oz + (t[2] || 0)); }
      else if (nd.kind === "grp") nd.children.forEach((c) => walk(c, ox, oy, oz));
      else if (nd.keys.length) {
        const m = models[at(nd.keys, f).model];
        if (!m) throw damaged();
        const [hx, hy, hz] = m.size.map((v) => Math.floor(v / 2));
        for (const [x, y, z, c] of m.voxels) out.push([x - hx + ox, y - hy + oy, z - hz + oz, c]);
      }
    };
    walk(0, 0, 0, 0);
    raw.push(out);
  }
  // One box that fits every frame, so the model doesn't jump between frames. With a single object (her characters),
  // that's the model's own box (8 × 8 × 8 stays 8 × 8 × 8); with several objects, the box around all of them.
  let frames;
  if (shapes.length === 1) {
    const used = shapes[0].keys.map((k) => models[k.model]).filter(Boolean);
    const box = [0, 1, 2].map((i) => Math.max(...used.map((m) => m.size[i])));
    frames = [];
    for (let f = first; f <= final; f++) {
      const m = models[at(shapes[0].keys, f).model];
      // (a smaller model sits in the middle of the box, as MagicaVoxel centers it)
      const pad = [0, 1, 2].map((i) => Math.floor(box[i] / 2) - Math.floor(m.size[i] / 2));
      frames.push({ size: box, voxels: m.voxels.map(([x, y, z, c]) => [x + pad[0], y + pad[1], z + pad[2], c]) });
    }
  } else {
    const all = raw.flat();
    if (!all.length) throw new Error("That .vox file has nothing in it.");
    const lo = [0, 1, 2].map((i) => Math.min(...all.map((v) => v[i]))), hi = [0, 1, 2].map((i) => Math.max(...all.map((v) => v[i])));
    const box = [0, 1, 2].map((i) => hi[i] - lo[i] + 1);
    frames = raw.map((vs) => ({ size: box, voxels: vs.map(([x, y, z, c]) => [x - lo[0], y - lo[1], z - lo[2], c]) }));
  }
  return { frames, palette };
}

/** A short description for lists: "3 frames, 8 × 8 × 8". */
export function voxSummary(v) {
  const s = v.frames[0].size;
  return `${v.frames.length} frame${v.frames.length === 1 ? "" : "s"}, ${s[0]} × ${s[1]} × ${s[2]}`;
}

/**
 * One frame's voxels ready for a 3D scene: [x, y, z, "#color"] with y up, the model centered on x and z and
 * standing on y = 0, facing the viewer (MagicaVoxel's front, -y, becomes +z).
 */
export function toScene(v, f = 0) {
  const { size, voxels } = v.frames[f];
  return voxels.map(([x, y, z, c]) => [x - size[0] / 2 + 0.5, z + 0.5, -(y - size[1] / 2 + 0.5), v.palette[c] ?? "#ff00ff"]);
}
