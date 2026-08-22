# Third-Party Licenses

Dieses Projekt selbst steht unter der [MIT-Lizenz](LICENSE). Es nutzt die
folgenden Drittanbieter-Ressourcen.

## Laufzeit (per CDN in den Demos geladen)

Keine dieser Bibliotheken wird ausgeliefert oder im Repository gebündelt —
alle werden zur Laufzeit per `<script src="https://cdn.jsdelivr.net/…">` vom
jeweiligen CDN geladen. Die Library selbst (`gesture-lib/`) hat keine
Runtime-Dependency.

| Bibliothek                                                             | Version | Lizenz                                                                                | Verwendung                                         |
| ---------------------------------------------------------------------- | ------- | ------------------------------------------------------------------------------------- | -------------------------------------------------- |
| [MediaPipe Pose](https://github.com/google-ai-edge/mediapipe)          | latest  | [Apache License 2.0](https://github.com/google-ai-edge/mediapipe/blob/master/LICENSE) | Pose-Landmark-Erkennung aus dem Kamerabild         |
| [MediaPipe Camera Utils](https://github.com/google-ai-edge/mediapipe)  | latest  | Apache License 2.0                                                                    | Kamera-Feed-Handling für MediaPipe                 |
| [MediaPipe Drawing Utils](https://github.com/google-ai-edge/mediapipe) | latest  | Apache License 2.0                                                                    | Landmark-/Verbindungs-Overlay in der Rohdaten-Demo |
| [Bootstrap](https://getbootstrap.com/)                                 | 5.3.3   | [MIT](https://github.com/twbs/bootstrap/blob/main/LICENSE)                            | UI-Styling in beiden Demos                         |

## Algorithmus (nicht als Code übernommen, als Referenz zitiert)

Der 1€-Filter (`gesture-lib/one-euro.js`) ist eine eigene Implementierung
nach der veröffentlichten Beschreibung in:

> Géry Casiez, Nicolas Roussel, Daniel Vogel. "1€ Filter: A Simple
> Speed-based Low-pass Filter for Noisy Input in Interactive Systems."
> CHI 2012. https://gery.casiez.net/1euro/

## Dev-Tooling (nur zur Entwicklungszeit, nicht Teil der ausgelieferten Library)

| Paket                                                                        | Lizenz |
| ---------------------------------------------------------------------------- | ------ |
| [eslint](https://github.com/eslint/eslint)                                   | MIT    |
| [@eslint/js](https://github.com/eslint/eslint/tree/main/packages/js)         | MIT    |
| [eslint-config-prettier](https://github.com/prettier/eslint-config-prettier) | MIT    |
| [globals](https://github.com/sindresorhus/globals)                           | MIT    |
| [prettier](https://github.com/prettier/prettier)                             | MIT    |

## CI (GitHub Actions)

| Action                                                                            | Lizenz |
| --------------------------------------------------------------------------------- | ------ |
| [actions/checkout](https://github.com/actions/checkout)                           | MIT    |
| [actions/setup-node](https://github.com/actions/setup-node)                       | MIT    |
| [actions/configure-pages](https://github.com/actions/configure-pages)             | MIT    |
| [actions/upload-pages-artifact](https://github.com/actions/upload-pages-artifact) | MIT    |
| [actions/deploy-pages](https://github.com/actions/deploy-pages)                   | MIT    |
