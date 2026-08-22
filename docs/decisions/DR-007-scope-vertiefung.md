# DR-007 – Scope-Entscheidung: Vertiefung (Weg B), fokussiert auf zwei Fixes

**Status:** Akzeptiert
**Datum:** 2026-08-22
**Kontext:** Issue #6 – Freie Bahn: Vision oder Vertiefung

---

## Kontext

Issue #6 verlangt eine begründete Entscheidung zwischen **Weg A** (eine neue
Vision-Anwendung mit hohem gestalterischem Anspruch) und **Weg B** (echte
Tiefenarbeit an einer bestehenden Schwachstelle), innerhalb einer Timebox von
20–24 Stunden. Zum Zeitpunkt dieser Entscheidung lagen bereits fünf
dokumentierte Schwachstellen vor: vier durchnummeriert in
`docs/gestures.md` (Abschnitt „Bekannte Stabilitätsprobleme" —
Frame-Rate-Abhängigkeit, kein Ellenbogen-Check, keine Nah/Fern-Unterscheidung,
Kamerawinkel) sowie die starre, nicht-adaptive Glättung, die an anderer
Stelle desselben Dokuments (Abschnitt „Rauschen und Fehlerquellen") und in
`docs/observations-raw-data.md` beschrieben ist.

---

## Entscheidung

**Weg B**, Scope bewusst auf zwei der fünf Schwachstellen (Timing, Glättung –
siehe DR-005, DR-006) begrenzt. Ellenbogen-Check, Nah/Fern-Unterscheidung
und Kamerawinkel bleiben dokumentierter Ausblick.

---

## Betrachtete Alternativen

| Alternative                     | Begründung für Ablehnung                                                                                                                                                                       |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Weg A (Vision-Anwendung)        | Für ein Master-Modul mit Fokus auf Forschungsfrage, Trade-offs und Tests bietet die Vertiefung die belastbarere, direkt messbare Geschichte; die Schwachstellen lagen bereits dokumentiert vor |
| Weg B, alle fünf Schwachstellen | Hätte die Messtiefe pro Fix verdünnt und den für die Bewertung ebenso zählenden CI-/Test-/Doku-Aufwand in der Timebox gefährdet – Scope-Explosion trotz großzügigerer Zeit                     |
| Nur ein Fix (z. B. nur Timing)  | Hätte „richtig gelöst" erfüllt, aber weniger Substanz für einen Vorher/Nachher-Vergleich geboten als zwei sich ergänzende Fixes, die dieselbe `update()`-Schleife betreffen                    |

---

## Begründung

Timing- und Glättungs-Fix teilen sich die `update()`-Schleife und den neuen
Zeitstempel-Parameter – zusammen bearbeitet statt isoliert, vermeidet das
doppelte Anfassen derselben Codepfade. Beide Fixes sind unabhängig voneinander
messbar und lassen sich ehrlich mit Trade-offs belegen (siehe DR-005, DR-006).
Ellenbogen-Check, Nah/Fern-Unterscheidung und Kamerawinkel bleiben eine
benannte, begründete Abgrenzung statt eines stillschweigenden Weglassens.

---

## Konsequenzen

- **Positiv**: Zeit blieb für Tooling, CI, Tests und den a11y-Pass – Bereiche,
  die in der Stufe-2-Rubrik ebenso zählen wie das Feature selbst.
- **Negativ**: Drei der fünf dokumentierten Schwachstellen (Ellenbogen-Check,
  Nah/Fern-Unterscheidung, Kamerawinkel) bleiben ungelöst. Explizit als
  Future Work benannt statt verschwiegen.
- Die Timebox (20–24 h) war Leitplanke für diese Entscheidung, nicht nur
  nachträgliche Rechtfertigung für einen bereits gewählten, kleineren Scope.
