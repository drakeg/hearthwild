// Instanced copies of the Hollow Crypt: one per party (or per solo adventurer).
// Encounter: three linked trash packs and Vorlath the Ashen Warden, who drops Ashfall circles
// (move out), channels an interruptible Soul Drain, calls acolytes at half health and enrages
// after four minutes. A wipe or abandoning the fight resets the encounter.
import { randomUUID } from "node:crypto";
import { CRYPT, cryptWalkable } from "../public/dungeon-layout.js";
import { mobStats } from "./combat.js";

const EMPTY_RESET = 5 * 60 * 1000;
const NAMES = {
  "ashen-cutthroat": "Crypt cutthroat",
  "ashen-raider": "Crypt raider",
  "ashen-stalker": "Crypt stalker",
  "ashen-hexer": "Crypt hexer",
  "ashen-acolyte": "Ashen acolyte",
};
export const toLocal = (x, z) => ({ x: x - CRYPT.origin.x, z: z - CRYPT.origin.z });
export const toWorld = (x, z) => ({ x: x + CRYPT.origin.x, z: z + CRYPT.origin.z });
export const walkableAt = (x, z) => {
  const l = toLocal(x, z);
  return cryptWalkable(l.x, l.z);
};

export class Crypts {
  constructor(world) {
    this.world = world;
    this.instances = new Map();
  }
  key(p) {
    return p.partyId ? `party:${p.partyId}` : `solo:${p.id}`;
  }
  find(p) {
    // Join a party member's copy if one is already running.
    for (const q of this.world.parties.members(p))
      if (q?.instance && this.instances.has(q.instance)) return this.instances.get(q.instance);
    return [...this.instances.values()].find((i) => i.key === this.key(p)) ?? null;
  }
  enter(p, now, fail) {
    fail(p.instance, "You are already inside.");
    fail(Math.hypot(p.x - CRYPT.door.x, p.z - CRYPT.door.z) > 6, "Move closer to the crypt door.");
    fail((p.combatUntil ?? 0) > now, "You can’t enter while in combat.");
    let inst = this.find(p);
    if (!inst) inst = this.create(this.key(p), this.world.parties.members(p).length, now);
    p.instance = inst.id;
    p.casting = null;
    p.autoAttack = null;
    p.eating = null;
    p.input = { x: 0, z: 0 };
    const e = toWorld(CRYPT.entry.x + (Math.random() - 0.5) * 3, CRYPT.entry.z);
    p.x = e.x;
    p.z = e.z;
    inst.emptySince = null;
    return { message: `You enter ${CRYPT.name}.` };
  }
  exit(p, now, fail) {
    fail(!p.instance, "You aren’t inside a dungeon.");
    const l = toLocal(p.x, p.z);
    fail(Math.hypot(l.x - CRYPT.exit.x, l.z - CRYPT.exit.z) > 5, "Walk back to the crypt entrance to leave.");
    this.leave(p);
    return { message: "You climb back out into Amberwatch Ruins." };
  }
  leave(p) {
    p.instance = null;
    p.casting = null;
    p.autoAttack = null;
    p.input = { x: 0, z: 0 };
    p.x = CRYPT.door.x + (Math.random() - 0.5) * 2;
    p.z = CRYPT.door.z - 2.5;
  }
  create(key, size, now) {
    // Health scales with group size so a solo adventurer can still explore it.
    const factor = Math.max(0.45, Math.min(1.6, size / 3)),
      inst = { id: `${CRYPT.id}:${randomUUID()}`, key, factor, created: now, enemies: [], telegraphs: [], emptySince: null, cleared: false, boss: null };
    CRYPT.packs.forEach((pack, i) => {
      for (const [kind, x, z] of pack) this.spawn(inst, kind, x, z, { level: i === 2 ? 5 : 4, pack: `pack-${i}` });
    });
    inst.boss = this.spawn(inst, "ashen-warden", CRYPT.boss.x, CRYPT.boss.z, {
      level: 6,
      boss: true,
      name: CRYPT.boss.name,
      maxHp: Math.round(1500 * factor),
      damage: 15,
    });
    this.instances.set(inst.id, inst);
    return inst;
  }
  spawn(inst, kind, x, z, { level = 4, pack = null, boss = false, name, maxHp, damage, summoned = false } = {}) {
    const w = toWorld(x, z),
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
    Object.assign(b, { casting: null, enraged: false, summonedAdds: false, fightStart: null, nextAshfall: 0, nextDrain: 0, damageScale: 1 });
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
  tickBoss(inst, inside, now) {
    const b = inst.boss;
    // Resolve Ashfall circles.
    for (const t of inst.telegraphs.filter((t) => now >= t.explodeAt)) {
      for (const p of inside)
        if (!p.dead && Math.hypot(p.x - t.x, p.z - t.z) <= t.radius) this.world.hurtPlayer(p, 38, now, b, "Ashfall");
      this.world.event("ashfall", { x: t.x, z: t.z, radius: t.radius, zone: inst.id }, now);
    }
    inst.telegraphs = inst.telegraphs.filter((t) => now < t.explodeAt);
    if (!b || b.hp <= 0 || b.evading || b.threat.size === 0) return;
    b.fightStart ??= now;
    b.nextAshfall ||= now + 5000;
    b.nextDrain ||= now + 8000;
    const targets = [...b.threat.keys()].map((id) => this.world.players.get(id)).filter((p) => p && !p.dead && p.instance === inst.id);
    if (!targets.length) return;
    if (!b.enraged && now - b.fightStart > 240000) {
      b.enraged = true;
      b.damageScale = 2;
      this.world.event("emote", { text: "Vorlath’s ashes blaze white-hot! (Enraged)", x: b.x, z: b.z, zone: inst.id }, now);
    }
    if (!b.summonedAdds && b.hp <= b.maxHp * 0.5) {
      b.summonedAdds = true;
      this.world.event("emote", { text: "Vorlath calls: “Rise, my acolytes!”", x: b.x, z: b.z, zone: inst.id }, now);
      const l = toLocal(b.x, b.z);
      for (const dx of [-5, 5]) {
        const add = this.spawn(inst, "ashen-cutthroat", l.x + dx, l.z + 3, { level: 5, summoned: true, name: "Ashen acolyte" });
        for (const p of targets) add.threat.set(p.id, 1);
      }
    }
    if (b.casting) {
      if (now >= b.casting.endsAt) {
        const victim = this.world.players.get(b.casting.target);
        if (victim && !victim.dead && victim.instance === inst.id) {
          this.world.hurtPlayer(victim, Math.round(42 * (b.damageScale ?? 1)), now, b, "Soul Drain");
          b.hp = Math.min(b.maxHp, b.hp + Math.round(b.maxHp * 0.05));
        }
        b.casting = null;
      }
      return;
    }
    if (now >= b.nextAshfall) {
      const p = targets[Math.floor(Math.random() * targets.length)];
      const t = { id: randomUUID().slice(0, 8), x: p.x, z: p.z, radius: 4, explodeAt: now + 2600 };
      inst.telegraphs.push(t);
      this.world.event("telegraph", { ...t, zone: inst.id, name: "Ashfall" }, now);
      b.nextAshfall = now + 9000;
    }
    if (now >= b.nextDrain && now >= (b.castLockUntil ?? 0)) {
      const top = [...b.threat.entries()].sort((a, c) => c[1] - a[1])[0];
      b.casting = { name: "Soul Drain", startedAt: now, endsAt: now + 3000, interruptible: true, target: top[0] };
      b.nextDrain = now + 14000;
    }
  }
}
