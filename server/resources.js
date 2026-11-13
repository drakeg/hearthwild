import { stillwoodLand as dryLand, STILLWOOD_LIMIT as WORLD_LIMIT, dryLand as worldDryLand, zoneAt, TOWNS } from "../public/world-config.js";
import { lakeAt } from "../public/terrain.js";
import { DUNGEON_LIST } from "../public/dungeon-layout.js";
import { REAGENTS, HERB_POPULATION, herbKind } from "../public/reagents.js";
// Server-owned gathering nodes. The Stillwood's Starleaf roams the clearing; herbs out in the
// world each keep a home ("anchor") and regrow somewhere nearby.
export const HERB_RESPAWN = { min: 30000, max: 90000, count: 32 };
const dry = dryLand;
const clearOfTowns = (x, z) =>
  !TOWNS.some((t) => Math.hypot(x - t.x, z - t.z) < t.r + 14) && !DUNGEON_LIST.some((d) => d.zone && Math.hypot(x - d.door.x, z - d.door.z) < 12);
// Good ground for a wild herb in this zone.
const wildSpot = (x, z, zone) => zoneAt(x, z) === zone && worldDryLand(x, z) && !lakeAt(x, z, 4) && clearOfTowns(x, z);
export function herbPosition(
  random,
  nodes = [],
  old = null,
  players = [],
  cell = null,
) {
  // Wild herbs regrow within about 30 m of their home.
  if (old?.anchorX !== undefined) {
    for (let attempt = 0; attempt < 80; attempt++) {
      const x = old.anchorX + (random() - 0.5) * 60,
        z = old.anchorZ + (random() - 0.5) * 60;
      if (!wildSpot(x, z, old.zone) || players.some((p) => Math.hypot(p.x - x, p.z - z) < 6) || Math.hypot(old.x - x, old.z - z) < 8) continue;
      return { x, z };
    }
    return null;
  }
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
const valid = (r) => typeof r.id === "string" && Number.isFinite(r.x) && Number.isFinite(r.z) && Number.isFinite(r.readyAt) && typeof r.depleted === "boolean";
// Spread-out homes for a zone's herbs.
function herbAnchors(random, zone, count) {
  const out = [],
    ring = ["ember", "gloam", "dunes", "reach"].includes(zone);
  for (let tries = 0; out.length < count && tries < count * 500; tries++) {
    const r = ring ? 1080 + random() * 1300 : 270 + random() * 600,
      a = random() * Math.PI * 2,
      x = Math.cos(a) * r,
      z = Math.sin(a) * r;
    if (!wildSpot(x, z, zone) || out.some((o) => Math.hypot(o.x - x, o.z - z) < (ring ? 55 : 38))) continue;
    out.push({ x, z });
  }
  return out;
}
export function createHerbs(random, saved = []) {
  saved ??= [];
  // The Stillwood's Starleaf.
  const still = saved.filter((r) => String(r.id).startsWith("starleaf-"));
  let nodes;
  if (still.length === HERB_RESPAWN.count && still.every((r) => valid(r) && dry(r.x, r.z)))
    nodes = still.map((r) => ({ kind: "starleaf", name: "Starleaf", zone: "stillwood", ...r }));
  else {
    nodes = [];
    for (let i = 0; i < HERB_RESPAWN.count; i++) {
      const p = herbPosition(random, nodes, null, [], {
        x: -66.5 + (i % 8) * 19,
        z: -57 + Math.floor(i / 8) * 38,
      });
      if (!p) throw Error("Could not place gathering nodes.");
      nodes.push({ id: `starleaf-${i}`, kind: "starleaf", name: "Starleaf", zone: "stillwood", ...p, readyAt: 0, depleted: false });
    }
  }
  // Herbs of the wider world.
  for (const [zone, count] of Object.entries(HERB_POPULATION)) {
    const old = saved.filter((r) => String(r.id).startsWith(`herb-${zone}-`)),
      reuse = old.length === count && old.every((r) => valid(r) && Number.isFinite(r.anchorX)),
      anchors = reuse ? null : herbAnchors(random, zone, count);
    for (let i = 0; i < count; i++) {
      const kind = herbKind(zone, i),
        prev = reuse ? old.find((r) => r.id === `herb-${zone}-${i}`) : null,
        home = prev ? { x: prev.anchorX, z: prev.anchorZ } : anchors[i];
      if (!home) break;
      nodes.push({
        id: `herb-${zone}-${i}`,
        kind,
        name: REAGENTS[kind].name,
        zone,
        x: prev?.x ?? home.x,
        z: prev?.z ?? home.z,
        anchorX: home.x,
        anchorZ: home.z,
        readyAt: prev?.readyAt ?? 0,
        depleted: prev?.depleted ?? false,
      });
    }
  }
  return nodes;
}
export function respawnHerbs(nodes, players, random, now) {
  for (const r of nodes) {
    if (!r.depleted || now < r.readyAt) continue;
    const p = herbPosition(
      random,
      r.anchorX === undefined ? nodes.filter((n) => n !== r && !n.depleted && n.anchorX === undefined) : [],
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
