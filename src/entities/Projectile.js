import { DEPTH } from '../config/gameConfig.js';

const MAX_LIFE = 2.2;
const TURN_RATE = 9; // radians / second of homing steering
const TRAIL_EVERY = 0.028;

// =====================================================================
// Pooled homing projectiles. Visual = additive glow + white core, plus a
// particle trail. Hit detection is a simple distance check to the target's
// body centre; impacts are resolved by GameScene.onProjectileHit.
// =====================================================================
export class ProjectilePool {
  constructor(scene, fx) {
    this.scene = scene;
    this.fx = fx;
    this.active = [];
    this.free = [];
  }

  _obtain() {
    let p = this.free.pop();
    if (!p) {
      p = {
        glow: this.scene.add.image(0, 0, 'proj').setBlendMode(1).setDepth(DEPTH.PROJECTILE),
        core: this.scene.add.image(0, 0, 'dot').setDepth(DEPTH.PROJECTILE + 0.5),
      };
    }
    p.glow.setVisible(true);
    p.core.setVisible(true);
    this.active.push(p);
    return p;
  }

  _release(i) {
    const p = this.active[i];
    p.glow.setVisible(false);
    p.core.setVisible(false);
    p.target = null;
    this.active[i] = this.active[this.active.length - 1];
    this.active.pop();
    this.free.push(p);
  }

  /**
   * @param {object} o { x, y, target, damage, crit, speed, color, size, angle }
   *   angle: initial launch angle offset (radians) so multi-shots fan out.
   */
  fire(o) {
    const p = this._obtain();
    p.x = o.x;
    p.y = o.y;
    p.target = o.target;
    p.damage = o.damage;
    p.crit = o.crit;
    p.speed = o.speed;
    p.color = o.color;
    p.size = o.size;
    p.life = 0;
    p.trailT = 0;
    const tx = o.target.aimX - o.x;
    const ty = o.target.aimY - o.y;
    const a = Math.atan2(ty, tx) + (o.angle || 0);
    p.vx = Math.cos(a) * p.speed * 0.75;
    p.vy = Math.sin(a) * p.speed * 0.75;
    p.glow.setTint(o.color);
    p.glow.setScale(0.62 * p.size);
    p.core.setScale(0.32 * p.size);
    p.core.setTint(o.crit ? 0xfff3b0 : 0xffffff);
    this._place(p);
    return p;
  }

  _place(p) {
    const ang = Math.atan2(p.vy, p.vx);
    p.glow.setPosition(p.x, p.y).setRotation(ang);
    p.core.setPosition(p.x, p.y);
    // slight pulse/scale wobble while flying
    const pulse = 1 + Math.sin(p.life * 40) * 0.08;
    p.glow.setScale(0.75 * p.size * pulse, 0.55 * p.size * pulse);
  }

  _retarget(p, enemies) {
    let best = null;
    let bestD = 220 * 220;
    for (const e of enemies) {
      if (!e.alive || !e.targetable) continue;
      const dx = e.x - p.x;
      const dy = e.y - p.y;
      const d = dx * dx + dy * dy;
      if (d < bestD) {
        bestD = d;
        best = e;
      }
    }
    p.target = best;
  }

  update(dt, enemies) {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const p = this.active[i];
      p.life += dt;
      if (p.life > MAX_LIFE) {
        this.fx.spawn({ tex: 'soft', x: p.x, y: p.y, life: 0.2, s0: 0.5, s1: 0, tint: p.color, add: true });
        this._release(i);
        continue;
      }
      if (p.target && !p.target.alive) this._retarget(p, enemies);

      // accelerate to full speed
      const sp = Math.hypot(p.vx, p.vy);
      const targetSpeed = p.speed;
      const newSp = sp + (targetSpeed - sp) * Math.min(1, dt * 6);

      if (p.target) {
        const tx = p.target.aimX - p.x;
        const ty = p.target.aimY - p.y;
        const dist = Math.hypot(tx, ty);
        const hitR = p.target.r * 0.75 + 6;
        if (dist <= hitR || dist <= newSp * dt) {
          const target = p.target;
          const hx = p.x;
          const hy = p.y;
          const nx = p.vx / (sp || 1);
          const ny = p.vy / (sp || 1);
          this._release(i);
          this.scene.onProjectileHit(p, target, hx, hy, nx, ny);
          continue;
        }
        // steer velocity toward target
        const cur = Math.atan2(p.vy, p.vx);
        const want = Math.atan2(ty, tx);
        let diff = want - cur;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        const turn = Math.max(-TURN_RATE * dt, Math.min(TURN_RATE * dt, diff));
        // turn harder when close so we never orbit a target
        const k = dist < 80 ? 2.5 : 1;
        const na = cur + turn * k;
        p.vx = Math.cos(na) * newSp;
        p.vy = Math.sin(na) * newSp;
      } else {
        p.vx *= newSp / (sp || 1);
        p.vy *= newSp / (sp || 1);
      }

      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.trailT += dt;
      if (p.trailT >= TRAIL_EVERY) {
        p.trailT = 0;
        this.fx.trail(p.x, p.y, p.color, p.size);
      }
      this._place(p);
    }
  }

  clear() {
    for (let i = this.active.length - 1; i >= 0; i--) this._release(i);
  }
}
