# Sprint 6: The Dungeon Finder

*Reconstructed after the fact.*

- **Goal:** Let players find groups for any dungeon.
- **Release:** v0.16.0 · [PR #12](https://github.com/drakeg/hearthwild/pull/12)

| ID | Story | Points | Status |
|---|---|---|---|
| HW-060 | Role queue and matching (tank, healer, damage) | 5 | Done |
| HW-061 | Ready check, declines and timeouts | 3 | Done |
| HW-062 | Dungeon Finder window and queue banner | 3 | Done |
| HW-063 | Straight into the dungeon, home again on leaving, and the Finder satchel | 3 | Done |
| HW-064 | Nearby name tags fade near the camera | 1 | Done |

**Velocity:** 15

## Retrospective
- **Went well:** testing in the browser against bots caught the static-file allowlist gap.
- **Didn't go well:** new client files must be added to the server's file list by hand.
- **Action:** HW-102 in the backlog: serve every file in `public/` safely instead of listing them.
