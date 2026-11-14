// Mail: send a letter, gold and one item to any character, from a mailbox (any provisioner's
// counter). Letters wait in the recipient's mailbox until they take what's attached. Saved with
// the world, like everything else a character owns.
import { randomUUID } from "node:crypto";
import { ITEMS } from "./content.js";

export const MAIL = { postage: 1, mailboxRange: 8, maxLetters: 50, maxText: 500, maxSubject: 60, keepDays: 30 };
const clean = (s, max) => String(s ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max);

export class Mail {
  constructor(world) {
    this.world = world;
  }
  nearMailbox(p) {
    return !p.instance && this.world.npcs.some((n) => n.merchant && Math.hypot(n.x - p.x, n.z - p.z) <= MAIL.mailboxRange);
  }
  // Old letters with nothing attached are cleared away after a month.
  tidy(p, now) {
    p.mail = (p.mail ?? []).filter((m) => m.coins || m.item || now - m.sentAt < MAIL.keepDays * 86400000);
  }
  act(p, a, now, fail) {
    fail(!this.nearMailbox(p), "Find a mailbox: every provisioner keeps one at their counter.");
    this.tidy(p, now);
    if (a.op === "send") {
      const name = clean(a.to, 24).toLowerCase(),
        to = [...this.world.players.values()].find((q) => q.name.toLowerCase() === name);
      fail(!to, "There’s nobody by that name in this world.");
      fail(to === p, "You can’t mail yourself.");
      to.mail ??= [];
      fail(to.mail.length >= MAIL.maxLetters, `${to.name}’s mailbox is full.`);
      const coins = Number(a.coins ?? 0);
      fail(!Number.isInteger(coins) || coins < 0, "Send a whole number of gold.");
      fail(coins + MAIL.postage > p.coins, `You need ${coins + MAIL.postage} gold (including ${MAIL.postage} for postage).`);
      let item = null;
      if (a.item) {
        item = p.inventory.find((i) => i.id === a.item);
        fail(!item, "Choose an item from your bags.");
        fail(Object.values(p.equipment).includes(item.id), "Take that off before you send it.");
        // Treasure won from dungeon and raid bosses stays with whoever won it.
        fail(ITEMS[item.template]?.dungeon, "Treasure from a dungeon or raid boss can’t be mailed.");
      }
      const subject = clean(a.subject, MAIL.maxSubject) || (item ? ITEMS[item.template].name : coins ? `${coins} gold` : "A letter"),
        body = clean(a.body, MAIL.maxText);
      fail(!coins && !item && !body, "Write something, or attach gold or an item.");
      p.coins -= coins + MAIL.postage;
      if (item) p.inventory = p.inventory.filter((i) => i !== item);
      to.mail.push({ id: randomUUID(), from: p.name, subject, body, coins, item, sentAt: now, read: false });
      if (now - to.seen < 15000) this.world.system(to, `You have new mail from ${p.name}. Visit a provisioner’s mailbox to read it.`, now);
      return { message: `Sent to ${to.name}.` };
    }
    const letter = (p.mail ?? []).find((m) => m.id === a.id);
    fail(!letter, "That letter isn’t in your mailbox.");
    if (a.op === "read") {
      letter.read = true;
      return { ok: true };
    }
    if (a.op === "take") {
      fail(!letter.coins && !letter.item, "There’s nothing attached.");
      if (letter.item) {
        fail(p.inventory.length >= 60, "Your bag is full.");
        p.inventory.push(letter.item);
      }
      p.coins += letter.coins;
      const got = [letter.coins && `${letter.coins} gold`, letter.item && ITEMS[letter.item.template].name].filter(Boolean).join(" and ");
      letter.coins = 0;
      letter.item = null;
      letter.read = true;
      return { message: `Took ${got}.` };
    }
    if (a.op === "delete") {
      fail(letter.coins || letter.item, "Take what’s attached first.");
      p.mail = p.mail.filter((m) => m !== letter);
      return { ok: true };
    }
    fail(true, "Choose send, read, take or delete.");
  }
  // What the player's mailbox shows: the letters themselves only at a mailbox.
  view(p) {
    const letters = p.mail ?? [],
      here = this.nearMailbox(p);
    return {
      unread: letters.filter((m) => !m.read).length,
      atMailbox: here,
      letters: here
        ? [...letters].reverse().map((m) => ({ ...m, item: m.item ? { id: m.item.id, template: m.item.template, name: ITEMS[m.item.template]?.name, rarity: ITEMS[m.item.template]?.rarity } : null }))
        : [],
    };
  }
}
