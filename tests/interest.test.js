import test from "node:test";
import assert from "node:assert/strict";
import { World } from "../server/world.js";
import { Grid, VIEW } from "../server/interest.js";
import { zoneBounds } from "../public/ui-model.js";
import { ZONES, TOWNS } from "../public/terrain.js";

const make = () => new World({}, { combatRandom: () => 0.99 });
const hero = (w, name = "Scout") => {
  const a = w.join({ name, faction: "dawnward", classId: "warrior" }),
    p = w.players.get(a.id);
  p.seen = 1000;
  return { a, p };
};

test("the grid finds what is near and nothing farther", () => {
  const g = new Grid(100).build([{ x: 0, z: 0 }, { x: 150, z: 0 }, { x: -260, z: 40 }, { x: 99, z: 99 }]);
  assert.equal(g.near(0, 0, 160).length, 3);
  assert.equal(g.near(-250, 40, 20).length, 1);
  assert.ok(g.any(140, 0, 15));
  assert.ok(!g.any(500, 500, 100));
});

test("updates carry only what is nearby, and unchanging content only once", () => {
  const w = make(),
    { a, p } = hero(w);
  const first = w.state(a.token, 0, 1000);
  assert.ok(first.shop && first.questDefinitions && first.npcs && first.abilities, "first update has everything");
  const next = w.state(a.token, 0, 1100, first.content);
  for (const k of ["shop", "recipes", "classes", "abilities", "questDefinitions", "npcs"]) assert.equal(next[k], undefined, `${k} not resent`);
  assert.ok(next.self && next.enemies);
  // A new server build or a different class gets a fresh copy.
  assert.ok(w.state(a.token, 0, 1200, "000000000000:warrior").shop);
  // Far out in the Amber Downs, nothing from the Stillwood comes along.
  Object.assign(p, { x: 600, z: 200 });
  const far = w.state(a.token, 0, 1300, first.content);
  assert.ok(far.enemies.every((e) => Math.hypot(e.x - p.x, e.z - p.z) < VIEW.enemies));
  assert.ok(far.resources.every((r) => Math.hypot(r.x - p.x, r.z - p.z) < VIEW.resources));
  assert.ok(far.enemies.length > 0, "the Downs creatures nearby are shared");
});

test("other adventurers are seen from much farther than before", () => {
  const w = make(),
    { a, p } = hero(w, "Watcher"),
    { p: q } = hero(w, "Wanderer");
  Object.assign(p, { x: 500, z: 100 });
  Object.assign(q, { x: 590, z: 100 });
  assert.ok(w.state(a.token, 0, 1000).players.some((o) => o.id === q.id));
});

test("creatures far from everyone sleep; creatures near a player wake", () => {
  const w = make(),
    { p } = hero(w);
  Object.assign(p, { x: 600, z: 200 });
  const near = w.enemies.find((e) => e.hp > 0 && Math.hypot(e.x - p.x, e.z - p.z) < 150),
    far = w.enemies.find((e) => e.hp > 0 && Math.hypot(e.x - p.x, e.z - p.z) > 600);
  assert.ok(near && far);
  // Both nudged off home: the sleeper stays put, the one near the player walks back.
  far.x += 3;
  near.x += 3;
  const farX = far.x,
    nearX = near.x;
  for (let t = 0; t < 30; t++) w.tick(0.1, 1000 + t * 100);
  assert.equal(far.x, farX);
  assert.notEqual(near.x, nearX);
});

test("every zone has a map view around its heart, inside the world", () => {
  const b = zoneBounds();
  for (const id of Object.keys(ZONES)) {
    const z = b[id];
    assert.ok(z && z.span >= 500 && z.span <= 1100, id);
    for (const t of TOWNS.filter((t) => t.zone === id))
      assert.ok(t.x > z.originX && t.x < z.originX + z.span && t.z > z.originZ && t.z < z.originZ + z.span, `${t.name} on the ${id} map`);
  }
});
