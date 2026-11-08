# Sending the games to your devices

`npm run ship` copies the newest carts from PICO-8's carts folder to
your handheld, arcade and laptop over Wi-Fi (ssh), all at once. The
kids website is separate (see WEBSITE.md); you upload that theme yourself.

## Each update

1. In PICO-8, save the carts (type `folder` to see where they go):

       load blessed-release
       save blessed.p8.png
       load blessed4-release
       save blessed4.p8.png
       load nuns-release
       save candles.p8.png
       load nuns4-release
       save candles4.p8.png

2. Turn the devices on, on the home Wi-Fi.
3. In Terminal, in sdcourses: `npm run ship`
   (only one device: `npm run ship -- arcade`; just to check: `-- --dry`).

It warns you if a cart in the carts folder is older than the game in
the repo, which means you forgot to save it again in step 1.

A brand-new game only shows up after a refresh. On RetroPie, open the
Start menu, choose Quit, then Restart EmulationStation. On muOS, refresh
the game list. An updated game just replaces the old one, and its high
scores are kept.

## One-time setup

### 1. The list of devices
Copy `game/devices.example.json` to `game/devices.json` (your addresses are already in it) and check the
addresses. That file stays on your computer; it isn't in the repo.
- **host**: `user@address`. RetroPie is usually `pi@retropie.local`. For
  muOS, use the handheld's IP address from your router or muOS's network
  screen: `root@192.168.1.127`.
- **dir**: the folder the games go in.
  - RetroPie: `/home/pi/RetroPie/roms/pico8`
  - muOS: your PICO-8 folder, usually `/mnt/mmc/ROMS/PICO-8` (or
    `/mnt/sdcard/ROMS/…` for the second SD card). Use the name your
    folder really has.
  - Windows: `C:/Users/<you>/AppData/Roaming/pico-8/carts`
- **files**: which carts each device gets. The handheld only needs the
  1-player carts; the arcade and the laptop can have all four.
- **scp**: `["-O"]` is for muOS. If muOS gives an error about
  "sftp", it's needed; if it says "unknown option", remove that line.

### 2. Turn on ssh on each device
- **muOS:** Configuration → Web Services → turn on **SSH**. Login `root`,
  password `root`.
- **RetroPie:** in the RetroPie menu → Raspi-Config → Interface Options →
  SSH → Yes. Login `pi`, password `raspberry` (unless you changed it).
- **Windows laptop:** Settings → System → Optional features → View
  features → add **OpenSSH Server**. Then open PowerShell as
  administrator and type:

      Start-Service sshd
      Set-Service sshd -StartupType Automatic

  (No keyboard? Open **Services** instead, find **OpenSSH SSH Server**,
  press Start, and set Startup type to Automatic.)
  The login is your Windows user name (`shalo`) and the password you use
  to sign in to Windows. If you sign in with a Microsoft account, it's
  that account's password, not your PIN. The address is the laptop's IP
  address (`192.168.1.32`).

### 3. A key, so it stops asking for passwords (optional)
On the Mac, once:

    ssh-keygen -t ed25519

(press Enter at every question). Then for each device:

    ssh-copy-id root@192.168.1.127
    ssh-copy-id pi@retropie.local

Type the device's password one last time. The Windows laptop puts an
administrator's keys in a different place, so for it type this instead
(one line, on the Mac):

    cat ~/.ssh/id_ed25519.pub | ssh shalo@192.168.1.32 "more >> C:\ProgramData\ssh\administrators_authorized_keys && icacls C:\ProgramData\ssh\administrators_authorized_keys /inheritance:r /grant Administrators:F /grant SYSTEM:F"


If the handheld still asks for a password after this, muOS may have
forgotten the key on restart. That's fine; type `root`.

## Version numbers
They're in the code only: `-- version: 1.1` near the top of `blessed.p8`
and `-- version: 1.0` in `nuns/nuns.p8`, copied into the `-release` carts.
Raise them when you send out an update.
