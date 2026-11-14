import { REAGENTS, REAGENT_IDS } from "./reagents.js";
const $ = (id) => document.getElementById(id),
  el = (tag, text, cls) => {
    const e = document.createElement(tag);
    if (text !== undefined) e.textContent = text;
    if (cls) e.className = cls;
    return e;
  };
export function servicesUi({ getState, act, stop, focusWorld }) {
  let mode = "buy",
    // A letter being written survives the window redrawing.
    draft = { to: "", subject: "", body: "", coins: "", item: "" },
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
    ["mail", "Mailbox"],
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
        p.mail,
        busy,
        near,
      ]);
    if (key === next) return;
    // Don't redraw the letter form under someone typing in it.
    if (mode === "mail" && body.querySelector(".mail-form")?.contains(document.activeElement) && !busy) return;
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
    if (mode === "mail") {
      const m = p.mail;
      body.append(el("h3", m.letters.length ? `Your letters (${m.letters.length})` : "Your mailbox is empty."));
      for (const letter of m.letters) {
        const attached = [letter.coins && `${letter.coins} gold`, letter.item && letter.item.name].filter(Boolean).join(" + ");
        row(
          `${letter.read ? "" : "● "}${letter.subject} — from ${letter.from}`,
          `${letter.body || "(no message)"}${attached ? ` · Attached: ${attached}` : ""} · ${new Date(letter.sentAt).toLocaleDateString()}`,
          [
            ...(attached ? [button(`Take ${attached}`, { type: "mail", op: "take", id: letter.id })] : []),
            button("Delete", { type: "mail", op: "delete", id: letter.id }, !!attached),
          ],
        );
        // Opening the mailbox marks letters as read.
        if (!letter.read) act({ type: "mail", op: "read", id: letter.id }).catch(() => {});
      }
      body.append(el("h3", "Send a letter"));
      const form = el("form", undefined, "mail-form"),
        field = (label, input) => {
          const l = el("label", label);
          l.append(input);
          form.append(l);
          return input;
        },
        input = (name, attrs = {}) => {
          const i = Object.assign(document.createElement(attrs.tag ?? "input"), attrs.props ?? {});
          i.value = draft[name];
          i.oninput = () => (draft[name] = i.value);
          return i;
        };
      field("To (character name)", input("to", { props: { maxLength: 24, required: true, autocomplete: "off" } }));
      field("Subject", input("subject", { props: { maxLength: 60 } }));
      field("Message", input("body", { tag: "textarea", props: { maxLength: 500, rows: 3 } }));
      field("Gold to send", input("coins", { props: { type: "number", min: 0, max: Math.max(0, p.coins - 1), placeholder: "0" } }));
      const pick = input("item", { tag: "select" }),
        worn = new Set(Object.values(p.equipment));
      pick.append(el("option", "No item"));
      pick.firstChild.value = "";
      for (const i of p.inventory.filter((i) => !worn.has(i.id))) {
        const o = el("option", `${i.name}${i.rarity ? ` (${i.rarity})` : ""}`);
        o.value = i.id;
        pick.append(o);
      }
      pick.value = draft.item;
      field("Attach an item", pick);
      const go = el("button", "Send (1 gold postage)");
      go.type = "submit";
      go.disabled = busy;
      form.append(go);
      form.onsubmit = async (e) => {
        e.preventDefault();
        if (busy) return;
        busy = true;
        try {
          const r = await act({ type: "mail", op: "send", to: draft.to, subject: draft.subject, body: draft.body, coins: Number(draft.coins || 0), item: draft.item || undefined });
          status.textContent = r.message ?? "Sent.";
          draft = { to: "", subject: "", body: "", coins: "", item: "" };
        } catch (err) {
          status.textContent = err.message;
        } finally {
          busy = false;
          key = "";
          update();
        }
      };
      body.append(form);
      body.append(el("p", "Treasure from dungeon and raid bosses stays with whoever won it, and can’t be mailed."));
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
      row("Starleaf", "2 gold per sprig · herb pouch", [
        button(
          "Buy Starleaf · 2g",
          { type: "buy", vendor, template: "starleaf" },
          p.coins < 2 || p.materials.starleaf >= 99,
        ),
      ]);
    }
    if (mode === "sell") {
      // Herbs: four Starleaf stay reserved while the gathering quest is active.
      const reserve = ["active", "ready"].includes(p.quests.starleaf.status) ? 4 : 0;
      for (const id of REAGENT_IDS) {
        const have = p.materials[id] ?? 0;
        if (!have) continue;
        const herb = REAGENTS[id],
          spare = Math.max(0, have - (id === "starleaf" ? reserve : 0));
        row(
          `${herb.name} ×${have}`,
          `${herb.value} gold each${id === "starleaf" && reserve ? " · Four reserved for your active quest" : ""}`,
          [
            button(`Sell ×1 · ${herb.value}g`, { type: "sell", vendor, item: `reagent-${id}`, quantity: 1 }, spare < 1),
            button(`Sell ×5 · ${herb.value * 5}g`, { type: "sell", vendor, item: `reagent-${id}`, quantity: 5 }, spare < 5),
            button(`Sell all · ${herb.value * spare}g`, { type: "sell", vendor, item: `reagent-${id}`, quantity: Math.max(1, spare) }, spare < 1),
          ],
        );
      }
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
          "Learn both professions free from Mira. Anyone can gather herbs; herbalists improve with every pick and often find a second sprig. Every zone has its own herb, so open the map (M) and turn on Herbs to find them. Craft draughts to improve Alchemy. Four Starleaf stay reserved while your gathering quest is active.",
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
      const reserve = ["active", "ready"].includes(p.quests.starleaf.status) ? 4 : 0,
        spare = (id) => (p.materials[id] ?? 0) - (id === "starleaf" ? reserve : 0);
      for (const [id, r] of Object.entries(s.recipes))
        row(
          r.name,
          `${Object.entries(r.herbs).map(([h, n]) => `${n} ${REAGENTS[h].name} (${p.materials[h] ?? 0})`).join(" + ")} → restores ${r.heal} health · Requires Alchemy ${r.skill}`,
          [
            button(
              `Craft ${r.name}`,
              { type: "craft", recipe: id },
              p.professions.alchemy < r.skill || Object.entries(r.herbs).some(([h, n]) => spare(h) < n),
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
