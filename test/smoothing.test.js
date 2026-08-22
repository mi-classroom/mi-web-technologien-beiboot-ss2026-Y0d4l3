'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');

const GestureLibrary = require('../gesture-lib/gesture-library.js');
const { forwardPose, baseFrame } = require('./helpers.js');

function holdUntilFire(smoothing, fps = 30, maxMs = 6000) {
  const lib = new GestureLibrary({ smoothing });
  lib.useDefaults();

  const dt = 1000 / fps;
  const frame = forwardPose();
  let ts = 0;
  let fired = null;
  lib.addEventListener('gesture', e => {
    if (!fired) fired = { atMs: ts, name: e.detail.name };
  });
  while (!fired && ts <= maxMs) {
    lib.update(frame, ts);
    if (!fired) ts += dt;
  }
  return fired;
}

test('moving average is the default smoothing strategy', () => {
  const lib = new GestureLibrary();
  assert.equal(lib.smoothing, 'movingAverage');
});

test('oneEuro smoothing detects a held gesture end-to-end', () => {
  const fired = holdUntilFire('oneEuro');
  assert.ok(fired, 'gesture should fire with oneEuro smoothing');
  assert.equal(fired.name, 'forward');
  // Constant pose ⇒ the filter seeds to the raw value immediately, so the hold
  // still completes at ~1 s, like the moving-average path.
  assert.ok(Math.abs(fired.atMs - 1000) < 100, `fired at ${fired.atMs} ms`);
});

test('both smoothing strategies stay silent on a neutral pose', () => {
  for (const smoothing of ['movingAverage', 'oneEuro']) {
    const lib = new GestureLibrary({ smoothing });
    lib.useDefaults();
    let fired = false;
    lib.addEventListener('gesture', () => {
      fired = true;
    });
    const frame = baseFrame();
    for (let ts = 0; ts < 3000; ts += 1000 / 30) lib.update(frame, ts);
    assert.equal(fired, false, `${smoothing} must stay silent on neutral pose`);
  }
});
