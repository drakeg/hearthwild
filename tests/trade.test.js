import test from "node:test";
import assert from "node:assert/strict";
import { World } from "../server/world.js";
import { DUNGEON_LOOT } from "../server/content-world.js";
import { TRADE } from "../server/trade.js";

const make = () => new World({}, { combatRandom: () => 0.99 });
let n = 0;
const hero = (w, faction = "dawnward") => {
  const a = w.join({ name: `Trader${String.fromCharCode(97 + n++)}`, faction, classId: "rogue" }),
    p = w.players.get(a.id);
  Object.assign(p, { seen: 1000, x: 30, z: 30, coins: 100 });
  return { a, p, act: (x, now = 2000) => w.act(a.token, x, now), view: (now = 2000) => w.state(a.token, 0, now).self.trade };
};
const give = (h, template) => {
  const item = { id: `${template}-${h.p.name}`, template };
  h.p.inventory.push(item);
  return item.id;
};

test("two players trade items and gold face to face, and both must confirm", () => {
  const w = make(),
    a = hero(w),
    b = hero(w);
  const sword = give(a, "copper-forged-blade"),
    vest = give(b, "copper-scale-vest");
  a.act({ type: "trade", op: "request", name: b.p.name });
  assert.equal(b.view().invite.from, a.p.name);
  b.act({ type: "trade", op: "accept" });
  assert.equal(a.view().theirs.name, b.p.name);
  a.act({ type: "trade", op: "offer", items: [sword], coins: 25 });
  b.act({ type: "trade", op: "offer", items: [vest] });
  assert.equal(b.view().theirs.items[0].name, "Copper-forged blade");
  b.act({ type: "trade", op: "confirm" });
  // Changing an offer clears every confirmation.
  a.act({ type: "trade", op: "offer", items: [sword], coins: 30 });
  assert.equal(b.view().mine.ok, false);
  a.act({ type: "trade", op: "confirm" });
  assert.ok(a.p.inventory.some((i) => i.id === sword), "nothing moves until both confirm");
  b.act({ type: "trade", op: "confirm" });
  assert.ok(b.p.inventory.some((i) => i.id === sword) && !a.p.inventory.some((i) => i.id === sword));
  assert.ok(a.p.inventory.some((i) => i.id === vest) && !b.p.inventory.some((i) => i.id === vest));
  assert.equal(a.p.coins, 70);
  assert.equal(b.p.coins, 130);
  assert.equal(a.view(), null, "the window closes");
});

test("trades respect distance, faction, equipped gear and bound treasure", () => {
  const w = make(),
    a = hero(w),
    b = hero(w),
    foe = hero(w, "mossbound");
  assert.throws(() => a.act({ type: "trade", op: "request", name: foe.p.name }), /faction/);
  b.p.x = 30 + TRADE.range + 5;
  assert.throws(() => a.act({ type: "trade", op: "request", name: b.p.name }), /paces/);
  b.p.x = 31;
  a.act({ type: "trade", op: "request", name: b.p.name });
  b.act({ type: "trade", op: "accept" });
  const epic = give(a, DUNGEON_LOOT["world-boss"][0]);
  assert.throws(() => a.act({ type: "trade", op: "offer", items: [epic] }), /stays with/);
  const worn = give(a, "copper-forged-blade");
  a.p.equipment.weapon = worn;
  assert.throws(() => a.act({ type: "trade", op: "offer", items: [worn] }), /Take that off/);
  assert.throws(() => a.act({ type: "trade", op: "offer", coins: 9999 }), /gold/);
  // Walking away cancels the trade.
  b.p.x = 30 + TRADE.range + 5;
  for (const p of w.players.values()) p.seen = 4000;
  w.tick(0.05, 4000);
  assert.equal(a.view(4000), null);
  assert.ok(a.p.messages.some((m) => /cancelled/.test(m.text)));
});
