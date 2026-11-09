import test from "node:test";
import assert from "node:assert/strict";
import { World } from "../server/world.js";
import { NPCS, QUESTS, ITEMS, addExperience } from "../server/content.js";
import { ZONE_CREATURES } from "../server/combat.js";
import { route } from "../server/travel.js";
import { DUNGEON_LIST, dungeonAt } from "../public/dungeon-layout.js";
import { ZONES, TOWNS, LAKES, WORLD_HALF, WORLD_LIMIT, MAX_LEVEL, zoneAt, lakeAt, roadDistance, ROADS } from "../public/terrain.js";

const RING = Object.values(ZONES).filter((z) => z.ring);
const make = () => new World({}, { combatRandom: () => 0.99 });
const hero = (w, name = "Ringwalker") => {
  const a = w.join({ name, faction: "dawnward", classId: "warrior" }),
    p = w.players.get(a.id);
  p.seen = 1000;
  return { a, p };
};

test("the Outer Ring: four zones for levels 20–30, each with a town, a dungeon, people and gear", () => {
  assert.equal(RING.length, 4);
  assert.equal(MAX_LEVEL, 30);
  assert.equal(Math.max(...RING.map((z) => z.levels[1])), 30);
  for (const z of RING) {
    const town = TOWNS.find((t) => t.zone === z.id);
    assert.ok(town && zoneAt(town.x, town.z) === z.id, `${z.name} has a town inside it`);
    const folk = NPCS.filter((n) => n.town === town.id);
    assert.ok(folk.filter((n) => n.quest).length >= 4, `${town.name} has four quest givers`);
    assert.ok(folk.some((n) => n.merchant) && folk.some((n) => n.caravan), `${town.name} has a provisioner and a caravan`);
    const d = DUNGEON_LIST.find((d) => d.zone === z.id);
    assert.ok(d && zoneAt(d.door.x, d.door.z) === z.id, `${z.name} has a dungeon`);
    assert.ok(d.bossLevel > z.levels[0]);
    assert.ok(ZONE_CREATURES[z.id].length >= 4);
    const gear = Object.values(ITEMS).filter((i) => i.zone === z.id);
    assert.equal(gear.length, 6, `${z.name} has six pieces of gear`);
    assert.ok(gear.every((i) => i.level >= z.levels[0] && i.level <= z.levels[1]));
    assert.equal(Object.values(ITEMS).filter((i) => i.dungeon === d.id && i.rarity === "Epic").length, 3);
  }
});

test("roads reach every Outer Ring town from camp, and stay out of the lakes", () => {
  for (const t of TOWNS) assert.ok(route("camp", t.id)?.length > 2, `a road to ${t.name}`);
  for (const r of ROADS) for (const [x, z] of r) assert.ok(!lakeAt(x, z, 2), `road at ${Math.round(x)},${Math.round(z)} is dry`);
  for (const t of TOWNS) assert.ok(!lakeAt(t.x, t.z, t.r + 10), `${t.name} is on dry land`);
  for (const l of LAKES.filter((l) => l.lava)) assert.equal(zoneAt(l.x, l.z), "ember");
  // Dungeon instances sit far outside the bigger world.
  for (const d of DUNGEON_LIST) assert.ok(d.origin.x - 200 > WORLD_HALF, `${d.name} instance space is outside the world`);
  assert.equal(dungeonAt(WORLD_LIMIT, 0), null);
  assert.ok(roadDistance(0, 0) < 40);
});

test("Outer Ring creatures come from their zone's table and match its levels", () => {
  const w = make();
  for (const z of RING) {
    const kinds = ZONE_CREATURES[z.id].map((c) => c.kind),
      here = w.enemies.filter((e) => String(e.id).startsWith(`wild-${z.id}-`));
    assert.ok(here.length >= 100, `${z.name} is well populated`);
    for (const e of here) {
      assert.equal(zoneAt(e.x, e.z), z.id);
      assert.ok(kinds.includes(e.kind));
      assert.ok(e.level >= z.levels[0] && e.level <= z.levels[1], `${e.name} level ${e.level}`);
      assert.ok(Math.max(Math.abs(e.x), Math.abs(e.z)) <= WORLD_LIMIT);
    }
  }
});

test("characters now grow to level 30", () => {
  const w = make(),
    { p } = hero(w);
  p.level = 20;
  p.xp = 0;
  for (let i = 0; i < 40; i++) addExperience(p, 5000);
  assert.equal(p.level, 30);
  assert.equal(p.xp, 0);
});

test("Outer Ring quest chains run town to town, from the Crags to Starfall Rest", () => {
  const chain = ["dispatch-cinderhold", "news-duskhollow", "letters-sunmere", "map-starfall"];
  const order = ["cinderhold-quest", "duskhollow-quest", "sunmere-quest", "starfall-quest"];
  chain.forEach((id, i) => assert.equal(QUESTS[id].deliver.to, order[i]));
  for (const id of ["zealot-hunt", "duskfang-hunt", "sunscale-hunt", "voidmaw-hunt"]) assert.ok(QUESTS[QUESTS[id].requires], `${id} is part of a chain`);
  for (const d of DUNGEON_LIST.filter((d) => ZONES[d.zone]?.ring)) {
    const scout = NPCS.find((n) => n.dungeon === d.id);
    assert.equal(QUESTS[scout.quest].boss, d.id);
  }
});

test("lava burns anyone who wades into the Cinder Pools", () => {
  const w = make(),
    { p } = hero(w),
    pool = LAKES.find((l) => l.lava);
  p.level = 22;
  p.hp = w.maxHp(p);
  Object.assign(p, { x: pool.x, z: pool.z, inputAt: 0 });
  const before = p.hp;
  for (let t = 0; t < 30; t++) w.tick(0.1, 2000 + t * 100);
  assert.ok(p.hp < before, "the lava hurts");
  // Standing on the shore is safe.
  Object.assign(p, { x: pool.x + pool.r + 8, z: pool.z, hp: w.maxHp(p) });
  const shore = p.hp;
  for (let t = 0; t < 30; t++) w.tick(0.1, 6000 + t * 100);
  assert.ok(p.hp >= shore - 1);
});
