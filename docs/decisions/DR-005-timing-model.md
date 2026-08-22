# DR-005 – Zeitmodell: Frames → Millisekunden

**Status:** Umgesetzt
**Datum:** 2026-08-22
**Kontext:** Issue #6 – Vertiefung, Fix 1 (Frame-Rate-Abhängigkeit)

---

## Kontext

`docs/gestures.md` dokumentiert unter „Bekannte Stabilitätsprobleme" bereits das
Kernproblem: `holdFrames` und `cooldownFrames` zählen reine Frames. Bei
abweichender Framerate (z. B. 15 fps bei schlechtem Licht) verdoppelt sich die
effektiv erlebte Haltezeit einer Geste – aus „~1 s halten" werden „~2 s halten",
ohne dass sich am Code etwas ändert. Die Frage: Wie lässt sich das Timing
frame-rate-unabhängig machen, ohne bestehende Aufrufer (beide Demos, potenzielle
Drittanwendungen) zu brechen?

---

## Entscheidung

`update(landmarks, timestamp?)` erhält einen **optionalen** Zeitstempel in
Millisekunden. Intern laufen Halte- und Cooldown-Zustand vollständig in ms
(`_holdElapsed`, `_cooldownRemaining`). Gesten-Definitionen akzeptieren `holdMs`
(neu, bevorzugt) oder `holdFrames` (weiter unterstützt, wird bei der
Registrierung einmalig über `nominalFps` in ms umgerechnet). Wird `update()`
ohne Zeitstempel aufgerufen, läuft eine nominale 30-fps-Uhr mit – exakt das
bisherige Verhalten für unveränderten Aufrufer-Code. Ein `maxFrameGapMs`-Clamp
(Default 250 ms) verhindert, dass ein gestallter Feed (z. B. Tab im Hintergrund)
einen Hold in einem einzigen Zeitsprung abschließen lässt.

---

## Betrachtete Alternativen

| Alternative                                                     | Begründung für Ablehnung                                                                                                                     |
| --------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Harter Cutover: Zeitstempel als Pflichtparameter                | Bricht sämtliche bestehenden Aufrufer sofort, ohne Migrationspfad                                                                            |
| Zeitstempel intern selbst holen (z. B. via `performance.now()`) | Funktioniert nicht in Node (Tests laufen ohne DOM); bindet den Kern unnötig an den Browser-Kontext                                           |
| Separate `updateMs()`-Methode neben `update()`                  | Verdoppelt die API-Fläche für denselben Zweck; unklar, welche Methode wann zu verwenden ist                                                  |
| Timing dem Aufrufer überlassen (Library bleibt frame-basiert)   | Verschiebt die Lösung eines dokumentierten Library-Problems in jede einzelne Anwendung – widerspricht dem Zweck einer wiederverwendbaren Lib |

---

## Begründung

Ein optionaler Parameter ist additiv, nicht brechend. Die Umrechnung von
`holdFrames` findet einmalig bei `register()` statt, nicht pro Frame im
Hot-Path. `maxFrameGapMs` schützt gegen unrealistische Zeitsprünge, ohne die
normale Nutzung zu beeinträchtigen.

---

## Konsequenzen

- **Positiv**: Beweisbar frame-rate-unabhängig – siehe `test/frame-rate.test.js`
  und `npm run bench`. Dieselbe Geste braucht bei 30/15/10 fps dieselbe
  Wall-Clock-Zeit (~1000 ms) statt bei 15 fps doppelt so lange wie bei 30 fps.
- **Positiv**: `getState()`/`getGestures()`/`getProgress()` geben weiter
  Frame-Äquivalente zurück – bestehende UI-Konsumenten brauchen keine Anpassung.
- **Negativ**: Zwei parallele Einheiten (ms intern, Frames nach außen) erhöhen
  die kognitive Last beim Lesen des Codes.
- **Negativ**: Ohne übergebenen Zeitstempel bleibt das alte, frame-rate-abhängige
  Verhalten bestehen (reines Opt-in) – beide Demos wurden deshalb explizit
  angepasst, echte Zeitstempel zu übergeben.
