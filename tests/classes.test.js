import test from "node:test";
import assert from "node:assert/strict";
import { World } from "../server/world.js";
test("classes enforce unlocked skills, class membership, resource costs and ability cooldowns", () => {
  const w = new World({}, { combatRandom: () => 0.99 }),
    a = w.join({ name: "Blade", faction: "dawnward", classId: "warrior" }),
    p = w.players.get(a.id),
    e = w.enemies[0];
  p.x = e.x;
  p.z = e.z;
  assert.throws(
    () =>
      w.act(
        a.token,
        { type: "ability", ability: "cinder-bolt", target: e.id },
        1000,
      ),
    /class/,
  );
  assert.throws(
    () =>
      w.act(
        a.token,
        { type: "ability", ability: "earthbreaker", target: e.id },
        1000,
      ),
    /level 3/,
  );
  assert.throws(
    () =>
      w.act(
        a.token,
        { type: "ability", ability: "crushing-blow", target: e.id },
        1000,
      ),
    /Rage/,
  );
  w.act(a.token, { type: "ability", ability: "iron-cut", target: e.id }, 1000);
  assert.equal(p.power, 15);
  assert.equal(e.hp, 40);
  assert.throws(
    () =>
      w.act(
        a.token,
        { type: "ability", ability: "iron-cut", target: e.id },
        1001,
      ),
    /not ready/,
  );
});
test("warlock can cast at range, and movement interrupts an unfinished cast", () => {
  const w = new World({}, { combatRandom: () => 0.99 }),
    a = w.join({ name: "Cinder", faction: "mossbound", classId: "warlock" }),
    p = w.players.get(a.id),
    e = w.enemies[0];
  p.x = e.x + 10;
  p.z = e.z;
  w.act(
    a.token,
    { type: "ability", ability: "cinder-bolt", target: e.id },
    1000,
  );
  assert.equal(e.hp, 60);
  w.tick(0.05, 2200);
  assert.equal(e.hp, 34);
  assert.equal(p.power, 88);
  w.act(
    a.token,
    { type: "ability", ability: "cinder-bolt", target: e.id },
    4000,
  );
  w.act(a.token, { type: "input", x: 1, z: 0 }, 4050);
  w.tick(0.05, 4100);
  assert.equal(p.casting, null);
  assert.equal(e.hp, 34);
});
test("experience raises level and unlocks skills while saved class and level remain fixed", () => {
  const w = new World({}, { combatRandom: () => 0.99 }),
    a = w.join({ name: "Blade", faction: "dawnward", classId: "warrior" }),
    p = w.players.get(a.id);
  for (let i = 0; i < 3; i++) {
    const e = w.enemies[i];
    p.x = e.x;
    p.z = e.z;
    e.hp = 20;
    w.act(
      a.token,
      { type: "ability", ability: "iron-cut", target: e.id },
      1000 + i * 2000,
    );
  }
  assert.equal(p.level, 2);
  assert.equal(p.xp, 5);
  assert.ok(
    w.state(a.token, 0, 6000).abilities.find((s) => s.id === "rally").level <=
      p.level,
  );
  const r = new World(w.save());
  assert.equal(r.state(a.token, 0, 7000).self.classId, "warrior");
  assert.equal(r.state(a.token, 0, 7000).self.level, 2);
});
for (const classId of ["druid", "rogue"])
  test(`${classId} starter ability uses its own resource and does server-owned damage`, () => {
    const w = new World({}, { combatRandom: () => 0.99 }),
      a = w.join({ name: `Test ${classId}`, faction: "dawnward", classId }),
      p = w.players.get(a.id),
      e = w.enemies[0];
    p.x = e.x + 1;
    p.z = e.z;
    const ability = w.state(a.token, 0, 1000).abilities[0];
    w.act(
      a.token,
      { type: "ability", ability: ability.id, target: e.id },
      1000,
    );
    if (ability.castTime) w.tick(0.05, 2000);
    assert.ok(e.hp < 60);
    assert.ok(p.power < 100);
    if (classId === "druid") {
      p.hp = 20;
      w.act(a.token, { type: "ability", ability: "mending" }, 4000);
      assert.equal(p.hp, 60);
    }
  });

test("malformed class and quest identifiers cannot access inherited object fields", () => {
  const w = new World();
  for (const classId of ["constructor", "__proto__", {}, []])
    assert.throws(
      () => w.join({ name: "Invalid", faction: "dawnward", classId }),
      (e) => e.status === 400,
    );
  const a = w.join({ name: "Valid", faction: "dawnward" });
  for (const quest of ["constructor", "__proto__", {}])
    assert.throws(
      () => w.act(a.token, { type: "quest", quest, operation: "accept" }),
      (e) => e.status === 400,
    );
});
