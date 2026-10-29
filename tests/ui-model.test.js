import test from "node:test";
import assert from "node:assert/strict";
import {
  BAR_KEYS,
  mapPoint,
  filterQuests,
  bagCells,
} from "../public/ui-model.js";
test("action bar has twelve conventional slots and map coordinates preserve north", () => {
  assert.equal(BAR_KEYS.length, 12);
  assert.deepEqual(mapPoint(0, 0), { x: 50, y: 50 });
  assert.ok(mapPoint(0, -20).y < 50);
  assert.deepEqual(mapPoint(100, -100), { x: 100, y: 0 });
});
test("quest lookup searches objectives and area, with active/complete filters", () => {
  const defs = {
      a: {
        id: "a",
        name: "Bramble",
        objective: "Defeat beasts",
        area: "Stillwood",
      },
      b: { id: "b", name: "Herbs", objective: "Gather leaves", area: "Pond" },
    },
    p = { a: { status: "active" }, b: { status: "complete" } };
  assert.equal(filterQuests(defs, p, "beasts", "active")[0].id, "a");
  assert.equal(filterQuests(defs, p, "", "complete")[0].id, "b");
  assert.equal(filterQuests(defs, p, "forest").length, 0);
});
test("combined bag always exposes its slot capacity and filters items without inventing loot", () => {
  const i = { id: "x", name: "Amber charm", slot: "charm", rarity: "Uncommon" };
  assert.equal(bagCells([i]).length, 60);
  assert.equal(bagCells([i], "amber")[0].id, "x");
  assert.ok(bagCells([i], "sword").every((i) => i === null));
});
test("consumables stack in one bag slot with a count, while gear stays separate", async () => {
  const { stackConsumables, itemIconStyle } = await import("../public/ui-model.js");
  const items = [
    { id: "a", template: "healing-draught", slot: "consumable", name: "Draught" },
    { id: "b", template: "healing-draught", slot: "consumable", name: "Draught" },
    { id: "c", template: "warden-blade", slot: "weapon", name: "Blade" },
  ];
  const s = stackConsumables(items);
  assert.equal(s.length, 2);
  assert.equal(s[0].count, 2);
  assert.deepEqual(s[0].ids, ["a", "b"]);
  assert.ok(itemIconStyle("healing-draught").backgroundImage.startsWith("url("));
});
