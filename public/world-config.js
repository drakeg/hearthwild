export const WORLD_HALF = 80,
  WORLD_LIMIT = 78,
  WORLD_SIZE = WORLD_HALF * 2;
export const inCamp = (p) => Math.abs(p.x) < 9 && p.z > 6 && p.z < 25;
export const dryLand = (x, z) =>
  Math.abs(x) <= WORLD_LIMIT - 2 &&
  Math.abs(z) <= WORLD_LIMIT - 2 &&
  Math.hypot(x + 16, z + 12) > 8 &&
  !inCamp({ x, z });

// Named places, used for zone-entry text and the creature level bands.
export const CAMP_CENTER = { x: 0, z: 14 };
export const SUBZONES = [
  { name: "Wayfarer’s Camp", x: 0, z: 16, r: 11, sanctuary: true },
  { name: "Old Stone Arch", x: 0, z: -2, r: 7 },
  { name: "Stillwater Pond", x: -16, z: -12, r: 12 },
  { name: "Amberwatch Ruins", x: -48, z: 45, r: 20 },
  { name: "Mossfall Ridge", x: 43, z: -46, r: 22 },
  { name: "Moonwell Grove", x: -55, z: -50, r: 20 },
];
export function subzoneAt(x, z) {
  return (
    SUBZONES.find((s) => Math.hypot(x - s.x, z - s.z) <= s.r)?.name ??
    "The Stillwood"
  );
}
// Creatures grow tougher the farther they roam from camp: levels 1–5.
export function levelAt(x, z) {
  const d = Math.hypot(x - CAMP_CENTER.x, z - CAMP_CENTER.z);
  return d < 34 ? 1 : d < 52 ? 2 : d < 70 ? 3 : d < 88 ? 4 : 5;
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
