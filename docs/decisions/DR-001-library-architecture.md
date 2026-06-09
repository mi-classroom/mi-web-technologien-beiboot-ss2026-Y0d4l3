# DR-001 – Bibliotheks-Architektur: Single-File IIFE mit EventTarget-Basis

**Status:** Akzeptiert
**Datum:** 2026-06-09

---

## Kontext

Die Gestenlogik muss aus dem monolithischen `index.html` extrahiert und in eine
eigenständige, von Dritten nutzbare Library überführt werden.  Dabei stellen
sich zwei grundlegende Architekturfragen:

1. **Dateistruktur**: Single-File vs. Multi-File / Build-System
2. **Klassen-Basis**: Eigene Event-Infrastruktur vs. bestehende Web-API

---

## Entscheidung

Die Library wird als **eine einzige Datei** (`gesture-lib/gesture-library.js`)
ausgeliefert, die mit einem **IIFE** (Immediately Invoked Function Expression)
gewrappt ist und `GestureLibrary` als globales Objekt auf `window` exportiert.

Die Klasse erbt von **`EventTarget`** (native Browser-API).

---

## Betrachtete Alternativen

| Alternative | Begründung für Ablehnung |
|---|---|
| ES-Module (`export class`) | Benötigt `type="module"` im HTML, keinen lokalen Datei-Server oder ein Build-System; kompliziert das Setup unnötig im Uni-Kontext |
| Multi-File mit Bundler (Webpack/Vite) | Erhöht die Einstiegshürde für Dritte erheblich; widerspricht dem KISS-Prinzip des Projekts |
| Eigene `on()`/`off()`-Infrastruktur | Erfindet das Rad neu; `EventTarget` ist W3C-Standard, in allen modernen Browsern vorhanden |
| Mixin-Pattern / freie Funktion | Kein Zustandsmanagement möglich; erschwert mehrere unabhängige Instanzen |

---

## Begründung

**IIFE-Single-File** erlaubt die einfachste Einbindung:
```html
<script src="gesture-lib/gesture-library.js"></script>
```
kein Build-Schritt, kein `import`, kein Server mit CORS-Kopfzeilen nötig.

**`EventTarget` als Basis** bietet drei Vorteile:
1. Nutzer kennen `addEventListener` / `removeEventListener` bereits aus der
   Browser-Entwicklung – keine neue API zu lernen.
2. Die Library kann Ereignisse sowohl auf sich selbst als auch auf `window`
   feuern, sodass unterschiedliche Nutzungsszenarien ohne Änderung am Code
   funktionieren.
3. Die Klasse bleibt testbar: in Node.js kann `EventTarget` durch einen
   einfachen Stub ersetzt werden.

---

## Konsequenzen

- **Positiv**: Keine Build-Abhängigkeiten; läuft direkt im Browser mit
  `python3 -m http.server`.
- **Positiv**: Vollständige Typprüfung und Auto-Completion in modernen IDEs
  durch die native `EventTarget`-Typisierung (TypeScript-deklariert in
  `lib.dom.d.ts`).
- **Negativ**: Tree-Shaking ist nicht möglich – alle Built-in-Gesten werden
  immer mitgeladen, auch wenn nur eine Teilmenge genutzt wird.  Bei der aktuellen
  Dateigröße (<10 KB) ist das kein praktisches Problem.
- **Negativ**: Globaler Namespace-Eintrag (`window.GestureLibrary`).
  Akzeptabel für den Uni-Prototypen; für ein npm-Paket würde ES-Module bevorzugt.
