import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { publicAssets } from "../server/http.js";

test("every client file is served by its own path, with no hand-kept list", () => {
  const assets = publicAssets();
  for (const path of ["/", "/game.js", "/finder-ui.js", "/reagents.js", "/hud.css", "/vendor/three.module.js", "/art/abilities-2.png"])
    assert.ok(assets.has(path), path);
  assert.equal(assets.get("/game.js")[1], "text/javascript");
  assert.ok([...assets.keys()].some((k) => k.startsWith("/models/") && k.endsWith(".glb")));
});

test("hidden files, unknown types and odd names are never served", () => {
  const dir = mkdtempSync(join(tmpdir(), "hw-public-"));
  mkdirSync(join(dir, "sub"));
  mkdirSync(join(dir, ".git"));
  for (const f of ["index.html", "ok.js", "sub/deep.css", ".env", ".git/config.js", "notes.md", "server.lock", "we ird.js", "-dash.js"]) writeFileSync(join(dir, f), "x");
  const assets = publicAssets(dir);
  assert.deepEqual([...assets.keys()].sort(), ["/", "/favicon.ico", "/index.html", "/ok.js", "/sub/deep.css"]);
  assert.ok(![...assets.keys()].some((k) => k.includes("..")));
});
