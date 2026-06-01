/**
 * WhyJarv — Settings Panel
 * Gemini + Groq API keys, stato real-time, preferenze.
 */

interface StatusResponse {
  claude_code_installed: boolean;
  calendar_accessible: boolean;
  mail_accessible: boolean;
  notes_accessible: boolean;
  task_count: number;
  server_port: number;
  uptime_seconds: number;
  env_keys_set: {
    gemini: boolean;
    groq: boolean;
    user_name: string;
    atomic_memory_facts: number;
    groq_rpm: string;
    gemini_rpm: string;
  };
}

let panelEl: HTMLElement | null = null;
let isOpen = false;

async function apiGet<T>(url: string): Promise<T> {
  const res = await fetch(url);
  return res.json();
}

async function apiPost<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json();
}

function buildHTML(): string {
  return `
    <div class="settings-backdrop" id="settings-backdrop"></div>
    <div class="settings-panel" id="settings-panel-inner">
      <div class="settings-header">
        <h2>WHYJARV</h2>
        <button class="settings-close" id="settings-close">&times;</button>
      </div>

      <div class="settings-body">

        <!-- AI Keys -->
        <section class="settings-section">
          <h3>AI Keys</h3>

          <div class="settings-field">
            <label>Gemini API Key</label>
            <div class="settings-input-row">
              <input type="password" id="input-gemini-key" placeholder="AIzaSy..." />
              <button class="settings-btn" id="btn-test-gemini">Test</button>
              <span class="status-dot" id="status-gemini"></span>
            </div>
          </div>

          <div class="settings-field">
            <label>Groq API Key</label>
            <div class="settings-input-row">
              <input type="password" id="input-groq-key" placeholder="gsk_..." />
              <button class="settings-btn" id="btn-test-groq">Test</button>
              <span class="status-dot" id="status-groq"></span>
            </div>
          </div>

          <div class="settings-actions">
            <button class="settings-btn primary" id="btn-save-keys">Salva</button>
          </div>
        </section>

        <!-- Stato sistema -->
        <section class="settings-section">
          <h3>Stato</h3>
          <div class="status-grid">
            <div class="status-row">
              <span class="status-dot" id="status-groq-live"></span>
              <span>Groq</span>
              <span class="status-detail" id="groq-rpm">--</span>
            </div>
            <div class="status-row">
              <span class="status-dot" id="status-gemini-live"></span>
              <span>Gemini</span>
              <span class="status-detail" id="gemini-rpm">--</span>
            </div>
            <div class="status-row">
              <span class="status-dot" id="status-claude-cli"></span>
              <span>Claude Code CLI</span>
            </div>
            <div class="status-row">
              <span class="status-dot" id="status-calendar"></span>
              <span>Calendar</span>
            </div>
            <div class="status-row">
              <span class="status-dot" id="status-mail"></span>
              <span>Mail</span>
            </div>
            <div class="status-row">
              <span class="status-dot" id="status-server"></span>
              <span>Server</span>
              <span class="status-detail" id="status-server-detail"></span>
            </div>
          </div>
        </section>

        <!-- Preferenze -->
        <section class="settings-section">
          <h3>Preferenze</h3>
          <div class="settings-field">
            <label>Il tuo nome</label>
            <input type="text" id="input-user-name" placeholder="Edoardo" />
          </div>
          <div class="settings-field">
            <label>Account calendario</label>
            <input type="text" id="input-calendar-accounts" placeholder="auto" />
          </div>
          <div class="settings-actions">
            <button class="settings-btn primary" id="btn-save-prefs">Salva</button>
          </div>
        </section>

        <!-- Info sistema -->
        <section class="settings-section">
          <h3>Info</h3>
          <div class="sysinfo-grid">
            <div class="sysinfo-row">
              <span class="sysinfo-label">Memorie atomiche</span>
              <span id="sysinfo-memory">--</span>
            </div>
            <div class="sysinfo-row">
              <span class="sysinfo-label">Task aperti</span>
              <span id="sysinfo-tasks">--</span>
            </div>
            <div class="sysinfo-row">
              <span class="sysinfo-label">Porta server</span>
              <span id="sysinfo-port">--</span>
            </div>
            <div class="sysinfo-row">
              <span class="sysinfo-label">Uptime</span>
              <span id="sysinfo-uptime">--</span>
            </div>
          </div>
        </section>

      </div>
    </div>
  `;
}

function setDot(id: string, status: "green" | "red" | "yellow" | "off") {
  const el = document.getElementById(id);
  if (!el) return;
  el.className = "status-dot" + (status !== "off" ? ` status-${status}` : "");
}

function formatUptime(s: number): string {
  if (s < 60) return `${Math.floor(s)}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
}

async function refreshStatus() {
  try {
    const st = await apiGet<StatusResponse>("/api/settings/status");

    setDot("status-groq-live",    st.env_keys_set.groq   ? "green" : "red");
    setDot("status-gemini-live",  st.env_keys_set.gemini ? "green" : "red");
    setDot("status-claude-cli",   st.claude_code_installed ? "green" : "red");
    setDot("status-calendar",     st.calendar_accessible ? "green" : "red");
    setDot("status-mail",         st.mail_accessible ? "green" : "red");
    setDot("status-server",       "green");

    const el = (id: string) => document.getElementById(id);
    el("status-server-detail")!.textContent  = `porta ${st.server_port} · ${formatUptime(st.uptime_seconds)}`;
    el("groq-rpm")!.textContent              = st.env_keys_set.groq_rpm + " rpm";
    el("gemini-rpm")!.textContent            = st.env_keys_set.gemini_rpm + " rpm";
    el("sysinfo-memory")!.textContent        = String(st.env_keys_set.atomic_memory_facts);
    el("sysinfo-tasks")!.textContent         = String(st.task_count);
    el("sysinfo-port")!.textContent          = String(st.server_port);
    el("sysinfo-uptime")!.textContent        = formatUptime(st.uptime_seconds);
  } catch {
    setDot("status-server", "red");
  }
}

async function loadPrefs() {
  try {
    const p = await apiGet<{ user_name: string; calendar_accounts: string }>("/api/settings/preferences");
    (document.getElementById("input-user-name") as HTMLInputElement).value = p.user_name || "";
    (document.getElementById("input-calendar-accounts") as HTMLInputElement).value = p.calendar_accounts || "auto";
  } catch {}
}

function wireEvents() {
  document.getElementById("settings-close")?.addEventListener("click", closeSettings);
  document.getElementById("settings-backdrop")?.addEventListener("click", closeSettings);

  // Save keys
  document.getElementById("btn-save-keys")?.addEventListener("click", async () => {
    const gk = (document.getElementById("input-gemini-key") as HTMLInputElement).value.trim();
    const qk = (document.getElementById("input-groq-key") as HTMLInputElement).value.trim();
    if (gk) await apiPost("/api/settings/keys", { key_name: "GEMINI_API_KEY", key_value: gk });
    if (qk) await apiPost("/api/settings/keys", { key_name: "GROQ_API_KEY",   key_value: qk });
    await refreshStatus();
  });

  // Test Gemini
  document.getElementById("btn-test-gemini")?.addEventListener("click", async () => {
    setDot("status-gemini", "yellow");
    const key = (document.getElementById("input-gemini-key") as HTMLInputElement).value.trim();
    const r = await apiPost<{ valid: boolean }>("/api/settings/test-gemini", { key_value: key || undefined });
    setDot("status-gemini", r.valid ? "green" : "red");
  });

  // Test Groq
  document.getElementById("btn-test-groq")?.addEventListener("click", async () => {
    setDot("status-groq", "yellow");
    const key = (document.getElementById("input-groq-key") as HTMLInputElement).value.trim();
    const r = await apiPost<{ valid: boolean }>("/api/settings/test-groq", { key_value: key || undefined });
    setDot("status-groq", r.valid ? "green" : "red");
  });

  // Save prefs
  document.getElementById("btn-save-prefs")?.addEventListener("click", async () => {
    const user_name = (document.getElementById("input-user-name") as HTMLInputElement).value.trim();
    const calendar_accounts = (document.getElementById("input-calendar-accounts") as HTMLInputElement).value.trim();
    await apiPost("/api/settings/preferences", { user_name, calendar_accounts });
    await refreshStatus();
  });
}

export function closeSettings() {
  if (!isOpen || !panelEl) return;
  isOpen = false;
  panelEl.classList.remove("open");
  setTimeout(() => { if (panelEl) panelEl.style.display = "none"; }, 300);
}

export async function openSettings() {
  if (isOpen) return;
  isOpen = true;
  if (!panelEl) {
    panelEl = document.createElement("div");
    panelEl.id = "settings-container";
    panelEl.innerHTML = buildHTML();
    document.body.appendChild(panelEl);
    wireEvents();
  }
  panelEl.style.display = "block";
  requestAnimationFrame(() => panelEl!.classList.add("open"));
  await refreshStatus();
  await loadPrefs();
}

export async function checkFirstTimeSetup() {
  try {
    const st = await apiGet<StatusResponse>("/api/settings/status");
    // Prima volta: né Gemini né Groq configurati
    if (!st.env_keys_set.gemini && !st.env_keys_set.groq) {
      openSettings();
    }
  } catch {}
}
