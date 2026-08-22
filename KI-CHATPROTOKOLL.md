# KI-Chat-Protokoll

Dokumentation der KI-Nutzung für die Vertiefung (Issue #6), gemäß den
[Vorgaben](https://www.archi-lab.io/infopages/ai/documentation-of-ai-chat-protocols.html)
für den Umgang mit KI-Werkzeugen in Studienarbeiten.

## Werkzeug

- **Claude Code** (Anthropic), CLI-Agent mit Datei-, Terminal- und
  Browser-Zugriff.
- Modell: primär Claude Sonnet 5.
- Zeitraum: 21.–22.08.2026, zwei Sitzungen.

## Warum überhaupt KI-gestützt

Die eigene Erfahrung mit JavaScript war zu Beginn dieser Vertiefung begrenzt.
Statt entweder komplett eigenständig (mit entsprechend hohem Fehlerrisiko und
Zeitaufwand fürs Einlesen) oder unreflektiert per Copy-Paste zu arbeiten,
wurde bewusst ein strukturiertes **Co-Working-Modell** mit Claude Code
gewählt. Die folgenden Abschnitte beschreiben, wie das konkret aussah.

## Arbeitsmodell

Explizit vereinbarte Leitplanke für die gesamte Session: Claude Code durfte
**pro Schritt nur eine einzelne, fokussierte Änderung** vorschlagen und
umsetzen. Jeder Schritt musste:

1. mit einer nachvollziehbaren Begründung versehen sein (nicht nur _was_,
   sondern _warum_),
2. durch die vorhandene Test-Suite, ESLint und Prettier automatisiert
   verifiziert werden, bevor er als "fertig" galt,
3. als fertige Commit-Vorlage (Conventional Commits, mit Begründung im
   Commit-Body) übergeben werden.

**Committet, gestaged und gepusht wurde ausschließlich von mir selbst** —
Claude Code hat zu keinem Zeitpunkt eigenständig `git commit` oder `git push`
ausgeführt. Das lässt sich direkt in der Commit-Historie nachvollziehen: jeder
Commit auf diesem Branch trägt meinen Namen, keiner wurde automatisiert
erzeugt.

## Konkrete eigene Entscheidungen im Prozess

- **Grundsatzentscheidung** Vertiefung (Weg B) statt neuer Anwendung (Weg A),
  nach Abwägen der Argumente für beide Wege (siehe
  [DR-007](docs/decisions/DR-007-scope-vertiefung.md)).
- **Scope-Entscheidung** innerhalb der Vertiefung: bewusst auf zwei Fixes
  fokussiert statt alle vier dokumentierten Schwachstellen anzugehen, um die
  Timebox einzuhalten.
- **Zeitpunkt des Merges/Deploys** selbst festgelegt — bewusst vor
  Fortsetzung der Implementierung gemergt, um die CI-/Pages-Pipeline früh zu
  verifizieren statt das Risiko auf das Ende der Bearbeitungszeit zu
  verschieben.
- **Faktenkorrektur**: Die KI hatte den Studiengang in der README zunächst
  falsch angenommen (Medieninformatik statt Master Digital Science) — das
  wurde von mir korrigiert.
- **Git-Workflow-Entscheidung**: bewusst festgelegt, dass jede Änderung
  einzeln von mir committet und geprüft wird, statt der KI Push-Rechte zu
  geben.
- Rückfragen zu Reihenfolge, Umfang und Dokumentationstiefe gestellt (u. a.
  zu diesem Protokoll selbst).

## Was von der KI kam

Die konkrete Code-Implementierung (Library-Refactoring für Fix 1/2, der
1€-Filter, die Test-Suite, das Mess-Harness, die CI-Konfiguration, die
a11y-Fixes, die Doku-Entwürfe inkl. ADRs) wurde von Claude Code vorschlagen
und geschrieben, jeweils mit Begründung und Alternativenabwägung. Vor jeder
Übernahme wurden die Vorschläge automatisiert verifiziert (Testsuite,
Linter, Formatter) und teils live im Browser getestet (u. a. der
Tastatur-Fallback im GestureQuiz, das Responsive-Verhalten der Rohdaten-Demo)
— nicht blind übernommen.

## Nachvollziehbarkeit

Die vollständige, Conventional-Commits-konforme Commit-Historie im Repository
dokumentiert den Ablauf Schritt für Schritt. Dieses Protokoll ersetzt kein
vollständiges Rohtranskript, sondern fasst Rollenverteilung und
Entscheidungspunkte zusammen.

## Persönliche Einordnung

Das Projekt war von vornherein darauf ausgelegt, relativ komplexe
Implementierungen in JavaScript vorzunehmen. Aufgrund mangelnder Kenntnisse
in der JavaScript-Entwicklung über einfache Frontend-Funktionen hinaus habe
ich mich entschieden, im Co-Working-Modell mit Claude zu arbeiten.

Konkret habe ich Claude als eine Art Lehrer genutzt: Ich habe viele
Rückfragen gestellt und bei jedem Commit versucht, den Inhalt im Kontext des
Projekts zu verstehen, statt ihn nur zu übernehmen.

Mein Ziel war es also nicht, meine Entwickler-Skills in JS zu vertiefen,
sondern eher das Konzept von KI-gestützter Gestenerkennung über die Kamera
zu verstehen und dieses nach der Wahl von Weg B weiter zu vertiefen.
