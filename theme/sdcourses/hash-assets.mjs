// After the build: copy assets/built/app.{css,js} to names that include a
// hash of their contents, and point the theme at them (partials/cc-assets.hbs).
// Ghost's {{asset}} version doesn't change when a theme is re-uploaded, and
// the files are cached for a year, so without this visitors keep old styles.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const dir = path.resolve('assets/built');
for (const f of fs.readdirSync(dir)) if (/^app\.[0-9a-f]{10}\.(css|js)(\.map)?$/.test(f)) fs.rmSync(path.join(dir, f));
const names = {};
for (const ext of ['css', 'js']) {
  const src = path.join(dir, `app.${ext}`);
  const hash = crypto.createHash('sha256').update(fs.readFileSync(src)).digest('hex').slice(0, 10);
  names[ext] = `built/app.${hash}.${ext}`;
  fs.copyFileSync(src, path.join(dir, `app.${hash}.${ext}`));
}
fs.writeFileSync('partials/cc-assets.hbs', `{{!-- Written by hash-assets.mjs on every build; don't edit. --}}
{{#match type "css"}}<link rel="stylesheet" type="text/css" href="{{asset "${names.css}"}}">{{/match}}
{{#match type "preload"}}<link rel="preload" as="style" href="{{asset "${names.css}"}}">
    <link rel="preload" as="script" href="{{asset "${names.js}"}}">{{/match}}
{{#match type "js"}}<script src="{{asset "${names.js}"}}"></script>{{/match}}
`);
console.log('assets:', names.css, names.js);
