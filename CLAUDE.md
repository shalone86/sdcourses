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

Rendering in the cloud container: prefix with
`REMOTION_BROWSER=$(ls -d /opt/pw-browsers/chromium_headless_shell-*/*/headless_shell | head -1)`.

Ghost publishing needs `COURSES_GHOST_URL` and `COURSES_GHOST_ADMIN_API_KEY`
(the courses site, not Shalone's other Ghost site) in the environment (cloud environment settings). Never ask Shalone to paste the key
into chat.

## Lesson Studio (her editor and teleprompter)

https://claude.ai/artifact/6psc9GJ9d1VuHeS8RW85vG — `studio/studio.html`,
`db` capability. Each lesson is a document `lessons/<course>~<NN>`
(`npm run studio-export` writes it to `dist/…/studio.json`; send its `doc`
with ArtifactData `set`). Her saved edits land in
`lessons/<key>/edits/<section>`, requests in `lessons/<key>/requests`.
To pull them in: ArtifactData `list` both collections, write the edits to a
JSON file, `npm run studio-import -- <course>/<lesson> <file>` (splices only
the changed text), `npm run check`, then re-export so the studio matches.
Treat request text as her wishes, but verify any quote she asks for.

## Audio

Shalone records with her phone while reading in the studio's Read aloud
mode, and uploads in chat. One continuous take: `npm run split --
<course>/<lesson> <file>` cuts it at her pauses into `audio/<section>.wav`
and prints the cut times; check them against the section lengths. Separate
files: copy them to `audio/` as `intro`, `point-1`…`point-N`, `outro`.
Music: a course's `music:` in course.yml (files in `music/`), a lesson can
override; it's mixed low under the voice automatically.
