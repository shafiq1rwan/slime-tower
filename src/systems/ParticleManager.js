import { DEPTH, COLORS } from '../config/gameConfig.js';
import { settings } from './Settings.js';
import { rand } from '../utils/animationUtils.js';

// =====================================================================
// Lightweight pooled particle system + floating numbers + lightning arcs.
// Each particle is a reusable Phaser Image updated manually, which gives us
// per-particle tint, fake height (z) with bounce, and strict caps.
// =====================================================================

const MAX_PARTICLES = 420;
const MAX_NUMBERS = 26;
const MAX_BOLTS = 10;

export class ParticleManager {
  constructor(scene) {
    this.scene = scene;
    this.pool = [];
    this.active = [];
    this.numbers = [];
    this.activeNumbers = [];
    this.bolts = [];
    this.quality = 1; // lowered automatically on slow devices
    this.reduced = settings.get('reducedEffects');
  }

  get cap() {
    return Math.floor(MAX_PARTICLES * (this.reduced ? 0.45 : 1) * this.quality);
  }

  /** Scales a requested particle count by quality settings. */
  n(count) {
    const m = (this.reduced ? 0.5 : 1) * this.quality;
    return Math.max(1, Math.round(count * m));
  }

  _obtain() {
    if (this.active.length >= this.cap) return null;
    let p = this.pool.pop();
    if (!p) {
      const img = this.scene.add.image(0, 0, 'soft').setVisible(false);
      p = { img };
    }
    this.active.push(p);
    return p;
  }

  /**
   * Spawn a particle. Options (all optional except tex/x/y):
   * tex, x, y, z, vx, vy, vz, gravity, drag, life, s0, s1, a0, a1, tint,
   * rot, vrot, depth, add (additive blend), bounce, stretch (align to velocity)
   */
  spawn(o) {
    const p = this._obtain();
    if (!p) return null;
    const img = p.img;
    img.setTexture(o.tex || 'soft');
    img.setVisible(true).setActive(true);
    img.setBlendMode(o.add ? 1 : 0);
    if (o.tint !== undefined) img.setTint(o.tint);
    else img.clearTint();
    img.setDepth(o.depth ?? DEPTH.FX);
    p.x = o.x;
    p.y = o.y;
    p.z = o.z || 0;
    p.vx = o.vx || 0;
    p.vy = o.vy || 0;
    p.vz = o.vz || 0;
    p.useZ = o.vz !== undefined || o.z !== undefined;
    p.gravity = o.gravity || 0;
    p.drag = o.drag ?? 0;
    p.life = o.life || 0.5;
    p.t = 0;
    p.s0 = o.s0 ?? 1;
    p.s1 = o.s1 ?? 0;
    p.a0 = o.a0 ?? 1;
    p.a1 = o.a1 ?? 0;
    p.rot = o.rot ?? 0;
    p.vrot = o.vrot || 0;
    p.bounce = o.bounce ?? 0.35;
    p.stretch = o.stretch || 0;
    p.sx = o.sx || 1; // anisotropic base scale (e.g. squashed ground rings)
    p.sy = o.sy || 1;
    this._apply(p, 0);
    return p;
  }

  _apply(p, u) {
    const s = p.s0 + (p.s1 - p.s0) * u;
    const img = p.img;
    img.setPosition(p.x, p.y - p.z);
    img.setAlpha(p.a0 + (p.a1 - p.a0) * u);
    if (p.stretch) {
      const sp = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
      const k = 1 + Math.min(2.5, sp * p.stretch);
      img.setScale(s * k, s / Math.sqrt(k));
      img.setRotation(Math.atan2(p.vy, p.vx));
    } else {
      img.setScale(s * p.sx, s * p.sy);
      img.setRotation(p.rot);
    }
  }

  update(dt) {
    const list = this.active;
    for (let i = list.length - 1; i >= 0; i--) {
      const p = list[i];
      p.t += dt;
      if (p.t >= p.life) {
        p.img.setVisible(false).setActive(false);
        list[i] = list[list.length - 1];
        list.pop();
        this.pool.push(p);
        continue;
      }
      if (p.drag) {
        const k = Math.exp(-p.drag * dt);
        p.vx *= k;
        p.vy *= k;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.useZ) {
        p.vz -= p.gravity * dt;
        p.z += p.vz * dt;
        if (p.z < 0) {
          p.z = 0;
          p.vz = -p.vz * p.bounce;
          p.vx *= 0.6;
          p.vy *= 0.6;
        }
      } else if (p.gravity) {
        p.vy += p.gravity * dt;
      }
      p.rot += p.vrot * dt;
      this._apply(p, p.t / p.life);
    }
    this._updateNumbers(dt);
    this._updateBolts(dt);
  }

  // ------------------------------------------------------------- presets

  /** Small bright burst where a projectile hits. */
  hitSpark(x, y, color = COLORS.magic, power = 1) {
    const c = this.n(4 + power * 2);
    for (let i = 0; i < c; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = rand(90, 220) * power;
      this.spawn({ tex: 'spark', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, drag: 6, life: rand(0.18, 0.32), s0: rand(0.35, 0.55) * power, s1: 0, tint: color, add: true, depth: DEPTH.FX_TOP });
    }
    this.spawn({ tex: 'soft', x, y, life: 0.14, s0: 0.9 * power, s1: 1.6 * power, a0: 0.9, a1: 0, tint: color, add: true, depth: DEPTH.FX_TOP });
  }

  /** Cute goo splash: droplets arc out, bounce and fade. */
  goo(x, y, color, count = 10, size = 1) {
    const c = this.n(count);
    for (let i = 0; i < c; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = rand(60, 190) * Math.sqrt(size);
      const s = rand(0.35, 0.75) * size;
      this.spawn({
        tex: 'goo', x, y, z: rand(10, 30) * size,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.7, vz: rand(120, 320) * Math.sqrt(size),
        gravity: 900, drag: 1.2, life: rand(0.55, 0.9), s0: s, s1: s * 0.4, a0: 1, a1: 0.2, tint: color, bounce: 0.3,
      });
    }
  }

  dust(x, y, count = 5, size = 1) {
    const c = this.n(count);
    for (let i = 0; i < c; i++) {
      const a = (i / c) * Math.PI * 2 + rand(-0.3, 0.3);
      const sp = rand(50, 110) * size;
      this.spawn({ tex: 'dust', x: x + Math.cos(a) * 10 * size, y: y + Math.sin(a) * 5 * size, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.45, drag: 4, life: rand(0.45, 0.7), s0: rand(0.45, 0.7) * size, s1: rand(0.9, 1.2) * size, a0: 0.75, a1: 0, depth: DEPTH.SHADOW + 1 });
    }
  }

  /** Expanding ring. `radius` is the final radius in world units. Flatten for ground rings. */
  ring(x, y, color, radius = 60, life = 0.4, flat = 1, alpha = 0.9, depth = DEPTH.FX) {
    const scale = radius / 56; // ring texture radius is 56px at scale 1
    return this.spawn({ tex: 'ring', x, y, life, s0: scale * 0.15, s1: scale, a0: alpha, a1: 0, tint: color, add: true, sy: flat, depth });
  }

  trail(x, y, color, size = 1) {
    this.spawn({ tex: 'soft', x: x + rand(-2, 2), y: y + rand(-2, 2), life: 0.22, s0: 0.42 * size, s1: 0.05, a0: 0.8, a1: 0, tint: color, add: true, depth: DEPTH.PROJECTILE - 1 });
  }

  muzzle(x, y, color, power = 1) {
    this.spawn({ tex: 'soft', x, y, life: 0.13, s0: 1.4 * power, s1: 0.4, a0: 1, a1: 0, tint: color, add: true, depth: DEPTH.PROJECTILE + 1 });
    this.spawn({ tex: 'spark', x, y, life: 0.12, s0: 0.9 * power, s1: 0.2, a0: 1, a1: 0, rot: Math.random() * 3, tint: 0xffffff, add: true, depth: DEPTH.PROJECTILE + 1 });
  }

  sparkles(x, y, color, count = 10, radius = 60, tex = 'spark') {
    const c = this.n(count);
    for (let i = 0; i < c; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.random() * radius;
      this.spawn({ tex, x: x + Math.cos(a) * r, y: y + Math.sin(a) * r * 0.7, vx: Math.cos(a) * 30, vy: -rand(30, 90), life: rand(0.5, 0.9), s0: rand(0.3, 0.6), s1: 0, rot: rand(0, 3), vrot: rand(-4, 4), tint: color, add: tex !== 'star', depth: DEPTH.FX_TOP });
    }
  }

  burst(x, y, color, count = 12, speed = 200, tex = 'spark', size = 0.6) {
    const c = this.n(count);
    for (let i = 0; i < c; i++) {
      const a = (i / c) * Math.PI * 2 + rand(-0.2, 0.2);
      const sp = rand(0.6, 1) * speed;
      this.spawn({ tex, x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, drag: 3, life: rand(0.4, 0.7), s0: size, s1: 0, rot: a, vrot: rand(-6, 6), tint: color, add: tex === 'spark' || tex === 'soft', depth: DEPTH.FX_TOP });
    }
  }

  confetti(x, y, count = 40, spread = 300) {
    const cols = [0xff6fae, 0xffd23f, 0x5fe3ff, 0x6ff2b0, 0xb36bff, 0xff9f43];
    const c = this.n(count);
    for (let i = 0; i < c; i++) {
      const a = -Math.PI / 2 + rand(-1.2, 1.2);
      const sp = rand(200, 520) * (spread / 300);
      this.spawn({ tex: 'confetti', x: x + rand(-20, 20), y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, gravity: 520, drag: 1.8, life: rand(1.2, 2), s0: rand(0.8, 1.3), s1: 0.6, a0: 1, a1: 0, rot: rand(0, 6), vrot: rand(-10, 10), tint: cols[i % cols.length], depth: DEPTH.FX_TOP });
    }
  }

  snow(x, y, count = 3) {
    const c = this.n(count);
    for (let i = 0; i < c; i++) {
      this.spawn({ tex: 'snow', x: x + rand(-14, 14), y: y + rand(-10, 10), vx: rand(-30, 30), vy: rand(-50, -10), drag: 2, life: rand(0.4, 0.7), s0: rand(0.25, 0.4), s1: 0, rot: rand(0, 3), vrot: rand(-3, 3), tint: 0xdff8ff, add: true, depth: DEPTH.FX_TOP });
    }
  }

  // ------------------------------------------------------------- numbers

  /**
   * Floating damage number. kind: 'normal' | 'crit' | 'heal' | 'hurt'.
   * Uses a pooled BitmapText; if too many are visible we recycle the oldest.
   */
  number(x, y, value, kind = 'normal') {
    if (this.reduced && kind === 'normal' && this.activeNumbers.length > 10) return;
    let n = this.numbers.pop();
    if (!n) {
      if (this.activeNumbers.length >= MAX_NUMBERS) {
        n = this.activeNumbers.shift();
      } else {
        const txt = this.scene.add.bitmapText(0, 0, 'dmgfont', '0').setOrigin(0.5).setDepth(DEPTH.NUMBERS);
        txt.setLetterSpacing(-10);
        n = { txt };
      }
    }
    if (!this.activeNumbers.includes(n)) this.activeNumbers.push(n);
    const txt = n.txt;
    const str = kind === 'heal' ? `+${Math.round(value)}` : kind === 'crit' ? `${Math.round(value)}!` : `${Math.round(value)}`;
    txt.setText(str);
    txt.setVisible(true);
    txt.setAlpha(1);
    if (kind === 'crit') txt.setTint(0xffc93c);
    else if (kind === 'heal') txt.setTint(0x6ff2b0);
    else if (kind === 'hurt') txt.setTint(0xff6b81);
    else txt.clearTint();
    n.x = x + rand(-8, 8);
    n.y = y;
    n.t = 0;
    n.life = kind === 'crit' ? 0.9 : 0.65;
    n.base = kind === 'crit' ? 0.82 : kind === 'heal' ? 0.8 : kind === 'hurt' ? 0.6 : 0.46;
    n.vy = kind === 'crit' ? -70 : -55;
    n.vx = rand(-20, 20);
    txt.setDepth(DEPTH.NUMBERS + (kind === 'crit' ? 1 : 0));
  }

  _updateNumbers(dt) {
    const list = this.activeNumbers;
    for (let i = list.length - 1; i >= 0; i--) {
      const n = list[i];
      n.t += dt;
      const u = n.t / n.life;
      if (u >= 1) {
        n.txt.setVisible(false);
        list.splice(i, 1);
        this.numbers.push(n);
        continue;
      }
      n.x += n.vx * dt;
      n.y += n.vy * dt;
      n.vy *= Math.exp(-3 * dt);
      // pop in (overshoot), hold, shrink out
      const pop = u < 0.15 ? 0.3 + (u / 0.15) * 1.0 : u < 0.28 ? 1.3 - ((u - 0.15) / 0.13) * 0.3 : 1;
      const out = u > 0.7 ? 1 - (u - 0.7) / 0.3 : 1;
      n.txt.setPosition(n.x, n.y);
      n.txt.setScale(n.base * pop * (0.6 + 0.4 * out));
      n.txt.setAlpha(out);
    }
  }

  // ------------------------------------------------------------- lightning

  lightning(x1, y1, x2, y2, color = COLORS.lightning) {
    let b = this.bolts.find((bb) => !bb.active);
    if (!b) {
      if (this.bolts.length >= MAX_BOLTS) b = this.bolts[0];
      else {
        b = { g: this.scene.add.graphics().setDepth(DEPTH.FX_TOP).setBlendMode(1), active: false };
        this.bolts.push(b);
      }
    }
    b.active = true;
    b.t = 0;
    b.life = 0.2;
    const g = b.g;
    g.clear();
    g.setAlpha(1);
    g.setVisible(true);
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;
    const segs = Math.max(4, Math.round(len / 22));
    const pts = [[x1, y1]];
    for (let i = 1; i < segs; i++) {
      const t = i / segs;
      const off = rand(-1, 1) * Math.min(18, len * 0.12);
      pts.push([x1 + dx * t + nx * off, y1 + dy * t + ny * off]);
    }
    pts.push([x2, y2]);
    const stroke = (w, col, a) => {
      g.lineStyle(w, col, a);
      g.beginPath();
      g.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
      g.strokePath();
    };
    stroke(9, color, 0.35);
    stroke(4, color, 0.8);
    stroke(1.8, 0xffffff, 1);
  }

  _updateBolts(dt) {
    for (const b of this.bolts) {
      if (!b.active) continue;
      b.t += dt;
      const u = b.t / b.life;
      if (u >= 1) {
        b.active = false;
        b.g.setVisible(false);
      } else {
        b.g.setAlpha(1 - u * u);
      }
    }
  }

  setReduced(v) {
    this.reduced = v;
  }
}
