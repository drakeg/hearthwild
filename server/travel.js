// Getting around a big world: riding, caravans between towns, and the waystone home.
import { ROADS, TOWNS, GRAVEYARDS } from "../public/terrain.js";

export const RIDING = { level: 10, cost: 50, speed: 1.6 };
export const CARAVAN_SPEED = 16; // metres per second along the road
export const WAYSTONE = { castTime: 10000, cooldown: 15 * 60 * 1000 };
// Caravan stops and waystone homes: Wayfarer's Camp and every town.
export const STOPS = [
  { id: "camp", name: "Wayfarer’s Camp", x: 0, z: 16, place: "Wayfarer’s Camp" },
  ...TOWNS.map((t) => ({ id: t.id, name: t.name, x: t.x, z: t.z, place: t.name })),
];
export const stopById = (id) => STOPS.find((s) => s.id === id) ?? null;
export const homePoint = (id) => GRAVEYARDS.find((g) => g.id === id) ?? GRAVEYARDS[0];

// ---------- The road network ----------
// Nodes are points along every road (plus the arch trail through the Stillwood); roads that
// meet or pass close by are joined, and each stop links to the road points beside it.
const nodes = [],
  edges = [];
const link = (a, b) => {
  const d = Math.hypot(nodes[a].x - nodes[b].x, nodes[a].z - nodes[b].z);
  edges[a].push([b, d]);
  edges[b].push([a, d]);
};
const addNode = (x, z) => (nodes.push({ x, z }), edges.push([]), nodes.length - 1);
const trail = [];
for (let z = 84; z >= -78; z -= 6) trail.push([Math.sin(z * 0.1) * 0.65, z]);
const lines = [trail, ...ROADS].map((road) => road.map(([x, z]) => addNode(x, z)));
for (const line of lines) for (let i = 1; i < line.length; i++) link(line[i - 1], line[i]);
for (let a = 0; a < lines.length; a++)
  for (let b = a + 1; b < lines.length; b++)
    for (const i of lines[a])
      for (const j of lines[b])
        if (Math.hypot(nodes[i].x - nodes[j].x, nodes[i].z - nodes[j].z) < 9) link(i, j);
const stopNode = new Map();
for (const s of STOPS) {
  const n = addNode(s.x, s.z),
    reach = s.id === "camp" ? 16 : (TOWNS.find((t) => t.id === s.id)?.r ?? 30) + 8;
  stopNode.set(s.id, n);
  for (let i = 0; i < n; i++) if (Math.hypot(nodes[i].x - s.x, nodes[i].z - s.z) < reach) link(n, i);
}
// Shortest road route between two stops, as a list of points.
export function route(fromId, toId) {
  const start = stopNode.get(fromId),
    goal = stopNode.get(toId);
  if (start === undefined || goal === undefined) return null;
  const dist = new Float64Array(nodes.length).fill(Infinity),
    prev = new Int32Array(nodes.length).fill(-1),
    done = new Uint8Array(nodes.length);
  dist[start] = 0;
  for (;;) {
    let u = -1;
    for (let i = 0; i < nodes.length; i++) if (!done[i] && (u < 0 || dist[i] < dist[u])) u = i;
    if (u < 0 || dist[u] === Infinity) return null;
    if (u === goal) break;
    done[u] = 1;
    for (const [v, w] of edges[u]) if (dist[u] + w < dist[v]) (dist[v] = dist[u] + w), (prev[v] = u);
  }
  const points = [];
  for (let u = goal; u >= 0; u = prev[u]) points.unshift({ ...nodes[u] });
  return { points, length: dist[goal] };
}
export const caravanFare = (length) => Math.max(2, Math.ceil(length / 60));
export function nearestStop(p, within = 40) {
  let best = null;
  for (const s of STOPS) {
    const d = Math.hypot(p.x - s.x, p.z - s.z);
    if (d < within && (!best || d < best.d)) best = { ...s, d };
  }
  return best;
}
