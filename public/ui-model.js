import { WORLD_HALF, WORLD_SIZE, WORLD_LIMIT, ZONES, zoneAt } from "./world-config.js";
// The square each zone's map shows, and the middle of its land for its name on the world map.
let bounds = null;
export function zoneBounds() {
  if (bounds) return bounds;
  const pts = {},
    step = Math.max(20, Math.round(WORLD_LIMIT / 45));
  for (let x = -WORLD_LIMIT; x <= WORLD_LIMIT; x += step)
    for (let z = -WORLD_LIMIT; z <= WORLD_LIMIT; z += step) (pts[zoneAt(x, z)] ??= []).push([x, z]);
  bounds = {};
  // Trim the thin tips of each zone so its map stays close on the land that matters.
  const pct = (v, f) => v[Math.min(v.length - 1, Math.floor(v.length * f))];
  for (const id of Object.keys(ZONES)) {
    const p = pts[id];
    if (!p) continue;
    const xs = p.map((q) => q[0]).sort((a, b) => a - b),
      zs = p.map((q) => q[1]).sort((a, b) => a - b),
      minX = pct(xs, 0.04), maxX = pct(xs, 0.96), minZ = pct(zs, 0.04), maxZ = pct(zs, 0.96),
      cx = xs.reduce((a, b) => a + b) / xs.length,
      cz = zs.reduce((a, b) => a + b) / zs.length,
      // Centred on the heart of the zone, wide enough for most of it.
      span = Math.max(520, Math.min(1100, Math.max(maxX - minX, maxZ - minZ) * 0.72)),
      clamp = (v) => Math.max(-WORLD_HALF, Math.min(WORLD_HALF - span, v));
    bounds[id] = { originX: clamp(cx - span / 2), originZ: clamp(cz - span / 2), span, cx, cz };
  }
  return bounds;
}
export const BAR_KEYS = [
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "0",
  "-",
  "=",
];
export function mapPoint(x, z) {
  return {
    x: Math.max(0, Math.min(100, ((x + WORLD_HALF) / WORLD_SIZE) * 100)),
    y: Math.max(0, Math.min(100, ((z + WORLD_HALF) / WORLD_SIZE) * 100)),
  };
}
export function filterQuests(
  definitions,
  progress,
  query = "",
  filter = "all",
) {
  const q = query.trim().toLowerCase();
  return Object.values(definitions).filter(
    (d) =>
      (filter === "all" ||
        (filter === "active"
          ? ["active", "ready"].includes(progress[d.id].status)
          : progress[d.id].status === filter)) &&
      `${d.name} ${d.objective} ${d.area}`.toLowerCase().includes(q),
  );
}
export function bagCells(items, query = "", capacity = 60) {
  const q = query.trim().toLowerCase(),
    filtered = items.filter((i) =>
      `${i.name} ${i.slot} ${i.rarity}`.toLowerCase().includes(q),
    );
  return [
    ...filtered,
    ...Array(Math.max(0, capacity - filtered.length)).fill(null),
  ];
}

export function bagItems(inventory, materials) {
  return [
    ...inventory,
    ...(materials?.starleaf > 0
      ? [
          {
            id: "reagent-starleaf",
            name: "Starleaf",
            slot: "reagent",
            rarity: "Reagent",
            count: materials.starleaf,
          },
        ]
      : []),
  ];
}
export function questMarker(status, locked = false) {
  if (locked && status === "offered") return { symbol: "", label: "Not yet available", color: "#b8beb4" };
  if (status === "ready")
    return { symbol: "?", label: "Ready for turn-in", color: "#ffd200" };
  if (status === "offered")
    return { symbol: "!", label: "Quest available", color: "#ffd200" };
  if (status === "active")
    return { symbol: "?", label: "Quest in progress", color: "#b8beb4" };
  return { symbol: "", label: "", color: "#b8beb4" };
}

// Consumables stack in one bag slot (20 per stack in the server's slot count).
export function stackConsumables(items) {
  const out = [],
    stacks = new Map();
  for (const i of items) {
    if (i.slot !== "consumable") {
      out.push(i);
      continue;
    }
    let s = stacks.get(i.template);
    if (!s) {
      s = { ...i, count: 0, ids: [] };
      stacks.set(i.template, s);
      out.push(s);
    }
    s.count++;
    s.ids.push(i.id);
  }
  return out;
}
const svg = (body) =>
  `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><rect width='64' height='64' fill='#1b140d'/>${body}</svg>`)}")`;
const flask = (liquid, glow) =>
  svg(`<radialGradient id='g' cx='.4' cy='.4'><stop offset='0' stop-color='${glow}'/><stop offset='1' stop-color='${liquid}'/></radialGradient><path d='M26 8h12v6h-2v10c8 3 14 10 14 19 0 10-8 17-18 17S14 53 14 43c0-9 6-16 14-19V14h-2z' fill='#d9e6ea' fill-opacity='.35' stroke='#e9f1f2' stroke-width='2'/><path d='M17 42c4-4 26-4 30 0 0 9-7 15-15 15s-15-6-15-15z' fill='url(#g)'/><rect x='25' y='4' width='14' height='6' rx='2' fill='#8a5a2b'/><circle cx='24' cy='40' r='3' fill='#fff' fill-opacity='.7'/>`);
export const ITEM_ICONS = {
  "healing-draught": flask("#a3121c", "#ff6a5a"),
  "greater-draught": flask("#5e1386", "#e38bff"),
  "travelers-bread": svg(`<ellipse cx='32' cy='38' rx='24' ry='15' fill='#b9772f'/><ellipse cx='32' cy='34' rx='22' ry='13' fill='#e0a95b'/><path d='M18 30l6 8M28 27l6 9M38 27l6 9' stroke='#a9682a' stroke-width='3' stroke-linecap='round'/>`),
  "spring-water": svg(`<path d='M20 16h24l-3 8c6 4 9 10 9 17 0 10-8 17-18 17s-18-7-18-17c0-7 3-13 9-17z' fill='#7b5432' stroke='#3a2614' stroke-width='2'/><path d='M18 40c4-3 24-3 28 0 0 8-6 13-14 13s-14-5-14-13z' fill='#3f8fd8'/><rect x='24' y='10' width='16' height='7' rx='2' fill='#c9b48a'/>`),
};
export function itemIconStyle(template) {
  const url = ITEM_ICONS[template];
  return url ? { backgroundImage: url, backgroundSize: "cover", backgroundPosition: "center" } : null;
}
