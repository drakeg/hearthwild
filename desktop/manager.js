// The Server Manager window. Everything it does goes through window.serverManager (see
// manager-preload.cjs), and the main process checks every request.
const api = window.serverManager;
const $ = (id) => document.getElementById(id);
const CLASSES = { warrior: "Warrior", warlock: "Warlock", druid: "Druid", rogue: "Rogue" };
let last = null,
  editing = false;

const since = (ms) => {
  const m = Math.floor(ms / 60000),
    h = Math.floor(m / 60);
  return h ? `up ${h} h ${m % 60} min` : `up ${m} min`;
};
const time = (t) => new Date(t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
function el(tag, text, className) {
  const e = document.createElement(tag);
  if (text !== undefined) e.textContent = text;
  if (className) e.className = className;
  return e;
}

function render(s) {
  last = s;
  const pill = $("pill");
  pill.textContent = s.external ? "Development server" : s.running ? (s.shared ? "Running · shared" : "Running · this computer") : "Stopped";
  pill.className = `pill ${s.external ? "dev" : s.running ? "on" : "off"}`;
  $("uptime").textContent = s.running ? since(s.uptime) : "";
  const notice = s.external ? s.message : s.error;
  $("notice").hidden = !notice;
  $("notice").textContent = notice ?? "";
  $("start").disabled = s.external || s.running;
  $("stop").disabled = s.external || !s.running;
  $("restart").disabled = s.external || !s.running;
  for (const b of $("settings").querySelectorAll("input, button")) b.disabled = !!s.external;

  // Invite friends.
  const invite = $("invite");
  invite.replaceChildren();
  if (!s.running) invite.append(el("p", "Start the server to see its address.", "muted"));
  else if (!s.shared) invite.append(el("p", "Only this computer can play right now. Turn on “Share with my network” below, then restart, to let friends join.", "muted"));
  else {
    if (!s.addresses.length) invite.append(el("p", "No network connection found. Connect to Wi-Fi or a network first.", "muted"));
    for (const a of s.addresses) {
      const row = el("div", undefined, "address"),
        copy = el("button", "Copy");
      copy.onclick = async () => {
        await api.copy(a);
        copy.textContent = "Copied";
        setTimeout(() => (copy.textContent = "Copy"), 1500);
      };
      row.append(el("code", a), copy);
      invite.append(row);
    }
    invite.append(
      el(
        "p",
        s.tls
          ? "Friends open this address in their web browser to play."
          : "Without an HTTPS certificate, friends can reach the server but can’t sign in. Add a certificate in Settings.",
        s.tls ? "hint" : "warning",
      ),
    );
  }

  // Players.
  const body = $("players").tBodies[0];
  body.replaceChildren(
    ...s.players.map((p) => {
      const tr = el("tr");
      const actions = el("td", undefined, "actions"),
        kick = el("button", "Kick"),
        ban = el("button", "Ban", "danger");
      kick.onclick = () => confirm(`Remove ${p.name} from the world? They can come back in.`) && act(api.kick(p.name), `Removed ${p.name}.`);
      ban.disabled = !p.account;
      ban.title = p.account ? `Ban the account ${p.account}` : "This character has no account";
      ban.onclick = () => {
        const reason = prompt(`Ban the account “${p.account}” (all its characters)? Optional reason:`, "");
        if (reason !== null) act(api.ban(p.account, reason), `Banned ${p.account}.`);
      };
      actions.append(kick, ban);
      tr.append(el("td", p.name), el("td", String(p.level)), el("td", CLASSES[p.classId] ?? p.classId), el("td", p.where), actions);
      return tr;
    }),
  );
  $("count").textContent = s.players.length;
  $("players").hidden = !s.players.length;
  $("nobody").hidden = !!s.players.length;

  // Settings (left alone while being edited).
  if (!editing) {
    $("share").checked = s.config.share;
    $("port").value = s.config.port;
    $("cert").value = s.config.tlsCert;
    $("key").value = s.config.tlsKey;
    $("signatures").value = s.config.charterSignatures;
  }
  $("folder").textContent = s.dataDir ?? "";
  const bans = s.bans ?? [];
  $("bans").replaceChildren(
    ...(bans.length
      ? bans.map((b) => {
          const li = el("li"),
            lift = el("button", "Lift ban");
          lift.onclick = () => act(api.unban(b.username), `Lifted the ban on ${b.username}.`);
          li.append(el("strong", b.username), el("span", ` · ${new Date(b.at).toLocaleDateString()}${b.reason ? ` · ${b.reason}` : ""}`, "muted"), lift);
          return li;
        })
      : [el("li", "Nobody is banned.", "muted")]),
  );
  for (const f of ["announce-form", "ban-form", "reset-form"]) for (const c of $(f).elements) c.disabled = !s.running || !!s.external;
  $("activity").replaceChildren(
    ...[...s.activity].reverse().map((a) => {
      const li = el("li");
      li.append(el("time", time(a.t)), el("span", a.text));
      return li;
    }),
  );
}
async function refresh() {
  render(await api.status());
}
const busy = async (button, work) => {
  button.disabled = true;
  try {
    const r = await work();
    if (r?.error) alertError(r.error);
  } finally {
    await refresh();
  }
};
function alertError(text) {
  $("notice").hidden = false;
  $("notice").textContent = text;
}

$("start").onclick = () => busy($("start"), api.start);
$("restart").onclick = () => busy($("restart"), api.restart);
$("stop").onclick = () => {
  if (last?.players.length && !confirm(`Stop the server? ${last.players.length} player(s) will be disconnected.`)) return;
  busy($("stop"), api.stop);
};
$("open-folder").onclick = () => api.openFolder();
$("backup").onclick = () => busy($("backup"), api.backup);
for (const b of document.querySelectorAll("[data-pick]"))
  b.onclick = async () => {
    const r = await api.pick(b.dataset.pick);
    if (r?.path) {
      $(b.dataset.pick).value = r.path;
      editing = true;
    }
  };
for (const b of document.querySelectorAll("[data-clear]"))
  b.onclick = () => {
    $(b.dataset.clear).value = "";
    editing = true;
  };
$("settings").oninput = () => (editing = true);
async function saveSettings(thenRestart) {
  const r = await api.save({
    share: $("share").checked,
    port: Number($("port").value),
    tlsCert: $("cert").value,
    tlsKey: $("key").value,
    charterSignatures: Number($("signatures").value),
  });
  const errors = $("errors");
  errors.replaceChildren(...(r.errors ?? (r.error ? [r.error] : [])).map((e) => el("li", e)));
  errors.hidden = !errors.children.length;
  if (errors.children.length) return;
  editing = false;
  $("saved").textContent = thenRestart ? "Saved. Restarting…" : "Saved. Restart the server to use the new settings.";
  if (thenRestart) await api.restart();
  await refresh();
  if (thenRestart) $("saved").textContent = "Saved and restarted.";
}
$("settings").onsubmit = (e) => {
  e.preventDefault();
  saveSettings(false);
};
$("save-restart").onclick = () => {
  if (last?.players.length && !confirm(`Restart now? ${last.players.length} player(s) will be disconnected briefly.`)) return;
  saveSettings(true);
};
// Host tools: run, then report the outcome under Accounts.
async function act(promise, done) {
  const r = await promise;
  $("accounts-msg").textContent = r?.error ?? done;
  await refresh();
  return !r?.error;
}
$("announce-form").onsubmit = async (e) => {
  e.preventDefault();
  if (await act(api.announce($("announce").value), "Announcement sent.")) $("announce").value = "";
};
$("ban-form").onsubmit = async (e) => {
  e.preventDefault();
  const name = $("ban-name").value.trim();
  if (name && confirm(`Ban the account “${name}”? It will be signed out and can't sign back in.`) && (await act(api.ban(name, $("ban-reason").value), `Banned ${name}.`)))
    $("ban-name").value = $("ban-reason").value = "";
};
$("reset-form").onsubmit = async (e) => {
  e.preventDefault();
  const name = $("reset-name").value.trim();
  if (await act(api.resetPassword(name, $("reset-pass").value), `Set a new password for ${name}.`)) $("reset-name").value = $("reset-pass").value = "";
};
api.onChange(refresh);
setInterval(refresh, 2000);
refresh();
