# Sprint 5: Rank II

*Reconstructed after the fact.*

- **Goal:** Make levels 21–30 rewarding.
- **Release:** v0.15.0 · [PR #11](https://github.com/drakeg/hearthwild/pull/11)

| ID | Story | Points | Status |
|---|---|---|---|
| HW-050 | Ability ranks, shared by server and client | 5 | Done |
| HW-051 | Spellbook and level-up show ranks | 2 | Done |

**Velocity:** 7

## Retrospective
- **Went well:** a single shared `ranked()` function keeps the client and the server consistent.
- **Didn't go well:** the base descriptions quoted old numbers, which was only caught in the browser.
- **Action:** each rank carries its own description when the numbers change.
