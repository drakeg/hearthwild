// Builds the Hollow Crypt from the KayKit Dungeon pack (CC0) using the shared layout.
import * as THREE from "./vendor/three.module.js";
import { GLTFLoader } from "./vendor/addons/GLTFLoader.js";
import { MeshoptDecoder } from "./vendor/addons/meshopt_decoder.module.js";
import { CRYPT, cryptCells, cryptWalls, cryptPillars } from "./dungeon-layout.js";

const PIECES = [
  "floor_tile_large", "floor_tile_large_rocks", "floor_dirt_large", "wall", "wall_cracked", "wall_arched", "wall_doorway",
  "pillar", "pillar_decorated", "torch_mounted", "banner_patternA_red", "banner_shield_red", "barrel_large", "barrel_small",
  "box_stacked", "crates_stacked", "rubble_large", "rubble_half", "table_long_broken", "candle_triple", "coin_stack_large",
  "chest", "sword_shield_broken", "column",
];

export function createDungeon(scene) {
  const group = new THREE.Group();
  group.visible = false;
  group.position.set(CRYPT.origin.x, 0, CRYPT.origin.z);
  scene.add(group);
  const occluders = [],
    torches = [],
    lights = [];
  // A small pool of lights follows the torches nearest the player.
  for (let i = 0; i < 6; i++) {
    const l = new THREE.PointLight("#ff9b45", 0, 15, 1.4);
    l.visible = false;
    scene.add(l);
    lights.push(l);
  }
  let rand = 7;
  const random = () => ((rand = (rand * 16807) % 2147483647) - 1) / 2147483646;
  const ready = (async () => {
    const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder),
      m = {};
    await Promise.all(PIECES.map(async (n) => (m[n] = (await loader.loadAsync(`/models/dungeon/${n}.glb`)).scene)));
    const put = (name, x, z, rot = 0, { y = 0, scale = 1, occlude = false } = {}) => {
      const o = m[name].clone(true);
      o.position.set(x, y, z);
      o.rotation.y = rot;
      o.scale.setScalar(scale);
      o.traverse((c) => {
        if (c.isMesh) {
          c.castShadow = true;
          c.receiveShadow = true;
          if (occlude) occluders.push(c);
        }
      });
      group.add(o);
      return o;
    };
    const sanctum = (z) => z < CRYPT.sanctum.maxZ;
    for (const c of cryptCells()) {
      const r = random();
      put(sanctum(c.z) ? (r < 0.5 ? "floor_tile_large" : "floor_dirt_large") : r < 0.2 ? "floor_tile_large_rocks" : "floor_tile_large", c.x, c.z, Math.floor(random() * 4) * (Math.PI / 2));
    }
    cryptWalls().forEach((w, i) => {
      const piece = sanctum(w.z) && i % 3 === 0 ? "wall_arched" : random() < 0.18 ? "wall_cracked" : "wall";
      put(piece, w.x, w.z, w.rot, { occlude: true });
      // Every few segments, a torch on the inner face.
      if (i % 3 === 1) {
        const tx = w.x + w.nx * 0.5,
          tz = w.z + w.nz * 0.5;
        put("torch_mounted", tx, tz, Math.atan2(w.nx, w.nz), { y: 2.3 });
        torches.push(new THREE.Vector3(CRYPT.origin.x + tx + w.nx * 0.5, 2.9, CRYPT.origin.z + tz + w.nz * 0.5));
      } else if (sanctum(w.z) && i % 3 === 2) put("banner_patternA_red", w.x + w.nx * 0.1, w.z + w.nz * 0.1, Math.atan2(w.nx, w.nz));
    });
    for (const p of cryptPillars()) put("pillar", p.x, p.z, 0, { occlude: true });
    // Sanctum columns and the warden's dais.
    for (const [x, z] of [[-8, -64], [8, -64], [-8, -76], [8, -76]]) put("pillar_decorated", x, z, 0, { occlude: true });
    for (const [n, x, z, r] of [
      ["barrel_large", -4.4, 3.6, 0.3], ["barrel_small", -3.6, 4.4, 0], ["crates_stacked", 4.2, 3.8, -0.4],
      ["rubble_half", -7.5, -26, 0.4], ["table_long_broken", 7, -22, Math.PI / 2], ["candle_triple", 7, -22.6, 0],
      ["box_stacked", -8, -20.5, 0.2], ["sword_shield_broken", 3.5, -48, 0.6], ["rubble_large", 9, -32, -0.3],
      ["coin_stack_large", -1.6, -79, 0], ["chest", 2, -79.5, Math.PI], ["candle_triple", -3, -78, 0], ["candle_triple", 3, -78, 0],
      ["column", -2, -70, 0], ["column", 2, -70, 0],
    ])
      put(n, x, z, r, n === "candle_triple" && z < -70 ? { y: 0 } : {});
    // Glowing exit portal.
    const portal = new THREE.Mesh(
      new THREE.TorusGeometry(1.2, 0.12, 12, 40),
      new THREE.MeshBasicMaterial({ color: "#9fd2ff", transparent: true, opacity: 0.85 }),
    );
    portal.position.set(CRYPT.exit.x, 1.5, CRYPT.exit.z + 0.5);
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
