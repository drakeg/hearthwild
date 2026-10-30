import test from "node:test";
import assert from "node:assert/strict";
import { World } from "../server/world.js";
import { ZONES, TOWNS, HOUSES, GRAVEYARDS, zoneAt, levelAt, terrainHeight, roadDistance, insideHouse } from "../public/terrain.js";
import { subzoneAt, inSanctuary } from "../public/world-config.js";

let seed = 7;
const rng = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
const make = () => new World({}, { random: rng, combatRandom: () => 0.99 });
const hero = (w, name = "Rover") => {
  const a = w.join({ name, faction: "dawnward", classId: "warrior" }),
    p = w.players.get(a.id);
  p.seen = 1000;
  return { a, p };
};

test("the world is two kilometres across with four zones around the Stillwood", () => {
  assert.equal(zoneAt(0, 0), "stillwood");
  assert.equal(zoneAt(600, 0), "downs");
  assert.equal(zoneAt(0, 600), "marsh");
  assert.equal(zoneAt(-600, 0), "crags");
  assert.equal(zoneAt(0, -600), "frost");
  for (const t of TOWNS) assert.equal(zoneAt(t.x, t.z), t.zone, `${t.name} sits in its zone`);
  // Level bands rise from camp outward.
  assert.equal(levelAt(0, 20), 1);
  assert.ok(levelAt(800, 0) >= ZONES.downs.levels[1] - 1);
  assert.ok(levelAt(-800, 0) >= 18);
  // Every town is on a road and flat enough to build on.
  for (const t of TOWNS) {
    assert.ok(roadDistance(t.x, t.z) < t.r, `${t.name} is reachable by road`);
    assert.ok(Math.abs(terrainHeight(t.x + 15, t.z + 10) - terrainHeight(t.x, t.z)) < 0.01);
  }
  assert.equal(subzoneAt(TOWNS[0].x, TOWNS[0].z), TOWNS[0].name);
  assert.equal(subzoneAt(700, 300), "The Amber Downs");
});

test("each zone is populated with its own creatures at its own levels", () => {
  const w = make();
  for (const zone of ["downs", "marsh", "frost", "crags"]) {
    const mobs = w.enemies.filter((e) => e.id.startsWith(`wild-${zone}-`));
    assert.ok(mobs.length >= 40, `${zone} has creatures`);
    const [lo, hi] = ZONES[zone].levels;
    for (const e of mobs) {
      assert.equal(zoneAt(e.x, e.z), zone);
      assert.ok(e.level >= lo - 1 && e.level <= hi, `${e.name} level ${e.level} in ${zone}`);
    }
    assert.ok(new Set(mobs.map((e) => e.kind)).size >= 3, `${zone} has variety`);
  }
});

test("houses block movement; towns are sanctuaries", () => {
  const w = make(),
    { a, p } = hero(w),
    h = HOUSES[0];
  assert.ok(insideHouse(h.x, h.z));
  // Walk straight at the house from the town square.
  const t = TOWNS.find((t) => t.id === h.town);
  p.x = t.x;
  p.z = t.z;
  const dx = h.x - t.x,
    dz = h.z - t.z,
    len = Math.hypot(dx, dz);
  w.act(a.token, { type: "input", x: dx / len, z: dz / len }, 1000);
  for (let now = 1050; now < 9000; now += 50) {
    p.inputAt = now;
    w.tick(0.05, now);
  }
  assert.ok(!insideHouse(p.x, p.z, 0.3), "the player stops at the wall");
  assert.ok(inSanctuary({ x: t.x, z: t.z }));
  assert.ok(!inSanctuary({ x: t.x + 200, z: t.z }));
});

test("released spirits return to the nearest graveyard", () => {
  const w = make(),
    { a, p } = hero(w),
    town = TOWNS.find((t) => t.id === "cragmoor");
  p.x = town.x + 60;
  p.z = town.z + 40;
  w.killPlayer(p, 1000);
  const r = w.act(a.token, { type: "release" }, 2000);
  assert.match(r.message, /Cragmoor Hold/);
  const g = GRAVEYARDS.find((g) => g.id === "cragmoor");
  assert.ok(Math.hypot(p.x - g.x, p.z - g.z) < 5);
});

test("town quests count creatures from their zone; first visits grant exploration experience", () => {
  const w = make(),
    { a, p } = hero(w);
  p.level = 8;
  p.quests.harrow.status = "active";
  const e = w.enemies.find((e) => e.id.startsWith("wild-downs-")),
    other = w.enemies.find((e) => e.id.startsWith("wild-marsh-"));
  for (const target of [e, other]) {
    p.x = target.x;
    p.z = target.z;
    target.hp = 1;
    p.globalReadyAt = 0;
    p.cooldowns = {};
    w.act(a.token, { type: "ability", ability: "iron-cut", target: target.id }, 5000 + w.sequence * 2000);
  }
  assert.equal(p.quests.harrow.progress, 1, "only Downs creatures count");
  // Exploring Harrowford.
  const t = TOWNS[0],
    before = p.xp + p.level * 1000;
  p.x = t.x;
  p.z = t.z;
  const s = w.state(a.token, 0, 99999);
  assert.ok(p.explored.includes("Harrowford"));
  assert.ok(s.messages.some((m) => /Discovered: Harrowford/.test(m.text)));
  assert.ok(p.xp + p.level * 1000 > before);
  const saved = new World(w.save());
  assert.ok(saved.players.get(p.id).explored.includes("Harrowford"), "exploration is saved");
});

test("each kill rolls its own random loot: varied items, sometimes only coin", () => {
  let s = 99;
  const w = new World({}, { random: () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646, combatRandom: () => 0.99 }),
    a = w.join({ name: "Looter", faction: "dawnward", classId: "warrior" }),
    p = w.players.get(a.id);
  const seen = new Set();
  let empty = 0;
  const e = w.enemies.find((x) => x.id.startsWith("wild-downs-"));
  for (let i = 0; i < 80; i++) {
    p.seen = 1000 + i * 4000;
    p.x = e.x;
    p.z = e.z;
    e.hp = 1;
    p.globalReadyAt = 0;
    p.cooldowns = {};
    w.act(a.token, { type: "ability", ability: "iron-cut", target: e.id }, 1000 + i * 4000);
    const drop = w.loot.at(-1);
    if (!drop.items.length) empty++;
    for (const it of drop.items) seen.add(it.template);
    assert.ok(drop.coins > 0);
  }
  assert.ok(seen.size >= 5, `many different items drop (${[...seen].join(", ")})`);
  assert.ok(empty > 10 && empty < 70, `some kills drop only coin (${empty}/80)`);
});
