import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdtempSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const { DEFAULTS, validate, load, save } = createRequire(import.meta.url)("../desktop/server-config.cjs");

test("server settings start private, on port 4180, with two charter signatures", () => {
  assert.deepEqual(validate({}).config, { share: false, port: 4180, tlsCert: "", tlsKey: "", charterSignatures: 2 });
  assert.equal(validate({}).errors.length, 0);
});

test("bad settings are explained instead of saved", () => {
  assert.match(validate({ port: 80 }).errors[0], /1024 to 65535/);
  assert.match(validate({ port: "abc" }).errors[0], /port/);
  assert.match(validate({ charterSignatures: 0 }).errors[0], /1 to 10/);
  assert.match(validate({ share: "yes" }).errors[0], /on or off/);
  assert.ok(validate({ tlsCert: "/no/such/cert.pem" }).errors.some((e) => /both/.test(e)));
  assert.ok(validate({ tlsCert: "/no/such/cert.pem", tlsKey: "/no/such/key.pem" }).errors.some((e) => /not found/.test(e)));
});

test("settings save to disk and load back; a damaged file falls back to the defaults", () => {
  const dir = mkdtempSync(join(tmpdir(), "hw-config-")),
    file = join(dir, "server-config.json"),
    cert = join(dir, "cert.pem"),
    key = join(dir, "key.pem");
  writeFileSync(cert, "x");
  writeFileSync(key, "y");
  assert.equal(save(file, { share: true, port: 5000, tlsCert: cert, tlsKey: key, charterSignatures: 3 }).errors.length, 0);
  assert.deepEqual(load(file), { share: true, port: 5000, tlsCert: cert, tlsKey: key, charterSignatures: 3 });
  assert.equal(save(file, { port: 1 }).errors.length, 1);
  assert.equal(JSON.parse(readFileSync(file, "utf8")).port, 5000, "a rejected save leaves the file alone");
  writeFileSync(file, "{ not json");
  assert.deepEqual(load(file), { ...DEFAULTS });
  assert.deepEqual(load(join(dir, "missing.json")), { ...DEFAULTS });
});
