# Hams Tavern: The Bells of Lahti

A solo fantasy RPG with an offline game master. You type what you want to do in plain words — *punch the zombie*, *ask Squib about the barrel*, *kick the vestry door* — and the game master resolves it with fifth-edition rules, dice, and a world that remembers how you treated it. No server, no AI service, no account: it all runs on the device.

**Play the playtest build:** https://hamsaladslammer.github.io/hams-tavern/

**Android app (playtest):** https://hamsaladslammer.github.io/hams-tavern/hams-tavern.apk
Open the link on an Android phone, download it, then tap the file to install. Android will ask you to allow installs from your browser or file manager. If Play Protect warns about an unrecognised developer, tap **More details → Install anyway**. Later builds install over the old one and keep your save.

You can also open the web link in Chrome and choose **Add to Home screen**.

## What's new in v0.2

- **Try anything.** Drink the mug Squib hands you, sit on a stool, climb the rafters, break a chair and swing the leg, light candles, play cards with the dwarves, forage, track, pray, pickpocket. Anything the story doesn't script gets a skill, a DC and a roll; the oracle decides whether the thing you reach for is actually there.
- **Chained commands:** "take the mug, drink it, then go outside".
- **Drinking:** ale, stout, cider, wine and Trenchfire, with tipsy, drunk and blackout.
- **Improvised weapons:** mugs, bottles, chair legs, rocks, bones, candles.
- **The Forge is back:** the original form-based creator with live preview, standard array, 4d6 or point buy, skills, spells, a life path, look, backstory and kit.
- **All 12 classes**, each with a Kalashscovia twist; **35 species** (the 9 SRD species plus original-named folk in the roles players know); **16 backgrounds** with feats.
- Subclasses arrive with level 3, in a later version.

## What's in v0.1

- **Act One, "The Old Chapel Bell":** the village of Breda, the Smoking Barrel and Squib, the Thornwood March, Kessel's Rest, Doss's pasture, and the Old Chapel's graveyard, nave, vestry, bell tower and crypt. Meet Alistair, a lich who never wanted the party to end. It takes about one to two hours to play.
- **Character creation:** 9 species, 5 classes (Fighter, Rogue, Monk, Wizard, Cleric) and 4 backgrounds, at levels 1–2.
- **Combat:**
  - Turn-based, with initiative, advantage, criticals, death saves, Undead Fortitude, and shoving and grappling.
  - Spells, class features, and companions (Kettle the war hound and Alistair).
  - Firearms that jam and need reloading.
- **Plain-language input:** dozens of verbs map to actions. Punch, kick, knee, elbow, headbutt, bite, slap, poke, karate chop, mule kick and the rest are all unarmed strikes, and each gets narration for that particular blow.
- **Speech judged by how you use it:** "oh shit" is an exclamation and "fuck you, Squib" is an insult, and NPCs react to each in character. Squib gives you one warning, then stops serving you. The dwarves cheer. Hetch the cat says "Language."
- **Oracle:** type `? Is anyone watching me` and a yes/no oracle answers. It uses a chaos factor, Mythic-style.
- **Saving:** the game saves automatically after every move. You can export and import saves, there's a dark and a light theme, and you can change the text size.
- **When you lose a fight:** you wake up at dawn with lighter pockets. The Pale Queen wants witnesses.

## Playtesting

1. Play on the link above.
2. If something breaks, open **Menu → Export save** and send the file along with what you typed.
3. Every push to `main` runs the tests and redeploys automatically within a couple of minutes. To get the newest version, reload, or tap the "new version" toast.

## Development

```sh
npm install
npm run dev      # local dev server
npm test         # parser, profanity and full scripted playthroughs of Act One
npm run build    # production build in dist/
```

### Layout

| Path | What it is |
| --- | --- |
| `src/engine/` | Rules: dice, characters, combat, oracle, and the game master (`game.ts`). Pure TypeScript with no DOM code. |
| `src/nlp/` | Intent parser, verb lexicon, profanity speech-act classifier, and narration grammar |
| `src/content/` | The world: rooms, NPCs, encounters and travel tables for Act One |
| `src/ui/` | Phone-first interface and the save layer |
| `tests/` | Unit tests, plus headless playthroughs that finish Act One with 8 different characters |

### Road to Android and Steam

The game is a static web app built with `base: './'`, so the same `dist/` folder works in all of these:

- **Web/PWA:** GitHub Pages, as it does now.
- **Android:** the Capacitor project in `android/` is already set up. CI builds a signed APK on every push and publishes it to the `playtest` release. Before going to Google Play, swap the committed playtest key for a private upload key and build an `.aab`.
- **Steam:** wrap `dist/` with Electron. Steamworks (achievements, cloud saves) gets added through steamworks.js.

## Credits

The world and story are © Jared. Rules material comes from SRD 5.2.1 under CC-BY-4.0. See [ATTRIBUTION.md](ATTRIBUTION.md) and [LICENSE](LICENSE).
