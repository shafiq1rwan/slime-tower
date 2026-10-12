// Global, non-balance configuration: world geometry, render depths and palette.
// All gameplay happens in a fixed logical world centred on the tower at (0, 0).
// The camera zooms so that VIEW_RADIUS always fits the available screen area,
// which keeps the game equally fair in portrait, landscape and on any DPI.

export const WORLD = {
  ARENA_RADIUS: 440, // edge of the walkable battlefield
  SPAWN_RADIUS: 468, // slimes appear on this ring
  VIEW_RADIUS: 510, // radius guaranteed to be visible on screen
  VIEW_CENTER_Y: -18, // bodies extend upwards, so frame slightly above the tower
  TOWER_RADIUS: 46, // tower collision radius (ground footprint)
  CRYSTAL_Y: -122, // crystal height above the tower origin (projectile origin)
};

// Generated textures are drawn at this multiple of world units so they stay crisp
// when the camera zooms in on large / high-DPI screens.
export const TEX_SCALE = 2;

// Render ordering. Entities use ENTITY + y so lower objects draw in front.
export const DEPTH = {
  GROUND: 0,
  DECAL: 4,
  RANGE: 6,
  SHADOW: 8,
  ENTITY: 1000,
  PROJECTILE: 3000,
  FX: 3100,
  FX_TOP: 3300,
  NUMBERS: 3500,
};

export const MAX_FRAME_DT = 1 / 20; // clamp huge frame gaps (tab switches etc.)
export const MAX_SIM_STEP = 1 / 30; // physics sub-step for debug time-scaling

export const COLORS = {
  grass: 0x8fd16a,
  grassLight: 0xa8e083,
  grassDark: 0x6fb552,
  magic: 0x5fe3ff,
  magicDeep: 0x2a8fe8,
  frost: 0xb8ecff,
  splash: 0xffc94a,
  lightning: 0xbfe6ff,
  heal: 0x6ff2b0,
  crit: 0xffd23f,
  damage: 0xffa94d,
  white: 0xffffff,
  navy: 0x1b2350,
};

// Hex string helpers for canvas drawing
export const toCss = (hex, alpha = 1) => {
  const r = (hex >> 16) & 255;
  const g = (hex >> 8) & 255;
  const b = hex & 255;
  return alpha >= 1 ? `rgb(${r},${g},${b})` : `rgba(${r},${g},${b},${alpha})`;
};
