import { WORLD } from '../config/gameConfig.js';

export const SPAWN_WARNING = .65;
export const ENTRY_DURATION = .5;
export const GATE_COUNT = 6;
export const gateAngle = (gate) => -Math.PI / 2 + (gate % GATE_COUNT) * Math.PI * 2 / GATE_COUNT;
export function spawnPosition(wave, group, index) {
  // Three arrivals per front, then move to the next rift. Later groups flank.
  const gate = (wave - 1 + group * 2 + Math.floor(index / 3)) % GATE_COUNT;
  const a = gateAngle(gate) + ((index % 3) - 1) * .065;
  const radius = WORLD.ARENA_RADIUS - 10;
  return { x: Math.cos(a) * radius, y: Math.sin(a) * radius, gate };
}
export function entrancePose(t, duration = ENTRY_DURATION, height = 18) {
  const u = Math.max(0, Math.min(1, t / duration));
  const ease = u * u * (3 - 2 * u);
  const smooth = (v) => v * v * (3 - 2 * v);
  return { u, travel: ease * 24, z: Math.sin(Math.PI * u) * height, scale: .25 + .75 * smooth(Math.min(1, u / .45)), alpha: smooth(Math.min(1, u / .25)) };
}
