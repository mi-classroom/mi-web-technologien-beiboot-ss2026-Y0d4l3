# DR-004 – Selektive Gesten-Unterdrückung: `disable()` / `enable()` und `getProgress()`

**Status:** Umgesetzt
**Datum:** 2026-07-13
**Kontext:** Issue #4 – Demo-Anwendung „GestureQuiz"

---

## Hintergrund

Beim Bau der Demo-Anwendung GestureQuiz wurden zwei Lücken in der öffentlichen API
aufgedeckt, die den Aufwand für Anwendungscode unnötig erhöhten.
Die Erkenntnisse stammen aus dem Versuch, die Library _ohne Blick in den Quellcode_
zu nutzen und nur auf README und TypeScript-Kommentare zu vertrauen.

---

## Problem 1 – Keine selektive Gesten-Unterdrückung

### Situation

`useDefaults()` registriert alle 13 eingebauten Gesten auf einmal.
GestureQuiz benötigt davon nur vier:

| Geste      | Aktion             |
| ---------- | ------------------ |
| `forward`  | Antwort A wählen   |
| `backward` | Antwort B wählen   |
| `confirm`  | Antwort C wählen   |
| `stop`     | Frage überspringen |

Die übrigen neun Gesten (volUp, volDown, scrollUp, scrollDown, zoomIn, zoomOut,
swipeRight, pause, armsCrossed) sind im Spielkontext unerwünscht.

### Verfügbare Optionen vor der Änderung

**Option A – Event-Handler-Filter**
Im `gesture`-Event-Handler unerwünschte Namen ignorieren.
_Problem:_ Die Gesten werden intern weiter akkumuliert.
Das Conflict-System wertet Akkumulatoren aus: Läuft etwa `armsCrossed` ungehindert
auf, kann es über die `conflicts`-Liste eine andere Geste sperren – auch wenn die
App kein `armsCrossed`-Event verarbeitet.
Außerdem feuern unerwünschte Gesten auf `window`, was andere Listeners stört.

**Option B – `reset()` als Unterdrückung missbrauchen**
Nach jeder Detektion sofort `reset()` aufrufen, um den Zustand zu löschen.
_Problem:_ `reset()` leert auch die Smoothing- und History-Puffer; die nächste
gewünschte Geste braucht dann deutlich länger, bis sie feuert.

**Option C – `useDefaults()` nicht verwenden, nur gewünschte Gesten manuell registrieren**
_Problem:_ Erfordert das Kopieren der Gesture-Definitionen aus `BUILTINS`.
Das setzt voraus, die interne Struktur zu kennen – widerspricht dem Ziel einer
opaken öffentlichen API.
Zudem werden die konzipierten Konfliktkaskaden (z. B. stop → forward/backward)
nicht mehr automatisch aufgebaut.

### Entschiedene Lösung

Zwei neue Methoden wurden zur Library hinzugefügt:

```js
lib.disable(name); // Geste aus Erkennungsschleife ausblenden
lib.enable(name); // Geste wieder aktivieren
```

**Verhalten:**

- Deaktivierte Gesten werden in `update()` übersprungen; ihr Akkumulator wird
  auf 0 gesetzt und nicht erhöht.
- Sie bleiben registriert, sodass `useDefaults()` weiter genutzt werden kann.
- Das Conflict-System ignoriert deaktivierte Gesten korrekt (Counter = 0 zählt
  nicht als Konflikt).
- `reset()` löscht **nicht** die Disabled-Menge; deaktivierte Gesten bleiben
  nach einem `reset()` deaktiviert.
- `getGestures()` enthält neu das Feld `disabled: boolean` pro Eintrag, damit
  UIs den Zustand darstellen können.

**Nutzung in GestureQuiz:**

```js
lib.useDefaults();

// Nicht benötigte Gesten unterdrücken
for (const name of [
  'volUp',
  'volDown',
  'scrollUp',
  'scrollDown',
  'zoomIn',
  'zoomOut',
  'swipeRight',
  'pause',
]) {
  lib.disable(name);
}
```

### Verworfene Alternativen

**`unregister(name)`** – Entfernt die Geste dauerhaft aus `_gestures`.
Vorteil: sauberere Semantik.
Nachteil: Keine Möglichkeit, die Geste später wieder einzuschalten; das Objekt
muss neu instantiiert werden. Zu restriktiv für Szenarien, in denen Gesten
kontextabhängig umgeschaltet werden sollen.

**Allowlist-Parameter in `useDefaults(['forward', 'backward', …])`** –
Würde `useDefaults()` auf eine andere Signatur umstellen.
Bricht die bestehende API und macht den häufigsten Anwendungsfall (alle Gesten)
expliziter als nötig.

---

## Problem 2 – Umständliche Fortschrittsberechnung

### Situation

Um einen Fortschrittsbalken für eine Halte-Geste anzuzeigen, benötigte der
Anwendungscode bisher:

```js
// 1. Metadaten holen (holdFrames)
const meta = lib.getGestures().reduce((m, g) => {
  m[g.name] = g;
  return m;
}, {});

// 2. Zähler holen
const { holdCounters } = lib.getState();

// 3. Fortschritt berechnen
const pct = holdCounters['forward'] / meta['forward'].holdFrames;
```

Das ist Boilerplate, das jede Anwendung, die Fortschrittsanzeigen braucht,
identisch schreiben müsste.

### Entschiedene Lösung

Neue Methode `getProgress()`:

```js
const progress = lib.getProgress();
// → {
//     forward:  { count: 18, holdFrames: 30, progress: 0.6 },
//     backward: { count:  0, holdFrames: 30, progress: 0.0 },
//     …
//   }
```

- Liefert alle Halte-Gesten in einem Aufruf.
- `progress` ist auf [0, 1] normiert.
- Deckt auch deaktivierte Gesten ab (count bleibt 0).

**Nutzung in GestureQuiz:**

```js
function updateHoldBars() {
  const progress = lib.getProgress();
  for (const [name, data] of Object.entries(progress)) {
    const bar = document.getElementById(`pb-${name}`);
    if (bar) bar.style.width = `${Math.round(data.progress * 100)}%`;
  }
}
```

### Verworfene Alternativen

**`getState()` erweitern** – `holdCounters` um Prozentsätze ergänzen.
Würde `getState()` mit berechneten Werten mischen, die ohnehin aus den bereits
bekannten `holdFrames` ableitbar sind; vermischt Rohzustand mit Präsentationslogik.

**Keine Änderung, Boilerplate dokumentieren** –
Technisch korrekt, aber ein schlechtes Entwicklererlebnis. Die Kombination
zweier Methoden für einen offensichtlichen Anwendungsfall ist ein klares Signal,
dass eine Abstraktionsebene fehlt.

---

## Zusammenfassung der Änderungen

| Änderung                                       | Datei                            | Zeilen |
| ---------------------------------------------- | -------------------------------- | ------ |
| `_disabled` Set im Konstruktor                 | `gesture-lib/gesture-library.js` | ~1     |
| `disable(name)` Methode                        | `gesture-lib/gesture-library.js` | ~10    |
| `enable(name)` Methode                         | `gesture-lib/gesture-library.js` | ~5     |
| `getProgress()` Methode                        | `gesture-lib/gesture-library.js` | ~12    |
| `getGestures()` um `disabled`-Feld erweitert   | `gesture-lib/gesture-library.js` | ~3     |
| `update()`: Disabled-Check in beiden Schleifen | `gesture-lib/gesture-library.js` | ~2     |

Alle Änderungen sind rückwärtskompatibel: bestehende Aufrufer erhalten neue
Felder in Rückgabewerten, ihre Signatur ändert sich nicht.
