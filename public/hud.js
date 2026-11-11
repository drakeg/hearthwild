import { CRYPT, DUNGEON_LIST, dungeonOf } from "./dungeon-layout.js";
import { WORLD_HALF, WORLD_SIZE, WORLD_LIMIT, ZONES, TOWNS } from "./world-config.js";
import { zoneWeights, zoneAt, terrainHeight, lakeAt, ROADS, HOUSES, LAKES } from "./terrain.js";
import { mapPoint, filterQuests, questMarker, zoneBounds, RANK_NAMES } from "./ui-model.js";
const $ = (id) => document.getElementById(id);
// Ability icons: keys 1–4 come from the first sheet, keys 9–12 from the second (one row per class).
export function abilityIcon(classId, key) {
  const row = ["warrior", "warlock", "druid", "rogue"].indexOf(classId);
  return key > 4 ? iconStyle(row * 4 + key - 9, "/art/abilities-2.png") : iconStyle(row * 4 + key - 1);
}
export function iconStyle(index, sheet = "/art/abilities.png") {
  return {
    backgroundImage: `url("${sheet}")`,
    backgroundSize: "400% 400%",
    backgroundPosition: `${((index % 4) / 3) * 100}% ${(Math.floor(index / 4) / 3) * 100}%`,
  };
}
export function createHud({
  getState,
  toggleBag,
  guide,
  useAbility,
  clearMovement,
  focusWorld,
}) {
  let chosenQuest = "wildgrowth",
    journalKey = "",
    spellKey = "",
    pinKey = "",
    lastView = null,
    waypoint = null;
  function stop() {
    clearMovement();
  }
  function close() {
    for (const id of ["atlas", "spellbook"]) $(id).hidden = true;
    focusWorld();
  }
  function openMap(mode = "map") {
    stop();
    scope = null;
    $("spellbook").hidden = true;
    $("bag").hidden = true;
    $("character-sheet").hidden = true;
    $("atlas").hidden = false;
    $("atlas").classList.toggle("journal-mode", mode === "journal");
    $("atlas-title").textContent =
      mode === "journal" ? "Quest log" : "Map & Quest Log";
    journalKey = "";
    update();
    $(mode === "journal" ? "quest-search" : "atlas-close").focus();
  }
  function spells() {
    stop();
    $("atlas").hidden = true;
    $("bag").hidden = true;
    $("character-sheet").hidden = true;
    $("spellbook").hidden = !$("spellbook").hidden;
    spellKey = "";
    update();
  }
  $("minimap-toggle").onclick = () => openMap();
  $("map-menu").onclick = () => openMap();
  $("quest-menu").onclick = () => openMap("journal");
  $("map-tab").onclick = () => openMap();
  $("journal-tab").onclick = () => openMap("journal");
  $("atlas-close").onclick = close;
  $("spell-menu").onclick = spells;
  $("spellbook-close").onclick = close;
  $("bags-menu").onclick = toggleBag;
  $("character-menu").onclick = () =>
    document.dispatchEvent(new CustomEvent("hearthwild-character"));
  $("quest-search").oninput = () => {
    journalKey = "";
    update();
  };
  $("quest-filter").onchange = () => {
    journalKey = "";
    update();
  };
  // Inside the crypt the map shows its rooms instead of the Stillwood.
  function drawCrypt(canvas, s, mini) {
    const D = dungeonOf(s.self.instance) ?? CRYPT,
      minX = Math.min(...D.rooms.map((r) => r.minX)),
      maxX = Math.max(...D.rooms.map((r) => r.maxX)),
      minZ = Math.min(...D.rooms.map((r) => r.minZ)),
      maxZ = Math.max(...D.rooms.map((r) => r.maxZ)),
      c = canvas.getContext("2d"),
      size = canvas.width,
      span = mini ? 60 : Math.max(maxX - minX, maxZ - minZ) + 16,
      scale = size / span,
      cx = mini ? s.self.x - D.origin.x : (minX + maxX) / 2,
      cz = mini ? s.self.z - D.origin.z : (minZ + maxZ) / 2,
      pt = (x, z) => [(x - cx) * scale + size / 2, (z - cz) * scale + size / 2];
    c.fillStyle = "#0d0b0a";
    c.fillRect(0, 0, size, size);
    c.fillStyle = "#4a4238";
    c.strokeStyle = "#8d7a5a";
    c.lineWidth = 2;
    for (const r of D.rooms) {
      const [x0, y0] = pt(r.minX, r.minZ),
        [x1, y1] = pt(r.maxX, r.maxZ);
      c.fillRect(x0, y0, x1 - x0, y1 - y0);
    }
    const dot = (x, z, color, r) => {
      const [px, py] = pt(x - D.origin.x, z - D.origin.z);
      c.fillStyle = color;
      c.beginPath();
      c.arc(px, py, r, 0, Math.PI * 2);
      c.fill();
    };
    for (const e of s.enemies) if (e.hp > 0) dot(e.x, e.z, e.boss ? "#ffb300" : "#d23a2a", e.boss ? 6 : 3.5);
    for (const m of s.self.party?.members ?? []) if (m.id !== s.self.id && m.instance === s.self.instance) dot(m.x, m.z, "#6fa0ff", 4);
    dot(s.self.x, s.self.z, "#ffe9a0", 5);
    if (!mini) {
      c.fillStyle = "#d8c49a";
      c.font = "italic 20px Georgia";
      c.textAlign = "center";
      c.fillText(D.name, size / 2, 30);
    }
  }
  // Shaded paintings of the land, built in small slices so they never stall a frame: one of the
  // whole world, and a sharper one of each zone the first time its map is opened.
  const zoneRGB = Object.fromEntries(
    Object.entries(ZONES).map(([k, z]) => [k, [1, 3, 5].map((i) => parseInt(z.color.slice(i, i + 2), 16))]),
  );
  function painter(originX, originZ, span, res) {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = res;
    const ctx = canvas.getContext("2d"),
      image = ctx.createImageData(res, res),
      step = span / res,
      // Heights of the row above, reused for the hill shading.
      prev = new Float32Array(res + 1);
    let row = 0;
    for (let i = 0; i <= res; i++) prev[i] = terrainHeight(originX + (i - 0.5) * step, originZ - 0.5 * step);
    return {
      canvas,
      originX,
      originZ,
      span,
      get done() {
        return row >= res;
      },
      // Paints rows until the time budget (ms) runs out; Infinity finishes the painting.
      paint(budget = 4) {
        if (row >= res) return true;
        const until = performance.now() + budget;
        while (row < res && performance.now() < until) {
          const z = originZ + (row + 0.5) * step;
          let left = terrainHeight(originX - 0.5 * step, z);
          for (let i = 0; i < res; i++) {
            const x = originX + (i + 0.5) * step,
              w = zoneWeights(x, z),
              h = terrainHeight(x, z),
              shade = Math.max(0.72, Math.min(1.25, 1 + (prev[i] - h) * (0.35 / Math.max(step, 4))));
            prev[i] = left;
            left = h;
            let r = 0,
              g = 0,
              b = 0;
            for (const k in w) (r += zoneRGB[k][0] * w[k]), (g += zoneRGB[k][1] * w[k]), (b += zoneRGB[k][2] * w[k]);
            if (Math.max(Math.abs(x), Math.abs(z)) > WORLD_LIMIT + 10) [r, g, b] = h > 45 ? [236, 238, 240] : [128, 122, 112];
            const lake = lakeAt(x, z);
            if (lake) [r, g, b] = lake.frozen ? [214, 232, 242] : lake.lava ? [236, 104, 34] : lake.star ? [138, 126, 214] : lake.bog ? [74, 98, 82] : [92, 140, 160];
            const k = (row * res + i) * 4;
            image.data[k] = r * shade;
            image.data[k + 1] = g * shade;
            image.data[k + 2] = b * shade;
            image.data[k + 3] = 255;
          }
          prev[res] = left;
          row++;
        }
        ctx.putImageData(image, 0, 0);
        return row >= res;
      },
    };
  }
  const world = painter(-WORLD_HALF, -WORLD_HALF, WORLD_SIZE, 256),
    zonePainters = new Map();
  const zonePainter = (id) => {
    if (!zonePainters.has(id)) {
      const b = zoneBounds()[id];
      zonePainters.set(id, painter(b.originX, b.originZ, b.span, 288));
    }
    return zonePainters.get(id);
  };
  // Which zone the map shows ("world" for the whole world); null follows the player.
  let scope = null;
  const viewFor = (s) => (scope === "world" ? "world" : (scope ?? zoneAt(s.self.x, s.self.z)));
  $("map-zone").onclick = () => {
    scope = null;
    pinKey = "";
    update();
  };
  $("map-world").onclick = () => {
    scope = "world";
    pinKey = "";
    update();
  };
  // Clicking a zone on the world map opens that zone's map.
  $("world-map").onclick = (ev) => {
    if (scope !== "world") return;
    const r = ev.currentTarget.getBoundingClientRect(),
      x = -WORLD_HALF + ((ev.clientX - r.left) / r.width) * WORLD_SIZE,
      z = -WORLD_HALF + ((ev.clientY - r.top) / r.height) * WORLD_SIZE;
    if (Math.max(Math.abs(x), Math.abs(z)) > WORLD_LIMIT) return;
    scope = zoneAt(x, z);
    pinKey = "";
    update();
  };
  function drawMap(canvas, s, mini = false) {
    if (s.self.instance) return drawCrypt(canvas, s, mini);
    const here = zoneAt(s.self.x, s.self.z),
      view = mini ? here : viewFor(s);
    // The zone's painting fills in a few milliseconds at a time, then the world's in spare time;
    // opening a map finishes its painting at once.
    const zp = view === "world" ? null : zonePainter(view);
    if (!mini) (zp ?? world).paint(Infinity);
    else if (!zp.done) zp.paint(5);
    else world.paint(3);
    const c = canvas.getContext("2d"),
      size = canvas.width,
      span = mini ? 170 : view === "world" ? WORLD_SIZE : zp.span,
      scale = size / span,
      originX = mini ? s.self.x - span / 2 : view === "world" ? -WORLD_HALF : zp.originX,
      originZ = mini ? s.self.z - span / 2 : view === "world" ? -WORLD_HALF : zp.originZ,
      pt = (x, z) => [(x - originX) * scale, (z - originZ) * scale],
      inView = (x, z, pad = 0) => x > originX - pad && z > originZ - pad && x < originX + span + pad && z < originZ + span + pad;
    if (!mini) lastView = { originX, originZ, span, key: view };
    if (!mini) {
      $("map-pins").classList.toggle("world", view === "world");
      $("map-zone").classList.toggle("active", view !== "world");
      $("map-world").classList.toggle("active", view === "world");
      canvas.style.cursor = view === "world" ? "pointer" : "";
      canvas.setAttribute("aria-label", view === "world" ? "Map of the world" : `Map of ${ZONES[view].name}`);
    }
    c.clearRect(0, 0, size, size);
    c.fillStyle = ZONES[here].color;
    c.fillRect(0, 0, size, size);
    // The painting: the zone's own where it covers the view, else the world's.
    c.imageSmoothingEnabled = true;
    const art = zp?.done && originX >= zp.originX && originZ >= zp.originZ && originX + span <= zp.originX + zp.span && originZ + span <= zp.originZ + zp.span ? zp : world,
      k = art.canvas.width / art.span;
    if (art.done || !mini) c.drawImage(art.canvas, (originX - art.originX) * k, (originZ - art.originZ) * k, span * k, span * k, 0, 0, size, size);
    // Stillwater Pond and the arch trail at the heart of the Stillwood.
    c.fillStyle = "#6e9aa6";
    const [px, py] = pt(-16, -12);
    c.beginPath();
    c.ellipse(px, py, 7 * scale, 6.5 * scale, -0.2, 0, Math.PI * 2);
    c.fill();
    // Roads.
    const road = (points) => {
      c.beginPath();
      points.forEach(([x, z], i) => (i ? c.lineTo(...pt(x, z)) : c.moveTo(...pt(x, z))));
    };
    for (const [color, width] of [
      ["#5a4628", mini ? 5 : view === "world" ? 4.5 : 6],
      ["#d6c08a", mini ? 2.8 : view === "world" ? 2.2 : 3.2],
    ]) {
      c.strokeStyle = color;
      c.lineWidth = width;
      c.lineJoin = c.lineCap = "round";
      road([[0, 84], [0, 0], [-2, -78]]);
      c.stroke();
      for (const r of ROADS) {
        road(r);
        c.stroke();
      }
    }
    const label = (text, x, y, font, fill, stroke = "#1d1810", width = 3) => {
      c.font = font;
      c.strokeStyle = stroke;
      c.lineWidth = width;
      c.strokeText(text, x, y);
      c.fillStyle = fill;
      c.fillText(text, x, y);
    };
    // Houses on the minimap and zone maps; town dots and names on the larger maps.
    if (mini || view !== "world") {
      c.fillStyle = "#8a4b33";
      for (const h of HOUSES) {
        if (!inView(h.x, h.z, 10)) continue;
        const [hx, hz] = pt(h.x, h.z);
        c.save();
        c.translate(hx, hz);
        c.rotate(-h.rot);
        c.fillRect((-h.w / 2) * scale, (-h.d / 2) * scale, Math.max(2, h.w * scale), Math.max(2, h.d * scale));
        c.restore();
      }
    }
    if (!mini) {
      c.textAlign = "center";
      const zoneMap = view !== "world";
      for (const t of TOWNS) {
        if (!inView(t.x, t.z)) continue;
        const [x, y] = pt(t.x, t.z);
        if (!zoneMap) {
          c.fillStyle = "#f3e2b0";
          c.strokeStyle = "#2a1d10";
          c.lineWidth = 2;
          c.beginPath();
          c.arc(x, y, 6, 0, Math.PI * 2);
          c.fill();
          c.stroke();
        }
        label(t.name, x, y - (zoneMap ? t.r * scale + 8 : 9), zoneMap ? "bold 15px Georgia" : "bold 11px Georgia", "#f3e2b0", "#2a1d10", 3);
      }
      // Lakes and named places, on zone maps.
      if (zoneMap) {
        const named = new Set();
        for (const l of LAKES) {
          if (!inView(l.x, l.z) || named.has(l.name + Math.round(l.x / 200))) continue;
          named.add(l.name + Math.round(l.x / 200));
          const [x, y] = pt(l.x, l.z);
          label(l.name, x, y + 4, "italic 13px Georgia", "#e4f2f6", "#1d2a30");
        }
      }
      // Dungeon entrances.
      for (const d of DUNGEON_LIST) {
        if (!inView(d.door.x, d.door.z)) continue;
        const [x, y] = pt(d.door.x, d.door.z);
        c.fillStyle = "#2a1d10";
        c.beginPath();
        c.moveTo(x, y - 7);
        c.lineTo(x + 6, y + 5);
        c.lineTo(x - 6, y + 5);
        c.closePath();
        c.fill();
        c.fillStyle = "#c9a2ff";
        c.beginPath();
        c.arc(x, y + 1, 2.6, 0, Math.PI * 2);
        c.fill();
        if (zoneMap) {
          label(d.name, x, y + 18, "bold 12px Georgia", "#e6d8ff");
          const [lo, hi] = d.levels ?? [];
          if (lo) label(`Dungeon · Levels ${lo}–${d.bossLevel ?? hi}`, x, y + 32, "11px Georgia", "#d8ccef");
        }
      }
      // Zone names: placed in each zone's heartland on the world map, as a title on a zone map.
      if (!zoneMap)
        for (const [id, b] of Object.entries(zoneBounds())) {
          // Outer Ring names sit out past their town, toward the zone's far corner.
          const push = ZONES[id].ring ? 1.3 : 1,
            [lx, ly] = pt(b.cx * push, b.cz * push);
          // The Outer Ring's names are larger; the inner zones are small at this scale.
          const big = ZONES[id].ring,
            [lo, hi] = ZONES[id].levels;
          label(ZONES[id].name.toUpperCase(), lx, ly + (big ? 0 : 14), big ? "italic bold 18px Georgia" : "italic bold 11px Georgia", "#f4ead0", "#1d1810cc", big ? 5 : 3);
          label(`Levels ${lo}–${hi}`, lx, ly + (big ? 16 : 25), big ? "12px Georgia" : "10px Georgia", "#f4ead0", "#1d1810cc", 3);
        }
      else {
        // The zone's name on a parchment plate along the bottom edge.
        const [lo, hi] = ZONES[view].levels;
        c.fillStyle = "#1d1810b8";
        c.fillRect(size / 2 - 190, size - 66, 380, 50);
        label(ZONES[view].name, size / 2, size - 42, "italic bold 22px Georgia", "#f4ead0", "#1d1810", 4);
        label(`Levels ${lo}–${hi}`, size / 2, size - 24, "13px Georgia", "#e8d8a8", "#1d1810", 3);
      }
      if (zoneMap && inView(0, 34)) label("Wayfarer’s Camp", ...pt(0, 34), "13px Georgia", "#fff4cc");
      c.textAlign = "start";
    }
    const marker = (o, color, r) => {
      const [x, y] = pt(o.x, o.z);
      if (x < -10 || y < -10 || x > size + 10 || y > size + 10) return;
      c.fillStyle = color;
      c.strokeStyle = "#152216";
      c.lineWidth = 1.3;
      c.beginPath();
      c.arc(x, y, r, 0, Math.PI * 2);
      c.fill();
      c.stroke();
    };
    if (mini) for (const e of s.enemies) if (e.hp > 0) marker(e, "#c66d4e", 2.5);
    if (mini && s.self.quests.starleaf.status === "active")
      for (const r of s.resources) if (r.available) marker(r, "#75ddbc", 2.5);
    for (const n of s.npcs) {
      const q = s.self.quests[n.quest] ?? { status: "merchant" };
      const info = q.status === "merchant" ? { symbol: mini && n.merchant ? "¤" : "", color: "#d9b465" } : questMarker(q.status, q.locked);
      if (!mini && !info.symbol) continue;
      marker(n, info.color, mini ? 3 : 4);
      if (info.symbol) {
        const [x, y] = pt(n.x, n.z);
        c.font = `bold ${mini ? 12 : 16}px Georgia`;
        c.textAlign = "center";
        c.strokeStyle = "#152216";
        c.lineWidth = 3;
        c.strokeText(info.symbol, x, y - 6);
        c.fillStyle = info.color;
        c.fillText(info.symbol, x, y - 6);
        c.textAlign = "start";
      }
    }
    for (const m of s.self.party?.members ?? []) if (m.id !== s.self.id && !m.instance) marker(m, "#6fa0ff", mini ? 3 : 5);
    for (const p of s.players) if (p.id !== s.self.id) marker(p, p.faction === s.self.faction ? "#93c9dc" : "#ce705e", mini ? 2.5 : 3.5);
    for (const l of s.loot) marker(l, "#ffe284", mini ? 3 : 4);
    if (waypoint) {
      const point = pt(waypoint.x, waypoint.z);
      c.strokeStyle = "#f6d474";
      c.lineWidth = 2;
      c.beginPath();
      c.arc(...point, mini ? 7 : 12, 0, Math.PI * 2);
      c.stroke();
    }
    const [x, y] = pt(s.self.x, s.self.z);
    c.fillStyle = "#fff0b1";
    c.strokeStyle = "#231c11";
    c.lineWidth = 1.5;
    c.beginPath();
    c.moveTo(x, y - (mini ? 5 : 10));
    c.lineTo(x - (mini ? 4 : 8), y + (mini ? 5 : 9));
    c.lineTo(x + (mini ? 4 : 8), y + (mini ? 5 : 9));
    c.closePath();
    c.fill();
    c.stroke();
    if (!mini) {
      c.strokeStyle = "#826c45";
      c.lineWidth = 7;
      c.strokeRect(5, 5, size - 10, size - 10);
    }
  }
  function journal(s) {
    const matches = filterQuests(
      s.questDefinitions,
      s.self.quests,
      $("quest-search").value,
      $("quest-filter").value,
    );
    if (matches.length && !matches.some((q) => q.id === chosenQuest))
      chosenQuest = matches[0].id;
    const key = JSON.stringify([matches, s.self.quests, chosenQuest]);
    if (key === journalKey) return;
    journalKey = key;
    $("journal-list").replaceChildren();
    if (!matches.length) {
      const empty = document.createElement("p");
      empty.textContent = "No matching quests.";
      $("journal-list").append(empty);
    }
    for (const q of matches) {
      const b = document.createElement("button"),
        p = s.self.quests[q.id];
      b.textContent = `${p.status === "ready" ? "?" : p.status === "offered" ? "!" : "◇"} ${q.name}`;
      b.classList.toggle("selected", q.id === chosenQuest);
      b.onclick = () => {
        chosenQuest = q.id;
        journalKey = "";
        update();
      };
      $("journal-list").append(b);
    }
    if (!matches.length) {
      $("quest-detail").textContent = "No quest matches your search.";
      return;
    }
    const q = s.questDefinitions[chosenQuest];
    if (!q) return;
    const progress = s.self.quests[q.id],
      npc = s.npcs.find((n) => n.id === q.npc);
    $("quest-detail").replaceChildren();
    for (const [tag, text] of [
      ["h3", q.name],
      ["p", npc.text],
      ["p", `${q.objective}: ${progress.progress} / ${q.required}`],
      ["small", q.area],
      ["strong", `Rewards: ${q.reward} gold · 60 XP`],
    ]) {
      const e = document.createElement(tag);
      e.textContent = text;
      $("quest-detail").append(e);
    }
    const b = document.createElement("button");
    b.textContent = "Track on map";
    b.onclick = () => {
      waypoint =
        progress.status === "ready" || progress.status === "offered"
          ? npc
          : q.id === "starleaf"
            ? s.resources.find((r) => r.available)
            : s.enemies.find((e) => e.hp > 0);
      $("atlas").classList.remove("journal-mode");
      $("atlas-title").textContent = "Map & Quest Log";
      update();
    };
    $("quest-detail").append(b);
    const action = document.createElement("button");
    action.textContent =
      progress.status === "offered" || progress.status === "ready"
        ? `Speak to ${npc.name}`
        : "Find objective";
    action.disabled = progress.status === "complete";
    action.onclick = () => {
      close();
      guide(q.id);
    };
    $("quest-detail").append(action);
  }
  function update() {
    const s = getState();
    if (!s) return;
    drawMap($("minimap"), s, true);
    $("map-coordinates").textContent =
      `${Math.round(mapPoint(s.self.x, s.self.z).x)}, ${Math.round(mapPoint(s.self.x, s.self.z).y)}`;
    if (!$("atlas").hidden) {
      drawMap($("world-map"), s);
      journal(s);
      const key = JSON.stringify([s.self.quests, lastView?.key]);
      if (key !== pinKey) {
        pinKey = key;
        $("map-pins").replaceChildren();
        for (const n of s.npcs) {
          const q = s.self.quests[n.quest] ?? { status: "merchant" },
            v = lastView,
            point = { x: ((n.x - v.originX) / v.span) * 100, y: ((n.z - v.originZ) / v.span) * 100 },
            b = document.createElement("button");
          if (point.x < 0 || point.y < 0 || point.x > 100 || point.y > 100) continue;
          // The world map keeps to quest givers; merchants show on zone maps.
          if (v.key === "world" && !n.quest) continue;
          b.className = "map-pin";
          b.textContent =
            q.status === "merchant"
              ? "¤"
              : q.status === "ready"
                ? "?"
                : q.status === "offered"
                  ? "!"
                  : "◇";
          b.setAttribute("aria-label", n.name + (n.quest ? " quest" : " merchant"));
          b.title = n.name;
          b.style.left = point.x + "%";
          b.style.top = point.y + "%";
          b.onclick = () => {
            if (!n.quest) {
              guide("merchant");
              return;
            }
            chosenQuest = n.quest;
            journalKey = "";
            journal(s);
          };
          $("map-pins").append(b);
        }
      }
    }
    if (
      !$("spellbook").hidden &&
      spellKey !== JSON.stringify([s.self.level, s.self.classId])
    ) {
      spellKey = JSON.stringify([s.self.level, s.self.classId]);
      $("spell-list").replaceChildren();
      for (const a of s.abilities) {
        const b = document.createElement("button"),
          i = document.createElement("span");
        i.className = "spell-icon";
        Object.assign(
          i.style,
          abilityIcon(s.self.classId, a.key),
        );
        const text = document.createElement("span");
        text.textContent = `${a.name}${a.rank ? ` · Rank ${RANK_NAMES[a.rank]}` : ""} · ${a.description} · ${a.cooldown / 1000}s cooldown · ${a.cost} ${s.classes[s.self.classId].resource}${s.self.level < a.level ? ` · Unlocks at level ${a.level}` : ` · Key ${a.key}`}`;
        b.append(i, text);
        // Ranks: reached ones in gold, the next ones still to come.
        for (const r of a.ranks ?? []) {
          const line = document.createElement("small");
          line.className = `spell-rank${s.self.level >= r.level ? " reached" : ""}`;
          line.textContent = `Rank II at level ${r.level}: ${r.text}`;
          text.append(line);
        }
        b.disabled = s.self.level < a.level;
        b.onclick = () => {
          close();
          useAbility(a.key);
        };
        $("spell-list").append(b);
      }
    }
  }
  return {
    update,
    openMap,
    close,
    spells,
    isOpen: () => !$("atlas").hidden || !$("spellbook").hidden,
  };
}
