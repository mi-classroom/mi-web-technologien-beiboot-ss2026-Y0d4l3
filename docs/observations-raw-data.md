# Beobachtungen: Rohdaten aus MediaPipe Pose

Historische Notizen aus dem ersten Meilenstein (Issue #3): die Kamera zum
Sprechen bringen, ohne jegliche Abstraktion, um ein Gefühl für die
Datenqualität von MediaPipe Pose zu bekommen. Grundlage für die spätere
Gesten-Logik in `gesture-lib/`.

## Struktur der eingehenden Daten

Das Modell feuert pro Frame ein Array mit 33 Landmarks (Knotenpunkten wie
Nase, Schultern, Handgelenke). Jeder Punkt liefert:

- **x & y**: Normierte Koordinaten (0.0 bis 1.0), relativ zur Bildbreite/-höhe.
- **z**: Eine geschätzte Tiefe relativ zur Hüfte.
- **visibility**: Ein Wahrscheinlichkeitswert (0.0 bis 1.0), wie sicher der
  Punkt sichtbar ist.

## Zuverlässige Daten (Signal)

- **Stabile 2D-Achsen**: Die x- und y-Koordinaten von gut sichtbaren Gelenken
  sind bei normalen Lichtverhältnissen extrem stabil und weisen kaum Jitter
  (Zittern) auf.
- **Visibility als Filter**: Der visibility-Score ist sehr zuverlässig.
  Verlässt ein Arm das Bild, sinkt der Wert rapide ab.

## Rauschen und Fehlerquellen (Noise)

- **Z-Achse (Tiefe)**: Da die Webcam nur 2D-Bilder liefert, wird die Tiefe
  rein mathematisch approximiert. Dieser Wert "zittert" stark.
- **Verdeckungen (Occlusion)**: Wird eine Hand hinter dem Rücken versteckt,
  rät das Modell die Position. Die Daten springen dann unkontrolliert.
- **Bewegungsunschärfe (Motion Blur)**: Bei sehr schnellen Gesten verliert
  das Modell kurzzeitig den Fokus, was sich in Einbrüchen beim
  visibility-Score und springenden Koordinaten bemerkbar macht.

## Performance

Die Ausführung direkt im Browser (via WebAssembly/WebGL) ist erstaunlich
ressourcenschonend. Das Skript läuft auf einem regulären Arbeitsgerät flüssig
und synchron mit der maximalen Framerate der Webcam (ca. 30 FPS).

---

Diese frühen Beobachtungen zum Rauschen (Z-Achse, Occlusion, Motion Blur)
motivieren direkt die spätere Vertiefung zur Glättung — siehe
[DR-006](decisions/DR-006-one-euro-smoothing.md).
