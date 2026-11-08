// Instanced dungeons, shared by server and client. The Hollow Crypt lies beneath Amberwatch
// Ruins; each outer zone has a dungeon of its own (see DUNGEONS below).
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
  levels: [4, 5],
  bossLevel: 6,
  theme: "crypt",
};
// One dungeon for each zone of the wider world. Rooms snap to the same 4 m grid.
export const DUNGEONS = {
  "hollow-crypt": CRYPT,
  "harrow-barrow": {
    id: "harrow-barrow",
    name: "The Barrow of Harrow Hill",
    zone: "downs",
    origin: { x: 2400, z: 0 },
    door: { x: 700, z: -60 },
    entry: { x: 0, z: 2 },
    exit: { x: 0, z: 4.5 },
    rooms: [
      { name: "Barrow mouth", minX: -6, maxX: 6, minZ: -6, maxZ: 6 },
      { name: "Root tunnel", minX: -2, maxX: 2, minZ: -14, maxZ: -6 },
      { name: "Robbers’ den", minX: -10, maxX: 10, minZ: -30, maxZ: -14 },
      { name: "Narrow dig", minX: 2, maxX: 6, minZ: -42, maxZ: -30 },
      { name: "Stolen stores", minX: -2, maxX: 14, minZ: -54, maxZ: -42 },
      { name: "King’s passage", minX: 2, maxX: 6, minZ: -62, maxZ: -54 },
      { name: "Bandit King’s hall", minX: -10, maxX: 18, minZ: -86, maxZ: -62 },
    ],
    packs: [
      [["harrow-bandit", -4, -20], ["downs-poacher", 4, -22]],
      [["bristleback", -6, -26], ["harrow-bandit", 6, -27], ["downs-poacher", 0, -28]],
      [["harrow-bandit", 3, -47], ["downs-poacher", 10, -49], ["bristleback", 6, -51]],
    ],
    boss: { kind: "bandit-king", name: "Gorran Blackhook", x: 4, z: -78 },
    sanctum: { minX: -10, maxX: 18, minZ: -86, maxZ: -62 },
    levels: [9, 10],
    bossLevel: 11,
    theme: "barrow",
  },
  "drowned-chapel": {
    id: "drowned-chapel",
    name: "The Drowned Chapel",
    zone: "marsh",
    origin: { x: 2800, z: 0 },
    door: { x: 40, z: 640 },
    entry: { x: 0, z: 2 },
    exit: { x: 0, z: 4.5 },
    rooms: [
      { name: "Sunken porch", minX: -6, maxX: 6, minZ: -6, maxZ: 6 },
      { name: "Flooded stair", minX: -2, maxX: 2, minZ: -18, maxZ: -6 },
      { name: "Drowned nave", minX: -6, maxX: 6, minZ: -50, maxZ: -18 },
      { name: "Choir passage", minX: -2, maxX: 2, minZ: -58, maxZ: -50 },
      { name: "Chancel of the Mire", minX: -14, maxX: 14, minZ: -82, maxZ: -58 },
    ],
    packs: [
      [["mire-cultist", -3, -22], ["bog-lurker", 3, -24]],
      [["mire-witch", -3, -32], ["mire-cultist", 3, -33], ["reedfang", 0, -35]],
      [["bog-lurker", -3, -43], ["mire-witch", 3, -44], ["mire-cultist", 0, -46]],
    ],
    boss: { kind: "mire-matron", name: "Mother Sallow", x: 0, z: -72 },
    sanctum: { minX: -14, maxX: 14, minZ: -82, maxZ: -58 },
    levels: [12, 13],
    bossLevel: 14,
    theme: "chapel",
  },
  "glassmere-depths": {
    id: "glassmere-depths",
    name: "Glassmere Depths",
    zone: "frost",
    origin: { x: 3200, z: 0 },
    door: { x: 140, z: -700 },
    entry: { x: 0, z: 2 },
    exit: { x: 0, z: 4.5 },
    rooms: [
      { name: "Ice gate", minX: -6, maxX: 6, minZ: -6, maxZ: 6 },
      { name: "Ice tunnel", minX: -2, maxX: 2, minZ: -14, maxZ: -6 },
      { name: "Frozen cavern", minX: -14, maxX: 6, minZ: -34, maxZ: -14 },
      { name: "Crystal tunnel", minX: -10, maxX: -6, minZ: -46, maxZ: -34 },
      { name: "Icefall", minX: -18, maxX: 2, minZ: -58, maxZ: -46 },
      { name: "Glass tunnel", minX: -10, maxX: -6, minZ: -66, maxZ: -58 },
      { name: "Heart of the Glassmere", minX: -22, maxX: 2, minZ: -90, maxZ: -66 },
    ],
    packs: [
      [["rime-wolf", -6, -20], ["frost-reaver", 0, -22]],
      [["frost-reaver", -10, -28], ["rime-wolf", -4, -30], ["frostfang", 2, -26]],
      [["frostfang", -12, -51], ["frost-reaver", -4, -53]],
    ],
    boss: { kind: "frostbound", name: "Hrimgar the Frostbound", x: -10, z: -80 },
    sanctum: { minX: -22, maxX: 2, minZ: -90, maxZ: -66 },
    levels: [15, 16],
    bossLevel: 17,
    theme: "depths",
  },
  "hollow-peak": {
    id: "hollow-peak",
    name: "The Hollow Peak",
    zone: "crags",
    origin: { x: 3600, z: 0 },
    door: { x: -760, z: -120 },
    entry: { x: 0, z: 2 },
    exit: { x: 0, z: 4.5 },
    rooms: [
      { name: "Mountain gate", minX: -6, maxX: 6, minZ: -6, maxZ: 6 },
      { name: "Cut stair", minX: -2, maxX: 2, minZ: -18, maxZ: -6 },
      { name: "Brigand hall", minX: -10, maxX: 10, minZ: -34, maxZ: -18 },
      { name: "Rune passage", minX: -2, maxX: 2, minZ: -42, maxZ: -34 },
      { name: "Rune gallery", minX: -14, maxX: 14, minZ: -54, maxZ: -42 },
      { name: "Summit stair", minX: -2, maxX: 2, minZ: -62, maxZ: -54 },
      { name: "Heart of the Mountain", minX: -14, maxX: 14, minZ: -90, maxZ: -62 },
    ],
    packs: [
      [["greyspire-brigand", -4, -24], ["stonecaller", 4, -26]],
      [["crag-stalker", -6, -30], ["greyspire-brigand", 6, -31]],
      [["stonecaller", -8, -47], ["greyspire-brigand", 0, -49], ["crag-stalker", 8, -48]],
    ],
    boss: { kind: "stone-matriarch", name: "Stonecaller Varkesh", x: 0, z: -80 },
    sanctum: { minX: -14, maxX: 14, minZ: -90, maxZ: -62 },
    levels: [19, 20],
    bossLevel: 21,
    theme: "peak",
  },
};
export const DUNGEON_LIST = Object.values(DUNGEONS);
// The dungeon whose instance space contains a world position (instances sit far outside the map).
export const dungeonAt = (x, z) =>
  DUNGEON_LIST.find((d) => Math.abs(x - d.origin.x) < 150 && Math.abs(z - d.origin.z) < 150) ?? null;
export const dungeonOf = (instance) =>
  typeof instance === "string" ? (DUNGEON_LIST.find((d) => instance.startsWith(`${d.id}:`)) ?? null) : null;
const INSET = 0.7;
export function walkableIn(d, x, z) {
  return d.rooms.some(
    (r) => x >= r.minX + INSET && x <= r.maxX - INSET && z >= r.minZ + INSET && z <= r.maxZ - INSET,
  ) ||
    // let corridors meet rooms without catching on the inset corners
    d.rooms.some((a) =>
      d.rooms.some(
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
export function cellsOf(d) {
  const cells = [],
    minX = Math.min(...d.rooms.map((r) => r.minX)) - 4,
    maxX = Math.max(...d.rooms.map((r) => r.maxX)) + 4,
    minZ = Math.min(...d.rooms.map((r) => r.minZ)) - 4,
    maxZ = Math.max(...d.rooms.map((r) => r.maxZ)) + 4;
  for (let x = Math.floor(minX / 4) * 4; x <= maxX; x += 4)
    for (let z = Math.floor(minZ / 4) * 4; z <= maxZ; z += 4)
      if (d.rooms.some((r) => x > r.minX && x < r.maxX && z > r.minZ && z < r.maxZ)) cells.push({ x, z });
  return cells;
}
// Wall segments between floor cells and solid rock: { x, z, rot } at the segment's centre.
export function wallsOf(d) {
  const cells = cellsOf(d),
    set = new Set(cells.map((c) => `${c.x},${c.z}`)),
    walls = [];
  for (const c of cells)
    for (const [dx, dz, rot] of [
      [0, -1, 0],
      [0, 1, 0],
      [-1, 0, Math.PI / 2],
      [1, 0, Math.PI / 2],
    ])
      if (!set.has(`${c.x + dx * 4},${c.z + dz * 4}`)) walls.push({ x: c.x + dx * 2, z: c.z + dz * 2, rot, nx: -dx, nz: -dz });
  return walls;
}
// Wall corners where perpendicular walls meet get a pillar to close the joint.
export function pillarsOf(d) {
  const ends = new Map();
  for (const w of wallsOf(d)) {
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
// The Hollow Crypt's original helpers.
export const cryptWalkable = (x, z) => walkableIn(CRYPT, x, z);
export const cryptCells = () => cellsOf(CRYPT);
export const cryptWalls = () => wallsOf(CRYPT);
export const cryptPillars = () => pillarsOf(CRYPT);
export const inCrypt = (p) => !!dungeonOf(p?.instance);
