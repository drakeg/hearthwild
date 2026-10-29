# Hearthwild: RPG foundation, 0.2

Original cooperative fantasy RPG with independent code, world data and procedural visuals. No third-party game executable, assets, account or protocol is required.

## Implemented contract

- Existing characters migrate to Warrior without losing gold or prior character data. New characters choose Warrior, Warlock, Druid or Rogue. Class and faction are server-owned and fixed for a character.
- Four abilities per class appear on keys 1–4. Two start unlocked; the others unlock at levels 2 and 3. Abilities enforce class, level, cost, range, cooldown and a shared 0.9-second recovery. Mana and Energy regenerate; Warrior attacks generate Rage. Ranged casts take time and movement interrupts them. A chosen ability can approach into range before executing once; it never silently repeats forever.
- XP comes from contributing to kills (35) and NPC quest completion (60). Level thresholds are current level × 100 XP, with a prototype cap at 20. Leveling grants health/damage growth and refills health/resource. Four early skills are a foundation, not a complete class progression tree.
- Warden Elowen offers a three-brambleling quest; Herbalist Mira offers a four-starleaf quest. Players talk, explicitly accept, complete local objectives, then talk again to turn in. Kills before acceptance do not advance the combat quest. Existing herbs can satisfy the gathering quest. Five renewable enemy spawns and six renewable herb nodes all lie in this zone. The camp (|x|<7, z>=8) is a sanctuary with health recovery.
- Each participating nearby player receives a personal loot chest on a kill. Only its owner receives that chest in state responses and can claim it. Loot requires proximity, expires after five minutes and grants 10 gold plus one gear item. Items have unique instance IDs, slots and server-defined bonuses. Equipping owned gear changes real damage, armor or maximum health. The bag holds up to 60 items. Items do not yet alter armor appearance or enforce class armor restrictions.
- Nearby, faction and whisper communication retain server-enforced same-faction restrictions.
- Characters, class, XP/level, inventory/equipment, quests, materials and outstanding personal loot are saved. Enemy states and resources reset on restart. Chat remains ephemeral.

## HTTP

POST /api/characters {name,faction,classId?} returns {id,token}. Bearer tokens authenticate GET /api/state?after=<chat cursor> and POST /api/actions. Class defaults to warrior for legacy callers.

Actions: input {x,z}; ability {ability,target?}; talk {target}; quest {quest,operation:accept|complete}; gather {target}; loot {target}; equip {item}; chat {channel,text,to?}. Legacy attack requests map to that character's first ability and use the same permission/cost/range checks. No client-supplied damage, stats, XP, quest rewards, class or loot ownership is trusted.

State contains public nearby players, own character with private inventory/progression, ability definitions, NPCs, quest definitions, renewable plants, own unexpired loot, short-lived combat events and recipient-filtered chat. The talk action returns dialogue. Every persistent action is saved immediately; time-based simulation changes also save every five seconds.

## Visual direction

A first procedural scenery pass adds organic canopy clusters, textured rock/bark, finer grass, gradient sky, mountains, animated water/motes, articulated bodies, class weapon silhouettes, attack motion and damage/projectile effects. Camera ray checks shorten the boom for foliage/trunks. This is an incremental art improvement; authored cinematic models, animations and effects remain required.

## Not implemented

Full classes/talents, pets, shapeshifting, combo points, damage-over-time effects, group-target healing, parties, guilds, instanced dungeons, raids, designed bosses, PvP, multiple zones, chat moderation and public-service operations. These are explicit product requirements in ROADMAP.md, not completed features.


## 0.3 interface contract and pacing (supersedes earlier timing)

Compact twelve-slot action bar with painted ability atlas/cooldown sweeps, compact unit frames, slot-based combined bags with searching/comparisons, a spellbook, north-up minimap, and combined map/quest journal with search/status filters. B/I/C opens bags/equipment, P opens spellbook, M map, L quest lookup. These are functional single-zone views; action-bar reassignment, additional bars, rebinding and a full edit mode remain unimplemented.

Monster respawn is 90 seconds and is deferred while an online player is within eight paces of its home point. Dead spawn status/timer persist in world saves, including across restart. Map data mirrors this zone's actual server-visible NPCs, live enemies, resources, player positions and private loot. No hidden opposing-faction chat is exposed.

Original painted ability sprites are generated for the project. The current art improvement is limited: foliage/environment/characters still need authored high-quality assets to meet the explicit visual requirement.
