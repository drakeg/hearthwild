import { stillwoodLand as dryLand, STILLWOOD_LIMIT as WORLD_LIMIT } from "../public/world-config.js";
// Server-owned gathering nodes. Positions stay inside the playable map and avoid water/camp.
export const HERB_RESPAWN = { min: 30000, max: 90000, count: 32 };
const dry = dryLand;
export function herbPosition(
  random,
  nodes = [],
  old = null,
  players = [],
  cell = null,
) {
  for (let attempt = 0; attempt < 160; attempt++) {
    const x =
      cell && attempt < 40
        ? cell.x + (random() - 0.5) * 9
        : -(WORLD_LIMIT - 2) + random() * (WORLD_LIMIT - 2) * 2;
    const z =
      cell && attempt < 40
        ? cell.z + (random() - 0.5) * 9
        : -(WORLD_LIMIT - 2) + random() * (WORLD_LIMIT - 2) * 2;
    if (
      !dry(x, z) ||
      nodes.some((n) => Math.hypot(n.x - x, n.z - z) < 5) ||
      players.some((p) => Math.hypot(p.x - x, p.z - z) < 6) ||
      (old && Math.hypot(old.x - x, old.z - z) < 8)
    )
      continue;
    return { x, z };
  }
  return null;
}
export function createHerbs(random, saved) {
  if (
    saved?.length === HERB_RESPAWN.count &&
    saved.every(
      (r) =>
        typeof r.id === "string" &&
        dry(r.x, r.z) &&
        Number.isFinite(r.readyAt) &&
        typeof r.depleted === "boolean",
    )
  )
    return saved.map((r) => ({ ...r }));
  const nodes = [];
  for (let i = 0; i < HERB_RESPAWN.count; i++) {
    const p = herbPosition(random, nodes, null, [], {
      x: -66.5 + (i % 8) * 19,
      z: -57 + Math.floor(i / 8) * 38,
    });
    if (!p) throw Error("Could not place gathering nodes.");
    nodes.push({
      id: `starleaf-${i}`,
      name: "Starleaf",
      ...p,
      readyAt: 0,
      depleted: false,
    });
  }
  return nodes;
}
export function respawnHerbs(nodes, players, random, now) {
  for (const r of nodes) {
    if (!r.depleted || now < r.readyAt) continue;
    const p = herbPosition(
      random,
      nodes.filter((n) => n !== r && !n.depleted),
      r,
      players,
    );
    if (!p) {
      r.readyAt = now + 5000;
      continue;
    }
    Object.assign(r, p, { depleted: false, readyAt: 0 });
  }
}
