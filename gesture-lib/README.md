# GestureLibrary – Public API Reference

A reusable, framework-free JavaScript library for detecting body gestures from
[MediaPipe Pose](https://google.github.io/mediapipe/solutions/pose.html) landmark data.

## Quick start

```html
<!-- 1. Load MediaPipe Pose (or any compatible provider) -->
<script src="https://cdn.jsdelivr.net/npm/@mediapipe/pose/pose.js"></script>

<!-- 2. Load the library -->
<script src="gesture-lib/gesture-library.js"></script>

<script>
  // 3. Instantiate with optional configuration
  const lib = new GestureLibrary({ cooldownFrames: 60 });

  // 4. Register all built-in gestures
  lib.useDefaults();

  // 5. Listen for results
  lib.addEventListener('gesture', ({ detail }) => {
    console.log(detail.name, detail.label, detail.timestamp);
  });

  // 6. Feed pose data each frame (inside your MediaPipe onResults callback)
  pose.onResults(results => {
    lib.update(results.poseLandmarks); // pass null when no person detected
  });
</script>
```

---

## Constructor

```js
new GestureLibrary([options]);
```

| Option           | Type   | Default | Description                                                                      |
| ---------------- | ------ | ------- | -------------------------------------------------------------------------------- |
| `bufferSize`     | number | `5`     | Frames averaged for landmark smoothing.                                          |
| `cooldownFrames` | number | `60`    | Frames (~2 s at 30 fps) during which no new gesture fires after one is detected. |
| `minVisibility`  | number | `0.60`  | Minimum landmark visibility score (0–1) required for a landmark to be used.      |
| `historySize`    | number | `30`    | Maximum number of smoothed frames kept for velocity gesture checks.              |

---

## Methods

### `register(definition)` → `this`

Register a custom gesture. Returns the library instance so calls can be chained.

```js
lib.register({
  name: 'myGesture', // unique string identifier
  type: 'hold', // 'hold' | 'velocity'
  label: 'My Gesture', // shown in events and UI

  // hold only: how many consecutive frames the condition must be true
  holdFrames: 30,

  // hold only: names of gestures whose accumulation blocks this one.
  // Useful for preventing a lower-priority gesture from accumulating
  // simultaneously with a higher-priority one.
  conflicts: ['stop'],

  // called every frame (hold) or every frame in velocity mode
  // lm      – current smoothed landmark array (same shape as MediaPipe output)
  // history – array of the last historySize smoothed frames, oldest first
  check(lm, history) {
    return; /* boolean */
  },
});
```

Gestures are evaluated in **registration order**. Register higher-priority
gestures first. Throwing an error if `name` is already registered ensures no
silent overwrites.

---

### `useDefaults()` → `this`

Registers all built-in gestures (see table below) in the recommended priority
order. Equivalent to calling `register()` for each built-in.

---

### `update(landmarks)` → `void`

Feed one frame of pose data. Call inside the MediaPipe `onResults` callback.

- When a pose is detected: pass `results.poseLandmarks`.
- When no pose is detected: pass `null` (or call with no argument).
  All state is reset automatically.

---

### `getState()` → `{ cooldown, holdCounters }`

Returns a **read-only snapshot** of the current internal state.

```js
const { cooldown, holdCounters } = lib.getState();
// cooldown      – frames remaining in the post-gesture lockout (0 = not locked)
// holdCounters  – { gestureName: frameCount, … }
```

Useful for rendering progress bars in a UI.

---

### `getGestures()` → `Array<{ name, type, label, holdFrames? }>`

Returns a list of all registered gestures. No check functions are exposed.

```js
lib
  .getGestures()
  .filter(g => g.type === 'hold')
  .forEach(g => {
    console.log(g.name, g.holdFrames);
  });
```

Use this instead of maintaining a separate gesture list in the application, so
the UI stays in sync with the library automatically.

---

### `isOnCooldown()` → `boolean`

Returns `true` while the post-gesture lockout is active.

---

### `reset()` → `void`

Immediately clears all internal state (smoothing buffers, history, hold counters,
cooldown). Useful when the camera feed is interrupted.

---

## Events

The library fires a `gesture` `CustomEvent` in two places:

1. **On the library instance** (`lib.addEventListener('gesture', cb)`)
2. **On `window`** (`window.addEventListener('gesture', cb)`) – lets any part of
   the application react without holding a reference to `lib`.

Event detail shape:

```js
{
  name:      'forward',          // matches the definition's name field
  label:     'Vorwärts →',       // human-readable
  timestamp: 1717235412000,      // Date.now() at detection time
}
```

---

## Built-in gestures

All built-in gestures use MediaPipe Pose landmarks. The coordinate system is
the **native MediaPipe image space**: x=0 is the left image edge (person's
right side), x=1 is the right edge (person's left side), y increases downward.

| Name          | Type     | Hold      | Description                                                                  |
| ------------- | -------- | --------- | ---------------------------------------------------------------------------- |
| `stop`        | hold     | 30 frames | T-pose: both arms extended horizontally.                                     |
| `armsCrossed` | hold     | 30 frames | Both wrists crossed in front of torso (cancel gesture).                      |
| `confirm`     | hold     | 30 frames | Both wrists raised above their shoulders.                                    |
| `volUp`       | hold     | 20 frames | Right wrist held above the nose.                                             |
| `volDown`     | hold     | 20 frames | Right wrist held below the right hip.                                        |
| `forward`     | hold     | 30 frames | Right arm extended horizontally to person's right.                           |
| `backward`    | hold     | 30 frames | Left arm extended horizontally to person's left.                             |
| `pause`       | hold     | 45 frames | Right wrist held still at chest height near body centre.                     |
| `scrollUp`    | velocity | —         | Right wrist moves quickly upward (Δy > 0.18 over 15 frames).                 |
| `scrollDown`  | velocity | —         | Right wrist moves quickly downward.                                          |
| `zoomIn`      | velocity | —         | Both wrists move closer together (Δdist > 0.15 over 20 frames).              |
| `zoomOut`     | velocity | —         | Both wrists move further apart.                                              |
| `swipeRight`  | velocity | —         | Right wrist sweeps quickly toward person's right (Δx > 0.15 over 15 frames). |

### Priority and conflicts

Built-in gestures are registered in the order shown above. Two conflict rules
prevent overlapping detection:

- `forward` and `backward` declare `conflicts: ['stop']`. While the T-pose is
  accumulating, neither arm-extended gesture accumulates.
- `volUp` declares `conflicts: ['confirm']`. While the victory pose is
  accumulating, vol-up does not accumulate.

---

## Adding a custom gesture

New gestures can be added at any time without modifying library source code:

```js
const lib = new GestureLibrary();
lib.useDefaults();

// Add a custom gesture: left hand raised above the nose
lib.register({
  name: 'leftHandUp',
  type: 'hold',
  label: 'Linke Hand oben',
  holdFrames: 20,
  check(lm) {
    // lm[0] = NOSE, lm[15] = LEFT_WRIST
    return (
      lm[15] &&
      lm[0] &&
      lm[15].visibility > 0.6 &&
      lm[0].visibility > 0.6 &&
      lm[15].y < lm[0].y - 0.05
    );
  },
});
```

No existing gesture definitions are touched.

---

## Landmark index reference

| Index | Landmark       |
| ----- | -------------- |
| 0     | NOSE           |
| 11    | LEFT_SHOULDER  |
| 12    | RIGHT_SHOULDER |
| 15    | LEFT_WRIST     |
| 16    | RIGHT_WRIST    |
| 23    | LEFT_HIP       |
| 24    | RIGHT_HIP      |

Full reference: [MediaPipe Pose landmark map](https://google.github.io/mediapipe/solutions/pose.html#pose-landmark-model-blazepose-ghum-3d)
