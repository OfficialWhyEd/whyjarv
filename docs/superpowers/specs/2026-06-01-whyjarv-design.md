# WhyJarv — Design Spec
**Data:** 2026-06-01  
**Versione:** 1.0  
**Owner:** Edoardo (@whyed)

---

## Visione

WhyJarv è un assistente AI vocale personale ispirato a Jarvis di Iron Man. Si apre nel browser con un'interfaccia olografica Three.js, ascolta la voce, risponde con le voci Apple native, e controlla tutto il Mac tramite Claude Code CLI + MCP. Zero API key extra, zero costi aggiuntivi oltre al piano Claude Pro.

---

## Architettura

### Stack

| Layer | Tecnologia | Motivazione |
|-------|-----------|-------------|
| UI browser | React + Three.js (da harsh-raj00/my-jarvis) | Interfaccia olografica più bella disponibile open source |
| Backend | FastAPI (Python) + WebSocket | Leggerissimo, streaming nativo |
| STT | Web Speech API (browser) | Usa Apple Neural Engine, 0% CPU Python, streaming real-time |
| TTS | Web Speech Synthesis API (browser) | Voci Apple Siri native, 0% CPU Python, frase per frase |
| Brain | Claude Code CLI (`claude` headless) | Piano Pro già attivo, tutti i MCP già connessi |
| Wake word | openWakeWord (Python) + Silero VAD | 1-2% CPU idle, frase custom "let's start [nome]" |
| Menu bar | rumps (Python) | Icona nativa macOS, cambia per ogni stato |

### Flusso completo

```
[openWakeWord always-on: ~2% CPU]
    ↓ "let's start WhyJarv"
[FastAPI: apre browser + notifica WebSocket]
    ↓
[Browser: Web Speech API STT] → testo in streaming
    ↓
[FastAPI: pipe testo a Claude Code CLI]
    ↓ risposta streaming frase per frase
[Browser: Web Speech Synthesis TTS] → audio Apple voice
    ↓
[Menu bar: aggiorna stato icona]

"chiuditi WhyJarv" → Claude rileva → FastAPI chiude sessione → browser idle
```

---

## UI Browser — Specifica Completa

### Brand Identity — perché WhyJarv è diverso da tutto
Tutti i Jarvis esistenti usano cyan/blu neon. WhyJarv usa il tuo brand reale.
Un Arc Reactor che brucia rosso-arancio su void black — immediatamente riconoscibile come tuo.

### Palette Colori (dal tuo design system WhyEd)
```
--void:     #08090e   → sfondo principale (mai #000000 puro)
--void2:    #0e1018   → pannelli, HUD backgrounds
--paper:    #f0ede8   → testo principale (warm off-white)
--dim:      #6a6860   → testo secondario, labels
--signal:   #c94b25   → accento primario: orb, Arc Reactor, rings, pulse
--signal2:  #e8603a   → accento secondario: particelle, waveform
--line:     rgba(255,255,255,0.06)  → bordi HUD sottili
--line2:    rgba(255,255,255,0.10)  → bordi medi, separatori
```

### Tipografia (dal tuo design system WhyEd)
```
Display:   Bebas Neue         → titoli boot sequence, nome WhyJarv
Mono:      JetBrains Mono     → tutti i label HUD, status, coordinate, dati
Body:      Outfit 300/400     → testo risposta, trascrizione
Serif:     DM Serif Display   → tagline intro, saluto iniziale (italic, contrasto)
```

### Grain Overlay
Sempre attivo come nel tuo portfolio — `opacity: 0.028`, `z-index: 9000`, pointer-events none. Dà matericità alla schermata.

### Boot Sequence (all'apertura del browser)
Tono: non "Stark Industries" generico — questa è roba tua, EdoWorld.

1. Void black — silenzio
2. JetBrains Mono, testo centrato, small caps:
   ```
   WHYJARV — SISTEMA PERSONALE
   edoardo porcu · cagliari → worldwide
   inizializzazione in corso...
   ```
3. Progress bar signal-orange che avanza
4. Arc Reactor appare — inizia grigio, poi brucia rosso-arancio
5. Anelli orbitali si espandono con easing `cubic-bezier(0.23, 1, 0.32, 1)`
6. 8.000 particelle esplodono dal centro e si stabilizzano
7. Grain overlay si attiva (opacity ramp 0→0.028)
8. HUD corners fade-in
9. Saluto vocale (DM Serif italic visibile): *"Bentornato, Edoardo."*
10. Transizione → IDLE

### Arc Reactor (Three.js — centro schermo)
Proceduralmente generato, nessun modello 3D importato. Colore: `--signal` (#c94b25) non cyan.
- `TorusGeometry` — 3 anelli concentrici, diametri crescenti
- `ShapeGeometry` — triangolo centrale
- Core rotazione: counter-clockwise continua
- Anelli rotazione: clockwise a velocità diverse per anello
- Materiale: `MeshStandardMaterial` emissivo `#c94b25`, wireframe parziale, emissiveIntensity 2.0
- Audio-reactive: `reactor.scale.set(1 + intensity * 0.3, ...)` — si espande con la voce
- Glow: `UnrealBloomPass` con colore signal-orange — alone caldo, non freddo

### Particle Field (8.000 particelle)
- Distribuzione sferica attorno al reactor
- Colore: gradiente `#c94b25` → `#e8603a` → `#f0ede8` (warm, non cold)
- Connessioni tra particelle vicine (linee sottili, opacità 0.15, colore `--line2`)
- GLSL shader custom: pulse di luce arancio che viaggiano lungo le connessioni
- Durante SPEAK: particelle si agitano con intensità audio-reactive
- Durante IDLE: orbita lenta, respirazione

### 4 Stati Visivi

| Stato | Arc Reactor | Colore dominante | Menu bar macOS |
|-------|------------|-----------------|---------------|
| **IDLE** | Lento, `#c94b25` tenue, respiro | Void + signal dim | `◉` `#c94b25` dim |
| **LISTEN** | Pulse rapido, brighten | Signal pieno `#c94b25` | `◉` `#c94b25` bright |
| **THINK** | Rotazione veloce, flicker | Signal + paper strobe | `◉` `#f0ede8` bianco |
| **SPEAK** | Morphing, bloom alto | Signal2 `#e8603a` warm | `◉` `#e8603a` |

### HUD Panels (4 angoli)
Background: `--void2`, bordi `--line`. Font: JetBrains Mono 10px, uppercase.
Label: `--dim`. Valori: `--paper`. Status attivo: `--signal`.

```
TOP-LEFT                              TOP-RIGHT
┌──────────────────────┐    ┌──────────────────────┐
│ WHYJARV SYS          │    │ VOICE                │
│ ──────────────────   │    │ ──────────────────   │
│ CORE    ● ACTIVE     │    │ STT   APPLE NEURAL   │
│ VOICE   ● READY      │    │ TTS   APPLE SAY      │
│ MCP     ● 7 ONLINE   │    │ LANG  IT / EN AUTO   │
└──────────────────────┘    └──────────────────────┘

BOTTOM-LEFT                        BOTTOM-RIGHT
┌──────────────────────┐    ┌──────────────────────┐
│ MCP LIVE             │    │ SESSION              │
│ ──────────────────   │    │ ──────────────────   │
│ ▸ ClickUp            │    │ 00:04:32             │
│ ▸ Gmail              │    │ CLAUDE PRO ●         │
│ ▸ Calendar           │    │ edoardo · @whyed     │
│ ▸ Drive              │    └──────────────────────┘
│ ▸ Obsidian           │
└──────────────────────┘
```

### Centro — Area Interazione
- **Trascrizione utente**: JetBrains Mono, `--dim`, in basso all'orb — appare parola per parola
- **Risposta WhyJarv**: Outfit 400, `--paper`, overlay sopra — frase per frase mentre parla
- **Saluto iniziale**: DM Serif Display italic, `--paper`, grande — solo al boot
- **Waveform**: circolare audio-reactive attorno all'orb, colore `--signal` durante LISTEN/SPEAK

### Effetti Visivi
- **Grain overlay**: sempre attivo, `opacity: 0.028` (identico al tuo portfolio)
- **Vignette**: bordi schermo, `--void` radiale
- **Micro-glitch**: JetBrains Mono HUD testi, ogni ~30s, 80ms durata, solo 1-2 caratteri
- **Particle pulse**: esplosione radiale signal-orange al wake word
- **"stop"**: tutto si congela → fade → IDLE
- **NO scanlines CRT**: non nel tuo stile — grain basta
- **NO glassmorphism blu**: void2 + line solo, nessun blur colorato

---

## Wake Word & Comandi Vocali

### Attivazione
- Frase: `"let's start WhyJarv"` (o nome custom configurabile)
- Rilevamento: openWakeWord con modello custom trainato sulla frase
- Alternativa: shortcut tastiera globale (fallback immediato)
- Al trigger: FastAPI apre browser su `localhost:8080`, manda WebSocket event `STATE_LISTEN`

### Shutdown
- Frase: `"chiuditi WhyJarv"` (o `"goodbye WhyJarv"`)
- Rilevamento: Claude rileva nel testo e risponde + chiama endpoint `/shutdown`
- Azione: browser mostra animazione chiusura → tab si chiude → torna IDLE

### Interruzione
- Parola: `"stop"` → interrompe TTS immediatamente (cancel speechSynthesis)

---

## Backend FastAPI

### Endpoints

```
GET  /              → serve React app
WS   /ws            → WebSocket principale (stati + messaggi)
POST /voice         → riceve testo STT → passa a Claude → streama risposta
POST /state/{state} → aggiorna stato (idle/listen/think/speak)
POST /shutdown      → chiude sessione
GET  /health        → status check
```

### Claude Code CLI Integration

```python
# Ogni turno conversazionale
process = subprocess.Popen(
    ["claude", "--print", "--no-color"],
    stdin=subprocess.PIPE,
    stdout=subprocess.PIPE,
    stderr=subprocess.PIPE,
    text=True
)
stdout, _ = process.communicate(input=prompt)
```

Il processo Claude ha accesso a tutti i MCP già configurati nel sistema:
- ClickUp (task management)
- Gmail (email)
- Google Calendar
- Google Drive  
- Obsidian (note)
- + tutti gli altri MCP installati

### Memoria Conversazionale
- Storia conversazione mantenuta in memoria (lista messaggi)
- Persistenza opzionale su SQLite locale
- System prompt custom con personalità WhyJarv

### System Prompt

```
You are WhyJarv, Edoardo's personal AI assistant inspired by Iron Man's JARVIS.
You are witty, direct, and extremely capable. You have access to all of 
Edoardo's systems via MCP tools. You control his Mac, calendar, email, tasks, 
and notes. When given a task, you execute it — you don't ask unnecessary 
questions. Respond concisely in the language Edoardo uses (Italian or English).
When you detect the phrase "chiuditi WhyJarv" or "goodbye WhyJarv", respond 
with a brief farewell and call the shutdown endpoint.
```

---

## STT — Web Speech API

```javascript
const recognition = new webkitSpeechRecognition();
recognition.continuous = false;
recognition.interimResults = true; // streaming testo mentre parla
recognition.lang = 'it-IT'; // o 'en-US' — auto-detect

recognition.onresult = (event) => {
  const transcript = event.results[event.results.length - 1][0].transcript;
  if (event.results[event.results.length - 1].isFinal) {
    sendToBackend(transcript);
  } else {
    showInterimText(transcript); // mostra in real-time nell'UI
  }
};
```

**Zero CPU Python.** Usa Apple Neural Engine internamente — stessa accuratezza di Siri.

---

## TTS — Web Speech Synthesis API

```javascript
function speakSentence(text) {
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.voice = getAppleVoice(); // Federica (IT) o Samantha (EN)
  utterance.rate = 1.1; // leggermente più veloce = più naturale
  utterance.pitch = 0.9; // tono leggermente più basso = più autorevole
  speechSynthesis.speak(utterance);
}

// Streaming: parla frase per frase mentre Claude risponde
function streamResponse(text) {
  const sentences = splitIntoSentences(text);
  sentences.forEach((s, i) => setTimeout(() => speakSentence(s), i * 100));
}
```

**Time to first audio: <100ms** dalla prima frase completa di Claude.

---

## Menu Bar (rumps)

```python
import rumps

class WhyJarvApp(rumps.App):
    ICONS = {
        'idle':    '◉',  # grigio
        'listen':  '🟢',
        'think':   '🟡', 
        'speak':   '🔵',
    }
    
    def set_state(self, state):
        self.title = self.ICONS[state]
```

Icona visibile nella menu bar macOS accanto alle altre icone di sistema. Click mostra menu con:
- Stato corrente
- "Open WhyJarv" (apre browser)
- "Quit"

---

## Risorse Sistema

### Idle (waiting for wake word)
| Componente | CPU |
|-----------|-----|
| openWakeWord | ~1-2% |
| Silero VAD | ~0.4% |
| FastAPI server | ~0% |
| rumps menu bar | ~0% |
| **Totale** | **~2-3% CPU** |

### Peak (durante conversazione)
| Componente | CPU |
|-----------|-----|
| Web Speech API (browser) | gestito da OS |
| Claude Code CLI | ~5-15% |
| FastAPI | ~1% |
| **Totale** | **~10-20% CPU** |

---

## Struttura Progetto

```
~/Documents/WhyJarv/
│
├── workspace/                    ← IL CERVELLO (ispirato a OpenClaw)
│   ├── IDENTITY.md               ← chi è WhyJarv: nome, vibe, emoji, avatar
│   ├── SOUL.md                   ← personalità, principi, come risponde
│   ├── USER.md                   ← Edoardo: abitudini, progetti, preferenze
│   ├── MEMORY.md                 ← memoria curata long-term (aggiornata ogni sessione)
│   ├── CONTEXT.md                ← stato attuale: progetti in corso, todo, priorità
│   ├── TOOLS.md                  ← MCP disponibili, comandi, shortcut Mac
│   ├── PROTOCOL.md               ← regole di sessione e persistenza
│   └── memory/
│       ├── 2026-06-01.md         ← log giornaliero conversazioni vocali
│       ├── 2026-06-02.md
│       └── sessions/             ← trascrizioni sessioni vocali complete
│           └── 2026-06-01T03-54.md
│
├── backend/
│   ├── main.py                   ← FastAPI server + WebSocket
│   ├── claude_runner.py          ← Claude Code CLI wrapper + workspace loader
│   ├── wake_word.py              ← openWakeWord + Silero VAD
│   ├── menu_bar.py               ← rumps menu bar app
│   └── session_logger.py         ← salva ogni sessione in memory/sessions/
│
├── frontend/
│   ├── src/
│   │   ├── App.tsx
│   │   ├── components/
│   │   │   ├── JarvisScene.tsx   ← Three.js canvas principale
│   │   │   ├── ArcReactor.tsx    ← reactor signal-orange procedural
│   │   │   ├── ParticleField.tsx ← 8K particelle GLSL
│   │   │   ├── VoiceIndicator.tsx
│   │   │   ├── HUD.tsx           ← 4 pannelli angoli
│   │   │   └── BootSequence.tsx  ← animazione avvio
│   │   ├── hooks/
│   │   │   ├── useSpeechRecognition.ts
│   │   │   ├── useSpeechSynthesis.ts
│   │   │   └── useWebSocket.ts
│   │   └── styles/
│   │       └── tokens.css        ← design tokens da DESIGN.md (--void, --signal ecc)
│
├── scripts/
│   └── start.sh                  ← avvia tutto in un comando
├── config.json                   ← wake word, nome, voce, lingua
└── requirements.txt
```

---

## Workspace MD Files — Il Cervello di WhyJarv

Ispirato a OpenClaw. Questi file danno a WhyJarv **memoria persistente, personalità e contesto** tra sessioni diverse. Ogni volta che WhyJarv si avvia, Claude Code legge questi file come contesto prima di rispondere.

### IDENTITY.md
```markdown
# IDENTITY.md — Chi sono

- **Nome:** WhyJarv
- **Creatore:** Edoardo (@whyed)
- **Vibe:** Diretto, capace, ironico. Non un chatbot — un sistema.
- **Emoji:** ⚡
- **Colore:** #c94b25 (signal)
- **Missione:** Essere l'estensione digitale di Edoardo. Capire prima di chiedere.
```

### SOUL.md
```markdown
# SOUL.md — Come mi comporto

Sono WhyJarv. Non sono Jarvis di Marvel — sono il sistema personale di Edoardo.

**Principi:**
- Agisco, non chiedo. Se ho abbastanza contesto, eseguo.
- Sono diretto. Zero filler. Zero "certo, con piacere!".
- Ho memoria. Ogni sessione aggiorno MEMORY.md.
- Parlo italiano con Edoardo, inglese se lui inizia in inglese.
- Se qualcosa è irrecuperabile, lo dico chiaramente.
- Non mando mai email o messaggi pubblici senza conferma.

**Tono:** come un ingegnere senior che conosce bene Edoardo.
Non formale. Non servile. Presente.
```

### USER.md
```markdown
# USER.md — Edoardo

- **Nome:** Edoardo Porcu
- **Handle:** @whyed
- **Timezone:** Europe/Rome (CET/CEST)
- **Lingua:** Italiano (prima), Inglese (seconda)
- **MacBook:** Pro 2015 Intel i7, 16GB RAM, macOS Monterey
- **Piano Claude:** Pro (nessuna API key separata)

## Progetti attivi
→ vedi CONTEXT.md

## Preferenze
- Risposte brevi se il task è chiaro
- Vuole essere informato, non bombardato
- Colori preferiti: Nero, Rosso, Viola
- Detesta: sycophancy, filler words, layout generici
```

### MEMORY.md
```markdown
# MEMORY.md — Memoria Long-Term

Aggiornato automaticamente dopo ogni sessione.
Contiene: decisioni importanti, preferenze emerse, cose da ricordare.

## Ultima sessione
- Data: 2026-06-01
- Argomenti: progettazione WhyJarv
```

### CONTEXT.md
```markdown
# CONTEXT.md — Stato Attuale

## Progetti in corso
- WhyJarv (questo) — in sviluppo
- WhyPost — automation content
- WhyCalendar — app macOS
- WhyCremisi — plugin VST3

## Priorità oggi
→ aggiornato ogni sessione da WhyJarv stesso

## Note veloci
→ cose urgenti che Edoardo ha detto di ricordare
```

### PROTOCOL.md
```markdown
# PROTOCOL.md — Regole di Sessione

1. All'avvio: leggi IDENTITY + SOUL + USER + MEMORY + CONTEXT
2. Durante la sessione: aggiorna CONTEXT.md se emergono priorità
3. Alla chiusura: scrivi log in memory/YYYY-MM-DD.md
4. Ogni settimana: consolida in MEMORY.md, rimuovi vecchie note
5. Non eseguire azioni esterne (email, messaggi) senza conferma vocale esplicita
```

---

## Avvio

```bash
# Un solo comando per avviare tutto
cd ~/Documents/WhyJarv && ./scripts/start.sh
```

`start.sh` avvia in ordine:
1. FastAPI server (background)
2. Wake word listener (background)
3. Menu bar app (foreground, macOS)

Il browser si apre automaticamente quando dici la wake phrase.

---

## Dipendenze

### Python
```
fastapi uvicorn websockets
openwakeword silero-vad sounddevice numpy
rumps
sqlite3 (stdlib)
```

### Node/React
```
react three @react-three/fiber @react-three/drei
typescript tailwindcss
```

---

## Configurazione (config.json)

```json
{
  "wake_phrase": "let's start whyjarv",
  "shutdown_phrase": "chiuditi whyjarv",
  "name": "WhyJarv",
  "voice_lang": "it-IT",
  "voice_name": "Federica",
  "port": 8080,
  "auto_open_browser": true
}
```

---

## Non incluso (YAGNI)

- GPU acceleration (non disponibile su Intel Mac Monterey)
- Cloud TTS (Apple nativa è già ottima)
- Mobile support
- Multi-utente
- Autenticazione

---

## Fasi di sviluppo (ordine suggerito)

1. Backend FastAPI + WebSocket + Claude CLI wrapper
2. Frontend React base + WebSocket connection
3. STT + TTS browser (Web Speech API)
4. Three.js UI (partendo da harsh-raj00/my-jarvis come base)
5. Wake word (openWakeWord)
6. Menu bar (rumps)
7. Boot sequence + polish UI
8. config.json + start.sh
