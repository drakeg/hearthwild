import { CRYPT } from "./dungeon-layout.js";
import { WORLD_HALF, WORLD_SIZE, WORLD_LIMIT, ZONES, TOWNS } from "./world-config.js";
import { zoneWeights, terrainHeight, lakeAt, ROADS, HOUSES } from "./terrain.js";
import { mapPoint, filterQuests, questMarker } from "./ui-model.js";
const $ = (id) => document.getElementById(id);
export function iconStyle(index) {
  return {
    backgroundImage: 'url("/art/abilities.png")',
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
    const c = canvas.getContext("2d"),
      size = canvas.width,
      span = mini ? 60 : 100,
      scale = size / span,
      cx = mini ? s.self.x - CRYPT.origin.x : 0,
      cz = mini ? s.self.z - CRYPT.origin.z : -38,
      pt = (x, z) => [(x - cx) * scale + size / 2, (z - cz) * scale + size / 2];
    c.fillStyle = "#0d0b0a";
    c.fillRect(0, 0, size, size);
    c.fillStyle = "#4a4238";
    c.strokeStyle = "#8d7a5a";
    c.lineWidth = 2;
    for (const r of CRYPT.rooms) {
      const [x0, y0] = pt(r.minX, r.minZ),
        [x1, y1] = pt(r.maxX, r.maxZ);
      c.fillRect(x0, y0, x1 - x0, y1 - y0);
    }
    const dot = (x, z, color, r) => {
      const [px, py] = pt(x - CRYPT.origin.x, z - CRYPT.origin.z);
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
      c.fillText(CRYPT.name, size / 2, 30);
    }
  }
  // A shaded painting of the whole world, built once in small slices so it never stalls a frame.
  const BG = 256,
    bgCanvas = document.createElement("canvas");
  bgCanvas.width = bgCanvas.height = BG;
  const bgCtx = bgCanvas.getContext("2d"),
    bgImage = bgCtx.createImageData(BG, BG),
    zoneRGB = Object.fromEntries(
      Object.entries(ZONES).map(([k, z]) => [k, [1, 3, 5].map((i) => parseInt(z.color.slice(i, i + 2), 16))]),
    );
  let bgRow = 0;
  function paintBackground() {
    if (bgRow >= BG) return true;
    const step = WORLD_SIZE / BG;
    for (const end = Math.min(BG, bgRow + 12); bgRow < end; bgRow++) {
      const z = -WORLD_HALF + (bgRow + 0.5) * step;
      for (let i = 0; i < BG; i++) {
        const x = -WORLD_HALF + (i + 0.5) * step,
          w = zoneWeights(x, z),
          h = terrainHeight(x, z),
          shade = Math.max(0.72, Math.min(1.25, 1 + (terrainHeight(x - step, z - step) - h) * 0.045));
        let r = 0,
          g = 0,
          b = 0;
        for (const k in w) (r += zoneRGB[k][0] * w[k]), (g += zoneRGB[k][1] * w[k]), (b += zoneRGB[k][2] * w[k]);
        if (Math.max(Math.abs(x), Math.abs(z)) > WORLD_LIMIT + 10) [r, g, b] = h > 45 ? [236, 238, 240] : [128, 122, 112];
        const lake = lakeAt(x, z);
        if (lake) [r, g, b] = lake.frozen ? [214, 232, 242] : [92, 140, 160];
        const k = (bgRow * BG + i) * 4;
        bgImage.data[k] = r * shade;
        bgImage.data[k + 1] = g * shade;
        bgImage.data[k + 2] = b * shade;
        bgImage.data[k + 3] = 255;
      }
    }
    bgCtx.putImageData(bgImage, 0, 0);
    return bgRow >= BG;
  }
  function drawMap(canvas, s, mini = false) {
    if (s.self.instance) return drawCrypt(canvas, s, mini);
    let ready = paintBackground();
    // The full map paints the whole world at once (a fraction of a second, once).
    if (!mini) while (!ready) ready = paintBackground();
    const c = canvas.getContext("2d"),
      size = canvas.width,
      span = mini ? 170 : WORLD_SIZE,
      scale = size / span,
      originX = mini ? s.self.x - span / 2 : -WORLD_HALF,
      originZ = mini ? s.self.z - span / 2 : -WORLD_HALF,
      pt = (x, z) => [(x - originX) * scale, (z - originZ) * scale];
    c.clearRect(0, 0, size, size);
    c.fillStyle = "#4f6a3c";
    c.fillRect(0, 0, size, size);
    // The painted world, cropped for the minimap.
    const bgScale = BG / WORLD_SIZE;
    c.imageSmoothingEnabled = true;
    c.drawImage(bgCanvas, (originX + WORLD_HALF) * bgScale, (originZ + WORLD_HALF) * bgScale, span * bgScale, span * bgScale, 0, 0, size, size);
    if (!ready && !mini) {
      c.fillStyle = "#00000055";
      c.fillRect(0, 0, size, size);
    }
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
      ["#5a4628", mini ? 5 : 4.5],
      ["#d6c08a", mini ? 2.8 : 2.2],
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
    // Houses on the minimap; town dots and names on the world map.
    if (mini) {
      c.fillStyle = "#8a4b33";
      for (const h of HOUSES) {
        if (Math.abs(h.x - s.self.x) > span || Math.abs(h.z - s.self.z) > span) continue;
        const [hx, hz] = pt(h.x, h.z);
        c.save();
        c.translate(hx, hz);
        c.rotate(-h.rot);
        c.fillRect((-h.w / 2) * scale, (-h.d / 2) * scale, h.w * scale, h.d * scale);
        c.restore();
      }
    } else {
      c.textAlign = "center";
      for (const t of TOWNS) {
        const [x, y] = pt(t.x, t.z);
        c.fillStyle = "#f3e2b0";
        c.strokeStyle = "#2a1d10";
        c.lineWidth = 2;
        c.beginPath();
        c.arc(x, y, 6, 0, Math.PI * 2);
        c.fill();
        c.stroke();
        c.font = "bold 15px Georgia";
        c.lineWidth = 4;
        c.strokeText(t.name, x, y - 11);
        c.fillText(t.name, x, y - 11);
      }
      // Zone names, placed in each zone's heartland.
      c.font = "italic bold 19px Georgia";
      for (const [id, x, z] of [
        ["stillwood", 0, -150],
        ["downs", 650, 330],
        ["marsh", 240, 700],
        ["crags", -700, 250],
        ["frost", -300, -720],
      ]) {
        const [lx, ly] = pt(x, z);
        c.strokeStyle = "#1d1810cc";
        c.lineWidth = 5;
        c.strokeText(ZONES[id].name.toUpperCase(), lx, ly);
        c.fillStyle = "#f4ead0";
        c.fillText(ZONES[id].name.toUpperCase(), lx, ly);
        c.font = "13px Georgia";
        const [lo, hi] = ZONES[id].levels;
        c.strokeText(`Levels ${lo}–${hi}`, lx, ly + 17);
        c.fillText(`Levels ${lo}–${hi}`, lx, ly + 17);
        c.font = "italic bold 19px Georgia";
      }
      c.font = "13px Georgia";
      c.fillStyle = "#fff4cc";
      c.strokeStyle = "#1d1810";
      c.lineWidth = 3;
      c.strokeText("Wayfarer’s Camp", ...pt(0, 34));
      c.fillText("Wayfarer’s Camp", ...pt(0, 34));
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
      const info = q.status === "merchant" ? { symbol: mini ? "¤" : "", color: "#d9b465" } : questMarker(q.status);
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
      const key = JSON.stringify(s.self.quests);
      if (key !== pinKey) {
        pinKey = key;
        $("map-pins").replaceChildren();
        for (const n of s.npcs) {
          const q = s.self.quests[n.quest] ?? { status: "merchant" },
            point = mapPoint(n.x, n.z),
            b = document.createElement("button");
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
          iconStyle(
            ["warrior", "warlock", "druid", "rogue"].indexOf(s.self.classId) *
              4 +
              a.key -
              1,
          ),
        );
        const text = document.createElement("span");
        text.textContent = `${a.name} · ${a.description} · ${a.cooldown / 1000}s cooldown · ${a.cost} ${s.classes[s.self.classId].resource}${s.self.level < a.level ? ` · Unlocks at level ${a.level}` : ` · Key ${a.key}`}`;
        b.append(i, text);
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
