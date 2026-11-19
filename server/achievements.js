// Awarding achievements and choosing a title. The list itself is shared with the client
// (public/achievements.js); the server keeps each character's counters in `p.tally`.
import { ACHIEVEMENTS, ACHIEVEMENT, TITLES } from "../public/achievements.js";

export const count = (p, key, n = 1) => {
  p.tally ??= {};
  p.tally[key] = (p.tally[key] ?? 0) + n;
};
export const markCleared = (p, dungeonId) => {
  p.tally ??= {};
  p.tally.cleared ??= {};
  p.tally.cleared[dungeonId] = true;
};

// Checks every achievement a character hasn't earned yet; returns the newly earned ones.
export function award(world, p, now) {
  p.achievements ??= {};
  const earned = [];
  for (const a of ACHIEVEMENTS) {
    if (p.achievements[a.id] || a.progress(p) < a.goal) continue;
    p.achievements[a.id] = now;
    earned.push(a);
    world.system(p, `Achievement earned: ${a.name}${a.title ? ` · Title unlocked: “${a.title}”` : ""} (+${a.points} points)`, now);
    world.event("achievement", { to: p.id, name: a.name, x: p.x, z: p.z, zone: p.instance ?? null }, now);
  }
  return earned;
}

// Choose a title you've earned, or none.
export function chooseTitle(p, a, fail) {
  if (!a.id) {
    p.title = null;
    return { message: "You no longer show a title." };
  }
  fail(!TITLES[a.id], "That isn’t a title.");
  fail(!p.achievements?.[a.id], `Earn “${ACHIEVEMENT[a.id].name}” to use that title.`);
  p.title = a.id;
  return { message: `You are now known as “${TITLES[a.id]}”.` };
}
