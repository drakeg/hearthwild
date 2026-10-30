import { createServer } from "node:http";
import {
  readFileSync,
  writeFileSync,
  renameSync,
  mkdirSync,
  existsSync,
  unlinkSync,
  openSync,
  closeSync,
  realpathSync,
  readdirSync,
} from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve, join } from "node:path";
import { World, GameError } from "./world.js";
import { Accounts } from "./accounts.js";
import { createServer as createSecureServer } from "node:https";
const root = fileURLToPath(new URL("../public/", import.meta.url));
const VERSION = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;
const assets = new Map([
  ["/", ["index.html", "text/html"]],
  ["/services-ui.js", ["services-ui.js", "text/javascript"]],
  ["/world-config.js", ["world-config.js", "text/javascript"]],
  ["/game-menu.js", ["game-menu.js", "text/javascript"]],
  ["/game.js", ["game.js", "text/javascript"]],
  ["/accounts-ui.js", ["accounts-ui.js", "text/javascript"]],
  ["/layout.css", ["layout.css", "text/css"]],
  ["/character-ui.js", ["character-ui.js", "text/javascript"]],
  ["/controls.js", ["controls.js", "text/javascript"]],
  ["/scenery.js", ["scenery.js", "text/javascript"]],
  ["/style.css", ["style.css", "text/css"]],
  ["/hud.css", ["hud.css", "text/css"]],
  ["/hud.js", ["hud.js", "text/javascript"]],
  ["/combat-ui.js", ["combat-ui.js", "text/javascript"]],
  ["/guild-ui.js", ["guild-ui.js", "text/javascript"]],
  ["/characters.js", ["characters.js", "text/javascript"]],
  ["/dungeon-layout.js", ["dungeon-layout.js", "text/javascript"]],
  ["/dungeon-scene.js", ["dungeon-scene.js", "text/javascript"]],
  ["/combat-ui.css", ["combat-ui.css", "text/css"]],
  ["/ui-model.js", ["ui-model.js", "text/javascript"]],
  ["/art/abilities.png", ["art/abilities.png", "image/png"]],
  ["/vendor/three.module.js", ["vendor/three.module.js", "text/javascript"]],
  ["/vendor/three.core.js", ["vendor/three.core.js", "text/javascript"]],
  ["/favicon.ico", [null, "image/x-icon"]],
]);
// Vendored three.js add-ons, models and textures: registered by name so nothing else under public/ is served.
for (const [dir, ext, type] of [
  ["vendor/addons", ".js", "text/javascript"],
  ["models", ".glb", "model/gltf-binary"],
  ["models/q", ".glb", "model/gltf-binary"],
  ["models/nature", ".glb", "model/gltf-binary"],
  ["models/props", ".glb", "model/gltf-binary"],
  ["models/dungeon", ".glb", "model/gltf-binary"],
  ["art", ".png", "image/png"],
  ["art", ".jpg", "image/jpeg"],
])
  if (existsSync(join(root, dir)))
    for (const name of readdirSync(join(root, dir)))
      if (name.endsWith(ext) && /^[\w.-]+$/.test(name))
        assets.set(`/${dir}/${name}`, [`${dir}/${name}`, type]);
export function createGameServer({ dataDir = resolve("data"), tls } = {}) {
  mkdirSync(dataDir, { recursive: true, mode: 0o700 });
  const file = join(dataDir, "world.json");
  const lock = join(dataDir, "server.lock");
  if (existsSync(lock)) {
    let old;
    try {
      old = JSON.parse(readFileSync(lock, "utf8"));
    } catch {
      throw Error(
        "Unrecognized save lock. Inspect server.lock before starting.",
      );
    }
    if (old.product !== "hearthwild") throw Error("Unrecognized save lock.");
    let alive = true;
    try {
      process.kill(old.pid, 0);
    } catch (e) {
      if (e.code === "ESRCH") alive = false;
      else throw e;
    }
    if (alive)
      throw Error("Another Hearthwild server is using this save folder.");
    unlinkSync(lock);
  }
  const fd = openSync(lock, "wx", 0o600);
  writeFileSync(
    fd,
    JSON.stringify({
      product: "hearthwild",
      pid: process.pid,
      root: realpathSync(dataDir),
    }),
  );
  closeSync(fd);

  const saved = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : {};
  const world = new World(saved),
    accounts = new Accounts(saved.auth);
  const persist = () => {
    writeFileSync(
      file + ".tmp",
      JSON.stringify({ ...world.save(), auth: accounts.save() }),
      { mode: 0o600 },
    );
    renameSync(file + ".tmp", file);
  };
  const rates = new Map();
  function limit(key, max, window = 1000) {
    const now = Date.now();
    let r = rates.get(key);
    if (!r || now - r.start >= window) {
      r = { start: now, count: 0 };
      rates.set(key, r);
    }
    if (++r.count > max)
      throw new GameError("Too many requests. Please slow down.", 429);
  }
  const handler = async (req, res) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("Cache-Control", "no-store");
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' blob:; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
    );
    const send = (status, value) => {
      res.writeHead(status, { "Content-Type": "application/json" });
      res.end(JSON.stringify(value));
    };
    try {
      if (
        req.headers.origin &&
        req.headers.origin !== `http://${req.headers.host}` &&
        req.headers.origin !== `https://${req.headers.host}`
      )
        throw new GameError("This origin cannot access the world.", 403);
      const url = new URL(req.url, "http://localhost"),
        ip = req.socket.remoteAddress;
      if (!rates.has(ip) && rates.size >= 2048)
        throw new GameError("Server is busy.", 503);
      const isAsset = req.method === "GET" && assets.has(url.pathname);
      // Entering a zone downloads many small models at once; give static files their own budget.
      limit(isAsset ? `asset:${ip}` : ip, isAsset ? 600 : 120);
      if (isAsset) {
        const [path, type] = assets.get(url.pathname);
        res.writeHead(path ? 200 : 204, {
          "Content-Type": type,
          ...(type.startsWith("model/") || type.startsWith("image/")
            ? { "Cache-Control": "max-age=86400" }
            : {}),
        });
        res.end(path ? readFileSync(join(root, path)) : undefined);
        return;
      }
      const local = ["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(ip);
      const host = new URL("http://" + req.headers.host).hostname;
      if (local && !["127.0.0.1", "localhost", "[::1]"].includes(host))
        throw new GameError("Use localhost or the server address.", 403);
      const cookie = req.headers.cookie
        ?.split(";")
        .map((x) => x.trim())
        .find((x) => x.startsWith("hearthwild_session="))
        ?.slice(19);
      const setCookie = (value, age = 30 * 86400) =>
        res.setHeader(
          "Set-Cookie",
          `hearthwild_session=${value}; HttpOnly; SameSite=Strict; Path=/api; Max-Age=${age}${req.socket.encrypted ? "; Secure" : ""}`,
        );
      if (req.method === "GET" && url.pathname === "/api/info") {
        send(200, {
          product: "hearthwild",
          protocol: 4,
          version: VERSION,
          ...(local ? { localDataDir: resolve(dataDir) } : {}),
        });
        return;
      }
      if (req.method === "GET" && url.pathname === "/api/setup") {
        send(200, {
          needsSetup: accounts.accounts.size === 0,
          local,
          legacyCount:
            local && accounts.accounts.size === 0
              ? [...world.players.values()].filter((p) => !p.accountId).length
              : 0,
        });
        return;
      }
      if (req.method === "GET" && url.pathname === "/api/account") {
        send(200, { account: accounts.authenticate(cookie) });
        return;
      }
      const roster = (account) =>
        [...world.players.values()]
          .filter((p) => p.accountId === account.id)
          .map((p) => ({
            id: p.id,
            name: p.name,
            classId: p.classId,
            faction: p.faction,
            level: p.level,
            coins: p.coins,
          }));
      if (req.method === "GET" && url.pathname === "/api/characters") {
        const account = accounts.authenticate(cookie);
        send(200, { account, characters: roster(account) });
        return;
      }
      let token;
      if (url.pathname === "/api/state" || url.pathname === "/api/actions") {
        const account = accounts.authenticate(cookie);
        token = world.accountToken(account.id, req.headers["x-character-id"]);
      }

      if (req.method === "GET" && url.pathname === "/api/state") {
        const after = Number(url.searchParams.get("after") ?? 0);
        if (!Number.isSafeInteger(after) || after < 0)
          throw new GameError("Invalid message cursor.");
        send(200, world.state(token, after));
        return;
      }
      if (
        req.method !== "POST" ||
        ![
          "/api/characters",
          "/api/actions",
          "/api/accounts/register",
          "/api/accounts/login",
          "/api/accounts/logout",
        ].includes(url.pathname)
      )
        throw new GameError("Not found.", 404);
      if (!req.headers["content-type"]?.startsWith("application/json"))
        throw new GameError("Send JSON.", 415);
      let size = 0;
      const chunks = [];
      for await (const chunk of req) {
        size += chunk.length;
        if (size > 2048) throw new GameError("Message is too large.", 413);
        chunks.push(chunk);
      }
      const body = Buffer.concat(chunks).toString("utf8");
      let data;
      try {
        data = JSON.parse(body);
      } catch {
        throw new GameError("Invalid JSON.");
      }
      if (
        ["/api/accounts/register", "/api/accounts/login"].includes(url.pathname)
      ) {
        if (!local && !req.socket.encrypted)
          throw new GameError(
            "Use an HTTPS server address to sign in over a network.",
            403,
          );
        if (accounts.accounts.size === 0 && !local)
          throw new GameError("Create the first server account locally.", 403);
        limit("auth:" + ip, 10, 15 * 60000);
        const first = accounts.accounts.size === 0,
          result = url.pathname.endsWith("register")
            ? await accounts.register(data)
            : await accounts.login(data);
        if (
          first &&
          accounts.accounts.keys().next().value === result.account.id &&
          local
        )
          world.claimLegacy(result.account.id);
        setCookie(result.session);
        persist();
        send(200, {
          account: result.account,
          characters: roster(result.account),
        });
        return;
      }
      if (url.pathname === "/api/accounts/logout") {
        try {
          const account = accounts.authenticate(cookie),
            p = world.players.get(req.headers["x-character-id"]);
          if (p?.accountId === account.id) {
            p.seen = -Infinity;
            p.input = { x: 0, z: 0 };
            p.casting = null;
          }
        } catch (e) {
          if (e.status !== 401) throw e;
        }
        accounts.logout(cookie);
        setCookie("", 0);
        persist();
        send(200, { ok: true });
        return;
      }
      if (url.pathname === "/api/characters") {
        const account = accounts.authenticate(cookie);
        limit(`join:${ip}`, 8, 60000);
        if (roster(account).length >= 12)
          throw new GameError("This account has twelve characters.", 409);
        const joined = world.join(data);
        world.players.get(joined.id).accountId = account.id;
        persist();
        send(201, { id: joined.id, characters: roster(account) });
      } else {
        const result = world.act(token, data);
        if (!["input", "chat", "talk"].includes(data.type)) persist();
        send(200, { ok: true, ...result });
      }
    } catch (error) {
      if (!res.headersSent)
        send(error.status ?? 500, {
          error: {
            message: error.status
              ? error.message
              : "The world encountered an error.",
          },
        });
      if (!error.status) console.error("World request failed:", error.message);
    }
  };
  const server = tls ? createSecureServer(tls, handler) : createServer(handler);
  server.requestTimeout = 10000;
  server.headersTimeout = 10000;
  const tick = setInterval(() => world.tick(0.05), 50);
  tick.unref();
  const saves = setInterval(() => {
    try {
      persist();
    } catch (e) {
      console.error("World save failed:", e.message);
    }
  }, 5000);
  saves.unref();
  const cleanup = setInterval(() => {
    const now = Date.now();
    for (const [key, r] of rates) if (now - r.start > 60000) rates.delete(key);
  }, 60000);
  cleanup.unref();
  return {
    server,
    world,
    accounts,
    close: async () => {
      clearInterval(tick);
      clearInterval(saves);
      clearInterval(cleanup);
      persist();
      await new Promise((r, j) => server.close((e) => (e ? j(e) : r())));
      if (
        existsSync(lock) &&
        JSON.parse(readFileSync(lock, "utf8")).pid === process.pid
      )
        unlinkSync(lock);
    },
  };
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const app = createGameServer({
    tls:
      process.env.TLS_CERT && process.env.TLS_KEY
        ? {
            cert: readFileSync(process.env.TLS_CERT),
            key: readFileSync(process.env.TLS_KEY),
          }
        : undefined,
    dataDir:
      process.env.DATA_DIR ??
      resolve(fileURLToPath(new URL("../data/", import.meta.url))),
  });
  const port = Number(process.env.PORT ?? 4180),
    host = process.env.HOST ?? "127.0.0.1";
  app.server.listen(port, host, () =>
    console.log(`Hearthwild is ready at http://${host}:${port}`),
  );
  for (const signal of ["SIGINT", "SIGTERM"])
    process.once(signal, async () => {
      await app.close();
      process.exit(0);
    });
}
