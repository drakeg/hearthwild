// Interest management: each player hears only about the world around them, and creatures far
// from every player sleep instead of being simulated. Lets the world grow without the server
// or the connection growing with it.
import { createHash } from "node:crypto";

// How far each kind of thing is shared with a player (metres).
export const VIEW = { enemies: 200, players: 160, resources: 200, loot: 200 };
// Creatures with nobody this close stop wandering until someone arrives.
export const AWAKE_RADIUS = 230;

// A uniform grid of buckets for fast "what is near here" queries.
export class Grid {
  constructor(cell = 100) {
    this.cell = cell;
    this.buckets = new Map();
  }
  key(cx, cz) {
    return cx * 100003 + cz;
  }
  build(items) {
    this.buckets.clear();
    for (const o of items) {
      const k = this.key(Math.floor(o.x / this.cell), Math.floor(o.z / this.cell));
      let b = this.buckets.get(k);
      if (!b) this.buckets.set(k, (b = []));
      b.push(o);
    }
    return this;
  }
  // Everything within r of (x, z).
  near(x, z, r) {
    const out = [],
      c = this.cell;
    for (let cx = Math.floor((x - r) / c); cx <= Math.floor((x + r) / c); cx++)
      for (let cz = Math.floor((z - r) / c); cz <= Math.floor((z + r) / c); cz++) {
        const b = this.buckets.get(this.key(cx, cz));
        if (b) for (const o of b) if (Math.hypot(o.x - x, o.z - z) < r) out.push(o);
      }
    return out;
  }
  any(x, z, r) {
    const c = this.cell;
    for (let cx = Math.floor((x - r) / c); cx <= Math.floor((x + r) / c); cx++)
      for (let cz = Math.floor((z - r) / c); cz <= Math.floor((z + r) / c); cz++) {
        const b = this.buckets.get(this.key(cx, cz));
        if (b) for (const o of b) if (Math.hypot(o.x - x, o.z - z) < r) return true;
      }
    return false;
  }
}

// Content that never changes while the server runs is sent once per client, keyed by a hash.
export function contentKey(content) {
  return createHash("sha1").update(JSON.stringify(content)).digest("hex").slice(0, 12);
}
