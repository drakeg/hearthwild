// Talents: at levels 10, 20 and 30 each character picks one of two talents that shape how
// their class plays. Shared by the server (which applies them) and the client (which shows
// them and the changed ability numbers).
export const TALENT_TIERS = [10, 20, 30];
const t = (id, name, text, effect) => ({ id, name, text, ...effect });
export const TALENTS = {
  warrior: {
    10: [t("bulwark", "Bulwark", "+15% maximum health.", { mods: { maxHp: 0.15 } }), t("berserker", "Berserker", "+10% damage.", { mods: { damage: 0.1 } })],
    20: [
      t("unbreakable", "Unbreakable", "+20% armor.", { mods: { armor: 0.2 } }),
      t("executioner", "Executioner", "Crushing blow and Titan’s strike hit 25% harder.", { abilities: { "crushing-blow": { scale: { multiplier: 1.25 } }, "titans-strike": { scale: { multiplier: 1.25 } } } }),
    ],
    30: [
      t("juggernaut", "Juggernaut", "Thunder slam stuns 1 s longer and recharges 2 s sooner.", { abilities: { "thunder-slam": { add: { stun: 1000, cooldown: -2000 } } } }),
      t("warlord", "Warlord", "+8% damage and +8% maximum health.", { mods: { damage: 0.08, maxHp: 0.08 } }),
    ],
  },
  warlock: {
    10: [t("dark-pact", "Dark pact", "+10% damage.", { mods: { damage: 0.1 } }), t("bone-armor", "Bone armor", "+15% maximum health.", { mods: { maxHp: 0.15 } })],
    20: [
      t("lingering-curse", "Lingering curse", "Wither deals 30% more damage over time.", { abilities: { wither: { scale: { "dot.multiplier": 1.3 } } } }),
      t("quickened-casting", "Quickened casting", "Cinder bolt casts 0.2 s faster.", { abilities: { "cinder-bolt": { add: { castTime: -200 } } } }),
    ],
    30: [
      t("soul-harvest", "Soul harvest", "Siphon heals 50% more.", { abilities: { siphon: { scale: { heal: 1.5 } } } }),
      t("apocalypse", "Apocalypse", "Cataclysm hits 20% harder.", { abilities: { cataclysm: { scale: { multiplier: 1.2 } } } }),
    ],
  },
  druid: {
    10: [t("groves-blessing", "Grove’s blessing", "All your healing is 15% stronger.", { healing: 0.15 }), t("thornskin", "Thornskin", "+15% armor.", { mods: { armor: 0.15 } })],
    20: [
      t("swift-bloom", "Swift bloom", "Wild bloom recharges 3 s sooner.", { abilities: { "wild-bloom": { add: { cooldown: -3000 } } } }),
      t("suns-wrath", "Sun’s wrath", "+12% damage.", { mods: { damage: 0.12 } }),
    ],
    30: [
      t("tidecaller", "Tidecaller", "Verdant tide heals 25% more.", { abilities: { "verdant-tide": { scale: { heal: 1.25 } } } }),
      t("living-oak", "Living oak", "+20% maximum health.", { mods: { maxHp: 0.2 } }),
    ],
  },
  rogue: {
    10: [t("lethality", "Lethality", "+10% damage.", { mods: { damage: 0.1 } }), t("evasion", "Evasion", "+15% armor.", { mods: { armor: 0.15 } })],
    20: [
      t("deep-wounds", "Deep wounds", "Bleeding gash deals 30% more damage over time.", { abilities: { "bleeding-gash": { scale: { "dot.multiplier": 1.3 } } } }),
      t("second-wind", "Second wind", "Recuperate heals 50% more.", { abilities: { recuperate: { scale: { heal: 1.5 } } } }),
    ],
    30: [
      t("assassin", "Assassin", "Heartseeker hits 20% harder.", { abilities: { heartseeker: { scale: { multiplier: 1.2 } } } }),
      t("shadowdancer", "Shadowdancer", "Shadow flurry costs 10 less Energy.", { abilities: { "shadow-flurry": { add: { cost: -10 } } } }),
    ],
  },
};
// The talents a character has chosen, as talent objects.
export function chosenTalents(classId, picks = {}) {
  return TALENT_TIERS.map((tier) => (TALENTS[classId]?.[tier] ?? []).find((x) => x.id === picks[tier])).filter(Boolean);
}
// Stat bonuses (fractions) from chosen talents.
export function talentMods(classId, picks) {
  const mods = { damage: 0, maxHp: 0, armor: 0 };
  for (const x of chosenTalents(classId, picks)) for (const [k, v] of Object.entries(x.mods ?? {})) mods[k] += v;
  return mods;
}
// An ability as changed by chosen talents (after its ranks are applied).
export function withTalents(ability, classId, picks) {
  const list = chosenTalents(classId, picks);
  if (!list.length) return ability;
  let out = ability;
  const edit = () => (out === ability ? (out = { ...ability, ...(ability.dot ? { dot: { ...ability.dot } } : {}) }) : out);
  for (const x of list) {
    if (x.healing && ability.heal) edit().heal = Math.round(out.heal * (1 + x.healing));
    const change = x.abilities?.[ability.id];
    if (!change) continue;
    edit();
    for (const [k, f] of Object.entries(change.scale ?? {})) {
      if (k === "dot.multiplier") out.dot.multiplier = +(out.dot.multiplier * f).toFixed(3);
      else out[k] = k === "heal" ? Math.round(out[k] * f) : +(out[k] * f).toFixed(3);
    }
    for (const [k, d] of Object.entries(change.add ?? {})) out[k] = Math.max(0, (out[k] ?? 0) + d);
  }
  return out;
}
