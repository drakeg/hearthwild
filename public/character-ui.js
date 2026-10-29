import { iconStyle } from "./hud.js";
const $ = (id) => document.getElementById(id),
  el = (tag, text) => {
    const e = document.createElement(tag);
    e.textContent = text;
    return e;
  };
export function characterUi({
  getState,
  closeOthers,
  clearMovement,
  focusWorld,
}) {
  let fingerprint = "";
  function update() {
    const s = getState();
    if (!s || $("character-sheet").hidden) return;
    const p = s.self,
      key = JSON.stringify([
        p.level,
        p.xp,
        p.stats,
        p.hp,
        p.power,
        p.equipment,
        p.inventory,
        p.professions,
        p.quests,
      ]);
    if (key === fingerprint) return;
    fingerprint = key;
    $("sheet-name").textContent = p.name + " · Character";
    $("character-info").replaceChildren();
    const baseDamage = 20 + (p.level - 1) * 2,
      baseHealth = 100 + (p.level - 1) * 10;
    const rows = [
      ["Class", `Level ${p.level} ${s.classes[p.classId].name}`],
      ["Allegiance", p.faction === "dawnward" ? "Dawnward" : "Mossbound"],
      ["Experience", `${p.xp} / ${p.xpNeeded} to next level`],
      ["Health", `${Math.ceil(p.hp)} / ${p.stats.maxHp}`],
      [s.classes[p.classId].resource, `${Math.floor(p.power)} / 100`],
      [
        "Weapon damage",
        `${p.stats.damage} (${baseDamage} base + ${p.stats.damage - baseDamage} gear)`,
      ],
      ["Armor", `${p.stats.armor} · reduces each creature hit`],
      ["Bonus health", `+${p.stats.maxHp - baseHealth} from equipped items`],
      ["Creatures defeated", String(p.kills)],
      [
        "Completed quests",
        String(
          Object.values(p.quests).filter((q) => q.status === "complete").length,
        ),
      ],
      ["Herbalism", `${p.professions.herbalism}/100`],
      ["Alchemy", `${p.professions.alchemy}/100`],
      ["Gold", String(p.coins)],
    ];
    const dl = el("dl", "");
    for (const [name, value] of rows)
      dl.append(el("dt", name), el("dd", value));
    $("character-info").append(dl);
    $("worn-items").replaceChildren();
    for (const slot of ["weapon", "chest", "charm"]) {
      const item = p.inventory.find((i) => i.id === p.equipment[slot]),
        b = el("button", "");
      const icon = el("span", "");
      icon.className = "gear-icon";
      if (item)
        Object.assign(
          icon.style,
          iconStyle(slot === "weapon" ? 0 : slot === "chest" ? 2 : 11),
        );
      const text = el(
        "span",
        `${slot.toUpperCase()}\n${item ? item.name : "Empty slot"}`,
      );
      b.append(icon, text);
      b.title = item
        ? `${item.rarity}: +${item.damage} damage, +${item.armor} armor, +${item.maxHp} health`
        : "Equip an item from Bags";
      b.onclick = () => {
        $("character-help").textContent = item
          ? `${item.name}: +${item.damage} damage · +${item.armor} armor · +${item.maxHp} maximum health`
          : "Find loot and equip it from your backpack.";
      };
      $("worn-items").append(b);
    }
  }
  function toggle() {
    const open = $("character-sheet").hidden;
    closeOthers();
    clearMovement();
    $("bag").hidden = true;
    $("character-sheet").hidden = !open;
    fingerprint = "";
    if (open) {
      update();
      $("character-close").focus();
    } else focusWorld();
  }
  $("character-close").onclick = () => {
    $("character-sheet").hidden = true;
    focusWorld();
  };
  return { toggle, update };
}
