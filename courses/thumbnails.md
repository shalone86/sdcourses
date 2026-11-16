# Course thumbnails (the green style)

Shalone's own look from her 2024 prayer lessons ("Conditions of Prayer", "Vocal
Prayer", "The Need for Prayer"), made in Canva. These replace the icon covers
from `npm run covers` (courses/covers.yml), course by course.

## The template

Canva design **"Course thumbnail template (green)"** (`DAHbGlhNMno`): a 1600 × 900
copy of her Vocal Prayer slide. Never edit it directly; copy it for each course.

| Part | Rule |
|---|---|
| Size | 1600 × 900 (16:9, the site's card frame) |
| Background | solid `#6dece0` (mint) |
| Blobs | her Canva shapes `MADtGo9Gh80` (top-left), `MADbegEo3FM` (bottom-right) in butter `#fbe698`, and the ring `MADzwb_-gyY` in teal `#15b5b0`; teal `MAD6WQHsNNw` is the spare. Keep them at the edges, never behind the subject's face |
| Picture | one subject, centered, in the slot labelled `picture` (1100 × 733 at 250, 140). A cut-out with a transparent background (Canva's remove background, if it has one), so the mint shows through |
| Picture source | **existing human-made art only**: Canva's Elements/Graphics library or her own uploads. **Never Canva's generative AI** (no Magic Media, no generate-image) |
| Picture style | flat cartoon illustration like her prayer-lesson art: soft outlines, warm friendly colors; no photos, no text inside the picture |
| Text | none on the picture: the site prints the course name under it |
| One subject per course | the thing the course is about (a church, a cross, a chalice), not a scene; a person only when the course is about that person |
| Faces | a saint or person with a face: Shalone picks or approves the picture first (her rule for faces) |

## Making one

The Canva connector can't search Canva's stock library, so the picking is hers
and the rest is Claude's:

1. **Shalone:** in Canva, open the design **"Thumbnail picks"**, add a page per
   course (title the page with the course slug), and drop in the one Elements
   graphic she wants. `courses/thumbnails.yml` has words to search for.
2. **Claude:** reads her pick (`read-design` on "Thumbnail picks" gives each
   page's media id), `copy-design` the template, `update_fill` the `picture`
   slot with it, titles the copy "Thumbnail: <course>", shows her the preview.
3. On her OK: save, `export-design` PNG 1600 × 900, and upload it as the course
   tag's `feature_image`. The old URL goes into `courses/covers-previous.json`
   first, so any can be put back.
