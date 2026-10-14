// Publishes a Markdown file from pages/ to Ghost as a DRAFT page.
// The first "# Heading" becomes the title. Run: npm run publish-page -- <name>
import fs from 'node:fs';
import path from 'node:path';
import {marked} from 'marked';
import {ghost} from './ghost.mjs';
import {ROOT} from './lib.mjs';

const name = process.argv[2];
const file = path.join(ROOT, 'pages', `${name}.md`);
if (!name || !fs.existsSync(file)) throw new Error('Usage: npm run publish-page -- <name>  (needs pages/<name>.md)');
const md = fs.readFileSync(file, 'utf8');
const title = md.match(/^#\s+(.+)$/m)?.[1]?.trim();
if (!title) throw new Error(`${file} needs a "# Title" line`);
const html = marked.parse(md.replace(/^#\s+.+$/m, '').replace(/^<!--[\s\S]*?-->\s*/, ''));
const saved = await ghost().saveDraft('pages', {title, slug: name, html});
console.log(`Draft page saved: ${saved.editorUrl}`);
