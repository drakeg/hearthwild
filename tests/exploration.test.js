import { ZONE_POPULATION } from "../server/wilderness.js";
import test from "node:test";
import assert from "node:assert/strict";
import { World } from "../server/world.js";
import { WORLD_LIMIT, inCamp } from "../public/world-config.js";
import { movementVector, facingAngle } from "../public/controls.js";
const rng = () => {
  let s = 72;
  return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
};
test("expanded wilderness distributes monsters widely and persists their random spawn schedule and locations", () => {
  const w = new World({}, { random: rng() }),
    starters = w.enemies.filter((e) => e.id.startsWith("bramble-")),
    live = starters.filter((e) => e.hp > 0);
  assert.equal(starters.length, 32, "the Stillwood keeps its 32 starter creatures");
  assert.equal(w.enemies.length - starters.length, Object.values(ZONE_POPULATION).reduce((a, b) => a + b), "plus the wider world");
  assert.ok(
    Math.max(...live.map((e) => e.x)) - Math.min(...live.map((e) => e.x)) > 100,
  );
  assert.ok(
    Math.max(...live.map((e) => e.z)) - Math.min(...live.map((e) => e.z)) > 100,
  );
  for (const e of w.enemies) {
    assert.ok(Math.abs(e.x) < WORLD_LIMIT && Math.abs(e.z) < WORLD_LIMIT);
    assert.ok(!inCamp(e));
  }
  const a = w.join({ name: "Ranger", faction: "dawnward" }),
    p = w.players.get(a.id),
    e = w.enemies[0],
    old = { x: e.x, z: e.z };
  p.x = e.x;
  p.z = e.z;
  e.hp = 20;
  w.act(a.token, { type: "attack", target: e.id }, 1000);
  assert.ok(e.respawnAt >= 46000 && e.respawnAt <= 181000);
  const saved = new World(w.save());
  assert.equal(saved.enemies[0].respawnAt, e.respawnAt);
  assert.equal(saved.enemies[0].x, e.x);
  p.x = 0;
  p.z = 12;
  w.tick(0, e.respawnAt + 1);
  assert.equal(e.hp, e.maxHp);
  assert.ok(Math.hypot(e.x - old.x, e.z - old.z) >= 18);
  assert.ok(Math.hypot(e.x - p.x, e.z - p.z) >= 12);
});
test("movement follows camera heading with normalized diagonals and attack facing points at its target", () => {
  const v = movementVector(0, -1, Math.PI / 2);
  assert.ok(Math.abs(v.x + 1) < 1e-9);
  assert.ok(Math.abs(v.z) < 1e-9);
  const d = movementVector(1, -1, 0);
  assert.ok(Math.abs(Math.hypot(d.x, d.z) - 1) < 1e-9);
  assert.equal(facingAngle({ x: 0, z: 0 }, { x: 1, z: 0 }), Math.PI / 2);
});

test("movement reaches the expanded boundary and leaving clears input and online presence", () => {
  const w = new World(),
    a = w.join({ name: "Explorer", faction: "dawnward" }),
    b = w.join({ name: "Watcher", faction: "dawnward" }),
    p = w.players.get(a.id);
  p.x = WORLD_LIMIT - 0.1;
  p.z = -WORLD_LIMIT + 0.1;
  w.act(a.token, { type: "input", x: 1, z: -1 }, 1000);
  w.tick(0.1, 1100);
  assert.equal(p.x, WORLD_LIMIT);
  assert.equal(p.z, -WORLD_LIMIT);
  p.x = 0;
  p.z = 12;
  w.act(a.token, { type: "leave" }, 1200);
  assert.deepEqual(p.input, { x: 0, z: 0 });
  assert.ok(!w.state(b.token, 0, 1201).players.some((x) => x.id === a.id));
});

test("first-person attack heading puts the target directly ahead of camera-relative movement", () => {
  const from = { x: 0, z: 0 },
    target = { x: 8, z: -6 },
    yaw = facingAngle(from, target) + Math.PI,
    v = movementVector(0, -1, yaw);
  assert.ok(Math.abs(v.x - 0.8) < 1e-9);
  assert.ok(Math.abs(v.z + 0.6) < 1e-9);
});
