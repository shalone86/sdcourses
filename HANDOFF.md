# Handoff: moving to a local session (Mac), 2026-10-14

Read CLAUDE.md first; it has the rules. This file is the state of play and
the next job. Shalone wants the whole workflow in one place; if it isn't
all-in-one she won't keep at it. Keep messages short and plain.

## Where things stand

**Decisions already made (don't relitigate):**
- Lessons are quote-anchored. Claude finds 3–5 exact quotations (Scripture
  NABRE, Catechism, Catholic Encyclopedia) and builds the script; Shalone
  writes the intro/outro, edits anything, and approves. Wikipedia is
  background only.
- Every post and video carries the AI-assistance credit from `site.yml`.
  Publishing makes Ghost **drafts** only.
- Video: Remotion, 2D scenes, flat colors, gentle float, her voice, her own
  CC0 music (methodius.media) mixed low. Videos are hosted on Ghost, so keep
  them small (H.264, CRF 30, 64 kbps mono AAC).
- Quiz types: `choice`, `truefalse`, `blank`.
- Recording: she prefers natural reads (rehearse once, keep small slips,
  redo only misread quotations or wrong facts).

**Lesson 1** (`courses/what-is-the-pope/01-what-is-the-pope/`): script is
complete (her intro and outro, 5 points, 653 words, all quotations pass
`npm run check`). `status: draft`. **Not recorded yet.** The course music is
set in `course.yml`. Preview of the silent draft (cloud artifact):
https://claude.ai/artifact/DMBwvzPuYhK9xncCyQRx7X

**Ghost:** not connected yet. The courses site is a *different* Ghost
install from her other site. Locally, put the credentials in a `.env` file
at the repo root (it must stay gitignored; add loading for it):
`COURSES_GHOST_URL=…` and `COURSES_GHOST_ADMIN_API_KEY=…` (Ghost Admin →
Settings → Integrations → Add custom integration). She types the key into
the file herself; never ask her to paste it into chat.

**Still to do after the studio:** record + publish lesson 1; her rewrite of
`pages/how-these-lessons-are-made.md` (needs a contact line); the Ghost
theme redesign (course = page + tag, lesson = post with `#lesson`, quiz and
progress built into the theme instead of Code Injection). Her current theme
is a modified "Novel" theme; get a copy from Ghost Admin → Settings →
Design → Change theme → Download when that work starts.

**Superseded:** the cloud "Lesson Studio" artifact
(https://claude.ai/artifact/6psc9GJ9d1VuHeS8RW85vG, `studio/studio.html`)
could edit text but couldn't record (artifacts can't use the microphone).
The local app below replaces it; reuse its look and its edit logic.

## Next job: the local Lesson Studio app

Goal: one browser page on her Mac where she does steps 3–5 of her
workflow: edit the script, record, watch the video, send it to Ghost.
Browsers allow the microphone on `http://localhost`, which is why this has
to run locally.

**Setup first** (check, then install what's missing, telling her what each
is for in one line): Homebrew, `brew install node ffmpeg`, `npm install`.
Don't set `REMOTION_BROWSER` on the Mac; Remotion downloads its own Chrome
on the first render.

**Build** `npm start` → a small Node server (no framework needed) on
`http://localhost:5178` that opens her default browser. Same visual identity
as the videos (see `studio/studio.html` styles and `video/theme.ts`).

- **Lesson picker** (from `courses/*/*/lesson.yml`).
- **Slides**, one per section (intro, points, outro), like a teleprompter.
  Intro, outro, each point's lead-in and explanation are editable in place;
  quotations are locked (show the citation, "read exactly"). Saving writes
  to `lesson.yml` with the splice logic in `scripts/studio.mjs` (only the
  changed text, comments kept), then runs the quote check and shows the
  result.
- **Record per slide**: `MediaRecorder`, big record/stop button, play back,
  re-record. Save to `audio/<section>.webm`, then convert to WAV with ffmpeg.
  Show which sections have audio.
- **One-take mode**: record continuously and tap Next between sections;
  store the tap times and cut at those marks (more exact than
  `scripts/split-audio.mjs`, which stays as the fallback for uploaded files).
- **"Ask Claude" box** that appends to a requests file Claude reads (she
  can also just say it in chat).
- **Video tab**: render button (runs `scripts/render.mjs`, shows progress),
  then plays `dist/…/lesson.mp4` and shows the file size.
- **Approve and send to Ghost**: an explicit "Approve" button sets
  `status: reviewed` (that click is her approval), then runs
  `scripts/publish.mjs` and shows the Ghost draft link. The publish gates
  stay as they are.

**Done when:** she can open the page, record lesson 1 (per slide or one
take), watch the rendered video with her voice and the music, and the
publish step reaches Ghost (or reports clearly that the `.env` key is
missing). Test the microphone with her before the full recording.

Commit and push to `main` as you go.
