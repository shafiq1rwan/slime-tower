import { bus } from './EventBus.js';

// Persistent player settings. localStorage can be unavailable (private mode,
// blocked storage), so every access is guarded and defaults always work.
const KEY = 'lts-settings-v1';
const DEFAULTS = {
  sound: true,
  shake: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'off' : 'reduced', // 'full' | 'reduced' | 'off'
  reducedEffects: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
};

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch (e) {
    /* storage unavailable */
  }
  return { ...DEFAULTS };
}

const state = load();

export const settings = {
  get(key) {
    return state[key];
  },
  set(key, value) {
    state[key] = value;
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch (e) {
      /* ignore */
    }
    bus.emit('settings:changed', key, value);
  },
  /** Multiplier applied to camera shake intensity. */
  shakeScale() {
    return state.shake === 'full' ? 1 : state.shake === 'reduced' ? 0.4 : 0;
  },
};

// Best score is stored separately.
const BEST_KEY = 'lts-best-v1';
export function getBestScore() {
  try {
    return parseInt(localStorage.getItem(BEST_KEY) || '0', 10) || 0;
  } catch (e) {
    return 0;
  }
}
export function saveBestScore(score) {
  const best = getBestScore();
  if (score > best) {
    try {
      localStorage.setItem(BEST_KEY, String(score));
    } catch (e) {
      /* ignore */
    }
    return true;
  }
  return false;
}
