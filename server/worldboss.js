// The world boss: Gharrowmaw, the Wandering Colossus, a huge beast that roams the Outer Ring.
// When it wakes, the whole world hears of it. It stomps the ground in a telegraphed ring, and
// everyone who helped bring it down earns their own Epic. It wakes again some while after it falls.
import { randomUUID } from "node:crypto";
import { lakeAt, insideHouse, ZONES } from "../public/terrain.js";
import { zoneAt, inSanctuary } from "../public/world-config.js";
import { mobStats } from "./combat.js";

export const WORLD_BOSS = {
  id: "world-boss",
  name: "Gharrowmaw, the Wandering Colossus",
  kind: "colossus",
  level: 32,
  hpScale: 60,
  damageScale: 2.4,
  // It wakes this long after the server starts, then again this long after it falls.
  firstWake: 5 * 60000,
  respawn: 45 * 60000,
  walkSpeed: 1.6,
  // Every so often it rears and stomps: anyone inside the ring when it lands is hurt.
  stomp: { name: "Earthshaker Stomp", radius: 10, delay: 2600, every: 11000, first: 6000, damage: 160 },
  zones: ["ember", "gloam", "dunes", "reach"],
  coins: 220,
};

const RING_ZONES = new Set(WORLD_BOSS.zones);
const open = (x, z) => RING_ZONES.has(zoneAt(x, z)) && !lakeAt(x, z, 2) && !insideHouse(x, z) && !inSanctuary({ x, z });

export class WorldBoss {
  constructor(world, saved = null, now = Date.now()) {
    this.world = world;
    this.boss = null;
    this.telegraphs = [];
    this.wakeAt = saved?.wakeAt ?? now + WORLD_BOSS.firstWake;
  }
  // A random open spot in the Outer Ring, near `from` if given.
  spot(from = null) {
    const r = this.world.random;
    for (let i = 0; i < 400; i++) {
      let x, z;
      if (from) {
        const a = r() * Math.PI * 2,
          d = 60 + r() * 120;
        x = from.x + Math.cos(a) * d;
        z = from.z + Math.sin(a) * d;
      } else {
        const a = r() * Math.PI * 2,
          d = 1150 + r() * 500;
        x = Math.cos(a) * d;
        z = Math.sin(a) * d;
      }
      if (open(x, z)) return { x, z };
    }
    return from ? { x: from.x, z: from.z } : { x: 1300, z: 0 };
  }
  wake(now) {
    const at = this.spot(),
      ms = mobStats(WORLD_BOSS.level);
    const e = {
      id: WORLD_BOSS.id,
      name: WORLD_BOSS.name,
      kind: WORLD_BOSS.kind,
      level: WORLD_BOSS.level,
      boss: true,
      worldBoss: true,
      spec: WORLD_BOSS.id,
      x: at.x,
      z: at.z,
      homeX: at.x,
      homeZ: at.z,
      maxHp: ms.maxHp * WORLD_BOSS.hpScale,
      hp: ms.maxHp * WORLD_BOSS.hpScale,
      damageScale: WORLD_BOSS.damageScale,
      respawnAt: Infinity,
      lastAttack: 0,
      contributors: new Set(),
      threat: new Map(),
      dots: [],
      stunnedUntil: 0,
      waypoint: this.spot(at),
    };
    this.boss = e;
    this.world.enemies.push(e);
    this.world.announce(`The ground trembles: ${WORLD_BOSS.name} has woken in ${ZONES[zoneAt(e.x, e.z)].name}! Gather your allies.`, now);
    return e;
  }
  // Called when the boss falls: tell the world, clear the stage, and set it to wake again.
  fallen(e, now) {
    const names = [...e.contributors].map((id) => this.world.players.get(id)?.name).filter(Boolean);
    this.world.announce(`${WORLD_BOSS.name} has fallen${names.length ? ` to ${names.slice(0, 6).join(", ")}${names.length > 6 ? ` and ${names.length - 6} more` : ""}` : ""}!`, now);
    this.world.enemies = this.world.enemies.filter((o) => o !== e);
    this.boss = null;
    this.telegraphs = [];
    this.wakeAt = now + WORLD_BOSS.respawn;
  }
  tick(now, online, dt) {
    if (!this.boss) {
      if (now >= this.wakeAt) this.wake(now);
      return;
    }
    const b = this.boss,
      s = WORLD_BOSS.stomp;
    // Stomps land.
    for (const t of this.telegraphs.filter((t) => now >= t.explodeAt)) {
      for (const p of online)
        if (!p.dead && !p.instance && Math.hypot(p.x - t.x, p.z - t.z) <= t.radius) this.world.hurtPlayer(p, Math.round(t.damage), now, b, t.name);
      this.world.event("ashfall", { x: t.x, z: t.z, radius: t.radius, name: t.name, zone: null }, now);
    }
    this.telegraphs = this.telegraphs.filter((t) => now < t.explodeAt);
    if (b.hp <= 0) return;
    if (b.threat.size) {
      // In a fight it stays put to stomp, rather than wandering off.
      b.stompAt ??= now + s.first;
      if (now >= b.stompAt && !b.evading) {
        b.stompAt = now + s.every;
        const t = { id: randomUUID().slice(0, 8), x: b.x, z: b.z, radius: s.radius, explodeAt: now + s.delay, name: s.name, damage: s.damage };
        this.telegraphs.push(t);
        this.world.event("emote", { text: `${b.name} rears up to stomp!`, x: b.x, z: b.z, zone: null }, now);
        this.world.event("telegraph", { ...t, zone: null }, now);
      }
      return;
    }
    b.stompAt = null;
    if (b.evading) return;
    // Out of a fight, it wanders: its home walks with it, so it never leashes back.
    const w = b.waypoint,
      d = Math.hypot(w.x - b.x, w.z - b.z);
    if (d < 2) b.waypoint = this.spot(b);
    else {
      const step = Math.min(d, WORLD_BOSS.walkSpeed * dt),
        nx = b.x + ((w.x - b.x) / d) * step,
        nz = b.z + ((w.z - b.z) / d) * step;
      if (open(nx, nz)) {
        b.x = b.homeX = nx;
        b.z = b.homeZ = nz;
      } else b.waypoint = this.spot(b);
    }
  }
  near(p, range = 80) {
    return this.telegraphs.filter((t) => Math.hypot(t.x - p.x, t.z - p.z) < range).map((t) => ({ ...t }));
  }
  // Where it is, for everyone's map, while it's awake.
  where() {
    const b = this.boss;
    return b && b.hp > 0 ? { name: b.name, x: Math.round(b.x), z: Math.round(b.z), zone: zoneAt(b.x, b.z), hp: b.hp / b.maxHp } : null;
  }
  save() {
    return { wakeAt: this.boss ? 0 : this.wakeAt };
  }
}
