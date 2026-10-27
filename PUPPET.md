# Handoff: the keyboard puppet (v1 built, 2026-10-24)

**Built (steps 1–6, v1):** a `puppet` scene (`video/scenes/Puppet.tsx`, logic in
`video/puppet.ts`, shared by the studio preview and the render). Timing tab →
+ Add a picture here → Puppet: character (every `<name>-<action>` drawing;
missing poses fall back to the nearest one and are listed), item, size, where
it stands first. Click its block → **● Play it from here** / From the start of
this picture: the video plays and her keys are kept against the playhead
(timing.yml `scenes.<i>.puppet: [[seconds, key, 1|0], …]`; playing again from a
point keeps what came before it). Keys: ← → walk, Shift run, P point (the item
shows beside it), ↑ look up, T talk, A pray, X sign of the cross (plays once),
↓ bow (once), I next item, Esc stops (2026-10-27: hold and point up removed). Tested with stand-in drawings
(deleted); **waiting on her real drawings**. Not done yet: color versions
(below), a turn frame, layered outfits, sketch-mode characters (pixel only).
Each key press re-sends the props to the preview; if playback stutters while
recording, batch those updates.

The design below is what Shalone and Claude agreed on in chat. Read CLAUDE.md first for the rules.
Keep messages short and plain.

## What she wants

**Step 1.** A little game in the studio: a pixel character walks back and
forth like Mario or the Chrome dino. Keys trigger actions (point, talk, hold
an item up, pray...). While a lesson's video plays on the Timing tab she plays
the character and **records her key presses against the playhead**, the way she
records audio, so the timing is exactly right. The render then replays the
recording.

**Step 2.** The same movements for different people (bishop, priest, man in a
suit, woman, nun, monk). A scene picks which character to use.

## Decisions already made (the hold pose, point-up and 16×16 items are replaced by the revised checklist below)

- **Walks across like Mario** (moves over the backdrop), not in place.
- **One drawing per action**, in the existing Pixel art tab, named
  `<character>-<action>`. Separate drawings give each action its own speed and
  frame count. The puppet finds actions **by name**, so the pattern must stay
  exact.
- **Same grid for every character drawing: 8 × 8 (was 32×32), feet on the same row, same
  head height.** That keeps the movement identical across characters.
- **Side views are drawn facing left only.** Right-facing is a flip (the
  editor and renderer already flip). Point-right is a flipped point-left.
- **Front view for the standing actions** (idle-front, talk, hold, pray, cross,
  bow). Side view for moving (idle, walk, run, point, point-up).
- **Items float above raised hands (old Zelda style), not drawn in an arm.**
  The `hold` pose is a front view with both arms raised; the chosen item is a
  separate picture drawn just above the hands. So items never need an arm or
  sleeve, never need recoloring, and can be swapped mid-recording.
- **Item is chosen per scene** (Timing tab), plus an optional key that cycles
  or switches the item mid-recording. One "hold up / lower" key, not a key per
  item.
- **Items: `item-` prefix, 16×16 canvas** (about 10–14 px tall), drawn to fit.
  Do **not** draw big and scale down. Items must render at the **same pixel
  size as the character's pixels** (a 16×16 item shows at half the character's
  width). A big item (Gospel book) may use 24×24; same pixel-size rule.
- **Other characters** are made by copying the guy's drawings (the tab has
  "start from a copy" in the gallery), renaming the prefix, recoloring the
  palette, and editing only head/robe pixels (mitre, veil, hood). Action names
  after the prefix must match exactly. Optional later: layered outfits.
- Turning between side and front: simplest is a cut between views; a single
  "turn" frame is a nice-to-have.
- Holding while walking (processions) is out of scope for v1.

## Her drawing checklist (revised 2026-10-27: 8 × 8 characters)

Her characters are **8 × 8**. That's too small to point up or to hold anything, so:
**look up** replaces point up (↑), and there's no hold pose: while the
character **points** (P), the scene's item appears beside it on the side it
faces. Items are drawn at the characters' pixel size, so an item is a few
pixels on an 8 × 8 grid (`item-<name>`, 8 × 8).

**Bases** (body types she draws every pose for; give every part its own color:
hair, skin, shirt, pants, shoes, eyes, the mustache block):
`skinny-woman`, `thick-woman`, `beard-guy`, `thick-beard-guy`, `thick-guy`,
`skinny-guy`, plus a vestment base (e.g. `vested-guy`) for each body type that
needs a robe (the hem changes the feet, which a recolor can't do).

Poses per base: `-idle`, `-walk`, `-run`, `-point`, `-pray`, `-look-up`
(optional: `-idle-front`, `-talk`, `-cross`, `-bow`).

**Built 2026-10-27: color versions** (Pixel art tab → New character from a base…; her poses are only idle, point, look-up, walk, run). She recolors one
pose of a base (usually idle) and saves it as a new character
(`st-joseph-idle`); the tool compares it with the base pixel by pixel, learns
the color swaps, and writes every other pose of that base with the same
swaps (`st-joseph-walk` …). Never changes her base drawings. It warns when one
base color became two colors (two parts shared a color) and lists base colors
that appear only in poses she didn't recolor. A mustache that isn't wanted is
recolored to skin.

## What to build (suggested order)

Design for the existing code, not a rewrite:

1. **Action sets.** A character = every sprite in `sprites/` named
   `<prefix>-<action>`. List prefixes from `listSprites()` in
   `scripts/sprites.mjs`; a character is "complete" when it has the required
   actions. Show missing ones in the Timing tab picker.
2. **Live puppet in the studio.** A new panel/scene in `studio/timing.js`
   (665 lines; playhead and `T.player` already exist). Keys: left/right to
   walk, a modifier for run, then one key each for point (left/right/up),
   talk, hold, pray, cross, bow; idle by default. Walk across the scene
   backdrop with position kept by the puppet.
3. **Record against the playhead.** While the video plays, log
   `{t, key down/up}` as seconds into the section's recording (same unit
   as `timing.yml`; `secOf()` in `studio/timing.js` already converts frames).
   Save as a `puppet:` list in `timing.yml` next to the other per-slide
   settings. Allow re-record of one slide.
4. **Render.** A new Remotion scene (see `video/scenes/Sprite.tsx` and
   `video/types.ts`) that replays the recording: given the time it works out
   position, facing and current action, then draws that action's frames.
   `scripts/prepare.mjs` copies the character's drawings into the props, as
   it already does for `sprite` scenes. Frame changes use the drawing's own
   `fps` (and the beat when `motion: dance`).
5. **Item.** Item picker per scene; draw the item at the character's pixel
   size above the hands for the `hold` action.
6. **Character picker per scene** (step 2): `character: bishop` on the scene.

## Open questions to ask her

- Pixel-size rule for items needs her ok on a first test.
- Does she want one key to cycle items mid-recording, or only per-scene choice?
- Does she want walk to scroll the backdrop, or the character to cross the
  screen (current assumption: cross the screen like Mario)?

## Notes

- Everything in the Pixel art tab is shared by all lessons
  (`sprites/<name>.json`; see CLAUDE.md → Pixel art tab).
- She doesn't want AI-generated art: **she draws every sprite herself.**
  Claude builds the tooling only; don't generate pixel art for her.

Commit and push to `main` as you go.
