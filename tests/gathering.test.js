import { WORLD_LIMIT } from "../public/world-config.js";
import test from "node:test";
import assert from "node:assert/strict";
import { World } from "../server/world.js";
import { bagItems, questMarker } from "../public/ui-model.js";
import { pointerIsClick, pickWorldTarget } from "../public/controls.js";
const seeded = () => {
  let s = 17;
  return () => (s = (1664525 * s + 1013904223) >>> 0) / 4294967296;
};
test("small hand motion remains a click and a plant mesh wins over an overlapping NPC label", () => {
  assert.ok(pointerIsClick({ x: 20, y: 30 }, { x: 23, y: 32 }));
  assert.ok(!pointerIsClick({ x: 20, y: 30 }, { x: 30, y: 30 }));
  const npc = {
      userData: { interaction: { type: "talk", target: "herbalist" } },
    },
    plant = { userData: { interaction: { type: "gather", target: "herb" } } };
  const hits = [
    { object: { isSprite: true, parent: npc } },
    { object: { parent: plant } },
  ];
  assert.equal(pickWorldTarget(hits), plant);
});
test("gathered starleaf appears as one searchable bag stack without becoming wearable gear", () => {
  const items = bagItems([], { starleaf: 3 });
  assert.equal(items[0].name, "Starleaf");
  assert.equal(items[0].count, 3);
  assert.equal(items[0].slot, "reagent");
  assert.equal(bagItems([], { starleaf: 0 }).length, 0);
  assert.equal(questMarker("ready").symbol, "?");
  assert.match(questMarker("ready").label, /Ready for turn-in/);
  assert.equal(questMarker("complete").symbol, "");
});
test("starleaf has broad random placement, staggered respawn deadlines, relocation and persisted depletion", () => {
  const w = new World({}, { random: seeded() }),
    a = w.join({ name: "Gatherer", faction: "dawnward" }),
    p = w.players.get(a.id);
  assert.equal(w.resources.length, 32);
  assert.ok(
    Math.max(...w.resources.map((r) => r.x)) -
      Math.min(...w.resources.map((r) => r.x)) >
      40,
  );
  assert.ok(
    Math.max(...w.resources.map((r) => r.z)) -
      Math.min(...w.resources.map((r) => r.z)) >
      40,
  );
  for (const r of w.resources) {
    assert.ok(Math.abs(r.x) <= WORLD_LIMIT && Math.abs(r.z) <= WORLD_LIMIT);
    assert.ok(Math.hypot(r.x + 16, r.z + 12) > 7);
  }
  const deadlines = [];
  for (const r of w.resources.slice(0, 4)) {
    p.x = r.x;
    p.z = r.z;
    w.act(a.token, { type: "gather", target: r.id }, 1000);
    assert.ok(r.readyAt >= 31000 && r.readyAt <= 91000);
    deadlines.push(r.readyAt);
    assert.equal(
      w.state(a.token, 0, 1001).resources.find((x) => x.id === r.id).available,
      false,
    );
  }
  assert.ok(new Set(deadlines).size > 1);
  const r = w.resources[0],
    old = { x: r.x, z: r.z };
  const restored = new World(w.save(), { random: seeded() });
  assert.equal(restored.resources[0].readyAt, r.readyAt);
  assert.equal(restored.state(a.token, 0, 1002).resources[0].available, false);
  p.x = 0;
  p.z = 12;
  w.tick(0, 100000);
  assert.ok(Math.hypot(r.x - old.x, r.z - old.z) >= 8);
  assert.equal(w.state(a.token, 0, 100000).resources[0].available, true);
});
test("four gathered sprigs credit the accepted quest, survive restart and are consumed only at turn-in", () => {
  const w = new World(),
    a = w.join({ name: "Herbalist", faction: "dawnward" }),
    p = w.players.get(a.id),
    npc = w.npcs[1];
  p.x = npc.x;
  p.z = npc.z;
  w.act(a.token, { type: "talk", target: npc.id }, 1000);
  w.act(
    a.token,
    { type: "quest", quest: "starleaf", operation: "accept" },
    1001,
  );
  for (const r of w.resources.slice(0, 4)) {
    p.x = r.x;
    p.z = r.z;
    w.act(a.token, { type: "gather", target: r.id }, 2000);
    assert.throws(
      () => w.act(a.token, { type: "gather", target: r.id }, 2001),
      /regrowing/,
    );
  }
  const restored = new World(w.save());
  const s = restored.state(a.token, 0, 3000);
  assert.equal(s.self.materials.starleaf, 4);
  assert.equal(s.self.quests.starleaf.progress, 4);
  assert.equal(s.self.quests.starleaf.status, "ready");
  assert.equal(bagItems(s.self.inventory, s.self.materials)[0].count, 4);
  const q = restored.players.get(a.id);
  q.x = npc.x;
  q.z = npc.z;
  restored.act(a.token, { type: "talk", target: npc.id }, 3999);
  restored.act(
    a.token,
    { type: "quest", quest: "starleaf", operation: "complete" },
    4000,
  );
  assert.equal(q.materials.starleaf, 0);
  assert.equal(q.quests.starleaf.status, "complete");
});

test("a saved herb pouch restores accurate accepted-quest credit without requiring another pickup", () => {
  const w = new World(),
    a = w.join({ name: "Returning", faction: "dawnward" }),
    p = w.players.get(a.id);
  p.materials.starleaf = 4;
  p.quests.starleaf = { status: "active", progress: 0 };
  const restored = new World(w.save());
  assert.equal(restored.state(a.token).self.quests.starleaf.status, "ready");
  assert.equal(restored.state(a.token).self.quests.starleaf.progress, 4);
});
