// =====================================================================
// Procedural art. Every visual in the game is drawn here once, at boot, with
// the Canvas 2D API and registered as a Phaser texture under a fixed key.
//
// To swap in real artwork later, load images/spritesheets with the same keys
// (see TEXTURE KEYS below) and skip the matching draw call. Slime textures are
// anchored at their feet (see slimeMetrics) — keep that anchor in new art.
//
// TEXTURE KEYS
//   FX:     soft, dot, goo, ring, spark, star, snow, plus, shadow, dust, proj, bar, confetti, exclaim
//   Slimes: slime_<type>, face_<type>, face_<type>_blink, face_<type>_hurt, crown
//   Tower:  tower_base, tower_base_gold, crystal, shard, rune_ring, crack
//   Arena:  grass_tile, arena_disc, plaza, flower_0..3, tuft, rock_0..2, bush_0..1, mushroom
//   Font:   dmgfont (bitmap font for damage numbers)
// =====================================================================
import Phaser from 'phaser';
import { ENEMIES } from '../config/balance.js';
import { TEX_SCALE, toCss } from '../config/gameConfig.js';

const INK = '#1e1b3a';
const NAVY = 0x1b2350;

// ---------------------------------------------------------------- colour helpers
function mixHex(a, b, t) {
  const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
  const br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
  return (
    (Math.round(ar + (br - ar) * t) << 16) |
    (Math.round(ag + (bg - ag) * t) << 8) |
    Math.round(ab + (bb - ab) * t)
  );
}
const lighten = (c, t) => mixHex(c, 0xffffff, t);
const darken = (c, t) => mixHex(c, 0x000000, t);

// Deterministic PRNG so decorations look the same every run.
function seeded(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeCanvas(w, h) {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(2, Math.ceil(w));
  canvas.height = Math.max(2, Math.ceil(h));
  const ctx = canvas.getContext('2d');
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  return { canvas, ctx };
}

function register(scene, key, canvas) {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  scene.textures.addCanvas(key, canvas);
}

function ellipse(ctx, x, y, rx, ry, rot = 0) {
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, Math.PI * 2);
}

function radial(ctx, x, y, r, stops) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  stops.forEach(([o, c]) => g.addColorStop(o, c));
  return g;
}

// =====================================================================
// SLIMES
// =====================================================================

/** Geometry of a slime texture in world units. Shared with SlimeView. */
export function slimeMetrics(radius) {
  const hw = radius * 1.08; // half width of the body
  const h = radius * 1.72; // body height
  const pad = radius * 0.22 + 4;
  const w = hw * 2 + pad * 2;
  const H = h * 1.04 + pad * 2;
  const by = H - pad; // feet
  return { hw, h, pad, w, H, by, originY: by / H };
}

function slimePath(ctx, cx, by, hw, h) {
  ctx.beginPath();
  ctx.moveTo(cx - hw * 0.78, by);
  ctx.bezierCurveTo(cx - hw * 1.06, by, cx - hw * 1.08, by - h * 0.42, cx - hw * 0.86, by - h * 0.7);
  ctx.bezierCurveTo(cx - hw * 0.62, by - h * 1.04, cx + hw * 0.62, by - h * 1.04, cx + hw * 0.86, by - h * 0.7);
  ctx.bezierCurveTo(cx + hw * 1.08, by - h * 0.42, cx + hw * 1.06, by, cx + hw * 0.78, by);
  ctx.quadraticCurveTo(cx, by + h * 0.07, cx - hw * 0.78, by);
  ctx.closePath();
}

function drawSlimeBody(type, def) {
  const S = TEX_SCALE;
  const m = slimeMetrics(def.radius);
  const { canvas, ctx } = makeCanvas(m.w * S, m.H * S);
  ctx.scale(S, S);
  const cx = m.w / 2;
  const by = m.by;
  const { hw, h } = m;
  const c = def.color;

  // Body fill: vertical gradient (light top -> base -> darker bottom)
  slimePath(ctx, cx, by, hw, h);
  const g = ctx.createLinearGradient(0, by - h, 0, by);
  g.addColorStop(0, toCss(lighten(c, 0.38)));
  g.addColorStop(0.5, toCss(c));
  g.addColorStop(1, toCss(darken(c, 0.16)));
  ctx.fillStyle = g;
  ctx.fill();

  // Inner shading, clipped to the body
  ctx.save();
  slimePath(ctx, cx, by, hw, h);
  ctx.clip();
  ellipse(ctx, cx + hw * 0.1, by + h * 0.02, hw * 1.15, h * 0.3);
  ctx.fillStyle = toCss(darken(c, 0.28), 0.4);
  ctx.fill();
  ctx.fillStyle = radial(ctx, cx - hw * 0.35, by - h * 0.7, hw * 1.2, [
    [0, 'rgba(255,255,255,0.38)'],
    [1, 'rgba(255,255,255,0)'],
  ]);
  ctx.fillRect(0, 0, m.w, m.H);

  // Type flavour details
  if (type === 'split' || type === 'mini') {
    // jelly bubbles
    const rnd = seeded(7);
    for (let i = 0; i < 5; i++) {
      const bx = cx + (rnd() - 0.5) * hw * 1.2;
      const byy = by - h * (0.15 + rnd() * 0.3);
      ellipse(ctx, bx, byy, hw * (0.05 + rnd() * 0.06), hw * (0.05 + rnd() * 0.06));
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.fill();
    }
  } else if (type === 'heavy') {
    // darker belly band for a "dense" look
    ellipse(ctx, cx, by - h * 0.12, hw * 0.75, h * 0.16);
    ctx.fillStyle = toCss(lighten(c, 0.25), 0.35);
    ctx.fill();
  } else if (type === 'speed') {
    // little sporty stripes
    ctx.strokeStyle = toCss(lighten(c, 0.55), 0.7);
    ctx.lineWidth = hw * 0.08;
    for (let i = 0; i < 2; i++) {
      ctx.beginPath();
      ctx.moveTo(cx + hw * (0.55 + i * 0.16), by - h * 0.18);
      ctx.lineTo(cx + hw * (0.72 + i * 0.16), by - h * 0.42);
      ctx.stroke();
    }
  } else if (type === 'boss') {
    // royal sparkles
    const rnd = seeded(3);
    for (let i = 0; i < 6; i++) {
      drawStarPath(ctx, cx + (rnd() - 0.5) * hw * 1.4, by - h * (0.12 + rnd() * 0.3), hw * 0.05, 4);
      ctx.fillStyle = 'rgba(255,240,255,0.6)';
      ctx.fill();
    }
  }
  ctx.restore();

  // Outline
  slimePath(ctx, cx, by, hw, h);
  ctx.lineWidth = Math.max(2.2, def.radius * 0.085);
  ctx.strokeStyle = toCss(mixHex(c, NAVY, 0.62));
  ctx.stroke();

  // Glossy highlights
  ellipse(ctx, cx - hw * 0.44, by - h * 0.7, hw * 0.22, h * 0.1, -0.6);
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.fill();
  ellipse(ctx, cx - hw * 0.14, by - h * 0.84, hw * 0.07, hw * 0.07);
  ctx.fill();
  // rim light on the right
  ctx.beginPath();
  ctx.arc(cx, by - h * 0.45, hw * 0.82, -0.25, 0.45);
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = hw * 0.06;
  ctx.stroke();

  return canvas;
}

function drawSlimeFace(type, def, mode) {
  const S = TEX_SCALE;
  const m = slimeMetrics(def.radius);
  const { canvas, ctx } = makeCanvas(m.w * S, m.H * S);
  ctx.scale(S, S);
  const cx = m.w / 2;
  const by = m.by;
  const { hw, h } = m;
  const lw = Math.max(1.6, hw * 0.075);
  const eyeY = by - h * 0.5;
  let dx = hw * 0.36;
  let ex = hw * 0.165;
  let ey = hw * 0.215;
  if (type === 'boss') {
    ex *= 1.05;
    ey *= 1.05;
  }
  if (type === 'speed') dx = hw * 0.34;

  ctx.strokeStyle = INK;
  ctx.fillStyle = INK;
  ctx.lineWidth = lw;

  // Blush
  for (const s of [-1, 1]) {
    ellipse(ctx, cx + s * hw * 0.62, by - h * 0.33, hw * 0.14, hw * 0.075);
    ctx.fillStyle = 'rgba(255,105,150,0.5)';
    ctx.fill();
  }
  ctx.fillStyle = INK;

  // ---- eyes
  for (const s of [-1, 1]) {
    const x = cx + s * dx;
    if (mode === 'blink') {
      ctx.beginPath();
      ctx.arc(x, eyeY - ey * 0.15, ex * 1.05, 0.15 * Math.PI, 0.85 * Math.PI);
      ctx.stroke();
    } else if (mode === 'hurt') {
      // > <
      ctx.beginPath();
      ctx.moveTo(x - s * ex, eyeY - ey * 0.75);
      ctx.lineTo(x + s * ex * 0.8, eyeY);
      ctx.lineTo(x - s * ex, eyeY + ey * 0.75);
      ctx.stroke();
    } else {
      const heavy = type === 'heavy';
      const eyH = heavy ? ey * 0.85 : ey;
      ellipse(ctx, x, eyeY, ex, eyH);
      ctx.fillStyle = INK;
      ctx.fill();
      if (heavy) {
        // sleepy lids
        ctx.save();
        ellipse(ctx, x, eyeY, ex * 1.2, eyH * 1.2);
        ctx.clip();
        ctx.fillStyle = toCss(def.color);
        ctx.fillRect(x - ex * 1.3, eyeY - eyH * 1.3, ex * 2.6, eyH * 0.95);
        ctx.restore();
        ctx.beginPath();
        ctx.moveTo(x - ex * 1.15, eyeY - eyH * 0.32);
        ctx.lineTo(x + ex * 1.15, eyeY - eyH * 0.32);
        ctx.stroke();
      }
      // sparkles
      ctx.fillStyle = '#fff';
      ellipse(ctx, x + ex * 0.32, eyeY - eyH * (heavy ? 0.05 : 0.38), ex * 0.36, ex * 0.36);
      ctx.fill();
      ellipse(ctx, x - ex * 0.38, eyeY + eyH * 0.4, ex * 0.15, ex * 0.15);
      ctx.fill();
      ctx.fillStyle = INK;
    }
    // brows
    if (type === 'boss' || type === 'speed') {
      const bY = eyeY - ey * 1.55;
      const tilt = type === 'boss' ? ey * 0.45 : ey * 0.3;
      ctx.beginPath();
      ctx.moveTo(x - s * ex * 1.1, bY - tilt);
      ctx.lineTo(x + s * ex * 0.9, bY + tilt * 0.6);
      ctx.lineWidth = lw * (type === 'boss' ? 1.4 : 1);
      ctx.stroke();
      ctx.lineWidth = lw;
    }
  }

  // ---- mouth
  const mY = by - h * 0.31;
  const mw = hw * 0.17;
  ctx.lineWidth = lw;
  if (mode === 'hurt') {
    ellipse(ctx, cx, mY + mw * 0.2, mw * 0.55, mw * 0.65);
    ctx.fillStyle = INK;
    ctx.fill();
  } else if (type === 'split' || type === 'mini') {
    // :3
    ctx.beginPath();
    ctx.arc(cx - mw * 0.5, mY, mw * 0.5, 0.1 * Math.PI, 0.95 * Math.PI);
    ctx.arc(cx + mw * 0.5, mY, mw * 0.5, 0.05 * Math.PI, 0.9 * Math.PI);
    ctx.stroke();
  } else if (type === 'heavy') {
    ctx.beginPath();
    ctx.moveTo(cx - mw * 0.6, mY + mw * 0.1);
    ctx.quadraticCurveTo(cx, mY + mw * 0.5, cx + mw * 0.6, mY + mw * 0.1);
    ctx.stroke();
  } else if (type === 'boss') {
    // smug smile with a tiny fang
    ctx.beginPath();
    ctx.moveTo(cx - mw * 1.1, mY - mw * 0.1);
    ctx.quadraticCurveTo(cx, mY + mw * 1.2, cx + mw * 1.1, mY - mw * 0.3);
    ctx.closePath();
    ctx.fillStyle = INK;
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(cx + mw * 0.2, mY + mw * 0.12);
    ctx.lineTo(cx + mw * 0.55, mY + mw * 0.05);
    ctx.lineTo(cx + mw * 0.38, mY + mw * 0.5);
    ctx.closePath();
    ctx.fillStyle = '#fff';
    ctx.fill();
  } else {
    // open happy mouth with tongue (bigger grin for speed slimes)
    const big = type === 'speed' ? 1.3 : 1;
    ctx.beginPath();
    ctx.moveTo(cx - mw * big, mY - mw * 0.1);
    ctx.quadraticCurveTo(cx, mY + mw * 1.5 * big, cx + mw * big, mY - mw * 0.1);
    ctx.closePath();
    ctx.fillStyle = INK;
    ctx.fill();
    ctx.save();
    ctx.clip();
    ellipse(ctx, cx, mY + mw * 0.9 * big, mw * 0.6 * big, mw * 0.45 * big);
    ctx.fillStyle = '#ff7a9c';
    ctx.fill();
    ctx.restore();
  }
  return canvas;
}

function drawStarPath(ctx, x, y, r, points = 5, inner = 0.45) {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const a = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2;
    const rr = i % 2 === 0 ? r : r * inner;
    const px = x + Math.cos(a) * rr;
    const py = y + Math.sin(a) * rr;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

function drawCrown(radius) {
  const S = TEX_SCALE;
  const w = radius * 1.05;
  const h = radius * 0.66;
  const pad = 6;
  const { canvas, ctx } = makeCanvas((w + pad * 2) * S, (h + pad * 2) * S);
  ctx.scale(S, S);
  const x0 = pad;
  const y0 = pad;
  const base = y0 + h;
  ctx.beginPath();
  ctx.moveTo(x0 + w * 0.06, base);
  ctx.lineTo(x0, y0 + h * 0.28);
  ctx.lineTo(x0 + w * 0.27, y0 + h * 0.55);
  ctx.lineTo(x0 + w * 0.5, y0 + h * 0.08);
  ctx.lineTo(x0 + w * 0.73, y0 + h * 0.55);
  ctx.lineTo(x0 + w, y0 + h * 0.28);
  ctx.lineTo(x0 + w * 0.94, base);
  ctx.quadraticCurveTo(x0 + w * 0.5, base + h * 0.12, x0 + w * 0.06, base);
  ctx.closePath();
  const g = ctx.createLinearGradient(0, y0, 0, base);
  g.addColorStop(0, '#fff6b0');
  g.addColorStop(0.45, '#ffd23f');
  g.addColorStop(1, '#e8960c');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#7a4300';
  ctx.stroke();
  // band
  ctx.beginPath();
  ctx.moveTo(x0 + w * 0.05, base - h * 0.22);
  ctx.quadraticCurveTo(x0 + w * 0.5, base - h * 0.1, x0 + w * 0.95, base - h * 0.22);
  ctx.strokeStyle = 'rgba(122,67,0,0.6)';
  ctx.lineWidth = 2;
  ctx.stroke();
  // jewels
  const jewel = (x, y, r, col) => {
    ellipse(ctx, x, y, r, r);
    ctx.fillStyle = col;
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = '#7a4300';
    ctx.stroke();
    ellipse(ctx, x - r * 0.3, y - r * 0.35, r * 0.3, r * 0.3);
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fill();
  };
  jewel(x0 + w * 0.5, base - h * 0.32, h * 0.12, '#ff4f8b');
  jewel(x0 + w * 0.23, base - h * 0.3, h * 0.08, '#4fc3ff');
  jewel(x0 + w * 0.77, base - h * 0.3, h * 0.08, '#4fc3ff');
  // tips
  for (const tx of [0, 0.5, 1]) {
    const ty = tx === 0.5 ? y0 + h * 0.08 : y0 + h * 0.28;
    ellipse(ctx, x0 + w * tx, ty, h * 0.08, h * 0.08);
    ctx.fillStyle = '#fff3a0';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#7a4300';
    ctx.stroke();
  }
  // shine
  ctx.beginPath();
  ctx.moveTo(x0 + w * 0.12, y0 + h * 0.42);
  ctx.lineTo(x0 + w * 0.2, base - h * 0.3);
  ctx.strokeStyle = 'rgba(255,255,255,0.7)';
  ctx.lineWidth = 2.5;
  ctx.stroke();
  return canvas;
}

// =====================================================================
// FX TEXTURES (white so they can be tinted at runtime)
// =====================================================================
function drawSoft(size = 64) {
  const { canvas, ctx } = makeCanvas(size, size);
  ctx.fillStyle = radial(ctx, size / 2, size / 2, size / 2, [
    [0, 'rgba(255,255,255,1)'],
    [0.35, 'rgba(255,255,255,0.55)'],
    [1, 'rgba(255,255,255,0)'],
  ]);
  ctx.fillRect(0, 0, size, size);
  return canvas;
}
function drawDot(size = 32) {
  const { canvas, ctx } = makeCanvas(size, size);
  ellipse(ctx, size / 2, size / 2, size / 2 - 1, size / 2 - 1);
  ctx.fillStyle = '#fff';
  ctx.fill();
  return canvas;
}
function drawGoo(size = 36) {
  const { canvas, ctx } = makeCanvas(size, size);
  const r = size / 2 - 2;
  ellipse(ctx, size / 2, size / 2, r, r);
  ctx.fillStyle = radial(ctx, size * 0.4, size * 0.38, r * 1.3, [
    [0, '#ffffff'],
    [0.6, '#f0f0f0'],
    [1, '#a8a8b8'],
  ]);
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(40,40,80,0.45)';
  ctx.stroke();
  ellipse(ctx, size * 0.36, size * 0.33, r * 0.3, r * 0.22, -0.6);
  ctx.fillStyle = '#fff';
  ctx.fill();
  return canvas;
}
function drawRing(size = 128) {
  const { canvas, ctx } = makeCanvas(size, size);
  const r = size / 2 - 8;
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, r, 0, Math.PI * 2);
    ctx.lineWidth = 3 + i * 4;
    ctx.strokeStyle = `rgba(255,255,255,${[1, 0.4, 0.18, 0.08][i]})`;
    ctx.stroke();
  }
  return canvas;
}
function drawSpark(size = 48) {
  const { canvas, ctx } = makeCanvas(size, size);
  const c = size / 2;
  ctx.fillStyle = radial(ctx, c, c, c, [
    [0, 'rgba(255,255,255,0.8)'],
    [1, 'rgba(255,255,255,0)'],
  ]);
  ctx.fillRect(0, 0, size, size);
  ctx.beginPath();
  ctx.moveTo(c, 2);
  ctx.quadraticCurveTo(c + 3, c - 3, size - 2, c);
  ctx.quadraticCurveTo(c + 3, c + 3, c, size - 2);
  ctx.quadraticCurveTo(c - 3, c + 3, 2, c);
  ctx.quadraticCurveTo(c - 3, c - 3, c, 2);
  ctx.fillStyle = '#fff';
  ctx.fill();
  return canvas;
}
function drawStar(size = 40) {
  const { canvas, ctx } = makeCanvas(size, size);
  drawStarPath(ctx, size / 2, size / 2 + 1, size / 2 - 3, 5, 0.48);
  ctx.fillStyle = '#fff';
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(80,60,0,0.35)';
  ctx.stroke();
  return canvas;
}
function drawSnow(size = 48) {
  const { canvas, ctx } = makeCanvas(size, size);
  const c = size / 2;
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 3.5;
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const ex = c + Math.cos(a) * (c - 4);
    const ey = c + Math.sin(a) * (c - 4);
    ctx.beginPath();
    ctx.moveTo(c, c);
    ctx.lineTo(ex, ey);
    ctx.stroke();
    const mx = c + Math.cos(a) * (c * 0.55);
    const my = c + Math.sin(a) * (c * 0.55);
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(mx, my);
      ctx.lineTo(mx + Math.cos(a + s * 0.8) * 7, my + Math.sin(a + s * 0.8) * 7);
      ctx.stroke();
    }
  }
  return canvas;
}
function drawPlus(size = 40) {
  const { canvas, ctx } = makeCanvas(size, size);
  const t = size * 0.3;
  ctx.fillStyle = '#fff';
  ctx.strokeStyle = 'rgba(20,80,50,0.5)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect((size - t) / 2, 3, t, size - 6, t / 2);
  ctx.roundRect(3, (size - t) / 2, size - 6, t, t / 2);
  ctx.fill();
  return canvas;
}
function drawShadow() {
  const { canvas, ctx } = makeCanvas(128, 64);
  ctx.save();
  ctx.scale(1, 0.5);
  ctx.fillStyle = radial(ctx, 64, 64, 62, [
    [0, 'rgba(20,40,20,0.55)'],
    [0.6, 'rgba(20,40,20,0.35)'],
    [1, 'rgba(20,40,20,0)'],
  ]);
  ctx.fillRect(0, 0, 128, 128);
  ctx.restore();
  return canvas;
}
function drawDust(size = 64) {
  const { canvas, ctx } = makeCanvas(size, size);
  const blobs = [
    [0.5, 0.55, 0.3],
    [0.32, 0.6, 0.22],
    [0.68, 0.6, 0.22],
    [0.45, 0.38, 0.2],
  ];
  for (const [x, y, r] of blobs) {
    ellipse(ctx, x * size, y * size, r * size, r * size);
    ctx.fillStyle = radial(ctx, x * size, y * size, r * size, [
      [0, 'rgba(255,255,245,0.95)'],
      [1, 'rgba(255,255,245,0.25)'],
    ]);
    ctx.fill();
  }
  return canvas;
}
function drawProjectile(size = 64) {
  const { canvas, ctx } = makeCanvas(size, size);
  const c = size / 2;
  ctx.fillStyle = radial(ctx, c, c, c, [
    [0, 'rgba(255,255,255,1)'],
    [0.25, 'rgba(255,255,255,0.9)'],
    [0.5, 'rgba(255,255,255,0.35)'],
    [1, 'rgba(255,255,255,0)'],
  ]);
  ctx.fillRect(0, 0, size, size);
  return canvas;
}
function drawBar() {
  const { canvas, ctx } = makeCanvas(8, 8);
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, 8, 8);
  return canvas;
}
function drawConfetti() {
  const { canvas, ctx } = makeCanvas(16, 10);
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.roundRect(1, 1, 14, 8, 3);
  ctx.fill();
  return canvas;
}
function drawExclaim() {
  const S = TEX_SCALE;
  const { canvas, ctx } = makeCanvas(36 * S, 44 * S);
  ctx.scale(S, S);
  ctx.beginPath();
  ctx.roundRect(3, 3, 30, 32, 12);
  ctx.moveTo(14, 34);
  ctx.lineTo(18, 42);
  ctx.lineTo(22, 34);
  ctx.fillStyle = '#fff';
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#1b2350';
  ctx.stroke();
  ctx.fillStyle = '#ff4f8b';
  ctx.beginPath();
  ctx.roundRect(15, 8, 6, 15, 3);
  ctx.fill();
  ellipse(ctx, 18, 28.5, 3.2, 3.2);
  ctx.fill();
  return canvas;
}

// =====================================================================
// TOWER
// =====================================================================
// Tower base texture size (world units) and anchor (ground centre).
export const TOWER_ART = { w: 150, h: 170, footX: 75, footY: 142 };

function drawTowerBase(gold) {
  const S = TEX_SCALE;
  const { w, h, footX: cx, footY } = TOWER_ART;
  const { canvas, ctx } = makeCanvas(w * S, h * S);
  ctx.scale(S, S);
  const outline = '#34336a';
  const stoneL = '#e2def5';
  const stoneM = '#b3aed6';
  const stoneD = '#7f7aae';
  ctx.lineWidth = 3;
  ctx.strokeStyle = outline;

  // --- plinth
  const pR = 64;
  const pRy = 22;
  ctx.beginPath();
  ctx.ellipse(cx, footY + 8, pR, pRy, 0, 0, Math.PI);
  ctx.lineTo(cx - pR, footY);
  ctx.ellipse(cx, footY, pR, pRy, 0, Math.PI, 0, false);
  ctx.closePath();
  ctx.fillStyle = stoneD;
  ctx.fill();
  ctx.stroke();
  ellipse(ctx, cx, footY, pR, pRy);
  ctx.fillStyle = stoneM;
  ctx.fill();
  ctx.stroke();
  ellipse(ctx, cx, footY - 2, pR - 8, pRy - 6);
  ctx.fillStyle = stoneL;
  ctx.fill();
  if (gold) {
    ctx.beginPath();
    ctx.ellipse(cx, footY + 4, pR - 1, pRy - 1, 0, 0.1, Math.PI - 0.1);
    ctx.strokeStyle = '#ffd23f';
    ctx.lineWidth = 3.5;
    ctx.stroke();
    ctx.strokeStyle = outline;
    ctx.lineWidth = 3;
  }

  // --- body (slightly tapered cylinder)
  const topY = 58;
  const botY = footY - 4;
  const bw = 44; // half width at bottom
  const tw = 36; // half width at top
  const bodyPath = () => {
    ctx.beginPath();
    ctx.moveTo(cx - tw, topY);
    ctx.lineTo(cx - bw, botY);
    ctx.ellipse(cx, botY, bw, 13, 0, Math.PI, 0, true);
    ctx.lineTo(cx + tw, topY);
    ctx.closePath();
  };
  bodyPath();
  const bg = ctx.createLinearGradient(cx - bw, 0, cx + bw, 0);
  bg.addColorStop(0, stoneL);
  bg.addColorStop(0.45, stoneM);
  bg.addColorStop(1, stoneD);
  ctx.fillStyle = bg;
  ctx.fill();

  // bricks
  ctx.save();
  bodyPath();
  ctx.clip();
  ctx.strokeStyle = 'rgba(52,51,106,0.35)';
  ctx.lineWidth = 2;
  const rows = 6;
  for (let r = 0; r <= rows; r++) {
    const y = topY + 6 + r * ((botY - topY) / rows);
    const hw = tw + (bw - tw) * ((y - topY) / (botY - topY));
    ctx.beginPath();
    ctx.ellipse(cx, y, hw, 9, 0, 0, Math.PI);
    ctx.stroke();
    const n = 4;
    for (let k = 0; k < n; k++) {
      const t = (k + (r % 2 ? 0.5 : 0)) / n;
      const ang = Math.PI * (0.12 + 0.76 * t);
      const x = cx - Math.cos(ang) * hw;
      const yy = y + Math.sin(ang) * 9;
      ctx.beginPath();
      ctx.moveTo(x, yy);
      ctx.lineTo(x, yy + (botY - topY) / rows - 1);
      ctx.stroke();
    }
  }
  // glowing rune band
  ctx.strokeStyle = 'rgba(95,227,255,0.85)';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.ellipse(cx, topY + 18, tw + 2, 10, 0, 0.15 * Math.PI, 0.85 * Math.PI);
  ctx.stroke();
  for (let k = 0; k < 5; k++) {
    const ang = Math.PI * (0.22 + 0.14 * k);
    const x = cx - Math.cos(ang) * (tw + 2);
    const y = topY + 18 + Math.sin(ang) * 10;
    ellipse(ctx, x, y, 2.4, 2.4);
    ctx.fillStyle = '#bff6ff';
    ctx.fill();
  }
  ctx.restore();
  bodyPath();
  ctx.strokeStyle = outline;
  ctx.lineWidth = 3;
  ctx.stroke();

  // --- door
  const dW = 13;
  const dTop = botY - 30;
  ctx.beginPath();
  ctx.moveTo(cx - dW, botY + 11);
  ctx.lineTo(cx - dW, dTop + dW);
  ctx.arc(cx, dTop + dW, dW, Math.PI, 0);
  ctx.lineTo(cx + dW, botY + 11);
  ctx.quadraticCurveTo(cx, botY + 14, cx - dW, botY + 11);
  ctx.closePath();
  ctx.fillStyle = '#8a5a3b';
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = 'rgba(52,30,20,0.5)';
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(cx - 4, dTop + 4);
  ctx.lineTo(cx - 4, botY + 11);
  ctx.moveTo(cx + 4, dTop + 4);
  ctx.lineTo(cx + 4, botY + 11);
  ctx.stroke();
  ellipse(ctx, cx + 7, botY - 6, 2, 2);
  ctx.fillStyle = '#ffd23f';
  ctx.fill();

  // --- window
  const wy = topY + 30;
  ctx.beginPath();
  ctx.moveTo(cx - 6, wy + 12);
  ctx.lineTo(cx - 6, wy + 4);
  ctx.arc(cx, wy + 4, 6, Math.PI, 0);
  ctx.lineTo(cx + 6, wy + 12);
  ctx.closePath();
  ctx.fillStyle = '#9ff3ff';
  ctx.fill();
  ctx.strokeStyle = outline;
  ctx.lineWidth = 2.5;
  ctx.stroke();
  ctx.fillStyle = radial(ctx, cx, wy + 7, 18, [
    [0, 'rgba(160,245,255,0.5)'],
    [1, 'rgba(160,245,255,0)'],
  ]);
  ctx.fillRect(cx - 20, wy - 12, 40, 40);

  // --- top rim with battlements
  const rimY = topY;
  ctx.strokeStyle = outline;
  ctx.lineWidth = 3;
  // rim side band
  ctx.beginPath();
  ctx.ellipse(cx, rimY + 6, tw + 8, 13, 0, 0, Math.PI);
  ctx.lineTo(cx - tw - 8, rimY - 2);
  ctx.ellipse(cx, rimY - 2, tw + 8, 13, 0, Math.PI, 0, false);
  ctx.closePath();
  ctx.fillStyle = stoneM;
  ctx.fill();
  ctx.stroke();
  // rim top
  ellipse(ctx, cx, rimY - 2, tw + 8, 13);
  ctx.fillStyle = stoneL;
  ctx.fill();
  ctx.stroke();
  // inner pit glowing
  ellipse(ctx, cx, rimY - 3, tw - 4, 8);
  ctx.fillStyle = radial(ctx, cx, rimY - 3, tw, [
    [0, '#c9fbff'],
    [0.5, '#5fe3ff'],
    [1, '#2a6fd0'],
  ]);
  ctx.fill();
  ctx.lineWidth = 2.5;
  ctx.stroke();
  // battlements on the front half
  for (let k = 0; k < 5; k++) {
    const ang = Math.PI * (0.1 + 0.2 * k);
    const x = cx - Math.cos(ang) * (tw + 6);
    const y = rimY - 2 + Math.sin(ang) * 12;
    ctx.beginPath();
    ctx.roundRect(x - 6, y - 12, 12, 13, 4);
    ctx.fillStyle = k === 0 ? stoneL : k === 4 ? stoneD : stoneM;
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = outline;
    ctx.stroke();
    if (gold) {
      ellipse(ctx, x, y - 12, 3, 3);
      ctx.fillStyle = '#ffd23f';
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }
  if (gold) {
    ctx.beginPath();
    ctx.ellipse(cx, rimY + 6, tw + 8, 13, 0, 0.08, Math.PI - 0.08);
    ctx.strokeStyle = '#ffd23f';
    ctx.lineWidth = 3.5;
    ctx.stroke();
    // gold emblem above the door
    drawStarPath(ctx, cx, dTop - 9, 7, 4);
    ctx.fillStyle = '#ffd23f';
    ctx.fill();
    ctx.strokeStyle = '#7a4300';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
  return canvas;
}

export const CRYSTAL_ART = { w: 58, h: 96 };

function drawCrystal() {
  const S = TEX_SCALE;
  const { w, h } = CRYSTAL_ART;
  const { canvas, ctx } = makeCanvas(w * S, h * S);
  ctx.scale(S, S);
  const top = [w / 2, 3];
  const L = [4, h * 0.36];
  const R = [w - 4, h * 0.36];
  const bot = [w / 2, h - 3];
  const C = [w / 2 + 2, h * 0.42];
  const face = (pts, col) => {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
    ctx.fillStyle = col;
    ctx.fill();
  };
  face([top, L, C], '#c8fbff');
  face([top, R, C], '#6fdcff');
  face([L, bot, C], '#45b8f0');
  face([R, bot, C], '#2a7fd8');
  // outline
  ctx.beginPath();
  ctx.moveTo(...top);
  ctx.lineTo(...R);
  ctx.lineTo(...bot);
  ctx.lineTo(...L);
  ctx.closePath();
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#1d3f8a';
  ctx.stroke();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = 'rgba(255,255,255,0.6)';
  ctx.beginPath();
  ctx.moveTo(...L);
  ctx.lineTo(...C);
  ctx.lineTo(...R);
  ctx.moveTo(...top);
  ctx.lineTo(...C);
  ctx.lineTo(...bot);
  ctx.stroke();
  // highlight streak
  ctx.beginPath();
  ctx.moveTo(w * 0.36, h * 0.14);
  ctx.lineTo(w * 0.22, h * 0.34);
  ctx.lineWidth = 3.5;
  ctx.strokeStyle = 'rgba(255,255,255,0.95)';
  ctx.stroke();
  ellipse(ctx, w * 0.32, h * 0.5, 2.2, 2.2);
  ctx.fillStyle = '#fff';
  ctx.fill();
  return canvas;
}

function drawShard() {
  const S = TEX_SCALE;
  const w = 16;
  const h = 28;
  const { canvas, ctx } = makeCanvas(w * S, h * S);
  ctx.scale(S, S);
  ctx.beginPath();
  ctx.moveTo(w / 2, 1.5);
  ctx.lineTo(w - 1.5, h * 0.4);
  ctx.lineTo(w / 2, h - 1.5);
  ctx.lineTo(1.5, h * 0.4);
  ctx.closePath();
  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(0.5, '#9ff0ff');
  g.addColorStop(1, '#3a9be8');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.lineWidth = 1.8;
  ctx.strokeStyle = '#1d3f8a';
  ctx.stroke();
  return canvas;
}

function drawRuneRing(size = 320) {
  const { canvas, ctx } = makeCanvas(size, size);
  const c = size / 2;
  ctx.strokeStyle = '#fff';
  ctx.fillStyle = '#fff';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(c, c, c - 6, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(c, c, c - 30, 0, Math.PI * 2);
  ctx.stroke();
  const n = 12;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const r = c - 18;
    const x = c + Math.cos(a) * r;
    const y = c + Math.sin(a) * r;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(a + Math.PI / 2);
    ctx.beginPath();
    switch (i % 4) {
      case 0:
        ctx.moveTo(-5, 4);
        ctx.lineTo(0, -6);
        ctx.lineTo(5, 4);
        ctx.stroke();
        break;
      case 1:
        ellipse(ctx, 0, 0, 3.5, 3.5);
        ctx.fill();
        break;
      case 2:
        ctx.moveTo(-5, -4);
        ctx.lineTo(5, 4);
        ctx.moveTo(5, -4);
        ctx.lineTo(-5, 4);
        ctx.stroke();
        break;
      default:
        ctx.moveTo(0, -6);
        ctx.lineTo(0, 6);
        ctx.moveTo(-4, -1);
        ctx.lineTo(4, -1);
        ctx.stroke();
    }
    ctx.restore();
  }
  return canvas;
}

function drawCrack() {
  const S = TEX_SCALE;
  const { w, h } = CRYSTAL_ART;
  const { canvas, ctx } = makeCanvas(w * S, h * S);
  ctx.scale(S, S);
  ctx.strokeStyle = '#1d2050';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(w * 0.5, h * 0.1);
  ctx.lineTo(w * 0.42, h * 0.3);
  ctx.lineTo(w * 0.56, h * 0.42);
  ctx.lineTo(w * 0.44, h * 0.6);
  ctx.lineTo(w * 0.52, h * 0.85);
  ctx.moveTo(w * 0.56, h * 0.42);
  ctx.lineTo(w * 0.78, h * 0.38);
  ctx.moveTo(w * 0.44, h * 0.6);
  ctx.lineTo(w * 0.24, h * 0.52);
  ctx.moveTo(w * 0.42, h * 0.3);
  ctx.lineTo(w * 0.26, h * 0.3);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.8)';
  ctx.lineWidth = 1;
  ctx.stroke();
  return canvas;
}

// =====================================================================
// ARENA
// =====================================================================
function drawGrassTile() {
  const size = 512;
  const { canvas, ctx } = makeCanvas(size, size);
  ctx.fillStyle = '#8fd16a';
  ctx.fillRect(0, 0, size, size);
  const rnd = seeded(42);
  // soft colour blotches (wrapped so the tile is seamless)
  const blot = (x, y, r, col) => {
    for (const ox of [-size, 0, size]) {
      for (const oy of [-size, 0, size]) {
        ellipse(ctx, x + ox, y + oy, r, r * 0.8);
        ctx.fillStyle = col;
        ctx.fill();
      }
    }
  };
  for (let i = 0; i < 26; i++) {
    blot(rnd() * size, rnd() * size, 30 + rnd() * 70, rnd() < 0.5 ? 'rgba(168,224,131,0.35)' : 'rgba(111,181,82,0.22)');
  }
  // grass tufts
  ctx.lineWidth = 3;
  for (let i = 0; i < 70; i++) {
    const x = rnd() * size;
    const y = rnd() * size;
    ctx.strokeStyle = rnd() < 0.5 ? 'rgba(98,168,70,0.55)' : 'rgba(184,234,140,0.6)';
    ctx.beginPath();
    ctx.moveTo(x - 5, y - 9);
    ctx.lineTo(x - 1, y);
    ctx.lineTo(x + 1, y - 12);
    ctx.lineTo(x + 3, y);
    ctx.lineTo(x + 8, y - 8);
    ctx.stroke();
  }
  return canvas;
}

export const ARENA_DISC = { radius: 600, scale: 0.5 };

function drawArenaDisc(arenaRadius) {
  const { radius, scale } = ARENA_DISC;
  const size = radius * 2 * scale;
  const { canvas, ctx } = makeCanvas(size, size);
  const c = size / 2;
  const a = (arenaRadius * scale) / (radius * scale); // arena edge as fraction
  // light inner meadow with a darker hedge-like ring at the arena edge
  ctx.fillStyle = radial(ctx, c, c, c, [
    [0, 'rgba(176,230,138,0.95)'],
    [a * 0.75, 'rgba(166,224,128,0.7)'],
    [a * 0.97, 'rgba(160,220,120,0.35)'],
    [a * 1.0, 'rgba(96,170,70,0.55)'],
    [a * 1.07, 'rgba(96,170,70,0.38)'],
    [1, 'rgba(96,170,70,0)'],
  ]);
  ctx.fillRect(0, 0, size, size);
  // dotted boundary
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  const n = 90;
  for (let i = 0; i < n; i++) {
    const ang = (i / n) * Math.PI * 2;
    ellipse(ctx, c + Math.cos(ang) * c * a, c + Math.sin(ang) * c * a, 2.2, 2.2);
    ctx.fill();
  }
  return canvas;
}

export const PLAZA = { radius: 180 };

function drawPlaza() {
  const S = TEX_SCALE;
  const R = PLAZA.radius;
  const size = R * 2;
  const { canvas, ctx } = makeCanvas(size * S, size * S);
  ctx.scale(S, S);
  const c = R;
  const rnd = seeded(11);
  const stone = (x, y, rx, ry, rot, base) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.beginPath();
    ctx.roundRect(-rx, -ry, rx * 2, ry * 2, Math.min(rx, ry) * 0.7);
    ctx.fillStyle = base;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(120,104,84,0.75)';
    ctx.stroke();
    ctx.beginPath();
    ctx.roundRect(-rx + 2.5, -ry + 2, rx * 2 - 5, ry * 0.8, Math.min(rx, ry) * 0.5);
    ctx.fillStyle = 'rgba(255,255,255,0.28)';
    ctx.fill();
    ctx.restore();
  };
  // soft dirt ring under the path
  ctx.beginPath();
  ctx.arc(c, c, 160, 0, Math.PI * 2);
  ctx.arc(c, c, 118, 0, Math.PI * 2, true);
  ctx.fillStyle = 'rgba(150,190,100,0.45)';
  ctx.fill();
  // circular path of flagstones
  const ringR = 140;
  const count = 24;
  for (let i = 0; i < count; i++) {
    const ang = (i / count) * Math.PI * 2 + rnd() * 0.05;
    const tone = rnd();
    const col = tone < 0.33 ? '#e6dccb' : tone < 0.66 ? '#dcd1bd' : '#efe6d6';
    stone(c + Math.cos(ang) * ringR, c + Math.sin(ang) * ringR, 17 + rnd() * 3, 11 + rnd() * 2, ang + Math.PI / 2, col);
  }
  // stepping stones joining plaza and ring
  for (let k = 0; k < 4; k++) {
    const ang = Math.PI / 4 + (k * Math.PI) / 2;
    for (const d of [84, 108]) {
      stone(c + Math.cos(ang) * d, c + Math.sin(ang) * d, 9 + rnd() * 2, 7 + rnd() * 2, ang, '#e3d8c4');
    }
  }
  // central plaza disc
  ellipse(ctx, c, c, 70, 70);
  ctx.fillStyle = '#d9cfbd';
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(120,104,84,0.8)';
  ctx.stroke();
  for (let ring = 0; ring < 2; ring++) {
    const r0 = ring === 0 ? 30 : 52;
    const n = ring === 0 ? 8 : 14;
    for (let i = 0; i < n; i++) {
      const ang = (i / n) * Math.PI * 2 + ring * 0.2;
      ctx.beginPath();
      ctx.moveTo(c + Math.cos(ang) * (r0 - 18), c + Math.sin(ang) * (r0 - 18));
      ctx.lineTo(c + Math.cos(ang) * (r0 + 4), c + Math.sin(ang) * (r0 + 4));
      ctx.strokeStyle = 'rgba(120,104,84,0.35)';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    ellipse(ctx, c, c, r0 + 4, r0 + 4);
    ctx.stroke();
  }
  return canvas;
}

function drawFlower(petalCol, centerCol) {
  const S = TEX_SCALE;
  const size = 18;
  const { canvas, ctx } = makeCanvas(size * S, size * S);
  ctx.scale(S, S);
  const c = size / 2;
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    ellipse(ctx, c + Math.cos(a) * 4.2, c + Math.sin(a) * 4.2, 3.6, 3.6);
    ctx.fillStyle = petalCol;
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(60,40,80,0.35)';
    ctx.stroke();
  }
  ellipse(ctx, c, c, 2.6, 2.6);
  ctx.fillStyle = centerCol;
  ctx.fill();
  return canvas;
}

function drawTuft() {
  const S = TEX_SCALE;
  const { canvas, ctx } = makeCanvas(22 * S, 16 * S);
  ctx.scale(S, S);
  ctx.strokeStyle = '#5aa543';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(4, 6);
  ctx.quadraticCurveTo(8, 10, 9, 15);
  ctx.moveTo(11, 2);
  ctx.lineTo(11, 15);
  ctx.moveTo(18, 6);
  ctx.quadraticCurveTo(14, 10, 13, 15);
  ctx.stroke();
  return canvas;
}

function drawRock(w, h, seed) {
  const S = TEX_SCALE;
  const pad = 4;
  const { canvas, ctx } = makeCanvas((w + pad * 2) * S, (h + pad * 2) * S);
  ctx.scale(S, S);
  const rnd = seeded(seed);
  const cx = w / 2 + pad;
  const cy = h * 0.55 + pad;
  // ground shadow
  ellipse(ctx, cx, h + pad - 3, w * 0.5, h * 0.14);
  ctx.fillStyle = 'rgba(30,60,30,0.25)';
  ctx.fill();
  ctx.beginPath();
  const n = 9;
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    const rr = 0.85 + rnd() * 0.18;
    const x = cx + Math.cos(a) * (w / 2) * rr;
    const y = cy + Math.sin(a) * (h / 2) * rr * (Math.sin(a) > 0 ? 0.8 : 1);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  const g = ctx.createLinearGradient(0, pad, 0, h + pad);
  g.addColorStop(0, '#d3d1e6');
  g.addColorStop(1, '#8f8cb0');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = '#4a4878';
  ctx.stroke();
  ellipse(ctx, cx - w * 0.15, cy - h * 0.22, w * 0.18, h * 0.1, -0.3);
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.fill();
  return canvas;
}

function drawBush(w, seed, berries) {
  const S = TEX_SCALE;
  const h = w * 0.75;
  const pad = 4;
  const { canvas, ctx } = makeCanvas((w + pad * 2) * S, (h + pad * 2) * S);
  ctx.scale(S, S);
  const rnd = seeded(seed);
  ellipse(ctx, w / 2 + pad, h + pad - 4, w * 0.48, h * 0.12);
  ctx.fillStyle = 'rgba(30,60,30,0.3)';
  ctx.fill();
  const blobs = [
    [0.3, 0.62, 0.26],
    [0.7, 0.62, 0.26],
    [0.5, 0.42, 0.3],
    [0.22, 0.45, 0.18],
    [0.78, 0.45, 0.18],
  ];
  ctx.lineWidth = 2.5;
  for (const pass of [0, 1]) {
    for (const [bx, by, br] of blobs) {
      ellipse(ctx, pad + bx * w, pad + by * h, br * w, br * w * 0.9);
      if (pass === 0) {
        ctx.strokeStyle = '#2f6b2a';
        ctx.stroke();
      } else {
        ctx.fillStyle = radial(ctx, pad + (bx - 0.08) * w, pad + (by - 0.1) * h, br * w * 1.2, [
          [0, '#8fdc6a'],
          [1, '#4e9e3c'],
        ]);
        ctx.fill();
      }
    }
  }
  if (berries) {
    for (let i = 0; i < 6; i++) {
      const x = pad + (0.25 + rnd() * 0.5) * w;
      const y = pad + (0.3 + rnd() * 0.4) * h;
      ellipse(ctx, x, y, 2.8, 2.8);
      ctx.fillStyle = '#ff5c8a';
      ctx.fill();
      ellipse(ctx, x - 0.8, y - 0.9, 0.9, 0.9);
      ctx.fillStyle = '#fff';
      ctx.fill();
    }
  }
  return canvas;
}

function drawMushroom() {
  const S = TEX_SCALE;
  const { canvas, ctx } = makeCanvas(26 * S, 26 * S);
  ctx.scale(S, S);
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#4a2f3a';
  ctx.beginPath();
  ctx.roundRect(10, 12, 7, 11, 3);
  ctx.fillStyle = '#fff4e0';
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(2, 14);
  ctx.quadraticCurveTo(13, -4, 24, 14);
  ctx.closePath();
  ctx.fillStyle = '#ff5c6c';
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#fff';
  for (const [x, y, r] of [
    [9, 9, 2.2],
    [16, 7, 1.8],
    [19, 11, 1.5],
  ]) {
    ellipse(ctx, x, y, r, r);
    ctx.fill();
  }
  return canvas;
}

// =====================================================================
// DAMAGE FONT (RetroFont bitmap font for cheap floating numbers)
// =====================================================================
const FONT_CHARS = '0123456789+!';
const FONT_CELL = { w: 40, h: 54 };

function registerDamageFont(scene) {
  const { canvas, ctx } = makeCanvas(FONT_CELL.w * FONT_CHARS.length, FONT_CELL.h);
  ctx.font = '700 44px Fredoka, "Trebuchet MS", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 8;
  ctx.strokeStyle = '#1b2350';
  ctx.fillStyle = '#ffffff';
  for (let i = 0; i < FONT_CHARS.length; i++) {
    const x = i * FONT_CELL.w + FONT_CELL.w / 2;
    const y = FONT_CELL.h / 2 + 2;
    ctx.strokeText(FONT_CHARS[i], x, y);
    ctx.fillText(FONT_CHARS[i], x, y);
  }
  register(scene, 'dmgfont_img', canvas);
  const config = {
    image: 'dmgfont_img',
    width: FONT_CELL.w,
    height: FONT_CELL.h,
    chars: FONT_CHARS,
    charsPerRow: FONT_CHARS.length,
    spacing: { x: 0, y: 0 },
    offset: { x: 0, y: 0 },
    lineSpacing: 0,
  };
  scene.cache.bitmapFont.add('dmgfont', Phaser.GameObjects.RetroFont.Parse(scene, config));
}

// =====================================================================
export function generateTextures(scene, arenaRadius) {
  const add = (key, canvas) => register(scene, key, canvas);

  // FX
  add('soft', drawSoft());
  add('dot', drawDot());
  add('goo', drawGoo());
  add('ring', drawRing());
  add('spark', drawSpark());
  add('star', drawStar());
  add('snow', drawSnow());
  add('plus', drawPlus());
  add('shadow', drawShadow());
  add('dust', drawDust());
  add('proj', drawProjectile());
  add('bar', drawBar());
  add('confetti', drawConfetti());
  add('exclaim', drawExclaim());

  // Slimes
  for (const [type, def] of Object.entries(ENEMIES)) {
    add(`slime_${type}`, drawSlimeBody(type, def));
    add(`face_${type}`, drawSlimeFace(type, def, 'open'));
    add(`face_${type}_blink`, drawSlimeFace(type, def, 'blink'));
    add(`face_${type}_hurt`, drawSlimeFace(type, def, 'hurt'));
  }
  add('crown', drawCrown(ENEMIES.boss.radius));

  // Tower
  add('tower_base', drawTowerBase(false));
  add('tower_base_gold', drawTowerBase(true));
  add('crystal', drawCrystal());
  add('shard', drawShard());
  add('rune_ring', drawRuneRing());
  add('crack', drawCrack());

  // Arena
  add('grass_tile', drawGrassTile());
  add('arena_disc', drawArenaDisc(arenaRadius));
  add('plaza', drawPlaza());
  add('flower_0', drawFlower('#ff9ec7', '#ffd23f'));
  add('flower_1', drawFlower('#ffffff', '#ffc94a'));
  add('flower_2', drawFlower('#ffe36e', '#ff9f43'));
  add('flower_3', drawFlower('#c9a7ff', '#fff3a0'));
  add('tuft', drawTuft());
  add('rock_0', drawRock(34, 24, 1));
  add('rock_1', drawRock(48, 32, 2));
  add('rock_2', drawRock(24, 18, 3));
  add('bush_0', drawBush(64, 4, false));
  add('bush_1', drawBush(78, 5, true));
  add('mushroom', drawMushroom());

  registerDamageFont(scene);
}
