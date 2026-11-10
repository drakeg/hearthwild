// Content for the wider world: zone gear tiers, abilities to level 20, the Outer Ring (levels 20–30), and each town's
// quest givers and quest chains. All names and text are original to Hearthwild.
import { TOWNS } from "../public/terrain.js";
import { DUNGEONS } from "../public/dungeon-layout.js";

// ---------- Gear ----------
// Each zone has an Uncommon and a Rare tier of weapon, chest and charm. Stats follow the
// required level so that every few levels brings a meaningful upgrade.
const TIERS = [
  {
    zone: "downs",
    levels: [6, 8],
    names: {
      Uncommon: ["Harrowford militia sword", "Gorsefield jerkin", "Harvest-knot charm"],
      Rare: ["Bristleback cleaver", "Wheatgold brigandine", "Millstone amulet"],
    },
  },
  {
    zone: "marsh",
    levels: [9, 11],
    names: {
      Uncommon: ["Reedcutter blade", "Bogwalker hauberk", "Peat-wrapped charm"],
      Rare: ["Mirefang kris", "Fenwarden scale", "Blackwater locket"],
    },
  },
  {
    zone: "frost",
    levels: [12, 14],
    names: {
      Uncommon: ["Rimeforged axe", "Snowpelt coat", "Frostbead pendant"],
      Rare: ["Frostfang glaive", "Hollowfrost hauberk", "Heart of the Glassmere"],
    },
  },
  {
    zone: "crags",
    levels: [15, 18],
    names: {
      Uncommon: ["Greyspire sabre", "Cragplate cuirass", "Stonecaller’s sigil"],
      Rare: ["Ridgebreaker maul", "Greyspire warplate", "Eye of the Tarn"],
    },
  },
  // The Outer Ring.
  {
    zone: "ember",
    levels: [21, 23],
    names: {
      Uncommon: ["Cinderhold war-axe", "Ashwalker’s mail", "Coal-ember token"],
      Rare: ["Emberback splitter", "Slagforged plate", "Heart of the Cinder Pools"],
    },
  },
  {
    zone: "gloam",
    levels: [23, 25],
    names: {
      Uncommon: ["Duskhollow longknife", "Mossweave jerkin", "Gloamcap charm"],
      Rare: ["Thornweaver’s crook", "Barkhide hauberk", "Lantern of the Deep Wood"],
    },
  },
  {
    zone: "dunes",
    levels: [25, 27],
    names: {
      Uncommon: ["Sunmere scimitar", "Dunewalker’s robes", "Scarab of the Sands"],
      Rare: ["Sunscale khopesh", "Mirage-silk raiment", "Eye of the Oasis"],
    },
  },
  {
    zone: "reach",
    levels: [28, 30],
    names: {
      Uncommon: ["Starfall sabre", "Skywatch coat", "Shard of fallen star"],
      Rare: ["Voidmaw fang", "Starwoven mantle", "Lens of the Long Night"],
    },
  },
];
const slug = (s) =>
  s
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
export const GEAR = {};
export const GEAR_PRICES = {};
for (const tier of TIERS)
  for (const [i, rarity] of ["Uncommon", "Rare"].entries()) {
    const level = tier.levels[i],
      boost = rarity === "Rare" ? 1.3 : 1,
      [weapon, chest, charm] = tier.names[rarity];
    const add = (name, slot, damage, armor, maxHp) => {
      const id = slug(name);
      GEAR[id] = { name, slot, rarity, level, zone: tier.zone, damage: Math.round(damage), armor: Math.round(armor), maxHp: Math.round(maxHp) };
      // Gear from the wider world sells to merchants but isn't stocked by them.
      GEAR_PRICES[id] = [null, Math.round(level * level * 0.6 * boost + 8)];
    };
    add(weapon, "weapon", (8 + level * 2.1) * boost, 0, 0);
    add(chest, "chest", 0, (3 + level * 0.7) * boost, (30 + level * 11) * boost);
    add(charm, "charm", (2 + level * 0.7) * boost, (1 + level * 0.25) * boost, (14 + level * 5) * boost);
  }

// ---------- Abilities from level 6 to 18 ----------
// They sit on action bar keys 9, 0, - and = (slots 9–12). New effects:
//   shield — absorbs damage for a while; dot — damage over time; stun — the target can't act.
export const LATE_ABILITIES = {
  warrior: [
    { id: "shield-wall", name: "Shield wall", key: 9, level: 6, range: 0, cooldown: 30000, cost: 15, shield: { base: 40, perLevel: 6, duration: 10000 }, description: "Raise your guard, absorbing damage for 10 seconds." },
    { id: "cleaving-sweep", name: "Cleaving sweep", key: 10, level: 10, range: 5, cooldown: 9000, cost: 25, multiplier: 2.2, aoe: true, description: "A wide sweep that strikes every enemy within 5 paces." },
    { id: "thunder-slam", name: "Thunder slam", key: 11, level: 14, range: 3.2, cooldown: 20000, cost: 20, multiplier: 1.4, stun: 3000, interrupt: true, description: "Slam your target, stunning it for 3 seconds. Interrupts spellcasting." },
    { id: "titans-strike", name: "Titan’s strike", key: 12, level: 18, range: 3.2, cooldown: 15000, cost: 35, multiplier: 3.6, description: "A devastating two-handed blow." },
  ],
  warlock: [
    { id: "wither", name: "Wither", key: 9, level: 6, range: 18, cooldown: 8000, cost: 15, dot: { ticks: 6, every: 2000, multiplier: 0.45 }, description: "Afflict your target with withering shadow, dealing damage every 2 seconds for 12 seconds." },
    { id: "bone-ward", name: "Bone ward", key: 10, level: 10, range: 0, cooldown: 30000, cost: 20, shield: { base: 35, perLevel: 7, duration: 12000 }, description: "Wrap yourself in a ward of bone that absorbs damage for 12 seconds." },
    { id: "paralysing-hex", name: "Paralysing hex", key: 11, level: 14, range: 16, cooldown: 25000, cost: 25, stun: 4000, interrupt: true, description: "Freeze your target in place for 4 seconds. Interrupts spellcasting." },
    { id: "cataclysm", name: "Cataclysm", key: 12, level: 18, range: 20, cooldown: 12000, castTime: 2000, cost: 40, multiplier: 4.2, description: "Call down a storm of cinders after a 2-second cast." },
  ],
  druid: [
    { id: "thornsnare", name: "Thornsnare", key: 9, level: 6, range: 16, cooldown: 20000, cost: 15, stun: 3500, interrupt: true, description: "Thorny vines hold your target fast for 3.5 seconds. Interrupts spellcasting." },
    { id: "oakhide", name: "Oakhide", key: 10, level: 10, range: 0, cooldown: 30000, cost: 20, shield: { base: 40, perLevel: 6, duration: 12000 }, description: "Your skin hardens like old oak, absorbing damage for 12 seconds." },
    { id: "sunlance", name: "Sunlance", key: 11, level: 14, range: 18, cooldown: 6000, castTime: 1500, cost: 25, multiplier: 2.6, description: "A searing lance of sunlight after a 1.5-second cast." },
    { id: "verdant-tide", name: "Verdant tide", key: 12, level: 18, range: 0, cooldown: 25000, cost: 40, heal: 220, description: "A great surge of grove magic restores 220 health." },
  ],
  rogue: [
    { id: "bleeding-gash", name: "Bleeding gash", key: 9, level: 6, range: 3.2, cooldown: 6000, cost: 25, multiplier: 0.6, dot: { ticks: 5, every: 2000, multiplier: 0.5 }, description: "A deep cut that keeps bleeding for 10 seconds." },
    { id: "hilt-strike", name: "Hilt strike", key: 10, level: 10, range: 3.2, cooldown: 18000, cost: 30, multiplier: 0.8, stun: 3000, interrupt: true, description: "Crack your target with the hilt, stunning it for 3 seconds. Interrupts spellcasting." },
    { id: "smoke-veil", name: "Smoke veil", key: 11, level: 14, range: 0, cooldown: 30000, cost: 25, shield: { base: 30, perLevel: 7, duration: 8000 }, description: "Vanish into smoke, absorbing damage for 8 seconds." },
    { id: "heartseeker", name: "Heartseeker", key: 12, level: 18, range: 3.2, cooldown: 14000, cost: 45, multiplier: 4, description: "A precise strike aimed at the heart." },
  ],
};

// ---------- Town folk and quest chains ----------
const town = (id) => TOWNS.find((t) => t.id === id);
// [town, id, name, role, look, dx, dz, text, quest]
const FOLK = [
  // Harrowford — the Amber Downs (levels 6–10).
  ["harrowford", "harrowford-quest", "Captain Bram Tolliver", "Captain of the Harrowford watch", "npc-captain", 4, -4,
    "Bandits and hungry hounds have the farms of the Downs on edge. Thin them out — eight should do — and the farmers will sleep easier.", "harrow"],
  ["harrowford", "harrowford-farmer", "Widow Hesketh", "Farmer", "npc-town-f", -3, -10,
    "The Harrow bandits took every sack of seed grain from my barn. Without it, there’s no harvest next year.", "seed-grain"],
  ["harrowford", "harrowford-hunter", "Old Garrow", "Hunter", "npc-town", 11, 4,
    "Those Bristlebacks are tearing up the fields. Bring me their tusks and I’ll make it worth your while.", "bristle-tusks"],
  ["harrowford", "harrowford-courier", "Pell Ashby", "Courier", "npc-town", -12, -2,
    "I’ve a sealed letter for Warden Isolde Fen at Reedwatch, but my knees won’t take the marsh road. Would you carry it south?", "letter-reedwatch"],
  // Reedwatch — Saltreed Marsh (levels 9–13).
  ["reedwatch", "reedwatch-quest", "Warden Isolde Fen", "Keeper of the marsh road", "npc-captain", 4, -4,
    "Something stirs in the Blackwater Pools. Cultists chant in the fog and the lurkers grow bold. Drive back eight of them.", "fog"],
  ["reedwatch", "reedwatch-herbalist", "Marrow Quill", "Bog herbalist", "npc-town-f", -10, -4,
    "Mire cultists carry ritual idols carved from bog oak. Bring me some and I’ll learn what they’re worshipping.", "bog-idols"],
  ["reedwatch", "reedwatch-scout", "Sedge Harlow", "Marsh scout", "npc-town", 10, 6,
    "The witches lead the cultists. Break their circle — five of them should scatter the rest.", "witch-circle"],
  ["reedwatch", "reedwatch-courier", "Ferris Wade", "Ferryman", "npc-town", -2, 12,
    "Huntmaster Brae at Hollowfrost Lodge asked for news of the marsh. Carry this report north for me?", "report-hollowfrost"],
  // Hollowfrost Lodge — Frostmere Vale (levels 12–16).
  ["hollowfrost", "hollowfrost-quest", "Huntmaster Oswin Brae", "Hollowfrost hunters’ lodge", "npc-captain", 4, -4,
    "The pale wolves have come down from the high snow, and the reavers follow them. Bring down eight and the lodge will remember it.", "hunt"],
  ["hollowfrost", "hollowfrost-tanner", "Ylva Stormhand", "Tanner", "npc-town-f", -11, 0,
    "A Rime wolf pelt keeps a lodge warm through the worst storm. I need six for the winter.", "rime-pelts"],
  ["hollowfrost", "hollowfrost-elder", "Elder Aksel", "Lodge elder", "npc-town", 9, 8,
    "The Frostfang alphas lead the packs. Fell four of them and the packs will scatter for a season.", "alpha-hunt"],
  ["hollowfrost", "hollowfrost-courier", "Brin Halloway", "Trapper", "npc-town", -5.5, 12.5,
    "Captain Hedda Stone at Cragmoor Hold needs to hear what we’ve seen in the high passes. Take her this map?", "map-cragmoor"],
  // Cragmoor Hold — Greyspire Crags (levels 15–20).
  ["cragmoor", "cragmoor-quest", "Captain Hedda Stone", "Commander of Cragmoor Hold", "npc-captain", 4, -4,
    "Greyspire brigands hold the high passes, and their stonecallers wake things best left sleeping. Break eight of them.", "brigands"],
  ["cragmoor", "cragmoor-quartermaster", "Quartermaster Lusk", "Quartermaster", "npc-town", -10, -4,
    "The brigands stole our supply crates on the pass road. Recover what you can.", "stolen-supplies"],
  ["cragmoor", "cragmoor-sage", "Sage Orla Venn", "Stone-reader", "npc-town-f", 10, 6,
    "The Stonecallers carve runestones to wake the mountain. Bring me six before they finish whatever they’ve started.", "runestones"],
  ["cragmoor", "cragmoor-sergeant", "Sergeant Dunmore", "Hold sergeant", "npc-captain", -5.5, 12.5,
    "Crag stalkers have been taking our sentries. Hunt eight of them down.", "stalker-hunt"],
  ["cragmoor", "cragmoor-courier", "Ada Wren", "Hold courier", "npc-town-f", 12, -6,
    "Past the black ridges to the north-west is Cinderhold, the last forge before the waste. Its marshal needs our dispatch. Will you carry it?", "dispatch-cinderhold"],
  // Cinderhold — the Emberwaste (levels 20–23).
  ["cinderhold", "cinderhold-quest", "Marshal Varra Kell", "Marshal of Cinderhold", "npc-captain", 4, -4,
    "The waste breeds hounds of living coal, and the Ashbound preach fire to anyone who’ll listen. Put down eight of them.", "ashen-waste"],
  ["cinderhold", "cinderhold-smith", "Smith Torvald", "Forge-master", "npc-town", -10, -4,
    "The Emberbacks carry slag cores hot enough to work the old steel. Bring me six and I’ll forge you something worth carrying.", "slag-cores"],
  ["cinderhold", "cinderhold-preacher", "Sister Calla", "Keeper of the cold flame", "npc-town-f", 10, 6,
    "The Ashbound zealots lead the young ones into the pools. Stop six of them before they lead more.", "zealot-hunt"],
  ["cinderhold", "cinderhold-courier", "Bryn Coalfoot", "Courier", "npc-town", -5.5, 12.5,
    "Warden Ysolde at Duskhollow is waiting on news from the waste. The south road through the Crags will get you there.", "news-duskhollow"],
  // Duskhollow — Gloamwood (levels 22–25).
  ["duskhollow", "duskhollow-quest", "Warden Ysolde Thorn", "Warden of the Gloamwood", "npc-captain", 4, -4,
    "The wood has woken, and none of it is friendly. Thin the stalkers and the wardens of the hollow — eight of them.", "gloam-wake"],
  ["duskhollow", "duskhollow-herbalist", "Old Mother Fen", "Herbalist", "npc-town-f", -10, -4,
    "Thornweavers carry seeds of the heartbriar. Bring me six before they plant them, and I’ll brew you something for the road.", "heartbriar-seeds"],
  ["duskhollow", "duskhollow-hunter", "Rook Halloran", "Hunter", "npc-town", 10, 6,
    "Duskfangs hunt in packs at the edge of the lanterns. Bring down eight, and the paths will be safe again.", "duskfang-hunt"],
  ["duskhollow", "duskhollow-courier", "Pip Larkin", "Courier", "npc-town", -5.5, 12.5,
    "There’s a caravan stuck in Sunmere waiting on our letters. Take them east along the south road?", "letters-sunmere"],
  // Sunmere — the Sunscar Dunes (levels 24–27).
  ["sunmere", "sunmere-quest", "Emir Kasim al-Raad", "Lord of the oasis", "npc-captain", 4, -4,
    "Sandreavers raid our wells and jackals pick off the stragglers. Clear eight from the dunes and Sunmere will drink in peace.", "dune-raiders"],
  ["sunmere", "sunmere-scholar", "Scholar Imra", "Tomb scholar", "npc-town-f", -10, -4,
    "The Dune mystics carry tablets from the old sun-temples. I must read them. Bring me six.", "sun-tablets"],
  ["sunmere", "sunmere-warden", "Captain Halim", "Captain of the wells", "npc-captain", 10, 6,
    "The Sunscale prowlers nest near the oasis. Hunt eight before they take another caravan.", "sunscale-hunt"],
  ["sunmere", "sunmere-courier", "Nadia Sand", "Caravan scout", "npc-town-f", -5.5, 12.5,
    "Starfall Rest sits high in the north-east, where the stars came down. Take them this map of the wells?", "map-starfall"],
  // Starfall Rest — Starfall Reach (levels 27–30).
  ["starfall", "starfall-quest", "Seer Aldric Vane", "Keeper of the Rest", "npc-captain", 4, -4,
    "Since the stars fell, the Reach has filled with hungry things. Drive back eight of them.", "starfall-hunger"],
  ["starfall", "starfall-collector", "Tamsin Glass", "Starstone cutter", "npc-town-f", -10, -4,
    "Star lynxes swallow shards of starstone — it’s what makes them glow. Bring me six shards.", "starstone-shards"],
  ["starfall", "starfall-sentinel", "Commander Eira Holt", "Commander of the Rest", "npc-captain", 10, 6,
    "The Voidmaws come through the cracks in the sky. Close them for good — eight should do.", "voidmaw-hunt"],
  ["starfall", "starfall-archivist", "Archivist Wend", "Keeper of the lens-glass", "npc-town", -5.5, 12.5,
    "The Astral seekers carry fragments of the great lens they broke. Bring me six, and perhaps one day we can mend it.", "lens-fragments"],
];
export const WORLD_FOLK = FOLK.map(([townId, id, name, role, look, dx, dz, text, quest]) => {
  const t = town(townId);
  return { id, name, role, x: t.x + dx, z: t.z + dz, look, town: townId, quest, text };
});
// Quest kinds: kill (by zone or creature kind), collect (a drop from certain creatures),
// and deliver (carry something to another town's NPC). `requires` makes a chain.
export const WORLD_QUESTS = {
  // The Amber Downs.
  harrow: { name: "Trouble on the Downs", npc: "harrowford-quest", required: 8, reward: 120, xp: 650, objective: "Defeat creatures of the Amber Downs", area: "The Amber Downs · east of the Stillwood · levels 6–10", kill: { zone: "downs" } },
  "seed-grain": { name: "Seed for Next Year", npc: "harrowford-farmer", required: 6, reward: 100, xp: 600, objective: "Recover sacks of seed grain from Harrow bandits", area: "The Amber Downs · bandit camps", collect: { kinds: ["harrow-bandit", "downs-poacher"], chance: 0.6, item: "Sack of seed grain" } },
  "bristle-tusks": { name: "Tusks for Old Garrow", npc: "harrowford-hunter", required: 5, reward: 110, xp: 650, objective: "Collect Bristleback tusks", area: "The Amber Downs · open fields", requires: "harrow", collect: { kinds: ["bristleback"], chance: 0.7, item: "Bristleback tusk" } },
  "letter-reedwatch": { name: "The Marsh Road", npc: "harrowford-courier", required: 1, reward: 60, xp: 500, objective: "Deliver Pell’s letter to Warden Isolde Fen in Reedwatch", area: "Reedwatch · follow the ring road south", deliver: { to: "reedwatch-quest" }, minLevel: 8 },
  // Saltreed Marsh.
  fog: { name: "Fog over the Pools", npc: "reedwatch-quest", required: 8, reward: 160, xp: 950, objective: "Defeat creatures of Saltreed Marsh", area: "Saltreed Marsh · south of the Stillwood · levels 9–13", kill: { zone: "marsh" } },
  "bog-idols": { name: "Idols of the Mire", npc: "reedwatch-herbalist", required: 6, reward: 150, xp: 950, objective: "Recover bog-oak idols from Mire cultists", area: "Saltreed Marsh · Blackwater Pools", collect: { kinds: ["mire-cultist", "mire-witch"], chance: 0.55, item: "Bog-oak idol" } },
  "witch-circle": { name: "Break the Circle", npc: "reedwatch-scout", required: 5, reward: 180, xp: 1000, objective: "Defeat Mire witches", area: "Saltreed Marsh", requires: "bog-idols", kill: { kind: "mire-witch" } },
  "report-hollowfrost": { name: "News for the Lodge", npc: "reedwatch-courier", required: 1, reward: 80, xp: 800, objective: "Carry Ferris’s report to Huntmaster Oswin Brae at Hollowfrost Lodge", area: "Hollowfrost Lodge · far to the north", deliver: { to: "hollowfrost-quest" }, minLevel: 11 },
  // Frostmere Vale.
  hunt: { name: "The Pale Hunt", npc: "hollowfrost-quest", required: 8, reward: 200, xp: 1250, objective: "Defeat creatures of Frostmere Vale", area: "Frostmere Vale · north of the Stillwood · levels 12–16", kill: { zone: "frost" } },
  "rime-pelts": { name: "Pelts for the Winter", npc: "hollowfrost-tanner", required: 6, reward: 190, xp: 1250, objective: "Collect Rime wolf pelts", area: "Frostmere Vale · pine forests", collect: { kinds: ["rime-wolf"], chance: 0.65, item: "Rime wolf pelt" } },
  "alpha-hunt": { name: "Lead the Pack No More", npc: "hollowfrost-elder", required: 4, reward: 230, xp: 1350, objective: "Defeat Frostfang alphas", area: "Frostmere Vale", requires: "rime-pelts", kill: { kind: "frostfang" } },
  "map-cragmoor": { name: "The High Passes", npc: "hollowfrost-courier", required: 1, reward: 100, xp: 1100, objective: "Take Brin’s map to Captain Hedda Stone at Cragmoor Hold", area: "Cragmoor Hold · west along the ring road", deliver: { to: "cragmoor-quest" }, minLevel: 14 },
  // Greyspire Crags.
  brigands: { name: "Brigands of Greyspire", npc: "cragmoor-quest", required: 8, reward: 260, xp: 1650, objective: "Defeat creatures of Greyspire Crags", area: "Greyspire Crags · west of the Stillwood · levels 15–20", kill: { zone: "crags" } },
  "stolen-supplies": { name: "Stolen Supplies", npc: "cragmoor-quartermaster", required: 6, reward: 250, xp: 1650, objective: "Recover supply crates from Greyspire brigands", area: "Greyspire Crags · pass roads", collect: { kinds: ["greyspire-brigand"], chance: 0.6, item: "Cragmoor supply crate" } },
  runestones: { name: "Waking the Mountain", npc: "cragmoor-sage", required: 6, reward: 280, xp: 1800, objective: "Take runestones from Stonecallers", area: "Greyspire Crags · high ridges", requires: "stolen-supplies", collect: { kinds: ["stonecaller"], chance: 0.6, item: "Carved runestone" } },
  "stalker-hunt": { name: "Sentries Lost", npc: "cragmoor-sergeant", required: 8, reward: 270, xp: 1750, objective: "Defeat Crag stalkers", area: "Greyspire Crags", kill: { kind: "crag-stalker" } },
  "dispatch-cinderhold": { name: "Beyond the Ridges", npc: "cragmoor-courier", required: 1, reward: 140, xp: 1500, objective: "Carry Ada’s dispatch to Marshal Varra Kell in Cinderhold", area: "Cinderhold · north-west, past the Crags", deliver: { to: "cinderhold-quest" }, minLevel: 19 },
  // The Emberwaste.
  "ashen-waste": { name: "The Burning Waste", npc: "cinderhold-quest", required: 8, reward: 330, xp: 2300, objective: "Defeat creatures of the Emberwaste", area: "The Emberwaste · north-west · levels 20–23", kill: { zone: "ember" } },
  "slag-cores": { name: "Steel from Slag", npc: "cinderhold-smith", required: 6, reward: 320, xp: 2300, objective: "Collect slag cores from Emberbacks", area: "The Emberwaste · ash flats", collect: { kinds: ["emberback"], chance: 0.65, item: "Slag core" } },
  "zealot-hunt": { name: "The Cold Flame", npc: "cinderhold-preacher", required: 6, reward: 350, xp: 2450, objective: "Defeat Ashbound zealots", area: "The Emberwaste · near the Cinder Pools", requires: "ashen-waste", kill: { kind: "ashbound-zealot" } },
  "news-duskhollow": { name: "Word for the Wood", npc: "cinderhold-courier", required: 1, reward: 160, xp: 2000, objective: "Take Bryn’s news to Warden Ysolde Thorn in Duskhollow", area: "Duskhollow · south along the outer road", deliver: { to: "duskhollow-quest" }, minLevel: 21 },
  // Gloamwood.
  "gloam-wake": { name: "The Wood Awakes", npc: "duskhollow-quest", required: 8, reward: 380, xp: 2800, objective: "Defeat creatures of Gloamwood", area: "Gloamwood · south-west · levels 22–25", kill: { zone: "gloam" } },
  "heartbriar-seeds": { name: "Seeds of the Heartbriar", npc: "duskhollow-herbalist", required: 6, reward: 370, xp: 2800, objective: "Take heartbriar seeds from Thornweavers", area: "Gloamwood · deep hollows", collect: { kinds: ["thornweaver"], chance: 0.6, item: "Heartbriar seed" } },
  "duskfang-hunt": { name: "Beyond the Lanterns", npc: "duskhollow-hunter", required: 8, reward: 390, xp: 2900, objective: "Defeat Duskfangs", area: "Gloamwood", requires: "heartbriar-seeds", kill: { kind: "duskfang" } },
  "letters-sunmere": { name: "Letters for the Oasis", npc: "duskhollow-courier", required: 1, reward: 180, xp: 2400, objective: "Deliver Pip’s letters to Emir Kasim al-Raad in Sunmere", area: "Sunmere · east along the outer road", deliver: { to: "sunmere-quest" }, minLevel: 23 },
  // The Sunscar Dunes.
  "dune-raiders": { name: "Raiders of the Wells", npc: "sunmere-quest", required: 8, reward: 430, xp: 3300, objective: "Defeat creatures of the Sunscar Dunes", area: "The Sunscar Dunes · south-east · levels 24–27", kill: { zone: "dunes" } },
  "sun-tablets": { name: "Tablets of the Sun", npc: "sunmere-scholar", required: 6, reward: 420, xp: 3300, objective: "Recover sun-temple tablets from Dune mystics", area: "The Sunscar Dunes · ruined temples", collect: { kinds: ["dune-mystic"], chance: 0.6, item: "Sun-temple tablet" } },
  "sunscale-hunt": { name: "Nests by the Water", npc: "sunmere-warden", required: 8, reward: 440, xp: 3400, objective: "Defeat Sunscale prowlers", area: "The Sunscar Dunes · near the oasis", requires: "dune-raiders", kill: { kind: "sunscale" } },
  "map-starfall": { name: "A Map of the Wells", npc: "sunmere-courier", required: 1, reward: 200, xp: 2800, objective: "Take Nadia’s map to Seer Aldric Vane at Starfall Rest", area: "Starfall Rest · north along the outer road", deliver: { to: "starfall-quest" }, minLevel: 26 },
  // Starfall Reach.
  "starfall-hunger": { name: "Hungers from the Sky", npc: "starfall-quest", required: 8, reward: 480, xp: 3800, objective: "Defeat creatures of Starfall Reach", area: "Starfall Reach · north-east · levels 27–30", kill: { zone: "reach" } },
  "starstone-shards": { name: "Starstone", npc: "starfall-collector", required: 6, reward: 470, xp: 3800, objective: "Collect starstone shards from Star lynxes", area: "Starfall Reach · high meadows", collect: { kinds: ["star-lynx"], chance: 0.65, item: "Starstone shard" } },
  "lens-fragments": { name: "Fragments of the Lens", npc: "starfall-archivist", required: 6, reward: 490, xp: 3900, objective: "Recover lens fragments from Astral seekers", area: "Starfall Reach · around the observatory", collect: { kinds: ["astral-seeker"], chance: 0.6, item: "Lens fragment" } },
  "voidmaw-hunt": { name: "Cracks in the Sky", npc: "starfall-sentinel", required: 8, reward: 500, xp: 4000, objective: "Defeat Voidmaws", area: "Starfall Reach", requires: "starstone-shards", kill: { kind: "voidmaw" } },
};

// ---------- Travel folk ----------
// Stablemasters teach riding; caravan masters carry you along the roads to towns you've found.
const CAMP = { x: 0, z: 0 };
const at = (townId) => (townId === "camp" ? CAMP : town(townId));
export const TRAVEL_FOLK = [
  { id: "camp-stable", name: "Wren Halloway", role: "Stablemaster", place: "camp", dx: 5.5, dz: 21, look: "npc-town-f", stable: true,
    text: "Every rider starts somewhere. Reach level 10 and bring 50 gold, and I’ll teach you to ride. Your mount will carry you half again as fast." },
  { id: "harrowford-stable", name: "Tam Rook", role: "Stablemaster", place: "harrowford", dx: 8, dz: -12, look: "npc-town", stable: true,
    text: "Fine riding country, the Downs. I can teach you, if you’re ready." },
  { id: "camp-caravan", name: "Odo Barrow", role: "Caravan master", place: "camp", dx: 6.5, dz: 15, look: "npc-town", caravan: "camp",
    text: "The caravan runs the roads to every town you’ve visited. Pay the fare and sit back." },
  { id: "cinderhold-stable", name: "Hessa Grael", role: "Stablemaster", place: "cinderhold", dx: 8, dz: -12, look: "npc-town-f", stable: true,
    text: "Our foxes are bred for hot ground. I’ll teach you to ride, if you haven’t learned yet." },
  ...["harrowford", "reedwatch", "hollowfrost", "cragmoor", "cinderhold", "duskhollow", "sunmere", "starfall"].map((id, i) => ({
    id: `${id}-caravan`,
    name: ["Mabel Thorne", "Gil Pike", "Runa Ashby", "Corin Vale", "Dag Emberly", "Wyn Mallow", "Farah Dunes", "Orrin Skye"][i],
    role: "Caravan master",
    place: id,
    dx: 1,
    dz: -8,
    look: i % 2 ? "npc-town" : "npc-town-f",
    caravan: id,
    text: "Wagons leave whenever you’re ready. I can take you to any town you’ve already found.",
  })),
].map(({ place, dx, dz, ...n }) => ({ ...n, x: at(place).x + dx, z: at(place).z + dz, town: place === "camp" ? undefined : place }));

// ---------- Dungeons: Epic rewards, door scouts and boss quests ----------
const EPIC_NAMES = {
  "harrow-barrow": ["Blackhook’s cleaver", "Bandit King’s greatcoat", "Gorran’s lucky coin"],
  "drowned-chapel": ["Mirewood greatstaff", "Vestments of the Drowned", "Mother Sallow’s rosary"],
  "glassmere-depths": ["Frostbound warhammer", "Glassmere icemail", "Shard of the Frozen Heart"],
  "hollow-peak": ["Varkesh’s runeblade", "Mountain-heart plate", "Summit runestone"],
  cinderforge: ["Ashkar’s forge-hammer", "Molten-heart breastplate", "Ember of the First Forge"],
  thornheart: ["Briar Queen’s scythe", "Crown-of-thorns mantle", "Heartbriar bloom"],
  "sun-tomb": ["Azhar’s sunblade", "Gilded raiment of the Sun-King", "Scarab of the Eternal Noon"],
  observatory: ["Velia’s starcaller", "Robes of the Shattered Sky", "Eye of the Orrery"],
};
// Each boss drops one of its dungeon's three Epics (the Hollow Crypt's are defined in content.js).
export const DUNGEON_LOOT = { "hollow-crypt": ["ashbound-greatblade", "ashen-mantle", "ember-of-vorlath"] };
for (const [id, names] of Object.entries(EPIC_NAMES)) {
  const level = DUNGEONS[id].levels[1],
    boost = 1.6;
  DUNGEON_LOOT[id] = [];
  names.forEach((name, i) => {
    const key = slug(name),
      slot = ["weapon", "chest", "charm"][i];
    GEAR[key] =
      slot === "weapon"
        ? { name, slot, rarity: "Epic", level, dungeon: id, damage: Math.round((8 + level * 2.1) * boost), armor: 0, maxHp: 0 }
        : slot === "chest"
          ? { name, slot, rarity: "Epic", level, dungeon: id, damage: 0, armor: Math.round((3 + level * 0.7) * boost), maxHp: Math.round((30 + level * 11) * boost) }
          : { name, slot, rarity: "Epic", level, dungeon: id, damage: Math.round((2 + level * 0.7) * boost), armor: Math.round((1 + level * 0.25) * boost), maxHp: Math.round((14 + level * 5) * boost) };
    GEAR_PRICES[key] = [null, Math.round(level * level * 1.2 + 30)];
    DUNGEON_LOOT[id].push(key);
  });
}
const SCOUTS = {
  "harrow-barrow": ["barrow", "Ranger Tess Mallory", "The Harrow bandits have dug into the old barrow on the hill, and their king holds court in the deepest hall. Bring down Gorran Blackhook and the Downs will breathe again."],
  "drowned-chapel": ["chapel", "Brother Ennis", "My chapel sank into the mire a generation ago. Now something sings beneath the water. Silence Mother Sallow, I beg you."],
  "glassmere-depths": ["depths", "Huntress Sigrun", "Beneath the frozen lake sleeps Hrimgar the Frostbound, and the pale wolves gather to him. Go down into the Depths and end his long winter."],
  "hollow-peak": ["peak", "Warden Kael Thorne", "Varkesh and her Stonecallers have hollowed out the mountain to wake whatever lies at its heart. Climb to the summit chamber and stop her."],
  cinderforge: ["forge", "Smith’s-mate Ilse", "Forgelord Ashkar has relit the First Forge beneath the waste, and every hound of coal answers its bellows. Bank its fires for good."],
  thornheart: ["hollow", "Ranger Aedan Moss", "At the heart of the wood sleeps the Briar Queen, and she is waking. Go down through the roots and put her back to sleep — forever."],
  "sun-tomb": ["tomb", "Scholar Rashid", "The tomb of Sun-King Azhar has opened, and he walks again among his treasures. A king long dead should stay that way."],
  observatory: ["observatory", "Starwatcher Lune", "Astromancer Velia broke the great lens to call the stars down, and she isn’t finished. Climb to the shattered dome and stop her before the sky comes with them."],
};
for (const [id, [short, name, text]] of Object.entries(SCOUTS)) {
  const d = DUNGEONS[id];
  TRAVEL_FOLK.push({ id: `${short}-scout`, dungeon: id, name, role: `Watcher at ${d.name}`, x: d.door.x + 4, z: d.door.z + 2.5, look: "npc-scout", quest: `${short}-boss`, text });
  WORLD_QUESTS[`${short}-boss`] = {
    name: `Into ${d.name}`,
    npc: `${short}-scout`,
    required: 1,
    reward: d.levels[1] * 24,
    xp: d.levels[1] * 220,
    objective: `Defeat ${d.boss.name} in ${d.name}`,
    area: `${d.name} · dungeon · levels ${d.levels[0]}–${d.bossLevel} · bring a group`,
    boss: id,
    minLevel: d.levels[0] - 2,
  };
}
