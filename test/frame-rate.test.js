'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');

const GestureLibrary = require('../gesture-lib/gesture-library.js');
const { forwardPose } = require('./helpers.js');

/**
 * Replay a static pose at a fixed frame rate using explicit timestamps, and report
 * when the gesture first fires — both in wall-clock milliseconds and in frame count.
 */
function holdUntilFire(fps, { maxMs = 6000 } = {}) {
  const lib = new GestureLibrary();
  lib.useDefaults();

  const dt = 1000 / fps;
  const frame = forwardPose();
  let ts = 0;
  let calls = 0;
  let fired = null;

  lib.addEventListener('gesture', e => {
    if (!fired) fired = { atMs: ts, calls, name: e.detail.name };
  });

  while (!fired && ts <= maxMs) {
    calls++;
    lib.update(frame, ts);
    if (!fired) ts += dt;
  }
  return fired;
}

// 'forward' resolves to holdMs = 1000 (30 frames at the nominal 30 fps). With real
// timestamps the hold must complete after ~1 s of wall-clock time regardless of the
// frame rate — not after a fixed number of frames. The frame-based predecessor fired
// after 30 frames unconditionally, i.e. ~1 s at 30 fps but ~2 s at 15 fps.

test('hold fires at the same wall-clock time across frame rates', () => {
  const at30 = holdUntilFire(30);
  const at15 = holdUntilFire(15);

  assert.equal(at30.name, 'forward');
  assert.equal(at15.name, 'forward');

  // Same wall-clock duration (~1000 ms) at both frame rates.
  assert.ok(Math.abs(at30.atMs - 1000) < 1, `30 fps fired at ${at30.atMs} ms`);
  assert.ok(Math.abs(at15.atMs - 1000) < 1, `15 fps fired at ${at15.atMs} ms`);
  assert.ok(
    Math.abs(at30.atMs - at15.atMs) < 1,
    'wall-clock trigger time is frame-rate independent'
  );
});

test('lower frame rate reaches the same hold in fewer frames', () => {
  const at30 = holdUntilFire(30);
  const at15 = holdUntilFire(15);

  // Roughly half as many frames at half the frame rate — proof the trigger is driven
  // by elapsed time, not by a fixed frame count.
  assert.ok(at15.calls < at30.calls, 'fewer frames needed at 15 fps');
  assert.ok(at30.calls / at15.calls > 1.7, `frame-count ratio ${at30.calls}/${at15.calls}`);
});

test('a very low frame rate still triggers near the target duration', () => {
  // 10 fps → dt 100 ms, still under the 250 ms maxFrameGapMs clamp, so timing holds.
  const at10 = holdUntilFire(10);
  assert.equal(at10.name, 'forward');
  assert.ok(Math.abs(at10.atMs - 1000) < 100, `10 fps fired at ${at10.atMs} ms`);
});
