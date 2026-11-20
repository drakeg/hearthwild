# Hearthwild

<!-- madmallard-badges:start -->
![Docker](https://img.shields.io/badge/Docker-2496ED?logo=docker&logoColor=white) ![Docker Compose](https://img.shields.io/badge/Docker%20Compose-2496ED?logo=docker&logoColor=white) ![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?logo=javascript&logoColor=white) ![Node.js 22](https://img.shields.io/badge/Node.js-22-5FA04E?logo=nodedotjs&logoColor=white) ![Three.js](https://img.shields.io/badge/Three.js-000000?logo=threedotjs&logoColor=white) ![Electron](https://img.shields.io/badge/Electron-47848F?logo=electron&logoColor=white) ![Platforms](https://img.shields.io/badge/platforms-macOS%20%7C%20Windows%20%7C%20Linux-informational)

[![ci](https://github.com/drakeg/hearthwild/actions/workflows/ci.yml/badge.svg)](https://github.com/drakeg/hearthwild/actions/workflows/ci.yml) [![codeql](https://github.com/drakeg/hearthwild/actions/workflows/codeql.yml/badge.svg)](https://github.com/drakeg/hearthwild/actions/workflows/codeql.yml) [![release](https://github.com/drakeg/hearthwild/actions/workflows/release.yml/badge.svg)](https://github.com/drakeg/hearthwild/actions/workflows/release.yml) [![License](https://img.shields.io/github/license/drakeg/hearthwild)](https://github.com/drakeg/hearthwild/blob/HEAD/LICENSE) [![Release](https://img.shields.io/github/v/release/drakeg/hearthwild)](https://github.com/drakeg/hearthwild/releases/latest) [![Issues](https://img.shields.io/github/issues/drakeg/hearthwild)](https://github.com/drakeg/hearthwild/issues) [![Release date](https://img.shields.io/github/release-date/drakeg/hearthwild)](https://github.com/drakeg/hearthwild/releases/latest) [![Downloads](https://img.shields.io/github/downloads/drakeg/hearthwild/total)](https://github.com/drakeg/hearthwild/releases) [![Pull requests](https://img.shields.io/github/issues-pr/drakeg/hearthwild)](https://github.com/drakeg/hearthwild/pulls) [![Last commit](https://img.shields.io/github/last-commit/drakeg/hearthwild)](https://github.com/drakeg/hearthwild/commits/main) [![Commit activity](https://img.shields.io/github/commit-activity/m/drakeg/hearthwild)](https://github.com/drakeg/hearthwild/pulse)
<!-- madmallard-badges:end -->

An original online fantasy RPG for you and your friends. Four classes, nine zones and quests up to level 30, ten dungeons, two ten-player raids, a roaming world boss, four professions, guilds, mail, trading and achievements. Host it on your own computer or play on a friend's server. Free software under the AGPL.

## Quick start

| I want to… | Do this |
|---|---|
| **Play** | Download the installer for your system from the [latest release](https://github.com/drakeg/hearthwild/releases/latest): macOS (Apple Silicon or Intel), Windows or Linux. The app runs its own server, so friends can join you. |
| **Try the free demo** | Download a `Hearthwild-Demo-…` file from the same release: the Stillwood and the Hollow Crypt, up to level 6. It installs alongside the full game with its own save. |
| **Host for my home network** | `docker compose up -d --build`, then open `http://<this computer's address>:4180` from any device on the network. Add `HEARTHWILD_DEMO=1` to run the demo instead. |
| **Run from source** | Node.js 22 or later: `npm start`, then open http://127.0.0.1:4180. No `npm install` or build step is needed. |
| **Contribute** | Read [CONTRIBUTING](CONTRIBUTING.md) and [AGENTS](AGENTS.md); see [SPRINTS](SPRINTS.md) and the [BACKLOG](BACKLOG.md) for what's next. |

The installers aren't signed by a registered developer yet. On macOS, right-click the installer and choose **Open**. On Windows, choose **More info → Run anyway** if SmartScreen appears. You need a keyboard, a mouse and a browser or computer with WebGL 2.

## The game

- **Accounts and characters:** make an account with a username and password, then up to twelve characters, each a **Warrior**, **Rogue**, **Warlock** or **Druid** of the **Dawnward** or the **Mossbound**. Each class has its own abilities, a spellbook (**P**), talents at levels 10, 20 and 30, and Rank II abilities from level 22.
- **The world:** about 4 km across. The Stillwood (levels 1–6) is in the middle, with four zones around it and the Outer Ring (levels 20–30) beyond. Every zone has a town with a provisioner, a quest giver and a graveyard. Get around on foot, by **riding** (from level 10), on **caravans** between towns, or with your **waystone** (**H**).

  | Zone | Levels | Town |
  |---|---|---|
  | The Stillwood | 1–6 | Wayfarer’s Camp |
  | The Amber Downs | 6–10 | Harrowford |
  | Saltreed Marsh | 9–13 | Reedwatch |
  | Frostmere Vale | 12–16 | Hollowfrost Lodge |
  | Greyspire Crags | 15–20 | Cragmoor Hold |
  | The Emberwaste | 20–23 | Cinderhold |
  | Gloamwood | 22–25 | Duskhollow |
  | The Sunscar Dunes | 24–27 | Sunmere |
  | Starfall Reach | 27–30 | Starfall Rest |

- **Dungeons:** each group gets its own copy. Talk to the watcher at the door for its quest, then press **F** at the door. Bosses have attacks to dodge, casts to interrupt, and Epic loot. Or press **O** for the **Dungeon Finder**, which builds a group (tank, healer and three damage) and takes you straight in.

  | Dungeon | Zone | Levels |
  |---|---|---|
  | The Hollow Crypt | The Stillwood | 4–6 |
  | The Barrow of Harrow Hill | The Amber Downs | 9–11 |
  | The Drowned Chapel | Saltreed Marsh | 12–14 |
  | Glassmere Depths | Frostmere Vale | 15–17 |
  | The Hollow Peak | Greyspire Crags | 19–21 |
  | The Cinderforge | The Emberwaste | 22–24 |
  | Thornheart Hollow | Gloamwood | 24–26 |
  | Tomb of the Sun-King | The Sunscar Dunes | 26–28 |
  | The Shattered Observatory | Starfall Reach | 29–31 |

- **Raids** (level 28+, up to ten players, three bosses each): **The Sundered Spire** in Starfall Reach and **The Molten Crown** in the Emberwaste. Type `/raid` to turn your group into a raid, or queue in the Dungeon Finder.
- **World boss:** **Gharrowmaw, the Wandering Colossus**, roams the Outer Ring. Everyone online hears when it wakes, and everyone who helps bring it down earns an Epic.
- **Professions:** at Wayfarer’s Camp, Herbalist Mira teaches **Herbalism** and **Alchemy**, and Smith Bran Hollis teaches **Mining** and **Blacksmithing**. Every zone has its own herb, and most have an ore; turn on **Herbs & ore** on the map (**M**) to find them. Brew potions and forge Rare gear in Professions (**K**).
- **Together:**
  - **groups** of five (`/invite Name`, `/p` for party chat);
  - **guilds** (charter from Registrar Corwin Hale; **J** for the roster, `/g` for guild chat);
  - **mail** at any provisioner's mailbox;
  - **face-to-face trading** (right-click a player, or `/trade Name`);
  - **chat** that only your own faction can read.
- **Achievements (Y):** 25 goals across the whole game. Ten of them unlock a **title** for your nameplate.

## Controls

| Key | Action |
|---|---|
| **W A S D** / arrows | Move and turn (Q/E strafe; hold the right mouse button to steer with the camera) |
| **Mouse** | Left-click to target, right-click to attack, talk, gather or loot; drag to look; wheel to zoom |
| **1–0, −, =** | Action bar (**5** toggles auto-attack) |
| **Tab** | Target the nearest enemy |
| **F** | Talk, gather, loot, enter a dungeon |
| **Space** | Jump |
| **R** / Num Lock | Autorun |
| **U** | Mount or dismount |
| **H** | Waystone home |
| **V** | Camera: orbit, follow, first person |
| **B / I** | Bags |
| **C** | Character |
| **P** | Spellbook and talents |
| **K** | Professions |
| **M** | Map |
| **L** | Quests |
| **J** | Guild |
| **O** | Dungeon Finder |
| **Y** | Achievements |
| **Enter** | Chat |
| **Esc** | Close windows, then the game menu |

## Hosting

### The desktop app

The app runs its own server. Open **Server → Server Manager…** (⇧⌘M on a Mac, Ctrl+Shift+M elsewhere) to:
- start, stop and restart it, and see who's online;
- share it with your network on a port you choose;
- send announcements, kick or ban players, and reset passwords;
- back up the world.

Friends sign in over HTTPS when you share, so you choose a certificate and key there. Settings live in `server-config.json` in the app's data folder.

### Docker or source

| Setting | Meaning | Default |
|---|---|---|
| `HOST` | Address to listen on: `0.0.0.0` for your whole network | `127.0.0.1` (Docker: `0.0.0.0`) |
| `PORT` | Port | `4180` |
| `DATA_DIR` | Where the world is saved | `data/` (Docker: the `hearthwild-data` volume) |
| `TLS_CERT`, `TLS_KEY` | Certificate and key files; needed for signing in from other devices | none |
| `HEARTHWILD_DEMO` | `1` runs the free demo | `0` |
| `HEARTHWILD_CHARTER_SIGNATURES` | Signatures a new guild charter needs | `2` |

Plain HTTP works for play on the same computer. From other devices, accounts need HTTPS: set `TLS_CERT` and `TLS_KEY`, and friends open `https://<your address>:4180`. Run only one server per save folder.

### Saves and recovery

The world is saved to `world.json` in the data folder every few seconds and on shutdown, written to a temporary file and then renamed. Back it up with the server stopped, or use **Back up now** in the Server Manager.

If someone forgets their password, the host can reset it in the Server Manager. Without the app, stop the server and run `node server/reset-password.js USERNAME SAVE_FOLDER`; it keeps a backup and signs out old sessions.

## Development

- Plain Node 22 on the server and browser JavaScript with [three.js](https://threejs.org/) (vendored) on the client; Electron for the desktop app. No runtime npm dependencies.
- `npm test` runs every test (Node's built-in test runner) and `npm run check` checks syntax. CI runs both on every pull request, along with a Docker build and CodeQL.
- Work is planned in one-week sprints: see [SPRINTS](SPRINTS.md), [BACKLOG](BACKLOG.md) and [`docs/agile/`](docs/agile/README.md). [SPEC.md](SPEC.md) and [ROADMAP.md](ROADMAP.md) describe the design.
- Releases are automatic when the version in `package.json` changes on `main` (see [RELEASES](RELEASES.md)), and every change is listed in [CHANGELOG.md](CHANGELOG.md).

## License

Copyright © 2026 Greg (@drakeg) and Hearthwild contributors.

Hearthwild is free software: you can redistribute it and/or modify it under the terms of the **GNU Affero General Public License, version 3 or (at your option) any later version**, as published by the Free Software Foundation. See [`LICENSE`](LICENSE). It comes with no warranty.

The AGPL means that if you run a **modified** Hearthwild server for other people, you must offer them your modified source code. The game's opening screen has a "Get the source code" link for this; point it at your own copy.

Third-party assets keep their own licenses, listed in [`public/models/CREDITS.md`](public/models/CREDITS.md) (CC0 and CC-BY). The bundled three.js library is MIT-licensed.
