// Builds the homepage "picks of the day" snippets for both Ghost sites (ghost/home-picks.js plus
// each site's settings and styles) into ghost/home-picks-kids.html and ghost/home-picks-courses.html.
// She pastes each into that site's Settings → Code injection → Site footer.
// Run: node scripts/home-picks.mjs
import fs from 'node:fs';
import path from 'node:path';
import {ROOT} from './lib.mjs';

const js = fs.readFileSync(path.join(ROOT, 'ghost/home-picks.js'), 'utf8');

const sites = {
  // Kids: today's video and today's song above "Latest work", in the theme's own cards.
  kids: {
    css: `.sd-picks .project-feed{grid-template-columns:repeat(auto-fit,minmax(260px,1fr))}
.sd-picks .sd-pick-label{display:inline-block;font-weight:700;font-size:.85em;letter-spacing:.04em;text-transform:uppercase;margin-bottom:.35em;opacity:.75}
.sd-picks .project-card__img{width:100%;height:auto;display:block}
.sd-picks{margin-bottom:32px}
.sd-picks-actions{display:flex;gap:12px;flex-wrap:wrap;justify-content:center;margin-top:24px}
.sd-picks-actions button{font:inherit;font-weight:700;font-size:1.05em;padding:12px 22px;border-radius:999px;border:0;cursor:pointer;background:#FFB300;color:#2B2350;box-shadow:0 4px 0 #c98a00}
.sd-picks-actions button:active{transform:translateY(2px);box-shadow:0 2px 0 #c98a00}
.sd-picks-actions button:disabled{opacity:.6}`,
    config: `{
  title: "Today's picks",
  before: 'section.projects',
  sectionClass: 'container wrapper section projects sd-picks',
  titleClass: 'section__title',
  gridClass: 'grid project-feed',
  buttonClass: 'sd-pick-btn',
  lists: [
    {label: "Today's video", button: '🎲 Surprise me: a video', filter: 'tag:catholic-kids-video-lessons'},
    {label: "Today's song", button: '🎲 Surprise me: a song', filter: 'tag:catholic-kids-songs'},
  ],
  card: function (p, label, esc) {
    return '<article class="project-card">' +
      (p.feature_image ? '<a class="project-card__media" href="' + esc(p.url) + '"><img class="project-card__img" src="' + esc(p.feature_image) + '" alt="' + esc(p.title) + '" loading="lazy"></a>' : '') +
      '<div class="project-card__content"><span class="sd-pick-label">' + esc(label) + '</span>' +
      '<h3 class="project-card__title"><a href="' + esc(p.url) + '">' + esc(p.title) + '</a></h3></div></article>';
  },
}`,
  },
  // Courses: one lesson of the day under the welcome banner, and "Surprise me".
  courses: {
    css: `.sd-picks{padding-top:8px;padding-bottom:8px}
.sd-picks .gh-inner{max-width:900px}
.sd-picks h2{font-size:13px;letter-spacing:.08em;text-transform:uppercase;margin:0 0 12px}
.sd-pick{display:flex;gap:20px;align-items:center;text-decoration:none;color:inherit;border:1px solid rgba(0,0,0,.1);border-radius:12px;padding:14px;background:rgba(255,255,255,.55)}
.sd-pick img{width:min(240px,38%);aspect-ratio:16/9;object-fit:cover;border-radius:8px;flex:none}
.sd-pick h3{margin:0 0 8px;font-size:24px;line-height:1.2}
.sd-pick p{margin:0;opacity:.8;font-size:16px;line-height:1.5;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
.sd-pick:hover h3{text-decoration:underline}
.sd-picks-actions{margin-top:14px}
@media (max-width:600px){.sd-pick{flex-direction:column;align-items:stretch}.sd-pick img{width:100%}}`,
    config: `{
  title: 'Lesson of the day',
  before: 'section.gh-header.is-slider, section.gh-container',
  sectionClass: 'gh-outer sd-picks',
  innerClass: 'gh-inner',
  titleClass: 'sd-picks-title',
  gridClass: 'sd-picks-grid',
  buttonClass: 'cc-btn cc-btn-quiet',
  lists: [
    // Lessons: posts with a picture that aren't a course page (#book), blog post or cover.
    {label: 'Lesson of the day', button: 'Surprise me with a lesson', filter: 'tag:-hash-book+tag:-hash-blog+tag:-hash-cover+feature_image:-null'},
  ],
  skip: /^(sources|congratulations!?|.*downloads?)$/i,
  card: function (p, label, esc) {
    // (an automatic excerpt can start with the video player's "0:00 /1:23 1×")
    var text = (p.custom_excerpt || p.excerpt || '').replace(/^[\\s\\d:\\/×.]+(?=\\S)/, '');
    return '<a class="sd-pick" href="' + esc(p.url) + '">' + (p.feature_image ? '<img src="' + esc(p.feature_image) + '" alt="" loading="lazy">' : '') +
      '<div><h3>' + esc(p.title) + '</h3>' + (text ? '<p>' + esc(text) + '</p>' : '') + '</div></a>';
  },
}`,
  },
};

for (const [name, s] of Object.entries(sites)) {
  const out = `<!-- Homepage picks of the day (sdcourses: scripts/home-picks.mjs). Paste into Settings → Code injection → Site footer. -->
<style>
${s.css}
</style>
<script>
window.SD_PICKS = ${s.config};
${js}</script>
`;
  fs.writeFileSync(path.join(ROOT, `ghost/home-picks-${name}.html`), out);
  console.log(`ghost/home-picks-${name}.html`);
}
