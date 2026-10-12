import { WAVES } from '../config/balance.js';
import { rand } from '../utils/animationUtils.js';
import { spawnPosition, SPAWN_WARNING } from '../utils/spawnLayout.js';

// =====================================================================
// WaveManager — turns a wave definition into a timed spawn queue.
// The scene asks `remainingToSpawn` + living enemies to decide when the
// wave is truly over, so nothing can end a wave early.
// =====================================================================
export class WaveManager {
  constructor(scene) {
    this.scene = scene;
    this.queue = [];
    this.time = 0;
    this.wave = 0;
    this.running = false;
  }

  start(wave) {
    this.wave = wave;
    this.time = 0;
    this.running = true;
    const def = WAVES[wave - 1] || [];
    const q = [];
    for (const [group, g] of def.entries()) {
      for (let i = 0; i < g.count; i++) {
        // small jitter so groups feel organic, never negative
        const t = g.delay + i * g.interval + (i > 0 ? rand(-0.15, 0.15) * g.interval : 0);
        q.push({ t: Math.max(0, t) + SPAWN_WARNING, type: g.type, ...spawnPosition(wave, group, i), warned: false });
      }
    }
    q.sort((a, b) => a.t - b.t);
    this.queue = q;
  }

  get remainingToSpawn() {
    return this.queue.length;
  }

  update(dt) {
    if (!this.running) return;
    this.time += dt;
    for (const entry of this.queue) {
      if (entry.t > this.time + SPAWN_WARNING) break;
      if (!entry.warned) {
        entry.warned = true;
        if (entry.type !== 'boss') this.scene.spawnEffects.warn(entry.type, entry.x, entry.y);
      }
    }
    while (this.queue.length && this.queue[0].t <= this.time) {
      const entry = this.queue.shift();
      this.scene.spawnSlime(entry.type, entry.x, entry.y);
    }
  }

  clear() {
    this.scene.spawnEffects?.clear();
    this.queue = [];
    this.running = false;
  }
}
