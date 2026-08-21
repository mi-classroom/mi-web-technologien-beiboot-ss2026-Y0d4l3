'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');

const GestureLibrary = require('../gesture-lib/gesture-library.js');
const { baseFrame, forwardPose, stopPose, feed, recordEvents } = require('./helpers.js');

// These tests pin the observable public-API contract of the library as it
// behaves today. They are the baseline the later timing / smoothing refactors
// must not break (timing-specific expectations live in their own suites).

test('useDefaults registers all 13 built-in gestures in priority order', () => {
  const lib = new GestureLibrary();
  lib.useDefaults();

  const names = lib.getGestures().map(g => g.name);
  assert.deepEqual(names, [
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
  ]);
});

test('register() rejects invalid and duplicate definitions', () => {
  const lib = new GestureLibrary();

  assert.throws(() => lib.register({}), /name, type, and check/);
  assert.throws(() => lib.register({ name: 'x', type: 'hold' }), /name, type, and check/);

  lib.register({ name: 'x', type: 'hold', label: 'X', holdFrames: 3, check: () => false });
  assert.throws(() => lib.register({ name: 'x', type: 'hold', check: () => false }), /already/);
});

test('a held gesture fires exactly once and then enters cooldown', () => {
  const lib = new GestureLibrary();
  lib.useDefaults();
  const fired = recordEvents(lib);

  feed(lib, forwardPose(), 30); // holdFrames for 'forward' is 30

  assert.deepEqual(fired, ['forward']);
  assert.equal(lib.isOnCooldown(), true);
  assert.equal(lib.getState().cooldown, lib.cooldownFrames);
});

test('an unmet gesture condition never fires (neutral pose is silent)', () => {
  const lib = new GestureLibrary();
  lib.useDefaults();
  const fired = recordEvents(lib);

  feed(lib, baseFrame(), 90);

  assert.deepEqual(fired, []);
});

test('conflict rule: an accumulating T-pose blocks forward from firing', () => {
  const lib = new GestureLibrary();
  lib.useDefaults();
  const fired = recordEvents(lib);

  // The T-pose satisfies both the stop condition and the forward condition,
  // but forward declares conflicts:['stop'], so only stop may fire.
  feed(lib, stopPose(), 30);

  assert.deepEqual(fired, ['stop']);
});

test('disable() suppresses a gesture; enable() restores it', () => {
  const lib = new GestureLibrary();
  lib.useDefaults();
  const fired = recordEvents(lib);

  lib.disable('forward');
  feed(lib, forwardPose(), 30);
  assert.deepEqual(fired, [], 'disabled gesture must not fire');
  assert.equal(lib.getGestures().find(g => g.name === 'forward').disabled, true);

  lib.reset();
  lib.enable('forward');
  feed(lib, forwardPose(), 30);
  assert.deepEqual(fired, ['forward'], 're-enabled gesture fires again');
});

test('disable() rejects an unknown gesture name', () => {
  const lib = new GestureLibrary();
  lib.useDefaults();
  assert.throws(() => lib.disable('does-not-exist'), /not registered/);
});

test('getProgress reports hold accumulation as a 0..1 ratio', () => {
  const lib = new GestureLibrary();
  lib.useDefaults();

  feed(lib, forwardPose(), 15); // half of 30 holdFrames

  const p = lib.getProgress().forward;
  assert.equal(p.holdFrames, 30);
  assert.equal(p.count, 15);
  assert.ok(Math.abs(p.progress - 0.5) < 1e-9);
});

test('update(null) resets accumulation and cooldown state', () => {
  const lib = new GestureLibrary();
  lib.useDefaults();

  feed(lib, forwardPose(), 15);
  assert.ok(lib.getProgress().forward.count > 0);

  lib.update(null);
  assert.equal(lib.getProgress().forward.count, 0);
  assert.equal(lib.getState().cooldown, 0);
});

test('gesture event detail carries name, label and a timestamp', () => {
  const lib = new GestureLibrary();
  lib.useDefaults();

  let detail = null;
  lib.addEventListener('gesture', e => {
    detail = e.detail;
  });

  feed(lib, forwardPose(), 30);

  assert.equal(detail.name, 'forward');
  assert.equal(typeof detail.label, 'string');
  assert.equal(typeof detail.timestamp, 'number');
});
