# Hams Tavern: The Bells of Lahti

A solo fantasy RPG with an offline game master. You type what you want to do in plain words — *punch the zombie*, *ask Squib about the barrel*, *kick the vestry door* — and the game master resolves it with fifth-edition rules, dice, and a world that remembers how you treated it. No server, no AI service, no account: it all runs on the device.

**Play the playtest build:** https://hamsaladslammer.github.io/hams-tavern/

On Android, open the link in Chrome and choose **Add to Home screen**. It then runs full-screen and works offline.

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
- **Android:** wrap `dist/` with Capacitor and publish to Google Play. The save layer in `src/ui/storage.ts` takes a native storage backend.
- **Steam:** wrap `dist/` with Electron. Steamworks (achievements, cloud saves) gets added through steamworks.js.

## Credits

The world and story are © Jared. Rules material comes from SRD 5.2.1 under CC-BY-4.0. See [ATTRIBUTION.md](ATTRIBUTION.md) and [LICENSE](LICENSE).
