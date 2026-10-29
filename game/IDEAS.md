# Game ideas (Shalone's, kept for later)

## Blessed! (the priest game): later
- More things to bless as side missions: businesses, a president, a king
  (coronation), weddings and baptisms with their own steps.
- More combos, each pairing two upgrades. Players discover them; the game
  remembers which ones they've found.
- Becoming a bishop should make sense. Bishop becomes an unlock; every
  day starts with 1 priest and 1 deacon.
- Seasons: 4 seasons; on Play again, choose a season or random.
- Places to unlock, each with its own building style: Europe, the
  Americas, Africa, the Middle East; and times: ancient Rome, the Middle
  Ages, the Renaissance, the Reformation, ancient China, colonial Americas.
- Donations: the between-days currency (like gold in Vampire Survivors).
  Earned during the day from big needs (weddings, baptisms, the grieving
  widow, new houses) and fully blessed houses; nothing to spend during the
  day. Between days, spend them on unlocks: characters, places, times,
  seasons, small permanent boosts. Grace stays the only currency in a day.
- Coffee shop: no store or menu. A building on the map where coffee
  always comes back after a while, so players plan routes past it. The
  java priest's coffee comes back faster. Later, other café items (e.g. a
  donut that slows how fast people lose patience).
- Characters to unlock, each with a different skill:
  - chaplain: starts with access to the hospital
  - archbishop: starts with a bishop who has 2 priests of his own and
    goes around off the screen (unlike priests)
  - exorcist: starts with a larger blessing area
  - java priest: more coffee drops, and coffee lasts longer
  - pope: not decided yet
  - monk: starts with more angels
  - dominican: starts with the Marian garden and sees more rosaries

## Exorcist (spitballing, nothing decided)
- A special unlock: blesses people as usual, but instead of sick calls
  he goes to the hospital and to houses and casts out demons.
- A large roaming demon he fights back with holy water.
- Probably too much for the main cart: maybe an exorcist mode as its own
  cart, with places like Transylvania, or a separate exorcism game.
- Worry: it could turn into Vampire Survivors with a priest skin. Could
  still be fun.

## A second game: monks and nuns
- Helping the poor, like Mother Teresa. A thinking/puzzle and collecting
  game, not run-and-bless like Blessed!.
- Go through a maze of people and city streets to find the poor and bring
  them to the hospital or hospice.
- Some people are heavy: you need a second nun, a stretcher, a car, etc.
  (upgrades or items).

## Plan (Oct 29, 2026): three new games and four Blessed! eras

Decision: the games are for family and friends on the kids' site, so no
multicart or BBS strategy. Each new game or era is its own cart with its own
link, built only when the kids ask for it. Blessed! is at the token limit, so
eras are copies of the cart with swapped data and changed rules, not unlocks
inside the main cart. Optional later: a shared `cartdata` ID so finishing one
cart gives a small cosmetic perk in the others.

### Three new games
Order of effort: Rosary Rescue, then Deliverance Diary, then Sanctum Siege.

- **Rosary Rescue** (the nuns game; the monks and nuns idea above). A grid
  maze puzzle: navigate city streets and jiggle (push) resources around to
  bring the sick and needy to the hospice or convent. Heavy people need a
  second nun, a stretcher or a car. Smallest build, a good warm-up. Its grid
  movement, pushing and pathing code is reused in Sanctum Siege.
- **Deliverance Diary** (the exorcist detective game). A point-and-click
  detective game. Interview people with a Q&A and decide: normal, possessed,
  or psychosis. Now and then a demon manifests and the player picks the right
  prayers and sacraments to defeat it (a prayer-matching minigame). Mostly
  text, and long strings cost almost no tokens, so there is room for many
  cases. Randomize which symptoms point to which answer so it replays well.
  Its dialogue system could also power the trust conversations in the Franks
  and Goths era.
- **Sanctum Siege** (tactics, based on famous Catholic battles). Move one
  space and attack. Use a top-down grid instead of isometric (iso math and
  depth sorting eat tokens). Each battle gets a small map and a special rule:
  Lepanto (wind direction), Tours, Vienna 1683, Las Navas de Tolosa (a hidden
  path). Reuses the puzzle and grid logic from Rosary Rescue. Ties in with
  the battle scenes in the studio (battle-engine branch).

### Four Blessed! eras (proposed mechanic changes)
- **Byzantine Empire:** iconoclasm. Smuggle and bless icons while dodging
  soldiers; a stealth game. Hide in doorways and chapels; bless an icon in a
  safe house to score.
- **Franks and Goths:** missionary work. Each tribe has a trust meter that
  rises with gifts, listening and small blessings; only then can you
  baptize. Bonus level: Boniface felling the oak, a timing minigame.
- **Asia:** island hopping. Sail between ports, learn a few local words in a
  matching minigame, follow etiquette. A hidden-Christians level in Japan
  where you bless in secret.
- **Colonial Times:** circuit riding. A limited number of days to visit
  scattered settlements, and each stop needs a different blessing. A serious
  level: St. Peter Claver meeting the ships in Cartagena.
