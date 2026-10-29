import test from "node:test";
import assert from "node:assert/strict";
import { World } from "../server/world.js";
import { killExperience, aggroRadius, mobStats } from "../server/combat.js";
import { levelAt, levelColor, subzoneAt } from "../public/world-config.js";

const noCrit = { combatRandom: () => 0.99 };
const setup = (classId = "warrior") => {
  const w = new World({}, noCrit),
    a = w.join({ name: "Tester", faction: "dawnward", classId }),
    p = w.players.get(a.id);
  // Keep other monsters out of these focused scenarios.
  for (const e of w.enemies.slice(1)) e.hp = 0, (e.respawnAt = Infinity);
  return { w, a, p, e: w.enemies[0] };
};

test("the global cooldown is 1.5 seconds, or 1 second for rogues", () => {
  const { w, a, p, e } = setup();
  p.x = e.x;
  p.z = e.z;
  w.act(a.token, { type: "ability", ability: "iron-cut", target: e.id }, 1000);
  assert.equal(p.globalReadyAt, 2500);
  const r = setup("rogue");
  r.p.x = r.e.x;
  r.p.z = r.e.z;
  w.state(a.token, 0, 1000);
  r.w.act(r.a.token, { type: "ability", ability: "quick-cut", target: r.e.id }, 1000);
  assert.equal(r.p.globalReadyAt, 2000);
});

test("melee abilities start auto-attack, which swings on the weapon timer and builds rage", () => {
  const { w, a, p, e } = setup();
  p.x = e.x;
  p.z = e.z;
  e.homeX = e.x;
  e.homeZ = e.z;
  w.act(a.token, { type: "ability", ability: "iron-cut", target: e.id }, 1000);
  assert.equal(p.autoAttack, e.id);
  const afterAbility = e.hp;
  w.tick(0.01, 1010);
  assert.ok(e.hp < afterAbility, "first swing lands immediately");
  const afterSwing = e.hp,
    rage = p.power;
  w.tick(0.01, 2000);
  assert.equal(e.hp, afterSwing, "no swing before the 2.4s timer");
  w.tick(0.01, 3420);
  assert.ok(e.hp < afterSwing);
  assert.ok(p.power > rage - 1);
});

test("auto-attack can be started and stopped directly, and stops when the target dies", () => {
  const { w, a, p, e } = setup("rogue");
  p.x = e.x;
  p.z = e.z;
  w.act(a.token, { type: "autoattack", target: e.id }, 1000);
  assert.equal(p.autoAttack, e.id);
  w.act(a.token, { type: "autoattack", stop: true }, 1001);
  assert.equal(p.autoAttack, null);
  e.hp = 1;
  w.act(a.token, { type: "autoattack", target: e.id }, 1002);
  w.tick(0.01, 1010);
  assert.equal(e.hp, 0);
  assert.equal(p.autoAttack, null);
});

test("creatures pick the player with the most threat", () => {
  const { w, a, p, e } = setup("warlock"),
    b = w.join({ name: "Tank", faction: "dawnward", classId: "warrior" }),
    q = w.players.get(b.id);
  e.hp = e.maxHp = 1000;
  p.x = e.x + 10;
  p.z = e.z;
  q.x = e.x + 1;
  q.z = e.z;
  w.state(b.token, 0, 1000);
  w.act(a.token, { type: "ability", ability: "soul-scorch", target: e.id }, 1000);
  w.tick(0.01, 1001);
  assert.equal(e.targetId, p.id);
  q.power = 100;
  w.act(b.token, { type: "ability", ability: "crushing-blow", target: e.id }, 1100);
  w.act(b.token, { type: "ability", ability: "iron-cut", target: e.id }, 2700);
  w.tick(0.01, 2701);
  assert.equal(e.targetId, q.id);
});

test("creatures pulled beyond their leash evade, run home and reset to full health", () => {
  const { w, a, p, e } = setup();
  e.homeX = e.x;
  e.homeZ = e.z;
  p.x = e.x;
  p.z = e.z;
  w.act(a.token, { type: "ability", ability: "iron-cut", target: e.id }, 1000);
  assert.ok(e.hp < e.maxHp);
  e.x = e.homeX + 40;
  p.x = e.x;
  w.tick(0.05, 1100);
  assert.equal(e.evading, true);
  assert.equal(p.autoAttack, null);
  assert.throws(
    () => w.act(a.token, { type: "ability", ability: "iron-cut", target: e.id }, 5000),
    /evading|range/,
  );
  for (let t = 1200; t < 12000; t += 100) w.tick(0.1, t);
  assert.equal(e.evading, false);
  assert.equal(e.hp, e.maxHp);
});

test("players die, are locked out of actions, and release to camp", () => {
  const { w, a, p, e } = setup();
  e.homeX = e.x;
  e.homeZ = e.z;
  p.x = e.x + 1;
  p.z = e.z;
  p.hp = 1;
  w.state(a.token, 0, 1000);
  w.tick(0.01, 4000);
  assert.equal(p.dead, true);
  assert.equal(p.hp, 0);
  assert.throws(
    () => w.act(a.token, { type: "ability", ability: "iron-cut", target: e.id }, 4100),
    /dead/,
  );
  w.act(a.token, { type: "chat", channel: "faction", text: "help" }, 4200);
  w.act(a.token, { type: "release" }, 4300);
  assert.equal(p.dead, false);
  assert.ok(p.hp > 0);
  assert.ok(Math.abs(p.x) < 9 && p.z > 6);
});

test("camp is a sanctuary: creatures drop players who flee into it", () => {
  const { w, a, p, e } = setup();
  p.x = e.x;
  p.z = e.z;
  w.act(a.token, { type: "ability", ability: "iron-cut", target: e.id }, 1000);
  assert.ok(e.threat.has(p.id));
  p.x = 0;
  p.z = 12;
  w.tick(0.05, 1100);
  assert.ok(!e.threat.has(p.id));
});

test("level bands, con colours, aggro radius and kill experience scale with level", () => {
  assert.equal(levelAt(0, 14), 1);
  assert.ok(levelAt(-70, -70) >= 4);
  assert.equal(levelColor(6, 1), "#ff2020");
  assert.equal(levelColor(5, 1), "#ff8040");
  assert.equal(levelColor(1, 1), "#ffff00");
  assert.equal(levelColor(1, 7), "#9d9d9d");
  assert.ok(aggroRadius(5, 1) > aggroRadius(1, 1));
  assert.ok(aggroRadius(1, 6) < aggroRadius(1, 1));
  assert.equal(killExperience(1, 1), 35);
  assert.ok(killExperience(3, 1) > 35);
  assert.equal(killExperience(1, 6), 0);
  assert.ok(mobStats(3).maxHp > mobStats(1).maxHp);
  assert.equal(subzoneAt(0, 16), "Wayfarer’s Camp");
  assert.equal(subzoneAt(43, -46), "Mossfall Ridge");
});

test("transient combat state is not saved, but death is", () => {
  const { w, a, p } = setup();
  p.casting = { ability: "x", endsAt: 0 };
  p.dead = true;
  const saved = w.save().players.find((s) => s.id === p.id);
  assert.equal(saved.casting, null);
  assert.equal(saved.dead, true);
});
