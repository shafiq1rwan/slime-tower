import { ICONS } from './icons.js';
import { audio } from '../systems/AudioManager.js';

const INPUT_GUARD_MS = 450; // ignore taps right after the cards appear

// Upgrade choice panel: three animated cards; one tap picks.
export class UpgradeCards {
  constructor(screen, container, subtitle) {
    this.screen = screen;
    this.container = container;
    this.subtitle = subtitle;
    this.cards = [];
    this.picked = false;
    this.onPick = null;
  }

  show(choices, levels, wave, onPick) {
    this.cancel();
    this.onPick = onPick;
    this.picked = false;
    this.choices = choices;
    this.subtitle.textContent = `Wave ${wave} cleared!`;
    this.container.innerHTML = '';
    this.cards = choices.map((def, i) => this.buildCard(def, levels[def.id] || 0, i));
    this.cards.forEach((c) => {
      c.classList.add('locked');
      c.disabled = true;
      this.container.appendChild(c);
    });
    this.screen.classList.remove('hidden');
    this.onVisibility?.();
    clearTimeout(this.guard);
    this.guard = setTimeout(() => {
      this.cards.forEach((c) => { c.classList.remove('locked'); c.disabled = false; });
      if (document.activeElement === this.screen && !this.screen.inert) this.cards[0]?.focus({ preventScroll: true });
    }, INPUT_GUARD_MS);
  }

  cancel() {
    clearTimeout(this.guard);
    clearTimeout(this.pickTimer);
    this.onPick = null;
    this.cards = [];
    this.container.replaceChildren();
    this.screen.classList.add('hidden');
  }

  buildCard(def, level, index) {
    const card = document.createElement('button');
    card.className = 'card';
    card.style.setProperty('--accent', def.color);
    card.style.setProperty('--i', index);
    const description = document.createElement('div');
    description.innerHTML = def.describe(level);
    card.setAttribute('aria-label', `${def.name}. ${description.textContent}. ${Number.isFinite(def.max) ? `Level ${level} to ${level + 1}.` : 'Instant heal.'}`);

    const key = document.createElement('span');
    key.className = 'card-key';
    key.textContent = String(index + 1);

    const icon = document.createElement('div');
    icon.className = 'card-icon';
    const ic = document.createElement('span');
    ic.className = 'icon';
    ic.innerHTML = ICONS[def.icon] || '';
    icon.appendChild(ic);

    const text = document.createElement('div');
    text.className = 'card-text';
    const name = document.createElement('div');
    name.className = 'card-name';
    name.textContent = def.name;
    const desc = document.createElement('div');
    desc.className = 'card-desc';
    // descriptions are static strings from config/balance.js (may contain <b>)
    desc.innerHTML = def.describe(level);

    text.appendChild(name);
    if (Number.isFinite(def.max)) {
      const pips = document.createElement('div');
      pips.className = 'pips';
      for (let i = 0; i < def.max; i++) {
        const p = document.createElement('span');
        p.className = 'pip' + (i < level ? ' on' : i === level ? ' next' : '');
        pips.appendChild(p);
      }
      const lbl = document.createElement('span');
      lbl.className = 'pips-label';
      lbl.textContent = level === 0 ? 'NEW · LV 1' : `LV ${level} → ${level + 1}`;
      pips.appendChild(lbl);
      text.appendChild(pips);
    }
    text.appendChild(desc);
    if (!Number.isFinite(def.max)) {
      const tag = document.createElement('span');
      tag.className = 'pips-label';
      tag.textContent = 'INSTANT HEAL';
      text.appendChild(tag);
    }

    card.append(key, icon, text);
    card.addEventListener('click', (e) => {
      e.preventDefault();
      this.pick(index);
    });
    card.addEventListener('pointerenter', (e) => {
      if (!this.picked && e.pointerType === 'mouse') audio.play('click');
    });
    return card;
  }

  pickIndex(i) {
    if (this.cards[i] && !this.cards[i].classList.contains('locked')) this.pick(i);
  }

  pick(index) {
    if (this.picked || this.screen.inert || this.screen.classList.contains('hidden') || !this.cards[index] || this.cards[index].disabled) return;
    this.picked = true;
    audio.unlock();
    const card = this.cards[index];
    this.cards.forEach((c) => { c.disabled = true; });
    card.classList.add('picked');
    this.cards.forEach((c, i) => i !== index && c.classList.add('dismissed'));
    this.burst(card, this.choices[index].color);
    this.pickTimer = setTimeout(() => {
      this.screen.classList.add('hidden');
      this.container.innerHTML = '';
      const cb = this.onPick;
      this.onPick = null;
      cb && cb(this.choices[index].id);
      this.onVisibility?.();
    }, 560);
  }

  burst(card, color) {
    const n = 16;
    for (let i = 0; i < n; i++) {
      const p = document.createElement('span');
      p.className = 'burst';
      const a = (i / n) * Math.PI * 2;
      const d = 70 + Math.random() * 60;
      p.style.setProperty('--dx', `${Math.cos(a) * d}px`);
      p.style.setProperty('--dy', `${Math.sin(a) * d}px`);
      p.style.setProperty('--c', i % 3 === 0 ? '#ffffff' : color);
      p.style.width = p.style.height = `${8 + Math.random() * 8}px`;
      card.appendChild(p);
      setTimeout(() => p.remove(), 750);
    }
  }
}
