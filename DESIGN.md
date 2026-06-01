# DESIGN.md — WhyJarv

## Physical Scene

Edoardo alle 3 di notte. Stanza buia. MacBook Pro sul tavolo. Dice due parole.
Il browser si apre. Un reattore pulsa arancio caldo nel buio.
Lui parla. La macchina risponde — la macchina che lui ha costruito.

Questo non è un chatbot. È uno strumento personale. Design come specchio dell'artefice.

---

## Palette — DRENCHED

Il signal orange non è un accento. È la sorgente di luce. Tutto il resto è vuoto.

Riferimento strategia: "Forge fire in absolute dark" — non Klim editorial, non Linear tech-blue,
non neon synthwave. Brace incandescente su carbone.

```css
:root {
  /* Core — OKLCH per chroma consistente tra browser */
  --void:    oklch(5.5% 0.006 245);   /* #08090e — mai #000000 puro */
  --void2:   oklch(7%   0.005 245);   /* #0e1018 — pannelli */
  --paper:   oklch(95%  0.008  80);   /* #f0ede8 — warm off-white */
  --dim:     oklch(55%  0.006  80);   /* #6a6860 — testo secondario */
  --faint:   oklch(30%  0.005  80);   /* #2a2c34 — dettagli */

  /* Signal — il reattore */
  --signal:  oklch(52%  0.18   32);   /* #c94b25 — ember primario */
  --signal2: oklch(60%  0.16   40);   /* #e8603a — ember secondario */
  --signal3: oklch(40%  0.14   25);   /* #8b2e10 — ember profondo */

  /* Superfici */
  --line:    oklch(100% 0 0 / 6%);    /* bordi pannelli — sottilissimi */
  --line2:   oklch(100% 0 0 / 10%);   /* bordi medi */
  --glow:    oklch(52%  0.18   32 / 30%); /* --signal con alpha — per shadows */
}
```

Anti-reflex check:
- Primo ordine: "AI voice UI → neon cyan/blue" ← evitato, usiamo ember orange
- Secondo ordine: "Jarvis non-cyan → synthwave purple o matrix green" ← evitato, usiamo warm industrial
- Terzo test: "Forge fire in void" non appartiene a nessuna categoria saturata. Non è cyberpunk, non è editorial, non è SaaS. È Edoardo.

---

## Tipografia

Brand voice words: **meccanico, incandescente, ossessivo**

Font esistenti del brand — identity-preserved (non subject to reflex-reject):

```
Display:     Bebas Neue           — tracking 0.05em, line-height 0.88
             → boot sequence, "WHYJARV", state labels grandi
             → solo uppercase, mai misto

Mono:        JetBrains Mono       — tracking 0.12em, uppercase
             → tutti i dati HUD: status, coordinate, token count, MCP names
             → 10-11px nei panel, 13px nelle label medie
             → QUESTO font dà la texture "macchina costruita da Edoardo"

Body:        Outfit 300/400       — line-height 1.6
             → testo risposta di WhyJarv (leggibile, caldo)
             → trascrizione utente

Serif:       DM Serif Display italic
             → saluto boot: "Bentornato, Edoardo." — solo quello
             → una sola occorrenza, massima eleganza
```

Scala tipografica (clamp fluid):
```css
--text-xs:   clamp(0.625rem, 0.58rem + 0.2vw, 0.688rem);   /* HUD micro */
--text-sm:   clamp(0.75rem,  0.70rem + 0.3vw, 0.875rem);   /* HUD labels */
--text-base: clamp(1rem,     0.95rem + 0.4vw, 1.125rem);   /* body response */
--text-lg:   clamp(1.25rem,  1.2rem  + 0.5vw, 1.5rem);     /* trascrizione */
--text-display: clamp(2.5rem, 2rem + 2vw, 4rem);           /* Bebas Neue */
--text-hero: clamp(4rem,     3rem + 4vw, 8rem);            /* "WHYJARV" boot */
```

---

## Layout

Fullscreen `100dvh × 100dvw`. Nessun contenitore. La tela è tutto lo schermo.

```
┌──────────────────────────────────────────────────────────┐
│ [HUD-TL]                              [HUD-TR]           │
│  24px                                     24px           │
│                                                          │
│                                                          │
│                    [ REACTOR ]                           │
│                  (centro esatto)                         │
│               + waveform circolare                       │
│                + particle field                          │
│                                                          │
│                                                          │
│  [HUD-BL]                              [HUD-BR]          │
│   24px                                    24px           │
│                                                          │
│          [ trascrizione utente ]                         │
│        [ risposta WhyJarv ]                              │
│                                             24px ↑       │
└──────────────────────────────────────────────────────────┘
```

HUD panels: `position: absolute`, non glassmorphism (banned as default).
Sfondo `--void2`, bordo 1px `--line`, zero blur, zero backdrop-filter decorativo.

Testo risposta e trascrizione: centrati orizzontalmente, bottom 24-64px.
Larghezza max 60ch (65ch per Outfit 300 → rispetta cap per leggibilità).

---

## Three.js — Specifiche Tecniche

### Performance Architecture
- **OffscreenCanvas + Web Worker**: particle system e GLSL shaders girano off main thread
- **Main thread**: solo React state, WebSocket, Web Speech API, rumps communication
- **60fps target**: se scende sotto 50fps su Intel i7, riduce particle count a 4K

### Arc Reactor (procedurale, zero modelli importati)

```javascript
// Materiale emissivo signal-orange
const signalMat = new THREE.MeshStandardMaterial({
  color: 0xc94b25,
  emissive: 0xc94b25,
  emissiveIntensity: 2.0,   // idle → 4.0 speak → 1.0 think flicker
  wireframe: false,
  transparent: true,
  opacity: 0.9
});

// Ring 1 — inner, più spesso
new THREE.TorusGeometry(0.8, 0.025, 8, 64)  // CCW rotation

// Ring 2 — mid
new THREE.TorusGeometry(1.2, 0.018, 8, 64)  // CW rotation

// Ring 3 — outer, quasi invisibile dim
new THREE.TorusGeometry(1.7, 0.010, 8, 64)  // CW rotation lenta, --signal3

// Triangle core — simbolo nel centro
// Equilateral, 0.35 radius, filled, emissive pieno
```

### Post-Processing
```javascript
// UnrealBloomPass — glow caldo, non freddo
bloomPass.threshold  = 0.6;
bloomPass.strength   = 1.8;   // idle → 2.5 speak
bloomPass.radius     = 0.5;
bloomPass.resolution = new THREE.Vector2(512, 512);

// GammaCorrectionShader → output sRGB corretto
```

### Particle Field

```javascript
// 8.000 particelle (riduce a 4K se Intel CPU throttling)
// Distribuzione sferica, raggio 3.0
// Colori: gradiente --signal → --signal2 → --paper
// per profondità prospettica

// GLSL Vertex Shader — pulse wave
uniform float uTime;
uniform float uIntensity;  // 0.0 idle → 1.0 speak

void main() {
  vec3 pos = position;
  float wave = sin(uTime * 2.0 + length(pos) * 1.5) * uIntensity * 0.1;
  pos += normal * wave;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  gl_PointSize = mix(1.0, 3.0, uIntensity) * (1.0 / -mvPosition.z);
}

// GLSL Fragment Shader — punto circolare con soft edge
void main() {
  float d = distance(gl_PointCoord, vec2(0.5));
  if (d > 0.5) discard;
  float alpha = 1.0 - smoothstep(0.3, 0.5, d);
  gl_FragColor = vec4(vColor, alpha * uIntensity * 0.8);
}
```

### Web Audio API — Audio Reactive

```javascript
// Collega TTS output o microfono all'analyser
const analyser = audioCtx.createAnalyser();
analyser.fftSize = 128;
const dataArray = new Uint8Array(analyser.frequencyBinCount); // 64 bins

// Ogni frame:
analyser.getByteFrequencyData(dataArray);
const intensity = dataArray.reduce((a, b) => a + b) / (dataArray.length * 255);

// → reactor scale: 1.0 + intensity * 0.3
// → bloom strength: 1.8 + intensity * 0.7
// → particle uIntensity: intensity
```

### Radial Waveform — SVG sovrapposto al canvas

```javascript
// 64 bars disposti in cerchio (r=200px), visibili solo in LISTEN/SPEAK
// SVG path aggiornato ogni rAF con frequency data
// Colore: --signal, opacity 0.6
// Animazione: framer-motion spring per appearance/disappearance
```

---

## 4 Stati — Transizioni Spring

```javascript
// framer-motion spring config
const spring = { type: 'spring', mass: 1, stiffness: 150, damping: 20 }

// IDLE
reactor.emissiveIntensity = 2.0
reactor.rotationSpeed = 0.003  // anelli
bloom.strength = 1.2
particles.uIntensity = 0.15
menuBar.color = '#c94b25' // dim

// LISTEN — attivazione immediata, espansione
reactor.emissiveIntensity = 3.5
reactor.rotationSpeed = 0.008
bloom.strength = 2.2
particles.uIntensity = 0.8    // agitate verso centro
waveform.visible = true
menuBar.color = '#c94b25' // bright

// THINK — flicker irregolare
reactor.emissiveIntensity = animate([2.0, 4.0, 1.5, 3.5, 2.5]) // strobe
reactor.rotationSpeed = 0.015
bloom.strength = 1.8
particles.uIntensity = 0.4    // burst radiale ogni 800ms
menuBar.color = '#f0ede8'

// SPEAK — morphing pieno
reactor.emissiveIntensity = 4.0 + audioIntensity * 2.0  // audio-driven
reactor.rotationSpeed = 0.005 + audioIntensity * 0.02
bloom.strength = 2.5 + audioIntensity * 1.0
particles.uIntensity = audioIntensity               // pienamente audio-reactive
waveform.visible = true
menuBar.color = '#e8603a'
```

---

## HUD Panels

```css
.hud-panel {
  position: absolute;
  background: var(--void2);
  border: 1px solid var(--line);
  padding: 14px 16px;
  min-width: 180px;
  max-width: 220px;

  /* NO blur, NO glassmorphism decorativo */
  /* La solidità È il design — macchina industriale */
}

.hud-panel .label {
  font-family: 'JetBrains Mono', monospace;
  font-size: var(--text-xs);
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--dim);
}

.hud-panel .value {
  font-family: 'JetBrains Mono', monospace;
  font-size: var(--text-sm);
  letter-spacing: 0.08em;
  color: var(--paper);
}

.hud-panel .value.active {
  color: var(--signal);
}

/* Micro-glitch: ogni 30s, 80ms, 1-2 chars distorted */
@keyframes glitch-char {
  0%, 90%  { opacity: 1; transform: none; }
  91%      { opacity: 0.7; transform: translateX(2px); }
  93%      { opacity: 1; transform: translateX(-1px); }
  95%      { opacity: 0.9; transform: none; }
  100%     { opacity: 1; }
}
```

**Posizioni:**
```
top-left:     top: 24px; left: 24px;
top-right:    top: 24px; right: 24px;
bottom-left:  bottom: 88px; left: 24px;   /* 88px per lasciare spazio testo */
bottom-right: bottom: 88px; right: 24px;
```

---

## Boot Sequence

Durata totale: ~3.5s. Non skippabile la prima volta. Tap/click per skip le volte successive.

```
0.0s   Void black
0.2s   JetBrains Mono, 11px, center:
         WHYJARV — SISTEMA PERSONALE v1.0
         edoardo porcu · cagliari
         —————————————————————————————
         inizializzazione...
0.6s   Progress bar signal-orange (left→right, 0→100%, easing ease-out-quart)
1.2s   "CORE ATTIVO"
1.4s   Reactor appare — scale 0→1 con spring (mass 0.8, stiffness 200, damping 18)
         emissiveIntensity parte da 0 → 2.0
1.6s   Ring 1 → Ring 2 → Ring 3 si espandono in sequenza (stagger 120ms)
1.9s   Particelle esplodono dal centro (burst radiale → si stabilizzano)
2.2s   Grain overlay fade-in (0→0.028, 400ms)
2.4s   HUD panels fade-in (stagger 80ms: TL → TR → BL → BR)
2.8s   DM Serif Display italic, center, 28px, --paper:
         "Bentornato, Edoardo."
       (voce Apple, lingua IT)
3.5s   Stato IDLE completo
```

---

## Grain Overlay

Identico al portfolio WhyEd — parte integrante del brand:

```css
body::before {
  content: '';
  position: fixed;
  inset: 0;
  z-index: 9000;
  pointer-events: none;
  opacity: 0.028;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
  background-size: 256px 256px;
}
```

---

## Testo — Area Centro-Bassa

```
TRASCRIZIONE (mentre utente parla, LISTEN):
  font: Outfit 300, --text-base, --dim
  posizione: bottom 64px, center, max-width 60ch
  animazione: parola per parola, fade-in 80ms stagger
  prefissata da: "▸ " in --signal

RISPOSTA (mentre WhyJarv parla, SPEAK):
  font: Outfit 400, --text-lg, --paper
  posizione: bottom 104px, center, max-width 60ch
  animazione: frase per frase, slide-up + fade-in
  line-height: 1.6 (Outfit chiaro su void, needs room)
  
SALUTO BOOT:
  font: DM Serif Display italic, 28px, --paper
  posizione: center assoluto, sopra reactor
  timing: dopo 2.8s, dura 1.2s poi si dissolve
```

---

## Reduced Motion

```css
@media (prefers-reduced-motion: reduce) {
  /* Reactor: statico, solo glow */
  /* Particles: off (canvas nascosto) */
  /* Boot sequence: skip diretto a IDLE */
  /* Transizioni di stato: instant */
  /* Waveform: flat bar statico */
  /* Tutti gli spring: instant */
}
```

Esperienza ridotta ancora bella: reactor statico glowing su void, HUD leggibili,
testo chiaro. Non degradato — solo fermo.

---

## Menu Bar macOS (rumps)

```python
ICONS = {
  'idle':   '◉',   # signal dim — a riposo
  'listen': '◉',   # signal bright — in ascolto
  'think':  '◉',   # paper white — elaborando
  'speak':  '◉',   # signal2 — parlando
}
# rumps non supporta colori custom via title — si usa emoji o unicode
# Alternative: icona SVG in NSImage (richiede PyObjC)
# Soluzione raccomandata: template image NSImage con tint per stato
```

---

## Accessibilità

- Contrasto: --paper su --void = 15.2:1 (AAA)
- Contrasto: --signal su --void = 4.8:1 (AA — per testo ≥18px OK, non usare per testo <14px)
- `prefers-reduced-motion`: rispettato, esperienza alternativa bella
- Keyboard: space per attivare/disattivare ascolto (fallback al wake word)
- Screen reader: il canvas Three.js ha `aria-hidden="true"`, il testo è nel DOM

---

## Anti-pattern da evitare

- NO cyan/blue/purple — se appare, eliminare immediatamente
- NO gradient text (`background-clip: text`) — vietato da impeccable
- NO glassmorphism come default — pannelli solidi void2
- NO side-stripe borders spesse
- NO card grid identiche
- NO bouncy elastic animation — solo ease-out-quart/expo
- NO suono senza opt-in utente (voce TTS è opt-in implicito, SFX no)
- NO "it's AI-made" look — deve sembrare costruito dalla stessa persona che ha scritto WhyCremisi
