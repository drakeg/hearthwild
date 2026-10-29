import {
  readFileSync,
  writeFileSync,
  renameSync,
  existsSync,
  copyFileSync,
} from "node:fs";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Accounts } from "./accounts.js";
async function hidden(prompt) {
  if (!process.stdin.isTTY)
    throw Error(
      "Use an interactive terminal; passwords are never command-line arguments.",
    );
  process.stdout.write(prompt);
  process.stdin.setRawMode(true);
  process.stdin.resume();
  return new Promise((yes, no) => {
    let value = "";
    const done = () => {
      process.stdin.off("data", input);
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdout.write("\n");
    };
    const input = (chunk) => {
      for (const c of chunk.toString()) {
        if (c === "\u0003") {
          done();
          no(Error("Cancelled."));
          return;
        }
        if (c === "\r" || c === "\n") {
          done();
          yes(value);
          return;
        }
        if (c === "\u007f" || c === "\b") {
          value = Array.from(value).slice(0, -1).join("");
        } else if (c >= " ") value += c;
      }
    };
    process.stdin.on("data", input);
  });
}
try {
  const username = process.argv[2];
  if (!username)
    throw Error("Usage: node server/reset-password.js USERNAME [SAVE_FOLDER]");
  const root = resolve(
      process.argv[3] ?? fileURLToPath(new URL("../data/", import.meta.url)),
    ),
    lock = join(root, "server.lock");
  if (existsSync(lock)) {
    const state = JSON.parse(readFileSync(lock, "utf8"));
    try {
      process.kill(state.pid, 0);
      throw Error("Stop the game/server before resetting a password.");
    } catch (e) {
      if (e.code !== "ESRCH") throw e;
    }
  }
  const file = join(root, "world.json"),
    world = JSON.parse(readFileSync(file, "utf8")),
    accounts = new Accounts(world.auth);
  const password = await hidden(
      "New password (10+ characters; input hidden): ",
    ),
    confirm = await hidden("Repeat password: ");
  if (password !== confirm) throw Error("Passwords do not match.");
  await accounts.resetPassword(username, password);
  copyFileSync(file, file + ".before-password-reset");
  world.auth = accounts.save();
  writeFileSync(file + ".tmp", JSON.stringify(world), { mode: 0o600 });
  renameSync(file + ".tmp", file);
  console.log("Password reset. Existing sessions were signed out.");
} catch (e) {
  console.error(e.message);
  process.exitCode = 1;
}
