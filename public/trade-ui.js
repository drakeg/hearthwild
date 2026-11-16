// The trade window: both players put up to six items and some gold on the table. Changing an offer
// clears both confirmations; when both confirm, everything changes hands at once. A small popup
// answers a request to trade.
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
const MAX_ITEMS = 6;

export function createTradeUi({ getState, act, onOpen, focusWorld }) {
  const hud = document.getElementById("hud");
  const win = el("section", "guild-window trade-window");
  win.id = "trade-window";
  win.hidden = true;
  win.setAttribute("aria-label", "Trade");
  hud.append(win);
  const ask = el("div", "cui-popup finder-ready trade-ask");
  ask.hidden = true;
  ask.setAttribute("role", "alertdialog");
  const askText = el("p");
  ask.append(
    el("strong", "", "Trade request"),
    askText,
    button("Trade", () => act({ type: "trade", op: "accept" }), "cui-button"),
    button("Decline", () => act({ type: "trade", op: "decline" }), "cui-button cui-secondary"),
  );
  hud.append(ask);

  let fingerprint = "";
  const offer = (items, coins) => act({ type: "trade", op: "offer", items, coins });

  function side(title, s, mine, self) {
    const box = el("div", `trade-side${s.ok ? " confirmed" : ""}`);
    box.append(el("h3", "", title));
    const list = el("ul", "trade-items");
    for (let k = 0; k < MAX_ITEMS; k++) {
      const i = s.items[k],
        li = el("li", i ? `rarity-${(i.rarity ?? "common").toLowerCase()}` : "empty", i ? i.name : "—");
      if (i && mine)
        li.append(
          button("×", () => offer(s.items.filter((x) => x.id !== i.id).map((x) => x.id), s.coins), "trade-remove"),
        );
      list.append(li);
    }
    box.append(list);
    if (mine) {
      const gold = el("input");
      Object.assign(gold, { type: "number", min: 0, max: self.coins, value: s.coins, className: "trade-gold" });
      gold.setAttribute("aria-label", "Gold to offer");
      gold.onchange = () => offer(s.items.map((x) => x.id), Math.max(0, Math.min(self.coins, Math.floor(Number(gold.value) || 0))));
      const row = el("label", "trade-gold-row", "Gold ");
      row.append(gold);
      box.append(row);
    } else box.append(el("p", "trade-gold-row", `Gold: ${s.coins}`));
    box.append(el("p", "trade-status", s.ok ? "✔ Confirmed" : "Not confirmed"));
    return box;
  }

  function render(s) {
    const t = s.self.trade;
    if (!t?.mine) {
      if (!win.hidden) {
        win.hidden = true;
        focusWorld?.();
      }
      fingerprint = "";
      return;
    }
    if (win.hidden) {
      onOpen?.();
      win.hidden = false;
    }
    const key = JSON.stringify([t.mine, t.theirs, s.self.coins, s.self.inventory.length]);
    if (key === fingerprint) return;
    fingerprint = key;
    win.replaceChildren();
    const header = el("header", "gw-header"),
      title = el("div");
    title.append(el("h2", "", `Trading with ${t.theirs.name}`), el("small", "", "Stand close together. Both must confirm."));
    header.append(title, button("×", () => act({ type: "trade", op: "cancel" }), "gw-close"));
    header.lastChild.setAttribute("aria-label", "Cancel trade");
    const body = el("div", "gw-body trade-body"),
      table = el("div", "trade-table");
    table.append(side("Your offer", t.mine, true, s.self), side(`${t.theirs.name}’s offer`, t.theirs, false, s.self));
    body.append(table);
    // Your bags: click an item to put it on the table.
    const worn = new Set(Object.values(s.self.equipment ?? {})),
      offered = new Set(t.mine.items.map((i) => i.id)),
      bag = el("div", "trade-bag");
    body.append(el("label", "gw-label", "Your bags · click to offer"));
    for (const i of s.self.inventory.filter((i) => !worn.has(i.id) && !offered.has(i.id))) {
      const b = button(i.name, () => offer([...offered, i.id], t.mine.coins), `trade-bag-item rarity-${(i.rarity ?? "common").toLowerCase()}`);
      b.disabled = offered.size >= MAX_ITEMS;
      bag.append(b);
    }
    if (!bag.children.length) bag.append(el("p", "gw-hint", "Nothing in your bags to offer."));
    body.append(bag);
    const actions = el("div", "gw-actions"),
      confirm = button(t.mine.ok ? "Waiting for them…" : "Confirm trade", () => act({ type: "trade", op: "confirm" }));
    confirm.disabled = t.mine.ok;
    actions.append(confirm, button("Cancel", () => act({ type: "trade", op: "cancel" }), "gw-button gw-secondary"));
    body.append(actions, el("p", "gw-hint", "Changing either offer clears both confirmations. Treasure from bosses can’t be traded."));
    win.append(header, body);
  }

  function update(s) {
    const t = s.self.trade;
    ask.hidden = !t?.invite || !!t?.mine;
    if (t?.invite) askText.textContent = `${t.invite.from} wants to trade with you.`;
    render(s);
  }
  return {
    update,
    request: (name) => act({ type: "trade", op: "request", name }),
    isOpen: () => !win.hidden,
    close: () => act({ type: "trade", op: "cancel" }),
  };
}
