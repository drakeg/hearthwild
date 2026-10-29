// Client intent only. Position, damage, reach, cooldown and rewards remain server-owned.
export function approach(self, target, range) {
  if (!self || !target) return { x: 0, z: 0, ready: false };
  const dx = target.x - self.x,
    dz = target.z - self.z,
    d = Math.hypot(dx, dz);
  return d <= range
    ? { x: 0, z: 0, ready: true }
    : { x: dx / d, z: dz / d, ready: false };
}
export function combatIntent(self, enemy) {
  return !enemy || enemy.hp <= 0
    ? { x: 0, z: 0, ready: false, ended: true }
    : { ...approach(self, enemy, 2.6), ended: false };
}

// A little hand motion is a click; camera dragging requires a deliberate movement.
export function pointerIsClick(start, end) {
  return !!start && Math.hypot(end.x - start.x, end.y - start.y) <= 6;
}
export function pickWorldTarget(hits) {
  for (const labels of [false, true])
    for (const hit of hits) {
      if (!!hit.object.isSprite !== labels) continue;
      let g = hit.object;
      while (g && !g.userData?.enemy && !g.userData?.interaction) g = g.parent;
      if (g) return g;
    }
  return null;
}

export function movementVector(dx, dz, yaw) {
  const length = Math.max(1, Math.hypot(dx, dz));
  return {
    x: (dx * Math.cos(yaw) + dz * Math.sin(yaw)) / length,
    z: (dz * Math.cos(yaw) - dx * Math.sin(yaw)) / length,
  };
}
export function facingAngle(from, to) {
  return Math.atan2(to.x - from.x, to.z - from.z);
}
