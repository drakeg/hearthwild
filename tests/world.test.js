import test from "node:test";
import assert from "node:assert/strict";
import { World } from "../server/world.js";
const make = () => new World({}, { combatRandom: () => 0.99 });
const join = (w, name, faction = "dawnward") => w.join({ name, faction });
test("faction text never reaches opposing faction, even with a forged sender/faction", () => {
  const w = make(),
    a = join(w, "Aster"),
    b = join(w, "Briar"),
    c = join(w, "Cedar", "mossbound");
  w.act(
    a.token,
    {
      type: "chat",
      channel: "faction",
      text: "Meet at the arch",
      sender: c.id,
      faction: "mossbound",
    },
    1000,
  );
  assert.equal(
    w.state(b.token, 0, 1000).messages.at(-1).text,
    "Meet at the arch",
  );
  assert.equal(w.state(c.token, 0, 1000).messages.length, 0);
  assert.equal(w.state(b.token, 0, 1000).messages.at(-1).from, "Aster");
});
test("nearby chat respects distance and faction; whispers are private and cannot cross factions", () => {
  const w = make(),
    a = join(w, "Aster"),
    b = join(w, "Briar"),
    c = join(w, "Cedar", "mossbound"),
    d = join(w, "Dusk");
  w.players.get(d.id).x = 28;
  w.act(a.token, { type: "chat", channel: "nearby", text: "Hello" }, 1000);
  assert.equal(w.state(b.token, 0, 1000).messages.length, 1);
  assert.equal(w.state(c.token, 0, 1000).messages.length, 0);
  assert.equal(w.state(d.token, 0, 1000).messages.length, 0);
  w.act(
    a.token,
    { type: "chat", channel: "whisper", to: "Dusk", text: "Private" },
    2000,
  );
  assert.equal(w.state(d.token, 0, 2000).messages.at(-1).text, "Private");
  assert.equal(w.state(b.token, 0, 2000).messages.length, 1);
  assert.throws(
    () =>
      w.act(
        a.token,
        { type: "chat", channel: "whisper", to: "Cedar", text: "No" },
        3000,
      ),
    /same faction/,
  );
});
test("chat validates messages, channels and rate, and has bounded recipient history", () => {
  const w = make(),
    a = join(w, "Aster");
  for (const text of ["", " ".repeat(5), "x".repeat(281)])
    assert.throws(() =>
      w.act(a.token, { type: "chat", channel: "nearby", text }, 1000),
    );
  assert.throws(() =>
    w.act(a.token, { type: "chat", channel: "global", text: "Leak" }, 1000),
  );
  w.act(a.token, { type: "chat", channel: "faction", text: "One" }, 1000);
  assert.throws(
    () =>
      w.act(a.token, { type: "chat", channel: "faction", text: "Two" }, 1100),
    /slow/i,
  );
  for (let i = 0; i < 90; i++)
    w.act(
      a.token,
      { type: "chat", channel: "faction", text: String(i) },
      2000 + i * 1000,
    );
  assert.equal(w.state(a.token, 0, 100000).messages.length, 80);
});
test("movement speed is normalized, bounded, and stale input stops", () => {
  const w = make(),
    a = join(w, "Aster"),
    p = w.players.get(a.id),
    start = { x: p.x, z: p.z };
  w.act(a.token, { type: "input", x: 1, z: 1 }, 1000);
  w.tick(0.1, 1100);
  assert.ok(Math.abs(Math.hypot(p.x - start.x, p.z - start.z) - 0.5) < 0.0001);
  w.tick(0.1, 2000);
  assert.ok(Math.abs(Math.hypot(p.x - start.x, p.z - start.z) - 0.5) < 0.0001);
  assert.throws(() =>
    w.act(a.token, { type: "input", x: Infinity, z: 0 }, 2100),
  );
});
test("combat validates reach and cooldown; rewards occur once per enemy defeat", () => {
  const w = make(),
    a = join(w, "Aster"),
    p = w.players.get(a.id),
    e = w.enemies[0];
  // This test is about ownership and gear, not the random roll.
  w.rollLoot = () => "warden-blade";
  w.rollCoins = () => 10;
  assert.throws(
    () => w.act(a.token, { type: "attack", target: e.id }, 1000),
    /closer/,
  );
  p.x = e.x;
  p.z = e.z;
  for (let i = 0; i < 3; i++)
    w.act(
      a.token,
      { type: "attack", target: e.id, damage: 99999 },
      2000 + i * 1500,
    );
  assert.equal(e.hp, 0);
  assert.equal(p.coins, 0);
  const drop = w.state(a.token, 0, 5001).loot[0];
  w.act(a.token, { type: "loot", target: drop.id }, 5002);
  assert.equal(p.coins, 10);
  assert.equal(p.kills, 1);
  assert.throws(() => w.act(a.token, { type: "attack", target: e.id }, 6000));
  assert.equal(p.coins, 10);
});
test("saved characters resume with fixed faction and rewards, without chat or raw tokens", () => {
  const w = make(),
    a = join(w, "Aster"),
    p = w.players.get(a.id);
  p.coins = 20;
  p.kills = 2;
  p.x = 9;
  w.act(a.token, { type: "chat", channel: "faction", text: "Ephemeral" }, 1000);
  const saved = JSON.stringify(w.save());
  assert.ok(!saved.includes(a.token));
  assert.ok(!saved.includes("Ephemeral"));
  const restored = new World(JSON.parse(saved));
  const state = restored.state(a.token, 0, 2000);
  assert.equal(state.self.coins, 20);
  assert.equal(state.self.x, 9);
  assert.equal(state.self.faction, "dawnward");
  assert.equal(state.messages.length, 0);
  assert.throws(() => restored.state("invalid", 0, 2000), /return key/);
  assert.throws(() => join(restored, "aster", "mossbound"), /already/);
});
