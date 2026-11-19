import test from "node:test";
import assert from "node:assert/strict";
import { World } from "../server/world.js";
import { ACHIEVEMENTS, titled } from "../public/achievements.js";
import { DUNGEON_LIST } from "../public/dungeon-layout.js";

const make = () => new World({}, { combatRandom: () => 0.99 });
let n = 0;
const hero = (w, classId = "warrior") => {
  const a = w.join({ name: `Laurel${String.fromCharCode(97 + n++)}`, faction: "dawnward", classId }),
    p = w.players.get(a.id);
  p.seen = 1000;
  return { a, p, act: (x, now = 2000) => w.act(a.token, x, now), self: (now = 2000) => w.state(a.token, 0, now).self };
};
const tick = (w, now) => {
  for (const p of w.players.values()) p.seen = now;
  w.tick(0.05, now);
};

test("every achievement is well formed, and titles read naturally", () => {
  const ids = new Set();
  for (const a of ACHIEVEMENTS) {
    assert.ok(!ids.has(a.id), a.id);
    ids.add(a.id);
    assert.ok(a.name && a.text && a.points > 0 && a.goal > 0 && typeof a.progress === "function", a.id);
  }
  assert.equal(titled("Rowan", "the Wayfarer"), "Rowan the Wayfarer");
  assert.equal(titled("Rowan", "Colossus-Slayer"), "Rowan, Colossus-Slayer");
  assert.equal(titled("Rowan", null), "Rowan");
});

test("achievements are earned once, announced, saved, and unlock titles to wear", () => {
  const w = make(),
    h = hero(w);
  tick(w, 3000);
  assert.deepEqual(Object.keys(h.self(3000).achievements), [], "a new character has none");
  h.p.level = 30;
  tick(w, 5000);
  const got = h.self(5000).achievements;
  for (const id of ["level-10", "level-20", "level-30"]) assert.equal(got[id], 5000, id);
  assert.ok(h.p.messages.some((m) => /Achievement earned: Hero of the Wilds/.test(m.text)));
  const said = h.p.messages.length;
  tick(w, 7000);
  assert.equal(h.p.messages.length, said, "no repeats");
  // Titles: only ones you've earned.
  assert.throws(() => h.act({ type: "title", id: "world-boss" }), /Earn/);
  assert.throws(() => h.act({ type: "title", id: "level-10" }), /isn’t a title/);
  h.act({ type: "title", id: "level-30" });
  assert.equal(h.self(7000).titleId, "level-30", "your window knows which title you wear");
  const other = hero(w);
  Object.assign(other.p, { x: h.p.x + 2, z: h.p.z });
  assert.equal(w.state(other.a.token, 0, 7000).players.find((q) => q.id === h.p.id).title, "the Hero", "others see it");
  h.act({ type: "title" });
  assert.equal(h.p.title, null);
  // Saved with the character.
  const saved = w.save().players.find((q) => q.id === h.p.id);
  assert.ok(saved.achievements["level-30"]);
});

test("dungeon clears, the world boss, trades, mail and crafting all count", () => {
  const w = make(),
    a = hero(w),
    b = hero(w, "rogue");
  // A trade.
  Object.assign(b.p, { x: a.p.x + 1, z: a.p.z });
  a.act({ type: "trade", op: "request", name: b.p.name });
  b.act({ type: "trade", op: "accept" });
  a.act({ type: "trade", op: "confirm" });
  b.act({ type: "trade", op: "confirm" });
  // A dungeon's final boss and the world boss.
  const crypt = DUNGEON_LIST[0];
  a.p.level = 12;
  w.crypts.place(a.p, crypt, 3000);
  const inst = w.crypts.instances.get(a.p.instance);
  Object.assign(a.p, { x: inst.boss.x + 1, z: inst.boss.z, power: 100 });
  inst.boss.hp = 1;
  a.act({ type: "ability", ability: "iron-cut", target: inst.boss.id }, 3500);
  w.crypts.leave(a.p, { door: true });
  w.worldBoss.wakeAt = 0;
  tick(w, 4000);
  const boss = w.worldBoss.boss;
  Object.assign(a.p, { x: boss.x + 1.5, z: boss.z, power: 100, hp: 9999, globalReadyAt: 0, cooldowns: {} });
  boss.hp = 1;
  a.act({ type: "ability", ability: "iron-cut", target: boss.id }, 4500);
  tick(w, 6000);
  const got = a.self(6000).achievements;
  for (const id of ["trade", "first-dungeon", "world-boss"]) assert.ok(got[id], id);
  assert.ok(b.self(6000).achievements.trade, "both traders earn it");
  assert.ok(!got["all-dungeons"]);
  assert.equal(ACHIEVEMENTS.find((x) => x.id === "all-dungeons").progress(a.p), 1);
});
