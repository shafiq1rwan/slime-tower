import { DEPTH } from '../config/gameConfig.js';
import { ENEMIES } from '../config/balance.js';
import { SPAWN_WARNING } from '../utils/spawnLayout.js';

export class SpawnEffects {
  constructor(scene) { this.scene = scene; this.markers = new Set(); }
  warn(type, x, y, duration = SPAWN_WARNING) {
    const marker = { g: this.scene.add.graphics().setDepth(DEPTH.DECAL + 2), type, x, y, t: 0, duration };
    this.markers.add(marker);
    return marker;
  }
  update(dt) {
    for (const m of this.markers) {
      m.t += dt;
      if (m.t > m.duration + .4) { m.g.destroy(); this.markers.delete(m); continue; }
      const progress = Math.min(1, m.t / m.duration);
      const fade = m.t <= m.duration ? 1 : Math.max(0, 1 - (m.t - m.duration) / .4);
      const g = m.g.clear();
      const r = m.type === 'boss' ? 70 : 30;
      const color = ENEMIES[m.type].color;
      g.fillStyle(0x182b46, .75 * fade);
      g.fillEllipse(m.x, m.y, r * 2, r * .95);
      g.lineStyle(3, color, fade);
      g.strokeEllipse(m.x, m.y, r * 2, r * .95);
      g.fillStyle(color, .32 * fade);
      g.fillEllipse(m.x, m.y, r * 1.65 * progress, r * .72 * progress);
      // Inward chevron makes the approach direction clear even without color.
      const a = Math.atan2(-m.y, -m.x), cx = m.x + Math.cos(a) * (r + 13), cy = m.y + Math.sin(a) * (r + 13);
      g.lineStyle(3, 0xfff8e7, .9 * fade);
      g.beginPath();
      g.moveTo(cx + Math.cos(a + 2.4) * 9, cy + Math.sin(a + 2.4) * 9);
      g.lineTo(cx, cy);
      g.lineTo(cx + Math.cos(a - 2.4) * 9, cy + Math.sin(a - 2.4) * 9);
      g.strokePath();
    }
  }
  clear() { for (const m of this.markers) m.g.destroy(); this.markers.clear(); }
}
