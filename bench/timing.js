'use strict';

/**
 * Frame-rate-independence measurement, shared between test/frame-rate.test.js and
 * bench/run.js so the assertions and the human-readable report use the exact same
 * replay logic.
 */

const GestureLibrary = require('../gesture-lib/gesture-library.js');
const { forwardPose } = require('../test/helpers.js');

/**
 * Replay a static 'forward' pose at a fixed frame rate using explicit timestamps,
 * and report when the gesture first fires — both in wall-clock milliseconds and in
 * frame count.
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

module.exports = { holdUntilFire };
