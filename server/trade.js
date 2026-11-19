// Face-to-face trading. Ask someone standing near you to trade; once they accept, a trade window
// opens for both. Each puts up to six items and some gold on the table. Changing your offer clears
// both confirmations, so nobody can swap something out at the last moment. When both confirm,
// everything changes hands at once — or, if anything no longer fits, nothing does.
// Live-session state: a trade in progress isn't saved.
import { randomUUID } from "node:crypto";
import { ITEMS } from "./content.js";
import { slotsUsed } from "./commerce.js";
import { count as tally } from "./achievements.js";

export const TRADE = { range: 10, maxItems: 6, inviteTime: 30000, bagSlots: 60 };

export class Trades {
  constructor(world) {
    this.world = world;
    this.sessions = new Map(); // trade id → { id, sides: [{ id, items, coins, ok }, …] }
    this.invites = new Map(); // invitee id → { from, at }
  }
  of(p) {
    for (const t of this.sessions.values()) if (t.sides.some((s) => s.id === p.id)) return t;
    return null;
  }
  // Why two players can't trade right now, or null if they can.
  problem(p, q, now) {
    if (!q || now - q.seen >= 15000) return "They’re no longer here.";
    if (q.faction !== p.faction) return "You can only trade with your own faction.";
    if (p.dead || q.dead) return "The dead can’t trade.";
    if (p.instance !== q.instance || p.travel || q.travel) return "You need to be standing together to trade.";
    if (Math.hypot(p.x - q.x, p.z - q.z) > TRADE.range) return `Stand within ${TRADE.range} paces to trade.`;
    return null;
  }
  end(t, text, now) {
    this.sessions.delete(t.id);
    for (const s of t.sides) {
      const q = this.world.players.get(s.id);
      if (q && text) this.world.system(q, text, now);
    }
  }
  act(p, a, now, fail) {
    const t = this.of(p);
    if (a.op === "request") {
      const name = String(a.name ?? "").toLowerCase(),
        q = [...this.world.players.values()].find((o) => o.name.toLowerCase() === name && now - o.seen < 15000);
      fail(!q, "There’s nobody by that name nearby.");
      fail(q === p, "You can’t trade with yourself.");
      fail(t, "You’re already trading.");
      fail(this.of(q), `${q.name} is busy trading.`);
      const why = this.problem(p, q, now);
      fail(why, why);
      this.invites.set(q.id, { from: p.id, at: now });
      this.world.system(q, `${p.name} wants to trade with you.`, now);
      return { message: `You ask ${q.name} to trade.` };
    }
    if (a.op === "accept") {
      const inv = this.invites.get(p.id);
      fail(!inv || now - inv.at > TRADE.inviteTime, "Nobody has asked you to trade.");
      this.invites.delete(p.id);
      const q = this.world.players.get(inv.from);
      fail(t || this.of(q), "One of you is already trading.");
      const why = this.problem(p, q, now);
      fail(why, why);
      const side = (id) => ({ id, items: [], coins: 0, ok: false });
      const id = randomUUID();
      this.sessions.set(id, { id, sides: [side(q.id), side(p.id)] });
      this.world.system(q, `${p.name} accepts. The trade window is open.`, now);
      return { message: `Trading with ${q.name}.` };
    }
    if (a.op === "decline") {
      const inv = this.invites.get(p.id);
      fail(!inv, "Nobody has asked you to trade.");
      this.invites.delete(p.id);
      const q = this.world.players.get(inv.from);
      if (q) this.world.system(q, `${p.name} declines to trade.`, now);
      return { message: "You decline." };
    }
    fail(!t, "You aren’t trading.");
    const mine = t.sides.find((s) => s.id === p.id);
    if (a.op === "cancel") {
      this.end(t, `${p.name} cancelled the trade.`, now);
      return { message: "Trade cancelled." };
    }
    if (a.op === "offer") {
      const items = [...new Set(Array.isArray(a.items) ? a.items : [])],
        coins = Number(a.coins ?? 0);
      fail(items.length > TRADE.maxItems, `Offer up to ${TRADE.maxItems} items.`);
      fail(!Number.isInteger(coins) || coins < 0, "Offer a whole number of gold.");
      fail(coins > p.coins, "You don’t have that much gold.");
      for (const id of items) this.check(p, id, fail);
      mine.items = items;
      mine.coins = coins;
      // Any change to the table means both must look again.
      for (const s of t.sides) s.ok = false;
      return { message: "Offer updated." };
    }
    if (a.op === "confirm") {
      mine.ok = true;
      if (t.sides.every((s) => s.ok)) return this.complete(t, p, now, fail);
      return { message: "Confirmed. Waiting for the other side…" };
    }
    fail(true, "Choose request, accept, decline, offer, confirm or cancel.");
  }
  check(p, id, fail) {
    const item = p.inventory.find((i) => i.id === id);
    fail(!item, "That item isn’t in your bags.");
    fail(Object.values(p.equipment).includes(id), "Take that off before you trade it.");
    fail(ITEMS[item.template]?.dungeon, "Treasure from a dungeon, raid or world boss stays with whoever won it.");
    return item;
  }
  // Everything is checked again, then swapped in one go.
  complete(t, p, now, fail) {
    const [a, b] = t.sides.map((s) => ({ s, q: this.world.players.get(s.id) }));
    const why = this.problem(a.q, b.q, now);
    if (why) {
      this.end(t, `The trade was cancelled: ${why}`, now);
      fail(true, why);
    }
    const reset = (text) => {
      for (const s of t.sides) s.ok = false;
      fail(true, text);
    };
    for (const { s, q } of [a, b]) {
      if (s.coins > q.coins) reset(`${q.name} no longer has that much gold.`);
      for (const id of s.items)
        if (!q.inventory.some((i) => i.id === id) || Object.values(q.equipment).includes(id)) reset(`${q.name}’s offer changed.`);
    }
    // Each side must have room for what they receive, after what they give away.
    for (const [give, get] of [
      [a, b],
      [b, a],
    ]) {
      const after = {
        inventory: [...give.q.inventory.filter((i) => !give.s.items.includes(i.id)), ...get.q.inventory.filter((i) => get.s.items.includes(i.id))],
      };
      if (slotsUsed(after) > TRADE.bagSlots) reset(`${give.q.name}’s bags are too full.`);
    }
    const moving = [a, b].map(({ s, q }) => q.inventory.filter((i) => s.items.includes(i.id)));
    a.q.inventory = a.q.inventory.filter((i) => !a.s.items.includes(i.id)).concat(moving[1]);
    b.q.inventory = b.q.inventory.filter((i) => !b.s.items.includes(i.id)).concat(moving[0]);
    a.q.coins += b.s.coins - a.s.coins;
    b.q.coins += a.s.coins - b.s.coins;
    this.sessions.delete(t.id);
    tally(a.q, "trades");
    tally(b.q, "trades");
    const what = (side, items) => [...items.map((i) => ITEMS[i.template]?.name ?? "an item"), ...(side.coins ? [`${side.coins} gold`] : [])].join(", ") || "nothing";
    this.world.system(a.q, `Trade complete. You received ${what(b.s, moving[1])}.`, now);
    this.world.system(b.q, `Trade complete. You received ${what(a.s, moving[0])}.`, now);
    return { message: "Trade complete." };
  }
  tick(now) {
    for (const [id, inv] of this.invites) if (now - inv.at > TRADE.inviteTime) this.invites.delete(id);
    for (const t of [...this.sessions.values()]) {
      const [a, b] = t.sides.map((s) => this.world.players.get(s.id)),
        why = this.problem(a, b, now);
      if (why) this.end(t, `The trade was cancelled: ${why}`, now);
    }
  }
  // What the trade window shows this player.
  view(p, now) {
    const t = this.of(p),
      inv = this.invites.get(p.id);
    const invite = inv && now - inv.at <= TRADE.inviteTime ? { from: this.world.players.get(inv.from)?.name } : null;
    if (!t) return invite ? { invite } : null;
    const show = (s) => {
      const q = this.world.players.get(s.id);
      return {
        name: q?.name,
        coins: s.coins,
        ok: s.ok,
        items: s.items.map((id) => q?.inventory.find((i) => i.id === id)).filter(Boolean).map((i) => ({ id: i.id, template: i.template, name: ITEMS[i.template]?.name, rarity: ITEMS[i.template]?.rarity, count: i.count })),
      };
    };
    return { invite, mine: show(t.sides.find((s) => s.id === p.id)), theirs: show(t.sides.find((s) => s.id !== p.id)) };
  }
}
