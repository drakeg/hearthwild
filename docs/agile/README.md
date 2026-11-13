# How Hearthwild is built: our Agile process

Hearthwild is developed in short **sprints**. Each sprint has a goal, a set of stories pulled from a prioritized **backlog**, and ends with a **review** (a release) and a **retrospective**. Everything is written down here, in Git, next to the code it describes.

## Roles

| Role | Who | Responsibilities |
|---|---|---|
| **Product Owner** | Greg (@drakeg) | Owns the vision and the backlog order. Accepts or rejects stories at review, and merges the sprint's pull requests. |
| **Development team** | Claude, with Greg | Plans and builds stories, writes tests and docs, opens pull requests, and keeps these documents current. |
| **Scrum facilitator** | Claude | Keeps the process honest: sprint files up to date, the board accurate, and retrospective actions followed up. |

## Cadence

- **Sprint length:** one week (Monday–Sunday, Eastern time). A sprint may end early when its goal is met and accepted.
- **One sprint, one release.** A sprint normally ships as one minor version (0.N.0). Each story is its own pull request, or a few closely related stories share one.
- **Capacity:** about 13–21 story points per sprint. We use each sprint's velocity to plan the next.

## Ceremonies (asynchronous, written in Git)

| Ceremony | When | Where it's recorded |
|---|---|---|
| **Backlog refinement** | Any time new ideas or bugs come up | [`BACKLOG.md`](BACKLOG.md): new items are added, split and estimated, then reordered by the Product Owner |
| **Sprint planning** | Start of each sprint | A new file `sprints/sprint-NN.md` with the sprint goal, committed stories and points |
| **Daily progress** | Each working session | The *Progress log* section of the current sprint file |
| **Sprint review** | End of the sprint | Pull requests with links; release notes in [`CHANGELOG.md`](../../CHANGELOG.md); accepted stories marked done |
| **Retrospective** | End of the sprint | The *Retrospective* section of the sprint file: what went well, what didn't, and action items, which go into the backlog |

## Work items

- **Epic:** a large theme, such as *World*, *Dungeons & Raids*, *Social*, *Server & Hosting*, *Process & Tooling* or *Tech debt*.
- **Story:** a user-visible slice of value, written *"As a ‹player/host/developer›, I want ‹goal› so that ‹benefit›."*, with acceptance criteria.
- **Bug** and **Chore** (tech debt, tooling) follow the same flow.
- **IDs:** every item has a permanent ID, `HW-###`. IDs are never reused.
- **Estimates:** story points on the Fibonacci scale (1, 2, 3, 5, 8, 13). Anything over 13 must be split.

### Board states

`Backlog` → `Ready` → `In sprint` → `In review` (PR open) → `Done` (merged, released and accepted)

## Definition of Ready

A story can enter a sprint when:
- it has an ID, a user-story sentence and acceptance criteria;
- it's estimated at 13 points or fewer;
- its dependencies are done or in the same sprint;
- the Product Owner has ordered it near the top of the backlog.

## Definition of Done

A story is done when:
- [ ] its acceptance criteria are met;
- [ ] automated tests cover the new behaviour, and `npm test` and `npm run check` pass;
- [ ] it has been tried in the browser or desktop app, with a screenshot when it has a UI;
- [ ] README and CHANGELOG are updated, and the sprint file is updated;
- [ ] its pull request references the story ID(s), is reviewed and merged by the Product Owner;
- [ ] the release workflow has published the version with downloads for every OS;
- [ ] it contains no third-party assets except CC0 or CC-BY ones listed in `public/models/CREDITS.md`, and it never touches the live save (`data/world.json`).

## Branches, commits and pull requests

- **Branch:** `sprint-NN/HW-###-short-name`, for example `sprint-09/HW-090-server-manager`.
- **Commit messages** start with the story ID: `HW-090: Server Manager window`.
- **Pull requests** use the template in `.github/pull_request_template.md`, list their story IDs, and say clearly if they must be merged after another PR (stacked PRs).
- **Releases:** the version in `package.json` is bumped once per sprint, on the sprint's last PR. Merging that PR publishes the release.

## Files

- [`BACKLOG.md`](BACKLOG.md): the product backlog, ordered top to bottom.
- [`sprints/`](sprints/): one file per sprint, holding the plan, progress log, review and retrospective.
- [`sprints/history.md`](sprints/history.md): work done before this process began (versions 0.1–0.10).
