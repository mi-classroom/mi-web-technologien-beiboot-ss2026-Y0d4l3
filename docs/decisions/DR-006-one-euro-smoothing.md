# DR-006 – Landmark-Glättung: 1€-Filter als wählbare Strategie

**Status:** Umgesetzt
**Datum:** 2026-08-22
**Kontext:** Issue #6 – Vertiefung, Fix 2 (naive Glättung)

---

## Kontext

`docs/gestures.md` beschreibt die Z-Achse als stark verrauscht und benennt den
festen gleitenden Mittelwert (`bufferSize`-Fenster) allgemein als Kompromiss.
Ein fester Mittelwert erzwingt einen festen Trade-off zwischen Jitter und Lag:
ein größeres Fenster glättet Ruhe-Jitter stärker, verzögert aber jede echte
Bewegung um dieselbe Fenstergröße. Die Frage: Wie lässt sich Ruhe-Jitter senken,
ohne die Reaktionsfähigkeit bei schnellen Gesten zu verschlechtern?

---

## Entscheidung

Neue Konstruktor-Option `smoothing: 'movingAverage' | 'oneEuro'`, Default bleibt
`movingAverage` (kein Breaking Change). Der **1€-Filter** (Casiez, Roussel,
Vogel – CHI 2012) ist in einer eigenen, dependency-freien Datei
(`gesture-lib/one-euro.js`) implementiert: ein Filter pro Landmark-Achse
(x/y/z), Visibility wird bewusst **ungefiltert** durchgereicht, damit das
Occlusion-Gate (Verlässt eine Hand das Bild) sofort reagiert statt verzögert.
Tuning über die `oneEuro`-Option (`minCutoff`, `beta`, `dCutoff`); der
Default-Wert `beta=1.0` basiert auf den Benchmark-Messungen in `bench/`.

---

## Betrachtete Alternativen

| Alternative                                                              | Begründung für Ablehnung                                                                                                                   |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Kalman-Filter                                                            | Deutlich komplexer zu parametrieren (Prozess-/Messrauschen-Kovarianzen); Overengineering für unabhängige 1D-Signale pro Achse              |
| Größerer/adaptiver Mittelwert-Puffer                                     | Löst das Grundproblem nicht wirklich – bleibt ein reiner Mittelwert ohne geschwindigkeitsabhängige Reaktion, nur mit mehr internem Zustand |
| 1€-Filter fest statt Mittelwert einbauen (kein Umschalter)               | Bricht die dokumentierte Baseline ohne Not; verhindert den geforderten Vorher/Nachher-Vergleich innerhalb derselben Codebasis              |
| Glättung vollständig der Anwendung überlassen (Library liefert Rohdaten) | Verschiebt ein dokumentiertes Library-Problem in jede Anwendung – widerspricht dem Zweck einer wiederverwendbaren Library                  |

---

## Begründung

Eine Strategie-Option statt eines Ersatzes erlaubt den A/B-Vergleich
(`bench/metrics.js`, `npm run bench`) und lässt bestehende Nutzer unangetastet.
Der 1€-Filter ist genau für dieses Problem entworfen (Jitter bei Ruhe runter,
Lag bei Bewegung runter) und mit zwei verständlichen Parametern (`minCutoff`,
`beta`) deutlich einfacher zu erklären als ein Kalman-Filter. Eine separate
Datei plus eigene Tests halten die Kernklasse unabhängig testbar.

---

## Konsequenzen

- **Positiv** (gemessen, `npm run bench`): Ruhe-Jitter sinkt um zusätzliche
  ~29 % gegenüber dem Mittelwert; Latenz bei schnellen Gesten sinkt um ~41 %
  (bei `beta=2`).
- **Negativ, ehrlich gemessen** (`test/benchmark.test.js`): Bei sehr langsamer
  Drift lagt der 1€-Filter etwas mehr als der Mittelwert – ein expliziter
  Trade-off, kein Freifahrtschein für pauschale Überlegenheit.
- **Negativ**: Eine zusätzliche Datei (`one-euro.js`) muss an jedem Einsatzort
  korrekt geladen werden (Browser: `<script>`-Tag; Node: `require`) – fehlte
  zunächst in beiden Demos und wurde nachträglich ergänzt.
- Kein Breaking Change: Default bleibt `movingAverage`.
