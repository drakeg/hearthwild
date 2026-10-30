// Combat tuning shared by the world simulation. All numbers are original to Hearthwild.
import { levelAt, subzoneAt, zoneAt } from "../public/world-config.js";

export const MELEE_RANGE = 3.2;
export const LEASH_RANGE = 32;
export const COMBAT_LINGER = 5000;
export const CRIT_CHANCE = 0.06;
export const CRIT_MULTIPLIER = 2;
export const MOB_SWING = 2000;
export const MOB_REACH = 2.2;

export function mobStats(level) {
  return {
    maxHp: 60 + (level - 1) * 28,
    damage: 6 + level * 2,
    chaseSpeed: 4.1,
  };
}
const BEASTS = [
  { kind: "brambleling", name: "Brambleling" },
  { kind: "prowler", name: "Mossback prowler" },
  { kind: "thornhide", name: "Thornhide" },
];
// The Ashen are a band of raiders holed up in the ruins and the far reaches.
const UNDEAD = [
  { kind: "ashen-cutthroat", name: "Ashen cutthroat" },
  { kind: "ashen-raider", name: "Ashen raider" },
  { kind: "ashen-stalker", name: "Ashen stalker" },
  { kind: "ashen-hexer", name: "Ashen hexer" },
];
const HAUNTED = ["Amberwatch Ruins", "Moonwell Grove"];
// The wider world's creatures, by zone. Beasts and people alternate by spawn slot.
export const ZONE_CREATURES = {
  stillwood: [BEASTS[1], UNDEAD[1], BEASTS[2], UNDEAD[3], UNDEAD[0]],
  downs: [
    { kind: "gorse-hound", name: "Gorsefield hound" },
    { kind: "harrow-bandit", name: "Harrow bandit" },
    { kind: "bristleback", name: "Bristleback" },
    { kind: "downs-poacher", name: "Downs poacher" },
  ],
  marsh: [
    { kind: "bog-lurker", name: "Bog lurker" },
    { kind: "mire-cultist", name: "Mire cultist" },
    { kind: "reedfang", name: "Reedfang" },
    { kind: "mire-witch", name: "Mire witch" },
  ],
  frost: [
    { kind: "rime-wolf", name: "Rime wolf" },
    { kind: "frost-reaver", name: "Hollowfrost reaver" },
    { kind: "frostfang", name: "Frostfang alpha" },
  ],
  crags: [
    { kind: "crag-stalker", name: "Crag stalker" },
    { kind: "greyspire-brigand", name: "Greyspire brigand" },
    { kind: "stonecaller", name: "Stonecaller" },
  ],
};
// Level, health and creature type follow where a creature (re)spawns.
export function applyLevel(e) {
  e.level = levelAt(e.x, e.z);
  e.maxHp = mobStats(e.level).maxHp;
  const parts = String(e.id ?? "").split("-"),
    slot = Number(parts.at(-1)) || 0;
  if (parts[0] === "wild") {
    const table = ZONE_CREATURES[zoneAt(e.x, e.z)],
      type = table[slot % table.length];
    e.kind = type.kind;
    e.name = type.name;
    e.zoneId = zoneAt(e.x, e.z);
    return e;
  }
  const undead = e.level >= 3 || HAUNTED.includes(subzoneAt(e.x, e.z)),
    type = undead ? UNDEAD[slot % UNDEAD.length] : BEASTS[slot % BEASTS.length];
  e.kind = type.kind;
  e.name = type.name;
  return e;
}
// Aggro radius grows when a creature outlevels you and shrinks when you outlevel it.
export function aggroRadius(mobLevel, playerLevel) {
  return Math.max(2.5, Math.min(12, 7 + (mobLevel - playerLevel) * 1.2));
}
// Experience scales with the level gap; creatures five or more levels below give none.
export function killExperience(mobLevel, playerLevel) {
  if (playerLevel - mobLevel >= 5) return 0;
  const scale = Math.max(0.2, Math.min(1.5, 1 + (mobLevel - playerLevel) * 0.15));
  return Math.round(35 * scale);
}
export function autoAttackDamage(stats, swing) {
  return Math.max(1, Math.round(stats.damage * 0.4 * (swing / 2000)));
}
