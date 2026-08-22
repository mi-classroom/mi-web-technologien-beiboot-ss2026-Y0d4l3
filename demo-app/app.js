/**
 * GestureQuiz – körpergesteuertes Web-Technologie-Quizspiel.
 *
 * Kommuniziert ausschließlich über die öffentliche API der GestureLibrary:
 *
 *   new GestureLibrary(options)
 *   lib.useDefaults()
 *   lib.disable(name)          ← nach entdeckter API-Lücke zur Library hinzugefügt
 *   lib.enable(name)           ← nach entdeckter API-Lücke zur Library hinzugefügt
 *   lib.addEventListener('gesture', cb)
 *   lib.getGestures()
 *   lib.getProgress()          ← nach entdeckter API-Lücke zur Library hinzugefügt
 *   lib.reset()
 *
 * Kein Zugriff auf interne Felder (_gestures, _holdCounters, etc.).
 */

'use strict';

// ── Fragen ────────────────────────────────────────────────────────────────────

const QUESTIONS = [
  {
    q: 'Was bedeutet die Abkürzung CSS?',
    a: 'Cascading Style Sheets',
    b: 'Computer Style System',
    c: 'Creative Syntax Styling',
    correct: 'a',
  },
  {
    q: 'Welches HTML-Element erzeugt die größte Überschrift?',
    a: '<h6>',
    b: '<header>',
    c: '<h1>',
    correct: 'c',
  },
  {
    q: 'Wofür steht DOM?',
    a: 'Data Object Module',
    b: 'Document Object Model',
    c: 'Dynamic Output Mode',
    correct: 'b',
  },
  {
    q: 'Welche JavaScript-Methode fügt ein Element ans Ende eines Arrays?',
    a: 'push()',
    b: 'pop()',
    c: 'shift()',
    correct: 'a',
  },
  {
    q: 'Welcher HTTP-Statuscode steht für "Not Found"?',
    a: '200',
    b: '301',
    c: '404',
    correct: 'c',
  },
  {
    q: 'Wofür steht das "S" in HTTPS?',
    a: 'Simple',
    b: 'Secure',
    c: 'Standard',
    correct: 'b',
  },
  {
    q: 'Welchen Standard-`display`-Wert hat ein <div>-Element in CSS?',
    a: 'inline',
    b: 'block',
    c: 'flex',
    correct: 'b',
  },
  {
    q: 'Welche CSS-Eigenschaft steuert die Stapelreihenfolge von Elementen?',
    a: 'z-index',
    b: 'order',
    c: 'layer',
    correct: 'a',
  },
  {
    q: 'Welches Schlüsselwort deklariert eine unveränderliche Bindung in JavaScript?',
    a: 'let',
    b: 'var',
    c: 'const',
    correct: 'c',
  },
  {
    q: 'Auf welchem Port läuft HTTP standardmäßig?',
    a: '80',
    b: '443',
    c: '8080',
    correct: 'a',
  },
];

// ── Gesten-Antwort-Zuordnung ──────────────────────────────────────────────────

// Welcher GestureLibrary-Gestenname mappt auf welche Aktion.
const GESTURE_ACTION = {
  forward: 'a', // rechter Arm = Antwort A
  backward: 'b', // linker Arm  = Antwort B
  confirm: 'c', // beide hoch  = Antwort C
  stop: 'skip', // T-Pose      = überspringen
  armsCrossed: 'restart', // gekreuzt    = neu starten
};

// Gesten, die im Quiz nicht benötigt werden und deaktiviert werden sollen.
// API-Erkenntnis: ohne disable() wäre nur serverseitiges Filtern im Event-Handler
// möglich – die Gesten würden intern aber weiter akkumulieren und könnten
// das Conflict-System beeinflussen. Deshalb wurde disable() zur Library ergänzt.
const UNUSED_GESTURES = [
  'volUp',
  'volDown',
  'scrollUp',
  'scrollDown',
  'zoomIn',
  'zoomOut',
  'swipeRight',
  'pause',
];

// ── Spielzustand ──────────────────────────────────────────────────────────────

let lib = null;
let cameraRunning = false;
let currentIdx = 0;
let score = 0;
let answers = []; // { isCorrect, chosen, correct } pro Frage
let accepting = false; // true = Geste wird als Antwort gewertet

// ── DOM-Referenzen ────────────────────────────────────────────────────────────

const $screens = {
  start: document.getElementById('screen-start'),
  game: document.getElementById('screen-game'),
  results: document.getElementById('screen-results'),
};

const $camPip = document.getElementById('cam-pip');
const $camVideo = document.getElementById('cam-video');
const $camCanvas = document.getElementById('cam-canvas');
const $camStatus = document.getElementById('cam-status');

const $qNum = document.getElementById('q-num');
const $qTotal = document.getElementById('q-total');
const $scoreEl = document.getElementById('score');
const $overallProg = document.getElementById('overall-progress');
const $questionText = document.getElementById('question-text');
const $holdBars = document.getElementById('hold-bars');
const $feedbackEl = document.getElementById('feedback');

const $cardA = document.getElementById('card-A');
const $cardB = document.getElementById('card-B');
const $cardC = document.getElementById('card-C');
const $ansA = document.getElementById('ans-A');
const $ansB = document.getElementById('ans-B');
const $ansC = document.getElementById('ans-C');

const $resultEmoji = document.getElementById('result-emoji');
const $finalScore = document.getElementById('final-score');
const $finalTotal = document.getElementById('final-total');
const $resultMsg = document.getElementById('result-msg');
const $resultList = document.getElementById('result-list');

const $smoothingSelect = document.getElementById('smoothing-select');

document.getElementById('btn-start').addEventListener('click', startGame);
document.getElementById('btn-restart').addEventListener('click', startGame);

// ── Screens ───────────────────────────────────────────────────────────────────

let currentScreen = 'start';

function showScreen(name) {
  currentScreen = name;
  Object.entries($screens).forEach(([k, el]) => el.classList.toggle('active', k === name));
}

// ── Spielstart / Neustart ─────────────────────────────────────────────────────

async function startGame() {
  score = 0;
  answers = [];
  accepting = false;

  if (!lib) {
    // Erste Runde: Library instanziieren und konfigurieren.
    // smoothing/timestamp: siehe gesture-lib/README.md, Abschnitt "Robustheit".
    lib = new GestureLibrary({
      bufferSize: 5,
      cooldownMs: 1600,
      minVisibility: 0.55,
      smoothing: $smoothingSelect.value,
    });

    lib.useDefaults();

    // Nicht benötigte Gesten deaktivieren.
    // API-Erkenntnis: useDefaults() registriert alle 13 Gesten auf einmal;
    // es gab ursprünglich keine Möglichkeit, einzelne davon zu unterdrücken.
    // disable() wurde als Lösung zur Library hinzugefügt.
    for (const name of UNUSED_GESTURES) {
      lib.disable(name);
    }

    lib.addEventListener('gesture', onGesture);

    // Halte-Fortschrittbalken aus der API ableiten – nicht hart kodieren.
    // getGestures() liefert Metadaten aller registrierten Gesten.
    buildHoldBars();

    // Die Glättungsstrategie ist an diese Library-Instanz gebunden; ein
    // Wechsel ist nur vor dem ersten Start sinnvoll.
    $smoothingSelect.disabled = true;
  } else {
    // Neustart: Zustand der Library zurücksetzen (Puffer + Zähler).
    lib.reset();
  }

  $scoreEl.textContent = '0';
  $qTotal.textContent = QUESTIONS.length;

  $camPip.classList.remove('d-none');
  showScreen('game');

  if (!cameraRunning) {
    await initCamera();
    cameraRunning = true;
  }

  loadQuestion(0);
}

// ── Fragen-Navigation ─────────────────────────────────────────────────────────

function loadQuestion(idx) {
  currentIdx = idx;
  const q = QUESTIONS[idx];

  // Karten zurücksetzen
  [$cardA, $cardB, $cardC].forEach(el => el.classList.remove('correct', 'wrong', 'pending'));

  $qNum.textContent = idx + 1;
  $overallProg.style.width = `${(idx / QUESTIONS.length) * 100}%`;
  $questionText.textContent = q.q;
  $ansA.textContent = q.a;
  $ansB.textContent = q.b;
  $ansC.textContent = q.c;

  // Kurze Sperre: verhindert Soforterkennung beim Laden
  accepting = false;
  setTimeout(() => {
    accepting = true;
  }, 900);
}

function advanceOrFinish() {
  hideFeedback();
  const next = currentIdx + 1;
  if (next >= QUESTIONS.length) {
    showResults();
  } else {
    loadQuestion(next);
  }
}

// ── Gesten-Handler ────────────────────────────────────────────────────────────

function onGesture({ detail }) {
  handleAction(detail.name);
}

// Tastatur-Fallback: das Spiel ist per Kamera/Gesten konzipiert, aber ohne
// funktionierende Kamera oder für Personen, die die Gesten nicht ausführen
// können, muss dieselbe Interaktion per Tastatur möglich sein.
const KEY_ACTION = {
  ArrowRight: 'forward',
  ArrowLeft: 'backward',
  ArrowUp: 'confirm',
  Escape: 'stop',
  Backspace: 'armsCrossed',
};

document.addEventListener('keydown', e => {
  const name = KEY_ACTION[e.key];
  if (name === undefined) return;
  e.preventDefault();
  handleAction(name);
});

/**
 * Verarbeitet eine Geste (per Kamera oder Tastatur) anhand ihres Namens.
 * Beide Eingabewege laufen durch denselben Code, damit sie exakt gleich
 * behandelt werden.
 */
function handleAction(name) {
  // Auf dem Ergebnisbildschirm: Neustart-Gesten abfangen
  if (currentScreen === 'results') {
    if (name === 'stop' || name === 'armsCrossed') startGame();
    return;
  }

  if (currentScreen !== 'game' || !accepting) return;

  const action = GESTURE_ACTION[name];
  if (action === undefined) return; // nicht gemappte Geste ignorieren

  accepting = false; // Doppel-Trigger während Feedback verhindern

  if (action === 'restart') {
    startGame();
    return;
  }

  if (action === 'skip') {
    answers.push({ isCorrect: null, chosen: null, correct: QUESTIONS[currentIdx].correct });
    showFeedback('⏭️', 'Frage übersprungen');
    setTimeout(advanceOrFinish, 1100);
    return;
  }

  // Antwort auswerten
  const q = QUESTIONS[currentIdx];
  const isCorrect = action === q.correct;
  const cardMap = { a: $cardA, b: $cardB, c: $cardC };
  const chosenCard = cardMap[action];
  const correctCard = cardMap[q.correct];

  chosenCard.classList.add(isCorrect ? 'correct' : 'wrong');
  if (!isCorrect) correctCard.classList.add('correct');

  if (isCorrect) {
    score++;
    $scoreEl.textContent = score;
  }

  answers.push({ isCorrect, chosen: action, correct: q.correct });
  showFeedback(isCorrect ? '✅' : '❌', isCorrect ? 'Richtig' : 'Falsch');
  setTimeout(advanceOrFinish, 1500);
}

// ── Ergebnisse ────────────────────────────────────────────────────────────────

function showResults() {
  showScreen('results');

  $overallProg.style.width = '100%';
  $finalScore.textContent = score;
  $finalTotal.textContent = QUESTIONS.length;

  const pct = score / QUESTIONS.length;
  if (pct === 1) {
    $resultEmoji.textContent = '🏆';
    $resultMsg.textContent = 'Perfekt! Du bist ein Web-Profi!';
  } else if (pct >= 0.7) {
    $resultEmoji.textContent = '🎉';
    $resultMsg.textContent = 'Sehr gut! Du kennst dich aus.';
  } else if (pct >= 0.5) {
    $resultEmoji.textContent = '👍';
    $resultMsg.textContent = 'Guter Anfang – noch Luft nach oben!';
  } else {
    $resultEmoji.textContent = '📚';
    $resultMsg.textContent = 'Üb noch ein bisschen – du schaffst das!';
  }

  $resultList.innerHTML = answers
    .map((a, i) => {
      const icon = a.isCorrect === null ? '⏭️' : a.isCorrect ? '✅' : '❌';
      return `
      <div class="d-flex align-items-start gap-2 p-2 rounded" style="background:#161b22;border:1px solid #30363d;">
        <span>${icon}</span>
        <span class="text-secondary small flex-grow-1">${QUESTIONS[i].q}</span>
      </div>`;
    })
    .join('');
}

// ── Feedback-Flash ────────────────────────────────────────────────────────────

function showFeedback(emoji, a11yText) {
  $feedbackEl.textContent = emoji;
  // aria-label statt des Emoji-Textinhalts, damit Screenreader den Zustand
  // ("Richtig"/"Falsch"/…) statt einer Emoji-Beschreibung ansagen.
  $feedbackEl.setAttribute('aria-label', a11yText);
  $feedbackEl.classList.add('show');
}
function hideFeedback() {
  $feedbackEl.classList.remove('show');
}

// ── Halte-Fortschrittbalken ───────────────────────────────────────────────────

/**
 * Baut die Fortschrittbalken aus den Gesten-Metadaten der Library auf.
 *
 * API-Erkenntnis: Um den prozentualen Fortschritt zu berechnen, musste man
 * ursprünglich getState().holdCounters mit den holdFrames aus getGestures()
 * kombinieren – umständliches Boilerplate. Deshalb wurde getProgress() als
 * Convenience-Methode zur Library hinzugefügt.
 */
function buildHoldBars() {
  // Nur Halte-Gesten, die tatsächlich im Quiz verwendet werden
  const quizGestures = ['forward', 'backward', 'confirm', 'stop'];

  // getGestures() nutzen, um Labels aus der Library zu holen – kein Hardcoding
  const meta = lib.getGestures().filter(g => g.type === 'hold' && quizGestures.includes(g.name));

  $holdBars.innerHTML = meta
    .map(
      g => `
    <div>
      <div class="d-flex justify-content-between mb-1">
        <span class="text-secondary" style="font-size:.75rem;">${g.label}</span>
        <span id="pb-pct-${g.name}" class="text-secondary" style="font-size:.75rem;">0 %</span>
      </div>
      <div class="progress hold-bar" style="background:#21262d;">
        <div id="pb-${g.name}" class="progress-bar" style="width:0%;"
          role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" aria-label="${g.label}"></div>
      </div>
    </div>
  `
    )
    .join('');
}

function updateHoldBars() {
  if (!lib || currentScreen !== 'game') return;

  // getProgress() liefert { name: { count, holdFrames, progress } } für alle
  // Halte-Gesten in einem einzigen Aufruf – kein manuelles Kombinieren nötig.
  const progress = lib.getProgress();

  for (const [name, data] of Object.entries(progress)) {
    const bar = document.getElementById(`pb-${name}`);
    const pct = document.getElementById(`pb-pct-${name}`);
    if (!bar) continue;

    const pctVal = Math.round(data.progress * 100);
    bar.style.width = `${pctVal}%`;
    bar.setAttribute('aria-valuenow', pctVal);
    if (pct) pct.textContent = `${pctVal} %`;

    // Farbwechsel: blau → gelb ab 60 %, gelb → rot ab 85 %
    bar.className =
      'progress-bar ' +
      (data.progress >= 0.85 ? 'bg-danger' : data.progress >= 0.6 ? 'bg-warning' : 'bg-primary');
  }
}

// ── Kamera & MediaPipe ────────────────────────────────────────────────────────

async function initCamera() {
  const pose = new Pose({
    locateFile: file => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`,
  });

  pose.setOptions({
    modelComplexity: 1,
    smoothLandmarks: true,
    enableSegmentation: false,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5,
  });

  pose.onResults(results => {
    drawLandmarks(results);

    // Frames an die Library übergeben (einziger Punkt der Interaktion pro Frame).
    // Real timestamp so hold/cooldown timing is frame-rate independent (see
    // gesture-lib README, "Frame-Rate-Unabhängigkeit").
    lib.update(results.poseLandmarks || null, performance.now());

    // Fortschrittbalken jedes Frame aktualisieren.
    updateHoldBars();

    $camStatus.textContent = results.poseLandmarks ? '✓ Pose erkannt' : 'Keine Person erkannt';
  });

  const camera = new Camera($camVideo, {
    onFrame: async () => {
      await pose.send({ image: $camVideo });
    },
    width: 320,
    height: 240,
  });

  await camera.start();
}

/**
 * Zeichnet Schultern und Handgelenke als einfache Punkte auf den Canvas,
 * damit der Nutzer sieht, ob er im Bild ist.
 */
function drawLandmarks(results) {
  const ctx = $camCanvas.getContext('2d');
  const w = $camVideo.videoWidth || 320;
  const h = $camVideo.videoHeight || 240;
  $camCanvas.width = w;
  $camCanvas.height = h;
  ctx.clearRect(0, 0, w, h);

  if (!results.poseLandmarks) return;

  const KEY_INDICES = [11, 12, 15, 16]; // Schultern + Handgelenke
  ctx.fillStyle = '#388bfd';

  for (const idx of KEY_INDICES) {
    const lm = results.poseLandmarks[idx];
    if (!lm || lm.visibility < 0.5) continue;
    ctx.beginPath();
    ctx.arc(lm.x * w, lm.y * h, 5, 0, Math.PI * 2);
    ctx.fill();
  }

  // Verbindungslinien Schulter–Schulter und Schulter–Handgelenk
  ctx.strokeStyle = '#388bfd';
  ctx.lineWidth = 2;
  ctx.globalAlpha = 0.6;

  const lms = results.poseLandmarks;
  const drawLine = (a, b) => {
    if (lms[a]?.visibility > 0.5 && lms[b]?.visibility > 0.5) {
      ctx.beginPath();
      ctx.moveTo(lms[a].x * w, lms[a].y * h);
      ctx.lineTo(lms[b].x * w, lms[b].y * h);
      ctx.stroke();
    }
  };

  drawLine(11, 12); // Schulter-Schulter
  drawLine(11, 15); // linke Schulter–Handgelenk
  drawLine(12, 16); // rechte Schulter–Handgelenk

  ctx.globalAlpha = 1;
}
