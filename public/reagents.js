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
};
export const REAGENT_IDS = Object.keys(REAGENTS);
// How many herb patches grow out in each zone (the Stillwood keeps its own 32 Starleaf patches).
export const HERB_POPULATION = { downs: 40, marsh: 40, frost: 36, crags: 36, ember: 70, gloam: 70, dunes: 70, reach: 70 };
// Starleaf also grows among the first zones' own herbs.
export const STARLEAF_SHARE = { downs: 0.3, marsh: 0.3 };
export const POUCH_LIMIT = 99;
// The herb that grows at patch i of a zone.
export function herbKind(zone, i) {
  const native = REAGENT_IDS.find((id) => REAGENTS[id].zone === zone);
  const share = STARLEAF_SHARE[zone] ?? 0;
  return share && (i * 0.6180339887) % 1 < share ? "starleaf" : native;
}
