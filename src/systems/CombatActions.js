import { PULSE } from '../config/balance.js';

export function inTowerRange(tower, enemy) {
  return Math.hypot(enemy.x - tower.x, enemy.y - tower.y) - enemy.r * .6 <= tower.stats.range;
}

// Simulation-only controls: UI and effects live in the scene.
export class CombatActions {
  constructor(tower) { this.tower = tower; this.target = null; this.cooldown = 0; }
  update(dt) {
    this.cooldown = Math.max(0, this.cooldown - dt);
    if (this.target && (!this.target.alive || !this.target.targetable)) this.target = null;
    this.tower.priorityTarget = this.target;
  }
  mark(enemy) {
    if (enemy && (!enemy.alive || !enemy.targetable)) return false;
    this.target = this.target === enemy ? null : enemy;
    this.tower.priorityTarget = this.target;
    return true;
  }
  pulse(enemies) {
    if (this.cooldown > 0 || !this.tower.alive) return null;
    this.cooldown = PULSE.cooldown;
    const hit = [];
    for (const e of enemies) {
      const dx = e.x - this.tower.x, dy = e.y - this.tower.y;
      const d = Math.hypot(dx, dy);
      if (!e.alive || !e.targetable || e.z > 70 || d > PULSE.radius + e.r * .5) continue;
      const interrupt = e.boss?.phase === 'windup';
      if (e.boss?.phase === 'leap') continue;
      e.stunT = PULSE.stun;
      e.lungeT = -1;
      e.lungeHit = false;
      e.attackCd = Math.max(e.attackCd, .6);
      if (interrupt) {
        e.boss.phase = 'recover'; e.boss.t = 0; e.boss.interrupted = true;
      }
      const resistance = e.def.knockbackResist;
      const push = PULSE.push * (1 - resistance);
      e.kbx += dx / (d || 1) * push * 11;
      e.kby += dy / (d || 1) * push * 11;
      e.jig.v += 2;
      hit.push({ enemy: e, interrupted: interrupt });
    }
    return hit;
  }
}
