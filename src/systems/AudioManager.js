import { settings } from './Settings.js';
import { bus } from './EventBus.js';

// =====================================================================
// Procedural sound effects via the Web Audio API — no audio files needed.
// - The AudioContext is created/resumed on the first user gesture
//   (required by mobile browsers).
// - Every sound has a minimum re-trigger interval and there is a global
//   voice cap, so 40 slimes popping at once stays pleasant.
// =====================================================================

const MAX_VOICES = 14;

// Minimum seconds between two plays of the same sound.
const THROTTLE = {
  pew: 0.07,
  pop: 0.05,
  plop: 0.045,
  boing: 0.22,
  squish: 0.25,
  zap: 0.09,
  ice: 0.12,
  splash: 0.1,
  hurt: 0.12,
  chime: 0.1,
  boss: 0.5,
  thud: 0.25,
  crit: 0.08,
  spawn: 0.15,
  click: 0.04,
};

class AudioManagerClass {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.voices = 0;
    this.last = Object.create(null);
    this.enabled = settings.get('sound');
    this.noiseBuffer = null;
    bus.on('settings:changed', (key, value) => {
      if (key === 'sound') {
        this.enabled = value;
        if (this.master) this.master.gain.value = value ? 0.55 : 0;
      }
    });
  }

  /** Call from any user gesture. Safe to call repeatedly. */
  unlock() {
    try {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC();
        const comp = this.ctx.createDynamicsCompressor();
        comp.threshold.value = -14;
        comp.ratio.value = 6;
        this.master = this.ctx.createGain();
        this.master.gain.value = this.enabled ? 0.55 : 0;
        this.master.connect(comp);
        comp.connect(this.ctx.destination);
        // 1 second of white noise reused by all noisy sounds
        const len = this.ctx.sampleRate;
        this.noiseBuffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const data = this.noiseBuffer.getChannelData(0);
        for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      }
      if (this.ctx.state === 'suspended') this.ctx.resume();
    } catch (e) {
      this.ctx = null;
    }
  }

  suspend() {
    if (this.ctx && this.ctx.state === 'running') this.ctx.suspend();
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }

  play(name, opts) {
    if (!this.enabled || !this.ctx || this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime;
    const gap = THROTTLE[name] ?? 0.05;
    if (this.last[name] && now - this.last[name] < gap) return;
    if (this.voices >= MAX_VOICES) return;
    this.last[name] = now;
    const fn = SOUNDS[name];
    if (fn) fn(this, now, opts || {});
  }

  // ---------------------------------------------------------- primitives
  _voice(node, stopAt) {
    this.voices++;
    node.onended = () => {
      this.voices = Math.max(0, this.voices - 1);
    };
    node.stop(stopAt);
  }

  tone(t, { type = 'sine', f0 = 440, f1 = f0, dur = 0.12, vol = 0.2, attack = 0.005, curve = 'exp', delay = 0, dest }) {
    const ctx = this.ctx;
    const start = t + delay;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(20, f0), start);
    if (f1 !== f0) {
      if (curve === 'exp') osc.frequency.exponentialRampToValueAtTime(Math.max(20, f1), start + dur);
      else osc.frequency.linearRampToValueAtTime(f1, start + dur);
    }
    g.gain.setValueAtTime(0.0001, start);
    g.gain.linearRampToValueAtTime(vol, start + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    osc.connect(g);
    g.connect(dest || this.master);
    osc.start(start);
    this._voice(osc, start + dur + 0.02);
    return osc;
  }

  noise(t, { dur = 0.1, vol = 0.15, filter = 'lowpass', freq = 1200, freq1 = freq, q = 1, delay = 0 }) {
    const ctx = this.ctx;
    const start = t + delay;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const f = ctx.createBiquadFilter();
    f.type = filter;
    f.Q.value = q;
    f.frequency.setValueAtTime(freq, start);
    if (freq1 !== freq) f.frequency.exponentialRampToValueAtTime(Math.max(30, freq1), start + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, start);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    src.connect(f);
    f.connect(g);
    g.connect(this.master);
    src.start(start, Math.random() * 0.5);
    this._voice(src, start + dur + 0.02);
  }
}

const jitter = (v, amt = 0.08) => v * (1 + (Math.random() * 2 - 1) * amt);

// Sound recipes. Keep them short, soft and cute.
const SOUNDS = {
  pew(a, t, o) {
    const base = jitter(980, 0.06) * (o.pitch || 1);
    a.tone(t, { type: 'triangle', f0: base, f1: base * 0.42, dur: 0.09, vol: 0.09 });
    a.tone(t, { type: 'sine', f0: base * 2, f1: base * 0.9, dur: 0.05, vol: 0.04 });
  },
  pop(a, t) {
    const f = jitter(720, 0.15);
    a.tone(t, { type: 'sine', f0: f, f1: f * 0.45, dur: 0.06, vol: 0.12 });
  },
  crit(a, t) {
    a.tone(t, { type: 'square', f0: 1400, f1: 700, dur: 0.07, vol: 0.05 });
    a.tone(t, { type: 'sine', f0: 1800, f1: 2400, dur: 0.1, vol: 0.07, delay: 0.02 });
  },
  plop(a, t, o) {
    const big = o.big ? 0.6 : 1;
    const f = jitter(520, 0.12) * big;
    a.tone(t, { type: 'sine', f0: f, f1: f * 0.3, dur: 0.14, vol: 0.18 });
    a.tone(t, { type: 'sine', f0: f * 1.9, f1: f * 2.6, dur: 0.06, vol: 0.06, delay: 0.03 });
    a.noise(t, { dur: 0.06, vol: 0.05, freq: 1800, freq1: 400 });
  },
  boing(a, t, o) {
    const f = jitter(200, 0.1) * (o.pitch || 1);
    const osc = a.tone(t, { type: 'sine', f0: f, f1: f * 2.4, dur: 0.22, vol: 0.12, curve: 'exp' });
    // vibrato for that springy wobble
    const lfo = a.ctx.createOscillator();
    const lg = a.ctx.createGain();
    lfo.frequency.value = 28;
    lg.gain.value = f * 0.15;
    lfo.connect(lg);
    lg.connect(osc.frequency);
    lfo.start(t);
    lfo.stop(t + 0.24);
  },
  squish(a, t, o) {
    const low = o.big ? 0.6 : 1;
    a.noise(t, { dur: 0.14, vol: 0.12, filter: 'lowpass', freq: 900 * low, freq1: 160 });
    a.tone(t, { type: 'sine', f0: 160 * low, f1: 60, dur: 0.16, vol: 0.16 });
  },
  thud(a, t) {
    a.tone(t, { type: 'sine', f0: 110, f1: 40, dur: 0.35, vol: 0.32 });
    a.noise(t, { dur: 0.25, vol: 0.18, freq: 500, freq1: 80 });
  },
  zap(a, t) {
    for (let i = 0; i < 3; i++) {
      a.tone(t, { type: 'sawtooth', f0: jitter(1600, 0.3), f1: jitter(500, 0.3), dur: 0.05, vol: 0.04, delay: i * 0.025 });
    }
    a.noise(t, { dur: 0.1, vol: 0.06, filter: 'bandpass', freq: 3000, q: 2 });
  },
  ice(a, t) {
    a.tone(t, { type: 'sine', f0: 1900, f1: 2100, dur: 0.18, vol: 0.05 });
    a.tone(t, { type: 'sine', f0: 2850, f1: 3000, dur: 0.12, vol: 0.035, delay: 0.03 });
  },
  splash(a, t) {
    a.noise(t, { dur: 0.18, vol: 0.09, filter: 'bandpass', freq: 1400, freq1: 300, q: 0.8 });
    a.tone(t, { type: 'sine', f0: 300, f1: 120, dur: 0.15, vol: 0.08 });
  },
  hurt(a, t) {
    a.tone(t, { type: 'square', f0: 220, f1: 110, dur: 0.12, vol: 0.06 });
    a.noise(t, { dur: 0.1, vol: 0.1, freq: 700, freq1: 200 });
  },
  chime(a, t) {
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
      a.tone(t, { type: 'sine', f0: f, dur: 0.35, vol: 0.1, delay: i * 0.06 });
      a.tone(t, { type: 'triangle', f0: f * 2, dur: 0.2, vol: 0.025, delay: i * 0.06 });
    });
  },
  heal(a, t) {
    [392, 523.25, 659.25, 783.99].forEach((f, i) => a.tone(t, { type: 'sine', f0: f, f1: f * 1.02, dur: 0.4, vol: 0.08, delay: i * 0.07 }));
  },
  click(a, t) {
    a.tone(t, { type: 'sine', f0: 900, f1: 1300, dur: 0.05, vol: 0.06 });
  },
  spawn(a, t) {
    a.tone(t, { type: 'sine', f0: 300, f1: 700, dur: 0.1, vol: 0.05 });
  },
  wave(a, t) {
    a.tone(t, { type: 'triangle', f0: 392, dur: 0.14, vol: 0.1 });
    a.tone(t, { type: 'triangle', f0: 587.33, dur: 0.22, vol: 0.1, delay: 0.12 });
  },
  cleared(a, t) {
    [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => a.tone(t, { type: 'triangle', f0: f, dur: 0.22, vol: 0.08, delay: i * 0.07 }));
  },
  boss(a, t) {
    a.tone(t, { type: 'sawtooth', f0: 98, f1: 65, dur: 1.0, vol: 0.12, curve: 'lin' });
    a.tone(t, { type: 'sawtooth', f0: 147, f1: 98, dur: 1.0, vol: 0.07, curve: 'lin' });
    a.tone(t, { type: 'sine', f0: 60, f1: 35, dur: 0.6, vol: 0.3 });
    a.noise(t, { dur: 0.5, vol: 0.12, freq: 400, freq1: 60 });
  },
  victory(a, t) {
    const notes = [523.25, 659.25, 783.99, 1046.5, 783.99, 1046.5, 1318.5];
    notes.forEach((f, i) => {
      const d = i < 4 ? i * 0.12 : 0.48 + (i - 4) * 0.16;
      a.tone(t, { type: 'triangle', f0: f, dur: i === notes.length - 1 ? 0.7 : 0.18, vol: 0.11, delay: d });
      a.tone(t, { type: 'sine', f0: f / 2, dur: 0.2, vol: 0.05, delay: d });
    });
  },
  gameover(a, t) {
    [392, 349.23, 311.13, 261.63].forEach((f, i) =>
      a.tone(t, { type: 'triangle', f0: f, f1: f * 0.97, dur: 0.32, vol: 0.1, delay: i * 0.2 })
    );
  },
  shatter(a, t) {
    a.noise(t, { dur: 0.5, vol: 0.2, filter: 'highpass', freq: 2500, freq1: 900 });
    for (let i = 0; i < 5; i++) a.tone(t, { type: 'sine', f0: jitter(2600, 0.3), dur: 0.15, vol: 0.04, delay: i * 0.04 });
  },
};

export const audio = new AudioManagerClass();
