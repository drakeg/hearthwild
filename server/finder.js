// The Dungeon Finder: queue for one or more dungeons alone or as a group, choose a role, and
// get matched with others of your faction. When a group is found, everyone gets a ready check;
// when all accept, they're grouped and carried straight into a fresh copy of the dungeon. Leaving
// the dungeon returns each of them to where they queued. Live-session state, like groups.
import { randomUUID } from "node:crypto";
import { DUNGEON_LIST, DUNGEONS } from "../public/dungeon-layout.js";
import { PARTY_SIZE } from "./party.js";

// Which roles each class can fill.
export const ROLES = { warrior: ["tank", "damage"], druid: ["healer", "damage"], warlock: ["damage"], rogue: ["damage"] };
export const FINDER = {
  slots: { tank: 1, healer: 1, damage: 3 },
  readyTime: 40000,
  // After this long in the queue, a smaller group (tank, healer and at least one more) will do.
  relaxAfter: 90000,
  minGroup: 3,
  // The bonus for finishing a dungeon with a group the Finder put together.
  bonus: (level) => ({ coins: 6 * level, xp: 60 * level }),
};
// Dungeons a character may queue for: from one level below the dungeon's first creatures.
export const eligible = (level) => DUNGEON_LIST.filter((d) => level >= (d.levels?.[0] ?? 1) - 1).map((d) => d.id);

export class Finder {
  constructor(world) {
    this.world = world;
    this.queue = new Map(); // entry id → { id, faction, members: [{ id, role }], dungeons, since }
    this.proposals = new Map(); // proposal id → { id, dungeon, entries, accepted, deadline }
  }
  entryOf(p) {
    for (const e of this.queue.values()) if (e.members.some((m) => m.id === p.id)) return e;
    return null;
  }
  proposalOf(p) {
    for (const pr of this.proposals.values()) if (pr.entries.some((e) => e.members.some((m) => m.id === p.id))) return pr;
    return null;
  }
  act(p, a, now, fail) {
    const party = this.world.parties.of(p),
      members = this.world.parties.members(p);
    if (a.op === "role") {
      fail(!ROLES[p.classId].includes(a.role), "Your class can’t take that role.");
      p.finderRole = a.role;
      const e = this.entryOf(p);
      if (e) e.members.find((m) => m.id === p.id).role = a.role;
      return { message: `You’ll queue as ${a.role === "damage" ? "damage" : `a ${a.role}`}.` };
    }
    if (a.op === "queue") {
      fail(this.entryOf(p) || this.proposalOf(p), "You’re already in the Dungeon Finder.");
      fail(party && party.leader !== p.id, "Only your group’s leader can queue the group.");
      fail(members.length >= PARTY_SIZE, "Your group is already full — walk in through the door.");
      fail(!Array.isArray(a.dungeons) || !a.dungeons.length || a.dungeons.length > DUNGEON_LIST.length, "Choose at least one dungeon.");
      const online = (q) => q && now - q.seen < 15000;
      for (const q of members) {
        fail(!online(q), `${q?.name ?? "A group member"} isn’t online.`);
        fail(q.instance, `${q.name} is inside a dungeon.`);
        fail(q.dead, `${q.name} must be alive to queue.`);
        fail(this.entryOf(q) || this.proposalOf(q), `${q.name} is already queued.`);
      }
      for (const id of a.dungeons) {
        fail(!DUNGEONS[id], "Unknown dungeon.");
        for (const q of members) fail(!eligible(q.level).includes(id), `${q.name} is too low a level for ${DUNGEONS[id].name}.`);
      }
      if (a.role) {
        fail(!ROLES[p.classId].includes(a.role), "Your class can’t take that role.");
        p.finderRole = a.role;
      }
      const role = (q) => (ROLES[q.classId].includes(q.finderRole) ? q.finderRole : ROLES[q.classId][0]);
      const entry = { id: randomUUID(), faction: p.faction, members: members.map((q) => ({ id: q.id, role: role(q) })), dungeons: [...new Set(a.dungeons)], since: now };
      // A group can't bring two tanks or two healers.
      const counts = this.counts(entry.members);
      fail(Object.entries(counts).some(([r, n]) => n > FINDER.slots[r]), "Your group has too many of one role for a dungeon group.");
      this.queue.set(entry.id, entry);
      for (const q of members)
        this.world.system(q, `You join the Dungeon Finder as ${role(q) === "damage" ? "damage" : `a ${role(q)}`} for ${entry.dungeons.length === 1 ? DUNGEONS[entry.dungeons[0]].name : `${entry.dungeons.length} dungeons`}.`, now);
      this.match(now);
      return { message: "Searching for a group…" };
    }
    if (a.op === "leave") {
      const e = this.entryOf(p);
      fail(!e, "You aren’t queued.");
      this.queue.delete(e.id);
      for (const m of e.members) {
        const q = this.world.players.get(m.id);
        if (q) this.world.system(q, q === p ? "You leave the Dungeon Finder." : `${p.name} took your group out of the Dungeon Finder.`, now);
      }
      return { message: "You leave the Dungeon Finder." };
    }
    if (a.op === "accept" || a.op === "decline") {
      const pr = this.proposalOf(p);
      fail(!pr, "There’s no group waiting for you.");
      if (a.op === "decline") {
        this.cancel(pr, [p.id], now);
        return { message: "You declined the group." };
      }
      pr.accepted.add(p.id);
      if (pr.accepted.size === this.size(pr)) this.launch(pr, now);
      return { message: "Ready! Waiting for the others…" };
    }
    fail(true, "Choose queue, leave, role, accept or decline.");
  }
  counts(members) {
    const c = { tank: 0, healer: 0, damage: 0 };
    for (const m of members) c[m.role]++;
    return c;
  }
  size(pr) {
    return pr.entries.reduce((n, e) => n + e.members.length, 0);
  }
  // Groups are built for one dungeon at a time, oldest entries first.
  match(now) {
    for (const d of DUNGEON_LIST)
      for (const faction of new Set([...this.queue.values()].map((e) => e.faction))) {
        const waiting = [...this.queue.values()].filter((e) => e.faction === faction && e.dungeons.includes(d.id)).sort((a, b) => a.since - b.since);
        if (!waiting.length) continue;
        const picked = [],
          have = { tank: 0, healer: 0, damage: 0 };
        for (const e of waiting) {
          const c = this.counts(e.members);
          if (Object.keys(c).some((r) => have[r] + c[r] > FINDER.slots[r])) continue;
          picked.push(e);
          for (const r of Object.keys(c)) have[r] += c[r];
          if (have.tank + have.healer + have.damage === PARTY_SIZE) break;
        }
        const size = have.tank + have.healer + have.damage,
          relaxed = now - waiting[0].since >= FINDER.relaxAfter && picked.includes(waiting[0]) && size >= FINDER.minGroup && have.tank && have.healer;
        if (size === PARTY_SIZE || relaxed) this.propose(d, picked, now);
      }
  }
  propose(d, entries, now) {
    const pr = { id: randomUUID(), dungeon: d.id, entries, accepted: new Set(), deadline: now + FINDER.readyTime };
    for (const e of entries) this.queue.delete(e.id);
    this.proposals.set(pr.id, pr);
    for (const e of entries)
      for (const m of e.members) {
        const q = this.world.players.get(m.id);
        if (q) this.world.system(q, `A group for ${d.name} is ready — accept to enter!`, now);
      }
  }
  // Anyone who declines (or lets the ready check run out) leaves the queue; everyone else keeps
  // their place.
  cancel(pr, refused, now) {
    this.proposals.delete(pr.id);
    for (const e of pr.entries) {
      const out = e.members.some((m) => refused.includes(m.id));
      if (!out) this.queue.set(e.id, e);
      for (const m of e.members) {
        const q = this.world.players.get(m.id);
        if (!q) continue;
        if (out) this.world.system(q, refused.includes(m.id) ? "You left the Dungeon Finder." : "Someone in your group declined; you left the Dungeon Finder.", now);
        else this.world.system(q, "Someone declined the group. You keep your place in the queue.", now);
      }
    }
  }
  launch(pr, now) {
    this.proposals.delete(pr.id);
    const d = DUNGEONS[pr.dungeon],
      w = this.world,
      players = pr.entries.flatMap((e) => e.members.map((m) => ({ q: w.players.get(m.id), role: m.role }))).filter((x) => x.q);
    // Everyone joins one fresh group, led by the tank (or whoever queued first).
    for (const { q } of players) if (w.parties.of(q)) w.parties.remove(q, now, `${q.name} leaves for the Dungeon Finder.`);
    const leader = (players.find((x) => x.role === "tank") ?? players[0]).q,
      party = { id: randomUUID(), leader: leader.id, members: new Set(players.map((x) => x.q.id)), finder: d.id };
    w.parties.byId.set(party.id, party);
    for (const { q, role } of players) {
      q.partyId = party.id;
      q.finderReturn = { x: q.x, z: q.z };
      q.finderRoleIn = role;
      w.crypts.place(q, d, now);
      w.system(q, `The Dungeon Finder brings you to ${d.name}. Your group: ${players.map((x) => `${x.q.name} (${x.role})`).join(", ")}.`, now);
    }
  }
  tick(now) {
    for (const pr of [...this.proposals.values()]) {
      const gone = pr.entries.flatMap((e) => e.members).filter((m) => {
        const q = this.world.players.get(m.id);
        return !q || now - q.seen >= 15000 || q.dead || q.instance;
      });
      if (gone.length) this.cancel(pr, gone.map((m) => m.id), now);
      else if (now > pr.deadline) this.cancel(pr, pr.entries.flatMap((e) => e.members).filter((m) => !pr.accepted.has(m.id)).map((m) => m.id), now);
    }
    for (const e of [...this.queue.values()])
      if (e.members.some((m) => {
        const q = this.world.players.get(m.id);
        return !q || now - q.seen >= 15000 || q.instance;
      }))
        this.queue.delete(e.id);
    this.match(now);
  }
  // What the player's Finder window shows.
  view(p, now) {
    const e = this.entryOf(p),
      pr = this.proposalOf(p),
      waiting = [...this.queue.values()].filter((o) => o.faction === p.faction);
    return {
      roles: ROLES[p.classId],
      role: ROLES[p.classId].includes(p.finderRole) ? p.finderRole : ROLES[p.classId][0],
      eligible: eligible(p.level),
      queued: e && { dungeons: e.dungeons, since: e.since, group: e.members.length > 1, leader: this.world.parties.of(p)?.leader === p.id || e.members.length === 1 },
      // How many of each role are waiting for the dungeons you chose: a hint at what's needed.
      waiting: e ? this.counts(waiting.filter((o) => o.dungeons.some((d) => e.dungeons.includes(d))).flatMap((o) => o.members)) : null,
      proposal: pr && {
        dungeon: pr.dungeon,
        deadline: pr.deadline,
        total: FINDER.readyTime,
        size: this.size(pr),
        accepted: pr.accepted.size,
        ready: pr.accepted.has(p.id),
        members: pr.entries.flatMap((x) => x.members).map((m) => ({ name: this.world.players.get(m.id)?.name, role: m.role })),
      },
      inFinderGroup: !!this.world.parties.of(p)?.finder,
    };
  }
}
