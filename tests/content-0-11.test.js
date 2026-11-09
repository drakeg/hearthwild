import test from "node:test";
import assert from "node:assert/strict";
import { World } from "../server/world.js";
import { ITEMS, QUESTS, ABILITIES, NPCS } from "../server/content.js";
import { TOWNS } from "../public/terrain.js";
import { route, STOPS } from "../server/travel.js";

let seed = 11;
const rng = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
const make = () => new World({}, { random: rng, combatRandom: () => 0.99 });
const hero = (w, classId = "warrior", name = "Tester") => {
  const a = w.join({ name, faction: "dawnward", classId }),
    p = w.players.get(a.id);
  p.seen = 1000;
  return { a, p, act: (x, now = 2000) => w.act(a.token, x, now) };
};
const near = (p, o) => ((p.x = o.x + 1), (p.z = o.z));
const kill = (w, h, e, now) => {
  near(h.p, e);
  e.hp = 1;
  h.p.globalReadyAt = 0;
  h.p.cooldowns = {};
  h.act({ type: "ability", ability: ABILITIES[h.p.classId][0].id, target: e.id }, now);
};

test("every zone has two tiers of gear with level requirements, and creatures drop gear near their level", () => {
  for (const zone of ["downs", "marsh", "frost", "crags"]) {
    const items = Object.values(ITEMS).filter((i) => i.zone === zone);
    assert.equal(items.length, 6, `${zone} has six pieces`);
    for (const slot of ["weapon", "chest", "charm"]) assert.equal(items.filter((i) => i.slot === slot).length, 2);
  }
  const w = make(),
    h = hero(w);
  const blade = Object.keys(ITEMS).find((k) => ITEMS[k].zone === "crags" && ITEMS[k].slot === "weapon");
  h.p.inventory.push({ id: "x1", template: blade });
  assert.throws(() => h.act({ type: "equip", item: "x1" }), /Requires level 1[5-8]/);
  h.p.level = 18;
  h.act({ type: "equip", item: "x1" });
  // A level-15 creature drops crags-tier gear, never Stillwood starter gear.
  const e = { level: 16 };
  for (let i = 0; i < 300; i++) {
    const t = w.rollLoot(e);
    if (t && ITEMS[t].slot !== "consumable") assert.ok(ITEMS[t].level >= 11 && ITEMS[t].level <= 16, `${t} level ${ITEMS[t].level}`);
  }
});

test("each class learns abilities at levels 6, 10, 14 and 18 on keys 9 to 12", () => {
  for (const [classId, list] of Object.entries(ABILITIES)) {
    const late = list.filter((a) => a.key >= 9);
    assert.deepEqual(late.map((a) => a.level), [6, 10, 14, 18], classId);
    assert.deepEqual(late.map((a) => a.key), [9, 10, 11, 12]);
  }
});

test("shields absorb damage, damage over time ticks, stuns stop a creature, bosses shrug off stuns", () => {
  const w = make(),
    h = hero(w, "warrior");
  h.p.level = 14;
  h.p.power = 100;
  h.act({ type: "ability", ability: "shield-wall" }, 1000);
  assert.ok(h.p.shield.amount > 100);
  const before = h.p.hp;
  w.hurtPlayer(h.p, 50, 1100, null, "test");
  assert.equal(h.p.hp, before, "the shield soaked the hit");
  // Stun.
  const e = w.enemies.find((x) => x.id.startsWith("wild-downs-"));
  near(h.p, e);
  h.p.globalReadyAt = 0;
  h.p.power = 100;
  h.act({ type: "ability", ability: "thunder-slam", target: e.id }, 5000);
  assert.ok(e.stunnedUntil > 5000);
  const swingAt = e.lastAttack;
  for (let t = 5050; t < 7500; t += 50) w.tick(0.05, t);
  assert.equal(e.lastAttack, swingAt, "a stunned creature doesn't swing");
  // Damage over time.
  const lock = hero(w, "warlock", "Hexer");
  lock.p.level = 6;
  const f = w.enemies.find((x) => x.id.startsWith("wild-marsh-"));
  near(lock.p, f);
  f.hp = f.maxHp = 9999;
  lock.p.hp = 99999;
  lock.act({ type: "ability", ability: "wither", target: f.id }, 10000);
  for (let t = 10050; t < 22500; t += 50) {
    lock.p.seen = t;
    h.p.seen = t;
    w.tick(0.05, t);
  }
  assert.ok(9999 - f.hp >= 6 * 8, `wither ticked six times (${9999 - f.hp})`);
});

test("towns offer quest chains: collect drops, kill a kind, and deliver letters between towns", () => {
  for (const t of TOWNS) assert.ok(NPCS.filter((n) => n.town === t.id && n.quest).length >= 4, `${t.name} has four quest givers`);
  const w = make(),
    h = hero(w);
  h.p.level = 9;
  // A chained quest stays locked until its predecessor is done.
  const hunter = NPCS.find((n) => n.id === "harrowford-hunter");
  near(h.p, hunter);
  assert.ok(h.act({ type: "talk", target: hunter.id }).locked);
  assert.throws(() => h.act({ type: "quest", quest: "bristle-tusks", operation: "accept" }), /Trouble on the Downs/);
  // Collect quests count drops from the right creatures only.
  const farmer = NPCS.find((n) => n.id === "harrowford-farmer");
  near(h.p, farmer);
  h.act({ type: "talk", target: farmer.id });
  h.act({ type: "quest", quest: "seed-grain", operation: "accept" });
  const bandit = w.enemies.find((e) => e.kind === "harrow-bandit"),
    hound = w.enemies.find((e) => e.kind === "gorse-hound");
  for (let i = 0; i < 30 && h.p.quests["seed-grain"].status === "active"; i++) kill(w, h, bandit, 10000 + i * 3000);
  assert.equal(h.p.quests["seed-grain"].status, "ready");
  const p0 = h.p.quests["seed-grain"].progress;
  kill(w, h, hound, 200000);
  assert.equal(h.p.quests["seed-grain"].progress, p0);
  // Deliveries: accept in Harrowford, hand in at Reedwatch.
  const courier = NPCS.find((n) => n.id === "harrowford-courier"),
    fen = NPCS.find((n) => n.id === "reedwatch-quest");
  near(h.p, courier);
  h.act({ type: "talk", target: courier.id });
  h.act({ type: "quest", quest: "letter-reedwatch", operation: "accept" });
  assert.throws(() => h.act({ type: "quest", quest: "letter-reedwatch", operation: "complete" }), /closer/);
  near(h.p, fen);
  const talk = h.act({ type: "talk", target: fen.id });
  assert.deepEqual(talk.deliveries.map((d) => d.id), ["letter-reedwatch"]);
  const coins = h.p.coins;
  h.act({ type: "quest", quest: "letter-reedwatch", operation: "complete" });
  assert.equal(h.p.quests["letter-reedwatch"].status, "complete");
  assert.equal(h.p.coins, coins + QUESTS["letter-reedwatch"].reward);
});

test("riding: learn at level 10 from a stablemaster, ride faster, dismount when hit", () => {
  const w = make(),
    h = hero(w);
  const stable = NPCS.find((n) => n.id === "camp-stable");
  near(h.p, stable);
  h.act({ type: "talk", target: stable.id });
  assert.throws(() => h.act({ type: "riding" }), /level 10/);
  h.p.level = 10;
  h.p.coins = 60;
  h.act({ type: "riding" });
  assert.equal(h.p.coins, 10);
  h.act({ type: "mount" });
  assert.ok(h.p.mounted);
  h.p.x = 300;
  h.p.z = 300;
  h.act({ type: "input", x: 1, z: 0 }, 3000);
  for (let t = 3050; t <= 4000; t += 50) {
    h.p.inputAt = t;
    w.tick(0.05, t);
  }
  assert.ok(h.p.x - 300 > 7, `mounted speed (${(h.p.x - 300).toFixed(1)} m in 1 s)`);
  w.hurtPlayer(h.p, 5, 4100, null, "test");
  assert.equal(h.p.mounted, false);
  assert.ok(w.save().players[0].riding, "riding is saved");
});

test("caravans run along the roads to towns you have found; the waystone brings you home", () => {
  for (const a of STOPS) for (const b of STOPS) if (a !== b) assert.ok(route(a.id, b.id), `${a.id} → ${b.id}`);
  const w = make(),
    h = hero(w);
  const master = NPCS.find((n) => n.id === "camp-caravan");
  near(h.p, master);
  h.p.coins = 100;
  h.act({ type: "talk", target: master.id });
  assert.throws(() => h.act({ type: "travel", to: "harrowford" }), /haven’t found/);
  h.p.explored.push("Harrowford");
  h.act({ type: "travel", to: "harrowford" });
  assert.ok(h.p.travel);
  for (let t = 2050; t < 50000 && h.p.travel; t += 100) {
    h.p.seen = t;
    w.tick(0.1, t);
  }
  const town = TOWNS.find((t) => t.id === "harrowford");
  assert.ok(!h.p.travel && Math.hypot(h.p.x - town.x, h.p.z - town.z) < 3, "arrived in Harrowford");
  // Make Harrowford home, walk away, then use the waystone.
  const shop = NPCS.find((n) => n.id === "harrowford-shop");
  near(h.p, shop);
  h.act({ type: "talk", target: shop.id }, 60000);
  h.act({ type: "home" }, 60000);
  h.p.x = 0;
  h.p.z = 300;
  h.act({ type: "waystone" }, 61000);
  h.act({ type: "input", x: 1, z: 0 }, 62000);
  assert.equal(h.p.recall, null, "moving breaks the waystone");
  h.act({ type: "input", x: 0, z: 0 }, 62500);
  h.act({ type: "waystone" }, 63000);
  for (let t = 63100; t <= 73500; t += 100) {
    h.p.seen = t;
    w.tick(0.1, t);
  }
  assert.ok(Math.hypot(h.p.x - town.x, h.p.z - town.z) < 12, "home in Harrowford");
  assert.throws(() => h.act({ type: "waystone" }, 74000), /recharging/);
});
