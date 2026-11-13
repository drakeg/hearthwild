# Sprint 3: Room to Grow

*Reconstructed after the fact.*

- **Goal:** Make the world able to grow without the server or the connection growing with it.
- **Release:** v0.13.0 · [PR #9](https://github.com/drakeg/hearthwild/pull/9)

| ID | Story | Points | Status |
|---|---|---|---|
| HW-030 | Zone maps, with zone and world views | 5 | Done |
| HW-031 | Nearby-only updates; static content sent once | 5 | Done |
| HW-032 | Sleeping creatures and spatial grids | 3 | Done |

**Velocity:** 13

## Retrospective
- **Went well:** updates got 50–85% smaller, measured.
- **Didn't go well:** map painting stalled frames until it was time-budgeted. Stacked PRs merged together meant v0.13.0 never got its own release run.
- **Action:** HW-101 in the backlog: the release workflow should catch versions skipped by stacked merges.
