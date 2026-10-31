# Battles: game scenes for videos (and, later, a playable game)

A **battle** is a small PICO-8-style world: a tile map, units that walk and fight, a camera
and captions, all driven by a plain list of timed events. It becomes video footage (a `battle`
scene in a lesson, or a clip of its own). The rules are PICO-8's on purpose (8 × 8 cells,
whole-pixel positions, one anchor per sprite, a 16-color palette), so a battle file can later
be converted into a PICO-8 cart (like `scripts/midi2pico8.mjs` does for music).

Read CLAUDE.md first for the rules. Keep messages short and plain.

## Files

- `battles/<name>.yml`: the battle (try `battles/tours.yml`).
- `video/battle.ts`: the engine. Everything is a pure function of the time, so the preview
  and the render agree exactly.
- `video/scenes/Battle.tsx`: draws it (`type: battle`, and the `Battle` composition for a clip).
- `scripts/battles.mjs`: loads a battle and the drawings it uses from `sprites/`.
- `npm run battle -- <name>`: renders `dist/battles/<name>.mp4`.
  `--still <seconds>` makes one picture to look at; `--out <file>` picks the file.
  In the cloud container: `REMOTION_BROWSER=/opt/pw-browsers/chromium-1243/chrome-linux64/chrome`.
- In a lesson: a picture of `type: battle` with `battle: tours` (prepare.mjs adds the file and
  its drawings to the props). Optional `palette: own` keeps her colors; the default snaps them
  to PICO-8's 16.

## The battle file

```yaml
name: tours
view: [16, 9]            # cells shown: 16 × 9 is 128 × 72 pixels (16:9, scales to 1080p exactly)
tiles: {g: tile-grass, h: tile-hill, …}   # map character → drawing
map: ["gggg…", …]        # one character per 8 × 8 cell (any size; the camera scrolls)
props: [{sprite: prop-tent, at: [2, 5]}]  # scenery
units:                   # id, kind, start cell (bottom-left of the drawing), face, speed (px/s)
  - {id: fr1, kind: frank-spearman, at: [22, 4]}
script:                  # times in seconds
  - {t: 13, unit: rd1, move: [[20, 4]]}        # walk/ride along the points
  - {t: 14.7, unit: rd1, act: attack, dur: 0.8}  # attack, point, fall (stays down)
  - {t: 14.8, fx: spark, at: [21, 4]}          # one-shot effect (spark, dust)
  - {t: 5, camera: [12, 2], dur: 5}            # slide the view (cells, top-left); follow: <id> tracks a unit
  - {t: 11, say: "…", dur: 5}                  # caption (who: optional name above it)
```

Units also take `face: left|right` and `show: true|false` events. `note:` on any line is for
people reading the file (sources, what is uncertain) and is never shown.

**Armies (colors without new drawings):** draw each kind of soldier once; `armies:` gives each side
its colors and a unit's `side:` puts it in one, in every pose. A unit's own `colors:` go over its army's.

```yaml
armies:
  franks: {name: Franks, colors: {"#29ADFF": "#FF004D"}}   # drawn color → this army's color
units:
  - {id: fr1, kind: spearman, at: [22, 4], side: franks}
```

In the Battles tab: the **Armies** card (+ Add army, one color box per color of its soldiers,
"same as" squares), **Army** when placing a person, and "Colors for just …" on a selected person.
"Save as a character…" keeps one as real drawings (every pose) when she'll reuse it.

## Drawings (her art, shared with the cart)

Her drawings face **left** (facing right is a flip). A unit's drawings are `<kind>-<action>`:
`idle`, `walk` (or `gallop`/`ride` for riders), `attack`, `point`, `fall`. Missing actions fall
back to `idle`. Characters are 8 × 8; riders (horse and rider) 16 × 16; tiles 8 × 8
(`tile-<name>`); scenery `prop-<name>`; effects `fx-<name>` (play once).

**Stand-ins:** the first Tours drawings are crude placeholders marked `"standin": true`
in their JSON. Draw the real one in the Pixel art tab under the same name and it replaces
the stand-in. Run `grep -l '"standin"' sprites/*.json` to list the ones still to redraw.

## Studio: the Battles tab

Lesson Studio → **Battles** (not tied to a lesson). Pick a battle or **+ New battle**; paint tiles,
place people and things, drag them, and scrub the preview (the same Remotion player as the video).
The script lines are listed under the map; each has an editor, and map spots are picked by clicking.
**Play a person:** choose someone, press *Record from the playhead*, and walk them with the arrow
keys while the battle plays (A attack, P point, F fall, S spark, D dust, Esc stops). Their later
lines are replaced; *Undo that recording* brings them back. **Save** writes `battles/<name>.yml`.

In a lesson: Timing tab → + Add a picture here → **Battle**, pick the battle and the window
(`clip: [from, to]` seconds), so one battle can fill the 4–5 slides of a lesson. `label` lines put
name tags on people or places (intro slide).

## Not built yet

- The PICO-8 tactics cart (turn-based, Fire Emblem style) and the converter from battle files to
  levels.
- Contested history stays hedged: Tours' exact site and any raid on the camp are uncertain
  (see the notes in `battles/tours.yml`).
