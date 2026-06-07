<p align="center">
  <img src="assets/banner.png" alt="WhyJarv" width="100%"/>
</p>

<p align="center">
  <a href="https://github.com/OfficialWhyEd/WhyJarv/stargazers"><img src="https://img.shields.io/github/stars/OfficialWhyEd/WhyJarv?style=flat-square&color=c94b25" /></a>
  <a href="https://discord.gg/cQQckfnN"><img src="https://img.shields.io/badge/Discord-join-5865F2?style=flat-square&logo=discord&logoColor=white" /></a>
  <a href="https://instagram.com/whyed.music"><img src="https://img.shields.io/badge/Instagram-whyed.music-E4405F?style=flat-square&logo=instagram&logoColor=white" /></a>
  <a href="https://officialwhyed.github.io/WhyJarv"><img src="https://img.shields.io/badge/Website-live-c94b25?style=flat-square" /></a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Python-3.11+-3776AB?style=flat-square&logo=python&logoColor=white" />
  <img src="https://img.shields.io/badge/Groq-LLaMA_70B-F55036?style=flat-square" />
  <img src="https://img.shields.io/badge/Gemini-Flash-4285F4?style=flat-square&logo=google&logoColor=white" />
  <img src="https://img.shields.io/badge/macOS-Monterey+-000000?style=flat-square&logo=apple&logoColor=white" />
  <img src="https://img.shields.io/badge/status-active-brightgreen?style=flat-square" />
</p>

<br/>

> Personal voice assistant that races **Groq LLaMA 70B** against **Gemini Flash** in parallel. Fastest reply wins. Under 300ms. Claude Code CLI executes real Mac actions via MCP. SQLite memory. Zero cloud storage.

---

## Philosophy

**Race mode** — Two AI models fire simultaneously the moment you finish speaking. The first HTTP chunk back wins; the other connection is silently cancelled. Nobody does this at the personal assistant level. The result is sub-300ms latency on a 2015 MacBook Pro.

**Real actions** — Claude Code CLI runs with full MCP access. It opens apps, writes and runs code, reads files, controls the Mac via AppleScript. You hear the answer in 247ms while Claude executes in the background.

**Local memory** — SQLite + TF-IDF indexing. Every conversation is stored and retrievable. Preferences, context, history — forever, offline, private.

**Zero cloud storage** — No conversation data leaves your Mac. No account required. Your Groq and Gemini API keys stay in `.env` locally.

**Always ready** — Menu bar icon via rumps. Wake with "Let's start" or two claps (PyAudio). Uses zero resources while silent.

---

## How it works

```
Voice → Apple STT → Groq LLaMA 70B ──────────────────→ Apple TTS
                         ↓ (if action needed)
                   Gemini Flash (context compression)
                         ↓
                   Claude Code CLI (executes via MCP)
```

| Layer | Technology | Latency |
|-------|-----------|---------|
| **STT** | Apple Web Speech API | ~200ms |
| **Conversation** | Groq LLaMA 3.3 70B + Gemini Flash (race) | <300ms |
| **Actions** | Claude Code CLI + MCP | 3–8s |
| **TTS** | Apple speechSynthesis — Alice | <50ms |
| **Memory** | SQLite local + TF-IDF retrieval | instant |

---

## What you can ask

| Ask | What happens |
|-----|-------------|
| "Open Xcode and show me the build errors" | AppleScript opens Xcode, Claude reads the log, speaks the errors |
| "Remember I hate meetings before 10am" | Stored in SQLite, surfaced whenever schedule is discussed |
| "Write a commit message for these changes" | Claude reads the diff via MCP, drafts conventional commit |
| "What did we discuss yesterday about WhyPost?" | TF-IDF retrieval returns the exact exchange in milliseconds |
| "Play something calm on Spotify" | AppleScript fires the Spotify command |
| "I have a call in 40 min — brief me on the deck" | Claude reads the file + fetches calendar context, speaks 3 key points |
| "Run the tests and tell me what broke" | MCP executes tests, Claude reads output, gives you the summary |
| "Set a 25-minute focus timer" | Native macOS timer via AppleScript |

---

## Why this is different

| Feature | WhyJarv | Siri | ChatGPT voice | Alexa |
|---------|---------|------|--------------|-------|
| Parallel model race | Yes | No | No | No |
| Real code execution | Yes | No | Limited | No |
| Local SQLite memory | Yes | No | No | No |
| Zero cloud storage | Yes | No | No | No |
| Claude CLI actions | Yes | No | No | No |
| Sub-300ms response | Yes | Sometimes | No | Sometimes |

---

## Stack

- **Backend**: FastAPI + WebSocket on `:8340`
- **Frontend**: React + Three.js (signal-orange orb `#c94b25`)
- **AI**: Groq LLaMA 3.3 70B · Gemini Flash · Claude Code CLI
- **TTS/STT**: Apple native (Web Speech API + speechSynthesis)
- **Memory**: SQLite + TF-IDF (`memory_store.py`)

---

## Quick start

```bash
git clone https://github.com/OfficialWhyEd/WhyJarv
cd WhyJarv

cp .env.example .env   # add GEMINI_API_KEY and GROQ_API_KEY
./start.sh             # start backend + open browser
```

Say **"Let's start"** to activate. Say **"chiuditi"** to shut down.

---

## Structure

```
WhyJarv/
├── server.py          # FastAPI + WebSocket + AI race pipeline
├── memory_store.py    # SQLite atomic memory + TF-IDF retrieval
├── menu_bar.py        # macOS menu bar icon (rumps)
├── frontend/
│   ├── src/orb.ts     # Three.js particle orb
│   └── src/main.ts    # state machine, barge-in
└── workspace/         # SOUL.md, PROTOCOL.md, IDENTITY.md
```

---

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=OfficialWhyEd/WhyJarv&type=Date)](https://star-history.com/#OfficialWhyEd/WhyJarv&Date)

---

## Spread the word

Found it useful or interesting? Share it.

- **Discord** — [discord.gg/cQQckfnN](https://discord.gg/cQQckfnN)
- **Instagram** — [@whyed.music](https://instagram.com/whyed.music)
- **Reddit** — [r/MacApps](https://reddit.com/r/MacApps), [r/LocalLLaMA](https://reddit.com/r/LocalLLaMA), [r/apple](https://reddit.com/r/apple)

---

## Contributing

Pull requests welcome. Highest-value contributions:

- **Windows/Linux port** — remove the macOS-only Apple TTS/STT dependency
- **New wake words** — expand the activation vocabulary in `server.py`
- **Memory improvements** — better retrieval algorithms in `memory_store.py`
- **New MCP tools** — extend Claude's action capabilities

---

<p align="center">Built by <a href="https://github.com/OfficialWhyEd">@whyed</a> · macOS only · local-first · <a href="https://officialwhyed.github.io/WhyJarv">website</a></p>
