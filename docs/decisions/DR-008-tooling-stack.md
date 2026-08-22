# DR-008 – Tooling-Stack: npm + Vanilla JS ohne Build-Schritt

**Status:** Umgesetzt
**Datum:** 2026-08-22
**Kontext:** Issue #6 – Vertiefung, Master-Rubrik-Anforderungen

---

## Kontext

Zu Beginn der Vertiefung gab es kein `package.json`, keinen Linter/Formatter,
keine Tests und keine CI-Pipeline – ein klarer Gap gegenüber der
Master-Rubrik (fixierte Abhängigkeiten, automatisierte statische Analyse,
Tests, CI-Pipeline). Gleichzeitig gilt seit DR-001 das KISS-Prinzip: kein
Build-System, die Library bleibt dependency-frei und per `<script>`-Tag
ladbar.

---

## Entscheidung

npm wird ausschließlich als **Dev-/CI-Tooling** eingeführt (Lint, Format,
Test, Benchmark) – die Laufzeit-Library selbst bekommt weder
Runtime-Dependencies noch einen Build-Schritt. Testframework ist der in Node
eingebaute `node:test`-Runner. ESLint (Flat Config) und Prettier übernehmen
automatisierte Analyse und Formatierung. GitHub Actions führt Lint, Format-
Check und Tests auf jedem Push/PR aus und deployt bei Push auf `main` nach
GitHub Pages.

---

## Betrachtete Alternativen

| Alternative                                   | Begründung für Ablehnung                                                                                                                            |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Vite/Webpack-Build-Pipeline                   | Widerspricht DR-001 (KISS, kein Build-System); für eine dependency-freie Library ohne Bundling-Bedarf unnötige Komplexität                          |
| Jest oder Mocha als Testframework             | Zusätzliche Dev-Dependency für etwas, das `node:test` seit Node 18 bereits mitliefert; würde „dependency-frei" auch fürs Tooling unnötig aufweichen |
| Kein CI, nur lokale Checks vor dem Commit     | Erfüllt die Master-Rubrik-Anforderung „CI-Pipeline führt grundlegende Checks aus" nicht; hängt vom Zufall/der Disziplin einzelner Commits ab        |
| Selbst gehostetes Deployment (Vercel/Netlify) | Zusätzlicher externer Account für ein rein statisches Projekt, das bereits vollständig auf GitHub liegt; GitHub Pages deckt den Bedarf ohne das     |

---

## Begründung

Die Trennung von Dev-Tooling und Laufzeit-Library ist bewusst: `package.json`
und `devDependencies` betreffen nur, wie die Library entwickelt und getestet
wird – wer sie per `<script src="gesture-library.js">` einbindet, merkt davon
nichts. `node:test` deckt den Anwendungsfall (Unit-Tests auf reinen
Landmark-Arrays, kein Browser-DOM nötig) ohne zusätzliche Dependency ab.
GitHub Actions läuft im selben Ökosystem wie das Classroom-Repository, ohne
zusätzliche Kontoeinrichtung.

---

## Konsequenzen

- **Positiv**: `npm ci && npm test` reicht für Dritte, um den vollen
  Vertiefungs-Nachweis nachzuvollziehen – kein Browser für die Testsuite
  nötig.
- **Positiv**: CI verhindert, dass ein zukünftiger Push versehentlich
  Lint-/Format-/Test-Regressionen auf `main` bringt.
- **Negativ**: Zwei Formatierungsstile mussten vereinheitlicht werden (die
  handgepflegte Spalten-Ausrichtung im Ursprungscode vs. Prettier) – bewusst
  zugunsten des automatisierten Formatters aufgelöst, in einem eigenen
  Formatting-Commit.
- **Negativ**: `bench/` und `test/` sind zusätzliche, nicht-triviale
  Verzeichnisse, die ein reines „Library + Demo"-Projekt sonst nicht bräuchte
  – gerechtfertigt durch die Nachweisbarkeits-Anforderungen der Master-Rubrik.
