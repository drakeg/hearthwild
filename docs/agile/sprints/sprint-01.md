# Sprint 1: Roads and Riches

*Reconstructed after the fact. Sprints 1–8 ran shorter than the one-week timebox now in use.*

- **Goal:** Give the wider world things to do and ways to cross it.
- **Release:** v0.11.0 · [PR #7](https://github.com/drakeg/hearthwild/pull/7)

| ID | Story | Points | Status |
|---|---|---|---|
| HW-010 | Zone gear tiers (Uncommon and Rare per zone, level-gated) | 5 | Done |
| HW-011 | Abilities for levels 6–18 (keys 9–12) | 5 | Done |
| HW-012 | Quest chains in every town (kill, collect, deliver, chains) | 5 | Done |
| HW-013 | Riding and mounts | 3 | Done |
| HW-014 | Caravans along the roads | 3 | Done |
| HW-015 | Waystone recall to a chosen inn | 2 | Done |

**Velocity:** 23

## Retrospective
- **Went well:** data-driven content (`content-world.js`) made adding zones fast.
- **Didn't go well:** a test failed because damage over time stopped when its caster died, a real design gap.
- **Action:** damage over time now continues after the caster dies, and tests cover it.
