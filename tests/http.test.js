import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createGameServer } from "../server/http.js";
test("password sessions own multiple characters, reject cross-account access and persist gear through restart", async (t) => {
  const dir = mkdtempSync(join(tmpdir(), "hearthwild-"));
  let app = createGameServer({ dataDir: dir });
  await new Promise((r) => app.server.listen(0, "127.0.0.1", r));
  t.after(async () => {
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  });
  let base = `http://127.0.0.1:${app.server.address().port}`;
  const post = (path, body, cookie, id, extra = {}) =>
    fetch(base + path, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(cookie ? { Cookie: cookie } : {}),
        ...(id ? { "X-Character-ID": id } : {}),
        ...extra,
      },
      body: JSON.stringify(body),
    });
  const get = (path, cookie, id) =>
    fetch(base + path, {
      headers: {
        ...(cookie ? { Cookie: cookie } : {}),
        ...(id ? { "X-Character-ID": id } : {}),
      },
    });
  const first = await post("/api/accounts/register", {
      username: "first_player",
      password: "local-test-password-941",
    }),
    cookie = first.headers.get("set-cookie").split(";")[0];
  assert.match(first.headers.get("set-cookie"), /HttpOnly/);
  assert.match(first.headers.get("set-cookie"), /SameSite=Strict/);
  const second = await post("/api/accounts/register", {
      username: "other_player",
      password: "local-test-password-942",
    }),
    other = second.headers.get("set-cookie").split(";")[0];
  const a = await (
    await post(
      "/api/characters",
      { name: "Aster", faction: "dawnward", classId: "warrior" },
      cookie,
    )
  ).json();
  const b = await (
    await post(
      "/api/characters",
      { name: "Briar", faction: "dawnward", classId: "warlock" },
      cookie,
    )
  ).json();
  const c = await (
    await post(
      "/api/characters",
      { name: "Cedar", faction: "mossbound" },
      other,
    )
  ).json();
  assert.ok(!a.token);
  assert.equal(
    (await (await get("/api/characters", cookie)).json()).characters.length,
    2,
  );
  assert.equal((await get("/api/state")).status, 401);
  assert.equal((await get("/api/state", other, a.id)).status, 403);
  assert.equal(
    (
      await post(
        "/api/actions",
        { type: "chat", channel: "faction", text: "Secret rally" },
        cookie,
        a.id,
      )
    ).status,
    200,
  );
  const state = async (c, id) => (await get("/api/state", c, id)).json();
  assert.equal(
    (await state(cookie, b.id)).messages.at(-1).text,
    "Secret rally",
  );
  assert.equal((await state(other, c.id)).messages.length, 0);
  assert.equal(
    (
      await post("/api/actions", {}, cookie, a.id, {
        Origin: "https://other.example",
      })
    ).status,
    403,
  );
  assert.equal(
    (await post("/api/actions", { type: "input", x: 1e30, z: 0 }, cookie, a.id))
      .status,
    400,
  );
  assert.equal(
    (
      await post(
        "/api/actions",
        { type: "chat", channel: "faction", text: "x".repeat(3000) },
        cookie,
        a.id,
      )
    ).status,
    413,
  );
  assert.equal((await get("/../server/world.js")).status, 404);
  const p = app.world.players.get(a.id),
    e = app.world.enemies[0];
  // This test is about ownership and gear, not the random roll.
  app.world.rollLoot = () => "warden-blade";
  app.world.rollCoins = () => 10;

  p.x = e.x;
  p.z = e.z;
  e.hp = 20;
  await post(
    "/api/actions",
    { type: "ability", ability: "iron-cut", target: e.id },
    cookie,
    a.id,
  );
  const drop = (await state(cookie, a.id)).loot[0];
  await post("/api/actions", { type: "loot", target: drop.id }, cookie, a.id);
  const item = (await state(cookie, a.id)).self.inventory[0];
  await post("/api/actions", { type: "equip", item: item.id }, cookie, a.id);
  assert.equal((await state(cookie, a.id)).self.stats.damage, 28);
  await app.close();
  app = createGameServer({ dataDir: dir });
  await new Promise((r) => app.server.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${app.server.address().port}`;
  assert.equal((await state(cookie, a.id)).self.stats.damage, 28);
  assert.equal((await state(cookie, a.id)).self.coins, 10);
  await post("/api/accounts/logout", {}, cookie);
  assert.equal((await get("/api/characters", cookie)).status, 401);
  const login = await post("/api/accounts/login", {
    username: "FIRST_PLAYER",
    password: "local-test-password-941",
  });
  assert.equal(login.status, 200);
  assert.equal((await login.json()).characters.length, 2);
});
test("first local account recovers existing characters without their old return codes", async (t) => {
  const dir = mkdtempSync(join(tmpdir(), "hearthwild-migrate-")),
    app = createGameServer({ dataDir: dir });
  const legacy = app.world.join({ name: "Oldhero", faction: "dawnward" });
  app.world.players.get(legacy.id).coins = 77;
  await new Promise((r) => app.server.listen(0, "127.0.0.1", r));
  t.after(async () => {
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  });
  const base = `http://127.0.0.1:${app.server.address().port}`,
    r = await fetch(base + "/api/accounts/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "local_owner",
        password: "local-owner-password-941",
      }),
    }),
    data = await r.json();
  assert.equal(data.characters[0].name, "Oldhero");
  assert.equal(data.characters[0].coins, 77);
  assert.equal(app.world.players.get(legacy.id).accountId, data.account.id);
});
