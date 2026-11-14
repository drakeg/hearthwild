const { app, BrowserWindow, Menu, dialog, ipcMain, shell, clipboard } = require("electron");
const path = require("node:path"),
  fs = require("node:fs"),
  os = require("node:os"),
  { pathToFileURL } = require("node:url"),
  serverConfig = require("./server-config.cjs");
let win,
  manager,
  hosted,
  terrain,
  startedAt = 0,
  serverError = "",
  online = new Map(),
  external = false,
  origin,
  activeData,
  quitting = false;
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) app.quit();
app.setName("Hearthwild");
ipcMain.handle("hearthwild:quit", (event) => {
  if (win && event.sender === win.webContents) {
    app.quit();
    return true;
  }
  return false;
});
app.on("second-instance", () => {
  if (win) {
    if (win.isMinimized()) win.restore();
    win.show();
    win.focus();
  }
});
// macOS asks permission before an app reads Documents, Desktop or Downloads, so saves are
// never looked for there: the game keeps its own save folder (or a ~/Sources dev copy).
function inProtectedFolder(candidate) {
  const target = path.resolve(String(candidate));
  return ["documents", "desktop", "downloads"].some((name) => {
    try {
      const dir = app.getPath(name);
      return target === dir || target.startsWith(dir + path.sep);
    } catch {
      return false;
    }
  });
}
function allowedData(candidate) {
  try {
    if (typeof candidate !== "string" || !candidate || inProtectedFolder(candidate)) return false;
    const dir = fs.realpathSync(candidate),
      own = path.join(app.getPath("userData"), "server"),
      roots = [path.join(app.getPath("home"), "Sources")].map((r) => r + path.sep);
    if (inProtectedFolder(dir)) return false;
    return (
      dir === own ||
      (roots.some((r) => dir.startsWith(r)) &&
        dir.endsWith(path.join("hearthwild", "data")) &&
        JSON.parse(fs.readFileSync(path.join(dir, "world.json"), "utf8"))
          .product === "hearthwild")
    );
  } catch {
    return false;
  }
}
// ---------- The server this app runs, and the Server Manager that controls it ----------
const configFile = () => path.join(app.getPath("userData"), "server-config.json");
const activity = [];
function log(text) {
  activity.push({ t: Date.now(), text });
  if (activity.length > 200) activity.shift();
  manager?.webContents.send("server:changed");
}
// Starts the server from the saved settings. If sharing fails (say, the port is taken), the
// game still runs privately on this computer and the Server Manager shows why.
async function localServer(dataDir) {
  const { createGameServer } = await import(pathToFileURL(path.join(__dirname, "../server/http.js")).href);
  terrain ??= await import(pathToFileURL(path.join(__dirname, "../public/terrain.js")).href);
  const config = serverConfig.load(configFile());
  process.env.HEARTHWILD_CHARTER_SIGNATURES = String(config.charterSignatures);
  activeData = dataDir;
  external = false;
  serverError = "";
  const attempt = async (share) => {
    const tls = share && config.tlsCert ? { cert: fs.readFileSync(config.tlsCert), key: fs.readFileSync(config.tlsKey) } : undefined;
    hosted = createGameServer({ dataDir, tls });
    await new Promise((r, j) => {
      hosted.server.once("error", j);
      hosted.server.listen(share ? config.port : 0, share ? "0.0.0.0" : "127.0.0.1", r);
    });
    hosted.shared = share;
  };
  try {
    await attempt(config.share);
  } catch (e) {
    if (!config.share) throw e;
    if (hosted) await hosted.close().catch(() => {});
    serverError = e.code === "EADDRINUSE" ? `Port ${config.port} is already in use by another program. Choose another port.` : `Could not share the server: ${e.message}`;
    log(serverError);
    await attempt(false);
  }
  startedAt = Date.now();
  online = new Map();
  log(hosted.shared ? `Server started and shared on port ${hosted.server.address().port}${hosted.tls ? " (HTTPS)" : ""}.` : "Server started for this computer only.");
  return `${hosted.tls ? "https" : "http"}://127.0.0.1:${hosted.server.address().port}`;
}
// Players come and go: noted in the activity log.
setInterval(() => {
  if (!hosted) return;
  const now = Date.now(),
    seen = new Map([...hosted.world.players.values()].filter((p) => now - p.seen < 15000).map((p) => [p.id, p.name]));
  for (const [id, name] of seen) if (!online.has(id)) log(`${name} joined.`);
  for (const [id, name] of online) if (!seen.has(id)) log(`${name} left.`);
  online = seen;
}, 3000).unref();
function shareAddresses(port, tls) {
  const out = [];
  for (const list of Object.values(os.networkInterfaces()))
    for (const a of list ?? []) if (a.family === "IPv4" && !a.internal) out.push(`${tls ? "https" : "http"}://${a.address}:${port}`);
  return out;
}
function status() {
  const config = serverConfig.load(configFile()),
    now = Date.now();
  if (external)
    return { external: true, config, activity, dataDir: activeData, players: [], message: "A development server is already running on port 4180 (started from ~/Sources). Manage it from there; this app is connected to it." };
  const running = !!hosted?.server.listening,
    port = running ? hosted.server.address().port : null;
  return {
    external: false,
    running,
    shared: running && hosted.shared,
    tls: running && hosted.tls,
    port,
    uptime: running ? now - startedAt : 0,
    addresses: running && hosted.shared ? shareAddresses(port, hosted.tls) : [],
    local: running ? `${hosted.tls ? "https" : "http"}://127.0.0.1:${port}` : null,
    error: serverError,
    config,
    dataDir: activeData,
    activity,
    players: running
      ? [...hosted.world.players.values()]
          .filter((p) => now - p.seen < 15000)
          .map((p) => ({
            name: p.name,
            account: hosted.admin.accountOf(p.name),
            level: p.level,
            classId: p.classId,
            where: p.instance ? "In a dungeon" : (terrain?.ZONES[terrain.zoneAt(p.x, p.z)]?.name ?? ""),
          }))
      : [],
    bans: running ? hosted.admin.bans() : [],
  };
}
async function stopServer() {
  if (!hosted) return;
  await hosted.close();
  hosted = null;
  log("Server stopped.");
}
async function restartServer() {
  await stopServer();
  origin = await localServer(activeData ?? path.join(app.getPath("userData"), "server"));
  if (win) await win.loadURL(origin + "/");
}
function openManager() {
  if (manager) return manager.show(), manager.focus();
  manager = new BrowserWindow({
    title: "Hearthwild Server Manager",
    width: 760,
    height: 720,
    minWidth: 560,
    minHeight: 520,
    backgroundColor: "#16120c",
    webPreferences: { preload: path.join(__dirname, "manager-preload.cjs"), sandbox: true, contextIsolation: true, nodeIntegration: false },
  });
  manager.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  manager.webContents.on("will-navigate", (e) => e.preventDefault());
  manager.on("closed", () => (manager = null));
  manager.loadFile(path.join(__dirname, "manager.html"));
}
const fromManager = (event) => manager && event.sender === manager.webContents;
const guard = (fn) => async (event, ...args) => {
  if (!fromManager(event)) return { error: "Not allowed." };
  try {
    return (await fn(...args)) ?? { ok: true };
  } catch (e) {
    log(`Error: ${e.message}`);
    return { error: e.message };
  }
};
ipcMain.handle("server:status", guard(() => status()));
ipcMain.handle("server:save", guard((input) => {
  if (external) return { error: "This app is connected to a development server; settings apply to the app's own server." };
  const { errors } = serverConfig.save(configFile(), input);
  if (!errors.length) log("Settings saved. Restart the server to use them.");
  return errors.length ? { errors } : { ok: true };
}));
ipcMain.handle("server:start", guard(async () => {
  if (external || hosted) return;
  origin = await localServer(activeData ?? path.join(app.getPath("userData"), "server"));
  if (win) await win.loadURL(origin + "/");
}));
ipcMain.handle("server:stop", guard(() => !external && stopServer()));
ipcMain.handle("server:restart", guard(() => !external && restartServer()));
ipcMain.handle("server:pick", guard(async (kind) => {
  const picked = await dialog.showOpenDialog(manager, {
    title: kind === "key" ? "Choose the HTTPS private key" : "Choose the HTTPS certificate",
    filters: [{ name: kind === "key" ? "Private key" : "Certificate", extensions: ["pem", "key", "crt", "cer"] }, { name: "All files", extensions: ["*"] }],
    properties: ["openFile"],
  });
  return { path: picked.canceled ? null : picked.filePaths[0] };
}));
// Host tools: each needs the server running here (not a separate development server).
const admin = (fn) =>
  guard(async (...args) => {
    if (external || !hosted) return { error: "Start the server first." };
    return fn(...args);
  });
ipcMain.handle("server:announce", admin((text) => {
  const message = hosted.admin.announce(text);
  log(`Announcement: ${message}`);
}));
ipcMain.handle("server:kick", admin((name) => log(`Removed ${hosted.admin.kick(name)} from the world.`)));
ipcMain.handle("server:ban", admin((username, reason) => log(`Banned the account ${hosted.admin.ban(username, reason)}${reason ? ` (${reason})` : ""}.`)));
ipcMain.handle("server:unban", admin((username) => log(`Lifted the ban on ${hosted.admin.unban(username)}.`)));
ipcMain.handle("server:reset-password", admin(async (username, password) => {
  await hosted.admin.resetPassword(username, password);
  log(`Set a new password for ${username}.`);
}));
ipcMain.handle("server:open-folder", guard(() => shell.openPath(activeData ?? app.getPath("userData"))));
ipcMain.handle("server:copy", guard((text) => clipboard.writeText(String(text).slice(0, 300))));
ipcMain.handle("server:backup", guard(() => {
  if (!activeData) return { error: "No save folder in use." };
  hosted?.save();
  const dir = path.join(activeData, "backups");
  fs.mkdirSync(dir, { recursive: true });
  const name = `world-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
  fs.copyFileSync(path.join(activeData, "world.json"), path.join(dir, name));
  log(`Saved a backup: backups/${name}`);
  return { ok: true, name };
}));
// A server using its own (self-signed) certificate: the game window on this computer trusts it.
app.on("certificate-error", (event, contents, url, error, certificate, callback) => {
  const local = hosted?.tls && new URL(url).hostname === "127.0.0.1" && contents === win?.webContents;
  if (local) event.preventDefault();
  callback(!!local);
});
async function launch() {
  const settings = path.join(app.getPath("userData"), "server-location.json");
  try {
    const response = await fetch("http://127.0.0.1:4180/api/info", {
        signal: AbortSignal.timeout(1200),
      }),
      info = await response.json();
    if (info.product === "hearthwild" && info.protocol === 4) {
      origin = "http://127.0.0.1:4180";
      external = true;
      activeData = allowedData(info.localDataDir) ? info.localDataDir : null;
      if (info.localDataDir && allowedData(info.localDataDir))
        fs.writeFileSync(
          settings,
          JSON.stringify({ dataDir: info.localDataDir }),
        );
    }
  } catch {}
  if (!origin) {
    let dataDir = path.join(app.getPath("userData"), "server");
    if (fs.existsSync(settings)) {
      const configured = JSON.parse(fs.readFileSync(settings, "utf8")).dataDir;
      if (allowedData(configured)) dataDir = configured;
    }
    origin = await localServer(dataDir);
  }
  win = new BrowserWindow({
    title: "Hearthwild",
    width: 1280,
    height: 850,
    minWidth: 480,
    minHeight: 440,
    backgroundColor: "#13231a",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      partition: "persist:hearthwild",
    },
  });
  // Only the game's own source-code link may leave the app, and it opens in the system browser.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url === "https://github.com/drakeg/hearthwild") shell.openExternal(url);
    return { action: "deny" };
  });
  win.webContents.on("will-navigate", (e, url) => {
    if (new URL(url).origin !== origin) e.preventDefault();
  });
  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      { role: "appMenu" },
      {
        label: "Game",
        submenu: [
          { label: "Import existing save…", click: importSave },
          {
            label: "Open save folder",
            click: () =>
              require("electron").shell.openPath(
                activeData ?? app.getPath("userData"),
              ),
          },
          { type: "separator" },
          { label: "Reload game", click: () => win.reload() },
        ],
      },
      {
        label: "Server",
        submenu: [{ label: "Server Manager…", accelerator: "CmdOrCtrl+Shift+M", click: openManager }],
      },
      { role: "editMenu" },
      {
        label: "View",
        submenu: [
          { label: "Compact window", click: () => win.setSize(640, 520) },
          { label: "Standard window", click: () => win.setSize(1280, 850) },
          { label: "Large window", click: () => win.setSize(1440, 900) },
          { type: "separator" },
          { role: "togglefullscreen" },
          { role: "zoomIn" },
          { role: "zoomOut" },
          { role: "resetZoom" },
        ],
      },
      { role: "windowMenu" },
    ]),
  );
  await win.loadURL(origin + "/");
}
async function importSave() {
  const picked = await dialog.showOpenDialog(win, {
    title: "Import an existing Hearthwild world.json save",
    filters: [{ name: "Hearthwild save", extensions: ["json"] }],
    properties: ["openFile"],
  });
  if (picked.canceled) return;
  try {
    const source = picked.filePaths[0],
      data = JSON.parse(fs.readFileSync(source, "utf8"));
    if (
      !Array.isArray(data.players) ||
      data.players.some(
        (p) => typeof p.id !== "string" || typeof p.name !== "string",
      )
    )
      throw Error("Choose a Hearthwild world.json save.");
    const answer = await dialog.showMessageBox(win, {
      type: "question",
      buttons: ["Cancel", "Import save"],
      defaultId: 0,
      cancelId: 0,
      message: "Use this saved world?",
      detail:
        "Current local app saves will be backed up. Existing external servers are left running. Imported accounts and characters keep their saved data.",
    });
    if (answer.response !== 1) return;
    if (hosted) {
      await hosted.close();
      hosted = null;
    }
    const dir = path.join(app.getPath("userData"), "server");
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, "world.json");
    if (fs.existsSync(file))
      fs.copyFileSync(file, file + ".before-import-" + Date.now());
    fs.writeFileSync(file, JSON.stringify(data), { mode: 0o600 });
    const settings = path.join(app.getPath("userData"), "server-location.json");
    fs.writeFileSync(settings, JSON.stringify({ dataDir: dir }));
    origin = await localServer(dir);
    await win.loadURL(origin + "/");
  } catch (e) {
    dialog.showErrorBox("Could not import save", e.message);
  }
}
if (gotLock)
  app
    .whenReady()
    .then(launch)
    .catch((e) => {
      dialog.showErrorBox("Hearthwild could not start", e.message);
      app.quit();
    });
app.on("activate", () => {
  if (win) win.show();
});
app.on("window-all-closed", () => app.quit());
app.on("before-quit", (e) => {
  if (hosted && !quitting) {
    e.preventDefault();
    quitting = true;
    hosted.close().finally(() => {
      hosted = null;
      app.quit();
    });
  }
});
