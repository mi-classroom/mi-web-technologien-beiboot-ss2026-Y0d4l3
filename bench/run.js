#!/usr/bin/env node
'use strict';

/**
 * Human-readable before/after report for the two robustness fixes in this
 * deepening. Reuses the exact same measurement functions as the test suite
 * (bench/metrics.js, bench/timing.js), so this report and `npm test` can never
 * silently disagree.
 *
 * Run with: node bench/run.js  (or: npm run bench)
 */

const { benchmark } = require('./metrics.js');
const { holdUntilFire } = require('./timing.js');

function pct(before, after) {
  const change = ((after - before) / before) * 100;
  const sign = change <= 0 ? '' : '+';
  return `${sign}${change.toFixed(0)}%`;
}

function fmt(n) {
  return n.toFixed(4);
}

function printSmoothingReport() {
  console.log('\n=== Fix 1: Landmark smoothing — moving average vs. 1€ filter ===\n');

  const fast = benchmark({
    oneEuroOpts: { minCutoff: 1.0, beta: 2.0, dCutoff: 1.0 },
    slopePerFrame: 0.05,
  });
  const slow = benchmark({
    oneEuroOpts: { minCutoff: 1.0, beta: 2.0, dCutoff: 1.0 },
    slopePerFrame: 0.01,
  });

  console.log('Jitter at rest (stddev of a stationary, noisy signal — lower is steadier):');
  console.log(`  raw (unfiltered)     ${fmt(fast.jitterRaw)}`);
  console.log(
    `  moving average       ${fmt(fast.jitterMA)}  (${pct(fast.jitterRaw, fast.jitterMA)} vs raw)`
  );
  console.log(
    `  1€ filter            ${fmt(fast.jitterOneEuro)}  (${pct(fast.jitterRaw, fast.jitterOneEuro)} vs raw, ${pct(fast.jitterMA, fast.jitterOneEuro)} vs moving average)`
  );

  console.log(
    '\nLag on a FAST gesture (mean abs. distance from the true position — lower is more responsive):'
  );
  console.log(`  moving average       ${fmt(fast.lagMA)}`);
  console.log(
    `  1€ filter            ${fmt(fast.lagOneEuro)}  (${pct(fast.lagMA, fast.lagOneEuro)} vs moving average)`
  );

  console.log('\nLag on a SLOW drift (same metric, slower motion — the honest trade-off):');
  console.log(`  moving average       ${fmt(slow.lagMA)}`);
  console.log(
    `  1€ filter            ${fmt(slow.lagOneEuro)}  (${pct(slow.lagMA, slow.lagOneEuro)} vs moving average)`
  );
  console.log(
    '  → 1€ trades a little slow-drift lag for much lower rest jitter and lower fast-gesture lag.'
  );
}

function printTimingReport() {
  console.log('\n=== Fix 2: Hold timing — frame count vs. milliseconds ===\n');
  console.log('Replaying a held "forward" pose at different frame rates:\n');

  const rates = [30, 15, 10];
  for (const fps of rates) {
    const r = holdUntilFire(fps);
    console.log(
      `  ${String(fps).padStart(2)} fps  →  fired after ${r.calls} frames, ${r.atMs.toFixed(0)} ms`
    );
  }
  console.log('\n  All three converge on ~1000 ms: the fix makes the trigger time frame-rate');
  console.log('  independent. The frame-counting predecessor fired after a fixed 30 frames');
  console.log('  regardless of rate — ~1000 ms at 30 fps, but ~2000 ms at 15 fps.');
}

printSmoothingReport();
printTimingReport();
console.log(
  '\nSee test/benchmark.test.js and test/frame-rate.test.js for the assertions behind these numbers.\n'
);
