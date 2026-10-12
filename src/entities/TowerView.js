import { TOWER_ART, CRYSTAL_ART } from '../art/textures.js';
import { TEX_SCALE, DEPTH, WORLD, COLORS } from '../config/gameConfig.js';
import { stepSpring, rand } from '../utils/animationUtils.js';

const INV = 1 / TEX_SCALE;
// Visual evolution per tier: crystal size, glow, orbiting shards
const TIERS = [
  { crystal: 1.0, glow: 1.0, orbiters: 0, rune: 0, gold: false },
  { crystal: 1.18, glow: 1.3, orbiters: 0, rune: 0.55, gold: false },
  { crystal: 1.3, glow: 1.55, orbiters: 3, rune: 0.7, gold: false },
  { crystal: 1.45, glow: 1.9, orbiters: 5, rune: 0.95, gold: true },
];

// =====================================================================
// TowerView — the stone tower, floating crystal, aura, rune circle,
// orbiting shards and range indicator. Purely cosmetic.
// =====================================================================
export class TowerView {
  constructor(scene, tower, fx) {
    this.scene = scene;
    this.tower = tower;
    this.fx = fx;
    this.time = 0;
    this.tier = 0;
    this.pulse = { x: 0, v: 0 };
    this.recoil = { x: 0, v: 0 };
    this.squash = { x: 0, v: 0 };
    this.hitT = 0;
    this.glowBoost = 0;
    this.crystalScale = 1;
    this.dead = false;

    // ground: aura glow + rotating rune circle + range ring
    this.aura = scene.add.image(0, 0, 'soft').setTint(COLORS.magic).setBlendMode(1).setAlpha(0.35).setDepth(DEPTH.DECAL);
    this.aura.setScale(3.2, 1.7);
    this.rune = scene.add.image(0, 0, 'rune_ring').setTint(COLORS.magic).setAlpha(0).setDepth(DEPTH.DECAL + 1).setBlendMode(1);
    this.rune.setScale(0.75, 0.42);
    this.rangeG = scene.add.graphics().setDepth(DEPTH.RANGE);
    this.rangeShown = 0;

    // tower body
    this.root = scene.add.container(0, 0).setDepth(DEPTH.ENTITY + 2);
    this.shadow = scene.add.image(0, 6, 'shadow').setScale(1.3, 1.1);
    this.base = scene.add.image(0, 0, 'tower_base').setOrigin(TOWER_ART.footX / TOWER_ART.w, TOWER_ART.footY / TOWER_ART.h).setScale(INV);

    this.crystalGroup = scene.add.container(0, WORLD.CRYSTAL_Y);
    this.glow = scene.add.image(0, 0, 'soft').setTint(COLORS.magic).setBlendMode(1).setScale(2.2).setAlpha(0.6);
    this.crystal = scene.add.image(0, 0, 'crystal').setScale(INV);
    this.crack = scene.add.image(0, 0, 'crack').setScale(INV).setVisible(false);
    this.halo = scene.add.image(0, 0, 'ring').setTint(0xffe58a).setBlendMode(1).setAlpha(0).setScale(0.9, 0.35);
    this.crystalGroup.add([this.glow, this.halo, this.crystal, this.crack]);

    this.root.add([this.shadow, this.base, this.crystalGroup]);

    this.orbiters = [];
    for (let i = 0; i < 5; i++) {
      const o = scene.add.image(0, 0, 'shard').setScale(INV).setVisible(false);
      this.orbiters.push(o);
    }

    this.drawRange(this.tower.stats.range);
    this.setTier(0, false);
  }

  crystalHeightScale() {
    return 1 + (this.crystalScale - 1) * 0.35;
  }

  /** Dashed range ring on the ground. */
  drawRange(radius, alpha = 0.26) {
    const g = this.rangeG;
    g.clear();
    g.lineStyle(4, 0xffffff, alpha);
    const segs = 64;
    for (let i = 0; i < segs; i += 2) {
      const a0 = (i / segs) * Math.PI * 2;
      const a1 = ((i + 1.2) / segs) * Math.PI * 2;
      g.beginPath();
      g.arc(0, 0, radius, a0, a1);
      g.strokePath();
    }
    this.rangeShown = radius;
  }

  onStatsChanged() {
    const r = this.tower.stats.range;
    if (Math.abs(r - this.rangeShown) > 0.5) {
      const from = this.rangeShown;
      const obj = { r: from, a: 0.6 };
      this.scene.tweens.add({
        targets: obj,
        r,
        a: 0.26,
        duration: 700,
        ease: 'Back.easeOut',
        onUpdate: () => this.drawRange(obj.r, obj.a),
      });
    }
    // frost upgrade tints the magic icy
    const frost = this.tower.stats.slow > 0;
    const col = frost ? 0x9fe9ff : COLORS.magic;
    this.glow.setTint(col);
    this.aura.setTint(col);
  }

  setTier(t, animate = true) {
    this.tier = t;
    const cfg = TIERS[t];
    this.crystalScale = cfg.crystal;
    this.base.setTexture(cfg.gold ? 'tower_base_gold' : 'tower_base');
    this.orbiters.forEach((o, i) => o.setVisible(i < cfg.orbiters && !this.dead));
    this.halo.setAlpha(cfg.gold ? 0.7 : 0);
    if (animate) {
      this.pulse.v += 10;
      this.squash.v -= 6;
      this.fx.ring(0, 0, COLORS.magic, 200, 0.7, 0.55);
      this.fx.ring(0, WORLD.CRYSTAL_Y, 0xffffff, 90, 0.5);
      this.fx.sparkles(0, WORLD.CRYSTAL_Y, cfg.gold ? 0xffe066 : COLORS.magic, 22, 70);
      this.glowBoost = 1.5;
    }
  }

  onAttack(power = 1) {
    this.pulse.v += 3.2 * power;
    this.recoil.v += 2.2 * power;
    this.glowBoost = Math.min(1.4, this.glowBoost + 0.45 * power);
  }

  onHit() {
    this.hitT = 0.14;
    this.squash.v += 3;
  }

  /** Celebration bounce when an upgrade is picked, flavoured per upgrade. */
  playUpgrade(id, color) {
    const fx = this.fx;
    const cy = WORLD.CRYSTAL_Y;
    this.pulse.v += 12;
    this.squash.v -= 7;
    this.glowBoost = 1.6;
    fx.ring(0, 0, color, 170, 0.6, 0.55);
    switch (id) {
      case 'rapid':
        fx.burst(0, cy, color, 16, 260, 'spark', 0.6);
        fx.ring(0, cy, color, 70, 0.35);
        break;
      case 'power':
        fx.ring(0, cy, color, 110, 0.5);
        fx.burst(0, cy, 0xffffff, 10, 160, 'soft', 0.9);
        break;
      case 'split':
        for (let i = 0; i < 3; i++) fx.burst(0, cy, color, 6, 200 + i * 60, 'spark', 0.5);
        break;
      case 'chain': {
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2 + rand(-0.2, 0.2);
          fx.lightning(0, cy, Math.cos(a) * 130, cy + Math.sin(a) * 90);
        }
        break;
      }
      case 'frost':
        fx.burst(0, cy, 0xdff8ff, 14, 200, 'snow', 0.55);
        break;
      case 'splash':
        fx.ring(0, 0, color, 140, 0.55, 0.55);
        fx.ring(0, 0, 0xffffff, 100, 0.4, 0.55);
        break;
      case 'heal':
        for (let i = 0; i < 3; i++) {
          this.scene.time.delayedCall(i * 140, () => fx.ring(0, 0, color, 130, 0.6, 0.55));
        }
        for (let i = 0; i < 12; i++) {
          fx.spawn({ tex: 'plus', x: rand(-60, 60), y: rand(-80, 20), vx: 0, vy: -rand(40, 90), life: rand(0.6, 1), s0: rand(0.4, 0.7), s1: 0, tint: color, depth: DEPTH.FX_TOP });
        }
        break;
      case 'crit':
        fx.sparkles(0, cy, color, 18, 70, 'star');
        break;
      case 'reach':
        fx.ring(0, 0, color, this.tower.stats.range, 0.8, 1, 0.8);
        break;
      default:
        break;
    }
    fx.sparkles(0, cy, color, 12, 50);
  }

  /** Tower destroyed: crack, flash, shatter. */
  playDestroyed() {
    this.dead = true;
    const fx = this.fx;
    const cy = this.crystalGroup.y;
    this.crack.setVisible(true);
    this.crystal.setTint(0xff9aa8);
    this.scene.tweens.add({
      targets: this.crystalGroup,
      x: { from: -4, to: 4 },
      duration: 40,
      yoyo: true,
      repeat: 6,
      onComplete: () => {
        this.crystalGroup.x = 0;
        this.crystal.setVisible(false);
        this.crack.setVisible(false);
        this.glow.setVisible(false);
        this.halo.setVisible(false);
        this.orbiters.forEach((o) => o.setVisible(false));
        fx.burst(0, cy, 0x9ff0ff, 18, 320, 'shard', 1.4);
        fx.burst(0, cy, 0xffffff, 14, 220, 'spark', 0.9);
        fx.ring(0, cy, 0xffffff, 140, 0.5);
        fx.ring(0, 0, COLORS.magic, 220, 0.8, 0.55);
        fx.spawn({ tex: 'soft', x: 0, y: cy, life: 0.4, s0: 2, s1: 6, a0: 1, a1: 0, tint: 0xffffff, add: true, depth: DEPTH.FX_TOP });
      },
    });
    this.aura.setAlpha(0);
    this.rune.setAlpha(0);
    this.rangeG.setVisible(false);
  }

  playVictory() {
    this.glowBoost = 3;
    this.pulse.v += 14;
    this.fx.ring(0, WORLD.CRYSTAL_Y, 0xffffff, 200, 0.8);
    this.fx.ring(0, 0, 0xffe066, 300, 1, 0.55);
    this.fx.sparkles(0, WORLD.CRYSTAL_Y, 0xffe066, 30, 120, 'star');
    this.victory = true;
    this.rangeG.setVisible(false);
  }

  update(dt) {
    this.time += dt;
    const t = this.time;
    const cfg = TIERS[this.tier];

    stepSpring(this.pulse, dt, 260, 12);
    stepSpring(this.recoil, dt, 420, 16);
    stepSpring(this.squash, dt, 300, 10);
    this.glowBoost = Math.max(0, this.glowBoost - dt * 3);
    if (this.hitT > 0) this.hitT -= dt;

    // tower body recoil / squash
    const sq = this.squash.x;
    const rc = this.recoil.x * 0.04;
    this.base.setScale(INV * (1 + sq * 0.05 + rc * 0.5), INV * (1 - sq * 0.06 - rc));
    if (this.hitT > 0) this.base.setTintFill(0xff8a9e);
    else this.base.clearTint();

    if (this.dead) return;

    // floating crystal
    const hs = this.crystalHeightScale();
    const bob = Math.sin(t * 2.1) * 4;
    this.crystalGroup.y = WORLD.CRYSTAL_Y * hs + bob - rc * 30;
    const cs = this.crystalScale * (1 + this.pulse.x * 0.04);
    this.crystal.setScale(INV * cs * (1 - this.pulse.x * 0.01), INV * cs * (1 + this.pulse.x * 0.02));
    this.crystal.rotation = Math.sin(t * 1.3) * 0.04;
    if (this.hitT > 0) this.crystal.setTint(0xffb3c0);
    else this.crystal.clearTint();

    const lowHp = this.tower.hp / this.tower.maxHp < 0.3;
    const flicker = lowHp ? 0.25 * Math.max(0, Math.sin(t * 9)) : 0;
    const breathe = 0.5 + 0.12 * Math.sin(t * 2.4);
    this.glow.setAlpha(Math.min(1, breathe + this.glowBoost * 0.3 - flicker));
    this.glow.setScale(2.2 * cfg.glow * (1 + this.glowBoost * 0.15));
    this.aura.setAlpha(0.22 + cfg.glow * 0.08 + this.glowBoost * 0.08 + Math.sin(t * 1.6) * 0.04);
    if (this.victory) this.glow.setTint(0xfff3c4);

    // halo (top tier)
    if (cfg.gold) {
      this.halo.rotation = 0;
      this.halo.y = -CRYSTAL_ART.h * 0.55 * cs + Math.sin(t * 3) * 2;
      this.halo.setScale(0.55 * cs, 0.2 * cs);
    }

    // rune circle on the ground
    this.rune.rotation += dt * 0.35;
    this.rune.setAlpha(cfg.rune * (0.6 + 0.4 * Math.sin(t * 2)));

    // orbiting shards — depth swaps as they pass behind the crystal
    const n = cfg.orbiters;
    for (let i = 0; i < n; i++) {
      const o = this.orbiters[i];
      const a = t * 1.6 + (i / n) * Math.PI * 2;
      const r = 46 * cs;
      o.x = Math.cos(a) * r;
      o.y = this.crystalGroup.y + Math.sin(a) * r * 0.32 + Math.sin(t * 3 + i) * 4;
      o.setDepth(DEPTH.ENTITY + 2 + (Math.sin(a) > 0 ? 1 : -1));
      o.rotation = Math.sin(a) * 0.3;
      o.setScale(INV * (0.85 + 0.15 * Math.sin(a)));
    }
  }
}
