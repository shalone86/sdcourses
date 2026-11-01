"""Attachable parts for characters built from other characters (see build_library.py `parts`).

These are SCAFFOLDS: plain blocked-out shapes in the library's faceted style, placed from the
character's measured body so Shalone can reshape them. They are marked sd_origin = 'scaffold'
and show as a draft in the studio until she says otherwise.

A part is a child object of the character (same collection) with its own shape keys; a key called
"Flap" on a child makes the character a `flap` animation (render.py).
"""
import bpy, bmesh, math, mathutils
from mathutils import Matrix, Vector


def _material(name, rgb, glow=0.0):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    bsdf.inputs['Base Color'].default_value = (*rgb, 1.0)
    if glow:
        bsdf.inputs['Emission Color'].default_value = (*rgb, 1.0)
        bsdf.inputs['Emission Strength'].default_value = glow
    return m


def _box(bm, size, centre, rot_x=0.0):
    """One slab: size (x, y, z), turned about X by rot_x, with its centre at `centre`."""
    m = Matrix.Translation(Vector(centre)) @ Matrix.Rotation(rot_x, 4, 'X') @ Matrix.Diagonal(Vector((*size, 1.0)))
    return bmesh.ops.create_cube(bm, size=1.0, matrix=m)['verts']


def _chunk(bm, size, centre, rot_x=0.0, rot_z=0.0):
    """One of her hand/foot blocks: a cube with the bevel pushed nearly all the way (24 points, 26 faces,
    each flat face about a third of the width), stretched to `size`, turned and placed at `centre`."""
    t = bmesh.new()
    bmesh.ops.create_cube(t, size=2.0)
    bmesh.ops.bevel(t, geom=list(t.edges), offset=0.667, offset_type='OFFSET', segments=1, affect='EDGES')
    m = (Matrix.Translation(Vector(centre)) @ Matrix.Rotation(rot_z, 4, 'Z') @ Matrix.Rotation(rot_x, 4, 'X')
         @ Matrix.Diagonal(Vector((size[0] / 2, size[1] / 2, size[2] / 2, 1.0))))
    made = {v: bm.verts.new(m @ v.co) for v in t.verts}
    for f in t.faces:
        bm.faces.new([made[v] for v in f.verts])
    t.free()
    return list(made.values())


def _finish(name, bm, parent, material):
    me = bpy.data.meshes.new(name)
    bm.normal_update()
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(name, me)
    me.materials.append(material)
    ob.parent = parent
    ob.matrix_parent_inverse = parent.matrix_basis.inverted()   # the part is built in world units; keep it that size when the character is scaled
    ob['sd_part'] = True
    ob['sd_origin'] = 'scaffold'
    for c in parent.users_collection:
        c.objects.link(ob)
    return ob


def halo(parent, mn, mx, slug, head_width=None):
    """A flat square ring floating above the head (seen edge-on from the front, like hers).
    mn/mx are the head's box; with head_width the ring is sized to the head (0.74 of its width)."""
    bm = bmesh.new()
    cy, cx = (mn.y + mx.y) / 2, (mn.x + mx.x) / 2
    outer = 2.0 if head_width is None else min(0.74 * head_width, 2.2)
    inner, thick = 0.725 * outer, 0.07 * outer
    z = mx.z + 0.225 * outer
    band = (outer - inner) / 2
    for dx, dy, sx, sy in [(0, (outer + inner) / 4, outer, band), (0, -(outer + inner) / 4, outer, band),
                           ((outer + inner) / 4, 0, band, inner), (-(outer + inner) / 4, 0, band, inner)]:
        _box(bm, (sx, sy, thick), (cx + dx, cy + dy, z))
    return _finish(f'{slug}-halo', bm, parent, _material(f'{slug}/halo gold', (0.95, 0.62, 0.05), glow=0.6))


def wings(parent, mn, mx, slug, feathers=4, flap_degrees=32):
    """Two wings behind the shoulders, four stacked slabs each, fanned out. Shape key "Flap" raises them."""
    bm = bmesh.new()
    cy = (mn.y + mx.y) / 2
    root_x = mn.x + 0.25                    # just behind the back
    root_z = mn.z + 3.25                    # shoulder height
    root_y = 0.9
    # A bulge at the shoulder, then chunky blocks fanning out and up, longest and lowest first.
    _chunk(bm, (0.9, 1.5, 1.7), (root_x, cy + root_y, root_z + 0.1))
    for i in range(feathers):
        length, width = 2.9 - 0.45 * i, 1.15 - 0.1 * i
        rise = math.radians(6 + 16 * i)     # the top block points highest
        centre = (root_x, cy + root_y + 0.4 + math.cos(rise) * length / 2, root_z + math.sin(rise) * length / 2 - 0.3 * i)
        _chunk(bm, (0.6, length, width), centre, rot_x=rise)
    # The left wing is the right one mirrored across the body's middle (y = cy).
    for f in list(bm.faces):
        pts = [Vector((v.co.x, 2 * cy - v.co.y, v.co.z)) for v in f.verts][::-1]
        bm.faces.new([bm.verts.new(p) for p in pts])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    ob = _finish(f'{slug}-wings', bm, parent, _material(f'{slug}/wings', (0.55, 0.75, 1.0), glow=0.45))
    ob.shape_key_add(name='Basis')
    key = ob.shape_key_add(name='Flap')
    a = math.radians(flap_degrees)
    for v, k in zip(ob.data.vertices, key.data):
        side = 1 if v.co.y > cy else -1
        pivot = Vector((root_x, cy + side * root_y, root_z))
        k.co = pivot + Matrix.Rotation(side * a, 3, 'X') @ (v.co - pivot)
    return ob


PARTS = {'halo': halo, 'wings': wings}
