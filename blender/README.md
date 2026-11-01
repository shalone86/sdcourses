# Blender characters

Shalone's low-poly characters, organized so the Lesson Studio can use them.

```
blender/library.blend      the clean library (57 items, ~5 MB): Characters/<slug>, Props/<slug>
blender/characters.json    the curated list: slug, display name, category, which object in the old file it came from
blender/build_library.py   builds library.blend from the old working file (sdcharacters.blend)
blender/render.py          draws stills and looping clips (also writes characters/manifest.json)
characters/manifest.json   who is in the library and what each can do
characters/<slug>/rest.png a still of each character standing
characters/<slug>/<anim>/  a clip (NN.png frames + clip.json), drawn on demand
scripts/characters.mjs     the studio's helper (list, draw on demand, copy into a lesson's video)
```

## Open it in Blender
Open `blender/library.blend`. Each character is one object in its own collection, named by
its slug, at the origin, in rest pose, facing +X, with its own materials (`<slug>/skin`,
`<slug>/Hair`, ...) and its own shape keys (poses). They are marked as assets, so they show
in the Asset Browser. The library is the source of truth now; the old `sdcharacters.blend` is
only needed to rebuild from scratch.

## Add or change a character
1. Edit it in `library.blend` (or append a new object into a `Characters/<slug>` collection).
   Give it shape keys like the others; the key names become its animations. Set custom
   properties `sd_name` (display name) and `sd_category` (`character` or `prop`); `sd_fit` fits
   the camera to it (crosses, tall pieces).
2. Save, then `npm run characters -- --manifest` (updates what each can do) and
   `npm run characters -- --all-rest` (redraws the stills; or draw one with `--only` through render.py).
3. Delete `characters/<slug>/<anim>/` to redraw a clip after changing a character.

## Views
Every clip can be drawn from eight angles: `front` (default), `front-left`, `left`, `back-left`, `back`,
`back-right`, `right`, `front-right`. The name is the way the character faces on screen (`right` is a
profile looking right, so a walk that crosses the screen left to right uses it). Other views are saved
as `rest@left.png` and `walk@right/`. Draw one with `npm run characters -- jesus walk@right`.
Her faces are flat planes on the front of a cube head, so profiles and back views show hair and no face.

## Animations
`idle`, `walk` (Walk V1/V2 + bob), `wave`, `talk` loop; every other shape key is a pose that
eases in, holds and eases out (`prayer`, `hands-up`, `point-forward`, `happy`, `kneel-head-down`...).
Clips are 12 fps PNG frames, 512x512, transparent. Standing characters share one camera size,
so heights match across characters; props and crosses are fitted instead.

## Rebuild from the old file
`npm run characters -- --build /path/to/sdcharacters.blend` (reads `characters.json`; only reads
the old file). Characters that were scaled very small or large in the old file are brought to the
standard height (6.6 units).

## Scaffolds (drafts)
An entry in `characters.json` can be built from another one: `derive` (a slug built earlier),
`recolor` ({material name: [r, g, b]}), and `parts` (`halo`, `wings`, from `blender/parts.py`).
Anything Claude blocked out is `"origin": "scaffold"`: it shows as a draft in the studio picker until
Shalone reshapes it and removes that line. Attached parts are child objects with their own shape keys;
a key called `Flap` gives the character a `flap` clip. Current scaffold: `angel` (the plain robed
base with a halo bar and blocked-out wings built from the same heavily bevelled chunks as her hands and feet, in `parts.py`; `_chunk` is that shape). Shape the wings, face and robe in Blender, then delete
`"origin": "scaffold"` and rebuild the manifest.

Halos: her old halos sat right on top of the hair. An entry with `"float_halo": true, "parts": ["halo"]`
has those faces deleted (only halo faces above the head, so glowing robes stay) and gets a floating gold
halo sized and placed from the head (measured from the eyes). `squash_top: [above, to]` pushes down the hair
block that stood up under the old halo, in every shape key. `halo_also_on` lists extra materials her old halo
used (Saint Nicholas: Eyes); `head_exclude` lists materials that only look like hair (Christ on the Cross:
Hair.001 is the top of the cross). Done for every character that had one: `jesus`, `ancient-saint-with-halo`, `risen-christ-floating`,
`christ-on-cross`, `saint-nicholas`, `mary-of-egypt`, `nun`, `nun-2`, `saint-peter-2`,
`ancient-queen-princess` (`halo_above_all`: it floats over her crown) and the angel.  `material_fix` corrects a material, e.g. `christ-on-cross` Hair was set to glow (emission 5)
and showed orange; it is 0 now.

Left out on purpose: the old file also had `Jesus.xx` and `nun` copies squashed to paper-thin depth (x scale
about 0.02). Those were flat drawn-icon stand-ins, not characters, so they are not in the library.

## Notes
- Several names in `characters.json` are plain (`ancient-robe-guy-2`, `girl-3`): rename `slug`/`name` there
  and rebuild, or rename the object in `library.blend` and update the manifest.
- `pen` was dropped (empty geometry); `thomas aquinas.001` was an empty stub.
- `shalone-talk-long` and `-2` are only a head and hands in the old file.
- Blender isn't needed on the Mac that records; it is only needed to draw a clip that hasn't been drawn.
