"""
WhyJarv Native Voice Pipeline — zero API waste.

Wake:   due clap entro 900ms  OR  Vosk offline (italiano, zero API)
STT:    Groq Whisper API — solo dopo wake word (~1 call/turno)
AI:     POST /api/voice/text → backend (Ollama locale → Groq fallback)
TTS:    Edge TTS Diego (it-IT, ~670ms) → fallback macOS say -v Luca
"""
import asyncio
import json
import logging
import os
import re
import struct
import subprocess
import tempfile
import threading
import time
import wave
from pathlib import Path

import pyaudio
import requests

log = logging.getLogger("jarvis.voice_native")

BACKEND_URL        = "http://localhost:8340"
GROQ_API_KEY       = os.getenv("GROQ_API_KEY", "")
ELEVENLABS_API_KEY = os.getenv("ELEVENLABS_API_KEY", "")

EL_VOICE_ID = "onwK4e9ZLuTAKqWW03F9"  # Daniel (en_GB) — kept for future paid plan
EL_MODEL    = "eleven_flash_v2_5"
EL_ENABLED  = False  # Italian voices require EL paid plan; using Edge TTS instead

EDGE_VOICE  = "it-IT-DiegoNeural"      # Microsoft Neural, italiano maschile, ~670ms

VOSK_MODEL_PATH = str(Path.home() / ".whyjarv-models" / "vosk-model-small-it-0.22")

# ── Audio ─────────────────────────────────────────────────────────────────────
RATE    = 16000
CH      = 1
FMT     = pyaudio.paInt16
CHUNK   = 1024

# ── Clap ──────────────────────────────────────────────────────────────────────
CLAP_THR    = 2500
CLAP_WIN_MS = 900

# ── Recording / silence ───────────────────────────────────────────────────────
SIL_THR    = 600
SIL_SEC    = 1.6
MAX_REC_S  = 25

# ── Wake word ─────────────────────────────────────────────────────────────────
WAKE_WORDS   = ["whyjarv", "why jarv", "iniziamo", "hey jarvis", "ehi jarvis", "jarvis"]
WAKE_PAUSE_S = 0.6

# ── Voice ─────────────────────────────────────────────────────────────────────
TTS_VOICE = "Luca"      # it_IT — voce italiana maschile nativa macOS
TTS_RATE  = 155         # parole/minuto (italiano un po' più lento)

_lock   = threading.Lock()
_awake  = False
_clap_count  = 0
_clap_time   = 0.0
_history: list[dict] = []


# ─────────────────────────────────────────────────────────────────────────────
# Utilities
# ─────────────────────────────────────────────────────────────────────────────

def _rms(data: bytes) -> float:
    n = len(data) // 2
    if n == 0:
        return 0.0
    shorts = struct.unpack(f"{n}h", data)
    return (sum(s * s for s in shorts) / n) ** 0.5


def _clean_for_tts(text: str) -> str:
    """Rimuove tag azione e markdown prima della sintesi vocale."""
    text = re.sub(r'\[ACTION:[^\]]*\]', '', text)
    text = re.sub(r'\[[A-Z_]+\]', '', text)
    text = re.sub(r'\*{1,2}([^*]+)\*{1,2}', r'\1', text)
    text = re.sub(r'`[^`]+`', '', text)
    text = re.sub(r'\s+', ' ', text).strip()
    return text


def _emit(role: str, text: str, agent: str = ""):
    """Invia un evento alla chat panel del frontend."""
    try:
        requests.post(
            f"{BACKEND_URL}/api/voice/event",
            json={"role": role, "text": text, "agent": agent},
            timeout=1,
        )
    except Exception:
        pass


# ─────────────────────────────────────────────────────────────────────────────
# TTS
# ─────────────────────────────────────────────────────────────────────────────

_tts_proc: subprocess.Popen | None = None


def _stop_tts_proc():
    global _tts_proc
    if _tts_proc and _tts_proc.poll() is None:
        _tts_proc.terminate()
        _tts_proc = None


def _say_elevenlabs(clean: str, wait: bool = False) -> bool:
    """ElevenLabs Flash v2.5 streaming → ffplay. Ritorna True se ok."""
    if not ELEVENLABS_API_KEY:
        return False
    try:
        _stop_tts_proc()
        # ffplay legge mp3 da stdin, -autoexit chiude quando finisce
        ffplay = subprocess.Popen(
            ["ffplay", "-autoexit", "-nodisp", "-loglevel", "quiet", "-"],
            stdin=subprocess.PIPE,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        # Streaming: i primi chunk audio arrivano in ~75ms
        resp = requests.post(
            f"https://api.elevenlabs.io/v1/text-to-speech/{EL_VOICE_ID}/stream",
            headers={"xi-api-key": ELEVENLABS_API_KEY, "Content-Type": "application/json"},
            json={
                "text": clean,
                "model_id": EL_MODEL,
                "voice_settings": {"stability": 0.45, "similarity_boost": 0.82, "style": 0.0},
                "output_format": "mp3_22050_32",
            },
            stream=True,
            timeout=10,
        )
        if resp.status_code != 200:
            ffplay.terminate()
            return False
        for chunk in resp.iter_content(chunk_size=4096):
            if chunk:
                try:
                    ffplay.stdin.write(chunk)
                except BrokenPipeError:
                    break
        ffplay.stdin.close()
        global _tts_proc
        _tts_proc = ffplay
        if wait:
            ffplay.wait()
        return True
    except Exception as e:
        log.debug(f"ElevenLabs TTS error: {e}")
        return False


def _say_edgetts(clean: str, wait: bool = False) -> bool:
    """Microsoft Edge TTS streaming → ffplay. it-IT-DiegoNeural, ~670ms, gratuito."""
    try:
        import edge_tts as _et
        _stop_tts_proc()
        ffplay = subprocess.Popen(
            ["ffplay", "-autoexit", "-nodisp", "-loglevel", "quiet", "-"],
            stdin=subprocess.PIPE,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )

        async def _stream():
            comm = _et.Communicate(clean, voice=EDGE_VOICE)
            async for chunk in comm.stream():
                if chunk["type"] == "audio":
                    try:
                        ffplay.stdin.write(chunk["data"])
                    except BrokenPipeError:
                        break
            try:
                ffplay.stdin.close()
            except Exception:
                pass

        loop = asyncio.new_event_loop()
        loop.run_until_complete(_stream())
        loop.close()

        global _tts_proc
        _tts_proc = ffplay
        if wait:
            ffplay.wait()
        return True
    except Exception as e:
        log.debug(f"Edge TTS error: {e}")
        return False



# ── Language / TTS selection ────────────────────────────────────────────────
import urllib.request as _urllib_req

def _current_lang() -> str:
    """Get current language from server."""
    try:
        with _urllib_req.urlopen("http://localhost:8340/api/settings/language", timeout=0.5) as r:
            import json as _j
            return _j.loads(r.read()).get("language", "en")
    except Exception:
        return "en"

def _say_misotts(clean: str, wait: bool = False) -> bool:
    """MisoTTS 8B — English, emotive. Uses local server if running (port 7860)
    or cloud API when MisoLabs releases it. Currently falls back gracefully."""
    try:
        import requests as _req
        # Check local MisoTTS server (Gradio default port)
        resp = _req.post(
            "http://localhost:7860/api/predict",
            json={"data": [clean, 0]},  # text, speaker_id=0
            timeout=0.5
        )
        if resp.status_code == 200:
            import tempfile, subprocess as _sp, soundfile as _sf, io, base64
            # Gradio returns base64 audio
            audio_b64 = resp.json().get("data", [{}])[0].get("data", "")
            if audio_b64:
                audio_bytes = base64.b64decode(audio_b64.split(",")[-1])
                with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
                    tmp.write(audio_bytes)
                    tmp_path = tmp.name
                proc = _sp.Popen(
                    ["afplay", tmp_path],
                    stdout=_sp.DEVNULL, stderr=_sp.DEVNULL
                )
                if wait:
                    proc.wait()
                return True
    except Exception:
        pass
    return False

def _say_personaplex(clean: str, wait: bool = False) -> bool:
    """NVIDIA PersonaPlex — full-duplex voice AI. Uses local server (port 8998)
    or NVIDIA NIM API. Currently falls back gracefully when not available."""
    try:
        import requests as _req
        # Check NVIDIA PersonaPlex local server
        resp = _req.post(
            "http://localhost:8998/tts",
            json={"text": clean},
            timeout=0.5
        )
        if resp.status_code == 200:
            import tempfile, subprocess as _sp
            audio_bytes = resp.content
            with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
                tmp.write(audio_bytes)
                tmp_path = tmp.name
            proc = _sp.Popen(
                ["afplay", tmp_path],
                stdout=_sp.DEVNULL, stderr=_sp.DEVNULL
            )
            if wait:
                proc.wait()
            return True
    except Exception:
        pass
    return False

def _say_native(clean: str, wait: bool = False):
    """Fallback macOS: say -v Luca (it_IT)."""
    _stop_tts_proc()
    global _tts_proc
    _tts_proc = subprocess.Popen(
        ["say", "-v", TTS_VOICE, "-r", str(TTS_RATE), clean],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    )
    if wait:
        _tts_proc.wait()


def _say(text: str, wait: bool = False):
    """Language-aware TTS: EN → MisoTTS/PersonaPlex/ElevenLabs/edge-en, IT → edge-it/Luca."""
    clean = _clean_for_tts(text)
    if not clean:
        return
    lang = _current_lang()
    if lang == "en":
        # English chain: MisoTTS (local/API) → PersonaPlex (local) → ElevenLabs Daniel → edge-tts en-GB
        if _say_misotts(clean, wait=wait):
            return
        if _say_personaplex(clean, wait=wait):
            return
        # ElevenLabs Daniel — British English, JARVIS quality, free tier
        if _say_elevenlabs(clean, wait=wait):
            return
        # edge-tts English fallback (Ryan = British male)
        import edge_tts as _et2, asyncio as _aio2, subprocess as _sp2
        _stop_tts_proc()
        ffplay = _sp2.Popen(
            ["ffplay", "-autoexit", "-nodisp", "-loglevel", "quiet", "-"],
            stdin=_sp2.PIPE, stdout=_sp2.DEVNULL, stderr=_sp2.DEVNULL,
        )
        async def _stream_en():
            comm = _et2.Communicate(clean, voice="en-GB-RyanNeural")
            async for chunk in comm.stream():
                if chunk["type"] == "audio":
                    try:
                        ffplay.stdin.write(chunk["data"])
                    except BrokenPipeError:
                        break
            try:
                ffplay.stdin.close()
            except Exception:
                pass
        loop = _aio2.new_event_loop()
        loop.run_until_complete(_stream_en())
        loop.close()
        global _tts_proc
        _tts_proc = ffplay
        if wait:
            ffplay.wait()
    else:
        # Italian chain: edge-tts DiegoNeural → macOS Luca
        if _say_edgetts(clean, wait=wait):
            return
        _say_native(clean, wait=wait)

def _say_and_wait(text: str):
    _say(text, wait=True)


def _beep():
    subprocess.Popen(
        ["osascript", "-e", 'beep 2'],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    ).wait()


def _open_browser():
    """Porta in primo piano il tab Chrome esistente, o ne apre uno nuovo."""
    script = f'''
set targetURL to "{BACKEND_URL}"
set opened to false
tell application "Google Chrome"
    repeat with w in windows
        repeat with t in tabs of w
            if URL of t contains "localhost:8340" then
                set active tab index of w to (index of t)
                set index of w to 1
                activate
                set opened to true
                exit repeat
            end if
        end repeat
        if opened then exit repeat
    end repeat
    if not opened then
        open location targetURL
    end if
end tell
'''
    subprocess.Popen(
        ["osascript", "-e", script],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    )


def _close_browser():
    """Chiude tutti i tab Chrome con localhost:8340."""
    script = '''
tell application "Google Chrome"
    repeat with w in (every window)
        repeat with t in (every tab of w)
            if URL of t contains "localhost:8340" then close t
        end repeat
    end repeat
end tell
'''
    subprocess.Popen(
        ["osascript", "-e", script],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    )


def _stop_tts():
    global _tts_proc
    # Ferma il browser TTS mandando testo vuoto (cancel)
    try:
        requests.post(f"{BACKEND_URL}/api/voice/speak_stop", timeout=1)
    except Exception:
        pass
    if _tts_proc and _tts_proc.poll() is None:
        _tts_proc.terminate()
        _tts_proc = None


# ─────────────────────────────────────────────────────────────────────────────
# Groq Whisper
# ─────────────────────────────────────────────────────────────────────────────

def _transcribe(frames: list[bytes]) -> str:
    if not GROQ_API_KEY or not frames:
        return ""
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
        path = tmp.name
    with wave.open(path, "wb") as wf:
        wf.setnchannels(CH)
        wf.setsampwidth(2)
        wf.setframerate(RATE)
        wf.writeframes(b"".join(frames))
    try:
        with open(path, "rb") as f:
            r = requests.post(
                "https://api.groq.com/openai/v1/audio/transcriptions",
                headers={"Authorization": f"Bearer {GROQ_API_KEY}"},
                files={"file": ("a.wav", f, "audio/wav")},
                data={"model": "whisper-large-v3-turbo", "language": "it" if _current_lang() == "it" else "en"},
                timeout=8,
            )
        os.unlink(path)
        if r.status_code == 200:
            return r.json().get("text", "").strip()
    except Exception as e:
        log.debug(f"Transcribe error: {e}")
        try:
            os.unlink(path)
        except Exception:
            pass
    return ""


# ─────────────────────────────────────────────────────────────────────────────
# AI response
# ─────────────────────────────────────────────────────────────────────────────

def _get_response(text: str) -> str:
    try:
        r = requests.post(
            f"{BACKEND_URL}/api/voice/text",
            json={"text": text, "history": _history[-10:]},
            timeout=15,
        )
        if r.status_code == 200:
            return r.json().get("response", "")
    except Exception as e:
        log.warning(f"AI error: {e}")
    return ""


# ─────────────────────────────────────────────────────────────────────────────
# Recording session
# ─────────────────────────────────────────────────────────────────────────────

def _record_and_respond(stream: pyaudio.Stream):
    global _awake, _history

    frames: list[bytes] = []
    sil_chunks  = 0
    sil_limit   = int(RATE / CHUNK * SIL_SEC)
    max_chunks  = int(RATE / CHUNK * MAX_REC_S)

    for _ in range(max_chunks):
        with _lock:
            if not _awake:
                break
        try:
            data = stream.read(CHUNK, exception_on_overflow=False)
        except Exception:
            break
        frames.append(data)
        amp = _rms(data)
        if amp < SIL_THR:
            sil_chunks += 1
            if sil_chunks >= sil_limit:
                break
        else:
            sil_chunks = 0

    if len(frames) < 5:
        log.debug("Registrazione troppo corta")
        with _lock:
            _awake = False
        return

    log.info("🔄 Trascrizione...")
    _emit("status", "transcribing")
    text = _transcribe(frames)

    if not text:
        log.info("Trascrizione vuota")
        _say("Non ti ho sentito, riprova.")
        with _lock:
            _awake = False
        return

    log.info(f"📝 {text}")
    _emit("user", text)

    # Shutdown check
    if any(w in text.lower() for w in ["chiudi", "chiuditi", "spegniti", "goodbye"]):
        _close_browser()
        _say_and_wait("A dopo.")
        _emit("assistant", "A dopo.", "whyjarv")
        with _lock:
            _awake = False
        return

    # Barge-in: ferma TTS se era ancora in corso
    _stop_tts()

    log.info("🤖 Risposta AI...")
    _emit("status", "thinking")
    response = _get_response(text)

    if not response:
        _say("Qualcosa è andato storto, riprova.")
        with _lock:
            _awake = False
        return

    log.info(f"💬 {response[:80]}")
    _history.append({"role": "user",      "content": text})
    _history.append({"role": "assistant", "content": response})
    _emit("assistant", response, "whyjarv")

    _say(response)

    # Aspetta fine TTS poi torna in sleep
    if _tts_proc:
        _tts_proc.wait()

    # Notifica il browser: Python ha finito, torna idle
    try:
        requests.post(f"{BACKEND_URL}/api/voice/idle", timeout=1)
    except Exception:
        pass
    _emit("status", "idle")

    with _lock:
        _awake = False


# ─────────────────────────────────────────────────────────────────────────────
# Main loop
# ─────────────────────────────────────────────────────────────────────────────

def _activate(stream: pyaudio.Stream):
    """Attiva WhyJarv: apri browser + beep → python_mode → registra → rispondi."""
    global _awake, _clap_count

    with _lock:
        if _awake:
            return
        _awake = True
        _clap_count = 0

    _stop_tts()
    _open_browser()
    _beep()
    log.info("✅ Attivato")

    # Invia python_mode SUBITO: browser STT/TTS silenzioso da ora
    # (evita doppio invio di trascrizioni mentre Python registra)
    try:
        requests.post(f"{BACKEND_URL}/api/voice/wake", timeout=1)
    except Exception:
        pass
    _emit("status", "listening")

    # Retry dopo 1s per il caso browser non ancora caricato
    def _wake_retry():
        time.sleep(1.0)
        try:
            requests.post(f"{BACKEND_URL}/api/voice/wake", timeout=1)
        except Exception:
            pass
    threading.Thread(target=_wake_retry, daemon=True).start()

    time.sleep(WAKE_PAUSE_S)
    threading.Thread(target=_record_and_respond, args=(stream,), daemon=True).start()


def _load_vosk():
    """Carica Vosk una volta sola. Ritorna (model, recognizer) o (None, None)."""
    if not Path(VOSK_MODEL_PATH).exists():
        log.warning(f"Vosk model non trovato: {VOSK_MODEL_PATH}")
        return None, None
    try:
        from vosk import Model, KaldiRecognizer
        import vosk
        vosk.SetLogLevel(-1)
        model = Model(VOSK_MODEL_PATH)
        rec   = KaldiRecognizer(model, RATE)
        log.info("✅ Vosk italiano caricato — wake word offline attivo")
        return model, rec
    except Exception as e:
        log.warning(f"Vosk non disponibile: {e}")
        return None, None


def run_voice_loop():
    global _clap_count, _clap_time, _awake

    pa = pyaudio.PyAudio()
    try:
        stream = pa.open(format=FMT, channels=CH, rate=RATE,
                         input=True, frames_per_buffer=CHUNK)
    except Exception as e:
        log.error(f"Microfono non disponibile: {e}")
        pa.terminate()
        return

    _, vosk_rec = _load_vosk()
    log.info("🎤 Voice pipeline attiva (clap × 2 o wake word Vosk)")
    _say("Sistema operativo.")
    _emit("status", "ready")

    while True:
        try:
            data = stream.read(CHUNK, exception_on_overflow=False)
        except Exception:
            time.sleep(0.02)
            continue

        with _lock:
            is_awake = _awake
        if is_awake:
            time.sleep(0.01)
            continue

        amp = _rms(data)
        now = time.time()

        # ── Clap detection ────────────────────────────────────────────────
        if amp > CLAP_THR:
            if _clap_count == 0:
                _clap_count = 1
                _clap_time  = now
            elif _clap_count == 1:
                elapsed_ms = (now - _clap_time) * 1000
                if 80 < elapsed_ms < CLAP_WIN_MS:
                    log.info("👏👏 Due clap — attivazione")
                    _activate(stream)
                    continue
                else:
                    _clap_count = 1
                    _clap_time  = now
        if _clap_count == 1 and (now - _clap_time) * 1000 > CLAP_WIN_MS + 200:
            _clap_count = 0

        # ── Wake word via Vosk (offline, zero API) ────────────────────────
        if vosk_rec and vosk_rec.AcceptWaveform(data):
            result = json.loads(vosk_rec.Result())
            text   = result.get("text", "").lower().strip()
            if text and any(w in text for w in WAKE_WORDS):
                log.info(f"🔔 Wake word Vosk: '{text}'")
                vosk_rec.Reset()
                _activate(stream)


def start_voice_native():
    t = threading.Thread(target=run_voice_loop, daemon=True)
    t.start()
    log.info("Voice native thread avviato")
    return t
