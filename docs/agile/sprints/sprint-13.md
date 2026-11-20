# Sprint 13: Deeds and titles

- **Dates:** 2026-11-19 → 2026-11-26
- **Goal:** Give players long-term goals across everything they can already do, and a way to show them off.
- **Planned release:** v0.23.0 · [PR #19](https://github.com/drakeg/hearthwild/pull/19)

| ID | Story | Points | Status |
|---|---|---|---|
| HW-111 | Achievements and titles | 5 | Done |
| HW-117 | Bug: the map and other windows could open on top of a trade, and opening one cancelled it | 1 | Done |

**Committed:** 6 points

## Acceptance criteria

**HW-111: Achievements and titles.** *As a player, I want goals beyond the next level and a way to show what I've done, so that I keep exploring everything the game offers.*
- **24 achievements** in five categories: Adventure, Dungeons & Raids, Exploration, Professions and Social. Each is worth 10 or 25 points.
- **Earning:** checked every second for each player online; earned once, with a message in chat. Characters made before this release earn the ones they already qualify for when they next play. Earned achievements and their dates are saved.
- **Window (Y):** every achievement by category, with a progress bar for those still to earn, the date each was earned, and total points.
- **Titles:** nine achievements unlock a title (for example *the Wayfarer* or *Colossus-Slayer*). Choose one in the window; everyone sees it on your nameplate. You can only wear titles you've earned.
- **Shared rules:** the achievement list lives in `public/achievements.js`, used by the server to award and the client to show progress.

**HW-117: Trade window stays on top.** While a trade is open, other windows can't be opened over it (chat still works). Only Escape or the Cancel button ends the trade.

## Progress log
- **2026-11-19:** sprint planned and built. The server counts things it didn't record before (gathering, crafting, trades, letters sent, dungeon clears, world-boss kills) in `p.tally`. 134 tests pass, including new achievement tests. The window was checked in the browser ([screenshot](sprint-13-achievements.png)), which caught the title picker showing blank; fixed and tested.

## Review
- **2026-11-19:** PR #19 merged; v0.23.0 released. All 6 points done.

## Retrospective
- **Went well:** keeping the achievement list in one shared file meant the server and the window can't disagree about progress.
- **To improve:** the browser check found a bug only after the code was written (the blank title picker). Check new windows in the browser before writing their docs.
