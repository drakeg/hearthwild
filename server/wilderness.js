import { dryLand, stillwoodLand, STILLWOOD_LIMIT, zoneAt, TOWNS } from "../public/world-config.js";
import { applyLevel } from "./combat.js";
export const MONSTER_RESPAWN = { min: 45000, max: 180000, count: 32 };
// Creatures of the wider world, per zone. Each keeps a home ("anchor") it respawns around.
export const ZONE_POPULATION = { stillwood: 24, downs: 46, marsh: 46, frost: 42, crags: 42 };
export const monsterDelay = (random) =>
  MONSTER_RESPAWN.min +
  Math.floor(random() * (MONSTER_RESPAWN.max - MONSTER_RESPAWN.min + 1));
const nearTown = (x, z) => TOWNS.some((t) => Math.hypot(x - t.x, z - t.z) < t.r + 30);
export function monsterPosition(random, others = [], players = [], old = null, cell = null) {
  // Creatures of the wider world stay near their anchor; starter creatures roam the clearing.
  const anchored = old?.anchorX !== undefined;
  for (let i = 0; i < 300; i++) {
    let x, z;
    if (anchored) {
      x = old.anchorX + (random() - 0.5) * (i < 150 ? 24 : 50);
      z = old.anchorZ + (random() - 0.5) * (i < 150 ? 24 : 50);
    } else {
      x = cell && i < 60 ? cell.x + (random() - 0.5) * 10 : (random() - 0.5) * (STILLWOOD_LIMIT - 3) * 2;
      z = cell && i < 60 ? cell.z + (random() - 0.5) * 10 : (random() - 0.5) * (STILLWOOD_LIMIT - 3) * 2;
    }
    if (
      !(anchored ? dryLand(x, z) && !nearTown(x, z) : stillwoodLand(x, z)) ||
      others.some((e) => e.hp > 0 && Math.hypot(x - e.x, z - e.z) < 8) ||
      players.some((p) => Math.hypot(x - p.x, z - p.z) < 12) ||
      (!anchored && old && Math.hypot(x - old.x, z - old.z) < 18)
    )
      continue;
    return { x, z };
  }
  return anchored ? { x: old.anchorX, z: old.anchorZ } : null;
}
// Picks a spread-out home for each creature inside its zone.
function zoneAnchors(random, zone, count) {
  const out = [];
  for (let tries = 0; out.length < count && tries < count * 400; tries++) {
    const r = zone === "stillwood" ? 108 + random() * 140 : 280 + random() * 560,
      a = random() * Math.PI * 2,
      x = Math.cos(a) * r,
      z = Math.sin(a) * r;
    if (zoneAt(x, z) !== zone || !dryLand(x, z) || nearTown(x, z)) continue;
    if (out.some((o) => Math.hypot(o.x - x, o.z - z) < (zone === "stillwood" ? 16 : 26))) continue;
    out.push({ x, z });
  }
  return out;
}
const finite = (o) => o && Number.isFinite(o.x) && Number.isFinite(o.z);
export function createMonsters(random, saved = [], now = Date.now()) {
  const starter = [
      [-9, -8],
      [15, -8],
      [-18, 5],
      [17, 15],
    ],
    nodes = [];
  for (let i = 0; i < MONSTER_RESPAWN.count; i++) {
    const cellIndex = ((i - 4) * 11 + 60) % 30,
      cell =
        i < 4
          ? { x: starter[i][0], z: starter[i][1] }
          : {
              x: -65 + (cellIndex % 6) * 26,
              z: -65 + Math.floor(cellIndex / 6) * 30,
            };
    const pos = monsterPosition(random, nodes, [], null, cell);
    if (!pos) throw Error("Could not place a wilderness encounter.");
    const old = saved.find((e) => e.id === `bramble-${i}`),
      valid = finite(old) && Math.abs(old.x) < STILLWOOD_LIMIT && Math.abs(old.z) < STILLWOOD_LIMIT;
    const e = {
      id: `bramble-${i}`,
      name: i % 3 === 0 ? "Brambleling" : i % 3 === 1 ? "Mossback prowler" : "Thornhide",
      ...pos,
      homeX: pos.x,
      homeZ: pos.z,
      hp: 0,
      respawnAt: i < 24 ? 0 : now + 15000 + Math.floor(random() * 45000),
      lastAttack: 0,
      contributors: new Set(),
      threat: new Map(),
    };
    applyLevel(e);
    if (i < 24) e.hp = e.maxHp;
    if (valid) {
      Object.assign(e, { x: old.x, z: old.z, homeX: old.homeX ?? old.x, homeZ: old.homeZ ?? old.z, respawnAt: old.respawnAt });
      applyLevel(e);
      e.hp = Math.max(0, Math.min(e.maxHp, old.hp));
    } else if (old?.hp === 0) {
      e.hp = 0;
      e.respawnAt = old.respawnAt;
    }
    nodes.push(e);
  }
  // The wider world.
  for (const [zone, count] of Object.entries(ZONE_POPULATION)) {
    const savedZone = saved.filter((e) => String(e.id).startsWith(`wild-${zone}-`)),
      reuse = savedZone.length === count && savedZone.every((e) => finite({ x: e.anchorX, z: e.anchorZ })),
      fresh = reuse ? null : zoneAnchors(random, zone, count);
    for (let i = 0; i < count; i++) {
      const id = `wild-${zone}-${i}`,
        old = savedZone.find((e) => e.id === id),
        anchor = fresh ? fresh[i] : { x: old.anchorX, z: old.anchorZ };
      if (!anchor) break;
      const e = {
        id,
        x: anchor.x,
        z: anchor.z,
        homeX: anchor.x,
        homeZ: anchor.z,
        anchorX: anchor.x,
        anchorZ: anchor.z,
        hp: 0,
        respawnAt: 0,
        lastAttack: 0,
        contributors: new Set(),
        threat: new Map(),
      };
      applyLevel(e);
      e.hp = e.maxHp;
      if (reuse && finite(old)) {
        Object.assign(e, { x: old.x, z: old.z, homeX: old.homeX ?? old.x, homeZ: old.homeZ ?? old.z, respawnAt: old.respawnAt ?? 0 });
        applyLevel(e);
        e.hp = Math.max(0, Math.min(e.maxHp, old.hp ?? e.maxHp));
      }
      nodes.push(e);
    }
  }
  return nodes;
}
