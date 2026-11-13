# Sprint 7: Herbs of the Wide World

*Reconstructed after the fact.*

- **Goal:** Herbs everywhere, and a way to find them.
- **Release:** v0.17.0 · [PR #13](https://github.com/drakeg/hearthwild/pull/13)

| ID | Story | Points | Status |
|---|---|---|---|
| HW-070 | Nine herbs, one per zone | 3 | Done |
| HW-071 | 464 patches across the world | 3 | Done |
| HW-072 | Herb finder on the map and minimap | 5 | Done |
| HW-073 | Eight recipes, and herbs sell at merchants | 3 | Done |

**Velocity:** 14

## Retrospective
- **Went well:** the requests came straight from the Product Owner's play feedback.
- **Didn't go well:** a test depended on where creatures happened to spawn, and broke when placement changed.
- **Action:** tests set up their own surroundings instead of relying on world randomness.
