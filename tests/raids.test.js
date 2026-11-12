import test from "node:test";
import assert from "node:assert/strict";
import { World } from "../server/world.js";
import { BOSSES } from "../server/crypt.js";
import { ITEMS, NPCS, QUESTS } from "../server/content.js";
import { DUNGEON_LOOT } from "../server/content-world.js";
import { FINDER, eligible } from "../server/finder.js";
import { DUNGEONS, walkableIn } from "../public/dungeon-layout.js";

const raid = DUNGEONS["sundered-spire"];
const make = () => new World({}, { combatRandom: () => 0.99 });
let n = 0;
const hero = (w, classId = "warrior", level = 30) => {
  const name = `Raider${String.fromCharCode(97 + (n % 26))}${String.fromCharCode(97 + (Math.floor(n / 26) % 26))}`;
  n++;
  const a = w.join({ name, faction: "dawnward", classId }),
    p = w.players.get(a.id);
  Object.assign(p, { seen: 1000, level, x: raid.door.x, z: raid.door.z + 1 });
  return { a, p, act: (x, now = 2000) => w.act(a.token, x, now) };
};

test("the Sundered Spire: three bosses in order, each with a real fight and its own Epics", () => {
  assert.ok(raid.raid && raid.bosses.length === 3);
  raid.bosses.forEach((b, i) => {
    assert.ok(walkableIn(raid, b.x, b.z));
    const spec = BOSSES[`sundered-spire:${i}`];
    assert.ok(spec.mechanics.length >= 2 && spec.adds && spec.enrage);
    const loot = DUNGEON_LOOT[`sundered-spire:${i}`];
    assert.equal(loot.length, 3);
    for (const k of loot) assert.ok(ITEMS[k].rarity === "Epic" && ITEMS[k].raid && ITEMS[k].level === 30);
  });
  // Raid Epics outclass the best dungeon Epics.
  const best = ITEMS[DUNGEON_LOOT.observatory[0]],
    raidWeapon = ITEMS[DUNGEON_LOOT["sundered-spire:2"][0]];
  assert.ok(raidWeapon.damage > best.damage);
  const scout = NPCS.find((x) => x.dungeon === "sundered-spire");
  assert.equal(QUESTS[scout.quest].boss, "sundered-spire");
});

test("raids need a group; groups become raids of up to ten", () => {
  const w = make(),
    lead = hero(w);
  assert.throws(() => lead.act({ type: "enter" }), /raid: form a group/);
  const others = Array.from({ length: 9 }, () => hero(w, "rogue"));
  for (const o of others.slice(0, 4)) {
    lead.act({ type: "party", op: "invite", name: o.p.name });
    o.act({ type: "party", op: "accept" });
  }
  assert.throws(() => lead.act({ type: "party", op: "invite", name: others[4].p.name }), /full/);
  lead.act({ type: "party", op: "raid" });
  for (const o of others.slice(4)) {
    lead.act({ type: "party", op: "invite", name: o.p.name });
    o.act({ type: "party", op: "accept" });
  }
  assert.equal(w.parties.of(lead.p).members.size, 10);
  assert.equal(w.state(lead.a.token, 0, 2000).self.party.size, 10);
  const low = hero(w, "rogue", 20);
  assert.throws(() => low.act({ type: "enter" }), /form a group|level/);
  lead.act({ type: "enter" });
  const inst = w.crypts.instances.get(lead.p.instance);
  assert.equal(inst.bosses.length, 3);
  assert.equal(inst.boss, inst.bosses[2]);
});

test("each boss is fought on its own; only the final boss clears the raid", () => {
  const w = make(),
    lead = hero(w),
    friend = hero(w, "druid");
  lead.act({ type: "party", op: "invite", name: friend.p.name });
  friend.act({ type: "party", op: "accept" });
  lead.act({ type: "enter" });
  const inst = w.crypts.instances.get(lead.p.instance),
    [first, , last] = inst.bosses;
  // Pull the first boss: it casts its own mechanics while the others stay quiet.
  Object.assign(lead.p, { x: first.x + 1, z: first.z, hp: 99999 });
  first.threat.set(lead.p.id, 10);
  for (let t = 3000; t < 20000; t += 200) {
    for (const p of w.players.values()) p.seen = t;
    lead.p.hp = 99999;
    w.tick(0.2, t);
  }
  assert.ok(first.fightStart, "the Gatekeeper fights");
  assert.equal(last.fightStart ?? null, null, "Nythera waits");
  first.hp = 1;
  lead.p.power = 100;
  lead.act({ type: "ability", ability: "iron-cut", target: first.id }, 21000);
  assert.equal(first.hp, 0);
  assert.equal(inst.cleared, false, "one boss down is not the end");
  // The final boss falls: the raid is cleared and its quest completes.
  lead.p.quests[NPCS.find((x) => x.dungeon === "sundered-spire").quest] = { status: "active", progress: 0 };
  Object.assign(lead.p, { x: last.x + 1, z: last.z, power: 100, globalReadyAt: 0 });
  last.hp = 1;
  lead.act({ type: "ability", ability: "iron-cut", target: last.id }, 40000);
  assert.ok(inst.cleared);
});

test("the Dungeon Finder fills raids: two tanks, two healers and six damage", () => {
  const w = make();
  assert.ok(eligible(30).includes("sundered-spire"));
  assert.ok(!eligible(27).includes("sundered-spire"));
  const roles = ["tank", "tank", "healer", "healer", "damage", "damage", "damage", "damage", "damage", "damage"],
    classes = { tank: "warrior", healer: "druid", damage: "rogue" },
    team = roles.map((r) => ({ h: hero(w, classes[r]), r }));
  team.forEach(({ h, r }) => h.act({ type: "finder", op: "queue", dungeons: ["sundered-spire"], role: r }));
  const pr = w.state(team[0].h.a.token, 0, 2000).self.finder.proposal;
  assert.equal(pr?.size, 10);
  for (const { h } of team) h.act({ type: "finder", op: "accept" });
  const party = w.parties.of(team[0].h.p);
  assert.ok(party.raid && party.members.size === 10);
  assert.ok(team.every(({ h }) => h.p.instance === team[0].h.p.instance));
  assert.ok(FINDER.raidRelaxAfter > FINDER.relaxAfter);
});
