# Agent operating instructions

For AI coding agents (and humans) working on Hearthwild. Follows the [Mad Mallard repository standards](https://github.com/drakeg/madmallard-repository-standards); where this file and those standards differ, **this file wins** for this project.

## Read first

[README](README.md), [SPRINTS](SPRINTS.md), [BACKLOG](BACKLOG.md), [CONTRIBUTING](CONTRIBUTING.md), [RELEASES](RELEASES.md), [SECURITY](SECURITY.md), the [Agile process](docs/agile/README.md), and the workflows in `.github/workflows/`.

## Project rules (never break these)

1. **Original work only.** All code, art, names and text are original, or assets are CC0 / CC-BY and credited in `public/models/CREDITS.md`. No assets, code, names or protocols from any commercial game. Don't name or compare Hearthwild to other commercial games in code, docs or release notes.
2. **Never touch a real save.** `data/world.json` (and any `DATA_DIR` in use) belongs to the player. Tests and dev servers use their own temporary folders.
3. **License:** AGPL-3.0-or-later. New files are under the same license.
4. **No runtime npm dependencies** for the server or client unless the Product Owner agrees; the game runs on plain Node 22 and browser JavaScript (Three.js is vendored).
5. **The server is authoritative.** Clients send intentions; the server checks everything (range, cooldowns, ownership, bag space, gold).

## How to work

- **Every change maps to a backlog ID** (`HW-###`). Bugs can be fixed first and recorded afterwards.
- **Branch** `sprint-NN/HW-###-short-name`; **commits** start with the ID; **pull requests** use the template, list the IDs, and give the merge order if stacked. The required checks (CI and CodeQL) must pass; formal review approval is optional, and the Product Owner merges. Once a PR has been reported as ready, don't push more to it: follow-ups go in a new PR.
- **Before opening a PR:** `npm run check` and `npm test` pass; new behaviour has tests; anything with a UI is checked in a browser (screenshot in the sprint file); README, CHANGELOG, the sprint file and BACKLOG are updated.
- **Versions:** bump `package.json` once per sprint, on its last PR. Merging it to `main` publishes the GitHub Release with downloads for every OS (see [RELEASES](RELEASES.md)).
- **Badges** sit directly under the README's title, between the `madmallard-badges` markers. Only claim what the repository proves (a workflow, a manifest, a published release). Regenerate with the standards toolkit's `scripts/badges.py`, then re-add the project badges listed in the README block.
- **Never** expose secrets, and never push to or change another repository from this one.

## Commands

```bash
npm start                                  # server on http://127.0.0.1:4180
HOST=0.0.0.0 npm start                     # same, reachable from your LAN
DATA_DIR=/tmp/hw-test npm start            # a throwaway world
npm test                                   # all tests (node:test)
npm run check                              # syntax check of the main files
docker compose up -d --build               # LAN test server in Docker (port 4180)
```

## Where things live

| Area | Files |
|---|---|
| World, combat, quests | `server/world.js`, `server/combat.js`, `server/content*.js`, `server/wilderness.js` |
| Dungeons and raids | `public/dungeon-layout.js` (layout data), `server/crypt.js` (fights) |
| Social | `server/party.js`, `server/guild.js`, `server/finder.js`, `server/mail.js`, `server/trade.js` |
| Professions and shops | `server/commerce.js`, `server/resources.js`, `public/reagents.js` |
| Achievements | `public/achievements.js` (shared), `server/achievements.js` |
| Client | `public/game.js` (scene and input), `public/hud.js`, `public/*-ui.js` |
| HTTP, accounts, admin | `server/http.js`, `server/accounts.js` |
| Desktop app | `desktop/` (Electron, Server Manager) |
| Process | `SPRINTS.md`, `BACKLOG.md`, `docs/agile/` |
