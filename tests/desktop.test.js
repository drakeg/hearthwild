import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { createRequire } from "node:module";
const localRequire = createRequire(import.meta.url);
test("desktop quit bridge exposes only quit and accepts requests only from the game window", async () => {
  let exposed,
    channel,
    handler,
    quits = 0;
  const bridge = {
    contextBridge: {
      exposeInMainWorld: (name, value) => {
        assert.equal(name, "hearthwildDesktop");
        exposed = value;
      },
    },
    ipcRenderer: {
      invoke: async (name) => {
        channel = name;
        return true;
      },
    },
  };
  vm.runInNewContext(
    readFileSync(new URL("../desktop/preload.cjs", import.meta.url), "utf8"),
    {
      require: (name) => {
        assert.equal(name, "electron");
        return bridge;
      },
    },
  );
  assert.deepEqual(Object.keys(exposed), ["quit"]);
  await exposed.quit();
  assert.equal(channel, "hearthwild:quit");
  const app = {
      requestSingleInstanceLock: () => false,
      quit: () => quits++,
      setName: () => {},
      on: () => {},
    },
    electron = {
      app,
      BrowserWindow: class {},
      Menu: {},
      dialog: {},
      ipcMain: {
        handle: (name, fn) => {
          assert.equal(name, channel);
          handler = fn;
        },
      },
    };
  const context = vm.createContext({
    require: (name) => (name === "electron" ? electron : localRequire(name)),
    __dirname: "/test/desktop",
    process,
    console,
  });
  vm.runInContext(
    readFileSync(new URL("../desktop/main.cjs", import.meta.url), "utf8"),
    context,
  );
  const sender = {};
  context.testSender = sender;
  vm.runInContext("win={webContents:testSender}", context);
  const before = quits;
  assert.equal(handler({ sender: {} }), false);
  assert.equal(quits, before);
  assert.equal(handler({ sender }), true);
  assert.equal(quits, before + 1);
});
