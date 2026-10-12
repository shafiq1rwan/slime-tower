import test from 'node:test';
import assert from 'node:assert/strict';
import { CombatActions, inTowerRange } from '../src/systems/CombatActions.js';
import { ENEMIES, PULSE } from '../src/config/balance.js';
import { entrancePose, spawnPosition, SPAWN_WARNING } from '../src/utils/spawnLayout.js';
import { WaveManager } from '../src/systems/WaveManager.js';

const tower = () => ({ x: 0, y: 0, alive: true, stats: { range: 264 } });
const slime = (x, type = 'basic') => ({
  x, y: 0, z: 0, r: ENEMIES[type].radius, def: ENEMIES[type], alive: true, targetable: true,
  kbx: 0, kby: 0, jig: { v: 0 }, lungeT: .2, attackCd: 0, stunT: 0,
});
test('Pulse interrupts attacks only inside its range and recharges on simulation time', () => {
  const actions = new CombatActions(tower());
  const near = slime(90), far = slime(350), emerging = slime(100);
  emerging.targetable = false;
  const result = actions.pulse([near, far, emerging]);
  assert.deepEqual(result.map(h => h.enemy), [near]);
  assert.equal(near.lungeT, -1);
  assert.equal(near.stunT, PULSE.stun);
  assert.ok(near.kbx > 0);
  assert.equal(far.kbx, 0);
  assert.equal(actions.pulse([near]), null);
  actions.update(0);
  assert.equal(actions.cooldown, PULSE.cooldown);
  actions.update(PULSE.cooldown);
  assert.ok(actions.pulse([]));
});
test('Pulse cancels a boss windup but respects airborne leaps and knockback resistance', () => {
  const actions = new CombatActions(tower());
  const boss = slime(120, 'boss');
  boss.boss = { phase: 'windup', t: .2 };
  assert.equal(actions.pulse([boss])[0].interrupted, true);
  assert.equal(boss.boss.phase, 'recover');
  assert.equal(boss.boss.interrupted, true);
  assert.equal(boss.kbx, 0);
  actions.update(PULSE.cooldown);
  boss.boss.phase = 'leap';
  boss.stunT = 0;
  assert.equal(actions.pulse([boss]).length, 0);
  assert.equal(boss.stunT, 0);
});
test('Marked enemies persist while approaching, toggle, and clear when dead', () => {
  const t = tower(), actions = new CombatActions(t), e = slime(400);
  assert.equal(actions.mark(e), true);
  assert.equal(t.priorityTarget, e);
  assert.equal(inTowerRange(t, e), false);
  e.x = 200;
  assert.equal(inTowerRange(t, e), true);
  actions.mark(e);
  assert.equal(actions.target, null);
  actions.mark(e); e.alive = false; actions.update(.01);
  assert.equal(t.priorityTarget, null);
  assert.equal(actions.mark(e), false);
});
test('Rift entrance remains bounded, starts small at ground level, and lands exactly', () => {
  const start = entrancePose(0), end = entrancePose(100);
  assert.equal(start.z, 0); assert.equal(start.alpha, 0); assert.equal(start.scale, .25);
  assert.equal(end.u, 1); assert.ok(end.z < 1e-8); assert.equal(end.scale, 1);
  for (let wave = 1; wave <= 12; wave++) {
    for (let i = 0; i < 30; i++) {
      const point = spawnPosition(wave, 0, i);
      assert.ok(Math.abs(Math.hypot(point.x, point.y) - 430) < .001);
      assert.ok(point.gate >= 0 && point.gate < 6);
    }
  }
  assert.equal(spawnPosition(1, 0, 0).gate, spawnPosition(1, 0, 2).gate);
  assert.notEqual(spawnPosition(1, 0, 0).gate, spawnPosition(1, 0, 3).gate);
});
test('Wave queue warns before arrivals, counts warned enemies, and cancels cleanly', () => {
  const warned = [], spawned = [];
  let cleared = 0;
  const scene = { spawnEffects: { warn: (...args) => warned.push(args), clear: () => cleared++ }, spawnSlime: (...args) => spawned.push(args) };
  const waves = new WaveManager(scene);
  waves.start(1);
  const total = waves.remainingToSpawn;
  waves.update(.01);
  assert.equal(warned.length, 1); assert.equal(spawned.length, 0);
  assert.equal(waves.remainingToSpawn, total);
  waves.update(SPAWN_WARNING);
  assert.equal(spawned.length, 1);
  assert.equal(waves.remainingToSpawn, total - 1);
  waves.clear(); waves.update(100);
  assert.equal(spawned.length, 1); assert.equal(waves.remainingToSpawn, 0); assert.equal(cleared, 1);
});
