# Course thumbnails (blue for adults, green for kids)

Shalone's own look from her 2024 prayer lessons ("Conditions of Prayer", "Vocal
Prayer", "The Need for Prayer"), made in Canva. These replace the icon covers
from `npm run covers` (courses/covers.yml), course by course.

## The templates

Canva design **"Course thumbnail templates (kids green, adults blue)"** (`DAHbGlhNMno`),
1600 × 900 (16:9, the site's card frame). Never edit it directly; copy the page you need.

**Adults (page 2, the default for this site):** dark navy `#16234A`, no shapes, one
main icon centered (about 220 × 310 at the top middle), and the course or lesson
name under it in cream `#F4EBDD`, centered, about 100 px, in the serif from her
**Adult Course** brand kit.

**Kids (page 1):** her green look from the 2024 prayer lessons: mint `#6dece0`, her
blob shapes `MADtGo9Gh80` (top-left) and `MADbegEo3FM` (bottom-right) in butter
`#fbe698`, the ring `MADzwb_-gyY` in teal `#15b5b0` (top-right); one picture in
the slot labelled `picture` (930 × 620 at 335, 30), and the name under it in navy
`#183153`, bold, about 104 px, in the font from her **Kid Course** brand kit. Kids
courses now live on angelio.org, so this page is for Angelio and for any kids
lesson that stays here (Confirmation).

| Rule | |
|---|---|
| Art | **existing human-made art only**: Canva's Elements library or her own uploads. **Never Canva's generative AI** (no Magic Media, no generate-image) |
| Icon (adults) | one simple icon of the course's subject (a church, keys, a chalice), in gold or cream so it reads on navy |
| Picture (kids) | flat cartoon illustration with a transparent background, like her prayer-lesson art |
| Title | the course name, or the lesson name for a lesson thumbnail; shorten long names (`title:` in courses/covers.yml) |
| Fonts | the connector can't set fonts, so the title boxes carry her brand-kit fonts; copies keep them, and the text is changed with `replace_text` |

## Making one

The Canva connector can't search Canva's stock library, so the picking is hers
and the rest is Claude's:

1. **Shalone:** in Canva, open the design **"Thumbnail picks"**, add a page per
   course (title the page with the course slug), and drop in the one Elements
   icon (adults) or picture (kids) she wants. `courses/thumbnails.yml` has words to search for.
2. **Claude:** reads her pick (`read-design` on "Thumbnail picks" gives each
   page's media id), `copy-design` the right template page, puts her pick in
   (`update_fill` for a picture, or delete the stand-in cross and `insert_fill` the icon), `replace_text` the title, titles the copy "Thumbnail: <course>", shows her the preview.
3. On her OK: save, `export-design` PNG 1600 × 900, and upload it as the course
   tag's `feature_image`. The old URL goes into `courses/covers-previous.json`
   first, so any can be put back.
