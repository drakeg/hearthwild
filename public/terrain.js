// The shape of the wider world, shared by the server (spawns, collisions, levels) and the
// client (terrain, scenery, maps). Pure functions only: no Three.js here.
//
// Layout: the Stillwood sits in the middle; four zones surround it. North is −z.
//   East  · The Amber Downs   — golden rolling grassland and farms
//   South · Saltreed Marsh    — flat bog, reed beds and dark pools
//   North · Frostmere Vale    — snowy hills, pines and a frozen lake
//   West  · Greyspire Crags   — high rocky ridges
// A mountain wall rings the world beyond WORLD_LIMIT.

export const WORLD_HALF = 1000,
  WORLD_LIMIT = 880,
  WORLD_SIZE = WORLD_HALF * 2;

export const ZONES = {
  stillwood: { id: "stillwood", name: "The Stillwood", levels: [1, 6], color: "#5f8f45" },
  downs: { id: "downs", name: "The Amber Downs", levels: [6, 10], color: "#c4a24f", angle: 0 },
  marsh: { id: "marsh", name: "Saltreed Marsh", levels: [9, 13], color: "#5f7a5a", angle: Math.PI / 2 },
  crags: { id: "crags", name: "Greyspire Crags", levels: [15, 20], color: "#8a8780", angle: Math.PI },
  frost: { id: "frost", name: "Frostmere Vale", levels: [12, 16], color: "#c9d6e2", angle: -Math.PI / 2 },
};
const OUTER = ["downs", "marsh", "crags", "frost"];

// ---------- Noise ----------
function hash(ix, iz, seed) {
  let h = (ix * 374761393 + iz * 668265263 + seed * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function noise(x, z, seed) {
  const ix = Math.floor(x),
    iz = Math.floor(z),
    fx = x - ix,
    fz = z - iz,
    u = fx * fx * (3 - 2 * fx),
    v = fz * fz * (3 - 2 * fz);
  const a = hash(ix, iz, seed),
    b = hash(ix + 1, iz, seed),
    c = hash(ix, iz + 1, seed),
    d = hash(ix + 1, iz + 1, seed);
  return (a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v) * 2 - 1;
}
export function fbm(x, z, seed, octaves = 4) {
  let s = 0,
    amp = 0.5,
    f = 1;
  for (let i = 0; i < octaves; i++) {
    s += amp * noise(x * f, z * f, seed + i * 17);
    f *= 2.03;
    amp *= 0.5;
  }
  return s;
}
const smooth = (a, b, x) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// ---------- Zones ----------
const STILL_R = 255;
export function zoneWeights(x, z) {
  const r = Math.hypot(x, z),
    edge = STILL_R + fbm(x * 0.006, z * 0.006, 3) * 40,
    outer = smooth(edge - 35, edge + 35, r),
    w = { stillwood: 1 - outer, downs: 0, marsh: 0, crags: 0, frost: 0 };
  if (outer <= 0) return w;
  const a = Math.atan2(z, x) + fbm(x * 0.004, z * 0.004, 9) * 0.22;
  let total = 0;
  const m = {};
  for (const id of OUTER) {
    let d = Math.abs(a - ZONES[id].angle) % (Math.PI * 2);
    if (d > Math.PI) d = Math.PI * 2 - d;
    // Borders blend over about 70 m of ground.
    m[id] = Math.max(0, Math.min(1, ((Math.PI / 4 - d) * Math.max(r, 60)) / 70 + 0.5));
    total += m[id];
  }
  for (const id of OUTER) w[id] = outer * (m[id] / (total || 1));
  return w;
}
export function zoneAt(x, z) {
  const w = zoneWeights(x, z);
  let best = "stillwood";
  for (const id of OUTER) if (w[id] > w[best]) best = id;
  return best;
}

// ---------- Towns ----------
// Every town is a sanctuary with a graveyard. Houses are [dx, dz, width, depth, rotation, style].
export const TOWNS = [
  {
    id: "harrowford",
    name: "Harrowford",
    zone: "downs",
    x: 560,
    z: 30,
    r: 34,
    houses: [
      [-15, -14, 6, 8, 0, 0], [3, -17, 4, 6, 0, 1], [17, -13, 6, 6, 0, 0],
      [-17, 13, 6, 6, Math.PI, 1], [0, 17, 8, 8, Math.PI, 0], [17, 14, 4, 4, Math.PI, 1],
    ],
  },
  {
    id: "reedwatch",
    name: "Reedwatch",
    zone: "marsh",
    x: -40,
    z: 580,
    r: 30,
    houses: [
      [-14, -12, 4, 6, Math.PI / 2, 1], [-15, 6, 6, 6, Math.PI / 2, 1], [14, -10, 6, 6, -Math.PI / 2, 1],
      [15, 10, 4, 4, -Math.PI / 2, 0], [0, 18, 6, 8, Math.PI, 1],
    ],
  },
  {
    id: "hollowfrost",
    name: "Hollowfrost Lodge",
    zone: "frost",
    x: 30,
    z: -600,
    r: 30,
    houses: [
      [0, -16, 8, 8, 0, 0], [-16, -6, 6, 6, Math.PI / 2, 0], [16, -6, 6, 6, -Math.PI / 2, 0],
      [-14, 14, 4, 6, Math.PI, 1], [14, 14, 4, 4, Math.PI, 1],
    ],
  },
  {
    id: "cragmoor",
    name: "Cragmoor Hold",
    zone: "crags",
    x: -600,
    z: -40,
    r: 32,
    houses: [
      [-16, -14, 6, 8, 0, 0], [0, -18, 6, 6, 0, 0], [16, -14, 8, 8, 0, 0],
      [-16, 14, 6, 6, Math.PI, 0], [16, 14, 6, 6, Math.PI, 0],
    ],
  },
];
// Wayfarer's Camp is the first sanctuary and graveyard.
export const GRAVEYARDS = [{ id: "camp", name: "Wayfarer’s Camp", x: 0, z: 12 }, ...TOWNS.map((t) => ({ id: t.id, name: t.name, x: t.x, z: t.z + 6 }))];
export const townAt = (x, z, pad = 0) => TOWNS.find((t) => Math.hypot(x - t.x, z - t.z) < t.r + pad) ?? null;
// World-space rectangles of every house, for collisions and placement.
export const HOUSES = TOWNS.flatMap((t) =>
  t.houses.map(([dx, dz, w, d, rot, style], i) => ({ id: `${t.id}-${i}`, town: t.id, x: t.x + dx, z: t.z + dz, w, d, rot, style })),
);
export function insideHouse(x, z, pad = 0.4) {
  for (const h of HOUSES) {
    if (Math.abs(x - h.x) > 8 || Math.abs(z - h.z) > 8) continue;
    const c = Math.cos(-h.rot),
      s = Math.sin(-h.rot),
      lx = (x - h.x) * c - (z - h.z) * s,
      lz = (x - h.x) * s + (z - h.z) * c;
    if (Math.abs(lx) < h.w / 2 + pad && Math.abs(lz) < h.d / 2 + pad) return h;
  }
  return null;
}

// ---------- Roads ----------
// Control points for each road; smoothed into short segments below.
const ROAD_PATHS = [
  // From the arch trail north to Hollowfrost Lodge.
  [[0, -78], [6, -150], [-14, -240], [12, -330], [-10, -420], [24, -500], [30, -570], [30, -600]],
  // South from camp to Reedwatch.
  [[0, 84], [-12, 170], [14, 260], [-6, 350], [-30, 450], [-40, 550], [-40, 580]],
  // East from camp to Harrowford.
  [[9, 16], [60, 22], [140, 4], [240, 30], [340, 14], [440, 36], [526, 30], [560, 30]],
  // West from camp to Cragmoor Hold.
  [[-9, 16], [-60, 12], [-150, 34], [-250, 6], [-360, -24], [-470, -30], [-568, -40], [-600, -40]],
  // The outer ring between towns.
  [[590, 30], [600, -120], [520, -300], [360, -460], [200, -560], [60, -600]],
  [[560, 64], [520, 230], [400, 380], [230, 500], [80, 560], [-10, 580]],
  [[-70, 580], [-240, 520], [-420, 400], [-540, 230], [-600, 90], [-600, -8]],
  [[-600, -72], [-560, -240], [-440, -400], [-280, -520], [-120, -590], [0, -600]],
];
function catmull(p, step = 6) {
  const out = [];
  for (let i = 0; i < p.length - 1; i++) {
    const p0 = p[Math.max(0, i - 1)],
      p1 = p[i],
      p2 = p[i + 1],
      p3 = p[Math.min(p.length - 1, i + 2)],
      n = Math.max(2, Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / step));
    for (let k = 0; k < n; k++) {
      const t = k / n,
        t2 = t * t,
        t3 = t2 * t;
      const f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  out.push(p[p.length - 1]);
  return out;
}
export const ROADS = ROAD_PATHS.map((p) => catmull(p));
export const ROAD_WIDTH = 4.2;
// Segments bucketed into 100 m cells for fast distance queries.
const roadGrid = new Map();
for (const road of ROADS)
  for (let i = 0; i < road.length - 1; i++) {
    const [ax, az] = road[i],
      [bx, bz] = road[i + 1];
    const seg = [ax, az, bx, bz];
    for (let cx = Math.floor((Math.min(ax, bx) - 40) / 100); cx <= Math.floor((Math.max(ax, bx) + 40) / 100); cx++)
      for (let cz = Math.floor((Math.min(az, bz) - 40) / 100); cz <= Math.floor((Math.max(az, bz) + 40) / 100); cz++) {
        const k = cx * 1000 + cz;
        if (!roadGrid.has(k)) roadGrid.set(k, []);
        roadGrid.get(k).push(seg);
      }
  }
// Distance to the nearest road (capped at 40 m), including the arch trail through the Stillwood.
export function roadDistance(x, z) {
  let best = 40;
  if (z > -82 && z < 86) best = Math.min(best, Math.abs(x - Math.sin(z * 0.1) * 0.65));
  const segs = roadGrid.get(Math.floor(x / 100) * 1000 + Math.floor(z / 100));
  if (segs)
    for (const [ax, az, bx, bz] of segs) {
      const dx = bx - ax,
        dz = bz - az,
        t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz || 1))),
        d = Math.hypot(x - ax - dx * t, z - az - dz * t);
      if (d < best) best = d;
    }
  return best;
}

// ---------- Water ----------
// Lakes: water level is set from the land around them; frozen lakes are walkable ice.
export const LAKES = [
  { name: "Miller’s Pond", x: 420, z: 170, r: 38, depth: 1.1 },
  { name: "Blackwater Pools", x: -150, z: 430, r: 52, depth: 1.0 },
  { name: "Blackwater Pools", x: 150, z: 470, r: 40, depth: 1.0 },
  { name: "Blackwater Pools", x: -230, z: 690, r: 46, depth: 1.0 },
  { name: "Blackwater Pools", x: 90, z: 720, r: 34, depth: 1.0 },
  { name: "Glassmere", x: -150, z: -500, r: 70, depth: 0, frozen: true },
  { name: "Greyspire Tarn", x: -720, z: -260, r: 36, depth: 1.2 },
];

// ---------- Height ----------
// The original Stillwood clearing, kept exactly as it was near camp.
function stillwoodCore(x, z) {
  const basin = Math.hypot(x + 16, z + 12);
  return Math.sin(x * 0.1) * 0.4 + Math.cos(z * 0.13) * 0.35 - Math.max(0, 1 - basin / 8) * 1.5 + Math.max(0, Math.hypot(x, z) - 24) * 0.055;
}
function landHeight(x, z, w = zoneWeights(x, z)) {
  const road = smooth(3, 30, roadDistance(x, z)) * 0.75 + 0.25;
  let h = 5.4;
  h += w.stillwood * fbm(x * 0.012, z * 0.012, 21) * 4 * road;
  h += w.downs * (fbm(x * 0.006, z * 0.006, 31) * 9 + fbm(x * 0.03, z * 0.03, 32) * 0.8) * road;
  h += w.marsh * (fbm(x * 0.01, z * 0.01, 41) * 1.6 - 1.2);
  h += w.frost * (fbm(x * 0.008, z * 0.008, 51) * 14 + 3) * road;
  if (w.crags > 0) {
    // Ridged noise for sharp rocky crests.
    const ridge = 1 - Math.abs(fbm(x * 0.007, z * 0.007, 61, 5));
    h += w.crags * (ridge * ridge * 30 + fbm(x * 0.04, z * 0.04, 62) * 2 - 4) * road;
  }
  // The world's rim rises into impassable mountains.
  const rim = Math.max(Math.abs(x), Math.abs(z));
  if (rim > 890) h += ((rim - 890) / 110) ** 2 * 70 * (0.8 + fbm(x * 0.01, z * 0.01, 71) * 0.4);
  return h;
}
const townLevel = new Map(TOWNS.map((t) => [t.id, landHeight(t.x, t.z)]));
for (const lake of LAKES) lake.level = lake.frozen ? landHeight(lake.x, lake.z) - 0.3 : landHeight(lake.x, lake.z) - 0.4;

export function terrainHeight(x, z) {
  const r = Math.hypot(x, z);
  if (r < 95) return stillwoodCore(x, z);
  let h = landHeight(x, z);
  if (r < 150) h = stillwoodCore(x, z) + (h - stillwoodCore(x, z)) * smooth(95, 150, r);
  for (const t of TOWNS) {
    const d = Math.hypot(x - t.x, z - t.z);
    if (d < t.r + 40) h = townLevel.get(t.id) + (h - townLevel.get(t.id)) * smooth(t.r, t.r + 40, d);
  }
  for (const l of LAKES) {
    const d = Math.hypot(x - l.x, z - l.z);
    if (d > l.r * 1.5) continue;
    const floor = l.frozen ? l.level : l.level - l.depth;
    h = floor + (h - floor) * smooth(l.r * 0.7, l.r * 1.5, d);
  }
  return h;
}
export const lakeAt = (x, z, pad = 0) => LAKES.find((l) => Math.hypot(x - l.x, z - l.z) < l.r + pad) ?? null;

// ---------- Levels ----------
// Creatures toughen with distance from camp inside the Stillwood, then by zone band.
export function levelAt(x, z) {
  const zone = zoneAt(x, z),
    d = Math.hypot(x, z - 14);
  if (zone === "stillwood") return d < 34 ? 1 : d < 52 ? 2 : d < 70 ? 3 : d < 88 ? 4 : d < 170 ? 5 : 6;
  const [lo, hi] = ZONES[zone].levels,
    t = Math.max(0, Math.min(1, (Math.hypot(x, z) - 280) / 520));
  return Math.round(lo + (hi - lo) * t);
}
