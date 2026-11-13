// Settings for the server the desktop app runs, kept in server-config.json in the app's data
// folder and edited from the Server Manager window.
const fs = require("node:fs");

const DEFAULTS = Object.freeze({
  // Off: only this computer can play. On: friends on your network can join too.
  share: false,
  port: 4180,
  tlsCert: "",
  tlsKey: "",
  charterSignatures: 2,
});

// Checks settings and returns { config, errors }; the config has every field, with defaults.
function validate(input = {}) {
  const errors = [],
    config = { ...DEFAULTS };
  if (input.share !== undefined) {
    if (typeof input.share !== "boolean") errors.push("Sharing must be on or off.");
    else config.share = input.share;
  }
  if (input.port !== undefined) {
    const port = Number(input.port);
    if (!Number.isInteger(port) || port < 1024 || port > 65535) errors.push("Choose a port from 1024 to 65535.");
    else config.port = port;
  }
  for (const key of ["tlsCert", "tlsKey"]) {
    if (input[key] === undefined || input[key] === null) continue;
    if (typeof input[key] !== "string") errors.push("Certificate paths must be text.");
    else config[key] = input[key].trim();
  }
  if (Boolean(config.tlsCert) !== Boolean(config.tlsKey)) errors.push("Choose both the HTTPS certificate and its key, or neither.");
  for (const key of ["tlsCert", "tlsKey"])
    if (config[key] && !fs.existsSync(config[key])) errors.push(`${key === "tlsCert" ? "Certificate" : "Key"} file not found: ${config[key]}`);
  if (input.charterSignatures !== undefined) {
    const n = Number(input.charterSignatures);
    if (!Number.isInteger(n) || n < 1 || n > 10) errors.push("Guild charters need from 1 to 10 signatures.");
    else config.charterSignatures = n;
  }
  return { config, errors };
}
function load(file) {
  try {
    const { config, errors } = validate(JSON.parse(fs.readFileSync(file, "utf8")));
    return errors.length ? { ...DEFAULTS } : config;
  } catch {
    return { ...DEFAULTS };
  }
}
function save(file, input) {
  const result = validate(input);
  if (!result.errors.length) fs.writeFileSync(file, JSON.stringify(result.config, null, 2), { mode: 0o600 });
  return result;
}
module.exports = { DEFAULTS, validate, load, save };
