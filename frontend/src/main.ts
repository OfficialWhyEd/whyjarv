/**
 * JARVIS — Main entry point.
 *
 * Wires together the orb visualization, WebSocket communication,
 * speech recognition, and audio playback into a single experience.
 */

import { createOrb, type OrbState } from "./orb";
import { createVoiceInput, createAudioPlayer } from "./voice";
import { createSocket } from "./ws";
import { openSettings, checkFirstTimeSetup } from "./settings";
import "./style.css";

// ---------------------------------------------------------------------------
// State machine
// ---------------------------------------------------------------------------

type State = "idle" | "listening" | "thinking" | "speaking";
let currentState: State = "idle";
let isMuted = false;

const statusEl = document.getElementById("status-text")!;
const errorEl = document.getElementById("error-text")!;

function showError(msg: string) {
  errorEl.textContent = msg;
  errorEl.style.opacity = "1";
  setTimeout(() => {
    errorEl.style.opacity = "0";
  }, 5000);
}

function updateStatus(state: State) {
  const labels: Record<State, string> = {
    idle: "",
    listening: "in ascolto...",
    thinking: "elaboro...",
    speaking: "",
  };
  statusEl.textContent = labels[state];
}

function updateHUD(state: State) {
  const el = document.getElementById('hud-state');
  if (el) {
    const labels: Record<State, string> = {
      idle: 'IDLE',
      listening: 'LISTEN',
      thinking: 'THINK',
      speaking: 'SPEAK',
    };
    el.textContent = labels[state] || state.toUpperCase();
    el.className = state !== 'idle' ? 'hud-val hud-active' : 'hud-val';
  }
}

// ---------------------------------------------------------------------------
// Init components
// ---------------------------------------------------------------------------

const canvas = document.getElementById("orb-canvas") as HTMLCanvasElement;
const orb = createOrb(canvas);

const wsProto = window.location.protocol === "https:" ? "wss:" : "ws:";
const WS_URL = `${wsProto}//${window.location.host}/ws/voice`;
const socket = createSocket(WS_URL);

const audioPlayer = createAudioPlayer();
orb.setAnalyser(audioPlayer.getAnalyser());

function transition(newState: State) {
  if (newState === currentState) return;
  currentState = newState;
  orb.setState(newState as OrbState);
  updateStatus(newState);
  updateHUD(newState);

  switch (newState) {
    case "idle":
      if (!isMuted) voiceInput.resume();
      break;
    case "listening":
      if (!isMuted) voiceInput.resume();
      break;
    case "thinking":
      voiceInput.pause();
      break;
    case "speaking":
      voiceInput.pause();
      break;
  }
}

// ---------------------------------------------------------------------------
// Voice input
// ---------------------------------------------------------------------------

// ── PersonaPlex-style Backchanneling ─────────────────────────────────────────
// Mentre Edoardo parla, WhyJarv dà segnali di ascolto attivo.
// Non interrompe mai — parla SOLO nelle pause naturali (>800ms silenzio).
// Questo è il vero segreto di PersonaPlex: sembra vivo perché reagisce.
const BACKCHANNELS_IT = ["Sì.", "Capisco.", "Mm.", "Certo.", "Ok."];
let _bcTimer: ReturnType<typeof setTimeout> | null = null;
let _lastInterimLen = 0;
let _bcCooldown = false;

function _triggerBackchannel() {
  if (_bcCooldown || currentState !== "listening") return;
  const bc = BACKCHANNELS_IT[Math.floor(Math.random() * BACKCHANNELS_IT.length)];
  const utt = new SpeechSynthesisUtterance(bc);
  const voice = getItalianVoice();
  if (voice) utt.voice = voice;
  utt.rate = 1.05; utt.pitch = 1.0; utt.volume = 0.7;  // più sottile, non invadente
  speechSynthesis.speak(utt);
  _bcCooldown = true;
  setTimeout(() => { _bcCooldown = false; }, 4000);  // cooldown 4s tra backchannels
}

function _onInterimForBackchannel(text: string) {
  if (_bcTimer) clearTimeout(_bcTimer);
  const len = text.length;
  // Se il testo si è stabilizzato (pausa naturale) → backchannel dopo 900ms
  if (len > 20 && len === _lastInterimLen) {
    _bcTimer = setTimeout(_triggerBackchannel, 900);
  }
  _lastInterimLen = len;
}

const WAKE_WORDS = ["let's start", "lets start", "inizia", "hey jarvis", "whyjarv"];
let isAwake = false;

const voiceInput = createVoiceInput(
  (text: string) => {
    const t = text.toLowerCase().trim();


    // Wake word detection — attiva quando WhyJarv è in idle
    if (!isAwake) {
      const triggered = WAKE_WORDS.some(w => t.includes(w));
      if (triggered) {
        isAwake = true;
        speechSynthesis.cancel();
        // Suona un tick di conferma via TTS
        const ack = new SpeechSynthesisUtterance(".");
        ack.volume = 0; // silenzioso, solo per attivare il contesto audio
        speechSynthesis.speak(ack);
        transition("listening");
      }
      return; // ignora tutto il resto quando dormiente
    }

    // Shutdown
    if (t.includes("chiuditi") || t.includes("goodbye whyjarv") || t.includes("arrivederci")) {
      isAwake = false;
      transition("idle");
      return;
    }

    // Comando normale — invia a WhyJarv
    speechSynthesis.cancel();
    socket.send({ type: "transcript", text, isFinal: true });
    transition("thinking");
  },
  (msg: string) => {
    showError(msg);
  },
  // Sistema 4 + Backchanneling
  (interim: string) => {
    if (!isAwake) return;
    // Speculative pre-computation
    if (interim.split(" ").length >= 4) {
      socket.send({ type: "transcript", text: interim, isFinal: false });
    }
    // PersonaPlex backchanneling — segnali di ascolto nelle pause naturali
    _onInterimForBackchannel(interim);
  }
);

// ---------------------------------------------------------------------------
// Audio playback finished
// ---------------------------------------------------------------------------

audioPlayer.onFinished(() => {
  transition("idle");
});

// ---------------------------------------------------------------------------
// WebSocket messages
// ---------------------------------------------------------------------------

// ── Web Speech Synthesis — Apple TTS nativo, latenza <50ms ──────────────────
function getItalianVoice(): SpeechSynthesisVoice | null {
  const voices = speechSynthesis.getVoices();
  return (
    voices.find(v => v.name === "Federica") ||
    voices.find(v => v.lang === "it-IT" && v.localService) ||
    voices.find(v => v.lang.startsWith("it") && v.localService) ||
    voices.find(v => v.localService) ||
    voices[0] || null
  );
}

// Filler naturali — pronunciati IMMEDIATAMENTE mentre Groq elabora.
// Elimina il silenzio imbarazzante. Fa sembrare WhyJarv umano.
const FILLERS_IT = ["Mm.", "Sì.", "Un attimo.", "Ci penso.", "Ok."];
const FILLERS_EN = ["Mm.", "Yeah.", "One sec.", "On it.", "Ok."];
let _lastFiller = "";
let _fillerTimeout: ReturnType<typeof setTimeout> | null = null;

function _playFiller(lang: "it" | "en" = "it") {
  // Riproduci un filler dopo 120ms di silenzio (se la risposta non è ancora arrivata)
  if (_fillerTimeout) clearTimeout(_fillerTimeout);
  _fillerTimeout = setTimeout(() => {
    if (currentState !== "thinking") return;
    const pool = lang === "it" ? FILLERS_IT : FILLERS_EN;
    // Non ripetere lo stesso filler due volte di fila
    const available = pool.filter(f => f !== _lastFiller);
    const filler = available[Math.floor(Math.random() * available.length)];
    _lastFiller = filler;
    const utt = new SpeechSynthesisUtterance(filler);
    const voice = getItalianVoice();
    if (voice) utt.voice = voice;
    utt.rate = 1.0;
    utt.pitch = 0.95;
    speechSynthesis.speak(utt);
  }, 120);  // 120ms — abbastanza per sembrare naturale
}

function _cancelFiller() {
  if (_fillerTimeout) { clearTimeout(_fillerTimeout); _fillerTimeout = null; }
}

// ── Full-duplex barge-in (ispirato a PersonaPlex NVIDIA) ──────────────────
// WhyJarv sente Edoardo anche mentre parla — si ferma immediatamente.
// Implementato con Web Audio API + VAD leggero (zero ML, pure DOM).
let _bargeInDetector: ReturnType<typeof _createBargeInDetector> | null = null;

function _createBargeInDetector(onBargeIn: () => void) {
  let audioCtx: AudioContext | null = null;
  let analyser: AnalyserNode | null = null;
  let stream: MediaStream | null = null;
  let animId: number | null = null;
  const THRESHOLD = 0.015;  // sensibilità voce

  function start() {
    navigator.mediaDevices.getUserMedia({ audio: true, video: false })
      .then(s => {
        stream = s;
        audioCtx = new AudioContext();
        const source = audioCtx.createMediaStreamSource(s);
        analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);

        const data = new Float32Array(analyser.frequencyBinCount);
        function detect() {
          if (!analyser) return;
          analyser.getFloatTimeDomainData(data);
          const rms = Math.sqrt(data.reduce((s, v) => s + v * v, 0) / data.length);
          if (rms > THRESHOLD) {
            onBargeIn();
          }
          animId = requestAnimationFrame(detect);
        }
        detect();
      })
      .catch(() => {});  // silenzioso se non disponibile
  }

  function stop() {
    if (animId) cancelAnimationFrame(animId);
    if (stream) stream.getTracks().forEach(t => t.stop());
    if (audioCtx) audioCtx.close();
    analyser = null; stream = null; audioCtx = null;
  }

  return { start, stop };
}

function speakText(text: string) {
  speechSynthesis.cancel();
  if (_bargeInDetector) { _bargeInDetector.stop(); _bargeInDetector = null; }

  const sentences = text.match(/[^.!?]+[.!?]*/g) || [text];
  transition("speaking");
  let idx = 0;
  let stopped = false;

  // Barge-in: se Edoardo parla mentre WhyJarv risponde → si ferma subito
  _bargeInDetector = _createBargeInDetector(() => {
    if (!stopped && currentState === "speaking") {
      stopped = true;
      speechSynthesis.cancel();
      if (_bargeInDetector) { _bargeInDetector.stop(); _bargeInDetector = null; }
      transition("listening");
    }
  });
  _bargeInDetector.start();

  function speakNext() {
    if (stopped || idx >= sentences.length) {
      if (_bargeInDetector) { _bargeInDetector.stop(); _bargeInDetector = null; }
      if (!stopped) transition("idle");
      return;
    }
    const utt = new SpeechSynthesisUtterance(sentences[idx++].trim());
    const voice = getItalianVoice();
    if (voice) utt.voice = voice;
    utt.lang = "it-IT";
    utt.rate = 1.1;
    utt.pitch = 0.9;
    utt.onend = speakNext;
    utt.onerror = () => { transition("idle"); };
    speechSynthesis.speak(utt);
  }
  speakNext();
}

speechSynthesis.onvoiceschanged = () => { getItalianVoice(); };

socket.onMessage((msg) => {
  const type = msg.type as string;

  if (type === "tts") {
    // Risposta completa — cancella il filler, parla
    _cancelFiller();
    const text = msg.text as string;
    if (text) { console.log("[WhyJarv]", text); speakText(text); }
    else transition("idle");
  } else if (type === "tts_sentence") {
    // Streaming sentence-by-sentence — prima frase parla subito
    _cancelFiller();
    const sentence = msg.text as string;
    if (sentence && sentence.trim()) {
      if (currentState !== "speaking") transition("speaking");
      // Accoda la frase nella coda TTS esistente (non interrompe)
      const utt = new SpeechSynthesisUtterance(sentence.trim());
      const voice = getItalianVoice();
      if (voice) utt.voice = voice;
      utt.lang = "it-IT";
      utt.rate = 1.1;
      utt.pitch = 0.9;
      speechSynthesis.speak(utt);
    }
  } else if (type === "tts_end") {
    // Fine streaming — transizione idle se non c'è altro in coda
    if (speechSynthesis.pending === false && !speechSynthesis.speaking) {
      transition("idle");
    }
  } else if (type === "audio") {
    _cancelFiller();
    if (msg.text) speakText(msg.text as string);
    else transition("idle");
  } else if (type === "status") {
    const state = msg.state as string;
    if (state === "thinking" && currentState !== "thinking") {
      transition("thinking");
      _playFiller();  // ← filler immediato, elimina il silenzio
    } else if (state === "working") {
      transition("thinking");
      _cancelFiller();
      statusEl.textContent = "working...";
    } else if (state === "idle") {
      _cancelFiller();
      transition("idle");
    }
  } else if (type === "text") {
    console.log("[WhyJarv]", msg.text);
  } else if (type === "task_spawned") {
    console.log("[task]", "spawned:", msg.task_id, msg.prompt);
  } else if (type === "task_complete") {
    console.log("[task]", "complete:", msg.task_id, msg.status, msg.summary);
  }
});

// ---------------------------------------------------------------------------
// Kick off
// ---------------------------------------------------------------------------

// Start listening after a brief delay for the orb to render
setTimeout(() => {
  voiceInput.start();
  transition("listening");
}, 1000);

// Resume AudioContext on ANY user interaction (browser autoplay policy)
function ensureAudioContext() {
  const ctx = audioPlayer.getAnalyser().context as AudioContext;
  if (ctx.state === "suspended") {
    ctx.resume().then(() => console.log("[audio] context resumed"));
  }
}
document.addEventListener("click", ensureAudioContext);
document.addEventListener("touchstart", ensureAudioContext);
document.addEventListener("keydown", ensureAudioContext, { once: true });

// Try to resume audio context on load
ensureAudioContext();

// ---------------------------------------------------------------------------
// UI Controls
// ---------------------------------------------------------------------------

const btnMute = document.getElementById("btn-mute")!;
const btnMenu = document.getElementById("btn-menu")!;
const menuDropdown = document.getElementById("menu-dropdown")!;
const btnRestart = document.getElementById("btn-restart")!;
const btnFixSelf = document.getElementById("btn-fix-self")!;

btnMute.addEventListener("click", (e) => {
  e.stopPropagation();
  isMuted = !isMuted;
  btnMute.classList.toggle("muted", isMuted);
  if (isMuted) {
    voiceInput.pause();
    transition("idle");
  } else {
    voiceInput.resume();
    transition("listening");
  }
});

btnMenu.addEventListener("click", (e) => {
  e.stopPropagation();
  menuDropdown.style.display = menuDropdown.style.display === "none" ? "block" : "none";
});

document.addEventListener("click", () => {
  menuDropdown.style.display = "none";
});

btnRestart.addEventListener("click", async (e) => {
  e.stopPropagation();
  menuDropdown.style.display = "none";
  statusEl.textContent = "restarting...";
  try {
    await fetch("/api/restart", { method: "POST" });
    // Wait a few seconds then reload
    setTimeout(() => window.location.reload(), 4000);
  } catch {
    statusEl.textContent = "restart failed";
  }
});

btnFixSelf.addEventListener("click", (e) => {
  e.stopPropagation();
  menuDropdown.style.display = "none";
  // Activate work mode on the WebSocket session (JARVIS becomes Claude Code's voice)
  socket.send({ type: "fix_self" });
  statusEl.textContent = "entering work mode...";
});

// Settings button
const btnSettings = document.getElementById("btn-settings")!;
btnSettings.addEventListener("click", (e) => {
  e.stopPropagation();
  menuDropdown.style.display = "none";
  openSettings();
});

// First-time setup detection — check after a short delay for server readiness
setTimeout(() => {
  checkFirstTimeSetup();
}, 2000);
