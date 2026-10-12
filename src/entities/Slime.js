import { ENEMIES, SCALING, BOSS } from '../config/balance.js';
import { WORLD } from '../config/gameConfig.js';
import { SlimeView } from './SlimeView.js';
import { stepSpring, hopSpeedFactor, landPhase, rand, clamp } from '../utils/animationUtils.js';
import { entrancePose, ENTRY_DURATION } from '../utils/spawnLayout.js';

const GRAVITY = 900;

// =====================================================================
// Slime — gameplay logic only. Position (x, y) is the ground point and the
// collision circle has radius `r`. All bouncing/squashing lives in SlimeView.
//
// States: spawning (dropping in / thrown by a split) -> moving -> attacking
//         dead | celebrate (when the tower falls)
// =====================================================================
export class Slime {
  constructor(scene, type, x, y, wave, opts = {}) {
    this.scene = scene;
    this.type = type;
    this.def = ENEMIES[type];
    const def = this.def;
    this.x = x;
    this.y = y;
    this.r = def.radius;
    this.mass = def.radius * def.radius;

    const hpMult = def.isBoss ? 1 : SCALING.hp(wave);
    this.maxHp = Math.round(def.hp * hpMult);
    this.hp = this.maxHp;
    this.damage = def.isBoss ? def.damage : Math.round(def.damage * SCALING.damage(wave));
    this.speed = def.speed * (def.isBoss ? 1 : SCALING.speed(wave));

    this.alive = true;
    this.targetable = false;
    this.state = 'spawning';
    this.isMinion = !!opts.minion;

    // Ordinary arrivals emerge from a rift and hop inward. Split/summon
    // children retain their explicitly supplied ballistic arcs.
    this.entrance = opts.z === undefined ? { t: 0, x, y, duration: def.isBoss ? .8 : ENTRY_DURATION } : null;
    this.z = opts.z ?? 0;
    this.vz = opts.vz ?? 0;
    this.vx = opts.vx || 0;
    this.vy = opts.vy || 0;

    this.hopPhase = Math.random();
    this.hopRate = def.hopRate * rand(0.9, 1.12);
    this.landAt = landPhase(def.hop);

    this.dirX = 0;
    this.dirY = 1;
    this.attackCd = rand(.65, .95);
    this.lungeT = -1;
    this.lungeHit = false;
    this.stunT = 0;
    this.attackWarn = 0;

    this.slowTimer = 0;
    this.slowAmount = 0;
    this.kbx = 0;
    this.kby = 0;
    this.jig = { x: 0, v: 0 };
    this.flashT = 0;
    this.hurtT = 0;
    this.blinkT = rand(1, 4);
    this.blinking = 0;
    this.lastNumberT = -1;

    this.boss = def.isBoss ? new BossBrain(this) : null;
    this.view = new SlimeView(scene, this);
  }

  /** Point projectiles home toward (body centre, including hop height). */
  get aimX() {
    return this.x;
  }
  get aimY() {
    return this.view && this.view.root ? this.view.aimY() : this.y - this.r;
  }

  update(dt, tower, time) {
    if (!this.alive) return;

    // ---- timers
    if (this.flashT > 0) this.flashT -= dt;
    if (this.hurtT > 0) this.hurtT -= dt;
    if (this.slowTimer > 0) this.slowTimer -= dt;
    this.blinkT -= dt;
    if (this.blinking > 0) this.blinking -= dt;
    if (this.blinkT <= 0) {
      this.blinking = 0.12;
      this.blinkT = rand(1.8, 5);
    }
    stepSpring(this.jig, dt, 340, 20);

    // ---- spawning arc
    if (this.state === 'spawning') {
      if (this.entrance) {
        const entry = this.entrance;
        entry.t += dt;
        const pose = entrancePose(entry.t, entry.duration, this.def.isBoss ? 30 : 18);
        const d = Math.hypot(entry.x, entry.y) || 1;
        this.x = entry.x - entry.x / d * pose.travel;
        this.y = entry.y - entry.y / d * pose.travel;
        this.dirX = -entry.x / d; this.dirY = -entry.y / d;
        this.z = pose.z;
        if (pose.u >= 1) this.finishSpawn();
        return;
      }
      this.vz -= GRAVITY * dt;
      this.z += this.vz * dt;
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      if (this.z <= 0 && this.vz < 0) {
        this.z = 0;
        this.vz = 0;
        this.vx = 0;
        this.vy = 0;
        this.finishSpawn();
      }
      return;
    }

    const slowMult = this.slowTimer > 0 ? 1 - this.slowAmount * (this.def.isBoss ? 0.5 : 1) : 1;
    if (this.stunT > 0) {
      this.stunT = Math.max(0, this.stunT - dt);
      this.attackWarn = 0;
      this.applyKnockback(dt);
      return;
    }

    if (this.state === 'celebrate') {
      this.hopPhase = (this.hopPhase + dt * this.hopRate * 0.9) % 1;
      return;
    }

    // ---- direction to the tower
    const dx = tower.x - this.x;
    const dy = tower.y - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 0.001;
    this.dirX = dx / dist;
    this.dirY = dy / dist;
    const contact = WORLD.TOWER_RADIUS + this.r * 0.8;

    // Boss abilities may take over movement (windup / leap)
    const busy = this.boss ? this.boss.update(dt, tower, dist, contact) : false;

    if (!busy) {
      if (dist > contact + 1) {
        this.state = 'moving';
        this.attackWarn = 0;
        const prev = this.hopPhase;
        this.hopPhase += dt * this.hopRate * slowMult;
        if (this.hopPhase >= 1) this.hopPhase -= 1;
        if (prev < this.landAt && this.hopPhase >= this.landAt) {
          this.scene.onSlimeLanded(this, false);
        }
        const v = this.speed * slowMult * hopSpeedFactor(this.hopPhase, this.def.hop);
        const step = Math.min(v * dt, dist - contact);
        this.x += this.dirX * step;
        this.y += this.dirY * step;
      } else {
        this.state = 'attacking';
        this.hopPhase = (this.hopPhase + dt * this.hopRate * 0.55) % 1;
        this.attackCd -= dt * slowMult;
        this.attackWarn = this.lungeT < 0 && this.attackCd <= .5 ? 1 - Math.max(0, this.attackCd) / .5 : 0;
        if (this.attackCd <= 0 && this.lungeT < 0) {
          this.lungeT = 0;
          this.lungeHit = false;
          this.attackCd = this.def.attackInterval;
        }
      }
    }

    // ---- attack lunge: damage lands mid-animation
    if (this.lungeT >= 0) {
      this.lungeT += dt / 0.45;
      if (!this.lungeHit && this.lungeT >= 0.45) {
        this.lungeHit = true;
        if (dist <= contact + 12) tower.takeDamage(this.damage, this);
      }
      if (this.lungeT >= 1) this.lungeT = -1;
    }

    // ---- knockback (decays quickly)
    this.applyKnockback(dt);

    // keep inside a sane radius
    const d2 = this.x * this.x + this.y * this.y;
    const maxR = WORLD.SPAWN_RADIUS + 30;
    if (d2 > maxR * maxR) {
      const d = Math.sqrt(d2);
      this.x *= maxR / d;
      this.y *= maxR / d;
    }
  }

  finishSpawn() {
    this.z = 0; this.state = 'moving'; this.targetable = true;
    this.jig.v += this.def.isBoss ? 4 : 2.5;
    this.hopPhase = this.landAt;
    this.scene.onSlimeLanded(this, true);
  }

  applyKnockback(dt) {
    if (this.kbx || this.kby) {
      this.x += this.kbx * dt;
      this.y += this.kby * dt;
      const k = Math.exp(-11 * dt);
      this.kbx *= k;
      this.kby *= k;
      if (Math.abs(this.kbx) + Math.abs(this.kby) < 2) this.kbx = this.kby = 0;
    }

  }

  /**
   * Apply damage. Returns true if this hit killed the slime.
   * opts: { crit, kx, ky (knockback direction), silent }
   */
  takeDamage(amount, opts = {}) {
    if (!this.alive) return false;
    this.hp -= amount;
    this.flashT = 0.07;
    this.hurtT = 0.22;
    const resist = this.def.knockbackResist;
    this.jig.v += (opts.crit ? 9 : 6) * (1 - resist * 0.6);
    if (opts.kx !== undefined) {
      const kb = (opts.crit ? 150 : 90) * (1 - resist);
      this.kbx += opts.kx * kb;
      this.kby += opts.ky * kb;
    }
    this.scene.onSlimeHit(this, amount, opts);
    if (this.hp <= 0) {
      this.die();
      return true;
    }
    return false;
  }

  applySlow(amount, duration) {
    if (!this.alive || amount <= 0) return;
    this.slowAmount = Math.max(this.slowAmount * (this.slowTimer > 0 ? 1 : 0), amount);
    this.slowTimer = Math.max(this.slowTimer, duration);
  }

  die() {
    if (!this.alive) return;
    this.alive = false;
    this.targetable = false;
    this.state = 'dead';
    this.scene.onSlimeKilled(this);
  }

  celebrate() {
    if (!this.alive) return;
    this.state = 'celebrate';
    this.lungeT = -1;
    this.z = 0;
  }

  /** Remove visuals immediately (restart / cleanup). */
  destroy() {
    this.alive = false;
    if (this.view) this.view.destroy();
  }
}

// =====================================================================
// Slime King abilities: periodic minion summons and a heavy jump attack.
// update() returns true while the boss is busy (normal walking suspended).
// =====================================================================
class BossBrain {
  constructor(slime) {
    this.slime = slime;
    this.phase = 'walk';
    this.t = 0;
    this.summonT = BOSS.summonFirstDelay;
    this.jumpT = BOSS.jumpFirstDelay;
    this.windup = BOSS.jumpWindup;
    this.sx = 0;
    this.sy = 0;
    this.tx = 0;
    this.ty = 0;
  }

  update(dt, tower, dist, contact) {
    const s = this.slime;
    const scene = s.scene;

    if (this.phase === 'walk') {
      this.summonT -= dt;
      this.jumpT -= dt;
      if (this.summonT <= 0) {
        this.summonT = BOSS.summonInterval;
        scene.bossSummon(s);
        s.jig.v -= 6; // stretch up as minions pop out
      }
      if (this.jumpT <= 0 && s.hopPhase >= s.landAt + 0.14) {
        this.phase = 'windup';
        this.t = 0;
        s.hopPhase = 0; // grounded pose while winding up
        s.lungeT = -1;
        // Leap toward the tower, stopping at contact range.
        const travel = clamp(dist - contact, 0, BOSS.jumpDistance);
        this.sx = s.x;
        this.sy = s.y;
        this.tx = s.x + s.dirX * travel;
        this.ty = s.y + s.dirY * travel;
        scene.bossJumpWindup(s, this.tx, this.ty);
        return true;
      }
      return false;
    }

    this.t += dt;
    if (this.phase === 'windup') {
      if (this.t >= this.windup) {
        this.phase = 'leap';
        this.t = 0;
      }
      return true;
    }
    if (this.phase === 'leap') {
      const u = Math.min(1, this.t / BOSS.jumpDuration);
      const e = u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
      s.x = this.sx + (this.tx - this.sx) * e;
      s.y = this.sy + (this.ty - this.sy) * e;
      s.z = Math.sin(Math.PI * u) * BOSS.jumpHeight;
      if (u >= 1) {
        s.z = 0;
        this.phase = 'recover';
        this.t = 0;
        s.jig.v += 12;
        s.hopPhase = s.landAt + 0.01;
        const d = Math.hypot(tower.x - s.x, tower.y - s.y);
        scene.bossLanded(s, d <= contact + 30);
      }
      return true;
    }
    if (this.phase === 'recover') {
      if (this.t >= 0.45) {
        this.phase = 'walk';
        s.hopPhase = 0;
        this.jumpT = this.interrupted ? 3.5 : BOSS.jumpInterval;
        this.interrupted = false;
      }
      return true;
    }
    return false;
  }
}
