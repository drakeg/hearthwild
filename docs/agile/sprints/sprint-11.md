# Sprint 11: Back to the game — mail and talents

- **Dates:** 2026-11-13 → 2026-11-20
- **Goal:** Back to the game after the process and hosting sprints: players can send each other gold and items, and every class gets meaningful choices at levels 10, 20 and 30.
- **Planned release:** v0.21.0 · [PR #17](https://github.com/drakeg/hearthwild/pull/17) (merge after #16)

| ID | Story | Points | Status |
|---|---|---|---|
| HW-106 | Mail: send a letter, gold and one item to any character from a mailbox | 8 | In review |
| HW-109 | Talents: two choices per class at levels 10, 20 and 30, forgettable for gold | 8 | In review |
| HW-120 | Monetization epic written into the backlog (no code) | 0 | Done |
| HW-114 | License the project under AGPL-3.0-or-later (Product Owner decision, 2026-11-14) | 1 | In review |

**Committed:** 17 points (HW-114 added mid-sprint after the Product Owner decided)

## Acceptance criteria

**HW-106: Mail.** *As a player, I want to send gold and items to a friend, so that we can help each other even when we're not online together.*
- **Where:** every provisioner keeps a mailbox; the **Mailbox** tab in the trade window.
- **Sending:** a letter (subject and message), gold, and one item from the bags, to any character by name. Postage is 1 gold.
- **Receiving:** online recipients are told at once; unread mail shows on screen until read. Letters wait until the recipient takes what's attached.
- **Rules:** treasure from dungeon and raid bosses can't be mailed, and worn gear must come off first. Mailboxes hold 50 letters; empty letters are cleared after 30 days.
- **Saving:** mail is saved with the world.

**HW-109: Talents.** *As a player, I want to shape how my class plays as I level, so that two characters of the same class can feel different.*
- **Choices:** two talents per class at levels 10, 20 and 30, chosen in the spellbook (**P**). They change stats (damage, health, armor, healing) or specific abilities (damage, stuns, cooldowns, cast times, costs).
- **Same numbers everywhere:** the client shows the changed numbers, from the same shared code the server uses.
- **One per tier:** each choice can be made once per tier. **Forget talents** costs 5 gold per level.

## Progress log
- **2026-11-13:** sprint planned. Shared `public/talents.js` (data, stat mods, `withTalents`) and `server/mail.js` built. The Hollow Crypt Epics are now tagged as boss treasure so they can't be mailed. 123 tests pass. The spellbook talents were checked in the browser, then given padding ([screenshot](sprint-11-talents.png)).
- **2026-11-13:** the Monetization epic (HW-120 to HW-130) added to the backlog, below game development.

- **2026-11-14:** the Product Owner chose **AGPL-3.0**. Added `LICENSE` (the official text, AGPL-3.0-or-later), the `package.json` license field, a README License section, the CONTRIBUTING terms (contributions under the same license), and a "Get the source code" link on the opening screen (AGPL §13). The Product Owner also chose a small cloud server for HW-100, which stays low in the backlog.

## Review
*(At the end of the sprint.)*

## Retrospective
*(At the end of the sprint.)*
