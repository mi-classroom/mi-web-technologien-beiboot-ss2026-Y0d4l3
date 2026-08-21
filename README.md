# Web Tech Beiboot-Projekt (SS 2026) ⛵

Im Rahmen des Moduls "Web Technologien" entsteht in diesem Repository sukzessive eine wiederverwendbare, dokumentierte JavaScript-Library.
Das finale Ziel der Library ist es, Körperdaten (Hände, Pose, Gesten) via Machine Learning über die Webcam direkt im Browser auszuwerten und als **Custom Browser Events** bereitzustellen. Web-Anwendungen können dann über simple `addEventListener` auf Nutzerbewegungen reagieren.

Das Projekt folgt dem **KISS-Prinzip** (Keep It Simple, Stupid) und wird iterativ weiterentwickelt. Grundlegende Architekturentscheidungen werden als [Architectural Decision Records (ADR)](docs/adr) dokumentiert.

---

## 📍 Aktueller Meilenstein: Kamera zum Sprechen bringen (Rohdaten)

Für den ersten Meilenstein wurde auf jegliche Abstraktion verzichtet. Das Ziel ist es, die Kamera auszulesen, die Daten durch das ML-Modell zu schleusen und die nackten Rohdaten direkt im Browser sichtbar zu machen, um ein Gefühl für die Datenqualität zu bekommen.

### 🚀 Setup & Lokales Starten (KISS)

Da wir uns in der Anfangsphase befinden, verzichten wir bewusst auf komplexe Build-Pipelines (wie Webpack oder Vite) oder ein dediziertes Backend. Die Library (MediaPipe) wird via CDN geladen.
Um CORS- und Kamera-Berechtigungsprobleme (die bei `file://` Protokollen auftreten) zu umgehen, reicht ein simpler lokaler HTTP-Server.

1. Terminal im Projektordner öffnen.
2. Webserver über Python (Standardbibliothek) starten:
   ```bash
   python3 -m http.server 8000
   ```

Browser öffnen unter: http://localhost:8000

📊 Dokumentation der Beobachtungen (Live-Daten)
Beim Sichten der Rohdaten, die das ML-Modell (MediaPipe Pose) ausgibt, konnten folgende Verhaltensweisen festgestellt werden, die für die spätere Entwicklung der Custom Events essenziell sind:

1. Struktur der eingehenden Daten
   Das Modell feuert pro Frame ein Array mit 33 Landmarks (Knotenpunkten wie Nase, Schultern, Handgelenke). Jeder Punkt liefert:

x & y: Normierte Koordinaten (0.0 bis 1.0), relativ zur Bildbreite/-höhe.

z: Eine geschätzte Tiefe relativ zur Hüfte.

visibility: Ein Wahrscheinlichkeitswert (0.0 bis 1.0), wie sicher der Punkt sichtbar ist.

2. Zuverlässige Daten (Signal)
   Stabile 2D-Achsen: Die x- und y-Koordinaten von gut sichtbaren Gelenken sind bei normalen Lichtverhältnissen extrem stabil und weisen kaum Jitter (Zittern) auf.

Visibility als Filter: Der visibility-Score ist sehr zuverlässig. Verlässt ein Arm das Bild, sinkt der Wert rapide ab. Das ist ideal, um später Events wie user-left-camera zu triggern.

3. Rauschen und Fehlerquellen (Noise)
   Z-Achse (Tiefe): Da die Webcam nur 2D-Bilder liefert, wird die Tiefe rein mathematisch approximiert. Dieser Wert "zittert" stark. Für zukünftige Näherungs-Events (proximity-event) muss hier zwingend ein Glättungs-Algorithmus (z. B. gleitender Mittelwert) über mehrere Frames angewendet werden.

Verdeckungen (Occlusion): Wird eine Hand hinter dem Rücken versteckt, rät das Modell die Position. Die Daten springen dann unkontrolliert.

Bewegungsunschärfe (Motion Blur): Bei sehr schnellen Gesten verliert das Modell kurzzeitig den Fokus, was sich in Einbrüchen beim visibility-Score und springenden Koordinaten bemerkbar macht.

4. Performance
   Die Ausführung direkt im Browser (via WebAssembly/WebGL) ist erstaunlich ressourcenschonend. Das Skript läuft auf einem regulären Arbeitsgerät flüssig und synchron mit der maximalen Framerate der Webcam (ca. 30 FPS).
