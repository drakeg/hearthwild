import { WORLD_LIMIT, inSanctuary, subzoneAt, zoneAt, ZONES } from "../public/world-config.js";
import { GRAVEYARDS, insideHouse, lakeAt } from "../public/terrain.js";
import { RIDING, CARAVAN_SPEED, WAYSTONE, STOPS, stopById, homePoint, route, caravanFare } from "./travel.js";
import { createMonsters, monsterDelay, monsterPosition } from "./wilderness.js";
import {
  ITEMS,
  NPCS,
  QUESTS,
  stats,
  describeItem,
  initAdventure,
  CLASSES,
  ABILITIES,
  abilityFor,
  addExperience,
} from "./content.js";
import { commerce, PRICES, RECIPES } from "./commerce.js";
import { createHerbs, respawnHerbs, HERB_RESPAWN } from "./resources.js";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { Parties } from "./party.js";
import { Guilds } from "./guild.js";
import { Crypts, walkableAt } from "./crypt.js";
import { CRYPT, DUNGEON_LIST, dungeonOf } from "../public/dungeon-layout.js";
import { DUNGEON_LOOT } from "./content-world.js";
import { Grid, VIEW, AWAKE_RADIUS, contentKey } from "./interest.js";
import { Finder, FINDER } from "./finder.js";
import { REAGENTS, POUCH_LIMIT } from "../public/reagents.js";
import {
  MELEE_RANGE,
  LEASH_RANGE,
  COMBAT_LINGER,
  CRIT_CHANCE,
  CRIT_MULTIPLIER,
  MOB_SWING,
  MOB_REACH,
  mobStats,
  applyLevel,
  aggroRadius,
  killExperience,
  autoAttackDamage,
} from "./combat.js";
export const FACTIONS = ["dawnward", "mossbound"];
const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const hash = (token) => createHash("sha256").update(token).digest("hex");
export class GameError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}
const reject = (condition, message, status) => {
  if (condition) throw new GameError(message, status);
};
const publicPlayer = (p) => ({
  id: p.id,
  name: p.name,
  faction: p.faction,
  x: p.x,
  z: p.z,
  hp: p.hp,
  coins: p.coins,
  kills: p.kills,
  stats: stats(p),
  appearance: Object.fromEntries(
    ["weapon", "chest", "charm"].map((slot) => [
      slot,
      p.inventory.find((i) => i.id === p.equipment[slot])?.template ?? null,
    ]),
  ),
  classId: p.classId,
  gender: p.gender ?? "male",
  level: p.level,
  dead: !!p.dead,
  sitting: !!p.eating,
  inCombat: (p.combatUntil ?? 0) > Date.now(),
  casting: p.casting ?? null,
  instance: p.instance ?? null,
  partyId: p.partyId ?? null,
});
const zoneOf = (o) => o?.instance ?? null;
export class World {
  constructor(saved = {}, { random = Math.random, combatRandom = random, charterSignatures } = {}) {
    this.random = random;
    this.combatRandom = combatRandom;
    this.players = new Map();
    this.keys = new Map();
    this.sequence = 0;
    this.chatEpoch = randomUUID();
    for (const p of saved.players ?? []) {
      this.players.set(p.id, {
        ...initAdventure(p),
        input: { x: 0, z: 0 },
        inputAt: 0,
        seen: 0,
        lastChat: -Infinity,
        lastAttack: -Infinity,
        messages: [],
      });
      this.keys.set(p.keyHash, p.id);
    }
    this.npcs = NPCS;
    this.loot = saved.loot ?? [];
    this.events = [];
    this.eventSequence = 0;
    this.resources = createHerbs(this.random, saved.resources);
    this.enemies = createMonsters(this.random, saved.enemies);
    this.enemyGrid = new Grid(100).build(this.enemies);
    this.playerGrid = new Grid(100);
    // Content that never changes is sent once per client (and again only if it changes).
    this.shop = Object.entries(PRICES).filter(([, [buy]]) => buy !== null).map(([template, [buy, sell]]) => ({ ...ITEMS[template], template, buy, sell }));
    this.contentBase = contentKey({ shop: this.shop, recipes: RECIPES, classes: CLASSES, quests: QUESTS, npcs: NPCS, abilities: ABILITIES });
    this.parties = new Parties(this);
    this.finder = new Finder(this);
    this.crypts = new Crypts(this);
    this.guilds = new Guilds(this, saved.guilds, {
      signatures: charterSignatures ?? (Number(process.env.HEARTHWILD_CHARTER_SIGNATURES) || 2),
    });
  }
  // What other players see, including the guild name under their nameplate.
  pub(p) {
    return { ...publicPlayer(p), guild: this.guilds.nameOf(p), mounted: !!(p.mounted || p.travel) };
  }
  // Riding ends the moment you fight, get hurt, die or go underground.
  dismount(p) {
    p.mounted = false;
  }
  // A waystone recall is broken by moving, fighting or taking a hit.
  breakRecall(p, now, why) {
    if (!p.recall) return;
    p.recall = null;
    this.system(p, `Waystone interrupted${why ? ` (${why})` : ""}.`, now);
  }
  zoneName(p) {
    return p.instance ? (dungeonOf(p.instance) ?? CRYPT).name : subzoneAt(p.x, p.z);
  }
  // Enemies that share the player's zone: the open world, or their dungeon copy.
  enemiesFor(p) {
    if (!p?.instance) return this.enemies;
    return this.crypts.instances.get(p.instance)?.enemies ?? [];
  }
  allEnemies() {
    return [this.enemies, ...[...this.crypts.instances.values()].map((i) => i.enemies)].flat();
  }
  maxHp(p) {
    return stats(p).maxHp;
  }
  // ---------- Host tools (used by the Server Manager) ----------
  online(now = Date.now()) {
    return [...this.players.values()].filter((q) => now - q.seen < 15000);
  }
  // Ends a player's session: their next request returns them to the character list with a reason.
  kick(p, reason = "The host removed you from the world. You can come back in from your characters.") {
    this.removed ??= new Map();
    if (this.removed.size > 200) this.removed.clear();
    this.removed.set(p.keyHash, reason);
    this.keys.delete(p.keyHash);
    p.accessToken = null;
    p.keyHash = hash(randomBytes(32).toString("hex"));
    this.keys.set(p.keyHash, p.id);
    p.seen = -Infinity;
    p.input = { x: 0, z: 0 };
    p.casting = null;
    p.autoAttack = null;
  }
  announce(text, now = Date.now()) {
    const message = String(text ?? "").trim().slice(0, 300);
    reject(!message, "Write an announcement first.");
    for (const p of this.online(now)) this.system(p, `[Server] ${message}`, now);
    return message;
  }
  system(p, text, now = Date.now()) {
    p.messages.push({ id: ++this.sequence, from: "", channel: "system", text, time: now });
    if (p.messages.length > 80) p.messages.shift();
  }
  // Damage from encounter mechanics (Ashfall, Soul Drain) rather than melee swings.
  // A damage shield soaks up hits before health does.
  absorb(p, damage, now, source) {
    if (!p.shield || p.shield.until <= now || p.shield.amount <= 0) return damage;
    const soaked = Math.min(p.shield.amount, damage);
    p.shield.amount -= soaked;
    if (p.shield.amount <= 0) p.shield = null;
    this.event("absorb", { to: p.id, from: source?.id, amount: soaked, x: p.x, z: p.z, zone: zoneOf(p) }, now);
    return damage - soaked;
  }
  hurtPlayer(p, amount, now, source, name) {
    const damage = this.absorb(p, Math.max(1, Math.round(amount - stats(p).armor * 0.5)), now, source);
    p.hp -= damage;
    this.dismount(p);
    this.breakRecall(p, now, "you were hit");
    p.eating = null;
    p.combatUntil = now + COMBAT_LINGER;
    this.event("hit", { from: source?.id, to: p.id, damage, spell: name, x: p.x, z: p.z, zone: zoneOf(p) }, now);
    if (p.hp <= 0) this.killPlayer(p, now);
  }
  leavePartyInstance(p, party, now) {
    if (p.instance && this.crypts.instances.get(p.instance)?.key.endsWith(`party:${party.id}`)) {
      this.crypts.leave(p);
      this.system(p, "You left the group and were returned to the dungeon entrance.", now);
    }
  }
  join(payload) {
    reject(
      !payload || typeof payload !== "object" || Array.isArray(payload),
      "Invalid character.",
    );
    let { name, faction, classId = "warrior", gender = "male" } = payload;
    reject(!["male", "female"].includes(gender), "Choose a body type.");
    reject(
      typeof classId !== "string" || !Object.hasOwn(CLASSES, classId),
      "Choose a character class.",
    );
    reject(
      typeof name !== "string" ||
        !/^[A-Za-z][A-Za-z0-9 -]{1,17}$/.test(name.trim()),
      "Use a name of 2–18 letters, numbers, spaces or hyphens.",
    );
    name = name.trim();
    reject(!FACTIONS.includes(faction), "Choose a faction.");
    reject(
      [...this.players.values()].some(
        (p) => p.name.toLowerCase() === name.toLowerCase(),
      ),
      "That character name is already in use. Choose another name.",
      409,
    );
    reject(
      this.players.size >= 100,
      "This prototype has reached its character limit.",
      409,
    );
    const token = randomBytes(32).toString("hex"),
      id = randomUUID();
    const p = {
      id,
      classId,
      gender,
      name,
      faction,
      x: faction === "dawnward" ? -2 : 2,
      z: 10,
      hp: 100,
      coins: 0,
      kills: 0,
      keyHash: hash(token),
      input: { x: 0, z: 0 },
      inputAt: 0,
      seen: Date.now(),
      lastChat: -Infinity,
      lastAttack: -Infinity,
      messages: [],
    };
    initAdventure(p);
    this.players.set(id, p);
    this.keys.set(p.keyHash, id);
    return { id, token };
  }
  accountToken(accountId, characterId) {
    const p = this.players.get(characterId);
    reject(
      !p || p.accountId !== accountId,
      "Choose a character belonging to your account.",
      403,
    );
    if (!p.accessToken) {
      p.accessToken = randomBytes(32).toString("hex");
      this.keys.delete(p.keyHash);
      p.keyHash = hash(p.accessToken);
      this.keys.set(p.keyHash, p.id);
    }
    return p.accessToken;
  }
  claimLegacy(accountId) {
    for (const p of this.players.values())
      if (!p.accountId) {
        p.accountId = accountId;
        this.keys.delete(p.keyHash);
        p.accessToken = null;
      }
  }
  authenticate(token) {
    reject(
      typeof token !== "string" || token.length !== 64,
      "Your return key is missing or invalid.",
      401,
    );
    const p = this.players.get(this.keys.get(hash(token)));
    // A player the host removed is told why (once), then sent back to their characters.
    const removed = !p && this.removed?.get(hash(token));
    if (removed) {
      this.removed.delete(hash(token));
      reject(true, removed, 401);
    }
    reject(!p, "Your return key is missing or invalid.", 401);
    return p;
  }
  state(token, after = 0, now = Date.now(), known = null, herbs = null) {
    const p = this.authenticate(token);
    const returning = now - p.seen >= 15000;
    p.seen = now;
    if (returning) this.guilds.cameOnline(p, now);
    if (p.instance && !this.crypts.instances.has(p.instance)) {
      // The dungeon copy reset while they were away.
      this.crypts.leave(p);
      this.system(p, "The dungeon has reset. You find yourself back at its entrance.", now);
    }
    for (const k of ["partyInvite", "guildInvite", "charterRequest"]) if (p[k] && p[k].expiresAt <= now) p[k] = null;
    if (!p.instance && !p.dead) this.explore(p, now);
    const zone = zoneOf(p),
      content = `${this.contentBase}:${p.classId}`,
      fresh = known !== content,
      near = (list, r) => list.filter((o) => distance(p, o) < r);
    return {
      chatEpoch: this.chatEpoch,
      content,
      self: {
        ...this.pub(p),
        inventory: p.inventory.map(describeItem),
        professions: p.professions,
        buyback: p.buyback.map(describeItem),
        potionReadyAt: p.potionReadyAt,
        equipment: p.equipment,
        quests: Object.fromEntries(Object.entries(p.quests).map(([id, q]) => [id, this.questLock(p, QUESTS[id]) ? { ...q, locked: true } : q])),
        materials: p.materials,
        power: p.power,
        xp: p.xp,
        xpNeeded: p.level * 100,
        cooldowns: p.cooldowns,
        globalReadyAt: p.globalReadyAt ?? 0,
        gcd: CLASSES[p.classId].gcd,
        casting: p.casting ?? null,
        autoAttack: p.autoAttack ?? null,
        swingReadyAt: p.swingReadyAt ?? 0,
        swingSpeed: CLASSES[p.classId].swing,
        combatUntil: p.combatUntil ?? 0,
        inCombat: (p.combatUntil ?? 0) > now,
        dead: !!p.dead,
        eating: p.eating ?? null,
        subzone: p.instance ? (dungeonOf(p.instance) ?? CRYPT).name : subzoneAt(p.x, p.z),
        zone: p.instance ? (dungeonOf(p.instance) ?? CRYPT).name : ZONES[zoneAt(p.x, p.z)].name,
        sanctuary: !p.instance && inSanctuary(p),
        instance: p.instance ?? null,
        party: this.parties.view(p, now),
        partyInvite: p.partyInvite ? { from: p.partyInvite.from } : null,
        shield: p.shield && p.shield.until > now ? { amount: p.shield.amount, until: p.shield.until } : null,
        riding: !!p.riding,
        mounted: !!p.mounted,
        home: p.home ?? "camp",
        homeName: stopById(p.home ?? "camp").name,
        finder: this.finder.view(p, now),
        waystoneReadyAt: p.waystoneReadyAt ?? 0,
        recall: p.recall,
        travel: p.travel ? { to: p.travel.to, name: p.travel.name, startedAt: p.travel.startedAt, eta: p.travel.eta } : null,
        guildInfo: this.guilds.view(p, now),
        guildInvite: p.guildInvite ? { from: p.guildInvite.from, name: p.guildInvite.name } : null,
        charter: this.guilds.charterView(p),
        charterRequest: p.charterRequest ? { from: p.charterRequest.fromName, name: p.charterRequest.name } : null,
      },
      ...(fresh && { shop: this.shop, recipes: RECIPES, classes: CLASSES, abilities: ABILITIES[p.classId], questDefinitions: QUESTS, npcs: this.npcs }),
      portals: p.instance
        ? [(({ origin, exit, id }) => ({ id: `${id}-exit`, type: "exit", name: "Exit", x: origin.x + exit.x, z: origin.z + exit.z }))(dungeonOf(p.instance) ?? CRYPT)]
        : DUNGEON_LIST.map((d) => ({ id: `${d.id}-door`, type: "enter", name: d.name, x: d.door.x, z: d.door.z })),
      telegraphs: p.instance ? (this.crypts.instances.get(p.instance)?.telegraphs ?? []).map(({ boss, ...t }) => t) : [],
      // The herb finder: every patch ready to pick in the zone the map shows (or the whole world).
      ...(herbs && { herbMap: this.resources.filter((r) => !r.depleted && (herbs === "world" || r.zone === herbs)).map((r) => [Math.round(r.x), Math.round(r.z), r.kind]) }),
      resources: (p.instance ? [] : near(this.resources, VIEW.resources)).map((r) => ({
        ...r,
        available: !r.depleted,
      })),
      loot: this.loot
        .filter((l) => l.ownerId === p.id && l.expiresAt > now && (l.zone ?? null) === zone && distance(l, p) < VIEW.loot)
        .map(({ ownerId, ...l }) => ({
          ...l,
          items: l.items.map(describeItem),
        })),
      events: this.events.filter(
        (e) => now - e.time < 2500 && (e.zone ?? null) === zone && distance(e, p) < 60,
      ),
      players: [...this.players.values()]
        .filter((q) => now - q.seen < 15000 && zoneOf(q) === zone && distance(p, q) < VIEW.players)
        .map((q) => this.pub(q)),
      enemies: (p.instance ? near(this.enemiesFor(p), VIEW.enemies) : this.enemyGrid.near(p.x, p.z, VIEW.enemies))
        .map(({ contributors, homeX, homeZ, lastAttack, threat, dots, stunnedUntil, ...e }) => ({
          ...e,
          engaged: threat?.has(p.id) ?? false,
          stunned: (stunnedUntil ?? 0) > now,
          afflicted: dots?.some((d) => d.from === p.id) ?? false,
        })),
      messages: p.messages.filter((m) => m.id > after),
      serverTime: now,
    };
  }
  act(token, a, now = Date.now()) {
    const p = this.authenticate(token);
    reject(!a || typeof a !== "object" || Array.isArray(a), "Invalid action.");
    p.seen = now;
    reject(
      p.dead && !["chat", "leave", "release"].includes(a.type),
      "You are dead. Release your spirit to return to the nearest graveyard.",
      409,
    );
    const trade = commerce(p, a, this.npcs, now);
    if (trade) {
      if (["active", "ready"].includes(p.quests.starleaf.status)) {
        p.quests.starleaf.progress = Math.min(4, p.materials.starleaf);
        p.quests.starleaf.status =
          p.materials.starleaf >= 4 ? "ready" : "active";
      }
      return trade;
    }
    if (a.type === "leave") {
      p.seen = -Infinity;
      p.input = { x: 0, z: 0 };
      p.casting = null;
      p.autoAttack = null;
      return { message: "Left the world." };
    }
    if (a.type === "party") return this.parties.act(p, a, now, reject);
    if (a.type === "finder") return this.finder.act(p, a, now, reject);
    if (a.type === "guild") return this.guilds.act(p, a, now, reject);
    if (a.type === "release") {
      reject(!p.dead, "You are not dead.");
      const where = p.instance ? null : this.graveyardFor(p).name;
      this.revive(p, now);
      return { message: where ? `Your spirit returns to ${where}.` : "Your spirit returns to the dungeon entrance." };
    }
    reject(
      p.dead && a.type !== "chat",
      "You are dead. Release your spirit to return to the nearest graveyard.",
      409,
    );
    if (a.type === "enter") return this.crypts.enter(p, now, reject);
    if (a.type === "exit") return this.crypts.exit(p, now, reject);
    if (a.type === "autoattack") {
      if (a.stop) {
        p.autoAttack = null;
        return;
      }
      const target = this.enemiesFor(p).find((e) => e.id === a.target);
      reject(!target || target.hp <= 0, "You have no target.");
      reject(target.evading, "Target is evading.");
      this.startAutoAttack(p, target, now);
      return;
    }
    if (a.type === "input") {
      reject(
        !Number.isFinite(a.x) ||
          !Number.isFinite(a.z) ||
          Math.abs(a.x) > 1 ||
          Math.abs(a.z) > 1,
        "Invalid movement.",
      );
      const length = Math.max(1, Math.hypot(a.x, a.z));
      p.input = { x: a.x / length, z: a.z / length };
      p.inputAt = now;
      if (p.eating && Math.hypot(a.x, a.z) > 0.01) p.eating = null;
      if (Math.hypot(a.x, a.z) > 0.01) this.breakRecall(p, now, "you moved");
      return;
    }
    if (a.type === "riding") {
      const npc = this.npcs.find((n) => n.id === p.talkedNpc && n.stable);
      reject(!npc || distance(p, npc) > 4.5, "Speak to a stablemaster to learn riding.");
      reject(p.riding, "You already know how to ride.");
      reject(p.level < RIDING.level, `Riding is taught from level ${RIDING.level}.`);
      reject(p.coins < RIDING.cost, `Riding lessons cost ${RIDING.cost} gold.`);
      p.coins -= RIDING.cost;
      p.riding = true;
      return { message: "You learned to ride! Press U to call your mount." };
    }
    if (a.type === "mount") {
      if (p.mounted) {
        p.mounted = false;
        return { message: "Dismounted." };
      }
      reject(!p.riding, "You haven’t learned to ride. Visit a stablemaster at level 10.");
      reject(p.instance, "Mounts can’t follow you underground.");
      reject((p.combatUntil ?? 0) > now, "You can’t mount while in combat.");
      reject(p.travel, "You’re already riding with the caravan.");
      p.mounted = true;
      p.eating = null;
      p.autoAttack = null;
      this.breakRecall(p, now);
      return { message: "Mounted." };
    }
    if (a.type === "travel") {
      const npc = this.npcs.find((n) => n.id === p.talkedNpc && n.caravan);
      reject(!npc || distance(p, npc) > 4.5, "Speak to a caravan master to travel.");
      const to = stopById(a.to);
      reject(!to || to.id === npc.caravan, "Choose a destination.");
      reject(!this.knownStop(p, to), `You haven’t found ${to?.name ?? "that place"} yet. Travel there on foot first.`);
      reject((p.combatUntil ?? 0) > now, "You can’t leave while in combat.");
      const r = route(npc.caravan, to.id);
      reject(!r, "No road leads there.");
      const fare = caravanFare(r.length);
      reject(p.coins < fare, `The fare is ${fare} gold.`);
      p.coins -= fare;
      p.mounted = false;
      p.autoAttack = null;
      p.input = { x: 0, z: 0 };
      this.breakRecall(p, now);
      p.travel = { to: to.id, name: to.name, points: r.points, i: 0, startedAt: now, eta: now + (r.length / CARAVAN_SPEED) * 1000 };
      return { message: `The caravan sets off for ${to.name} (${fare} gold).` };
    }
    if (a.type === "home") {
      const npc = this.npcs.find((n) => n.id === p.talkedNpc && n.inn);
      reject(!npc || distance(p, npc) > 4.5, "Speak to an innkeeper or provisioner to make a town your home.");
      p.home = npc.inn;
      return { message: `${stopById(npc.inn).name} is now your home. Your waystone will return you here.` };
    }
    if (a.type === "waystone") {
      if (a.cancel) {
        this.breakRecall(p, now);
        return;
      }
      reject(p.instance, "Leave the dungeon before using your waystone.");
      reject(p.travel, "You’re riding with the caravan.");
      reject(p.recall, "You’re already using your waystone.");
      reject((p.combatUntil ?? 0) > now, "You can’t use your waystone in combat.");
      const wait = (p.waystoneReadyAt ?? 0) - now;
      reject(wait > 0, `Your waystone is recharging (${Math.ceil(wait / 60000)} min).`);
      p.mounted = false;
      p.input = { x: 0, z: 0 };
      p.recall = { startedAt: now, endsAt: now + WAYSTONE.castTime };
      return { message: `Your waystone glows… returning to ${stopById(p.home ?? "camp").name}.` };
    }
    if (a.type === "talk") {
      const npc = this.npcs.find((n) => n.id === a.target);
      reject(!npc, "Choose a villager.");
      reject(distance(p, npc) > 4.5, "Move closer to talk.");
      p.talkedNpc = npc.id;
      const deliveries = Object.values(QUESTS)
        .filter((q) => q.deliver?.to === npc.id && p.quests[q.id]?.status === "ready")
        .map((q) => ({ id: q.id, name: q.name, reward: q.reward, xp: q.xp }));
      const destinations = npc.caravan
        ? STOPS.filter((s) => s.id !== npc.caravan).map((s) => {
            const r = route(npc.caravan, s.id);
            return { id: s.id, name: s.name, known: this.knownStop(p, s), fare: r ? caravanFare(r.length) : null, seconds: r ? Math.round(r.length / CARAVAN_SPEED) : null };
          })
        : null;
      const riding = npc.stable ? { known: !!p.riding, level: RIDING.level, cost: RIDING.cost } : null;
      const inn = npc.inn ? { home: p.home ?? "camp", here: npc.inn, name: stopById(npc.inn).name } : null;
      return { npc, quest: QUESTS[npc.quest], progress: p.quests[npc.quest], locked: this.questLock(p, QUESTS[npc.quest]), deliveries, destinations, riding, inn };
    }
    if (a.type === "quest") {
      const quest =
        typeof a.quest === "string" && Object.hasOwn(QUESTS, a.quest)
          ? QUESTS[a.quest]
          : null;
      reject(!quest, "Unknown quest.");
      const progress = p.quests[quest.id],
        // Deliveries are handed in to the person they're addressed to.
        npc = this.npcs.find((n) => n.id === (a.operation === "complete" && quest.deliver ? quest.deliver.to : quest.npc));
      reject(distance(p, npc) > 4.5, "Move closer to the quest giver.");
      reject(p.talkedNpc !== npc.id, "Talk to the quest giver first.");
      if (a.operation === "accept") {
        reject(
          progress.status !== "offered",
          "You already accepted this quest.",
        );
        reject(quest.requires && p.quests[quest.requires]?.status !== "complete", `First complete “${QUESTS[quest.requires]?.name}”.`);
        reject(p.level < (quest.minLevel ?? 1), `Come back at level ${quest.minLevel}.`);
        progress.status = quest.deliver ? "ready" : "active";
        if (quest.deliver) progress.progress = 0;
        if (quest.id === "starleaf")
          progress.progress = Math.min(quest.required, p.materials.starleaf);
        if (!quest.deliver && progress.progress >= quest.required) progress.status = "ready";
      } else if (a.operation === "complete") {
        reject(progress.status !== "ready", "Finish the objectives first.");
        if (quest.deliver) progress.progress = 1;
        if (quest.id === "starleaf") {
          reject(p.materials.starleaf < 4, "You need four starleaf sprigs.");
          p.materials.starleaf -= 4;
        }
        progress.status = "complete";
        p.coins += quest.reward;
        addExperience(p, quest.xp ?? 60);
      } else throw new GameError("Choose accept or complete.");
      return;
    }
    if (a.type === "gather") {
      const r = this.resources.find((r) => r.id === a.target);
      reject(!r, "Choose a herb to gather.");
      reject(distance(p, r) > 3.2, "Move closer to gather.");
      const kind = r.kind ?? "starleaf",
        herb = REAGENTS[kind];
      reject(r.depleted, `This plant is regrowing. Look for another ${herb.name} patch.`);
      reject(p.materials[kind] >= POUCH_LIMIT, `Your pouch can’t hold more ${herb.name}.`);
      // Herbalists improve as they gather, and a skilled one often finds a second sprig.
      let count = 1;
      if (p.professions.herbalism) {
        if (this.random() < p.professions.herbalism / 250) count = 2;
        p.professions.herbalism = Math.min(100, p.professions.herbalism + 1);
      }
      count = Math.min(count, POUCH_LIMIT - p.materials[kind]);
      r.depleted = true;
      r.readyAt =
        now +
        HERB_RESPAWN.min +
        Math.floor(this.random() * (HERB_RESPAWN.max - HERB_RESPAWN.min + 1));
      p.materials[kind] += count;
      const q = p.quests.starleaf;
      if (kind === "starleaf" && ["active", "ready"].includes(q.status)) {
        q.progress = Math.min(4, p.materials.starleaf);
        if (q.progress === 4) q.status = "ready";
      }
      const questNote = kind !== "starleaf" ? "" : q.status === "ready" ? " · Quest ready — return to Herbalist Mira!" : q.status === "active" ? ` · Quest ${q.progress}/4` : "";
      return {
        message: `Gathered ${herb.name} ×${count} · ${p.materials[kind]} in your pouch${p.professions.herbalism ? ` · Herbalism ${p.professions.herbalism}` : ""}${questNote}`,
      };
    }
    if (a.type === "loot") {
      const l = this.loot.find(
        (l) => l.id === a.target && l.ownerId === p.id && l.expiresAt > now,
      );
      reject(!l, "This loot is not yours or has already been collected.");
      reject(distance(p, l) > 3.2, "Move closer to collect loot.");
      reject(p.inventory.length + l.items.length > 60, "Your bag is full.");
      p.coins += l.coins;
      p.inventory.push(...l.items);
      this.loot = this.loot.filter((x) => x !== l);
      return {
        message: `Looted ${l.coins} gold and ${l.items.map((i) => ITEMS[i.template].name).join(", ")}. Open Bags to equip.`,
      };
    }
    if (a.type === "equip") {
      const item = p.inventory.find((i) => i.id === a.item),
        definition = ITEMS[item?.template];
      reject(!definition, "That item is not in your bag.");
      reject(
        !["weapon", "chest", "charm"].includes(definition.slot),
        "That item cannot be equipped.",
      );
      reject(p.level < (definition.level ?? 1), `Requires level ${definition.level}.`);
      p.equipment[definition.slot] = item.id;
      p.hp = Math.min(p.hp, stats(p).maxHp);
      return { message: `Equipped ${definition.name}.` };
    }
    if (["ability", "attack", "autoattack"].includes(a.type)) {
      reject(p.travel, "You can’t fight from a caravan.");
      p.eating = null;
      this.dismount(p);
      this.breakRecall(p, now);
    }
    if (a.type === "ability" || a.type === "attack") {
      const base = ABILITIES[p.classId].find(
        (b) => b.id === (a.ability ?? ABILITIES[p.classId][0].id),
      );
      reject(!base, "That ability does not belong to your class.");
      const ability = abilityFor(p, base);
      reject(p.level < ability.level, `Unlocks at level ${ability.level}.`);
      reject(p.casting, "You are already casting.");
      reject(
        now < (p.globalReadyAt ?? 0),
        "Ability is not ready yet — global cooldown.",
        429,
      );
      reject(
        now - (p.cooldowns[ability.id] ?? -Infinity) < ability.cooldown,
        "That ability is not ready.",
        429,
      );
      reject(
        p.power < ability.cost,
        `Not enough ${CLASSES[p.classId].resource}.`,
      );
      const target = this.enemiesFor(p).find((e) => e.id === a.target);
      if (ability.multiplier || ability.dot || ability.stun) {
        reject(!target || target.hp <= 0, "You have no target.");
        reject(
          distance(p, target) > ability.range,
          "Out of range — move closer to use this ability.",
        );
        reject(target.evading, "Target is evading.");
      }
      if (ability.castTime) {
        p.casting = {
          ability: ability.id,
          target: target?.id,
          startedAt: now,
          endsAt: now + ability.castTime,
        };
        p.globalReadyAt = now + CLASSES[p.classId].gcd;
        return { message: `Casting ${ability.name}…` };
      }
      this.resolveAbility(p, ability, target, now);
      return { message: ability.name };
    }
    reject(a.type !== "chat", "Unknown action.");
    reject(
      !["nearby", "faction", "whisper", "party", "guild", "officer"].includes(a.channel),
      "Choose nearby, faction, party, guild, officer or whisper chat.",
    );
    reject(
      typeof a.text !== "string" ||
        a.text.length > 280 ||
        !a.text.trim() ||
        /[\x00-\x1f\x7f]/.test(a.text),
      "Write 1–280 characters without control characters.",
    );
    reject(
      now - p.lastChat < 800,
      "Please slow down before speaking again.",
      429,
    );
    let recipients;
    if (a.channel === "whisper") {
      const to =
        typeof a.to === "string"
          ? [...this.players.values()].find(
              (q) => q.name.toLowerCase() === a.to.trim().toLowerCase(),
            )
          : null;
      reject(
        !to || to.faction !== p.faction || now - to.seen >= 15000,
        "Whisper to an online adventurer of the same faction.",
      );
      recipients = [...new Set([p, to])];
    } else if (a.channel === "guild" || a.channel === "officer") {
      const g = this.guilds.of(p);
      reject(!g, "You aren’t in a guild.");
      reject(a.channel === "officer" && this.guilds.rank(p) > 1, "Only officers can use officer chat.");
      recipients = this.guilds
        .online(g, now)
        .filter((q) => a.channel === "guild" || g.members.get(q.id).rank <= 1);
    } else if (a.channel === "party") {
      reject(!this.parties.of(p), "You aren’t in a group.");
      recipients = this.parties.members(p).filter((q) => now - q.seen < 15000);
    } else
      recipients = [...this.players.values()].filter(
        (q) =>
          q.faction === p.faction &&
          now - q.seen < 15000 &&
          (a.channel === "faction" || distance(q, p) <= 18),
      );
    const m = {
      id: ++this.sequence,
      from: p.name,
      faction: p.faction,
      channel: a.channel,
      text: a.text.trim(),
      to: a.channel === "whisper" ? a.to.trim() : undefined,
      time: now,
    };
    p.lastChat = now;
    for (const q of recipients) {
      q.messages.push(m);
      if (q.messages.length > 80) q.messages.shift();
    }
  }
  event(kind, fields, now) {
    this.events.push({ id: ++this.eventSequence, time: now, kind, ...fields });
    if (this.events.length > 160) this.events = this.events.slice(-160);
  }
  roll(chance = CRIT_CHANCE) {
    return this.combatRandom() < chance;
  }
  startAutoAttack(p, target, now) {
    if (p.autoAttack !== target.id) {
      p.autoAttack = target.id;
      // The first swing lands immediately unless a swing is already mid-cycle.
      p.swingReadyAt = Math.max(now, p.swingReadyAt ?? 0);
    }
  }
  addThreat(e, p, amount, now) {
    if (e.hp <= 0 || e.evading) return;
    const fresh = !e.threat.has(p.id);
    e.threat.set(p.id, (e.threat.get(p.id) ?? 0) + Math.max(1, amount));
    e.combatUntil = now + COMBAT_LINGER;
    p.combatUntil = now + COMBAT_LINGER;
    // Pulling one member of a linked pack brings the whole pack.
    if (fresh && e.pack)
      for (const o of this.enemiesFor(p))
        if (o !== e && o.pack === e.pack && o.hp > 0 && !o.threat.has(p.id)) this.addThreat(o, p, 1, now);
  }
  damageEnemy(p, e, amount, now, fields = {}) {
    e.hp = Math.max(0, e.hp - amount);
    e.contributors.add(p.id);
    this.addThreat(e, p, amount, now);
    this.event(
      "strike",
      { from: p.id, target: e.id, damage: amount, x: e.x, z: e.z, zone: zoneOf(e), ...fields },
      now,
    );
    // Interrupting abilities stop interruptible casts and lock the caster briefly.
    const ability = fields.ability && ABILITIES[p.classId].find((a) => a.id === fields.ability);
    if (ability?.interrupt && e.casting?.interruptible && e.hp > 0) {
      this.event("interrupted", { target: e.id, by: p.name, spell: e.casting.name, x: e.x, z: e.z, zone: zoneOf(e) }, now);
      e.casting = null;
      e.castLockUntil = now + 2000;
    }
    if (e.hp === 0) this.defeat(e, now);
  }
  defeat(e, now) {
    e.respawnAt = e.instance ? Infinity : now + monsterDelay(this.random);
    e.threat.clear();
    e.evading = false;
    e.casting = null;
    this.event("death", { target: e.id, x: e.x, z: e.z, name: e.name, zone: zoneOf(e), boss: !!e.boss }, now);
    // Contributors and their nearby group members each earn credit and personal loot once.
    const eligible = new Set();
    for (const id of e.contributors) {
      const q = this.players.get(id);
      if (q?.autoAttack === e.id) q.autoAttack = null;
      if (!q || q.dead || now - q.seen >= 15000 || zoneOf(q) !== zoneOf(e) || distance(q, e) >= 40) continue;
      eligible.add(q);
      for (const m of this.parties.nearby(q, e.x, e.z, zoneOf(e))) if (now - m.seen < 15000) eligible.add(m);
    }
    const share = Math.max(1, eligible.size);
    for (const q of eligible) {
      const template = this.rollLoot(e),
        // Groups split kill experience, with a bonus for grouping.
        xp = Math.round((killExperience(e.level ?? 1, q.level) * (e.boss ? 8 : 1) * (share > 1 ? 1.25 : 1)) / share);
      q.kills++;
      addExperience(q, xp);
      if (xp) this.event("xp", { to: q.id, amount: xp, name: e.name, x: e.x, z: e.z, zone: zoneOf(e) }, now);
      const items = e.boss
        ? [{ id: randomUUID(), template: ((list) => list[Math.floor(this.random() * list.length)])(DUNGEON_LOOT[e.spec] ?? DUNGEON_LOOT[dungeonOf(e.instance)?.id] ?? DUNGEON_LOOT["hollow-crypt"]) }]
        : e.summoned
          ? []
          : template
            ? [{ id: randomUUID(), template }]
            : [];
      this.loot.push({
        id: randomUUID(),
        ownerId: q.id,
        x: e.x,
        z: e.z,
        coins: e.boss ? (dungeonOf(e.instance)?.raid ? 150 : 60) : this.rollCoins(e),
        items,
        expiresAt: now + 300000,
        zone: zoneOf(e),
      });
      const progress = q.quests.wildgrowth;
      if (progress.status === "active") {
        progress.progress = Math.min(3, progress.progress + 1);
        if (progress.progress === 3) progress.status = "ready";
      }
      // Town quests: kill creatures of a zone or a kind, or collect drops from certain kinds.
      for (const [id, def] of Object.entries(QUESTS)) {
        const qp = q.quests[id];
        if (qp?.status !== "active") continue;
        const counts =
          (def.kill && (def.kill.zone ? e.zoneId === def.kill.zone : e.kind === def.kill.kind)) ||
          (def.collect && def.collect.kinds.includes(e.kind) && this.random() < def.collect.chance);
        if (!counts) continue;
        qp.progress = Math.min(def.required, qp.progress + 1);
        if (def.collect) this.system(q, `${def.collect.item}: ${qp.progress}/${def.required}`, now);
        if (qp.progress >= def.required) qp.status = "ready";
      }
      // Dungeon quests complete when that dungeon's (final) boss falls.
      if (e.boss && this.crypts.instances.get(e.instance)?.boss === e)
        for (const [id, def] of Object.entries(QUESTS)) {
          const qp = q.quests[id];
          if (def.boss && def.boss === dungeonOf(e.instance)?.id && qp?.status === "active") {
            qp.progress = 1;
            qp.status = "ready";
          }
        }
    }
    if (e.boss && this.crypts.instances.get(e.instance)?.boss === e) {
      const inst = this.crypts.instances.get(e.instance);
      // A group the Dungeon Finder put together earns a satchel of coin and experience.
      const finderParty = inst && [...this.parties.byId.values()].find((g) => g.finder === inst.dungeon.id && inst.key.endsWith(`party:${g.id}`));
      if (finderParty && !inst.finderPaid) {
        inst.finderPaid = true;
        for (const id of finderParty.members) {
          const q = this.players.get(id);
          if (!q || q.instance !== inst.id) continue;
          const bonus = FINDER.bonus(inst.dungeon.bossLevel);
          q.coins = (q.coins ?? 0) + bonus.coins;
          addExperience(q, bonus.xp);
          this.system(q, `Dungeon Finder satchel: ${bonus.coins} gold and ${bonus.xp} experience.`, now);
        }
      }
      if (inst) {
        inst.cleared = true;
        inst.telegraphs = [];
        inst.enemies = inst.enemies.filter((o) => !o.summoned || o.hp > 0);
      }
    }
  }
  // Every kill rolls its own loot: often just coin, sometimes gear or a draught.
  rollLoot(e) {
    const roll = this.random(),
      pick = (list) => list[Math.floor(this.random() * list.length)];
    // Gear matches the creature: items whose required level is within a few levels below it.
    const level = e.level ?? 1,
      gear = (rarity) => Object.keys(ITEMS).filter((k) => ITEMS[k].rarity === rarity && ITEMS[k].slot && ITEMS[k].slot !== "consumable"),
      of = (rarity) => {
        const near = gear(rarity).filter((k) => ITEMS[k].level <= level && ITEMS[k].level >= level - 5);
        return near.length ? near : gear(rarity).filter((k) => ITEMS[k].level <= Math.max(level, 1)).slice(-3);
      };
    const rareChance = e.instance ? 0.14 : 0.06 + Math.min(0.08, (e.level ?? 1) * 0.004);
    if (roll < rareChance) return pick(of("Rare"));
    if (roll < rareChance + 0.3) return pick(of("Uncommon"));
    if (roll < rareChance + 0.42) return pick(["healing-draught", "travelers-bread", "spring-water"]);
    return null;
  }
  rollCoins(e) {
    const level = e.level ?? 1;
    return Math.round((4 + level * 2) * (0.6 + this.random() * 0.8)) + (e.instance ? 6 : 0);
  }
  healPlayer(p, amount, now, ability) {
    const before = p.hp;
    p.hp = Math.min(stats(p).maxHp, p.hp + amount);
    this.event(
      "heal",
      { from: p.id, to: p.id, amount: Math.round(p.hp - before), ability: ability?.id, x: p.x, z: p.z, zone: zoneOf(p) },
      now,
    );
    // Healing draws half its value as threat from every creature already fighting you.
    for (const e of this.enemiesFor(p))
      if (e.hp > 0 && e.threat.has(p.id)) this.addThreat(e, p, amount * 0.5, now);
  }
  resolveAbility(p, base, target, now) {
    const ability = abilityFor(p, base);
    const targeted = ability.multiplier || ability.dot || ability.stun;
    if (
      targeted &&
      (!target || target.hp <= 0 || target.evading || distance(p, target) > ability.range)
    )
      return;
    p.power = Math.max(
      0,
      Math.min(100, p.power - ability.cost + (ability.gain ?? 0)),
    );
    if (ability.cost && p.classId !== "warrior") p.lastSpend = now;
    p.cooldowns[ability.id] = now;
    if (!ability.castTime) p.globalReadyAt = now + CLASSES[p.classId].gcd;
    if (ability.heal) {
      const crit = this.roll();
      this.healPlayer(p, ability.heal * (crit ? 1.5 : 1), now, ability);
    }
    if (ability.shield) {
      p.shield = { amount: ability.shield.base + ability.shield.perLevel * p.level, until: now + ability.shield.duration, ability: ability.id };
      this.event("shield", { to: p.id, amount: p.shield.amount, ability: ability.id, x: p.x, z: p.z, zone: zoneOf(p) }, now);
    }
    if (targeted && target && !ability.multiplier) {
      // Pure afflictions still start a fight.
      this.addThreat(target, p, 5, now);
      target.contributors.add(p.id);
    }
    if (targeted && target && target.hp > 0) {
      if (ability.dot) {
        target.dots = (target.dots ?? []).filter((d) => !(d.from === p.id && d.ability === ability.id));
        target.dots.push({
          from: p.id,
          ability: ability.id,
          amount: Math.max(1, Math.round(stats(p).damage * ability.dot.multiplier)),
          ticks: ability.dot.ticks,
          every: ability.dot.every,
          nextAt: now + ability.dot.every,
        });
      }
      if (ability.stun) {
        if (target.boss) this.event("immune", { target: target.id, x: target.x, z: target.z, zone: zoneOf(target) }, now);
        else {
          target.stunnedUntil = now + ability.stun;
          if (target.casting) target.casting = null;
          this.event("stunned", { target: target.id, by: p.name, until: target.stunnedUntil, x: target.x, z: target.z, zone: zoneOf(target) }, now);
        }
      }
    }
    const targets = ability.multiplier
      ? ability.aoe
        ? this.enemiesFor(p).filter(
            (e) => e.hp > 0 && !e.evading && distance(p, e) <= ability.range,
          )
        : [target]
      : [];
    if (ability.multiplier && ability.range <= MELEE_RANGE + 0.1 && target)
      this.startAutoAttack(p, target, now);
    for (const e of targets) {
      const crit = this.roll(),
        damage = Math.round(
          stats(p).damage * ability.multiplier * (crit ? CRIT_MULTIPLIER : 1),
        );
      this.damageEnemy(p, e, damage, now, { ability: ability.id, crit });
    }
  }
  revive(p, now) {
    p.dead = false;
    p.hp = Math.round(stats(p).maxHp * 0.5);
    p.power = p.classId === "warrior" ? 0 : 50;
    p.input = { x: 0, z: 0 };
    p.combatUntil = 0;
    if (p.instance) {
      // Spirits released inside the crypt return to its door, ready to run back in.
      this.crypts.leave(p, { door: true });
      return;
    }
    // Spirits return to the nearest graveyard: camp or a town.
    const g = this.graveyardFor(p);
    p.x = g.x + (p.faction === "dawnward" ? -2 : 2);
    p.z = g.z - 2;
  }
  // Exploration: the first visit to a zone, town or lake is worth some experience.
  explore(p, now) {
    for (const place of [ZONES[zoneAt(p.x, p.z)].name, subzoneAt(p.x, p.z)]) {
      if (p.explored.includes(place)) continue;
      p.explored.push(place);
      if (place === "The Stillwood" || place === "Wayfarer’s Camp") continue;
      const xp = 25 + p.level * 15;
      addExperience(p, xp);
      this.system(p, `Discovered: ${place} (+${xp} experience)`, now);
    }
  }
  knownStop(p, s) {
    return s.id === "camp" || (p.explored ?? []).includes(s.place);
  }
  // Why a quest can't be taken yet (an earlier quest in its chain, or level), or null.
  questLock(p, quest) {
    if (!quest || p.quests[quest.id]?.status !== "offered") return null;
    if (quest.requires && p.quests[quest.requires]?.status !== "complete") return `Complete “${QUESTS[quest.requires].name}” first.`;
    if (p.level < (quest.minLevel ?? 1)) return `Available at level ${quest.minLevel}.`;
    return null;
  }
  graveyardFor(p) {
    return GRAVEYARDS.reduce((best, g) => (distance(g, p) < distance(best, p) ? g : best), GRAVEYARDS[0]);
  }
  killPlayer(p, now) {
    p.eating = null;
    p.mounted = false;
    p.recall = null;
    p.hp = 0;
    p.dead = true;
    p.casting = null;
    p.autoAttack = null;
    p.input = { x: 0, z: 0 };
    p.combatUntil = 0;
    for (const e of this.allEnemies()) e.threat.delete(p.id);
    this.event("player-death", { to: p.id, x: p.x, z: p.z, zone: zoneOf(p) }, now);
  }
  evade(e, now) {
    e.evading = true;
    e.threat.clear();
    e.casting = null;
    e.dots = [];
    e.stunnedUntil = 0;
    this.event("evade", { target: e.id, x: e.x, z: e.z, zone: zoneOf(e) }, now);
    for (const p of this.players.values())
      if (p.autoAttack === e.id) p.autoAttack = null;
    if (e.boss) {
      const inst = this.crypts.instances.get(e.instance);
      if (inst) this.crypts.reset(inst, e);
    }
  }
  tick(dt, now = Date.now()) {
    this.loot = this.loot.filter((l) => l.expiresAt > now);
    dt = Math.min(0.1, Math.max(0, dt));
    const online = [...this.players.values()].filter(
      (p) => now - p.seen < 15000,
    );
    respawnHerbs(this.resources, online, this.random, now);
    for (const p of online) {
      if (p.dead) continue;
      const cls = CLASSES[p.classId],
        inCombat = (p.combatUntil ?? 0) > now;
      if (p.classId === "warrior") {
        // Rage fades once the fight is over.
        if (!inCombat) p.power = Math.max(0, p.power - 3 * dt);
      } else {
        // Mana regenerates slowly for five seconds after you spend it.
        const slowed =
          cls.resource === "Mana" && now - (p.lastSpend ?? -Infinity) < 5000;
        p.power = Math.min(100, p.power + cls.regen * (slowed ? 0.25 : 1) * dt);
      }
      if (!inCombat && !inSanctuary(p))
        p.hp = Math.min(stats(p).maxHp, p.hp + stats(p).maxHp * 0.02 * dt);
      if (p.eating) {
        if (now >= p.eating.until || inCombat) p.eating = null;
        else {
          p.hp = Math.min(stats(p).maxHp, p.hp + p.eating.hp * dt);
          p.power = Math.min(100, p.power + p.eating.power * dt);
        }
      }
      if (p.casting) {
        if (Math.hypot(p.input.x, p.input.z) > 0.01 && now - p.inputAt < 400) {
          this.event("interrupt", { to: p.id, x: p.x, z: p.z, zone: zoneOf(p) }, now);
          p.casting = null;
        } else if (now >= p.casting.endsAt) {
          const cast = p.casting;
          p.casting = null;
          this.resolveAbility(
            p,
            ABILITIES[p.classId].find((a) => a.id === cast.ability),
            this.enemiesFor(p).find((e) => e.id === cast.target),
            now,
          );
        }
      }
      if (p.autoAttack && !p.casting) {
        const e = this.enemiesFor(p).find((e) => e.id === p.autoAttack);
        if (!e || e.hp <= 0 || e.evading) p.autoAttack = null;
        else if (now >= (p.swingReadyAt ?? 0) && distance(p, e) <= MELEE_RANGE) {
          const crit = this.roll(),
            damage = Math.round(
              autoAttackDamage(stats(p), cls.swing) * (crit ? CRIT_MULTIPLIER : 1),
            );
          p.swingReadyAt = now + cls.swing;
          if (p.classId === "warrior")
            p.power = Math.min(100, p.power + (crit ? 12 : 7));
          this.damageEnemy(p, e, damage, now, { swing: true, crit });
        }
      }
    }
    for (const p of online)
      if (inSanctuary(p) && !p.dead) p.hp = Math.min(stats(p).maxHp, p.hp + dt * 6);
    for (const p of online) {
      // The caravan rolls along the road at its own pace.
      if (p.travel) {
        let step = CARAVAN_SPEED * dt;
        const pts = p.travel.points;
        while (step > 0 && p.travel.i < pts.length - 1) {
          const next = pts[p.travel.i + 1],
            d = Math.hypot(next.x - p.x, next.z - p.z);
          if (d <= step) {
            p.x = next.x;
            p.z = next.z;
            p.travel.i++;
            step -= d;
          } else {
            p.x += ((next.x - p.x) / d) * step;
            p.z += ((next.z - p.z) / d) * step;
            step = 0;
          }
        }
        if (p.travel.i >= pts.length - 1) {
          this.system(p, `The caravan arrives at ${p.travel.name}.`, now);
          p.travel = null;
        }
      }
      if (p.recall && now >= p.recall.endsAt && !p.dead) {
        const home = homePoint(p.home ?? "camp");
        p.recall = null;
        p.waystoneReadyAt = now + WAYSTONE.cooldown;
        p.x = home.x + (this.random() - 0.5) * 2;
        p.z = home.z - 3;
        this.system(p, `Your waystone returns you to ${stopById(p.home ?? "camp").name}.`, now);
      }
    }
    for (const p of online)
      if (now - p.inputAt < 400 && !p.dead && !p.travel) {
        const speed = 5 * (p.mounted ? RIDING.speed : 1);
        if (p.instance) {
          // Inside the crypt, slide along walls instead of passing through them.
          const nx = p.x + p.input.x * 5 * dt,
            nz = p.z + p.input.z * 5 * dt;
          if (walkableAt(nx, nz)) (p.x = nx), (p.z = nz);
          else if (walkableAt(nx, p.z)) p.x = nx;
          else if (walkableAt(p.x, nz)) p.z = nz;
          continue;
        }
        // Out in the world: stay inside the mountains and walk around houses, not through them.
        const nx = Math.max(-WORLD_LIMIT, Math.min(WORLD_LIMIT, p.x + p.input.x * speed * dt)),
          nz = Math.max(-WORLD_LIMIT, Math.min(WORLD_LIMIT, p.z + p.input.z * speed * dt));
        if (!insideHouse(nx, nz)) (p.x = nx), (p.z = nz);
        else if (!insideHouse(nx, p.z)) p.x = nx;
        else if (!insideHouse(p.x, nz)) p.z = nz;
      }
    // Lava burns anyone who wades into the Cinder Pools.
    for (const p of online) {
      if (p.dead || p.instance || p.travel || !lakeAt(p.x, p.z, -2)?.lava) continue;
      if (now < (p.burnAt ?? 0)) continue;
      p.burnAt = now + 1000;
      this.hurtPlayer(p, this.maxHp(p) * 0.08 + stats(p).armor * 0.5, now, null, "Lava");
    }
    this.crypts.tick(now, dt);
    if (now - (this.finderAt ?? 0) >= 1000) {
      this.finderAt = now;
      this.finder.tick(now);
    }
    this.playerGrid.build(online.filter((p) => !p.instance && !p.dead));
    this.tickEnemies(this.enemies, online.filter((p) => !p.instance), dt, now, null);
    this.enemyGrid.build(this.enemies);
    for (const inst of this.crypts.instances.values())
      this.tickEnemies(inst.enemies, online.filter((p) => p.instance === inst.id), dt, now, inst);
  }
  tickEnemies(enemies, online, dt, now, inst) {
    for (const e of enemies) {
      if (e.hp <= 0) {
        if (inst) continue;
        if (now >= e.respawnAt) {
          const pos = monsterPosition(
            this.random,
            enemies.filter((o) => o !== e),
            online,
            e,
          );
          if (!pos) {
            e.respawnAt = now + 5000;
            continue;
          }
          Object.assign(e, pos, { homeX: pos.x, homeZ: pos.z, dots: [], stunnedUntil: 0 });
          applyLevel(e);
          e.hp = e.maxHp;
          e.evading = false;
          e.contributors.clear();
          e.threat.clear();
        }
        continue;
      }
      // Out in the world, a creature with nobody near and nothing going on sleeps.
      if (!inst && !e.threat.size && !e.dots?.length && !e.casting && !e.evading && !this.playerGrid.any(e.x, e.z, AWAKE_RADIUS)) continue;
      const ms = mobStats(e.level ?? 1),
        home = { x: e.homeX, z: e.homeZ };
      if (e.evading) {
        // Run home, ignoring everything, then reset to full health.
        const d = distance(e, home);
        if (d > 0.5) {
          e.x += ((home.x - e.x) / d) * Math.min(d, dt * 7);
          e.z += ((home.z - e.z) / d) * Math.min(d, dt * 7);
        } else {
          e.evading = false;
          e.hp = e.maxHp;
          e.contributors.clear();
        }
        continue;
      }
      // Proximity aggro: creatures notice players inside their level-scaled radius.
      for (const p of inst ? online : this.playerGrid.near(e.x, e.z, 14))
        if (
          !p.dead &&
          !p.travel &&
          !inSanctuary(p) &&
          !e.threat.has(p.id) &&
          distance(e, p) < aggroRadius(e.level ?? 1, p.level)
        )
          this.addThreat(e, p, 1, now);
      // Drop players who died, left, or fled into the camp's sanctuary.
      for (const id of e.threat.keys()) {
        const p = this.players.get(id);
        if (!p || p.dead || p.travel || now - p.seen >= 15000 || inSanctuary(p) || zoneOf(p) !== zoneOf(e)) e.threat.delete(id);
      }
      let target = null,
        top = -1;
      for (const [id, amount] of e.threat)
        if (amount > top) {
          top = amount;
          target = this.players.get(id);
        }
      // Damage over time ticks on its own schedule.
      if (e.dots?.length) {
        for (const d of e.dots) {
          if (now < d.nextAt || e.hp <= 0) continue;
          const source = this.players.get(d.from);
          d.ticks--;
          d.nextAt += d.every;
          if (source) this.damageEnemy(source, e, d.amount, now, { ability: d.ability, dot: true });
        }
        e.dots = e.dots.filter((d) => d.ticks > 0);
        if (e.hp <= 0) continue;
      }
      if (e.casting) {
        e.targetId = target?.id ?? null;
        continue;
      }
      // Stunned creatures stand dazed: no moving, no swinging.
      if ((e.stunnedUntil ?? 0) > now) continue;
      if (target && distance(e, home) > (inst ? 70 : LEASH_RANGE)) {
        this.evade(e, now);
        continue;
      }
      if (e.threat.size === 0 && e.contributors.size && e.hp < e.maxHp) {
        this.evade(e, now);
        continue;
      }
      e.targetId = target?.id ?? null;
      const goal = target ?? {
        x: e.homeX + Math.sin(now / 3200 + e.homeX) * 1.5,
        z: e.homeZ + Math.cos(now / 4000 + e.homeZ) * 1.5,
      };
      const d = distance(e, goal);
      if (d > (target ? (e.boss ? 2.2 : 1.6) : 0.2)) {
        const speed = target ? ms.chaseSpeed : inst ? 0 : 0.7,
          nx = e.x + ((goal.x - e.x) / d) * Math.min(d, dt * speed),
          nz = e.z + ((goal.z - e.z) / d) * Math.min(d, dt * speed);
        if (!inst || walkableAt(nx, nz)) (e.x = nx), (e.z = nz);
        else if (walkableAt(nx, e.z)) e.x = nx;
        else if (walkableAt(e.x, nz)) e.z = nz;
      }
      if (target && d < (e.boss ? 2.8 : MOB_REACH) && now - e.lastAttack > MOB_SWING) {
        const crit = this.roll(0.04),
          damage = Math.max(
            1,
            Math.round(((e.damage ?? ms.damage) * (e.damageScale ?? 1) - stats(target).armor) * (crit ? 1.5 : 1)),
          ),
          taken = this.absorb(target, damage, now, e);
        target.hp -= taken;
        this.dismount(target);
        this.breakRecall(target, now, "you were hit");
        target.eating = null;
        target.combatUntil = now + COMBAT_LINGER;
        e.lastAttack = now;
        if (target.classId === "warrior")
          target.power = Math.min(100, target.power + 4);
        this.event(
          "hit",
          { from: e.id, to: target.id, damage, crit, x: target.x, z: target.z, zone: zoneOf(e) },
          now,
        );
        if (target.hp <= 0) this.killPlayer(target, now);
      }
    }
  }
  save() {
    return {
      product: "hearthwild",
      version: 4,
      resources: this.resources.map((r) => ({ ...r })),
      guilds: this.guilds.save(),
      loot: this.loot,
      enemies: this.enemies.map((e) => ({
        id: e.id,
        x: e.x,
        z: e.z,
        homeX: e.homeX,
        homeZ: e.homeZ,
        hp: e.hp,
        level: e.level,
        respawnAt: e.respawnAt,
        ...(e.anchorX !== undefined ? { anchorX: e.anchorX, anchorZ: e.anchorZ } : {}),
      })),
      players: [...this.players.values()].map((p) => ({
        ...publicPlayer(p),
        ...(p.instance ? (({ door }) => ({ x: door.x, z: door.z - 2.5 }))(dungeonOf(p.instance) ?? CRYPT) : {}),
        instance: null,
        partyId: null,
        guild: undefined,
        charter: p.charter ?? null,
        casting: null,
        inCombat: false,
        sitting: false,
        keyHash: p.keyHash,
        accountId: p.accountId ?? null,
        professions: p.professions,
        buyback: p.buyback,
        potionReadyAt: p.potionReadyAt,
        inventory: p.inventory,
        equipment: p.equipment,
        quests: p.quests,
        explored: p.explored,
        riding: !!p.riding,
        home: p.home ?? "camp",
        waystoneReadyAt: p.waystoneReadyAt ?? 0,
        materials: p.materials,
        xp: p.xp,
        power: p.power,
        cooldowns: p.cooldowns,
      })),
    };
  }
}
