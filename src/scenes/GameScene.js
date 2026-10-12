import Phaser from 'phaser';
import { buildArena } from '../entities/Arena.js';
import { Tower } from '../entities/Tower.js';
import { Slime } from '../entities/Slime.js';
import { ProjectilePool } from '../entities/Projectile.js';
import { ParticleManager } from '../systems/ParticleManager.js';
import { WaveManager } from '../systems/WaveManager.js';
import { UpgradeManager } from '../systems/UpgradeManager.js';
import { CombatActions, inTowerRange } from '../systems/CombatActions.js';
import { SpawnEffects } from '../systems/SpawnEffects.js';
import { bus } from '../systems/EventBus.js';
import { audio } from '../systems/AudioManager.js';
import { settings, saveBestScore, getBestScore } from '../systems/Settings.js';
import { ui } from '../ui/UIManager.js';
import { frameCamera } from './framing.js';
import { DEBUG } from '../utils/debug.js';
import { rand, pick } from '../utils/animationUtils.js';
import { WORLD, COLORS, DEPTH, MAX_FRAME_DT, MAX_SIM_STEP } from '../config/gameConfig.js';
import { ENEMIES, BOSS, BOSS_WAVE, TOTAL_WAVES, SCORE, UPGRADES, PULSE } from '../config/balance.js';

const WAVE_SUBTITLES = {
  1: 'Here they come!',
  3: 'Speedy slimes incoming!',
  4: 'Heavy slimes approach…',
  5: 'A mixed bunch!',
  6: 'Careful — these ones split!',
  7: 'Speed rush!',
  8: 'Heavyweights!',
  9: 'Full assault!',
  10: 'Huge slime swarm!',
  11: 'Hold the line!',
};

// =====================================================================
// GameScene — the battle. Owns the simulation loop, wave flow, combat
// resolution and all gameplay -> FX/UI wiring.
//
// Flow: intro (banner) -> combat -> cleared -> choosing (upgrade) -> intro …
//       -> over (tower destroyed) | victory (boss + remaining slimes dead)
// =====================================================================
export class GameScene extends Phaser.Scene {
  constructor() {
    super('Game');
  }

  create() {
    // ---- state (re-initialised on every restart)
    this.timeScale = DEBUG.timeScale;
    this.tweens.timeScale = this.timeScale;
    this.time.timeScale = this.timeScale;
    this.simTime = 0;
    this.state = 'intro';
    this.wave = 0;
    this.score = 0;
    this.kills = 0;
    this.enemies = [];
    this.pendingSpawns = 0; // slimes promised but not yet spawned (split children, boss intro)
    this.timers = [];
    this.boss = null;
    this.bossDying = false;
    this.shakeCd = 0;
    this.paused = false;
    this.perf = { t: 0, frames: 0 };

    // ---- world
    buildArena(this);
    this.fx = new ParticleManager(this);
    this.projectiles = new ProjectilePool(this, this.fx);
    this.tower = new Tower(this, this.fx, this.projectiles);
    this.waves = new WaveManager(this);
    this.upgrades = new UpgradeManager(this.tower);
    this.actions = new CombatActions(this.tower);
    this.spawnEffects = new SpawnEffects(this);
    this.dangerZone = this.add.graphics().setDepth(DEPTH.DECAL + 3);

    ui.enterGame();
    this.updateHud(true);
    this.bindEvents();
    frameCamera(this);
    this.cameras.main.fadeIn(350, 111, 191, 87);

    if (DEBUG.startWave > 1) this.debugPreUpgrade(DEBUG.startWave - 1);
    this.after(0.35, () => this.startWave(Math.min(DEBUG.startWave, TOTAL_WAVES)));

    if (DEBUG.enabled || DEBUG.auto) {
      window.__LTS = this;
    }
  }

  // ------------------------------------------------------------------ events
  bindEvents() {
    const handlers = {
      'ui:pause': (kind) => this.pauseGame(kind),
      'ui:resume': () => this.resumeGame(),
      'ui:restart': () => this.restartGame(),
      'ui:menu': () => this.toMenu(),
      'ui:pulse': () => this.usePulse(),
      'ui:clear-target': () => this.actions.mark(null),
      'layout:changed': () => frameCamera(this, this.state === 'combat' && !this.paused),
      'settings:changed': (key, value) => {
        if (key === 'reducedEffects') this.fx.setReduced(value);
      },
    };
    Object.entries(handlers).forEach(([ev, fn]) => bus.on(ev, fn));
    const onResize = () => frameCamera(this);
    this.scale.on('resize', onResize);
    const onVisibility = () => {
      if (document.hidden && !this.paused && this.isPausable()) this.pauseGame('pause');
    };
    document.addEventListener('visibilitychange', onVisibility);
    const selectTarget = (pointer) => {
      if (this.paused || this.state !== 'combat') return;
      const point = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
      const touchRadius = 22 / this.cameras.main.zoom;
      let target = null, best = Infinity;
      for (const e of this.enemies) {
        if (!e.alive || !e.targetable) continue;
        const radius = Math.max(e.r * 1.3, touchRadius);
        const distance = Math.hypot(point.x - e.aimX, point.y - e.aimY);
        if (distance <= radius && distance < best) { best = distance; target = e; }
      }
      this.actions.mark(target);
      if (target) this.sfx('click');
    };
    this.input.on('pointerdown', selectTarget);

    this.events.once('shutdown', () => {
      Object.entries(handlers).forEach(([ev, fn]) => bus.off(ev, fn));
      this.scale.off('resize', onResize);
      document.removeEventListener('visibilitychange', onVisibility);
      this.enemies.forEach((e) => e.destroy());
      this.enemies = [];
      this.timers = [];
      this.spawnEffects.clear();
      this.input.off('pointerdown', selectTarget);
      if (window.__LTS === this) window.__LTS = null;
    });
  }

  isPausable() {
    return this.state !== 'over' && this.state !== 'victory';
  }

  pauseGame(kind) {
    if (this.paused || !this.isPausable()) return;
    this.paused = true;
    this.scene.pause();
    ui.showPause(kind);
  }

  resumeGame() {
    if (!this.paused) return;
    this.paused = false;
    ui.hidePause();
    audio.unlock();
    this.scene.resume();
  }

  restartGame() {
    ui.hidePause();
    ui.hide('result');
    this.paused = false;
    this.scene.restart();
  }

  toMenu() {
    ui.hidePause();
    this.paused = false;
    this.scene.start('Menu');
  }

  // ------------------------------------------------------------------ helpers
  /** Run `fn` after `sec` seconds of *game* time (pauses with the game). */
  after(sec, fn) {
    this.timers.push({ t: this.simTime + sec, fn });
  }

  sfx(name, opts) {
    audio.play(name, opts);
  }

  shake(intensity, duration = 160) {
    const s = settings.shakeScale();
    if (s <= 0) return;
    this.cameras.main.shake(duration, intensity * s, true);
  }

  enemiesRemaining() {
    return this.waves.remainingToSpawn + this.enemies.length + this.pendingSpawns;
  }

  usePulse() {
    if (this.paused || this.state !== 'combat') return;
    const hits = this.actions.pulse(this.enemies);
    if (!hits) return;
    this.fx.ring(0, 0, COLORS.magic, PULSE.radius, .45, 1, .85, DEPTH.DECAL + 3);
    this.fx.ring(0, 0, 0xffffff, PULSE.radius, .3, 1, .6, DEPTH.DECAL + 3);
    this.tower.view.onAttack(1.5);
    this.fx.sparkles(0, WORLD.CRYSTAL_Y, COLORS.magic, 10, 45);
    hits.forEach(({ enemy }) => this.fx.hitSpark(enemy.x, enemy.aimY, COLORS.magic, .6));
    this.sfx('zap');
    this.updateHud();
  }

  updateHud(force) {
    const h = ui.hud;
    if (force) h.cache = {};
    h.setHp(this.tower.hp, this.tower.maxHp);
    h.setWave(Math.max(1, this.wave));
    h.setEnemies(this.enemiesRemaining());
    h.setScore(this.score);
    ui.updateBuild(this.upgrades.levels);
    ui.hud.setActions(this.actions.cooldown, this.state === 'combat' && !this.paused,
      this.actions.target, this.actions.target ? inTowerRange(this.tower, this.actions.target) : false);
  }

  // ------------------------------------------------------------------ wave flow
  startWave(n) {
    this.wave = n;
    this.state = 'intro';
    const tier = this.tower.tierForWave(n);
    let evolved = false;
    if (tier !== this.tower.tier) {
      this.tower.tier = tier;
      this.tower.view.setTier(tier, n > 1);
      evolved = n > 1;
    }
    if (n === BOSS_WAVE) {
      ui.showBanner('Final Wave!', 'The Slime King approaches…', 'pink', { long: true });
    } else {
      ui.showBanner(`Wave ${n}`, evolved ? 'Your tower evolved!' : WAVE_SUBTITLES[n] || '', evolved ? 'gold' : '');
    }
    this.sfx('wave');
    this.updateHud();
    this.after(n === BOSS_WAVE ? 2 : 1, () => {
      if (this.state !== 'intro') return;
      ui.clearBanner();
      this.waves.start(n);
      this.state = 'combat';
    });
  }

  checkWaveComplete() {
    if (this.state !== 'combat') return;
    if (this.waves.remainingToSpawn > 0 || this.pendingSpawns > 0 || this.enemies.length > 0 || this.bossDying) return;
    this.onWaveCleared();
  }

  onWaveCleared() {
    this.state = 'cleared';
    this.waves.clear();
    const bonus = SCORE.waveClear(this.wave);
    this.score += bonus;
    this.updateHud();
    if (this.wave >= TOTAL_WAVES) {
      this.onVictory();
      return;
    }
    ui.showBanner('Wave Cleared!', `+${bonus} bonus`, 'mint');
    this.sfx('cleared');
    this.fx.sparkles(0, WORLD.CRYSTAL_Y, 0x8dffc4, 16, 90, 'star');
    this.fx.confetti(0, WORLD.CRYSTAL_Y, 26, 220);
    this.after(1, () => this.openUpgrades());
  }

  openUpgrades() {
    if (this.state !== 'cleared') return;
    this.state = 'choosing';
    ui.clearBanner();
    const choices = this.upgrades.roll(3);
    ui.showUpgrades(choices, this.upgrades.levels, this.wave, (id) => this.onUpgradePicked(id));
    if (DEBUG.auto) {
      setTimeout(() => {
        const idx = choices.indexOf(this.autoChoose(choices));
        ui.cards.pick(Math.max(0, idx));
      }, 500);
    }
  }

  onUpgradePicked(id) {
    if (this.state !== 'choosing') return; // stale callback after a restart
    const res = this.upgrades.apply(id);
    if (!res) return;
    const color = Phaser.Display.Color.HexStringToColor(res.def.color).color;
    this.tower.view.playUpgrade(id, color);
    if (id === 'heal') {
      this.sfx('heal');
      this.fx.number(0, WORLD.CRYSTAL_Y - 40, res.healed, 'heal');
    } else {
      this.sfx('chime');
    }
    this.updateHud();
    this.state = 'intro';
    this.after(0.55, () => this.startWave(this.wave + 1));
  }

  onVictory() {
    this.state = 'victory';
    this.projectiles.clear();
    const hpBonus = Math.round(this.tower.hp * SCORE.victoryHpBonus);
    this.score += hpBonus;
    this.updateHud();
    this.tower.view.playVictory();
    ui.hideBoss();
    ui.showBanner('Victory!', 'The kingdom is safe!', 'gold', { long: true });
    this.sfx('victory');
    for (let i = 0; i < 4; i++) {
      this.after(i * 0.35, () => this.fx.confetti(rand(-200, 200), WORLD.CRYSTAL_Y + rand(-40, 40), 40, 320));
    }
    this.after(2.8, () => this.showResult(true));
  }

  onTowerDestroyed() {
    if (this.state === 'over') return;
    this.state = 'over';
    this.waves.clear();
    this.projectiles.clear();
    this.tower.view.playDestroyed();
    ui.hideBoss();
    this.sfx('shatter');
    this.shake(0.012, 400);
    this.time.delayedCall(250, () => this.sfx('gameover'));
    ui.showBanner('Tower Destroyed', '', 'red', { long: true });
    // the slimes are thrilled
    this.enemies.forEach((e) => e.celebrate());
    this.after(2.6, () => this.showResult(false));
  }

  showResult(victory) {
    const best = getBestScore();
    const newBest = saveBestScore(this.score);
    ui.showResult({ victory, wave: this.wave, kills: this.kills, score: this.score, best: Math.max(best, this.score), newBest });
    if (DEBUG.auto) {
      window.__LTS_RESULT = { victory, wave: this.wave, kills: this.kills, score: this.score, hp: this.tower.hp, picks: [...this.upgrades.history] };
    }
  }

  // ------------------------------------------------------------------ spawning
  spawnSlime(type, x, y, opts) {
    if (type === 'boss') {
      this.spawnBoss();
      return null;
    }
    const s = new Slime(this, type, x, y, this.wave, opts);
    this.enemies.push(s);
    return s;
  }

  spawnBoss() {
    this.pendingSpawns++;
    ui.showBanner('Slime King!', 'Defeat the boss to win!', 'pink', { long: true });
    this.sfx('boss');
    this.spawnEffects.warn('boss', 0, 380, .9);
    this.after(0.9, () => {
      this.pendingSpawns--;
      if (this.state === 'over') return;
      const s = new Slime(this, 'boss', 0, 380, this.wave);
      this.enemies.push(s);
      this.boss = s;
    });
  }

  bossSummon(boss) {
    const alive = this.enemies.filter((e) => e.isMinion && e.alive).length;
    const n = Math.min(BOSS.summonTypes.length, BOSS.maxMinions - alive);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = rand(90, 160);
      this.spawnSlime(BOSS.summonTypes[i], boss.x + Math.cos(a) * 20, boss.y + Math.sin(a) * 10, {
        z: 70, vz: rand(280, 360), vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.8, minion: true,
      });
    }
    if (n > 0) {
      this.fx.sparkles(boss.x, boss.y - 80, ENEMIES.boss.color, 12, 60, 'star');
      this.fx.ring(boss.x, boss.y - 60, ENEMIES.boss.color, 90, 0.4);
      this.sfx('boing', { pitch: 0.7 });
    }
  }

  bossJumpWindup(boss, tx, ty) {
    this.fx.ring(tx, ty, 0xff4f8b, boss.r * 1.3, .5, 1, .9, DEPTH.DECAL + 2);
    this.sfx('boing', { pitch: 0.5 });
  }

  bossLanded(boss, nearTower) {
    this.shake(0.011, 280);
    this.fx.dust(boss.x, boss.y, 10, 2.2);
    this.fx.ring(boss.x, boss.y, 0xff9ad5, 230, 0.6, 0.5, 0.9, DEPTH.DECAL + 2);
    this.fx.goo(boss.x, boss.y, ENEMIES.boss.color, 8, 1.2);
    this.sfx('thud');
    if (nearTower) this.tower.takeDamage(BOSS.jumpDamage, boss);
  }

  // ------------------------------------------------------------------ slime callbacks
  onSlimeLanded(s, fromSpawn) {
    const def = s.def;
    if (def.isBoss) {
      this.shake(fromSpawn ? 0.014 : 0.0035, fromSpawn ? 380 : 160);
      this.fx.dust(s.x, s.y, fromSpawn ? 12 : 5, fromSpawn ? 2.6 : 1.8);
      this.fx.ring(s.x, s.y, 0xffffff, fromSpawn ? 260 : 140, 0.5, 0.5, 0.6, DEPTH.DECAL + 2);
      this.sfx('thud');
      if (fromSpawn) {
        ui.showBoss();
        this.fx.goo(s.x, s.y, def.color, 10, 1.4);
      }
      return;
    }
    if (fromSpawn) {
      this.fx.dust(s.x, s.y, 2, s.r / 30);
      if (Math.random() < 0.5) this.sfx('boing', { pitch: 30 / s.r });
      return;
    }
    if (def.landingDust) {
      this.fx.dust(s.x, s.y, 3, s.r / 28);
      this.fx.ring(s.x, s.y, 0xffffff, s.r * 1.6, 0.3, 0.5, 0.35, DEPTH.DECAL + 2);
      if (Math.random() < 0.5) this.sfx('squish', { big: true });
      if (this.shakeCd <= 0 && settings.get('shake') === 'full') {
        this.shake(0.0012, 90);
        this.shakeCd = 0.9;
      }
    } else if (s.type === 'split' || s.type === 'mini') {
      s.jig.v += 3; // extra jelly jiggle
    } else if (Math.random() < 0.03) {
      this.sfx('boing', { pitch: 30 / s.r });
    }
  }

  onSlimeHit(s, amount, opts) {
    const fx = this.fx;
    fx.goo(s.x, s.y - s.r, s.def.color, opts.crit ? 4 : 2, 0.55);
    if (opts.crit || this.simTime - s.lastNumberT > 0.09) {
      s.lastNumberT = this.simTime;
      fx.number(s.x, s.aimY - s.r * 0.9, amount, opts.crit ? 'crit' : 'normal');
    }
    if (opts.crit) {
      this.sfx('crit');
      fx.burst(s.x, s.aimY, COLORS.crit, 6, 160, 'star', 0.45);
    } else {
      this.sfx('pop');
    }
    if (s === this.boss) ui.setBossHp(s.hp / s.maxHp);
  }

  onSlimeKilled(s) {
    if (this.actions.target === s) this.actions.mark(null);
    this.kills++;
    this.score += s.def.score;
    const def = s.def;
    const fx = this.fx;

    if (def.isBoss) {
      this.bossDying = true;
      this.waves.clear(); // no more reinforcements
      ui.setBossHp(0);
      this.sfx('boss');
      s.view.playDeath(() => {
        fx.goo(s.x, s.y - s.r, def.color, 40, 2.2);
        fx.goo(s.x, s.y - s.r, 0xffd23f, 14, 1.4);
        fx.ring(s.x, s.y - s.r, 0xffffff, 260, 0.7);
        fx.ring(s.x, s.y, def.color, 320, 0.9, 0.5);
        fx.confetti(s.x, s.y - s.r, 50, 360);
        fx.burst(s.x, s.y - s.r, 0xffe066, 18, 380, 'star', 0.9);
        this.sfx('plop', { big: true });
        this.sfx('thud');
        this.shake(0.018, 500);
        this.bossDying = false;
        this.boss = null;
        ui.hideBoss();
      }, 'boss');
      return;
    }

    if (def.splitInto) {
      const count = def.splitCount || 2;
      this.pendingSpawns += count;
      s.view.playDeath(() => {
        this.pendingSpawns -= count;
        fx.goo(s.x, s.y - s.r * 0.6, def.color, 8, 0.9);
        fx.ring(s.x, s.y - s.r * 0.6, def.color, 50, 0.3);
        this.sfx('plop');
        if (this.state === 'over' || this.state === 'victory') return;
        // children fly out sideways relative to the approach direction
        const px = -s.dirY;
        const py = s.dirX;
        for (let i = 0; i < count; i++) {
          const side = i % 2 === 0 ? 1 : -1;
          const sp = rand(110, 150);
          this.spawnSlime(def.splitInto, s.x + px * side * 8, s.y + py * side * 8, {
            z: 24, vz: rand(250, 300), vx: px * side * sp - s.dirX * 20, vy: py * side * sp - s.dirY * 20,
          });
        }
      }, 'split');
      return;
    }

    s.view.playDeath(() => {
      fx.goo(s.x, s.y - s.r * 0.6, def.color, Math.round(6 + s.r / 4), s.r / 26);
      fx.ring(s.x, s.y - s.r * 0.6, def.color, s.r * 1.6, 0.28, 1, 0.7);
      fx.sparkles(s.x, s.y - s.r * 0.6, 0xffffff, 2, s.r * 0.6);
      this.sfx('plop');
    });
  }

  onProjectileHit(p, target, hx, hy, nx, ny) {
    const st = this.tower.stats;
    const fx = this.fx;
    fx.hitSpark(hx, hy, p.color, p.crit ? 1.4 : 1);
    const ix = target.x;
    const iy = target.y;
    if (target.alive) {
      target.takeDamage(p.damage, { crit: p.crit, kx: nx, ky: ny });
      if (st.slow > 0) {
        target.applySlow(st.slow, st.slowDuration);
        fx.snow(target.x, target.aimY, 2);
        this.sfx('ice');
      }
    }

    // Splash Burst — area damage around the impact
    if (st.splashRadius > 0) {
      const r = st.splashRadius;
      fx.ring(ix, iy - 10, COLORS.splash, r, 0.32, 0.6, 0.85);
      fx.spawn({ tex: 'soft', x: ix, y: iy - 10, life: 0.2, s0: r / 40, s1: r / 28, a0: 0.45, a1: 0, tint: COLORS.splash, add: true });
      this.sfx('splash');
      const dmg = p.damage * st.splashDamage;
      for (const e of this.enemies) {
        if (e === target || !e.alive || !e.targetable) continue;
        const dx = e.x - ix;
        const dy = e.y - iy;
        const d = Math.hypot(dx, dy);
        if (d <= r + e.r * 0.5) {
          e.takeDamage(dmg, { kx: dx / (d || 1), ky: dy / (d || 1) });
          if (st.slow > 0) e.applySlow(st.slow * 0.7, st.slowDuration * 0.7);
        }
      }
    }

    // Chain Lightning — jump to nearby slimes not yet hit
    if (st.chainJumps > 0) {
      let fromX = target.aimX;
      let fromY = target.aimY;
      let fromGX = ix;
      let fromGY = iy;
      const hit = new Set([target]);
      const dmg = p.damage * st.chainDamage;
      let jumped = false;
      for (let j = 0; j < st.chainJumps; j++) {
        let best = null;
        let bestD = st.chainRange;
        for (const e of this.enemies) {
          if (hit.has(e) || !e.alive || !e.targetable) continue;
          const d = Math.hypot(e.x - fromGX, e.y - fromGY);
          if (d < bestD) {
            bestD = d;
            best = e;
          }
        }
        if (!best) break;
        hit.add(best);
        fx.lightning(fromX, fromY, best.aimX, best.aimY);
        fx.hitSpark(best.aimX, best.aimY, COLORS.lightning, 0.8);
        fromX = best.aimX;
        fromY = best.aimY;
        fromGX = best.x;
        fromGY = best.y;
        best.takeDamage(dmg, {});
        if (st.slow > 0) best.applySlow(st.slow * 0.7, st.slowDuration * 0.7);
        jumped = true;
      }
      if (jumped) this.sfx('zap');
    }
  }

  onTowerDamaged(amount) {
    this.updateHud();
    const cy = WORLD.CRYSTAL_Y * 0.5;
    this.fx.burst(rand(-20, 20), cy, 0xff8a9e, 5, 140, 'spark', 0.45);
    this.fx.number(rand(-24, 24), WORLD.CRYSTAL_Y - 30, amount, 'hurt');
    this.sfx('hurt');
    if (amount >= 15) this.shake(0.003, 120);
  }

  // ------------------------------------------------------------------ main loop
  update(time, delta) {
    const frameDt = Math.min(delta / 1000, MAX_FRAME_DT);
    const dt = frameDt * this.timeScale;
    const steps = Math.max(1, Math.ceil(dt / MAX_SIM_STEP));
    const h = dt / steps;
    for (let i = 0; i < steps; i++) this.step(h);

    for (const e of this.enemies) e.view.render(this.simTime);
    this.drawDangerZone();
    this.fx.update(Math.min(dt, 0.1));
    this.updateHud();
    this.monitorPerformance(frameDt);
  }

  step(dt) {
    this.simTime += dt;
    if (this.shakeCd > 0) this.shakeCd -= dt;

    // game-time timers
    if (this.timers.length) {
      const due = this.timers.filter((t) => t.t <= this.simTime);
      if (due.length) {
        this.timers = this.timers.filter((t) => t.t > this.simTime);
        due.forEach((t) => t.fn());
      }
    }

    if (this.state === 'combat') this.waves.update(dt);
    this.spawnEffects.update(dt);
    this.actions.update(this.state === 'combat' ? dt : 0);

    const tower = this.tower;
    for (const e of this.enemies) e.update(dt, tower, this.simTime);
    this.separate();

    if (this.state === 'combat') tower.update(dt, this.enemies);
    this.projectiles.update(dt, this.enemies);
    tower.view.update(dt);

    // drop dead slimes from the active list (their death animation runs on its own)
    if (this.enemies.some((e) => !e.alive)) this.enemies = this.enemies.filter((e) => e.alive);

    this.checkWaveComplete();
  }

  drawDangerZone() {
    const g = this.dangerZone.clear();
    const boss = this.boss?.boss;
    if (!boss || !this.boss.alive || !['windup', 'leap'].includes(boss.phase)) return;
    const r = this.boss.r * 1.3;
    g.fillStyle(0xff8195, .22);
    g.fillCircle(boss.tx, boss.ty, r);
    g.lineStyle(4, 0xff8195, .95);
    g.strokeCircle(boss.tx, boss.ty, r);
    const u = boss.phase === 'leap' ? 1 : Math.min(1, boss.t / boss.windup);
    g.lineStyle(3, 0xfff8e7, .95);
    g.beginPath();
    g.arc(boss.tx, boss.ty, r + 6, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * u);
    g.strokePath();
  }

  /** Soft circle separation so slimes don't stack, plus tower blocking. */
  separate() {
    const list = this.enemies;
    const n = list.length;
    for (let i = 0; i < n; i++) {
      const a = list[i];
      if (!a.alive || a.state === 'spawning') continue;
      const aLocked = a.boss && a.boss.phase !== 'walk';
      for (let j = i + 1; j < n; j++) {
        const b = list[j];
        if (!b.alive || b.state === 'spawning') continue;
        const minD = (a.r + b.r) * 0.82;
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        if (dx > minD || dx < -minD || dy > minD || dy < -minD) continue;
        let d2 = dx * dx + dy * dy;
        if (d2 >= minD * minD) continue;
        if (d2 < 0.0001) {
          dx = Math.random() - 0.5;
          dy = Math.random() - 0.5;
          d2 = dx * dx + dy * dy;
        }
        const d = Math.sqrt(d2);
        const overlap = (minD - d) * 0.5;
        const nx = dx / d;
        const ny = dy / d;
        const bLocked = b.boss && b.boss.phase !== 'walk';
        let wa = b.mass / (a.mass + b.mass);
        if (aLocked) wa = 0;
        if (bLocked) wa = 1;
        a.x -= nx * overlap * wa;
        a.y -= ny * overlap * wa;
        b.x += nx * overlap * (1 - wa);
        b.y += ny * overlap * (1 - wa);
      }
      // keep out of the tower footprint
      const tr = WORLD.TOWER_RADIUS + a.r * 0.8;
      const d2t = a.x * a.x + a.y * a.y;
      if (d2t < tr * tr && d2t > 0.0001) {
        const d = Math.sqrt(d2t);
        a.x *= tr / d;
        a.y *= tr / d;
      }
    }
  }

  /** Lower particle budgets if the device can't keep up. */
  monitorPerformance(frameDt) {
    const p = this.perf;
    p.t += frameDt;
    p.frames++;
    if (p.t >= 2) {
      const fps = p.frames / p.t;
      if (fps < 40 && this.fx.quality > 0.5) this.fx.quality = Math.max(0.5, this.fx.quality - 0.25);
      else if (fps > 56 && this.fx.quality < 1) this.fx.quality = Math.min(1, this.fx.quality + 0.1);
      p.t = 0;
      p.frames = 0;
    }
  }

  // ------------------------------------------------------------------ debug / balance helpers
  autoChoose(choices) {
    const strategy = DEBUG.auto;
    if (strategy === 'random') return pick(choices);
    const t = this.tower;
    const heal = choices.find((c) => c.id === 'heal');
    if (heal && t.hp / t.maxHp < 0.5) return heal;
    const priority = ['split', 'power', 'rapid', 'crit', 'chain', 'splash', 'frost', 'reach', 'heal'];
    return [...choices].sort((a, b) => priority.indexOf(a.id) - priority.indexOf(b.id))[0];
  }

  debugPreUpgrade(count) {
    for (let i = 0; i < count; i++) {
      const choice = this.autoChoose(this.upgrades.roll(3).filter((u) => u.id !== 'heal').concat(UPGRADES[0]).slice(0, 3));
      this.upgrades.apply(choice.id);
    }
  }
}
