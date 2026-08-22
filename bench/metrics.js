'use strict';

/**
 * Measurement engine comparing the two landmark-smoothing strategies on identical,
 * deterministic synthetic signals: the fixed moving average (the library's original
 * smoother) versus the speed-adaptive 1€ filter.
 *
 * Two regimes are measured:
 *   - jitter at rest: residual noise while the signal is stationary (lower = steadier)
 *   - lag while moving: how far the output trails the true position during a fast
 *     gesture (lower = more responsive)
 *
 * The seeded PRNG / stddev helpers are reused from the test utilities so the tests
 * and this dev tool measure exactly the same way.
 */

const { OneEuroFilter } = require('../gesture-lib/one-euro.js');
const { makeRng, gaussian, stddev } = require('../test/helpers.js');

const NOMINAL_FPS = 30;
const DT = 1000 / NOMINAL_FPS; // ms per frame

// ── Smoothers as plain series transforms ─────────────────────────────────────

/** Fixed-window moving average, matching the library's movingAverage path. */
function movingAverageSeries(signal, windowSize) {
  const buf = [];
  return signal.map(v => {
    buf.push(v);
    if (buf.length > windowSize) buf.shift();
    return buf.reduce((s, x) => s + x, 0) / buf.length;
  });
}

/** 1€-filtered series (first sample seeds the filter with dt = 0). */
function oneEuroSeries(signal, opts, dtMs = DT) {
  const f = new OneEuroFilter(opts);
  return signal.map((v, i) => f.filter(v, i === 0 ? 0 : dtMs));
}

// ── Synthetic signals ────────────────────────────────────────────────────────

/** Stationary position with Gaussian sensor noise. */
function staticSignal({ value = 0.5, noise = 0.01, n = 600, seed = 1 } = {}) {
  const rng = makeRng(seed);
  return Array.from({ length: n }, () => value + noise * gaussian(rng));
}

/** Linear motion (a fast gesture) plus noise; returns the noiseless truth too. */
function rampSignal({ start = 0.2, slopePerFrame = 0.05, noise = 0.01, n = 120, seed = 2 } = {}) {
  const rng = makeRng(seed);
  const truth = Array.from({ length: n }, (_, i) => start + slopePerFrame * i);
  const noisy = truth.map(v => v + noise * gaussian(rng));
  return { truth, noisy };
}

// ── Metrics ──────────────────────────────────────────────────────────────────

/** Residual jitter = stddev of the output after a warm-up window. */
function jitter(series, warmup = 100) {
  return stddev(series.slice(warmup));
}

/** Mean absolute lag between the true position and the smoothed output. */
function meanAbsLag(truth, series, warmup = 40) {
  let sum = 0;
  let count = 0;
  for (let i = warmup; i < series.length; i++) {
    sum += Math.abs(truth[i] - series[i]);
    count++;
  }
  return sum / count;
}

// ── Combined benchmark ───────────────────────────────────────────────────────

/**
 * Run both regimes for both smoothers on identical inputs.
 * @returns metrics with jitter (rest) and lag (fast motion) for each smoother.
 */
function benchmark({
  maWindow = 5,
  oneEuroOpts = { minCutoff: 1.0, beta: 1.0, dCutoff: 1.0 },
  slopePerFrame = 0.05,
} = {}) {
  const rest = staticSignal();
  const jitterRaw = jitter(rest);
  const jitterMA = jitter(movingAverageSeries(rest, maWindow));
  const jitterOneEuro = jitter(oneEuroSeries(rest, oneEuroOpts));

  const { truth, noisy } = rampSignal({ slopePerFrame });
  const lagMA = meanAbsLag(truth, movingAverageSeries(noisy, maWindow));
  const lagOneEuro = meanAbsLag(truth, oneEuroSeries(noisy, oneEuroOpts));

  return {
    maWindow,
    oneEuroOpts,
    slopePerFrame,
    jitterRaw,
    jitterMA,
    jitterOneEuro,
    lagMA,
    lagOneEuro,
  };
}

module.exports = {
  NOMINAL_FPS,
  DT,
  movingAverageSeries,
  oneEuroSeries,
  staticSignal,
  rampSignal,
  jitter,
  meanAbsLag,
  benchmark,
};
