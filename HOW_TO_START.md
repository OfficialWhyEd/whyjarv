# ⚡ WhyJarv — Come avviare

## Avvio rapido

```bash
cd ~/Documents/WhyJarv
./start.sh
```

Apre automaticamente http://localhost:8340 nel browser.

## Come usarlo

1. Apri il browser su **http://localhost:8340**
2. Di' **"Let's start"** → WhyJarv si attiva (orb diventa verde)
3. Parla normalmente — Gemini risponde in <500ms
4. Di' **"chiuditi"** per disattivare

## Cosa può fare

- Aprire Terminal con Claude Code
- Cercare nel web / aprire Chrome
- Costruire progetti software
- Controllare Calendar / Mail via AppleScript
- Creare note, task, ricordare cose
- Qualsiasi cosa che Claude Code può fare

## Stack

| Layer | Tecnologia |
|-------|-----------|
| Conversazione | Gemini flash-latest → flash-lite-latest (cascade) |
| Azioni | Claude Code CLI |
| STT | Apple Web Speech API (nativo browser) |
| TTS | Apple speechSynthesis (voce Federica) |
| UI | Three.js orb signal-orange + 4 HUD panels |

## Troubleshooting

Microfono non funziona → clicca sul canvas prima di parlare
Gemini lento → rate limit temporaneo, cade su Claude CLI automaticamente
