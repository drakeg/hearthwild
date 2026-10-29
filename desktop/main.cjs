const { app, BrowserWindow, Menu, dialog, ipcMain } = require("electron");
const path = require("node:path"),
  fs = require("node:fs"),
  { pathToFileURL } = require("node:url");
let win,
  hosted,
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
function allowedData(candidate) {
  try {
    const dir = fs.realpathSync(candidate),
      own = path.join(app.getPath("userData"), "server"),
      // Development copies may live in ~/Sources or the older Documents/Codex folder.
      roots = [path.join(app.getPath("home"), "Sources"), path.join(app.getPath("documents"), "Codex")].map((r) => r + path.sep);
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
async function localServer(dataDir) {
  const { createGameServer } = await import(
    pathToFileURL(path.join(__dirname, "../server/http.js")).href
  );
  hosted = createGameServer({ dataDir });
  activeData = dataDir;
  await new Promise((r, j) => {
    hosted.server.once("error", j);
    hosted.server.listen(0, "127.0.0.1", r);
  });
  external = false;
  return `http://127.0.0.1:${hosted.server.address().port}`;
}
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
      activeData = info.localDataDir;
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
  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
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
