import test from "node:test";
import assert from "node:assert/strict";
import { World } from "../server/world.js";
test("cooperative kills reward contributors once, with a one-time quest bonus", () => {
  const w = new World({}, { combatRandom: () => 0.99 }),
    a = w.join({ name: "Rowan", faction: "dawnward" }),
    b = w.join({ name: "Alder", faction: "dawnward" });
  // This test is about ownership and gear, not the random roll.
  w.rollLoot = () => "warden-blade";
  w.rollCoins = () => 10;

  const p = w.players.get(a.id),
    q = w.players.get(b.id);
  for (const joined of [a, b]) {
    const player = w.players.get(joined.id),
      npc = w.npcs[0];
    player.x = npc.x;
    player.z = npc.z;
    w.act(joined.token, { type: "talk", target: npc.id }, 1000);
    w.act(
      joined.token,
      { type: "quest", quest: "wildgrowth", operation: "accept" },
      1001,
    );
  }
  for (let i = 0; i < 4; i++) {
    const e = w.enemies[i];
    p.x = q.x = e.x;
    p.z = q.z = e.z;
    const now = 10000 + i * 4000;
    w.act(a.token, { type: "attack", target: e.id }, now);
    assert.throws(
      () => w.act(a.token, { type: "attack", target: e.id }, now + 1),
      /not ready/,
    );
    w.act(b.token, { type: "attack", target: e.id }, now + 100);
    w.act(a.token, { type: "attack", target: e.id }, now + 1600);
  }
  for (const joined of [a, b]) {
    const player = w.players.get(joined.id);
    for (const drop of w.state(joined.token, 0, 25000).loot) {
      player.x = drop.x;
      player.z = drop.z;
      w.act(joined.token, { type: "loot", target: drop.id }, 25001);
    }
    const npc = w.npcs[0];
    player.x = npc.x;
    player.z = npc.z;
    w.act(joined.token, { type: "talk", target: npc.id }, 26000);
    w.act(
      joined.token,
      { type: "quest", quest: "wildgrowth", operation: "complete" },
      26001,
    );
  }
  assert.equal(p.kills, 4);
  assert.equal(q.kills, 4);
  assert.equal(p.coins, 70);
  assert.equal(q.coins, 70);
});
test("world restart changes chat epoch so a live client can reset its cursor", () => {
  const w = new World(),
    a = w.join({ name: "Rowan", faction: "dawnward" });
  const first = w.state(a.token);
  const restored = new World(w.save());
  assert.notEqual(first.chatEpoch, restored.state(a.token).chatEpoch);
});
test("invalid character payloads are rejected as user errors", () => {
  const w = new World();
  for (const bad of [
    null,
    [],
    42,
    {},
    { name: "<script>", faction: "dawnward" },
  ])
    assert.throws(
      () => w.join(bad),
      (e) => e.status === 400,
    );
});
