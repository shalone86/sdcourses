# Putting the games on the kids site

The game is served from your own Ghost site, inside your theme, so no
other company is involved.

## 1. Export the web version (PICO-8)
The site plays the 1-player cart (phones, tablets and a keyboard are
one player anyway). In PICO-8, type:

    load blessed-release
    export blessed.html

That makes two files in the carts folder (type `folder` to open it):
`blessed.html` and `blessed.js`. Keep them together.

## 1b. The downloads (PICO-8)
Both carts as programs that run without PICO-8 (Windows, Mac, Linux,
Raspberry Pi), and as .p8.png carts for PICO-8, RetroPie and handhelds:

    load blessed-release
    export blessed.bin
    save blessed.p8.png
    load blessed4-release
    export blessed4.bin
    save blessed4.p8.png

`export ….bin` makes a `….bin` folder with one zip per computer. If PICO-8
says the code is too big to save as .png, tell Claude (that's the
compressed-size limit, separate from tokens).

## 2. Put it online (Terminal, in sdcourses)

    npm run add-game -- "<carts folder>/blessed.html"

The game lives on Pico Parish (since 2026-11-10): this copies the `.html` and `.js` into its
`play/` folder (making the screen fill its frame), commits, puts it online at
`https://picoparish.com/play/blessed` and pushes. Several games can go at once. A fix is the same
command again. (The carts folder is usually `~/Library/Application Support/pico-8/carts`.)

## 3. The Game template (once)
The kids theme's **Game** template (`game/theme/custom-game.hbs`) shows
`picoparish.com/play/<slug>` in its cabinet, so new games need no theme upload. If the
template itself changes: in Ghost, **Settings → Design & branding → Change theme → Advanced →
Download** the active theme, then

    npm run game-to-theme -- ~/Downloads/<theme>.zip

and upload the `-with-games.zip` **under the active theme's own name** (rename it, e.g.
`fumio-pwa-latest-7.2-13.zip`) so it replaces that theme in place and your design settings stay.
The older games stay in the theme at `/assets/games/`, so old links keep working.

## 4. A page for it (Ghost)
Make a page whose **slug is the game's name** (`blessed`, `candles`), in
its settings pick **Template: Game**, give it the tag **#games** (so it
shows on the Games page) and the cartridge picture as its feature image
(the Games page's shelf uses it). The template shows the title, the
excerpt as a tagline, and the game in its cabinet; everything else is the
page's own content: "How to play", the downloads card, the credit line:

> *Art, music and game design by Shalone Cason. Code written with AI help
> (Claude).*

## 5. Downloads (computer versions)
In PICO-8, `export blessed.bin` makes `blessed.bin/` with a zip for
Windows, Mac (`_osx`), Linux and Raspberry Pi. Upload the zips to Ghost
(they become `/content/files/...` links) and the cartridge picture
(`blessed.p8.png`, from `save blessed.p8.png`), then add an **HTML** card:

```html
<div class="game-downloads">
<h2>Play on your computer</h2>
<div class="game-dl">
  <img src="<cartridge picture>" alt="Blessed! cartridge">
  <h3>Blessed!</h3>
  <p>1 player &middot; the same game as above</p>
  <div class="game-dl-all"><a data-os="windows" href="<windows zip>">Windows</a><a data-os="mac" href="<osx zip>">Mac</a><a data-os="linux" href="<linux zip>">Linux</a><a data-os="raspi" href="<raspi zip>">Raspberry Pi</a></div>
</div>
<!-- one .game-dl per version (Blessed! 4 Players is the second) -->
<p class="game-dl-note">Free. Unzip it and open the game; no internet needed. On a Mac, the first time, right-click the app and choose Open.</p>
</div>
```

Under it, the controls and the credit line (change them to your words):

> **How to play:** arrow keys walk; **Z** opens the town map; **X** takes
> upgrades. On a phone, use the on-screen buttons.
>
> *Art, music and game design by Shalone Cason. Code written with AI help
> (Claude).*

Then the downloads: type `/file` in the editor for a **File** card and
upload each zip (and the two .p8.png carts), with a line saying which is
which: *Blessed! (1 player)* and *Blessed! (4 players: players 2–4 press X
on their own controller on the start screen to join)*.

## Updating the game later
Export again (1) and run `npm run add-game` (2). The page stays the same;
new downloads need new uploads and their links swapped in the card.

## The Games page (/games/)
A page with slug `games` and **Template: Games** (`custom-games.hbs`) shows
every published page tagged **#games**, newest first: a shelf of their
cartridges that jumps to each one, then each game playable right there
with its own content (how to play, downloads, credit) and a link to its
own page. Its own content (if any) shows as an intro under the title. Each
game page has an "All games" link back to it. A new game only needs its
page made as in step 5; the Games page picks it up by itself.

## Good to know
- High scores and unlocks are saved in each player's own browser, per
  site address (kids.sdcason.com now redirects to kids.methodiusmedia.com,
  so anything saved on the old address before the move stays there).
- Ghost may cache the old version for a short while after an update; a
  refresh (or a minute) brings the new one.
- `game-to-theme` fills PICO-8's player to the edge (its shell leaves a 5%
  grey margin otherwise), so the game fills the cabinet screen.
