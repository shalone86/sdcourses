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

**Ghost:** not connected yet. Create `.env` at the repo root with
`COURSES_GHOST_URL=…` and `COURSES_GHOST_ADMIN_API_KEY=…` (Ghost Admin →
Settings → Integrations → Add custom integration). She types the key into
the file herself; never ask her to paste it into chat.

## Next

1. Mic test with her in the studio, then record lesson 1, make the video,
   she watches it, approves.
2. Ghost `.env` (her key), then publish lesson 1 as a draft.
3. Her rewrite of `pages/how-these-lessons-are-made.md` (needs a contact line).
4. Ghost theme redesign (course = page + tag, lesson = post with `#lesson`,
   quiz and progress built into the theme instead of Code Injection). Her
   current theme is a modified "Novel" theme; get a copy from Ghost Admin →
   Settings → Design → Change theme → Download when that work starts.

Commit and push to `main` as you go.
