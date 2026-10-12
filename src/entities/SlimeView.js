import { slimeMetrics } from '../art/textures.js';
import { TEX_SCALE, DEPTH } from '../config/gameConfig.js';
import { hopPose, clamp } from '../utils/animationUtils.js';
import { settings } from '../systems/Settings.js';
import { BOSS } from '../config/balance.js';
import { entrancePose } from '../utils/spawnLayout.js';

const INV = 1 / TEX_SCALE;
const pose = { h: 0, sx: 1, sy: 1, air: 0 };

// =====================================================================
// SlimeView — everything visual about a slime. Reads state from the Slime
// (logic) object each frame; never writes gameplay state back.
//
// Hierarchy:
//   root (container at ground position, depth-sorted by y)
//     shadow       — stays on the ground, shrinks while airborne
//     body         — container lifted by hop height, squashed/stretched
//       bodyImg, face, [crown]
//     frost icon, hp bar
// =====================================================================
export class SlimeView {
  constructor(scene, slime) {
    this.scene = scene;
    this.slime = slime;
    const def = slime.def;
    const type = slime.type;
    const m = slimeMetrics(def.radius);
    this.m = m;
    this.type = type;
    this.seed = Math.random() * 100;
    this.faceKey = `face_${type}`;
    this.currentFace = '';

    this.root = scene.add.container(slime.x, slime.y);
    this.shadow = scene.add.image(0, 2, 'shadow');
    this.shadowBase = (m.hw * 2.3) / 128;
    this.shadow.setScale(this.shadowBase);

    this.body = scene.add.container(0, 0);
    this.bodyImg = scene.add.image(0, 0, `slime_${type}`).setOrigin(0.5, m.originY).setScale(INV);
    this.face = scene.add.image(0, 0, this.faceKey).setOrigin(0.5, m.originY).setScale(INV);
    this.body.add([this.bodyImg, this.face]);
    this.status = scene.add.graphics();
    this.attackIcon = scene.add.image(0, -m.h - 20, 'exclaim').setScale(.48).setVisible(false);

    if (def.isBoss) {
      this.crown = scene.add.image(m.hw * 0.08, -m.h * 0.86, 'crown').setOrigin(0.5, 0.85).setScale(INV).setRotation(0.12);
      this.body.add(this.crown);
      this.exclaim = scene.add.image(0, -m.h - 70, 'exclaim').setScale(INV * 1.6).setVisible(false);
    }

    this.frost = scene.add.image(m.hw * 0.7, -m.h * 0.95, 'snow').setScale(0.42).setTint(0xdff8ff).setVisible(false);

    // HP bar (hidden until damaged; the boss uses the DOM bar instead)
    const bw = Math.max(30, m.hw * 1.5);
    this.barW = bw;
    this.hpBg = scene.add.image(-bw / 2, -m.h - 14, 'bar').setOrigin(0, 0.5).setTint(0x1b2350).setVisible(false);
    this.hpBg.setDisplaySize(bw + 4, 8);
    this.hpBg.x -= 2;
    this.hpFill = scene.add.image(-bw / 2, -m.h - 14, 'bar').setOrigin(0, 0.5).setTint(0x7dff9a).setVisible(false);
    this.hpFill.setDisplaySize(bw, 4.5);

    const parts = [this.shadow, this.status, this.body, this.frost, this.hpBg, this.hpFill, this.attackIcon];
    if (this.exclaim) parts.push(this.exclaim);
    this.root.add(parts);
    this.root.setDepth(DEPTH.ENTITY + slime.y);
    this.dying = false;
    this.hopAmp = 1;
    this.lastTime = null;
  }

  setFace(key) {
    if (key !== this.currentFace) {
      this.face.setTexture(key);
      this.currentFace = key;
    }
  }

  /** Per-frame visual update. `time` in seconds. */
  render(time) {
    if (this.dying) return;
    const s = this.slime;
    const prof = s.def.hop;

    // ---- hop pose
    const dt = this.lastTime === null ? 1 / 60 : clamp(time - this.lastTime, 0, 0.05);
    this.lastTime = time;
    const busy = s.boss && s.boss.phase !== 'walk';
    const reduced = settings.get('reducedEffects');
    const targetAmp = (busy || s.state === 'spawning' ? 0 : s.state === 'attacking' ? 0.12 : s.state === 'celebrate' ? 1.1 : 1) * (reduced ? 0.5 : 1);
    this.hopAmp += (targetAmp - this.hopAmp) * (1 - Math.exp(-16 * dt));
    if (busy || s.state === 'spawning') this.hopAmp = 0;
    hopPose(s.hopPhase, prof, this.hopAmp, pose);
    let h = pose.h + s.z;
    let sx = pose.sx;
    let sy = pose.sy;

    // idle wobble (organic jelly feel, desynchronised per slime)
    const w = reduced ? 0 : prof.wobble * 0.3 * Math.sin(time * 4 + this.seed) * (1 - pose.air);
    sx *= 1 + w;
    sy *= 1 - w;

    // hit jiggle spring (positive = squash)
    const j = clamp(s.jig.x, -0.18, 0.22);
    sx += j;
    sy -= j;

    // airborne from spawning / split arc: stretch with vertical speed
    if (s.state === 'spawning') {
      const st = clamp(Math.abs(s.vz) / 1600, 0, 0.16) * clamp(s.z / 32, 0, 1);
      sy += st;
      sx -= st * 0.6;
    }

    // attack lunge toward the tower
    let ox = 0;
    let oy = 0;
    if (s.lungeT >= 0) {
      const u = s.lungeT;
      const k = Math.pow(Math.sin(Math.PI * u), 2);
      ox = s.dirX * s.r * 0.5 * k;
      oy = s.dirY * s.r * 0.35 * k;
      sx += 0.12 * k;
      sy -= 0.1 * k;
    }

    // boss jump windup / leap
    const boss = s.boss;
    if (boss) {
      if (boss.phase === 'windup') {
        const u = clamp(boss.t / boss.windup, 0, 1);
        sy = 1 - 0.22 * u * u * (3 - 2 * u);
        sx = 1 / Math.sqrt(sy);
        ox += reduced ? 0 : Math.sin(time * 24) * 0.8 * u;
      } else if (boss.phase === 'leap') {
        const u = clamp(boss.t / BOSS.jumpDuration, 0, 1);
        const release = clamp(u / 0.18, 0, 1);
        const settle = clamp((u - 0.18) / 0.82, 0, 1);
        const stretch = u < 0.18
          ? -0.22 + 0.34 * release * release * (3 - 2 * release)
          : 0.12 * (1 - settle * settle * (3 - 2 * settle));
        sy = 1 + stretch;
        sx = 1 / Math.sqrt(sy);
      }
      this.exclaim.setVisible(boss.phase === 'windup');
      if (this.exclaim.visible) this.exclaim.y = -this.m.h - 60 - h + Math.sin(time * 18) * 4;
    }

    this.root.setPosition(s.x, s.y);
    this.root.setDepth(DEPTH.ENTITY + s.y);
    this.body.setPosition(ox, oy - h);
    this.body.setScale(Math.max(0.3, sx), Math.max(0.3, sy));
    let entryScale = 1;
    if (s.state === 'spawning' && s.entrance) {
      const entry = entrancePose(s.entrance.t, s.entrance.duration);
      entryScale = entry.scale;
      this.body.setScale(sx * entryScale, sy * entryScale).setAlpha(entry.alpha);
    } else this.body.setAlpha(1);
    this.body.rotation = s.dirX * prof.lean * 0.5 * pose.air + w * 0.3;

    // look toward travel direction
    this.face.x = s.dirX * this.m.hw * 0.08;
    this.face.y = Math.max(0, s.dirY) * this.m.h * 0.03;

    // shadow shrinks with height
    const hs = clamp(1 - h / 220, 0.45, 1);
    this.shadow.setScale(this.shadowBase * hs * entryScale);
    this.shadow.setAlpha(0.35 + 0.65 * hs);
    const status = this.status.clear();
    if (this.scene.actions?.target === s) {
      status.lineStyle(3.5, 0x76e4f4, 1);
      status.strokeEllipse(0, 2, s.r * 2.8, s.r * 1.65);
      status.lineStyle(1.5, 0xfff8e7, .9);
      status.strokeEllipse(0, 2, s.r * 3.1, s.r * 1.85);
    }
    const warning = s.attackWarn > 0 && s.stunT <= 0 && !s.def.isBoss;
    this.attackIcon.setVisible(warning);
    if (warning) {
      this.attackIcon.setPosition(0, -this.m.h * sy - h - 20);
      status.lineStyle(3, 0xff8195, .9);
      status.strokeEllipse(0, 2, s.r * 2.5, s.r * 1.5);
      status.fillStyle(0xff8195, .15 + .2 * s.attackWarn);
      status.fillEllipse(0, 2, s.r * 2.4 * s.attackWarn, s.r * 1.4 * s.attackWarn);
    }
    if (s.stunT > 0) {
      status.lineStyle(2, 0x76e4f4, .9);
      status.strokeCircle(0, -this.m.h - h - 12, 8);
    }

    // face expression
    if (s.hurtT > 0) this.setFace(`${this.faceKey}_hurt`);
    else if (s.blinking > 0 || s.state === 'celebrate') this.setFace(`${this.faceKey}_blink`);
    else this.setFace(this.faceKey);

    // flash / frost tint
    if (s.flashT > 0) {
      this.bodyImg.setTintFill(0xffffff);
    } else if (s.slowTimer > 0) {
      this.bodyImg.setTint(0xb5e6ff);
    } else {
      this.bodyImg.clearTint();
    }
    const frosty = s.slowTimer > 0;
    this.frost.setVisible(frosty);
    if (frosty) {
      this.frost.rotation = time * 2;
      this.frost.y = -this.m.h * 0.95 - h;
    }

    // hp bar
    const showBar = !s.def.isBoss && s.hp < s.maxHp && s.hp > 0;
    this.hpBg.setVisible(showBar);
    this.hpFill.setVisible(showBar);
    if (showBar) {
      const ratio = clamp(s.hp / s.maxHp, 0, 1);
      this.hpFill.setDisplaySize(Math.max(1, this.barW * ratio), 4.5);
      this.hpFill.setTint(ratio > 0.5 ? 0x7dff9a : ratio > 0.25 ? 0xffd23f : 0xff5c7a);
      const by = -this.m.h * sy - 14 - h;
      this.hpBg.y = by;
      this.hpFill.y = by;
    }
  }

  /**
   * Death pop: squash -> stretch outward -> vanish. `onPop` fires at the
   * moment the slime bursts (for particles); the view destroys itself after.
   */
  playDeath(onPop, style = 'normal') {
    this.dying = true;
    this.hpBg.setVisible(false);
    this.hpFill.setVisible(false);
    this.frost.setVisible(false);
    this.status.clear();
    this.attackIcon.setVisible(false);
    if (this.exclaim) this.exclaim.setVisible(false);
    this.setFace(`${this.faceKey}_hurt`);
    this.bodyImg.setTintFill(0xffffff);
    const tweens = this.scene.tweens;
    const body = this.body;
    body.rotation = 0;

    if (style === 'split') {
      // strong jelly wobble, then a wide stretch before popping into two
      this.bodyImg.clearTint();
      tweens.chain({
        targets: body,
        tweens: [
          { scaleX: 1.3, scaleY: 0.75, duration: 70, ease: 'Sine.easeOut' },
          { scaleX: 0.8, scaleY: 1.25, duration: 70, ease: 'Sine.easeInOut' },
          { scaleX: 1.25, scaleY: 0.8, duration: 70, ease: 'Sine.easeInOut' },
          { scaleX: 1.7, scaleY: 0.6, duration: 90, ease: 'Quad.easeIn' },
        ],
        onComplete: () => {
          onPop && onPop();
          this.destroy();
        },
      });
      return;
    }

    if (style === 'boss') {
      // long dramatic wobble with flashes
      let flashes = 0;
      const ev = this.scene.time.addEvent({
        delay: 110,
        repeat: 11,
        callback: () => {
          flashes++;
          if (flashes % 2) this.bodyImg.setTintFill(0xffffff);
          else this.bodyImg.clearTint();
        },
      });
      tweens.chain({
        targets: body,
        tweens: [
          { scaleX: 1.15, scaleY: 0.85, duration: 120, yoyo: true, repeat: 4, ease: 'Sine.easeInOut' },
          { scaleX: 0.75, scaleY: 1.3, duration: 180, ease: 'Quad.easeOut' },
          { scaleX: 1.8, scaleY: 0.4, duration: 160, ease: 'Quad.easeIn' },
        ],
        onComplete: () => {
          ev.remove();
          onPop && onPop();
          this.destroy();
        },
      });
      return;
    }

    tweens.chain({
      targets: body,
      tweens: [
        { scaleX: 1.45, scaleY: 0.6, duration: 70, ease: 'Quad.easeOut' },
        { scaleX: 1.65, scaleY: 1.5, alpha: 0, duration: 90, ease: 'Quad.easeIn' },
      ],
      onComplete: () => this.destroy(),
    });
    this.scene.time.delayedCall(70, () => onPop && onPop());
    tweens.add({ targets: this.shadow, alpha: 0, duration: 160 });
  }

  /** World position of the body centre (for projectile aiming). */
  aimY() {
    return this.slime.y - this.m.h * 0.45 + this.body.y;
  }

  destroy() {
    if (this.root) {
      this.root.destroy();
      this.root = null;
    }
  }
}
