# ⚡ WhyJarv

**Il Jarvis personale di Edoardo Porcu (@whyed).**  
Costruito da zero, vive nel tuo Mac, ti conosce, e fa tutto — esattamente come Jarvis.

---

## Architettura

```
Voce → Apple STT → Gemini Flash (conversazione) → Apple TTS → risposta
                 ↘ Claude Code CLI (azioni) ↗
```

| Layer | Tecnologia | Latenza |
|-------|-----------|---------|
| **STT** | Apple Web Speech API (nativo browser) | ~200ms |
| **Conversazione** | Gemini flash-latest → flash-lite-latest (cascade) | <500ms |
| **Azioni** | Claude Code CLI + tutti i MCP | 3-8s |
| **TTS** | Apple speechSynthesis voce Federica | <50ms |
| **UI** | Three.js orb signal-orange + 4 HUD panels | 60fps |

## Avvio

**Apri l'app:**
```
/Applications/WhyJarv.app
```

Oppure da terminale:
```bash
cd ~/Documents/WhyJarv && ./start.sh
```

Di' **"Let's start"** per attivare.

## Design

WhyJarv usa il design system WhyEd:
- `#c94b25` signal orange — colore primario orb
- `#08090e` void black — sfondo
- Bebas Neue + JetBrains Mono + Outfit

Nessun cyan. Nessun blue generico. Inconfondibilmente @whyed.

## Struttura

```
WhyJarv/
├── server.py          — FastAPI backend + WebSocket + Gemini + Claude CLI
├── menu_bar.py        — macOS menu bar icon (rumps)
├── WhyJarv.app/       — App bundle per /Applications
├── frontend/          — Three.js + TypeScript + Vite
├── workspace/         — MD files: IDENTITY, SOUL, USER, MEMORY, CONTEXT
└── start.sh           — Avvio rapido
```

## GitHub

[github.com/OfficialWhyEd/whyjarv](https://github.com/OfficialWhyEd/whyjarv)
