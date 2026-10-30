import { gameMenu } from "./game-menu.js";
import { servicesUi } from "./services-ui.js";
import { WORLD_HALF, WORLD_SIZE } from "./world-config.js";
import { characterUi } from "./character-ui.js";
import { accountUi } from "./accounts-ui.js";
import { BAR_KEYS, bagCells, bagItems, questMarker, stackConsumables, itemIconStyle } from "./ui-model.js";
import { createHud, iconStyle } from "./hud.js";
import { createCombatUi } from "./combat-ui.js";
import { createGuildUi } from "./guild-ui.js";
import {
  preloadCharacters,
  createRig,
  heroLook,
  NPC_MODEL,
  CREATURES,
} from "./characters.js";
const charactersReady = preloadCharacters();
import * as THREE from "./vendor/three.module.js";
import { createDungeon } from "./dungeon-scene.js";
import { CRYPT } from "./dungeon-layout.js";
import {
  GRAPHICS,
  setGraphicsQuality,
  setIndoors,
  height,
  createScenery,
  createBody,
  createCreature,
  applyEquipment,
} from "./scenery.js";
import {
  combatIntent,
  approach,
  pointerIsClick,
  pickWorldTarget,
  movementVector,
  facingAngle,
} from "./controls.js";
const $ = (id) => document.getElementById(id),
  canvas = $("world");
const scene = new THREE.Scene();
scene.background = new THREE.Color("#a9c8de");
scene.fog = new THREE.FogExp2("#c3d6dc", 0.0065);
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.7));
renderer.shadowMap.enabled = GRAPHICS.shadows;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;
const camera = new THREE.PerspectiveCamera(
  50,
  innerWidth / innerHeight,
  0.1,
  360,
);
camera.position.set(28, 21, 35);
const hemi = new THREE.HemisphereLight("#cfe4ff", "#4b4126", 1.6);
scene.add(hemi);
const sun = new THREE.DirectionalLight("#ffe2a8", 3.4);
sun.position.set(-30, 22, -18);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, {
  left: -40,
  right: 40,
  top: 40,
  bottom: -40,
  far: 100,
});
sun.shadow.bias = -0.0008;
scene.add(sun);
scene.add(sun.target);
const materials = new Map();
function mat(color) {
  if (!materials.has(color))
    materials.set(
      color,
      new THREE.MeshStandardMaterial({ color, roughness: 0.95 }),
    );
  return materials.get(color);
}
function mesh(geometry, color, x = 0, y = 0, z = 0, parent = scene) {
  const m = new THREE.Mesh(geometry, mat(color));
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}
// The open world lives in its own group so it can be hidden while inside a dungeon.
const worldRoot = new THREE.Group();
scene.add(worldRoot);
const scenery = createScenery(worldRoot);
const dungeon = createDungeon(scene);
let currentZone = null;
const OUTDOOR = { bg: "#a9c8de", fog: "#c3d6dc", density: 0.0065, hemi: ["#cfe4ff", "#4b4126", 1.6], sun: ["#ffe2a8", 3.4] },
  INDOOR = { bg: "#07060a", fog: "#0b0910", density: 0.04, hemi: ["#8f98c4", "#2a1d10", 1.05], sun: ["#b4c0ff", 0.7] };
function switchZone(instance) {
  if (instance === currentZone) return;
  currentZone = instance;
  const inside = !!instance,
    look = inside ? INDOOR : OUTDOOR;
  worldRoot.visible = !inside;
  dungeon.setActive(inside);
  setIndoors(inside);
  scene.background.set(look.bg);
  scene.fog.color.set(look.fog);
  scene.fog.density = look.density;
  hemi.color.set(look.hemi[0]);
  hemi.groundColor.set(look.hemi[1]);
  hemi.intensity = look.hemi[2];
  sun.color.set(look.sun[0]);
  sun.intensity = look.sun[1];
  zoom = Math.min(zoom, inside ? 9 : 30);
  // Models from the other zone are stale: drop and rebuild them.
  for (const models of [playerModels, enemyModels, lootModels, portalModels])
    for (const [id, g] of models) {
      scene.remove(g);
      models.delete(id);
    }
}
function label(text, color) {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 80;
  const ctx = c.getContext("2d");
  ctx.font = "500 30px system-ui";
  ctx.textAlign = "center";
  ctx.lineWidth = 5;
  ctx.strokeStyle = "#10271d";
  ctx.strokeText(text, 256, 48);
  ctx.fillStyle = color;
  ctx.fillText(text, 256, 48);
  const texture = new THREE.CanvasTexture(c);
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: texture, depthTest: false }),
  );
  sprite.scale.set(4.6, 0.72, 1);
  sprite.position.y = 2.7;
  return sprite;
}
function questGlyph(symbol, color) {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const ctx = c.getContext("2d");
  ctx.font = "900 112px Georgia, serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineWidth = 10;
  ctx.strokeStyle = "#2a1a00";
  ctx.strokeText(symbol, 64, 68);
  ctx.fillStyle = color;
  ctx.fillText(symbol, 64, 68);
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false }),
  );
  sprite.scale.set(1.25, 1.25, 1);
  return sprite;
}
const portalModels = new Map(),
  telegraphModels = new Map(),
  playerModels = new Map(),
  enemyModels = new Map(),
  npcModels = new Map(),
  resourceModels = new Map(),
  lootModels = new Map();
function avatar(p, modelKey = heroLook(p.classId, p.gender)) {
  const rig = createRig(modelKey);
  let g;
  if (rig) {
    g = new THREE.Group();
    g.add(rig.root);
    g.userData.rig = rig;
  } else
    g = createBody(p.faction === "dawnward" ? "#a88c55" : "#598b7e", p.classId);
  const tag = label(p.name, p.faction === "dawnward" ? "#ffdc96" : "#b8ead6");
  if (rig) tag.position.y = 2.25;
  g.add(tag);
  g.userData.nameTag = tag;
  scene.add(g);
  return g;
}
function enemy(e) {
  const type = CREATURES[e.kind] ?? CREATURES.brambleling,
    rig = createRig(type.model, { tint: type.tint, size: type.size ?? 1 });
  let g;
  if (rig) {
    g = new THREE.Group();
    g.add(rig.root);
    g.userData.rig = rig;
  } else g = createCreature();
  g.userData.enemy = e.id;
  g.userData.kind = e.kind;
  g.userData.plateY = e.boss ? 2.9 : type.model === "fox" ? 1.4 * (type.size ?? 1) : 1.95;
  scene.add(g);
  return g;
}
// Friendly NPCs show a green name with their <title> beneath, MMO style.
// Player name with their guild in angle brackets beneath it.
function playerTag(p) {
  const color = p.faction === "dawnward" ? "#ffdc96" : "#b8ead6";
  if (!p.guild) return label(p.name, color);
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 128;
  const ctx = c.getContext("2d");
  ctx.textAlign = "center";
  ctx.lineJoin = "round";
  ctx.font = "500 30px system-ui";
  ctx.lineWidth = 5;
  ctx.strokeStyle = "#10271d";
  ctx.strokeText(p.name, 256, 48);
  ctx.fillStyle = color;
  ctx.fillText(p.name, 256, 48);
  ctx.font = "500 24px system-ui";
  ctx.strokeText(`<${p.guild}>`, 256, 88);
  ctx.fillStyle = "#e9e2c8";
  ctx.fillText(`<${p.guild}>`, 256, 88);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false }));
  sprite.scale.set(4.6, 1.15, 1);
  sprite.userData.twoLine = true;
  return sprite;
}
function npcLabel(name, title) {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 128;
  const ctx = c.getContext("2d");
  ctx.textAlign = "center";
  ctx.lineJoin = "round";
  ctx.font = "700 40px system-ui";
  ctx.lineWidth = 7;
  ctx.strokeStyle = "#000";
  ctx.strokeText(name, 256, 52);
  ctx.fillStyle = "#68e86b";
  ctx.fillText(name, 256, 52);
  ctx.font = "500 28px system-ui";
  ctx.lineWidth = 6;
  ctx.strokeText(`<${title}>`, 256, 98);
  ctx.fillStyle = "#c8f5c2";
  ctx.fillText(`<${title}>`, 256, 98);
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false }),
  );
  sprite.scale.set(3.4, 0.85, 1);
  sprite.position.y = 2.45;
  return sprite;
}
const ring = mesh(new THREE.RingGeometry(0.8, 1.0, 48), "#ff2a1a");
ring.rotation.x = -Math.PI / 2;
ring.visible = false;
ring.castShadow = false;
ring.material = new THREE.MeshBasicMaterial({
  color: "#ff2a1a",
  side: THREE.DoubleSide,
  transparent: true,
  opacity: 0.85,
  depthWrite: false,
});
let token = sessionStorage.getItem("hearthwild-character"),
  state = null,
  after = 0,
  chatEpoch = null,
  selected = null,
  yaw = 0.3,
  zoom = 12,
  playing = false,
  noticeTimer,
  pollTimer,
  inputTimer,
  inputBusy = false,
  lastInput = "";
let cameraMode = "orbit",
  cameraPitch = 0.48,
  mouseSensitivity = 0.006,
  cameraHoldUntil = 0,
  lookTurning = false;
try {
  const p = JSON.parse(localStorage.getItem("hearthwild-camera") ?? "{}");
  if (["orbit", "follow", "first"].includes(p.mode)) cameraMode = p.mode;
  if (Number.isFinite(p.sensitivity))
    mouseSensitivity = Math.max(0.002, Math.min(0.012, p.sensitivity));
} catch {}
function setCamera({ mode = cameraMode, sensitivity = mouseSensitivity }) {
  cameraMode = mode;
  mouseSensitivity = sensitivity;
  cameraPitch = mode === "first" ? 0.08 : 0.48;
  try {
    localStorage.setItem(
      "hearthwild-camera",
      JSON.stringify({ mode, sensitivity }),
    );
  } catch {}
  notice(
    `View: ${mode === "first" ? "First person" : mode === "follow" ? "Follow behind" : "Orbit"} · V switches view`,
  );
}
let queuedAbility = null,
  queuedAttack = null,
  autorun = false,
  heading = 0.2,
  jumpStart = -Infinity,
  mouseButtons = 0,
  interaction = null,
  actionBusy = false,
  lastActionAt = 0,
  dialogueNpc = null,
  questFingerprint = "",
  bagFingerprint = "",
  abilityClass = "",
  playEpoch = 0;
const seenEvents = new Set(),
  effects = [],
  corpses = [];
function animateCorpses(t) {
  for (let i = corpses.length - 1; i >= 0; i--) {
    const c = corpses[i],
      age = t - c.started;
    const rig = c.g.userData.rig;
    if (!rig || rig.beast) c.g.rotation.z = Math.min(Math.PI / 2, age * 5);
    rig?.update(1 / 60);
    if (age > 5) c.g.position.y -= 0.01;
    if (age > 7) {
      scene.remove(c.g);
      c.g.traverse((o) => {
        if (o.material?.map) o.material.map.dispose();
        o.geometry?.dispose();
      });
      corpses.splice(i, 1);
    }
  }
}
const keys = new Set();
async function api(path, data) {
  const response = await fetch(path, {
    method: data ? "POST" : "GET",
    headers: {
      ...(data ? { "Content-Type": "application/json" } : {}),
      ...(token ? { "X-Character-ID": token } : {}),
    },
    body: data ? JSON.stringify(data) : undefined,
    signal: AbortSignal.timeout(5000),
  });
  const result = await response.json();
  if (!response.ok) {
    const error = new Error(
      result.error?.message ?? "Could not reach the world.",
    );
    error.status = response.status;
    throw error;
  }
  return result;
}
function notice(text) {
  $("notice").textContent = text;
  clearTimeout(noticeTimer);
  noticeTimer = setTimeout(() => ($("notice").textContent = ""), 3500);
}
// Failed actions appear as red text near the top of the screen.
const uiError = (text) => combatUi.error(text);
function npcModel(n) {
  const g = avatar(
    { ...n, faction: n.id === "warden" ? "dawnward" : "mossbound" },
    n.look ?? NPC_MODEL[n.id] ?? "npc-merchant",
  );
  if (g.userData.rig) {
    g.remove(g.userData.nameTag);
    const tag = npcLabel(n.name, n.role.split(" · ")[0]);
    g.add(tag);
    g.userData.nameTag = tag;
  }
  g.userData.interaction = { type: "talk", target: n.id };
  return g;
}
function resourceModel(r) {
  const g = new THREE.Group();
  mesh(
    new THREE.CylinderGeometry(0.045, 0.07, 0.65, 8),
    "#78996c",
    0,
    0.3,
    0,
    g,
  );
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const leaf = mesh(
      new THREE.SphereGeometry(0.16, 10, 6),
      "#8ab2aa",
      Math.cos(a) * 0.2,
      0.45,
      Math.sin(a) * 0.2,
      g,
    );
    leaf.scale.set(1.8, 0.35, 1);
  }
  const bud = mesh(
    new THREE.SphereGeometry(0.13, 12, 8),
    "#bce8ca",
    0,
    0.7,
    0,
    g,
  );
  bud.material = new THREE.MeshStandardMaterial({
    color: "#bce8ca",
    emissive: "#71a990",
    emissiveIntensity: 0.7,
  });
  const tag = label("Starleaf · F", "#cef2d6");
  tag.position.y = 1.2;
  tag.scale.set(2.7, 0.45, 1);
  g.add(tag);
  // A generous pick volume makes the small plant easy to click without changing gather reach.
  const pick = mesh(
    new THREE.CylinderGeometry(0.65, 0.65, 1.25, 10),
    "#ffffff",
    0,
    0.55,
    0,
    g,
  );
  pick.material = new THREE.MeshBasicMaterial({
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });
  pick.castShadow = false;
  pick.receiveShadow = false;
  g.userData.interaction = { type: "gather", target: r.id };
  scene.add(g);
  return g;
}
function lootModel(l) {
  const g = new THREE.Group();
  mesh(new THREE.BoxGeometry(0.65, 0.38, 0.45), "#9d7845", 0, 0.25, 0, g);
  mesh(new THREE.BoxGeometry(0.7, 0.08, 0.5), "#dfbb66", 0, 0.48, 0, g);
  const marker = label("Loot · F", "#ffe7a3");
  marker.position.y = 1.1;
  marker.scale.set(2, 0.45, 1);
  g.add(marker);
  g.userData.interaction = { type: "loot", target: l.id };
  scene.add(g);
  return g;
}
function portalModel(pt) {
  const g = new THREE.Group();
  if (pt.type === "enter") {
    // A sunken stone doorway at the foot of the ruins.
    const stone = new THREE.MeshStandardMaterial({ color: "#8d877b", roughness: 0.95 });
    for (const x of [-1.6, 1.6]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.8, 3.4, 0.8), stone);
      post.position.set(x, 1.7, 0);
      post.castShadow = true;
      g.add(post);
    }
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.7, 1), stone);
    lintel.position.y = 3.6;
    lintel.castShadow = true;
    g.add(lintel);
    const dark = new THREE.Mesh(
      new THREE.PlaneGeometry(2.4, 3.3),
      new THREE.MeshBasicMaterial({ color: "#120b18", side: THREE.DoubleSide }),
    );
    dark.position.set(0, 1.65, -0.1);
    g.add(dark);
    const glow = new THREE.Mesh(
      new THREE.PlaneGeometry(2.4, 3.3),
      new THREE.MeshBasicMaterial({ color: "#7b4fd6", transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false }),
    );
    glow.position.set(0, 1.65, 0);
    g.add(glow);
    g.userData.glow = glow;
  }
  const tag = label(`${pt.type === "enter" ? pt.name : "Leave the crypt"} · F`, "#d9c2ff");
  tag.position.y = pt.type === "enter" ? 4.6 : 3.1;
  tag.scale.set(4.2, 0.65, 1);
  g.add(tag);
  const pick = new THREE.Mesh(
    new THREE.CylinderGeometry(1.6, 1.6, 3.4, 12),
    new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
  );
  pick.position.y = 1.7;
  g.add(pick);
  g.userData.interaction = { type: pt.type, target: pt.id };
  scene.add(g);
  return g;
}
function telegraphModel(t) {
  const g = new THREE.Group(),
    fill = new THREE.Mesh(
      new THREE.CircleGeometry(1, 48),
      new THREE.MeshBasicMaterial({ color: "#ff3a1a", transparent: true, opacity: 0.32, depthWrite: false }),
    ),
    rim = new THREE.Mesh(
      new THREE.RingGeometry(0.93, 1, 64),
      new THREE.MeshBasicMaterial({ color: "#ff8a3a", transparent: true, opacity: 0.95, depthWrite: false, side: THREE.DoubleSide }),
    );
  fill.rotation.x = rim.rotation.x = -Math.PI / 2;
  g.add(fill, rim);
  g.scale.setScalar(t.radius);
  g.position.set(t.x, 0.06, t.z);
  g.userData.fill = fill;
  g.userData.explodeAt = t.explodeAt;
  scene.add(g);
  return g;
}
function element(tag, text, className) {
  const e = document.createElement(tag);
  if (text !== undefined) e.textContent = text;
  if (className) e.className = className;
  return e;
}
function updateQuests() {
  const fingerprint = JSON.stringify(state.self.quests);
  if (fingerprint === questFingerprint) return;
  questFingerprint = fingerprint;
  $("quest-list").replaceChildren();
  for (const [id, q] of Object.entries(state.self.quests)) {
    const def = state.questDefinitions[id],
      npc = state.npcs.find((n) => n.id === def.npc),
      row = element("div", undefined, "quest-row");
    row.append(
      element("h3", def.name),
      element(
        "p",
        q.status === "offered"
          ? `Speak to ${npc.name} at camp.`
          : `${def.objective}: ${q.progress} / ${def.required}`,
      ),
      element("small", def.area),
    );
    const button = element(
      "button",
      q.status === "offered"
        ? `Talk to ${npc.name}`
        : q.status === "ready"
          ? `Return to ${npc.name}`
          : q.status === "complete"
            ? "Quest complete"
            : id === "starleaf"
              ? "Find nearby starleaf"
              : id === "crypt"
                ? state.self.instance
                  ? "Find Vorlath in the Sanctum"
                  : "Go to the Hollow Crypt"
                : "Find a brambleling",
    );
    button.disabled = q.status === "complete";
    button.onclick = () => {
      keys.clear();
      queuedAbility = null;
      if (q.status === "offered" || q.status === "ready")
        queueInteraction({ type: "talk", target: npc.id });
      else if (id === "crypt") {
        if (state.self.instance) notice("Vorlath waits in the Warden’s Sanctum at the far end of the crypt.");
        else queueInteraction({ type: "enter", target: "crypt-door" });
      } else if (id === "starleaf") {
        const r = [...state.resources]
          .filter((r) => r.available)
          .sort(
            (a, b) =>
              Math.hypot(a.x - state.self.x, a.z - state.self.z) -
              Math.hypot(b.x - state.self.x, b.z - state.self.z),
          )[0];
        if (r) queueInteraction({ type: "gather", target: r.id });
        else notice("Starleaf is regrowing. Try again shortly.");
      } else {
        selected = nearest()?.id;
        notice("Target found. Use abilities 1–4.");
      }
      canvas.focus();
    };
    row.append(button);
    $("quest-list").append(row);
  }
}
function updateHotbar() {
  if (abilityClass !== state.self.classId) {
    abilityClass = state.self.classId;
    $("hotbar").replaceChildren();
    for (let slot = 0; slot < 12; slot++) {
      const a = state.abilities.find((a) => a.key === slot + 1),
        b = element("button");
      b.dataset.slot = String(slot);
      b.append(element("kbd", BAR_KEYS[slot]));
      if (a) {
        b.dataset.ability = a.id;
        b.title = `${a.name} · ${a.description} · ${a.cost} ${state.classes[state.self.classId].resource} · ${a.cooldown / 1000}s cooldown · Level ${a.level}`;
        b.setAttribute("aria-label", `${a.key}: ${a.name}`);
        const art = element("span", undefined, "ability-art");
        Object.assign(
          art.style,
          iconStyle(
            ["warrior", "warlock", "druid", "rogue"].indexOf(
              state.self.classId,
            ) *
              4 +
              a.key -
              1,
          ),
        );
        b.append(
          art,
          element("span", undefined, "cooldown-sweep"),
          element("small"),
          element("strong", a.name),
        );
        b.onclick = () => useAbility(a.key);
      } else if (QUICK_SLOTS[slot]) {
        const q = QUICK_SLOTS[slot],
          art = element("span", undefined, "ability-art");
        Object.assign(art.style, itemIconStyle(q.icon));
        b.dataset.quick = q.kind;
        b.title = q.title;
        b.setAttribute("aria-label", `${BAR_KEYS[slot]}: ${q.title}`);
        b.append(art, element("span", undefined, "cooldown-sweep"), element("small"));
        b.onclick = () => useConsumable(q.kind);
      } else if (slot === 4) {
        b.className = "auto-attack";
        b.dataset.autoattack = "1";
        b.title = "Attack · Start or stop automatic weapon swings on your target (5 or right-click an enemy)";
        b.setAttribute("aria-label", "5: Attack");
        b.append("⚔");
        b.onclick = toggleAutoAttack;
      } else {
        b.className = "empty-slot";
        b.disabled = true;
        b.setAttribute("aria-label", `Empty action slot ${BAR_KEYS[slot]}`);
        b.title = "Empty action slot";
      }
      $("hotbar").append(b);
    }
  }
  const now = combatUi.serverNow(),
    gcdLeft = Math.max(0, (state.self.globalReadyAt ?? 0) - now),
    target = state.enemies.find((e) => e.id === selected && e.hp > 0);
  for (const a of state.abilities) {
    const b = $("hotbar").querySelector(`[data-ability="${a.id}"]`),
      own = Math.max(0, (state.self.cooldowns[a.id] ?? 0) + a.cooldown - now),
      useGcd = gcdLeft > own,
      remaining = Math.max(own, gcdLeft),
      total = useGcd ? state.self.gcd ?? 1500 : a.cooldown,
      locked = state.self.level < a.level;
    b.disabled = locked;
    b.classList.toggle("cooling", remaining > 0);
    b.classList.toggle("gcd", useGcd && remaining > 0);
    b.classList.toggle("locked", locked);
    b.classList.toggle("queued", queuedAbility?.id === a.id);
    b.classList.toggle(
      "out-of-range",
      !!(a.multiplier && target && Math.hypot(target.x - state.self.x, target.z - state.self.z) > a.range),
    );
    b.classList.toggle("no-power", state.self.power < a.cost);
    b.querySelector("small").textContent = locked
      ? `L${a.level}`
      : own > 1500
        ? own >= 10000
          ? `${Math.ceil(own / 1000)}`
          : (own / 1000).toFixed(1)
        : "";
    b.querySelector(".cooldown-sweep").style.background =
      remaining > 0
        ? `conic-gradient(#000b ${(remaining / total) * 360}deg,transparent 0deg)`
        : "transparent";
  }
  $("hotbar")
    .querySelector("[data-autoattack]")
    ?.classList.toggle("active", !!state.self.autoAttack);
  const stacks = stackConsumables(state.self.inventory);
  for (const b of $("hotbar").querySelectorAll("[data-quick]")) {
    const kind = b.dataset.quick,
      count = stacks.filter((i) => (kind === "potion" ? i.heal : i[kind])).reduce((n, i) => n + i.count, 0),
      wait = kind === "potion" ? Math.max(0, state.self.potionReadyAt - now) : 0;
    b.querySelector("small").textContent = wait > 0 ? `${Math.ceil(wait / 1000)}` : String(count);
    b.classList.toggle("empty", count === 0);
    b.querySelector(".cooldown-sweep").style.background =
      wait > 0 ? `conic-gradient(#000b ${(wait / 20000) * 360}deg,transparent 0deg)` : "transparent";
  }
}
function toggleBag() {
  services.close();
  queuedAbility = null;
  interaction = null;
  keys.clear();
  hud.close();
  $("character-sheet").hidden = true;
  $("bag").hidden = !$("bag").hidden;
  bagFingerprint = "";
  updateBag();
}
let selectedItem = null;
function updateBag() {
  if ($("bag").hidden) return;
  const p = state.self,
    fingerprint = JSON.stringify([
      p.inventory,
      p.equipment,
      p.stats,
      p.materials,
      Math.ceil(p.hp),
      p.potionReadyAt,
      Math.floor(state.serverTime / 1000),
      p.quests.starleaf,
      $("bag-search").value,
    ]);
  if (fingerprint === bagFingerprint) return;
  bagFingerprint = fingerprint;
  $("stats").textContent =
    `Damage ${p.stats.damage} · Armor ${p.stats.armor} · Health ${p.stats.maxHp}`;
  $("herbs").textContent = `Reagents · ${p.materials.starleaf} Starleaf`;
  $("bag-capacity").textContent =
    `${stackConsumables(p.inventory).length} / 60 bag slots · Reagent pouch ${p.materials.starleaf}/99 · ${p.coins} gold`;
  $("equipment-slots").replaceChildren();
  for (const slot of ["weapon", "chest", "charm"]) {
    const item = p.inventory.find((i) => i.id === p.equipment[slot]),
      b = element("button", `${slot}: ${item ? item.name : "Empty"}`);
    b.onclick = () => {
      if (item) showItem(item);
    };
    $("equipment-slots").append(b);
  }
  $("inventory").replaceChildren();
  for (const item of bagCells(
    bagItems(stackConsumables(p.inventory), p.materials),
    $("bag-search").value,
    60,
  )) {
    const b = element("button");
    b.className = "bag-slot";
    if (item) {
      b.classList.add(item.rarity === "Epic" ? "epic" : item.rarity === "Rare" ? "rare" : "uncommon");
      b.setAttribute(
        "aria-label",
        item.slot === "reagent" ? `${item.name} ×${item.count}` : item.name,
      );
      b.title =
        item.slot === "reagent"
          ? `Starleaf ×${item.count} · Reagent pouch · A remedy for the grove`
          : `${item.name} · ${item.slot} · +${item.damage} damage / +${item.armor} armor / +${item.maxHp} health`;
      Object.assign(
        b.style,
        itemIconStyle(item.template) ??
          iconStyle(
            item.slot === "reagent"
              ? 8
              : item.slot === "weapon"
                ? 0
                : item.slot === "chest"
                  ? 2
                  : 11,
          ),
      );
      if (item.slot === "consumable") {
        b.title = `${item.name} ×${item.count} · Right-click to use`;
        // Right-click uses a consumable, as in most MMOs.
        b.oncontextmenu = (e) => {
          e.preventDefault();
          useItem(item);
        };
      }
      if (item.count)
        b.append(element("span", String(item.count), "stack-count"));
      if (p.equipment[item.slot] === item.id)
        b.append(element("span", "✓", "equipped-mark"));
      b.onclick = () => showItem(item);
      b.onfocus = () => showItem(item);
    } else {
      b.classList.add("vacant");
      b.disabled = true;
      b.setAttribute("aria-label", "Empty bag slot");
    }
    $("inventory").append(b);
  }
  const item = bagItems(stackConsumables(p.inventory), p.materials).find(
    (i) => i.id === selectedItem || i.template === selectedItem,
  );
  if (item) showItem(item);
  else {
    $("item-detail").textContent = bagItems(p.inventory, p.materials).length
      ? "Select an item to compare or equip."
      : "Your bags are empty. Collect an enemy’s loot chest.";
  }
}
async function useItem(item) {
  try {
    const r = await api("/api/actions", { type: "consume", item: item.ids?.[0] ?? item.id });
    combatUi.info(r.message);
    keys.clear();
  } catch (e) {
    uiError(e.message);
  }
}
// Quick-use from the action bar: best healing draught, then food and drink.
function useConsumable(kind) {
  if (!state) return;
  const stacks = stackConsumables(state.self.inventory),
    pick =
      kind === "potion"
        ? stacks.filter((i) => i.heal).sort((a, b) => b.heal - a.heal)[0]
        : stacks.find((i) => i[kind]);
  if (!pick) {
    uiError(kind === "potion" ? "You have no healing draughts. Craft them with Alchemy or buy them." : `You have no ${kind === "food" ? "food" : "drink"}. Torren the Provisioner sells some.`);
    return;
  }
  useItem(pick);
}
function showItem(item) {
  selectedItem = item.id;
  if (item.slot === "reagent") {
    $("item-detail").replaceChildren(
      element("strong", `Starleaf ×${item.count}`),
      element("small", "Reagent · Quest item"),
      element(
        "p",
        state.self.quests.starleaf.status === "ready"
          ? "Four sprigs collected. Return to Herbalist Mira — look for the gold ? marker."
          : "Gather four sprigs for A remedy for the grove. Kept in your reagent pouch; consumed when you turn in the quest.",
      ),
    );
    return;
  }
  if (item.slot === "consumable") {
    selectedItem = item.template;
    const p = state.self,
      potion = !!item.heal,
      wait = potion ? Math.max(0, Math.ceil((p.potionReadyAt - state.serverTime) / 1000)) : 0;
    const use = element(
      "button",
      wait ? `Potion ready in ${wait}s` : item.food ? "Eat" : item.drink ? "Drink" : "Use draught",
    );
    use.disabled = wait > 0 || (potion && p.hp >= p.stats.maxHp);
    use.onclick = () => useItem(item);
    $("item-detail").replaceChildren(
      element("strong", `${item.name} ×${item.count ?? 1}`),
      element(
        "p",
        item.food
          ? `Restores ${item.food} health over 18 seconds while sitting. Moving, attacking or being hit stops eating. Not usable in combat.`
          : item.drink
            ? `Restores ${item.drink} mana or energy over 18 seconds while sitting. Moving, attacking or being hit stops drinking. Not usable in combat.`
            : `Restores ${item.heal} health instantly. 20-second shared potion cooldown.`,
      ),
      element("small", "Tip: right-click it in your bags to use it."),
      use,
    );
    return;
  }
  const p = state.self,
    old = p.inventory.find((i) => i.id === p.equipment[item.slot]),
    equipped = old?.id === item.id;
  $("item-detail").replaceChildren();
  $("item-detail").append(
    element("strong", item.name, item.rarity === "Epic" ? "epic" : item.rarity === "Rare" ? "rare" : "uncommon"),
    element("small", `${item.rarity} · ${item.slot}`),
    element(
      "p",
      `+${item.damage} damage · +${item.armor} armor · +${item.maxHp} health`,
    ),
  );
  if (!equipped)
    $("item-detail").append(
      element(
        "small",
        `Compared with equipped: ${item.damage - (old?.damage ?? 0) >= 0 ? "+" : ""}${item.damage - (old?.damage ?? 0)} damage, ${item.armor - (old?.armor ?? 0) >= 0 ? "+" : ""}${item.armor - (old?.armor ?? 0)} armor, ${item.maxHp - (old?.maxHp ?? 0) >= 0 ? "+" : ""}${item.maxHp - (old?.maxHp ?? 0)} health`,
      ),
    );
  const b = element("button", equipped ? "Equipped" : "Equip");
  b.disabled = equipped;
  b.onclick = async () => {
    try {
      const r = await api("/api/actions", { type: "equip", item: item.id });
      notice(r.message);
    } catch (e) {
      uiError(e.message);
    }
  };
  $("item-detail").append(b);
}
$("bag-search").oninput = () => {
  bagFingerprint = "";
  updateBag();
};
function showConversation(data) {
  dialogueNpc = data.npc;
  $("npc-role").textContent = data.npc.role;
  $("npc-name").textContent = data.npc.name;
  $("npc-text").textContent = data.npc.text;
  $("npc-trade").hidden = !data.npc.merchant;
  $("npc-trade").onclick = () => {
    $("dialogue").close();
    services.open("buy", data.npc.id);
  };
  $("quest-action").hidden = !data.quest && !data.npc.registrar;
  $("npc-quest").textContent = "";
  if (data.npc.registrar) {
    const c = state.self.charter;
    $("quest-action").textContent = state.self.guildInfo
      ? "View your guild"
      : c
        ? c.signatures.length >= c.needed
          ? "Found your guild"
          : `Charter · ${c.signatures.length}/${c.needed} signatures`
        : "Buy a guild charter";
    $("quest-action").disabled = false;
  }
  if (data.quest) {
    $("npc-quest").textContent =
      `${data.quest.name} · ${data.progress.progress} / ${data.quest.required} · Reward ${data.quest.reward} gold + ${data.quest.xp ?? 60} XP`;
    $("quest-action").textContent =
      data.progress.status === "offered"
        ? "Accept quest"
        : data.progress.status === "ready"
          ? "Complete quest"
          : data.progress.status === "complete"
            ? "Already completed"
            : "Quest in progress";
    $("quest-action").disabled = !["offered", "ready"].includes(
      data.progress.status,
    );
  }
  if (!$("dialogue").open) $("dialogue").showModal();
}
$("quest-action").onclick = async () => {
  if (!dialogueNpc) return;
  if (dialogueNpc.registrar) {
    $("dialogue").close();
    guildUi.open(true);
    return;
  }
  try {
    const q = state.self.quests[dialogueNpc.quest];
    await api("/api/actions", {
      type: "quest",
      quest: dialogueNpc.quest,
      operation: q.status === "offered" ? "accept" : "complete",
    });
    $("dialogue").close();
    notice(
      q.status === "offered"
        ? "Quest accepted. Objectives are in the Stillwood."
        : "Quest complete. Gold and experience received.",
    );
  } catch (e) {
    uiError(e.message);
  }
};
$("dialogue-close").onclick = () => $("dialogue").close();
$("dialogue").addEventListener("close", () => {
  keys.clear();
  canvas.focus();
});
$("bag-toggle").onclick = toggleBag;
$("bag-close").onclick = toggleBag;
function queueInteraction(command) {
  services.close();
  hud.close();
  $("bag").hidden = true;
  $("character-sheet").hidden = true;
  interaction = { ...command };
  queuedAbility = null;
  keys.clear();
  canvas.focus();
  if (command.type === "gather")
    notice("Starleaf selected · moving within gathering reach…");
}
function interactNearest() {
  if (!state) return;
  queuedAbility = null;
  keys.clear();
  const options = [
    ...state.npcs.map((n) => ({ ...n, type: "talk" })),
    ...state.resources
      .filter((r) => r.available)
      .map((r) => ({ ...r, type: "gather" })),
    ...state.loot.map((l) => ({ ...l, type: "loot" })),
    ...(state.portals ?? []).map((pt) => ({ ...pt, type: pt.type })),
  ].sort(
    (a, b) =>
      Math.hypot(a.x - state.self.x, a.z - state.self.z) -
      Math.hypot(b.x - state.self.x, b.z - state.self.z),
  );
  if (options[0])
    queueInteraction({ type: options[0].type, target: options[0].id });
}
$("interact").onclick = interactNearest;
async function automaticIntent() {
  const zero = { x: 0, z: 0 };
  if (actionBusy || !state) return zero;
  if (state.self.casting || state.self.dead) return zero;
  if (queuedAttack && !queuedAbility) {
    const e = state.enemies.find((e) => e.id === queuedAttack && e.hp > 0);
    if (!e) {
      queuedAttack = null;
      return zero;
    }
    const intent = approach(state.self, e, 2.6);
    if (!intent.ready) return intent;
    queuedAttack = null;
    actionBusy = true;
    try {
      await api("/api/actions", { type: "input", x: 0, z: 0 });
      lastInput = "0,0";
      await api("/api/actions", { type: "autoattack", target: e.id });
    } catch (e) {
      uiError(e.message);
    } finally {
      actionBusy = false;
    }
    return zero;
  }
  if (queuedAbility) {
    const a = queuedAbility,
      e = state.enemies.find((e) => e.id === selected && e.hp > 0);
    if (a.multiplier && !e) {
      queuedAbility = null;
      return zero;
    }
    if (state.self.power < a.cost) {
      uiError(`Not enough ${state.classes[state.self.classId].resource.toLowerCase()}.`);
      queuedAbility = null;
      return zero;
    }
    const intent = a.multiplier
      ? approach(state.self, e, Math.max(0.5, a.range - 0.6))
      : { ...zero, ready: true };
    if (!intent.ready) return intent;
    if (state.serverTime < (state.self.globalReadyAt ?? 0)) return zero;
    if (
      state.serverTime - (state.self.cooldowns[a.id] ?? -Infinity) <
      a.cooldown
    )
      return zero;
    queuedAbility = null;
    actionBusy = true;
    try {
      await api("/api/actions", { type: "input", x: 0, z: 0 });
      lastInput = "0,0";
      await api("/api/actions", {
        type: "ability",
        ability: a.id,
        target: e?.id,
      });
    } catch (e) {
      uiError(e.message);
    } finally {
      actionBusy = false;
    }
    return zero;
  }
  if (interaction) {
    const command = interaction,
      target = (
        command.type === "talk"
          ? state.npcs
          : command.type === "gather"
            ? state.resources
            : command.type === "enter" || command.type === "exit"
              ? state.portals ?? []
              : state.loot
      ).find((x) => x.id === command.target);
    if (!target || (command.type === "gather" && !target.available)) {
      if (command.type === "gather")
        notice("That patch was gathered. Look for another Starleaf plant.");
      interaction = null;
      return zero;
    }
    const intent = approach(state.self, target, 2.7);
    if (!intent.ready) return intent;
    interaction = null;
    actionBusy = true;
    try {
      const r = await api("/api/actions", command);
      if (command.type === "talk") showConversation(r);
      else notice(r.message);
    } catch (e) {
      uiError(e.message);
    } finally {
      actionBusy = false;
    }
    return zero;
  }
  return zero;
}
function showEvents() {
  for (const event of state.events ?? []) {
    const key = `${state.chatEpoch}:${event.id}`;
    if (seenEvents.has(key)) continue;
    seenEvents.add(key);
    if (seenEvents.size > 200)
      seenEvents.delete(seenEvents.values().next().value);
    if (event.kind === "hit") {
      // A creature strikes a player: creature attack animation, player flinch.
      const mob = enemyModels.get(event.from),
        victim = playerModels.get(event.to);
      if (mob) {
        mob.userData.rig?.attack();
        if (victim) mob.userData.attackTarget = { x: victim.position.x, z: victim.position.z };
        mob.userData.attackUntil = clock.elapsedTime + 0.5;
      }
      victim?.userData.rig?.hit();
      continue;
    }
    const from = event.kind === "strike" ? playerModels.get(event.from) : null;
    if (from) {
      from.userData.attackUntil = clock.elapsedTime + (event.swing ? 0.5 : 0.7);
      from.userData.attackTarget = { x: event.x, z: event.z };
      const rig = from.userData.rig,
        ability = state.abilities.find((a) => a.id === event.ability);
      if (rig) {
        if (event.swing) rig.attack();
        else if (ability?.castTime) rig.play("castRelease");
        else if (ability && ability.range > 4) rig.play("castInstant");
        else rig.attack();
      }
    }
    if (event.kind !== "strike") continue;
    const struck = enemyModels.get(event.target);
    if (struck) {
      struck.userData.hitAt = clock.elapsedTime;
      struck.userData.rig?.hit();
    }
    if (
      from &&
      !event.swing &&
      Math.hypot(from.position.x - event.x, from.position.z - event.z) > 4
    ) {
      const orb = mesh(new THREE.SphereGeometry(0.16, 10, 8), "#ddb184");
      orb.material = new THREE.MeshBasicMaterial({
        color:
          state.classes[state.players.find((q) => q.id === event.from)?.classId]
            ?.color ?? "#ddb184",
      });
      orb.position.copy(from.position).add(new THREE.Vector3(0, 1.5, 0));
      effects.push({
        object: orb,
        started: clock.elapsedTime,
        kind: "bolt",
        from: orb.position.clone(),
        to: new THREE.Vector3(event.x, height(event.x, event.z) + 0.8, event.z),
      });
    }
  }
}
function animateEffects(t, dt) {
  for (let i = effects.length - 1; i >= 0; i--) {
    const e = effects[i],
      age = t - e.started;
    if (age > 1) {
      scene.remove(e.object);
      e.object.material?.map?.dispose();
      e.object.material?.dispose();
      e.object.geometry?.dispose();
      effects.splice(i, 1);
      continue;
    }
    if (e.kind === "damage") {
      e.object.position.y += dt * 0.7;
      e.object.material.opacity = 1 - age;
    } else e.object.position.lerpVectors(e.from, e.to, Math.min(1, age * 3));
  }
}

function updateModels() {
  switchZone(state.self.instance ?? null);
  for (const [models, items, create] of [
    [playerModels, state.players, avatar],
    [enemyModels, state.enemies.filter((e) => e.hp > 0), enemy],
    [npcModels, state.npcs, npcModel],
    [resourceModels, state.resources.filter((r) => r.available), resourceModel],
    [lootModels, state.loot, lootModel],
    [portalModels, state.portals ?? [], portalModel],
    [telegraphModels, state.telegraphs ?? [], telegraphModel],
  ]) {
    const ids = new Set(items.map((e) => e.id));
    for (const [id, g] of models)
      if (!ids.has(id) && models === enemyModels && state.enemies.some((e) => e.id === id && e.hp <= 0)) {
        g.userData.rig?.die();
        corpses.push({ g, started: clock.elapsedTime });
        models.delete(id);
        if (selected === id) selected = null;
      } else if (!ids.has(id)) {
        scene.remove(g);
        g.traverse((o) => {
          if (o.material?.map) {
            o.material.map.dispose();
            o.material.dispose();
          }
          o.geometry?.dispose();
        });
        models.delete(id);
      }
    for (const item of items) {
      let g = models.get(item.id);
      if (!g) {
        g = create(item);
        g.position.set(item.x, height(item.x, item.z), item.z);
        if (models === playerModels && item.id !== state.self.id)
          g.userData.interaction = { type: "player", target: item.id, name: item.name };
        models.set(item.id, g);
      }
      g.userData.target = { x: item.x, z: item.z };
      if (models === playerModels && g.userData.guildName !== (item.guild ?? null)) {
        g.userData.guildName = item.guild ?? null;
        const old = g.userData.nameTag,
          tag = playerTag(item);
        tag.position.y = (old?.position.y ?? 2.25) + (item.guild ? 0.1 : 0) - (old?.userData.twoLine ? 0.1 : 0);
        if (old) {
          g.remove(old);
          old.material.map?.dispose();
          old.material.dispose();
        }
        tag.visible = item.id !== state.self.id;
        g.add(tag);
        g.userData.nameTag = tag;
      }
      if (item.appearance) {
        if (g.userData.rig) {
          const key = JSON.stringify(item.appearance);
          if (g.userData.gearKey !== key) {
            g.userData.gearKey = key;
            g.userData.rig.setGear(item.appearance);
          }
        } else applyEquipment(g, item.appearance);
      }
      g.userData.casting = !!item.casting;
      g.userData.sitting = !!item.sitting;
      g.userData.dead = !!item.dead;
    }
  }
  for (const n of state.npcs) {
    const g = npcModels.get(n.id),
      status = state.self.quests[n.quest]?.status ?? "merchant";
    if (g.userData.questStatus === status) continue;
    const old = g.userData.questMarker;
    if (old) {
      g.remove(old);
      old.material.map.dispose();
      old.material.dispose();
    }
    const info =
      status === "merchant"
        ? { symbol: "¤", label: "Merchant", color: "#e4c473" }
        : questMarker(status);
    g.userData.questStatus = status;
    g.userData.questMarker = null;
    if (info.symbol && status !== "merchant") {
      // A large floating ! or ? above quest givers.
      const m = questGlyph(info.symbol, info.color);
      m.position.y = 3.15;
      g.add(m);
      g.userData.questMarker = m;
    }
  }
  services.update();
  const p = state.self;
  $("player-name").textContent = p.name;
  $("player-faction").textContent =
    p.faction === "dawnward"
      ? "Dawnward · Ember tongue"
      : "Mossbound · Grove tongue";
  $("chat-language").textContent =
    p.faction === "dawnward" ? "Ember tongue" : "Grove tongue";
  $("health-bar").style.width = `${(p.hp / p.stats.maxHp) * 100}%`;
  $("health-text").textContent = `${Math.ceil(p.hp)} / ${p.stats.maxHp}`;
  $("coins").textContent = `${p.coins} gold`;
  $("class-stats").textContent =
    `Level ${p.level} ${state.classes[p.classId].name} · ${p.stats.damage} damage · ${p.stats.armor} armor`;
  $("power-bar").style.width = `${p.power}%`;
  $("power-text").textContent =
    `${Math.floor(p.power)} / 100 ${state.classes[p.classId].resource}`;
  $("xp-bar").style.width = `${(p.xp / p.xpNeeded) * 100}%`;
  $("xp-text").textContent = `${p.xp} / ${p.xpNeeded} XP`;
  combatUi.update(state);
  guildUi.update(state);
  if (state.self.dead) {
    queuedAbility = queuedAttack = interaction = null;
    autorun = false;
  }
  const own = playerModels.get(state.self.id)?.userData.nameTag;
  if (own) own.visible = false;
  updateQuests();
  updateBag();
  character.update();
  updateHotbar();
  hud.update();
  showEvents();
  if (state.messages.length) {
    $("messages").querySelector(".chat-hint")?.remove();
    for (const m of state.messages) {
      after = Math.max(after, m.id);
      const line = document.createElement("p");
      line.className = m.channel;
      const author = document.createElement("span");
      author.className = "message-author";
      author.textContent =
        m.channel === "system"
          ? ""
          : `[${{ nearby: "Say", party: "Party", faction: "Faction", guild: "Guild", officer: "Officer" }[m.channel] ?? "Whisper"}${m.to ? ` → ${m.to}` : ""}] ${m.from}: `;
      line.append(author, document.createTextNode(m.text));
      $("messages").append(line);
    }
    while ($("messages").children.length > 80)
      $("messages").firstChild.remove();
    $("messages").scrollTop = $("messages").scrollHeight;
  }
}
async function poll() {
  if (!playing) return;
  const epoch = playEpoch;
  try {
    const incoming = await api(`/api/state?after=${after}`);
    if (epoch !== playEpoch || !playing) return;
    state = incoming;
    if (chatEpoch && chatEpoch !== state.chatEpoch) after = 0;
    chatEpoch = state.chatEpoch;
    updateModels();
    $("connection").textContent =
      `${state.players.length} adventurer${state.players.length === 1 ? "" : "s"} in the clearing · Connected`;
    if ($("chat-status").textContent.startsWith("Connection"))
      $("chat-status").textContent = "Connection restored.";
  } catch (e) {
    if (e.status === 401) {
      accounts.roster();
      return;
    }
    keys.clear();
    $("connection").textContent = "Connection lost · Reconnecting…";
    $("chat-status").textContent =
      "Connection lost. Messages cannot be sent yet.";
  }
  if (playing) pollTimer = setTimeout(poll, 140);
}
async function begin(key) {
  token = key;
  const epoch = ++playEpoch;
  clearTimeout(pollTimer);
  clearInterval(inputTimer);
  try {
    const incoming = await api("/api/state");
    await charactersReady;
    if (epoch !== playEpoch) return;
    state = incoming;
    sessionStorage.setItem("hearthwild-character", token);
    playing = true;
    after = 0;
    chatEpoch = state.chatEpoch;
    $("entry").hidden = true;
    document.body.classList.add("in-world");
    $("hud").hidden = false;
    updateModels();
    yaw = 0.2;
    heading = yaw;
    poll();
    inputTimer = setInterval(sendInput, 100);
    canvas.focus();
  } catch (e) {
    $("roster-error").textContent = e.message;
  }
}
function leaveWorld() {
  hud.close();
  services.close();
  if (menu.isOpen()) menu.close();
  $("bag").hidden = true;
  $("character-sheet").hidden = true;
  $("dialogue").close();
  document.body.classList.remove("chat-open", "objectives-open");
  selected = null;
  lastInput = "";
  bagFingerprint = "";
  questFingerprint = "";
  playEpoch++;
  playing = false;
  clearTimeout(pollTimer);
  clearInterval(inputTimer);
  keys.clear();
  queuedAbility = null;
  queuedAttack = null;
  autorun = false;
  interaction = null;
  combatUi.reset();
  if (state) api("/api/actions", { type: "leave" }).catch(() => {});
  $("hud").hidden = true;
  document.body.classList.remove("in-world");
  $("entry").hidden = false;
  state = null;
}
$("leave").onclick = leaveWorld;
$("channel").onchange = () => {
  $("whisper-to").hidden = $("channel").value !== "whisper";
  $("chat-status").textContent =
    $("channel").value === "whisper"
      ? "Private · An online adventurer of your faction only"
      : "Same faction only · Nearby reaches 18 paces";
};
// MMO slash commands: /invite, /leave, /kick, /promote, /p, /w, /s.
async function slashCommand(text) {
  const [cmd, ...rest] = text.slice(1).trim().split(/\s+/),
    arg = rest.join(" "),
    c = cmd.toLowerCase();
  if (["invite", "inv"].includes(c)) return partyAction({ op: "invite", name: arg });
  if (["leave", "leaveparty", "leavegroup"].includes(c)) return partyAction({ op: "leave" });
  if (["kick", "uninvite"].includes(c)) return partyAction({ op: "kick", name: arg });
  if (["promote", "pl"].includes(c)) return partyAction({ op: "promote", name: arg });
  const send = (channel, body, to) =>
    api("/api/actions", { type: "chat", channel, text: body, to }).catch((e) => uiError(e.message));
  if (["p", "party"].includes(c)) return send("party", arg);
  if (["g", "guild"].includes(c)) return send("guild", arg);
  if (["o", "officer"].includes(c)) return send("officer", arg);
  const guildOps = { ginvite: "invite", gkick: "kick", gremove: "kick", gpromote: "promote", gdemote: "demote", gleader: "leader" };
  if (guildOps[c]) return guildAction({ op: guildOps[c], name: arg });
  if (["gquit", "gleave"].includes(c)) return guildAction({ op: "leave" });
  if (c === "gmotd") return guildAction({ op: "motd", text: arg });
  if (["groster", "guildroster"].includes(c)) return guildUi.open();
  if (["s", "say"].includes(c)) return send("nearby", arg);
  if (["f", "faction"].includes(c)) return send("faction", arg);
  if (["w", "whisper", "tell", "t"].includes(c)) return send("whisper", rest.slice(1).join(" "), rest[0]);
  uiError(`Unknown command /${cmd}. Try /invite, /leave, /p, /g, /o, /ginvite, /w or /s.`);
}
$("chat-form").onsubmit = async (e) => {
  e.preventDefault();
  const text = $("chat-text").value;
  if (!text.trim()) return;
  if (text.trim().startsWith("/")) {
    $("chat-text").value = "";
    await slashCommand(text.trim());
    return;
  }
  try {
    await api("/api/actions", {
      type: "chat",
      channel: $("channel").value,
      text,
      to: $("whisper-to").value,
    });
    $("chat-text").value = "";
    $("chat-status").textContent = "Message sent.";
  } catch (e) {
    $("chat-status").textContent = e.message;
  }
};
function nearest() {
  return state?.enemies
    .filter((e) => e.hp > 0)
    .sort(
      (a, b) =>
        Math.hypot(a.x - state.self.x, a.z - state.self.z) -
        Math.hypot(b.x - state.self.x, b.z - state.self.z),
    )[0];
}
function targetNext() {
  if (!state) return;
  // Tab cycles nearby enemies, preferring those in front of the camera.
  const fx = -Math.sin(yaw),
    fz = -Math.cos(yaw),
    score = (e) => {
      const dx = e.x - state.self.x,
        dz = e.z - state.self.z,
        d = Math.hypot(dx, dz),
        ahead = (dx * fx + dz * fz) / Math.max(d, 0.001);
      return d + (ahead < 0.2 ? 40 : 0);
    };
  const alive = state.enemies
    .filter((e) => e.hp > 0 && Math.hypot(e.x - state.self.x, e.z - state.self.z) < 40)
    .sort((a, b) => score(a) - score(b));
  selected =
    alive[(alive.findIndex((e) => e.id === selected) + 1) % alive.length]?.id;
}
const QUICK_SLOTS = {
  5: { kind: "potion", icon: "healing-draught", title: "Healing draught · drink your best draught (6)" },
  6: { kind: "food", icon: "travelers-bread", title: "Eat · sit and restore health out of combat (7)" },
  7: { kind: "drink", icon: "spring-water", title: "Drink · sit and restore mana out of combat (8)" },
};
function flashSlot(slot) {
  const b = $("hotbar").children[slot];
  if (!b) return;
  b.classList.add("pressed");
  setTimeout(() => b.classList.remove("pressed"), 140);
}
function toggleAutoAttack() {
  if (!state || !playing) return;
  flashSlot(4);
  if (state.self.autoAttack) {
    queuedAttack = null;
    api("/api/actions", { type: "autoattack", stop: true }).catch((e) => uiError(e.message));
    return;
  }
  if (!state.enemies.some((e) => e.id === selected && e.hp > 0)) selected = nearest()?.id;
  if (!selected) {
    uiError("You have no target.");
    return;
  }
  startAttack(selected);
}
function startAttack(id) {
  selected = id;
  interaction = null;
  queuedAbility = null;
  queuedAttack = id;
  keys.clear();
  canvas.focus();
}
// A small context menu for other adventurers: invite or whisper.
const playerMenu = document.createElement("div");
playerMenu.className = "cui-menu";
playerMenu.hidden = true;
document.body.append(playerMenu);
addEventListener("pointerdown", (e) => {
  if (!playerMenu.contains(e.target)) playerMenu.hidden = true;
});
function showPlayerMenu(who, x, y) {
  playerMenu.replaceChildren();
  const title = document.createElement("strong");
  title.textContent = who.name;
  const item = (text, fn) => {
    const b = document.createElement("button");
    b.textContent = text;
    b.onclick = () => {
      playerMenu.hidden = true;
      fn();
    };
    playerMenu.append(b);
  };
  playerMenu.append(title);
  item("Invite to group", () => partyAction({ op: "invite", name: who.name }));
  if ((state?.self.guildInfo?.rank ?? 9) <= 1)
    item("Invite to guild", () => guildAction({ op: "invite", name: who.name }));
  if (state?.self.charter && !state.self.guildInfo)
    item("Ask to sign charter", () => guildAction({ op: "request-signature", name: who.name }));
  item("Whisper", () => {
    $("channel").value = "whisper";
    $("channel").onchange();
    $("whisper-to").value = who.name;
    $("chat-text").focus();
  });
  Object.assign(playerMenu.style, { left: `${x}px`, top: `${y}px` });
  playerMenu.hidden = false;
}
async function guildAction(a) {
  try {
    const r = await api("/api/actions", { type: "guild", ...a });
    if (r?.message) combatUi.info(r.message);
  } catch (e) {
    uiError(e.message);
  }
}
async function partyAction(a) {
  try {
    const r = await api("/api/actions", { type: "party", ...a });
    if (r.message) combatUi.info(r.message);
  } catch (e) {
    uiError(e.message);
  }
}
function closePanels() {
  let closed = false;
  if (!$("bag").hidden) ($("bag").hidden = true), (closed = true);
  if (!$("character-sheet").hidden) ($("character-sheet").hidden = true), (closed = true);
  if (hud.isOpen()) hud.close(), (closed = true);
  if (services.isOpen()) services.close(), (closed = true);
  if ($("dialogue").open) $("dialogue").close(), (closed = true);
  if (typeof guildUi !== "undefined" && guildUi.isOpen()) guildUi.close(), (closed = true);
  return closed;
}
function useAbility(key) {
  if (!state || !playing) return;
  const ability = state.abilities.find((a) => a.key === key);
  if (!ability) return;
  flashSlot(key - 1);
  if (state.self.dead) {
    uiError("You are dead.");
    return;
  }
  if (state.self.level < ability.level) {
    uiError(`Requires level ${ability.level}.`);
    return;
  }
  if (ability.multiplier) {
    const living = state.enemies.find((e) => e.id === selected && e.hp > 0);
    if (!living) selected = nearest()?.id;
    if (!selected) {
      uiError("You have no target.");
      return;
    }
  }
  $("bag").hidden = true;
  $("character-sheet").hidden = true;
  services.close();
  hud.close();
  interaction = null;
  queuedAbility = ability;
  keys.clear();
  canvas.focus();
}
const typing = () =>
  ["INPUT", "SELECT", "TEXTAREA", "SUMMARY"].includes(
    document.activeElement?.tagName,
  );
addEventListener("keydown", (e) => {
  if (!playing) return;
  if (e.key === "Escape") {
    e.preventDefault();
    if (menu.isOpen()) menu.toggle();
    else if (typing()) document.activeElement.blur();
    else if (closePanels()) canvas.focus();
    else if (queuedAbility || queuedAttack || interaction) {
      queuedAbility = queuedAttack = interaction = null;
    } else if (selected) selected = null;
    else menu.toggle();
    return;
  }
  if (menu.isOpen()) return;
  if ($("dialogue").open) return;
  if (services.isOpen() && e.code !== "KeyK") return;
  if (typing()) return;
  if (
    hud.isOpen() &&
    !["KeyM", "KeyL", "KeyP", "KeyB", "KeyC", "KeyI"].includes(e.code)
  )
    return;
  if (e.key === "Enter") {
    e.preventDefault();
    keys.clear();
    $("chat-text").focus();
    return;
  }
  if (e.key === "Tab") {
    e.preventDefault();
    targetNext();
    return;
  }
  if (/^Digit[1-4]$/.test(e.code) && !e.repeat)
    useAbility(Number(e.code.slice(-1)));
  if (e.code === "Digit5" && !e.repeat) toggleAutoAttack();
  if (/^Digit[678]$/.test(e.code) && !e.repeat) {
    const slot = Number(e.code.slice(-1)) - 1;
    flashSlot(slot);
    useConsumable(QUICK_SLOTS[slot].kind);
  }
  if (e.code === "Space" && !e.repeat) {
    e.preventDefault();
    if (clock.elapsedTime - jumpStart > 0.75) {
      jumpStart = clock.elapsedTime;
      playerModels.get(state?.self.id)?.userData.rig?.play("jump", { speed: 1.4 });
    }
  }
  if ((e.code === "NumLock" || e.code === "KeyR") && !e.repeat) {
    e.preventDefault();
    autorun = !autorun;
    queuedAbility = queuedAttack = interaction = null;
  }
  if (e.code === "KeyK" && !e.repeat) {
    e.preventDefault();
    if (services.isOpen()) services.close();
    else services.open("professions");
    return;
  }
  if (e.code === "KeyV" && !e.repeat) {
    e.preventDefault();
    setCamera({
      mode:
        cameraMode === "orbit"
          ? "follow"
          : cameraMode === "follow"
            ? "first"
            : "orbit",
    });
    return;
  }
  if (e.code === "KeyF" && !e.repeat) interactNearest();
  if (["KeyI", "KeyB"].includes(e.code) && !e.repeat) {
    e.preventDefault();
    toggleBag();
  }
  if (e.code === "KeyJ" && !e.repeat) {
    e.preventDefault();
    guildUi.toggle();
  }
  if (e.code === "KeyC" && !e.repeat) {
    e.preventDefault();
    character.toggle();
  }
  if (e.code === "KeyM" && !e.repeat) {
    e.preventDefault();
    if (!$("atlas").hidden && !$("atlas").classList.contains("journal-mode"))
      hud.close();
    else hud.openMap();
  }
  if (e.code === "KeyL" && !e.repeat) {
    e.preventDefault();
    if (!$("atlas").hidden && $("atlas").classList.contains("journal-mode"))
      hud.close();
    else hud.openMap("journal");
  }
  if (e.code === "KeyP" && !e.repeat) {
    e.preventDefault();
    hud.spells();
  }
  if (
    [
      "KeyW",
      "KeyA",
      "KeyS",
      "KeyD",
      "KeyQ",
      "KeyE",
      "ArrowUp",
      "ArrowDown",
      "ArrowLeft",
      "ArrowRight",
    ].includes(e.code)
  ) {
    e.preventDefault();
    keys.add(e.code);
    queuedAbility = null;
    queuedAttack = null;
    interaction = null;
    if (["KeyW", "KeyS", "ArrowUp", "ArrowDown"].includes(e.code)) autorun = false;
  }
});
addEventListener("keyup", (e) => keys.delete(e.code));
addEventListener("blur", () => keys.clear());
document.addEventListener("visibilitychange", () => {
  if (document.hidden) keys.clear();
});
document.addEventListener("focusin", () => {
  if (typing()) keys.clear();
});
// Classic MMO keys: W/S move along your facing, A/D and arrows turn, Q/E strafe.
// Holding the right mouse button makes A/D strafe and turns you to face the camera.
const steering = () => (mouseButtons & 2) !== 0;
function moveKeys() {
  const steer = steering();
  return {
    forward: keys.has("KeyW") || keys.has("ArrowUp") || autorun || (mouseButtons & 3) === 3,
    back: keys.has("KeyS") || keys.has("ArrowDown"),
    strafeLeft: keys.has("KeyQ") || (steer && keys.has("KeyA")),
    strafeRight: keys.has("KeyE") || (steer && keys.has("KeyD")),
    turnLeft: keys.has("ArrowLeft") || (!steer && keys.has("KeyA")),
    turnRight: keys.has("ArrowRight") || (!steer && keys.has("KeyD")),
  };
}
async function sendInput() {
  if (!playing || inputBusy) return;
  const m = moveKeys(),
    dx = Number(m.strafeRight) - Number(m.strafeLeft),
    dz = Number(m.back) - Number(m.forward);
  let { x, z } = movementVector(dx, dz, heading),
    fingerprint = `${x},${z}`;
  if (menu.isOpen() || services.isOpen() || $("dialogue").open || state?.self.dead) {
    x = z = 0;
    fingerprint = "0,0";
  }
  if (
    !dx &&
    !dz &&
    !typing() &&
    !$("dialogue").open &&
    !hud.isOpen() &&
    !menu.isOpen() &&
    !services.isOpen() &&
    $("character-sheet").hidden &&
    $("bag").hidden
  ) {
    const intent = await automaticIntent();
    x = intent.x;
    z = intent.z;
    fingerprint = `${x},${z}`;
  }
  if (!x && !z && lastInput === fingerprint) return;
  inputBusy = true;
  try {
    await api("/api/actions", {
      type: "input",
      x: Math.max(-1, Math.min(1, x)),
      z: Math.max(-1, Math.min(1, z)),
    });
    lastInput = fingerprint;
  } catch {
  } finally {
    inputBusy = false;
  }
}
let dragging = false,
  moved = false,
  lastX = 0,
  lastY = 0,
  dragButton = 0,
  pointerStart = null;
function pick(clientX, clientY) {
  const point = new THREE.Vector2(
      (clientX / innerWidth) * 2 - 1,
      (-clientY / innerHeight) * 2 + 1,
    ),
    ray = new THREE.Raycaster();
  ray.setFromCamera(point, camera);
  return pickWorldTarget(
    ray.intersectObjects(
      [
        ...enemyModels.values(),
        ...npcModels.values(),
        ...resourceModels.values(),
        ...lootModels.values(),
        ...portalModels.values(),
        ...[...playerModels.entries()].filter(([id]) => id !== state?.self.id).map(([, g]) => g),
      ],
      true,
    ),
  );
}
let hoverAt = 0;
canvas.addEventListener("pointermove", (e) => {
  mouseButtons = e.buttons;
  if (dragging || !playing || performance.now() - hoverAt < 80) return;
  hoverAt = performance.now();
  const g = pick(e.clientX, e.clientY);
  const kind = g?.userData.interaction?.type;
  canvas.className = g?.userData.enemy
    ? "cursor-attack"
    : kind === "player" || kind === "enter" || kind === "exit"
      ? "cursor-talk"
      : kind
        ? `cursor-${kind}`
        : "";
});
canvas.addEventListener("pointerdown", (e) => {
  mouseButtons = e.buttons;
  if (dragging) return;
  dragging = true;
  moved = false;
  lastX = e.clientX;
  lastY = e.clientY;
  dragButton = e.button;
  pointerStart = { x: e.clientX, y: e.clientY };
  canvas.setPointerCapture(e.pointerId);
  document.activeElement.blur();
});
canvas.addEventListener("pointermove", (e) => {
  if (dragging) {
    const delta = e.clientX - lastX;
    if (!pointerIsClick(pointerStart, { x: e.clientX, y: e.clientY }))
      moved = true;
    if (moved) {
      yaw -= delta * mouseSensitivity;
      cameraPitch = Math.max(
        cameraMode === "first" ? -1.1 : 0.12,
        Math.min(1.25, cameraPitch + (e.clientY - lastY) * mouseSensitivity),
      );
      cameraHoldUntil = clock.elapsedTime + 2;
      lookTurning = dragButton === 2;
    }
    lastY = e.clientY;
    lastX = e.clientX;
  }
});
canvas.addEventListener("pointerup", (e) => {
  const wasChord = (mouseButtons & 3) === 3;
  mouseButtons = e.buttons;
  if (e.buttons) return;
  dragging = false;
  lookTurning = false;
  if (
    !wasChord &&
    [0, 2].includes(e.button) &&
    !moved &&
    pointerIsClick(pointerStart, { x: e.clientX, y: e.clientY }) &&
    playing &&
    !state?.self.dead
  ) {
    const g = pick(e.clientX, e.clientY);
    if (g?.userData.enemy) {
      selected = g.userData.enemy;
      // Right-click attacks: approach to melee range and start auto-attack.
      if (e.button === 2) startAttack(selected);
    } else if (g?.userData.interaction?.type === "player")
      showPlayerMenu(g.userData.interaction, e.clientX, e.clientY);
    else if (g?.userData.interaction)
      queueInteraction(g.userData.interaction);
    else if (e.button === 0) selected = null;
  }
});
canvas.addEventListener("pointercancel", () => {
  dragging = false;
  lookTurning = false;
});
canvas.addEventListener("contextmenu", (e) => e.preventDefault());
canvas.addEventListener(
  "wheel",
  (e) => {
    if (cameraMode === "first") {
      camera.fov = Math.max(50, Math.min(85, camera.fov + e.deltaY * 0.02));
      camera.updateProjectionMatrix();
    } else zoom = Math.max(3, Math.min(currentZone ? 9 : 30, zoom + e.deltaY * 0.015));
  },
  { passive: true },
);
function resize() {
  renderer.setSize(innerWidth, innerHeight, false);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
}
addEventListener("resize", resize);
resize();
const cameraRay = new THREE.Raycaster(),
  cameraAim = new THREE.Vector3(),
  cameraDelta = new THREE.Vector3();
let cameraCollision = Infinity,
  lastCollisionAt = -1;
const clock = new THREE.Clock(),
  look = new THREE.Vector3(0, 1, 0);
function render() {
  requestAnimationFrame(render);
  const dt = Math.min(clock.getDelta(), 0.1),
    t = clock.elapsedTime;
  scenery.update(t, state && !state.self.instance ? state.self : null, camera);
  dungeon.update(t, playing && state ? playerModels.get(state.self.id)?.position : null);
  const serverNowMs = combatUi.serverNow();
  for (const g of telegraphModels.values()) {
    const left = Math.max(0, g.userData.explodeAt - serverNowMs),
      k = 1 - left / 2600;
    g.userData.fill.scale.setScalar(Math.max(0.05, k));
    g.userData.fill.material.opacity = 0.22 + k * 0.3 + Math.sin(t * 18) * 0.05;
  }
  for (const g of portalModels.values())
    if (g.userData.glow) g.userData.glow.material.opacity = 0.28 + Math.sin(t * 2.2) * 0.1;
  animateEffects(t, dt);
  animateCorpses(t);
  for (const g of npcModels.values()) g.userData.rig?.update(dt, {});
  for (const models of [playerModels, enemyModels])
    for (const g of models.values()) {
      const p = g.userData.target;
      if (!p) continue;
      const dx = p.x - g.position.x,
        dz = p.z - g.position.z;
      g.position.x += dx * Math.min(1, dt * 14);
      g.position.z += dz * Math.min(1, dt * 14);
      const rig = g.userData.rig,
        moving = Math.hypot(dx, dz) > 0.02,
        own = g === playerModels.get(state?.self.id);
      g.position.y =
        height(g.position.x, g.position.z) +
        (moving && !rig ? Math.sin(t * 12) * 0.05 : 0);
      if (g.userData.cape)
        g.userData.cape.rotation.x =
          0.08 + Math.sin(t * 3 + g.position.x) * 0.05 + (moving ? 0.2 : 0);
      // Your own character faces the camera while you steer with the keys, so
      // S backpedals and A/D strafe; everyone else turns toward where they're heading.
      let dir = "forward",
        facing = null;
      const mk = own ? moveKeys() : null;
      if (own && rig && mk && Object.values(mk).some(Boolean)) {
        facing = heading + Math.PI;
        dir = mk.forward ? "forward" : mk.back ? "back" : mk.strafeLeft ? "left" : mk.strafeRight ? "right" : "forward";
      } else if (moving) facing = Math.atan2(dx, dz);
      if (t < (g.userData.attackUntil ?? 0) && g.userData.attackTarget)
        facing = facingAngle(g.position, g.userData.attackTarget);
      if (facing !== null) {
        if (rig) {
          const delta = Math.atan2(Math.sin(facing - g.rotation.y), Math.cos(facing - g.rotation.y));
          g.rotation.y += delta * Math.min(1, dt * 12);
        } else g.rotation.y = facing;
      }
      if (rig) {
        if (g.userData.dead) rig.die();
        else if (g.userData.wasDead) rig.revive();
        g.userData.wasDead = g.userData.dead;
        const e = models === enemyModels ? state?.enemies.find((x) => x.id === g.userData.enemy) : null;
        rig.update(dt, {
          moving,
          dir,
          casting: own ? !!state.self.casting : g.userData.casting,
          sitting: own ? !!state.self.eating : g.userData.sitting,
          combat: own ? !!state.self.inCombat || !!state.self.autoAttack : !!e?.engaged,
        });
      }
      const hitAge = t - (g.userData.hitAt ?? -9);
      if (hitAge < 0.25) g.scale.setScalar(1 + Math.sin(hitAge * 25) * 0.06);
      else if (g.scale.x !== 1) g.scale.setScalar(1);
      if (g === playerModels.get(state?.self.id)) {
        const jt = t - jumpStart;
        if (jt < 0.7) g.position.y += Math.sin((jt / 0.7) * Math.PI) * 1.1;
        const target = state.enemies.find(
          (e) => e.id === (state.self.casting?.target ?? selected) && e.hp > 0,
        );
        if (target && (queuedAbility?.multiplier || state.self.casting))
          g.rotation.y = facingAngle(g.position, target);
        else if (lookTurning) g.rotation.y = yaw + Math.PI;
        g.visible = cameraMode !== "first";
      } else g.visible = true;
      g.userData.legs?.forEach(
        (leg, i) =>
          (leg.rotation.x = moving ? Math.sin(t * 10 + i * Math.PI) * 0.45 : 0),
      );
      g.userData.arms?.forEach(
        (arm, i) =>
          (arm.rotation.x =
            t < (g.userData.attackUntil ?? 0)
              ? -1.5 + Math.sin(t * 25) * 0.5
              : moving
                ? -Math.sin(t * 10 + i * Math.PI) * 0.25
                : 0),
      );
    }
  if (playing && state && !typing() && !menu.isOpen() && !state.self.dead) {
    const mk = moveKeys(),
      turn = Number(mk.turnRight) - Number(mk.turnLeft);
    if (turn) {
      heading -= turn * 2.6 * dt;
      yaw -= turn * 2.6 * dt;
    }
    if (steering() && dragging) heading = yaw;
  }
  if (playing && state) {
    const p = playerModels.get(state.self.id),
      center = p
        ? p.position
        : new THREE.Vector3(state.self.x, 0, state.self.z);
    sun.position.set(center.x - 30, center.y + 35, center.z - 18);
    sun.target.position.copy(center);
    if (
      cameraMode === "follow" &&
      p &&
      !dragging &&
      t > cameraHoldUntil
    ) {
      const desired = p.rotation.y + Math.PI;
      const delta = Math.atan2(
        Math.sin(desired - yaw),
        Math.cos(desired - yaw),
      );
      yaw += delta * Math.min(1, dt * 4);
    }
    if (cameraMode === "first" && p && !dragging && !menu.isOpen()) {
      const focus =
        queuedAbility?.multiplier || state.self.casting
          ? state.enemies.find(
              (e) =>
                e.id === (state.self.casting?.target ?? selected) && e.hp > 0,
            )
          : t < (p.userData.attackUntil ?? 0)
            ? p.userData.attackTarget
            : null;
      if (focus) {
        const desired = facingAngle(center, focus) + Math.PI;
        const delta = Math.atan2(
          Math.sin(desired - yaw),
          Math.cos(desired - yaw),
        );
        yaw += delta * Math.min(1, dt * 12);
        const distance = Math.hypot(focus.x - center.x, focus.z - center.z);
        cameraPitch = Math.max(
          -1.1,
          Math.min(
            1.1,
            Math.atan2(
              center.y + 1.78 - height(focus.x, focus.z) - 1,
              Math.max(1, distance),
            ),
          ),
        );
      }
    }
    if (cameraMode === "first") {
      camera.position.set(center.x, center.y + 1.78, center.z);
      look.set(
        center.x - Math.sin(yaw) * Math.cos(cameraPitch) * 10,
        center.y + 1.78 - Math.sin(cameraPitch) * 10,
        center.z - Math.cos(yaw) * Math.cos(cameraPitch) * 10,
      );
    } else {
      look.set(center.x, center.y + 1.35, center.z);
      cameraAim.set(
        center.x + Math.sin(yaw) * zoom * Math.cos(cameraPitch),
        center.y + 1.35 + Math.sin(cameraPitch) * zoom,
        center.z + Math.cos(yaw) * zoom * Math.cos(cameraPitch),
      );
      cameraDelta.copy(cameraAim).sub(look);
      cameraRay.set(look, cameraDelta.clone().normalize());
      cameraRay.far = cameraDelta.length();
      if (t - lastCollisionAt > 0.12) {
        const blockers = cameraRay.intersectObjects(currentZone ? dungeon.occluders : scenery.occluders, false);
        cameraCollision = blockers[0]?.distance ?? Infinity;
        lastCollisionAt = t;
      }
      if (cameraCollision < cameraDelta.length())
        cameraAim
          .copy(look)
          .addScaledVector(
            cameraDelta.normalize(),
            Math.max(2, cameraCollision - 0.7),
          );
      cameraAim.y = Math.max(
        cameraAim.y,
        height(cameraAim.x, cameraAim.z) + 0.8,
      );
      camera.position.lerp(cameraAim, Math.min(1, dt * 10));
    }
    camera.lookAt(look);
    const e = state.enemies.find((e) => e.id === selected && e.hp > 0);
    ring.visible = !!e;
    $("target-frame").hidden = !e;
    if (e) {
      $("target-name").textContent = e.name;
      $("target-health").style.width = `${(e.hp / 60) * 100}%`;
      $("target-distance").textContent =
        `${e.hp} / 60 · ${Math.hypot(e.x - state.self.x, e.z - state.self.z).toFixed(1)} paces`;
    }

    if (e) {
      ring.position.set(e.x, height(e.x, e.z) + 0.06, e.z);
      $("target").textContent =
        `${e.name} · ${e.hp} / 60 · ${Math.hypot(e.x - state.self.x, e.z - state.self.z).toFixed(1)} paces`;
    } else {
      $("target").textContent = "Click an enemy · abilities 1–4 · F interacts";
      selected = null;
    }
  } else {
    camera.position.set(18 + Math.sin(t * 0.035) * 2, 12, 20);
    camera.lookAt(0, 1, -3);
    ring.visible = false;
  }
  if (playing && state) {
    combatUi.setSelected(selected);
    combatUi.frame(enemyModels);
  }
  if (playing && state)
    $("combat-status").textContent = state.self.casting
      ? `Casting ${state.abilities.find((a) => a.id === state.self.casting.ability)?.name ?? "ability"}…`
      : state.self.eating
        ? state.self.eating.kind === "food" ? "Eating… (move to stop)" : "Drinking… (move to stop)"
        : queuedAttack
        ? "Moving to attack…"
        : autorun
          ? "Autorun"
          : queuedAbility
        ? `Preparing ${queuedAbility.name} · approaching target`
        : interaction
          ? interaction.type === "gather"
            ? "Approaching Starleaf · gathering on arrival…"
            : "Approaching to interact…"
          : "";
  renderer.render(scene, camera);
}
const combatUi = createCombatUi({
  camera,
  height,
  act: (a) =>
    api("/api/actions", a)
      .then((r) => r.message && combatUi.info(r.message))
      .catch((e) => uiError(e.message)),
  onRelease: () =>
    api("/api/actions", { type: "release" })
      .then((r) => combatUi.info(r.message))
      .catch((e) => uiError(e.message)),
});
const guildUi = createGuildUi({
  getState: () => state,
  act: (a) =>
    api("/api/actions", a)
      .then((r) => {
        if (r?.message) combatUi.info(r.message);
        return true;
      })
      .catch((e) => {
        uiError(e.message);
        return false;
      }),
  onOpen: () => closePanels(),
  focusWorld: () => {
    keys.clear();
    canvas.focus();
  },
});
$("guild-menu").onclick = () => guildUi.toggle();
const hud = createHud({
  getState: () => state,
  toggleBag,
  useAbility,
  clearMovement: () => {
    keys.clear();
    queuedAbility = null;
    interaction = null;
  },
  focusWorld: () => canvas.focus(),
  guide: (id) => {
    if (id === "merchant") {
      queueInteraction({ type: "talk", target: "merchant" });
      return;
    }
    const index = Object.keys(state.self.quests).indexOf(id);
    $("quest-list").children[index]?.querySelector("button")?.click();
  },
});
const services = servicesUi({
  getState: () => state,
  act: async (a) => {
    const epoch = playEpoch,
      r = await api("/api/actions", a);
    if (epoch === playEpoch) {
      state = await api("/api/state");
      updateModels();
    }
    return r;
  },
  stop: () => {
    keys.clear();
    queuedAbility = null;
    interaction = null;
    hud.close();
    $("bag").hidden = true;
    $("character-sheet").hidden = true;
  },
  focusWorld: () => canvas.focus(),
});
$("profession-menu").onclick = () => services.open("professions");
const character = characterUi({
  getState: () => state,
  closeOthers: () => {
    hud.close();
    services.close();
  },
  clearMovement: () => {
    keys.clear();
    queuedAbility = null;
    interaction = null;
  },
  focusWorld: () => canvas.focus(),
});
const menu = gameMenu({
  stop: () => {
    keys.clear();
    queuedAbility = null;
    interaction = null;
    hud.close();
    services.close();
    $("bag").hidden = true;
    $("character-sheet").hidden = true;
    $("dialogue").close();
    api("/api/actions", { type: "input", x: 0, z: 0 }).catch(() => {});
  },
  resume: () => canvas.focus(),
  characters: () => accounts.roster(),
  logout: async () => {
    leaveWorld();
    await accounts.logout();
  },
  quit: async () => {
    if (state) await api("/api/actions", { type: "leave" });
    leaveWorld();
    if (window.hearthwildDesktop) await window.hearthwildDesktop.quit();
    else {
      await accounts.logout();
      $("account-error").textContent =
        "Logged out. You can close this browser tab.";
    }
  },
  camera: setCamera,
  getCamera: () => ({ mode: cameraMode, sensitivity: mouseSensitivity }),
  graphics: { current: GRAPHICS.quality, set: setGraphicsQuality },
});
$("game-menu-button").onclick = () => menu.toggle();
document.addEventListener("hearthwild-character", () => character.toggle());
for (const [button, cls] of [
  ["chat-toggle", "chat-open"],
  ["objectives-toggle", "objectives-open"],
])
  $(button).onclick = () => {
    const open = document.body.classList.toggle(cls);
    if (open)
      for (const other of ["chat-open", "objectives-open"])
        if (other !== cls) document.body.classList.remove(other);
    $(button).setAttribute("aria-expanded", String(open));
  };
render();
const accounts = accountUi({ api, onEnter: begin, onLeave: leaveWorld });
accounts.start();
