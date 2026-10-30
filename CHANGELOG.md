## 0.10.1 — Random loot and no Documents prompt

- **Loot is random again.** Each kill rolls its own drop: often just coin, sometimes an Uncommon item, now and then a Rare, and occasionally a draught, bread or water. Gold now scales with the creature’s level. (Before, the item was picked by your total kill count, so after five kills every drop was the same.)
- **The Mac app no longer asks to access your Documents folder.** It only uses its own save folder, or a development copy in `~/Sources`. It never looks in Documents, Desktop or Downloads, even if an older version saved a location there.
- Seventy-six checks, including a new test that kills vary their loot.

## 0.10.0 — The Wider World

- **The world is now about two kilometres across**, up from 160 metres. Running from Wayfarer’s Camp to the edge of the world takes three to four minutes, and a mountain wall rings it all.
- **Four new zones surround the Stillwood**, each with its own landscape, creatures and level range:
  - **The Amber Downs** (east, levels 6–10): golden rolling grassland and Miller’s Pond. Gorsefield hounds, Bristlebacks, Harrow bandits and Downs poachers.
  - **Saltreed Marsh** (south, levels 9–13): flat bog, reed-lined Blackwater Pools and twisted trees. Bog lurkers, Reedfangs, Mire cultists and Mire witches.
  - **Frostmere Vale** (north, levels 12–16): snowy hills, pine forest and the frozen Glassmere. Rime wolves, Frostfang alphas and Hollowfrost reavers.
  - **Greyspire Crags** (west, levels 15–20): rocky ridges, boulder fields and Greyspire Tarn. Crag stalkers, Greyspire brigands and Stonecallers.
  - The Stillwood itself now reaches out to about 250 metres, with tougher creatures (levels 5–6) in its outer woods.
- **Four towns**, built from timber-framed and stone houses: **Harrowford**, **Reedwatch**, **Hollowfrost Lodge** and **Cragmoor Hold**. Each has a provisioner, a quest giver, a market corner, lamp-lit streets and a graveyard shrine. Towns are sanctuaries: creatures won’t follow you in, and you heal faster there. You can’t walk through the houses.
- **Roads** run from Wayfarer’s Camp to every town, and a ring road links the towns to each other.
- **When you die, your spirit returns to the nearest graveyard**: the camp or a town.
- **New quests:** *Trouble on the Downs*, *Fog over the Pools*, *The Pale Hunt* and *Brigands of Greyspire*. Each asks you to defeat eight creatures of its zone.
- **Exploration:** the first time you reach a new zone, town or lake you gain experience, and a “Discovered” message appears.
- **Maps:** the world map shows the whole world, with its zones, level ranges, roads, towns and lakes. The minimap now shows roads and houses around you.
- **Zone banners** show the zone you’re entering, and mark towns as sanctuaries.
- The terrain streams in around you as you travel, with finer detail up close. Lower graphics quality loads less of it.
- Seventy-five checks, including new tests for zones, creature levels, house collisions, graveyards, town quests and exploration.

## 0.9.0 — Guilds

- **Found a guild.** Registrar Corwin Hale, beside the campfire at Wayfarer’s Camp, sells a guild charter for 10 gold. Name your guild, ask two adventurers of your faction to sign it (click them and choose *Ask to sign charter*), then bring it back to found the guild. You become its Guild Master and the signers become Members.
- **Ranks:** Guild Master, Officer, Member and Initiate.
  - Officers and the Guild Master invite new members (who start as Initiates), promote, demote and remove lower ranks, and set the message of the day.
  - Only the Guild Master can pass on leadership (*Make GM*) or disband the guild.
  - If the Guild Master leaves, the highest-ranked, longest-serving member takes over automatically. When the last member leaves, the guild disbands.
- **Guild window (J, or the Guild button):** roster with level, class, rank, location and online status; the message of the day; invitations; and member management.
- **Guild chat** with `/g`, and **officer chat** with `/o`. Both are also in the chat channel menu. Commands: `/ginvite`, `/gpromote`, `/gdemote`, `/gkick`, `/gleader`, `/gmotd`, `/gquit`, `/groster`.
- Your guild’s name appears in angle brackets under your name for everyone nearby. Members see the message of the day and a note when guildmates come online.
- Guilds are saved with the world and survive restarts. Server hosts can change the number of charter signatures with `HEARTHWILD_CHARTER_SIGNATURES`.
- Builds for macOS (Apple Silicon and Intel), Windows and Linux.
- Seventy checks.

## 0.8.0 — Groups and the Hollow Crypt

- **Groups of up to five.** Click another adventurer and choose *Invite to group*, or type `/invite Name`. The invitee gets an Accept/Decline popup. Party frames appear under your portrait. The leader can `/kick` and `/promote`; anyone can `/leave`. Party chat with `/p`. Groups are same-faction only.
- **Shared credit.** Group members within 40 paces share kill experience (with a 25% group bonus) and quest credit, and each gets their own loot roll.
- **The Hollow Crypt, an instanced dungeon.** Scout Haldren, beside the sealed door in Amberwatch Ruins, gives the quest *Ashes beneath Amberwatch*. Each group (or solo adventurer) gets its own copy of the crypt: an entry hall, passages, a ruined chapel, an ossuary and the Warden's Sanctum, built from the CC0 KayKit Dungeon pack with flickering torchlight.
  - Linked trash packs: pull one and its friends come too.
  - **Boss: Vorlath the Ashen Warden.** Move out of the red Ashfall circles, interrupt *Soul Drain* (it heals him), and deal with the acolytes he calls at half health. He enrages after four minutes. A wipe resets the fight. He drops Epic loot: the Ashbound greatblade, Mantle of the Ashen Warden or Ember of Vorlath.
  - Health scales with group size, so the crypt can be explored solo, but the boss is meant for a group.
  - Interrupt abilities: Crushing Blow, Soul Scorch, Feral Rake and Venom Edge also interrupt enemy casts. The target frame shows a cast bar marked "interrupt!".
  - The minimap shows a dungeon map inside. Dying inside returns your spirit to the crypt entrance.
- Fixed: entering a new area could trip the request limiter and leave some models missing.
- Sixty-four checks.

## 0.7.1 — Classic MMO controls, food and drink

- Classic MMO movement: A/D and the arrow keys turn your character (the camera turns too), Q/E strafe, and holding the right mouse button makes A/D strafe while you face the camera’s direction. Interact moves from E to **F**; right-click still interacts.
- Food and drink: Torren sells Traveler’s bread (health) and Stillwood spring water (mana or energy). You sit while eating or drinking, and the amount refills over 18 seconds. Not usable in combat; moving, attacking or being hit stops it.
- Healing draughts and food now have proper icons and stack in one bag slot (20 per stack). Right-click any consumable in your bags to use it. Action-bar keys 6, 7 and 8 drink your best draught, eat and drink, with counts and the potion cooldown sweep.
- Every release now ships with a Mac installer.
- Fifty-eight checks.

## 0.7.0 — Realistic characters and a hand-made world

- **Characters:** heroes, NPCs and human enemies use realistic proportions, built from Quaternius's CC0 Universal Base Characters, Modular Fantasy Outfits and Universal Animation Library. Each is assembled at runtime from an outfit, head, hairstyle and held weapons on a shared skeleton.
  - Every class has a distinct look: crimson warriors with sword and shield, shadow-clad hooded rogues with twin daggers, moss-green druids with staves, and violet-hooded warlocks with wand and tome. Cloth colours come from a shader that shifts only the outfit's cloth.
  - Character creation now has a masculine or feminine body choice.
  - Animations include idle, jog, backpedal, strafe, jump, sword attacks, punches, spellcasting, hit reactions, death and talking idles for NPCs.
- **Enemies:** the Ashen are human raiders (cutthroats, raiders, stalkers and hexers) who hold Amberwatch Ruins, Moonwell Grove and the far reaches. Fox-bodied beasts are scaled to wolf size.
- **Nature:** the woods use the Stylized Nature MegaKit: five broadleaf trees, five pines, red-leaved twisted trees in Moonwell Grove, dead trees around Amberwatch Ruins, bushes, ferns, flowers, mushrooms, grass clumps and rocks. Instances are chunked so off-screen areas aren't drawn.
- **Camp:** Wayfarer’s Camp is furnished from the Fantasy Props and Medieval Village kits. Torren has a market cart and supplies, Mira a cauldron and potion table, and the Warden a weapon stand, training dummy and anvil. There are also benches round the fire, a wagon and a split-rail fence.
- **The 0.7 preview also included:** the repainted world (sky, clouds, water, mountains, lighting), the campfire, tents and banners, and green NPC names with titles.
- **Settings:** a new Graphics quality setting in the Escape menu. Low turns off shadows and thins the foliage for older computers.
- Fifty-four checks, with new tests for body type and creature placement.

## 0.6.0 — Classic MMO combat feel

- Combat follows familiar MMO conventions: a 1.5-second global cooldown (1 second for Rogues), auto-attack on weapon swing timers, Rage from swings and hits that fades out of combat, slower Mana regeneration for five seconds after spending, critical hits and heals, and out-of-combat health regeneration.
- Creatures have levels 1–5 by distance from camp, level-scaled health, damage, aggro radius and experience, and a threat table. They leash and evade home at 32 paces, and the camp sanctuary drops pursuit.
- Players can die, with a grey world and a Release Spirit prompt that returns them to camp.
- New interface: player, target and target-of-target frames; hostile name plates with level colouring; floating combat text; a cast bar; red error text; zone titles; a segmented XP bar; level-up banner; large ! and ? quest markers; red target ring; dying creatures topple; a hit-flinch.
- Controls: right-click to attack or interact, a 5 / ⚔ auto-attack slot, both mouse buttons to run, Space to jump, Num Lock or R for autorun, front-facing Tab targeting, and layered Escape. The action bar tints for out-of-range and low resource.
- Fifty-two checks, including nine new combat tests for the global cooldown, swing timers, threat, leashing and evading, death and release, sanctuary, level scaling and save hygiene.
- All code and art are original to Hearthwild; no game client data, assets or protocol is used.

## 0.5.0 — Trade, professions, wilderness and controls

- Torren and Mira buy and sell gear, draughts and herbs; per-character ten-item buyback, server-owned prices and proximity checks.
- Free Herbalism and Alchemy training from Mira, skill progression, two Starleaf healing recipes and usable draughts with a shared cooldown.
- Expanded 160×160 map with three wilderness landmarks, 32 scattered monster slots and 32 gathering patches. Monsters relocate on random 45–180 second timers, away from online players. Positions and schedules persist.
- Escape menu for character selection, logout, resume and native quit. Leaving clears movement/presence. Browser quit signs out.
- Orbit, follow-behind and first-person views; mouse tilt/zoom/sensitivity, camera-relative movement and attack-facing. V cycles views.
- Forty-three checks cover trade validation, crafting/consumption/persistence, random spawns, expanded movement, camera math and existing gameplay.

## 0.4.1 — Starleaf gathering and quest feedback

- Clicking a plant closes blocking panels, tolerates small hand motion and uses a larger picking target; overlapping name labels no longer steal physical plant clicks.
- Starleaf appears as a counted, searchable reagent stack in Bags and updates accepted-quest credit from the actual pouch count.
- Sixteen patches cover the playable map and relocate after random 30–90 second delays. Positions/timers persist; gathering never respawns a patch beside an online player.
- Quest givers show available/in-progress/ready markers; gold ? and Ready for turn-in text identify completed objectives. Map markers also show quest status.
- Five regression tests cover click picking, reagent display, resource distribution/timers, persistence and turn-in consumption.

## 0.4.0 — Accounts, equipment and desktop packaging

- Username/password accounts, persistent sessions, twelve-character rosters and offline owner password reset. First local account recovers legacy characters.
- Dedicated Character statistics/equipped-slot screen; Bags focuses on inventory and equipping.
- Responsive HUD layout with compact chat/objective drawers.
- Visible chest plates, capes, charms and upgraded weapon sizes; class headgear details.
- Apple Silicon Mac desktop app with bundled server/runtime, save import and save-folder access.
- Thirty tests cover account isolation/recovery and existing gameplay; no private saves in packages.

# Changes

## 0.3.0 — 2026-10-27

- Added a compact 12-slot painted-icon action bar, unit frames, minimap and micro-menu.
- Added searchable slot-based bags with item comparisons, a class spellbook and a linked map/quest journal.
- Slowed monster respawns to 90 seconds, deferred them near players and preserved dead timers across restart.
- Added original forest-beast models and character face/clothing details; final world-art quality remains unfinished.

## 0.2.0 — 2026-10-27

- Replaced the generic Strike control with four starter classes, numbered abilities, resources, XP/level growth and skill unlocks. Abilities approach into range when needed.
- Added two NPC conversations, explicit quest acceptance/turn-in and renewable local gathering objectives.
- Added personal loot chests, persistent bags, equipment slots and real stat bonuses.
- Added an initial environment/animation pass, combat feedback and tree camera occlusion checks.
- Migrated existing characters to Warrior while retaining saved character data. Existing automatic quest/gold behavior is replaced by NPC quests and collectible loot.
- Recorded dungeon, raid, boss and guild requirements as future dedicated milestones; they are not implemented yet.

## 0.1.0 — 2026-10-27

- Added an original shared forest zone with server-owned movement, enemies, combat, gold and a starter quest.
- Added nearby, faction and private whisper text chat, with server-enforced faction separation.
- Added character return keys and local saves, including recovery after server restarts.
- Added a browser client and opt-in trusted-LAN server hosting.
- Recorded the requirement for substantially improved graphics; current art remains placeholder geometry.
