import test from 'node:test';
import assert from 'node:assert/strict';
import { ENEMIES } from '../src/config/balance.js';
import { hopPose, hopSpeedFactor } from '../src/utils/animationUtils.js';

for (const [type, def] of Object.entries(ENEMIES)) {
  test(`${type}: continuous grounded/airborne transitions and stable body volume`, () => {
    const prof = def.hop;
    const boundaries = [prof.anticip, prof.anticip + prof.air, prof.anticip + prof.air + .14];
    for (const p of boundaries) {
      const before = hopPose(p - 1e-7, prof, 1, {});
      const after = hopPose(p + 1e-7, prof, 1, {});
      for (const key of ['h', 'sx', 'sy', 'air']) assert.ok(Math.abs(before[key] - after[key]) < .001, `${key} snaps at ${p}`);
      assert.ok(Math.abs(hopSpeedFactor(p - 1e-7, prof) - hopSpeedFactor(p + 1e-7, prof)) < .001);
    }
    const end = hopPose(1 - 1e-7, prof, 1, {});
    const start = hopPose(0, prof, 1, {});
    for (const key of ['h', 'sx', 'sy', 'air']) assert.ok(Math.abs(end[key] - start[key]) < .001);
    let averageSpeed = 0;
    for (let i = 0; i < 10000; i++) {
      const p = i / 10000;
      const pose = hopPose(p, prof, 1, {});
      assert.ok(pose.h >= 0 && pose.h <= prof.height + .001);
      assert.ok(pose.sy > .5 && pose.sx > .5);
      assert.ok(Math.abs(pose.sx * pose.sx * pose.sy - 1) < 1e-8);
      averageSpeed += hopSpeedFactor(p, prof) / 10000;
    }
    assert.ok(Math.abs(averageSpeed - 1) < .001, 'Changing animation must preserve average enemy speed');
    assert.deepEqual(hopPose(.5, prof, 0, {}), { h: 0, sy: 1, sx: 1, air: hopPose(.5, prof, 1, {}).air });
  });
}
