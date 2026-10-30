// Guild window (J): roster, ranks, message of the day, invitations, and the charter
// process for founding a new guild. Also shows guild invitation and charter signing popups.
const CLASS_NAME = { warrior: "Warrior", warlock: "Warlock", druid: "Druid", rogue: "Rogue" };
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

export function createGuildUi({ getState, act, onOpen, focusWorld }) {
  const win = el("section", "guild-window");
  win.id = "guild-window";
  win.hidden = true;
  win.setAttribute("aria-label", "Guild");
  document.getElementById("hud").append(win);
  let fingerprint = "",
    atRegistrar = false,
    confirmingDisband = false;

  // ---------- Popups: guild invitations and charter signatures ----------
  const popups = el("div", "gw-popups");
  document.getElementById("hud").append(popups);
  const popup = (title, yes, no, yesText) => {
    const box = el("div", "cui-popup gw-popup"),
      text = el("p");
    box.hidden = true;
    box.append(el("strong", "", title), text, button(yesText, yes, "cui-button"), button("Decline", no, "cui-button cui-secondary"));
    popups.append(box);
    return { box, text };
  };
  const invite = popup("Guild invitation", () => act({ type: "guild", op: "accept" }), () => act({ type: "guild", op: "decline" }), "Join");
  const sign = popup(
    "Guild charter",
    () => act({ type: "guild", op: "sign" }),
    () => act({ type: "guild", op: "decline-signature" }),
    "Sign",
  );

  function open(fromRegistrar = false) {
    atRegistrar = fromRegistrar;
    onOpen?.();
    win.hidden = false;
    fingerprint = "";
    render();
  }
  function close() {
    win.hidden = true;
    atRegistrar = false;
    confirmingDisband = false;
    focusWorld?.();
  }
  function toggle() {
    if (win.hidden) open();
    else close();
  }

  function header(title, subtitle) {
    const h = el("header", "gw-header");
    const t = el("div");
    t.append(el("h2", "", title));
    if (subtitle) t.append(el("small", "", subtitle));
    h.append(t, button("×", close, "gw-close"));
    h.lastChild.setAttribute("aria-label", "Close guild window");
    return h;
  }
  function nameForm(placeholder, action, label) {
    const f = el("form", "gw-form"),
      input = el("input");
    input.placeholder = placeholder;
    input.maxLength = 24;
    input.autocomplete = "off";
    f.append(input, el("button", "gw-button", label));
    f.onsubmit = async (e) => {
      e.preventDefault();
      if (!input.value.trim()) return;
      if (await action(input.value.trim())) input.value = "";
    };
    return f;
  }

  function renderCharter(s) {
    const c = s.self.charter;
    win.append(header("Found a guild", "Guild Registrar · Wayfarer’s Camp"));
    const body = el("div", "gw-body");
    if (!c) {
      body.append(
        el(
          "p",
          "",
          "A guild is a lasting company of adventurers from your faction, with its own chat, ranks and name shown beneath every member’s.",
        ),
      );
      const steps = el("ol", "gw-steps");
      for (const t of [
        "Buy a charter from the Guild Registrar (10 gold) and choose your guild’s name.",
        "Ask two adventurers of your faction who aren’t in a guild to sign it.",
        "Return the signed charter to the Registrar to found your guild. You become its Guild Master.",
      ])
        steps.append(el("li", "", t));
      body.append(steps);
      if (atRegistrar)
        body.append(
          el("label", "gw-label", "Guild name"),
          nameForm("e.g. Order of the Ember", (name) => act({ type: "guild", op: "buy-charter", name }), "Buy charter · 10 gold"),
        );
      else body.append(el("p", "gw-hint", "Visit Registrar Corwin Hale beside the campfire at Wayfarer’s Camp to begin."));
    } else {
      const done = c.signatures.length >= c.needed;
      body.append(el("p", "gw-charter-name", `Charter: <${c.name}>`));
      const sig = el("div", "gw-signatures");
      for (let i = 0; i < c.needed; i++) sig.append(el("span", c.signatures[i] ? "signed" : "", c.signatures[i] ?? "Awaiting signature"));
      for (const extra of c.signatures.slice(c.needed)) sig.append(el("span", "signed", extra));
      body.append(el("small", "gw-label", `Signatures ${Math.min(c.signatures.length, c.needed)} / ${c.needed}`), sig);
      if (!done)
        body.append(
          el("label", "gw-label", "Ask someone to sign"),
          nameForm("Adventurer’s name", (name) => act({ type: "guild", op: "request-signature", name }), "Request"),
          el("p", "gw-hint", "Tip: click another adventurer and choose “Ask to sign charter”."),
        );
      const actions = el("div", "gw-actions");
      const found = button("Found guild", () => act({ type: "guild", op: "found" }));
      found.disabled = !done || !atRegistrar;
      actions.append(found, button("Tear up charter", () => act({ type: "guild", op: "abandon-charter" }), "gw-button gw-secondary"));
      body.append(actions);
      if (done && !atRegistrar) body.append(el("p", "gw-hint", "Your charter is ready. Bring it to the Guild Registrar at Wayfarer’s Camp."));
    }
    win.append(body);
  }

  function renderGuild(s) {
    const g = s.self.guildInfo,
      officer = g.rank <= 1,
      online = g.members.filter((m) => m.online).length;
    win.append(header(`<${g.name}>`, `${g.members.length} members · ${online} online · You are ${g.rankName}`));
    const body = el("div", "gw-body");
    // Message of the day.
    const motd = el("div", "gw-motd");
    motd.append(el("small", "gw-label", "Message of the day"));
    if (!officer) motd.append(el("p", g.motd ? "" : "gw-hint", g.motd || "No message set."));
    else {
      const f = el("form", "gw-form"),
        input = el("input");
      input.maxLength = 160;
      input.placeholder = "Set a new message";
      input.value = g.motd;
      f.append(input, el("button", "gw-button", "Save"));
      f.onsubmit = (e) => {
        e.preventDefault();
        act({ type: "guild", op: "motd", text: input.value });
      };
      motd.append(f);
    }
    body.append(motd);
    // Roster.
    const table = el("table", "gw-roster"),
      head = el("tr");
    for (const h of ["Name", "Level", "Class", "Rank", "Location", ""]) head.append(el("th", "", h));
    table.append(head);
    for (const m of g.members) {
      const tr = el("tr", m.online ? "online" : "offline");
      tr.append(
        el("td", "gw-name", m.name),
        el("td", "", String(m.level)),
        el("td", `class-${m.classId}`, CLASS_NAME[m.classId] ?? m.classId),
        el("td", m.rank === 0 ? "gw-gm" : "", g.ranks[m.rank]),
        el("td", "", m.online ? m.zone : "Offline"),
      );
      const tools = el("td", "gw-tools");
      if (m.id !== s.self.id && officer && m.rank > g.rank) {
        if (m.rank - 1 > g.rank) tools.append(button("▲", () => act({ type: "guild", op: "promote", name: m.name }), "gw-mini"));
        if (m.rank < 3) tools.append(button("▼", () => act({ type: "guild", op: "demote", name: m.name }), "gw-mini"));
        tools.append(button("Remove", () => act({ type: "guild", op: "kick", name: m.name }), "gw-mini gw-danger"));
      }
      if (m.id !== s.self.id && g.rank === 0)
        tools.append(button("Make GM", () => act({ type: "guild", op: "leader", name: m.name }), "gw-mini"));
      for (const b of tools.querySelectorAll("button")) b.title = `${b.textContent === "▲" ? "Promote" : b.textContent === "▼" ? "Demote" : b.textContent} ${m.name}`;
      tr.append(tools);
      table.append(tr);
    }
    const wrap = el("div", "gw-roster-wrap");
    wrap.append(table);
    body.append(wrap);
    if (officer)
      body.append(
        el("label", "gw-label", "Invite to guild"),
        nameForm("Adventurer’s name", (name) => act({ type: "guild", op: "invite", name }), "Invite"),
      );
    const actions = el("div", "gw-actions");
    actions.append(button("Leave guild", () => act({ type: "guild", op: "leave" }), "gw-button gw-secondary"));
    if (g.rank === 0) {
      if (!confirmingDisband)
        actions.append(
          button("Disband…", () => {
            confirmingDisband = true;
            fingerprint = "";
            render();
          }, "gw-button gw-danger"),
        );
      else {
        const f = nameForm(`Type “${g.name}” to confirm`, (confirm) => act({ type: "guild", op: "disband", confirm }), "Disband");
        f.querySelector("input").maxLength = 24;
        actions.append(f);
      }
    }
    body.append(actions);
    body.append(el("p", "gw-hint", "Chat: /g for guild, /o for officers. Commands: /ginvite, /gpromote, /gdemote, /gkick, /gleader, /gmotd, /gquit."));
    win.append(body);
  }

  function render() {
    const s = getState();
    if (!s || win.hidden) return;
    const key = JSON.stringify([s.self.guildInfo, s.self.charter, atRegistrar, confirmingDisband]);
    if (key === fingerprint) return;
    // Don't redraw while the player is typing into one of the window's fields.
    if (win.contains(document.activeElement) && document.activeElement.tagName === "INPUT" && fingerprint) return;
    fingerprint = key;
    win.replaceChildren();
    if (s.self.guildInfo) renderGuild(s);
    else renderCharter(s);
  }

  function update(s) {
    invite.box.hidden = !s.self.guildInvite;
    if (s.self.guildInvite) invite.text.textContent = `${s.self.guildInvite.from} invites you to join <${s.self.guildInvite.name}>.`;
    sign.box.hidden = !s.self.charterRequest;
    if (s.self.charterRequest)
      sign.text.textContent = `${s.self.charterRequest.from} asks you to sign the charter for <${s.self.charterRequest.name}>. Signers become founding members.`;
    if (atRegistrar && s.self.subzone !== "Wayfarer’s Camp") atRegistrar = false;
    render();
  }

  return {
    open,
    close,
    toggle,
    update,
    isOpen: () => !win.hidden,
    element: win,
  };
}
