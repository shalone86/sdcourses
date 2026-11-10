# sdcourses

Shalone Cason's Catholic courses: each lesson is one `lesson.yml` that becomes
a Ghost post, a quiz, and a narrated explainer video. Shalone works in chat;
Claude does the file work. Start a lesson with `/lesson` (see
`.claude/skills/lesson/SKILL.md`). **Current state and next job:
HANDOFF.md.**

## Branch names

Name a branch for the work, in plain words: `game/4-player-grace-piles`, not `claude/happy-lovelace-ote8op` or `ccr-…`. If a session starts on an automatic name, rename it (`git branch -m`) before pushing or opening a PR.

## Who decides what (never cross these lines)

- **Shalone chooses** the topic (and the music, or the course's track).
  Claude finds 3–5 anchor quotations and builds the script; she can swap,
  cut, or ask for more quotes, and her call is final.
- **Shalone writes the intro and outro.** Give her facts in `notes`, never
  prose. Her fixed lines are always in them (the template and the studio's
  New lesson put them in): the intro ends "I'm your host Shalone Cason, and let's begin in the name of the Father and of the Son and of the Holy Spirit."
  and the outro ends "Thanks for learning with us. I've been your host Shalone, and until next time, stay holy, my friends." If she dictates text in chat, use her words as given (ask before
  fixing more than a typo).
- **Shalone approves.** Only set `status: reviewed` when she explicitly says the
  lesson is approved. Publishing creates Ghost **drafts** only; she presses
  Publish in Ghost.

## Content rules

- Every point stands on one direct quotation (`quote.text`) from a primary
  source: Scripture (NABRE, bible.usccb.org), the Catechism (vatican.va), the
  Catholic Encyclopedia (newadvent.org), or another source she approves.
  Wikipedia is `reference: true`: background only, never quoted.
- Christ – Our Pascha (the Ukrainian Catholic catechism) is free online; every source entry for it carries both
  `file: sources-local/ugcc-catechism.txt` (the check reads this) and `url: https://ukrcatholic.org/fileadmin/user_upload/PDFs/Our_Faith/Christ-our-Pascha-Catechism-of-the-Ukrainian-Catholic-Church-by-Comission-for-the-Catehism-z-lib.org_.pdf` (the post links to it).
- Copy quotations exactly. `npm run check -- <course>/<lesson>` must pass.
- Explanations: 60–100 words, plain, no flourishes. Whole lesson ~550–650 words.
- Quizzes: one or more per point, mixing `choice`, `truefalse`, and `blank`.
- Every intro opens the same way: `title`, then `host` (her photo) at "I'm your
  host", then `trinity` at "in the name of the Father" (templates/lesson.yml has it).
- Don't state contested history more confidently than the sources do.
- Kids style: `style: kids` in course.yml (or a lesson.yml) gives bright
  colors, the rounded Fredoka font, bouncing shapes, and scenes and items
  background shapes moving to the music's beat (`scripts/beats.mjs`, cached
  as `music/<track>.beats.json`). `motion: dance` (music videos) also makes
  the pictures, headings and her video bounce, snaps them to the beat, and
  shows the beats as dots in the Timing tab; the default `calm` is for
  explainers.
- Guide characters: her pixel characters (`sprites/`: idle, walk, run, look up, point; a
  `sprite` scene can be flipped) are fun guides, like Crash Course or Kurzgesagt, especially
  for kids. They guide and react; they never stand for a whole idea. Things like a chalice or the
  Eucharist get a real picture (Wikimedia etc.) or a 2D shape sketch (like the iconostasis). She
  adjusts everything in the Timing tab.
- Battles (BATTLES.md): `type: battle` scenes are PICO-8-style game footage (tile map, units, camera) built from
  `battles/<name>.yml` and her 8 × 8 drawings; `npm run battle -- <name>` renders one alone. Stand-in drawings are
  marked `"standin": true`; she redraws them under the same names. Keep contested history hedged.
- Maps can highlight `areas:`: a country (Natural Earth name or a common one,
  "United States"), a continent, a group of countries (EU, NATO, BRICS…;
  members as of 2025), or an empire (approximate, at about its peak; those
  show "Borders approximate"). The list is `video/data/areas.json` (plus the
  older `video/data/empires.ts`); add new ones there. With areas and no
  `region:`, a map fits itself to them (`region: auto`); regions also include
  world, africa, asia, americas, oceania and more.

## Commands (all take `<course>/<lesson-folder>`)

| command | does |
|---|---|
| `npm run new -- course <slug> "<Title>"` | scaffold a course |
| `npm run new -- lesson <course> "<Title>"` | scaffold the next lesson |
| `npm run check` | verify quotations against sources |
| `npm run stills` | contact sheet of every scene (`dist/…/contact-sheet.jpg`) |
| `npm run prepare-lesson` | timing + `recording-script.md` |
| `npm run render` | `lesson.mp4` + `poster.jpg` (several minutes; run in background) |
| `npm run post` | `post.html` + `preview.html` |
| `npm run publish` | upload video, save Ghost draft post (gated); `--update-live` replaces an already published lesson in place, only when she asks |
| `npm run publish-course -- <course>` | create/update the course tag in Ghost |
| `npm run publish-page -- <name>` | save `pages/<name>.md` as a Ghost draft page |
| `npm run studio-export` / `studio-import` | sync a lesson with the Lesson Studio |
| `npm run characters -- <character> <animation>` | draw a Blender character's clip now (the studio does it on demand); `-- --manifest`, `-- --all-rest`, `-- --build <old.blend>` (see `blender/README.md`) |
| `npm run split -- <c>/<l> <file>` | split a one-take recording into sections |
| `npm run song -- <name>` | make a music video from `songs/<name>/` (`dist/songs/<name>/<name>.mp4`) |

Rendering on the Mac needs nothing extra (Remotion downloads its own
Chrome). In the cloud container, prefix with
`REMOTION_BROWSER=$(ls -d /opt/pw-browsers/chromium_headless_shell-*/*/headless_shell | head -1)`.

Ghost publishing needs `COURSES_GHOST_URL` and `COURSES_GHOST_ADMIN_API_KEY`
(the courses site, not Shalone's other Ghost site). Kids lessons (`style:
kids`) also go to kids.methodiusmedia.com with `KIDS_GHOST_URL` and
`KIDS_GHOST_ADMIN_API_KEY` (skipped, with a note, until those are set). There
the post is built from Ghost's own cards (`buildKidsSitePost`): video, an
accent "Quiz" header, one toggle per question, the words in a toggle. Tags
there, in this order: the series (`series:`, else the course title) **first** (the
first tag is the primary one; the page uses it to pick which other videos to show
automatically), then Catholic Kids Video Lessons, Byzantine Catholic Lessons too
for `tradition: byzantine`, and `#project` (her collection pages need it).
Kids thumbnails (`video/KidsThumb.tsx`) always use her own corner shapes from
`thumb-shapes/` (PNG or SVG, transparent background; `corner-<tl|tr|bl|br>-…`
names are flush corner pieces, the rest free blobs; one per corner, chosen at
random from the title). Wrapped titles: the small lead ("WHAT DOES") sits over the title block's right
edge when the drawing is on the left, else centered over it, and shorter title
lines are centered under the longest (her Affinity fix; the block is only as wide
as its longest line). They keep all text and art inside the middle
(x 190–1090): the home page crops them to ~4:3 from the center. The words toggle is rewritten in
the post's lexical after saving (Ghost flattens toggle paragraphs). For kids, prefer short quotations (an exact short passage that carries
the meaning) over long ones. On the Mac they go in
`.env` at the repo root (gitignored; `scripts/lib.mjs` loads it); in the
cloud, in the environment settings. Never ask Shalone to paste the key
into chat; she types it into the file herself.

## Lesson Studio (her editor and recorder)

A local page on her Mac: `npm start` (or double-click `Lesson Studio.command`)
runs `studio/server.mjs` and opens http://localhost:5178 (`studio/index.html`).
It must be local: browsers only allow the microphone on localhost. It runs
as a login background item (`studio/launchd/com.sdcourses.studio.plist`,
installed with `npm run studio-autostart`): it starts at login and restarts
if it stops; logs in `~/Library/Logs/sdcourses-studio.log`. After changing
studio or script code, `npm run studio-restart` (don't start a second copy).
If it's already running, `npm start` just opens the page.

- **Home and the tabs:** a fresh start opens on Home (`homeView` in studio/index.html): the last lesson with
  its three tabs (Script & recording, Timing, Video & Ghost), Open another lesson, + New lesson,
  and a card for each tool (Pixel art, Battles, Town, Music videos, Pico Parish; `TOOLS`). A refresh reopens
  where she was (`sessionStorage['studio.open']` tells the two apart). Off Home, every tab is across the
  top after ← Home (the three lesson tabs, then the tools), so she switches straight between them; a
  lesson's title shows only on its own tabs. A new tool gets a tab there and a card on Home.
- **Script & recording:** one slide per section. Her edits are saved straight
  into lesson.yml (`applyEdits` in `scripts/studio.mjs` splices only the
  changed text), then the quote check runs. Changing the script of an
  approved lesson sets it back to `status: draft`. Quotations are locked.
- **Recording:** per slide, or one take with Next taps as the cut points.
  Each section ends up as `audio/<section>.wav`, with the browser's original
  beside it (`.webm`, or `.m4a` from Safari; a one take keeps `take.webm`).
- **Keys:** R/F19 record (F19 also presses Yes on an "Are you sure?"), F17/F18 change
  slide, F16 scrolls down the slide (back to the top at the bottom). (A prompter mode was tried
  and removed at her request; don't bring it back unasked.)
- **Camera:** "Record my video too" (in the Microphone panel) records her
  webcam with the voice. Clips go to `<lesson>/camera/` (gitignored: her
  face stays off the public repo, so it exists only on this Mac); a
  voice-only re-record drops that slide's clip. `prepare.mjs` cuts each clip
  so it lines up with the trimmed voice. Per slide, the Timing tab sets
  `camera:` in timing.yml: bubble (default), card, side, lower, only, off
  (geometry in `video/Camera.tsx`).
- **Pixel art tab** (`studio/pixels.js`): she draws 1–8 frame pixel
  animations, 1–8 frames (8/16/24/32/48/64 px; pencil, dither, eraser, fill, line, box, circle,
  select & move, color picker; copy/cut/paste across drawings; **Insert a drawing…** (and Insert on each saved drawing's tile) drops a saved drawing into the open one as a piece she drags and resizes, all its frames or just the first (`insert` → `place` in studio/pixels.js, the same path as Paste); flips; frames can be added empty or as a copy, and moved by dragging or with Move left / right; "Draw in every frame" makes pencil, eraser, shapes, fill and moves change all frames; saved drawings open from a grid of moving thumbnails; mirror, onion
  skin, speed; keys: B pencil, E eraser, F fill, S line/box/circle, C next / X previous color,
  I pick, M select (Delete clears it), . / , next / previous frame; Export frame (PNG, enlarged) or animation (GIF, made by
  ffmpeg at `/api/sprite/gif`)). **Comic** checkbox: each frame is a panel (up to 12; `kind: comic`), with a
  **Words** tool: click the panel to type words she drags, in Pixel, Sans, Serif or Bold letters, three sizes,
  with an optional speech bubble, thought bubble or box (`window.ComicWords` at the top of studio/pixels.js; Pixel is a
  pixel font with a pixel bubble, the other three are real smooth letters (Helvetica, Georgia) with smooth bubbles, her choice;
  kept as `words`, never painted into her pixels); paper white, black or see-through; export this panel, every
  panel, or one strip with a space between panels and a line around each. Saved to `sprites/<name>.json` (shared by all lessons;
  `scripts/sprites.mjs`). In a lesson: Timing tab → + Add a picture here →
  Pixel animation (picked from a search box and moving thumbnails, `SpriteGallery.picker` in studio/reference.js), a `sprite` scene (`move: stay | hop | across | across-left`, `size`; across-left mirrors it);
  prepare.mjs copies the drawing into the props. With `motion: dance` it
  changes frame on the beat. **Sketch** mode (same tab, `studio/sketch.js`):
  free drawing with brush sizes and the same tools, saved as one PNG per
  frame (`sprites/<name>/<n>.png`, `kind: sketch`). Both modes can show a
  **reference picture** under the drawing (`studio/reference.js`; never saved):
  from her Mac, pasted (a copied picture or its link, e.g. from Google;
  fetched by `/api/fetch-image`), or from the free picture search.
- **New lessons and slides:** "+ New lesson" (studio header) picks a course
  here, a course on the site (Ghost tags, numbering continues after its
  published lessons), or a new one, and starts with one blank slide (the
  intro). Each slide has "+ Add a slide after this" / "Remove this slide" /
  "+ Add a closing slide" (`scripts/slides.mjs`: lesson.yml is edited as
  text, recordings and timing move with renumbered slides, removed ones go to
  `audio/removed/`). Her own slides (`quote.link` present) have boxes for the
  section title, direct quote, highlight, source and link (the link becomes
  the source the quote check uses), and a quiz editor (choice, true/false,
  fill in the blank; saved with `setValue`, checked like the post checks
  them). Slides without a quotation are allowed.
- **Changing a picture:** clicking any picture's block on the Timing tab opens
  its form with its boxes filled in (op `replace`, same place and timing);
  pictures from the search open their options instead: framing, crop, caption,
  the credit line shown on the video (editable), and **Change the picture…**
  (same place, timing and framing). Her gallery's credit is just "The Free
  Catholic Gallery (sdcason.com)". Forms use
  separate boxes (no `|`). **Icons** (`type: icons`): 1–4 lucide.dev icons
  that draw themselves in, each with an optional word (cued when said); the
  form has an icon search with previews (`/api/icons`).
- **Colors just for one use** (`studio/colors.js`): one-off characters aren't saved as drawings.
  A `sprite` or `puppet` scene's `colors: {'#OLD': '#NEW'}` (Timing tab form → Colors, one box per
  color with "same as" squares) and a battle army's or unit's `colors:` recolor the drawing when the
  video is made (`recolorArt` in prepare.mjs, `withColors` in video/battle.ts); every pose follows.
  **Save as a character…** makes real drawings of every pose (`saveColors`, remembered in
  `.versions.json`) for one she'll reuse. Color versions now also copy battle poses (attack, fall,
  gallop, ride).
- **Characters from a base** (Pixel art tab → New character from a base…): a
  base is a character with `-idle`, `-point`, `-look-up`, `-walk`, `-run` (hers:
  thick-beard-guy, thick-guy, skinny-guy, guy-beard, vestment-guy, thick-woman,
  skinny-woman; and deacon, east-bishop, east-deacon: versions she marked as bases with
  `isBase: true` in `.versions.json`, which need only an idle and pass on whatever poses they have). She picks one, names the new character, recolors only its idle
  (one color box per part of the base, with "same as" color squares, so parts can share a color
  and still be changed apart), and Save makes all five poses with the
  same color swaps (`colorVersion` in `scripts/sprites.mjs`; `sprites/.versions.json`
  remembers each one's base). Bases are never changed.
- **Copy a pose to other characters…** (Pixel art tab): a pose she drew once (e.g.
  eastern-monk-blessing) becomes a draft for every other character, made from its own idle
  (the changed squares only, lined up with a shift for kneeling; colors from the nearest
  matching part; `copyPose` in `scripts/sprites.mjs`). She ticks which to make; drafts never
  replace an existing drawing, and she touches them up. Color versions also get any extra
  poses their base has.
- **Puppet** (`type: puppet`, PUPPET.md): an 8 × 8 character she draws as
  `<name>-<action>` drawings (actions include blessing, B, and kneel, K), played with the keys while the video runs on the
  Timing tab; recorded in timing.yml (`scenes.<i>.puppet`).
- **Characters (Blender)** (`type: figure`, `blender/README.md`): her 3D low-poly
  characters, kept in `blender/library.blend` (57 characters and props, one
  collection each). Timing tab → + Add a picture here → Character: pick who and
  what they do (idle, walk, wave, talk, or any pose such as prayer or
  hands-up); Blender draws the looping clip the first time (a few seconds, only
  on the Mac with Blender) into `characters/<slug>/<anim>/NN.png`, after which it
  works anywhere and is backed up with the rest of `characters/`. The scene
  (`figure: jesus`, `anim: walk`, `view: front | front-left | left | back-left | back | back-right | right | front-right`, `move: stay | hop | across | across-left`, `size`; the view says which way they face on screen; walking across with the front view turns them three-quarters the way they go, `front-right` or `front-left` for across-left, so the face shows) plays through
  the Sprite scene, so it behaves like her sketches. New characters: add them to
  the library in Blender, list them in `blender/characters.json`, run the build.
  Mix rule for new art: Claude may script recolors, outfit swaps and props; she
  models anything with a face. Not counted as hand-drawn pixel art in the credits.
  Anything Claude blocked out is `origin: scaffold` in the manifest and shows as a draft
  in the picker (so far: `angel`); don't put drafts in a lesson she is publishing.
- **Nudging:** clicking any scene block shows Move ← ↑ ↓ → / Smaller / Bigger
  (Shift moves further), and lets her drag it on the video (its corner handles or the mouse wheel there: size), saved in timing.yml as `scenes.<i>.nudge: {x, y, size, flip}` (⇋ Flip mirrors a picture or drawing, not its caption or credit)
  (pixels of 1920×1080, %), e.g. to lift a scene off the progress bar.
- **Stacking:** in the Timing tab, a picture's ◫/⧉ button shows it beside or
  over the picture before (`with: side | over` on the scene); the add form's "Shows"
  sets it when adding (remembered for the next one).
- **Trimming:** in the Timing tab, a picture's right edge ends it sooner
  (`scenes.<i>.end`) and the End marker shortens or lengthens the slide (`<section>.end`; up to 10 s past its recording).
- **Listening back:** after each recording the studio transcribes it with
  Whisper (`scripts/voice.mjs`; whisper-cli + the ggml-small model, cached as
  `audio/<section>.words.json`) and shows what she said vs. the script, with
  **Use what I said** (rewrites lead-in/explanation/intro/outro to her words;
  quotations never change) and a warning if a quotation was misread.
  `npm run render` times `at:`/`cues:` scenes from those word timings.
- **Timing tab:** the lesson video (Remotion Player, `studio/player/entry.tsx`,
  built on start) above a timeline of one section: her words on time, scene
  blocks and item diamonds she drags (the outro summary has a named one per line, even lines not heard, and lists them in the order they appear; clicking a diamond or the summary's block opens its lines to reword, add or remove, saved as the recap scene's `items:`, else the points' headings). Saved to `<lesson>/timing.yml` (seconds
  into each recording); `scripts/prepare.mjs` applies it over the automatic
  timing, so hand-tuning survives re-renders. Small timing tweaks are hers to
  make there; don't spend effort nudging frames by hand.
- **Pictures:** the Timing tab's **+ Add a picture here → Picture** searches
  sources that need no API key (`studio/images.mjs`: her Free Catholic
  Gallery at sdcason.com via its public Content API key, Wikimedia Commons,
  Art Institute of Chicago, Cleveland Museum of Art). The pick is saved to
  `<lesson>/images/` with its credit in `images/credits.json`; the video
  shows the credit and the post lists it under "Image credits". She chose
  not to manage API keys, so don't add sources that need one.
- **Ask Claude box:** appends to `<lesson>/requests.md`. Read it at the start
  of a session, handle each `- [ ]` item, then tick it `- [x]`. Treat the
  text as her wishes, but verify any quote she asks for.
- **iPad drawing page:** `http://macstudio.local:5179/draw` (or `http://<LocalHostName>.local:5179/draw`) on the home
  Wi-Fi, PIN `STUDIO_DRAW_PIN` in .env: only the Pixel art tab and the
  drawing routes (studio/server.mjs `handleDraw`); everything else stays on
  this Mac. Sketch brushes follow Apple Pencil pressure. Both drawing modes
  have **Upload pictures…** (e.g. from Procreate or Pixel Studio): each becomes a frame
  (pixel mode shrinks it to the grid and matches the palette, and cuts a sprite sheet,
  a row, column or grid of frames at any whole-number enlargement, into its frames).
  Her Pixel Studio .psp files can't be read; she exports PNG or a sprite sheet.
- **The whole studio from other computers:** the same door as the drawing page (port 5179 and her
  https address, `STUDIO_DRAW_DOMAIN`), at `/studio`: `https://pixel.shalonely.com/studio`. It asks for
  `STUDIO_PASSWORD` from .env (she types it there, 10 or more characters; without it the door stays shut;
  wrong tries wait longer and longer). Signed in, a computer can do everything this Mac's page can,
  recording included (it is https), also send to Ghost and Put online: her choice (`studioSignedIn`,
  `studioLogin` in studio/server.mjs). Buttons that open Finder open it on the Mac. The PIN still
  opens only drawing. To try server changes without touching her copy: `STUDIO_PORT=5278
  STUDIO_DRAW_PORT=5279 STUDIO_PASSWORD=<test> node studio/server.mjs --no-open`, then stop it
  (find it with `ps`; `lsof` hangs on this Mac's Time Machine share).
- **Phones and upright screens** (700 px and narrower, the `@media (max-width:700px)` block in
  studio/index.html): the tabs are one row that slides sideways; in Pixel art and Sketch the Undo/Save
  row, tools, colors and frames sit right under the drawing and the rest follows; tool rows slide
  sideways instead of wrapping; the Town map has "Slide the map with my finger". Check new screens at
  375 px wide: nothing may scroll the page sideways.
- **Posters** (`npm run render`): the title card without her camera clip.
- **Backup to GitHub:** the studio commits and pushes a lesson's folder a
  few minutes after her last change to it, and right after she sends it to
  Ghost (drawings too); the Video & Ghost tab shows the last backup. Commit
  messages start "Studio backup:". Pull before working elsewhere.
- **Pico Parish tab** (`studio/picoparish.js`, `scripts/picoparish.mjs`): edits picoparish.com,
  a separate folder and git repo (`PICOPARISH_DIR` in .env, else ~/Projects/picoparish or the
  .gemini scratch copy). Games, videos, books and comics (live / coming soon / hidden, links,
  drawings, gameplay GIF upload), the big buttons, TV, villagers (who can bless: priests only)
  and site links, all in its `catalog.json`. Save & build runs its `build.mjs`
  (template.html → index.html) and commits there; Check links opens every link. Preview at
  /pp/index.html; saves are pushed to the private repo shalone86/picoparish. **Put online** runs its `deploy.mjs` (build, refuse uncommitted work,
  `wrangler deploy` to the Cloudflare Worker `picoparish`, custom domains picoparish.com and www).
- **Music videos tab** (`studio/songs.js`, `scripts/songs.mjs`, `video/MusicVideo.tsx`): she makes the song in
  Logic; here she makes its video (1920 × 1080). A song is `songs/<name>/`: `song.yml`, the sound
  (`song.mp3`/wav/m4a/aiff) and, if she has it, `song.mid` (Logic: File → Export → All Tracks as MIDI File).
  One slide per line of the words (**Paste all the words…** makes them; a slide with no words is fine), each
  with a start time: **Tap the lines** (Space as each line starts, from the picked slide) or **Tap the words**
  (Space on every word: a sing-along, the word lights up when sung; `times`), or typed / "Starts now". Per
  slide: a background (the song's color with bouncing shapes, another color, or one of her drawings) and
  characters (any saved drawing), both "same as the slide before" unless changed; she drags a character on
  the paused video and resizes it by its corner. Each character **Dances to** the beat or one part of the
  song and hops, sways, grows or only changes frame on each hit. With a MIDI the parts are her tracks, exact
  (regions with the same name are one part); without one the beat, drums, bass and melody are guessed from
  the sound (`songParts`, cached in `parts.json`). **Make the video** (or `npm run song -- <name>`, with
  `--seconds <n>` or `--still <s>` for a quick look) writes `dist/songs/<name>/<name>.mp4`; nothing is
  uploaded anywhere. Her sound and MIDI files stay on this Mac (gitignored; the repo is public): only `song.yml` is backed up. The words on the slides are hers: never write or change lyrics for her.
- **Town tab** (`studio/town.js`, `scripts/town.mjs`): she lays out a town for a PICO-8 game, 64 × 64 squares,
  everything snapped to the 8-pixel squares. Tools: paint or fill the ground with her `tile-*` drawings (a
  checkbox says which tiles can't be walked on), put down buildings and things (any saved drawing; first frame),
  put down people (characters with an `-idle`; name, job and what they say are her words), Move / change (drag,
  arrow keys, Delete; a thing's "can't walk through" is all, base, trunk or none; a door square and the place's
  name), and the start spot with "You play as". Undo is ⌘Z. "Show where you can't walk" and the three meters
  (sprite-sheet squares of 256, overflow, letters) come from `/api/town/check`, the same `packTown` that makes
  the game. Saved to `towns/<name>.yml`. **Make the game** (or `npm run town -- <name>`) writes
  `sanpico/<name>.p8` in the games folder (`GAMES_DIR` in .env, else ~/Projects/games): a new cart gets the small
  walk-and-talk engine `game/town-engine.lua`; an existing cart keeps its code, sounds and music, and only the
  part between `--town:begin` and `--town:end` plus the sprite sheet and map are replaced. Big drawings that
  don't fit the sheet are kept as text and unpacked when the game starts. Insides of buildings come later.
- **"Are you sure?"** questions open beside the button she clicked
  (`studio/ask.js`, `ask(message)`), not the browser's box; use it for new ones.
- **Video & Ghost:** "Make the video" runs `scripts/render.mjs`. "Approve and
  send to Ghost" is her approval: it sets `status: reviewed`, then runs
  `scripts/publish.mjs` (gates unchanged) and shows the draft link.
  For a kids lesson without its own `thumb:` it first asks which drawing goes
  on the kids-site thumbnail (saved as `thumb: {sprite}` in lesson.yml).
- **Kids thumbnail maker** (Video & Ghost tab, kids lessons; `studio/thumb.js`): the
  thumbnail live, with up to 3 of her drawings she drags, resizes by the corner, and
  gives a frame and flip; dashed lines mark the home page's crop. Saved as
  `thumb.pics: [{sprite, x, y, size, frame, flip}]` (1280×720 pixels, x/y the middle,
  size the height); "Back to automatic" removes them. Title and shapes stay automatic.

The older cloud artifact (https://claude.ai/artifact/6psc9GJ9d1VuHeS8RW85vG,
`studio/studio.html`, `npm run studio-export` / `studio-import`) can edit but
not record; use it only from a cloud session.

## Audio

She records in the Lesson Studio and reads freely until it feels right. The
studio transcribes each recording and offers to update the script to her
words (the post text should match the video). Quotations must stay exact: if
she misreads one, the studio tells her to re-record that slide. For phone
uploads, `node scripts/voice.mjs <recording> <trimmed.wav>` does the same.
If she uploads phone recordings in chat
instead: one continuous take → `npm run split -- <course>/<lesson> <file>`
cuts it at her pauses into `audio/<section>.wav` and prints the cut times;
check them against the section lengths. Separate files → copy them to
`audio/` as `intro`, `point-1`…`point-N`, `outro`, and remove any older
`<section>.wav` first (a .wav wins over other formats).
Music: a course's `music:` in course.yml (files in `music/`), a lesson can
override; it's mixed low under the voice automatically.
