import test from "node:test";
import assert from "node:assert/strict";
import { World } from "../server/world.js";
import { slotsUsed } from "../server/commerce.js";

const setup = (classId = "druid") => {
  const w = new World({}, { combatRandom: () => 0.99 }),
    a = w.join({ name: "Hungry", faction: "dawnward", classId }),
    p = w.players.get(a.id);
  for (const e of w.enemies) (e.hp = 0), (e.respawnAt = Infinity);
  return { w, a, p };
};

test("bread restores health over time while sitting, and moving stops eating", () => {
  const { w, a, p } = setup();
  p.x = 30;
  p.z = 30;
  p.hp = 20;
  p.inventory.push({ id: "b1", template: "travelers-bread" }, { id: "b2", template: "travelers-bread" });
  w.act(a.token, { type: "consume", item: "b1" }, 1000);
  assert.ok(p.eating);
  assert.equal(p.inventory.length, 1);
  assert.equal(w.state(a.token, 0, 1000).self.eating.kind, "food");
  const before = p.hp;
  for (let t = 1100; t <= 4000; t += 100) w.tick(0.1, t);
  assert.ok(p.hp > before + 10, "health rises while eating");
  w.act(a.token, { type: "input", x: 1, z: 0 }, 4100);
  assert.equal(p.eating, null);
});

test("water restores mana; nobody can eat or drink in combat", () => {
  const { w, a, p } = setup("warlock");
  p.x = 30;
  p.z = 30;
  p.power = 10;
  p.inventory.push({ id: "w1", template: "spring-water" }, { id: "w2", template: "spring-water" });
  w.act(a.token, { type: "consume", item: "w1" }, 1000);
  for (let t = 1100; t <= 10000; t += 100) w.tick(0.1, t);
  assert.ok(p.power > 40);
  p.combatUntil = 20000;
  assert.throws(() => w.act(a.token, { type: "consume", item: "w2" }, 15000), /combat/);
});

test("consumables stack twenty to a bag slot", () => {
  const p = { inventory: [] };
  for (let i = 0; i < 25; i++) p.inventory.push({ template: "healing-draught" });
  p.inventory.push({ template: "warden-blade" });
  assert.equal(slotsUsed(p), 3);
});
