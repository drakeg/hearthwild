// Instanced dungeons: one copy per party (or per solo adventurer) of each dungeon.
// Every dungeon has linked trash packs and a boss whose fight is described as data:
//   circles — ground circles dropped under players (move out);
//   nova    — a ring around the boss itself (step away);
//   channel — an interruptible cast that hurts its target and heals the boss;
//   adds    — helpers called at a health threshold; enrage — harder hits after a time limit.
// A wipe or abandoning the fight resets the encounter.
import { randomUUID } from "node:crypto";
import { CRYPT, DUNGEONS, DUNGEON_LIST, dungeonAt, dungeonOf, walkableIn } from "../public/dungeon-layout.js";
import { mobStats, ZONE_CREATURES } from "./combat.js";

const EMPTY_RESET = 5 * 60 * 1000;
const NAMES = {
  "ashen-cutthroat": "Crypt cutthroat",
  "ashen-raider": "Crypt raider",
  "ashen-stalker": "Crypt stalker",
  "ashen-hexer": "Crypt hexer",
  "ashen-acolyte": "Ashen acolyte",
  ...Object.fromEntries(Object.values(ZONE_CREATURES).flat().map((c) => [c.kind, c.name])),
};
// Boss fights. Damage is given either in points (the Hollow Crypt's originals) or as a
// multiple (times) of a normal creature's swing at the boss's level.
export const BOSSES = {
  "hollow-crypt": {
    hp: 1500,
    damage: 15,
    mechanics: [
      { type: "circles", name: "Ashfall", first: 5000, every: 9000, radius: 4, delay: 2600, damage: 38, count: 1 },
      { type: "channel", name: "Soul Drain", first: 8000, every: 14000, castTime: 3000, damage: 42, heal: 0.05 },
    ],
    adds: { at: 0.5, kind: "ashen-cutthroat", name: "Ashen acolyte", count: 2, level: 5, yell: "Vorlath calls: “Rise, my acolytes!”" },
    enrage: { after: 240000, yell: "Vorlath’s ashes blaze white-hot! (Enraged)" },
  },
  "harrow-barrow": {
    mechanics: [
      { type: "nova", name: "Whirling Hook", first: 6000, every: 11000, radius: 6, delay: 2200, times: 2.2 },
      { type: "circles", name: "Caltrops", first: 9000, every: 13000, radius: 3.5, delay: 2400, times: 1.6, count: 2 },
    ],
    adds: { at: 0.5, kind: "harrow-bandit", name: "Blackhook cutthroat", count: 2, yell: "Gorran bellows: “Lads! To me!”" },
    enrage: { after: 240000, yell: "Gorran Blackhook flies into a rage! (Enraged)" },
  },
  "drowned-chapel": {
    mechanics: [
      { type: "circles", name: "Bog Mire", first: 5000, every: 8000, radius: 4, delay: 2600, times: 2, count: 1 },
      { type: "channel", name: "Drowning Hex", first: 9000, every: 15000, castTime: 3000, times: 2.6, heal: 0.05 },
    ],
    adds: { at: 0.5, kind: "bog-lurker", name: "Chapel lurker", count: 2, yell: "Mother Sallow croons: “Up from the deep, my darlings.”" },
    enrage: { after: 270000, yell: "The water rises around Mother Sallow! (Enraged)" },
  },
  "glassmere-depths": {
    mechanics: [
      { type: "nova", name: "Frost Nova", first: 7000, every: 12000, radius: 7, delay: 2400, times: 2.4 },
      { type: "circles", name: "Ice Shards", first: 4000, every: 10000, radius: 3.5, delay: 2200, times: 1.8, count: 2 },
    ],
    adds: { at: 0.4, kind: "rime-wolf", name: "Glassmere wolf", count: 2, yell: "Hrimgar roars, and the pale wolves answer!" },
    enrage: { after: 300000, yell: "The cold deepens around Hrimgar! (Enraged)" },
  },
  "hollow-peak": {
    mechanics: [
      { type: "circles", name: "Rockfall", first: 5000, every: 9000, radius: 4, delay: 2400, times: 2, count: 3 },
      { type: "channel", name: "Mountain’s Wrath", first: 10000, every: 16000, castTime: 3500, times: 3, heal: 0.05 },
    ],
    adds: { at: 0.5, kind: "greyspire-brigand", name: "Varkesh’s guard", count: 2, yell: "Varkesh calls: “Guards! Hold the summit!”" },
    enrage: { after: 300000, yell: "The mountain shakes with Varkesh’s fury! (Enraged)" },
  },
};
const swing = (level) => mobStats(level).damage;
// Telegraph and channel damage: fixed points, or a multiple of the boss level's normal swing.
const hitOf = (m, level) => m.damage ?? Math.round(swing(level) * m.times);

// Instance-space coordinates. Without a dungeon these refer to the Hollow Crypt.
export const toLocal = (x, z, d = CRYPT) => ({ x: x - d.origin.x, z: z - d.origin.z });
export const toWorld = (x, z, d = CRYPT) => ({ x: x + d.origin.x, z: z + d.origin.z });
export const walkableAt = (x, z) => {
  const d = dungeonAt(x, z);
  if (!d) return false;
  const l = toLocal(x, z, d);
  return walkableIn(d, l.x, l.z);
};

export class Crypts {
  constructor(world) {
    this.world = world;
    this.instances = new Map();
  }
  key(p, d) {
    return `${d.id}|${p.partyId ? `party:${p.partyId}` : `solo:${p.id}`}`;
  }
  find(p, d) {
    // Join a party member's copy of the same dungeon if one is already running.
    for (const q of this.world.parties.members(p)) {
      const inst = q?.instance && this.instances.get(q.instance);
      if (inst && inst.dungeon === d) return inst;
    }
    return [...this.instances.values()].find((i) => i.key === this.key(p, d)) ?? null;
  }
  doorNear(p, range = 6) {
    return DUNGEON_LIST.find((d) => Math.hypot(p.x - d.door.x, p.z - d.door.z) <= range) ?? null;
  }
  enter(p, now, fail) {
    fail(p.instance, "You are already inside.");
    const d = this.doorNear(p);
    fail(!d, "Move closer to the dungeon door.");
    fail((p.combatUntil ?? 0) > now, "You can’t enter while in combat.");
    fail(p.travel, "Wait until the caravan stops.");
    p.mounted = false;
    p.recall = null;
    let inst = this.find(p, d);
    if (!inst) inst = this.create(d, this.key(p, d), this.world.parties.members(p).length, now);
    p.instance = inst.id;
    p.casting = null;
    p.autoAttack = null;
    p.eating = null;
    p.input = { x: 0, z: 0 };
    const e = toWorld(d.entry.x + (Math.random() - 0.5) * 3, d.entry.z, d);
    p.x = e.x;
    p.z = e.z;
    inst.emptySince = null;
    return { message: `You enter ${d.name}.` };
  }
  exit(p, now, fail) {
    const d = dungeonOf(p.instance);
    fail(!p.instance || !d, "You aren’t inside a dungeon.");
    const l = toLocal(p.x, p.z, d);
    fail(Math.hypot(l.x - d.exit.x, l.z - d.exit.z) > 5, "Walk back to the entrance to leave.");
    this.leave(p);
    return { message: "You climb back out into the daylight." };
  }
  leave(p) {
    const d = dungeonOf(p.instance) ?? CRYPT;
    p.instance = null;
    p.casting = null;
    p.autoAttack = null;
    p.input = { x: 0, z: 0 };
    p.x = d.door.x + (Math.random() - 0.5) * 2;
    p.z = d.door.z - 2.5;
  }
  create(d, key, size, now) {
    // Health scales with group size so a solo adventurer can still explore.
    const factor = Math.max(0.45, Math.min(1.6, size / 3)),
      spec = BOSSES[d.id],
      inst = { id: `${d.id}:${randomUUID()}`, dungeon: d, key, factor, created: now, enemies: [], telegraphs: [], emptySince: null, cleared: false, boss: null };
    d.packs.forEach((pack, i) => {
      for (const [kind, x, z] of pack) this.spawn(inst, kind, x, z, { level: i === d.packs.length - 1 ? d.levels[1] : d.levels[0], pack: `pack-${i}` });
    });
    inst.boss = this.spawn(inst, d.boss.kind, d.boss.x, d.boss.z, {
      level: d.bossLevel,
      boss: true,
      name: d.boss.name,
      maxHp: Math.round((spec.hp ?? mobStats(d.bossLevel).maxHp * 7.5) * factor),
      damage: spec.damage ?? Math.round(swing(d.bossLevel) * 0.85),
    });
    this.instances.set(inst.id, inst);
    return inst;
  }
  spawn(inst, kind, x, z, { level = 4, pack = null, boss = false, name, maxHp, damage, summoned = false } = {}) {
    const w = toWorld(x, z, inst.dungeon),
      hp = maxHp ?? Math.round(mobStats(level).maxHp * inst.factor * 1.15),
      e = {
        id: `${inst.id}:${randomUUID().slice(0, 8)}`,
        kind,
        name: name ?? NAMES[kind] ?? kind,
        level,
        x: w.x,
        z: w.z,
        homeX: w.x,
        homeZ: w.z,
        hp,
        maxHp: hp,
        damage: damage ?? null,
        respawnAt: Infinity,
        lastAttack: 0,
        contributors: new Set(),
        threat: new Map(),
        instance: inst.id,
        pack,
        boss,
        summoned,
      };
    inst.enemies.push(e);
    return e;
  }
  // Called when the boss evades: wipe or abandoned fight.
  reset(inst) {
    inst.enemies = inst.enemies.filter((e) => !e.summoned);
    inst.telegraphs = [];
    const b = inst.boss;
    Object.assign(b, { casting: null, enraged: false, summonedAdds: false, fightStart: null, timers: {}, damageScale: 1 });
  }
  tick(now, dt) {
    for (const inst of this.instances.values()) {
      const inside = [...this.world.players.values()].filter((p) => p.instance === inst.id && now - p.seen < 15000);
      if (!inside.length) {
        inst.emptySince ??= now;
        if (now - inst.emptySince > EMPTY_RESET) this.instances.delete(inst.id);
        continue;
      }
      inst.emptySince = null;
      this.tickBoss(inst, inside, now);
    }
  }
  telegraph(inst, b, m, x, z, now) {
    const t = { id: randomUUID().slice(0, 8), x, z, radius: m.radius, explodeAt: now + m.delay, name: m.name, damage: hitOf(m, b.level) };
    inst.telegraphs.push(t);
    this.world.event("telegraph", { ...t, zone: inst.id }, now);
  }
  tickBoss(inst, inside, now) {
    const b = inst.boss,
      spec = BOSSES[inst.dungeon.id],
      yell = (text) => this.world.event("emote", { text, x: b.x, z: b.z, zone: inst.id }, now);
    // Resolve telegraphed circles.
    for (const t of inst.telegraphs.filter((t) => now >= t.explodeAt)) {
      for (const p of inside)
        if (!p.dead && Math.hypot(p.x - t.x, p.z - t.z) <= t.radius)
          this.world.hurtPlayer(p, Math.round(t.damage * (b.damageScale ?? 1)), now, b, t.name);
      this.world.event("ashfall", { x: t.x, z: t.z, radius: t.radius, name: t.name, zone: inst.id }, now);
    }
    inst.telegraphs = inst.telegraphs.filter((t) => now < t.explodeAt);
    if (!b || b.hp <= 0 || b.evading || b.threat.size === 0) return;
    b.fightStart ??= now;
    b.timers ??= {};
    const targets = [...b.threat.keys()].map((id) => this.world.players.get(id)).filter((p) => p && !p.dead && p.instance === inst.id);
    if (!targets.length) return;
    if (!b.enraged && now - b.fightStart > spec.enrage.after) {
      b.enraged = true;
      b.damageScale = 2;
      yell(spec.enrage.yell);
    }
    if (spec.adds && !b.summonedAdds && b.hp <= b.maxHp * spec.adds.at) {
      b.summonedAdds = true;
      yell(spec.adds.yell);
      const l = toLocal(b.x, b.z, inst.dungeon);
      for (const dx of [-5, 5].slice(0, spec.adds.count)) {
        const add = this.spawn(inst, spec.adds.kind, l.x + dx, l.z + 3, {
          level: spec.adds.level ?? inst.dungeon.levels[1],
          summoned: true,
          name: spec.adds.name,
        });
        for (const p of targets) add.threat.set(p.id, 1);
      }
    }
    // A channel in progress: finish it (unless interrupted) before anything else.
    if (b.casting) {
      if (now >= b.casting.endsAt) {
        const victim = this.world.players.get(b.casting.target),
          m = spec.mechanics.find((x) => x.name === b.casting.name) ?? { damage: 42, heal: 0.05 };
        if (victim && !victim.dead && victim.instance === inst.id) {
          this.world.hurtPlayer(victim, Math.round(hitOf(m, b.level) * (b.damageScale ?? 1)), now, b, b.casting.name);
          b.hp = Math.min(b.maxHp, b.hp + Math.round(b.maxHp * (m.heal ?? 0)));
        }
        b.casting = null;
      }
      return;
    }
    for (const [i, m] of spec.mechanics.entries()) {
      b.timers[i] ||= now + m.first;
      if (now < b.timers[i]) continue;
      if (m.type === "channel") {
        if (now < (b.castLockUntil ?? 0)) continue;
        const top = [...b.threat.entries()].sort((a, c) => c[1] - a[1])[0];
        b.casting = { name: m.name, startedAt: now, endsAt: now + m.castTime, interruptible: true, target: top[0] };
        b.timers[i] = now + m.every;
        return;
      }
      if (m.type === "circles")
        for (let k = 0; k < (m.count ?? 1); k++) {
          const p = targets[Math.floor(Math.random() * targets.length)];
          this.telegraph(inst, b, m, p.x + (k ? (Math.random() - 0.5) * 8 : 0), p.z + (k ? (Math.random() - 0.5) * 8 : 0), now);
        }
      if (m.type === "nova") this.telegraph(inst, b, m, b.x, b.z, now);
      b.timers[i] = now + m.every;
    }
  }
}
export { DUNGEONS };
