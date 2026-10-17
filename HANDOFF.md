# Handoff: state of play, 2026-10-14 (local session on Shalone's Mac)

Read CLAUDE.md first; it has the rules. This file is the state of play and
the next job. Shalone wants the whole workflow in one place; if it isn't
all-in-one she won't keep at it. Keep messages short and plain.

## Decisions already made (don't relitigate)

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

## Where things stand

**Mac setup: done.** Homebrew, Node 24, ffmpeg and `npm install`. A silent
test render of lesson 1 took about 3 minutes (2 min drawing, 45 s
compressing) and came out at 9.7 MB for 4:48.

**Local Lesson Studio: built.** `npm start` / `Lesson Studio.command` (see
CLAUDE.md → Lesson Studio). Tested: editing and saving (lesson.yml comes back
byte-identical after edit and undo), per-slide and one-take recording with a
synthetic tone, render with progress, approve → publish (stops cleanly at
"Ghost isn't connected"), and approval resetting when the script changes.
**Not yet tested with a real microphone**; do that with her first (the
Microphone panel has a level meter and a device picker).

**Lesson 1** (`courses/what-is-the-pope/01-what-is-the-pope/`): script
complete (653 words), `npm run check` passes, `status: draft`. **Not
recorded yet.**

**Quote check note:** bible.usccb.org sometimes answers scripts with a
"Checking connection" bot page (HTTP 403). Don't try to get around it. The
check now reports those quotes as "couldn't be checked" (still blocks
publishing) instead of wrong; it usually works again a little later. All of
lesson 1's sources are cached in `sources/` on this Mac now.

**Ghost:** connected (`.env` on the Mac, Free Catholic Courses, courses.sdcason.com).
Lesson 1 is approved and saved there as a draft.

**New Ghost theme:** `theme/sdcourses` (from her Novel theme). Previewed on a
private local Ghost (`theme/.ghost-local`, test login in its
`test-login.json`; start it with `cd theme/.ghost-local && NODE_ENV=development
npx -y -p node@22 -- node current/index.js`). **Live since 2026-10-15** (her go-ahead). Update it by
uploading a new zip via the Admin API (`POST /themes/upload/`, same name keeps it
active); her old Novel theme is still installed for rollback. This site's
addresses are custom: lessons `/course/<slug>/`, courses `/topic/<slug>/`. Build: `cd theme/sdcourses && npm run zip` (hash-assets.mjs gives the CSS/JS
content-hashed names: Ghost keeps the same ?v= across uploads and caches a year).

**Redo every course:** `courses/ROADMAP.md` lists all 27 courses and their
posts from the live site. One course at a time: script together (/lesson),
she records, publish, tick it off. Course pictures: `npm run cover`, set
`cover: {icon: …}` in course.yml (lucide.dev icons).

## Next

1. She sets Brand accent #7A1F2B and marks 3–5 courses Featured (the home
   slider stays hidden until one is).
2. Publish the Pope course picture (`npm run publish-course -- what-is-the-pope`)
   and resend lesson 1 so it gets #book and All Courses.
3. Her rewrite of `pages/how-these-lessons-are-made.md` (needs a contact line).
4. Redo courses in the ROADMAP.md order (easiest first; All About the Pope is
   being replaced by What Is the Pope?, which is on the back burner).

5. **Kids version (coming):** a kids edition of this pipeline with extra
   features. She started it in another chat and will bring it here; plan
   for it to reuse the studio, scenes and Timing tab.

Commit and push to `main` as you go.
