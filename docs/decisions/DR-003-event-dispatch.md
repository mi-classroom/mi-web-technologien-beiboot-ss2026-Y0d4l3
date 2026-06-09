# DR-003 – Event-System: Doppelte Dispatch-Strategie

**Status:** Akzeptiert
**Datum:** 2026-06-09

---

## Kontext

Sobald eine Geste erkannt wird, müssen interessierte Komponenten benachrichtigt
werden.  Die Library soll von Dritten nutzbar sein, ohne dass sie wissen müssen,
wie die interne Instanz heißt oder wo sie im globalen Scope liegt.

---

## Entscheidung

Jedes Gesten-Ereignis wird **zweifach** als `CustomEvent('gesture')` dispatcht:

1. **Auf der Library-Instanz** (da `GestureLibrary extends EventTarget`):
   ```js
   this.dispatchEvent(new CustomEvent('gesture', { detail }));
   ```
2. **Auf `window`**:
   ```js
   window.dispatchEvent(new CustomEvent('gesture', { detail }));
   ```

Beide Events tragen dasselbe `detail`-Objekt:
```js
{ name: string, label: string, timestamp: number }
```

---

## Betrachtete Alternativen

| Alternative | Begründung für Ablehnung |
|---|---|
| Nur Callback-basiert (`lib.onGesture = fn`) | Erlaubt nur einen Listener; schlechte Komposierbarkeit |
| Nur Callback-Array (`lib.on('gesture', fn)`) | Eigene Implementierung nötig; `EventTarget` bietet dieselbe Funktionalität bereits |
| Nur `document`-Event | `document.dispatchEvent` ohne `bubbles: true` wird von `window`-Listenern nicht empfangen; muss explizit dokumentiert werden |
| Nur Instanz-Event | Nutzer müssen eine Referenz auf `lib` halten; erschwert lose Kopplung zwischen Komponenten |
| Pub/Sub-Bibliothek (EventEmitter, RxJS) | Externe Abhängigkeit; für das Volumen eines Uni-Projekts nicht gerechtfertigt |

---

## Begründung

Die **Doppel-Strategie** bedient zwei Nutzungsszenarien ohne Kompromiss:

**Szenario A – enger Scope** (Demo-App hat direkte `lib`-Referenz):
```js
lib.addEventListener('gesture', ({ detail }) => {
  showBadge(detail.name);
});
```

**Szenario B – loser Scope** (Folienpräsentation, separates Modul ohne
`lib`-Referenz):
```js
window.addEventListener('gesture', ({ detail }) => {
  if (detail.name === 'forward') nextSlide();
});
```

Das `CustomEvent`-Format ist ein W3C-Standard und benötigt keine zusätzlichen
Bibliotheken oder Transpiler.

Das `detail`-Objekt enthält bewusst nur unveränderliche, serialisierbare Werte
(`name`, `label`, `timestamp`).  Kein Verweis auf interne Library-Objekte wird
nach außen gegeben, was die Kapselung der Internals sicherstellt.

---

## Konsequenzen

- **Positiv**: Zwei Nutzungsszenarien mit derselben Standard-API abgedeckt.
- **Positiv**: `window`-Events ermöglichen Integration in beliebige Seiten-
  Komponenten ohne Code-Änderung an der Library.
- **Negativ**: `window`-Events sind global – bei mehreren `GestureLibrary`-
  Instanzen auf derselben Seite feuern alle Events auf denselben `window`-Bus.
  Listener können anhand von `detail.name` filtern, aber die Herkunfts-Instanz
  ist nicht direkt erkennbar.  Für diesen Prototypen ist das akzeptabel;
  bei mehreren parallelen Instanzen wäre ein Namespacing (z. B.
  `gesture:myLib`) sinnvoll.
