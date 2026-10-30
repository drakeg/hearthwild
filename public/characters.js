// Rigged, animated characters and creatures. Models are CC0 / CC-BY assets listed in public/models/CREDITS.md.
// Humanoids are assembled at runtime from Quaternius parts (outfit + head + hair + held props) that share one
// 65-bone skeleton, and animated with the Universal Animation Library. Edit LOOKS to restyle anyone.
import * as THREE from "./vendor/three.module.js";
import { GLTFLoader } from "./vendor/addons/GLTFLoader.js";
import { MeshoptDecoder } from "./vendor/addons/meshopt_decoder.module.js";
import { clone as cloneSkinned } from "./vendor/addons/SkeletonUtils.js";

const Q = "/models/q/";
const PARTS = [
  "anims", "head_male", "head_female", "male_ranger", "female_ranger", "male_peasant", "female_peasant",
  "hair_simpleparted", "hair_long", "hair_buns", "hair_beard", "hair_buzzed", "hair_buzzedfemale",
  "w_sword", "w_axe", "w_shield", "w_pickaxe", "w_torch", "w_staff", "w_dagger", "w_wand", "w_book",
];
// Logical animation → clip in the Universal Animation Library (timeScale < 0 plays backwards).
const CLIPS = {
  idle: { name: "Idle_Loop" },
  combatIdle: { name: "Sword_Idle" },
  run: { name: "Jog_Fwd_Loop", timeScale: 1.05 },
  back: { name: "Walk_Loop", timeScale: -1.25 },
  strafeLeft: { name: "Jog_Fwd_Loop", yaw: 1.15 },
  strafeRight: { name: "Jog_Fwd_Loop", yaw: -1.15 },
  jump: { name: "Jump_Start", once: true },
  attack1h: { name: "Sword_Attack", once: true, timeScale: 1.35 },
  attackDual: { name: "Punch_Cross", once: true, timeScale: 1.2 },
  attackUnarmed: { name: "Punch_Jab", once: true },
  cast: { name: "Spell_Simple_Idle_Loop" },
  castRelease: { name: "Spell_Simple_Shoot", once: true },
  castInstant: { name: "Spell_Simple_Shoot", once: true, timeScale: 1.2 },
  hit: { name: "Hit_Chest", once: true, timeScale: 1.3 },
  death: { name: "Death01", once: true },
  interact: { name: "Interact", once: true },
  talk: { name: "Idle_Talking_Loop" },
  sit: { name: "Sitting_Idle_Loop" },
};
// Cloth recolouring: hue (0–1), saturation and value multipliers applied only to the outfit's green cloth.
const CLOTH = {
  crimson: { hue: 0.0, sat: 1.15, val: 0.85 },
  shadow: { hue: 0.62, sat: 0.18, val: 0.42 },
  moss: { hue: 0.24, sat: 0.9, val: 0.95 },
  violet: { hue: 0.76, sat: 1.0, val: 0.7 },
  ash: { hue: 0.08, sat: 0.12, val: 0.5 },
  ember: { hue: 0.03, sat: 0.9, val: 0.5 },
  royal: { hue: 0.6, sat: 0.9, val: 0.8 },
  wine: { hue: 0.92, sat: 0.7, val: 0.45 },
  tan: { hue: 0.1, sat: 0.55, val: 0.75 },
  frost: { hue: 0.57, sat: 0.35, val: 0.95 },
  slate: { hue: 0.6, sat: 0.12, val: 0.6 },
  bog: { hue: 0.2, sat: 0.45, val: 0.45 },
};
const HAIR = { black: "#1b1512", brown: "#4a2e1b", auburn: "#7a3418", blond: "#b98b4f", grey: "#8b8780", copper: "#a5552a" };
// Held props: which bone, and an offset (position, Euler rotation, scale) in that bone's space.
export const HELD = {
  sword: { bone: "hand_r", file: "w_sword", pos: [0, 0, 0], rot: [0, 0, 0], scale: 0.95 },
  axe: { bone: "hand_r", file: "w_axe", pos: [0, 0, 0], rot: [0, 0, 0], scale: 0.95 },
  pickaxe: { bone: "hand_r", file: "w_pickaxe", pos: [0, 0, 0], rot: [0, 0, 0], scale: 0.9 },
  shield: { bone: "lowerarm_l", file: "w_shield", pos: [0.0, 0.18, -0.08], rot: [0, Math.PI / 2, Math.PI / 2], scale: 0.85 },
  staff: { bone: "hand_r", file: "w_staff", pos: [0, 0, 0], rot: [Math.PI, 0, 0], scale: 0.62 },
  dagger: { bone: "hand_r", file: "w_dagger", pos: [0, 0, 0], rot: [0, 0, 0], scale: 0.42 },
  daggerOff: { bone: "hand_l", file: "w_dagger", pos: [0, 0, 0], rot: [0, 0, 0], scale: 0.42 },
  wand: { bone: "hand_r", file: "w_wand", pos: [0, 0, 0], rot: [Math.PI, 0, 0], scale: 0.55 },
  book: { bone: "hand_l", file: "w_book", pos: [0, 0, 0.04], rot: [0, 0, 0], scale: 0.36 },
  torch: { bone: "hand_r", file: "w_torch", pos: [0, 0, 0], rot: [Math.PI, 0, 0], scale: 0.9 },
};
const RANGER_HOOD = /Ranger_Head_Hood/;
const RANGER_PAULDRON = /Ranger_Acc_Pauldron/;
// Everyone who appears in the world. g: male|female. hood/pauldron toggle Ranger pieces.
export const LOOKS = {
  "warrior-male": { g: "male", outfit: "ranger", hair: "hair_buzzed", beard: true, hairColor: "brown", cloth: "crimson", pauldron: true, held: ["sword", "shield"], attack: "attack1h" },
  "warrior-female": { g: "female", outfit: "ranger", hair: "hair_buns", hairColor: "auburn", cloth: "crimson", pauldron: true, held: ["sword", "shield"], attack: "attack1h" },
  "rogue-male": { g: "male", outfit: "ranger", hood: true, cloth: "shadow", held: ["dagger", "daggerOff"], attack: "attackDual" },
  "rogue-female": { g: "female", outfit: "ranger", hood: true, cloth: "shadow", held: ["dagger", "daggerOff"], attack: "attackDual" },
  "druid-male": { g: "male", outfit: "ranger", hair: "hair_long", beard: true, hairColor: "copper", cloth: "moss", held: ["staff"], attack: "castInstant", caster: true },
  "druid-female": { g: "female", outfit: "ranger", hair: "hair_long", hairColor: "blond", cloth: "moss", held: ["staff"], attack: "castInstant", caster: true },
  "warlock-male": { g: "male", outfit: "ranger", hood: true, cloth: "violet", held: ["wand", "book"], attack: "castInstant", caster: true },
  "warlock-female": { g: "female", outfit: "ranger", hood: true, cloth: "violet", held: ["wand", "book"], attack: "castInstant", caster: true },
  "npc-warden": { g: "female", outfit: "ranger", hair: "hair_buns", hairColor: "brown", cloth: "royal", pauldron: true, held: ["sword"], idle: "idle" },
  "npc-herbalist": { g: "female", outfit: "peasant", hair: "hair_long", hairColor: "auburn", held: [], idle: "talk" },
  "npc-merchant": { g: "male", outfit: "peasant", hair: "hair_simpleparted", beard: true, hairColor: "grey", held: [], idle: "talk" },
  "ashen-cutthroat": { g: "male", outfit: "ranger", hood: true, cloth: "ember", held: ["dagger"], attack: "attack1h" },
  "ashen-raider": { g: "male", outfit: "ranger", hair: "hair_buzzed", beard: true, hairColor: "black", cloth: "ash", pauldron: true, held: ["axe"], attack: "attack1h" },
  "ashen-stalker": { g: "female", outfit: "ranger", hood: true, cloth: "wine", held: ["dagger", "daggerOff"], attack: "attackDual" },
  "ashen-hexer": { g: "male", outfit: "ranger", hood: true, cloth: "ash", held: ["staff"], attack: "castInstant", caster: true },
  "ashen-warden": { g: "male", outfit: "ranger", hood: true, cloth: "ember", pauldron: true, held: ["staff"], attack: "castInstant", caster: true, scale: 1.4 },
  // The wider world's people: Harrow bandits, mire cultists, Hollowfrost reavers and Greyspire brigands.
  "harrow-bandit": { g: "male", outfit: "ranger", hood: true, cloth: "tan", held: ["sword"], attack: "attack1h" },
  "downs-poacher": { g: "female", outfit: "ranger", hair: "hair_simpleparted", hairColor: "auburn", cloth: "tan", held: ["dagger", "daggerOff"], attack: "attackDual" },
  "mire-cultist": { g: "male", outfit: "ranger", hood: true, cloth: "bog", held: ["staff"], attack: "castInstant", caster: true },
  "mire-witch": { g: "female", outfit: "ranger", hood: true, cloth: "wine", held: ["wand", "book"], attack: "castInstant", caster: true },
  "frost-reaver": { g: "male", outfit: "ranger", hair: "hair_long", beard: true, hairColor: "blond", cloth: "frost", pauldron: true, held: ["axe"], attack: "attack1h" },
  "greyspire-brigand": { g: "male", outfit: "ranger", hair: "hair_buzzed", beard: true, hairColor: "black", cloth: "slate", pauldron: true, held: ["sword", "shield"], attack: "attack1h" },
  "stonecaller": { g: "female", outfit: "ranger", hood: true, cloth: "slate", held: ["staff"], attack: "castInstant", caster: true },
  "npc-town": { g: "male", outfit: "peasant", hair: "hair_simpleparted", beard: true, hairColor: "brown", held: [], idle: "talk" },
  "npc-town-f": { g: "female", outfit: "peasant", hair: "hair_buns", hairColor: "blond", held: [], idle: "talk" },
  "npc-captain": { g: "male", outfit: "ranger", hair: "hair_buzzed", beard: true, hairColor: "grey", cloth: "royal", pauldron: true, held: ["sword", "shield"], idle: "idle" },
  "npc-registrar": { g: "male", outfit: "peasant", hair: "hair_simpleparted", beard: true, hairColor: "brown", cloth: "royal", held: ["book"], idle: "talk" },
  "npc-scout": { g: "male", outfit: "ranger", hair: "hair_simpleparted", hairColor: "blond", cloth: "moss", pauldron: true, held: ["dagger"], idle: "talk" },
};
export function heroLook(classId, gender = "male") {
  return `${classId}-${gender === "female" ? "female" : "male"}`;
}
export const CLASS_MODEL = { warrior: "warrior-male", warlock: "warlock-male", druid: "druid-male", rogue: "rogue-male" };
export const NPC_MODEL = { warden: "npc-warden", herbalist: "npc-herbalist", merchant: "npc-merchant", scout: "npc-scout", registrar: "npc-registrar" };
// Creature kinds sent by the server → look (humanoids) or beast model with size and colouring.
export const CREATURES = {
  brambleling: { model: "fox", size: 0.85, tint: "#c0623a" },
  prowler: { model: "fox", size: 1.25, tint: "#7f9a6a" },
  thornhide: { model: "fox", size: 1.55, tint: "#5a4636" },
  "ashen-cutthroat": { model: "ashen-cutthroat" },
  "ashen-raider": { model: "ashen-raider" },
  "ashen-stalker": { model: "ashen-stalker" },
  "ashen-hexer": { model: "ashen-hexer" },
  "ashen-warden": { model: "ashen-warden" },
  "gorse-hound": { model: "fox", size: 1.15, tint: "#c49a52" },
  bristleback: { model: "fox", size: 1.5, tint: "#6b4a2e" },
  "bog-lurker": { model: "fox", size: 1.35, tint: "#556446" },
  reedfang: { model: "fox", size: 1.05, tint: "#2f3a2a" },
  "rime-wolf": { model: "fox", size: 1.55, tint: "#e8eef2" },
  frostfang: { model: "fox", size: 1.95, tint: "#9fb4c8" },
  "crag-stalker": { model: "fox", size: 2.0, tint: "#6e6a64" },
  "harrow-bandit": { model: "harrow-bandit" },
  "downs-poacher": { model: "downs-poacher" },
  "mire-cultist": { model: "mire-cultist" },
  "mire-witch": { model: "mire-witch" },
  "frost-reaver": { model: "frost-reaver" },
  "greyspire-brigand": { model: "greyspire-brigand" },
  stonecaller: { model: "stonecaller" },
};
const BEASTS = {
  fox: { file: "/models/fox.glb", scale: 0.0105, yaw: -Math.PI / 2, clips: { idle: "Survey", run: "Run", back: "Walk" } },
};

const parts = new Map(),
  beasts = new Map();
let readyPromise = null;
export function preloadCharacters() {
  if (readyPromise) return readyPromise;
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  const load = async (url, store, key) => {
    try {
      const gltf = await loader.loadAsync(url);
      gltf.scene.traverse((o) => {
        if (o.isMesh) {
          o.castShadow = true;
          o.receiveShadow = true;
          o.frustumCulled = false;
        }
      });
      store.set(key, gltf);
    } catch (e) {
      console.warn(`Model ${url} failed to load; using procedural fallback.`, e);
    }
  };
  readyPromise = Promise.all([
    ...PARTS.map((p) => load(`${Q}${p}.glb`, parts, p)),
    ...Object.entries(BEASTS).map(([k, b]) => load(b.file, beasts, k)),
  ]).then(() => parts.size + beasts.size);
  return readyPromise;
}
export const hasModel = (key) => (LOOKS[key] ? parts.has("anims") : beasts.has(key));

function clothMaterial(source, cloth) {
  const m = source.clone();
  if (!cloth) return m;
  const uniforms = { uHue: { value: cloth.hue }, uSat: { value: cloth.sat }, uVal: { value: cloth.val } };
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nuniform float uHue;uniform float uSat;uniform float uVal;")
      .replace(
        "#include <map_fragment>",
        `#include <map_fragment>
        {
          vec3 c = diffuseColor.rgb;
          vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
          vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
          vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
          float d = q.x - min(q.w, q.y);
          vec3 hsv = vec3(abs(q.z + (q.w - q.y) / (6.0 * d + 1e-10)), d / (q.x + 1e-10), q.x);
          float mask = smoothstep(0.16, 0.22, hsv.x) * (1.0 - smoothstep(0.46, 0.52, hsv.x)) * smoothstep(0.1, 0.22, hsv.y);
          vec3 t = vec3(uHue, clamp(hsv.y * uSat, 0.0, 1.0), clamp(hsv.z * uVal, 0.0, 1.0));
          vec3 rgb = clamp(abs(mod(t.x * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
          rgb = t.z * mix(vec3(1.0), rgb, t.y);
          diffuseColor.rgb = mix(c, rgb, mask);
        }`,
      );
  };
  m.customProgramCacheKey = () => `cloth-${cloth.hue}-${cloth.sat}-${cloth.val}`;
  return m;
}

// Attach every skinned mesh of `scene` to `skeleton`, matching bones by name.
function graft(scene, skeleton, into, materialFor) {
  const meshes = [];
  scene.traverse((o) => {
    if (o.isSkinnedMesh) meshes.push(o);
  });
  for (const m of meshes) {
    const bones = m.skeleton.bones.map((b) => skeleton.bones.find((x) => x.name === b.name) ?? b);
    m.bind(new THREE.Skeleton(bones, m.skeleton.boneInverses), m.bindMatrix);
    if (materialFor) m.material = materialFor(m.material);
    into.add(m);
  }
  return meshes;
}

function buildHumanoid(look) {
  const outfitKey = `${look.g}_${look.outfit}`,
    outfit = parts.get(outfitKey);
  if (!outfit || !parts.get("anims")) return null;
  const model = cloneSkinned(outfit.scene);
  let skeleton = null;
  const cloth = CLOTH[look.cloth];
  model.traverse((o) => {
    if (o.isSkinnedMesh) {
      skeleton ??= o.skeleton;
      if (RANGER_HOOD.test(o.name)) o.visible = !!look.hood;
      if (RANGER_PAULDRON.test(o.name)) o.visible = !!look.pauldron;
      if (/Belt_1\.001/.test(o.name)) o.visible = false;
      if (/Ranger|Peasant/.test(o.material.name)) o.material = clothMaterial(o.material, cloth);
    }
  });
  graft(cloneSkinned(parts.get(`head_${look.g}`).scene), skeleton, model);
  const hairTint = (m) => {
    const c = m.clone();
    c.color = new THREE.Color(HAIR[look.hairColor] ?? HAIR.brown);
    return c;
  };
  if (look.hair && !look.hood && parts.get(look.hair)) graft(cloneSkinned(parts.get(look.hair).scene), skeleton, model, hairTint);
  if (look.beard && look.g === "male" && parts.get("hair_beard")) graft(cloneSkinned(parts.get("hair_beard").scene), skeleton, model, hairTint);
  const held = new Map();
  for (const name of look.held ?? []) {
    const h = HELD[name],
      src = parts.get(h?.file),
      bone = skeleton.bones.find((b) => b.name === h?.bone);
    if (!src || !bone) continue;
    const obj = src.scene.clone(true);
    obj.position.set(...h.pos);
    obj.rotation.set(...h.rot);
    obj.scale.setScalar(h.scale);
    bone.add(obj);
    held.set(name, obj);
  }
  return { model, held };
}

export function createRig(key, { tint = null, size = 1 } = {}) {
  const look = LOOKS[key];
  if (look) return humanoidRig(look);
  const beast = BEASTS[key],
    gltf = beasts.get(key);
  if (!beast || !gltf) return null;
  return beastRig(beast, gltf, { tint, size });
}

function humanoidRig(look) {
  const built = buildHumanoid(look);
  if (!built) return null;
  const { model } = built,
    root = new THREE.Group(),
    turn = new THREE.Group();
  turn.add(model);
  root.add(turn);
  if (look.scale) turn.scale.setScalar(look.scale);
  const anims = parts.get("anims").animations,
    mixer = new THREE.AnimationMixer(model),
    actions = {};
  for (const [logical, spec] of Object.entries(CLIPS)) {
    const clip = anims.find((a) => a.name === spec.name);
    if (!clip) continue;
    const a = mixer.clipAction(clip);
    if (spec.once) {
      a.setLoop(THREE.LoopOnce, 1);
      a.clampWhenFinished = true;
    }
    a.userData = spec;
    actions[logical] = a;
  }
  const idleKey = look.idle ?? "idle";
  let base = null,
    baseKey = null,
    oneShot = null,
    oneShotUntil = 0,
    dead = false,
    clock = 0,
    yawTarget = 0;
  function fadeTo(key, fade = 0.2) {
    const action = actions[key];
    if (!action || key === baseKey) return;
    action.reset().setEffectiveTimeScale(action.userData.timeScale ?? 1).setEffectiveWeight(1).fadeIn(fade).play();
    base?.fadeOut(fade);
    base = action;
    baseKey = key;
    yawTarget = action.userData.yaw ?? 0;
  }
  function play(name, { fade = 0.12, speed = 1 } = {}) {
    if (dead && name !== "death") return;
    const a = actions[name];
    if (!a) return;
    oneShot?.fadeOut(fade);
    const ts = (a.userData.timeScale ?? 1) * speed;
    a.reset().setEffectiveTimeScale(ts).setEffectiveWeight(1).fadeIn(fade).play();
    oneShot = a;
    oneShotUntil = clock + a.getClip().duration / Math.abs(ts) - fade;
  }
  fadeTo(idleKey, 0);
  mixer.update(Math.random() * 2);
  return {
    root,
    beast: false,
    caster: !!look.caster,
    setGear() {},
    play,
    attack() {
      play(look.attack ?? "attack1h");
    },
    hit() {
      if (!oneShot || clock > oneShotUntil) play("hit", { fade: 0.06 });
    },
    die() {
      if (dead) return;
      play("death", { fade: 0.1 });
      dead = true;
    },
    revive() {
      dead = false;
      oneShot?.fadeOut(0.2);
      oneShot = null;
      baseKey = null;
    },
    update(dt, motion = {}) {
      clock += dt;
      if (oneShot && clock > oneShotUntil && !dead) {
        oneShot.fadeOut(0.25);
        oneShot = null;
      }
      if (!dead) {
        let next = idleKey;
        if (motion.sitting && !motion.moving) next = "sit";
        else if (motion.moving)
          next = motion.dir === "back" ? "back" : motion.dir === "left" ? "strafeLeft" : motion.dir === "right" ? "strafeRight" : "run";
        else if (motion.casting) next = "cast";
        else if (motion.combat) next = "combatIdle";
        fadeTo(next);
      } else yawTarget = 0;
      // Strafing turns the body toward the travel direction while the character keeps facing ahead.
      turn.rotation.y += (yawTarget - turn.rotation.y) * Math.min(1, dt * 10);
      mixer.update(dt);
    },
  };
}

function beastRig(cfg, gltf, { tint, size }) {
  const model = cloneSkinned(gltf.scene);
  model.scale.setScalar(cfg.scale * size);
  model.rotation.y = cfg.yaw ?? 0;
  const root = new THREE.Group();
  root.add(model);
  model.traverse((o) => {
    if (o.isMesh && tint) {
      o.material = o.material.clone();
      o.material.color.multiply(new THREE.Color(tint).lerp(new THREE.Color("#ffffff"), 0.15));
    }
  });
  const mixer = new THREE.AnimationMixer(model),
    actions = {};
  for (const [k, n] of Object.entries(cfg.clips)) {
    const c = gltf.animations.find((a) => a.name === n);
    if (c) actions[k] = mixer.clipAction(c);
  }
  let base = null,
    lunge = 0,
    dead = false;
  const fadeTo = (a) => {
    if (!a || a === base) return;
    a.reset().fadeIn(0.2).play();
    base?.fadeOut(0.2);
    base = a;
  };
  fadeTo(actions.idle);
  return {
    root,
    beast: true,
    setGear() {},
    play(name) {
      if (name.startsWith("attack") || name === "lunge") lunge = 0.35;
    },
    attack() {
      lunge = 0.35;
    },
    hit() {},
    die() {
      dead = true;
    },
    revive() {
      dead = false;
    },
    update(dt, motion = {}) {
      if (!dead) {
        fadeTo(motion.moving ? actions.run : actions.idle);
        base?.setEffectiveTimeScale(motion.moving ? 1.3 : 1);
      }
      if (lunge > 0) {
        lunge = Math.max(0, lunge - dt);
        model.position.z = Math.sin((1 - lunge / 0.35) * Math.PI) * 0.45;
      } else model.position.z = 0;
      if (!dead) mixer.update(dt);
    },
  };
}
