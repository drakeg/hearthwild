import { WORLD_HALF, WORLD_LIMIT, WORLD_SIZE, ZONES, TOWNS, LAKES, zoneAt, townAt, lakeAt, roadDistance, levelAt } from "./terrain.js";
export { WORLD_HALF, WORLD_LIMIT, WORLD_SIZE, ZONES, TOWNS, levelAt, zoneAt };

// The original Stillwood clearing (starter creatures and starleaf patches stay inside it).
export const STILLWOOD_LIMIT = 78;
export const inCamp = (p) => Math.abs(p.x) < 9 && p.z > 6 && p.z < 25;
// Towns and camp are sanctuaries: creatures won't follow you in and you heal faster.
export const inSanctuary = (p) => inCamp(p) || !!townAt(p.x, p.z);
export const stillwoodLand = (x, z) =>
  Math.abs(x) <= STILLWOOD_LIMIT - 2 &&
  Math.abs(z) <= STILLWOOD_LIMIT - 2 &&
  Math.hypot(x + 16, z + 12) > 8 &&
  !inCamp({ x, z });
// Open wilderness anywhere in the world: off the roads, out of towns and water.
export const dryLand = (x, z) =>
  Math.abs(x) <= WORLD_LIMIT - 12 &&
  Math.abs(z) <= WORLD_LIMIT - 12 &&
  Math.hypot(x + 16, z + 12) > 8 &&
  !inCamp({ x, z }) &&
  !townAt(x, z, 14) &&
  !lakeAt(x, z, 4) &&
  roadDistance(x, z) > 5;

// Named places, used for zone-entry text.
export const CAMP_CENTER = { x: 0, z: 14 };
export const SUBZONES = [
  { name: "Wayfarer’s Camp", x: 0, z: 16, r: 11, sanctuary: true },
  { name: "Old Stone Arch", x: 0, z: -2, r: 7 },
  { name: "Stillwater Pond", x: -16, z: -12, r: 12 },
  { name: "Amberwatch Ruins", x: -48, z: 45, r: 20 },
  { name: "Mossfall Ridge", x: 43, z: -46, r: 22 },
  { name: "Moonwell Grove", x: -55, z: -50, r: 20 },
  ...TOWNS.map((t) => ({ name: t.name, x: t.x, z: t.z, r: t.r + 6, sanctuary: true })),
  ...LAKES.map((l) => ({ name: l.name, x: l.x, z: l.z, r: l.r + 8 })),
];
export function subzoneAt(x, z) {
  return SUBZONES.find((s) => Math.hypot(x - s.x, z - s.z) <= s.r)?.name ?? ZONES[zoneAt(x, z)].name;
}
// Standard MMO "con" colours relative to the viewer's level.
export function levelColor(mobLevel, playerLevel) {
  const diff = mobLevel - playerLevel;
  if (diff >= 5) return "#ff2020";
  if (diff >= 3) return "#ff8040";
  if (diff >= -2) return "#ffff00";
  if (diff >= -4) return "#40c040";
  return "#9d9d9d";
}
