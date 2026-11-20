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
| HW-121 | Chore | Decide what's sold versus free. **Direction (2026-11-20):** a limited free edition and a more robust, polished paid one. Proposal: [docs/business/editions.md](docs/business/editions.md), with 4 questions | 1 | Proposal ready, waiting on PO |
| HW-141 | Bug | **Check that the world boss shows in the game window on a real graphics card.** The server sends it to nearby players (verified over the real API), but in the slow software renderer used for the trailer it never appeared on screen. Needed before it goes in a trailer | Gameplay | 1 | Ready |
| HW-136 | Story | **Polish pack** for the paid edition: music, ambient sound, lighting, new creature and armour models, in a private content repo | 13 | Backlog |
| HW-137 | Story | **Free edition:** grow the demo to levels 1–10, the Stillwood and the Amber Downs, two dungeons, capped professions, with an Upgrade screen | 5 | Backlog |
| HW-138 | Story | **Signed builds** and automatic updates (Apple notarization, Windows code signing). *Yearly fees, needs approval* | 5 | Backlog |
| HW-139 | Story | **Paid build distribution** through itch.io, with the free build on GitHub Releases | 3 | Backlog |
| HW-140 | Chore | **Content split:** paid-only assets under a separate content license, plus a contributor agreement | 3 | Backlog |
| HW-122 | Story | **Free demo build:** the Stillwood only (levels 1–6), built by the release workflow alongside the full game | 5 | In sprint |
| HW-123 | Story | **Gameplay trailer and press kit:** 60–90 s of the Outer Ring and the raid, screenshots, a short description | 3 | In sprint |
| HW-124 | Story | **itch.io early-access page:** pay what you want, $5 minimum and $10 suggested; demo plus full builds uploaded by the workflow | 3 | Backlog |
| HW-125 | Story | **Supporter page** (Ko-fi or Patreon) linked from the game menu and README, with credits for supporters | 2 | Backlog |
| HW-126 | Story | **Terms of service and a privacy policy** for player accounts | 2 | In sprint |
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
| HW-135 | Bug | v0.24.0 release failed: the catch-up job used the new workflow to build an older version without demo support | Process & Tooling | 1 | In sprint |
| HW-134 | Bug | In the demo, hide or explain quests whose objectives are outside the Stillwood | Monetization | 2 | In sprint |
| HW-133 | Chore | Rewrite the README for the current game (it still describes 0.5–0.7 builds) | Process & Tooling | 2 | In sprint |
*(Add items here; they're refined and placed above.)*
