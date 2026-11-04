# Nun game (working title)

Blessed! with nuns and a twist: nuns walk around with candles and leave
light wherever they go. For now the cart (`nuns.p8`) holds only Shalone's
music, with a little player: left/right picks a song.

## Music

Her MIDIs (from Logic) are in `music/`. The cart's songs, in this order:

| song | file | music(n) |
|---|---|---|
| home screen | `home-screen.mid` | `music(0)` |
| world map | `world-map-normal.mid` | `music(12)` |
| world map, fast (the last minute) | `world-map-fast.mid` | `music(16)` |

sfx 0-7 are Blessed!'s sound effects (the game will reuse them). To redo
the music after changing a MIDI, start from a cart without songs (delete
the `__music__` section and every `__sfx__` line after the 8th), then:

    npm run music -- game/nuns/music/home-screen.mid --cart game/nuns/nuns.p8 --append
    npm run music -- game/nuns/music/world-map-normal.mid --cart game/nuns/nuns.p8 --append --part-wins-from 99
    npm run music -- game/nuns/music/world-map-fast.mid --cart game/nuns/nuns.p8 --append --part-wins-from 99

Each prints where its song starts (`music(n)`). The snare and kick tracks
are played as one drum kit inside the harmony part (the 4th channel stays
free for sound effects); `--part-wins-from 99` lets the drums win all the
way through, so both world-map songs keep their beat.
