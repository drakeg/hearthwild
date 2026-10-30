import test from "node:test";
import assert from "node:assert/strict";
import { World } from "../server/world.js";
const setup = () => {
  const w = new World({}, { combatRandom: () => 0.99 }),
    a = w.join({ name: "Hero", faction: "dawnward" });
  return { w, a, p: w.players.get(a.id) };
};
const move = (p, o) => {
  p.x = o.x;
  p.z = o.z;
};
test("quests require a local NPC conversation, acceptance, objectives and a single turn-in", () => {
  const { w, a, p } = setup(),
    npc = w.npcs[0];
  move(p, npc);
  assert.equal(
    w.act(a.token, { type: "talk", target: npc.id }, 1000).npc.name,
    "Warden Elowen",
  );
  w.act(
    a.token,
    { type: "quest", quest: "wildgrowth", operation: "accept" },
    1001,
  );
  for (let i = 0; i < 3; i++) {
    const e = w.enemies[i];
    move(p, e);
    e.hp = 20;
    w.act(a.token, { type: "attack", target: e.id }, 2000 + i * 1500);
  }
  assert.equal(p.quests.wildgrowth.status, "ready");
  assert.equal(p.coins, 0);
  assert.throws(
    () =>
      w.act(
        a.token,
        { type: "quest", quest: "wildgrowth", operation: "complete" },
        6000,
      ),
    /closer/,
  );
  move(p, npc);
  w.act(
    a.token,
    { type: "quest", quest: "wildgrowth", operation: "complete" },
    7000,
  );
  assert.equal(p.coins, 30);
  assert.equal(p.quests.wildgrowth.status, "complete");
  assert.throws(() =>
    w.act(
      a.token,
      { type: "quest", quest: "wildgrowth", operation: "complete" },
      7001,
    ),
  );
});
test("all quest requirements have enough local renewable targets, and gathering must happen in reach", () => {
  const { w, a, p } = setup();
  assert.ok(w.enemies.length >= 3);
  assert.ok(w.resources.length >= 4);
  // Starter content stays inside the original Stillwood clearing.
  for (const o of [...w.npcs.filter((n) => !n.town), ...w.resources, ...w.enemies.filter((e) => e.id.startsWith("bramble-"))])
    assert.ok(Math.abs(o.x) < 79 && Math.abs(o.z) < 79);
  move(p, w.npcs[1]);
  w.act(a.token, { type: "talk", target: w.npcs[1].id }, 1000);
  w.act(
    a.token,
    { type: "quest", quest: "starleaf", operation: "accept" },
    1001,
  );
  assert.throws(
    () =>
      w.act(a.token, { type: "gather", target: w.resources.at(-1).id }, 1100),
    /closer/,
  );
  for (let i = 0; i < 4; i++) {
    move(p, w.resources[i]);
    w.act(
      a.token,
      { type: "gather", target: w.resources[i].id },
      2000 + i * 1000,
    );
  }
  assert.equal(p.quests.starleaf.status, "ready");
  assert.equal(p.materials.starleaf, 4);
  move(p, w.npcs[1]);
  w.act(
    a.token,
    { type: "quest", quest: "starleaf", operation: "complete" },
    7000,
  );
  assert.equal(p.materials.starleaf, 0);
});
test("enemy loot belongs to its contributor, requires proximity, and equipped gear raises real stats", () => {
  const { w, a, p } = setup(),
    b = w.join({ name: "Other", faction: "dawnward" }),
    e = w.enemies[0];
  move(p, e);
  e.hp = 20;
  w.act(a.token, { type: "attack", target: e.id }, 1000);
  const drop = w.state(a.token, 0, 1100).loot[0];
  assert.ok(drop.items.length);
  assert.equal(w.state(b.token, 0, 1100).loot.length, 0);
  assert.throws(() => w.act(b.token, { type: "loot", target: drop.id }, 1200));
  p.x = 28;
  assert.throws(
    () => w.act(a.token, { type: "loot", target: drop.id }, 1300),
    /closer/,
  );
  move(p, drop);
  const before = w.state(a.token, 0, 1400).self.stats;
  w.act(a.token, { type: "loot", target: drop.id }, 1400);
  assert.equal(p.coins, 10);
  const gear = p.inventory[0];
  w.act(a.token, { type: "equip", item: gear.id }, 1500);
  assert.ok(w.state(a.token, 0, 1600).self.stats.damage > before.damage);
  assert.throws(() => w.act(a.token, { type: "loot", target: drop.id }, 1601));
  const restored = new World(w.save());
  assert.equal(restored.state(a.token, 0, 1700).self.stats.damage, 28);
  assert.throws(() =>
    w.act(a.token, { type: "equip", item: "forged", damage: 9999 }, 1800),
  );
});

test("the NPC camp is safe for conversations and restores health", () => {
  const w = new World(),
    a = w.join({ name: "Campguest", faction: "dawnward" }),
    p = w.players.get(a.id);
  p.hp = 40;
  const e = w.enemies[0];
  e.x = p.x;
  e.z = p.z;
  w.tick(0.1, 1000);
  assert.ok(p.hp > 40);
});
