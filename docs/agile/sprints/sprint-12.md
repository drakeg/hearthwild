# Sprint 12: Hands and hammers — mining, a world boss, and trading

- **Dates:** 2026-11-16 → 2026-11-23
- **Goal:** More to do in the Outer Ring and more reasons to play together: dig ore and forge your own gear, gather a crowd to bring down a roaming giant, and trade face to face.
- **Planned release:** v0.22.0

| ID | Story | Points | Status |
|---|---|---|---|
| HW-107 | Mining and blacksmithing: ore veins in eight zones, six tiers of forged gear | 8 | In review |
| HW-112 | World event: Gharrowmaw, a roaming world boss in the Outer Ring | 5 | In review |
| HW-116 | Face-to-face trade window | 5 | In review |
| HW-114 | License (AGPL-3.0-or-later), carried over from Sprint 11 | 1 | In review |

**Committed:** 19 points

## Acceptance criteria

**HW-107: Mining and blacksmithing.** *As a player, I want to dig ore and forge my own gear, so that I have a way to gear up besides drops.*
- **Ore:** six ores, each in its own zones: Copper (Amber Downs, Saltreed Marsh), Iron (Frostmere Vale, Greyspire Crags), Emberite, Duskiron, Sunsteel and Starmetal (one Outer Ring zone each). 266 veins in all, shown as rocks with glinting veins.
- **Trainer:** Smith Bran Hollis at Wayfarer’s Camp teaches **Mining** and **Blacksmithing** free, and sells like any merchant. Mining is needed to dig ore; it improves with every vein.
- **Forging:** two recipes per ore (a weapon and a chest piece), Rare quality, levels 6 to 30. Higher tiers also use the ore before them. Forging raises Blacksmithing, faster for recipes near your skill.
- **Finding ore:** the map’s **Herbs & ore** finder shows veins as well as herbs.

**HW-112: World boss.** *As a player in the Outer Ring, I want a big shared fight that comes to me, so that strangers have a reason to team up.*
- **Wakes:** Gharrowmaw, the Wandering Colossus (level 32), wakes somewhere in the Outer Ring five minutes after the server starts, and again 45 minutes after it falls. Everyone online is told where.
- **Roams:** it walks slowly from place to place. While it’s awake, it shows on every big map with its health.
- **Fights:** every 11 seconds in a fight it rears up and stomps: a red ring shows where, and anyone inside when it lands is hurt.
- **Rewards:** everyone who helped earns their own Epic (one of three) and 220 gold. Its fall is announced, with who brought it down.

**HW-116: Trade window.** *As a player, I want to swap items and gold with someone standing next to me, so that we can trade safely without trusting each other.*
- **Starting:** right-click a player and choose **Trade**, or type `/trade Name`. They get a popup to accept or decline.
- **Offers:** up to six items and some gold each. Changing either offer clears both confirmations.
- **Safety:** nothing moves until both confirm; then everything changes hands at once. If anything no longer fits (gold spent, bags full, item gone), nothing moves. Walking apart, dying or leaving cancels the trade. Worn gear and boss treasure can’t be traded.

## Progress log
- **2026-11-16:** sprint planned. Mining and blacksmithing built on the herb system (ores are reagents with `type: "ore"`). The world boss lives in `server/worldboss.js` and the trade window in `server/trade.js` and `public/trade-ui.js`. 131 tests pass, including new tests for ore, forging, the world boss and trading. The trade window was checked in the browser ([screenshot](sprint-12-trade.png)).
- **2026-11-16:** found that the HW-114 license commit missed PR #17; carried into this sprint.

## Review
*(At the end of the sprint.)*

## Retrospective
*(At the end of the sprint.)*
