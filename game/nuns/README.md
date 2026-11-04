# Candles! (the nun game, working title)

Blessed! with nuns and a twist. The sisters walk the town with candles
and drop them as they go; everyone in a candle's light is prayed for, and
people walk to the nearest light. Shrines (built as you level up) have
candles that never go out. The town is always dark, dusk or night (each
day picks one), so the candlelight shows. The church, hospital, houses
and big needs work as in Blessed!, in the words of prayer.

- `nuns.p8`: the 1-player cart, the one to edit (code, her music).
- `nuns4.p8`: the 4-player cart, made from it (lines ending `--1p` left
  out, lines starting `--4p` put in), like Blessed!'s.
- `npm run nuns` puts her drawings in (per `sprites.json` here), makes
  the 4-player cart and the `-release` copies of both.
- Saves (`cartdata("sdcason_nuns")`) are separate from Blessed!'s.

## The sisters

| sister | drawing | start | to unlock |
|---|---|---|---|
| Benedictine | `nun-benedictine-idle` | ora et labora (none) | – |
| Sister of Charity | `nun-sister-of-charity-idle` | starts at the hospital | pray for 50 sick in a day |
| Missionary Sister | `nun-missionary-sister-idle` | walks faster | find 3 combos |
| Discalced Carmelite | `nun-discalced-carmelite-idle` | candles burn twice as long | build 3 shrines in a day |
| Poor Clare | `nun-poor-clare-idle` | 2 more candles at once | pray for 500 in a day |

Players pick skin and eyes (up/down); the habits stay as she drew them.
Each nun holds `nun-candle` (its bottom-left 8x8, `nun-candle-small`) on
her white square; dropped candles use the same 8 frames and flicker before
they go out.

## Candles and shrines

- You drop a candle every 40 frames while walking (or driving). At most
  2 burn at once (the oldest goes out), each for 5 s.
- Your own light prays for everyone in reach, as blessing did; dropped
  candles and shrines pray half as often. Candles near the hospital pray
  for the sick (once you're the hospital sister).
- New upgrades: bigger flame (reach), quick prayers, longer wick (+3 s),
  more candles (+1 at once), a shrine (built where you stand, up to 3:
  her three drawings in turn), shrine candles (shrines reach farther).
- The rest are Blessed!'s, renamed: convent (a novice joins you), church
  sister, hospital sister, nursing sister, chapel sister.
- Combos are Blessed!'s for now (renamed for sisters; anointing left out),
  until she has her own.

## Music

Her two songs, one bright piano sound (tilted saw, each note fading like
a struck key, PICO-8's reverb filter at 2), all three music channels
(channel 3 stays free for sound effects):

| song | file | music patterns | plays |
|---|---|---|---|
| slow (16 bars) | `music/slow.mid` | 0-7, `music(0)` | home screen and town |
| fast (8 bars) | `music/fast.mid` | 8-11, `music(8)` | the last minute |

Her chords have 4 notes; PICO-8 plays 3 at once here, so the top note
always sounds and the chord's other notes share the other two channels
(the lowest two take turns). To redo them after changing a MIDI:

    npm run music -- game/nuns/music/slow.mid --cart game/nuns/nuns.p8 --piano --reverb 2 --bars 16
    npm run music -- game/nuns/music/fast.mid --cart game/nuns/nuns.p8 --piano --reverb 2 --bars 8 --append

(The first clears every song sfx, 8-63, and the music patterns; sfx 0-7
are Blessed!'s sound effects, kept. The older MIDIs in `music/` are no
longer in the cart.)
