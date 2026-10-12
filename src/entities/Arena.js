import { ARENA_DISC, PLAZA } from '../art/textures.js';
import { WORLD, DEPTH, TEX_SCALE } from '../config/gameConfig.js';

const INV = 1 / TEX_SCALE;

// Deterministic random so the arena looks the same every run.
function mulberry(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), s | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Builds the static grassland arena: tiled grass, meadow disc, stone plaza
 * and decorations. Decorations sit mostly outside the battlefield edge so the
 * fight stays readable.
 */
export function buildArena(scene) {
  const objs = [];
  // Phaser allocates a canvas the size of a TileSprite, so keep it small and
  // scale the object up instead: 500 * 16 = 8000 world units of grass, with the
  // tile drawn at 0.5 world units per texel (16 * 1/32).
  const GRASS_SCALE = 16;
  const grass = scene.add.tileSprite(0, 0, 500, 500, 'grass_tile').setDepth(DEPTH.GROUND);
  grass.setScale(GRASS_SCALE).setTileScale(0.5 / GRASS_SCALE);
  objs.push(grass);
  const extent = 2600; // decoration bounds

  const disc = scene.add.image(0, 0, 'arena_disc').setDepth(DEPTH.GROUND + 1).setScale(1 / ARENA_DISC.scale);
  objs.push(disc);

  const plaza = scene.add.image(0, 0, 'plaza').setDepth(DEPTH.GROUND + 2).setScale(INV);
  objs.push(plaza);

  const rnd = mulberry(1234);
  const R = WORLD.ARENA_RADIUS;
  const swaying = [];

  const place = (key, minR, maxR, count, opts = {}) => {
    for (let i = 0; i < count; i++) {
      const a = rnd() * Math.PI * 2;
      const r = minR + rnd() * (maxR - minR);
      const x = Math.cos(a) * r;
      const y = Math.sin(a) * r;
      if (Math.abs(x) > extent / 2 - 40 || Math.abs(y) > extent / 2 - 40) continue;
      const k = typeof key === 'function' ? key() : key;
      const img = scene.add.image(x, y, k).setScale(INV * (opts.scale ? opts.scale[0] + rnd() * (opts.scale[1] - opts.scale[0]) : 1));
      img.setOrigin(0.5, opts.originY ?? 0.85);
      img.setDepth(opts.flat ? DEPTH.DECAL : DEPTH.ENTITY + y);
      if (opts.alpha) img.setAlpha(opts.alpha);
      if (rnd() < 0.5) img.setFlipX(true);
      if (opts.sway) swaying.push(img);
      objs.push(img);
    }
  };

  const flower = () => `flower_${Math.floor(rnd() * 4)}`;
  // Outer ring: bushes, rocks, mushrooms and flower clusters
  place(() => (rnd() < 0.5 ? 'bush_0' : 'bush_1'), R + 70, R + 520, 34, { scale: [0.9, 1.3], sway: true });
  place(() => `rock_${Math.floor(rnd() * 3)}`, R + 50, R + 520, 26, { scale: [0.9, 1.4] });
  place('mushroom', R + 40, R + 400, 14, { scale: [0.8, 1.2] });
  place(flower, R + 30, R + 600, 90, { scale: [0.9, 1.4], flat: true, originY: 0.5 });
  place('tuft', R + 20, R + 600, 70, { scale: [0.9, 1.3], flat: true });
  // Sparse, low-contrast details inside the battlefield
  place(flower, 200, R - 30, 26, { scale: [0.7, 1], flat: true, originY: 0.5, alpha: 0.85 });
  place('tuft', 190, R - 20, 30, { scale: [0.8, 1.1], flat: true, alpha: 0.8 });

  // gentle breathing on bushes so the world feels alive (cheap: one tween each)
  swaying.forEach((img, i) => {
    scene.tweens.add({
      targets: img,
      scaleY: img.scaleY * 1.04,
      scaleX: img.scaleX * 0.98,
      duration: 1400 + (i % 5) * 220,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
      delay: (i * 137) % 1200,
    });
  });

  return objs;
}
