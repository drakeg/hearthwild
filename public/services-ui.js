const $ = (id) => document.getElementById(id),
  el = (tag, text, cls) => {
    const e = document.createElement(tag);
    if (text !== undefined) e.textContent = text;
    if (cls) e.className = cls;
    return e;
  };
export function servicesUi({ getState, act, stop, focusWorld }) {
  let mode = "buy",
    vendor = null,
    key = "",
    busy = false;
  const panel = el("section", undefined, "window services-window");
  panel.id = "services-window";
  panel.hidden = true;
  panel.setAttribute("aria-label", "Merchants and professions");
  const head = el("header"),
    title = el("h2", "Trade & professions"),
    close = el("button", "×");
  close.setAttribute("aria-label", "Close trade and professions");
  head.append(title, close);
  const tabs = el("nav"),
    body = el("div", undefined, "services-body"),
    status = el("p", "", "services-status");
  status.setAttribute("role", "status");
  panel.append(head, tabs, body, status);
  $("hud").append(panel);
  const tabButtons = {};
  for (const [id, name] of [
    ["buy", "Buy"],
    ["sell", "Sell"],
    ["buyback", "Buyback"],
    ["professions", "Professions"],
  ]) {
    const b = el("button", name);
    b.onclick = () => {
      mode = id;
      key = "";
      update();
    };
    tabs.append(b);
    tabButtons[id] = b;
  }
  function dismiss() {
    panel.hidden = true;
    focusWorld();
  }
  close.onclick = dismiss;
  async function send(a) {
    if (busy) return;
    busy = true;
    key = "";
    update();
    try {
      const r = await act(a);
      status.textContent = r.message ?? "Done.";
    } catch (e) {
      status.textContent = e.message;
    } finally {
      busy = false;
      key = "";
      update();
    }
  }
  function button(label, action, disabled = false) {
    const b = el("button", label);
    b.disabled = busy || disabled;
    b.onclick = () => send(action);
    return b;
  }
  function row(name, detail, buttons) {
    const r = el("article", undefined, "service-row"),
      copy = el("div");
    copy.append(el("strong", name), el("small", detail));
    r.append(copy, ...buttons);
    body.append(r);
  }
  function update() {
    if (panel.hidden) return;
    const s = getState();
    if (!s) return;
    const p = s.self,
      npc = s.npcs.find((n) => n.id === vendor),
      near = npc && Math.hypot(p.x - npc.x, p.z - npc.z) <= 4.5,
      next = JSON.stringify([
        mode,
        vendor,
        p.coins,
        p.inventory,
        p.buyback,
        p.materials,
        p.professions,
        busy,
        near,
      ]);
    if (key === next) return;
    key = next;
    title.textContent =
      mode === "professions"
        ? "Professions"
        : `${npc?.name ?? "Merchant"} · ${p.coins} gold`;
    body.replaceChildren();
    for (const [id, b] of Object.entries(tabButtons)) {
      b.classList.toggle("active", mode === id);
      b.disabled = busy || (id !== "professions" && !vendor);
    }
    if (mode !== "professions" && !near) {
      body.append(el("p", "Talk to Torren or Mira at camp to buy and sell."));
      return;
    }
    if (mode === "buy") {
      for (const item of s.shop)
        row(
          item.name,
          `${item.buy} gold · ${item.slot === "consumable" ? `Restores ${item.heal} health` : `+${item.damage} damage · +${item.armor} armor · +${item.maxHp} health`}`,
          [
            button(
              `Buy · ${item.buy}g`,
              { type: "buy", vendor, template: item.template },
              p.coins < item.buy || p.inventory.length >= 60,
            ),
          ],
        );
      row("Starleaf", "2 gold per sprig · reagent pouch", [
        button(
          "Buy Starleaf · 2g",
          { type: "buy", vendor, template: "starleaf" },
          p.coins < 2 || p.materials.starleaf >= 99,
        ),
      ]);
    }
    if (mode === "sell") {
      const reserve = ["active", "ready"].includes(p.quests.starleaf.status)
          ? 4
          : 0,
        surplus = Math.max(0, p.materials.starleaf - reserve);
      row(
        `Starleaf ×${p.materials.starleaf}`,
        reserve
          ? "Four sprigs reserved for your active quest. Selling grants 1 gold per sprig."
          : "1 gold per sprig.",
        [
          button(
            "Sell Starleaf ×1 · 1g",
            { type: "sell", vendor, item: "reagent-starleaf", quantity: 1 },
            surplus < 1,
          ),
          button(
            "Sell Starleaf ×5 · 5g",
            { type: "sell", vendor, item: "reagent-starleaf", quantity: 5 },
            surplus < 5,
          ),
        ],
      );
      for (const item of p.inventory) {
        const price = s.shop.find((i) => i.template === item.template)?.sell,
          worn = Object.values(p.equipment).includes(item.id);
        row(
          item.name,
          `${price} gold${worn ? " · Equipped; replace it before selling." : ""}`,
          [
            button(
              `Sell ${item.name} · ${price}g`,
              { type: "sell", vendor, item: item.id },
              worn,
            ),
          ],
        );
      }
      if (!p.inventory.length)
        body.append(
          el("p", "Spare gear and crafted potions can be sold here."),
        );
    }
    if (mode === "buyback") {
      if (!p.buyback.length)
        body.append(
          el(
            "p",
            "The last ten items you sell appear here for buyback at the price paid to you.",
          ),
        );
      for (const i of p.buyback)
        row(i.name, `${i.price} gold`, [
          button(
            `Buy back ${i.name} · ${i.price}g`,
            { type: "buyback", vendor, item: i.id },
            p.coins < i.price,
          ),
        ]);
    }
    if (mode === "professions") {
      body.append(
        el(
          "p",
          "Learn both professions free from Mira. Gather Starleaf to improve Herbalism; craft draughts to improve Alchemy. Four herbs stay reserved while your gathering quest is active.",
        ),
      );
      for (const id of ["herbalism", "alchemy"])
        row(
          id === "herbalism" ? "Herbalism" : "Alchemy",
          p.professions[id]
            ? `Skill ${p.professions[id]} / 100`
            : "Not learned · Speak to Mira at camp.",
          [
            button(
              p.professions[id] ? "Learned" : "Learn free",
              { type: "learn", vendor: "herbalist", profession: id },
              !!p.professions[id] || vendor !== "herbalist" || !near,
            ),
          ],
        );
      for (const [id, r] of Object.entries(s.recipes))
        row(
          r.name,
          `${r.herbs} Starleaf → 1 draught · restores ${r.heal} health · Requires Alchemy ${r.skill}`,
          [
            button(
              `Craft ${r.name}`,
              { type: "craft", recipe: id },
              p.professions.alchemy < r.skill ||
                p.materials.starleaf -
                  (["active", "ready"].includes(p.quests.starleaf.status)
                    ? 4
                    : 0) <
                  r.herbs,
            ),
          ],
        );
      body.append(
        el(
          "p",
          "Craft anywhere with K. Use healing draughts from Bags; potions share a 20-second cooldown.",
        ),
      );
    }
  }
  return {
    open(next = "buy", npc = null) {
      stop();
      vendor = npc;
      mode = next;
      panel.hidden = false;
      key = "";
      status.textContent = "";
      update();
      close.focus();
    },
    close: dismiss,
    isOpen: () => !panel.hidden,
    update,
  };
}
