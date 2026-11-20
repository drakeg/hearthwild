# Releases and versioning

Hearthwild uses [Semantic Versioning](https://semver.org/). Until 1.0 the game is in early development: a **minor** version (0.N.0) is one sprint's release; a **patch** (0.N.1) fixes a released bug. 1.0.0 will mean a stable save format and server protocol that later versions must keep loading.

## How a release happens

1. The sprint's last pull request bumps `version` in `package.json` and adds a `## 0.N.0 — Name (Sprint NN)` section at the top of [CHANGELOG.md](CHANGELOG.md).
2. The Product Owner reviews and merges it to `main`.
3. The [Release workflow](.github/workflows/release.yml) sees the new version, runs the tests, builds the desktop app for every system, and publishes a [GitHub Release](https://github.com/drakeg/hearthwild/releases) tagged `v0.N.0` with the CHANGELOG section as its notes:
   - macOS installers (`.pkg`) for Apple Silicon and Intel,
   - Windows 64-bit (`.zip`),
   - Linux 64-bit (`.tar.gz`),
   - and `SHA256SUMS.txt`.
4. If two versions merge together, the workflow's catch-up job also releases the skipped one.

No release is published without a version change, and a release is never published from a branch other than `main`.

## Checklist (in the release PR)

- [ ] CI is green: `npm run check`, `npm test`, Docker image builds and serves.
- [ ] CHANGELOG section written for players, with no internal jargon.
- [ ] Sprint file, [SPRINTS.md](SPRINTS.md) and [BACKLOG.md](BACKLOG.md) updated.
- [ ] README badges still accurate.
- [ ] Saves from the previous version still load (the save format only grows; fields are defaulted on load).

## Fixing a bad release

Ship a patch (0.N.1) with the fix. Never move or delete a published tag. Security fixes follow [SECURITY.md](SECURITY.md) and may be released on their own, outside a sprint.

## History

Every release and its notes: [CHANGELOG.md](CHANGELOG.md) and [GitHub Releases](https://github.com/drakeg/hearthwild/releases).
