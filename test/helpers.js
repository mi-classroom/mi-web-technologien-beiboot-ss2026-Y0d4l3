'use strict';

/**
 * Test helpers: synthetic MediaPipe-Pose landmark frames.
 *
 * Coordinate system (native MediaPipe image space, unmirrored):
 *   x = 0 → left image edge  = person's RIGHT side
 *   x = 1 → right image edge = person's LEFT side
 *   y = 0 → top, y = 1 → bottom
 *
 * Frames are full 33-landmark arrays so the library's per-landmark smoothing
 * loop has a consistent shape. Only the landmarks the built-in gestures read
 * are given meaningful positions; the rest are neutral filler.
 */

const LANDMARK_COUNT = 33;

/** A neutral standing pose: person centred, both arms hanging down. Fires nothing. */
function baseFrame() {
  const lm = [];
  for (let i = 0; i < LANDMARK_COUNT; i++) {
    lm.push({ x: 0.5, y: 0.5, z: 0, visibility: 1 });
  }
  lm[0] = { x: 0.5, y: 0.15, z: 0, visibility: 1 }; // NOSE
  lm[11] = { x: 0.6, y: 0.35, z: 0, visibility: 1 }; // LEFT_SHOULDER (person's left = high x)
  lm[12] = { x: 0.4, y: 0.35, z: 0, visibility: 1 }; // RIGHT_SHOULDER (person's right = low x)
  lm[15] = { x: 0.62, y: 0.65, z: 0, visibility: 1 }; // LEFT_WRIST (down)
  lm[16] = { x: 0.38, y: 0.65, z: 0, visibility: 1 }; // RIGHT_WRIST (down)
  lm[23] = { x: 0.58, y: 0.68, z: 0, visibility: 1 }; // LEFT_HIP
  lm[24] = { x: 0.42, y: 0.68, z: 0, visibility: 1 }; // RIGHT_HIP
  return lm;
}

/** Right arm extended horizontally to the person's right → 'forward'. */
function forwardPose() {
  const lm = baseFrame();
  lm[16] = { x: 0.1, y: 0.35, z: 0, visibility: 1 };
  return lm;
}

/** Left arm extended horizontally to the person's left → 'backward'. */
function backwardPose() {
  const lm = baseFrame();
  lm[15] = { x: 0.9, y: 0.35, z: 0, visibility: 1 };
  return lm;
}

/** Both arms extended horizontally (T-pose) → 'stop'. */
function stopPose() {
  const lm = baseFrame();
  lm[16] = { x: 0.1, y: 0.35, z: 0, visibility: 1 };
  lm[15] = { x: 0.9, y: 0.35, z: 0, visibility: 1 };
  return lm;
}

/** Feed the same frame `times` times. */
function feed(lib, frame, times) {
  for (let i = 0; i < times; i++) lib.update(frame);
}

/** Collect fired gesture names into an array via an event listener. */
function recordEvents(lib) {
  const names = [];
  lib.addEventListener('gesture', ({ detail }) => names.push(detail.name));
  return names;
}

module.exports = {
  LANDMARK_COUNT,
  baseFrame,
  forwardPose,
  backwardPose,
  stopPose,
  feed,
  recordEvents,
};
