import { ITEMS, stats } from "./content.js";
import { randomUUID } from "node:crypto";
import { GEAR_PRICES } from "./content-world.js";
import { REAGENTS, POUCH_LIMIT } from "../public/reagents.js";
export const PRICES = {
  // Zone gear: sold to merchants, never stocked (buy price null).
  ...GEAR_PRICES,
  "warden-blade": [24, 6],
  "grove-coat": [30, 8],
  "amber-charm": [20, 5],
  thornblade: [80, 20],
  "ironbark-mail": [90, 22],
  moonstone: [65, 16],
  "healing-draught": [8, 2],
  "travelers-bread": [3, 1],
  "spring-water": [3, 1],
  "greater-draught": [18, 5],
  "amber-tonic": [null, 8],
  "mire-salve": [null, 10],
  "frostbloom-elixir": [null, 12],
  "stoneheart-draught": [null, 14],
  "ember-draught": [null, 16],
  "gloamcap-brew": [null, 18],
  "sunpetal-cordial": [null, 20],
  "starlight-elixir": [null, 24],
};
export const RECIPES = {
  "healing-draught": { name: "Starleaf healing draught", herbs: { starleaf: 2 }, skill: 1, heal: 60 },
  "greater-draught": { name: "Greater Starleaf draught", herbs: { starleaf: 4 }, skill: 5, heal: 110 },
  "amber-tonic": { name: "Amberroot tonic", herbs: { amberroot: 2, starleaf: 1 }, skill: 12, heal: 150 },
  "mire-salve": { name: "Bog myrtle salve", herbs: { bogmyrtle: 3 }, skill: 20, heal: 190 },
  "frostbloom-elixir": { name: "Frostbloom elixir", herbs: { frostbloom: 2, bogmyrtle: 1 }, skill: 30, heal: 230 },
  "stoneheart-draught": { name: "Stoneheart draught", herbs: { stonemoss: 3 }, skill: 40, heal: 280 },
  "ember-draught": { name: "Emberthorn draught", herbs: { emberthorn: 2, stonemoss: 1 }, skill: 50, heal: 320 },
  "gloamcap-brew": { name: "Gloamcap brew", herbs: { gloamcap: 3 }, skill: 60, heal: 370 },
  "sunpetal-cordial": { name: "Sunpetal cordial", herbs: { sunpetal: 2, gloamcap: 1 }, skill: 70, heal: 420 },
  "starlight-elixir": { name: "Starlight elixir", herbs: { starlily: 2, sunpetal: 1 }, skill: 80, heal: 480 },
};
const requireThat = (ok, message) => {
  if (!ok) throw Object.assign(new Error(message), { status: 400 });
};
// Herbs free to sell or brew: four Starleaf stay reserved while the gathering quest is active.
export function surplus(p, kind = "starleaf") {
  return Math.max(
    0,
    (p.materials[kind] ?? 0) -
      (kind === "starleaf" && ["active", "ready"].includes(p.quests.starleaf.status) ? 4 : 0),
  );
}
export function commerce(p, a, npcs, now) {
  if (!["buy", "sell", "buyback", "learn", "craft", "consume"].includes(a.type))
    return null;
  if (["buy", "sell", "buyback", "learn"].includes(a.type)) {
    const npc = npcs.find((n) => n.id === a.vendor);
    requireThat(npc?.merchant, "Choose a merchant.");
    requireThat(
      Math.hypot(p.x - npc.x, p.z - npc.z) <= 4.5,
      "Move closer to the merchant.",
    );
    requireThat(p.talkedNpc === npc.id, "Talk to the merchant first.");
  }
  const room = (template) =>
    requireThat(slotsUsed(p, template) <= 60, "Your bag is full.");
  if (a.type === "buy") {
    if (a.template === "starleaf") {
      const quantity = a.quantity ?? 1;
      requireThat(
        Number.isInteger(quantity) && quantity >= 1 && quantity <= 99,
        "Choose a quantity from 1 to 99.",
      );
      requireThat(p.coins >= quantity * 2, "Not enough gold.");
      requireThat(
        p.materials.starleaf + quantity <= 99,
        "Your herb pouch is full.",
      );
      p.coins -= quantity * 2;
      p.materials.starleaf += quantity;
      return { message: `Bought Starleaf ×${quantity}.` };
    }
    requireThat(
      typeof a.template === "string" && Object.hasOwn(PRICES, a.template),
      "That item is not for sale.",
    );
    requireThat(PRICES[a.template][0] !== null, "That item is not for sale.");
    room(a.template);
    const price = PRICES[a.template][0];
    requireThat(p.coins >= price, "Not enough gold.");
    p.coins -= price;
    p.inventory.push({ id: randomUUID(), template: a.template });
    return { message: `Bought ${ITEMS[a.template].name} for ${price} gold.` };
  }
  if (a.type === "sell") {
    const kind = typeof a.item === "string" && a.item.startsWith("reagent-") ? a.item.slice(8) : null;
    if (kind) {
      requireThat(Object.hasOwn(REAGENTS, kind), "Choose a herb from your pouch.");
      const quantity = a.quantity ?? 1,
        herb = REAGENTS[kind];
      requireThat(
        Number.isInteger(quantity) && quantity > 0 && quantity <= POUCH_LIMIT,
        "Choose a quantity from 1 to 99.",
      );
      requireThat(
        surplus(p, kind) >= quantity,
        kind === "starleaf" ? "Keep four Starleaf for your active quest; gather extra or turn it in first." : `You don’t have that much ${herb.name}.`,
      );
      p.materials[kind] -= quantity;
      p.coins += quantity * herb.value;
      return { message: `Sold ${herb.name} ×${quantity} for ${quantity * herb.value} gold.` };
    }
    const item = p.inventory.find((i) => i.id === a.item);
    requireThat(
      item && Object.hasOwn(PRICES, item.template),
      "Choose an item from your bags.",
    );
    requireThat(
      !Object.values(p.equipment).includes(item.id),
      "Replace this equipped item before selling it.",
    );
    const price = PRICES[item.template][1];
    p.inventory = p.inventory.filter((i) => i.id !== item.id);
    p.coins += price;
    p.buyback.unshift({ ...item, price });
    p.buyback = p.buyback.slice(0, 10);
    return { message: `Sold ${ITEMS[item.template].name} for ${price} gold.` };
  }
  if (a.type === "buyback") {
    const item = p.buyback.find((i) => i.id === a.item);
    requireThat(item, "That item is no longer in buyback.");
    room();
    requireThat(p.coins >= item.price, "Not enough gold.");
    p.coins -= item.price;
    p.inventory.push({ id: item.id, template: item.template });
    p.buyback = p.buyback.filter((i) => i.id !== item.id);
    return { message: `Bought back ${ITEMS[item.template].name}.` };
  }
  if (a.type === "learn") {
    requireThat(
      ["herbalism", "alchemy"].includes(a.profession),
      "Choose Herbalism or Alchemy.",
    );
    requireThat(
      npcs.find((n) => n.id === a.vendor)?.trainer,
      "Mira teaches professions.",
    );
    requireThat(
      !p.professions[a.profession],
      "You already know that profession.",
    );
    p.professions[a.profession] = 1;
    return {
      message: `Learned ${a.profession === "alchemy" ? "Alchemy" : "Herbalism"} — skill 1/100.`,
    };
  }
  if (a.type === "craft") {
    requireThat(
      p.professions.alchemy > 0,
      "Learn Alchemy from Herbalist Mira first.",
    );
    const recipe =
      typeof a.recipe === "string" && Object.hasOwn(RECIPES, a.recipe)
        ? RECIPES[a.recipe]
        : null;
    requireThat(recipe, "Choose an Alchemy recipe.");
    requireThat(
      p.professions.alchemy >= recipe.skill,
      `Requires Alchemy ${recipe.skill}.`,
    );
    for (const [kind, n] of Object.entries(recipe.herbs))
      requireThat(
        surplus(p, kind) >= n,
        kind === "starleaf" ? "Not enough surplus Starleaf. Keep four for your active quest." : `You need ${n} ${REAGENTS[kind].name}.`,
      );
    room(a.recipe);
    for (const [kind, n] of Object.entries(recipe.herbs)) p.materials[kind] -= n;
    p.inventory.push({ id: randomUUID(), template: a.recipe });
    p.professions.alchemy = Math.min(100, p.professions.alchemy + 1);
    return {
      message: `Crafted ${recipe.name} · Alchemy ${p.professions.alchemy}/100.`,
    };
  }
  const item = p.inventory.find((i) => i.id === a.item),
    def = ITEMS[item?.template];
  if (def?.food || def?.drink) {
    requireThat(!((p.combatUntil ?? 0) > now), "You can’t eat or drink while in combat.");
    requireThat(
      !def.drink || p.classId !== "warrior",
      "Warriors don’t use mana. Try bread instead.",
    );
    p.inventory = p.inventory.filter((i) => i.id !== item.id);
    // Sitting restores the amount over 18 seconds; moving, attacking or being hit ends it.
    p.eating = {
      until: now + 18000,
      hp: (def.food ?? 0) / 18,
      power: (def.drink ?? 0) / 18,
      kind: def.food ? "food" : "drink",
    };
    p.input = { x: 0, z: 0 };
    p.casting = null;
    return { message: def.food ? `You sit down to eat ${def.name}.` : `You sit down to drink ${def.name}.` };
  }
  const heal = RECIPES[item?.template]?.heal;
  requireThat(heal, "Choose a healing draught from your bags.");
  requireThat(now >= p.potionReadyAt, "Your potion is on cooldown.");
  requireThat(p.hp < stats(p).maxHp, "Your health is already full.");
  p.hp = Math.min(stats(p).maxHp, p.hp + heal);
  p.potionReadyAt = now + 20000;
  p.inventory = p.inventory.filter((i) => i.id !== item.id);
  return {
    message: `Used ${ITEMS[item.template].name} · restored up to ${heal} health.`,
  };
}

// Consumables stack 20 per bag slot; gear takes one slot each. Adding `template` is counted.
export function slotsUsed(p, template = null) {
  const counts = {};
  let slots = 0;
  for (const i of [...p.inventory, ...(template ? [{ template }] : [])]) {
    if (ITEMS[i.template]?.slot === "consumable") counts[i.template] = (counts[i.template] ?? 0) + 1;
    else slots++;
  }
  for (const n of Object.values(counts)) slots += Math.ceil(n / 20);
  return slots;
}
