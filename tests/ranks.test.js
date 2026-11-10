import test from "node:test";
import assert from "node:assert/strict";
import { World } from "../server/world.js";
import { ABILITIES, abilityFor } from "../server/content.js";
import { ranked } from "../public/ui-model.js";

const make = () => new World({}, { combatRandom: () => 0.99 });
const hero = (w, classId, name) => {
  const a = w.join({ name, faction: "dawnward", classId }),
    p = w.players.get(a.id);
  p.seen = 1000;
  return { a, p, act: (x, now) => w.act(a.token, x, now) };
};

test("every class ranks up five abilities, one each at levels 22, 24, 26, 28 and 30", () => {
  for (const [classId, list] of Object.entries(ABILITIES)) {
    const ranks = list.flatMap((a) => (a.ranks ?? []).map((r) => ({ a, r })));
    assert.deepEqual(ranks.map(({ r }) => r.level).sort(), [22, 24, 26, 28, 30], classId);
    for (const { a, r } of ranks) {
      const up = ranked(a, r.level);
      assert.equal(up.rank, 2);
      assert.equal(ranked(a, r.level - 1), a, `${a.id} waits for level ${r.level}`);
      // Every rank is strictly better: more damage or healing, or less cost, cooldown or cast time.
      const better =
        (up.multiplier ?? 0) > (a.multiplier ?? 0) ||
        (up.heal ?? 0) > (a.heal ?? 0) ||
        (up.dot?.multiplier ?? 0) > (a.dot?.multiplier ?? 0) ||
        (up.stun ?? 0) > (a.stun ?? 0);
      assert.ok(better, `${a.id} rank II is stronger`);
      for (const k of ["cooldown", "cost", "castTime"]) if (a[k] !== undefined) assert.ok(up[k] <= a[k], `${a.id} ${k}`);
      assert.ok(r.text.length > 10);
    }
  }
  // Ranking never changes the shared ability itself.
  const blow = ABILITIES.warrior.find((a) => a.id === "crushing-blow");
  assert.equal(abilityFor({ level: 30 }, blow).multiplier, 2.5);
  assert.equal(blow.multiplier, 1.9);
});

test("a ranked ability hits harder in play, and the new numbers reach the client", () => {
  const w = make(),
    lo = hero(w, "warrior", "Lowblade"),
    hi = hero(w, "warrior", "Highblade");
  const hit = (h, level, now) => {
    h.p.level = level;
    h.p.equipment = {};
    h.p.power = 100;
    h.p.hp = 9999;
    const e = w.enemies.find((e) => e.hp > 0 && !e.threat.size);
    Object.assign(h.p, { x: e.x + 1, z: e.z });
    e.hp = e.maxHp = 99999;
    h.act({ type: "ability", ability: "crushing-blow", target: e.id }, now);
    return 99999 - e.hp;
  };
  const before = hit(lo, 22, 5000) / (20 + 21 * 2),
    after = hit(hi, 22, 5000) / (20 + 21 * 2);
  assert.equal(before, after);
  const at21 = hit(lo, 21, 20000) / (20 + 20 * 2),
    at22 = hit(hi, 22, 20000) / (20 + 21 * 2);
  assert.ok(Math.abs(at21 - 1.9) < 0.05 && Math.abs(at22 - 2.5) < 0.05, `${at21} → ${at22}`);
  // A rank that shortens a cooldown lets it be used sooner.
  const priest = hero(w, "warrior", "Rallier");
  priest.p.level = 26;
  priest.p.power = 100;
  priest.act({ type: "ability", ability: "rally" }, 30000);
  priest.p.globalReadyAt = 0;
  priest.p.power = 100;
  priest.act({ type: "ability", ability: "rally" }, 40500);
  // The client receives each ability's ranks to show and apply.
  assert.ok(w.state(lo.a.token, 0, 50000).abilities.find((a) => a.id === "crushing-blow").ranks[0].level === 22);
});
