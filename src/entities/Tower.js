import { TOWER, UPGRADE_EFFECTS, TOWER_TIERS } from '../config/balance.js';
import { WORLD, COLORS } from '../config/gameConfig.js';
import { TowerView } from './TowerView.js';

// =====================================================================
// Tower — stats, targeting and firing. Visuals live in TowerView.
// =====================================================================
export class Tower {
  constructor(scene, fx, projectiles) {
    this.scene = scene;
    this.fx = fx;
    this.projectiles = projectiles;
    this.x = 0;
    this.y = 0;
    this.maxHp = TOWER.maxHp;
    this.hp = this.maxHp;
    this.alive = true;
    this.levels = {};
    this.attackT = 0.6;
    this.tier = 0;
    this.recomputeStats();
    this.view = new TowerView(scene, this, fx);
  }

  /** Fold all upgrade levels into the live stat block. */
  recomputeStats() {
    const lv = (id) => this.levels[id] || 0;
    const fx = {};
    for (const [id, fn] of Object.entries(UPGRADE_EFFECTS)) Object.assign(fx, fn(lv(id)));
    this.stats = {
      damage: TOWER.damage * (fx.damageMult || 1),
      interval: TOWER.attackInterval / (fx.attackSpeedMult || 1),
      range: TOWER.range * (fx.rangeMult || 1),
      projectiles: 1 + TOWER.extraProjectiles + (fx.extraProjectiles || 0),
      projectileSpeed: TOWER.projectileSpeed,
      critChance: TOWER.critChance + (fx.critChance || 0),
      critMultiplier: TOWER.critMultiplier,
      chainJumps: fx.chainJumps || 0,
      chainDamage: fx.chainDamage || 0,
      chainRange: fx.chainRange || 0,
      slow: fx.slow || 0,
      slowDuration: fx.slowDuration || 0,
      splashRadius: fx.splashRadius || 0,
      splashDamage: fx.splashDamage || 0,
    };
    this.projColor = this.stats.slow > 0 ? COLORS.frost : COLORS.magic;
    if (this.view) this.view.onStatsChanged();
  }

  setLevel(id, level) {
    this.levels[id] = level;
    this.recomputeStats();
  }

  tierForWave(wave) {
    let t = 0;
    TOWER_TIERS.forEach((w, i) => {
      if (wave >= w) t = i;
    });
    return t;
  }

  /** Nearest slimes within range, closest first. */
  findTargets(enemies) {
    const range = this.stats.range;
    const out = [];
    for (const e of enemies) {
      if (!e.alive || !e.targetable) continue;
      const d = Math.hypot(e.x - this.x, e.y - this.y) - e.r * 0.6;
      if (d <= range) {
        e._d = d;
        out.push(e);
      }
    }
    out.sort((a, b) => (b === this.priorityTarget) - (a === this.priorityTarget) || a._d - b._d);
    return out;
  }

  update(dt, enemies) {
    if (!this.alive) return;
    this.attackT -= dt;
    if (this.attackT > 0) return;
    const targets = this.findTargets(enemies);
    if (!targets.length) {
      this.attackT = 0.05; // poll again shortly
      return;
    }
    this.fire(targets);
    this.attackT += this.stats.interval;
    if (this.attackT < 0) this.attackT = this.stats.interval * 0.5;
  }

  fire(targets) {
    const s = this.stats;
    const n = s.projectiles;
    const ox = this.x;
    const oy = this.y + WORLD.CRYSTAL_Y * this.view.crystalHeightScale();
    const powerLvl = this.levels.power || 0;
    const rapidLvl = this.levels.rapid || 0;
    const size = 1 + powerLvl * 0.09;
    for (let i = 0; i < n; i++) {
      const target = targets[i % targets.length];
      const crit = Math.random() < s.critChance;
      // fan multi-shots out so the split is readable
      const spread = n > 1 ? (i - (n - 1) / 2) * 0.55 : 0;
      this.projectiles.fire({
        x: ox,
        y: oy,
        target,
        damage: s.damage * (crit ? s.critMultiplier : 1),
        crit,
        speed: s.projectileSpeed,
        color: crit ? COLORS.crit : this.projColor,
        size: crit ? size * 1.25 : size,
        angle: spread,
      });
    }
    this.view.onAttack(1 + rapidLvl * 0.08 + powerLvl * 0.06);
    this.fx.muzzle(ox, oy, this.projColor, 0.8 + rapidLvl * 0.1 + powerLvl * 0.06);
    this.scene.sfx('pew', { pitch: 1 + rapidLvl * 0.03 });
  }

  takeDamage(amount, source) {
    if (!this.alive) return;
    this.hp = Math.max(0, this.hp - amount);
    this.view.onHit(amount);
    this.scene.onTowerDamaged(amount, source);
    if (this.hp <= 0) {
      this.alive = false;
      this.scene.onTowerDestroyed();
    }
  }

  heal(amount) {
    const before = this.hp;
    this.hp = Math.min(this.maxHp, this.hp + amount);
    return this.hp - before;
  }
}
