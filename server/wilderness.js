import { dryLand, WORLD_LIMIT } from "../public/world-config.js";
import { applyLevel } from "./combat.js";
export const MONSTER_RESPAWN = { min: 45000, max: 180000, count: 32 };
export const monsterDelay = (random) =>
  MONSTER_RESPAWN.min +
  Math.floor(random() * (MONSTER_RESPAWN.max - MONSTER_RESPAWN.min + 1));
export function monsterPosition(
  random,
  others = [],
  players = [],
  old = null,
  cell = null,
) {
  for (let i = 0; i < 300; i++) {
    const x =
        cell && i < 60
          ? cell.x + (random() - 0.5) * 10
          : (random() - 0.5) * (WORLD_LIMIT - 3) * 2,
      z =
        cell && i < 60
          ? cell.z + (random() - 0.5) * 10
          : (random() - 0.5) * (WORLD_LIMIT - 3) * 2;
    if (
      !dryLand(x, z) ||
      others.some((e) => e.hp > 0 && Math.hypot(x - e.x, z - e.z) < 8) ||
      players.some((p) => Math.hypot(x - p.x, z - p.z) < 12) ||
      (old && Math.hypot(x - old.x, z - old.z) < 18)
    )
      continue;
    return { x, z };
  }
  return null;
}
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
      valid =
        old &&
        Number.isFinite(old.x) &&
        Number.isFinite(old.z) &&
        Math.abs(old.x) < WORLD_LIMIT &&
        Math.abs(old.z) < WORLD_LIMIT;
    const e = {
      id: `bramble-${i}`,
      name:
        i % 3 === 0
          ? "Brambleling"
          : i % 3 === 1
            ? "Mossback prowler"
            : "Thornhide",
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
    if (valid)
      Object.assign(e, {
        x: old.x,
        z: old.z,
        homeX: old.homeX ?? old.x,
        homeZ: old.homeZ ?? old.z,
        respawnAt: old.respawnAt,
      });
    if (valid) {
      applyLevel(e);
      e.hp = Math.max(0, Math.min(e.maxHp, old.hp));
    }
    else if (old?.hp === 0) {
      e.hp = 0;
      e.respawnAt = old.respawnAt;
    }
    nodes.push(e);
  }
  return nodes;
}
