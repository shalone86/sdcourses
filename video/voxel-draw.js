// Draw one of her MagicaVoxel models (a `voxel` scene; art made by scripts/voxels.mjs) on a 2D canvas, at any angle.
// No 3D library: each block's faces that can be seen are painted as flat shapes, the far ones first, with a light
// from the upper left. The video (video/scenes/Voxel.tsx), the Timing tab's preview and the studio's picker all
// use this one file, so they look the same.
//
// art: {kind: 'voxel', fps, size: [x, y, z], palette: [null, '#rrggbb', …], frames: [[[x, y, z, color], …], …]}
// (MagicaVoxel's numbers: z is up and the model's front looks toward -y, at the viewer.)

/** Which way they face (degrees; turning toward the right of the screen is positive). */
export const VIEWS = {front: 0, 'front-right': 35, right: 90, 'back-right': 145, back: 180, 'back-left': -145, left: -90, 'front-left': -35};
export const VIEW_NAMES = {front: 'Facing you', 'front-right': 'Turned a little to the right', right: 'Side, looking right', 'back-right': 'Turned away, to the right',
  back: 'Back to you', 'back-left': 'Turned away, to the left', left: 'Side, looking left', 'front-left': 'Turned a little to the left'};
const PITCH = 0.42; // looking down a little (radians)
const LIGHT = norm([-0.45, 0.8, 0.5]); // in the camera's terms: from the upper left, in front

function norm(v) { const l = Math.hypot(...v); return v.map((x) => x / l); }
const shade = (hex, k) => {
  const n = parseInt(hex.slice(1), 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.max(0, Math.min(255, Math.round(v * k))));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
};

// The six faces: the neighbor (in MagicaVoxel's numbers) that hides it, its direction (x right, y up, z toward the
// viewer, before turning) and its four corners (offsets from the block's middle).
const FACES = [
  {n: [1, 0, 0], d: [1, 0, 0], c: [[.5, -.5, -.5], [.5, -.5, .5], [.5, .5, .5], [.5, .5, -.5]]},
  {n: [-1, 0, 0], d: [-1, 0, 0], c: [[-.5, -.5, .5], [-.5, -.5, -.5], [-.5, .5, -.5], [-.5, .5, .5]]},
  {n: [0, 0, 1], d: [0, 1, 0], c: [[-.5, .5, -.5], [.5, .5, -.5], [.5, .5, .5], [-.5, .5, .5]]},
  {n: [0, -1, 0], d: [0, 0, 1], c: [[-.5, -.5, .5], [.5, -.5, .5], [.5, .5, .5], [-.5, .5, .5]]},
  {n: [0, 1, 0], d: [0, 0, -1], c: [[.5, -.5, -.5], [-.5, -.5, -.5], [-.5, .5, -.5], [.5, .5, -.5]]},
];

const cache = new WeakMap();
/** Every frame at one angle as painted shapes in model units: [{pts: [[x, y] ×4], fill}] in drawing order, plus the bounds of all frames. */
function shapes(art, yawDeg) {
  let byYaw = cache.get(art);
  if (!byYaw) cache.set(art, (byYaw = new Map()));
  if (byYaw.has(yawDeg)) return byYaw.get(yawDeg);
  const t = (yawDeg * Math.PI) / 180, cos = Math.cos(t), sin = Math.sin(t), cp = Math.cos(PITCH), sp = Math.sin(PITCH);
  const [sx, sy] = art.size;
  // turn about the up axis, then look down a little: [screen x, screen y (down), nearness]
  const turn = ([X, Y, Z]) => [X * cos + Z * sin, Y, -X * sin + Z * cos];
  const see = ([X, Y, Z]) => { const [xr, y, zr] = turn([X, Y, Z]); return [xr, -y * cp + zr * sp, zr * cp + y * sp]; };
  const view = [0, sp, cp];
  const faces = FACES.map((f) => { const d = turn(f.d); return {...f, front: d[0] * view[0] + d[1] * view[1] + d[2] * view[2] > 1e-6, light: 0.58 + 0.42 * Math.max(0, d[0] * LIGHT[0] + d[1] * LIGHT[1] + d[2] * LIGHT[2])}; });
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const frames = art.frames.map((voxels) => {
    const filled = new Set(voxels.map((v) => v[0] + ',' + v[1] + ',' + v[2]));
    const cubes = [];
    for (const [x, y, z, c] of voxels) {
      const fill = art.palette[c] || '#ff00ff';
      const mid = [x - sx / 2 + 0.5, z + 0.5, -(y - sy / 2 + 0.5)];
      const polys = [];
      for (const f of faces) {
        if (!f.front || filled.has((x + f.n[0]) + ',' + (y + f.n[1]) + ',' + (z + f.n[2]))) continue;
        const pts = f.c.map(([a, b, d]) => see([mid[0] + a, mid[1] + b, mid[2] + d]));
        for (const [px, py] of pts) { x0 = Math.min(x0, px); x1 = Math.max(x1, px); y0 = Math.min(y0, py); y1 = Math.max(y1, py); }
        polys.push({pts: pts.map(([px, py]) => [px, py]), fill: shade(fill, f.light)});
      }
      if (polys.length) cubes.push({depth: see(mid)[2], polys});
    }
    cubes.sort((a, b) => a.depth - b.depth);
    return cubes.flatMap((cb) => cb.polys);
  });
  const out = {frames, bounds: {x: x0, y: y0, w: x1 - x0 || 1, h: y1 - y0 || 1}};
  byYaw.set(yawDeg, out);
  return out;
}

/** How wide and tall (model units) it is at this angle, all frames together. */
export function voxelBounds(art, view = 'front') { return shapes(art, VIEWS[view] ?? Number(view) ?? 0).bounds; }

/**
 * Paint frame `i` into the box {x, y, w, h} (canvas pixels): as big as fits, centered, standing on the box's bottom.
 * `view` is a name from VIEWS or a number of degrees. Returns the size of one block in pixels.
 */
export function drawVoxels(ctx, art, i, box, view = 'front') {
  const {frames, bounds} = shapes(art, typeof view === 'number' ? view : VIEWS[view] ?? 0);
  const s = Math.min(box.w / bounds.w, box.h / bounds.h);
  const ox = box.x + (box.w - bounds.w * s) / 2 - bounds.x * s, oy = box.y + box.h - bounds.h * s - bounds.y * s;
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(0.6, s * 0.04); // a hairline of the same color closes the gaps between faces
  for (const {pts, fill} of frames[((i % frames.length) + frames.length) % frames.length]) {
    ctx.beginPath();
    pts.forEach(([px, py], k) => (k ? ctx.lineTo : ctx.moveTo).call(ctx, ox + px * s, oy + py * s));
    ctx.closePath();
    ctx.fillStyle = fill; ctx.strokeStyle = fill;
    ctx.fill(); ctx.stroke();
  }
  return s;
}
