import test from "node:test";
import assert from "node:assert/strict";
import { World } from "../server/world.js";
import { NPCS } from "../server/content.js";

const registrar = NPCS.find((n) => n.registrar);
const make = (saved) => new World(saved, { combatRandom: () => 0.99, charterSignatures: 2 });
const hero = (w, name, faction = "dawnward") => {
  const a = w.join({ name, faction, classId: "warrior" }),
    p = w.players.get(a.id);
  p.seen = 1000;
  p.coins = 50;
  return { a, p };
};
const go = (w, h, op, extra = {}, now = 2000) => w.act(h.a.token, { type: "guild", op, ...extra }, now);
const atRegistrar = (p) => ((p.x = registrar.x + 1), (p.z = registrar.z));

function founded() {
  const w = make(),
    A = hero(w, "Aster"),
    B = hero(w, "Briar"),
    C = hero(w, "Cedar");
  atRegistrar(A.p);
  go(w, A, "buy-charter", { name: "Order of the Ember" });
  for (const X of [B, C]) {
    go(w, A, "request-signature", { name: X.p.name });
    go(w, X, "sign");
  }
  go(w, A, "found");
  return { w, A, B, C };
}

test("founding a guild: buy a charter at the registrar, gather signatures, found it", () => {
  const w = make(),
    A = hero(w, "Aster"),
    B = hero(w, "Briar"),
    M = hero(w, "Moss", "mossbound");
  assert.throws(() => go(w, A, "buy-charter", { name: "Order of the Ember" }), /Registrar/);
  atRegistrar(A.p);
  assert.throws(() => go(w, A, "buy-charter", { name: "x!" }), /3–24 letters/);
  go(w, A, "buy-charter", { name: "Order of the Ember" });
  assert.equal(A.p.coins, 40, "the charter costs 10 gold");
  assert.throws(() => go(w, A, "request-signature", { name: "Moss" }), /faction/);
  go(w, A, "request-signature", { name: "Briar" });
  assert.equal(w.state(B.a.token, 0, 2001).self.charterRequest.name, "Order of the Ember");
  go(w, B, "sign", {}, 2002);
  assert.throws(() => go(w, A, "found", {}, 2003), /needs 2 signatures \(1 so far\)/);
  const C = hero(w, "Cedar");
  go(w, A, "request-signature", { name: "Cedar" });
  go(w, C, "sign");
  go(w, A, "found", {}, 3000);
  const view = w.state(A.a.token, 0, 3001).self.guildInfo;
  assert.equal(view.name, "Order of the Ember");
  assert.equal(view.rankName, "Guild Master");
  assert.deepEqual(view.members.map((m) => m.rank).sort(), [0, 2, 2], "signers become Members");
  assert.equal(A.p.charter, null);
  // The name is now taken, and other players see it under the founder's name.
  atRegistrar(M.p);
  assert.throws(() => go(w, M, "buy-charter", { name: "order of the ember" }), /taken/);
  assert.equal(w.state(B.a.token, 0, 3002).players.find((q) => q.id === A.p.id).guild, "Order of the Ember");
});

test("ranks: officers invite and manage lower ranks; only the Guild Master passes leadership", () => {
  const { w, A, B, C } = founded(),
    D = hero(w, "Dusk");
  assert.throws(() => go(w, B, "invite", { name: "Dusk" }), /officers/);
  go(w, A, "promote", { name: "Briar" });
  assert.equal(w.guilds.rank(B.p), 1, "Member → Officer");
  assert.throws(() => go(w, A, "promote", { name: "Briar" }), /can’t be promoted to your rank/);
  go(w, B, "invite", { name: "Dusk" });
  assert.equal(w.state(D.a.token, 0, 2100).self.guildInvite.name, "Order of the Ember");
  go(w, D, "accept", {}, 2101);
  assert.equal(w.guilds.rank(D.p), 3, "new members start as Initiates");
  go(w, B, "promote", { name: "Dusk" });
  assert.equal(w.guilds.rank(D.p), 2);
  assert.throws(() => go(w, B, "kick", { name: "Aster" }), /lower rank/);
  assert.throws(() => go(w, B, "leader", { name: "Cedar" }), /Only the Guild Master/);
  go(w, B, "kick", { name: "Cedar" });
  assert.equal(C.p.guildId, null);
  go(w, A, "leader", { name: "Briar" });
  assert.equal(w.guilds.rank(B.p), 0);
  assert.equal(w.guilds.rank(A.p), 1, "the old Guild Master becomes an Officer");
});

test("guild and officer chat reach the right members only", () => {
  const { w, A, B, C } = founded(),
    O = hero(w, "Outsider");
  go(w, A, "promote", { name: "Briar" });
  for (const X of [A, B, C, O]) X.p.seen = 5000;
  w.act(C.a.token, { type: "chat", channel: "guild", text: "Hello guild" }, 5000);
  w.act(A.a.token, { type: "chat", channel: "officer", text: "Officers only" }, 6000);
  const said = (X, t) => X.p.messages.some((m) => m.text === t);
  assert.ok(said(A, "Hello guild") && said(B, "Hello guild") && !said(O, "Hello guild"));
  assert.ok(said(B, "Officers only") && !said(C, "Officers only"));
  assert.throws(() => w.act(C.a.token, { type: "chat", channel: "officer", text: "hi" }, 7000), /officers/);
});

test("when the Guild Master leaves, the highest-ranked member inherits; the last to leave disbands it", () => {
  const { w, A, B, C } = founded();
  go(w, A, "promote", { name: "Cedar" });
  go(w, A, "leave");
  assert.equal(w.guilds.rank(C.p), 0, "the officer inherits over a member");
  go(w, B, "leave");
  go(w, C, "leave");
  assert.equal(w.guilds.byId.size, 0);
});

test("guilds, ranks, message of the day and charters survive a save and reload", () => {
  const { w, A, B } = founded(),
    D = hero(w, "Dusk");
  go(w, A, "motd", { text: "Crypt run at dusk" });
  atRegistrar(D.p);
  go(w, D, "buy-charter", { name: "Moonwell Wardens" });
  const saved = JSON.parse(JSON.stringify(w.save()));
  assert.ok(!("guild" in saved.players[0]));
  const w2 = make(saved),
    A2 = w2.players.get(A.p.id);
  assert.equal(w2.guilds.nameOf(A2), "Order of the Ember");
  assert.equal(w2.guilds.rank(A2), 0);
  assert.equal(w2.guilds.rank(w2.players.get(B.p.id)), 2);
  assert.equal(w2.guilds.of(A2).motd, "Crypt run at dusk");
  assert.equal(w2.players.get(D.p.id).charter.name, "Moonwell Wardens");
  // Returning players see the message of the day.
  A2.seen = 0;
  const msgs = w2.state(A2.accessToken ?? A.a.token, 0, 100000).messages;
  assert.ok(msgs.some((m) => m.text.includes("Crypt run at dusk")));
});

test("the Guild Master can disband after confirming the name", () => {
  const { w, A, B } = founded();
  assert.throws(() => go(w, B, "disband", { confirm: "Order of the Ember" }), /Only the Guild Master/);
  assert.throws(() => go(w, A, "disband", { confirm: "nope" }), /confirm/);
  go(w, A, "disband", { confirm: "Order of the Ember" });
  assert.equal(A.p.guildId, null);
  assert.equal(B.p.guildId, null);
  assert.equal(w.guilds.byId.size, 0);
});
