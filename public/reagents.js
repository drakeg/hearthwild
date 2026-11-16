// Herbs (reagents) of Hearthwild: one native to each zone, plus Starleaf, which also grows on the
// edges of the first zones. Shared by the server (placement, gathering, prices) and the client
// (plant colours, bags, map).
export const REAGENTS = {
  starleaf: { name: "Starleaf", zone: "stillwood", leaf: "#8ab2aa", bud: "#bce8ca", glow: "#71a990", value: 1 },
  amberroot: { name: "Amberroot", zone: "downs", leaf: "#a88f4c", bud: "#ffcf6a", glow: "#c08a20", value: 2 },
  bogmyrtle: { name: "Bog myrtle", zone: "marsh", leaf: "#58744a", bud: "#d2e88a", glow: "#7a9a30", value: 3 },
  frostbloom: { name: "Frostbloom", zone: "frost", leaf: "#9bbccc", bud: "#eef8ff", glow: "#8ac0e8", value: 4 },
  stonemoss: { name: "Stonemoss", zone: "crags", leaf: "#717f60", bud: "#d6dcb6", glow: "#a0b080", value: 5 },
  emberthorn: { name: "Emberthorn", zone: "ember", leaf: "#4f352c", bud: "#ff7a30", glow: "#ff4a00", value: 6 },
  gloamcap: { name: "Gloamcap", zone: "gloam", leaf: "#35533f", bud: "#a98cff", glow: "#7050e0", value: 7 },
  sunpetal: { name: "Sunpetal", zone: "dunes", leaf: "#a69658", bud: "#ffe060", glow: "#ffb020", value: 8 },
  starlily: { name: "Starglass lily", zone: "reach", leaf: "#8682c4", bud: "#f4f0ff", glow: "#b8a8ff", value: 9 },
  // Ores, mined with the Mining profession: rock (leaf) with a coloured vein (bud).
  copper: { name: "Copper ore", type: "ore", zones: ["downs", "marsh"], leaf: "#6f6a62", bud: "#d9824a", glow: "#a8501e", value: 2 },
  iron: { name: "Iron ore", type: "ore", zones: ["frost", "crags"], leaf: "#5f5f63", bud: "#c9b8a8", glow: "#806a5a", value: 4 },
  emberite: { name: "Emberite", type: "ore", zones: ["ember"], leaf: "#3a2c28", bud: "#ff6a2a", glow: "#ff3a00", value: 6 },
  duskiron: { name: "Duskiron", type: "ore", zones: ["gloam"], leaf: "#3c4442", bud: "#7fd6b0", glow: "#2f8a6a", value: 7 },
  sunsteel: { name: "Sunsteel ore", type: "ore", zones: ["dunes"], leaf: "#8a7a5a", bud: "#ffe48a", glow: "#e0a020", value: 8 },
  starmetal: { name: "Starmetal", type: "ore", zones: ["reach"], leaf: "#4c4866", bud: "#d8ccff", glow: "#8f7aff", value: 9 },
};
export const REAGENT_IDS = Object.keys(REAGENTS);
// How many herb patches grow out in each zone (the Stillwood keeps its own 32 Starleaf patches).
export const HERB_POPULATION = { downs: 40, marsh: 40, frost: 36, crags: 36, ember: 70, gloam: 70, dunes: 70, reach: 70 };
// Starleaf also grows among the first zones' own herbs.
export const STARLEAF_SHARE = { downs: 0.3, marsh: 0.3 };
export const POUCH_LIMIT = 99;
export const isOre = (kind) => REAGENTS[kind]?.type === "ore";
// Ore veins per zone (the Stillwood has none).
export const ORE_POPULATION = { downs: 24, marsh: 20, frost: 22, crags: 30, ember: 45, gloam: 40, dunes: 40, reach: 45 };
export const oreKind = (zone) => REAGENT_IDS.find((id) => REAGENTS[id].zones?.includes(zone));
// The herb that grows at patch i of a zone.
export function herbKind(zone, i) {
  const native = REAGENT_IDS.find((id) => REAGENTS[id].zone === zone && !isOre(id));
  const share = STARLEAF_SHARE[zone] ?? 0;
  return share && (i * 0.6180339887) % 1 < share ? "starleaf" : native;
}
