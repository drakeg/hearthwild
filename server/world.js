import { WORLD_LIMIT, inSanctuary, subzoneAt, zoneAt, ZONES } from "../public/world-config.js";
import { GRAVEYARDS, insideHouse } from "../public/terrain.js";
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
  addExperience,
} from "./content.js";
import { commerce, PRICES, RECIPES } from "./commerce.js";
import { createHerbs, respawnHerbs, HERB_RESPAWN } from "./resources.js";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { Parties } from "./party.js";
import { Guilds } from "./guild.js";
import { Crypts, walkableAt } from "./crypt.js";
import { CRYPT } from "../public/dungeon-layout.js";
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
const BOSS_LOOT = ["ashbound-greatblade", "ashen-mantle", "ember-of-vorlath"];
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
    this.parties = new Parties(this);
    this.crypts = new Crypts(this);
    this.guilds = new Guilds(this, saved.guilds, {
      signatures: charterSignatures ?? (Number(process.env.HEARTHWILD_CHARTER_SIGNATURES) || 2),
    });
  }
  // What other players see, including the guild name under their nameplate.
  pub(p) {
    return { ...publicPlayer(p), guild: this.guilds.nameOf(p) };
  }
  zoneName(p) {
    return p.instance ? CRYPT.name : subzoneAt(p.x, p.z);
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
  system(p, text, now = Date.now()) {
    p.messages.push({ id: ++this.sequence, from: "", channel: "system", text, time: now });
    if (p.messages.length > 80) p.messages.shift();
  }
  // Damage from encounter mechanics (Ashfall, Soul Drain) rather than melee swings.
  hurtPlayer(p, amount, now, source, name) {
    const damage = Math.max(1, Math.round(amount - stats(p).armor * 0.5));
    p.hp -= damage;
    p.eating = null;
    p.combatUntil = now + COMBAT_LINGER;
    this.event("hit", { from: source?.id, to: p.id, damage, spell: name, x: p.x, z: p.z, zone: zoneOf(p) }, now);
    if (p.hp <= 0) this.killPlayer(p, now);
  }
  leavePartyInstance(p, party, now) {
    if (p.instance && this.crypts.instances.get(p.instance)?.key === `party:${party.id}`) {
      this.crypts.leave(p);
      this.system(p, "You left the group and were returned to Amberwatch Ruins.", now);
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
    reject(!p, "Your return key is missing or invalid.", 401);
    return p;
  }
  state(token, after = 0, now = Date.now()) {
    const p = this.authenticate(token);
    const returning = now - p.seen >= 15000;
    p.seen = now;
    if (returning) this.guilds.cameOnline(p, now);
    if (p.instance && !this.crypts.instances.has(p.instance)) {
      // The dungeon copy reset while they were away.
      this.crypts.leave(p);
      this.system(p, "The crypt has reset. You find yourself back at Amberwatch Ruins.", now);
    }
    for (const k of ["partyInvite", "guildInvite", "charterRequest"]) if (p[k] && p[k].expiresAt <= now) p[k] = null;
    if (!p.instance && !p.dead) this.explore(p, now);
    const zone = zoneOf(p);
    return {
      chatEpoch: this.chatEpoch,
      self: {
        ...this.pub(p),
        inventory: p.inventory.map(describeItem),
        professions: p.professions,
        buyback: p.buyback.map(describeItem),
        potionReadyAt: p.potionReadyAt,
        equipment: p.equipment,
        quests: p.quests,
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
        subzone: p.instance ? CRYPT.name : subzoneAt(p.x, p.z),
        zone: p.instance ? CRYPT.name : ZONES[zoneAt(p.x, p.z)].name,
        sanctuary: !p.instance && inSanctuary(p),
        instance: p.instance ?? null,
        party: this.parties.view(p, now),
        partyInvite: p.partyInvite ? { from: p.partyInvite.from } : null,
        guildInfo: this.guilds.view(p, now),
        guildInvite: p.guildInvite ? { from: p.guildInvite.from, name: p.guildInvite.name } : null,
        charter: this.guilds.charterView(p),
        charterRequest: p.charterRequest ? { from: p.charterRequest.fromName, name: p.charterRequest.name } : null,
      },
      shop: Object.entries(PRICES).map(([template, [buy, sell]]) => ({
        ...ITEMS[template],
        template,
        buy,
        sell,
      })),
      recipes: RECIPES,
      classes: CLASSES,
      abilities: ABILITIES[p.classId],
      npcs: p.instance ? [] : this.npcs,
      portals: p.instance
        ? [{ id: "crypt-exit", type: "exit", name: "Crypt exit", x: CRYPT.origin.x + CRYPT.exit.x, z: CRYPT.origin.z + CRYPT.exit.z }]
        : [{ id: "crypt-door", type: "enter", name: CRYPT.name, x: CRYPT.door.x, z: CRYPT.door.z }],
      telegraphs: p.instance ? (this.crypts.instances.get(p.instance)?.telegraphs ?? []) : [],
      questDefinitions: QUESTS,
      resources: this.resources.map((r) => ({
        ...r,
        available: !r.depleted,
      })),
      loot: this.loot
        .filter((l) => l.ownerId === p.id && l.expiresAt > now && (l.zone ?? null) === zone)
        .map(({ ownerId, ...l }) => ({
          ...l,
          items: l.items.map(describeItem),
        })),
      events: this.events.filter(
        (e) => now - e.time < 2500 && (e.zone ?? null) === zone && distance(e, p) < 60,
      ),
      players: [...this.players.values()]
        .filter((q) => now - q.seen < 15000 && zoneOf(q) === zone && distance(p, q) < 40)
        .map((q) => this.pub(q)),
      enemies: this.enemiesFor(p)
        .filter((e) => distance(p, e) < 180)
        .map(({ contributors, homeX, homeZ, lastAttack, threat, ...e }) => ({
          ...e,
          engaged: threat?.has(p.id) ?? false,
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
    if (a.type === "guild") return this.guilds.act(p, a, now, reject);
    if (a.type === "release") {
      reject(!p.dead, "You are not dead.");
      const where = p.instance ? null : this.graveyardFor(p).name;
      this.revive(p, now);
      return { message: where ? `Your spirit returns to ${where}.` : "Your spirit returns to the crypt entrance." };
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
      return;
    }
    if (a.type === "talk") {
      const npc = this.npcs.find((n) => n.id === a.target);
      reject(!npc, "Choose a villager.");
      reject(distance(p, npc) > 4.5, "Move closer to talk.");
      p.talkedNpc = npc.id;
      return { npc, quest: QUESTS[npc.quest], progress: p.quests[npc.quest] };
    }
    if (a.type === "quest") {
      const quest =
        typeof a.quest === "string" && Object.hasOwn(QUESTS, a.quest)
          ? QUESTS[a.quest]
          : null;
      reject(!quest, "Unknown quest.");
      const npc = this.npcs.find((n) => n.id === quest.npc),
        progress = p.quests[quest.id];
      reject(distance(p, npc) > 4.5, "Move closer to the quest giver.");
      reject(p.talkedNpc !== npc.id, "Talk to the quest giver first.");
      if (a.operation === "accept") {
        reject(
          progress.status !== "offered",
          "You already accepted this quest.",
        );
        progress.status = "active";
        if (quest.id === "starleaf")
          progress.progress = Math.min(quest.required, p.materials.starleaf);
        if (progress.progress >= quest.required) progress.status = "ready";
      } else if (a.operation === "complete") {
        reject(progress.status !== "ready", "Finish the objectives first.");
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
      reject(!r, "Choose a starleaf plant.");
      reject(distance(p, r) > 3.2, "Move closer to gather.");
      reject(
        r.depleted,
        "This plant is regrowing. Look for another Starleaf patch.",
      );
      reject(p.materials.starleaf >= 99, "Your herb pouch is full.");
      if (p.professions.herbalism)
        p.professions.herbalism = Math.min(100, p.professions.herbalism + 1);
      r.depleted = true;
      r.readyAt =
        now +
        HERB_RESPAWN.min +
        Math.floor(this.random() * (HERB_RESPAWN.max - HERB_RESPAWN.min + 1));
      p.materials.starleaf++;
      const q = p.quests.starleaf;
      if (["active", "ready"].includes(q.status)) {
        q.progress = Math.min(4, p.materials.starleaf);
        if (q.progress === 4) q.status = "ready";
      }
      return {
        message: `Gathered Starleaf ×1 · ${p.materials.starleaf} in Bags${q.status === "ready" ? " · Quest ready — return to Herbalist Mira!" : q.status === "active" ? ` · Quest ${q.progress}/4` : ""}`,
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
      p.equipment[definition.slot] = item.id;
      p.hp = Math.min(p.hp, stats(p).maxHp);
      return { message: `Equipped ${definition.name}.` };
    }
    if (["ability", "attack", "autoattack"].includes(a.type)) p.eating = null;
    if (a.type === "ability" || a.type === "attack") {
      const ability = ABILITIES[p.classId].find(
        (b) => b.id === (a.ability ?? ABILITIES[p.classId][0].id),
      );
      reject(!ability, "That ability does not belong to your class.");
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
      if (ability.multiplier) {
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
      const templates = Object.keys(ITEMS).filter((k) => !["consumable"].includes(ITEMS[k].slot) && ITEMS[k].rarity !== "Epic"),
        template = templates[Math.min(q.kills, templates.length - 1)],
        // Groups split kill experience, with a bonus for grouping.
        xp = Math.round((killExperience(e.level ?? 1, q.level) * (e.boss ? 8 : 1) * (share > 1 ? 1.25 : 1)) / share);
      q.kills++;
      addExperience(q, xp);
      if (xp) this.event("xp", { to: q.id, amount: xp, name: e.name, x: e.x, z: e.z, zone: zoneOf(e) }, now);
      const items = e.boss
        ? [{ id: randomUUID(), template: BOSS_LOOT[Math.floor(this.random() * BOSS_LOOT.length)] }]
        : e.summoned
          ? []
          : [{ id: randomUUID(), template }];
      this.loot.push({
        id: randomUUID(),
        ownerId: q.id,
        x: e.x,
        z: e.z,
        coins: e.boss ? 60 : e.instance ? 14 : 10,
        items,
        expiresAt: now + 300000,
        zone: zoneOf(e),
      });
      const progress = q.quests.wildgrowth;
      if (progress.status === "active") {
        progress.progress = Math.min(3, progress.progress + 1);
        if (progress.progress === 3) progress.status = "ready";
      }
      // Zone quests from the towns count any creature of their zone.
      for (const [id, def] of Object.entries(QUESTS)) {
        const qp = q.quests[id];
        if (def.kill && qp?.status === "active" && e.zoneId === def.kill.zone) {
          qp.progress = Math.min(def.required, qp.progress + 1);
          if (qp.progress >= def.required) qp.status = "ready";
        }
      }
      const crypt = q.quests.crypt;
      if (e.boss && crypt?.status === "active") {
        crypt.progress = 1;
        crypt.status = "ready";
      }
    }
    if (e.boss) {
      const inst = this.crypts.instances.get(e.instance);
      if (inst) {
        inst.cleared = true;
        inst.telegraphs = [];
        inst.enemies = inst.enemies.filter((o) => !o.summoned || o.hp > 0);
      }
    }
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
  resolveAbility(p, ability, target, now) {
    if (
      ability.multiplier &&
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
      this.crypts.leave(p);
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
  graveyardFor(p) {
    return GRAVEYARDS.reduce((best, g) => (distance(g, p) < distance(best, p) ? g : best), GRAVEYARDS[0]);
  }
  killPlayer(p, now) {
    p.eating = null;
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
    this.event("evade", { target: e.id, x: e.x, z: e.z, zone: zoneOf(e) }, now);
    for (const p of this.players.values())
      if (p.autoAttack === e.id) p.autoAttack = null;
    if (e.boss) {
      const inst = this.crypts.instances.get(e.instance);
      if (inst) this.crypts.reset(inst);
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
    for (const p of online)
      if (now - p.inputAt < 400 && !p.dead) {
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
        const nx = Math.max(-WORLD_LIMIT, Math.min(WORLD_LIMIT, p.x + p.input.x * 5 * dt)),
          nz = Math.max(-WORLD_LIMIT, Math.min(WORLD_LIMIT, p.z + p.input.z * 5 * dt));
        if (!insideHouse(nx, nz)) (p.x = nx), (p.z = nz);
        else if (!insideHouse(nx, p.z)) p.x = nx;
        else if (!insideHouse(p.x, nz)) p.z = nz;
      }
    this.crypts.tick(now, dt);
    this.tickEnemies(this.enemies, online.filter((p) => !p.instance), dt, now, null);
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
          Object.assign(e, pos, { homeX: pos.x, homeZ: pos.z });
          applyLevel(e);
          e.hp = e.maxHp;
          e.evading = false;
          e.contributors.clear();
          e.threat.clear();
        }
        continue;
      }
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
      for (const p of online)
        if (
          !p.dead &&
          !inSanctuary(p) &&
          !e.threat.has(p.id) &&
          distance(e, p) < aggroRadius(e.level ?? 1, p.level)
        )
          this.addThreat(e, p, 1, now);
      // Drop players who died, left, or fled into the camp's sanctuary.
      for (const id of e.threat.keys()) {
        const p = this.players.get(id);
        if (!p || p.dead || now - p.seen >= 15000 || inSanctuary(p) || zoneOf(p) !== zoneOf(e)) e.threat.delete(id);
      }
      let target = null,
        top = -1;
      for (const [id, amount] of e.threat)
        if (amount > top) {
          top = amount;
          target = this.players.get(id);
        }
      if (e.casting) {
        e.targetId = target?.id ?? null;
        continue;
      }
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
          );
        target.hp -= damage;
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
        ...(p.instance ? { x: CRYPT.door.x, z: CRYPT.door.z - 2.5 } : {}),
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
        materials: p.materials,
        xp: p.xp,
        power: p.power,
        cooldowns: p.cooldowns,
      })),
    };
  }
}
