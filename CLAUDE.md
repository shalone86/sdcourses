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
- Maps can highlight `areas:` (a country name, or an approximate empire from
  `video/data/empires.ts`; those show "Borders approximate"). Add empires there.

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
there: Byzantine Catholic Lessons (course.yml `tradition: byzantine`) or
Catholic Kids Video Lessons, plus the series (`series:`, else the course
title). For kids, prefer short quotations (an exact short passage that carries
the meaning) over long ones. On the Mac they go in
`.env` at the repo root (gitignored; `scripts/lib.mjs` loads it); in the
cloud, in the environment settings. Never ask Shalone to paste the key
into chat; she types it into the file herself.

## Lesson Studio (her editor, teleprompter and recorder)

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
- **Camera:** "Record my video too" (in the Microphone panel) records her
  webcam with the voice. Clips go to `<lesson>/camera/` (gitignored: her
  face stays off the public repo, so it exists only on this Mac); a
  voice-only re-record drops that slide's clip. `prepare.mjs` cuts each clip
  so it lines up with the trimmed voice. Per slide, the Timing tab sets
  `camera:` in timing.yml: bubble (default), card, side, lower, only, off
  (geometry in `video/Camera.tsx`).
- **Pixel art tab** (`studio/pixels.js`): she draws 1–8 frame pixel
  animations, 1–8 frames (16/24/32/48/64 px; pencil, dither, eraser, fill, line, box, circle,
  select & move, color picker; copy/cut/paste across drawings; flips; mirror, onion
  skin, speed). Saved to `sprites/<name>.json` (shared by all lessons;
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
- **Video & Ghost:** "Make the video" runs `scripts/render.mjs`. "Approve and
  send to Ghost" is her approval: it sets `status: reviewed`, then runs
  `scripts/publish.mjs` (gates unchanged) and shows the draft link.

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
