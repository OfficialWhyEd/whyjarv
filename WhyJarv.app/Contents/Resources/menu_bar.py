"""
WhyJarv Menu Bar App
macOS system tray icon con stato real-time e pannello di controllo veloce.
"""
import rumps
import subprocess
import threading
import webbrowser
import os
import sys
import time
import json
import urllib.request
from pathlib import Path

DIR = Path.home() / "Documents" / "WhyJarv"
BACKEND_URL = "http://localhost:8340"
POLL_INTERVAL = 0.8  # seconds

# Stato dell'orb — icona che cambia in base allo stato WhyJarv
STATE_ICONS = {
    "idle":      "◉",   # signal orange dim
    "listening": "◉",   # signal orange bright
    "thinking":  "◎",   # rotante
    "speaking":  "●",   # pieno
    "offline":   "○",   # offline
}

STATE_LABELS = {
    "idle":      "WhyJarv — Idle",
    "listening": "WhyJarv — Ascolto",
    "thinking":  "WhyJarv — Penso...",
    "speaking":  "WhyJarv — Rispondo",
    "offline":   "WhyJarv — Offline",
}


class WhyJarvApp(rumps.App):
    def __init__(self):
        super().__init__(
            name="WhyJarv",
            title=STATE_ICONS["offline"],
            quit_button=None,
        )

        self._state = "offline"
        self._backend_pid = None
        self._polling = True

        # Menu items
        self._status_item = rumps.MenuItem("● Offline", callback=None)
        self._status_item.set_callback(None)

        self.menu = [
            self._status_item,
            None,
            rumps.MenuItem("Apri WhyJarv", callback=self._open_browser),
            rumps.MenuItem("Riavvia Backend", callback=self._restart_backend),
            None,
            rumps.MenuItem("Quit", callback=self._quit),
        ]

        # Avvia backend all'apertura
        self._start_backend()

        # Polling thread
        t = threading.Thread(target=self._poll_loop, daemon=True)
        t.start()

    def _start_backend(self):
        """Avvia il backend Python se non è già in esecuzione."""
        try:
            # Check se già in esecuzione
            urllib.request.urlopen(f"{BACKEND_URL}/api/health", timeout=1)
            print("[menu_bar] Backend già in esecuzione")
            return
        except Exception:
            pass

        print("[menu_bar] Avvio backend...")
        venv_python = DIR / ".venv" / "bin" / "python3"
        python = str(venv_python) if venv_python.exists() else sys.executable

        # Carica .env
        env_file = DIR / ".env"
        env = os.environ.copy()
        if env_file.exists():
            for line in env_file.read_text().splitlines():
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, _, v = line.partition("=")
                    env[k.strip()] = v.strip()

        proc = subprocess.Popen(
            [python, str(DIR / "server.py")],
            cwd=str(DIR),
            env=env,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        self._backend_pid = proc.pid
        print(f"[menu_bar] Backend avviato PID={proc.pid}")

        # Aspetta che sia pronto
        for _ in range(15):
            time.sleep(0.5)
            try:
                urllib.request.urlopen(f"{BACKEND_URL}/api/health", timeout=1)
                print("[menu_bar] Backend pronto")
                break
            except Exception:
                pass

        # Apri browser
        time.sleep(0.3)
        webbrowser.open(BACKEND_URL)

    def _poll_loop(self):
        """Aggiorna icona in base allo stato del backend."""
        spin_chars = ["◎", "◌", "◉"]
        spin_idx = 0

        while self._polling:
            try:
                with urllib.request.urlopen(
                    f"{BACKEND_URL}/api/health", timeout=1
                ) as resp:
                    data = json.loads(resp.read())
                    state = data.get("state", "idle")

                if state != self._state:
                    self._state = state
                    self._update_icon(state)

                # Spin animation quando pensa
                if state == "thinking":
                    spin_idx = (spin_idx + 1) % len(spin_chars)
                    rumps.App.title.fset(self, spin_chars[spin_idx])

            except Exception:
                if self._state != "offline":
                    self._state = "offline"
                    self._update_icon("offline")

            time.sleep(POLL_INTERVAL)

    def _update_icon(self, state: str):
        icon = STATE_ICONS.get(state, "○")
        label = STATE_LABELS.get(state, "WhyJarv")
        try:
            self.title = icon
            self._status_item.title = label
        except Exception:
            pass

    @rumps.clicked("Apri WhyJarv")
    def _open_browser(self, _):
        webbrowser.open(BACKEND_URL)

    @rumps.clicked("Riavvia Backend")
    def _restart_backend(self, _):
        try:
            urllib.request.urlopen(
                urllib.request.Request(
                    f"{BACKEND_URL}/api/restart",
                    method="POST"
                ),
                timeout=2,
            )
        except Exception:
            pass
        time.sleep(2)
        self._start_backend()

    def _quit(self, _):
        """Ferma il backend e chiude l'app."""
        self._polling = False
        if self._backend_pid:
            try:
                os.kill(self._backend_pid, 15)  # SIGTERM
            except Exception:
                pass
        rumps.quit_application()


def main():
    app = WhyJarvApp()
    app.run()


if __name__ == "__main__":
    main()
