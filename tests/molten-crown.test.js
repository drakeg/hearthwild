import test from "node:test";
import assert from "node:assert/strict";
import { World } from "../server/world.js";
import { BOSSES } from "../server/crypt.js";
import { ITEMS, NPCS, QUESTS } from "../server/content.js";
import { DUNGEON_LOOT } from "../server/content-world.js";
import { eligible } from "../server/finder.js";
import { DUNGEONS, DUNGEON_LIST, walkableIn } from "../public/dungeon-layout.js";
import { zoneAt } from "../public/terrain.js";
import { ACHIEVEMENT } from "../public/achievements.js";

const crown = DUNGEONS["molten-crown"];
const make = () => new World({}, { combatRandom: () => 0.99 });
let n = 0;
const hero = (w, classId = "warrior") => {
  const a = w.join({ name: `Emberguard${String.fromCharCode(97 + n++)}`, faction: "dawnward", classId }),
    p = w.players.get(a.id);
  Object.assign(p, { seen: 1000, level: 30, x: crown.door.x, z: crown.door.z + 1 });
  return { a, p, act: (x, now = 2000) => w.act(a.token, x, now) };
};

test("every raid has three bosses with real fights, its own Epics, a scout and its own place", () => {
  const raids = DUNGEON_LIST.filter((d) => d.raid);
  assert.ok(raids.length >= 2);
  for (const r of raids) {
    assert.equal(r.bosses.length, 3, r.id);
    r.bosses.forEach((b, i) => {
      assert.ok(walkableIn(r, b.x, b.z), `${r.id} boss ${i}`);
      const spec = BOSSES[`${r.id}:${i}`];
      assert.ok(spec.mechanics.length >= 2 && spec.adds && spec.enrage, `${r.id}:${i}`);
      const loot = DUNGEON_LOOT[`${r.id}:${i}`];
      assert.equal(loot.length, 3);
      for (const k of loot) assert.ok(ITEMS[k].rarity === "Epic" && ITEMS[k].raid && ITEMS[k].dungeon === r.id, k);
    });
    assert.equal(QUESTS[NPCS.find((x) => x.dungeon === r.id).quest].boss, r.id);
    assert.ok(eligible(30).includes(r.id) && !eligible(27).includes(r.id));
  }
  // Doors and instance spaces never overlap.
  for (const a of DUNGEON_LIST)
    for (const b of DUNGEON_LIST) {
      if (a === b) continue;
      assert.ok(Math.hypot(a.door.x - b.door.x, a.door.z - b.door.z) > 100, `${a.id} / ${b.id} doors`);
      assert.ok(Math.abs(a.origin.x - b.origin.x) >= 300 || Math.abs(a.origin.z - b.origin.z) >= 300, `${a.id} / ${b.id} space`);
    }
  assert.equal(zoneAt(crown.door.x, crown.door.z), "ember");
});

test("the Molten Crown: a group walks in, fights in order, and its fall counts toward Unbroken", () => {
  const w = make(),
    lead = hero(w),
    friend = hero(w, "druid");
  lead.act({ type: "party", op: "invite", name: friend.p.name });
  friend.act({ type: "party", op: "accept" });
  lead.act({ type: "enter" });
  const inst = w.crypts.instances.get(lead.p.instance);
  assert.ok(lead.p.instance.startsWith("molten-crown:"));
  assert.deepEqual(inst.bosses.map((b) => b.name), crown.bosses.map((b) => b.name));
  const last = inst.boss;
  assert.equal(last.name, "Vulcaris, the Molten King");
  Object.assign(lead.p, { x: last.x + 1, z: last.z, power: 100, hp: 99999 });
  last.hp = 1;
  lead.act({ type: "ability", ability: "iron-cut", target: last.id }, 5000);
  assert.ok(inst.cleared);
  assert.ok(DUNGEON_LOOT["molten-crown:2"].includes(w.loot.find((l) => l.ownerId === lead.p.id).items[0].template));
  // One raid of two toward Unbroken; the Spire would complete it.
  assert.equal(ACHIEVEMENT["all-raids"].progress(lead.p), 1);
  lead.p.tally.cleared["sundered-spire"] = true;
  for (const p of w.players.values()) p.seen = 6000;
  w.tick(0.05, 6000);
  assert.ok(lead.p.achievements["all-raids"] && lead.p.achievements.raid);
});
