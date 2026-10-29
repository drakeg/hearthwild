import test from "node:test";
import assert from "node:assert/strict";
import { Accounts } from "../server/accounts.js";
test("password accounts validate input, persist only hashes, log in case-insensitively and invalidate logged-out sessions", async () => {
  const a = new Accounts();
  await assert.rejects(() => a.register({ username: "ab", password: "short" }));
  const created = await a.register({
    username: "Player_One",
    password: "local-test-password-941",
  });
  assert.equal(a.authenticate(created.session).username, "Player_One");
  const saved = JSON.stringify(a.save());
  assert.ok(!saved.includes("local-test-password-941"));
  assert.ok(!saved.includes(created.session));
  const restored = new Accounts(JSON.parse(saved));
  const login = await restored.login({
    username: "player_one",
    password: "local-test-password-941",
  });
  assert.equal(restored.authenticate(login.session).id, created.account.id);
  await assert.rejects(
    () =>
      restored.login({ username: "player_one", password: "wrong-password" }),
    /Username or password/,
  );
  await assert.rejects(
    () =>
      restored.register({
        username: "PLAYER_ONE",
        password: "different-pass-972",
      }),
    /taken/,
  );
  restored.logout(login.session);
  assert.throws(() => restored.authenticate(login.session), /Sign in/);
});

test("offline password reset preserves the account and invalidates all old sessions", async () => {
  const a = new Accounts(),
    created = await a.register({
      username: "Recoverable",
      password: "before-reset-2345",
    });
  await a.resetPassword("recoverable", "after-reset-6789");
  assert.throws(() => a.authenticate(created.session), /Sign in/);
  await assert.rejects(() =>
    a.login({ username: "Recoverable", password: "before-reset-2345" }),
  );
  const login = await a.login({
    username: "Recoverable",
    password: "after-reset-6789",
  });
  assert.equal(login.account.id, created.account.id);
});
