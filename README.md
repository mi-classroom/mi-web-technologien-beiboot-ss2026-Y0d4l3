# Web Tech Beiboot-Projekt ⛵ — Robustheit der Gestenerkennung

## Hochschulkontext

|                    |                                                                     |
| ------------------ | ------------------------------------------------------------------- |
| **Studiengang**    | Master Digital Science                                              |
| **Modul**          | Web Technologien                                                    |
| **Semester**       | SS 2026                                                             |
| **Betreuung**      | Prof. Christian Noss                                                |
| **Art der Arbeit** | Modulprojekt / Studienleistung                                      |
| **Bearbeitung**    | Michel Haurand ([@Y0d4l3](https://github.com/Y0d4l3)), Einzelarbeit |

---

## Was ist das?

Eine wiederverwendbare, framework-freie JavaScript-Library
(`gesture-lib/gesture-library.js`), die Körperdaten (Pose-Landmarks von
[MediaPipe Pose](https://google.github.io/mediapipe/solutions/pose.html))
über die Webcam direkt im Browser in Gesten übersetzt und als **Custom
Browser Events** bereitstellt. Web-Anwendungen reagieren dann über simples
`addEventListener('gesture', …)` auf Nutzerbewegungen — ganz ohne die Library
selbst zu kennen.

Zwei Demo-Anwendungen zeigen die Library im Einsatz:

- [`index.html`](index.html) — die ursprüngliche Rohdaten-/Debug-Demo (Issue #3)
- [`demo-app/`](demo-app/) — **GestureQuiz**, ein körpergesteuertes Web-Tech-Quiz (Issue #4)

**Live-Demo:** https://mi-classroom.github.io/mi-web-technologien-beiboot-ss2026-Y0d4l3/
(GestureQuiz: [`/demo-app/`](https://mi-classroom.github.io/mi-web-technologien-beiboot-ss2026-Y0d4l3/demo-app/))

## Diese Abgabe: Vertiefung statt neuer Anwendung

Issue #6 stellte die Wahl zwischen einer neuen Vision-Anwendung (Weg A) und
echter Tiefenarbeit an einer bestehenden Schwachstelle (Weg B). Die
Begründung für Weg B — und wofür sich explizit **gegen** eine dritte
Anwendung entschieden wurde — steht in [DR-007](docs/decisions/DR-007-scope-vertiefung.md).

**Forschungsfrage:** Wie lässt sich die Latenz und Jitter-Robustheit der
pose-basierten Gestenerkennung unter realen Bedingungen (Bildrauschen,
schwankende Framerate) messbar verbessern, ohne die öffentliche API zu
brechen?

Zwei zusammenhängende Schwachstellen aus [docs/gestures.md](docs/gestures.md)
wurden bearbeitet:

| Problem                                                                                                 | Lösung                                                                                   | Details                                               |
| ------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| Halte-/Cooldown-Timing lief in Frames statt Zeit — bei 15 fps dauerte eine "1-Sekunden"-Geste real ~2 s | `update()` akzeptiert einen optionalen Zeitstempel; Timing läuft intern in Millisekunden | [DR-005](docs/decisions/DR-005-timing-model.md)       |
| Fester gleitender Mittelwert erzwingt einen festen Jitter/Lag-Trade-off                                 | Wählbarer 1€-Filter (`smoothing: 'oneEuro'`)                                             | [DR-006](docs/decisions/DR-006-one-euro-smoothing.md) |

Beide Fixes sind mit einem Mess-Harness belegt, das dieselbe Logik wie die
Test-Suite nutzt:

```bash
npm run bench
```

**Kurzfassung der Messwerte** (Details: `npm run bench`, Tests in
[`test/frame-rate.test.js`](test/frame-rate.test.js) und
[`test/benchmark.test.js`](test/benchmark.test.js)):

- Hold-Trigger jetzt bei 30/15/10 fps konstant bei ~1000 ms Wall-Clock-Zeit
  (vorher: ~1000 ms bei 30 fps, aber ~2000 ms bei 15 fps).
- 1€-Filter senkt Ruhe-Jitter um zusätzlich ~29 % gegenüber dem Mittelwert und
  die Latenz bei schnellen Gesten um ~41 %.
- **Ehrlicher Trade-off**: bei sehr langsamer Drift lagt der 1€-Filter etwas
  mehr als der Mittelwert — deshalb bleibt `movingAverage` der Default und
  `oneEuro` ist opt-in.

Bewusst **nicht** Teil dieser Vertiefung (Timebox, siehe DR-007): Distanz-
Normierung und Ellenbogen-Check. Beide bleiben als Future Work dokumentiert.

## Voraussetzungen

- **Node.js ≥ 20** (siehe [`.nvmrc`](.nvmrc); getestet mit Node 22)
- Ein moderner Browser mit Webcam-Zugriff (Chrome empfohlen für MediaPipe)
- Kein Build-System, keine Runtime-Dependency für die Library selbst — siehe
  [DR-008](docs/decisions/DR-008-tooling-stack.md)

## Lokale Installation & Start

```bash
npm ci                  # Dev-Tooling installieren (Lint/Format/Test — die
                         # Library selbst hat keine Runtime-Dependencies)
npm test                # 24 Unit-Tests (node:test)
npm run lint             # ESLint
npm run format:check     # Prettier-Check
npm run bench             # Vorher/Nachher-Report der Vertiefung
```

Die Demos sind statisches HTML/JS und brauchen nur einen einfachen HTTP-Server
(Kamera-Zugriff verlangt `http://localhost` oder HTTPS, kein `file://`):

```bash
python3 -m http.server 8000
```

Dann im Browser öffnen:

- http://localhost:8000/ — Rohdaten-Demo
- http://localhost:8000/demo-app/ — GestureQuiz

## Selbst deployen

Deployment läuft automatisch über GitHub Actions
([`.github/workflows/ci.yml`](.github/workflows/ci.yml)): jeder Push auf
`main` linted, testet und deployt anschließend nach GitHub Pages. Um das in
einem eigenen Fork zu übernehmen:

1. Fork/Repo unter **Settings → Pages → Build and deployment → Source: "GitHub Actions"** einstellen.
2. Push auf `main` — der Workflow baut eine minimale Site (`index.html`,
   `gesture-lib/`, `demo-app/`, `docs/`) und deployt sie.
3. Die URL erscheint danach unter **Settings → Pages**.

## Datenschutz

Alle Verarbeitung läuft **ausschließlich lokal im Browser** der Nutzerin/des
Nutzers. Das Kamerabild wird von MediaPipe direkt im Browser in Landmark-
Koordinaten umgewandelt; weder Bilder noch Landmark-Daten verlassen das Gerät
oder werden an einen Server übertragen — die Demos haben kein Backend.

## Lizenz

MIT, siehe [LICENSE](LICENSE). Genutzte Drittanbieter-Ressourcen (MediaPipe,
Bootstrap, Dev-Tooling) und deren Lizenzen stehen in
[THIRD_PARTY_LICENSES.md](THIRD_PARTY_LICENSES.md). Hinweise zum
Arbeitsprozess: [CONTRIBUTING.md](CONTRIBUTING.md).

## Projektstruktur

```
gesture-lib/          Die Library (gesture-library.js, one-euro.js) + eigene README (API-Referenz)
demo-app/             GestureQuiz-Demo (Issue #4)
index.html            Rohdaten-/Debug-Demo (Issue #3)
test/                 node:test-Suite (24 Tests)
bench/                Mess-Harness für die Vertiefung (npm run bench)
docs/decisions/       Decision Records (DR-001 … DR-008)
docs/gestures.md      Gestenvokabular, Mapping-Tabelle, bekannte Stabilitätsprobleme
docs/observations-raw-data.md   Frühe Beobachtungen zu MediaPipe-Rohdaten (Issue #3)
.github/workflows/    CI: Lint, Format-Check, Tests, GitHub-Pages-Deploy
```

## Weiterführende Dokumentation

- [gesture-lib/README.md](gesture-lib/README.md) — vollständige API-Referenz der Library
- [docs/architecture.md](docs/architecture.md) — Architektur-Diagramme (Gesamtaufbau, `update()`-Pipeline)
- [docs/gestures.md](docs/gestures.md) — Gestenvokabular und Stabilitätsanalyse
- [docs/decisions/](docs/decisions/) — alle Decision Records
- [docs/observations-raw-data.md](docs/observations-raw-data.md) — frühe Rohdaten-Beobachtungen

Das Projekt folgt dem **KISS-Prinzip** und wird iterativ weiterentwickelt.
