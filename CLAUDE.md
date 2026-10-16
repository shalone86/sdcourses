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
  prose. If she dictates text in chat, use her words as given (ask before
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
| `npm run publish` | upload video, save Ghost draft post (gated) |
| `npm run publish-course -- <course>` | create/update the course tag in Ghost |
| `npm run publish-page -- <name>` | save `pages/<name>.md` as a Ghost draft page |
| `npm run studio-export` / `studio-import` | sync a lesson with the Lesson Studio |
| `npm run split -- <c>/<l> <file>` | split a one-take recording into sections |

Rendering on the Mac needs nothing extra (Remotion downloads its own
Chrome). In the cloud container, prefix with
`REMOTION_BROWSER=$(ls -d /opt/pw-browsers/chromium_headless_shell-*/*/headless_shell | head -1)`.

Ghost publishing needs `COURSES_GHOST_URL` and `COURSES_GHOST_ADMIN_API_KEY`
(the courses site, not Shalone's other Ghost site). On the Mac they go in
`.env` at the repo root (gitignored; `scripts/lib.mjs` loads it); in the
cloud, in the environment settings. Never ask Shalone to paste the key
into chat; she types it into the file herself.

## Lesson Studio (her editor, teleprompter and recorder)

A local page on her Mac: `npm start` (or double-click `Lesson Studio.command`)
runs `studio/server.mjs` and opens http://localhost:5178 (`studio/index.html`).
It must be local: browsers only allow the microphone on localhost. When she
wants to work, start it for her in the background; if it's already running,
`npm start` just opens the page.

- **Script & recording:** one slide per section. Her edits are saved straight
  into lesson.yml (`applyEdits` in `scripts/studio.mjs` splices only the
  changed text), then the quote check runs. Changing the script of an
  approved lesson sets it back to `status: draft`. Quotations are locked.
- **Recording:** per slide, or one take with Next taps as the cut points.
  Each section ends up as `audio/<section>.wav`, with the browser's original
  beside it (`.webm`, or `.m4a` from Safari; a one take keeps `take.webm`).
- **Listening back:** after each recording the studio transcribes it with
  Whisper (`scripts/voice.mjs`; whisper-cli + the ggml-small model, cached as
  `audio/<section>.words.json`) and shows what she said vs. the script, with
  **Use what I said** (rewrites lead-in/explanation/intro/outro to her words;
  quotations never change) and a warning if a quotation was misread.
  `npm run render` times `at:`/`cues:` scenes from those word timings.
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
