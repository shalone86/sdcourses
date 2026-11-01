"""Render characters from blender/library.blend to transparent PNGs.

  blender --background blender/library.blend --python blender/render.py -- \
      --out characters [--only jesus,nun] [--anims rest,wave,walk] [--size 512] [--manifest]

Writes, per character (slug), for the front view (other views add @<view>: rest@left.png, walk@left/):
  characters/<slug>/rest.png            the character standing (always)
  characters/<slug>/<anim>.png          one pose, held (any pose key: prayer, hands-up, ...)
  characters/<slug>/<anim>/NN.png       a short looping clip (+ clip.json: fps, frames, size)
Views (--views front,left,...): front, front-left, left, back-left, back, back-right, right, front-right.
Animations: idle, walk, wave, talk, and every other shape key as a pose (eases in, holds, eases out).
--manifest writes characters/manifest.json (who is in the library and what each can do) and renders nothing.

Characters face +X; the camera looks at them from +X, orthographic, the same size for everyone
so a bishop and a nun stand at the right heights next to each other. Tall things (crosses) and
props are fitted to the frame instead (manifest says `fit: true`).
"""
import bpy, json, math, mathutils, os, re, sys

argv = sys.argv[sys.argv.index('--') + 1:]
def opt(name, default=None):
    return argv[argv.index(name) + 1] if name in argv else default

OUT = os.path.abspath(opt('--out', 'characters'))
SIZE = int(opt('--size', 512))
FPS = 12
ONLY = [s for s in (opt('--only') or '').split(',') if s]
ANIMS = [s for s in (opt('--anims') or 'rest').split(',') if s]
# Where the camera stands, in degrees round the character (0 = in front of them, they face +X).
# The name says which way they face on screen: 'left' is a profile looking to the left.
VIEW_ANGLE = {'front': 0, 'front-left': 45, 'left': 90, 'back-left': 135, 'back': 180, 'back-right': -135, 'right': -90, 'front-right': -45}
VIEWS = [s for s in (opt('--views') or 'front').split(',') if s]
for _v in VIEWS:
    if _v not in VIEW_ANGLE: raise SystemExit(f'Unknown view "{_v}". Known: {", ".join(VIEW_ANGLE)}')
FRAME_H = 8.6            # world units shown top to bottom for a standing character
FIT_ABOVE = 8.2          # taller than this → fit the frame to it instead

slug_of = lambda s: re.sub(r'[^a-z0-9]+', '-', s.lower()).strip('-')

def library():
    out = []
    for ob in bpy.data.objects:
        if ob.get('sd_category'):
            out.append(ob)
    return sorted(out, key=lambda o: (o['sd_category'], o.name))

def flap_key(part):
    return part.data.shape_keys.key_blocks.get('Flap') if part.data.shape_keys else None

def winged(ob):
    """Has an attached part (wings) with a Flap shape key."""
    return any(flap_key(c) for c in ob.children)

def anims_of(ob):
    """What this one can do: {id: kind}. Poses come from its shape keys."""
    keys = [k.name for k in ob.data.shape_keys.key_blocks[1:]] if ob.data.shape_keys else []
    a = {'idle': 'loop'}
    if winged(ob): a['flap'] = 'loop'
    if 'Walk V1' in keys and 'Walk V2' in keys: a['walk'] = 'loop'
    if 'Wave' in keys: a['wave'] = 'loop'
    if 'Talk' in keys: a['talk'] = 'loop'
    for k in keys:
        if k in ('Walk V1', 'Walk V2', 'Wave', 'Talk'): continue
        a[slug_of(k)] = 'pose'
    return a, {slug_of(k): k for k in keys}

def ease(x): return x * x * (3 - 2 * x)

def clip_values(anim, kind, n, winged=False):
    """Frame i of n → ({key name: value}, bob) for this animation."""
    for i in range(n):
        p = i / n
        if anim == 'idle': yield ({'@flap': 0.25 + 0.25 * math.sin(2 * math.pi * p)} if winged else {}), 0.08 * math.sin(2 * math.pi * p)
        elif anim == 'flap': yield {'@flap': 0.5 - 0.5 * math.cos(2 * math.pi * p)}, 0.18 * math.sin(2 * math.pi * p)
        elif anim == 'walk': yield {'Walk V1': max(0, math.sin(2 * math.pi * p)), 'Walk V2': max(0, -math.sin(2 * math.pi * p))}, 0.14 * abs(math.sin(2 * math.pi * p))
        elif anim == 'wave': yield {'Wave': 0.5 - 0.5 * math.cos(4 * math.pi * p)}, 0
        elif anim == 'talk': yield {'Talk': [0, 1, .3, .9, 0, .7, .2, 1, 0, .8, .4, .9][i % 12]}, 0
        else:  # a pose: ease in, hold, ease out
            third = n / 3
            v = ease(i / third) if i < third else 1 if i < 2 * third else ease(max(0, 1 - (i - 2 * third) / third))
            yield {'@pose': v}, 0

CLIP_FRAMES = {'idle': 12, 'walk': 12, 'wave': 16, 'talk': 12, 'flap': 12}

def write_manifest():
    chars = []
    for ob in library():
        a, _ = anims_of(ob)
        keys = ob.data.shape_keys
        chars.append({'slug': ob.name, 'name': ob['sd_name'], 'category': ob['sd_category'],
                      'origin': ob.get('sd_origin', 'hers'),
                      'fit': bool(ob['sd_category'] == 'prop' or ob.get('sd_fit')),
                      'anims': [{'id': k, 'kind': v} for k, v in a.items()]})
    os.makedirs(OUT, exist_ok=True)
    json.dump({'fps': FPS, 'size': SIZE, 'views': list(VIEW_ANGLE), 'characters': chars}, open(os.path.join(OUT, 'manifest.json'), 'w'), indent=1)
    print(f'@@ manifest: {len(chars)} characters')

if '--manifest' in argv:
    write_manifest(); sys.exit(0)

# ---- a scene of our own: transparent, flat-lit, orthographic from +X ----
sc = bpy.data.scenes.new('render')
bpy.context.window.scene = sc
sc.render.engine = 'BLENDER_EEVEE'
sc.render.film_transparent = True
sc.render.resolution_x = sc.render.resolution_y = SIZE
sc.render.image_settings.file_format = 'PNG'
sc.render.image_settings.color_mode = 'RGBA'
sc.render.image_settings.compression = 90
sc.view_settings.view_transform = 'Standard'
cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam'))
cam.data.type = 'ORTHO'
sc.collection.objects.link(cam)
sc.camera = cam
for rot in [(0.8, 0.2, 0.6), (-0.8, 0.2, 3.6)]:
    sun = bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN'))
    sun.data.energy, sun.rotation_euler = 2.5, rot
    sc.collection.objects.link(sun)
world = bpy.data.worlds.new('w'); world.use_nodes = True
world.node_tree.nodes['Background'].inputs[1].default_value = 1.0
sc.world = world

def bounds(ob):
    dg = bpy.context.evaluated_depsgraph_get()
    eo = ob.evaluated_get(dg)
    pts = [eo.matrix_world @ mathutils.Vector(c) for c in eo.bound_box]
    mn = mathutils.Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    mx = mathutils.Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    return mn, mx

def pose(ob, values, bob=0.0, home=None):
    for part in ob.children:                       # wings and other attached parts
        k = flap_key(part)
        if k: k.value = values.get('@flap', 0.0)
    values = {k: v for k, v in values.items() if not k.startswith('@')}
    if ob.data.shape_keys:
        for k in ob.data.shape_keys.key_blocks[1:]: k.value = 0
        for name, v in values.items():
            if name in ob.data.shape_keys.key_blocks: ob.data.shape_keys.key_blocks[name].value = v
    ob.location = (0, 0, bob)

def shoot(path):
    sc.render.filepath = path
    bpy.ops.render.render(write_still=True)

objects = [o for o in library() if not ONLY or o.name in ONLY]
for ob in objects:
    sc.collection.objects.link(ob)
    for part in ob.children: sc.collection.objects.link(part)
    pose(ob, {})
    bpy.context.view_layer.update()
    mn, mx = bounds(ob)
    size = mx - mn
    centre = (mn + mx) / 2
    fit = ob['sd_category'] == 'prop' or ob.get('sd_fit') or size.z > FIT_ABOVE
    avail, labels = anims_of(ob)
    d = os.path.join(OUT, ob.name)
    os.makedirs(d, exist_ok=True)
    for view in VIEWS:
        ang = math.radians(VIEW_ANGLE[view])
        suffix = '' if view == 'front' else '@' + view
        if fit:
            cam.data.ortho_scale = (max(size.y, size.z) if view == 'front' else max(size.x, size.y, size.z)) * 1.12
            cz = centre.z
        else:
            cam.data.ortho_scale = FRAME_H
            cz = mn.z - 0.4 + FRAME_H / 2        # feet sit just above the bottom edge
        cam.location = (centre.x + 30 * math.cos(ang), centre.y + 30 * math.sin(ang), cz)
        cam.rotation_euler = (math.pi / 2, 0, ang + math.pi / 2)
        for anim in ANIMS:
            if anim == 'rest':
                shoot(os.path.join(d, f'rest{suffix}.png'))
            elif anim in avail:
                if avail[anim] == 'pose':
                    pose(ob, {labels[anim]: 1}); shoot(os.path.join(d, f'{anim}{suffix}.png')); pose(ob, {})
                n = CLIP_FRAMES.get(anim, 18)
                cdir = os.path.join(d, anim + suffix)
                os.makedirs(cdir, exist_ok=True)
                for i, (vals, bob) in enumerate(clip_values(anim, avail[anim], n, winged(ob))):
                    if '@pose' in vals: vals = {labels[anim]: vals['@pose']}
                    pose(ob, vals, bob)
                    shoot(os.path.join(cdir, f'{i + 1:02d}.png'))
                json.dump({'fps': FPS, 'frames': n, 'width': SIZE, 'height': SIZE, 'view': view}, open(os.path.join(cdir, 'clip.json'), 'w'))
                pose(ob, {})
            else:
                print(f'@@ {ob.name} has no animation "{anim}"')
    for part in ob.children: sc.collection.objects.unlink(part)
    sc.collection.objects.unlink(ob)
    print(f'@@ done {ob.name}')
