import test from "node:test";
import assert from "node:assert/strict";
import { World } from "../server/world.js";
import { applyLevel } from "../server/combat.js";

test("characters keep a chosen body type, defaulting to masculine, and reject unknown values", () => {
  const w = new World(),
    a = w.join({ name: "Brienne", faction: "dawnward", classId: "warrior", gender: "female" }),
    b = w.join({ name: "Oren", faction: "dawnward", classId: "rogue" });
  assert.equal(w.state(a.token).self.gender, "female");
  assert.equal(w.state(b.token).self.gender, "male");
  assert.throws(() => w.join({ name: "Odd", faction: "dawnward", gender: "robot" }), /body/);
  const r = new World(w.save());
  assert.equal(r.state(a.token).self.gender, "female");
});

test("creature type follows the land: beasts near camp, Ashen raiders in the ruins and far reaches", () => {
  const near = applyLevel({ id: "bramble-1", x: 5, z: -5 }),
    ruins = applyLevel({ id: "bramble-2", x: -48, z: 45 }),
    far = applyLevel({ id: "bramble-3", x: 70, z: 70 });
  assert.equal(near.kind, "prowler");
  assert.match(ruins.kind, /^ashen-/);
  assert.match(far.kind, /^ashen-/);
  assert.ok(far.level >= 3);
});
