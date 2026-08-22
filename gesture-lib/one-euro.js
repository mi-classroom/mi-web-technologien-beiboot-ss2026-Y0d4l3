/**
 * OneEuroFilter – adaptive low-pass filter for noisy real-time signals.
 *
 * Reference: Géry Casiez, Nicolas Roussel, Daniel Vogel.
 * "1€ Filter: A Simple Speed-based Low-pass Filter for Noisy Input in
 *  Interactive Systems." CHI 2012.  https://gery.casiez.net/1euro/
 *
 * The idea: a plain low-pass filter forces a fixed trade-off between jitter and
 * lag. The 1€ filter makes the cutoff frequency depend on the signal speed —
 * low speed → low cutoff (strong smoothing, kills jitter at rest); high speed →
 * high cutoff (little smoothing, low lag while moving). One instance filters one
 * scalar; the gesture library runs one per landmark coordinate.
 */
(function (global) {
  'use strict';

  /** Smoothing factor for a first-order low-pass, given a cutoff (Hz) and dt (s). */
  function alpha(cutoffHz, dtSec) {
    const tau = 1 / (2 * Math.PI * cutoffHz);
    return 1 / (1 + tau / dtSec);
  }

  /** First-order exponential low-pass filter with an externally supplied alpha. */
  class LowPass {
    constructor() {
      this._hat = null;
    }
    reset() {
      this._hat = null;
    }
    get initialized() {
      return this._hat !== null;
    }
    get lastValue() {
      return this._hat;
    }
    filter(value, a) {
      this._hat = this._hat === null ? value : a * value + (1 - a) * this._hat;
      return this._hat;
    }
  }

  class OneEuroFilter {
    /**
     * @param {object} [options]
     * @param {number} [options.minCutoff=1.0] Baseline cutoff (Hz). Lower = smoother at rest.
     * @param {number} [options.beta=0.0]      Speed coefficient. Higher = less lag when moving.
     * @param {number} [options.dCutoff=1.0]   Cutoff (Hz) for the derivative's own low-pass.
     */
    constructor({ minCutoff = 1.0, beta = 0.0, dCutoff = 1.0 } = {}) {
      this.minCutoff = minCutoff;
      this.beta = beta;
      this.dCutoff = dCutoff;
      this._x = new LowPass();
      this._dx = new LowPass();
      this._lastRaw = null;
    }

    reset() {
      this._x.reset();
      this._dx.reset();
      this._lastRaw = null;
    }

    /**
     * Filter one sample.
     *
     * @param {number} value  Raw sample value.
     * @param {number} dtMs   Elapsed time since the previous sample, in milliseconds.
     * @returns {number}      Filtered value.
     */
    filter(value, dtMs) {
      const dt = dtMs / 1000;
      if (!(dt > 0)) {
        // No time elapsed (first frame / non-monotonic clock): seed, don't smooth.
        this._lastRaw = value;
        return this._x.filter(value, 1);
      }

      // Rate of change of the raw signal, itself low-passed at dCutoff.
      const dValue = this._x.initialized ? (value - this._lastRaw) / dt : 0;
      const edValue = this._dx.filter(dValue, alpha(this.dCutoff, dt));

      // Speed-dependent cutoff: fast motion raises it, reducing lag.
      const cutoff = this.minCutoff + this.beta * Math.abs(edValue);
      const filtered = this._x.filter(value, alpha(cutoff, dt));

      this._lastRaw = value;
      return filtered;
    }
  }

  // ── Export ──────────────────────────────────────────────────────────────────

  global.OneEuroFilter = OneEuroFilter;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { OneEuroFilter, LowPass, alpha };
  }
})(typeof window !== 'undefined' ? window : globalThis);
