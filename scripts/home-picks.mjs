// Builds the kids site's homepage "picks of the day" snippet (ghost/home-picks.js plus the
// site's settings and styles) into ghost/home-picks-kids.html. She pastes it into that site's
// Settings → Code injection → Site footer. (The courses site has its Lesson of the day in the theme.)
// Run: node scripts/home-picks.mjs
import fs from 'node:fs';
import path from 'node:path';
import {ROOT} from './lib.mjs';

const js = fs.readFileSync(path.join(ROOT, 'ghost/home-picks.js'), 'utf8');

const sites = {
  // Kids: today's video and today's song above "Latest work", in the theme's own cards.
  kids: {
    css: `.sd-picks .project-feed{grid-template-columns:repeat(auto-fit,minmax(260px,1fr));margin-bottom:0}
.sd-picks .sd-pick-label{display:inline-block;font-weight:700;font-size:.85em;letter-spacing:.04em;text-transform:uppercase;margin-bottom:.35em;opacity:.75}
.sd-picks .project-card__img{width:100%;height:auto;display:block}
.sd-picks{margin-bottom:32px}
.sd-picks-actions{display:flex;gap:12px;flex-wrap:wrap;justify-content:center;margin-top:8px}
.sd-picks-actions button{font:inherit;font-weight:700;font-size:1.05em;padding:12px 22px;border-radius:999px;border:0;cursor:pointer;background:var(--ghost-accent-color,#1ab2ff);color:#fff;box-shadow:0 4px 0 rgba(0,0,0,.22)}
.sd-picks-actions button:active{transform:translateY(2px);box-shadow:0 2px 0 rgba(0,0,0,.22)}
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
    {label: "Today's song", button: '🎵 Surprise me: a song', filter: 'tag:catholic-kids-songs'},
  ],
  card: function (p, label, esc) {
    return '<article class="project-card">' +
      (p.feature_image ? '<a class="project-card__media" href="' + esc(p.url) + '"><img class="project-card__img" src="' + esc(p.feature_image) + '" alt="' + esc(p.title) + '" loading="lazy"></a>' : '') +
      '<div class="project-card__content"><span class="sd-pick-label">' + esc(label) + '</span>' +
      '<h3 class="project-card__title"><a href="' + esc(p.url) + '">' + esc(p.title) + '</a></h3></div></article>';
  },
}`,
  },
  // Courses: Lesson of the day is built into the theme now
  // (theme/sdcourses: partials/components/lesson-of-the-day.hbs, assets/js/lesson-of-the-day.js).
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
