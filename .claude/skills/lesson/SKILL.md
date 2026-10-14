---
name: lesson
description: Make a new course lesson with Shalone, from topic to Ghost draft. Use when she asks for a new lesson or course, or invokes /lesson.
---

# Making a lesson

Follow CLAUDE.md's "who decides what" rules. Each **Stop** waits for
Shalone. Keep messages short: she reads on her phone.

## 1. Topic and music

- New course: `npm run new -- course <slug> "<Title>"`, write `summary`, and
  ask whether to create it in Ghost (`npm run publish-course -- <slug>`).
- Music: if she uploads a track, copy it to `music/` and set `music:` in
  course.yml (whole course) or lesson.yml (this lesson). Otherwise the
  course's track is used.

## 2. Quotes and script

1. Read the primary sources: Catechism (vatican.va/archive/ENG0015),
   Catholic Encyclopedia (newadvent.org/cathen), Scripture (bible.usccb.org,
   NABRE); Wikipedia for orientation only.
2. `npm run new -- lesson <course> "<Title>"` and build `lesson.yml`: 3–5
   points, each on one exact quotation, with a 60–100-word explanation,
   1–2 visuals and a quiz (mix `choice`, `truefalse`, `blank`). Facts for her
   intro/outro go in `notes`; leave their `text` empty.
3. `npm run check` until it passes; `npm run stills` and look at the sheet.
4. Load it into the Lesson Studio (see CLAUDE.md) and send her the link with
   a two-line summary of the points and their sources.

**Stop.** She writes her intro and outro, edits anything, and may ask for
more quotes (in the studio or in chat).

## 3. Her edits

Pull edits and requests from the studio, apply them, `npm run check`, and
re-export to the studio. Repeat until she says the script is ready.

## 4. Record

She opens Read aloud, starts her phone's recorder, reads, and uploads the
file(s). Split a one-take file with `npm run split`; check the cut times
look sane. Render in the background, then show her the video (a preview
Artifact with the video file) and the size.

**Stop.** Re-record a section if she wants (just that file). Only her
explicit approval sets `status: reviewed`.

## 5. Publish

`npm run publish -- <course>/<lesson>`: uploads the video, saves a Ghost
**draft**, and sends her the editor link. She presses Publish. Commit and
push the lesson (audio included) to `main`.
