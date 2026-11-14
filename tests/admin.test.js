import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createGameServer } from "../server/http.js";

async function setup() {
  const app = createGameServer({ dataDir: mkdtempSync(join(tmpdir(), "hw-admin-")) }),
    { account, session } = await app.accounts.register({ username: "Rowan", password: "password12345" }),
    joined = app.world.join({ name: "Rowanleaf", faction: "dawnward", classId: "druid" }),
    p = app.world.players.get(joined.id);
  p.accountId = account.id;
  p.seen = Date.now();
  return { app, account, session, p, token: app.world.accountToken(account.id, p.id) };
}

test("hosts can announce to everyone online, and remove a player who can come back", async () => {
  const { app, account, p, token } = await setup();
  try {
    app.admin.announce("Server restart in five minutes.");
    assert.ok(p.messages.some((m) => m.channel === "system" && m.text === "[Server] Server restart in five minutes."));
    assert.throws(() => app.admin.announce("   "), /announcement/);
    assert.equal(app.admin.kick("rowanleaf"), "Rowanleaf");
    assert.throws(() => app.world.authenticate(token), (e) => e.status === 401 && /host removed you/.test(e.message));
    assert.throws(() => app.world.authenticate(token), /return key/, "the reason is shown once");
    assert.throws(() => app.admin.kick("Rowanleaf"), /isn’t online/);
    // Back in from the character list with a fresh key.
    const again = app.world.accountToken(account.id, p.id);
    assert.notEqual(again, token);
    assert.equal(app.world.authenticate(again), p);
  } finally {
    await app.close();
  }
});

test("banned accounts can't sign in or play until the ban is lifted", async () => {
  const { app, session, p, token } = await setup();
  try {
    assert.equal(app.admin.accountOf("Rowanleaf"), "Rowan");
    app.admin.ban("rowan", "griefing");
    assert.deepEqual(app.admin.bans().map((b) => [b.username, b.reason]), [["Rowan", "griefing"]]);
    await assert.rejects(app.accounts.login({ username: "Rowan", password: "password12345" }), (e) => e.status === 403);
    assert.throws(() => app.accounts.authenticate(session), (e) => e.status === 401 || e.status === 403);
    assert.throws(() => app.world.authenticate(token), /banned/);
    assert.throws(() => app.admin.ban("nobody"), /No account/);
    app.admin.unban("Rowan");
    assert.equal(app.admin.bans().length, 0);
    assert.ok((await app.accounts.login({ username: "Rowan", password: "password12345" })).session);
    assert.ok(p);
  } finally {
    await app.close();
  }
});

test("hosts can set a new password; old sessions end", async () => {
  const { app, session } = await setup();
  try {
    await app.admin.resetPassword("Rowan", "a-brand-new-password");
    assert.throws(() => app.accounts.authenticate(session), (e) => e.status === 401);
    await assert.rejects(app.accounts.login({ username: "Rowan", password: "password12345" }), (e) => e.status === 401);
    assert.ok((await app.accounts.login({ username: "Rowan", password: "a-brand-new-password" })).session);
  } finally {
    await app.close();
  }
});
