// The wider world, streamed around the player: terrain chunks with distance-based detail,
// zone-specific scenery from the Stylized Nature MegaKit, road surfaces, lakes and ice, and
// towns built from Medieval Village MegaKit pieces (Quaternius, CC0). Original Hearthwild code.
import * as THREE from "./vendor/three.module.js";
import { GLTFLoader } from "./vendor/addons/GLTFLoader.js";
import { MeshoptDecoder } from "./vendor/addons/meshopt_decoder.module.js";
import { mergeGeometries } from "./vendor/addons/BufferGeometryUtils.js";
import {
  WORLD_HALF,
  terrainHeight,
  zoneWeights,
  roadDistance,
  fbm,
  ROADS,
  ROAD_WIDTH,
  LAKES,
  TOWNS,
  HOUSES,
  GRAVEYARDS,
  townAt,
  lakeAt,
  insideHouse,
} from "./terrain.js";

const CHUNK = 100;
const NATURE = [
  "commontree_1", "commontree_2", "commontree_3", "commontree_4", "commontree_5",
  "pine_1", "pine_2", "pine_3", "pine_4", "pine_5", "twistedtree_1", "twistedtree_3", "deadtree_1", "deadtree_3",
  "bush_common", "bush_common_flowers", "fern_1", "plant_1", "plant_7", "grass_common_short", "grass_common_tall",
  "grass_wispy_tall", "flower_3_group", "flower_4_group", "mushroom_common", "rock_medium_1", "rock_medium_2", "rock_medium_3", "clover_1",
];
const TALL = /tree|pine/;
// Instance tints (multiplied with the model's own colours) per zone.
const TINT = {
  stillwood: [1, 1, 1],
  downs: [1.0, 0.86, 0.5],
  marsh: [0.72, 0.8, 0.58],
  frost: [0.78, 0.88, 0.96],
  crags: [0.86, 0.82, 0.66],
};

function seeded(cx, cz) {
  let s = (Math.imul(cx + 101, 73856093) ^ Math.imul(cz + 211, 19349663)) >>> 0 || 1;
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
}
const dominant = (w) => Object.entries(w).reduce((a, b) => (b[1] > a[1] ? b : a))[0];

// Ground colour from the zone blend, slope and nearby roads.
const tmp = new THREE.Color(),
  mix = new THREE.Color();
export function groundColor(x, z, h, slope, w, out) {
  out.setRGB(0, 0, 0);
  const add = (weight, hh, ss, ll) => {
    if (weight <= 0) return;
    // The new zones' colours are given as on-screen (sRGB) colours.
    tmp.setHSL(hh, ss, ll, THREE.SRGBColorSpace);
    out.r += tmp.r * weight;
    out.g += tmp.g * weight;
    out.b += tmp.b * weight;
  };
  const n = fbm(x * 0.05, z * 0.05, 5),
    dry = Math.max(0, Math.sin(x * 0.045 + 1.3) * Math.cos(z * 0.05)) * 0.6;
  // The Stillwood keeps its original tint (the old ground texture was a pale sage green).
  if (w.stillwood > 0) {
    tmp.setHSL(0.25 - dry * 0.07 + n * 0.02, 0.5 - dry * 0.12, 0.33 + n * 0.04);
    out.r += tmp.r * 0.85 * w.stillwood;
    out.g += tmp.g * 0.9 * w.stillwood;
    out.b += tmp.b * 0.75 * w.stillwood;
  }
  // Golden grass with greener hollows.
  const green = Math.max(0, fbm(x * 0.012, z * 0.012, 6)) * 1.6;
  add(w.downs, 0.11 + n * 0.02 + green * 0.08, 0.42 + green * 0.04, 0.47 + n * 0.05 - green * 0.08);
  add(w.marsh, 0.2 + n * 0.03, 0.32, 0.3 + n * 0.05);
  // Snow lies everywhere in the vale except on steep banks.
  add(w.frost * (1 - Math.min(1, slope * 1.4)), 0.6, 0.45, 0.95 + n * 0.03);
  add(w.frost * Math.min(1, slope * 1.4), 0.3, 0.12, 0.42);
  // The crags are bare rock on slopes and thin grass on the flats.
  const rock = Math.min(1, slope * 1.3 + 0.45 + n * 0.3);
  add(w.crags * rock, 0.08, 0.06, 0.5 + n * 0.08);
  add(w.crags * (1 - rock), 0.22, 0.3, 0.38);
  // Packed earth along the road shoulders.
  const road = roadDistance(x, z);
  if (road < 5) {
    mix.setHSL(0.09, 0.3, 0.4, THREE.SRGBColorSpace);
    out.lerp(mix, (1 - road / 5) * 0.55);
  }
  // Rocky, then snow-capped, rim mountains.
  if (h > 24 && Math.max(Math.abs(x), Math.abs(z)) > 880) {
    mix.setHSL(0.6, 0.08, h > 48 ? 0.92 : 0.5);
    out.lerp(mix, Math.min(1, (h - 24) / 20));
  }
  return out;
}

// A terrain chunk with a skirt that hides cracks between detail levels.
export function terrainChunk(cx, cz, seg, material) {
  const x0 = cx * CHUNK - WORLD_HALF,
    z0 = cz * CHUNK - WORLD_HALF,
    step = CHUNK / seg,
    n = seg + 3,
    pos = new Float32Array(n * n * 3),
    nor = new Float32Array(n * n * 3),
    col = new Float32Array(n * n * 3),
    uv = new Float32Array(n * n * 2),
    c = new THREE.Color();
  for (let j = 0; j < n; j++)
    for (let i = 0; i < n; i++) {
      const ii = Math.max(0, Math.min(seg, i - 1)),
        jj = Math.max(0, Math.min(seg, j - 1)),
        skirt = ii !== i - 1 || jj !== j - 1,
        x = x0 + ii * step,
        z = z0 + jj * step,
        h = terrainHeight(x, z),
        hx = (terrainHeight(x + 1, z) - terrainHeight(x - 1, z)) / 2,
        hz = (terrainHeight(x, z + 1) - terrainHeight(x, z - 1)) / 2,
        slope = Math.hypot(hx, hz),
        k = j * n + i;
      // Normals come from the terrain itself, so chunk edges (and their skirts) light identically.
      const inv = 1 / Math.hypot(hx, 1, hz);
      nor[k * 3] = -hx * inv;
      nor[k * 3 + 1] = inv;
      nor[k * 3 + 2] = -hz * inv;
      pos[k * 3] = x;
      pos[k * 3 + 1] = skirt ? h - 4 : h;
      pos[k * 3 + 2] = z;
      groundColor(x, z, h, slope, zoneWeights(x, z), c);
      col[k * 3] = c.r;
      col[k * 3 + 1] = c.g;
      col[k * 3 + 2] = c.b;
      uv[k * 2] = (x - x0) / CHUNK;
      uv[k * 2 + 1] = (z - z0) / CHUNK;
    }
  const index = [];
  for (let j = 0; j < n - 1; j++)
    for (let i = 0; i < n - 1; i++) {
      const a = j * n + i,
        b = a + 1,
        d = a + n,
        e = d + 1;
      index.push(a, d, b, b, d, e);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("color", new THREE.BufferAttribute(col, 3));
  g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  g.setAttribute("normal", new THREE.BufferAttribute(nor, 3));
  g.setIndex(index);
  const m = new THREE.Mesh(g, material);
  m.receiveShadow = true;
  m.userData.seg = seg;
  return m;
}

// Where scenery may grow: away from the old clearing (it has its own), roads, towns and water.
function openForNature(x, z, roadMargin) {
  return (
    Math.hypot(x, z) > 102 &&
    roadDistance(x, z) > ROAD_WIDTH / 2 + roadMargin &&
    !townAt(x, z, 10) &&
    !lakeAt(x, z, 2) &&
    !insideHouse(x, z, 3) &&
    Math.max(Math.abs(x), Math.abs(z)) < 905
  );
}
// Deterministic scenery for one chunk: [{ name, matrix, tint }].
function chunkNature(cx, cz, density) {
  const random = seeded(cx, cz),
    x0 = cx * CHUNK - WORLD_HALF,
    z0 = cz * CHUNK - WORLD_HALF,
    out = [],
    dummy = new THREE.Object3D(),
    pick = (list) => list[Math.floor(random() * list.length)];
  const center = zoneWeights(x0 + 50, z0 + 50);
  if (Math.hypot(x0 + 50, z0 + 50) < 60) return out;
  const place = (name, x, z, scale, zone, tilt = 0.05) => {
    dummy.position.set(x, terrainHeight(x, z) - 0.05, z);
    dummy.rotation.set((random() - 0.5) * tilt, random() * Math.PI * 2, (random() - 0.5) * tilt);
    dummy.scale.setScalar(scale);
    dummy.updateMatrix();
    out.push({ name, matrix: dummy.matrix.clone(), tint: TINT[zone] });
  };
  const scatter = (count, margin, fn, cluster = 0) => {
    let cx2 = x0 + random() * CHUNK,
      cz2 = z0 + random() * CHUNK;
    for (let i = 0, tries = 0; i < count * density && tries < count * 8; tries++) {
      if (cluster && random() < 0.15) (cx2 = x0 + random() * CHUNK), (cz2 = z0 + random() * CHUNK);
      const x = cluster ? cx2 + (random() - 0.5) * cluster : x0 + random() * CHUNK,
        z = cluster ? cz2 + (random() - 0.5) * cluster : z0 + random() * CHUNK;
      if (x < x0 || x >= x0 + CHUNK || z < z0 || z >= z0 + CHUNK || !openForNature(x, z, margin)) continue;
      const zone = dominant(zoneWeights(x, z));
      fn(x, z, zone);
      i++;
    }
  };
  const broadleaf = ["commontree_1", "commontree_2", "commontree_3", "commontree_4", "commontree_5"],
    conifers = ["pine_1", "pine_2", "pine_3", "pine_4", "pine_5"],
    rocks = ["rock_medium_1", "rock_medium_2", "rock_medium_3"],
    grass = ["grass_common_short", "grass_common_short", "grass_common_tall", "grass_wispy_tall"];
  const w = center;
  // Trees.
  scatter(Math.round(26 * w.stillwood + 6 * w.downs + 12 * w.marsh + 30 * w.frost + 8 * w.crags), 2.5, (x, z, zone) => {
    if (zone === "stillwood") place(random() < 0.6 ? pick(broadleaf) : pick(conifers), x, z, 0.9 + random() * 0.6, zone);
    else if (zone === "downs") place(pick(broadleaf), x, z, 0.8 + random() * 0.5, zone);
    else if (zone === "marsh") place(random() < 0.55 ? pick(["twistedtree_1", "twistedtree_3"]) : pick(["deadtree_1", "deadtree_3"]), x, z, zone === "marsh" && random() < 0.55 ? 0.45 + random() * 0.25 : 0.7 + random() * 0.4, zone);
    else if (zone === "frost") place(random() < 0.9 ? pick(conifers) : pick(["deadtree_1", "deadtree_3"]), x, z, 1 + random() * 0.7, zone);
    else place(random() < 0.6 ? pick(conifers) : pick(["deadtree_1", "deadtree_3"]), x, z, 0.8 + random() * 0.5, zone);
  }, w.downs > 0.5 ? 26 : 0);
  // Bushes and undergrowth.
  scatter(Math.round(18 * w.stillwood + 14 * w.downs + 12 * w.marsh + 2 * w.frost + 4 * w.crags), 0.8, (x, z, zone) =>
    place(pick(["bush_common", "bush_common", "bush_common_flowers"]), x, z, 0.6 + random() * 0.6, zone),
  );
  scatter(Math.round(26 * w.stillwood + 4 * w.downs + 50 * w.marsh + 2 * w.frost + 3 * w.crags), 0.4, (x, z, zone) =>
    place(pick(zone === "marsh" ? ["fern_1", "plant_1", "plant_7", "fern_1"] : ["fern_1", "plant_1", "plant_7", "clover_1"]), x, z, 0.5 + random() * 0.7, zone),
  );
  // Grass and flowers.
  scatter(Math.round(70 * w.stillwood + 120 * w.downs + 90 * w.marsh + 14 * w.frost + 30 * w.crags), 0, (x, z, zone) => {
    const kind = zone === "downs" || zone === "marsh" ? pick(["grass_wispy_tall", "grass_common_tall", "grass_wispy_tall"]) : pick(grass);
    place(kind, x, z, kind === "grass_wispy_tall" ? 0.35 + random() * 0.35 : 0.7 + random() * 0.6, zone);
  });
  scatter(Math.round(22 * w.stillwood + 40 * w.downs + 6 * w.marsh), 0, (x, z, zone) => place(pick(["flower_3_group", "flower_4_group"]), x, z, 0.6 + random() * 0.5, zone), 10);
  scatter(Math.round(6 * w.stillwood + 22 * w.marsh), 0.5, (x, z, zone) => place("mushroom_common", x, z, 0.5 + random() * 0.6, zone));
  // Stone: a scattering in the lowlands, boulder fields in the crags.
  scatter(Math.round(6 * w.stillwood + 4 * w.downs + 3 * w.marsh + 12 * w.frost + 34 * w.crags), 1, (x, z, zone) =>
    place(pick(rocks), x, z, zone === "crags" ? 0.8 + random() * 2.2 : 0.35 + random() * 0.8, zone, 0.4),
  );
  // Reeds crowd the shores of open water.
  for (const l of LAKES) {
    if (l.frozen || l.x + l.r + 6 < x0 || l.x - l.r - 6 > x0 + CHUNK || l.z + l.r + 6 < z0 || l.z - l.r - 6 > z0 + CHUNK) continue;
    for (let i = 0; i < l.r * 3 * density; i++) {
      const a = random() * Math.PI * 2,
        r = l.r * (0.95 + random() * 0.25),
        x = l.x + Math.cos(a) * r,
        z = l.z + Math.sin(a) * r;
      if (x < x0 || x >= x0 + CHUNK || z < z0 || z >= z0 + CHUNK || roadDistance(x, z) < 4) continue;
      const zone = dominant(zoneWeights(x, z));
      place(random() < 0.7 ? "grass_wispy_tall" : "grass_common_tall", x, z, 0.5 + random() * 0.4, zone);
    }
  }
  return out;
}

export function createWorldStream(scene, { GRAPHICS, groundMap, rockMat, roadMap, dequantize }) {
  const root = new THREE.Group();
  scene.add(root);
  const low = GRAPHICS.quality === "low",
    TERRAIN_R = low ? 2 : 3,
    NATURE_R = low ? 1 : 2;
  // A neutral grey copy of the painted ground, so vertex colours set each zone's true colour.
  const map = (() => {
    const src = groundMap.image,
      c = document.createElement("canvas");
    c.width = src.width;
    c.height = src.height;
    const ctx = c.getContext("2d");
    ctx.filter = "grayscale(1) brightness(1.12)";
    ctx.drawImage(src, 0, 0);
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    t.repeat.set(16, 16);
    return t;
  })();
  const groundMat = new THREE.MeshStandardMaterial({ vertexColors: true, map, roughness: 1 });
  const chunks = new Map();
  const segFor = (ring) => (ring <= 1 ? (low ? 40 : 64) : ring === 2 ? (low ? 20 : 32) : 16);
  const N = (WORLD_HALF * 2) / CHUNK;

  // ---------- Roads ----------
  {
    const pos = [],
      uv = [],
      index = [];
    let base = 0;
    for (const road of ROADS) {
      // Resample at ~2 m so the ribbon follows the ground closely.
      const pts = [];
      for (let i = 0; i < road.length - 1; i++) {
        const [ax, az] = road[i],
          [bx, bz] = road[i + 1],
          n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / 2));
        for (let k = 0; k < n; k++) pts.push([ax + ((bx - ax) * k) / n, az + ((bz - az) * k) / n]);
      }
      pts.push(road[road.length - 1]);
      let along = 0;
      pts.forEach(([x, z], i) => {
        const [px, pz] = pts[Math.max(0, i - 1)],
          [nx, nz] = pts[Math.min(pts.length - 1, i + 1)],
          dx = nx - px,
          dz = nz - pz,
          len = Math.hypot(dx, dz) || 1,
          ox = -dz / len,
          oz = dx / len;
        if (i) along += Math.hypot(x - px, z - pz);
        for (const s of [-1, 0, 1]) {
          const vx = x + ox * s * (ROAD_WIDTH / 2),
            vz = z + oz * s * (ROAD_WIDTH / 2);
          pos.push(vx, terrainHeight(vx, vz) + 0.1, vz);
          uv.push((s + 1) * 0.5, along / 4);
        }
        if (i < pts.length - 1)
          for (let s = 0; s < 2; s++) {
            const a = base + i * 3 + s;
            index.push(a, a + 1, a + 3, a + 1, a + 4, a + 3);
          }
      });
      base += pts.length * 3;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(index);
    // Roads face the sky whatever order their triangles were wound in.
    g.setAttribute("normal", new THREE.Float32BufferAttribute(new Float32Array(pos.length).map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
    const tex = roadMap.clone();
    tex.needsUpdate = true;
    tex.repeat.set(1, 1);
    const road = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: "#a8977a", map: tex, roughness: 1, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 }));
    road.receiveShadow = true;
    root.add(road);
  }

  // ---------- Lakes and ice ----------
  // A soft ripple pattern so open water reads as water even without reflections.
  const ripple = (() => {
    const c = document.createElement("canvas");
    c.width = c.height = 256;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#808080";
    ctx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 260; i++) {
      const x = (i * 97) % 256,
        y = (i * 61 + i * i) % 256,
        r = 6 + (i % 7) * 4;
      ctx.strokeStyle = `rgba(255,255,255,${0.05 + (i % 5) * 0.025})`;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.ellipse(x, y, r, r * 0.35, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(6, 6);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();
  const waterMat = new THREE.MeshPhysicalMaterial({ color: "#5aa6c4", map: ripple, metalness: 0.1, roughness: 0.06, transparent: true, opacity: 0.78, clearcoat: 1 }),
    bogMat = new THREE.MeshPhysicalMaterial({ color: "#6f8f7a", map: ripple, metalness: 0.05, roughness: 0.1, transparent: true, opacity: 0.82, clearcoat: 0.8 }),
    iceMat = new THREE.MeshStandardMaterial({ color: "#d8ecf7", roughness: 0.12, metalness: 0.05, transparent: true, opacity: 0.94 });
  for (const l of LAKES) {
    const g = new THREE.CircleGeometry(l.r * 1.12, 56);
    g.rotateX(-Math.PI / 2);
    // A slightly irregular shoreline.
    const p = g.attributes.position;
    for (let i = 1; i < p.count; i++) {
      const x = p.getX(i),
        z = p.getZ(i),
        k = 1 + fbm((l.x + x) * 0.03, (l.z + z) * 0.03, 81) * 0.25;
      p.setXYZ(i, x * k, 0, z * k);
    }
    const m = new THREE.Mesh(g, l.frozen ? iceMat : l.name.startsWith("Blackwater") ? bogMat : waterMat);
    m.position.set(l.x, l.frozen ? l.level + 0.32 : l.level, l.z);
    m.receiveShadow = true;
    root.add(m);
  }

  // ---------- Graveyard shrines ----------
  for (const g of GRAVEYARDS.slice(1)) {
    const y = terrainHeight(g.x, g.z),
      shrine = new THREE.Group();
    shrine.position.set(g.x + 2.5, y, g.z + 1.5);
    const plinth = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.3, 0.45, 10), rockMat);
    plinth.position.y = 0.22;
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.4, 1.4, 8), rockMat);
    pillar.position.y = 1.1;
    const crystal = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.42),
      new THREE.MeshStandardMaterial({ color: "#a8d8ff", emissive: "#6fb6ff", emissiveIntensity: 0.9, roughness: 0.2 }),
    );
    crystal.position.y = 2.15;
    crystal.userData.spin = true;
    for (const o of [plinth, pillar, crystal]) (o.castShadow = true), shrine.add(o);
    root.add(shrine);
  }

  // ---------- Nature pools ----------
  const natureModels = {};
  let natureReady = false;
  const pools = new Map(); // name → [{ mesh }]
  const occluders = [],
    buildings = [];
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  Promise.all(NATURE.map(async (n) => (natureModels[n] = (await loader.loadAsync(`/models/nature/${n}.glb`)).scene)))
    .then(() => {
      for (const name of NATURE) {
        const parts = [];
        const rootModel = natureModels[name];
        rootModel.updateMatrixWorld(true);
        rootModel.traverse((o) => {
          if (!o.isMesh) return;
          const geo = dequantize(o.geometry).applyMatrix4(o.matrixWorld);
          parts.push({ geo, material: o.material, mesh: null, capacity: 0 });
        });
        pools.set(name, parts);
      }
      natureReady = true;
      natureDirty = true;
    })
    .catch((e) => console.warn("Wider-world scenery unavailable", e));
  let natureDirty = false,
    natureKey = "";
  const white = new THREE.Color(1, 1, 1),
    tint = new THREE.Color();
  function rebuildNature(centerX, centerZ) {
    const lists = new Map();
    for (let dz = -NATURE_R; dz <= NATURE_R; dz++)
      for (let dx = -NATURE_R; dx <= NATURE_R; dx++) {
        const c = chunks.get(`${centerX + dx},${centerZ + dz}`);
        if (!c?.nature) continue;
        for (const item of c.nature) {
          if (!lists.has(item.name)) lists.set(item.name, []);
          lists.get(item.name).push(item);
        }
      }
    occluders.length = 0;
    // Houses always block the camera, like trees.
    occluders.push(...buildings);
    for (const [name, parts] of pools) {
      const items = lists.get(name) ?? [];
      for (const part of parts) {
        if (items.length > part.capacity) {
          if (part.mesh) root.remove(part.mesh), part.mesh.dispose();
          part.capacity = Math.ceil(items.length * 1.5) + 16;
          part.mesh = new THREE.InstancedMesh(part.geo, part.material, part.capacity);
          part.mesh.castShadow = GRAPHICS.shadows && (TALL.test(name) || /rock|bush/.test(name));
          part.mesh.receiveShadow = GRAPHICS.shadows;
          part.mesh.frustumCulled = false;
          root.add(part.mesh);
        }
        if (!part.mesh) continue;
        items.forEach((it, i) => {
          part.mesh.setMatrixAt(i, it.matrix);
          part.mesh.setColorAt(i, it.tint ? tint.setRGB(...it.tint) : white);
        });
        part.mesh.count = items.length;
        part.mesh.instanceMatrix.needsUpdate = true;
        if (part.mesh.instanceColor) part.mesh.instanceColor.needsUpdate = true;
        if (TALL.test(name) && items.length) occluders.push(part.mesh);
      }
    }
  }

  // ---------- Towns ----------
  const townLights = [];
  for (let i = 0; i < 4; i++) {
    const l = new THREE.PointLight("#ffb862", 0, 14, 1.6);
    root.add(l);
    townLights.push(l);
  }
  const lamps = [];
  const townReady = (async () => {
    let village, props;
    try {
      village = (await loader.loadAsync("/models/props/village.glb")).scene;
      const names = ["barrel", "barrel_apples", "crate_wooden", "farmcrate_carrot", "farmcrate_apple", "stall_empty", "stall_cart_empty", "bench", "torch_metal", "prop_wagon", "bucket_wooden_1", "prop_woodenfence_single", "banner_1", "banner_1_cloth"];
      props = Object.fromEntries(await Promise.all(names.map(async (n) => [n, (await loader.loadAsync(`/models/props/${n}.glb`)).scene])));
    } catch (e) {
      console.warn("Town models unavailable", e);
      return;
    }
    village.updateMatrixWorld(true);
    const piece = (name) => village.getObjectByName(name);
    for (const town of TOWNS) {
      const buckets = new Map(),
        base = terrainHeight(town.x, town.z);
      const addPiece = (obj, matrix) => {
        obj.updateMatrixWorld(true);
        const inv = new THREE.Matrix4().copy(obj.matrixWorld).invert();
        obj.traverse((o) => {
          if (!o.isMesh) return;
          const local = new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld),
            geo = dequantize(o.geometry);
          for (const k of Object.keys(geo.attributes)) if (!["position", "normal", "uv"].includes(k)) geo.deleteAttribute(k);
          if (!geo.attributes.uv) geo.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(geo.attributes.position.count * 2), 2));
          geo.applyMatrix4(new THREE.Matrix4().multiplyMatrices(matrix, local));
          const key = o.material.uuid;
          if (!buckets.has(key)) buckets.set(key, { material: o.material, geos: [] });
          buckets.get(key).geos.push(geo.index ? geo : geo);
        });
      };
      const at = (x, y, z, rot = 0, s = 1) =>
        new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rot), new THREE.Vector3(s, s, s));
      for (const h of HOUSES.filter((h) => h.town === town.id)) {
        const house = at(h.x, base, h.z, h.rot);
        const local = (x, y, z, rot = 0) => new THREE.Matrix4().multiplyMatrices(house, at(x, y, z, rot));
        const brick = h.style === 1,
          wall = brick ? "Wall_UnevenBrick" : "Wall_Plaster",
          W = h.w,
          D = h.d;
        // Walls: four sides of 2 m modules, a door in front, windows elsewhere.
        const sides = [
          { n: W / 2, rot: 0, pos: (k) => [-W / 2 + 1 + k * 2, D / 2], front: true },
          { n: W / 2, rot: Math.PI, pos: (k) => [W / 2 - 1 - k * 2, -D / 2] },
          { n: D / 2, rot: Math.PI / 2, pos: (k) => [W / 2, D / 2 - 1 - k * 2] },
          { n: D / 2, rot: -Math.PI / 2, pos: (k) => [-W / 2, -D / 2 + 1 + k * 2] },
        ];
        for (const side of sides)
          for (let k = 0; k < side.n; k++) {
            const [x, z] = side.pos(k),
              door = side.front && k === Math.floor((side.n - 1) / 2),
              window = !door && k % 2 === (side.front ? 1 : 0) && side.n > 1;
            const kind = door ? `${wall}_Door_Round` : window ? `${wall}_Window_Wide_Round` : brick ? `${wall}_Straight` : k % 2 ? "Wall_Plaster_WoodGrid" : `${wall}_Straight`;
            addPiece(piece(kind), local(x, 0, z, side.rot));
            if (door) addPiece(piece("Door_1_Round"), local(x - 0.53 * Math.cos(side.rot), 0, z, side.rot));
            if (window) {
              addPiece(piece("Window_Wide_Round1"), local(x, 0, z, side.rot));
              addPiece(piece("WindowShutters_Wide_Round_Open"), local(x, 0, z, side.rot));
            }
          }
        for (const [sx, sz] of [[1, 1], [-1, 1], [1, -1], [-1, -1]])
          addPiece(piece(brick ? "Corner_Exterior_Brick" : "Corner_Exterior_Wood"), local((sx * W) / 2, 0, (sz * D) / 2, Math.atan2(sx, sz) - Math.PI / 4));
        addPiece(piece(`Roof_RoundTiles_${W}x${D}`), local(0, 3.05, 0));
        addPiece(piece(`Roof_Front_Brick${W}`), local(0, 3.05, D / 2 - 0.2, 0));
        addPiece(piece(`Roof_Front_Brick${W}`), local(0, 3.05, -D / 2 + 0.2, Math.PI));
        addPiece(piece("Prop_Chimney"), local(W / 2 - 1.1, 3.6, -D / 4));
        // A stone plinth so the house sits firmly on the ground.
        const plinth = new THREE.BoxGeometry(W + 0.7, 1.2, D + 0.7);
        plinth.translate(0, -0.55, 0);
        plinth.applyMatrix4(house);
        if (!buckets.has("plinth")) buckets.set("plinth", { material: rockMat, geos: [] });
        buckets.get("plinth").geos.push(plinth.toNonIndexed());
      }
      for (const { material, geos } of buckets.values()) {
        const indexed = geos.filter((g) => g.index),
          flat = geos.filter((g) => !g.index);
        for (const list of [indexed, flat]) {
          if (!list.length) continue;
          const merged = mergeGeometries(list, false);
          if (!merged) continue;
          const mesh = new THREE.Mesh(merged, material);
          mesh.castShadow = GRAPHICS.shadows;
          mesh.receiveShadow = GRAPHICS.shadows;
          root.add(mesh);
          buildings.push(mesh);
        }
      }
      // Market dressing, benches and lamp posts around the square.
      const put = (name, dx, dz, rot = 0, s = 1, y = 0) => {
        const o = props[name].clone(true);
        o.position.set(town.x + dx, base + y, town.z + dz);
        o.rotation.y = rot;
        o.scale.setScalar(s);
        o.traverse((m) => m.isMesh && ((m.castShadow = GRAPHICS.shadows), (m.receiveShadow = GRAPHICS.shadows)));
        root.add(o);
        return o;
      };
      put("stall_empty", -8, 8, Math.PI / 2);
      put("barrel", -10, 3.5, 0);
      put("barrel_apples", -9.4, 11.8, 0.4);
      put("crate_wooden", -6, 10.6, 0.3);
      put("farmcrate_carrot", -10.5, 6.2, 0);
      put("bench", 6, 7, 0, 0.8);
      put("bench", -3, -7, Math.PI, 0.8);
      put(town.zone === "downs" ? "prop_wagon" : "stall_cart_empty", 9, -2, -0.6);
      put("bucket_wooden_1", 5.5, -6.5, 0);
      for (const [dx, dz] of [[-6, -6], [6, 3], [-3, 12], [9, -9]]) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.15, 2.6, 8), new THREE.MeshStandardMaterial({ color: "#6a4a30", roughness: 1 }));
        post.position.set(town.x + dx, base + 1.3, town.z + dz);
        post.castShadow = GRAPHICS.shadows;
        root.add(post);
        put("torch_metal", dx, dz, 0, 1.7, 2.4);
        lamps.push(new THREE.Vector3(town.x + dx, base + 3.1, town.z + dz));
      }
    }
  })();

  // ---------- Streaming ----------
  let lastKey = "",
    queue = [];
  const centerChunk = (x, z) => [Math.floor((x + WORLD_HALF) / CHUNK), Math.floor((z + WORLD_HALF) / CHUNK)];
  function plan(cx, cz) {
    const want = new Map();
    for (let dz = -TERRAIN_R; dz <= TERRAIN_R; dz++)
      for (let dx = -TERRAIN_R; dx <= TERRAIN_R; dx++) {
        const x = cx + dx,
          z = cz + dz;
        if (x < 0 || z < 0 || x >= N || z >= N) continue;
        want.set(`${x},${z}`, { x, z, ring: Math.max(Math.abs(dx), Math.abs(dz)) });
      }
    for (const [key, c] of chunks)
      if (!want.has(key)) {
        root.remove(c.mesh);
        c.mesh.geometry.dispose();
        chunks.delete(key);
        natureDirty = true;
      }
    queue = [...want.entries()]
      .filter(([key, w]) => chunks.get(key)?.seg !== segFor(w.ring) || (w.ring <= NATURE_R && !chunks.get(key)?.nature))
      .sort((a, b) => a[1].ring - b[1].ring)
      .map(([key, w]) => ({ key, ...w }));
  }
  function build(job) {
    const seg = segFor(job.ring);
    let c = chunks.get(job.key);
    if (!c || c.seg !== seg) {
      if (c) root.remove(c.mesh), c.mesh.geometry.dispose();
      const mesh = terrainChunk(job.x, job.z, seg, groundMat);
      root.add(mesh);
      c = { mesh, seg, nature: c?.nature ?? null };
      chunks.set(job.key, c);
    }
    if (job.ring <= NATURE_R && !c.nature) {
      c.nature = chunkNature(job.x, job.z, GRAPHICS.density);
      natureDirty = true;
    }
  }
  const spinners = [];
  root.traverse((o) => o.userData.spin && spinners.push(o));
  let current = [0, 0],
    lastX = 0,
    lastZ = 0;
  return {
    root,
    occluders,
    townReady,
    // Builds the first ring synchronously so the player never stands on nothing.
    prime(x, z, all = false) {
      current = centerChunk(x, z);
      plan(...current);
      const limit = all ? NATURE_R : 1;
      for (const job of queue.filter((j) => j.ring <= limit)) build(job);
      queue = queue.filter((j) => j.ring > limit);
      if (natureReady) (natureDirty = false), rebuildNature(...current);
    },
    update(t, x, z) {
      // After a teleport (respawn, entering the world) build everything nearby at once.
      if (!chunks.size || Math.hypot(x - lastX, z - lastZ) > 120) {
        this.prime(x, z, true);
        lastKey = "";
      }
      lastX = x;
      lastZ = z;
      const [cx, cz] = centerChunk(x, z),
        key = `${cx},${cz}`;
      if (key !== lastKey) {
        lastKey = key;
        current = [cx, cz];
        plan(cx, cz);
        natureDirty = true;
      }
      // A few milliseconds of building per frame keeps travel smooth.
      const start = performance.now();
      while (queue.length && performance.now() - start < 7) build(queue.shift());
      if (natureReady && natureDirty && !queue.some((j) => j.ring <= NATURE_R)) {
        natureDirty = false;
        rebuildNature(...current);
      }
      for (const s of spinners) (s.rotation.y = t * 0.8), (s.position.y = 2.15 + Math.sin(t * 1.6) * 0.12);
      // Town lamps: light only the ones near the player.
      const near = lamps
        .map((p) => [p, (p.x - x) ** 2 + (p.z - z) ** 2])
        .filter(([, d]) => d < 90 * 90)
        .sort((a, b) => a[1] - b[1]);
      townLights.forEach((l, i) => {
        const n = near[i];
        l.visible = !!n;
        if (!n) return;
        l.position.copy(n[0]);
        l.intensity = 10 + Math.sin(t * 9 + i * 2) * 1.5;
      });
    },
  };
}
