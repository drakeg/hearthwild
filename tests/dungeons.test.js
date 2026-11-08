import test from "node:test";
import assert from "node:assert/strict";
import { World } from "../server/world.js";
import { ITEMS, NPCS, QUESTS } from "../server/content.js";
import { DUNGEONS, DUNGEON_LIST, walkableIn, dungeonOf } from "../public/dungeon-layout.js";
import { zoneAt, lakeAt, townAt } from "../public/terrain.js";
import { BOSSES } from "../server/crypt.js";

const make = () => new World({}, { combatRandom: () => 0.99 });
const hero = (w, name = "Delver") => {
  const a = w.join({ name, faction: "dawnward", classId: "warrior" }),
    p = w.players.get(a.id);
  p.seen = 1000;
  return { a, p };
};
const outer = DUNGEON_LIST.filter((d) => d.zone);

test("every zone has a dungeon: a door in the open, a connected layout and its own boss", () => {
  assert.equal(outer.length, 4);
  for (const d of outer) {
    assert.equal(zoneAt(d.door.x, d.door.z), d.zone, `${d.name} door is in its zone`);
    assert.ok(!lakeAt(d.door.x, d.door.z, 8) && !townAt(d.door.x, d.door.z, 20));
    assert.ok(walkableIn(d, d.entry.x, d.entry.z) && walkableIn(d, d.boss.x, d.boss.z));
    for (const [, x, z] of d.packs.flat()) assert.ok(walkableIn(d, x, z), `${d.name} pack at ${x},${z}`);
    assert.ok(BOSSES[d.id].mechanics.length >= 2, `${d.boss.name} has a real fight`);
    // A watcher at the door gives a quest to bring the boss down.
    const scout = NPCS.find((n) => n.dungeon === d.id);
    assert.ok(scout && QUESTS[scout.quest].boss === d.id);
  }
});

test("each dungeon is entered from its own door; creatures and boss match its level band", () => {
  const w = make();
  for (const d of outer) {
    const { a, p } = hero(w, d.id.slice(0, 10));
    p.level = d.levels[0];
    p.x = d.door.x;
    p.z = d.door.z;
    w.state(a.token, 0, 1000);
    w.act(a.token, { type: "enter" }, 1000);
    assert.equal(dungeonOf(p.instance), d);
    const s = w.state(a.token, 0, 1001),
      inst = w.crypts.instances.get(p.instance);
    assert.equal(s.self.subzone, d.name);
    assert.ok(inst.enemies.every((e) => e.level >= d.levels[0]));
    assert.equal(inst.boss.level, d.bossLevel);
    assert.equal(inst.boss.name, d.boss.name);
    assert.ok(s.portals.some((x) => x.type === "exit"));
    // Walk back to the exit and leave by the right door.
    w.act(a.token, { type: "exit" }, 2000);
    assert.equal(p.instance, null);
    assert.ok(Math.hypot(p.x - d.door.x, p.z - d.door.z) < 5);
  }
});

test("bosses use their mechanics, drop their own Epics and complete their quest", () => {
  for (const d of outer) {
    const w = make(),
      { a, p } = hero(w);
    p.level = 20;
    p.hp = 99999;
    const scout = NPCS.find((n) => n.dungeon === d.id);
    p.quests[scout.quest].status = "active";
    p.x = d.door.x;
    p.z = d.door.z;
    w.state(a.token, 0, 1000);
    w.act(a.token, { type: "enter" }, 1000);
    const inst = w.crypts.instances.get(p.instance),
      b = inst.boss;
    for (const e of inst.enemies) if (!e.boss) e.hp = 0;
    p.x = b.x;
    p.z = b.z + 2;
    w.act(a.token, { type: "autoattack", target: b.id }, 10000);
    for (let t = 10050; t < 30000; t += 50) {
      p.seen = t;
      p.hp = 99999;
      w.tick(0.05, t);
    }
    assert.ok(w.events.some((e) => e.kind === "telegraph" && e.zone === inst.id) || b.casting, `${d.boss.name} used a mechanic`);
    // Finish the boss.
    b.hp = 1;
    p.globalReadyAt = 0;
    p.cooldowns = {};
    w.act(a.token, { type: "ability", ability: "iron-cut", target: b.id }, 40000);
    assert.equal(b.hp, 0);
    const drop = w.loot.at(-1);
    assert.ok(drop.items.some((i) => ITEMS[i.template].rarity === "Epic" && ITEMS[i.template].dungeon === d.id), `${d.name} drops its own Epic`);
    assert.equal(p.quests[scout.quest].status, "ready");
  }
});
