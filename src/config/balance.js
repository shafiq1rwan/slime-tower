// =====================================================================
// Balance data. Everything a designer may want to tweak lives here.
// Units: distances in world units (arena radius = 440), time in seconds.
// =====================================================================

export const TOWER = {
  maxHp: 200,
  damage: 10,
  attackInterval: 0.7, // seconds between volleys
  range: 264, // ~60% of the arena radius
  projectileSpeed: 560,
  critChance: 0,
  critMultiplier: 2,
  extraProjectiles: 0,
};

export const PULSE = { cooldown: 9, radius: 205, push: 105, stun: .65 };

// Per-type slime definitions.
//   hop: visual bounce profile (see utils/animationUtils.js#hopPose)
//   hopRate: hop cycles per second at full speed
export const ENEMIES = {
  basic: {
    name: 'Basic Slime',
    color: 0x7ee05a,
    hp: 20,
    damage: 5,
    speed: 44,
    radius: 26,
    attackInterval: 1.6,
    score: 10,
    knockbackResist: 0,
    hopRate: 1.55,
    hop: { height: 22, squash: 0.22, stretch: 0.2, anticip: 0.18, air: 0.5, lean: 0.16, wobble: 0.03 },
  },
  speed: {
    name: 'Speed Slime',
    color: 0xffd93b,
    hp: 12,
    damage: 4,
    speed: 86,
    radius: 20,
    attackInterval: 1.3,
    score: 12,
    knockbackResist: 0,
    hopRate: 2.7,
    hop: { height: 14, squash: 0.2, stretch: 0.26, anticip: 0.12, air: 0.56, lean: 0.26, wobble: 0.025 },
  },
  heavy: {
    name: 'Heavy Slime',
    color: 0x4f9dff,
    hp: 80,
    damage: 12,
    speed: 29,
    radius: 38,
    attackInterval: 2.1,
    score: 30,
    knockbackResist: 0.75,
    hopRate: 0.85,
    landingDust: true,
    hop: { height: 26, squash: 0.32, stretch: 0.14, anticip: 0.26, air: 0.44, lean: 0.08, wobble: 0.02 },
  },
  split: {
    name: 'Split Slime',
    color: 0xb36bff,
    hp: 35,
    damage: 6,
    speed: 46,
    radius: 30,
    attackInterval: 1.5,
    score: 18,
    knockbackResist: 0.2,
    hopRate: 1.4,
    splitInto: 'mini',
    splitCount: 2,
    hop: { height: 20, squash: 0.26, stretch: 0.22, anticip: 0.18, air: 0.48, lean: 0.14, wobble: 0.06 },
  },
  // Children of split slimes. They have no splitInto, so splitting cannot recurse.
  mini: {
    name: 'Mini Slime',
    color: 0xd29bff,
    hp: 12,
    damage: 3,
    speed: 60,
    radius: 18,
    attackInterval: 1.4,
    score: 6,
    knockbackResist: 0,
    hopRate: 2.1,
    hop: { height: 14, squash: 0.22, stretch: 0.22, anticip: 0.15, air: 0.52, lean: 0.2, wobble: 0.05 },
  },
  boss: {
    name: 'Slime King',
    color: 0xff6fbf,
    hp: 2300,
    damage: 14,
    speed: 16,
    radius: 78,
    attackInterval: 1.8,
    score: 1000,
    knockbackResist: 1,
    hopRate: 0.62,
    landingDust: true,
    isBoss: true,
    hop: { height: 46, squash: 0.3, stretch: 0.16, anticip: 0.3, air: 0.42, lean: 0.06, wobble: 0.02 },
  },
};

export const BOSS = {
  summonInterval: 7.5,
  summonFirstDelay: 4,
  summonTypes: ['basic', 'speed', 'basic'],
  maxMinions: 10,
  jumpInterval: 9,
  jumpFirstDelay: 8,
  jumpWindup: 0.75,
  jumpDuration: 0.9,
  jumpDistance: 90,
  jumpHeight: 170,
  jumpDamage: 22, // dealt if the boss lands next to the tower
  hpBarDelay: 0.4,
};

// Difficulty scaling per wave (wave index starts at 1).
// HP scaling starts after wave 3 so early slimes stay at clean 2-hit breakpoints.
export const SCALING = {
  hp: (wave) => 1 + 0.15 * Math.max(0, wave - 3),
  damage: (wave) => 1 + 0.05 * (wave - 1),
  speed: (wave) => 1 + 0.012 * (wave - 1),
};

// Wave definitions. Each group spawns `count` slimes of `type` every `interval`
// seconds, starting `delay` seconds after the wave begins.
export const WAVES = [
  /* 1 */ [{ type: 'basic', count: 6, interval: 1.35, delay: 0 }],
  /* 2 */ [
    { type: 'basic', count: 8, interval: 1.2, delay: 0 },
    { type: 'speed', count: 2, interval: 1.8, delay: 4 },
  ],
  /* 3 */ [
    { type: 'basic', count: 7, interval: 1.7, delay: 0 },
    { type: 'speed', count: 5, interval: 2.0, delay: 6 },
  ],
  /* 4 */ [
    { type: 'basic', count: 8, interval: 1.6, delay: 0 },
    { type: 'heavy', count: 2, interval: 8, delay: 5 },
    { type: 'speed', count: 4, interval: 1.6, delay: 10 },
  ],
  /* 5 */ [
    { type: 'basic', count: 10, interval: 1.2, delay: 0 },
    { type: 'speed', count: 8, interval: 1.1, delay: 3 },
    { type: 'heavy', count: 2, interval: 6, delay: 5 },
  ],
  /* 6 */ [
    { type: 'split', count: 5, interval: 2.8, delay: 0 },
    { type: 'basic', count: 10, interval: 1.2, delay: 1.5 },
  ],
  /* 7 */ [
    { type: 'speed', count: 18, interval: 0.6, delay: 1 },
    { type: 'basic', count: 6, interval: 1.6, delay: 0 },
    { type: 'split', count: 2, interval: 4, delay: 7 },
  ],
  /* 8 */ [
    { type: 'heavy', count: 6, interval: 3, delay: 0 },
    { type: 'basic', count: 10, interval: 1.2, delay: 1.5 },
    { type: 'split', count: 3, interval: 3.5, delay: 5 },
  ],
  /* 9 */ [
    { type: 'basic', count: 12, interval: 1.0, delay: 0 },
    { type: 'speed', count: 10, interval: 0.85, delay: 3 },
    { type: 'heavy', count: 3, interval: 4.5, delay: 4 },
    { type: 'split', count: 4, interval: 3, delay: 7 },
  ],
  /* 10 */ [
    { type: 'basic', count: 20, interval: 0.6, delay: 0 },
    { type: 'speed', count: 14, interval: 0.7, delay: 4 },
    { type: 'split', count: 5, interval: 2.4, delay: 6 },
    { type: 'heavy', count: 2, interval: 5, delay: 8 },
  ],
  /* 11 */ [
    { type: 'heavy', count: 5, interval: 3.4, delay: 0 },
    { type: 'split', count: 6, interval: 2.4, delay: 2 },
    { type: 'speed', count: 16, interval: 0.7, delay: 4 },
    { type: 'basic', count: 16, interval: 0.85, delay: 3 },
  ],
  /* 12 — boss */ [
    { type: 'boss', count: 1, interval: 0, delay: 0 },
    { type: 'basic', count: 8, interval: 2, delay: 5 },
    { type: 'speed', count: 6, interval: 2.2, delay: 10 },
    { type: 'split', count: 3, interval: 5, delay: 12 },
    { type: 'heavy', count: 2, interval: 9, delay: 16 },
  ],
];

export const TOTAL_WAVES = WAVES.length;
export const BOSS_WAVE = TOTAL_WAVES;

export const SCORE = {
  waveClear: (wave) => 40 * wave,
  victoryHpBonus: 5, // per remaining tower HP
};

// ---------------------------------------------------------------------
// Upgrades — data-driven. `stats(level)` returns the tower stat changes
// at a given level; Tower.recomputeStats() folds all upgrade levels together.
// ---------------------------------------------------------------------
export const UPGRADES = [
  {
    id: 'rapid',
    name: 'Rapid Fire',
    icon: 'rapid',
    color: '#ffd23f',
    max: 6,
    weight: 10,
    describe: () => 'Attack speed <b>+15%</b>. Brighter, faster volleys.',
  },
  {
    id: 'power',
    name: 'Power Crystal',
    icon: 'power',
    color: '#ff7a59',
    max: 6,
    weight: 10,
    describe: () => 'Tower damage <b>+20%</b>. Bigger, stronger bolts.',
  },
  {
    id: 'split',
    name: 'Split Shot',
    icon: 'split',
    color: '#5fe3ff',
    max: 3,
    weight: 8,
    describe: () => 'Fire <b>+1 projectile</b> at a different slime.',
  },
  {
    id: 'chain',
    name: 'Chain Lightning',
    icon: 'chain',
    color: '#a8c8ff',
    max: 3,
    weight: 7,
    describe: (lvl) =>
      lvl === 0
        ? 'Hits <b>chain</b> to a nearby slime for 60% damage.'
        : `Lightning chains to <b>${lvl + 1} slimes</b>.`,
  },
  {
    id: 'frost',
    name: 'Frost Core',
    icon: 'frost',
    color: '#9fe9ff',
    max: 3,
    weight: 7,
    describe: (lvl) => `Hits <b>slow</b> slimes by ${30 + lvl * 10}% for ${1.5 + lvl * 0.5}s.`,
  },
  {
    id: 'splash',
    name: 'Splash Burst',
    icon: 'splash',
    color: '#ffb84a',
    max: 3,
    weight: 7,
    describe: (lvl) => `Impacts burst for <b>${40 + lvl * 12}% area damage</b>.`,
  },
  {
    id: 'heal',
    name: 'Healing Pulse',
    icon: 'heal',
    color: '#6ff2b0',
    max: Infinity,
    weight: 6,
    describe: () => 'Restore <b>30 HP</b> to the tower.',
  },
  {
    id: 'crit',
    name: 'Critical Spark',
    icon: 'crit',
    color: '#ffe066',
    max: 4,
    weight: 7,
    describe: () => '<b>+12% chance</b> to deal double damage.',
  },
  {
    id: 'reach',
    name: 'Long Reach',
    icon: 'reach',
    color: '#c39bff',
    max: 4,
    weight: 6,
    describe: () => 'Attack range <b>+14%</b>.',
  },
];

// Numeric effect of each upgrade at a given level (level 0 = not owned).
export const UPGRADE_EFFECTS = {
  rapid: (l) => ({ attackSpeedMult: Math.pow(1.15, l) }),
  power: (l) => ({ damageMult: Math.pow(1.2, l) }),
  split: (l) => ({ extraProjectiles: l }),
  chain: (l) => ({ chainJumps: l, chainDamage: 0.6, chainRange: 150 }),
  frost: (l) => (l > 0 ? { slow: 0.3 + 0.1 * (l - 1), slowDuration: 1.5 + 0.5 * (l - 1) } : { slow: 0, slowDuration: 0 }),
  splash: (l) => (l > 0 ? { splashRadius: 62 + 14 * (l - 1), splashDamage: 0.4 + 0.12 * (l - 1) } : { splashRadius: 0, splashDamage: 0 }),
  crit: (l) => ({ critChance: 0.12 * l }),
  reach: (l) => ({ rangeMult: 1 + 0.14 * l }),
  heal: () => ({}),
};

export const HEAL_AMOUNT = 30;

// Tower visual evolution thresholds (wave number at which each tier begins).
export const TOWER_TIERS = [1, 4, 8, 12];
