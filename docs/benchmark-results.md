# Benchmark-Ergebnisse (Vorher/Nachher)

Persistierter Vorher/Nachher-Beleg für die beiden Fixes dieser Vertiefung
(siehe [DR-005](decisions/DR-005-timing-model.md) und
[DR-006](decisions/DR-006-one-euro-smoothing.md)). Erzeugt mit `npm run bench`
auf Node v22.22.0. Die Messungen laufen auf deterministisch geseedeten
Signalen (`bench/metrics.js`, `bench/timing.js`) — ein erneuter Lauf von
`npm run bench` liefert exakt dieselben Zahlen.

```text
=== Fix 1: Landmark smoothing — moving average vs. 1€ filter ===

Jitter at rest (stddev of a stationary, noisy signal — lower is steadier):
  raw (unfiltered)     0.0098
  moving average       0.0041  (-59% vs raw)
  1€ filter            0.0029  (-71% vs raw, -29% vs moving average)

Lag on a FAST gesture (mean abs. distance from the true position — lower is more responsive):
  moving average       0.0997
  1€ filter            0.0592  (-41% vs moving average)

Lag on a SLOW drift (same metric, slower motion — the honest trade-off):
  moving average       0.0197
  1€ filter            0.0291  (+48% vs moving average)
  → 1€ trades a little slow-drift lag for much lower rest jitter and lower fast-gesture lag.

=== Fix 2: Hold timing — frame count vs. milliseconds ===

Replaying a held "forward" pose at different frame rates:

  30 fps  →  fired after 31 frames, 1000 ms
  15 fps  →  fired after 16 frames, 1000 ms
  10 fps  →  fired after 11 frames, 1000 ms

  All three converge on ~1000 ms: the fix makes the trigger time frame-rate
  independent. The frame-counting predecessor fired after a fixed 30 frames
  regardless of rate — ~1000 ms at 30 fps, but ~2000 ms at 15 fps.

See test/benchmark.test.js and test/frame-rate.test.js for the assertions behind these numbers.
```

## Einordnung

**Fix 1 (Glättung):** Der 1€-Filter reduziert Ruhe-Jitter deutlich stärker als
der ursprüngliche gleitende Mittelwert (−71 % vs. roh, −29 % zusätzlich
gegenüber dem Mittelwert) und senkt bei schnellen Gesten auch die Latenz
(−41 %). Der ehrliche Gegenpol: bei sehr langsamer Drift lagt der 1€-Filter
etwas mehr (+48 %) als der Mittelwert — ein bewusster Trade-off, kein
pauschaler Sieger. Deshalb bleibt `movingAverage` der Default, `oneEuro` ist
opt-in (`smoothing: 'oneEuro'`).

**Fix 2 (Timing):** Vor dem Fix hätte dieselbe Geste bei 15 fps doppelt so
lange gebraucht wie bei 30 fps (Frame-Zählung statt Zeitmessung). Nach dem
Fix lösen 30/15/10 fps alle bei ~1000 ms Wall-Clock-Zeit aus — nur die Anzahl
der dafür nötigen Frames unterscheidet sich (31 / 16 / 11).

## Reproduzieren

```bash
npm ci
npm run bench
```
