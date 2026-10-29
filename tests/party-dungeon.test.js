import test from "node:test";
import assert from "node:assert/strict";
import { World } from "../server/world.js";
import { CRYPT, cryptWalkable, cryptWalls, cryptPillars } from "../public/dungeon-layout.js";
import { toWorld, walkableAt } from "../server/crypt.js";

const make = () => new World({}, { combatRandom: () => 0.99 });
const hero = (w, name, faction = "dawnward", classId = "warrior") => {
  const a = w.join({ name, faction, classId }),
    p = w.players.get(a.id);
  p.seen = 1;
  return { a, p };
};
const at = (p, x, z) => ((p.x = x), (p.z = z));

test("party invitations: same faction only, accept joins, party chat reaches members only", () => {
  const w = make(),
    A = hero(w, "Aster"),
    B = hero(w, "Briar"),
    C = hero(w, "Cedar", "mossbound"),
    D = hero(w, "Dusk");
  for (const x of [A, B, C, D]) w.state(x.a.token, 0, 1000);
  assert.throws(() => w.act(A.a.token, { type: "party", op: "invite", name: "Cedar" }, 1000), /faction/);
  w.act(A.a.token, { type: "party", op: "invite", name: "Briar" }, 1000);
  assert.equal(w.state(B.a.token, 0, 1001).self.partyInvite.from, "Aster");
  w.act(B.a.token, { type: "party", op: "accept" }, 1002);
  const party = w.state(A.a.token, 0, 1003).self.party;
  assert.equal(party.members.length, 2);
  assert.equal(party.leader, A.p.id);
  assert.throws(() => w.act(B.a.token, { type: "party", op: "invite", name: "Dusk" }, 1004), /leader/);
  w.act(B.a.token, { type: "chat", channel: "party", text: "Ready?" }, 2000);
  assert.equal(w.state(A.a.token, 0, 2001).messages.at(-1).text, "Ready?");
  assert.ok(!w.state(D.a.token, 0, 2001).messages.some((m) => m.text === "Ready?"));
  w.act(B.a.token, { type: "party", op: "leave" }, 3000);
  assert.equal(w.state(A.a.token, 0, 3001).self.party, null, "a group of one dissolves");
});

test("nearby party members share kill experience, quest credit and get their own loot", () => {
  const w = make(),
    A = hero(w, "Aster"),
    B = hero(w, "Briar");
  for (const x of [A, B]) w.state(x.a.token, 0, 1000);
  w.act(A.a.token, { type: "party", op: "invite", name: "Briar" }, 1000);
  w.act(B.a.token, { type: "party", op: "accept" }, 1001);
  for (const x of [A, B]) x.p.quests.wildgrowth = { status: "active", progress: 0 };
  const e = w.enemies[0];
  at(A.p, e.x, e.z);
  at(B.p, e.x + 5, e.z);
  e.hp = 10;
  w.act(A.a.token, { type: "ability", ability: "iron-cut", target: e.id }, 2000);
  assert.equal(e.hp, 0);
  assert.equal(B.p.quests.wildgrowth.progress, 1, "the member who didn't hit still gets credit");
  assert.equal(w.state(B.a.token, 0, 2001).loot.length, 1);
  assert.equal(w.state(A.a.token, 0, 2001).loot.length, 1);
  assert.ok(B.p.xp > 0 && A.p.xp > 0);
});

test("the crypt layout is connected and enclosed by walls", () => {
  assert.ok(cryptWalkable(CRYPT.entry.x, CRYPT.entry.z));
  assert.ok(cryptWalkable(0, -12), "passage");
  assert.ok(cryptWalkable(0, -6), "doorway between hall and passage");
  assert.ok(cryptWalkable(CRYPT.boss.x, CRYPT.boss.z));
  assert.ok(!cryptWalkable(8, -10), "solid rock beside the passage");
  for (let z = 4; z > -80; z -= 0.5) assert.ok(cryptWalkable(0, z), `centre line open at ${z}`);
  assert.ok(cryptWalls().length > 40);
  assert.ok(cryptPillars().length > 10);
});

test("each group gets its own crypt copy; walls block movement; leaving returns you outside", () => {
  const w = make(),
    A = hero(w, "Aster"),
    S = hero(w, "Solo");
  for (const x of [A, S]) at(x.p, CRYPT.door.x, CRYPT.door.z), w.state(x.a.token, 0, 1000);
  w.act(A.a.token, { type: "enter" }, 1000);
  w.act(S.a.token, { type: "enter" }, 1000);
  assert.ok(A.p.instance && S.p.instance && A.p.instance !== S.p.instance);
  const sa = w.state(A.a.token, 0, 1001);
  assert.equal(sa.self.subzone, CRYPT.name);
  assert.ok(sa.enemies.length >= 8 && sa.enemies.every((e) => e.instance === A.p.instance));
  assert.ok(!sa.players.some((q) => q.id === S.p.id), "other copies are invisible");
  // Walk sideways into a wall: position must stay walkable.
  w.act(A.a.token, { type: "input", x: 1, z: 0 }, 1100);
  for (let t = 1200; t < 5000; t += 100) w.tick(0.1, t);
  assert.ok(walkableAt(A.p.x, A.p.z));
  const exit = toWorld(CRYPT.exit.x, CRYPT.exit.z);
  at(A.p, exit.x, exit.z);
  w.act(A.a.token, { type: "exit" }, 5100);
  assert.equal(A.p.instance, null);
  assert.ok(Math.hypot(A.p.x - CRYPT.door.x, A.p.z - CRYPT.door.z) < 5);
});

test("pulling one pack member pulls the pack; the boss drops Ashfall, can be interrupted and resets on a wipe", () => {
  const w = make(),
    A = hero(w, "Aster", "dawnward", "rogue");
  A.p.level = 6;
  at(A.p, CRYPT.door.x, CRYPT.door.z);
  w.state(A.a.token, 0, 1000);
  w.act(A.a.token, { type: "enter" }, 1000);
  const inst = w.crypts.instances.get(A.p.instance),
    pack = inst.enemies.filter((e) => e.pack === "pack-1");
  at(A.p, pack[0].x, pack[0].z);
  w.act(A.a.token, { type: "autoattack", target: pack[0].id }, 1100);
  w.tick(0.05, 1150);
  assert.ok(pack.every((e) => e.threat.has(A.p.id)), "whole pack aggroes");
  // Skip to the boss.
  for (const e of inst.enemies) if (!e.boss) e.hp = 0;
  const b = inst.boss;
  at(A.p, b.x, b.z + 2);
  A.p.hp = 9999;
  w.act(A.a.token, { type: "autoattack", target: b.id }, 10000);
  for (let t = 10050; t < 16100; t += 50) w.tick(0.05, t);
  assert.ok(w.events.some((e) => e.kind === "telegraph" && e.zone === inst.id), "Ashfall was telegraphed");
  // Force a Soul Drain cast and interrupt it.
  b.casting = { name: "Soul Drain", startedAt: 16100, endsAt: 19100, interruptible: true, target: A.p.id };
  A.p.power = 100;
  A.p.globalReadyAt = 0;
  A.p.cooldowns = {};
  w.act(A.a.token, { type: "ability", ability: "venom-edge", target: b.id }, 16200);
  assert.equal(b.casting, null);
  assert.ok(w.events.some((e) => e.kind === "interrupted"));
  // Half health calls acolytes.
  b.hp = Math.floor(b.maxHp * 0.49);
  w.tick(0.05, 16300);
  assert.equal(inst.enemies.filter((e) => e.summoned).length, 2);
  // Wipe: the boss evades and resets, removing acolytes.
  w.killPlayer(A.p, 16400);
  for (let t = 16450; t < 40000; t += 100) w.tick(0.1, t);
  assert.equal(b.hp, b.maxHp);
  assert.equal(inst.enemies.filter((e) => e.summoned).length, 0);
  // Releasing inside puts you at the crypt door outside.
  w.act(A.a.token, { type: "release" }, 40100);
  assert.equal(A.p.instance, null);
});

test("defeating the boss grants Epic loot and completes the crypt quest; saves never store dungeon positions", () => {
  const w = make(),
    A = hero(w, "Aster");
  A.p.quests.crypt = { status: "active", progress: 0 };
  at(A.p, CRYPT.door.x, CRYPT.door.z);
  w.state(A.a.token, 0, 1000);
  w.act(A.a.token, { type: "enter" }, 1000);
  const inst = w.crypts.instances.get(A.p.instance),
    b = inst.boss;
  at(A.p, b.x, b.z + 1);
  b.hp = 5;
  w.act(A.a.token, { type: "ability", ability: "iron-cut", target: b.id }, 2000);
  assert.equal(b.hp, 0);
  assert.equal(A.p.quests.crypt.status, "ready");
  const drop = w.state(A.a.token, 0, 2001).loot[0];
  assert.ok(drop.items.some((i) => i.rarity === "Epic"));
  const saved = w.save().players.find((p) => p.id === A.p.id);
  assert.equal(saved.instance, null);
  assert.ok(Math.abs(saved.x) < 100);
});
