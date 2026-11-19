# Sprint 14: The Molten Crown

- **Dates:** 2026-11-19 → 2026-11-26
- **Goal:** A second raid for the Outer Ring, so level-30 groups have more than one ten-player challenge.
- **Planned release:** v0.24.0

| ID | Story | Points | Status |
|---|---|---|---|
| HW-108 | Second raid: The Molten Crown, in the Emberwaste | 13 | In review |

**Committed:** 13 points

## Acceptance criteria

**HW-108: The Molten Crown.** *As a level-30 player, I want a second raid, so that my group has somewhere new to go after the Sundered Spire.*
- **Where:** a door in the Emberwaste, guarded by Flamewarden Oriel, who gives the raid's quest. Level 28 and up, groups of up to ten (as with the Spire), and the Dungeon Finder can fill it.
- **Inside:** six rooms from the Caldera gate down to the Molten Throne, with packs of Cinderhold reavers and Ashbound zealots, in the fiery forge style.
- **Three bosses, fought in order:** Emberjaw the Furnace-Warden, Cindra the Flame-Speaker, and Vulcaris, the Molten King. Each has telegraphed attacks to dodge, a cast to interrupt or heal through, adds partway through, and an enrage timer. Each is a little tougher than its Spire counterpart.
- **Rewards:** each boss drops one of three Epics of its own (nine in all), as strong as the Spire's.
- **Achievement:** a new **Unbroken** achievement (title *the Unbroken*) for defeating the final boss of every raid.

## Progress log
- **2026-11-19:** sprint planned and built. The raid is data in `public/dungeon-layout.js`, `server/crypt.js` and `server/content-world.js`, using the same engine as the Spire. New tests check every raid (bosses, fights, loot, scout, Finder levels), that no two dungeon doors or instance spaces overlap, and a run of the Molten Crown through to Unbroken. 136 tests pass. Checked in the browser beside the Cinderforge ([screenshot](sprint-14-molten-crown.png)).

## Review
*(At the end of the sprint.)*

## Retrospective
*(At the end of the sprint.)*
