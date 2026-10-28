// Turns Shalone's MIDI (exported from Logic) into PICO-8 music in the cart.
// Each track becomes one channel; notes are quantized to 16ths, one note at
// a time (a chord on one track is played as a fast arpeggio). Every 2 bars
// (32 steps) of a track becomes one sfx, starting at sfx 8 (0-7 are the game's
// sound effects, kept as they are); repeated 2 bars are stored once. The
// patterns start at music 0 and loop.
// A drum track (named "kit" or "drum", or from a file with "drum" in its
// name) has no channel of its own (the 4th is for sound effects): its hits
// go into the part with the most rests at those moments. The lowest drum is
// a kick (low triangle that drops), the others noise hits.
// From bar --part-wins-from (default 8) on, the part keeps its notes and
// drums only fill its rests.
// Usage: npm run music -- <file.mid> [<drums.mid>] [--part-wins-from 8]
//   [--wave melody=3,harmony=0,bass=0] [--no-fx] (no slides, vibrato, fades)
import fs from 'node:fs';

const args = process.argv.slice(2);
const files = args.filter((a, i) => !a.startsWith('--') && !['--wave', '--part-wins-from'].includes(args[i - 1]));
const pw = args.indexOf('--part-wins-from');
const partWinsFrom = pw >= 0 ? +args[pw + 1] : 8; // bar number, 1 = first
const cart = 'game/blessed.p8';
const FIRST = 8;
const useFx = !args.includes('--no-fx');
// PICO-8 waveforms: 0 triangle, 1 tilted saw, 2 saw, 3 square, 4 pulse,
// 5 organ, 6 noise, 7 phaser
const waves = {melody: 3, harmony: 0, bass: 0};
const wi = args.indexOf('--wave');
if (wi >= 0) for (const kv of args[wi + 1].split(',')) { const [k, v] = kv.split('='); waves[k] = +v; }
// how many volume steps (of 7) each part sits under its MIDI velocity
const quiet = {harmony: 3};

// --- read the MIDI files
let tempo = 500000; // microseconds per quarter
let division = 480;
const tracks = [];
for (const file of files) {
  const buf = fs.readFileSync(file);
  let pos = 0;
  const u32 = () => { const v = buf.readUInt32BE(pos); pos += 4; return v; };
  const u16 = () => { const v = buf.readUInt16BE(pos); pos += 2; return v; };
  const vlq = () => { let v = 0, b; do { b = buf[pos++]; v = (v << 7) | (b & 0x7f); } while (b & 0x80); return v; };
  if (buf.toString('latin1', 0, 4) !== 'MThd') throw new Error(`${file} is not a MIDI file`);
  pos = 4; const hl = u32(); u16(); const ntracks = u16(); const div = u16(); pos = 8 + hl;
  const scale = division / div; // every file on the same grid
  for (let t = 0; t < ntracks; t++) {
    if (buf.toString('latin1', pos, pos + 4) !== 'MTrk') break;
    pos += 4; const len = u32(); const end = pos + len;
    let tick = 0, status = 0, name = '';
    const on = new Map(), notes = [];
    while (pos < end) {
      tick += vlq();
      const b = buf[pos];
      if (b & 0x80) { status = b; pos++; }
      const type = status & 0xf0;
      if (status === 0xff) {
        const meta = buf[pos++]; const l = vlq(); const data = buf.subarray(pos, pos + l); pos += l;
        if (meta === 0x51) tempo = (data[0] << 16) | (data[1] << 8) | data[2];
        // track or instrument name; Logic puts hers in one of the two
        if (meta === 0x03 || meta === 0x04) {
          const t = data.toString('latin1').trim();
          if (!name || /melody|harmony|bass|kit|drum/i.test(t)) name = t;
        }
      } else if (status === 0xf0 || status === 0xf7) { pos += vlq(); }
      else if (type === 0x90 || type === 0x80) {
        const key = buf[pos++], vel = buf[pos++];
        if (type === 0x90 && vel > 0) on.set(key, {key, vel, start: tick * scale});
        else if (on.has(key)) { const n = on.get(key); on.delete(key); n.end = tick * scale; notes.push(n); }
      } else if (type === 0xc0 || type === 0xd0) pos += 1;
      else pos += 2;
    }
    pos = end;
    if (!notes.length) continue;
    name = name.toLowerCase();
    const drums = /kit|drum/.test(name) || /drum/i.test(file);
    tracks.push({name: drums ? 'drums' : name, drums, notes});
  }
}
const bpm = 60e6 / tempo;
const step = division / 4; // ticks per 16th
const steps = Math.ceil(Math.max(...tracks.flatMap((t) => t.notes.map((n) => n.end))) / step / 32) * 32;
// a 16th at this tempo, in PICO-8 speed units (183 samples at 22050 Hz)
const speed = Math.max(1, Math.round((60 / bpm / 4) / (183 / 22050)));
const at = (n) => Math.round(n.start / step);
const until = (n) => Math.max(Math.round(n.end / step), at(n) + 1);

// --- one note per step per part
const parts = tracks.filter((t) => !t.drums).slice(0, 3).map((tr, ti) => {
  const wave = waves[tr.name] ?? [3, 0, 0][ti];
  const grid = Array.from({length: steps}, (_, s) => {
    const live = tr.notes.filter((n) => at(n) <= s && until(n) > s);
    if (!live.length) return null;
    live.sort((a, b) => a.key - b.key);
    // a chord: take turns, one note per step
    const n = live.length > 1 ? live[s % live.length] : live[0];
    let p = n.key - 36; // PICO-8 pitch 0 is MIDI C2 (pitch 33 is A 440)
    while (p < 0) p += 12; while (p > 63) p -= 12;
    const vol = Math.max(1, Math.min(7, Math.round(n.vel / 127 * 7) - (quiet[tr.name] || 0)));
    // effects: a long melody note gets vibrato (2) after its first 2
    // steps; harmony notes fade out (5) on their last step, like a
    // plucked piano; the bass plays plain
    const st = at(n), en = until(n);
    let fx = 0;
    if (useFx && tr.name === 'melody') { if (en - st >= 4 && s - st >= 2) fx = 2; }
    else if (useFx && tr.name === 'harmony' && s === en - 1 && en - st >= 2) fx = 5;
    return {p, wave, vol, fx};
  });
  // the melody slides (1) into the first note of each phrase, from a
  // little below (the silent step before it carries the starting pitch)
  if (useFx && tr.name === 'melody') {
    for (let s = 1; s < steps; s++) {
      if (grid[s] && !grid[s - 1]) {
        grid[s] = {...grid[s], fx: 1};
        grid[s - 1] = {p: Math.max(0, grid[s].p - 3), wave: grid[s].wave, vol: 0, fx: 0};
      }
    }
  }
  return {name: tr.name || `track ${ti + 1}`, wave, grid};
});

// --- drums: into the part with the most rests where they hit
const drum = tracks.find((t) => t.drums);
let drumNote = '';
if (drum) {
  const hits = drum.notes.map((n) => ({s: at(n), key: n.key, vel: n.vel})).filter((h) => h.s < steps);
  const low = Math.min(...hits.map((h) => h.key));
  const free = (part) => hits.filter((h) => !part.grid[h.s] || part.grid[h.s].vol === 0).length;
  const choices = parts.filter((p) => p.name !== 'melody');
  const host = choices.sort((a, b) => free(b) - free(a))[0];
  let covered = 0, dropped = 0;
  for (const h of hits) {
    const busy = host.grid[h.s] && host.grid[h.s].vol > 0;
    // from that bar on, the part's own notes come first
    if (busy && h.s >= (partWinsFrom - 1) * 16) { dropped++; continue; }
    if (busy) covered++;
    const vol = Math.max(1, Math.round(h.vel / 127 * 6));
    host.grid[h.s] = h.key === low
      ? {p: 12, wave: 0, vol: 7, fx: 3} // kick: low triangle, pitch drops
      : {p: 36 + (h.key - low) % 12, wave: 6, vol, fx: 5}; // noise hit, fades
  }
  drumNote = `drums: ${hits.length} hits, in the ${host.name}: ${covered} of its notes give way to a drum before bar ${partWinsFrom}; from bar ${partWinsFrom} the ${host.name} wins (${dropped} drum hits left out, the rest fill its rests)`;
}

const hex = (v, w) => v.toString(16).padStart(w, '0');
const sfx = []; const seen = new Map();
const channels = parts.map((part) => {
  const ids = [];
  for (let c = 0; c < steps; c += 32) {
    const body = part.grid.slice(c, c + 32).map((n) => n ? hex(n.p, 2) + n.wave + n.vol + n.fx : '00000').join('');
    if (!seen.has(body)) { seen.set(body, FIRST + sfx.length); sfx.push(body); }
    ids.push(seen.get(body));
  }
  return {...part, ids};
});
if (FIRST + sfx.length > 64) throw new Error(`needs ${sfx.length} sfx; only ${64 - FIRST} fit`);

// --- write into the cart: sfx 8 and up, music patterns from 0
let text = fs.readFileSync(cart, 'utf8');
const section = (name) => { const m = text.match(new RegExp(`__${name}__\\n([\\s\\S]*?)(?=\\n__\\w+__|$)`)); return m ? m[1].split('\n').filter(Boolean) : []; };
const empty = '00' + hex(16, 2) + '0000' + '0'.repeat(160);
const sfxLines = section('sfx');
while (sfxLines.length < 64) sfxLines.push(empty);
for (let i = FIRST; i < 64; i++) sfxLines[i] = empty;
sfx.forEach((body, i) => { sfxLines[FIRST + i] = '00' + hex(speed, 2) + '0000' + body; });
const patterns = channels[0].ids.length;
const musicLines = [];
for (let i = 0; i < patterns; i++) {
  const flags = (i === 0 ? 1 : 0) | (i === patterns - 1 ? 2 : 0); // loop start / loop back
  const ch = [0, 1, 2, 3].map((c) => hex(channels[c] ? channels[c].ids[i] : 0x40, 2));
  musicLines.push(hex(flags, 2) + ' ' + ch.join(''));
}
const put = (name, lines) => {
  const block = `__${name}__\n${lines.join('\n')}`;
  const re = new RegExp(`__${name}__\\n[\\s\\S]*?(?=\\n__\\w+__|$)`);
  text = re.test(text) ? text.replace(re, block) : text.replace(/\n*$/, '\n') + block + '\n';
};
put('sfx', sfxLines);
put('music', musicLines);
fs.writeFileSync(cart, text.endsWith('\n') ? text : text + '\n');

const names = ['triangle', 'tilted saw', 'saw', 'square', 'pulse', 'organ', 'noise', 'phaser'];
console.log(`${Math.round(bpm)} BPM → PICO-8 speed ${speed}; ${steps / 16} bars → ${patterns} patterns`);
channels.forEach((c) => console.log(`  ${c.name}: ${names[c.wave]}`));
if (drumNote) console.log('  ' + drumNote);
console.log(`${sfx.length} sfx used (${FIRST}–${FIRST + sfx.length - 1}); repeats stored once. Wrote ${cart}`);
