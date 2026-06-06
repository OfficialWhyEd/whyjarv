<p align="center">
  <img src="assets/banner.png" alt="WhyJarv" width="100%"/>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Python-3.11+-3776AB?style=flat-square&logo=python&logoColor=white" />
  <img src="https://img.shields.io/badge/Groq-LLaMA_70B-F55036?style=flat-square" />
  <img src="https://img.shields.io/badge/Gemini-Flash-4285F4?style=flat-square&logo=google&logoColor=white" />
  <img src="https://img.shields.io/badge/macOS-Monterey+-000000?style=flat-square&logo=apple&logoColor=white" />
  <img src="https://img.shields.io/badge/status-active-brightgreen?style=flat-square" />
</p>

<br/>

> Un assistente vocale personale che gira interamente in locale sul Mac. Risponde in meno di 300ms, esegue azioni reali tramite Claude Code CLI, e ti conosce attraverso una memoria persistente.

---

## Come funziona

```
Voce → Apple STT → Groq LLaMA 70B ──────────────────→ Apple TTS
                         ↓ (se serve un'azione)
                   Gemini Flash (compressione contesto)
                         ↓
                   Claude Code CLI (esegue)
```

| Layer | Tecnologia | Latenza |
|-------|-----------|---------|
| **STT** | Apple Web Speech API | ~200ms |
| **Conversazione** | Groq LLaMA 3.3 70B | <300ms |
| **Azioni** | Claude Code CLI + MCP | 3–8s |
| **TTS** | Apple speechSynthesis — voce Federica | <50ms |
| **Memoria** | SQLite locale + TF-IDF retrieval | istantaneo |

---

## Features

- **Risposta istantanea** — Groq in race con Gemini, vince il più veloce
- **Azioni reali** — apre app, scrive codice, controlla il Mac via AppleScript
- **Memoria persistente** — ricorda chi sei, cosa fai, le tue preferenze
- **Zero cloud storage** — tutto gira in locale, nessun dato esce dal Mac
- **Menu bar nativa** — icona WJ sempre in alto a destra, avvio silenzioso
- **Wake word** — di' "Let's start" per attivare, "chiuditi" per spegnere

---

## Stack

- **Backend**: FastAPI + WebSocket su `:8340`
- **Frontend**: React + Three.js (orb signal-orange `#c94b25`)
- **AI**: Groq LLaMA 3.3 70B · Gemini Flash · Claude Code CLI
- **TTS/STT**: Apple nativo (Web Speech API + speechSynthesis)
- **Memoria**: SQLite + TF-IDF (memory_store.py)

---

## Avvio rapido

```bash
git clone https://github.com/OfficialWhyEd/WhyJarv
cd WhyJarv

cp .env.example .env   # aggiungi GEMINI_API_KEY e GROQ_API_KEY
./start.sh             # avvia backend + browser
```

Di' **"Let's start"** per attivare.

---

## Struttura

```
WhyJarv/
├── server.py          # FastAPI + WebSocket + AI pipeline
├── memory_store.py    # memoria atomica SQLite + TF-IDF
├── menu_bar.py        # icona macOS menu bar
├── frontend/
│   ├── src/orb.ts     # Three.js particle orb
│   └── src/main.ts    # state machine, barge-in
└── workspace/         # identità e contesto del bot (MD files)
```

---

<p align="center">Built by <a href="https://github.com/OfficialWhyEd">@whyed</a> · macOS only · no cloud required</p>
