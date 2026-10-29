// Groups of up to five adventurers of the same faction. Parties are live-session state
// (not saved): they dissolve on server restart, like an ad-hoc group.
import { randomUUID } from "node:crypto";
export const PARTY_SIZE = 5;
const INVITE_TTL = 60000;

export class Parties {
  constructor(world) {
    this.world = world;
    this.byId = new Map();
  }
  of(p) {
    return p?.partyId ? this.byId.get(p.partyId) ?? null : null;
  }
  members(p) {
    const party = this.of(p);
    return party ? [...party.members].map((id) => this.world.players.get(id)).filter(Boolean) : [p];
  }
  // Party members in the same zone, near enough to share a kill.
  nearby(p, x, z, zone, range = 40) {
    return this.members(p).filter(
      (q) =>
        q &&
        !q.dead &&
        (q.instance ?? null) === (zone ?? null) &&
        Math.hypot(q.x - x, q.z - z) <= range,
    );
  }
  act(p, a, now, fail) {
    const online = (q) => q && now - q.seen < 15000;
    const find = (name) =>
      typeof name === "string"
        ? [...this.world.players.values()].find((q) => q.name.toLowerCase() === name.trim().toLowerCase())
        : null;
    if (a.op === "invite") {
      const q = find(a.name);
      fail(!q || !online(q), "That adventurer isn’t online.");
      fail(q === p, "You can’t invite yourself.");
      fail(q.faction !== p.faction, "You can only group with your own faction.");
      fail(q.partyId, `${q.name} is already in a group.`);
      let party = this.of(p);
      if (party) fail(party.leader !== p.id, "Only the group leader can invite.");
      if (party) fail(party.members.size >= PARTY_SIZE, "Your group is full.");
      if (!party) {
        party = { id: randomUUID(), leader: p.id, members: new Set([p.id]) };
        this.byId.set(party.id, party);
        p.partyId = party.id;
      }
      q.partyInvite = { partyId: party.id, from: p.name, expiresAt: now + INVITE_TTL };
      return { message: `Invited ${q.name} to your group.` };
    }
    if (a.op === "accept") {
      const inv = p.partyInvite,
        party = inv && inv.expiresAt > now ? this.byId.get(inv.partyId) : null;
      p.partyInvite = null;
      fail(!party, "That invitation has expired.");
      fail(p.partyId, "Leave your current group first.");
      fail(party.members.size >= PARTY_SIZE, "That group is full.");
      party.members.add(p.id);
      p.partyId = party.id;
      this.notify(party, `${p.name} joins the group.`, now);
      return { message: "You joined the group." };
    }
    if (a.op === "decline") {
      const inv = p.partyInvite;
      p.partyInvite = null;
      const leader = inv && this.world.players.get(this.byId.get(inv.partyId)?.leader);
      if (leader) this.world.system(leader, `${p.name} declines your group invitation.`, now);
      this.prune(this.byId.get(inv?.partyId));
      return { message: "Invitation declined." };
    }
    if (a.op === "leave") {
      fail(!this.of(p), "You aren’t in a group.");
      this.remove(p, now, `${p.name} leaves the group.`);
      return { message: "You left the group." };
    }
    if (a.op === "kick") {
      const party = this.of(p),
        q = find(a.name);
      fail(!party, "You aren’t in a group.");
      fail(party.leader !== p.id, "Only the group leader can remove members.");
      fail(!q || !party.members.has(q.id) || q === p, "That adventurer isn’t in your group.");
      this.remove(q, now, `${q.name} was removed from the group.`);
      this.world.system(q, "You were removed from the group.", now);
      return { message: `Removed ${q.name} from the group.` };
    }
    if (a.op === "promote") {
      const party = this.of(p),
        q = find(a.name);
      fail(!party || party.leader !== p.id, "Only the group leader can promote.");
      fail(!q || !party.members.has(q.id), "That adventurer isn’t in your group.");
      party.leader = q.id;
      this.notify(party, `${q.name} is now the group leader.`, now);
      return { message: `${q.name} leads the group.` };
    }
    fail(true, "Choose invite, accept, decline, leave, kick or promote.");
  }
  remove(p, now, message) {
    const party = this.of(p);
    if (!party) return;
    party.members.delete(p.id);
    p.partyId = null;
    this.world.leavePartyInstance?.(p, party, now);
    if (party.leader === p.id) party.leader = party.members.values().next().value;
    this.notify(party, message, now);
    this.prune(party);
  }
  // A group of one dissolves.
  prune(party) {
    if (!party || party.members.size > 1) return;
    const hasPendingInvite = [...this.world.players.values()].some((q) => q.partyInvite?.partyId === party.id);
    if (hasPendingInvite && party.members.size === 1) return;
    for (const id of party.members) {
      const q = this.world.players.get(id);
      if (q) q.partyId = null;
    }
    this.byId.delete(party.id);
  }
  notify(party, text, now) {
    for (const id of party.members) {
      const q = this.world.players.get(id);
      if (q) this.world.system(q, text, now);
    }
  }
  view(p, now) {
    const party = this.of(p);
    if (!party) return null;
    return {
      id: party.id,
      leader: party.leader,
      members: [...party.members]
        .map((id) => this.world.players.get(id))
        .filter(Boolean)
        .map((q) => ({
          id: q.id,
          name: q.name,
          classId: q.classId,
          level: q.level,
          hp: Math.ceil(q.hp),
          maxHp: this.world.maxHp(q),
          power: Math.floor(q.power),
          dead: !!q.dead,
          online: now - q.seen < 15000,
          leader: party.leader === q.id,
          x: q.x,
          z: q.z,
          instance: q.instance ?? null,
        })),
    };
  }
}
