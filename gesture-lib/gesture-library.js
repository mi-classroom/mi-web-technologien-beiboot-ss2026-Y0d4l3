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

  /** True when all listed landmark indices exceed the visibility threshold. */
  function _vis(lm, minVis, ...indices) {
    return indices.every(i => lm[i] && lm[i].visibility > minVis);
  }

  /** Arithmetic mean of a numeric array. */
  function _avg(arr) {
    return arr.reduce((s, v) => s + v, 0) / arr.length;
  }

  // ── GestureLibrary ──────────────────────────────────────────────────────────

  /**
   * Core library class.  Extends EventTarget so instances expose the familiar
   * addEventListener / removeEventListener / dispatchEvent API.
   */
  class GestureLibrary extends EventTarget {

    /**
     * @param {object} [options]
     * @param {number} [options.bufferSize=5]       Smoothing window (frames).
     * @param {number} [options.cooldownFrames=60]  Lockout after each gesture.
     * @param {number} [options.minVisibility=0.60] Min landmark visibility score.
     * @param {number} [options.historySize=30]     Max frames kept for velocity checks.
     */
    constructor({
      bufferSize     = 5,
      cooldownFrames = 60,
      minVisibility  = 0.60,
      historySize    = 30,
    } = {}) {
      super();
      this.bufferSize     = bufferSize;
      this.cooldownFrames = cooldownFrames;
      this.minVisibility  = minVisibility;
      this.historySize    = historySize;

      this._gestures     = [];   // ordered list of gesture definitions
      this._smoothBuf    = [];   // raw landmark frames, up to bufferSize
      this._historyBuf   = [];   // smoothed landmark frames, up to historySize
      this._holdCounters = {};   // name → consecutive-frame count
      this._cooldown     = 0;
    }

    // ── Public API ────────────────────────────────────────────────────────────

    /**
     * Register a gesture definition.
     *
     * Gesture definition object fields:
     *   name       {string}    Unique identifier used in events and state.
     *   type       {string}    'hold' or 'velocity'.
     *   label      {string}    Human-readable name shown in UI / events.
     *   holdFrames {number}    (hold only) Consecutive frames required to fire.
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
      this._gestures.push({ conflicts: [], ...def });
      if (def.type === 'hold') {
        this._holdCounters[def.name] = 0;
      }
      return this;
    }

    /**
     * Feed one frame of MediaPipe pose landmarks.
     * Call this every frame inside the MediaPipe onResults callback.
     * Pass null (or call with no argument) when no pose is detected.
     *
     * @param {Array|null} landmarks  MediaPipe poseLandmarks array.
     */
    update(landmarks) {
      if (!landmarks || landmarks.length === 0) {
        this._resetState();
        return;
      }

      // 1. Advance the smoothing window.
      this._smoothBuf.push(landmarks);
      if (this._smoothBuf.length > this.bufferSize) this._smoothBuf.shift();

      // 2. Compute per-landmark running average.
      const smoothed = this._computeSmoothed();

      // 3. Advance the history window (updated every frame, even during cooldown,
      //    so velocity windows do not have gaps after the lockout ends).
      this._historyBuf.push(smoothed);
      if (this._historyBuf.length > this.historySize) this._historyBuf.shift();

      // 4. Tick the cooldown counter and skip detection while active.
      if (this._cooldown > 0) {
        this._cooldown--;
        return;
      }

      // 5. Evaluate hold gestures in registration order.
      //    A gesture whose `conflicts` list contains the name of any currently
      //    accumulating gesture has its own counter reset for this frame.
      for (const g of this._gestures) {
        if (g.type !== 'hold') continue;

        const blocked = g.conflicts.some(n => (this._holdCounters[n] || 0) > 0);
        if (blocked) {
          this._holdCounters[g.name] = 0;
          continue;
        }

        if (g.check(smoothed, this._historyBuf)) {
          this._holdCounters[g.name]++;
          if (this._holdCounters[g.name] >= g.holdFrames) {
            this._trigger(g);
            return;
          }
        } else {
          this._holdCounters[g.name] = 0;
        }
      }

      // 6. Evaluate velocity gestures in registration order.
      for (const g of this._gestures) {
        if (g.type !== 'velocity') continue;
        if (g.check(smoothed, this._historyBuf)) {
          this._trigger(g);
          return;
        }
      }
    }

    /**
     * Returns a read-only snapshot of the current library state.
     *
     * @returns {{ cooldown: number, holdCounters: object }}
     */
    getState() {
      return {
        cooldown:     this._cooldown,
        holdCounters: { ...this._holdCounters },
      };
    }

    /**
     * Returns a summary of every registered gesture (safe copy, no check functions).
     * Useful for dynamically building a UI without hardcoding gesture names.
     *
     * @returns {Array<{ name, type, label, holdFrames? }>}
     */
    getGestures() {
      return this._gestures.map(({ name, type, label, holdFrames }) =>
        holdFrames !== undefined ? { name, type, label, holdFrames }
                                 : { name, type, label }
      );
    }

    /** @returns {boolean} True while the post-gesture lockout is active. */
    isOnCooldown() {
      return this._cooldown > 0;
    }

    /**
     * Immediately clears all internal state (smoothing buffers, history,
     * hold counters, cooldown).  Useful when the camera feed is interrupted.
     */
    reset() {
      this._resetState();
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
        'stop', 'armsCrossed',
        'confirm', 'volUp', 'volDown',
        'forward', 'backward', 'pause',
        'scrollUp', 'scrollDown', 'zoomIn', 'zoomOut',
        'swipeRight',
      ];
      for (const name of order) {
        this.register(GestureLibrary.BUILTINS[name]);
      }
      return this;
    }

    // ── Private ───────────────────────────────────────────────────────────────

    /** Compute per-landmark mean over the current smoothing window. */
    _computeSmoothed() {
      const n  = this._smoothBuf.length;
      const lc = this._smoothBuf[0].length;
      return Array.from({ length: lc }, (_, i) => {
        let x = 0, y = 0, z = 0, vis = 0;
        for (const frame of this._smoothBuf) {
          const lm = frame[i] || {};
          x   += lm.x          ?? 0;
          y   += lm.y          ?? 0;
          z   += lm.z          ?? 0;
          vis += lm.visibility ?? 0;
        }
        return { x: x / n, y: y / n, z: z / n, visibility: vis / n };
      });
    }

    /** Fire a gesture: reset accumulators, start cooldown, dispatch events. */
    _trigger(gesture) {
      // Reset all hold counters and clear the velocity history so a fresh
      // window is required before the next velocity gesture can fire.
      for (const name in this._holdCounters) this._holdCounters[name] = 0;
      this._historyBuf = [];
      this._cooldown   = this.cooldownFrames;

      const detail = {
        name:      gesture.name,
        label:     gesture.label,
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
      this._smoothBuf  = [];
      this._historyBuf = [];
      this._cooldown   = 0;
      for (const name in this._holdCounters) this._holdCounters[name] = 0;
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

  const _XV = 0.20;  // minimum horizontal extension to count as "arm extended"
  const _YT = 0.18;  // maximum vertical deviation from shoulder height
  const _MV = 0.60;  // minimum visibility score

  /** Checks visibility of the given landmark indices against _MV. */
  function _v(lm, ...idx) { return idx.every(i => lm[i] && lm[i].visibility > _MV); }

  GestureLibrary.BUILTINS = {

    // ── Hold gestures ───────────────────────────────────────────────────────

    /**
     * Stop – T-pose: both arms extended horizontally.
     * Registered first so it blocks 'forward' and 'backward' from accumulating
     * simultaneously (T-pose satisfies both arm-extended conditions).
     */
    stop: {
      name: 'stop', type: 'hold', label: 'Stop (T-Pose)', holdFrames: 30,
      check(lm) {
        if (!_v(lm, 11, 12, 15, 16)) return false;
        return (lm[12].x - lm[16].x) > _XV && Math.abs(lm[16].y - lm[12].y) < _YT &&
               (lm[15].x - lm[11].x) > _XV && Math.abs(lm[15].y - lm[11].y) < _YT;
      },
    },

    /**
     * Arms Crossed – right wrist crosses past left wrist at chest level.
     * Near-range implementation of the "Abbrechen/Cancel" gesture from the
     * original mapping table (#4), where arms cross in front of the torso.
     */
    armsCrossed: {
      name: 'armsCrossed', type: 'hold', label: 'Abbrechen (Arme gekreuzt)', holdFrames: 30,
      check(lm) {
        if (!_v(lm, 11, 12, 15, 16, 24)) return false;
        const rW = lm[16], lW = lm[15];
        // In MediaPipe space: right wrist normally has lower x than left wrist.
        // When crossed, right wrist x exceeds left wrist x.
        const crossed   = rW.x > lW.x;
        // Both wrists should be in the torso zone (below shoulders, above hips).
        const atTorso   = rW.y > lm[12].y && rW.y < lm[24].y &&
                          lW.y > lm[11].y && lW.y < lm[24].y;
        return crossed && atTorso;
      },
    },

    /**
     * Confirm – both wrists raised above their respective shoulders.
     * Registered before 'volUp' so that the victory pose does not also
     * accumulate the vol-up counter.
     */
    confirm: {
      name: 'confirm', type: 'hold', label: 'Bestätigen', holdFrames: 30,
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
      name: 'volUp', type: 'hold', label: 'Lautstärke +', holdFrames: 20,
      conflicts: ['confirm'],
      check(lm) {
        if (!_v(lm, 0, 16)) return false;
        return lm[16].y < lm[0].y - 0.05;
      },
    },

    /** Vol Down – right wrist held below the right hip. */
    volDown: {
      name: 'volDown', type: 'hold', label: 'Lautstärke -', holdFrames: 20,
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
      name: 'forward', type: 'hold', label: 'Vorwärts →', holdFrames: 30,
      conflicts: ['stop'],
      check(lm) {
        if (!_v(lm, 12, 16)) return false;
        return (lm[12].x - lm[16].x) > _XV && Math.abs(lm[16].y - lm[12].y) < _YT;
      },
    },

    /**
     * Backward – left arm extended horizontally to person's left.
     * Blocked by 'stop' for the same reason as 'forward'.
     */
    backward: {
      name: 'backward', type: 'hold', label: '← Rückwärts', holdFrames: 30,
      conflicts: ['stop'],
      check(lm) {
        if (!_v(lm, 11, 15)) return false;
        return (lm[15].x - lm[11].x) > _XV && Math.abs(lm[15].y - lm[11].y) < _YT;
      },
    },

    /**
     * Pause – right wrist held still at chest height near the body centre.
     * Uses the previous history frame to measure per-frame displacement.
     */
    pause: {
      name: 'pause', type: 'hold', label: 'Pause (Stillstand)', holdFrames: 45,
      check(lm, history) {
        if (!_v(lm, 0, 11, 12, 16, 24)) return false;
        if (history.length < 2) return false;
        const prev    = history[history.length - 2];
        const rW      = lm[16];
        const moved   = Math.abs(rW.x - prev[16].x) + Math.abs(rW.y - prev[16].y);
        const centerX = (lm[11].x + lm[12].x) / 2;
        const inZone  = rW.y > lm[0].y &&
                        rW.y < lm[24].y - 0.05 &&
                        Math.abs(rW.x - centerX) < 0.15;
        return moved < 0.008 && inZone;
      },
    },

    // ── Velocity gestures ────────────────────────────────────────────────────

    /** Scroll Up – right wrist moves quickly upward. */
    scrollUp: {
      name: 'scrollUp', type: 'velocity', label: 'Scroll ↑',
      check(lm, history) {
        const H = 15;
        if (history.length < H) return false;
        const s = history.slice(-H);
        if (!s.every(f => f[16].visibility > _MV)) return false;
        const oldY = _avg(s.slice(0, 5).map(f => f[16].y));
        const newY = _avg(s.slice(-5).map(f  => f[16].y));
        return oldY - newY > 0.18;
      },
    },

    /** Scroll Down – right wrist moves quickly downward. */
    scrollDown: {
      name: 'scrollDown', type: 'velocity', label: 'Scroll ↓',
      check(lm, history) {
        const H = 15;
        if (history.length < H) return false;
        const s = history.slice(-H);
        if (!s.every(f => f[16].visibility > _MV)) return false;
        const oldY = _avg(s.slice(0, 5).map(f => f[16].y));
        const newY = _avg(s.slice(-5).map(f  => f[16].y));
        return newY - oldY > 0.18;
      },
    },

    /** Zoom In – both wrists move closer together. */
    zoomIn: {
      name: 'zoomIn', type: 'velocity', label: 'Zoom +',
      check(lm, history) {
        const H = 20;
        if (history.length < H) return false;
        const s = history.slice(-H);
        if (!s.every(f => Math.min(f[15].visibility, f[16].visibility) > _MV)) return false;
        const d    = f => Math.hypot(f[15].x - f[16].x, f[15].y - f[16].y);
        const oldD = _avg(s.slice(0, 5).map(d));
        const newD = _avg(s.slice(-5).map(d));
        return oldD - newD > 0.15;
      },
    },

    /** Zoom Out – both wrists move further apart. */
    zoomOut: {
      name: 'zoomOut', type: 'velocity', label: 'Zoom −',
      check(lm, history) {
        const H = 20;
        if (history.length < H) return false;
        const s = history.slice(-H);
        if (!s.every(f => Math.min(f[15].visibility, f[16].visibility) > _MV)) return false;
        const d    = f => Math.hypot(f[15].x - f[16].x, f[15].y - f[16].y);
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
      name: 'swipeRight', type: 'velocity', label: 'Wischen → (Schnell)',
      check(lm, history) {
        const H = 15;
        if (history.length < H) return false;
        const s = history.slice(-H);
        if (!s.every(f => f[16].visibility > _MV)) return false;
        const oldX = _avg(s.slice(0, 5).map(f => f[16].x));
        const newX = _avg(s.slice(-5).map(f  => f[16].x));
        return oldX - newX > 0.15;
      },
    },

  };

  // ── Export ──────────────────────────────────────────────────────────────────

  global.GestureLibrary = GestureLibrary;

})(typeof window !== 'undefined' ? window : globalThis);
