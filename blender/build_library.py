"""Build the clean character library from Shalone's old working file.

  blender --background sdcharacters.blend --python blender/build_library.py -- blender/library.blend

Reads blender/characters.json (the curated list: one entry per distinct character)
and writes a new .blend with:
  Characters/<slug>  and  Props/<slug>   one collection each, one object each
  - at the origin, rotation 0, rest pose (all shape keys at 0), no leftover animation
  - its own copy of the mesh and materials, named <slug>/<role>, so editing one never changes another
  - marked as an asset (Asset Browser), with the display name and category as properties
The old file is only read, never saved.
"""
import bpy, bmesh, json, mathutils, os, re, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import parts

args = sys.argv[sys.argv.index('--') + 1:]
OUT = os.path.abspath(args[0])
CURATION = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'characters.json')
entries = json.load(open(CURATION))

top = {'character': bpy.data.collections.new('Characters'), 'prop': bpy.data.collections.new('Props')}
made, skipped = 0, []
built = {}       # slug -> the clean object, so a later entry can derive from it
STANDARD_H, STANDARD_MIN, STANDARD_MAX = 6.6, 6.2, 9.0   # a plain character is 6.43 tall; hair, hats and crowns add to it

scratch = bpy.data.scenes.new('measure')
bpy.context.window.scene = scratch
def bounds(ob):
    scratch.collection.objects.link(ob)
    bpy.context.view_layer.update()
    eo = ob.evaluated_get(bpy.context.evaluated_depsgraph_get())
    pts = [eo.matrix_world @ mathutils.Vector(c) for c in eo.bound_box]
    scratch.collection.objects.unlink(ob)
    return (mathutils.Vector((min(p[i] for p in pts) for i in range(3))), mathutils.Vector((max(p[i] for p in pts) for i in range(3))))

def recolor(slug, role, rgb):
    mat = bpy.data.materials[f'{slug}/{role}']
    for n in mat.node_tree.nodes:
        if n.type == 'BSDF_PRINCIPLED':
            n.inputs['Base Color'].default_value = (*rgb, 1.0)

HALO_MIN_Z = 0.9     # halo faces above this height (world units) are the ring over the head; lower ones are robes that glow

def head_box(ob, exclude=()):
    """The head's box in world units, measured from the eyes so it also works on a scaled-down figure:
    from the top of the head down to a head's height below it. The width comes from hair and beard
    (they surround the head); a part of the model that only looks like hair (a cross) can be excluded."""
    sz = ob.scale.z
    me = ob.data
    roles = [s.material.name.split('/')[-1].lower() if s.material else '' for s in ob.material_slots]
    def verts(keys):
        return {v for p in me.polygons if roles[p.material_index] not in exclude and any(k in roles[p.material_index] for k in keys) for v in p.vertices}
    head = verts(('skin', 'hair', 'beard', 'eyes'))
    top = max(me.vertices[v].co.z for v in head) * sz
    eyes = [me.vertices[v].co.z * sz for p in me.polygons if 'eyes' in roles[p.material_index] for v in p.vertices if me.vertices[v].co.z * sz < top - 0.2]
    low = top - 2.2 * (top - sum(eyes) / len(eyes))
    around = verts(('hair', 'beard')) or head
    pts = [me.vertices[v].co * sz for v in around if me.vertices[v].co.z * sz > low]
    return (mathutils.Vector((min(p[i] for p in pts) for i in range(3))), mathutils.Vector((max(p[i] for p in pts) for i in range(3))))

def fix_materials(slug, fixes):
    """Per-material corrections, e.g. {"Hair": {"emission_strength": 0}} to stop a hair material glowing."""
    for role, f in fixes.items():
        for n in bpy.data.materials[f'{slug}/{role}'].node_tree.nodes:
            if n.type == 'BSDF_PRINCIPLED' and 'emission_strength' in f:
                n.inputs['Emission Strength'].default_value = f['emission_strength']

def top_levels(ob, count=4):
    sz = ob.scale.z
    lv = {}
    for v in ob.data.vertices: lv[round(v.co.z * sz, 2)] = lv.get(round(v.co.z * sz, 2), 0) + 1
    return [(z, lv[z]) for z in sorted(lv, reverse=True)[:count]]

def squash_top(ob, above, to):
    """Push down anything above `above` (a hair block that stood up under the old halo) to height `to`,
    in the base shape and in every shape key, so it keeps moving with the head."""
    sz = ob.scale.z
    me = ob.data
    idx = [v.index for v in me.vertices if v.co.z * sz > above]
    dz = (max(me.vertices[i].co.z for i in idx) * sz - to) / sz
    for i in idx: me.vertices[i].co.z -= dz
    if me.shape_keys:
        for kb in me.shape_keys.key_blocks:
            for i in idx: kb.data[i].co.z -= dz
    print(f'@@ {ob.name}: pushed {len(idx)} points down by {dz * sz:.2f}')

def remove_halo_faces(ob, extra_roles=()):
    """Delete the faces on any 'halo' material (her halos sat right on top of the hair), keeping the shape keys."""
    slots = [i for i, slot in enumerate(ob.material_slots) if slot.material and any(k in slot.material.name.split('/')[-1].lower() for k in ('halo', *extra_roles))]
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    sz = ob.scale.z
    faces = [f for f in bm.faces if f.material_index in slots and min(v.co.z for v in f.verts) * sz > HALO_MIN_Z]
    bmesh.ops.delete(bm, geom=faces, context='FACES')
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context='VERTS')
    bm.to_mesh(ob.data)
    bm.free()
    keys = ob.data.shape_keys
    assert not keys or all(len(k.data) == len(ob.data.vertices) for k in keys.key_blocks), 'shape keys went out of step'
    print(f'@@ {ob.name}: removed {len(faces)} halo faces; top levels now {top_levels(ob)}')

def height(ob):
    """How tall it really stands (shape keys at rest, scale applied)."""
    scratch.collection.objects.link(ob)
    bpy.context.view_layer.update()
    eo = ob.evaluated_get(bpy.context.evaluated_depsgraph_get())
    zs = [(eo.matrix_world @ mathutils.Vector(c)).z for c in eo.bound_box]
    scratch.collection.objects.unlink(ob)
    return max(zs) - min(zs)


# The old file already has objects called "nun", "bishop"... Move them out of the way so the
# clean names are free.
originals = {o.name: o for o in bpy.data.objects}
for o in originals.values():
    o.name = 'old:' + o.name

for e in entries:
    src = built.get(e['derive']) if e.get('derive') else originals.get(e.get('source'))
    if src is None:
        skipped.append(e['slug']); continue
    slug = e['slug']
    ob = src.copy()
    ob.data = src.data.copy()
    ob.name, ob.data.name = slug, slug
    if ob.animation_data: ob.animation_data_clear()
    ob.parent = None
    ob.location, ob.rotation_euler = (0, 0, 0), (0, 0, 0)
    ob.hide_render = ob.hide_viewport = False
    keys = ob.data.shape_keys
    if keys:
        keys.name = f'{slug} poses'
        if keys.animation_data: keys.animation_data_clear()
        for k in keys.key_blocks:
            k.value = 0.0
    # Some copies in the old file were scaled very small or very large. Bring any character that
    # isn't already a normal height to the standard one so everyone stands at the same size.
    if e['category'] == 'character' and not e.get('fit'):
        h = height(ob)
        if not (STANDARD_MIN <= h <= STANDARD_MAX):
            ob.scale = [s * STANDARD_H / h for s in ob.scale]
            print(f'@@ resized {slug}: {h:.2f} -> {height(ob):.2f}')
    # Own copy of each material, named for its job (skin, Hair, robe color 1 ...).
    copies = {}
    for i, slot in enumerate(ob.material_slots):
        m = slot.material
        if m is None: continue
        if m.name not in copies:
            c = m.copy()
            c.name = f"{slug}/{re.sub(r'[.]\d+$', '', m.name.split('/')[-1])}"
            copies[m.name] = c
        ob.data.materials[i] = copies[m.name]
    if e.get('float_halo'):
        remove_halo_faces(ob, [r.lower() for r in e.get('halo_also_on', [])])
    if e.get('material_fix'):
        fix_materials(slug, e['material_fix'])
    if e.get('squash_top'):
        squash_top(ob, *e['squash_top'])
    for role, rgb in (e.get('recolor') or {}).items():
        recolor(slug, role, rgb)
    col = bpy.data.collections.new(slug)
    col.objects.link(ob)
    built[slug] = ob
    for part in e.get('parts', []):
        if part == 'halo' and e.get('float_halo'):
            mn, mx = head_box(ob, [r.lower() for r in e.get('head_exclude', [])])
            if e.get('halo_above_all'): mx = mx.copy(); mx.z = bounds(ob)[1].z   # a crown or hat sits above the hair   # sized and placed from the head, not the whole body
            parts.halo(ob, mn, mx, slug, head_width=mx.y - mn.y)
        else:
            mn, mx = bounds(ob)
            parts.PARTS[part](ob, mn, mx, slug)
    top[e['category']].children.link(col)
    ob['sd_name'] = e['name']
    ob['sd_category'] = e['category']
    ob['sd_origin'] = e.get('origin', 'hers')   # hers | scaffold (blocked out by Claude for her to shape)
    if e.get('fit'): ob['sd_fit'] = True
    if e.get('also'): ob['sd_also_was'] = ', '.join(e['also'])
    ob.asset_mark()
    ob.asset_data.description = e['name']
    ob.asset_data.tags.new(e['category'])
    made += 1

ids = set(top.values())
for c in top.values(): c.use_fake_user = True
bpy.data.libraries.write(OUT, ids, compress=True)
print(f'@@ wrote {made} to {OUT}; skipped {skipped}')
