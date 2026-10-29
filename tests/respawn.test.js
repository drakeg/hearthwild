import test from "node:test";
import assert from "node:assert/strict";
import { World } from "../server/world.js";
test("killed monsters stay dead until their random deadline and respawn elsewhere away from players", () => {
  const w = new World(),
    a = w.join({ name: "Spawnwatch", faction: "dawnward" }),
    p = w.players.get(a.id),
    e = w.enemies[0];
  p.x = e.x;
  p.z = e.z;
  e.hp = 20;
  w.act(a.token, { type: "ability", ability: "iron-cut", target: e.id }, 1000);
  assert.ok(e.respawnAt >= 46000 && e.respawnAt <= 181000);
  const deadline = e.respawnAt;
  w.tick(0.05, 15000);
  assert.equal(e.hp, 0);
  w.state(a.token, 0, deadline - 1);
  w.tick(0.05, deadline - 1);
  assert.equal(e.hp, 0);
  p.x = 25;
  p.z = 25;
  w.state(a.token, 0, deadline + 1);
  w.tick(0.05, deadline + 1);
  assert.equal(e.hp, e.maxHp);
});
test("dead spawn timers survive restart instead of resurrecting the whole zone immediately", () => {
  const w = new World(),
    a = w.join({ name: "Persistent", faction: "dawnward" }),
    p = w.players.get(a.id),
    e = w.enemies[0];
  p.x = e.x;
  p.z = e.z;
  e.hp = 20;
  w.act(a.token, { type: "ability", ability: "iron-cut", target: e.id }, 1000);
  const r = new World(w.save());
  assert.equal(r.enemies[0].hp, 0);
  assert.equal(r.enemies[0].respawnAt, e.respawnAt);
});
