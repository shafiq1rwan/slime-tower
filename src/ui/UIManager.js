import { bus } from '../systems/EventBus.js';
import { settings, getBestScore } from '../systems/Settings.js';
import { audio } from '../systems/AudioManager.js';
import { ICONS, hydrateIcons } from './icons.js';
import { TOTAL_WAVES, UPGRADES } from '../config/balance.js';
import { HUD } from './HUD.js';
import { UpgradeCards } from './UpgradeCards.js';

const $ = (id) => document.getElementById(id);

// =====================================================================
// UIManager — owns every DOM screen layered over the Phaser canvas.
// Scenes call methods here; user actions are emitted on the bus.
// =====================================================================
class UIManagerClass {
  init() {
    hydrateIcons(document);
    this.hud = new HUD();
    this.cards = new UpgradeCards($('upgrade-screen'), $('cards'), $('upgrade-sub'));
    this.screens = {
      menu: $('menu-screen'),
      upgrade: $('upgrade-screen'),
      pause: $('pause-screen'),
      result: $('result-screen'),
      loading: $('loading'),
    };
    this.banner = $('banner');
    this.bannerTimer = null;
    this.mode = 'menu';
    this.cards.onVisibility = () => this.syncFocus();

    // --- menu
    this.on('btn-play', () => bus.emit('ui:play'));
    this.on('btn-menu-settings', () => this.showSettings('menu'));
    this.on('btn-menu-sound', () => settings.set('sound', !settings.get('sound')));

    // --- hud
    this.on('btn-pause', () => bus.emit('ui:pause', 'pause'));
    this.on('btn-settings', () => bus.emit('ui:pause', 'settings'));
    this.on('btn-pulse', () => bus.emit('ui:pulse'));
    this.on('btn-clear-target', () => bus.emit('ui:clear-target'));

    // --- pause / settings
    this.on('btn-resume', () => bus.emit('ui:resume'));
    this.on('btn-restart', () => bus.emit('ui:restart'));
    this.on('btn-quit', () => bus.emit('ui:menu'));
    this.on('btn-close-settings', () => this.hide('pause'));
    this.on('tgl-sound', () => settings.set('sound', !settings.get('sound')));
    this.on('tgl-shake', () => {
      const order = ['full', 'reduced', 'off'];
      const cur = settings.get('shake');
      settings.set('shake', order[(order.indexOf(cur) + 1) % order.length]);
    });
    this.on('tgl-fx', () => settings.set('reducedEffects', !settings.get('reducedEffects')));

    // --- result
    this.on('btn-again', () => bus.emit('ui:restart'));
    this.on('btn-res-menu', () => bus.emit('ui:menu'));

    bus.on('settings:changed', () => this.refreshSettings());
    this.refreshSettings();

    // Keyboard shortcuts (desktop convenience only — never required)
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      const modal = this.activeDialog();
      if (e.code === 'Space' && this.mode === 'game' && !modal) {
        e.preventDefault();
        bus.emit('ui:pulse');
      }
      if (e.key === 'Tab' && modal) {
        const buttons = [...modal.querySelectorAll('button:not(:disabled)')].filter((b) => b.offsetParent);
        const first = buttons[0];
        const last = buttons[buttons.length - 1];
        if (!first) { e.preventDefault(); modal.focus(); }
        else if (e.shiftKey && (document.activeElement === first || document.activeElement === modal)) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && (document.activeElement === last || document.activeElement === modal)) { e.preventDefault(); first.focus(); }
      }
      if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') {
        if (this.isVisible('pause')) {
          if (this.screens.pause.classList.contains('menu-mode')) this.hide('pause');
          else bus.emit('ui:resume');
        } else if (this.mode === 'game') bus.emit('ui:pause', 'pause');
      }
      if (['1', '2', '3'].includes(e.key) && this.isVisible('upgrade') && !this.isVisible('pause')) this.cards.pickIndex(parseInt(e.key, 10) - 1);
      if ((e.key === 'Enter' || e.key === ' ') && this.isVisible('menu') && !modal && document.activeElement.tagName !== 'BUTTON') { e.preventDefault(); bus.emit('ui:play'); }
    });

    // Layout changes (HUD size, orientation) -> scenes re-frame the camera
    const notify = () => {
      cancelAnimationFrame(this._raf);
      this._raf = requestAnimationFrame(() => {
        document.documentElement.style.setProperty('--footer-height', `${$('game-footer').getBoundingClientRect().height}px`);
        bus.emit('layout:changed');
      });
    };
    if (window.ResizeObserver) {
      const ro = new ResizeObserver(notify);
      document.querySelectorAll('[data-reserve]').forEach((el) => ro.observe(el));
    }
  }

  on(id, fn) {
    const el = $(id);
    if (!el) return;
    el.addEventListener('click', (e) => {
      e.preventDefault();
      audio.unlock();
      audio.play('click');
      fn(e);
    });
  }

  show(name) {
    this.screens[name].classList.remove('hidden');
    this.syncFocus();
  }
  hide(name) {
    this.screens[name].classList.add('hidden');
    this.syncFocus();
  }
  isVisible(name) {
    return !this.screens[name].classList.contains('hidden');
  }

  activeDialog() {
    return ['pause', 'result', 'upgrade'].map((name) => this.screens[name]).find((el) => !el.classList.contains('hidden'));
  }

  syncFocus() {
    const modal = this.activeDialog();
    this.hud.el.inert = !!modal;
    $('game-footer').inert = !!modal;
    Object.values(this.screens).forEach((el) => { el.inert = !!modal && el !== modal; });
    if (modal && !modal.contains(document.activeElement)) {
      if (!this.focusReturn) this.focusReturn = document.activeElement;
      const first = [...modal.querySelectorAll('button:not(:disabled)')].find((b) => b.offsetParent);
      (first || modal).focus({ preventScroll: true });
    } else if (!modal && this.focusReturn) {
      const target = this.focusReturn;
      this.focusReturn = null;
      if (target.isConnected && target.offsetParent && !target.closest('[inert]')) target.focus({ preventScroll: true });
    }
  }

  updateBuild(levels) {
    const el = $('build-summary');
    const key = JSON.stringify(levels);
    if (key === this.buildKey) return;
    this.buildKey = key;
    el.replaceChildren();
    UPGRADES.filter((def) => def.id !== 'heal' && levels[def.id] > 0).forEach((def) => {
      const item = document.createElement('span');
      item.className = 'build-item';
      item.style.setProperty('--accent', def.color);
      item.title = `${def.name} · Level ${levels[def.id]}`;
      item.setAttribute('aria-label', item.title);
      item.innerHTML = `<span class="icon" aria-hidden="true">${ICONS[def.icon]}</span><span>${levels[def.id]}</span>`;
      el.appendChild(item);
    });
  }

  hideLoading() {
    this.hide('loading');
  }

  /**
   * Reserved screen rects (device px) that the camera framing should avoid.
   * Only visible elements marked with [data-reserve] count.
   */
  getReservedRects(dpr) {
    const rects = [];
    document.querySelectorAll('[data-reserve]').forEach((el) => {
      if (!el.offsetParent && getComputedStyle(el).position !== 'fixed') return; // hidden
      const r = el.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) return;
      rects.push({ left: r.left * dpr, top: r.top * dpr, right: r.right * dpr, bottom: r.bottom * dpr });
    });
    return rects;
  }

  // ------------------------------------------------------------------ modes
  enterMenu() {
    this.mode = 'menu';
    this.cards.cancel();
    ['upgrade', 'pause', 'result'].forEach((s) => this.hide(s));
    this.hud.hide();
    $('game-footer').classList.add('hidden');
    this.hideBoss();
    this.clearBanner();
    this.show('menu');
    const best = getBestScore();
    $('menu-best').textContent = best > 0 ? `Best score: ${best.toLocaleString()}` : '';
    bus.emit('layout:changed');
  }

  enterGame() {
    this.mode = 'game';
    this.cards.cancel();
    ['menu', 'upgrade', 'pause', 'result'].forEach((s) => this.hide(s));
    this.hideBoss();
    this.clearBanner();
    this.hud.show();
    $('game-footer').classList.remove('hidden');
    this.updateBuild({});
    bus.emit('layout:changed');
  }

  // ------------------------------------------------------------------ banner
  /** Big centred banner. style: '' | 'gold' | 'mint' | 'pink' | 'red'. */
  showBanner(main, sub = '', style = '', { long = false, sticky = false } = {}) {
    clearTimeout(this.bannerTimer);
    const b = this.banner;
    b.className = '';
    b.innerHTML = '';
    if (sticky) b.classList.add('sticky');
    if (style) b.classList.add(`banner-${style}`);
    if (long) b.classList.add('banner-long');
    const m = document.createElement('div');
    m.className = 'banner-main';
    m.textContent = main;
    b.appendChild(m);
    if (sub) {
      const s = document.createElement('div');
      s.className = 'banner-sub';
      s.textContent = sub;
      b.appendChild(s);
    }
    if (!sticky) this.bannerTimer = setTimeout(() => this.clearBanner(), long ? 2700 : 1700);
  }

  clearBanner() {
    clearTimeout(this.bannerTimer);
    this.banner.innerHTML = '';
    this.banner.className = '';
  }

  // ------------------------------------------------------------------ boss bar
  showBoss() {
    $('boss-bar').classList.remove('hidden');
    this.setBossHp(1);
    bus.emit('layout:changed');
  }
  hideBoss() {
    const el = $('boss-bar');
    if (!el.classList.contains('hidden')) {
      el.classList.add('hidden');
      bus.emit('layout:changed');
    }
  }
  setBossHp(ratio) {
    const r = Math.max(0, Math.min(1, ratio));
    $('boss-fill').style.transform = `scaleX(${r})`;
    $('boss-ghost').style.transform = `scaleX(${r})`;
  }

  // ------------------------------------------------------------------ upgrades
  showUpgrades(choices, levels, wave, onPick) {
    this.cards.show(choices, levels, wave, onPick);
  }

  // ------------------------------------------------------------------ pause / settings
  showPause(kind = 'pause') {
    const el = this.screens.pause;
    el.classList.remove('menu-mode');
    $('pause-title').textContent = kind === 'settings' ? 'Settings' : 'Paused';
    $('pause-caption').textContent = kind === 'settings' ? 'Make the game feel right for you.' : 'Take a breath. Your crystal is safe.';
    this.show('pause');
  }
  hidePause() {
    this.hide('pause');
  }
  showSettings() {
    const el = this.screens.pause;
    el.classList.add('menu-mode');
    $('pause-title').textContent = 'Settings';
    $('pause-caption').textContent = 'Make the game feel right for you.';
    this.show('pause');
  }

  refreshSettings() {
    const setVal = (id, text, cls) => {
      const v = $(id).querySelector('.t-val');
      v.textContent = text;
      v.className = `t-val ${cls || ''}`;
    };
    const sound = settings.get('sound');
    $('tgl-sound').setAttribute('aria-pressed', String(sound));
    setVal('tgl-sound', sound ? 'On' : 'Off', sound ? '' : 'off');
    $('tgl-sound').querySelector('.icon').innerHTML = sound ? ICONS.sound : ICONS.mute;
    const shake = settings.get('shake');
    setVal('tgl-shake', shake === 'full' ? 'Full' : shake === 'reduced' ? 'Low' : 'Off', shake === 'full' ? '' : shake === 'reduced' ? 'mid' : 'off');
    const fx = settings.get('reducedEffects');
    $('tgl-fx').setAttribute('aria-pressed', String(fx));
    document.documentElement.classList.toggle('reduced-effects', fx);
    setVal('tgl-fx', fx ? 'On' : 'Off', fx ? '' : 'off');
    const ms = $('btn-menu-sound');
    ms.querySelector('.label').textContent = sound ? 'Sound On' : 'Sound Off';
    ms.querySelector('.icon').innerHTML = sound ? ICONS.sound : ICONS.mute;
  }

  // ------------------------------------------------------------------ results
  showResult({ victory, wave, kills, score, best, newBest }) {
    const panel = this.screens.result.querySelector('.result-panel');
    panel.classList.toggle('lose', !victory);
    $('result-badge').innerHTML = victory ? ICONS.trophy : ICONS.broken;
    $('result-title').textContent = victory ? 'Victory!' : 'Tower Destroyed';
    $('result-sub').textContent = victory ? 'The Slime King has been defeated!' : 'The slimes overran your crystal…';
    $('res-wave').textContent = victory ? `${TOTAL_WAVES}/${TOTAL_WAVES}` : `${Math.max(0, wave - 1)}/${TOTAL_WAVES}`;
    $('res-kills').textContent = kills.toLocaleString();
    $('res-score').textContent = score.toLocaleString();
    $('res-best').textContent = newBest ? 'New best score!' : best > 0 ? `Best: ${best.toLocaleString()}` : '';
    this.hideBoss();
    this.show('result');
  }
}

export const ui = new UIManagerClass();
