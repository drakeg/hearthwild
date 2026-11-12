// Dungeon Finder window (O): choose a role and dungeons, join the queue alone or as a group,
// and answer the ready check when a group is found. A small banner shows time in the queue.
import { DUNGEON_LIST } from "./dungeon-layout.js";
import { ZONES } from "./terrain.js";

const ROLE_NAMES = { tank: "Tank", healer: "Healer", damage: "Damage" };
const ROLE_HELP = {
  tank: "Hold the enemies’ attention and keep them on you.",
  healer: "Keep the group alive.",
  damage: "Bring the enemies down.",
};
const el = (tag, className, text) => {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text !== undefined) e.textContent = text;
  return e;
};
const button = (text, onclick, className = "gw-button") => {
  const b = el("button", className, text);
  b.type = "button";
  b.onclick = onclick;
  return b;
};
const clock = (ms) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

export function createFinderUi({ getState, act, serverNow, onOpen, focusWorld }) {
  const hud = document.getElementById("hud");
  const win = el("section", "guild-window finder-window");
  win.id = "finder-window";
  win.hidden = true;
  win.setAttribute("aria-label", "Dungeon Finder");
  hud.append(win);
  // The ready check and the queue banner live outside the window.
  const ready = el("div", "cui-popup finder-ready");
  ready.hidden = true;
  ready.setAttribute("role", "alertdialog");
  const readyTitle = el("strong", "", "Your group is ready!"),
    readyText = el("p"),
    readyRoster = el("ul", "finder-roster"),
    readyTimer = el("div", "finder-timer"),
    readyFill = el("span");
  readyTimer.append(readyFill);
  const accept = button("Enter dungeon", () => act({ type: "finder", op: "accept" }), "cui-button"),
    decline = button("Decline", () => act({ type: "finder", op: "decline" }), "cui-button cui-secondary");
  ready.append(readyTitle, readyText, readyRoster, readyTimer, accept, decline);
  hud.append(ready);
  const banner = el("button", "finder-banner");
  banner.type = "button";
  banner.hidden = true;
  banner.onclick = () => open();
  hud.append(banner);

  let chosen = null,
    fingerprint = "";
  function open() {
    onOpen?.();
    win.hidden = false;
    fingerprint = "";
    render();
  }
  function close() {
    win.hidden = true;
    focusWorld?.();
  }
  const toggle = () => (win.hidden ? open() : close());

  function render() {
    const s = getState();
    if (!s || win.hidden) return;
    const f = s.self.finder,
      key = JSON.stringify([f, s.self.level, s.self.party?.leader, chosen && [...chosen]]);
    if (key === fingerprint) return updateClock(s);
    fingerprint = key;
    win.replaceChildren();
    const header = el("header", "gw-header"),
      title = el("div");
    title.append(el("h2", "", "Dungeon Finder"), el("small", "", "Find a group for any dungeon you’re ready for"));
    header.append(title, button("×", close, "gw-close"));
    header.lastChild.setAttribute("aria-label", "Close Dungeon Finder");
    const body = el("div", "gw-body finder-body");
    win.append(header, body);
    if (s.self.instance) {
      body.append(el("p", "gw-hint", "You’re inside a dungeon. The Finder will be here when you come back out."));
      return;
    }
    const party = s.self.party,
      leader = !party || party.leader === s.self.id,
      queued = f.queued;
    // Role.
    body.append(el("label", "gw-label", "Your role"));
    const roles = el("div", "finder-roles");
    for (const r of f.roles) {
      const b = button("", () => act({ type: "finder", op: "role", role: r }), `finder-role${f.role === r ? " active" : ""}`);
      b.append(el("strong", "", ROLE_NAMES[r]), el("small", "", ROLE_HELP[r]));
      b.setAttribute("aria-pressed", f.role === r);
      roles.append(b);
    }
    body.append(roles);
    // Dungeons.
    chosen ??= new Set(queued?.dungeons ?? f.eligible.filter((id) => DUNGEON_LIST.find((d) => d.id === id).bossLevel >= s.self.level - 3).slice(-2));
    body.append(el("label", "gw-label", queued ? "Searching for" : "Dungeons"));
    const list = el("div", "finder-dungeons");
    for (const d of DUNGEON_LIST) {
      const ok = f.eligible.includes(d.id),
        row = el("label", `finder-dungeon${ok ? "" : " locked"}`),
        box = el("input");
      box.type = "checkbox";
      box.checked = queued ? queued.dungeons.includes(d.id) : chosen.has(d.id);
      box.disabled = !ok || !!queued;
      box.onchange = () => {
        box.checked ? chosen.add(d.id) : chosen.delete(d.id);
        fingerprint = "";
        render();
      };
      const [lo] = d.levels ?? [1];
      row.append(box, el("span", "finder-name", d.raid ? `${d.name} · Raid` : d.name), el("span", "finder-meta", d.raid ? `${ZONES[d.zone].name} · 10 players · level ${d.minLevel}+` : `${ZONES[d.zone ?? "stillwood"].name} · levels ${lo}–${d.bossLevel}`));
      if (!ok) row.title = `Opens at level ${d.minLevel ?? lo - 1}`;
      list.append(row);
    }
    body.append(list);
    // Queue controls.
    const actions = el("div", "gw-actions");
    if (queued) {
      body.append(el("p", "finder-status", `Searching… ${clock(serverNow() - queued.since)} in the queue.`));
      if (f.waiting) body.append(el("p", "gw-hint", `Also waiting for these dungeons: ${f.waiting.tank} tank, ${f.waiting.healer} healer, ${f.waiting.damage} damage. A group needs one tank, one healer and three damage; after a minute and a half, a tank, a healer and one more will do.`));
      if (queued.leader) actions.append(button("Leave queue", () => act({ type: "finder", op: "leave" }), "gw-button gw-secondary"));
      else body.append(el("p", "gw-hint", "Your group leader queued the group."));
    } else {
      const go = button(party ? `Queue my group (${party.members.length})` : "Find a group", () => act({ type: "finder", op: "queue", dungeons: [...chosen], role: f.role }));
      go.disabled = !chosen.size || !leader;
      actions.append(go);
      if (!leader) body.append(el("p", "gw-hint", "Only your group’s leader can queue the group."));
      body.append(el("p", "gw-hint", "When a group is found, everyone gets a ready check. Accept, and you’re carried straight into a fresh copy of the dungeon. Walk out through the portal to return here. Finishing the dungeon pays a bonus satchel of gold and experience."));
    }
    body.append(actions);
    updateClock(s);
  }
  function updateClock(s) {
    const st = win.querySelector(".finder-status");
    if (st && s.self.finder.queued) st.textContent = `Searching… ${clock(serverNow() - s.self.finder.queued.since)} in the queue.`;
  }

  function update(s) {
    const f = s.self.finder;
    // Queue banner.
    banner.hidden = !f.queued || !!f.proposal;
    if (f.queued) banner.textContent = `Dungeon Finder · ${clock(serverNow() - f.queued.since)}`;
    // Ready check.
    const pr = f.proposal;
    // The ready check takes over from the window.
    if (pr && ready.hidden && !win.hidden) close();
    ready.hidden = !pr;
    if (pr) {
      const d = DUNGEON_LIST.find((d) => d.id === pr.dungeon);
      readyText.textContent = `${d.name} · ${pr.accepted} of ${pr.size} ready`;
      const roster = JSON.stringify(pr.members);
      if (readyRoster.dataset.key !== roster) {
        readyRoster.dataset.key = roster;
        readyRoster.replaceChildren(...pr.members.map((m) => el("li", `finder-${m.role}`, `${m.name} · ${ROLE_NAMES[m.role]}`)));
      }
      readyFill.style.width = `${Math.max(0, Math.min(100, ((pr.deadline - serverNow()) / pr.total) * 100))}%`;
      accept.disabled = decline.disabled = pr.ready;
      accept.textContent = pr.ready ? "Waiting for the others…" : "Enter dungeon";
    }
    if (!f.queued) chosen = chosen && !win.hidden ? chosen : null;
    render();
  }
  return { open, close, toggle, update, isOpen: () => !win.hidden };
}
