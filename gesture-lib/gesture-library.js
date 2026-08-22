/**
 * GestureLibrary – reusable gesture recognition library for MediaPipe Pose.
 *
 * Typical usage:
 *
 *   const lib = new GestureLibrary();
 *   lib.useDefaults();                          // register all built-in gestures
 *
 *   lib.addEventListener('gesture', ({ detail }) => {
 *     console.log(detail.name, detail.label);   // listen on the library instance
 *   });
 *   // or: window.addEventListener('gesture', …) for cross-component access
 *
 *   // inside MediaPipe onResults callback:
 *   lib.update(results.poseLandmarks);          // null when no person detected
 *
 * See gesture-lib/README.md for the full public API reference.
 */
(function (global) {
  'use strict';

  // ── Module-private helpers ──────────────────────────────────────────────────

  /** Arithmetic mean of a numeric array. */
  function _avg(arr) {
    return arr.reduce((s, v) => s + v, 0) / arr.length;
  }

  /**
   * Resolve the OneEuroFilter class from either the Node module (tests/tooling)
   * or the browser global set by one-euro.js. Returns undefined if unavailable,
   * so the moving-average path keeps working even without the filter loaded.
   */
  function _resolveOneEuro() {
    if (typeof require !== 'undefined') {
      try {
        return require('./one-euro.js').OneEuroFilter;
      } catch {
        /* not resolvable in this context – fall back to the global */
      }
    }
    return global.OneEuroFilter;
  }

  // ── GestureLibrary ──────────────────────────────────────────────────────────

  /**
   * Core library class.  Extends EventTarget so instances expose the familiar
   * addEventListener / removeEventListener / dispatchEvent API.
   */
  class GestureLibrary extends EventTarget {
    /**
     * @param {object} [options]
     * @param {number} [options.bufferSize=5]        Smoothing window (frames).
     * @param {number} [options.minVisibility=0.60]  Min landmark visibility score.
     * @param {number} [options.historySize=30]      Max frames kept for velocity checks.
     * @param {number} [options.nominalFps=30]       Frame rate assumed when update() is
     *                                               called without a timestamp, and the
     *                                               basis for the frames↔ms conversion.
     * @param {number} [options.cooldownMs]          Lockout after each gesture, in ms.
     * @param {number} [options.cooldownFrames]      Legacy: lockout in frames. Converted
     *                                               to ms via nominalFps. Ignored if
     *                                               cooldownMs is given. Defaults to ~2 s.
     * @param {number} [options.maxFrameGapMs=250]   Upper bound applied to the measured
     *                                               inter-frame delta, so a stalled feed
     *                                               (e.g. a backgrounded tab) cannot make
     *                                               a hold complete or a cooldown expire
     *                                               in a single jump.
     */
    constructor({
      bufferSize = 5,
      minVisibility = 0.6,
      historySize = 30,
      nominalFps = 30,
      cooldownMs,
      cooldownFrames,
      maxFrameGapMs = 250,
      smoothing = 'movingAverage',
      oneEuro = {},
    } = {}) {
      super();
      this.bufferSize = bufferSize;
      this.minVisibility = minVisibility;
      this.historySize = historySize;
      this.nominalFps = nominalFps;
      this.maxFrameGapMs = maxFrameGapMs;
      this._nominalDt = 1000 / nominalFps; // ms per frame at the nominal rate

      // Landmark smoothing strategy: the original 'movingAverage' (fixed window) or
      // the speed-adaptive 'oneEuro' filter. Moving average stays the default so
      // existing behavior is unchanged; opt into 'oneEuro' for lower jitter and lag.
      this.smoothing = smoothing;
      this._oneEuroOpts = { minCutoff: 1.0, beta: 1.0, dCutoff: 1.0, ...oneEuro };
      this._filters = null; // lazily built per-landmark filters (oneEuro only)

      // Cooldown is stored in ms. Prefer an explicit cooldownMs; otherwise accept the
      // legacy cooldownFrames (converted); otherwise default to ~2 s.
      this.cooldownMs =
        cooldownMs != null
          ? cooldownMs
          : cooldownFrames != null
            ? cooldownFrames * this._nominalDt
            : 2000;
      // Derived frame-equivalent, kept for UIs that still read it (e.g. progress bars).
      this.cooldownFrames = Math.round(this.cooldownMs / this._nominalDt);

      this._gestures = []; // ordered list of gesture definitions
      this._smoothBuf = []; // raw landmark frames, up to bufferSize
      this._historyBuf = []; // smoothed landmark frames, up to historySize
      this._historyTimes = []; // timestamps parallel to _historyBuf (ms)
      this._holdElapsed = {}; // name → ms the current hold streak has lasted
      this._cooldownRemaining = 0; // ms left in the post-gesture lockout
      this._lastTs = null; // timestamp of the previous update() (ms)
      this._disabled = new Set(); // names of currently-disabled gestures
    }

    // ── Public API ────────────────────────────────────────────────────────────

    /**
     * Register a gesture definition.
     *
     * Gesture definition object fields:
     *   name       {string}    Unique identifier used in events and state.
     *   type       {string}    'hold' or 'velocity'.
     *   label      {string}    Human-readable name shown in UI / events.
     *   holdMs     {number}    (hold only) Duration the condition must hold to fire, in
     *                          milliseconds. Preferred over holdFrames.
     *   holdFrames {number}    (hold only) Legacy alternative to holdMs: a frame count,
     *                          interpreted as holdFrames/nominalFps seconds.
     *   conflicts  {string[]}  (hold only) Names of gestures whose accumulation
     *                          blocks this one from accumulating.  Gestures are
     *                          evaluated in registration order, so a higher-
     *                          priority gesture should be registered first.
     *   check      {Function}  (lm, history) → boolean
     *                            lm      – current smoothed landmark array
     *                            history – array of the last historySize smoothed
     *                                      frames, oldest first (may be shorter
     *                                      when the library has just started)
     *
     * Returns `this` for chaining.
     *
     * @param {object} def  Gesture definition.
     * @returns {GestureLibrary}
     */
    register(def) {
      if (!def || !def.name || !def.type || typeof def.check !== 'function') {
        throw new Error(
          'GestureLibrary.register(): definition must include name, type, and check().'
        );
      }
      if (this._gestures.some(g => g.name === def.name)) {
        throw new Error(`GestureLibrary.register(): gesture "${def.name}" already registered.`);
      }
      // Resolve the hold duration to ms once, at registration time.
      const holdMs =
        def.holdMs != null
          ? def.holdMs
          : def.holdFrames != null
            ? def.holdFrames * this._nominalDt
            : undefined;

      this._gestures.push({ conflicts: [], ...def, holdMs });
      if (def.type === 'hold') {
        this._holdElapsed[def.name] = 0;
      }
      return this;
    }

    /**
     * Feed one frame of MediaPipe pose landmarks.
     * Call this every frame inside the MediaPipe onResults callback.
     * Pass null (or call with no argument) when no pose is detected.
     *
     * @param {Array|null} landmarks  MediaPipe poseLandmarks array.
     * @param {number} [timestamp]    Frame time in ms (e.g. performance.now()). When
     *                                omitted, a nominal-fps clock is used, so existing
     *                                callers keep working; pass real timestamps to make
     *                                hold and cooldown timing independent of frame rate.
     */
    update(landmarks, timestamp) {
      if (!landmarks || landmarks.length === 0) {
        this._resetState();
        return;
      }

      // 1. Determine the elapsed time since the previous frame.
      const dt = this._advanceClock(timestamp);

      // 2. Smooth the raw landmarks with the configured strategy.
      const smoothed = this._smooth(landmarks, dt);

      // 3. Advance the history window (updated every frame, even during cooldown,
      //    so velocity windows do not have gaps after the lockout ends).
      this._historyBuf.push(smoothed);
      this._historyTimes.push(this._lastTs);
      if (this._historyBuf.length > this.historySize) {
        this._historyBuf.shift();
        this._historyTimes.shift();
      }

      // 4. Draw down the cooldown and skip detection while it is active.
      if (this._cooldownRemaining > 0) {
        this._cooldownRemaining = Math.max(0, this._cooldownRemaining - dt);
        return;
      }

      // 5. Evaluate hold gestures in registration order.
      //    A gesture whose `conflicts` list contains the name of any currently
      //    accumulating gesture has its own timer reset for this frame.
      //    Disabled gestures are skipped entirely (timer stays at 0).
      for (const g of this._gestures) {
        if (g.type !== 'hold') continue;
        if (this._disabled.has(g.name)) continue;

        const blocked = g.conflicts.some(n => (this._holdElapsed[n] || 0) > 0);
        if (blocked) {
          this._holdElapsed[g.name] = 0;
          continue;
        }

        if (g.check(smoothed, this._historyBuf)) {
          this._holdElapsed[g.name] += dt;
          // Small epsilon so floating-point rounding never delays a hold by one frame.
          if (this._holdElapsed[g.name] >= g.holdMs - 1e-9) {
            this._trigger(g);
            return;
          }
        } else {
          this._holdElapsed[g.name] = 0;
        }
      }

      // 6. Evaluate velocity gestures in registration order (frame-window based;
      //    time-windowed velocity remains future work). Disabled gestures are skipped.
      for (const g of this._gestures) {
        if (g.type !== 'velocity') continue;
        if (this._disabled.has(g.name)) continue;
        if (g.check(smoothed, this._historyBuf)) {
          this._trigger(g);
          return;
        }
      }
    }

    /**
     * Returns a read-only snapshot of the current library state.
     * `cooldown` and `holdCounters` are expressed in nominal frames (derived from the
     * internal ms timers) for backward compatibility; `cooldownMs` gives the raw value.
     *
     * @returns {{ cooldown: number, cooldownMs: number, holdCounters: object }}
     */
    getState() {
      const holdCounters = {};
      for (const name in this._holdElapsed) {
        holdCounters[name] = Math.round(this._holdElapsed[name] / this._nominalDt);
      }
      return {
        cooldown: Math.round(this._cooldownRemaining / this._nominalDt),
        cooldownMs: this._cooldownRemaining,
        holdCounters,
      };
    }

    /**
     * Returns a summary of every registered gesture (safe copy, no check functions).
     * Useful for dynamically building a UI without hardcoding gesture names.
     * For hold gestures, both the ms duration and a nominal-frame equivalent are given.
     *
     * @returns {Array<{ name, type, label, holdMs?, holdFrames?, disabled }>}
     */
    getGestures() {
      return this._gestures.map(({ name, type, label, holdMs }) => {
        const disabled = this._disabled.has(name);
        if (holdMs === undefined) return { name, type, label, disabled };
        return {
          name,
          type,
          label,
          holdMs,
          holdFrames: Math.round(holdMs / this._nominalDt),
          disabled,
        };
      });
    }

    /** @returns {boolean} True while the post-gesture lockout is active. */
    isOnCooldown() {
      return this._cooldownRemaining > 0;
    }

    /**
     * Immediately clears all internal state (smoothing buffers, history,
     * hold counters, cooldown).  Useful when the camera feed is interrupted.
     */
    reset() {
      this._resetState();
    }

    /**
     * Disable a registered gesture so it is skipped during detection.
     * Its hold counter is reset immediately; it can be re-enabled with enable().
     * Disabled gestures still appear in getGestures() (with disabled: true)
     * and in getProgress(), but they never fire events.
     *
     * Returns `this` for chaining.
     *
     * @param {string} name  Gesture name to disable.
     * @returns {GestureLibrary}
     */
    disable(name) {
      if (!this._gestures.some(g => g.name === name)) {
        throw new Error(`GestureLibrary.disable(): gesture "${name}" is not registered.`);
      }
      this._disabled.add(name);
      if (name in this._holdElapsed) this._holdElapsed[name] = 0;
      return this;
    }

    /**
     * Re-enable a previously disabled gesture.
     * Has no effect if the gesture is not currently disabled.
     *
     * Returns `this` for chaining.
     *
     * @param {string} name  Gesture name to enable.
     * @returns {GestureLibrary}
     */
    enable(name) {
      this._disabled.delete(name);
      return this;
    }

    /**
     * Returns the hold-progress for every registered hold gesture as a
     * convenient map, avoiding the need to manually combine getState() and
     * getGestures() to compute percentages.
     *
     * @returns {Object.<string, { count: number, holdFrames: number, progress: number }>}
     *   Keys are gesture names.  `count`/`holdFrames` are nominal-frame equivalents of
     *   the internal ms timers.  `progress` is a value in [0, 1].
     */
    getProgress() {
      const out = {};
      for (const g of this._gestures) {
        if (g.type !== 'hold') continue;
        const elapsed = this._holdElapsed[g.name] || 0;
        out[g.name] = {
          count: Math.round(elapsed / this._nominalDt),
          holdFrames: Math.round(g.holdMs / this._nominalDt),
          progress: g.holdMs > 0 ? Math.min(elapsed / g.holdMs, 1) : 0,
        };
      }
      return out;
    }

    /**
     * Register all built-in gestures in the recommended priority order.
     * Equivalent to calling register() for each entry in GestureLibrary.BUILTINS.
     * Returns `this` for chaining.
     *
     * @returns {GestureLibrary}
     */
    useDefaults() {
      const order = [
        'stop',
        'armsCrossed',
        'confirm',
        'volUp',
        'volDown',
        'forward',
        'backward',
        'pause',
        'scrollUp',
        'scrollDown',
        'zoomIn',
        'zoomOut',
        'swipeRight',
      ];
      for (const name of order) {
        this.register(GestureLibrary.BUILTINS[name]);
      }
      return this;
    }

    // ── Private ───────────────────────────────────────────────────────────────

    /** Smooth one raw frame with the configured strategy. */
    _smooth(landmarks, dt) {
      if (this.smoothing === 'oneEuro') return this._smoothOneEuro(landmarks, dt);

      // Moving average: advance the window and return its per-landmark mean.
      this._smoothBuf.push(landmarks);
      if (this._smoothBuf.length > this.bufferSize) this._smoothBuf.shift();
      return this._computeSmoothed();
    }

    /** Compute per-landmark mean over the current smoothing window. */
    _computeSmoothed() {
      const n = this._smoothBuf.length;
      const lc = this._smoothBuf[0].length;
      return Array.from({ length: lc }, (_, i) => {
        let x = 0,
          y = 0,
          z = 0,
          vis = 0;
        for (const frame of this._smoothBuf) {
          const lm = frame[i] || {};
          x += lm.x ?? 0;
          y += lm.y ?? 0;
          z += lm.z ?? 0;
          vis += lm.visibility ?? 0;
        }
        return { x: x / n, y: y / n, z: z / n, visibility: vis / n };
      });
    }

    /**
     * Smooth x/y/z per landmark with an independent 1€ filter. Visibility is passed
     * through unfiltered so the occlusion gate reacts immediately when a landmark
     * disappears (smoothing it would delay the visibility drop).
     */
    _smoothOneEuro(landmarks, dt) {
      if (!this._filters) this._initFilters(landmarks.length);
      return landmarks.map((lm, i) => {
        const f = this._filters[i];
        return {
          x: f.x.filter(lm.x ?? 0, dt),
          y: f.y.filter(lm.y ?? 0, dt),
          z: f.z.filter(lm.z ?? 0, dt),
          visibility: lm.visibility ?? 0,
        };
      });
    }

    /** Build one 1€ filter per axis per landmark. */
    _initFilters(count) {
      const OneEuro = _resolveOneEuro();
      if (!OneEuro) {
        throw new Error("GestureLibrary: smoothing 'oneEuro' requires one-euro.js to be loaded.");
      }
      this._filters = Array.from({ length: count }, () => ({
        x: new OneEuro(this._oneEuroOpts),
        y: new OneEuro(this._oneEuroOpts),
        z: new OneEuro(this._oneEuroOpts),
      }));
    }

    /** Fire a gesture: reset accumulators, start cooldown, dispatch events. */
    _trigger(gesture) {
      // Reset all hold timers and clear the velocity history so a fresh
      // window is required before the next velocity gesture can fire.
      for (const name in this._holdElapsed) this._holdElapsed[name] = 0;
      this._historyBuf = [];
      this._historyTimes = [];
      this._cooldownRemaining = this.cooldownMs;

      const detail = {
        name: gesture.name,
        label: gesture.label,
        timestamp: Date.now(),
      };

      // Fire on the library instance (lib.addEventListener usage).
      this.dispatchEvent(new CustomEvent('gesture', { detail }));

      // Fire on window so any part of the application can listen without
      // holding a reference to the library instance.
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('gesture', { detail }));
      }
    }

    /** Hard reset – called when no pose is detected or reset() is invoked. */
    _resetState() {
      this._smoothBuf = [];
      this._historyBuf = [];
      this._historyTimes = [];
      this._cooldownRemaining = 0;
      this._lastTs = null;
      this._filters = null; // rebuilt on the next frame (oneEuro only)
      for (const name in this._holdElapsed) this._holdElapsed[name] = 0;
    }

    /**
     * Update the internal clock and return the sanitized elapsed time (ms) since the
     * previous frame.
     *
     * With an explicit timestamp, dt is the real gap between samples (0 on the first
     * frame, then clamped to [0, maxFrameGapMs]). Without one, a fixed nominal-fps step
     * is assumed so timestamp-free callers behave exactly as the frame-based version did.
     *
     * @param {number} [ts]  Frame timestamp in ms.
     * @returns {number}     Elapsed time since the previous frame, in ms.
     */
    _advanceClock(ts) {
      if (typeof ts === 'number' && Number.isFinite(ts)) {
        const dt = this._lastTs == null ? 0 : ts - this._lastTs;
        this._lastTs = ts;
        if (!(dt > 0)) return 0; // first frame or non-monotonic timestamp
        return dt > this.maxFrameGapMs ? this.maxFrameGapMs : dt;
      }
      // No timestamp supplied: assume the nominal frame rate.
      this._lastTs = this._lastTs == null ? 0 : this._lastTs + this._nominalDt;
      return this._nominalDt;
    }
  }

  // ── Built-in gesture definitions ───────────────────────────────────────────
  //
  // MediaPipe landmark indices used here:
  //   0  = NOSE         11 = LEFT_SHOULDER   12 = RIGHT_SHOULDER
  //   15 = LEFT_WRIST   16 = RIGHT_WRIST     24 = RIGHT_HIP
  //
  // Coordinate system (native MediaPipe image space, unmirrored):
  //   x = 0 → left image edge = person's RIGHT side
  //   x = 1 → right image edge = person's LEFT side
  //   y = 0 → top, y = 1 → bottom
  //
  // The demo canvas is CSS-mirrored (scaleX(-1)) for natural selfie display;
  // the coordinate values themselves are never modified.

  const _XV = 0.2; // minimum horizontal extension to count as "arm extended"
  const _YT = 0.18; // maximum vertical deviation from shoulder height
  const _MV = 0.6; // minimum visibility score

  /** Checks visibility of the given landmark indices against _MV. */
  function _v(lm, ...idx) {
    return idx.every(i => lm[i] && lm[i].visibility > _MV);
  }

  GestureLibrary.BUILTINS = {
    // ── Hold gestures ───────────────────────────────────────────────────────

    /**
     * Stop – T-pose: both arms extended horizontally.
     * Registered first so it blocks 'forward' and 'backward' from accumulating
     * simultaneously (T-pose satisfies both arm-extended conditions).
     */
    stop: {
      name: 'stop',
      type: 'hold',
      label: 'Stop (T-Pose)',
      holdFrames: 30,
      check(lm) {
        if (!_v(lm, 11, 12, 15, 16)) return false;
        return (
          lm[12].x - lm[16].x > _XV &&
          Math.abs(lm[16].y - lm[12].y) < _YT &&
          lm[15].x - lm[11].x > _XV &&
          Math.abs(lm[15].y - lm[11].y) < _YT
        );
      },
    },

    /**
     * Arms Crossed – right wrist crosses past left wrist at chest level.
     * Near-range implementation of the "Abbrechen/Cancel" gesture from the
     * original mapping table (#4), where arms cross in front of the torso.
     */
    armsCrossed: {
      name: 'armsCrossed',
      type: 'hold',
      label: 'Abbrechen (Arme gekreuzt)',
      holdFrames: 30,
      check(lm) {
        if (!_v(lm, 11, 12, 15, 16, 24)) return false;
        const rW = lm[16],
          lW = lm[15];
        // In MediaPipe space: right wrist normally has lower x than left wrist.
        // When crossed, right wrist x exceeds left wrist x.
        const crossed = rW.x > lW.x;
        // Both wrists should be in the torso zone (below shoulders, above hips).
        const atTorso = rW.y > lm[12].y && rW.y < lm[24].y && lW.y > lm[11].y && lW.y < lm[24].y;
        return crossed && atTorso;
      },
    },

    /**
     * Confirm – both wrists raised above their respective shoulders.
     * Registered before 'volUp' so that the victory pose does not also
     * accumulate the vol-up counter.
     */
    confirm: {
      name: 'confirm',
      type: 'hold',
      label: 'Bestätigen',
      holdFrames: 30,
      check(lm) {
        if (!_v(lm, 11, 12, 15, 16)) return false;
        return lm[16].y < lm[12].y - 0.05 && lm[15].y < lm[11].y - 0.05;
      },
    },

    /**
     * Vol Up – right wrist held above the nose.
     * Declares 'confirm' as a conflict: when the victory pose is accumulating,
     * vol-up does not accumulate.
     */
    volUp: {
      name: 'volUp',
      type: 'hold',
      label: 'Lautstärke +',
      holdFrames: 20,
      conflicts: ['confirm'],
      check(lm) {
        if (!_v(lm, 0, 16)) return false;
        return lm[16].y < lm[0].y - 0.05;
      },
    },

    /** Vol Down – right wrist held below the right hip. */
    volDown: {
      name: 'volDown',
      type: 'hold',
      label: 'Lautstärke -',
      holdFrames: 20,
      check(lm) {
        if (!_v(lm, 16, 24)) return false;
        return lm[16].y > lm[24].y + 0.05;
      },
    },

    /**
     * Forward – right arm extended horizontally to person's right.
     * Blocked by 'stop': T-pose also satisfies this condition.
     */
    forward: {
      name: 'forward',
      type: 'hold',
      label: 'Vorwärts →',
      holdFrames: 30,
      conflicts: ['stop'],
      check(lm) {
        if (!_v(lm, 12, 16)) return false;
        return lm[12].x - lm[16].x > _XV && Math.abs(lm[16].y - lm[12].y) < _YT;
      },
    },

    /**
     * Backward – left arm extended horizontally to person's left.
     * Blocked by 'stop' for the same reason as 'forward'.
     */
    backward: {
      name: 'backward',
      type: 'hold',
      label: '← Rückwärts',
      holdFrames: 30,
      conflicts: ['stop'],
      check(lm) {
        if (!_v(lm, 11, 15)) return false;
        return lm[15].x - lm[11].x > _XV && Math.abs(lm[15].y - lm[11].y) < _YT;
      },
    },

    /**
     * Pause – right wrist held still at chest height near the body centre.
     * Uses the previous history frame to measure per-frame displacement.
     */
    pause: {
      name: 'pause',
      type: 'hold',
      label: 'Pause (Stillstand)',
      holdFrames: 45,
      check(lm, history) {
        if (!_v(lm, 0, 11, 12, 16, 24)) return false;
        if (history.length < 2) return false;
        const prev = history[history.length - 2];
        const rW = lm[16];
        const moved = Math.abs(rW.x - prev[16].x) + Math.abs(rW.y - prev[16].y);
        const centerX = (lm[11].x + lm[12].x) / 2;
        const inZone = rW.y > lm[0].y && rW.y < lm[24].y - 0.05 && Math.abs(rW.x - centerX) < 0.15;
        return moved < 0.008 && inZone;
      },
    },

    // ── Velocity gestures ────────────────────────────────────────────────────

    /** Scroll Up – right wrist moves quickly upward. */
    scrollUp: {
      name: 'scrollUp',
      type: 'velocity',
      label: 'Scroll ↑',
      check(lm, history) {
        const H = 15;
        if (history.length < H) return false;
        const s = history.slice(-H);
        if (!s.every(f => f[16].visibility > _MV)) return false;
        const oldY = _avg(s.slice(0, 5).map(f => f[16].y));
        const newY = _avg(s.slice(-5).map(f => f[16].y));
        return oldY - newY > 0.18;
      },
    },

    /** Scroll Down – right wrist moves quickly downward. */
    scrollDown: {
      name: 'scrollDown',
      type: 'velocity',
      label: 'Scroll ↓',
      check(lm, history) {
        const H = 15;
        if (history.length < H) return false;
        const s = history.slice(-H);
        if (!s.every(f => f[16].visibility > _MV)) return false;
        const oldY = _avg(s.slice(0, 5).map(f => f[16].y));
        const newY = _avg(s.slice(-5).map(f => f[16].y));
        return newY - oldY > 0.18;
      },
    },

    /** Zoom In – both wrists move closer together. */
    zoomIn: {
      name: 'zoomIn',
      type: 'velocity',
      label: 'Zoom +',
      check(lm, history) {
        const H = 20;
        if (history.length < H) return false;
        const s = history.slice(-H);
        if (!s.every(f => Math.min(f[15].visibility, f[16].visibility) > _MV)) return false;
        const d = f => Math.hypot(f[15].x - f[16].x, f[15].y - f[16].y);
        const oldD = _avg(s.slice(0, 5).map(d));
        const newD = _avg(s.slice(-5).map(d));
        return oldD - newD > 0.15;
      },
    },

    /** Zoom Out – both wrists move further apart. */
    zoomOut: {
      name: 'zoomOut',
      type: 'velocity',
      label: 'Zoom −',
      check(lm, history) {
        const H = 20;
        if (history.length < H) return false;
        const s = history.slice(-H);
        if (!s.every(f => Math.min(f[15].visibility, f[16].visibility) > _MV)) return false;
        const d = f => Math.hypot(f[15].x - f[16].x, f[15].y - f[16].y);
        const oldD = _avg(s.slice(0, 5).map(d));
        const newD = _avg(s.slice(-5).map(d));
        return newD - oldD > 0.15;
      },
    },

    /**
     * Swipe Right – right wrist sweeps quickly toward person's right side.
     * In MediaPipe space, person's right = lower x values, so the gesture
     * fires when the running x-average decreases by more than the threshold.
     */
    swipeRight: {
      name: 'swipeRight',
      type: 'velocity',
      label: 'Wischen → (Schnell)',
      check(lm, history) {
        const H = 15;
        if (history.length < H) return false;
        const s = history.slice(-H);
        if (!s.every(f => f[16].visibility > _MV)) return false;
        const oldX = _avg(s.slice(0, 5).map(f => f[16].x));
        const newX = _avg(s.slice(-5).map(f => f[16].x));
        return oldX - newX > 0.15;
      },
    },
  };

  // ── Export ──────────────────────────────────────────────────────────────────

  // Browser: attach to the global object so <script> tags expose GestureLibrary.
  global.GestureLibrary = GestureLibrary;

  // Node (tests, tooling): also expose via CommonJS. Guarded with typeof so the
  // browser build — which has no module system — is completely unaffected.
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = GestureLibrary;
  }
})(typeof window !== 'undefined' ? window : globalThis);
