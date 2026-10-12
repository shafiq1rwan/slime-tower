import { UPGRADES, HEAL_AMOUNT } from '../config/balance.js';

// =====================================================================
// UpgradeManager — rolls upgrade choices and applies picks to the tower.
// Upgrade definitions live in config/balance.js (UPGRADES / UPGRADE_EFFECTS).
// =====================================================================
export class UpgradeManager {
  constructor(tower) {
    this.tower = tower;
    this.levels = {};
    this.history = [];
  }

  level(id) {
    return this.levels[id] || 0;
  }

  /** Return `count` distinct upgrade definitions, weighted at random. */
  roll(count = 3) {
    const t = this.tower;
    const missing = t.maxHp - t.hp;
    const hpRatio = t.hp / t.maxHp;
    let pool = UPGRADES.filter((u) => this.level(u.id) < u.max && (u.id !== 'heal' || missing > 0));
    // Healing becomes more likely the more damaged the tower is.
    const weight = (u) => (u.id === 'heal' ? u.weight * (hpRatio < 0.4 ? 3 : hpRatio < 0.7 ? 1.6 : 0.7) : u.weight);

    const picks = [];
    while (picks.length < count && pool.length) {
      const total = pool.reduce((s, u) => s + weight(u), 0);
      let r = Math.random() * total;
      let chosen = pool[pool.length - 1];
      for (const u of pool) {
        r -= weight(u);
        if (r <= 0) {
          chosen = u;
          break;
        }
      }
      picks.push(chosen);
      pool = pool.filter((u) => u !== chosen);
    }
    // Always offer at least one core damage upgrade while any remain, so a
    // run can't stall on a hand of purely utility picks.
    const core = ['rapid', 'power', 'split'];
    if (!picks.some((u) => core.includes(u.id))) {
      const options = UPGRADES.filter((u) => core.includes(u.id) && this.level(u.id) < u.max);
      // replace the last non-heal card (keep healing on offer when it's there)
      let idx = picks.length - 1;
      while (idx > 0 && picks[idx].id === 'heal') idx--;
      if (options.length && picks.length) picks[idx] = options[Math.floor(Math.random() * options.length)];
    }
    // Fallback: if everything is maxed, healing is always available.
    if (picks.length < count && !picks.find((u) => u.id === 'heal')) {
      picks.push(UPGRADES.find((u) => u.id === 'heal'));
    }
    return picks;
  }

  /** Apply an upgrade. Returns info for UI/FX. */
  apply(id) {
    const def = UPGRADES.find((u) => u.id === id);
    if (!def) return null;
    this.history.push(id);
    if (id === 'heal') {
      const healed = this.tower.heal(HEAL_AMOUNT);
      this.levels.heal = this.level('heal') + 1;
      return { def, healed };
    }
    const lvl = Math.min(def.max, this.level(id) + 1);
    this.levels[id] = lvl;
    this.tower.setLevel(id, lvl);
    return { def, level: lvl };
  }
}
