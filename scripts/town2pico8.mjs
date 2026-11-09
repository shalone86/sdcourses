// npm run town -- <name>   → ~/Projects/games/sanpico/<name>.p8 (see scripts/town.mjs)
import {exportTown, listTowns} from './town.mjs';
const name = process.argv[2];
if (!name) { console.log('Towns: ' + (listTowns().map((t) => t.name).join(', ') || 'none yet (make one on the Studio\'s Town tab)')); process.exit(0); }
try {
  const r = exportTown(name);
  const b = r.budget;
  console.log(`${r.fresh ? 'Made' : 'Updated'} ${r.file}`);
  console.log(`Sprite sheet: ${b.slots} of ${b.of} squares. Extra pictures: ${b.extra[0] + b.extra[1]} of 512 squares. Town data: ${b.letters.toLocaleString()} letters.`);
  for (const w of b.warnings) console.log('Note: ' + w);
} catch (e) { console.error(e.message); process.exit(1); }
