# Sprint 10: Open to contributors, release safety and host tools

- **Dates:** 2026-11-13 → 2026-11-20
- **Goal:** Others can contribute, every version gets a release, and hosts can manage players from the Server Manager.
- **Planned release:** v0.20.0 · [PR #16](https://github.com/drakeg/hearthwild/pull/16)

| ID | Story | Points | Status |
|---|---|---|---|
| HW-115 | Contributor docs: CONTRIBUTING, Code of Conduct, SECURITY, issue templates | 2 | In review |
| HW-101 | The release workflow publishes versions skipped when stacked PRs merge together | 3 | In review |
| HW-102 | Serve every file under `public/` safely, instead of a hand-kept list | 2 | In review |
| HW-103 | Host admin tools in the Server Manager: announcements, kick, ban and unban, password reset | 5 | In review |

**Committed:** 12 points (Sprint 9 velocity: 17; held lower while HW-100 and HW-114 wait on Product Owner decisions)

## Acceptance criteria

**HW-115:** a new contributor can find the ground rules, set up, and follow the flow from issue to release without asking. Security reports have a private route.

**HW-101:** when one merge brings in several version bumps (for example 0.13.0 and 0.14.0 together), every version that has a `CHANGELOG.md` entry but no GitHub Release is released, each built from the commit that set that version.

**HW-102:** any file under `public/` is served with the right content type, with no hand-kept list. Paths outside `public/`, hidden files and anything containing `..` are refused. Unknown file types are not served.

**HW-103:** *As a host, I want to manage players from the Server Manager, so that I can keep my world friendly.*
- **Announce:** send a message that every online player sees in chat, in gold.
- **Kick:** a player is disconnected, with a message telling them so; they can sign back in.
- **Ban and unban:** a banned account can't sign in or play until unbanned. Bans are saved with the world, and the ban list shows in the window.
- **Password reset:** set a temporary password for an account.
- All of these are recorded in the activity log, and only the Server Manager window can use them.

## Progress log
- **2026-11-13:** sprint planned. HW-115 written; its security claims were checked against the code (scrypt, rate limits, request size limits, HTTPS for network sign-in).

- **2026-11-13:** HW-102 done. The server now scans `public/` at startup; hidden files, odd names and unknown types are refused (tested).
- **2026-11-13:** HW-101 done. A `catch-up` job finds CHANGELOG versions with no release and starts a run for each, from the commit that set it (`workflow_dispatch` takes a `commit` input; concurrency is per commit). A local dry run found the right commits for 0.12.0, 0.13.0 and 0.17.0, and skipped versions before 0.8.0. It hasn't run on GitHub yet.
- **2026-11-13:** HW-103 done. Server: `admin` API, account bans (saved with the world), a kick with a one-time reason, announcements, password resets. Window: Kick and Ban on each player, announcements, the ban list with Lift ban, password reset ([screenshot](sprint-10-host-tools.png)). 118 tests pass.

## Review
*(At the end of the sprint.)*

## Retrospective
*(At the end of the sprint.)*
