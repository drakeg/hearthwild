// MMO-style combat presentation: unit frames, nameplates, floating combat text,
// cast bar, error/zone text, XP bar, death and level-up feedback. Original Hearthwild UI.
import * as THREE from "./vendor/three.module.js";
import { levelColor } from "./world-config.js";

const $ = (id) => document.getElementById(id);
const el = (tag, className, text) => {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text !== undefined) e.textContent = text;
  return e;
};
const CLASS_GLYPH = { warrior: "⚔", warlock: "☽", druid: "❦", rogue: "✧" };
const RESOURCE_CLASS = { Rage: "rage", Mana: "mana", Energy: "energy" };

export function createCombatUi({ camera, height, onRelease, onTargetChange, act }) {
  const root = el("div", "cui");
  root.id = "combat-ui";
  document.getElementById("hud").append(root);

  // ---------- Unit frames ----------
  const frames = el("div", "cui-frames");
  const player = unitFrame("player");
  const target = unitFrame("target");
  const tot = el("div", "cui-tot");
  tot.hidden = true;
  const totName = el("span", "cui-tot-name"),
    totBar = el("div", "cui-bar cui-tot-bar"),
    totFill = el("i");
  totBar.append(totFill);
  tot.append(el("small", "", "Target of target"), totName, totBar);
  target.root.append(tot);
  target.root.hidden = true;
  frames.append(player.root, target.root);
  root.append(frames);
  // Target cast bar, so you can see when to interrupt.
  const tcast = el("div", "cui-tcast"),
    tcastFill = el("i"),
    tcastName = el("b");
  tcast.append(tcastFill, tcastName);
  tcast.hidden = true;
  target.root.append(tcast);
  // Party frames stack under the player frame.
  const partyBox = el("div", "cui-party");
  root.append(partyBox);
  const partyFrames = new Map();
  // Group invitation popup.
  const invite = el("div", "cui-popup cui-invite");
  invite.hidden = true;
  const inviteText = el("p"),
    accept = el("button", "cui-button", "Accept"),
    decline = el("button", "cui-button cui-secondary", "Decline");
  accept.onclick = () => act?.({ type: "party", op: "accept" });
  decline.onclick = () => act?.({ type: "party", op: "decline" });
  invite.append(el("strong", "", "Group invitation"), inviteText, accept, decline);
  root.append(invite);
  // Boss yells and big announcements.
  const yell = el("div", "cui-yell");
  root.append(yell);
  function shout(text, kind = "yell") {
    yell.textContent = text;
    yell.className = `cui-yell ${kind}`;
    void yell.offsetWidth;
    yell.classList.add("show");
  }

  function unitFrame(kind) {
    const r = el("section", `cui-unit cui-${kind}`),
      portrait = el("div", "cui-portrait"),
      glyph = el("span", "cui-glyph"),
      level = el("span", "cui-level"),
      body = el("div", "cui-body"),
      name = el("div", "cui-name"),
      hp = el("div", "cui-bar cui-hp"),
      hpFill = el("i"),
      hpText = el("b"),
      power = el("div", "cui-bar cui-power"),
      powerFill = el("i"),
      powerText = el("b"),
      status = el("div", "cui-status");
    hp.append(hpFill, hpText);
    power.append(powerFill, powerText);
    portrait.append(glyph, level);
    body.append(name, hp, power, status);
    r.append(portrait, body);
    return { root: r, glyph, level, name, hpFill, hpText, power, powerFill, powerText, status };
  }

  // ---------- Cast bar ----------
  const castBar = el("div", "cui-cast"),
    castFill = el("i"),
    castName = el("b"),
    castTime = el("span");
  castBar.append(castFill, castName, castTime);
  castBar.hidden = true;
  root.append(castBar);
  let castFlash = null; // { text, kind, until }

  // ---------- Error / info text & zone text ----------
  const errors = el("div", "cui-errors");
  errors.setAttribute("role", "alert");
  const zone = el("div", "cui-zone"),
    zoneTitle = el("h2"),
    zoneSub = el("p");
  zone.append(zoneTitle, zoneSub);
  const levelUp = el("div", "cui-levelup");
  root.append(errors, zone, levelUp);

  // ---------- XP bar ----------
  const xp = el("div", "cui-xp"),
    xpFill = el("i"),
    xpText = el("b");
  for (let i = 1; i < 20; i++) {
    const tick = el("span", "cui-xp-tick");
    tick.style.left = `${i * 5}%`;
    xp.append(tick);
  }
  xp.append(xpFill, xpText);
  document.querySelector("#hud .bottom")?.append(xp);

  // ---------- Death popup ----------
  const death = el("div", "cui-popup");
  death.hidden = true;
  const releaseButton = el("button", "cui-button", "Release Spirit");
  const deathWhere = el("p", "", "Your spirit will return to the nearest graveyard.");
  death.append(
    el("strong", "", "You have died."),
    deathWhere,
    releaseButton,
  );
  releaseButton.onclick = () => onRelease();
  root.append(death);

  // ---------- World-anchored layers ----------
  const plates = el("div", "cui-plates"),
    floaters = el("div", "cui-floaters");
  root.prepend(plates, floaters);
  const plateMap = new Map(),
    floating = [],
    seen = new Set();
  const v = new THREE.Vector3();
  function project(x, y, z) {
    v.set(x, y, z).project(camera);
    if (v.z > 1 || v.z < -1) return null;
    return { x: ((v.x + 1) / 2) * innerWidth, y: ((1 - v.y) / 2) * innerHeight };
  }

  let state = null,
    selected = null,
    clockOffset = 0,
    lastSubzone = null,
    lastZone = null,
    lastLevel = null,
    lastDead = false;
  const serverNow = () => performance.now() + clockOffset;

  function error(text) {
    show(text, "error");
  }
  function info(text) {
    show(text, "info");
  }
  function show(text, kind) {
    if (!text) return;
    for (const line of errors.children)
      if (line.textContent === text) line.remove();
    const line = el("p", kind, text);
    errors.append(line);
    while (errors.children.length > 3) errors.firstChild.remove();
    setTimeout(() => line.classList.add("fade"), 2200);
    setTimeout(() => line.remove(), 3200);
  }
  function systemChat(text, kind = "system") {
    const log = $("messages");
    if (!log) return;
    log.querySelector(".chat-hint")?.remove();
    const p = el("p", kind, text);
    log.append(p);
    while (log.children.length > 80) log.firstChild.remove();
    log.scrollTop = log.scrollHeight;
  }
  function showZone(title, sub, subClass = "") {
    zoneTitle.textContent = title;
    zoneSub.textContent = sub;
    zoneSub.className = subClass;
    zone.classList.remove("show");
    void zone.offsetWidth;
    zone.classList.add("show");
  }
  function float(text, x, y, z, kind, big = false) {
    const node = el("div", `cui-float ${kind}${big ? " crit" : ""}`, text);
    floaters.append(node);
    floating.push({
      node,
      x: x + (Math.random() - 0.5) * 0.6,
      y,
      z,
      born: performance.now(),
      drift: (Math.random() - 0.5) * 30,
      life: big ? 1700 : 1300,
    });
  }

  function handleEvents() {
    const me = state.self.id;
    for (const e of state.events ?? []) {
      const key = `${state.chatEpoch}:${e.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      if (seen.size > 400) seen.delete(seen.values().next().value);
      const gy = height(e.x, e.z);
      if (e.kind === "strike" && e.from === me)
        float(
          String(e.damage),
          e.x,
          gy + 2.4,
          e.z,
          e.swing ? "swing" : "spell",
          e.crit,
        );
      else if (e.kind === "hit" && e.to === me)
        float(`-${e.damage}`, e.x, gy + 2.6, e.z, "taken", e.crit);
      else if (e.kind === "heal" && e.to === me && e.amount > 0)
        float(`+${e.amount}`, e.x, gy + 2.6, e.z, "heal");
      else if (e.kind === "evade") {
        float("Evade", e.x, gy + 2.4, e.z, "miss");
      } else if (e.kind === "xp" && e.to === me) {
        float(`+${e.amount} XP`, state.self.x, height(state.self.x, state.self.z) + 3, state.self.z, "xp");
        systemChat(`${e.name} dies. You gain ${e.amount} experience.`, "xp");
      } else if (e.kind === "interrupt" && e.to === me) {
        castFlash = { text: "Interrupted", kind: "interrupted", until: performance.now() + 900 };
      } else if (e.kind === "emote") {
        shout(e.text);
        systemChat(e.text, "yell");
      } else if (e.kind === "interrupted") {
        float("Interrupted!", e.x, gy + 2.8, e.z, "spell", true);
        info(`${e.by} interrupted ${e.spell}!`);
      } else if (e.kind === "ashfall") {
        float("Ashfall", e.x, gy + 1.5, e.z, "taken");
      } else if (e.kind === "telegraph") {
        if (Math.hypot(state.self.x - e.x, state.self.z - e.z) <= e.radius + 1) error("Move out of the Ashfall!");
      }
      if (e.kind === "death" && e.boss) {
        shout(`${e.name} has been defeated!`, "victory");
        systemChat(`${e.name} has been defeated!`, "levelup");
      }
      if (e.kind === "death" && e.target === selected) {
        selected = null;
        onTargetChange?.(null);
      }
    }
  }

  function updateFrames() {
    const p = state.self,
      cls = state.classes[p.classId],
      maxHp = p.stats.maxHp;
    player.root.style.setProperty("--class", cls.color);
    player.glyph.textContent = CLASS_GLYPH[p.classId] ?? "✦";
    player.level.textContent = p.level;
    player.name.textContent = p.name;
    player.hpFill.style.width = `${(p.hp / maxHp) * 100}%`;
    player.hpText.textContent = `${Math.ceil(p.hp)} / ${maxHp}`;
    player.power.className = `cui-bar cui-power ${RESOURCE_CLASS[cls.resource]}`;
    player.powerFill.style.width = `${p.power}%`;
    player.powerText.textContent = `${Math.floor(p.power)} / 100`;
    const resting = Math.abs(p.x) < 9 && p.z > 6 && p.z < 25;
    player.root.classList.toggle("in-combat", !!p.inCombat);
    player.root.classList.toggle("resting", resting && !p.inCombat);
    player.status.textContent = p.dead
      ? "Dead"
      : p.inCombat
        ? "In combat"
        : resting
          ? "Resting"
          : "";

    const e = state.enemies.find((x) => x.id === selected && x.hp > 0);
    target.root.hidden = !e;
    if (e) {
      const color = levelColor(e.level ?? 1, p.level);
      target.glyph.textContent = e.boss ? "☠" : "❂";
      target.level.textContent = e.boss ? "??" : e.level ?? 1;
      target.level.style.color = e.boss ? "#ff2020" : color;
      target.root.classList.toggle("boss", !!e.boss);
      tcast.hidden = !e.casting;
      if (e.casting) {
        const total = e.casting.endsAt - e.casting.startedAt,
          k = Math.max(0, Math.min(1, (serverNow() - e.casting.startedAt) / total));
        tcastFill.style.width = `${k * 100}%`;
        tcastName.textContent = `${e.casting.name}${e.casting.interruptible ? " · interrupt!" : ""}`;
        tcast.classList.toggle("interruptible", !!e.casting.interruptible);
      }
      target.name.textContent = e.name;
      target.hpFill.style.width = `${(e.hp / (e.maxHp ?? 60)) * 100}%`;
      target.hpText.textContent = `${e.hp} / ${e.maxHp ?? 60}`;
      target.power.hidden = true;
      const dist = Math.hypot(e.x - p.x, e.z - p.z);
      target.status.textContent = e.evading
        ? "Evading"
        : `${dist.toFixed(0)} paces${e.engaged ? " · Hostile" : ""}`;
      target.root.classList.toggle("engaged", !!e.engaged);
      const victim = e.targetId
        ? e.targetId === p.id
          ? p
          : state.players.find((q) => q.id === e.targetId)
        : null;
      tot.hidden = !victim;
      if (victim) {
        totName.textContent = victim.name;
        totFill.style.width = `${(victim.hp / victim.stats.maxHp) * 100}%`;
      }
    }

    const members = (p.party?.members ?? []).filter((m) => m.id !== p.id),
      seenIds = new Set();
    for (const m of members) {
      seenIds.add(m.id);
      let f = partyFrames.get(m.id);
      if (!f) {
        const r = el("div", "cui-pmember"),
          name = el("span", "cui-pname"),
          hp = el("div", "cui-bar cui-hp"),
          hpFill = el("i"),
          power = el("div", "cui-bar cui-power"),
          powerFill = el("i");
        hp.append(hpFill);
        power.append(powerFill);
        r.append(name, hp, power);
        partyBox.append(r);
        f = { r, name, hpFill, power, powerFill };
        partyFrames.set(m.id, f);
      }
      const cls = state.classes[m.classId];
      f.r.style.setProperty("--class", cls.color);
      f.name.textContent = `${m.leader ? "♛ " : ""}${m.name} · ${m.level}${m.dead ? " · Dead" : !m.online ? " · Offline" : (m.instance ?? null) !== (p.instance ?? null) ? " · Elsewhere" : ""}`;
      f.hpFill.style.width = `${(m.hp / m.maxHp) * 100}%`;
      f.power.className = `cui-bar cui-power ${RESOURCE_CLASS[cls.resource]}`;
      f.powerFill.style.width = `${m.power}%`;
      f.r.classList.toggle("away", m.dead || !m.online);
    }
    for (const [id, f] of partyFrames)
      if (!seenIds.has(id)) {
        f.r.remove();
        partyFrames.delete(id);
      }
    invite.hidden = !p.partyInvite;
    if (p.partyInvite) inviteText.textContent = `${p.partyInvite.from} invites you to join their group.`;
    xpFill.style.width = `${(p.xp / p.xpNeeded) * 100}%`;
    xpText.textContent =
      p.level >= 20 ? "Maximum level" : `Level ${p.level} · XP ${p.xp} / ${p.xpNeeded}`;
  }

  function update(next) {
    state = next;
    clockOffset = state.serverTime - performance.now();
    handleEvents();
    updateFrames();
    const p = state.self;
    if (p.subzone !== lastSubzone) {
      const first = lastSubzone === null;
      lastSubzone = p.subzone;
      const label = document.querySelector(".minimap-zone");
      if (label) label.textContent = p.subzone;
      const zone = p.zone ?? "The Stillwood",
        newZone = zone !== lastZone;
      lastZone = zone;
      if (first) showZone(zone, p.subzone !== zone ? p.subzone : "");
      else if (p.sanctuary) showZone(p.subzone, "(Sanctuary)", "sanctuary");
      else if (p.subzone !== zone) showZone(p.subzone, zone);
      else if (newZone) showZone(zone, "");
    }
    if (lastLevel !== null && p.level > lastLevel) {
      levelUp.replaceChildren(
        el("strong", "", `Level ${p.level}`),
        el("span", "", "You feel stronger."),
      );
      levelUp.classList.remove("show");
      void levelUp.offsetWidth;
      levelUp.classList.add("show");
      systemChat(`You have reached level ${p.level}!`, "levelup");
    }
    lastLevel = p.level;
    if (p.dead !== lastDead) {
      lastDead = p.dead;
      death.hidden = !p.dead;
      deathWhere.textContent = p.instance
        ? "Your spirit will return to the crypt entrance."
        : "Your spirit will return to the nearest graveyard.";
      document.body.classList.toggle("is-dead", p.dead);
      if (p.dead) systemChat("You have died.", "system");
    }
  }

  function frame(enemyModels) {
    if (!state) return;
    const now = performance.now(),
      p = state.self;
    // Nameplates
    const live = new Set();
    for (const e of state.enemies) {
      if (e.hp <= 0) continue;
      const model = enemyModels.get(e.id);
      if (!model) continue;
      const dist = Math.hypot(e.x - p.x, e.z - p.z);
      if (dist > 42) continue;
      const pos = project(
        model.position.x,
        model.position.y + (model.userData.plateY ?? 1.95),
        model.position.z,
      );
      if (!pos) continue;
      live.add(e.id);
      let plate = plateMap.get(e.id);
      if (!plate) {
        const node = el("div", "cui-plate"),
          name = el("span", "cui-plate-name"),
          lvl = el("span", "cui-plate-level"),
          bar = el("div", "cui-plate-bar"),
          fill = el("i");
        bar.append(fill);
        node.append(name, bar, lvl);
        plates.append(node);
        plate = { node, name, lvl, fill };
        plateMap.set(e.id, plate);
      }
      plate.name.textContent = e.name;
      plate.lvl.textContent = e.level ?? 1;
      plate.lvl.style.color = levelColor(e.level ?? 1, p.level);
      plate.fill.style.width = `${(e.hp / (e.maxHp ?? 60)) * 100}%`;
      plate.node.classList.toggle("selected", e.id === selected);
      plate.node.classList.toggle("engaged", !!e.engaged);
      plate.node.classList.toggle("evading", !!e.evading);
      const scale = Math.max(0.7, Math.min(1, 18 / Math.max(dist, 1)));
      plate.node.style.transform = `translate(${pos.x}px, ${pos.y}px) translate(-50%, -100%) scale(${e.id === selected ? 1.12 : scale})`;
      plate.node.style.zIndex = String(1000 - Math.round(dist * 10));
    }
    for (const [id, plate] of plateMap)
      if (!live.has(id)) {
        plate.node.remove();
        plateMap.delete(id);
      }
    // Floating combat text
    for (let i = floating.length - 1; i >= 0; i--) {
      const f = floating[i],
        age = now - f.born;
      if (age > f.life) {
        f.node.remove();
        floating.splice(i, 1);
        continue;
      }
      const pos = project(f.x, f.y, f.z);
      if (!pos) {
        f.node.style.opacity = "0";
        continue;
      }
      const k = age / f.life;
      f.node.style.opacity = String(k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3);
      f.node.style.transform = `translate(${pos.x + f.drift * k}px, ${pos.y - k * 70}px) translate(-50%, -50%) scale(${f.node.classList.contains("crit") ? (age < 120 ? 1.8 - age / 300 : 1.4) : 1})`;
    }
    // Cast bar
    const c = p.casting;
    const ability = c && state.abilities.find((a) => a.id === c.ability);
    if (c && ability) {
      const total = c.endsAt - (c.startedAt ?? c.endsAt - (ability.castTime ?? 1)),
        done = Math.max(0, Math.min(1, (serverNow() - (c.startedAt ?? c.endsAt - total)) / total));
      castBar.hidden = false;
      castBar.className = "cui-cast";
      castFill.style.width = `${done * 100}%`;
      castName.textContent = ability.name;
      castTime.textContent = `${Math.max(0, (c.endsAt - serverNow()) / 1000).toFixed(1)}`;
      castFlash = { text: ability.name, kind: "complete", until: now + 350 };
    } else if (castFlash && now < castFlash.until) {
      castBar.hidden = false;
      castBar.className = `cui-cast ${castFlash.kind}`;
      castFill.style.width = "100%";
      castName.textContent = castFlash.text;
      castTime.textContent = "";
    } else {
      castBar.hidden = true;
      castFlash = null;
    }
  }

  return {
    update,
    frame,
    error,
    info,
    systemChat,
    setSelected(id) {
      selected = id;
    },
    serverNow,
    reset() {
      lastSubzone = null;
      lastLevel = null;
      lastDead = false;
      death.hidden = true;
      document.body.classList.remove("is-dead");
      for (const f of floating) f.node.remove();
      floating.length = 0;
      for (const plate of plateMap.values()) plate.node.remove();
      plateMap.clear();
    },
  };
}
