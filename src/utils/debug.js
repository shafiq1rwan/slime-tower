// URL-driven debug switches (harmless in production):
//   ?speed=4    run the simulation faster
//   ?wave=12    start at a given wave
//   ?auto=1     auto-pick upgrades and auto-continue (used for balance runs)
//   ?debug=1    expose internals on window.__LTS
const params = new URLSearchParams(typeof location !== 'undefined' ? location.search : '');

const num = (key, def) => {
  const v = parseFloat(params.get(key));
  return Number.isFinite(v) ? v : def;
};

export const DEBUG = {
  enabled: params.has('debug'),
  timeScale: Math.max(0.1, Math.min(20, num('speed', 1))),
  startWave: Math.max(1, Math.floor(num('wave', 1))),
  auto: params.get('auto') || '',
  skipMenu: params.has('play'),
};
