import {
  randomBytes,
  randomUUID,
  scrypt,
  timingSafeEqual,
  createHash,
} from "node:crypto";
import { promisify } from "node:util";
import { GameError } from "./world.js";
const derive = promisify(scrypt),
  digest = (value) => createHash("sha256").update(value).digest("hex");
const profile = { N: 131072, r: 8, p: 1, maxmem: 192 * 1024 * 1024 };
function validate({ username, password } = {}) {
  if (
    typeof username !== "string" ||
    !/^[a-zA-Z0-9_][a-zA-Z0-9_.-]{2,31}$/.test(username.trim())
  )
    throw new GameError(
      "Use a username of 3–32 letters, numbers, underscores, dots or hyphens.",
    );
  if (
    typeof password !== "string" ||
    password.length < 10 ||
    password.length > 128
  )
    throw new GameError("Use a password of 10–128 characters.");
  return { username: username.trim(), password };
}
export class Accounts {
  constructor(saved = {}) {
    this.accounts = new Map((saved.accounts ?? []).map((a) => [a.id, a]));
    this.sessions = new Map(
      (saved.sessions ?? [])
        .filter((s) => s.expiresAt > Date.now())
        .map((s) => [s.hash, s]),
    );
    this.busy = 0;
  }
  async passwordHash(password, salt) {
    if (this.busy >= 2)
      throw new GameError("Account service is busy. Try again shortly.", 429);
    this.busy++;
    try {
      return await derive(password, salt, 64, profile);
    } finally {
      this.busy--;
    }
  }
  async register(payload) {
    const { username, password } = validate(payload ?? {}),
      key = username.toLowerCase();
    if (this.accounts.size >= 500)
      throw new GameError("This server has reached its account limit.", 409);
    if ([...this.accounts.values()].some((a) => a.key === key))
      throw new GameError("That username is already taken.", 409);
    const salt = randomBytes(16).toString("hex"),
      passwordHash = (await this.passwordHash(password, salt)).toString("hex");
    if ([...this.accounts.values()].some((a) => a.key === key))
      throw new GameError("That username is already taken.", 409);
    const account = {
      id: randomUUID(),
      username,
      key,
      salt,
      passwordHash,
      createdAt: Date.now(),
    };
    this.accounts.set(account.id, account);
    return this.issue(account);
  }
  async login(payload) {
    const { username, password } = validate(payload ?? {}),
      account = [...this.accounts.values()].find(
        (a) => a.key === username.toLowerCase(),
      );
    const actual = await this.passwordHash(
        password,
        account?.salt ?? "00000000000000000000000000000000",
      ),
      expected = Buffer.from(account?.passwordHash ?? "00".repeat(64), "hex");
    if (!timingSafeEqual(actual, expected) || !account)
      throw new GameError("Username or password is incorrect.", 401);
    return this.issue(account);
  }
  issue(account) {
    const session = randomBytes(32).toString("hex"),
      hash = digest(session);
    this.sessions.set(hash, {
      hash,
      accountId: account.id,
      expiresAt: Date.now() + 30 * 86400000,
    });
    const own = [...this.sessions.values()]
      .filter((s) => s.accountId === account.id)
      .sort((a, b) => a.expiresAt - b.expiresAt);
    for (const s of own.slice(0, -10)) this.sessions.delete(s.hash);
    return { account: { id: account.id, username: account.username }, session };
  }
  authenticate(session) {
    const s =
        typeof session === "string" && session.length === 64
          ? this.sessions.get(digest(session))
          : null,
      account =
        s && s.expiresAt > Date.now() ? this.accounts.get(s.accountId) : null;
    if (!account) throw new GameError("Sign in to your account.", 401);
    return { id: account.id, username: account.username };
  }
  logout(session) {
    if (typeof session === "string") this.sessions.delete(digest(session));
  }
  async resetPassword(username, password) {
    const data = validate({ username, password }),
      account = [...this.accounts.values()].find(
        (a) => a.key === data.username.toLowerCase(),
      );
    if (!account) throw new GameError("Account not found.", 404);
    const salt = randomBytes(16).toString("hex"),
      passwordHash = (await this.passwordHash(password, salt)).toString("hex");
    account.salt = salt;
    account.passwordHash = passwordHash;
    for (const [hash, s] of this.sessions)
      if (s.accountId === account.id) this.sessions.delete(hash);
  }
  save() {
    return {
      accounts: [...this.accounts.values()],
      sessions: [...this.sessions.values()].filter(
        (s) => s.expiresAt > Date.now(),
      ),
    };
  }
}
