# WhyJarv — Sistema AI Personale di Edoardo (@whyed)

## Cos'è
WhyJarv è il Jarvis personale di Edoardo. Fork di ethanplusai/jarvis, completamente riscritto.
Gira su MacBook Pro Intel 2015, macOS Monterey. Zero API key Anthropic — usa Claude Code CLI.

## Avvio rapido
```bash
cd ~/Documents/WhyJarv
./start.sh          # avvia tutto (backend + browser)
# oppure
open /Applications/WhyJarv.app
```

Di' **"Let's start"** per attivare. Di' **"chiuditi"** per spegnere.

## Stack AI (3 layer)
- **Groq** (llama-3.3-70b): conversazione istantanea, <200ms
- **Gemini** (flash-latest): analisi + compressione contesto per Claude
- **Claude Code CLI**: esecuzione azioni reali (build, browse, AppleScript, MCP)

## Architettura
- Backend: FastAPI Python su porta 8340
- Frontend: React + Three.js (orb signal-orange #c94b25)
- TTS: Web Speech Synthesis Apple nativo (voce Federica)
- STT: Web Speech API Apple nativo
- Memoria: atomic memory store SQLite locale (memory_store.py)
- Wake word: "Let's start"

## Variabili d'ambiente (.env)
```
GEMINI_API_KEY=...
GROQ_API_KEY=...
USER_NAME=Edoardo
JARVIS_SKIP_PERMISSIONS=true
```

## File chiave
- `server.py` — FastAPI + WebSocket + Groq race + Gemini + Claude CLI
- `memory_store.py` — atomic memory, TF-IDF retrieval locale
- `menu_bar.py` — macOS menu bar icon (rumps)
- `frontend/src/orb.ts` — Three.js particle orb
- `frontend/src/main.ts` — state machine, barge-in, backchanneling
- `workspace/` — MD files identità (IDENTITY, SOUL, USER, MEMORY, CONTEXT, TOOLS, PROTOCOL)

## GitHub
https://github.com/OfficialWhyEd/whyjarv
