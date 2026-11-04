# Putting the games on the kids site

The game is served from your own Ghost site, inside your theme, so no
other company is involved.

## 1. Export the web version (PICO-8)
In PICO-8, type:

    load blessed-release
    export blessed.html

That makes two files in the carts folder (type `folder` to open it):
`blessed.html` and `blessed.js`. Keep them together.

## 2. Get your kids site's theme (Ghost)
In the kids site's Ghost admin: **Settings → Design & branding →
Change theme → Advanced**, then **Download** the active theme. That
saves a zip, e.g. `kids-theme.zip`, in Downloads.

## 3. Add the game to the theme (Terminal, in sdcourses)

    npm run game-to-theme -- ~/Downloads/kids-theme.zip "<carts folder>/blessed.html"

It writes `kids-theme-with-games.zip` next to the original, with the game
under `assets/games/` and the **Game** page template from `game/theme/`
(`custom-game.hbs`, `assets/css/game.css`, `assets/js/game.js`). Several
games can go in at once: list each `.html`. (The carts folder is usually
`~/Library/Application Support/pico-8/carts`.)

## 4. Upload it (Ghost)
Upload it **under the active theme's own name** (rename the zip to it,
e.g. `fumio-pwa-latest-7.2-13.zip`), so it replaces that theme in place and
your design settings stay: **Settings → Design & branding → Change theme →
Upload theme**, overwrite, keep it active. Check that the game opens at:

    https://kids.methodiusmedia.com/assets/games/blessed.html

## 5. A page for it (Ghost)
Make a page whose **slug is the game's name** (`blessed`, `candles`), in
its settings pick **Template: Game**, give it the tag **#games** (so it
shows on the Games page) and the cartridge picture as its feature image
(the Games page's shelf uses it). The template shows the title, the
excerpt as a tagline, and the game in its cabinet; everything else is the
page's own content: "How to play", the downloads card, the credit line:

> *Art, music and game design by Shalone Cason. Code written with AI help
> (Claude).*

## 6. Downloads (computer versions)
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

Each card gets a big "Download for Windows/Mac/…" button for the
visitor's own computer (`game.js`); phones and tablets just see the links.

## Updating the game later
Repeat 1, 3 and 4 with the theme zip you already have (or a fresh
download, if you changed the theme in between). The page stays the same;
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
