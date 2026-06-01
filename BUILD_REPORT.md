# WhyJarv Build Report — 2026-06-01

## Cosa è stato fatto

### 1. Gemini 2.0 Flash integrato per conversazione veloce
- Aggiunto `_gemini_chat()` helper in `server.py` che usa `google-genai`
- `generate_response()` ora usa Gemini se `GEMINI_API_KEY` è impostata (risposta <500ms), con fallback a Claude CLI
- Claude CLI (`claude --print`) rimane per le azioni pesanti

### 2. Rimossi tutti i riferimenti ad anthropic_client
- Rimosso `import anthropic` da `planner.py`
- Tutte le type annotations `anthropic.AsyncAnthropic` sostituite con `Optional[object]`
- `_update_session_summary()` → ora usa Gemini o truncation
- `_execute_prompt_project()` → summary via Gemini invece di Haiku
- `self_work_and_notify()` → summary via Gemini
- `_do_screen_lookup()` → rimosso branch anthropic_client (usa solo AppleScript)
- `handle_research()` → riscritto per usare Claude CLI + Gemini summary
- `extract_memories()` in `memory.py` → riscritto per usare Gemini
- Endpoint `/api/settings/test-anthropic` → ora testa Gemini key
- `api_test_fish()` → restituisce errore chiaro (Fish Audio non usato)
- Rimosso `httpx` dalla logica Fish Audio

### 3. Dipendenze installate
- `fastapi uvicorn websockets playwright pyyaml google-genai` via pip
- Virtualenv in `.venv/`

### 4. HUD Panels aggiunti al frontend
- 4 pannelli agli angoli (TL, TR, BL, BR) con info sistema in tempo reale
- CSS JetBrains Mono, signal-orange, void background
- `#hud-state` si aggiorna dinamicamente via `updateHUD()` in `main.ts`

### 5. Label stati aggiornati (italiano)
- `listening` → "in ascolto..."
- `thinking` → "elaboro..."

### 6. `.env.example` creato
- `GEMINI_API_KEY`, `USER_NAME`, `JARVIS_SKIP_PERMISSIONS`

### 7. Build frontend
- TypeScript compilato senza errori
- Vite build OK → `frontend/dist/`

## File modificati
- `server.py` — Gemini integration, rimossi tutti gli anthropic_client
- `memory.py` — extract_memories ora usa Gemini
- `planner.py` — rimosso import anthropic, type annotations aggiornate
- `frontend/index.html` — HUD panels aggiunti
- `frontend/src/style.css` — HUD CSS aggiunto
- `frontend/src/main.ts` — updateHUD(), label in italiano
- `.env.example` — aggiornato per Gemini

## Status
- server.py: SYNTAX OK
- Server startup: OK (avvia su porta 8340)
- Frontend build: OK (dist/ generata)
