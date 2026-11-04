# Nun game (working title)

Blessed! with nuns and a twist: nuns walk around with candles and leave
light wherever they go. For now the cart (`nuns.p8`) holds only Shalone's
music, with a little player: left/right picks a song.

## Music

Shalone finished the music in PICO-8 herself, so `nuns.p8` is now the
source for it: don't rerun `npm run music` on this cart (it would replace
her work). Her songs:

| song | music patterns | in the code |
|---|---|---|
| home screen | 8-11 | `music(8)` |
| world map | 12-15 | `music(12)` |
| world map, fast (the last minute) | 20-23 | `music(20)` |

Patterns 0-7 and 16-19 are lead-ins: when a song reaches its last
pattern, PICO-8 jumps back to the nearest earlier pattern marked "loop
start", which is 0 for the home screen (7 silent patterns, then the song
again) and 16 for the fast song (her drums first).

sfx 0-7 are Blessed!'s sound effects (the game will reuse them). Her
original MIDIs are in `music/`.
