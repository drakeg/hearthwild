# Contributing to Hearthwild

Thanks for wanting to help build Hearthwild! This guide covers the ground rules, how to set up the game, and how a change goes from an idea to a release.

> **Licensing:** Hearthwild is free software under the [GNU AGPL v3 or later](LICENSE). By submitting a pull request, you agree that your contribution is licensed under the same terms. Assets you add must be CC0 or CC-BY (see the ground rules).

## Ground rules

1. **Everything must be original or openly licensed.** Hearthwild is its own game. Never add code, art, sound, names, maps, text or network protocols from another game, especially commercial MMOs. Third-party assets must be **CC0 or CC-BY**, and each one must be listed in [`public/models/CREDITS.md`](public/models/CREDITS.md) with its source and license.
2. **Never touch a real save.** Don't commit or overwrite `data/world.json`, and never run tests against a live world. Tests make their own worlds in memory or in temporary folders.
3. **The server is the authority.** The client asks; the server decides. Anything that changes the game (damage, loot, movement, gold) is checked on the server, and the client only shows the result.
4. **Keep it dependency-free.** The game runs on Node.js 22+ and a browser with no `npm install`. Don't add runtime dependencies without discussing it in an issue first. The vendored copy of three.js in `public/vendor/` is the exception.
5. **Be kind.** Everyone taking part follows the [Code of Conduct](CODE_OF_CONDUCT.md).
6. **Report security problems privately.** See [`SECURITY.md`](SECURITY.md); please don't open public issues for them.

## Setting up

```sh
git clone https://github.com/drakeg/hearthwild.git
cd hearthwild
npm start            # http://127.0.0.1:4180 (needs Node.js 22+)
npm test             # all automated tests
npm run check        # syntax checks
```

There's no build step: edit a file in `public/` or `server/` and reload. Every file in `public/` with a known type is served automatically; restart the server after adding one. The desktop app (Electron) is packaged by the release workflow; you don't need it to develop. Your local world is saved in `data/` (ignored by Git).

### Where things live

| Folder | What's in it |
|---|---|
| `server/` | The game server: `world.js` (the simulation), `http.js` (API and static files), `content*.js` (items, quests, NPCs), `crypt.js` (dungeons and raids), `finder.js`, `party.js`, `travel.js`, `interest.js` |
| `public/` | The browser client: `game.js` (3D and input), `hud.js` (maps and windows), `combat-ui.js`, plus shared data modules used by both sides (`terrain.js`, `dungeon-layout.js`, `reagents.js`, `ui-model.js`) |
| `desktop/` | The Electron app and the Server Manager window |
| `tests/` | `node:test` test files, one per area |
| `docs/agile/` | The process, the backlog and the sprint files |
| `.github/` | The release workflow and templates |

## How work flows

Hearthwild uses a light Agile process; the details are in [`docs/agile/README.md`](docs/agile/README.md).

1. **Find or propose an item.** Look at the [backlog](docs/agile/BACKLOG.md), or open an issue using the *Bug report* or *Idea / story* template. Every item gets an ID like `HW-123`.
2. **Agree before building.** Comment on the issue to say you'd like to take it. The Product Owner (@drakeg) decides what goes into each sprint.
3. **Branch** from `main`: `sprint-NN/HW-123-short-name`, or `contrib/HW-123-short-name` if your item isn't in a sprint.
4. **Commit** with the ID first: `HW-123: Herb finder legend filters by herb`.
5. **Open a pull request** using the template. List the story IDs, say whether it must be merged after another PR, describe how you tested it, and tick the Definition of Done.
6. **Review:** the Product Owner reviews and merges. Releases are automatic: when a merge changes the version in `package.json`, GitHub Actions builds the downloads for every OS and publishes the release. Don't change the version yourself; that happens once per sprint.

## Definition of Done (short version)

- The acceptance criteria are met.
- **Tests** cover the new behaviour, and `npm test` and `npm run check` pass.
- You **tried it** in the browser (and the desktop app, if you changed it). Add a screenshot for anything visual.
- **README** and **CHANGELOG** are updated where players or hosts would notice the change.
- The ground rules above are followed.

## Style

- **JavaScript:** modern ES modules, two-space indentation, double quotes, semicolons, and lines around 140 characters (Prettier-like).
- **Comments** explain *why*, in plain English. Keep the existing tone: short, friendly sentences.
- **In-game text and docs:** plain, warm English with no jargon. Write as if for a player who has never seen an MMO.
- **Data first:** content (zones, items, quests, bosses) lives in data tables rather than special-case code.
- **Tests:** put new tests in `tests/<area>.test.js`. Build the world each test needs, and don't depend on random spawns.

## Reporting bugs

Use the **Bug report** issue template, and include:
- the version (shown in the game menu or the release name);
- your operating system;
- what you did, what you expected, and what happened;
- any error from the browser console or the server terminal.

## Questions

Open a discussion or an issue labelled *question*. Thanks again for helping!
