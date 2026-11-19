// Achievements: shared by the server (which awards them) and the client (which lists them).
// Each one checks a character's own record. Some grant a title that can be shown after your name.
// `tally` holds counters the server keeps for things not otherwise recorded.
import { DUNGEON_LIST } from "./dungeon-layout.js";
import { ZONES } from "./terrain.js";

const DUNGEONS = DUNGEON_LIST.filter((d) => !d.raid).map((d) => d.id),
  RAIDS = DUNGEON_LIST.filter((d) => d.raid).map((d) => d.id),
  ZONE_NAMES = Object.values(ZONES).map((z) => z.name),
  quests = (p) => Object.values(p.quests ?? {}).filter((q) => q.status === "complete").length,
  t = (p, k) => p.tally?.[k] ?? 0,
  cleared = (p, id) => !!p.tally?.cleared?.[id];

export const CATEGORIES = ["Adventure", "Dungeons & Raids", "Exploration", "Professions", "Social"];

export const ACHIEVEMENTS = [
  // Adventure
  { id: "level-10", category: "Adventure", name: "Finding Your Feet", text: "Reach level 10.", points: 10, goal: 10, progress: (p) => p.level },
  { id: "level-20", category: "Adventure", name: "Seasoned", text: "Reach level 20.", points: 10, goal: 20, progress: (p) => p.level },
  { id: "level-30", category: "Adventure", name: "Hero of the Wilds", text: "Reach level 30.", points: 25, title: "the Hero", goal: 30, progress: (p) => p.level },
  { id: "kills-100", category: "Adventure", name: "Monster Hunter", text: "Defeat 100 creatures.", points: 10, goal: 100, progress: (p) => p.kills ?? 0 },
  { id: "kills-1000", category: "Adventure", name: "Relentless", text: "Defeat 1,000 creatures.", points: 25, title: "the Relentless", goal: 1000, progress: (p) => p.kills ?? 0 },
  { id: "quests-10", category: "Adventure", name: "Helping Hand", text: "Complete 10 quests.", points: 10, goal: 10, progress: quests },
  { id: "quests-30", category: "Adventure", name: "Hero for Hire", text: "Complete 30 quests.", points: 25, title: "the Dependable", goal: 30, progress: quests },
  { id: "talents", category: "Adventure", name: "Making Choices", text: "Choose a talent at levels 10, 20 and 30.", points: 10, goal: 3, progress: (p) => Object.keys(p.talents ?? {}).length },
  { id: "gold-1000", category: "Adventure", name: "Well-Off", text: "Hold 1,000 gold at once.", points: 10, goal: 1000, progress: (p) => p.coins ?? 0 },
  // Dungeons & Raids
  { id: "first-dungeon", category: "Dungeons & Raids", name: "Into the Dark", text: "Defeat the final boss of any dungeon.", points: 10, goal: 1, progress: (p) => DUNGEONS.filter((id) => cleared(p, id)).length },
  { id: "all-dungeons", category: "Dungeons & Raids", name: "Delver", text: `Defeat the final boss of all ${DUNGEONS.length} dungeons.`, points: 25, title: "the Delver", goal: DUNGEONS.length, progress: (p) => DUNGEONS.filter((id) => cleared(p, id)).length },
  { id: "raid", category: "Dungeons & Raids", name: "Spirebreaker", text: "Defeat the final boss of a raid.", points: 25, title: "Spirebreaker", goal: 1, progress: (p) => RAIDS.filter((id) => cleared(p, id)).length },
  { id: "all-raids", category: "Dungeons & Raids", name: "Unbroken", text: `Defeat the final boss of all ${RAIDS.length} raids.`, points: 25, title: "the Unbroken", goal: RAIDS.length, progress: (p) => RAIDS.filter((id) => cleared(p, id)).length },
  { id: "world-boss", category: "Dungeons & Raids", name: "Colossus-Slayer", text: "Help bring down Gharrowmaw, the Wandering Colossus.", points: 25, title: "Colossus-Slayer", goal: 1, progress: (p) => t(p, "worldBoss") },
  // Exploration
  { id: "explore-5", category: "Exploration", name: "Wanderer", text: "Discover 5 zones.", points: 10, goal: 5, progress: (p) => ZONE_NAMES.filter((n) => p.explored?.includes(n)).length },
  { id: "explore-all", category: "Exploration", name: "Wayfarer", text: `Discover all ${ZONE_NAMES.length} zones.`, points: 25, title: "the Wayfarer", goal: ZONE_NAMES.length, progress: (p) => ZONE_NAMES.filter((n) => p.explored?.includes(n)).length },
  { id: "places-25", category: "Exploration", name: "Mapmaker", text: "Discover 25 places: zones, towns and lakes.", points: 10, goal: 25, progress: (p) => p.explored?.length ?? 0 },
  // Professions
  { id: "gather-100", category: "Professions", name: "Green Thumb", text: "Gather 100 herbs or ore.", points: 10, goal: 100, progress: (p) => t(p, "gathered") },
  { id: "craft-25", category: "Professions", name: "Handy", text: "Brew or forge 25 times.", points: 10, goal: 25, progress: (p) => t(p, "crafted") },
  { id: "alchemy-100", category: "Professions", name: "Master Alchemist", text: "Reach Alchemy 100.", points: 25, title: "the Alchemist", goal: 100, progress: (p) => p.professions?.alchemy ?? 0 },
  { id: "smithing-100", category: "Professions", name: "Master Smith", text: "Reach Blacksmithing 100.", points: 25, title: "the Smith", goal: 100, progress: (p) => p.professions?.blacksmithing ?? 0 },
  // Social
  { id: "group", category: "Social", name: "Better Together", text: "Join a group.", points: 10, goal: 1, progress: (p) => (p.partyId ? 1 : 0) },
  { id: "guild", category: "Social", name: "Sworn In", text: "Join a guild.", points: 10, goal: 1, progress: (p) => (p.guildId || p.guild ? 1 : 0) },
  { id: "trade", category: "Social", name: "Fair Exchange", text: "Complete a trade with another player.", points: 10, goal: 1, progress: (p) => t(p, "trades") },
  { id: "mail", category: "Social", name: "Pen Pal", text: "Send a letter.", points: 10, goal: 1, progress: (p) => t(p, "mailSent") },
];
export const ACHIEVEMENT = Object.fromEntries(ACHIEVEMENTS.map((a) => [a.id, a]));
export const TITLES = Object.fromEntries(ACHIEVEMENTS.filter((a) => a.title).map((a) => [a.id, a.title]));
// "Name the Hero", but "Spirebreaker Name" reads oddly, so titles without "the" follow a comma.
export const titled = (name, title) => (!title ? name : title.startsWith("the ") ? `${name} ${title}` : `${name}, ${title}`);
