// Builds Hearthwild's dungeons from the KayKit Dungeon pack (CC0) using the shared layouts.
// Each dungeon has a theme: tinted stone, floors, light colour and dressing of its own.
import * as THREE from "./vendor/three.module.js";
import { GLTFLoader } from "./vendor/addons/GLTFLoader.js";
import { MeshoptDecoder } from "./vendor/addons/meshopt_decoder.module.js";
import { CRYPT, cellsOf, wallsOf, pillarsOf } from "./dungeon-layout.js";

const PIECES = [
  "floor_tile_large", "floor_tile_large_rocks", "floor_dirt_large", "wall", "wall_cracked", "wall_arched", "wall_doorway",
  "pillar", "pillar_decorated", "torch_mounted", "banner_patternA_red", "banner_shield_red", "barrel_large", "barrel_small",
  "box_stacked", "crates_stacked", "rubble_large", "rubble_half", "table_long_broken", "candle_triple", "coin_stack_large",
  "chest", "sword_shield_broken", "column",
];
// Per-theme looks: stone tint, floor mix, torch colour, and the fog and light used inside.
export const THEMES = {
  crypt: { tint: "#ffffff", floorTint: "#ffffff", floors: ["floor_tile_large", "floor_tile_large_rocks"], dirt: 0.2, torch: "#ff9b45", banners: true,
    indoor: { bg: "#07060a", fog: "#0b0910", density: 0.04, hemi: ["#8f98c4", "#2a1d10", 1.05], sun: ["#b4c0ff", 0.7] } },
  barrow: { tint: "#c9a77f", floorTint: "#b89a72", floors: ["floor_dirt_large", "floor_dirt_large", "floor_tile_large_rocks"], dirt: 0.7, torch: "#ffb060", props: "bandit",
    indoor: { bg: "#0a0704", fog: "#120c06", density: 0.042, hemi: ["#b09a7a", "#2a1a0c", 1.0], sun: ["#ffd8a0", 0.6] } },
  chapel: { tint: "#8fb09a", floorTint: "#6f8f7a", floors: ["floor_tile_large", "floor_tile_large_rocks"], dirt: 0.3, torch: "#7fe0b0", water: "#2e5a4c", banners: true,
    indoor: { bg: "#04100c", fog: "#0a1d17", density: 0.05, hemi: ["#8fd0b8", "#0c1a10", 1.0], sun: ["#bff0d8", 0.55] } },
  depths: { tint: "#cfe6f5", floorTint: "#d8ecf8", floors: ["floor_tile_large", "floor_tile_large"], dirt: 0, torch: "#8fd0ff", ice: true,
    indoor: { bg: "#060c14", fog: "#0e1a28", density: 0.035, hemi: ["#cfe8ff", "#1a2a3a", 1.3], sun: ["#d8f0ff", 0.9] } },
  peak: { tint: "#7d7670", floorTint: "#6a625c", floors: ["floor_tile_large_rocks", "floor_tile_large"], dirt: 0.15, torch: "#ff6a2a", props: "runes",
    indoor: { bg: "#0c0504", fog: "#1a0a06", density: 0.04, hemi: ["#c08a70", "#200a04", 1.0], sun: ["#ffb080", 0.7] } },
};

let loaded = null;
function loadPieces() {
  loaded ??= (async () => {
    const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder),
      m = {};
    await Promise.all(PIECES.map(async (n) => (m[n] = (await loader.loadAsync(`/models/dungeon/${n}.glb`)).scene)));
    return m;
  })();
  return loaded;
}

export function createDungeon(scene, d = CRYPT) {
  const theme = THEMES[d.theme ?? "crypt"],
    group = new THREE.Group();
  group.visible = false;
  group.position.set(d.origin.x, 0, d.origin.z);
  scene.add(group);
  const occluders = [],
    torches = [],
    lights = [];
  // A small pool of lights follows the torches nearest the player.
  for (let i = 0; i < 6; i++) {
    const l = new THREE.PointLight(theme.torch, 0, 15, 1.4);
    l.visible = false;
    scene.add(l);
    lights.push(l);
  }
  let rand = 7 + d.id.length;
  const random = () => ((rand = (rand * 16807) % 2147483647) - 1) / 2147483646;
  // Tinted copies of the kit's materials give each dungeon its own stone.
  const tinted = new Map();
  const tintFor = (material, color) => {
    if (color === "#ffffff") return material;
    const key = material.uuid + color;
    if (!tinted.has(key)) {
      const m = material.clone();
      m.color = (m.color ?? new THREE.Color(1, 1, 1)).clone().multiply(new THREE.Color(color));
      if (theme.ice) (m.roughness = 0.35), (m.metalness = 0.05);
      tinted.set(key, m);
    }
    return tinted.get(key);
  };
  const ready = (async () => {
    const m = await loadPieces();
    const put = (name, x, z, rot = 0, { y = 0, scale = 1, occlude = false, tint = theme.tint } = {}) => {
      const o = m[name].clone(true);
      o.position.set(x, y, z);
      o.rotation.y = rot;
      o.scale.setScalar(scale);
      o.traverse((c) => {
        if (c.isMesh) {
          c.material = tintFor(c.material, tint);
          c.castShadow = true;
          c.receiveShadow = true;
          if (occlude) occluders.push(c);
        }
      });
      group.add(o);
      return o;
    };
    const s = d.sanctum,
      inSanctum = (x, z) => x > s.minX && x < s.maxX && z > s.minZ && z < s.maxZ,
      mid = { x: (s.minX + s.maxX) / 2, z: (s.minZ + s.maxZ) / 2 };
    for (const c of cellsOf(d)) {
      const r = random(),
        floor = r < theme.dirt ? "floor_dirt_large" : theme.floors[Math.floor(random() * theme.floors.length)];
      put(inSanctum(c.x, c.z) && d.theme === "crypt" ? (r < 0.5 ? "floor_tile_large" : "floor_dirt_large") : floor, c.x, c.z, Math.floor(random() * 4) * (Math.PI / 2), {
        tint: theme.floorTint,
      });
    }
    wallsOf(d).forEach((w, i) => {
      const piece = inSanctum(w.x, w.z) && i % 3 === 0 ? "wall_arched" : random() < 0.18 ? "wall_cracked" : "wall";
      put(piece, w.x, w.z, w.rot, { occlude: true });
      // Every few segments, a torch on the inner face.
      if (i % 3 === 1) {
        const tx = w.x + w.nx * 0.5,
          tz = w.z + w.nz * 0.5;
        put("torch_mounted", tx, tz, Math.atan2(w.nx, w.nz), { y: 2.3, tint: "#ffffff" });
        torches.push(new THREE.Vector3(d.origin.x + tx + w.nx * 0.5, 2.9, d.origin.z + tz + w.nz * 0.5));
      } else if (theme.banners && inSanctum(w.x, w.z) && i % 3 === 2)
        put("banner_patternA_red", w.x + w.nx * 0.1, w.z + w.nz * 0.1, Math.atan2(w.nx, w.nz), { tint: theme.tint });
    });
    for (const p of pillarsOf(d)) put("pillar", p.x, p.z, 0, { occlude: true });
    // The boss chamber: decorated columns around a dais, and a hoard behind the boss.
    const span = Math.min(8, (s.maxX - s.minX) / 2 - 4);
    for (const [x, z] of [[mid.x - span, s.maxZ - 6], [mid.x + span, s.maxZ - 6], [mid.x - span, s.minZ + 6], [mid.x + span, s.minZ + 6]])
      put("pillar_decorated", x, z, 0, { occlude: true });
    for (const [n, x, z, r] of [
      ["coin_stack_large", d.boss.x - 1.6, s.minZ + 3, 0], ["chest", d.boss.x + 2, s.minZ + 2.5, Math.PI],
      ["candle_triple", d.boss.x - 3, s.minZ + 4, 0], ["candle_triple", d.boss.x + 3, s.minZ + 4, 0],
      ["column", d.boss.x - 2, d.boss.z + 4, 0], ["column", d.boss.x + 2, d.boss.z + 4, 0],
    ])
      put(n, x, z, r, { tint: n === "candle_triple" ? "#ffffff" : theme.tint });
    // Room dressing along the way.
    const rooms = d.rooms.filter((r) => r.maxX - r.minX >= 10 && r !== d.rooms[0] && !(r.minZ === s.minZ && r.maxZ === s.maxZ));
    const dressing = theme.props === "bandit"
      ? ["barrel_large", "crates_stacked", "box_stacked", "table_long_broken", "barrel_small"]
      : theme.props === "runes" ? ["rubble_large", "rubble_half", "sword_shield_broken", "column"]
      : ["rubble_half", "table_long_broken", "box_stacked", "sword_shield_broken", "rubble_large"];
    rooms.forEach((r, i) => {
      for (let k = 0; k < 3; k++) {
        const x = (k % 2 ? r.maxX - 2 : r.minX + 2),
          z = r.minZ + 2 + ((r.maxZ - r.minZ - 4) * (k + 0.5)) / 3;
        put(dressing[(i + k) % dressing.length], x, z, random() * Math.PI * 2);
      }
    });
    for (const [n, x, z, rot] of [["barrel_large", -4.4, 3.6, 0.3], ["barrel_small", -3.6, 4.4, 0], ["crates_stacked", 4.2, 3.8, -0.4]]) put(n, x, z, rot);
    // Murky water covering the chapel floor; ice gleaming in the depths.
    if (theme.water || theme.ice) {
      const water = new THREE.Mesh(
        new THREE.PlaneGeometry(200, 200),
        new THREE.MeshPhysicalMaterial({ color: theme.water ?? "#cfe8f8", transparent: true, opacity: theme.water ? 0.55 : 0.18, roughness: 0.05, clearcoat: 1, depthWrite: false }),
      );
      water.rotation.x = -Math.PI / 2;
      water.position.set(0, theme.water ? 0.18 : 0.03, -40);
      group.add(water);
    }
    // Glowing exit portal.
    const portal = new THREE.Mesh(
      new THREE.TorusGeometry(1.2, 0.12, 12, 40),
      new THREE.MeshBasicMaterial({ color: "#9fd2ff", transparent: true, opacity: 0.85 }),
    );
    portal.position.set(d.exit.x, 1.5, d.exit.z + 0.5);
    group.add(portal);
    const swirl = new THREE.Mesh(
      new THREE.CircleGeometry(1.15, 40),
      new THREE.MeshBasicMaterial({ color: "#4a8fd8", transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false }),
    );
    swirl.position.copy(portal.position);
    group.add(swirl);
    return { portal, swirl };
  })();
  let portalParts = null;
  ready.then((p) => (portalParts = p)).catch((e) => console.warn("Dungeon models unavailable", e));
  return {
    id: d.id,
    theme,
    group,
    occluders,
    ready,
    setActive(on) {
      group.visible = on;
      for (const l of lights) l.visible = on;
    },
    update(t, player) {
      if (!group.visible) return;
      if (portalParts) {
        portalParts.portal.rotation.z = t * 0.6;
        portalParts.swirl.material.opacity = 0.3 + Math.sin(t * 2) * 0.08;
      }
      if (!player) return;
      const near = torches
        .map((p) => [p, p.distanceToSquared(player)])
        .sort((a, b) => a[1] - b[1])
        .slice(0, lights.length);
      lights.forEach((l, i) => {
        const n = near[i];
        if (!n) return (l.intensity = 0);
        l.position.copy(n[0]);
        l.intensity = 26 + Math.sin(t * 11 + i * 3) * 4 + Math.sin(t * 27 + i) * 2;
      });
    },
  };
}
