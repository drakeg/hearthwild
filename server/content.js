export const ITEMS = {
  "ashbound-greatblade": {
    name: "Ashbound greatblade",
    slot: "weapon",
    rarity: "Epic",
    damage: 22,
    armor: 0,
    maxHp: 0,
  },
  "ashen-mantle": {
    name: "Mantle of the Ashen Warden",
    slot: "chest",
    rarity: "Epic",
    damage: 0,
    armor: 8,
    maxHp: 80,
  },
  "ember-of-vorlath": {
    name: "Ember of Vorlath",
    slot: "charm",
    rarity: "Epic",
    damage: 10,
    armor: 1,
    maxHp: 30,
  },
  "travelers-bread": {
    name: "Traveler’s bread",
    slot: "consumable",
    rarity: "Common",
    damage: 0,
    armor: 0,
    maxHp: 0,
    food: 90,
  },
  "spring-water": {
    name: "Stillwood spring water",
    slot: "consumable",
    rarity: "Common",
    damage: 0,
    armor: 0,
    maxHp: 0,
    drink: 90,
  },
  "healing-draught": {
    name: "Starleaf healing draught",
    slot: "consumable",
    rarity: "Common",
    damage: 0,
    armor: 0,
    maxHp: 0,
    heal: 60,
  },
  "greater-draught": {
    name: "Greater Starleaf draught",
    slot: "consumable",
    rarity: "Uncommon",
    damage: 0,
    armor: 0,
    maxHp: 0,
    heal: 110,
  },
  "warden-blade": {
    name: "Warden’s iron blade",
    slot: "weapon",
    damage: 8,
    maxHp: 0,
    armor: 0,
    rarity: "Uncommon",
  },
  "grove-coat": {
    name: "Grovekeeper’s coat",
    slot: "chest",
    damage: 0,
    maxHp: 30,
    armor: 3,
    rarity: "Uncommon",
  },
  "amber-charm": {
    name: "Amberroot talisman",
    slot: "charm",
    damage: 4,
    maxHp: 10,
    armor: 0,
    rarity: "Uncommon",
  },
  thornblade: {
    name: "Thorncarved longsword",
    slot: "weapon",
    damage: 14,
    maxHp: 0,
    armor: 0,
    rarity: "Rare",
  },
  "ironbark-mail": {
    name: "Ironbark mail",
    slot: "chest",
    damage: 0,
    maxHp: 50,
    armor: 5,
    rarity: "Rare",
  },
  moonstone: {
    name: "Moonstone pendant",
    slot: "charm",
    damage: 7,
    maxHp: 20,
    armor: 1,
    rarity: "Rare",
  },
};
export const NPCS = [
  {
    id: "warden",
    name: "Warden Elowen",
    role: "Keeper of the crossing",
    x: -4,
    z: 10,
    quest: "wildgrowth",
    text: "The woodland creatures have grown restless. Defeat three, then return to me. You can start beyond the arch; more creatures roam the distant woods and ridges.",
  },
  {
    id: "herbalist",
    merchant: true,
    trainer: true,
    name: "Herbalist Mira",
    role: "Herbalism & Alchemy trainer · Merchant",
    x: 4,
    z: 10,
    quest: "starleaf",
    text: "I need four starleaf sprigs for a restorative. Look for pale blue-green leaves and a glowing bud throughout the Stillwood, from the western banks to the eastern woods and northern ridges. Patches return in new places after a while. Gather four and bring them back to me.",
  },
  {
    id: "scout",
    name: "Scout Haldren",
    role: "Dawn & Moss scout",
    x: -44,
    z: 33.5,
    quest: "crypt",
    text: "Ashen raiders have dug into the old crypt beneath Amberwatch. Their warden, Vorlath, burns the dead to feed his ash. Go in with friends if you can — watch for his falling ash, and break his Soul Drain with a quick strike. Bring me word when he falls.",
  },
  {
    id: "merchant",
    name: "Torren the Provisioner",
    role: "Merchant · Buy & sell",
    x: 0,
    z: 18,
    merchant: true,
    text: "Welcome, traveler. I buy spare gear and herbs, and sell supplies. Mira teaches Herbalism and Alchemy nearby.",
  },
];
export const QUESTS = {
  wildgrowth: {
    id: "wildgrowth",
    name: "A thorn in the wood",
    npc: "warden",
    required: 3,
    reward: 30,
    objective: "Defeat woodland creatures",
    area: "The Stillwood · creatures across the woods and ridges",
  },
  crypt: {
    id: "crypt",
    name: "Ashes beneath Amberwatch",
    npc: "scout",
    required: 1,
    reward: 80,
    objective: "Defeat Vorlath the Ashen Warden",
    xp: 250,
    area: "The Hollow Crypt · beneath Amberwatch Ruins · group recommended, level 4+",
  },
  starleaf: {
    id: "starleaf",
    name: "A remedy for the grove",
    npc: "herbalist",
    required: 4,
    reward: 25,
    objective: "Gather starleaf",
    area: "The Stillwood · western banks, eastern woods and northern ridges",
  },
};
export function stats(p) {
  const result = {
    damage: 20 + ((p.level ?? 1) - 1) * 2,
    maxHp: 100 + ((p.level ?? 1) - 1) * 10,
    armor: 0,
  };
  for (const id of Object.values(p.equipment ?? {})) {
    const instance = p.inventory.find((i) => i.id === id),
      item = ITEMS[instance?.template];
    if (item) for (const key of Object.keys(result)) result[key] += item[key];
  }
  return result;
}
export const describeItem = (i) => ({ ...i, ...ITEMS[i.template] });
export function initAdventure(p) {
  p.classId ??= "warrior";
  p.gender ??= "male";
  p.level ??= 1;
  p.xp ??= 0;
  p.power ??= p.classId === "warrior" ? 0 : 100;
  p.cooldowns ??= {};
  p.inventory ??= [];
  p.equipment ??= {};
  p.professions ??= { herbalism: 0, alchemy: 0 };
  p.buyback ??= [];
  p.potionReadyAt ??= 0;
  p.materials ??= { starleaf: 0 };
  p.quests ??= {
    wildgrowth: { status: "offered", progress: 0 },
    starleaf: { status: "offered", progress: 0 },
  };
  p.quests.crypt ??= { status: "offered", progress: 0 };
  if (["active", "ready"].includes(p.quests.starleaf?.status)) {
    p.quests.starleaf.progress = Math.min(4, p.materials.starleaf);
    p.quests.starleaf.status = p.materials.starleaf >= 4 ? "ready" : "active";
  }
  return p;
}
export const CLASSES = {
  // swing: auto-attack weapon speed (ms); gcd: shared global cooldown (ms).
  warrior: { name: "Warrior", resource: "Rage", regen: 0, color: "#c79c6e", swing: 2400, gcd: 1500 },
  warlock: { name: "Warlock", resource: "Mana", regen: 6, color: "#8788ee", swing: 2000, gcd: 1500 },
  druid: { name: "Druid", resource: "Mana", regen: 7, color: "#ff7c0a", swing: 2200, gcd: 1500 },
  rogue: { name: "Rogue", resource: "Energy", regen: 12, color: "#fff468", swing: 1700, gcd: 1000 },
};
export const ABILITIES = {
  warrior: [
    {
      id: "iron-cut",
      name: "Iron cut",
      key: 1,
      level: 1,
      range: 3.2,
      cooldown: 1000,
      cost: 0,
      gain: 15,
      multiplier: 1,
      description: "A melee cut that builds 15 Rage.",
    },
    {
      id: "crushing-blow",
      name: "Crushing blow",
      key: 2,
      level: 1,
      range: 3.2,
      cooldown: 4000,
      cost: 25,
      multiplier: 1.9,
      interrupt: true,
      description: "Spend Rage for a powerful melee blow. Interrupts spellcasting.",
    },
    {
      id: "rally",
      name: "Rally",
      key: 3,
      level: 2,
      range: 0,
      cooldown: 14000,
      cost: 20,
      heal: 45,
      description: "Restore 45 health.",
    },
    {
      id: "earthbreaker",
      name: "Earthbreaker",
      key: 4,
      level: 3,
      range: 5,
      cooldown: 8000,
      cost: 30,
      multiplier: 1.6,
      aoe: true,
      description: "Strike enemies within 5 paces.",
    },
  ],
  warlock: [
    {
      id: "cinder-bolt",
      name: "Cinder bolt",
      key: 1,
      level: 1,
      range: 18,
      cooldown: 1400,
      castTime: 1100,
      cost: 12,
      multiplier: 1.3,
      description: "Cast a ranged bolt of cinder magic.",
    },
    {
      id: "soul-scorch",
      name: "Soul scorch",
      key: 2,
      level: 1,
      range: 18,
      cooldown: 5000,
      cost: 20,
      multiplier: 1.8,
      interrupt: true,
      description: "Instant ranged shadow damage. Interrupts spellcasting.",
    },
    {
      id: "siphon",
      name: "Siphon",
      key: 3,
      level: 2,
      range: 16,
      cooldown: 7000,
      cost: 15,
      multiplier: 1,
      heal: 18,
      description: "Damage your target and restore health.",
    },
    {
      id: "dread-wave",
      name: "Dread wave",
      key: 4,
      level: 3,
      range: 8,
      cooldown: 10000,
      cost: 30,
      multiplier: 2,
      aoe: true,
      description: "Release shadow magic around you.",
    },
  ],
  druid: [
    {
      id: "thorn-bolt",
      name: "Thorn bolt",
      key: 1,
      level: 1,
      range: 16,
      cooldown: 1200,
      castTime: 800,
      cost: 10,
      multiplier: 1.2,
      description: "Cast a thorn bolt at range.",
    },
    {
      id: "mending",
      name: "Mending",
      key: 2,
      level: 1,
      range: 0,
      cooldown: 5000,
      cost: 18,
      heal: 40,
      description: "Restore your health with grove magic.",
    },
    {
      id: "feral-rake",
      name: "Feral rake",
      key: 3,
      level: 2,
      range: 3.2,
      cooldown: 3000,
      cost: 15,
      multiplier: 1.7,
      interrupt: true,
      description: "A close-range feral strike. Interrupts spellcasting.",
    },
    {
      id: "wild-bloom",
      name: "Wild bloom",
      key: 4,
      level: 3,
      range: 0,
      cooldown: 14000,
      cost: 35,
      heal: 75,
      description: "A powerful restorative bloom.",
    },
  ],
  rogue: [
    {
      id: "quick-cut",
      name: "Quick cut",
      key: 1,
      level: 1,
      range: 3.2,
      cooldown: 900,
      cost: 20,
      multiplier: 1.1,
      description: "A fast melee strike.",
    },
    {
      id: "venom-edge",
      name: "Venom edge",
      key: 2,
      level: 1,
      range: 3.2,
      cooldown: 3500,
      cost: 30,
      multiplier: 1.8,
      interrupt: true,
      description: "A strong poisoned blade strike. Interrupts spellcasting.",
    },
    {
      id: "recuperate",
      name: "Recuperate",
      key: 3,
      level: 2,
      range: 0,
      cooldown: 12000,
      cost: 25,
      heal: 35,
      description: "Catch your breath and restore health.",
    },
    {
      id: "shadow-flurry",
      name: "Shadow flurry",
      key: 4,
      level: 3,
      range: 3.2,
      cooldown: 7000,
      cost: 40,
      multiplier: 2.5,
      description: "A rapid series of blade strikes.",
    },
  ],
};
export function addExperience(p, amount) {
  p.xp += amount;
  while (p.level < 20 && p.xp >= p.level * 100) {
    p.xp -= p.level * 100;
    p.level++;
    p.hp = stats(p).maxHp;
    p.power = 100;
  }
  if (p.level === 20) p.xp = 0;
}
