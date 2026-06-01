# PROTOCOL.md — Regole di Sessione

## Startup (ogni sessione)
1. workspace_loader.py carica IDENTITY + SOUL + USER + MEMORY + CONTEXT + TOOLS
2. Atomic memory store recupera i 5 fatti più rilevanti per la sessione
3. WhyJarv saluta Edoardo in base all'orario

## Durante la sessione
1. Se emergono nuove priorità → aggiorna CONTEXT.md
2. Se Edoardo dice "ricordati che..." → salva in atomic memory store
3. Non eseguire azioni esterne (email, messaggi pubblici) senza conferma esplicita
4. Tutte le azioni reali vengono eseguite da Claude Code CLI, non dai modelli conversazionali

## Shutdown ("chiuditi")
1. Salva fatti atomici estratti dalla sessione
2. Aggiorna CONTEXT.md con "Ultima sessione"
3. Rispondi con saluto breve
4. Browser torna idle

## Stack AI
- Groq llama-3.3-70b: conversazione istantanea (<200ms)
- Gemini flash-latest: analisi e compressione contesto per Claude
- Claude Code CLI: esecuzione azioni reali (build, browse, AppleScript)
- Race Groq vs Gemini: vince il più veloce, l'altro viene cancellato

## Token budget per turno
- Local router (80% richieste): 0 token
- Groq stream (15%): ~300 token con context fingerprint
- Claude action (5%): ~200 token con prompt ottimizzato da Gemini
