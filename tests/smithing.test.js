import test from "node:test";
import assert from "node:assert/strict";
import { World } from "../server/world.js";
import { SMITH_RECIPES } from "../server/commerce.js";
import { ITEMS } from "../server/content.js";
import { REAGENTS, ORE_POPULATION, isOre } from "../public/reagents.js";
import { zoneAt } from "../public/terrain.js";

const make = () => new World({}, { combatRandom: () => 0.99 });
const hero = (w) => {
  const a = w.join({ name: "Anvilhand", faction: "dawnward", classId: "warrior" }),
    p = w.players.get(a.id);
  p.seen = 1000;
  return { a, p, act: (x, now = 2000) => w.act(a.token, x, now) };
};

test("ore veins lie in their own zones, in the numbers each zone promises", () => {
  const w = make();
  for (const [zone, n] of Object.entries(ORE_POPULATION)) {
    const here = w.resources.filter((r) => isOre(r.kind) && r.zone === zone);
    assert.equal(here.length, n, zone);
    for (const r of here) {
      assert.ok(REAGENTS[r.kind].zones.includes(zone));
      assert.equal(zoneAt(r.x, r.z), zone);
    }
  }
});

test("mining needs the trade; Smith Bran teaches it; ore becomes Rare gear at the forge", () => {
  const w = make(),
    h = hero(w),
    vein = w.resources.find((r) => r.kind === "copper" && !r.depleted);
  Object.assign(h.p, { x: vein.x, z: vein.z });
  assert.throws(() => h.act({ type: "gather", target: vein.id }), /Learn Mining/);
  // Mira doesn't teach smithing, and Bran doesn't teach herbs.
  const bran = w.npcs.find((n) => n.id === "smith"),
    mira = w.npcs.find((n) => n.id === "herbalist");
  Object.assign(h.p, { x: mira.x, z: mira.z });
  h.act({ type: "talk", target: mira.id });
  assert.throws(() => h.act({ type: "learn", vendor: "herbalist", profession: "mining" }), /Smith Bran/);
  Object.assign(h.p, { x: bran.x, z: bran.z });
  h.act({ type: "talk", target: bran.id });
  assert.throws(() => h.act({ type: "learn", vendor: "smith", profession: "alchemy" }), /Mira/);
  h.act({ type: "learn", vendor: "smith", profession: "mining" });
  h.act({ type: "learn", vendor: "smith", profession: "blacksmithing" });
  assert.equal(h.p.professions.mining, 1);
  // Now the vein yields.
  Object.assign(h.p, { x: vein.x, z: vein.z });
  h.act({ type: "gather", target: vein.id }, 3000);
  assert.ok(h.p.materials.copper >= 1);
  assert.ok(h.p.professions.mining > 1, "mining improves with every vein");
  // Forging needs enough ore and enough skill.
  const blade = "copper-forged-blade";
  assert.ok(SMITH_RECIPES[blade]);
  h.p.materials.copper = 5;
  assert.throws(() => h.act({ type: "craft", recipe: blade }), /6 Copper/);
  h.p.materials.copper = 6;
  h.act({ type: "craft", recipe: blade }, 4000);
  assert.equal(h.p.materials.copper, 0);
  assert.ok(h.p.inventory.some((i) => i.template === blade));
  assert.equal(ITEMS[blade].rarity, "Rare");
  assert.ok(h.p.professions.blacksmithing > 1);
  h.p.materials.starmetal = 99;
  h.p.materials.sunsteel = 99;
  assert.throws(() => h.act({ type: "craft", recipe: "starmetal-greatsword" }), /Blacksmithing 85/);
});

test("every forge recipe names real ores and a sensible level", () => {
  for (const r of Object.values(SMITH_RECIPES)) {
    for (const o of Object.keys(r.ores)) assert.ok(isOre(o), o);
    assert.ok(r.level >= 6 && r.level <= 30);
  }
});
