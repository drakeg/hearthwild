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
      tr.append(el("td", p.name), el("td", String(p.level)), el("td", CLASSES[p.classId] ?? p.classId), el("td", p.where));
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
api.onChange(refresh);
setInterval(refresh, 2000);
refresh();
