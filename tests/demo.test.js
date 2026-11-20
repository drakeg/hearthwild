import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { World } from "../server/world.js";
import { createGameServer } from "../server/http.js";
import { DEMO, zoneAt } from "../public/world-config.js";
import { MAX_LEVEL } from "../public/terrain.js";

const hero = (w) => {
  const a = w.join({ name: "Sampler", faction: "dawnward", classId: "warrior" }),
    p = w.players.get(a.id);
  p.seen = 1000;
  return { a, p, act: (x, now = 2000) => w.act(a.token, x, now) };
};

test("the demo caps levels at 6; the full game doesn't", () => {
  const demo = new World({}, { demo: true }),
    full = new World({});
  const d = hero(demo),
    f = hero(full);
  for (const h of [d, f]) {
    h.p.level = 5;
    h.p.xp = 0;
  }
  // Enough experience for several levels, granted through a creature kill.
  for (const [w, h] of [
    [demo, d],
    [full, f],
  ]) {
    const e = w.enemies.find((e) => e.hp > 0);
    e.level = 5;
    e.contributors = new Set([h.p.id]);
    for (let i = 0; i < 40; i++) w.defeat(e, 5000 + i);
  }
  assert.equal(d.p.level, DEMO.maxLevel);
  assert.equal(d.p.xp, 0);
  assert.ok(f.p.level > DEMO.maxLevel && f.p.level <= MAX_LEVEL);
  assert.deepEqual(demo.state(d.a.token, 0, 9000).demo, DEMO, "the client is told");
  assert.equal(full.state(f.a.token, 0, 9000).demo, null);
});

test("the demo keeps players in the Stillwood: no walking out, caravans, outer dungeons or world boss", () => {
  const w = new World({}, { demo: true }),
    h = hero(w);
  // Walk east until the zone would change.
  let x = h.p.x;
  while (zoneAt(x, h.p.z) === "stillwood") x += 0.25;
  Object.assign(h.p, { x: x - 1, input: { x: 1, z: 0 } });
  let now = 2000;
  for (let i = 0; i < 40; i++) {
    h.p.seen = h.p.inputAt = now;
    w.tick(0.1, (now += 100));
  }
  assert.equal(zoneAt(h.p.x, h.p.z), "stillwood");
  assert.ok(h.p.messages.some((m) => /demo ends at the edge of the Stillwood/.test(m.text)));
  assert.throws(() => h.act({ type: "travel", to: "anything" }), /full game/);
  h.p.level = 6;
  assert.throws(() => h.act({ type: "finder", op: "queue", dungeons: ["harrow-barrow"] }), /Hollow Crypt only/);
  assert.deepEqual(w.state(h.a.token, 0, now).self.finder.eligible, ["hollow-crypt"]);
  w.worldBoss.wakeAt = 0;
  w.tick(0.1, now + 100);
  assert.equal(w.worldBoss.boss, null, "the world boss stays asleep");
});

test("the server reports demo mode from HEARTHWILD_DEMO or its option", async () => {
  const dir = mkdtempSync(join(tmpdir(), "hw-demo-"));
  const app = createGameServer({ dataDir: dir, demo: true });
  await new Promise((r) => app.server.listen(0, "127.0.0.1", r));
  const info = await (await fetch(`http://127.0.0.1:${app.server.address().port}/api/info`)).json();
  assert.equal(info.demo, true);
  await app.close();
  rmSync(dir, { recursive: true, force: true });
});
