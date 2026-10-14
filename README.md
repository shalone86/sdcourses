# Catholic Courses

One lesson = one `lesson.yml`. From it come the Ghost post, the quiz, and the
video. You pick the topic and the points and approve every word; the
tooling does the packaging.

```
courses/
  what-is-the-pope/
    course.yml                    course title, summary, planned lessons
    01-what-is-the-pope/
      lesson.yml                  ← the lesson (text = post body = narration)
      audio/                      ← your recordings: intro.m4a, point-1.m4a … outro.m4a
video/                            Remotion template + scene library
ghost/                            quiz script/styles for the Ghost site
scripts/                          prepare · stills · render · post · publish
```

## Publishing from chat (the easy way)

Shalone works in a Claude Code session on this repo and says what she wants
("new lesson on how a pope is chosen"). Claude follows `CLAUDE.md` and the
`/lesson` skill: it offers candidate points, drafts, shows previews, takes her
intro/outro and recordings, renders, and saves the lesson to Ghost as a
draft. She presses Publish in Ghost.

One-time setup, in the cloud environment's settings (environment menu in the
session title bar → Edit):

1. **Environment variables:** `GHOST_URL=https://your-site.com` and
   `GHOST_ADMIN_API_KEY=<key>`. Get the key in Ghost Admin → Settings →
   Integrations → Add custom integration → Admin API key. Don't paste it
   into chat.
2. **Network access:** add your Ghost site's domain under Allowed domains
   (keep "Allow package managers" ticked).

A new session picks both up.

## Making a lesson by hand

1. **Topic and candidates.** Claude reads the Catholic Encyclopedia, the
   Catechism, Scripture (and Wikipedia for orientation) and offers 6–8
   candidate points, each with the exact quotation it would stand on. Shalone
   picks 3–6.
2. **Draft → her words.** Claude fills in `lesson.yml`: each point has an
   anchor `quote`, a 60–100-word explanation, 1–2 visuals and a quiz
   (`choice`, `truefalse` or `blank`). Shalone writes the intro and outro,
   edits the rest, and approves it (`status: reviewed`).
3. **Check the look:** `npm run stills -- what-is-the-pope/01-what-is-the-pope`
   writes `dist/…/contact-sheet.jpg` (one frame per scene).
4. **Record.** `npm run prepare-lesson -- <course>/<lesson>` writes
   `dist/…/recording-script.md`. Record one file per section into the
   lesson's `audio/` folder (`intro`, `point-1` … `outro`; .m4a, .mp3 or .wav).
   Phone voice memos are fine. Silence is trimmed and volume leveled
   automatically, and the video times itself to your voice.
5. **Tweak (optional):** `npm run studio`, then load `dist/…/props.json`
   as props to scrub through the video and adjust.
6. **Check quotes:** `npm run check -- <course>/<lesson>` confirms every
   quotation appears word for word in a primary source (Scripture, the
   Catechism, the Catholic Encyclopedia). Wikipedia is background only.
7. **Render:** `npm run render -- <course>/<lesson>` writes `dist/…/lesson.mp4`
   (small web copy) and `poster.jpg`. Add `--720` for an even smaller file.
8. **Publish:** `npm run publish -- <course>/<lesson>` uploads the video and
   creates a **draft** post in Ghost (see `scripts/publish.mjs` for the API key
   setup). It refuses to run until the lesson says `status: reviewed`, your
   name is in `site.yml`, and the quote check passes. Review the draft in
   Ghost and press Publish.

Every post ends with the AI-assistance credit from `site.yml`, and the video's
closing card carries a short version of it.

Without the API key, `npm run post -- <course>/<lesson>` writes `post.html`. Paste
it into a Ghost HTML card and swap in the video URL by hand.

## Scene types

Each point picks two. Fields are in each file under `video/scenes/`.

| type | shows |
|---|---|
| `title` | lesson title card |
| `term` | a word, its origin, its meaning |
| `compare` | two cards, one marked as the answer |
| `keys` | crossed keys drawing + a quote |
| `timeline` | dated events + optional count-up number |
| `quote` | words reveal, key phrase highlighted |
| `college` | head + ring (Peter & the Twelve → Pope & bishops) |
| `titles` | Latin titles with English |
| `chain` | handing-on chain with a moving token |
| `recap` | the lesson's headings, checked off |

## Sources and licensing

- Catholic Encyclopedia (1913) is public domain. It is also dated, so check
  claims against the Catechism.
- Wikipedia is CC BY-SA: cite it, and write in your own words rather than
  adapting its sentences.
- Fonts: EB Garamond and Inter, SIL Open Font License (`video/public/fonts`).
- Remotion is free for individuals and companies of up to 3 people.

## Rendering in a container

If Chrome can't be downloaded, point Remotion at an installed one:
`REMOTION_BROWSER=/path/to/chrome-headless-shell npm run render -- …`
