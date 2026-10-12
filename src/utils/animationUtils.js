// Small, allocation-free animation helpers used by the procedural visuals.

export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const rand = (lo, hi) => lo + Math.random() * (hi - lo);
export const randInt = (lo, hi) => Math.floor(rand(lo, hi + 1));
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

export const easeOutQuad = (t) => 1 - (1 - t) * (1 - t);
export const easeInQuad = (t) => t * t;
export const easeOutBack = (t, s = 1.70158) => 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2);
export const easeOutElastic = (t) =>
  t === 0 || t === 1 ? t : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1;

/**
 * Damped spring integrator. Keeps `value` oscillating back toward 0.
 * Used for hit jiggles, crystal pulses and recoil. Frame-rate independent
 * enough for our step sizes (semi-implicit Euler).
 */
export function stepSpring(s, dt, stiffness = 320, damping = 14) {
  s.v += (-stiffness * s.x - damping * s.v) * dt;
  s.x += s.v * dt;
  return s.x;
}

/**
 * Hop pose for one slime at hop phase p in [0, 1).
 * Cycle: anticipation squash -> stretched take-off -> airborne arc ->
 * landing squash -> elastic recovery. Purely visual: the result is applied to
 * the slime's *view*, never to its collision circle.
 *
 * Writes into `out` = { h, sx, sy, air } to avoid allocations.
 */
export function hopPose(p, prof, amp, out) {
  const a = prof.anticip;
  const air = prof.air;
  const land = 0.14;
  const rest = 1 - a - air - land;
  let h = 0;
  let s = 0; // positive = stretch (taller), negative = squash
  let airborne = 0;

  if (p < a) {
    // Anticipation: sink down before jumping
    const u = p / a;
    s = -prof.squash * smoothstep(u);
  } else if (p < a + air) {
    // Airborne: parabolic arc, stretched on take-off and slightly on descent
    const u = (p - a) / air;
    h = 4 * u * (1 - u) * prof.height;
    // Start at exactly the anticipation pose, then release into the jump.
    // Both ends join the grounded poses without a one-frame scale snap.
    s = u < 0.2
      ? lerp(-prof.squash, prof.stretch, smoothstep(u / 0.2))
      : prof.stretch * (1 - smoothstep((u - 0.2) / 0.8));
    airborne = Math.sin(Math.PI * u);
  } else if (p < a + air + land) {
    // Landing impact: fast squash then release
    const u = (p - a - air) / land;
    s = -prof.squash * Math.pow(Math.sin(Math.PI * u), 2);
  } else {
    // Elastic recovery: damped wobble back to round
    const u = (p - a - air - land) / rest;
    s = prof.squash * 0.18 * Math.pow(Math.sin(u * Math.PI), 2) * (1 - u);
  }

  s *= amp;
  out.h = h * amp;
  // Rough volume preservation: stretching up makes the body thinner.
  out.sy = 1 + s;
  out.sx = 1 / Math.sqrt(out.sy);
  out.air = airborne;
  return out;
}

/** Gameplay speed multiplier across the hop cycle; averages to 1. Slimes surge while airborne. */
export function hopSpeedFactor(p, prof) {
  const a = prof.anticip;
  const air = prof.air;
  if (p >= a && p < a + air) {
    const u = (p - a) / air;
    // Continuous at takeoff/landing, with a cycle average of exactly 1.
    return 0.15 + ((0.85 * Math.PI) / (2 * air)) * Math.sin(Math.PI * u);
  }
  return 0.15;
}

const smoothstep = (t) => t * t * (3 - 2 * t);

/** Phase at which a slime lands (used to detect landing events). */
export const landPhase = (prof) => prof.anticip + prof.air;
