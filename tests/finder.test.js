import test from "node:test";
import assert from "node:assert/strict";
import { World } from "../server/world.js";
import { FINDER, eligible } from "../server/finder.js";
import { DUNGEONS } from "../public/dungeon-layout.js";

const make = () => new World({}, { combatRandom: () => 0.99 });
let n = 0;
const hero = (w, classId, level = 12, extra = {}) => {
  const name = `Seeker${String.fromCharCode(97 + (n % 26))}${String.fromCharCode(97 + (Math.floor(n / 26) % 26))}`;
  n++;
  const a = w.join({ name, faction: "dawnward", classId }),
    p = w.players.get(a.id);
  Object.assign(p, { seen: 1000, level, x: 20 + n, z: 30 }, extra);
  return { a, p, act: (x, now = 2000) => w.act(a.token, x, now), view: (now = 2000) => w.state(a.token, 0, now).self.finder };
};
const keepOnline = (w, now) => {
  for (const p of w.players.values()) p.seen = now;
};
const five = (w) => [hero(w, "warrior"), hero(w, "druid"), hero(w, "rogue"), hero(w, "warlock"), hero(w, "rogue")];

test("five adventurers queue, accept the ready check, and enter one fresh dungeon together", () => {
  const w = make(),
    team = five(w);
  team[0].act({ type: "finder", op: "queue", dungeons: ["harrow-barrow"], role: "tank" });
  team[1].act({ type: "finder", op: "queue", dungeons: ["harrow-barrow", "drowned-chapel"], role: "healer" });
  for (const h of team.slice(2, 4)) h.act({ type: "finder", op: "queue", dungeons: ["harrow-barrow"] });
  assert.ok(team[0].view().queued, "queued");
  assert.equal(team[0].view().proposal, null);
  const home = { x: team[4].p.x, z: team[4].p.z };
  team[4].act({ type: "finder", op: "queue", dungeons: ["drowned-chapel", "harrow-barrow"] });
  const pr = team[0].view().proposal;
  assert.ok(pr && pr.dungeon === "harrow-barrow" && pr.size === 5, "a group of five is proposed");
  assert.deepEqual(pr.members.map((m) => m.role).sort(), ["damage", "damage", "damage", "healer", "tank"]);
  for (const h of team) h.act({ type: "finder", op: "accept" });
  const instance = team[0].p.instance;
  assert.ok(instance && instance.startsWith("harrow-barrow:"));
  for (const h of team) {
    assert.equal(h.p.instance, instance, `${h.p.name} is inside the same copy`);
    assert.equal(h.p.partyId, team[0].p.partyId);
  }
  assert.equal(w.parties.of(team[0].p).leader, team[0].p.id, "the tank leads");
  assert.ok(team[0].view().inFinderGroup);
  // Walking out through the portal takes you back to where you queued.
  const d = DUNGEONS["harrow-barrow"],
    p = team[4].p;
  Object.assign(p, { x: d.origin.x + d.exit.x, z: d.origin.z + d.exit.z });
  team[4].act({ type: "exit" });
  assert.deepEqual({ x: p.x, z: p.z }, home);
  assert.equal(p.instance, null);
});

test("declining or ignoring the ready check removes only those who didn't accept", () => {
  const w = make(),
    team = five(w);
  team.forEach((h, i) => h.act({ type: "finder", op: "queue", dungeons: ["harrow-barrow"], role: i === 0 ? "tank" : i === 1 ? "healer" : "damage" }));
  assert.ok(team[0].view().proposal);
  team[2].act({ type: "finder", op: "decline" });
  assert.equal(team[2].view().queued, null, "the decliner is out");
  assert.ok(team[0].view().queued, "the others keep their place");
  // A newcomer completes the group again; this time one just never answers.
  const late = hero(w, "warlock");
  late.act({ type: "finder", op: "queue", dungeons: ["harrow-barrow"] });
  assert.ok(late.view().proposal);
  for (const h of [team[0], team[1], team[3], team[4]]) h.act({ type: "finder", op: "accept" });
  keepOnline(w, 2000 + FINDER.readyTime + 2000);
  w.tick(0.05, 2000 + FINDER.readyTime + 2000);
  assert.equal(late.view(2000 + FINDER.readyTime + 2100).queued, null);
  assert.ok(team[0].view(2000 + FINDER.readyTime + 2100).queued);
  assert.equal(team[0].p.instance ?? null, null);
});

test("after a long wait, a tank, a healer and one more will do", () => {
  const w = make(),
    trio = [hero(w, "warrior"), hero(w, "druid"), hero(w, "rogue")];
  trio.forEach((h, i) => h.act({ type: "finder", op: "queue", dungeons: ["hollow-crypt"], role: ["tank", "healer", "damage"][i] }, 1000));
  keepOnline(w, 30000);
  w.tick(0.05, 30000);
  assert.equal(trio[0].view(30000).proposal, null, "not yet");
  const later = 1000 + FINDER.relaxAfter + 1000;
  keepOnline(w, later);
  w.tick(0.05, later);
  assert.equal(trio[0].view(later).proposal?.size, 3);
});

test("a group queues together, and the rules keep groups sensible", () => {
  const w = make(),
    lead = hero(w, "warrior"),
    friend = hero(w, "druid");
  lead.act({ type: "party", op: "invite", name: friend.p.name });
  friend.act({ type: "party", op: "accept" });
  assert.throws(() => friend.act({ type: "finder", op: "queue", dungeons: ["harrow-barrow"] }), /leader/);
  friend.act({ type: "finder", op: "role", role: "healer" });
  lead.act({ type: "finder", op: "queue", dungeons: ["harrow-barrow"], role: "tank" });
  assert.ok(friend.view().queued?.group);
  const dps = [hero(w, "rogue"), hero(w, "warlock"), hero(w, "rogue")];
  for (const h of dps) h.act({ type: "finder", op: "queue", dungeons: ["harrow-barrow"] });
  assert.equal(lead.view().proposal?.size, 5);
  // Class roles, levels and places are checked.
  const rogue = hero(w, "rogue");
  assert.throws(() => rogue.act({ type: "finder", op: "role", role: "healer" }), /role/);
  const low = hero(w, "rogue", 3);
  assert.throws(() => low.act({ type: "finder", op: "queue", dungeons: ["hollow-peak"] }), /too low/);
  assert.deepEqual(eligible(3), ["hollow-crypt"]);
  assert.ok(eligible(30).length >= 9);
});

test("finishing a Finder dungeon pays a satchel; leaving the group sends you home", () => {
  const w = make(),
    team = five(w);
  team.forEach((h, i) => h.act({ type: "finder", op: "queue", dungeons: ["hollow-crypt"], role: i === 0 ? "tank" : i === 1 ? "healer" : "damage" }));
  for (const h of team) h.act({ type: "finder", op: "accept" });
  const home = { x: team[3].p.x, z: team[3].p.z };
  team[3].p.finderReturn = { ...home };
  const inst = w.crypts.instances.get(team[0].p.instance),
    boss = inst.boss,
    xp = team[0].p.xp,
    coins = team[0].p.coins;
  Object.assign(team[0].p, { x: boss.x + 1, z: boss.z, power: 100 });
  boss.hp = 1;
  team[0].act({ type: "ability", ability: "iron-cut", target: boss.id }, 5000);
  assert.equal(boss.hp, 0, "the boss falls");
  const bonus = FINDER.bonus(inst.dungeon.bossLevel);
  assert.ok(team[0].p.coins >= coins + bonus.coins);
  assert.ok(team[0].p.xp !== xp || team[0].p.level > 12);
  // Leaving the Finder group from inside returns you where you queued.
  team[3].act({ type: "party", op: "leave" }, 6000);
  assert.equal(team[3].p.instance, null);
  assert.deepEqual({ x: team[3].p.x, z: team[3].p.z }, home);
});
