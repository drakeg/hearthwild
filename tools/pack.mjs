// Packages the desktop app for one platform with Electron Packager.
//   node tools/pack.mjs <platform> <arch> <outDir> [demo]
// With "demo", it builds the free demo (the Stillwood, up to level 6) as "Hearthwild Demo".
import { packager } from "@electron/packager";
import { cpSync, mkdirSync, rmSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
const [platform, arch, out = "dist", variant] = process.argv.slice(2),
  demo = variant === "demo",
  title = demo ? "Hearthwild Demo" : "Hearthwild";
const { version } = JSON.parse(readFileSync("package.json", "utf8"));
const stage = join(out, `stage-${platform}-${arch}`);
rmSync(stage, { recursive: true, force: true });
mkdirSync(stage, { recursive: true });
for (const p of ["desktop", "public", "server", "package.json", "README.md", "CHANGELOG.md"]) cpSync(p, join(stage, p), { recursive: true });
if (demo) writeFileSync(join(stage, "demo.json"), JSON.stringify({ demo: true }) + "\n");
const [path] = await packager({
  dir: stage,
  out,
  name: title,
  executableName: platform === "linux" ? (demo ? "hearthwild-demo" : "hearthwild") : demo ? "Hearthwild Demo" : "Hearthwild",
  platform,
  arch,
  electronVersion: "45.0.0",
  appVersion: version,
  appBundleId: demo ? "com.hearthwild.demo" : "com.hearthwild.game",
  appCopyright: "Hearthwild",
  asar: false,
  overwrite: true,
  prune: false,
  win32metadata: { CompanyName: "Hearthwild", ProductName: title, FileDescription: title },
});
rmSync(stage, { recursive: true, force: true });
console.log(path);
