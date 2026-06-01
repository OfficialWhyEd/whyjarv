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
  // Sistema 4: interim transcript → speculative pre-computation
  (interim: string) => {
    if (isAwake && interim.split(" ").length >= 4) {
      socket.send({ type: "transcript", text: interim, isFinal: false });
    }
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

function speakText(text: string) {
  speechSynthesis.cancel();
  const sentences = text.match(/[^.!?]+[.!?]*/g) || [text];
  transition("speaking");
  let idx = 0;
  function speakNext() {
    if (idx >= sentences.length) { transition("idle"); return; }
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
    const text = msg.text as string;
    if (text) { console.log("[WhyJarv]", text); speakText(text); }
    else transition("idle");
  } else if (type === "audio") {
    // Fallback — non usato in WhyJarv ma compatibile col backend originale
    if (msg.text) speakText(msg.text as string);
    else transition("idle");
  } else if (type === "status") {
    const state = msg.state as string;
    if (state === "thinking" && currentState !== "thinking") {
      transition("thinking");
    } else if (state === "working") {
      // Task spawned — show thinking with a different label
      transition("thinking");
      statusEl.textContent = "working...";
    } else if (state === "idle") {
      transition("idle");
    }
  } else if (type === "text") {
    // Text fallback when TTS fails
    console.log("[JARVIS]", msg.text);
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
