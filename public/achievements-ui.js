// Achievements window (Y): every achievement by category, with progress toward the ones still to
// earn, your points, and a choice of title from the ones you've unlocked.
import { ACHIEVEMENTS, CATEGORIES, TITLES, titled } from "./achievements.js";

const el = (tag, className, text) => {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text !== undefined) e.textContent = text;
  return e;
};
const day = (ms) => new Date(ms).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });

export function createAchievementsUi({ act, onOpen, focusWorld }) {
  const hud = document.getElementById("hud");
  const win = el("section", "guild-window achievements-window");
  win.id = "achievements-window";
  win.hidden = true;
  win.setAttribute("aria-label", "Achievements");
  hud.append(win);
  let state = null,
    fingerprint = "",
    category = CATEGORIES[0];

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

  function render() {
    if (!state || win.hidden) return;
    const p = state.self,
      got = p.achievements ?? {},
      key = JSON.stringify([got, p.titleId, category, p.level, p.kills, p.tally, p.explored?.length, p.professions, p.coins, p.partyId]);
    if (key === fingerprint) return;
    fingerprint = key;
    win.replaceChildren();
    const earned = ACHIEVEMENTS.filter((a) => got[a.id]),
      points = earned.reduce((n, a) => n + a.points, 0),
      total = ACHIEVEMENTS.reduce((n, a) => n + a.points, 0);
    const header = el("header", "gw-header"),
      title = el("div");
    title.append(el("h2", "", "Achievements"), el("small", "", `${earned.length} of ${ACHIEVEMENTS.length} earned · ${points} / ${total} points`));
    const x = el("button", "gw-close", "×");
    x.type = "button";
    x.onclick = close;
    x.setAttribute("aria-label", "Close achievements");
    header.append(title, x);
    const body = el("div", "gw-body achievements-body");
    // Title choice.
    const row = el("label", "ach-title-row", "Title "),
      pick = el("select");
    pick.append(new Option("No title", ""));
    for (const [id, t] of Object.entries(TITLES)) if (got[id]) pick.append(new Option(titled(p.name, t), id));
    pick.value = p.titleId ?? "";
    pick.disabled = pick.options.length === 1;
    pick.onchange = () => act({ type: "title", id: pick.value || undefined });
    row.append(pick);
    if (pick.disabled) row.append(el("small", "", " Earn achievements marked with a title to unlock them."));
    body.append(row);
    // Category tabs.
    const tabs = el("div", "ach-tabs");
    tabs.setAttribute("role", "tablist");
    for (const c of CATEGORIES) {
      const list = ACHIEVEMENTS.filter((a) => a.category === c),
        b = el("button", `ach-tab${c === category ? " active" : ""}`, `${c} ${list.filter((a) => got[a.id]).length}/${list.length}`);
      b.type = "button";
      b.setAttribute("role", "tab");
      b.setAttribute("aria-selected", c === category);
      b.onclick = () => {
        category = c;
        fingerprint = "";
        render();
      };
      tabs.append(b);
    }
    body.append(tabs);
    const list = el("ul", "ach-list");
    for (const a of ACHIEVEMENTS.filter((a) => a.category === category)) {
      const done = !!got[a.id],
        have = Math.min(a.goal, a.progress(p)),
        li = el("li", `ach${done ? " earned" : ""}`),
        text = el("div", "ach-text");
      text.append(el("strong", "", a.name), el("span", "", a.text));
      if (a.title) text.append(el("em", "", `Title: ${titled(p.name, a.title)}`));
      const side = el("div", "ach-side");
      side.append(el("b", "ach-points", String(a.points)));
      if (done) side.append(el("small", "", day(got[a.id])));
      else if (a.goal > 1) {
        const bar = el("div", "ach-bar"),
          fill = el("span");
        fill.style.width = `${(have / a.goal) * 100}%`;
        bar.append(fill);
        bar.title = `${have} / ${a.goal}`;
        side.append(bar, el("small", "", `${have.toLocaleString()} / ${a.goal.toLocaleString()}`));
      }
      li.append(text, side);
      list.append(li);
    }
    body.append(list);
    win.append(header, body);
  }

  return {
    open,
    close,
    toggle: () => (win.hidden ? open() : close()),
    isOpen: () => !win.hidden,
    update(s) {
      state = s;
      render();
    },
  };
}
