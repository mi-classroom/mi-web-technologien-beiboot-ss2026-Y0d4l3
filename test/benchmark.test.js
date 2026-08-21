'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');

const { benchmark } = require('../bench/metrics.js');

// These tests guard the central claim of the deepening: the 1€ filter improves on
// the fixed moving average. They run on deterministic seeded signals, so the numeric
// comparisons are stable in CI. The trade-off (slow-drift lag) is asserted too, to
// keep the claim honest rather than cherry-picked.

test('both smoothers cut rest jitter; 1€ cuts it more than the moving average', () => {
  const r = benchmark({ oneEuroOpts: { minCutoff: 1.0, beta: 1.0, dCutoff: 1.0 } });
  assert.ok(r.jitterMA < r.jitterRaw, 'moving average reduces jitter');
  assert.ok(r.jitterOneEuro < r.jitterRaw, '1€ reduces jitter');
  assert.ok(r.jitterOneEuro < r.jitterMA, `1€ ${r.jitterOneEuro} < MA ${r.jitterMA}`);
});

test('on a fast gesture, a responsiveness-tuned 1€ beats the moving average on both jitter and lag', () => {
  const r = benchmark({
    oneEuroOpts: { minCutoff: 1.0, beta: 2.0, dCutoff: 1.0 },
    slopePerFrame: 0.05,
  });
  assert.ok(r.jitterOneEuro < r.jitterMA, `rest jitter: 1€ ${r.jitterOneEuro} < MA ${r.jitterMA}`);
  assert.ok(r.lagOneEuro < r.lagMA, `motion lag: 1€ ${r.lagOneEuro} < MA ${r.lagMA}`);
});

test('trade-off is honest: during slow drift the moving average lags less', () => {
  const r = benchmark({
    oneEuroOpts: { minCutoff: 1.0, beta: 2.0, dCutoff: 1.0 },
    slopePerFrame: 0.01,
  });
  assert.ok(r.lagMA < r.lagOneEuro, `slow-drift lag: MA ${r.lagMA} < 1€ ${r.lagOneEuro}`);
});
