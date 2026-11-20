# Editions: free and paid (HW-121 proposal)

*Proposed 2026-11-20 for the Product Owner. Direction given: "a limited version for free and a much more robust and polished version for the paid." Nothing here is decided until the questions at the end are answered.*

## The constraint: the code is AGPL

Everything already published is AGPL-3.0, so anyone may build the full game from source, forever. That can't be undone, and it's fine: most players never build from source. A paid edition has to sell what the source alone doesn't give them:

1. **Convenience:** signed, one-click installers and automatic updates, versus building it yourself.
2. **Content the project keeps:** *new* art, music, zones, dungeons and quests can be released under a separate, non-free content license, kept out of this repository, because the project owns its copyright. The engine stays AGPL; the paid content pack doesn't have to be. (Contributors' work stays AGPL unless they agree otherwise, so paid content should be made by the owner or under a contributor agreement.)
3. **Services:** hosted worlds (Realms), cross-device accounts, support.

## Proposed editions

| | **Hearthwild Free** | **Hearthwild** (paid, early access) |
|---|---|---|
| **Price** | Free | Pay what you want, $10 suggested, $5 minimum (itch.io); later a fixed price on Steam |
| **World** | The Stillwood and the Amber Downs, **levels 1–10** | All nine zones, levels 1–30, and future zones |
| **Dungeons** | The Hollow Crypt and the Barrow of Harrow Hill | All nine, both raids, the world boss |
| **Classes** | All four (so players can find their favourite) | All four, plus future classes |
| **Professions** | Herbalism and Mining to skill 50 | All four to 100 |
| **Social** | Groups, chat, trading, and **joining** guilds | Everything, including founding guilds and the Dungeon Finder |
| **Multiplayer** | Can join any server, including a paid player's | Can host worlds for friends from the app |
| **Polish** | The same engine | Paid-only: the art and audio pack (HW-136), cinematic intro, voiced key NPCs, more creature models (HW-110) |
| **Builds** | Unsigned downloads | Signed and notarized installers with automatic updates (HW-138) |
| **Saves** | Carry over when you buy | |

**Why this split:**
- Ten levels and two dungeons is about 3–5 hours of play: enough to love it, not enough to finish.
- Free players can join paid players' worlds, which turns each buyer into a recruiter.
- Hosting stays paid because hosting is the thing groups of friends need.

This replaces the current demo (the Stillwood, up to level 6). The `HEARTHWILD_DEMO` switch becomes an **edition** setting (`free` or `full`) with the limits above.

## What it takes (new backlog items)

| ID | Item | Points | Cost or approval needed |
|---|---|---|---|
| HW-136 | **Polish pack:** music and ambient sound, better skies and lighting, new creature and armour models, kept in a private content repo under a content license | 13+ | Commissioned or licensed art and music may cost money |
| HW-137 | **Free edition:** extend the demo to the limits above (levels 1–10, two zones, two dungeons, profession caps, no founding guilds, no hosting), with an "Upgrade" screen | 5 | — |
| HW-138 | **Signed builds:** Apple Developer ID and notarization (US$99/year), Windows code signing (about US$100–400/year), and automatic updates | 5 | **Yes: yearly fees** |
| HW-139 | **Licence keys or itch.io downloads:** the paid build is only on the store; the free build stays on GitHub Releases | 3 | itch.io account (free; itch takes a share you choose) |
| HW-140 | **Content split:** move paid-only assets out of the public repo, and add a contributor agreement for future content | 3 | A decision on the content license |

## Questions for the Product Owner

1. **Free edition scope:** levels 1–10 with two zones (proposed), or keep it smaller (levels 1–6, the current demo)?
2. **Where the paid build lives:** itch.io first (proposed), with GitHub Releases carrying only the free build? Or keep full builds on GitHub too, and sell only Realms and the polish pack?
3. **Signing fees:** start paying for Apple and Windows signing now (about US$200–500/year), or after the first sales?
4. **Trademark:** run a trademark search for "Hearthwild" before spending on a store page? (A search is free; a US filing is about US$350 per class.)
