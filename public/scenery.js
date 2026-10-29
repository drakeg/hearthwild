import { WORLD_SIZE, inCamp } from "./world-config.js";
import * as THREE from "./vendor/three.module.js";
import { mergeVertices } from "./vendor/addons/BufferGeometryUtils.js";
import { GLTFLoader } from "./vendor/addons/GLTFLoader.js";
import { MeshoptDecoder } from "./vendor/addons/meshopt_decoder.module.js";
// Graphics quality: "high" (default) or "low" (no shadows, sparser foliage). Stored per browser.
export const GRAPHICS = (() => {
  let q = "high";
  try {
    q = new URLSearchParams(location.search).get("gfx") ?? localStorage.getItem("hearthwild-graphics") ?? "high";
  } catch {}
  return q === "low" ? { quality: "low", shadows: false, density: 0.45, grass: 9000 } : { quality: "high", shadows: true, density: 1, grass: 24000 };
})();
export function setGraphicsQuality(q) {
  try {
    localStorage.setItem("hearthwild-graphics", q);
  } catch {}
}
// Inside the crypt the floor is flat at y = 0.
let indoors = false;
export function setIndoors(on) {
  indoors = !!on;
}
export function height(x, z) {
  if (indoors) return 0;
  const basin = Math.hypot(x + 16, z + 12);
  return (
    Math.sin(x * 0.1) * 0.4 +
    Math.cos(z * 0.13) * 0.35 -
    Math.max(0, 1 - basin / 8) * 1.5 +
    Math.max(0, Math.hypot(x, z) - 24) * 0.055
  );
}
export function createScenery(scene) {
  let seed = 71;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  function texture(kind) {
    const c = document.createElement("canvas");
    c.width = c.height = 256;
    const ctx = c.getContext("2d");
    ctx.fillStyle = kind === "bark" ? "#6e4f35" : "#a8a396";
    ctx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 6000; i++) {
      const v = Math.floor(65 + random() * 100);
      ctx.fillStyle = `rgba(${v},${v + 3},${v - 8},.18)`;
      ctx.fillRect(
        random() * 256,
        random() * 256,
        kind === "bark" ? 1 : random() * 8,
        kind === "bark" ? 15 + random() * 55 : random() * 5,
      );
    }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }
  const bark = texture("bark"),
    stone = texture("stone");
  const rockMat = new THREE.MeshStandardMaterial({
    color: "#b9b2a2",
    map: stone,
    bumpMap: stone,
    bumpScale: 0.14,
    roughness: 0.92,
  });
  const barkMat = new THREE.MeshStandardMaterial({
    color: "#7d6248",
    map: bark,
    bumpMap: bark,
    bumpScale: 0.09,
    roughness: 1,
  });
  function add(geometry, material, x, y, z, parent = scene) {
    const m = new THREE.Mesh(
      geometry,
      typeof material === "string"
        ? new THREE.MeshStandardMaterial({ color: material, roughness: 0.85 })
        : material,
    );
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  }
  const ground = new THREE.PlaneGeometry(220, 220, 180, 180);
  ground.rotateX(-Math.PI / 2);
  const pos = ground.attributes.position,
    colors = [];
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i),
      z = pos.getZ(i);
    pos.setY(i, height(x, z));
    // Lush, saturated meadow greens with warmer, drier patches on the slopes.
    const dry = Math.max(0, Math.sin(x * 0.045 + 1.3) * Math.cos(z * 0.05)) * 0.6,
      c = new THREE.Color().setHSL(
        0.25 - dry * 0.07 + Math.sin(x * 0.06) * 0.012,
        0.5 - dry * 0.12,
        0.33 + Math.sin(x * 0.24 + z * 0.19) * 0.03 + random() * 0.03,
      );
    colors.push(c.r, c.g, c.b);
  }
  ground.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  ground.computeVertexNormals();
  const groundMap = paintedGround(random);
  groundMap.repeat.set(36, 36);
  add(
    ground,
    new THREE.MeshStandardMaterial({
      vertexColors: true,
      map: groundMap,
      roughness: 1,
    }),
    0,
    0,
    0,
  ).castShadow = false;
  const dummy = new THREE.Object3D(),
    trunkGeo = new THREE.CylinderGeometry(0.2, 0.42, 1, 10, 4);
  // Flare the roots and add a little wobble so trunks read as wood, not pipes.
  const tg = trunkGeo.attributes.position;
  for (let i = 0; i < tg.count; i++) {
    const y = tg.getY(i) + 0.5,
      flare = 1 + Math.max(0, 0.18 - y) * 4,
      wob = 1 + Math.sin(tg.getX(i) * 9 + y * 7) * 0.06;
    tg.setX(i, tg.getX(i) * flare * wob);
    tg.setZ(i, tg.getZ(i) * flare * wob);
  }
  trunkGeo.computeVertexNormals();
  const trunks = new THREE.InstancedMesh(trunkGeo, barkMat, 350),
    leaves = new THREE.InstancedMesh(
      lumpyCanopy(random),
      new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }),
      1750,
    );
  let leaf = 0;
  for (let i = 0; i < 350; i++) {
    const x = (random() - 0.5) * 180,
      z = (random() - 0.5) * 180,
      h = 5 + random() * 6,
      y = height(x, z);
    dummy.position.set(x, y + h / 2, z);
    dummy.rotation.set(0, random() * 6.28, (random() - 0.5) * 0.08);
    dummy.scale.set(1 + random(), h, 1 + random());
    if (
      inCamp({ x, z }) ||
      Math.hypot(x + 16, z + 12) < 8 ||
      Math.abs(x - Math.sin(z * 0.1) * 0.65) < 3
    )
      dummy.scale.setScalar(0);
    dummy.updateMatrix();
    trunks.setMatrixAt(i, dummy.matrix);
    for (let k = 0; k < 5; k++) {
      const angle = (k / 5) * 6.28 + random();
      dummy.position.set(
        x + Math.cos(angle) * 1.4,
        y + h - 0.6 + random() * 2,
        z + Math.sin(angle) * 1.4,
      );
      dummy.scale.set(
        2 + random() * 1.7,
        1.8 + random() * 1.5,
        2 + random() * 1.3,
      );
      dummy.rotation.set(random(), random() * 6, random());
      if (
        inCamp({ x, z }) ||
        Math.hypot(x + 16, z + 12) < 8 ||
        Math.abs(x - Math.sin(z * 0.1) * 0.65) < 3
      )
        dummy.scale.setScalar(0);
      dummy.updateMatrix();
      leaves.setMatrixAt(leaf, dummy.matrix);
      leaves.setColorAt(
        leaf++,
        new THREE.Color().setHSL(
          0.17 + random() * 0.12,
          0.45 + random() * 0.3,
          0.74 + random() * 0.14,
        ),
      );
    }
  }
  trunks.castShadow = true;
  trunks.receiveShadow = true;
  leaves.castShadow = true;
  leaves.receiveShadow = true;
  scene.add(trunks, leaves);
  // Tall layered pines on the outer ridges.
  const pineGeo = pineTree(),
    pines = new THREE.InstancedMesh(
      pineGeo,
      new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }),
      260,
    );
  for (let i = 0; i < 260; i++) {
    const a = random() * 6.28,
      r = 40 + random() * 62,
      x = Math.cos(a) * r,
      z = Math.sin(a) * r,
      h = 7 + random() * 7,
      blocked =
        inCamp({ x, z }) ||
        Math.hypot(x + 16, z + 12) < 9 ||
        Math.abs(x - Math.sin(z * 0.1) * 0.65) < 3.5 ||
        [
          [-48, 45],
          [51, -46],
          [-55, -50],
        ].some(([lx, lz]) => Math.hypot(x - lx, z - lz) < 9);
    dummy.position.set(x, height(x, z) - 0.2, z);
    dummy.rotation.set(0, random() * 6.28, (random() - 0.5) * 0.05);
    dummy.scale.set(h * 0.32, blocked ? 0 : h, h * 0.32);
    dummy.updateMatrix();
    pines.setMatrixAt(i, dummy.matrix);
    pines.setColorAt(
      i,
      new THREE.Color().setHSL(0.3 + random() * 0.08, 0.3, 0.78 + random() * 0.16),
    );
  }
  pines.castShadow = true;
  pines.receiveShadow = true;
  scene.add(pines);
  const proceduralRocks = [];
  for (let i = 0; i < 200; i++) {
    const a = random() * 6.28,
      r = 12 + random() * 86,
      x = Math.cos(a) * r,
      z = Math.sin(a) * r;
    const m = add(
      new THREE.IcosahedronGeometry(0.4 + random() * 1.5, 1),
      rockMat,
      x,
      height(x, z),
      z,
    );
    m.scale.set(1, 0.5 + random() * 0.4, 1.3);
    m.rotation.set(random(), random(), random());
    proceduralRocks.push(m);
  }
  const trail = new THREE.PlaneGeometry(4.3, 164, 8, 180);
  trail.rotateX(-Math.PI / 2);
  const tp = trail.attributes.position;
  for (let i = 0; i < tp.count; i++) {
    const z = tp.getZ(i) + 2,
      x = tp.getX(i) + Math.sin(z * 0.1) * 0.65;
    tp.setXYZ(i, x, height(x, z) + 0.035, z);
  }
  trail.computeVertexNormals();
  add(
    trail,
    new THREE.MeshStandardMaterial({
      color: "#afa58b",
      map: stone,
      roughness: 1,
    }),
    0,
    0,
    0,
  ).castShadow = false;
  // Weathered arch with moss, foundation stones, and warm practical lights.
  for (const x of [-3.3, 3.3])
    for (let i = 0; i < 5; i++) {
      const m = add(
        new THREE.BoxGeometry(1.25, 0.96, 1.6, 2, 2, 2),
        rockMat,
        x,
        i * 0.9 + 0.5 + height(x, 0),
        0,
      );
      m.rotation.y = (random() - 0.5) * 0.08;
    }
  for (let i = 0; i < 9; i++) {
    const a = (i / 8) * Math.PI;
    const m = add(
      new THREE.BoxGeometry(1.15, 1.15, 1.6),
      rockMat,
      Math.cos(a) * 3.3,
      4.45 + Math.sin(a) * 2.5,
      0,
    );
    m.rotation.z = a - Math.PI / 2;
    add(
      new THREE.SphereGeometry(0.5, 8, 6),
      "#677854",
      m.position.x,
      m.position.y + 0.48,
      0.1,
    ).scale.set(1, 0.22, 1);
  }
  for (const x of [-5.3, 5.3]) {
    const y = height(x, 3);
    add(
      new THREE.CylinderGeometry(0.48, 0.65, 0.4, 10),
      rockMat,
      x,
      y + 0.2,
      3,
    );
    add(new THREE.CylinderGeometry(0.2, 0.3, 1.5, 10), rockMat, x, y + 1, 3);
    const flame = add(
      new THREE.SphereGeometry(0.18, 12, 10),
      new THREE.MeshStandardMaterial({
        color: "#ffd188",
        emissive: "#ffab4a",
        emissiveIntensity: 3,
      }),
      x,
      y + 1.9,
      3,
    );
    flame.scale.y = 1.6;
    const light = new THREE.PointLight("#ffb45b", 12, 8);
    light.position.set(x, y + 2, 3);
    scene.add(light);
  }
  // Fernlike grass blades, drawn in one instanced batch.
  const blade = new THREE.PlaneGeometry(0.055, 0.4, 1, 3);
  blade.translate(0, 0.2, 0);
  const bp = blade.attributes.position;
  for (let i = 0; i < bp.count; i++)
    bp.setX(i, bp.getX(i) + Math.pow(bp.getY(i), 2) * 0.3);
  const bladeColors = [];
  for (let i = 0; i < bp.count; i++) {
    const k = bp.getY(i) / 0.4,
      c = new THREE.Color("#3f6b1f").lerp(new THREE.Color("#b9d86a"), k);
    bladeColors.push(c.r, c.g, c.b);
  }
  blade.setAttribute("color", new THREE.Float32BufferAttribute(bladeColors, 3));
  const grassMat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    side: THREE.DoubleSide,
    roughness: 1,
  });
  const wind = { value: 0 };
  grassMat.onBeforeCompile = (shader) => {
    shader.uniforms.uWind = wind;
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nuniform float uWind;")
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
        vec4 wp = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
        float sway = sin(uWind * 1.7 + wp.x * 0.35 + wp.z * 0.27) * 0.5 + sin(uWind * 3.1 + wp.x) * 0.15;
        transformed.x += sway * position.y * position.y * 0.9;`,
      );
  };
  const grass = new THREE.InstancedMesh(blade, grassMat, GRAPHICS.grass);
  for (let i = 0; i < GRAPHICS.grass; i++) {
    const x = (random() - 0.5) * 180,
      z = (random() - 0.5) * 180;
    dummy.position.set(x, height(x, z), z);
    dummy.rotation.set(0, random() * 6.28, 0);
    dummy.scale.setScalar(
      Math.abs(x - Math.sin(z * 0.1) * 0.65) < 2.5 ||
        Math.hypot(x + 16, z + 12) < 7
        ? 0
        : 0.4 + random() * 0.9,
    );
    dummy.updateMatrix();
    grass.setMatrixAt(i, dummy.matrix);
  }
  scene.add(grass);
  // Scattered wildflowers: small bright heads on short stems.
  const flowerGeo = new THREE.IcosahedronGeometry(0.07, 0);
  flowerGeo.translate(0, 0.32, 0);
  const flowers = new THREE.InstancedMesh(
    flowerGeo,
    new THREE.MeshStandardMaterial({ roughness: 0.7, emissive: "#222", emissiveIntensity: 0.4 }),
    2400,
  );
  const petals = ["#fff4c2", "#ffd84a", "#c79cff", "#ff9fb2", "#ffffff"];
  for (let i = 0; i < 2400; i++) {
    // Flowers grow in drifts rather than evenly.
    const cx = (random() - 0.5) * 170,
      cz = (random() - 0.5) * 170,
      x = cx + (random() - 0.5) * 6,
      z = cz + (random() - 0.5) * 6,
      off =
        Math.abs(x - Math.sin(z * 0.1) * 0.65) < 2.5 || Math.hypot(x + 16, z + 12) < 7.5;
    dummy.position.set(x, height(x, z), z);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.setScalar(off ? 0 : 0.8 + random() * 0.8);
    dummy.updateMatrix();
    flowers.setMatrixAt(i, dummy.matrix);
    flowers.setColorAt(i, new THREE.Color(petals[Math.floor(random() * petals.length)]));
  }
  scene.add(flowers);
  const waterGeo = new THREE.PlaneGeometry(14, 14, 40, 40);
  waterGeo.rotateX(-Math.PI / 2);
  const water = add(
    waterGeo,
    new THREE.MeshPhysicalMaterial({
      color: "#2f7fa0",
      metalness: 0.15,
      roughness: 0.08,
      transparent: true,
      opacity: 0.82,
      clearcoat: 1,
      side: THREE.DoubleSide,
    }),
    -16,
    -0.34,
    -12,
  );
  water.castShadow = false;
  const wp = waterGeo.attributes.position;
  for (let i = 0; i < wp.count; i++) {
    const x = wp.getX(i),
      z = wp.getZ(i);
    if (Math.hypot(x, z) > 6.8) wp.setXYZ(i, x, -2, z);
  }
  // Distinct destinations anchor the expanded wilderness.
  for (const [x, z, color] of [
    [-48, 45, "#c6a477"],
    [51, -46, "#9da9c0"],
    [-55, -50, "#82bda7"],
  ]) {
    const y = height(x, z);
    add(new THREE.CylinderGeometry(4.5, 4.8, 0.35, 16), rockMat, x, y, z);
    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI) / 3,
        px = x + Math.sin(a) * 3.5,
        pz = z + Math.cos(a) * 3.5,
        h = 1.6 + random() * 2;
      add(
        new THREE.CylinderGeometry(0.4, 0.6, h, 8),
        rockMat,
        px,
        height(px, pz) + h / 2,
        pz,
      );
    }
    add(new THREE.CylinderGeometry(0.7, 1, 1, 8), rockMat, x, y + 0.7, z);
    add(
      new THREE.OctahedronGeometry(0.8),
      new THREE.MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: 0.6,
        roughness: 0.25,
      }),
      x,
      y + 2,
      z,
    );
  }
  // Distant layered ridgelines and drifting fireflies give depth beyond the playable clearing.
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2,
      r = 145,
      h = 15 + random() * 24;
    const geo = new THREE.ConeGeometry(15 + random() * 18, h, 14, 6),
      mp = geo.attributes.position,
      mc = [];
    for (let k = 0; k < mp.count; k++) {
      const y = mp.getY(k) / h + 0.5;
      if (y < 0.98 && y > 0.02) {
        const n = 1 + (random() - 0.5) * 0.22;
        mp.setX(k, mp.getX(k) * n);
        mp.setZ(k, mp.getZ(k) * n);
      }
      const col = y > 0.78 ? new THREE.Color("#eef3f7") : new THREE.Color("#5f7f86").lerp(new THREE.Color("#8aa3a8"), y);
      mc.push(col.r, col.g, col.b);
    }
    geo.setAttribute("color", new THREE.Float32BufferAttribute(mc, 3));
    geo.computeVertexNormals();
    const mountain = add(
      geo,
      new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true }),
      Math.sin(a) * r,
      h / 2 - 4,
      Math.cos(a) * r,
    );
    mountain.castShadow = false;
  }
  const motesGeo = new THREE.BufferGeometry(),
    motes = [];
  for (let i = 0; i < 150; i++)
    motes.push((random() - 0.5) * 48, 1 + random() * 5, (random() - 0.5) * 48);
  motesGeo.setAttribute("position", new THREE.Float32BufferAttribute(motes, 3));
  const motesMesh = new THREE.Points(
    motesGeo,
    new THREE.PointsMaterial({
      color: "#f6df9e",
      size: 0.055,
      transparent: true,
      opacity: 0.65,
      depthWrite: false,
    }),
  );
  scene.add(motesMesh);
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(260, 24, 12),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      vertexShader:
        "varying vec3 v;void main(){v=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",
      uniforms: { uTime: { value: 0 } },
      fragmentShader: `varying vec3 v;uniform float uTime;
        float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
        float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
          return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
        float fbm(vec2 p){float s=0.,a=.5;for(int i=0;i<5;i++){s+=a*noise(p);p*=2.03;a*=.5;}return s;}
        void main(){vec3 d=normalize(v);float h=d.y;
          vec3 horizon=vec3(.86,.9,.88),mid=vec3(.47,.68,.9),top=vec3(.2,.43,.8);
          vec3 col=mix(horizon,mid,smoothstep(-.02,.25,h));col=mix(col,top,smoothstep(.25,.9,h));
          vec2 uv=d.xz/(h+.18)*1.6+vec2(uTime*.004,uTime*.0015);
          float c=smoothstep(.48,.78,fbm(uv));float shade=fbm(uv*1.7+3.);
          vec3 cloud=mix(vec3(.82,.84,.9),vec3(1.,.99,.95),shade);
          col=mix(col,cloud,c*smoothstep(.0,.18,h)*.9);
          col+=vec3(1.,.85,.55)*pow(max(0.,dot(d,normalize(vec3(-.55,.45,-.35)))),12.)*.35;
          gl_FragColor=vec4(col,1.);}`,
    }),
  );
  scene.add(sky);
  const camp = createCamp(scene, add, rockMat, barkMat, random);
  // Hand-made trees, foliage and rocks replace the procedural stand-ins once they load.
  const occluders = [trunks, leaves, pines];
  populateCampProps(scene);
  populateNature(scene, random).then((nature) => {
    if (!nature) return;
    for (const m of [trunks, leaves, pines, ...proceduralRocks]) m.visible = false;
    occluders.splice(0, occluders.length, ...nature.occluders);
  });
  let frame = 0;
  return {
    occluders,
    update(t) {
      camp.update(t);
      wind.value = t;
      sky.material.uniforms.uTime.value = t;
      motesMesh.position.y = Math.sin(t * 0.15) * 0.3;
      if (++frame % 3 === 0) {
        for (let i = 0; i < wp.count; i++) {
          const x = wp.getX(i),
            z = wp.getZ(i);
          if (Math.hypot(x, z) < 6.8)
            wp.setY(
              i,
              Math.sin(x * 1.8 + t * 0.8) * 0.035 +
                Math.cos(z * 1.4 + t * 0.6) * 0.025,
            );
        }
        wp.needsUpdate = true;
        waterGeo.computeVertexNormals();
      }
    },
  };
}
export function createBody(color, classId = "warrior") {
  const g = new THREE.Group();
  const cloth = new THREE.MeshStandardMaterial({ color, roughness: 0.9 }),
    leather = new THREE.MeshStandardMaterial({
      color: "#493d33",
      roughness: 0.8,
    }),
    skin = new THREE.MeshStandardMaterial({ color: "#cda987", roughness: 1 }),
    metal = new THREE.MeshStandardMaterial({
      color: "#bcb8a3",
      metalness: 0.65,
      roughness: 0.4,
    });
  const part = (geo, mat, x, y, z, parent = g) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    parent.add(m);
    return m;
  };
  part(new THREE.CylinderGeometry(0.3, 0.38, 0.85, 12), cloth, 0, 1.12, 0);
  part(new THREE.CylinderGeometry(0.39, 0.44, 0.38, 12), cloth, 0, 0.72, 0);
  part(new THREE.SphereGeometry(0.25, 16, 12), skin, 0, 1.84, 0);
  const hair = part(
    new THREE.SphereGeometry(0.265, 16, 10),
    leather,
    0,
    1.94,
    -0.04,
  );
  hair.scale.y = 0.7;
  part(new THREE.SphereGeometry(0.065, 10, 8), skin, 0, 1.8, 0.23);
  for (const x of [-0.105, 0.105])
    part(new THREE.SphereGeometry(0.028, 8, 6), leather, x, 1.87, 0.22);
  part(new THREE.CylinderGeometry(0.365, 0.375, 0.13, 12), leather, 0, 0.88, 0);
  part(new THREE.BoxGeometry(0.13, 0.13, 0.05), metal, 0, 0.88, 0.37);
  const legs = [],
    arms = [];
  for (const side of [-1, 1]) {
    const leg = new THREE.Group();
    leg.position.set(side * 0.18, 0.65, 0);
    part(
      new THREE.CylinderGeometry(0.12, 0.1, 0.5, 10),
      leather,
      0,
      -0.23,
      0,
      leg,
    );
    part(new THREE.BoxGeometry(0.23, 0.22, 0.4), leather, 0, -0.54, 0.07, leg);
    g.add(leg);
    legs.push(leg);
    const arm = new THREE.Group();
    arm.position.set(side * 0.4, 1.48, 0);
    part(new THREE.CapsuleGeometry(0.12, 0.43, 4, 8), cloth, 0, -0.25, 0, arm);
    part(new THREE.SphereGeometry(0.12, 10, 8), skin, 0, -0.59, 0, arm);
    part(new THREE.SphereGeometry(0.18, 10, 8), metal, 0, -0.04, 0, arm);
    g.add(arm);
    arms.push(arm);
  }
  const weapon = new THREE.Group();
  weapon.position.set(0, -0.6, 0.15);
  if (classId === "warlock" || classId === "druid") {
    part(
      new THREE.CylinderGeometry(0.045, 0.06, 1.65, 8),
      leather,
      0,
      0.25,
      0,
      weapon,
    );
    part(
      new THREE.SphereGeometry(0.15, 12, 10),
      new THREE.MeshStandardMaterial({
        color: classId === "warlock" ? "#a390ca" : "#8abb9b",
        emissive: classId === "warlock" ? "#674b99" : "#4b8460",
        emissiveIntensity: 1.2,
      }),
      0,
      1.1,
      0,
      weapon,
    );
  } else {
    part(
      new THREE.BoxGeometry(0.11, classId === "rogue" ? 0.48 : 0.85, 0.06),
      metal,
      0,
      0.2,
      0,
      weapon,
    );
    part(new THREE.BoxGeometry(0.4, 0.07, 0.1), metal, 0, -0.2, 0, weapon);
  }
  arms[1].add(weapon);
  g.userData.legs = legs;
  g.userData.arms = arms;
  // Layered silhouettes read at the normal play camera, with equipment added separately.
  const trim = new THREE.MeshStandardMaterial({
    color: "#c7a466",
    metalness: 0.72,
    roughness: 0.36,
  });
  for (const side of [-1, 1]) {
    const cuff = part(
      new THREE.CylinderGeometry(0.135, 0.145, 0.18, 10),
      leather,
      0,
      -0.43,
      0,
      arms[side === -1 ? 0 : 1],
    );
    const buckle = part(
      new THREE.BoxGeometry(0.08, 0.09, 0.04),
      trim,
      side * 0.19,
      0.52,
      0.13,
      legs[side === -1 ? 0 : 1],
    );
    if (classId === "druid") {
      const horn = part(
        new THREE.ConeGeometry(0.075, 0.45, 7),
        leather,
        side * 0.25,
        2.13,
        -0.02,
      );
      horn.rotation.z = side * -0.5;
      const leaf = part(
        new THREE.SphereGeometry(0.14, 8, 5),
        cloth,
        side * 0.33,
        1.48,
        0.08,
      );
      leaf.scale.set(1.4, 0.45, 1);
    }
  }
  if (classId === "warlock" || classId === "rogue") {
    const hood = part(
      new THREE.SphereGeometry(0.29, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.68),
      cloth,
      0,
      1.94,
      -0.04,
    );
    hood.scale.set(1, 1.15, 1);
    const collar = part(
      new THREE.TorusGeometry(0.27, 0.07, 6, 16),
      cloth,
      0,
      1.6,
      0,
    );
    collar.rotation.x = Math.PI / 2;
  }
  const armor = new THREE.Group();
  g.add(armor);
  g.userData.armor = armor;
  const breast = part(
    new THREE.SphereGeometry(0.36, 12, 10),
    metal,
    0,
    1.2,
    0.07,
    armor,
  );
  breast.scale.set(1, 0.98, 0.87);
  const crest = part(
    new THREE.OctahedronGeometry(0.12),
    trim,
    0,
    1.3,
    0.39,
    armor,
  );
  crest.scale.set(1, 1.4, 0.25);
  for (const side of [-1, 1]) {
    const plate = part(
      new THREE.SphereGeometry(0.23, 10, 8),
      metal,
      side * 0.43,
      1.5,
      0,
      armor,
    );
    plate.scale.set(1.3, 0.65, 1.15);
    const rim = part(
      new THREE.TorusGeometry(0.2, 0.035, 5, 12),
      trim,
      side * 0.43,
      1.53,
      0,
      armor,
    );
    rim.rotation.x = Math.PI / 2;
  }
  armor.visible = false;
  g.userData.clothMaterial = cloth;
  g.userData.baseCloth = color;
  g.userData.weaponGroup = weapon;
  const charm = part(
    new THREE.SphereGeometry(0.075, 10, 8),
    new THREE.MeshStandardMaterial({
      color: "#e3c278",
      emissive: "#b68c38",
      emissiveIntensity: 0.7,
    }),
    0,
    1.4,
    0.31,
  );
  charm.visible = false;
  g.userData.charm = charm;
  const cape = part(
    new THREE.PlaneGeometry(0.7, 1.05, 1, 4),
    new THREE.MeshStandardMaterial({
      color,
      side: THREE.DoubleSide,
      roughness: 1,
    }),
    0,
    0.94,
    -0.37,
  );
  cape.rotation.x = 0.08;
  cape.visible = false;
  g.userData.cape = cape;
  return g;
}
export function createCreature() {
  const g = new THREE.Group(),
    hide = new THREE.MeshStandardMaterial({ color: "#766551", roughness: 1 }),
    moss = new THREE.MeshStandardMaterial({ color: "#748251", roughness: 1 }),
    ivory = new THREE.MeshStandardMaterial({
      color: "#e3d7b0",
      roughness: 0.75,
    }),
    hoof = new THREE.MeshStandardMaterial({ color: "#35382c", roughness: 0.9 });
  const part = (geo, mat, x, y, z, parent = g) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  };
  const body = part(new THREE.SphereGeometry(1, 16, 12), hide, 0, 0.8, 0);
  body.scale.set(0.62, 0.55, 0.92);
  const head = part(
    new THREE.SphereGeometry(0.47, 14, 10),
    hide,
    0,
    0.73,
    0.77,
  );
  head.scale.set(1, 0.95, 1.2);
  const nose = part(
    new THREE.CylinderGeometry(0.26, 0.29, 0.28, 12),
    hoof,
    0,
    0.66,
    1.15,
  );
  nose.rotation.x = Math.PI / 2;
  for (const side of [-1, 1]) {
    const ear = part(
      new THREE.ConeGeometry(0.19, 0.42, 3),
      hide,
      side * 0.32,
      1.13,
      0.64,
    );
    ear.rotation.z = -side * 0.4;
    const tusk = part(
      new THREE.ConeGeometry(0.07, 0.38, 10),
      ivory,
      side * 0.27,
      0.68,
      1.18,
    );
    tusk.rotation.x = 0.7;
    tusk.rotation.z = -side * 0.25;
    part(
      new THREE.SphereGeometry(0.065, 10, 8),
      new THREE.MeshStandardMaterial({
        color: "#f8c478",
        emissive: "#a76f20",
        emissiveIntensity: 0.6,
      }),
      side * 0.36,
      0.89,
      1.02,
    );
  }
  const legs = [];
  for (const x of [-0.4, 0.4])
    for (const z of [-0.5, 0.5]) {
      const leg = new THREE.Group();
      leg.position.set(x, 0.56, z);
      part(new THREE.CapsuleGeometry(0.12, 0.26, 4, 8), hide, 0, -0.15, 0, leg);
      part(
        new THREE.SphereGeometry(0.15, 10, 8),
        hoof,
        0,
        -0.39,
        0.03,
        leg,
      ).scale.set(1, 0.65, 1.3);
      g.add(leg);
      legs.push(leg);
    }
  for (let i = 0; i < 7; i++) {
    const z = -0.55 + i * 0.19,
      m = part(
        new THREE.ConeGeometry(0.14, 0.35 + (i % 3) * 0.1, 5),
        moss,
        0,
        1.28,
        z,
      );
    m.rotation.x = -0.35;
  }
  g.userData.legs = legs;
  return g;
}

export function applyEquipment(g, appearance = {}) {
  if (!g.userData.clothMaterial) return;
  const key = JSON.stringify(appearance);
  if (g.userData.gearKey === key) return;
  g.userData.gearKey = key;
  const rare = appearance.chest === "ironbark-mail",
    worn = !!appearance.chest;
  g.userData.clothMaterial.color.set(
    worn ? (rare ? "#667888" : "#526e55") : g.userData.baseCloth,
  );
  g.userData.cape.visible = worn;
  g.userData.armor.visible = worn;
  g.userData.cape.material.color.set(rare ? "#475c78" : "#536b48");
  g.userData.charm.visible = !!appearance.charm;
  g.userData.weaponGroup.scale.setScalar(
    appearance.weapon === "thornblade" ? 1.28 : appearance.weapon ? 1.12 : 1,
  );
}

// A hand-painted-looking ground detail tile: soft dabs of light and dark green with dirt flecks.
function paintedGround(random) {
  const c = document.createElement("canvas");
  c.width = c.height = 512;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#d9e6c0";
  ctx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 2600; i++) {
    const x = random() * 512,
      y = random() * 512,
      r = 2 + random() * 14,
      light = random();
    ctx.fillStyle =
      light < 0.42
        ? `rgba(255,255,220,${0.08 + random() * 0.1})`
        : light < 0.9
          ? `rgba(40,70,20,${0.05 + random() * 0.09})`
          : `rgba(120,85,45,${0.08 + random() * 0.1})`;
    ctx.beginPath();
    ctx.ellipse(x, y, r, r * (0.4 + random() * 0.5), random() * 3, 0, Math.PI * 2);
    ctx.fill();
    // wrap around so the tile repeats without seams
    for (const [dx, dy] of [[512, 0], [-512, 0], [0, 512], [0, -512]])
      if (x + dx > -20 && x + dx < 532 && y + dy > -20 && y + dy < 532) {
        ctx.beginPath();
        ctx.ellipse(x + dx, y + dy, r, r * 0.6, 0, 0, Math.PI * 2);
        ctx.fill();
      }
  }
  for (let i = 0; i < 1800; i++) {
    ctx.strokeStyle = `rgba(${random() < 0.5 ? "30,60,15" : "235,245,190"},${0.12 + random() * 0.12})`;
    ctx.lineWidth = 1;
    const x = random() * 512,
      y = random() * 512;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + (random() - 0.5) * 3, y - 4 - random() * 6);
    ctx.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
// A puffy canopy blob: a displaced icosphere, darker underneath and sunlit on top.
function lumpyCanopy(random) {
  const geo = mergeVertices(new THREE.IcosahedronGeometry(1, 3)),
    p = geo.attributes.position,
    colors = [];
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const n =
      1 +
      Math.sin(v.x * 4.1 + v.y * 2.3) * 0.1 +
      Math.sin(v.z * 5.3 - v.y * 3.7) * 0.08 +
      Math.sin((v.x + v.z) * 9) * 0.03;
    v.multiplyScalar(n);
    p.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i),
      k = THREE.MathUtils.clamp((y + 1) / 2, 0, 1),
      c = new THREE.Color("#3c5a1c").lerp(new THREE.Color("#d6ee8c"), Math.pow(k, 1.4));
    colors.push(c.r, c.g, c.b);
  }
  geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  return geo;
}
// A stylised conifer: trunk plus three stacked, drooping cones, in unit height.
function pineTree() {
  const parts = [];
  const trunk = new THREE.CylinderGeometry(0.06, 0.1, 0.35, 7);
  trunk.translate(0, 0.17, 0);
  parts.push([trunk, "#5b3d25", "#5b3d25"]);
  for (const [y, r, h] of [
    [0.3, 0.95, 0.42],
    [0.52, 0.72, 0.36],
    [0.72, 0.48, 0.32],
  ]) {
    const cone = new THREE.ConeGeometry(r, h, 9, 2);
    cone.translate(0, y + h / 2, 0);
    parts.push([cone, "#1f4a2c", "#5f9a52"]);
  }
  const positions = [],
    normals = [],
    colors = [];
  for (const [g, low, high] of parts) {
    const ng = g.toNonIndexed();
    ng.computeVertexNormals();
    const p = ng.attributes.position,
      n = ng.attributes.normal;
    for (let i = 0; i < p.count; i++) {
      positions.push(p.getX(i), p.getY(i), p.getZ(i));
      normals.push(n.getX(i), n.getY(i), n.getZ(i));
      const c = new THREE.Color(low).lerp(new THREE.Color(high), THREE.MathUtils.clamp(p.getY(i), 0, 1));
      colors.push(c.r, c.g, c.b);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  return geo;
}

// Wayfarer's Camp: a crackling fire, tents, supply crates and banners.
function createCamp(scene, add, rockMat, barkMat, random) {
  const wood = new THREE.MeshStandardMaterial({ color: "#8a603b", roughness: 0.9 }),
    darkWood = new THREE.MeshStandardMaterial({ color: "#5e3f26", roughness: 0.95 }),
    canvasMat = new THREE.MeshStandardMaterial({ color: "#d8c49a", roughness: 1, side: THREE.DoubleSide }),
    trim = new THREE.MeshStandardMaterial({ color: "#8c2f22", roughness: 0.9, side: THREE.DoubleSide });
  const fx = 0,
    fz = 14,
    fy = height(fx, fz);
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    add(new THREE.DodecahedronGeometry(0.24, 0), rockMat, fx + Math.cos(a) * 0.85, fy + 0.1, fz + Math.sin(a) * 0.85).scale.set(1, 0.7, 1);
  }
  for (let i = 0; i < 4; i++) {
    const log = add(new THREE.CylinderGeometry(0.09, 0.11, 1.1, 7), darkWood, fx, fy + 0.18, fz);
    log.rotation.set(Math.PI / 2 - 0.35, (i / 4) * Math.PI * 2, 0);
  }
  const flameMat = new THREE.MeshBasicMaterial({ color: "#ffb33a", transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending }),
    coreMat = new THREE.MeshBasicMaterial({ color: "#fff1b0", transparent: true, opacity: 0.95, depthWrite: false, blending: THREE.AdditiveBlending });
  const flames = [];
  for (let i = 0; i < 5; i++) {
    const f = new THREE.Mesh(new THREE.ConeGeometry(0.22 - i * 0.02, 0.9 - i * 0.08, 7, 1, true), i ? flameMat : coreMat);
    f.position.set(fx + (random() - 0.5) * 0.25, fy + 0.6, fz + (random() - 0.5) * 0.25);
    scene.add(f);
    flames.push(f);
  }
  const fire = new THREE.PointLight("#ff9a3c", 18, 14, 1.6);
  fire.position.set(fx, fy + 1.1, fz);
  scene.add(fire);
  // embers
  const emberGeo = new THREE.BufferGeometry(),
    ember = new Float32Array(60 * 3),
    seeds = [];
  for (let i = 0; i < 60; i++) seeds.push(random(), random(), random());
  emberGeo.setAttribute("position", new THREE.BufferAttribute(ember, 3));
  const embers = new THREE.Points(
    emberGeo,
    new THREE.PointsMaterial({ color: "#ffc061", size: 0.06, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending }),
  );
  scene.add(embers);
  // A-frame tents
  for (const [x, z, rot] of [
    [-6.6, 19.5, 0.5],
    [6.8, 20, -0.45],
    [-7.4, 13.5, 1.3],
  ]) {
    const g = new THREE.Group(),
      y = height(x, z);
    const tentGeo = new THREE.BufferGeometry();
    // Simple ridge tent: two sloped canvas panels and a coloured hem.
    const w = 1.35,
      h = 1.7,
      l = 1.4;
    tentGeo.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(
        [-w, 0, -l, 0, h, -l, 0, h, l, -w, 0, -l, 0, h, l, -w, 0, l, w, 0, -l, 0, h, l, 0, h, -l, w, 0, -l, w, 0, l, 0, h, l],
        3,
      ),
    );
    tentGeo.computeVertexNormals();
    const panels = new THREE.Mesh(tentGeo, canvasMat);
    panels.castShadow = panels.receiveShadow = true;
    g.add(panels);
    const back = new THREE.Mesh(new THREE.BufferGeometry().setAttribute("position", new THREE.Float32BufferAttribute([-w, 0, -l, w, 0, -l, 0, h, -l], 3)), trim);
    back.geometry.computeVertexNormals();
    g.add(back);
    for (const zz of [-l - 0.05, l + 0.05]) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, h + 0.35, 6), wood);
      pole.position.set(0, (h + 0.35) / 2, zz);
      pole.castShadow = true;
      g.add(pole);
    }
    const ridge = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, l * 2 + 0.3, 6), wood);
    ridge.rotation.x = Math.PI / 2;
    ridge.position.y = h + 0.02;
    g.add(ridge);
    g.position.set(x, y, z);
    g.rotation.y = rot;
    scene.add(g);
  }
  // faction banners at the camp entrance
  const bannerCloth = [];
  for (const [x, color] of [
    [-8.2, "#b33a2b"],
    [8.2, "#2f6f5a"],
  ]) {
    const z = 7.5,
      y = height(x, z);
    add(new THREE.CylinderGeometry(0.07, 0.09, 4.2, 8), darkWood, x, y + 2.1, z);
    add(new THREE.CylinderGeometry(0.04, 0.04, 1.3, 6), darkWood, x, y + 4.05, z).rotation.z = Math.PI / 2;
    const cloth = new THREE.Mesh(
      new THREE.PlaneGeometry(1.1, 1.9, 4, 8),
      new THREE.MeshStandardMaterial({ color, roughness: 0.9, side: THREE.DoubleSide }),
    );
    cloth.position.set(x, y + 3.05, z + 0.02);
    cloth.castShadow = true;
    scene.add(cloth);
    bannerCloth.push(cloth);
  }
  return {
    update(t) {
      flames.forEach((f, i) => {
        const k = 1 + Math.sin(t * (9 + i * 2.3) + i) * 0.14 + Math.sin(t * 23 + i * 5) * 0.06;
        f.scale.set(1 / Math.sqrt(k), k, 1 / Math.sqrt(k));
        f.rotation.y = t * (0.6 + i * 0.3);
      });
      fire.intensity = 16 + Math.sin(t * 13) * 2.5 + Math.sin(t * 31) * 1.5;
      for (let i = 0; i < 60; i++) {
        const life = (t * (0.25 + seeds[i * 3] * 0.35) + seeds[i * 3 + 1]) % 1;
        ember[i * 3] = fx + Math.sin(seeds[i * 3 + 2] * 40 + t) * 0.35 * life;
        ember[i * 3 + 1] = fy + 0.4 + life * 3.2;
        ember[i * 3 + 2] = fz + Math.cos(seeds[i * 3 + 2] * 30 + t) * 0.35 * life;
      }
      emberGeo.attributes.position.needsUpdate = true;
      for (const c of bannerCloth) {
        const p = c.geometry.attributes.position;
        for (let i = 0; i < p.count; i++) {
          const yy = p.getY(i),
            down = (0.95 - yy) / 1.9;
          p.setZ(i, Math.sin(t * 2.2 + yy * 3 + c.position.x) * 0.12 * down);
        }
        p.needsUpdate = true;
      }
    },
  };
}

// ---- Stylized Nature MegaKit (Quaternius, CC0) ----
const LANDMARKS = [
  [-48, 45],
  [51, -46],
  [-55, -50],
];
function openGround(x, z, margin = 0) {
  return !(
    inCamp({ x, z }) ||
    Math.hypot(x + 16, z + 12) < 8.5 + margin ||
    Math.abs(x - Math.sin(z * 0.1) * 0.65) < 3 + margin ||
    LANDMARKS.some(([lx, lz]) => Math.hypot(x - lx, z - lz) < 6 + margin) ||
    Math.hypot(x, z + 2) < 6 + margin ||
    Math.abs(x) > 98 ||
    Math.abs(z) > 98
  );
}
async function populateNature(scene, random) {
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder),
    names = [
      "commontree_1", "commontree_2", "commontree_3", "commontree_4", "commontree_5",
      "pine_1", "pine_2", "pine_3", "pine_4", "pine_5", "twistedtree_1", "twistedtree_3", "deadtree_1", "deadtree_3",
      "bush_common", "bush_common_flowers", "fern_1", "plant_1", "plant_7", "grass_common_short", "grass_common_tall",
      "grass_wispy_tall", "flower_3_group", "flower_4_group", "mushroom_common", "rock_medium_1", "rock_medium_2", "rock_medium_3", "clover_1",
    ];
  const models = {};
  try {
    await Promise.all(names.map(async (n) => (models[n] = (await loader.loadAsync(`/models/nature/${n}.glb`)).scene)));
  } catch (e) {
    console.warn("Nature models unavailable; keeping procedural trees.", e);
    return null;
  }
  const placements = Object.fromEntries(names.map((n) => [n, []])),
    dummy = new THREE.Object3D();
  const place = (name, x, z, scale, tilt = 0.04) => {
    dummy.position.set(x, height(x, z) - 0.05, z);
    dummy.rotation.set((random() - 0.5) * tilt, random() * Math.PI * 2, (random() - 0.5) * tilt);
    dummy.scale.setScalar(scale);
    dummy.updateMatrix();
    placements[name].push(dummy.matrix.clone());
  };
  const scatter = (count, minR, maxR, margin, fn) => {
    for (let i = 0, tries = 0; i < count && tries < count * 20; tries++) {
      const a = random() * Math.PI * 2,
        r = minR + Math.sqrt(random()) * (maxR - minR),
        x = Math.cos(a) * r,
        z = Math.sin(a) * r;
      if (!openGround(x, z, margin)) continue;
      fn(x, z);
      i++;
    }
  };
  const pick = (list) => list[Math.floor(random() * list.length)];
  const broadleaf = ["commontree_1", "commontree_2", "commontree_3", "commontree_4", "commontree_5"],
    conifers = ["pine_1", "pine_2", "pine_3", "pine_4", "pine_5"];
  // Woods thicken away from camp; pines dominate the outer ridges.
  const d = GRAPHICS.density;
  scatter(Math.round(300 * d), 14, 100, 1.5, (x, z) => {
    const outer = Math.hypot(x, z) > 55 && random() < 0.65;
    place(outer ? pick(conifers) : pick(broadleaf), x, z, 0.9 + random() * 0.55);
  });
  // A ring of trees frames the camp and the pond.
  scatter(Math.round(70 * d), 11, 30, 2.5, (x, z) => place(pick(broadleaf), x, z, 0.85 + random() * 0.4));
  // Red-leaved twisted trees mark Moonwell Grove; dead trees haunt Amberwatch Ruins.
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2,
      x = -55 + Math.cos(a) * (10 + random() * 5),
      z = -50 + Math.sin(a) * (10 + random() * 5);
    place(pick(["twistedtree_1", "twistedtree_3"]), x, z, 0.45 + random() * 0.2);
  }
  for (let i = 0; i < 10; i++) {
    const a = random() * Math.PI * 2,
      x = -48 + Math.cos(a) * (9 + random() * 9),
      z = 45 + Math.sin(a) * (9 + random() * 9);
    if (openGround(x, z)) place(pick(["deadtree_1", "deadtree_3"]), x, z, 0.7 + random() * 0.4);
  }
  scatter(Math.round(320 * d), 8, 100, 0.5, (x, z) => place(pick(["bush_common", "bush_common", "bush_common_flowers"]), x, z, 0.6 + random() * 0.6));
  scatter(Math.round(420 * d), 8, 100, 0.3, (x, z) => place(pick(["fern_1", "plant_1", "plant_7", "clover_1"]), x, z, 0.5 + random() * 0.6));
  scatter(Math.round(1000 * d), 6, 100, 0, (x, z) => {
    const kind = pick(["grass_common_short", "grass_common_short", "grass_common_tall", "grass_wispy_tall"]);
    place(kind, x, z, kind === "grass_wispy_tall" ? 0.35 + random() * 0.3 : 0.7 + random() * 0.6);
  });
  scatter(Math.round(280 * d), 8, 100, 0, (x, z) => place(pick(["flower_3_group", "flower_4_group"]), x, z, 0.6 + random() * 0.5));
  scatter(Math.round(120 * d), 12, 100, 0.5, (x, z) => place("mushroom_common", x, z, 0.5 + random() * 0.5));
  scatter(170, 12, 100, 1, (x, z) => place(pick(["rock_medium_1", "rock_medium_2", "rock_medium_3"]), x, z, 0.35 + random() * 0.7, 0.4));
  // Instances are split into a 4×4 grid of chunks so the renderer can skip chunks outside the
  // camera and shadow frustums.
  const occluders = [],
    CELL = 50,
    cellOf = (m) => `${Math.floor((m.elements[12] + 100) / CELL)},${Math.floor((m.elements[14] + 100) / CELL)}`;
  for (const name of names) {
    const chunks = new Map();
    for (const m of placements[name]) {
      const k = cellOf(m);
      if (!chunks.has(k)) chunks.set(k, []);
      chunks.get(k).push(m);
    }
    if (!chunks.size) continue;
    const root = models[name];
    root.updateMatrixWorld(true);
    root.traverse((o) => {
      if (!o.isMesh) return;
      const geo = dequantize(o.geometry).applyMatrix4(o.matrixWorld),
        tall = /tree|pine/.test(name);
      if (o.material.map) o.material.map.anisotropy = 4;
      for (const mats of chunks.values()) {
        const inst = new THREE.InstancedMesh(geo, o.material, mats.length);
        mats.forEach((m, i) => inst.setMatrixAt(i, m));
        inst.computeBoundingSphere();
        inst.castShadow = GRAPHICS.shadows && (tall || /rock|bush/.test(name));
        inst.receiveShadow = GRAPHICS.shadows;
        scene.add(inst);
        if (tall) occluders.push(inst);
      }
    });
  }
  return { occluders };
}

// Compressed models keep positions/normals as normalized integers; expand them to floats so
// transforms can be baked into the vertices without clamping.
function dequantize(source) {
  const geo = source.clone();
  for (const [name, attr] of Object.entries(geo.attributes)) {
    if (attr.array instanceof Float32Array && !attr.isInterleavedBufferAttribute) continue;
    const out = new Float32Array(attr.count * attr.itemSize);
    for (let i = 0; i < attr.count; i++)
      for (let k = 0; k < attr.itemSize; k++) out[i * attr.itemSize + k] = attr.getComponent(i, k);
    geo.setAttribute(name, new THREE.BufferAttribute(out, attr.itemSize));
  }
  return geo;
}

// Wayfarer's Camp furnishings from the Fantasy Props and Medieval Village kits (Quaternius, CC0).
// [model, x, z, rotationY, scale, yOffset]
const CAMP_PROPS = [
  ["stall_cart_empty", 0, 20.2, Math.PI, 1],
  ["barrel_apples", 2.3, 19.6, 0.3, 1],
  ["barrel", 2.9, 20.3, 0, 1],
  ["crate_wooden", -2.2, 19.9, 0.4, 1],
  ["farmcrate_carrot", -2.9, 19.3, -0.2, 1],
  ["bag", 1.8, 18.6, 0, 1],
  ["cauldron", 5.6, 11.2, 0, 1],
  ["table_large", 6.2, 8.8, Math.PI / 2, 1],
  ["potion_1", 6.1, 8.4, 0, 1, 0.8],
  ["potion_2", 6.3, 9.2, 0, 1, 0.8],
  ["shelf_small_bottles", 7.6, 10.3, -Math.PI / 2, 1],
  ["bucket_wooden_1", 4.9, 12.2, 0, 1],
  ["weaponstand", -5.8, 11.4, Math.PI / 2, 1],
  ["dummy", -6.6, 8.4, 0.5, 1],
  ["anvil", -5.6, 12.9, 0.3, 1],
  ["chest_wood", -7.6, 11, Math.PI / 2, 1],
  ["bench", -1.9, 14, Math.PI / 2, 0.75],
  ["bench", 1.9, 14, Math.PI / 2, 0.75],
  ["stool", 0.9, 12.3, 0, 1],
  ["prop_wagon", 7.4, 16.2, 0.35, 1],
  ["pot_1", -1.2, 15.4, 0, 1],
];
async function populateCampProps(scene) {
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder),
    names = [...new Set([...CAMP_PROPS.map((p) => p[0]), "prop_woodenfence_single"])],
    models = {};
  try {
    await Promise.all(names.map(async (n) => (models[n] = (await loader.loadAsync(`/models/props/${n}.glb`)).scene)));
  } catch (e) {
    console.warn("Camp props unavailable.", e);
    return;
  }
  const put = (name, x, z, rot = 0, scale = 1, yOff = 0) => {
    const o = models[name].clone(true);
    o.position.set(x, height(x, z) + yOff, z);
    o.rotation.y = rot;
    o.scale.setScalar(scale);
    o.traverse((m) => {
      if (m.isMesh) {
        m.castShadow = GRAPHICS.shadows;
        m.receiveShadow = GRAPHICS.shadows;
      }
    });
    scene.add(o);
  };
  for (const p of CAMP_PROPS) put(...p);
  // A split-rail fence along the back and sides of camp, open toward the arch.
  for (let x = -8; x <= 8; x += 2.1) put("prop_woodenfence_single", x, 24.8, 0);
  for (const side of [-9.4, 9.4])
    for (let z = 23.6; z >= 12; z -= 2.1) put("prop_woodenfence_single", side, z, Math.PI / 2);
}
