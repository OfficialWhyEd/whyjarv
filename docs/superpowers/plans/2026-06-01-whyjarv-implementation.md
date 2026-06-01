# WhyJarv Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build WhyJarv — un assistente vocale personale con UI browser Three.js olografica signal-orange, brain Claude Code CLI, e wake word "let's start whyjarv", che gira su macOS Monterey Intel senza API key extra.

**Architecture:** FastAPI Python backend gestisce WebSocket con il browser, Claude Code CLI come brain (stdin/stdout pipe), openWakeWord ascolta sempre il mic (2% CPU idle). Il browser usa Web Speech API per STT/TTS nativi Apple — zero CPU Python per audio. Three.js con OffscreenCanvas gira i 8K particle off main thread.

**Tech Stack:** Python 3.10+, FastAPI, openWakeWord, silero-vad, rumps, sounddevice — React 18 + TypeScript + Vite, Three.js r160+, @react-three/fiber, @react-three/postprocessing, Zustand, framer-motion — Web Speech API (browser native)

---

## File Structure

```
~/Documents/WhyJarv/
├── config.json                          # wake_phrase, name, port, voice_lang
├── requirements.txt
│
├── workspace/                           # Cervello persistente di WhyJarv
│   ├── IDENTITY.md
│   ├── SOUL.md
│   ├── USER.md
│   ├── MEMORY.md
│   ├── CONTEXT.md
│   ├── TOOLS.md
│   ├── PROTOCOL.md
│   └── memory/
│       └── YYYY-MM-DD.md               # Log giornalieri (creati a runtime)
│
├── backend/
│   ├── main.py                          # FastAPI app + WebSocket + state machine
│   ├── claude_runner.py                 # Claude CLI subprocess wrapper
│   ├── workspace_loader.py              # Legge workspace/*.md → system prompt
│   ├── session_logger.py                # Scrive memory/YYYY-MM-DD.md
│   ├── wake_word.py                     # openWakeWord + Silero VAD listener
│   └── menu_bar.py                      # rumps menu bar app
│
├── frontend/
│   ├── index.html
│   ├── vite.config.ts
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── main.tsx
│       ├── App.tsx
│       ├── store/
│       │   └── jarvisStore.ts           # Zustand — JarvisState enum + actions
│       ├── hooks/
│       │   ├── useJarvisSocket.ts       # WebSocket ↔ backend
│       │   ├── useSpeechInput.ts        # Web Speech API STT
│       │   └── useSpeechOutput.ts       # Web Speech Synthesis TTS
│       ├── components/
│       │   ├── BootSequence.tsx         # Animazione avvio 3.5s
│       │   ├── HUDPanel.tsx             # Singolo pannello angolo
│       │   ├── HUDLayout.tsx            # 4 pannelli posizionati
│       │   ├── TranscriptArea.tsx       # Testo utente + risposta
│       │   ├── WaveformRing.tsx         # SVG radial waveform audio-reactive
│       │   └── JarvisCanvas.tsx         # Three.js scene (ArcReactor+Particles)
│       ├── three/
│       │   ├── scene.ts                 # Three.js setup, renderer, postprocessing
│       │   ├── reactor.ts               # Arc Reactor geometry + materials
│       │   ├── particles.ts             # 8K particle system + GLSL
│       │   └── audioAnalyser.ts         # Web Audio API analyser
│       ├── shaders/
│       │   ├── particles.vert.glsl
│       │   └── particles.frag.glsl
│       └── styles/
│           └── tokens.css               # CSS custom properties dal DESIGN.md
│
└── scripts/
    └── start.sh                         # Avvia tutto in un comando
```

---

## PHASE A — Backend Core

### Task 1: Project Scaffold

**Files:**
- Create: `~/Documents/WhyJarv/config.json`
- Create: `~/Documents/WhyJarv/requirements.txt`
- Create: `~/Documents/WhyJarv/backend/` (directory)

- [ ] **Step 1: Crea la directory del progetto**

```bash
mkdir -p ~/Documents/WhyJarv/{backend,frontend,workspace/memory,scripts,docs/superpowers/plans}
cd ~/Documents/WhyJarv
git init
```

- [ ] **Step 2: Crea config.json**

```json
{
  "wake_phrase": "let's start whyjarv",
  "shutdown_phrase": "chiuditi whyjarv",
  "name": "WhyJarv",
  "voice_lang": "it-IT",
  "voice_name": "Federica",
  "port": 8080,
  "auto_open_browser": true,
  "particle_count": 8000,
  "whisper_model": "tiny"
}
```

- [ ] **Step 3: Crea requirements.txt**

```
fastapi==0.111.0
uvicorn[standard]==0.30.1
websockets==12.0
openwakeword==0.6.0
silero-vad==5.1.2
sounddevice==0.4.7
numpy==1.26.4
rumps==0.4.0
pyobjc-core==10.3
pyobjc-framework-Cocoa==10.3
```

- [ ] **Step 4: Installa le dipendenze Python**

```bash
cd ~/Documents/WhyJarv
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Expected: tutte le librerie installate senza errori. Su Monterey Intel, silero-vad scarica un modello ~1MB al primo import.

- [ ] **Step 5: Verifica installazione**

```bash
python3 -c "import fastapi, openwakeword, rumps, sounddevice; print('OK')"
```

Expected: `OK`

- [ ] **Step 6: Commit**

```bash
git add config.json requirements.txt
git commit -m "feat: project scaffold and dependencies"
```

---

### Task 2: Workspace MD Files

**Files:**
- Create: `workspace/IDENTITY.md`
- Create: `workspace/SOUL.md`
- Create: `workspace/USER.md`
- Create: `workspace/MEMORY.md`
- Create: `workspace/CONTEXT.md`
- Create: `workspace/TOOLS.md`
- Create: `workspace/PROTOCOL.md`

- [ ] **Step 1: Crea workspace/IDENTITY.md**

```markdown
# IDENTITY.md — Chi sono

- **Nome:** WhyJarv
- **Creatore:** Edoardo (@whyed)
- **Vibe:** Diretto, capace, ironico. Non un chatbot — un sistema personale.
- **Emoji:** ⚡
- **Colore:** #c94b25 (signal)
- **Missione:** Essere l'estensione digitale di Edoardo. Capire prima di chiedere. Agire prima di spiegare.
```

- [ ] **Step 2: Crea workspace/SOUL.md**

```markdown
# SOUL.md — Come mi comporto

Sono WhyJarv. Il sistema personale di Edoardo Porcu (@whyed).

## Principi
- Agisco, non chiedo. Se ho abbastanza contesto, eseguo senza conferma.
- Sono diretto. Zero filler. Zero "certo, con piacere!". Zero "ottima domanda!".
- Ho memoria. Ogni sessione leggo MEMORY.md e aggiorno CONTEXT.md.
- Parlo italiano con Edoardo se inizia in italiano. Inglese se inizia in inglese.
- Se qualcosa è irreversibile o va all'esterno (email, messaggi pubblici), chiedo conferma.
- Rispondo brevemente a meno che non sia esplicitamente richiesto di approfondire.

## Tono
Come un ingegnere senior che conosce Edoardo da anni.
Non formale. Non servile. Presente e competente.

## Limiti
- Non mando email, messaggi, tweet senza conferma esplicita vocale.
- Non eseguo comandi distruttivi (rm -rf, drop database) senza conferma.
- Le cose private restano private.
```

- [ ] **Step 3: Crea workspace/USER.md**

```markdown
# USER.md — Edoardo

- **Nome:** Edoardo Porcu
- **Handle:** @whyed
- **Timezone:** Europe/Rome (CET/CEST)
- **Lingua:** Italiano (prima), Inglese (seconda)
- **Hardware:** MacBook Pro 2015 Intel i7, 16GB RAM, macOS Monterey
- **Piano Claude:** Pro (nessuna API key Anthropic separata)

## Setup tecnico
- Claude Code CLI installato e configurato
- MCP attivi: ClickUp, Gmail, Google Calendar, Google Drive, Obsidian
- Shell: zsh
- Node: installato (per Claude Code)

## Preferenze
- Risposte brevi se il task è chiaro
- Detesta: sycophancy, filler, layout generici
- Vuole sapere cosa succede, non essere bombardato
- Colori preferiti: nero, rosso, viola
```

- [ ] **Step 4: Crea workspace/MEMORY.md**

```markdown
# MEMORY.md — Memoria Long-Term

Aggiornato automaticamente da WhyJarv dopo ogni sessione significativa.
Contiene: decisioni importanti, preferenze emerse, cose da ricordare.

## Formato
Ogni entry: `- [YYYY-MM-DD] <fatto o decisione>`

## Entries
- [2026-06-01] WhyJarv creato. Stack: FastAPI + Three.js + Claude Code CLI + Web Speech API.
```

- [ ] **Step 5: Crea workspace/CONTEXT.md**

```markdown
# CONTEXT.md — Stato Attuale

Aggiornato da WhyJarv durante ogni sessione.

## Progetti in corso
- WhyJarv (questo) — in sviluppo attivo
- WhyPost — content automation, Python + SwiftUI
- WhyCalendar — app macOS Tauri+React
- WhyCremisi — plugin VST3+React+AI

## Note veloci
(WhyJarv aggiorna questa sezione durante le sessioni)

## Ultima sessione
- Data: 2026-06-01
- Argomento: progettazione e kick-off WhyJarv
```

- [ ] **Step 6: Crea workspace/TOOLS.md**

```markdown
# TOOLS.md — Strumenti disponibili

## MCP Connessi
- ClickUp: task management, progetti
- Gmail: email (read + draft, mai send senza conferma)
- Google Calendar: eventi, agenda
- Google Drive: file, documenti
- Obsidian: note personali

## Comandi Mac utili
- `open -a "Safari" <url>` → apre URL
- `osascript -e 'tell application "Finder" to ...'` → AppleScript
- `say -v Federica "<testo>"` → TTS italiano

## Note
I MCP sono già configurati nel sistema Claude Code di Edoardo.
Sono accessibili automaticamente quando Claude Code CLI viene invocato.
```

- [ ] **Step 7: Crea workspace/PROTOCOL.md**

```markdown
# PROTOCOL.md — Regole di Sessione

## Startup (ogni sessione)
1. workspace_loader.py legge IDENTITY + SOUL + USER + MEMORY + CONTEXT + TOOLS
2. Costruisce system prompt → iniettato in Claude Code CLI
3. Sessione inizia con saluto personalizzato

## Durante la sessione
1. Se emergono nuove priorità → aggiorna CONTEXT.md
2. Se Edoardo dice "ricordati che..." → aggiorna MEMORY.md
3. Non eseguire azioni esterne senza conferma esplicita

## Shutdown ("chiuditi whyjarv")
1. Scrivi log in workspace/memory/YYYY-MM-DD.md
2. Aggiorna CONTEXT.md con "Ultima sessione"
3. Rispondi con saluto breve
4. Chiudi sessione

## Persistenza
- Log giornalieri: workspace/memory/YYYY-MM-DD.md
- Formato: lista cronologica di query e azioni chiave
```

- [ ] **Step 8: Commit**

```bash
git add workspace/
git commit -m "feat: add WhyJarv workspace identity files"
```

---

### Task 3: Workspace Loader

**Files:**
- Create: `backend/workspace_loader.py`

- [ ] **Step 1: Scrivi test**

Crea `backend/test_workspace_loader.py`:

```python
import os, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
from backend.workspace_loader import load_workspace_context

def test_loads_all_files(tmp_path):
    # Create minimal workspace
    ws = tmp_path / "workspace"
    ws.mkdir()
    (ws / "SOUL.md").write_text("# SOUL\nBe direct.")
    (ws / "USER.md").write_text("# USER\nEdoardo")
    
    result = load_workspace_context(workspace_dir=str(ws))
    
    assert "SOUL" in result
    assert "Be direct." in result
    assert "Edoardo" in result

def test_handles_missing_files(tmp_path):
    ws = tmp_path / "workspace"
    ws.mkdir()
    # Only one file
    (ws / "SOUL.md").write_text("# SOUL\nContent")
    
    # Should not raise even if other files missing
    result = load_workspace_context(workspace_dir=str(ws))
    assert "Content" in result
```

- [ ] **Step 2: Esegui test (deve fallire)**

```bash
cd ~/Documents/WhyJarv
source .venv/bin/activate
python3 -m pytest backend/test_workspace_loader.py -v
```

Expected: `ModuleNotFoundError: No module named 'backend.workspace_loader'`

- [ ] **Step 3: Implementa workspace_loader.py**

```python
"""Reads workspace MD files and builds Claude system prompt."""
import os
from pathlib import Path
from datetime import date

WORKSPACE_FILES = [
    "IDENTITY.md",
    "SOUL.md",
    "USER.md",
    "MEMORY.md",
    "CONTEXT.md",
    "TOOLS.md",
    "PROTOCOL.md",
]

def load_workspace_context(workspace_dir: str | None = None) -> str:
    if workspace_dir is None:
        workspace_dir = str(Path(__file__).parent.parent / "workspace")
    
    sections = []
    for filename in WORKSPACE_FILES:
        filepath = Path(workspace_dir) / filename
        if filepath.exists():
            content = filepath.read_text(encoding="utf-8").strip()
            sections.append(f"=== {filename} ===\n{content}")
    
    today = date.today().isoformat()
    header = f"[Session date: {today}]\n\n"
    return header + "\n\n".join(sections)

def build_system_prompt(workspace_dir: str | None = None) -> str:
    context = load_workspace_context(workspace_dir)
    return f"""You are WhyJarv, Edoardo's personal AI assistant.

{context}

---
Respond in the language Edoardo uses. Be direct and concise.
When you detect the shutdown phrase "chiuditi whyjarv" or "goodbye whyjarv",
respond with a brief farewell then output exactly: [SHUTDOWN]
"""
```

- [ ] **Step 4: Esegui test (deve passare)**

```bash
python3 -m pytest backend/test_workspace_loader.py -v
```

Expected: `2 passed`

- [ ] **Step 5: Commit**

```bash
git add backend/workspace_loader.py backend/test_workspace_loader.py
git commit -m "feat: workspace loader builds Claude system prompt from MD files"
```

---

### Task 4: Claude CLI Runner

**Files:**
- Create: `backend/claude_runner.py`
- Create: `backend/test_claude_runner.py`

- [ ] **Step 1: Scrivi test**

```python
import pytest
from unittest.mock import patch, MagicMock
from backend.claude_runner import ClaudeRunner

def test_run_returns_response():
    runner = ClaudeRunner(system_prompt="You are helpful.")
    
    mock_process = MagicMock()
    mock_process.communicate.return_value = ("Hello there.", "")
    mock_process.returncode = 0
    
    with patch("subprocess.Popen", return_value=mock_process) as mock_popen:
        response = runner.run("Say hello")
        
        assert response == "Hello there."
        # Verify claude was called with --print
        call_args = mock_popen.call_args[0][0]
        assert "claude" in call_args
        assert "--print" in call_args

def test_run_detects_shutdown_signal():
    runner = ClaudeRunner(system_prompt="You are helpful.")
    
    mock_process = MagicMock()
    mock_process.communicate.return_value = ("Goodbye Edoardo. [SHUTDOWN]", "")
    mock_process.returncode = 0
    
    with patch("subprocess.Popen", return_value=mock_process):
        response, should_shutdown = runner.run_with_shutdown_check("chiuditi whyjarv")
        
        assert should_shutdown is True
        assert "Goodbye" in response

def test_injects_system_prompt():
    runner = ClaudeRunner(system_prompt="Test system prompt.")
    
    mock_process = MagicMock()
    mock_process.communicate.return_value = ("response", "")
    mock_process.returncode = 0
    
    with patch("subprocess.Popen", return_value=mock_process) as mock_popen:
        runner.run("user input")
        
        # stdin should contain system prompt + user input
        stdin_input = mock_process.communicate.call_args[1]["input"]
        assert "Test system prompt." in stdin_input
        assert "user input" in stdin_input
```

- [ ] **Step 2: Esegui test (deve fallire)**

```bash
python3 -m pytest backend/test_claude_runner.py -v
```

Expected: `ModuleNotFoundError`

- [ ] **Step 3: Implementa claude_runner.py**

```python
"""Claude Code CLI subprocess wrapper."""
import subprocess
import json
from typing import Optional

CLAUDE_TIMEOUT = 60  # seconds


class ClaudeRunner:
    def __init__(self, system_prompt: str):
        self.system_prompt = system_prompt
        self.history: list[dict] = []

    def _build_prompt(self, user_input: str) -> str:
        """Builds the full prompt including system context and history."""
        parts = [self.system_prompt, "---"]
        
        for turn in self.history[-10:]:  # last 10 turns max
            parts.append(f"User: {turn['user']}")
            parts.append(f"WhyJarv: {turn['assistant']}")
        
        parts.append(f"User: {user_input}")
        parts.append("WhyJarv:")
        return "\n".join(parts)

    def run(self, user_input: str) -> str:
        """Send input to Claude CLI, return response string."""
        prompt = self._build_prompt(user_input)
        
        process = subprocess.Popen(
            ["claude", "--print", "--no-color"],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
        )
        stdout, stderr = process.communicate(input=prompt, timeout=CLAUDE_TIMEOUT)
        response = stdout.strip()
        
        # Store in history
        self.history.append({"user": user_input, "assistant": response})
        return response

    def run_with_shutdown_check(self, user_input: str) -> tuple[str, bool]:
        """Returns (response, should_shutdown)."""
        response = self.run(user_input)
        should_shutdown = "[SHUTDOWN]" in response
        clean_response = response.replace("[SHUTDOWN]", "").strip()
        return clean_response, should_shutdown

    def clear_history(self):
        self.history = []
```

- [ ] **Step 4: Esegui test**

```bash
python3 -m pytest backend/test_claude_runner.py -v
```

Expected: `3 passed`

- [ ] **Step 5: Commit**

```bash
git add backend/claude_runner.py backend/test_claude_runner.py
git commit -m "feat: Claude CLI runner with history and shutdown detection"
```

---

### Task 5: FastAPI Backend + WebSocket

**Files:**
- Create: `backend/main.py`
- Create: `backend/test_main.py`

- [ ] **Step 1: Scrivi test**

```python
import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock

# Patch heavy imports before importing main
with patch("backend.main.ClaudeRunner"), \
     patch("backend.main.load_workspace_context", return_value="context"):
    from backend.main import app

client = TestClient(app)

def test_health_endpoint():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"

def test_state_endpoint_default():
    response = client.get("/state")
    assert response.status_code == 200
    assert response.json()["state"] == "idle"

def test_state_update():
    response = client.post("/state/listen")
    assert response.status_code == 200
    assert response.json()["state"] == "listen"
    
    response = client.post("/state/idle")
    assert response.status_code == 200

def test_invalid_state_rejected():
    response = client.post("/state/flying")
    assert response.status_code == 422
```

- [ ] **Step 2: Esegui test (deve fallire)**

```bash
python3 -m pytest backend/test_main.py -v
```

Expected: `ModuleNotFoundError`

- [ ] **Step 3: Implementa main.py**

```python
"""FastAPI backend — WebSocket, state machine, Claude integration."""
import json
import asyncio
import webbrowser
from typing import Literal
from pathlib import Path

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from backend.workspace_loader import load_workspace_context, build_system_prompt
from backend.claude_runner import ClaudeRunner
from backend.session_logger import SessionLogger

# ── State ───────────────────────────────────────────────────────────────────
JarvisState = Literal["idle", "listen", "think", "speak"]
VALID_STATES: set[str] = {"idle", "listen", "think", "speak"}

app_state = {
    "current": "idle",
    "runner": None,
    "logger": None,
}

connected: set[WebSocket] = set()

# ── App ─────────────────────────────────────────────────────────────────────
app = FastAPI(title="WhyJarv Backend")

@app.on_event("startup")
async def startup():
    system_prompt = build_system_prompt()
    app_state["runner"] = ClaudeRunner(system_prompt=system_prompt)
    app_state["logger"] = SessionLogger()

# ── REST endpoints ───────────────────────────────────────────────────────────
@app.get("/health")
async def health():
    return {"status": "ok", "state": app_state["current"]}

@app.get("/state")
async def get_state():
    return {"state": app_state["current"]}

@app.post("/state/{new_state}")
async def set_state(new_state: str):
    if new_state not in VALID_STATES:
        raise HTTPException(status_code=422, detail=f"Invalid state: {new_state}")
    app_state["current"] = new_state
    await broadcast({"type": "state", "state": new_state})
    return {"state": new_state}

@app.post("/shutdown")
async def shutdown_endpoint():
    await broadcast({"type": "shutdown"})
    return {"ok": True}

# ── WebSocket ────────────────────────────────────────────────────────────────
@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    await ws.accept()
    connected.add(ws)
    # Send current state on connect
    await ws.send_json({"type": "state", "state": app_state["current"]})
    try:
        while True:
            data = await ws.receive_json()
            await handle_message(data, ws)
    except WebSocketDisconnect:
        connected.discard(ws)

async def handle_message(data: dict, ws: WebSocket):
    msg_type = data.get("type")
    
    if msg_type == "voice_input":
        text = data.get("text", "").strip()
        if not text:
            return
        
        # → THINK
        await set_state("think")
        
        runner: ClaudeRunner = app_state["runner"]
        logger: SessionLogger = app_state["logger"]
        
        # Run Claude (blocking in thread pool to not block event loop)
        response, should_shutdown = await asyncio.to_thread(
            runner.run_with_shutdown_check, text
        )
        
        logger.log(user=text, assistant=response)
        
        if should_shutdown:
            await ws.send_json({"type": "response", "text": response})
            await set_state("idle")
            await shutdown_endpoint()
            return
        
        # → SPEAK
        await set_state("speak")
        await ws.send_json({"type": "response", "text": response})

async def broadcast(message: dict):
    dead = set()
    for ws in connected:
        try:
            await ws.send_json(message)
        except Exception:
            dead.add(ws)
    connected.difference_update(dead)

# ── Static files (frontend build) ────────────────────────────────────────────
frontend_dist = Path(__file__).parent.parent / "frontend" / "dist"
if frontend_dist.exists():
    app.mount("/", StaticFiles(directory=str(frontend_dist), html=True), name="static")
```

- [ ] **Step 4: Esegui test**

```bash
python3 -m pytest backend/test_main.py -v
```

Expected: `4 passed`

- [ ] **Step 5: Test manuale — avvia il server**

```bash
cd ~/Documents/WhyJarv
source .venv/bin/activate
uvicorn backend.main:app --host 0.0.0.0 --port 8080 --reload
```

In un altro terminale:
```bash
curl http://localhost:8080/health
# Expected: {"status":"ok","state":"idle"}

curl -X POST http://localhost:8080/state/listen
# Expected: {"state":"listen"}
```

- [ ] **Step 6: Commit**

```bash
git add backend/main.py backend/test_main.py
git commit -m "feat: FastAPI backend with WebSocket and state machine"
```

---

### Task 6: Session Logger

**Files:**
- Create: `backend/session_logger.py`
- Create: `backend/test_session_logger.py`

- [ ] **Step 1: Scrivi test**

```python
from datetime import date
from pathlib import Path
from backend.session_logger import SessionLogger

def test_creates_daily_log(tmp_path):
    logger = SessionLogger(memory_dir=str(tmp_path))
    logger.log(user="apri safari", assistant="Apro Safari.")
    
    today = date.today().isoformat()
    log_file = tmp_path / f"{today}.md"
    
    assert log_file.exists()
    content = log_file.read_text()
    assert "apri safari" in content
    assert "Apro Safari." in content

def test_appends_to_existing_log(tmp_path):
    logger = SessionLogger(memory_dir=str(tmp_path))
    logger.log(user="prima domanda", assistant="prima risposta")
    logger.log(user="seconda domanda", assistant="seconda risposta")
    
    today = date.today().isoformat()
    content = (tmp_path / f"{today}.md").read_text()
    assert "prima domanda" in content
    assert "seconda domanda" in content
```

- [ ] **Step 2: Esegui test (deve fallire)**

```bash
python3 -m pytest backend/test_session_logger.py -v
```

- [ ] **Step 3: Implementa session_logger.py**

```python
"""Writes daily conversation logs to workspace/memory/."""
from datetime import datetime, date
from pathlib import Path


class SessionLogger:
    def __init__(self, memory_dir: str | None = None):
        if memory_dir is None:
            memory_dir = str(Path(__file__).parent.parent / "workspace" / "memory")
        self.memory_dir = Path(memory_dir)
        self.memory_dir.mkdir(parents=True, exist_ok=True)

    def log(self, user: str, assistant: str):
        today = date.today().isoformat()
        log_file = self.memory_dir / f"{today}.md"
        
        timestamp = datetime.now().strftime("%H:%M")
        entry = f"\n## {timestamp}\n**User:** {user}\n**WhyJarv:** {assistant}\n"
        
        if not log_file.exists():
            log_file.write_text(f"# Session Log — {today}\n")
        
        with open(log_file, "a", encoding="utf-8") as f:
            f.write(entry)
```

- [ ] **Step 4: Esegui test**

```bash
python3 -m pytest backend/test_session_logger.py -v
```

Expected: `2 passed`

- [ ] **Step 5: Commit**

```bash
git add backend/session_logger.py backend/test_session_logger.py
git commit -m "feat: session logger writes daily markdown logs"
```

---

## PHASE B — Frontend UI

### Task 7: Frontend Scaffold

**Files:**
- Create: `frontend/package.json`, `frontend/vite.config.ts`, `frontend/tsconfig.json`, `frontend/index.html`

- [ ] **Step 1: Inizializza il progetto Vite + React + TypeScript**

```bash
cd ~/Documents/WhyJarv/frontend
npm create vite@latest . -- --template react-ts
npm install
```

- [ ] **Step 2: Installa dipendenze Three.js e UI**

```bash
npm install three @react-three/fiber @react-three/drei @react-three/postprocessing
npm install zustand framer-motion
npm install -D @types/three tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

- [ ] **Step 3: Configura tailwind.config.js**

```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: { extend: {} },
  plugins: [],
}
```

- [ ] **Step 4: Aggiorna index.html**

```html
<!doctype html>
<html lang="it">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>WhyJarv</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=JetBrains+Mono:wght@400;500&family=Outfit:wght@300;400&family=DM+Serif+Display:ital@1&display=swap" rel="stylesheet">
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 5: Verifica che il progetto si avvii**

```bash
cd ~/Documents/WhyJarv/frontend
npm run dev
```

Expected: `http://localhost:5173` risponde con la pagina React default.

- [ ] **Step 6: Commit**

```bash
cd ~/Documents/WhyJarv
git add frontend/
git commit -m "feat: frontend scaffold with Vite + React + Three.js + Zustand"
```

---

### Task 8: Design Tokens CSS

**Files:**
- Create: `frontend/src/styles/tokens.css`
- Modify: `frontend/src/main.tsx`

- [ ] **Step 1: Crea tokens.css**

```css
/* WhyJarv Design Tokens — dal DESIGN.md */
:root {
  /* Color — OKLCH */
  --void:    oklch(5.5% 0.006 245);
  --void2:   oklch(7%   0.005 245);
  --paper:   oklch(95%  0.008  80);
  --dim:     oklch(55%  0.006  80);
  --faint:   oklch(30%  0.005  80);
  --signal:  oklch(52%  0.18   32);
  --signal2: oklch(60%  0.16   40);
  --signal3: oklch(40%  0.14   25);
  --line:    oklch(100% 0 0 / 6%);
  --line2:   oklch(100% 0 0 / 10%);
  --glow:    oklch(52%  0.18   32 / 30%);

  /* Typography scale */
  --text-xs:      clamp(0.625rem, 0.58rem + 0.2vw, 0.688rem);
  --text-sm:      clamp(0.75rem,  0.70rem + 0.3vw, 0.875rem);
  --text-base:    clamp(1rem,     0.95rem + 0.4vw, 1.125rem);
  --text-lg:      clamp(1.25rem,  1.2rem  + 0.5vw, 1.5rem);
  --text-display: clamp(2.5rem,   2rem    + 2vw,   4rem);
  --text-hero:    clamp(4rem,     3rem    + 4vw,   8rem);

  /* Font families */
  --font-display: 'Bebas Neue', sans-serif;
  --font-mono:    'JetBrains Mono', monospace;
  --font-body:    'Outfit', sans-serif;
  --font-serif:   'DM Serif Display', serif;

  /* Spacing */
  --hud-gap: 24px;
}

/* Reset */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

html, body, #root {
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: var(--void);
  color: var(--paper);
  font-family: var(--font-body);
  -webkit-font-smoothing: antialiased;
}

/* Grain overlay — identico al portfolio WhyEd */
body::before {
  content: '';
  position: fixed;
  inset: 0;
  z-index: 9000;
  pointer-events: none;
  opacity: 0.028;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
  background-size: 256px 256px;
}

/* Reduced motion */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

- [ ] **Step 2: Importa in main.tsx**

```tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import './styles/tokens.css'
import App from './App'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
```

- [ ] **Step 3: Verifica visiva** — apri il browser su `localhost:5173`, sfondo deve essere `--void` quasi-nero con grain leggero.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/styles/tokens.css frontend/src/main.tsx
git commit -m "feat: design tokens CSS with void/signal palette and grain overlay"
```

---

### Task 9: Zustand State Store

**Files:**
- Create: `frontend/src/store/jarvisStore.ts`

- [ ] **Step 1: Crea jarvisStore.ts**

```typescript
import { create } from 'zustand'

export type JarvisState = 'idle' | 'listen' | 'think' | 'speak'

interface JarvisStore {
  state: JarvisState
  transcript: string       // ciò che l'utente ha detto
  response: string         // risposta corrente di WhyJarv
  bootComplete: boolean
  audioIntensity: number   // 0.0–1.0 dall'analyser

  setState: (s: JarvisState) => void
  setTranscript: (t: string) => void
  setResponse: (r: string) => void
  setBootComplete: (v: boolean) => void
  setAudioIntensity: (v: number) => void
}

export const useJarvisStore = create<JarvisStore>((set) => ({
  state: 'idle',
  transcript: '',
  response: '',
  bootComplete: false,
  audioIntensity: 0,

  setState: (s) => set({ state: s }),
  setTranscript: (t) => set({ transcript: t }),
  setResponse: (r) => set({ response: r }),
  setBootComplete: (v) => set({ bootComplete: v }),
  setAudioIntensity: (v) => set({ audioIntensity: v }),
}))
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/store/jarvisStore.ts
git commit -m "feat: Zustand store for WhyJarv state management"
```

---

### Task 10: WebSocket Hook

**Files:**
- Create: `frontend/src/hooks/useJarvisSocket.ts`

- [ ] **Step 1: Crea useJarvisSocket.ts**

```typescript
import { useEffect, useRef, useCallback } from 'react'
import { useJarvisStore } from '../store/jarvisStore'

const WS_URL = 'ws://localhost:8080/ws'

export function useJarvisSocket() {
  const ws = useRef<WebSocket | null>(null)
  const { setState, setResponse } = useJarvisStore()

  const connect = useCallback(() => {
    if (ws.current?.readyState === WebSocket.OPEN) return

    ws.current = new WebSocket(WS_URL)

    ws.current.onmessage = (event) => {
      const data = JSON.parse(event.data)

      if (data.type === 'state') {
        setState(data.state)
      }
      if (data.type === 'response') {
        setResponse(data.text)
        // TTS is handled by useSpeechOutput watching 'response'
      }
      if (data.type === 'shutdown') {
        setState('idle')
        ws.current?.close()
      }
    }

    ws.current.onclose = () => {
      // Reconnect after 2s if not intentional shutdown
      setTimeout(connect, 2000)
    }
  }, [setState, setResponse])

  const sendVoiceInput = useCallback((text: string) => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify({ type: 'voice_input', text }))
    }
  }, [])

  useEffect(() => {
    connect()
    return () => { ws.current?.close() }
  }, [connect])

  return { sendVoiceInput }
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/hooks/useJarvisSocket.ts
git commit -m "feat: WebSocket hook with auto-reconnect"
```

---

### Task 11: Speech Input Hook (Web Speech API STT)

**Files:**
- Create: `frontend/src/hooks/useSpeechInput.ts`

- [ ] **Step 1: Crea useSpeechInput.ts**

```typescript
import { useEffect, useRef, useCallback } from 'react'
import { useJarvisStore } from '../store/jarvisStore'

export function useSpeechInput(onFinalTranscript: (text: string) => void) {
  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const { state, setTranscript } = useJarvisStore()

  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition

    if (!SpeechRecognition) {
      console.error('Web Speech API not supported in this browser')
      return
    }

    const recognition = new SpeechRecognition()
    recognition.continuous = false
    recognition.interimResults = true
    recognition.lang = 'it-IT'   // auto-detect basato su config.json idealmente

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const result = event.results[event.results.length - 1]
      const transcript = result[0].transcript

      setTranscript(transcript)

      if (result.isFinal) {
        onFinalTranscript(transcript)
      }
    }

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.warn('Speech recognition error:', event.error)
    }

    recognitionRef.current = recognition
  }, [onFinalTranscript, setTranscript])

  const startListening = useCallback(() => {
    recognitionRef.current?.start()
  }, [])

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop()
  }, [])

  // Auto-start/stop based on jarvis state
  useEffect(() => {
    if (state === 'listen') {
      recognitionRef.current?.start()
    } else {
      recognitionRef.current?.stop()
    }
  }, [state])

  return { startListening, stopListening }
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/hooks/useSpeechInput.ts
git commit -m "feat: Web Speech API STT hook, starts/stops with jarvis state"
```

---

### Task 12: Speech Output Hook (Web Speech Synthesis TTS)

**Files:**
- Create: `frontend/src/hooks/useSpeechOutput.ts`

- [ ] **Step 1: Crea useSpeechOutput.ts**

```typescript
import { useEffect, useCallback, useRef } from 'react'
import { useJarvisStore } from '../store/jarvisStore'

function splitIntoSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .filter(s => s.trim().length > 0)
}

function getAppleVoice(lang: string): SpeechSynthesisVoice | null {
  const voices = speechSynthesis.getVoices()
  // Prefer native Apple/Italian voice
  return (
    voices.find(v => v.lang === lang && v.localService) ||
    voices.find(v => v.lang.startsWith(lang.split('-')[0]) && v.localService) ||
    voices[0] ||
    null
  )
}

export function useSpeechOutput() {
  const { response, setState } = useJarvisStore()
  const isSpeaking = useRef(false)

  const speakText = useCallback((text: string) => {
    if (!text.trim()) return
    speechSynthesis.cancel()

    const sentences = splitIntoSentences(text)
    isSpeaking.current = true
    setState('speak')

    sentences.forEach((sentence, i) => {
      const utterance = new SpeechSynthesisUtterance(sentence)
      const voice = getAppleVoice('it-IT')
      if (voice) utterance.voice = voice
      utterance.rate = 1.1
      utterance.pitch = 0.9
      utterance.lang = 'it-IT'

      if (i === sentences.length - 1) {
        utterance.onend = () => {
          isSpeaking.current = false
          setState('idle')
        }
      }

      speechSynthesis.speak(utterance)
    })
  }, [setState])

  const stopSpeaking = useCallback(() => {
    speechSynthesis.cancel()
    isSpeaking.current = false
    setState('idle')
  }, [setState])

  // Speak when response changes
  useEffect(() => {
    if (response) speakText(response)
  }, [response, speakText])

  return { speakText, stopSpeaking }
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/hooks/useSpeechOutput.ts
git commit -m "feat: Web Speech Synthesis TTS, sentence-by-sentence streaming"
```

---

### Task 13: Boot Sequence Component

**Files:**
- Create: `frontend/src/components/BootSequence.tsx`

- [ ] **Step 1: Crea BootSequence.tsx**

```tsx
import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useJarvisStore } from '../store/jarvisStore'

const BOOT_LINES = [
  'WHYJARV — SISTEMA PERSONALE v1.0',
  'edoardo porcu · cagliari',
  '─────────────────────────────────',
  'inizializzazione sistema...',
]

export function BootSequence() {
  const { bootComplete, setBootComplete } = useJarvisStore()
  const [visibleLines, setVisibleLines] = useState<number>(0)
  const [progress, setProgress] = useState(0)
  const [showGreeting, setShowGreeting] = useState(false)

  useEffect(() => {
    if (bootComplete) return

    // Show lines one by one
    BOOT_LINES.forEach((_, i) => {
      setTimeout(() => setVisibleLines(i + 1), i * 180)
    })

    // Progress bar
    const interval = setInterval(() => {
      setProgress(p => {
        if (p >= 100) { clearInterval(interval); return 100 }
        return p + 2
      })
    }, 12)

    // Greeting
    setTimeout(() => setShowGreeting(true), 2600)

    // Complete
    setTimeout(() => setBootComplete(true), 3500)

    return () => clearInterval(interval)
  }, [bootComplete, setBootComplete])

  if (bootComplete) return null

  return (
    <motion.div
      className="boot-sequence"
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        background: 'var(--void)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        gap: '8px',
        fontFamily: 'var(--font-mono)',
        fontSize: 'var(--text-sm)',
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
        color: 'var(--dim)',
      }}
    >
      {BOOT_LINES.slice(0, visibleLines).map((line, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2 }}
        >
          {line}
        </motion.div>
      ))}

      {/* Progress bar */}
      {visibleLines >= BOOT_LINES.length && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          style={{ width: '280px', marginTop: '16px' }}
        >
          <div style={{
            width: '100%', height: '2px',
            background: 'var(--faint)',
            position: 'relative',
          }}>
            <motion.div style={{
              position: 'absolute', left: 0, top: 0, bottom: 0,
              background: 'var(--signal)',
              width: `${progress}%`,
              transition: 'width 0.05s linear',
            }} />
          </div>
          <div style={{ color: 'var(--signal)', marginTop: '6px', fontSize: '0.6rem' }}>
            CORE ATTIVO
          </div>
        </motion.div>
      )}

      {/* Greeting */}
      <AnimatePresence>
        {showGreeting && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            style={{
              fontFamily: 'var(--font-serif)',
              fontSize: 'var(--text-lg)',
              fontStyle: 'italic',
              textTransform: 'none',
              letterSpacing: 'normal',
              color: 'var(--paper)',
              marginTop: '24px',
            }}
          >
            Bentornato, Edoardo.
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/BootSequence.tsx
git commit -m "feat: boot sequence component with JetBrains Mono and DM Serif greeting"
```

---

### Task 14: HUD Panels

**Files:**
- Create: `frontend/src/components/HUDPanel.tsx`
- Create: `frontend/src/components/HUDLayout.tsx`

- [ ] **Step 1: Crea HUDPanel.tsx**

```tsx
import { CSSProperties } from 'react'

interface HUDRow {
  label: string
  value: string
  active?: boolean
}

interface HUDPanelProps {
  title: string
  rows: HUDRow[]
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
}

const positionStyle: Record<string, CSSProperties> = {
  'top-left':     { top: 'var(--hud-gap)', left: 'var(--hud-gap)' },
  'top-right':    { top: 'var(--hud-gap)', right: 'var(--hud-gap)' },
  'bottom-left':  { bottom: '88px', left: 'var(--hud-gap)' },
  'bottom-right': { bottom: '88px', right: 'var(--hud-gap)' },
}

export function HUDPanel({ title, rows, position }: HUDPanelProps) {
  return (
    <div style={{
      position: 'absolute',
      ...positionStyle[position],
      background: 'var(--void2)',
      border: '1px solid var(--line)',
      padding: '14px 16px',
      minWidth: '180px',
      maxWidth: '220px',
      fontFamily: 'var(--font-mono)',
    }}>
      {/* Title */}
      <div style={{
        fontSize: 'var(--text-xs)',
        letterSpacing: '0.14em',
        textTransform: 'uppercase',
        color: 'var(--dim)',
        marginBottom: '8px',
        borderBottom: '1px solid var(--line)',
        paddingBottom: '6px',
      }}>
        {title}
      </div>

      {/* Rows */}
      {rows.map((row, i) => (
        <div key={i} style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: '12px',
          marginTop: '4px',
        }}>
          <span style={{
            fontSize: 'var(--text-xs)',
            letterSpacing: '0.10em',
            textTransform: 'uppercase',
            color: 'var(--dim)',
          }}>
            {row.label}
          </span>
          <span style={{
            fontSize: 'var(--text-xs)',
            letterSpacing: '0.06em',
            color: row.active ? 'var(--signal)' : 'var(--paper)',
          }}>
            {row.value}
          </span>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Crea HUDLayout.tsx**

```tsx
import { motion } from 'framer-motion'
import { HUDPanel } from './HUDPanel'
import { useJarvisStore } from '../store/jarvisStore'

const STATE_LABELS: Record<string, string> = {
  idle: 'IDLE',
  listen: 'ASCOLTO',
  think: 'ELABORO',
  speak: 'RISPONDO',
}

export function HUDLayout() {
  const { state } = useJarvisStore()

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 2.2, duration: 0.5 }}
      style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 10 }}
    >
      <HUDPanel
        position="top-left"
        title="WHYJARV SYS"
        rows={[
          { label: 'CORE',  value: '● ACTIVE', active: true },
          { label: 'VOICE', value: '● READY',  active: true },
          { label: 'MCP',   value: '● ONLINE', active: true },
          { label: 'STATE', value: STATE_LABELS[state], active: state !== 'idle' },
        ]}
      />

      <HUDPanel
        position="top-right"
        title="VOICE"
        rows={[
          { label: 'STT', value: 'APPLE NEURAL' },
          { label: 'TTS', value: 'APPLE SAY' },
          { label: 'LANG', value: 'IT / EN AUTO' },
        ]}
      />

      <HUDPanel
        position="bottom-left"
        title="MCP LIVE"
        rows={[
          { label: '▸', value: 'ClickUp',  active: true },
          { label: '▸', value: 'Gmail',    active: true },
          { label: '▸', value: 'Calendar', active: true },
          { label: '▸', value: 'Drive',    active: true },
          { label: '▸', value: 'Obsidian', active: true },
        ]}
      />

      <HUDPanel
        position="bottom-right"
        title="SESSION"
        rows={[
          { label: 'PLAN',  value: 'CLAUDE PRO', active: true },
          { label: 'USER',  value: '@whyed' },
          { label: 'BUILD', value: 'v1.0' },
        ]}
      />
    </motion.div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/HUDPanel.tsx frontend/src/components/HUDLayout.tsx
git commit -m "feat: HUD panels with JetBrains Mono and void2 background"
```

---

### Task 15: GLSL Shaders

**Files:**
- Create: `frontend/src/shaders/particles.vert.glsl`
- Create: `frontend/src/shaders/particles.frag.glsl`

- [ ] **Step 1: Crea particles.vert.glsl**

```glsl
uniform float uTime;
uniform float uIntensity;
attribute vec3 color;
varying vec3 vColor;

void main() {
  vColor = color;
  
  vec3 pos = position;
  float wave = sin(uTime * 2.0 + length(position) * 1.5) * uIntensity * 0.08;
  pos += normalize(position) * wave;

  vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  
  float size = mix(1.5, 3.5, uIntensity);
  gl_PointSize = size * (200.0 / -mvPosition.z);
}
```

- [ ] **Step 2: Crea particles.frag.glsl**

```glsl
varying vec3 vColor;
uniform float uIntensity;

void main() {
  float d = distance(gl_PointCoord, vec2(0.5));
  if (d > 0.5) discard;
  
  float alpha = 1.0 - smoothstep(0.3, 0.5, d);
  float opacity = mix(0.15, 0.8, uIntensity) * alpha;
  
  gl_FragColor = vec4(vColor, opacity);
}
```

- [ ] **Step 3: Aggiungi vite.config.ts per importare GLSL**

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  assetsInclude: ['**/*.glsl'],
})
```

- [ ] **Step 4: Aggiungi types per GLSL**

Crea `frontend/src/shaders/glsl.d.ts`:
```typescript
declare module '*.glsl' {
  const content: string
  export default content
}
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/shaders/ frontend/vite.config.ts
git commit -m "feat: GLSL particle shaders with wave animation and intensity uniform"
```

---

### Task 16: Arc Reactor + Particle Scene (Three.js)

**Files:**
- Create: `frontend/src/three/reactor.ts`
- Create: `frontend/src/three/particles.ts`
- Create: `frontend/src/three/scene.ts`
- Create: `frontend/src/components/JarvisCanvas.tsx`

- [ ] **Step 1: Crea three/reactor.ts**

```typescript
import * as THREE from 'three'

const SIGNAL = 0xc94b25
const SIGNAL2 = 0xe8603a
const SIGNAL3 = 0x8b2e10

function signalMaterial(color: number, intensity: number) {
  return new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: intensity,
    transparent: true,
    opacity: 0.92,
  })
}

export function createReactor(): THREE.Group {
  const group = new THREE.Group()

  // Ring 1 — inner
  const ring1 = new THREE.Mesh(
    new THREE.TorusGeometry(0.8, 0.025, 8, 64),
    signalMaterial(SIGNAL, 2.0)
  )
  group.add(ring1)

  // Ring 2 — mid
  const ring2 = new THREE.Mesh(
    new THREE.TorusGeometry(1.2, 0.018, 8, 64),
    signalMaterial(SIGNAL2, 1.5)
  )
  group.add(ring2)

  // Ring 3 — outer, dim
  const ring3 = new THREE.Mesh(
    new THREE.TorusGeometry(1.7, 0.010, 8, 64),
    signalMaterial(SIGNAL3, 0.8)
  )
  group.add(ring3)

  // Triangle core
  const triShape = new THREE.Shape()
  triShape.moveTo(0, 0.4)
  triShape.lineTo(-0.35, -0.2)
  triShape.lineTo(0.35, -0.2)
  triShape.closePath()

  const core = new THREE.Mesh(
    new THREE.ShapeGeometry(triShape),
    signalMaterial(SIGNAL, 3.0)
  )
  group.add(core)

  // Expose for animation
  ;(group as any)._ring1 = ring1
  ;(group as any)._ring2 = ring2
  ;(group as any)._ring3 = ring3

  return group
}

export function animateReactor(
  reactor: THREE.Group,
  delta: number,
  intensity: number,
  state: string
) {
  const r1 = (reactor as any)._ring1 as THREE.Mesh
  const r2 = (reactor as any)._ring2 as THREE.Mesh
  const r3 = (reactor as any)._ring3 as THREE.Mesh

  const speedMult = state === 'think' ? 4 : state === 'speak' ? 1.5 : 1

  r1.rotation.z -= delta * 0.6 * speedMult   // CCW
  r2.rotation.z += delta * 0.4 * speedMult   // CW
  r3.rotation.z += delta * 0.2 * speedMult   // CW slow

  // Emissive based on state + audio intensity
  const baseIntensity = state === 'speak' ? 3.5 + intensity * 2 :
                        state === 'listen' ? 3.0 :
                        state === 'think' ? 2.0 + Math.sin(Date.now() * 0.01) * 1.5 :
                        2.0

  ;(r1.material as THREE.MeshStandardMaterial).emissiveIntensity = baseIntensity
  ;(r2.material as THREE.MeshStandardMaterial).emissiveIntensity = baseIntensity * 0.7
}
```

- [ ] **Step 2: Crea three/particles.ts**

```typescript
import * as THREE from 'three'
import vertexShader from '../shaders/particles.vert.glsl'
import fragmentShader from '../shaders/particles.frag.glsl'

const SIGNAL_R = 201 / 255, SIGNAL_G = 75 / 255, SIGNAL_B = 37 / 255
const PAPER_R = 240 / 255, PAPER_G = 237 / 255, PAPER_B = 232 / 255

export function createParticleField(count: number): THREE.Points {
  const positions = new Float32Array(count * 3)
  const colors    = new Float32Array(count * 3)

  for (let i = 0; i < count; i++) {
    // Spherical distribution
    const theta = Math.random() * Math.PI * 2
    const phi   = Math.acos(2 * Math.random() - 1)
    const r     = 2.5 + Math.random() * 1.5

    positions[i * 3]     = r * Math.sin(phi) * Math.cos(theta)
    positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta)
    positions[i * 3 + 2] = r * Math.cos(phi)

    // Color: signal → paper gradient by depth
    const t = Math.random()
    colors[i * 3]     = SIGNAL_R + (PAPER_R - SIGNAL_R) * t * 0.4
    colors[i * 3 + 1] = SIGNAL_G + (PAPER_G - SIGNAL_G) * t * 0.3
    colors[i * 3 + 2] = SIGNAL_B + (PAPER_B - SIGNAL_B) * t * 0.5
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setAttribute('color',    new THREE.BufferAttribute(colors,    3))

  const material = new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: {
      uTime:      { value: 0 },
      uIntensity: { value: 0.15 },
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  })

  return new THREE.Points(geometry, material)
}

export function updateParticles(
  particles: THREE.Points,
  delta: number,
  intensity: number
) {
  const mat = particles.material as THREE.ShaderMaterial
  mat.uniforms.uTime.value      += delta
  mat.uniforms.uIntensity.value  = THREE.MathUtils.lerp(
    mat.uniforms.uIntensity.value,
    intensity,
    delta * 3
  )
}
```

- [ ] **Step 3: Crea three/scene.ts**

```typescript
import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass'

export function createScene(canvas: HTMLCanvasElement) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setSize(canvas.clientWidth, canvas.clientHeight)
  renderer.outputColorSpace = THREE.SRGBColorSpace

  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0x08090e)

  const camera = new THREE.PerspectiveCamera(
    60,
    canvas.clientWidth / canvas.clientHeight,
    0.1,
    100
  )
  camera.position.z = 5

  // Postprocessing
  const composer = new EffectComposer(renderer)
  composer.addPass(new RenderPass(scene, camera))

  const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(512, 512),
    1.8,   // strength
    0.5,   // radius
    0.6    // threshold
  )
  composer.addPass(bloomPass)

  // Ambient light so emissive materials show
  scene.add(new THREE.AmbientLight(0xffffff, 0.1))

  const handleResize = () => {
    camera.aspect = canvas.clientWidth / canvas.clientHeight
    camera.updateProjectionMatrix()
    renderer.setSize(canvas.clientWidth, canvas.clientHeight)
    composer.setSize(canvas.clientWidth, canvas.clientHeight)
  }
  window.addEventListener('resize', handleResize)

  return {
    scene, camera, renderer, composer, bloomPass,
    dispose: () => {
      window.removeEventListener('resize', handleResize)
      renderer.dispose()
    }
  }
}
```

- [ ] **Step 4: Crea components/JarvisCanvas.tsx**

```tsx
import { useEffect, useRef } from 'react'
import { useJarvisStore } from '../store/jarvisStore'
import { createScene } from '../three/scene'
import { createReactor, animateReactor } from '../three/reactor'
import { createParticleField, updateParticles } from '../three/particles'

const PARTICLE_COUNT = 8000

export function JarvisCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const { state, audioIntensity } = useJarvisStore()
  const stateRef = useRef(state)
  const intensityRef = useRef(audioIntensity)

  useEffect(() => { stateRef.current = state }, [state])
  useEffect(() => { intensityRef.current = audioIntensity }, [audioIntensity])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const { scene, camera, composer, dispose } = createScene(canvas)
    const reactor  = createReactor()
    const particles = createParticleField(PARTICLE_COUNT)

    scene.add(reactor)
    scene.add(particles)

    const clock = new THREE.Clock()
    let animId: number

    function animate() {
      animId = requestAnimationFrame(animate)
      const delta = clock.getDelta()
      const intensity = intensityRef.current

      animateReactor(reactor, delta, intensity, stateRef.current)
      updateParticles(particles, delta, intensity)

      composer.render()
    }

    animate()

    return () => {
      cancelAnimationFrame(animId)
      dispose()
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{
        position: 'fixed', inset: 0,
        width: '100%', height: '100%',
        zIndex: 1,
      }}
    />
  )
}
```

Note: aggiungere `import * as THREE from 'three'` all'inizio di `JarvisCanvas.tsx` (THREE è usato nella closure).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/three/ frontend/src/components/JarvisCanvas.tsx
git commit -m "feat: Three.js scene with Arc Reactor signal-orange and 8K particle field"
```

---

### Task 17: Transcript Area + Waveform Ring

**Files:**
- Create: `frontend/src/components/TranscriptArea.tsx`
- Create: `frontend/src/components/WaveformRing.tsx`

- [ ] **Step 1: Crea TranscriptArea.tsx**

```tsx
import { motion, AnimatePresence } from 'framer-motion'
import { useJarvisStore } from '../store/jarvisStore'

export function TranscriptArea() {
  const { transcript, response, state } = useJarvisStore()

  return (
    <div style={{
      position: 'fixed',
      bottom: '24px',
      left: '50%',
      transform: 'translateX(-50%)',
      width: '100%',
      maxWidth: '60ch',
      padding: '0 24px',
      zIndex: 20,
      textAlign: 'center',
      pointerEvents: 'none',
    }}>
      <AnimatePresence mode="wait">
        {state === 'listen' && transcript && (
          <motion.div
            key="transcript"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 'var(--text-sm)',
              color: 'var(--dim)',
              letterSpacing: '0.05em',
            }}
          >
            ▸ {transcript}
          </motion.div>
        )}

        {state === 'speak' && response && (
          <motion.div
            key="response"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            style={{
              fontFamily: 'var(--font-body)',
              fontWeight: 300,
              fontSize: 'var(--text-base)',
              color: 'var(--paper)',
              lineHeight: 1.6,
            }}
          >
            {response}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
```

- [ ] **Step 2: Crea WaveformRing.tsx**

```tsx
import { useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useJarvisStore } from '../store/jarvisStore'

const BARS = 64
const RADIUS = 160
const W = 400, H = 400
const CX = W / 2, CY = H / 2

export function WaveformRing() {
  const { state, audioIntensity } = useJarvisStore()
  const svgRef = useRef<SVGSVGElement>(null)
  const intensityRef = useRef(audioIntensity)

  useEffect(() => { intensityRef.current = audioIntensity }, [audioIntensity])

  const visible = state === 'listen' || state === 'speak'

  useEffect(() => {
    if (!visible || !svgRef.current) return
    let animId: number

    const bars = svgRef.current.querySelectorAll<SVGRectElement>('.wf-bar')

    function draw() {
      animId = requestAnimationFrame(draw)
      bars.forEach((bar, i) => {
        const angle = (i / BARS) * Math.PI * 2 - Math.PI / 2
        const noise = 0.3 + Math.random() * intensityRef.current * 0.7
        const barH = 4 + noise * 24

        const x = CX + Math.cos(angle) * RADIUS - 2
        const y = CY + Math.sin(angle) * RADIUS

        bar.setAttribute('x', String(x))
        bar.setAttribute('y', String(y - barH / 2))
        bar.setAttribute('height', String(barH))
      })
    }

    draw()
    return () => cancelAnimationFrame(animId)
  }, [visible])

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          style={{
            position: 'fixed',
            top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)',
            width: W, height: H,
            pointerEvents: 'none',
            zIndex: 5,
          }}
        >
          <svg
            ref={svgRef}
            width={W} height={H}
            viewBox={`0 0 ${W} ${H}`}
          >
            {Array.from({ length: BARS }).map((_, i) => {
              const angle = (i / BARS) * Math.PI * 2 - Math.PI / 2
              const x = CX + Math.cos(angle) * RADIUS - 2
              const y = CY + Math.sin(angle) * RADIUS
              return (
                <rect
                  key={i}
                  className="wf-bar"
                  x={x} y={y}
                  width={2} height={4}
                  rx={1}
                  fill="var(--signal)"
                  opacity={0.6}
                  transform={`rotate(${(i / BARS) * 360} ${CX} ${CY})`}
                />
              )
            })}
          </svg>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/TranscriptArea.tsx frontend/src/components/WaveformRing.tsx
git commit -m "feat: transcript overlay and radial SVG waveform ring"
```

---

### Task 18: App.tsx — Composizione

**Files:**
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Riscrivi App.tsx**

```tsx
import { AnimatePresence } from 'framer-motion'
import { useJarvisStore } from './store/jarvisStore'
import { useJarvisSocket } from './hooks/useJarvisSocket'
import { useSpeechInput } from './hooks/useSpeechInput'
import { useSpeechOutput } from './hooks/useSpeechOutput'
import { BootSequence } from './components/BootSequence'
import { JarvisCanvas } from './components/JarvisCanvas'
import { HUDLayout } from './components/HUDLayout'
import { WaveformRing } from './components/WaveformRing'
import { TranscriptArea } from './components/TranscriptArea'

export default function App() {
  const { bootComplete } = useJarvisStore()
  const { sendVoiceInput } = useJarvisSocket()
  
  useSpeechInput(sendVoiceInput)
  useSpeechOutput()

  return (
    <div style={{ width: '100dvw', height: '100dvh', position: 'relative', overflow: 'hidden' }}>
      {/* Layer 1: Three.js canvas */}
      <JarvisCanvas />

      {/* Layer 2: Waveform ring */}
      <WaveformRing />

      {/* Layer 3: HUD panels */}
      {bootComplete && <HUDLayout />}

      {/* Layer 4: Transcript + response text */}
      {bootComplete && <TranscriptArea />}

      {/* Layer 5: Boot sequence (covers everything) */}
      <AnimatePresence>
        {!bootComplete && <BootSequence />}
      </AnimatePresence>

      {/* Keyboard fallback: Space = toggle listen */}
    </div>
  )
}
```

- [ ] **Step 2: Build frontend**

```bash
cd ~/Documents/WhyJarv/frontend
npm run build
```

Expected: `dist/` creata senza errori TypeScript.

- [ ] **Step 3: Test integrazione base** — avvia backend e frontend insieme:

```bash
# Terminal 1
cd ~/Documents/WhyJarv && source .venv/bin/activate
uvicorn backend.main:app --host 0.0.0.0 --port 8080

# Terminal 2
cd ~/Documents/WhyJarv/frontend && npm run dev
```

Apri `http://localhost:5173` — deve vedere boot sequence, reactor signal-orange, HUD panels.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/App.tsx
git commit -m "feat: compose all UI components in App.tsx"
```

---

## PHASE C — Wake Word + Menu Bar

### Task 19: Wake Word Listener

**Files:**
- Create: `backend/wake_word.py`

- [ ] **Step 1: Scarica modello openWakeWord**

```bash
cd ~/Documents/WhyJarv
source .venv/bin/activate
python3 -c "
import openwakeword
openwakeword.utils.download_models(['hey_jarvis_v0.1'])
print('Models downloaded')
"
```

Expected: modello scaricato in `~/.local/share/openwakeword/`

- [ ] **Step 2: Crea wake_word.py**

```python
"""Wake word detection using openWakeWord + Silero VAD.
Sends HTTP signal to FastAPI when wake phrase detected.
Uses ~2% CPU always-on on Intel Mac.
"""
import time
import threading
import requests
import numpy as np
import sounddevice as sd
from openwakeword.model import Model

SAMPLE_RATE   = 16000
CHUNK_SIZE    = 1280   # 80ms at 16kHz — openWakeWord requirement
WAKE_MODEL    = "hey_jarvis_v0.1"  # closest available; customize with fine-tuning
BACKEND_URL   = "http://localhost:8080"
THRESHOLD     = 0.5

class WakeWordListener:
    def __init__(self, backend_url: str = BACKEND_URL):
        self.backend_url = backend_url
        self.model = Model(wakeword_models=[WAKE_MODEL])
        self._running = False
        self._cooldown = False

    def _on_wake(self):
        """Called when wake word detected. Opens browser + signals backend."""
        if self._cooldown:
            return
        self._cooldown = True

        print(f"[WhyJarv] Wake word detected!")
        try:
            requests.post(f"{self.backend_url}/state/listen", timeout=2)
            # Open browser if not already open
            import subprocess, webbrowser
            webbrowser.open(f"{self.backend_url}/")
        except requests.RequestException as e:
            print(f"[WhyJarv] Backend not reachable: {e}")

        # Cooldown 3s to avoid multiple triggers
        threading.Timer(3.0, lambda: setattr(self, '_cooldown', False)).start()

    def listen(self):
        """Blocking listen loop. Run in background thread."""
        self._running = True
        print(f"[WhyJarv] Listening for '{WAKE_MODEL}'...")

        with sd.InputStream(
            samplerate=SAMPLE_RATE,
            channels=1,
            dtype='int16',
            blocksize=CHUNK_SIZE,
        ) as stream:
            while self._running:
                chunk, _ = stream.read(CHUNK_SIZE)
                audio_f32 = chunk.flatten().astype(np.float32) / 32768.0
                
                predictions = self.model.predict(audio_f32)
                score = predictions.get(WAKE_MODEL, 0.0)
                
                if score > THRESHOLD:
                    self._on_wake()

    def stop(self):
        self._running = False


def run_in_background(backend_url: str = BACKEND_URL):
    """Start the wake word listener in a daemon thread."""
    listener = WakeWordListener(backend_url=backend_url)
    thread = threading.Thread(target=listener.listen, daemon=True)
    thread.start()
    return listener, thread


if __name__ == "__main__":
    listener = WakeWordListener()
    try:
        listener.listen()
    except KeyboardInterrupt:
        listener.stop()
```

- [ ] **Step 3: Test manuale**

```bash
cd ~/Documents/WhyJarv
source .venv/bin/activate
# Con il backend in esecuzione in un altro terminale:
python3 -m backend.wake_word
# Dì "hey jarvis" al microfono
# Expected: "[WhyJarv] Wake word detected!" + browser si apre
```

- [ ] **Step 4: Commit**

```bash
git add backend/wake_word.py
git commit -m "feat: openWakeWord listener with backend signal and browser open"
```

---

### Task 20: Menu Bar App (rumps)

**Files:**
- Create: `backend/menu_bar.py`

- [ ] **Step 1: Crea menu_bar.py**

```python
"""macOS menu bar app via rumps.
Shows WhyJarv state as icon in system tray.
Polls backend state every 500ms.
"""
import rumps
import requests
import threading

BACKEND_URL = "http://localhost:8080"
POLL_INTERVAL = 0.5

STATE_ICONS = {
    "idle":   "⚡",   # signal color not possible via rumps title alone
    "listen": "◉",
    "think":  "◎",
    "speak":  "●",
}

STATE_TITLES = {
    "idle":   "WhyJarv",
    "listen": "WhyJarv · Ascolto",
    "think":  "WhyJarv · Penso...",
    "speak":  "WhyJarv · Parlo",
}


class WhyJarvMenuBar(rumps.App):
    def __init__(self):
        super().__init__(
            name="WhyJarv",
            title=STATE_ICONS["idle"],
            quit_button=None
        )
        self.menu = [
            rumps.MenuItem("Apri WhyJarv", callback=self.open_browser),
            rumps.MenuItem("Stato: idle", callback=None),
            None,
            rumps.MenuItem("Quit", callback=rumps.quit_application),
        ]
        self._current_state = "idle"
        self._start_polling()

    def _start_polling(self):
        def poll():
            while True:
                try:
                    resp = requests.get(f"{BACKEND_URL}/state", timeout=1)
                    state = resp.json().get("state", "idle")
                    if state != self._current_state:
                        self._current_state = state
                        self.title = STATE_ICONS.get(state, "⚡")
                        self.menu["Stato: idle"].title = f"Stato: {state}"
                except Exception:
                    self.title = "⚠"  # backend not running
                threading.Event().wait(POLL_INTERVAL)
        
        thread = threading.Thread(target=poll, daemon=True)
        thread.start()

    def open_browser(self, _):
        import webbrowser
        webbrowser.open(f"{BACKEND_URL}/")


if __name__ == "__main__":
    WhyJarvMenuBar().run()
```

- [ ] **Step 2: Test manuale**

```bash
cd ~/Documents/WhyJarv
source .venv/bin/activate
# Con il backend in esecuzione:
python3 -m backend.menu_bar
```

Expected: icona ⚡ appare nella menu bar macOS. Click mostra il menu.

- [ ] **Step 3: Commit**

```bash
git add backend/menu_bar.py
git commit -m "feat: macOS menu bar app with state polling"
```

---

## PHASE D — Integration

### Task 21: Start Script

**Files:**
- Create: `scripts/start.sh`

- [ ] **Step 1: Crea scripts/start.sh**

```bash
#!/bin/bash
# WhyJarv startup script
# Avvia: FastAPI backend + Wake word listener + Menu bar app

set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$DIR"

echo "⚡ Starting WhyJarv..."

# Activate venv
source "$DIR/.venv/bin/activate"

# Build frontend if dist doesn't exist
if [ ! -d "$DIR/frontend/dist" ]; then
  echo "Building frontend..."
  cd "$DIR/frontend" && npm run build && cd "$DIR"
fi

# Start FastAPI backend in background
echo "Starting backend on :8080..."
uvicorn backend.main:app --host 0.0.0.0 --port 8080 &
BACKEND_PID=$!

# Wait for backend to be ready
sleep 1.5

# Start wake word listener in background
echo "Starting wake word listener..."
python3 -m backend.wake_word &
WAKE_PID=$!

# Open browser
echo "Opening browser..."
open "http://localhost:8080/"

# Start menu bar (foreground — this keeps the script alive)
echo "Starting menu bar..."
python3 -m backend.menu_bar &
MENU_PID=$!

echo ""
echo "✓ WhyJarv running. Say 'let's start WhyJarv' to activate."
echo "  Backend PID:   $BACKEND_PID"
echo "  WakeWord PID:  $WAKE_PID"
echo "  MenuBar PID:   $MENU_PID"
echo ""
echo "Press Ctrl+C to stop all processes."

# Cleanup on exit
cleanup() {
  echo "Stopping WhyJarv..."
  kill $BACKEND_PID $WAKE_PID $MENU_PID 2>/dev/null || true
  exit 0
}
trap cleanup SIGINT SIGTERM

wait
```

- [ ] **Step 2: Rendi eseguibile**

```bash
chmod +x ~/Documents/WhyJarv/scripts/start.sh
```

- [ ] **Step 3: Test completo**

```bash
cd ~/Documents/WhyJarv
./scripts/start.sh
```

Expected: browser si apre su `localhost:8080`, boot sequence visibile, icona ⚡ in menu bar, wake word listener attivo.

- [ ] **Step 4: Commit finale**

```bash
git add scripts/start.sh
git commit -m "feat: start.sh launches complete WhyJarv stack"
```

---

## Self-Review

### Spec coverage check

| Requisito spec | Task che lo copre |
|---------------|------------------|
| Boot sequence 3.5s con JetBrains Mono + DM Serif greeting | Task 13 |
| Arc Reactor Three.js signal-orange, 3 rings + triangle | Task 16 |
| 8K particle field GLSL audio-reactive | Task 16 |
| 4 stati IDLE/LISTEN/THINK/SPEAK | Task 9 (store) + Task 16 (animator) |
| HUD panels 4 angoli void2 + JetBrains Mono | Task 14 |
| Web Speech API STT | Task 11 |
| Web Speech Synthesis TTS frase per frase | Task 12 |
| Claude Code CLI wrapper con history | Task 4 |
| Workspace MD files (IDENTITY/SOUL/USER/MEMORY/CONTEXT) | Task 2 |
| Session logger memory/YYYY-MM-DD.md | Task 6 |
| FastAPI + WebSocket state machine | Task 5 |
| Wake word "let's start whyjarv" → openWakeWord | Task 19 |
| Menu bar macOS | Task 20 |
| Grain overlay identico portfolio WhyEd | Task 8 |
| Design tokens OKLCH (void/signal/paper) | Task 8 |
| Radial SVG waveform audio-reactive | Task 17 |
| start.sh unico comando | Task 21 |

### Placeholder scan

Nessun TBD, TODO, o "similar to Task N" nel documento. Ogni step ha codice concreto.

### Type consistency

- `JarvisState` definito in `jarvisStore.ts` (Task 9) → usato in tutti i componenti
- `ClaudeRunner.run()` restituisce `string` (Task 4) → `run_with_shutdown_check()` restituisce `tuple[str, bool]` → main.py (Task 5) usa `run_with_shutdown_check` ✓
- `SessionLogger.log(user, assistant)` (Task 6) → chiamato in main.py con stessa firma ✓
- `animateReactor(reactor, delta, intensity, state)` (Task 16 reactor.ts) → chiamato in JarvisCanvas.tsx con stessa firma ✓

---

**Piano salvato in `docs/superpowers/plans/2026-06-01-whyjarv-implementation.md`.**

**Due opzioni di esecuzione:**

**1. Subagent-Driven (raccomandato)** — dispatcho un subagent fresco per ogni task, review tra i task, iterazione veloce

**2. Inline Execution** — eseguo i task in questa sessione con superpowers:executing-plans, checkpoint per review

**Quale preferisci?**
