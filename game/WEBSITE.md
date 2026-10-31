# Putting Blessed! on the kids site

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

It writes `kids-theme-with-games.zip` next to the original.
(The carts folder is usually `~/Library/Application Support/pico-8/carts`.)

## 4. Upload it (Ghost)
**Settings → Design & branding → Change theme → Upload theme**, choose
`kids-theme-with-games.zip`. If Ghost asks, let it overwrite the theme
of the same name, and keep it active. Check that the game opens at:

    https://kids.sdcason.com/assets/games/blessed.html

## 5. A page for it (Ghost)
Make a page or post, add an **HTML** card, and paste:

```html
<div style="width:100%;max-width:560px;margin:0 auto">
  <div style="position:relative;padding-top:100%">
    <iframe src="/assets/games/blessed.html" title="Blessed!"
      style="position:absolute;inset:0;width:100%;height:100%;border:0"
      allow="autoplay; fullscreen; gamepad" allowfullscreen></iframe>
  </div>
</div>
```

Under it, the controls and the credit line (change them to your words):

> **How to play:** arrow keys walk; **Z** opens the town map; **X** takes
> upgrades. Player 2 joins on the start screen with their own X
> (keyboard: S F E D to move, A or Q for X). On a phone, use the on-screen
> buttons.
>
> *Art, music and game design by Shalone Cason. Code written with AI help
> (Claude).*

## Updating the game later
Repeat 1, 3 and 4 with the theme zip you already have (or a fresh
download, if you changed the theme in between). The page from step 5
stays the same.

## Good to know
- High scores and unlocks are saved in each player's own browser.
- Ghost may cache the old version for a short while after an update; a
  refresh (or a minute) brings the new one.
