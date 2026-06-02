# Gestenvokabular – Anwendungskontext: Präsentationssteuerung

## Anwendungskontext

Die Library wird als kontaktloser **Präsentationscontroller** eingesetzt. Eine Person steht vor einem Bildschirm und steuert Folien oder Medieninhalte allein durch Körpergesten. Der Anwendungskontext unterscheidet zwei Distanzen:

- **Nahbereich**: Person ca. 0,5–1,5 m vor der Kamera (Oberkörper gut sichtbar, Schulterlinie klar erkennbar)
- **Fernbereich**: Person ca. 1,5–4 m vor der Kamera (Ganzkörper sichtbar, Feinmotorik kaum erkennbar)

### Koordinatensystem-Hinweis

MediaPipe liefert Landmark-Koordinaten im **nativen Bildraum** (nicht gespiegelt). Da Webcams das Bild typischerweise nicht spiegeln, liegt die rechte Seite der Person (aus ihrer Perspektive) auf der **linken** Bildseite (niedrige x-Werte). Die Demo-Anwendung spiegelt das Canvas per CSS (`transform: scaleX(-1)`), sodass das Display einer natürlichen Spiegelsicht entspricht, ohne die Koordinaten zu verändern.

---

## Mapping-Tabelle

| # | Interaktion | Nahbereich: Mögliche Geste | Daten & Reliabilität (Nah) | Fernbereich: Mögliche Geste | Daten & Reliabilität (Fern) |
|---|---|---|---|---|---|
| 1 | **Vorwärts** (nächste Folie) | Rechten Arm seitlich nach rechts ausstrecken und ≥1 s halten | RIGHT_SHOULDER (idx 12) + RIGHT_WRIST (idx 16); visibility > 0,7 gut erreichbar; kaum Rauschen bei guter Beleuchtung; **implementiert** | Rechten Arm vollständig in Richtung rechten Bildrand strecken (erkennbarer Winkel Schulter→Ellenbogen→Handgelenk) | Alle drei Punkte müssen sichtbar sein; bei >2 m Distanz fallen visibility-Scores; mittlere Reliabilität |
| 2 | **Rückwärts** (vorherige Folie) | Linken Arm seitlich nach links ausstrecken und ≥1 s halten | LEFT_SHOULDER (idx 11) + LEFT_WRIST (idx 15); symmetrisch zu Geste 1; gleich zuverlässig; **implementiert** | Linken Arm vollständig in Richtung linken Bildrand strecken | Symmetrisch zu #1; mittlere Reliabilität |
| 3 | **Auswahl bestätigen** | Beide Handgelenke gleichzeitig über die Schulterlinie anheben | Alle vier Punkte (idx 11, 12, 15, 16); zuverlässig solange Person zentral im Bild steht; selten zufällig ausgelöst | Beide Arme vollständig nach oben strecken (Siegergeste) | Sehr großräumige, distinktive Pose; Landmarks bleiben auch auf Distanz sichtbar; hoch zuverlässig |
| 4 | **Abbrechen / Stop** | Arme vor der Brust kreuzen (rechtes Handgelenk links von linker Schulter und umgekehrt) | Handgelenk-Koordinaten müssen tatsächlich kreuzen; durch Verdeckung (Occlusion) können überdeckte Landmarks instabil werden; mittlere Reliabilität | T-Pose: beide Arme horizontal seitlich ausstrecken | Sehr auffällige Pose; solange alle 4 Punkte sichtbar, hohe Reliabilität |
| 5 | **Scrollen nach oben** | Schnelle Aufwärtswischgeste mit der rechten Hand (Δy > 0,3 in < 0,5 s) | Δy über kurzes Zeitfenster; empfindlich für Motion Blur (visibility bricht ein); schwerer von normaler Handbewegung zu trennen; niedrige Reliabilität | Oberkörper nach hinten lehnen (Nase-z-Wert nimmt ab) | Z-Achse extrem verrauscht bei 2D-Webcam; kaum brauchbar ohne aufwändiges Smoothing |
| 6 | **Scrollen nach unten** | Schnelle Abwärtswischgeste mit der rechten Hand | Wie #5; dynamische Swipe-Gesten generell schwerer zu stabilisieren als statische Haltegesten | Oberkörper nach vorne lehnen (Nase-z steigt) | Z-Achse unzuverlässig; gleiche Probleme wie #5 |
| 7 | **Pause / Weiter** | Rechte offene Hand zur Kamera halten und ≥1,5 s stillhalten | Handgelenk-Stillstand (Δx + Δy < 0,02 über alle Buffer-Frames); MediaPipe Pose hat keine Fingerdetaildaten – „offen" ist nicht direkt prüfbar; mittlere Reliabilität | Person bewegt sich für ≥2 s überhaupt nicht | Bewegungsmaß aller Landmarks zusammen; akkumulierter Drift unter Schwelle; gut implementierbar |
| 8 | **Lautstärke erhöhen** | Rechte Hand über den Kopf heben (RIGHT_WRIST.y < nose.y) | Wrist-zu-Nose-Vergleich; beide Landmarks mit hoher visibility; robust und selten zufällig | Rechter Arm gestreckt über Kopfhöhe | Bei Fern-Distanz weiterhin sichtbar; robust |
| 9 | **Lautstärke senken** | Rechte Hand unter die Hüfte senken (RIGHT_WRIST.y > RIGHT_HIP.y) | Wrist-zu-Hip-Vergleich (idx 16, 24); Hüft-Landmarks bei Frontalaufnahme gut sichtbar; zuverlässig | Rechter Arm deutlich unter Hüftniveau gesenkt | Gut erkennbar auch auf Distanz |
| 10 | **Zoom / Skalieren** | Beide Hände nähern sich / entfernen sich voneinander (Abstandsänderung) | Euklidischer Abstand beider Handgelenke; mittlere Reliabilität; Überlappungsgefahr bei Kreuzung | Person tritt auf Kamera zu oder weg (z-Wert aller Landmarks) | Z-Achse zu unzuverlässig für flüssige Zoom-Steuerung; nicht empfohlen |

---

## Gewählte Gesten für die Implementierung

### Auswahl: Gesten #1 (Vorwärts) und #2 (Rückwärts)

**Begründung:**

1. **Hohe Reliabilität**: Schultern und Handgelenke sind die stabilsten, gut sichtbaren Landmarks in typischen Oberkörperaufnahmen. Die visibility-Scores bleiben bei normaler Beleuchtung konstant über 0,7 – deutlich über dem Noise-Niveau anderer Landmarks (z. B. Knöchel).

2. **Klare Intentionalität**: Das seitliche Ausstrecken eines Arms ist eine großräumige, bewusste Bewegung. Sie tritt im Alltag selten zufällig auf, was die False-Positive-Rate gegenüber Swipe-Gesten oder feinen Fingergesten deutlich senkt.

3. **Zeitfenster als Stabilisator**: Die Anforderung, die Pose ≥1 s zu halten, eliminiert impulsive Zufallsbewegungen (z. B. kurzes Gestikulieren beim Sprechen). Nur wer bewusst und ruhig den Arm hält, löst die Geste aus.

4. **Symmetrisches Interaktionspaar**: Vorwärts/Rückwärts bilden ein natürliches, intuitives Paar – vergleichbar mit Schiebebewegungen auf Touchscreens.

5. **Algorithmische Einfachheit (KISS)**: Nur ein einfacher Schwellenwertvergleich auf zwei Koordinatenachsen – keine komplexe Bewegungsanalyse, keine Zeitreihen-Klassifikation. Leicht verständlich, leicht zu debuggen.

---

## Algorithmus

### Allgemeines Vorgehen

Beide Gesten folgen demselben algorithmischen Muster:

```
1. Landmark-Koordinaten aus dem aktuellen Frame lesen
2. Gleitenden Mittelwert über die letzten N Frames berechnen (Rauschunterdrückung)
3. Geometrische Bedingungen prüfen (Position + Visibility)
4. Bei Erfüllung: Hold-Zähler erhöhen; bei Nicht-Erfüllung: Zähler zurücksetzen
5. Bei HOLD_FRAMES aufeinanderfolgenden Frames: Geste auslösen, Cooldown starten
6. Während Cooldown: keine neue Erkennung möglich
```

### Parameter

| Parameter | Wert | Bedeutung |
|---|---|---|
| `BUFFER_SIZE` | 5 Frames | Größe des Glättungspuffers (gleitender Mittelwert) |
| `HOLD_FRAMES` | 30 Frames (~1 s bei 30 fps) | Mindesthaltezeit bevor Geste auslöst |
| `COOLDOWN_FRAMES` | 60 Frames (~2 s) | Sperrzeit nach Auslösung, verhindert Mehrfach-Trigger |
| `X_THRESH` | 0,20 | Minimale horizontale Ausdehnung (20 % der Bildbreite) |
| `Y_TOL` | 0,18 | Maximale vertikale Abweichung von Schulterhöhe (18 % der Bildhöhe) |
| `MIN_VIS` | 0,60 | Minimaler Visibility-Score für verwendete Landmarks |

### Geste "Vorwärts" – Algorithmus im Detail

**Verwendete Landmarks**: RIGHT\_SHOULDER (idx 12), RIGHT\_WRIST (idx 16)

**Koordinatenhinweis**: In MediaPipes Bildkoordinaten liegt die rechte Seite der Person (ihre Perspektive) bei niedrigen x-Werten (linke Bildseite). Ein ausgestreckter rechter Arm bewegt das Handgelenk weiter nach links im Bild → `rWrist.x < rShoulder.x`, also `rShoulder.x - rWrist.x > threshold`.

```
Bedingung (pro Frame, nach Smoothing):
  (1) rShoulder.visibility > 0,60   -- Schulter gut sichtbar
  (2) rWrist.visibility   > 0,60   -- Handgelenk gut sichtbar
  (3) rShoulder.x - rWrist.x > 0,20  -- Arm nach rechts ausgestreckt (im Bildraum)
  (4) |rWrist.y - rShoulder.y| < 0,18 -- Arm grob auf Schulterhöhe (nicht schräg)

Zustandsmaschine:
  holdCount = 0
  cooldown  = 0

  Jeder Frame:
    if cooldown > 0:
      cooldown--                   -- Sperre läuft ab
    else if Bedingungen (1)–(4) alle erfüllt:
      holdCount++
      if holdCount >= 30:
        GESTE AUSLÖSEN → CustomEvent('gesture', { type: 'forward' })
        holdCount = 0
        cooldown  = 60
    else:
      holdCount = 0               -- Kette unterbrochen, von vorne
```

### Geste "Rückwärts" – Algorithmus im Detail

Symmetrisch zu "Vorwärts", gespiegelt:

**Verwendete Landmarks**: LEFT\_SHOULDER (idx 11), LEFT\_WRIST (idx 15)

```
Bedingung:
  (1) lShoulder.visibility > 0,60
  (2) lWrist.visibility   > 0,60
  (3) lWrist.x - lShoulder.x > 0,20   -- linker Arm nach links ausgestreckt
  (4) |lWrist.y - lShoulder.y| < 0,18
```

Zustandsmaschine: identisch, separater Zähler.

---

## Custom Browser Events

Erkannte Gesten werden als `CustomEvent` auf `document` gefeuert:

```javascript
document.dispatchEvent(new CustomEvent('gesture', {
  detail: {
    type:      'forward',          // 'forward' | 'backward'
    label:     'Vorwärts →',
    timestamp: '2026-06-02T12:00:00.000Z'
  }
}));

// Verwendung in der Anwendung:
document.addEventListener('gesture', (e) => {
  if (e.detail.type === 'forward')  { /* nächste Folie */ }
  if (e.detail.type === 'backward') { /* vorherige Folie */ }
});
```

---

## Bekannte Probleme & Stabilitätsanalyse

### False Positives (unerwünschte Auslösungen)

| Szenario | Wahrscheinlichkeit | Mitigation |
|---|---|---|
| Arm kurz seitlich beim Gestikulieren | Mittel | Hold-Timer (30 Frames) fängt kurze Bewegungen ab |
| Körperdrehung verschiebt Schulterkoordinate | Niedrig | Visibility-Check erkennt oft schlechte Sichtbarkeit |
| Diagonales Zeigen erfüllt X-Bedingung | Niedrig | Y-Toleranz filtert starke vertikale Abweichungen |
| Arm zufällig in Geste-Position gehalten | Sehr niedrig | Kombination Winkel + Höhe + Haltezeit macht dies selten |

### False Negatives (verpasste Gesten)

| Szenario | Wahrscheinlichkeit | Mitigation |
|---|---|---|
| Schlechte Beleuchtung → niedrige Visibility | Mittel | Kein direktes Mittel; Nutzer braucht gute Lichtverhältnisse |
| Arm teilweise aus dem Bild | Mittel | Visibility-Check schlägt an; keine Erkennung (sicherer Fail) |
| Motion Blur beim schnellen Armstrecken | Niedrig | Smoothing-Buffer hilft; langsames Strecken empfohlen |
| Person sehr weit von Kamera entfernt | Mittel | Landmarks ungenauer; ggf. X\_THRESH anpassen |

### Bekannte Stabilitätsprobleme

1. **Frame-Rate-Abhängigkeit**: `HOLD_FRAMES` ist in Frames, nicht Sekunden angegeben. Bei abweichender Framerate (z. B. 15 fps bei schlechtem Licht) ändert sich die effektive Haltezeit auf ~2 s statt ~1 s. Eine zeitbasierte Implementierung in Millisekunden wäre robuster.

2. **Kein Ellenbogen-Check**: Es wird nicht geprüft, ob der Arm tatsächlich gestreckt ist. Ein stark angewinkelter Arm, dessen Handgelenk trotzdem die X-Schwelle erreicht, löst die Geste aus. Ein zusätzlicher Ellenbogen-Zwischenposition-Check würde die Präzision erhöhen.

3. **Keine Nah/Fern-Unterscheidung**: Der Algorithmus ist distanzunabhängig. Im Fernbereich kann eine kleinere absolute Armbewegung bereits den relativen Schwellenwert überschreiten, da die Person in Pixeln kleiner erscheint.

4. **Kamerawinkel**: Bei stark schräg aufgestellter Kamera oder Seitenansicht der Person können Schulter- und Handgelenk-Koordinaten systematisch verschoben sein, was zu dauerhaften False Positives oder Negatives führt.
