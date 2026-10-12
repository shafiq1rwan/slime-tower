import Phaser from 'phaser';
import '@fontsource/fredoka/latin-500.css';
import '@fontsource/fredoka/latin-600.css';
import '@fontsource/fredoka/latin-700.css';
import './styles/main.css';

import { BootScene } from './scenes/BootScene.js';
import { MenuScene } from './scenes/MenuScene.js';
import { GameScene } from './scenes/GameScene.js';
import { ui } from './ui/UIManager.js';
import { audio } from './systems/AudioManager.js';
import { getRenderDpr } from './utils/layout.js';

// Canvas roundRect polyfill for older mobile browsers (used by procedural art).
if (typeof CanvasRenderingContext2D !== 'undefined' && !CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function roundRect(x, y, w, h, r) {
    const rr = Math.min(typeof r === 'number' ? r : 0, w / 2, h / 2);
    this.moveTo(x + rr, y);
    this.arcTo(x + w, y, x + w, y + h, rr);
    this.arcTo(x + w, y + h, x, y + h, rr);
    this.arcTo(x, y + h, x, y, rr);
    this.arcTo(x, y, x + w, y, rr);
    this.closePath();
    return this;
  };
}

function viewportSize() {
  const vv = window.visualViewport;
  const w = Math.round(vv ? vv.width : window.innerWidth);
  const h = Math.round(vv ? vv.height : window.innerHeight);
  return { w: Math.max(1, w), h: Math.max(1, h) };
}

async function waitForFonts() {
  if (!document.fonts || !document.fonts.load) return;
  const timeout = new Promise((r) => setTimeout(r, 2500));
  try {
    await Promise.race([Promise.all([document.fonts.load('700 44px Fredoka'), document.fonts.load('600 20px Fredoka')]), timeout]);
  } catch (e) {
    /* fall back to system fonts */
  }
}

async function start() {
  ui.init();
  await waitForFonts();

  const { w, h } = viewportSize();
  const dpr = getRenderDpr();

  // The canvas backing store is rendered at device resolution (capped at 2x)
  // and displayed at CSS size via the scale manager's zoom. We manage resizing
  // ourselves so orientation changes never restart or distort the game.
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    backgroundColor: '#8fd16a',
    scale: {
      mode: Phaser.Scale.NONE,
      width: w * dpr,
      height: h * dpr,
      zoom: 1 / dpr,
    },
    render: {
      antialias: true,
      roundPixels: false,
      powerPreference: 'high-performance',
    },
    fps: { target: 60, smoothStep: true },
    input: { activePointers: 2 },
    disableContextMenu: true,
    banner: false,
    scene: [BootScene, MenuScene, GameScene],
  });

  let pending = 0;
  const resize = () => {
    cancelAnimationFrame(pending);
    pending = requestAnimationFrame(() => {
      const size = viewportSize();
      const d = getRenderDpr();
      game.scale.zoom = 1 / d;
      game.scale.resize(size.w * d, size.h * d);
    });
  };
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', () => setTimeout(resize, 120));
  if (window.visualViewport) window.visualViewport.addEventListener('resize', resize);

  // Audio must be unlocked by a user gesture on mobile.
  const unlock = () => audio.unlock();
  window.addEventListener('pointerdown', unlock, { passive: true });
  window.addEventListener('keydown', unlock);

  // Pause audio when the page is hidden.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) audio.suspend();
    else audio.resume();
  });

  // Block page scroll / pinch-zoom gestures outside scrollable panels.
  document.addEventListener(
    'touchmove',
    (e) => {
      if (!e.target.closest || !e.target.closest('.panel, .upgrade-panel')) e.preventDefault();
    },
    { passive: false }
  );
  document.addEventListener('gesturestart', (e) => e.preventDefault());

  if (import.meta.env.DEV) window.__game = game;
}

start();
