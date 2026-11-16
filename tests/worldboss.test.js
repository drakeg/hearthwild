import test from "node:test";
import assert from "node:assert/strict";
import { World } from "../server/world.js";
import { WORLD_BOSS } from "../server/worldboss.js";
import { DUNGEON_LOOT } from "../server/content-world.js";
import { ITEMS } from "../server/content.js";
import { zoneAt } from "../public/terrain.js";

const make = () => new World({}, { combatRandom: () => 0.99 });
let n = 0;
const hero = (w, classId = "warrior") => {
  const a = w.join({ name: `Giantslayer${String.fromCharCode(97 + n++)}`, faction: "dawnward", classId }),
    p = w.players.get(a.id);
  Object.assign(p, { seen: 1000, level: 30, hp: 99999 });
  return { a, p, act: (x, now) => w.act(a.token, x, now) };
};
const online = (w, now) => {
  for (const p of w.players.values()) p.seen = now;
};

test("the colossus wakes in the Outer Ring, tells the world, and wanders", () => {
  const w = make(),
    h = hero(w);
  assert.equal(w.worldBoss.boss, null, "asleep at first");
  w.worldBoss.wakeAt = 1000;
  online(w, 2000);
  w.tick(0.05, 2000);
  const b = w.worldBoss.boss;
  assert.ok(b && w.enemies.includes(b));
  assert.ok(WORLD_BOSS.zones.includes(zoneAt(b.x, b.z)));
  assert.ok(h.p.messages.some((m) => m.text.includes(WORLD_BOSS.name)), "everyone hears it wake");
  assert.equal(w.state(h.a.token, 0, 2000).worldBoss.name, WORLD_BOSS.name, "and sees where it is");
  const start = { x: b.x, z: b.z };
  for (let t = 2100; t < 12000; t += 100) w.tick(0.1, t);
  assert.ok(Math.hypot(b.x - start.x, b.z - start.z) > 5, "it roams");
  assert.deepEqual({ x: b.homeX, z: b.homeZ }, { x: b.x, z: b.z }, "its home walks with it");
});

test("in a fight it stomps a telegraphed ring; standing in it hurts", () => {
  const w = make(),
    h = hero(w);
  w.worldBoss.wakeAt = 0;
  w.tick(0.05, 1000);
  const b = w.worldBoss.boss;
  Object.assign(h.p, { x: b.x + 3, z: b.z });
  online(w, 1000);
  w.addThreat(b, h.p, 10, 1000);
  // Keep the beast from swinging so only the stomp counts.
  b.stunnedUntil = Infinity;
  let now = 1000;
  for (; now < 1000 + WORLD_BOSS.stomp.first + 200; now += 100) {
    online(w, now);
    w.tick(0.1, now);
  }
  const tg = w.state(h.a.token, 0, now).telegraphs;
  assert.equal(tg.length, 1);
  assert.equal(tg[0].name, WORLD_BOSS.stomp.name);
  Object.assign(h.p, { x: tg[0].x + 1, z: tg[0].z, hp: w.maxHp(h.p) });
  const before = h.p.hp;
  for (const end = now + WORLD_BOSS.stomp.delay + 200; now < end; now += 100) {
    online(w, now);
    w.tick(0.1, now);
  }
  assert.ok(h.p.hp <= before - WORLD_BOSS.stomp.damage * 0.5, "the stomp lands");
});

test("everyone who helped earns their own Epic, and it wakes again later", () => {
  const w = make(),
    a = hero(w),
    c = hero(w, "rogue");
  w.worldBoss.wakeAt = 0;
  w.tick(0.05, 1000);
  const b = w.worldBoss.boss;
  for (const h of [a, c]) Object.assign(h.p, { x: b.x + 1.5, z: b.z, power: 100 });
  online(w, 5000);
  b.contributors.add(c.p.id);
  b.hp = 1;
  a.act({ type: "ability", ability: "iron-cut", target: b.id }, 5000);
  assert.equal(b.hp, 0);
  for (const h of [a, c]) {
    const bag = w.loot.find((l) => l.ownerId === h.p.id);
    assert.ok(bag, `${h.p.name} gets loot`);
    assert.ok(DUNGEON_LOOT["world-boss"].includes(bag.items[0].template));
    assert.equal(ITEMS[bag.items[0].template].rarity, "Epic");
    assert.equal(bag.coins, WORLD_BOSS.coins);
  }
  assert.ok(a.p.messages.some((m) => /has fallen/.test(m.text)));
  assert.equal(w.worldBoss.boss, null);
  assert.ok(!w.enemies.includes(b));
  assert.equal(w.worldBoss.wakeAt, 5000 + WORLD_BOSS.respawn);
  // Saving remembers when it wakes, but never stores it among ordinary creatures.
  const saved = w.save();
  assert.equal(saved.worldBoss.wakeAt, 5000 + WORLD_BOSS.respawn);
  assert.ok(!saved.enemies.some((e) => e.id === WORLD_BOSS.id));
});
