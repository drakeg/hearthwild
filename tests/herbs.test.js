import test from "node:test";
import assert from "node:assert/strict";
import { World } from "../server/world.js";
import { RECIPES } from "../server/commerce.js";
import { REAGENTS, REAGENT_IDS, HERB_POPULATION } from "../public/reagents.js";
import { ZONES, zoneAt, lakeAt } from "../public/terrain.js";

const make = () => new World({}, { combatRandom: () => 0.99 });
const hero = (w) => {
  const a = w.join({ name: "Herbwise", faction: "dawnward", classId: "druid" }),
    p = w.players.get(a.id);
  p.seen = 1000;
  return { a, p, act: (x, now = 2000) => w.act(a.token, x, now) };
};

test("every zone grows its own herb, spread across the zone and out of the water", () => {
  const w = make();
  for (const zone of Object.keys(ZONES)) {
    const native = REAGENT_IDS.find((id) => REAGENTS[id].zone === zone),
      here = w.resources.filter((r) => r.zone === zone);
    assert.ok(native, `${zone} has a herb`);
    assert.ok(here.some((r) => r.kind === native));
    for (const r of here) {
      assert.equal(zoneAt(r.x, r.z), zone);
      assert.ok(!lakeAt(r.x, r.z, 2));
    }
    if (HERB_POPULATION[zone]) assert.equal(here.length, HERB_POPULATION[zone]);
  }
  assert.ok(w.resources.filter((r) => r.kind === "starleaf").length > 32, "Starleaf grows beyond the Stillwood too");
  assert.ok(w.resources.length > 400);
});

test("anyone can gather any herb; herbalists improve and sometimes find two; herbs sell and brew", () => {
  const w = make(),
    h = hero(w),
    pick = (kind, now) => {
      const r = w.resources.find((r) => r.kind === kind && !r.depleted);
      Object.assign(h.p, { x: r.x, z: r.z });
      h.act({ type: "gather", target: r.id }, now);
      return r;
    };
  pick("gloamcap", 2000);
  assert.equal(h.p.materials.gloamcap, 1);
  h.p.professions.herbalism = 100;
  w.random = () => 0.1;
  pick("gloamcap", 3000);
  assert.equal(h.p.materials.gloamcap, 3, "a skilled herbalist finds a second sprig");
  // Sell one at the herb's own price.
  const shop = w.npcs.find((n) => n.merchant);
  Object.assign(h.p, { x: shop.x, z: shop.z });
  h.act({ type: "talk", target: shop.id }, 3500);
  const coins = h.p.coins;
  h.act({ type: "sell", vendor: shop.id, item: "reagent-gloamcap", quantity: 1 }, 4000);
  assert.equal(h.p.coins, coins + REAGENTS.gloamcap.value);
  // Brew a Gloamcap brew.
  h.p.professions.alchemy = 70;
  h.p.materials.gloamcap = 3;
  h.act({ type: "craft", recipe: "gloamcap-brew" }, 5000);
  assert.equal(h.p.materials.gloamcap, 0);
  assert.ok(h.p.inventory.some((i) => i.template === "gloamcap-brew"));
  for (const r of Object.values(RECIPES)) for (const k of Object.keys(r.herbs)) assert.ok(REAGENTS[k]);
});

test("the herb finder lists ready patches for the zone the map shows", () => {
  const w = make(),
    h = hero(w);
  const s = w.state(h.a.token, 0, 2000, null, "dunes");
  assert.equal(s.herbMap.length, HERB_POPULATION.dunes);
  assert.ok(s.herbMap.every(([x, z, k]) => k === "sunpetal" && zoneAt(x, z) === "dunes"));
  assert.equal(w.state(h.a.token, 0, 2000).herbMap, undefined, "only when asked");
  assert.ok(w.state(h.a.token, 0, 2000, null, "world").herbMap.length > 400);
});
