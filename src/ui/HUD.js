import { TOTAL_WAVES, PULSE } from '../config/balance.js';

const $ = (id) => document.getElementById(id);

// Compact in-game HUD. Only touches the DOM when a value actually changes.
export class HUD {
  constructor() {
    this.el = $('hud');
    this.hpFill = $('hp-fill');
    this.hpGhost = $('hp-ghost');
    this.hpText = $('hp-text');
    this.hpPill = $('hp-pill');
    this.waveText = $('wave-text');
    this.enemyText = $('enemy-text');
    this.scoreText = $('score-text');
    this.cache = {};
  }

  show() {
    this.el.classList.remove('hidden');
    this.cache = {};
  }

  hide() {
    this.el.classList.add('hidden');
  }

  setHp(hp, max) {
    const v = Math.ceil(hp);
    if (this.cache.hp === v && this.cache.max === max) return;
    const prev = this.cache.hp;
    this.cache.hp = v;
    this.cache.max = max;
    const r = Math.max(0, Math.min(1, hp / max));
    this.hpFill.style.transform = `scaleX(${r})`;
    this.hpGhost.style.transform = `scaleX(${r})`;
    this.hpText.textContent = `${v} / ${max}`;
    const meter = document.getElementById('hp-meter');
    meter.setAttribute('aria-valuenow', String(Math.max(0, v)));
    meter.setAttribute('aria-valuemax', String(max));
    this.hpFill.classList.toggle('mid', r <= 0.6 && r > 0.3);
    this.hpFill.classList.toggle('low', r <= 0.3);
    if (prev !== undefined) {
      const cls = v < prev ? 'hit' : 'heal';
      this.hpPill.classList.remove('hit', 'heal');
      void this.hpPill.offsetWidth; // restart animation
      this.hpPill.classList.add(cls);
    }
  }

  setWave(wave) {
    if (this.cache.wave === wave) return;
    this.cache.wave = wave;
    this.waveText.textContent = `${wave} / ${TOTAL_WAVES}`;
    this.bump(this.waveText);
  }

  setEnemies(n) {
    if (this.cache.enemies === n) return;
    this.cache.enemies = n;
    this.enemyText.textContent = String(n);
  }

  setScore(s) {
    if (this.cache.score === s) return;
    this.cache.score = s;
    this.scoreText.textContent = s.toLocaleString();
    this.bump(this.scoreText);
  }

  setActions(cooldown, active, target, inRange) {
    const seconds = Math.ceil(cooldown);
    const button = document.getElementById('btn-pulse');
    button.disabled = !active || seconds > 0;
    const label = !active ? 'Between waves' : seconds > 0 ? `Recharging · ${seconds}s` : 'Ready · push & interrupt';
    const status = document.getElementById('pulse-status');
    if (status.textContent !== label) status.textContent = label;
    button.style.setProperty('--charge', `${(1 - cooldown / PULSE.cooldown) * 100}%`);
    const text = target ? `${target.def.name} · ${inRange ? 'Focused' : 'Approaching'}` : 'Tap a slime to focus fire';
    const targetStatus = document.getElementById('target-status');
    if (targetStatus.textContent !== text) targetStatus.textContent = text;
    document.getElementById('btn-clear-target').classList.toggle('hidden', !target);
  }

  bump(el) {
    const chip = el.parentElement;
    chip.classList.remove('bump');
    void chip.offsetWidth;
    chip.classList.add('bump');
  }
}
