import test from "node:test";
import assert from "node:assert/strict";
import { World } from "../server/world.js";
const setup = () => {
  const w = new World(),
    a = w.join({ name: "Trader", faction: "dawnward" }),
    p = w.players.get(a.id);
  p.x = 4;
  p.z = 10;
  p.coins = 100;
  w.act(a.token, { type: "talk", target: "herbalist" }, 1000);
  return { w, a, p };
};
test("merchant uses fixed prices, supports selling and buying back the same item, and rejects remote trades", () => {
  const { w, a, p } = setup();
  w.act(
    a.token,
    { type: "buy", vendor: "herbalist", template: "warden-blade", price: 0 },
    1100,
  );
  const item = p.inventory[0];
  assert.equal(p.coins, 76);
  w.act(a.token, { type: "sell", vendor: "herbalist", item: item.id }, 1200);
  assert.equal(p.coins, 82);
  assert.equal(p.inventory.length, 0);
  w.act(a.token, { type: "buyback", vendor: "herbalist", item: item.id }, 1300);
  assert.equal(p.coins, 76);
  assert.equal(p.inventory[0].id, item.id);
  assert.throws(() =>
    w.act(
      a.token,
      { type: "buyback", vendor: "herbalist", item: item.id },
      1400,
    ),
  );
  p.x = 60;
  assert.throws(
    () =>
      w.act(
        a.token,
        { type: "buy", vendor: "herbalist", template: "warden-blade" },
        1500,
      ),
    /closer/,
  );
});
test("Alchemy turns surplus Starleaf into a usable potion, levels profession, protects quest herbs and persists", () => {
  const { w, a, p } = setup();
  p.materials.starleaf = 10;
  p.quests.starleaf = { status: "ready", progress: 4 };
  for (const profession of ["herbalism", "alchemy"])
    w.act(a.token, { type: "learn", vendor: "herbalist", profession }, 1100);
  w.act(a.token, { type: "craft", recipe: "healing-draught" }, 1200);
  assert.equal(p.materials.starleaf, 8);
  assert.equal(p.professions.alchemy, 2);
  const potion = p.inventory[0];
  assert.equal(potion.template, "healing-draught");
  p.hp = 20;
  w.act(a.token, { type: "consume", item: potion.id }, 1300);
  assert.equal(p.hp, 80);
  assert.equal(p.inventory.length, 0);
  p.materials.starleaf = 4;
  assert.throws(
    () => w.act(a.token, { type: "craft", recipe: "healing-draught" }, 1400),
    /quest/,
  );
  const s = new World(w.save()).state(a.token).self;
  assert.equal(s.professions.alchemy, 2);
  assert.equal(s.materials.starleaf, 4);
});
test("merchant rejects forged prices, invalid quantities, equipped sales and crafting without training", () => {
  const { w, a, p } = setup();
  p.coins = 0;
  assert.throws(
    () =>
      w.act(
        a.token,
        { type: "buy", vendor: "herbalist", template: "moonstone", price: 0 },
        1100,
      ),
    /gold/,
  );
  assert.throws(() =>
    w.act(
      a.token,
      {
        type: "sell",
        vendor: "herbalist",
        item: "reagent-starleaf",
        quantity: -2,
      },
      1200,
    ),
  );
  assert.throws(
    () => w.act(a.token, { type: "craft", recipe: "healing-draught" }, 1300),
    /Alchemy/,
  );
  p.inventory.push({ id: "worn", template: "warden-blade" });
  p.equipment.weapon = "worn";
  assert.throws(
    () =>
      w.act(a.token, { type: "sell", vendor: "herbalist", item: "worn" }, 1400),
    /equipped/,
  );
});
