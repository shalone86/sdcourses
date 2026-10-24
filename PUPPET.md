# Handoff: the keyboard puppet (idea stage, 2026-10-24)

Nothing is built yet. This is the design Shalone and Claude agreed on in chat,
so the next session can start building. Read CLAUDE.md first for the rules.
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

## Decisions already made

- **Walks across like Mario** (moves over the backdrop), not in place.
- **One drawing per action**, in the existing Pixel art tab, named
  `<character>-<action>`. Separate drawings give each action its own speed and
  frame count. The puppet finds actions **by name**, so the pattern must stay
  exact.
- **Same grid for every character drawing: 32×32, feet on the same row, same
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

## Her drawing checklist

Character prefix `guy-` (use `bishop-`, `nun-` ... for the others).

Side view, facing left (moving):
- [ ] `guy-idle` (2 frames)
- [ ] `guy-walk` (4; start from `sprites/man-walk-cycle.json`, which is 32×32, 4 frames)
- [ ] `guy-run` (4, faster fps)
- [ ] `guy-point` (1–2; flipped for right)
- [ ] `guy-point-up` (2)

Front view (standing):
- [ ] `guy-idle-front` (2)
- [ ] `guy-talk` (2: mouth closed and open)
- [ ] `guy-hold` (1–2: both arms raised)
- [ ] `guy-pray` (2)
- [ ] `guy-cross` (4: sign of the cross)
- [ ] `guy-bow` (3)

Items, shared by everyone (16×16, 1 frame; censer 2 so it swings):
- [ ] `item-icon`
- [ ] `item-gospel`
- [ ] `item-chalice`
- [ ] `item-bread`
- [ ] `item-candle`
- [ ] `item-censer`

About 26 body frames per character, drawn once; items drawn once for all.

Why these actions: counting words across all nine lessons, "icon" (33),
"pray" (21), "points" (19), "gospel" (8), "holds" (6), "chalice" (6) and
"sign of the cross" (2) come up most.

**Test before drawing the rest:** put the first item next to the finished
`guy-hold` pose. If the scale is off, fix it, then size the other items to match.

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
