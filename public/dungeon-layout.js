// The Hollow Crypt: an instanced dungeon beneath Amberwatch Ruins. Shared by server and client.
// Coordinates are metres relative to the instance origin; rooms snap to a 4 m tile grid
// (tile centres on multiples of 4, so every room edge sits on an odd multiple of 2).
export const CRYPT = {
  id: "hollow-crypt",
  name: "The Hollow Crypt",
  origin: { x: 2000, z: 0 },
  // Overworld doorway at the foot of Amberwatch Ruins.
  door: { x: -48, z: 37.5 },
  entry: { x: 0, z: 2 },
  exit: { x: 0, z: 4.5 },
  rooms: [
    { name: "Entry hall", minX: -6, maxX: 6, minZ: -6, maxZ: 6 },
    { name: "Bone passage", minX: -2, maxX: 2, minZ: -18, maxZ: -6 },
    { name: "Hall of Ash", minX: -10, maxX: 10, minZ: -34, maxZ: -18 },
    { name: "Lower passage", minX: -2, maxX: 2, minZ: -46, maxZ: -34 },
    { name: "Antechamber", minX: -6, maxX: 6, minZ: -54, maxZ: -46 },
    { name: "Warden’s door", minX: -2, maxX: 2, minZ: -58, maxZ: -54 },
    { name: "Warden’s Sanctum", minX: -14, maxX: 14, minZ: -82, maxZ: -58 },
  ],
  // Trash packs and the boss: [kind, x, z]
  packs: [
    [["ashen-cutthroat", -3, -24], ["ashen-raider", 3, -25]],
    [["ashen-stalker", -6, -30], ["ashen-hexer", 5, -31], ["ashen-cutthroat", 0, -32]],
    [["ashen-raider", -3, -50], ["ashen-hexer", 3, -51]],
  ],
  boss: { kind: "ashen-warden", name: "Vorlath the Ashen Warden", x: 0, z: -74 },
  sanctum: { minX: -14, maxX: 14, minZ: -82, maxZ: -58 },
};
const INSET = 0.7;
export function cryptWalkable(x, z) {
  return CRYPT.rooms.some(
    (r) => x >= r.minX + INSET && x <= r.maxX - INSET && z >= r.minZ + INSET && z <= r.maxZ - INSET,
  ) ||
    // let corridors meet rooms without catching on the inset corners
    CRYPT.rooms.some((a) =>
      CRYPT.rooms.some(
        (b) =>
          a !== b &&
          x >= Math.max(a.minX, b.minX) + INSET &&
          x <= Math.min(a.maxX, b.maxX) - INSET &&
          z >= Math.min(a.minZ, b.minZ) + INSET &&
          z <= Math.max(a.maxZ, b.maxZ) - INSET &&
          (Math.abs(a.minZ - b.maxZ) < 0.01 || Math.abs(a.maxZ - b.minZ) < 0.01),
      ),
    );
}
// Grid cells (tile centres) that are inside any room.
export function cryptCells() {
  const cells = [];
  for (let x = -16; x <= 16; x += 4)
    for (let z = -84; z <= 8; z += 4)
      if (CRYPT.rooms.some((r) => x > r.minX && x < r.maxX && z > r.minZ && z < r.maxZ)) cells.push({ x, z });
  return cells;
}
// Wall segments between floor cells and solid rock: { x, z, rot } at the segment's centre.
export function cryptWalls() {
  const cells = cryptCells(),
    has = (x, z) => cells.some((c) => c.x === x && c.z === z),
    walls = [];
  for (const c of cells)
    for (const [dx, dz, rot] of [
      [0, -1, 0],
      [0, 1, 0],
      [-1, 0, Math.PI / 2],
      [1, 0, Math.PI / 2],
    ])
      if (!has(c.x + dx * 4, c.z + dz * 4)) walls.push({ x: c.x + dx * 2, z: c.z + dz * 2, rot, nx: -dx, nz: -dz });
  return walls;
}
// Wall corners where perpendicular walls meet get a pillar to close the joint.
export function cryptPillars() {
  const walls = cryptWalls(),
    ends = new Map();
  for (const w of walls) {
    const horizontal = w.rot === 0;
    for (const s of [-2, 2]) {
      const px = horizontal ? w.x + s : w.x,
        pz = horizontal ? w.z : w.z + s,
        key = `${px},${pz}`;
      const e = ends.get(key) ?? { x: px, z: pz, h: false, v: false };
      if (horizontal) e.h = true;
      else e.v = true;
      ends.set(key, e);
    }
  }
  return [...ends.values()].filter((e) => e.h && e.v);
}
export const inCrypt = (p) => p?.instance?.startsWith?.(CRYPT.id) ?? false;
