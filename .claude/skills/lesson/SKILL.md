---
name: lesson
description: Make a new course lesson with Shalone, from topic to Ghost draft. Use when she asks for a new lesson or course, or invokes /lesson.
---

# Making a lesson

Follow CLAUDE.md's "who decides what" rules throughout. Each step that ends
in **Stop** waits for Shalone's reply. Keep messages short: she reads on her
phone.

## 1. Topic and candidates

1. If the course doesn't exist: `npm run new -- course <slug> "<Title>"`, fill
   in `summary`, and ask whether to create it in Ghost now
   (`npm run publish-course -- <slug>`).
2. Read the primary sources for the topic: the Catechism section
   (vatican.va/archive/ENG0015), the Catholic Encyclopedia article
   (newadvent.org/cathen), the relevant Scripture (bible.usccb.org, NABRE),
   and Wikipedia for orientation only.
3. Offer **6–8 candidate points**. For each: a one-line heading and the exact
   quotation it would stand on, with its citation. Number them.

**Stop.** Shalone picks 3–6 (she may swap quotes or add her own).

## 2. Draft

1. `npm run new -- lesson <course> "<Title>"`, then fill in `lesson.yml`:
   - `sources` with an `id` for each; Wikipedia gets `reference: true`.
   - Each point: `quote` (exact text, `source` id, `cite`, optional `lead` and
     `highlight`), a 60–100-word `text` explanation, 1–2 `visuals` (scene
     types are listed in README.md), and a quiz. Mix quiz types across the
     lesson.
   - `intro.notes` / `outro.notes`: facts she can use. Leave `text: ""`.
2. `npm run check`, fix until it passes.
3. `npm run stills` and `npm run post`. Show her the contact sheet and a
   preview page (publish `dist/…/preview.html` as an Artifact with the
   video/poster files if they exist).

**Stop.** Ask for edits, and for her intro and outro.

## 3. Her words, then her voice

1. Put her intro and outro in as written. Apply her edits.
2. `npm run prepare-lesson` and send her `dist/…/recording-script.md`.

**Stop.** She records and uploads audio files.

## 4. Render and approve

1. Copy the audio into `audio/` with the right names, then render in the
   background. The video re-times itself to her voice.
2. Update the preview; tell her the file size.

**Stop.** Only her explicit approval sets `status: reviewed`.

## 5. Publish the draft

`npm run publish -- <course>/<lesson>`. It uploads the video and saves a
**draft**. Send her the Ghost editor link; she presses Publish. Commit and
push the lesson (audio included) to `main`.
