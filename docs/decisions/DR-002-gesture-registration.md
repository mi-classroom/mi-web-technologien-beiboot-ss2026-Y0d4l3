# DR-002 – Gesten-Registrierung: Deklaratives Objekt-API

**Status:** Akzeptiert
**Datum:** 2026-06-09

---

## Kontext

Eine der zentralen Anforderungen lautet: „Neue Gesten sollen hinzugefügt werden
können, ohne bestehende zu brechen." Dafür muss eine Registrierungs-API
entworfen werden, die sowohl für Built-in-Gesten als auch für nutzerdefinierte
Gesten funktioniert.

---

## Entscheidung

Gesten werden als **plain JavaScript-Objekte** registriert:

```js
lib.register({
  name: 'myGesture',
  type: 'hold', // 'hold' | 'velocity'
  label: 'Meine Geste',
  holdFrames: 30,
  conflicts: ['stop'], // optional
  check(lm, history) {
    return; /* boolean */
  },
});
```

Die Library verwaltet intern eine geordnete Liste dieser Objekte. Priorität
ergibt sich aus der **Registrierungsreihenfolge** (zuerst registriert = höhere
Priorität).

---

## Betrachtete Alternativen

| Alternative                                                    | Begründung für Ablehnung                                                                                                    |
| -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Klassen-basierte Plugins (`class StopGesture extends Gesture`) | Erzwingt Vererbungs-Hierarchie; Nutzer müssen die Basisklasse kennen; erschwert das Hinzufügen einer einfachen Lambda-Geste |
| String-basiertes DSL (`lib.register('right-arm-extended@30')`) | Zu unflexibel für komplexe Bedingungen (z. B. Stillstand-Prüfung beim Pause-Gesture)                                        |
| Konfigurationsobjekte ohne `check`-Funktion (nur Parameter)    | Kann nur vordefinierte Bedingungstypen abdecken; schließt nutzerdefinierte Logik aus                                        |
| Automatische Priorität (z. B. per `priority`-Zahl)             | Explizite Zahlenwerte sind fehleranfällig und schwer wartbar; Reihenfolge ist intuitiver                                    |

---

## Begründung

Das **deklarative Objekt-API** minimiert die Einstiegshürde:

- Kein Framework, keine Vererbung – nur ein Objekt mit bekannten Feldern.
- `check(lm, history)` gibt Nutzern vollen Zugriff auf die Rohdaten, ohne dass
  die Library spezifische Bedingungstypen kennen muss.
- Neue Gesten fügen sich ohne Änderung an bestehenden Dateien ein:
  ```js
  lib.register({ name: 'leftHandUp', … });  // vorhandener Code unangetastet
  ```

Das **`conflicts`-Feld** löst das Prioritätsproblem (z. B. T-Pose blockiert
Einzel-Arm-Gesten) auf deklarative Weise, ohne komplexe Bedingungen in die
`check`-Funktion einzubauen:

```js
forward: { conflicts: ['stop'], … }
// → wenn stop.holdCount > 0, wird forward.holdCount nicht inkrementiert
```

---

## Konsequenzen

- **Positiv**: Vollständige Erweiterbarkeit ohne Quelltextänderung.
- **Positiv**: Einfach testbar – `check`-Funktionen sind reine Prädikate.
- **Negativ**: Die Registrierungsreihenfolge beeinflusst das Verhalten still-
  schweigend; sie ist im API-Dokument ausdrücklich dokumentiert.
- **Negativ**: Keine Laufzeit-Typprüfung der `check`-Signatur. Ungültige
  Definitionen werfen erst beim ersten `update()`-Aufruf eine Ausnahme.
