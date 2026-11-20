# Product backlog

Ordered by priority: the top is next. The Product Owner (Greg) sets the order; anyone can add an item, at the bottom, under *New*. Points use the Fibonacci scale. Finished items move into their sprint file; see [`sprints/`](docs/agile/sprints/).

**Status:** `Ready` = meets the Definition of Ready · `Backlog` = still needs refinement

## Current sprint: [Sprint 15](docs/agile/sprints/sprint-15.md)

HW-131 Mad Mallard standards · HW-133 README rewrite · HW-122 Free demo build

## Priorities (updated 2026-11-19)

Following the Mad Mallard standards, the **fastest realistic path to a paying customer** now comes first: a free demo and a pay-what-you-want early-access page (HW-121 → HW-122 → HW-126 → HW-124), then the hosted-world waitlist. New game content continues alongside, but no longer ahead of launch work. *HW-121 needs a Product Owner decision before HW-124 can ship.*

## Up next

| ID | Type | Item | Epic | Points | Status |
|---|---|---|---|---|---|
| HW-104 | Chore | Playtest both raids (the Sundered Spire and the Molten Crown) with real players, then tune boss health and damage | Dungeons & Raids | 3 | Backlog |
| HW-105 | Chore | Measure frame rate on a real Mac and a modest Windows PC in the busiest zones; set a performance budget | Tech debt | 3 | Backlog |
| HW-110 | Story | **New beast models** (CC0) to replace the recoloured foxes | Art | 5 | Backlog |
| HW-100 | Story | **A hosted server you can leave running**, updated from each release, with HTTPS. *Decided 2026-11-14: start with a small cloud server (about $5–12 a month). Still to settle when it's planned: a domain name, who it's for (invite-only or open), and the budget.* | Server & Hosting | 8 | Backlog (later) |
| HW-113 | Bug | The `release-0.12` branch is left over from the v0.12.0 re-release; delete it on GitHub | Process & Tooling | 1 | Ready |

## Epic: Monetization (HW-120)

Planned on 2026-11-13 from a monetization review. Ordered so each step tests demand before the next costs more. Prices and revenue are estimates. These items wait behind game development, and whether the repo stays public (HW-121) must be decided first. The license is settled: AGPL-3.0 (HW-114). It suits hosted Realms, since others can't run a modified copy as a closed competing service.

| ID | Type | Item | Points | Status |
|---|---|---|---|---|
| HW-121 | Chore | Decide what's sold versus free: repo visibility, whether GitHub Release downloads stay free, and a trademark check on "Hearthwild" | 1 | Waiting on PO |
| HW-122 | Story | **Free demo build:** the Stillwood only (levels 1–6), built by the release workflow alongside the full game | 5 | Backlog |
| HW-123 | Story | **Gameplay trailer and press kit:** 60–90 s of the Outer Ring and the raid, screenshots, a short description | 3 | Backlog |
| HW-124 | Story | **itch.io early-access page:** pay what you want, $5 minimum and $10 suggested; demo plus full builds uploaded by the workflow | 3 | Backlog |
| HW-125 | Story | **Supporter page** (Ko-fi or Patreon) linked from the game menu and README, with credits for supporters | 2 | Backlog |
| HW-126 | Story | **Terms of service and a privacy policy** for player accounts | 2 | Backlog |
| HW-127 | Story | **Waitlist for hosted worlds:** a "join the waitlist" form, aiming for 50 sign-ups before building billing | 2 | Backlog |
| HW-128 | Story | **Hosted private worlds ("Realms"):** an always-on world for a group of up to 10, about $6 a month; builds on HW-100 | 13 | Backlog |
| HW-129 | Story | **Billing for Realms:** subscription checkout, receipts, cancellation | 8 | Backlog |
| HW-130 | Chore | **Steam "coming soon" page and wishlists**, once the itch.io launch shows demand ($100 fee, refunded after $1,000 in sales) | 3 | Backlog |

**How we'll know it's working:** playtesters play more than an hour and come back; at least 10% of pay-what-you-want downloads pay something; 50 waitlist sign-ups before building Realms.

## New

| ID | Type | Item | Epic | Points | Status |
|---|---|---|---|---|---|
| HW-131 | Chore | Adopt the Mad Mallard repository standards: root docs, CI, CodeQL, Docker Compose for LAN testing, README badges | Process & Tooling | 5 | In sprint |
| HW-132 | Story | **Free hosted test world** that redeploys from `main` (for example a free container host), so testers can play without installing anything. *Needs the Product Owner to choose a host and create the account.* | Server & Hosting | 3 | Waiting on PO |
| HW-133 | Chore | Rewrite the README for the current game (it still describes 0.5–0.7 builds) | Process & Tooling | 2 | In sprint |
*(Add items here; they're refined and placed above.)*
