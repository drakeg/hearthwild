// Guilds: permanent, saved organisations of one faction, founded with a signed charter.
// Ranks run from 0 (Guild Master) to 3 (Initiate). Officers and the Guild Master manage
// members; only the Guild Master can hand over leadership or disband the guild.
import { randomUUID } from "node:crypto";

export const RANKS = ["Guild Master", "Officer", "Member", "Initiate"];
export const GM = 0,
  OFFICER = 1,
  MEMBER = 2,
  INITIATE = 3;
export const CHARTER_COST = 10;
export const GUILD_LIMIT = 100;
const INVITE_TTL = 60000;
const ONLINE = 15000;
const REGISTRAR_RANGE = 4.5;
const NAME = /^[A-Za-z][A-Za-z']*(?: [A-Za-z][A-Za-z']*)*$/;

export class Guilds {
  constructor(world, saved = [], { signatures = 2 } = {}) {
    this.world = world;
    this.signaturesNeeded = signatures;
    this.byId = new Map();
    for (const g of Array.isArray(saved) ? saved : []) {
      const members = new Map(
        (g.members ?? []).filter(([id]) => world.players.has(id)).map(([id, rank, joined]) => [id, { rank, joined }]),
      );
      if (!members.size) continue;
      const guild = { id: g.id, name: g.name, faction: g.faction, created: g.created ?? 0, motd: g.motd ?? "", members };
      this.byId.set(guild.id, guild);
      for (const id of members.keys()) world.players.get(id).guildId = guild.id;
      // A guild must always have a Guild Master.
      if (![...members.values()].some((m) => m.rank === GM)) this.promoteSuccessor(guild);
    }
  }
  of(p) {
    return p?.guildId ? (this.byId.get(p.guildId) ?? null) : null;
  }
  nameOf(p) {
    return this.of(p)?.name ?? null;
  }
  rank(p) {
    return this.of(p)?.members.get(p.id)?.rank ?? null;
  }
  online(guild, now) {
    return [...guild.members.keys()].map((id) => this.world.players.get(id)).filter((q) => q && now - q.seen < ONLINE);
  }
  nameTaken(name) {
    const n = name.toLowerCase();
    return (
      [...this.byId.values()].some((g) => g.name.toLowerCase() === n) ||
      [...this.world.players.values()].some((q) => q.charter?.name.toLowerCase() === n)
    );
  }
  find(name) {
    return typeof name === "string"
      ? [...this.world.players.values()].find((q) => q.name.toLowerCase() === name.trim().toLowerCase())
      : null;
  }
  nearRegistrar(p) {
    const r = this.world.npcs.find((n) => n.registrar);
    return r && !p.instance && Math.hypot(p.x - r.x, p.z - r.z) <= REGISTRAR_RANGE;
  }
  notify(guild, text, now, maxRank = INITIATE) {
    for (const [id, m] of guild.members) {
      const q = this.world.players.get(id);
      if (q && m.rank <= maxRank) this.world.system(q, text, now);
    }
  }
  // Highest rank, then longest-serving member, inherits the guild.
  promoteSuccessor(guild) {
    const next = [...guild.members.entries()].sort((a, b) => a[1].rank - b[1].rank || a[1].joined - b[1].joined)[0];
    if (next) next[1].rank = GM;
    return next ? this.world.players.get(next[0]) : null;
  }
  removeMember(guild, q, now) {
    guild.members.delete(q.id);
    q.guildId = null;
    if (!guild.members.size) {
      this.byId.delete(guild.id);
      return null;
    }
    if (![...guild.members.values()].some((m) => m.rank === GM)) {
      const heir = this.promoteSuccessor(guild);
      if (heir) this.notify(guild, `${heir.name} is now the Guild Master.`, now);
    }
    return guild;
  }
  act(p, a, now, fail) {
    const online = (q) => q && now - q.seen < ONLINE;
    const guild = this.of(p),
      rank = this.rank(p);
    const target = () => {
      const q = this.find(a.name);
      fail(!q, "There’s no adventurer by that name.");
      return q;
    };
    const member = () => {
      const q = target();
      fail(!guild || !guild.members.has(q.id), `${q.name} isn’t in your guild.`);
      return q;
    };
    switch (a.op) {
      // ---------- Founding ----------
      case "buy-charter": {
        fail(!this.nearRegistrar(p), "Speak to the Guild Registrar at Wayfarer’s Camp.");
        fail(guild, "You are already in a guild.");
        fail(p.charter, "You already carry a guild charter.");
        const name = typeof a.name === "string" ? a.name.trim().replace(/\s+/g, " ") : "";
        fail(name.length < 3 || name.length > 24 || !NAME.test(name), "Guild names are 3–24 letters, spaces or apostrophes.");
        fail(this.nameTaken(name), "That guild name is already taken.");
        fail(p.coins < CHARTER_COST, `A charter costs ${CHARTER_COST} gold.`);
        p.coins -= CHARTER_COST;
        p.charter = { name, signatures: [], created: now };
        return { message: `You bought a charter for “${name}”. Ask ${this.signaturesNeeded} adventurers to sign it.` };
      }
      case "request-signature": {
        fail(!p.charter, "You don’t have a guild charter.");
        const q = target();
        fail(!online(q), `${q.name} isn’t online.`);
        fail(q === p, "You can’t sign your own charter.");
        fail(q.faction !== p.faction, "Only your own faction can sign your charter.");
        fail(q.guildId, `${q.name} is already in a guild.`);
        fail(q.charter, `${q.name} carries a charter of their own.`);
        fail(p.charter.signatures.includes(q.id), `${q.name} has already signed.`);
        q.charterRequest = { from: p.id, fromName: p.name, name: p.charter.name, expiresAt: now + INVITE_TTL };
        return { message: `Asked ${q.name} to sign the charter for “${p.charter.name}”.` };
      }
      case "sign":
      case "decline-signature": {
        const r = p.charterRequest;
        p.charterRequest = null;
        const owner = r && r.expiresAt > now ? this.world.players.get(r.from) : null;
        if (a.op === "decline-signature") {
          if (owner) this.world.system(owner, `${p.name} declines to sign your charter.`, now);
          return { message: "You declined to sign." };
        }
        fail(!owner || !owner.charter || owner.charter.name !== r.name, "That charter is no longer being offered.");
        fail(p.guildId, "You are already in a guild.");
        if (!owner.charter.signatures.includes(p.id)) owner.charter.signatures.push(p.id);
        const n = owner.charter.signatures.length;
        this.world.system(
          owner,
          `${p.name} signed your charter (${n}/${this.signaturesNeeded}).${n >= this.signaturesNeeded ? " Return to the Guild Registrar to found your guild." : ""}`,
          now,
        );
        return { message: `You signed the charter for “${r.name}”.` };
      }
      case "abandon-charter": {
        fail(!p.charter, "You don’t have a guild charter.");
        p.charter = null;
        return { message: "You tore up your charter." };
      }
      case "found": {
        fail(!this.nearRegistrar(p), "Speak to the Guild Registrar at Wayfarer’s Camp.");
        fail(!p.charter, "You need a signed charter first.");
        fail(guild, "You are already in a guild.");
        const signers = p.charter.signatures
          .map((id) => this.world.players.get(id))
          .filter((q) => q && !q.guildId && q.faction === p.faction);
        fail(
          signers.length < this.signaturesNeeded,
          `Your charter needs ${this.signaturesNeeded} signatures (${signers.length} so far).`,
        );
        const g = { id: randomUUID(), name: p.charter.name, faction: p.faction, created: now, motd: "", members: new Map() };
        g.members.set(p.id, { rank: GM, joined: now });
        p.guildId = g.id;
        signers.forEach((q, i) => {
          g.members.set(q.id, { rank: MEMBER, joined: now + i + 1 });
          q.guildId = g.id;
        });
        p.charter = null;
        this.byId.set(g.id, g);
        this.notify(g, `<${g.name}> has been founded! ${p.name} is its Guild Master.`, now);
        return { message: `You founded <${g.name}>.` };
      }
      // ---------- Membership ----------
      case "invite": {
        fail(!guild, "You aren’t in a guild.");
        fail(rank > OFFICER, "Only officers and the Guild Master can invite.");
        fail(guild.members.size >= GUILD_LIMIT, "Your guild is full.");
        const q = target();
        fail(!online(q), `${q.name} isn’t online.`);
        fail(q.faction !== guild.faction, "Guilds only accept their own faction.");
        fail(q.guildId, `${q.name} is already in a guild.`);
        q.guildInvite = { guildId: guild.id, name: guild.name, from: p.name, expiresAt: now + INVITE_TTL };
        return { message: `Invited ${q.name} to <${guild.name}>.` };
      }
      case "accept":
      case "decline": {
        const inv = p.guildInvite;
        p.guildInvite = null;
        const g = inv && inv.expiresAt > now ? this.byId.get(inv.guildId) : null;
        if (a.op === "decline") {
          const from = this.find(inv?.from);
          if (from) this.world.system(from, `${p.name} declines your guild invitation.`, now);
          return { message: "Guild invitation declined." };
        }
        fail(!g, "That guild invitation has expired.");
        fail(p.guildId, "You are already in a guild.");
        fail(g.members.size >= GUILD_LIMIT, "That guild is full.");
        if (p.charter) p.charter = null;
        g.members.set(p.id, { rank: INITIATE, joined: now });
        p.guildId = g.id;
        this.notify(g, `${p.name} has joined the guild.`, now);
        if (g.motd) this.world.system(p, `Guild Message of the Day: ${g.motd}`, now);
        return { message: `Welcome to <${g.name}>.` };
      }
      case "leave": {
        fail(!guild, "You aren’t in a guild.");
        const left = this.removeMember(guild, p, now);
        if (left) this.notify(left, `${p.name} has left the guild.`, now);
        return { message: left ? `You left <${guild.name}>.` : `<${guild.name}> has been disbanded.` };
      }
      case "kick": {
        fail(!guild || rank > OFFICER, "Only officers and the Guild Master can remove members.");
        const q = member();
        fail(q === p, "Use Leave guild to leave.");
        fail(guild.members.get(q.id).rank <= rank, "You can only remove members of lower rank.");
        this.removeMember(guild, q, now);
        this.world.system(q, `You have been removed from <${guild.name}>.`, now);
        this.notify(guild, `${q.name} was removed from the guild by ${p.name}.`, now);
        return { message: `Removed ${q.name}.` };
      }
      case "promote":
      case "demote": {
        fail(!guild || rank > OFFICER, "Only officers and the Guild Master can change ranks.");
        const q = member(),
          m = guild.members.get(q.id);
        fail(q === p, "You can’t change your own rank.");
        fail(m.rank <= rank, "You can only change the rank of members below you.");
        const next = m.rank + (a.op === "promote" ? -1 : 1);
        fail(a.op === "promote" && next <= rank, `${q.name} can’t be promoted to your rank. The Guild Master can pass on leadership instead.`);
        fail(a.op === "demote" && next > INITIATE, `${q.name} is already an ${RANKS[INITIATE]}.`);
        m.rank = next;
        this.notify(guild, `${p.name} ${a.op}d ${q.name} to ${RANKS[next]}.`, now);
        return { message: `${q.name} is now ${RANKS[next]}.` };
      }
      case "leader": {
        fail(!guild || rank !== GM, "Only the Guild Master can pass on leadership.");
        const q = member();
        fail(q === p, "You are already the Guild Master.");
        guild.members.get(q.id).rank = GM;
        guild.members.get(p.id).rank = OFFICER;
        this.notify(guild, `${p.name} has made ${q.name} the Guild Master.`, now);
        return { message: `${q.name} now leads <${guild.name}>.` };
      }
      case "motd": {
        fail(!guild || rank > OFFICER, "Only officers and the Guild Master can set the message of the day.");
        fail(typeof a.text !== "string" || a.text.length > 160 || /[\x00-\x1f\x7f]/.test(a.text), "Keep the message under 160 characters.");
        guild.motd = a.text.trim();
        this.notify(guild, guild.motd ? `Guild Message of the Day: ${guild.motd}` : "The guild message of the day was cleared.", now);
        return { message: "Message of the day updated." };
      }
      case "disband": {
        fail(!guild || rank !== GM, "Only the Guild Master can disband the guild.");
        fail(a.confirm !== guild.name, "Type the guild’s name to confirm.");
        this.notify(guild, `<${guild.name}> has been disbanded by ${p.name}.`, now);
        for (const id of guild.members.keys()) {
          const q = this.world.players.get(id);
          if (q) q.guildId = null;
        }
        this.byId.delete(guild.id);
        return { message: "Guild disbanded." };
      }
    }
    fail(true, "Unknown guild action.");
  }
  // Called when a player's client reconnects after being away.
  cameOnline(p, now) {
    const g = this.of(p);
    if (!g) return;
    const text = `Guild Message of the Day: ${g.motd}`;
    if (g.motd && !p.messages.some((m) => m.text === text && now - m.time < 60000)) this.world.system(p, text, now);
    for (const q of this.online(g, now)) if (q !== p) this.world.system(q, `${p.name} has come online.`, now);
  }
  view(p, now) {
    const g = this.of(p);
    if (!g) return null;
    const rank = this.rank(p);
    return {
      id: g.id,
      name: g.name,
      motd: g.motd,
      created: g.created,
      rank,
      rankName: RANKS[rank],
      ranks: RANKS,
      members: [...g.members.entries()]
        .map(([id, m]) => {
          const q = this.world.players.get(id);
          return q && {
            id,
            name: q.name,
            level: q.level,
            classId: q.classId,
            rank: m.rank,
            online: now - q.seen < ONLINE,
            zone: this.world.zoneName(q),
          };
        })
        .filter(Boolean)
        .sort((a, b) => b.online - a.online || a.rank - b.rank || a.name.localeCompare(b.name)),
    };
  }
  charterView(p) {
    return p.charter
      ? {
          name: p.charter.name,
          needed: this.signaturesNeeded,
          signatures: p.charter.signatures.map((id) => this.world.players.get(id)?.name).filter(Boolean),
        }
      : null;
  }
  save() {
    return [...this.byId.values()].map((g) => ({
      id: g.id,
      name: g.name,
      faction: g.faction,
      created: g.created,
      motd: g.motd,
      members: [...g.members.entries()].map(([id, m]) => [id, m.rank, m.joined]),
    }));
  }
}
