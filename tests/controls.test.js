import test from "node:test";
import assert from "node:assert/strict";
import { combatIntent, approach } from "../public/controls.js";
test("attack intent closes distance from camp before striking instead of repeatedly failing reach", () => {
  const p = { x: -2, z: 10 },
    e = { x: -10, z: 4, hp: 60 };
  const intent = combatIntent(p, e);
  assert.ok(intent.x < 0 && intent.z < 0);
  assert.equal(intent.ready, false);
  assert.ok(Math.abs(Math.hypot(intent.x, intent.z) - 1) < 1e-8);
  assert.equal(combatIntent({ x: -9, z: 4 }, e).ready, true);
  assert.equal(combatIntent(p, { ...e, hp: 0 }).ended, true);
});
test("NPC and gathering intent stop within interact range", () => {
  assert.deepEqual(approach({ x: 0, z: 0 }, { x: 2, z: 0 }, 2.7), {
    x: 0,
    z: 0,
    ready: true,
  });
});
