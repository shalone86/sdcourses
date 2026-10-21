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
   intro/outro go in `notes`. Their `text` holds only her fixed lines (the
   template has them); she writes the rest in front of them:
   - intro always ends: "I'm your host Shalone Cason, and let's begin in the name of the Father and of the Son and of the Holy Spirit."
   - outro always ends: "Thanks for learning with us. I've been your host Shalone, and until next time, stay holy, my friends."
3. `npm run check` until it passes; `npm run stills` and look at the sheet.
4. Start the Lesson Studio (`npm start`, in the background; see CLAUDE.md)
   and give her a two-line summary of the points and their sources.

**Stop.** She writes her intro and outro, edits anything, and may ask for
more quotes (in the studio's Ask Claude box or in chat).

## 3. Her edits

Her studio edits are already in lesson.yml. Handle `requests.md`, run
`npm run check`, and tell her to reload the page. Repeat until she says the
script is ready.

## 4. Record and watch

She records in the studio (per slide or one take), then presses "Make the
video" on the Video & Ghost tab and watches it there. If she uploads phone
recordings in chat instead, see CLAUDE.md → Audio, then render in the
background.

**Stop.** She re-records any section she wants (just that slide). Only her
explicit approval sets `status: reviewed`: the studio's "Approve and send to
Ghost" button, or her saying so in chat.

## 5. Publish

The Approve button runs the publish step; from chat it's
`npm run publish -- <course>/<lesson>`. Either way it uploads the video,
saves a Ghost **draft**, and gives her the editor link. She presses Publish.
Commit and push the lesson (audio included) to `main`.
