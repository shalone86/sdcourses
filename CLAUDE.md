# sdcourses

Shalone Cason's Catholic courses: each lesson is one `lesson.yml` that becomes
a Ghost post, a quiz, and a narrated explainer video. Shalone works in chat;
Claude does the file work. Start a lesson with `/lesson` (see
`.claude/skills/lesson/SKILL.md`). **Current state and next job:
HANDOFF.md.**

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
| `npm run split -- <c>/<l> <file>` | split a one-take recording into sections |

Rendering on the Mac needs nothing extra (Remotion downloads its own
Chrome). In the cloud container, prefix with
`REMOTION_BROWSER=$(ls -d /opt/pw-browsers/chromium_headless_shell-*/*/headless_shell | head -1)`.

Ghost publishing needs `COURSES_GHOST_URL` and `COURSES_GHOST_ADMIN_API_KEY`
(the courses site, not Shalone's other Ghost site). Kids lessons (`style:
kids`) also go to kids.sdcason.com with `KIDS_GHOST_URL` and
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

- **Script & recording:** one slide per section. Her edits are saved straight
  into lesson.yml (`applyEdits` in `scripts/studio.mjs` splices only the
  changed text), then the quote check runs. Changing the script of an
  approved lesson sets it back to `status: draft`. Quotations are locked.
- **Recording:** per slide, or one take with Next taps as the cut points.
  Each section ends up as `audio/<section>.wav`, with the browser's original
  beside it (`.webm`, or `.m4a` from Safari; a one take keeps `take.webm`).
- **Keys:** R/F19 record, F17/F18 change slide. (A prompter mode was tried
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
  select & move, color picker; copy/cut/paste across drawings; flips; mirror, onion
  skin, speed; keys: B pencil/eraser/fill, S line/box/circle, C/Shift+C colors,
  I pick, M select; Export frame (PNG, enlarged) or animation (GIF, made by
  ffmpeg at `/api/sprite/gif`)). Saved to `sprites/<name>.json` (shared by all lessons;
  `scripts/sprites.mjs`). In a lesson: Timing tab → + Add a picture here →
  Pixel animation, a `sprite` scene (`move: stay | hop | across`, `size`);
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
- **Puppet** (`type: puppet`, PUPPET.md): a character she draws as
  `<name>-<action>` drawings, played with the keys while the video runs on the
  Timing tab; recorded in timing.yml (`scenes.<i>.puppet`).
- **Nudging:** clicking any scene block shows Move ← ↑ ↓ → / Smaller / Bigger
  (Shift moves further), saved in timing.yml as `scenes.<i>.nudge: {x, y, size}`
  (pixels of 1920×1080, %), e.g. to lift a scene off the progress bar.
- **Stacking:** in the Timing tab, a picture's ◫/⧉ button shows it beside or
  over the picture before (`with: side | over` on the scene).
- **Trimming:** in the Timing tab, a picture's right edge ends it sooner
  (`scenes.<i>.end`) and the End marker shortens the slide (`<section>.end`).
- **Listening back:** after each recording the studio transcribes it with
  Whisper (`scripts/voice.mjs`; whisper-cli + the ggml-small model, cached as
  `audio/<section>.words.json`) and shows what she said vs. the script, with
  **Use what I said** (rewrites lead-in/explanation/intro/outro to her words;
  quotations never change) and a warning if a quotation was misread.
  `npm run render` times `at:`/`cues:` scenes from those word timings.
- **Timing tab:** the lesson video (Remotion Player, `studio/player/entry.tsx`,
  built on start) above a timeline of one section: her words on time, scene
  blocks and item diamonds she drags. Saved to `<lesson>/timing.yml` (seconds
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
- **iPad drawing page:** `http://MacBook-Air-2.local:5179/draw` on the home
  Wi-Fi, PIN `STUDIO_DRAW_PIN` in .env: only the Pixel art tab and the
  drawing routes (studio/server.mjs `handleDraw`); everything else stays on
  this Mac. Sketch brushes follow Apple Pencil pressure. Both drawing modes
  have **Upload pictures…** (e.g. from Procreate): each becomes a frame
  (pixel mode shrinks it to the grid and matches the palette).
- **Posters** (`npm run render`): the title card without her camera clip.
- **Backup to GitHub:** the studio commits and pushes a lesson's folder a
  few minutes after her last change to it, and right after she sends it to
  Ghost (drawings too); the Video & Ghost tab shows the last backup. Commit
  messages start "Studio backup:". Pull before working elsewhere.
- **"Are you sure?"** questions open beside the button she clicked
  (`studio/ask.js`, `ask(message)`), not the browser's box; use it for new ones.
- **Video & Ghost:** "Make the video" runs `scripts/render.mjs`. "Approve and
  send to Ghost" is her approval: it sets `status: reviewed`, then runs
  `scripts/publish.mjs` (gates unchanged) and shows the draft link.
  For a kids lesson without its own `thumb:` it first asks which drawing goes
  on the kids-site thumbnail (saved as `thumb: {sprite}` in lesson.yml).

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
