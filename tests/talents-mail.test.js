import test from "node:test";
import assert from "node:assert/strict";
import { World } from "../server/world.js";
import { ABILITIES, abilityFor, stats } from "../server/content.js";
import { TALENTS, TALENT_TIERS, withTalents } from "../public/talents.js";
import { ranked } from "../public/ui-model.js";
import { DUNGEON_LOOT } from "../server/content-world.js";

const make = () => new World({}, { combatRandom: () => 0.99 });
let n = 0;
const hero = (w, classId = "warrior", level = 30) => {
  const name = `Pen${String.fromCharCode(97 + (n % 26))}${String.fromCharCode(97 + Math.floor(n / 26))}`;
  n++;
  const a = w.join({ name, faction: "dawnward", classId }),
    p = w.players.get(a.id);
  Object.assign(p, { seen: 1000, level, coins: 200 });
  return { a, p, act: (x, now = 2000) => w.act(a.token, x, now) };
};

test("every class has two talents at levels 10, 20 and 30, each a real change", () => {
  for (const [classId, tiers] of Object.entries(TALENTS))
    for (const tier of TALENT_TIERS) {
      assert.equal(tiers[tier].length, 2, `${classId} ${tier}`);
      for (const x of tiers[tier]) {
        assert.ok(x.mods || x.abilities || x.healing, x.id);
        for (const id of Object.keys(x.abilities ?? {})) assert.ok(ABILITIES[classId].some((b) => b.id === id), `${x.id} → ${id}`);
      }
    }
});

test("talents are chosen once per tier, change stats and abilities, and can be forgotten for gold", () => {
  const w = make(),
    h = hero(w, "warrior", 15),
    before = stats(h.p);
  assert.throws(() => h.act({ type: "talent", tier: 20, id: "unbreakable" }), /level 20/);
  h.act({ type: "talent", tier: 10, id: "bulwark" });
  assert.equal(stats(h.p).maxHp, Math.round(before.maxHp * 1.15));
  assert.throws(() => h.act({ type: "talent", tier: 10, id: "berserker" }), /already chosen/);
  h.p.level = 30;
  h.act({ type: "talent", tier: 20, id: "executioner" });
  h.act({ type: "talent", tier: 30, id: "juggernaut" });
  const blow = ABILITIES.warrior.find((b) => b.id === "crushing-blow"),
    slam = ABILITIES.warrior.find((b) => b.id === "thunder-slam");
  assert.equal(abilityFor(h.p, blow).multiplier, +(ranked(blow, 30).multiplier * 1.25).toFixed(3));
  assert.equal(abilityFor(h.p, slam).stun, ranked(slam, 30).stun + 1000);
  assert.equal(abilityFor(h.p, slam).cooldown, ranked(slam, 30).cooldown - 2000);
  assert.equal(blow.multiplier, 1.9, "the shared ability is untouched");
  // The client sees the same numbers.
  assert.equal(withTalents(ranked(slam, 30), "warrior", h.p.talents).stun, abilityFor(h.p, slam).stun);
  const coins = h.p.coins;
  h.act({ type: "talent", op: "reset" });
  assert.deepEqual(h.p.talents, {});
  assert.equal(h.p.coins, coins - 150);
  assert.equal(w.state(h.a.token, 0, 3000).self.talentResetCost, 150);
});

test("a druid's healing talent strengthens every heal", () => {
  const w = make(),
    h = hero(w, "druid", 10),
    mend = ABILITIES.druid.find((b) => b.id === "mending");
  h.act({ type: "talent", tier: 10, id: "groves-blessing" });
  assert.equal(abilityFor(h.p, mend).heal, Math.round(ranked(mend, 10).heal * 1.15));
});

test("mail carries a letter, gold and an item between characters, from a mailbox", () => {
  const w = make(),
    from = hero(w, "warrior"),
    to = hero(w, "rogue"),
    box = w.npcs.find((x) => x.merchant);
  const sword = { id: "gift-1", template: "warden-blade" };
  from.p.inventory.push(sword);
  Object.assign(from.p, { x: 400, z: 300 });
  assert.throws(() => from.act({ type: "mail", op: "send", to: to.p.name, coins: 5 }), /mailbox/);
  Object.assign(from.p, { x: box.x + 1, z: box.z });
  assert.throws(() => from.act({ type: "mail", op: "send", to: "Nobodyhere", coins: 5 }), /nobody/);
  assert.throws(() => from.act({ type: "mail", op: "send", to: to.p.name, coins: 999 }), /gold/);
  from.act({ type: "mail", op: "send", to: to.p.name.toLowerCase(), subject: "For you", body: "Good luck in the Spire!", coins: 20, item: sword.id });
  assert.equal(from.p.coins, 200 - 21, "20 gold plus 1 postage");
  assert.ok(!from.p.inventory.includes(sword));
  assert.ok(to.p.messages.some((m) => /new mail/.test(m.text)));
  // Away from a mailbox, the recipient only sees that there's unread mail.
  Object.assign(to.p, { x: 0, z: 30 });
  let view = w.state(to.a.token, 0, 3000).self.mail;
  assert.equal(view.unread, 1);
  assert.equal(view.letters.length, 0);
  Object.assign(to.p, { x: box.x, z: box.z + 1 });
  view = w.state(to.a.token, 0, 3000).self.mail;
  const letter = view.letters[0];
  assert.equal(letter.from, from.p.name);
  assert.equal(letter.item.name, "Warden’s iron blade");
  assert.throws(() => to.act({ type: "mail", op: "delete", id: letter.id }), /Take/);
  to.act({ type: "mail", op: "take", id: letter.id });
  assert.equal(to.p.coins, 220);
  assert.ok(to.p.inventory.some((i) => i.id === "gift-1"));
  to.act({ type: "mail", op: "delete", id: letter.id });
  assert.equal(to.p.mail.length, 0);
  // Mail is saved with the world.
  const saved = new World(w.save());
  assert.ok(saved.players.get(to.p.id));
});

test("boss treasure can't be mailed, and equipped gear must come off first", () => {
  const w = make(),
    from = hero(w, "warrior"),
    to = hero(w, "rogue"),
    box = w.npcs.find((x) => x.merchant);
  Object.assign(from.p, { x: box.x + 1, z: box.z });
  from.p.inventory.push({ id: "epic-1", template: DUNGEON_LOOT["harrow-barrow"][0] });
  assert.throws(() => from.act({ type: "mail", op: "send", to: to.p.name, item: "epic-1" }), /boss/);
  const worn = Object.values(from.p.equipment)[0];
  if (worn) assert.throws(() => from.act({ type: "mail", op: "send", to: to.p.name, item: worn }), /Take that off/);
});
