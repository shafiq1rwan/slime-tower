import Phaser from 'phaser';
import { buildArena } from '../entities/Arena.js';
import { Tower } from '../entities/Tower.js';
import { Slime } from '../entities/Slime.js';
import { ParticleManager } from '../systems/ParticleManager.js';
import { ProjectilePool } from '../entities/Projectile.js';
import { bus } from '../systems/EventBus.js';
import { audio } from '../systems/AudioManager.js';
import { ui } from '../ui/UIManager.js';
import { frameCamera } from './framing.js';
import { MAX_FRAME_DT } from '../config/gameConfig.js';
import { hopSpeedFactor } from '../utils/animationUtils.js';

// The menu only needs the tower and the parade ring visible.
const MENU_VIEW_RADIUS = 300;

// Title screen backdrop: the arena, an idle tower and a parade of slimes
// bouncing around it. The DOM menu sits on top.
export class MenuScene extends Phaser.Scene {
  constructor() {
    super('Menu');
  }

  create() {
    ui.enterMenu();
    buildArena(this);
    this.fx = new ParticleManager(this);
    this.projectiles = new ProjectilePool(this, this.fx);
    this.tower = new Tower(this, this.fx, this.projectiles);
    this.tower.view.setTier(2, false);
    this.tower.view.rangeG.setVisible(false);
    this.time_ = 0;

    // Parade of slimes circling the tower
    const types = ['basic', 'speed', 'heavy', 'split', 'basic', 'mini', 'speed'];
    this.parade = types.map((type, i) => {
      const a = (i / types.length) * Math.PI * 2;
      const r = 205 + (i % 2) * 40;
      const s = new Slime(this, type, Math.cos(a) * r, Math.sin(a) * r, 1, { z: 0 });
      s.state = 'moving';
      s.targetable = false;
      s.pAngle = a;
      s.pRadius = r;
      s.pSpeed = (type === 'speed' ? 0.34 : type === 'heavy' ? 0.16 : 0.24) * (i % 2 ? 1 : 1);
      return s;
    });

    this.onLayout = () => frameCamera(this, false, MENU_VIEW_RADIUS);
    this.onResize = () => frameCamera(this, false, MENU_VIEW_RADIUS);
    bus.on('layout:changed', this.onLayout);
    this.scale.on('resize', this.onResize);
    this.onPlay = () => {
      audio.unlock();
      audio.play('chime');
      this.scene.start('Game');
    };
    bus.on('ui:play', this.onPlay);
    this.events.once('shutdown', () => {
      bus.off('layout:changed', this.onLayout);
      bus.off('ui:play', this.onPlay);
      this.scale.off('resize', this.onResize);
      this.parade.forEach((s) => s.destroy());
    });
    frameCamera(this, false, MENU_VIEW_RADIUS);
    this.cameras.main.fadeIn(400, 111, 191, 87);
  }

  // Slime callbacks (no gameplay in the menu)
  onSlimeLanded(s) {
    if (s.def.landingDust) this.fx.dust(s.x, s.y, 3, s.r / 30);
  }
  onSlimeHit() {}
  onSlimeKilled() {}
  sfx() {}

  update(time, delta) {
    const dt = Math.min(delta / 1000, MAX_FRAME_DT);
    this.time_ += dt;
    for (const s of this.parade) {
      // walk the circle: hop phase drives a surge just like in-game
      const prev = s.hopPhase;
      s.hopPhase = (s.hopPhase + dt * s.hopRate) % 1;
      if (prev < s.landAt && s.hopPhase >= s.landAt) this.onSlimeLanded(s);
      s.pAngle += dt * s.pSpeed * hopSpeedFactor(s.hopPhase, s.def.hop);
      s.x = Math.cos(s.pAngle) * s.pRadius;
      s.y = Math.sin(s.pAngle) * s.pRadius;
      s.dirX = -Math.sin(s.pAngle);
      s.dirY = Math.cos(s.pAngle);
      s.blinkT -= dt;
      if (s.blinking > 0) s.blinking -= dt;
      if (s.blinkT <= 0) {
        s.blinking = 0.12;
        s.blinkT = 2 + Math.random() * 3;
      }
      s.view.render(this.time_);
    }
    this.tower.view.update(dt);
    this.fx.update(dt);
  }
}
