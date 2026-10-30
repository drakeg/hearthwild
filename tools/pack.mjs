// Packages the desktop app for one platform with Electron Packager.
//   node tools/pack.mjs <platform> <arch> <outDir>
import { packager } from "@electron/packager";
import { cpSync, mkdirSync, rmSync, readFileSync } from "node:fs";
import { join } from "node:path";
const [platform, arch, out = "dist"] = process.argv.slice(2);
const { version } = JSON.parse(readFileSync("package.json", "utf8"));
const stage = join(out, `stage-${platform}-${arch}`);
rmSync(stage, { recursive: true, force: true });
mkdirSync(stage, { recursive: true });
for (const p of ["desktop", "public", "server", "package.json", "README.md", "CHANGELOG.md"]) cpSync(p, join(stage, p), { recursive: true });
const [path] = await packager({
  dir: stage,
  out,
  name: "Hearthwild",
  executableName: platform === "linux" ? "hearthwild" : "Hearthwild",
  platform,
  arch,
  electronVersion: "45.0.0",
  appVersion: version,
  appBundleId: "com.hearthwild.game",
  appCopyright: "Hearthwild",
  asar: false,
  overwrite: true,
  prune: false,
  win32metadata: { CompanyName: "Hearthwild", ProductName: "Hearthwild", FileDescription: "Hearthwild" },
});
rmSync(stage, { recursive: true, force: true });
console.log(path);
