# Hearthwild · The Stillwood — 0.7.1

An original cooperative fantasy RPG foundation with its own client, simulation, quests, class abilities, loot and saves. No third-party game installation, game data, account, assets or protocol is used. Three.js is bundled under MIT in public/vendor/THREE-LICENSE.txt.

## Play

For Apple Silicon Macs, open the supplied **Hearthwild 0.5.0 .pkg installer** and follow the installer prompts to install Hearthwild in Applications. The app includes its own runtime and starts a local server; Node.js is not required. This development build is ad-hoc signed, not Apple notarized. macOS may require manual approval in Privacy & Security. The installer does not bundle anyone's saved world or credentials.

The app reuses the running local development server when available and remembers its save location. Otherwise it saves in `~/Library/Application Support/Hearthwild/server`. **Game → Open save folder** shows the active directory. **Game → Import existing save…** imports a world.json with a backup of the previous app save. Quit the app/server before copying or restoring save files.

For source development with Node.js 22+, double-click start.command or run npm start; open http://127.0.0.1:4180. No dependency installation/build is needed for the browser game. Desktop keyboard/mouse and WebGL 2 are required; touch movement is not implemented.

Create a **username/password account** and choose from its character roster. Each account can create up to twelve characters with independent class, faction, level, quests and gear. Warrior, Warlock, Druid and Rogue are available. Passwords require 10–128 characters and are stored as salted scrypt hashes. HttpOnly sessions expire after 30 days; logging out invalidates the session. Signing in again restores the roster. Character IDs are not login credentials.

On this local upgrade, the first account created on the server inherits all existing unowned characters; **no old return codes are needed**. This migration is intended for this developer's local save, so complete setup locally before sharing access. Legacy HTTP bearer/return-code login is disabled.

If a password is forgotten, the server owner can reset it offline without losing characters. Stop the app/server, then run `node server/reset-password.js USERNAME SAVE_FOLDER` from the source folder. The prompt hides the new password, keeps a save backup and invalidates old sessions. In an installed Mac build, use the bundled runtime instead of Node:

```sh
ELECTRON_RUN_AS_NODE=1 /Applications/Hearthwild.app/Contents/MacOS/Hearthwild /Applications/Hearthwild.app/Contents/Resources/app/server/reset-password.js USERNAME "$HOME/Library/Application Support/Hearthwild/server"
```

Use the active save folder shown by the Game menu if it differs. This is owner-operated recovery; email recovery is not implemented.

## Controls and combat

- WASD / arrows move relative to the camera view. Drag either mouse button to orbit horizontally and tilt vertically; right-drag also turns the character. Wheel zooms in third person and adjusts field of view in first person.
- **V** cycles Orbit, Follow behind and First person. **Escape → Camera view** selects a mode and adjusts mouse sensitivity; preferences persist locally. Attacks and casts turn the character toward their target. The follow view settles behind the character when you finish strafing.
- **Escape** opens the game menu: Resume, Character selection, Log out and Quit game. The multiplayer world keeps running. Desktop Quit closes the app; browser Quit signs out so the tab can be closed. Leaving clears movement and presence; logging out invalidates the session.
- **K** opens professions; **B / I** opens Bags; **C** opens character stats and equipped gear; **M / L** opens map/quests; **P** opens class spells.
- **Targeting and attacking.** Left-click an enemy or press **Tab** to target it; Tab prefers enemies in front of the camera. **Right-click** an enemy to run to it and start auto-attacking. **5** (the ⚔ slot) toggles auto-attack. Keys **1–4** use your class abilities; a chosen ability still approaches into range before firing once. Melee abilities also start auto-attack.
- **Movement (classic MMO style).** W/S run forward and backpedal along your facing; A/D and the left/right arrows turn you (the camera turns with you); Q/E strafe. Hold the right mouse button to steer: you face where the camera looks and A/D strafe. Hold both mouse buttons to run forward. **F** talks, gathers and loots (right-clicking also works). **Space** jumps (a visual hop). **Num Lock** or **R** toggles autorun; W or S cancels it. **Escape** closes open windows first, then cancels approach, then clears your target, and only then opens the game menu.
- **Combat rules.** A 1.5-second global cooldown (1 second for Rogues) sweeps across every ability button. Auto-attack swings on a weapon timer (Warrior 2.4s, Druid 2.2s, Warlock 2.0s, Rogue 1.7s), and swings and hits taken build Warrior Rage. Rage fades out of combat. Mana regenerates slowly for five seconds after you spend it. Hits and heals can crit. Health regenerates out of combat, faster in camp.
- **Creatures.** Creatures are levels 1–5, rising the farther they roam from camp. Name-plate level colours follow the usual MMO scheme: grey, green, yellow, orange, red. Each creature notices players within an aggro radius that grows with its level advantage, attacks whoever has the most threat (damage dealt, plus half of any healing), and evades back home at full health if pulled more than 32 paces from its spawn. Fleeing into Wayfarer’s Camp (a sanctuary) drops you from every threat list. Kill XP scales with the level gap; creatures five or more levels below you give none.
- **Food, drink and potions.** Torren sells Traveler’s bread and Stillwood spring water. Right-click food or drink in your bags (or press 7 / 8) to sit and restore health or mana over 18 seconds; you can’t eat or drink in combat, and moving, attacking or being hit stops it. Healing draughts (key 6, or right-click in bags) heal instantly with a 20-second shared cooldown. Consumables stack in one bag slot.
- **Death.** At zero health you die: the world turns grey and actions are locked until you choose **Release Spirit**, which returns you to Wayfarer’s Camp at half health.
- **Graphics.** Escape → Graphics quality switches between High (shadows, dense foliage) and Low (faster on older computers); it applies the next time the world loads. Models and their CC0/CC-BY credits are listed in public/models/CREDITS.md.
- **Interface.** The interface includes player and target unit frames with portraits, level badges, combat and resting states, and target-of-target. Hostile name plates sit over creatures. Floating combat text shows white swings, yellow abilities, larger crits, red damage taken, green heals and purple XP. There is a cast bar that flashes green on completion and red on interruption, and failed actions appear as red text near the top of the screen. Entering a named place shows a zone title. A segmented XP bar sits under the action bar, and the action buttons tint red when out of range and blue when you lack the resource. Chat uses channel colours with yellow system lines, and the cursor changes over enemies, NPCs, plants and loot.
- **E** interacts with the nearest NPC, available plant or personal loot chest, approaching if needed. Click an NPC/plant/chest to do the same. NPC conversations also have buttons in the quest ledger. **B / I** opens Bags. **C** opens the separate Character sheet with stats, level, XP, class, faction and equipped slots.
- Enter focuses chat; typing suspends movement. Escape cancels approach/releases text focus. NPC conversations are modal.

There are no complete class talent trees, pets, forms, combo points, group healing, dungeon/raid instances or guilds yet. See ROADMAP.md for those explicit requirements and acceptance milestones.

## NPC quests and local objectives

At camp, talk to **Warden Elowen** for *A thorn in the wood*: defeat three bramblelings, then return for 30 gold + 60 XP. Talk to **Herbalist Mira** for *A remedy for the grove*: gather four starleaf, then return for 25 gold + 60 XP. Select **Accept quest** in the conversation. Click a glowing plant or its Starleaf label to approach and gather it once; clicking through from an open panel closes that panel and starts gathering. Collected sprigs appear as a counted Starleaf stack in Bags’ reagent pouch, with quest progress in the objectives panel. When all four are gathered, Mira displays a **gold ? / Ready for turn-in** marker (also on the maps). Return and choose **Complete quest**; the four sprigs are consumed then. A reward cannot be claimed twice.

The playable map is now 160×160, roughly seven times the previous area. Thirty-two woodland encounter slots and thirty-two Starleaf patches cover the woods, with Amberwatch Ruins, Mossfall Ridge and Moonwell Grove as destinations. Starleaf avoids water and the central camp. Each gathered patch returns after a random 30–90 seconds at a new random location at least eight paces from its old one and away from nearby players. Plant positions and depletion timers survive a restart. The ledger’s Find buttons guide you to a target. Monsters return after random 45–180 second delays at new random sites at least eighteen paces from their previous position and twelve from online players. Eight encounters initially arrive after staggered 15–60 second delays; other players cannot permanently exhaust a quest's resources. The camp around the quest NPCs is a sanctuary with gradual health recovery. Enemies do not select players standing inside it.

## Groups and dungeons

- **Group up:** click another adventurer of your faction and choose *Invite to group*, or type `/invite Name`. Other commands: `/leave`, `/kick Name`, `/promote Name`, and `/p message` for party chat. Groups hold up to five.
- Group members near a kill share its experience (with a group bonus) and quest credit, and each gets their own loot.
- **The Hollow Crypt:** talk to Scout Haldren at the sealed door in Amberwatch Ruins, then press **F** at the door. Your group gets its own copy of the dungeon. Walk back to the glowing portal by the entrance to leave.
- Vorlath the Ashen Warden: step out of red circles, interrupt *Soul Drain*, and kill or control his acolytes.

## The world

The Stillwood (levels 1–6) is at the centre, with four zones around it, each with a town:

| Zone | Direction | Levels | Town |
|---|---|---|---|
| The Amber Downs | East | 6–10 | Harrowford |
| Saltreed Marsh | South | 9–13 | Reedwatch |
| Frostmere Vale | North | 12–16 | Hollowfrost Lodge |
| Greyspire Crags | West | 15–20 | Cragmoor Hold |

Roads lead from Wayfarer’s Camp to every town, and a ring road joins the towns. Towns are sanctuaries with a provisioner, a quest giver and a graveyard; when you release your spirit, you return to the nearest one. Press **M** for the world map.

## Guilds

- **Start one:** talk to Registrar Corwin Hale at Wayfarer’s Camp and buy a charter (10 gold). Ask two adventurers of your faction to sign it, either by clicking them and choosing *Ask to sign charter* or from the guild window. Then return to the Registrar and choose *Found your guild*.
- **Ranks:** Guild Master → Officer → Member → Initiate. Officers and the Guild Master invite, promote, demote, remove lower ranks and set the message of the day. The Guild Master can hand over leadership or disband.
- **Window and chat:** press **J** for the roster. Use `/g` for guild chat and `/o` for officer chat.
- Hosts can change the number of signatures needed with the `HEARTHWILD_CHARTER_SIGNATURES` environment variable (default 2).

## Loot, bags and equipment

Each nearby active contributor receives a personal loot chest when an enemy dies. It contains 10 gold and one item. Move nearby and press E or click the chest; only its owner can see or claim it. Unclaimed drops expire after five minutes. Gold is now collected from drops, rather than instantly added on a kill.

Open the bag with I and select **Equip**. Weapons, chest armor and charms change server-calculated damage, armor and maximum health. Bonuses are listed per item; equipped items remain in the bag and replace that slot's prior item. Repeated replacements do not stack. There are six gear definitions and two healing draughts, with up to 60 gear/consumable bag items and a separate Starleaf reagent pouch. Equipping chest gear adds layered armor and a cape; charms appear on the chest and upgraded weapons change size. Item-specific authored models, class armor restrictions, player-to-player trading is not implemented. Spare items can be sold to merchants.

## Merchants and professions

Talk to **Torren the Provisioner** (south of camp) or **Herbalist Mira**, then choose **Trade & professions**. Buy lists fixed gold prices; Sell buys spare unequipped gear, potions and Starleaf (one gold per sprig). Buyback restores the last ten sold gear/potion instances at the sale price. Equipped gear must be replaced before selling. Purchases, materials, gold and buyback persist per character. Remote trades, forged prices and invalid quantities are rejected by the server.

Mira teaches **Herbalism** and **Alchemy** free. Gathering increases learned Herbalism; crafting increases Alchemy, each capped at 100. Use K to craft anywhere. Two Starleaf make a healing draught (restores 60 health); at Alchemy 5, four make a greater draught (110 health). Select a potion in Bags and choose **Use draught**. Potions share a 20-second cooldown and cannot be wasted at full health. Four Starleaf stay reserved for an accepted gathering quest until turn-in; surplus herbs can be sold or crafted. These are the first two professions and recipes, not complete profession trees.

## Faction communication

| Channel | Recipients |
|---|---|
| Nearby | Online characters of your faction within 18 paces |
| Faction | Your faction throughout the zone |
| Whisper | Sender and the named online same-faction character |

The server derives sender identity/faction and filters recipients; opposing clients never receive restricted text. Messages allow 1–280 characters without control characters and an 0.8-second send interval. A character retains the last 80 received messages in memory. Server history resets on restart; already-rendered browser text can remain until reload. Presence expires after 15 seconds without requests. Voice, party/guild chat and moderation are not implemented. These are character-language rules, not prevention of out-of-game communication or a human creating both factions.

## Friends hosting

Default binding is local to this Mac. To opt into a trusted LAN, stop the server with Ctrl-C, then:

```sh
HOST=0.0.0.0 PORT=4180 npm start
```

Account sign-in over a network requires HTTPS. Supply TLS_CERT and TLS_KEY paths to your trusted certificate/key files; friends open `https://<server-hostname>:4180`. Plain HTTP is supported only for loopback local play. Allow inbound access in macOS Firewall if prompted. No router/firewall/public exposure was configured by this work. Separate devices have not been tested. Internet hosting needs TLS, invitations/account administration, moderation, operational safeguards and measured capacity. The initial 2–8-player target is not a load-test result.

PORT overrides the port; DATA_DIR overrides save storage. Run only one server process per save directory. Data lives in `data/world.json`, replaced through a temporary file and rename. Save after persistent actions and every five seconds, plus graceful shutdown. Abrupt failure can lose recent simulation changes. Back up with the server stopped. Class, XP/level, inventory, equipment, quests, materials and outstanding loot persist; dead monster timers persist through restart; resource nodes regenerate. Password hashes, hashed sessions and account ownership persist. Saves are excluded from Git and the source archive.

## Visual state

This pass adds class headgear, layered visible chest armor, animated capes and equipment details. Earlier work replaces the cone forest and simple bodies with rounded canopy clusters, detailed ground vegetation, textured rock/bark, gradient sky, distant mountains, animated water/motes, articulated character limbs, class weapon silhouettes and combat motion/damage/projectile feedback. The camera shortens around tree occluders. It remains procedural prototype art: authored cinematic characters, animations, environments and effects are a continuing requirement, not a completed result.

## Verify and develop

Run `npm test` and `npm run check`. Forty-three tests cover class/level/skill permissions, costs/cooldowns/cast interruption, leveling, NPC acceptance/turn-in, local objective supply, renewable gathering, personal loot ownership/proximity, equipment stats, character/save migration, chat restrictions, input normalization, approach behavior and authenticated HTTP/restart persistence.

Browser checks in this update: both NPC conversations and acceptance; gathering four starleaf and returning for the reward; Warrior resource generation and a second ability; an enemy defeat with a personal chest; collection/equipping of armor and a charm; level 2 unlocking Rally; a separate Warlock casting at range with Mana consumption; captured console logs without warnings/errors. Druid/Rogue rules are server-tested through the same validation paths, but their complete browser combat flows have not been individually exercised. Long sessions, mobile breakpoints, separate machines and endgame systems remain unverified.

`server/content.js`: classes, abilities, items and NPC/quest definitions. `server/world.js`: server-owned rules/simulation. `server/http.js`: authenticated transport and persistence. `public/controls.js`: approach intent. `public/scenery.js`: original procedural environment/bodies. `public/game.js`: client rendering, input and UI. See SPEC.md for the API and ROADMAP.md for the full MMORPG direction.

## 0.3 interface and respawn update

The HUD now uses a compact 12-slot action bar keyed 1–0, minus and equals (four actual class abilities are implemented; the other slots are empty). Icons are original painted art with cooldown sweeps and level-lock indicators. The player/target frames, lower-left chat, upper-right circular minimap, objective tracker and micro-menu follow familiar MMORPG placement. There is no hotbar drag-and-drop, rebinding, additional action-bar paging or full HUD edit mode yet.

**B / I** opens the combined 60-slot backpack. Search by name/type/rarity, select an item to compare bonuses against the equipped slot, then equip it. **C** opens the same combined character/equipment bag panel. **P** opens the class spellbook. **M** opens a local world map with player/NPC/enemy/resource/loot markers and quest tracking. **L** opens the searchable quest journal view; filter all, active, available or completed quests. Escape closes these windows. Map coordinates are normalized 0–100 for this one starting zone; this is not a multi-continent world atlas or route planner. Other faction players remain visible on the map without any access to restricted chat.

Monster spawning now uses scattered encounter sites and random 45–180 second return delays, preserving positions and schedules through restarts. Starleaf also persists and relocates on a separate 30–90 second timer.

This pass also replaces spherical monsters with articulated tusked forest beasts and adds facial/clothing detail to characters. World art remains procedural and is far from a final cinematic asset set. The icon atlas is a production asset generated with the built-in image tool: see `public/art/GENERATION.md` for the complete prompt and provenance.

Added verification covers twelve-slot ordering, north-up map projection, quest lookup/status filtering, bag filtering/capacity, respawn delay, proximity deferral and timer persistence. Browser verification exercises map/journal search, bag search/item comparison, the spellbook and the new hotbar. These do not establish verification on other screen sizes/devices.

## Window sizes

The HUD has been measured at 320×480, 480×480, 640×480, 800×600, 1024×768 and 1440×900. Compact windows use Chat/Objectives toggles and stacked menus; modal windows scroll to fit. The desktop app offers Compact/Standard/Large sizes in View.
