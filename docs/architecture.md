# Architektur

Zwei schlanke Diagramme: der Gesamtaufbau (wer spricht mit wem) und die
`update()`-Pipeline innerhalb der Library, in der beide Vertiefungs-Fixes
greifen (siehe [DR-005](decisions/DR-005-timing-model.md) und
[DR-006](decisions/DR-006-one-euro-smoothing.md)).

## Gesamtaufbau

Alles läuft clientseitig im Browser, kein Backend (siehe README,
„Datenschutz"). MediaPipe liefert pro Frame Pose-Landmarks; die Library
übersetzt sie in Custom Events; die Demo-Anwendung hört nur auf diese Events
und kennt die Library-Internas nicht.

```mermaid
flowchart LR
    cam["Webcam"] --> mp["MediaPipe Pose\n(CDN, WASM/WebGL)"]
    mp -- "poseLandmarks (33 × {x,y,z,visibility})" --> lib["GestureLibrary\ngesture-lib/gesture-library.js"]
    lib -- "CustomEvent 'gesture'\n(auf sich selbst)" --> app["Demo-Anwendung\nindex.html / demo-app/"]
    lib -- "CustomEvent 'gesture'\n(auf window)" --> win["window"]
    win --> app
    lib -.-> filter["OneEuroFilter\ngesture-lib/one-euro.js\n(nur smoothing: 'oneEuro')"]
```

Die Library ist die einzige Stelle, die MediaPipe-Koordinaten kennt; die
Demo-Anwendung kommuniziert ausschließlich über die öffentliche API
(`register`, `useDefaults`, `update`, `disable`/`enable`, `getProgress`,
`addEventListener('gesture', …)`).

## Die `update()`-Pipeline

Ein Aufruf pro Kamera-Frame. Hervorgehoben, wo die beiden Fixes dieser
Vertiefung eingreifen.

```mermaid
flowchart TD
    A["update(landmarks, timestamp?)"] --> B{"landmarks vorhanden?"}
    B -- nein --> R["_resetState()"]
    B -- ja --> C["_advanceClock(timestamp)\n→ dt in ms (Fix 1, DR-005)"]
    C --> D["_smooth(landmarks, dt)\nmovingAverage | oneEuro (Fix 2, DR-006)"]
    D --> E["historyBuf aktualisieren\n(für Velocity-Gesten)"]
    E --> F{"cooldownRemaining > 0?"}
    F -- ja --> G["cooldownRemaining -= dt"]
    F -- nein --> H["Hold-Gesten prüfen\n(Registrierungsreihenfolge,\nConflicts beachten)"]
    H --> I{"holdElapsed ≥ holdMs?"}
    I -- ja --> J["_trigger()\nCustomEvent dispatch + Cooldown starten"]
    I -- nein --> K["Velocity-Gesten prüfen"]
    K --> L{"Geste erkannt?"}
    L -- ja --> J
```

**Was sich durch die Vertiefung geändert hat:** Schritt `C` liefert vor dieser
Vertiefung immer einen festen Nominal-Frame-Schritt; Schritt `D` war fest auf
den gleitenden Mittelwert verdrahtet. Beide Schritte sind jetzt austauschbar
(Zeitstempel optional, Glättungsstrategie wählbar) — ohne dass sich an den
Schritten `E`–`L` etwas ändert.
