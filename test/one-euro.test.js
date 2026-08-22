'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');

const { OneEuroFilter } = require('../gesture-lib/one-euro.js');
const { makeRng, gaussian, stddev } = require('./helpers.js');

const DT = 1000 / 30; // 30 fps sampling period, in ms

test('a constant signal converges to the constant without drift', () => {
  const f = new OneEuroFilter({ minCutoff: 1, beta: 0 });
  let out = 0;
  for (let i = 0; i < 200; i++) out = f.filter(0.5, DT);
  assert.ok(Math.abs(out - 0.5) < 1e-6, `converged to ${out}`);
});

test('at rest, the filter reduces jitter substantially', () => {
  const rng = makeRng(42);
  const f = new OneEuroFilter({ minCutoff: 1, beta: 0 });

  const raw = [];
  const filtered = [];
  for (let i = 0; i < 600; i++) {
    const sample = 0.5 + 0.01 * gaussian(rng); // steady position + sensor noise
    raw.push(sample);
    filtered.push(f.filter(sample, DT));
  }

  // Compare residual jitter after a warm-up window.
  const rawJitter = stddev(raw.slice(100));
  const outJitter = stddev(filtered.slice(100));
  assert.ok(outJitter < rawJitter * 0.35, `jitter ${outJitter} vs raw ${rawJitter}`);
});

test('the filter tracks a step change and settles near the new value', () => {
  const f = new OneEuroFilter({ minCutoff: 1, beta: 0 });
  for (let i = 0; i < 30; i++) f.filter(0, DT); // settle at 0
  let out = 0;
  for (let i = 0; i < 30; i++) out = f.filter(1, DT); // ~1 s after the step
  assert.ok(out > 0.9, `settled at ${out} one second after the step`);
});

test('a higher beta reduces lag while the signal is moving', () => {
  const slow = new OneEuroFilter({ minCutoff: 1, beta: 0 });
  const fast = new OneEuroFilter({ minCutoff: 1, beta: 1.5 });

  // A steady ramp: constant speed, so the adaptive cutoff stays raised for `fast`.
  let lagSlow = 0;
  let lagFast = 0;
  let v = 0;
  for (let i = 0; i < 60; i++) {
    v += 0.01; // move 0.01 units per frame
    const os = slow.filter(v, DT);
    const of = fast.filter(v, DT);
    lagSlow = v - os;
    lagFast = v - of;
  }
  assert.ok(lagFast < lagSlow, `lag fast ${lagFast} should be < slow ${lagSlow}`);
  assert.ok(lagFast > 0, 'some lag remains');
});

test('reset() clears filter state', () => {
  const f = new OneEuroFilter({ minCutoff: 1, beta: 0 });
  for (let i = 0; i < 50; i++) f.filter(0.9, DT);
  f.reset();
  const first = f.filter(0.1, DT);
  assert.ok(
    Math.abs(first - 0.1) < 1e-9,
    `after reset first output should equal input, got ${first}`
  );
});
