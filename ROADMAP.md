# Hearthwild MMORPG roadmap

The user's target is an independent game that follows familiar classic MMO play closely: classes, numbered abilities, leveling and skill unlocks, quest NPCs, local quest objectives, loot, gear progression, factions and communication, eventually dungeons, raids, bosses and guilds. These are enduring requirements; a small prototype must not be represented as their completion. All implementation and assets must remain original or independently licensed.

## Complete foundation: current 0.2

Four starter classes with four early abilities each; resource/cost/range/cast/cooldown checks; XP/level growth and unlocks; two quest NPCs; local combat/gathering objectives; personal drops; gear and stats; persistent progression; faction-restricted chat. First scenery/animation upgrade, with placeholder procedural art still present.

## 1. Finish the core combat model

Add a persistent melee auto-attack alongside deliberate hotbar abilities, global cooldown presentation, configurable keybindings, threat/aggro/leashing, target-of-target, status effects, damage over time, interrupts, crowd control and ally-targeted healing. Replace generic early skill implementations with deeper class identities: Warrior stances and defenses; Rogue combo points/finishers and stealth; Warlock curses, summoned pets and resource tradeoffs; Druid forms, restoration and nature damage. Add further classes, specialization/talent choices and ability learning across a longer leveling curve. Establish balance and regression tests before treating a class as complete.

Acceptance: a player can tell which abilities are usable and why, choose an intended target, complete a full fight using class-specific resources and inspect server-authoritative damage/healing outcomes under latency.

## 2. Parties and one real dungeon

Build invites, party membership/roles, party chat, shared quest credit, threat tables and healing targets. Add an instanced five-player dungeon with a unique instance ID, group admission, saved encounter state and reconnect support. Design several trash packs and at least one boss with telegraphed phases, an interruptible cast, an avoidable hazard and an encounter reset. Define corpse/revival, loot rolls or personal loot, difficulty and anti-duplication rules.

Acceptance: two separate parties occupy independent copies; a tank, healer and damage players can clear the encounter; a wipe resets it; rewards occur once per eligible kill; disconnect/rejoin preserves membership and encounter consistency.

## 3. Guilds and social systems

Persistent guild membership, invitations, rank/permissions, roster, leadership transfer and guild chat. Apply faction communication rules to every recipient; decide explicit cross-faction exceptions before implementing them. Add ignore/report and moderation. Later: guild storage, achievements and scheduled events.

Acceptance: unauthorized invitations, promotions, kicks and guild-chat access fail on the server, including after logout or a server restart.

## 4. Raids and designed bosses

Extend instances into coordinated raid groups, role assignment, ready checks, raid chat, larger encounter spaces and multiple original bosses. Add threat-sensitive mechanics, phases, enrage/wipe/reset logic, telegraphs, encounter logs and controlled raid rewards. Define raid size/difficulty and lockouts with the user before final balance.

Acceptance: simultaneous groups stay isolated; mechanics require coordination; encounter/reward state survives recovery; no duplicate boss loot can be claimed through reconnects or retries. Capacity must be measured rather than inferred from the small starting zone.

## 5. World and progression

More connected zones, NPC dialogue/quest chains, guaranteed locally available objectives, professions, crafting, consumables, equipment restrictions, shops/trading, travel, exploration, factions and reputation. Add curated loot tables, item comparisons, bags, vendors and a better leveling/learning curve. Build tooling to validate quest requirements against actual spawn/resource data for each zone.

## Visual quality: explicit requirement throughout

The user expects MUCH better, more cinematic graphics than the first geometric prototype. The first procedural pass is not an accepted final quality reference. Develop an original representative scene and character to approve a visual benchmark, then implement authored rigs/animations, richer materials/terrain, organic foliage, cinematic lighting/sky/water, polished combat effects, camera collision and coherent interface art. Evaluate engine/tooling and frame time against that benchmark; do not assume progressively adding primitives will reach it. No third-party commercial art or game data should be used.

## Friends hosting and delivery

Verify separate machines, add invitations/account recovery, a transactional save database/backups, TLS and remote-hosting configuration, monitoring and load tests. Maintain a standalone desktop packaging milestone. Currently only local browser and local-server play is verified; no public endpoint was exposed.


## 0.3 HUD progress and the next visual milestone

The reference-led HUD now includes a twelve-slot icon action bar, unit frames, combined bag grid/search/comparisons, class spellbook, minimap and combined quest journal/world map. Its art is original, including the generated painted ability atlas. Additional action bars, rebinding, slot reassignment and user-controlled layout editing are still requirements for deeper classic MMO behavior.

The next art milestone is a genuinely authored and rigged hero plus one enemy, ground-cover/foliage assets, material sets and animations in a curated representative scene. Approve and measure that quality target before expanding it. Current procedural figures and terrain remain below the user's target; incremental primitive detailing must not be represented as finishing that requirement.
