# POSSIBLE MISSION (`가능미션`) — Authoritative Technical & Game Design Specification

- **Document Role**: Single Source of Truth for parallel implementation by Core Systems + 4 independent mini-game programmers.
- **Target Deployment**: Pure static site hosted on GitHub Pages (`main` branch, root `/`). Zero build step, zero bundler, zero backend, zero external JS CDN dependencies.
- **Module & Path Standard**: Native ES Modules (`<script type="module" src="./js/app.js">`). All asset, stylesheet, and module references MUST use strictly relative paths (`./assets/...`, `./styles/...`, `./js/...`) — never root-leading `/` paths — so the app runs identically at `https://<user>.github.io/<repo>/` and `http://localhost`.
- **Language & Theme**: **Calm Graphite Arcade** — a softer successor to the launch "Midnight Neon" look (`#0c1018` base, muted accent set `#38bdf8` / `#ec6aa0` / `#eeb44a` / `#3fbf92` / `#e06767` / `#a189e8`, subtle 6px/18px shadows instead of neon glows). Korean is the primary UI language; English micro-labels are decorative only and must never be required to understand a screen. Design rule: **one clear action per surface** — avoid stacked pill clusters, 3D tilt, grid backgrounds and glow-heavy borders.
- **Concurrency & Scale**: Engineered for **5–100 simultaneous workshop participants** on mobile (`360px+` portrait/landscape) and desktop/projector (`1440px+`), using deterministic seeded PRNG for zero-backend puzzle synchronization.

---

## 1. Authoritative File Structure & Ownership Boundaries

Every programmer works strictly inside their assigned CSS + JS module(s). Modifying another game's file or changing core contracts without updating this spec is prohibited.

```text
/
├── DESIGN_SPEC.md                  # [this document] Authoritative architecture & module contracts
├── index.html                      # Single-page shell (Lobby view, Game view, HUD, Modals, Toast/Confetti layers)
├── styles/
│   ├── main.css                    # CSS variables (:root tokens), backdrop, lobby, shared HUD, modals, toasts, responsive grid
│   ├── game-hidden.css             # Scoped under .game-hidden — Hidden Object canvas, loupe, target dock
│   ├── game-spot.css               # Scoped under .game-spot — Dual canvases, mirror cursor, mobile zoom toggle
│   ├── game-memory.css             # Scoped under .game-memory — 3D flip cards, combo banner, responsive grid
│   └── game-fortress.css           # Scoped under .game-fortress — Vault terminal, floating nodes, tactile A-J keypad
├── js/
│   ├── app.js                      # Hub controller, URL sync, Lobby renderer, dynamic ./games/<id>.js router, ctx factory
│   ├── core/
│   │   ├── seed.js                 # Deterministic FNV-1a + Mulberry32 PRNG & seeded array utilities
│   │   ├── audio.js                # Pure Web Audio API retro SFX synthesizer & mute persistence
│   │   ├── storage.js              # localStorage persistence (profile, PB per game+mode, seed history, run log, mute)
│   │   └── ui.js                   # Toasts, confetti canvas burst, S/A/B/C grading, Slack/Kakao formatter, modals, share URL + QR matrix
│   └── games/
│       ├── hidden-object.js        # Programmer A — exports mount(container, ctx) -> { unmount() }
│       ├── spot-difference.js      # Programmer B — exports mount(container, ctx) -> { unmount() }
│       ├── memory-match.js         # Programmer C — exports mount(container, ctx) -> { unmount() }
│       └── despair-fortress.js     # Programmer D — exports mount(container, ctx) -> { unmount() }
└── assets/
    └── images/                     # [Verified Existing Assets]
        ├── hero-arcade.jpg         # 1376x768 — Lobby hero banner
        ├── hidden-workshop.jpg     # 1376x768 — Hidden Object Stage 1 (Creative Lounge)
        ├── hidden-space.jpg        # 1376x768 — Hidden Object Stage 2 (Orbital Observatory)
        ├── spot-cafe.jpg           # 1200x896 — Spot the Difference Stage 1 (Board Game Cafe)
        ├── spot-camp.jpg           # 1200x896 — Spot the Difference Stage 2 (Golden Camp)
        └── fortress-bg.jpg         # 1376x768 — Despair Fortress Security Vault
```

### CSS Isolation Rule (Zero Style Collisions)
1. `index.html` loads `styles/main.css` plus all 4 game stylesheets (`game-hidden.css`, `game-spot.css`, `game-memory.css`, `game-fortress.css`), OR `app.js` guarantees they are linked in `<head>`.
2. Each game programmer MUST wrap their root DOM element in `#game-stage` with a single game-specific root class and scope **100% of their CSS rules and `@keyframes` names**:
   - `hidden-object.js` → root `<div class="game-root game-hidden">`, keyframes prefixed `ho-`
   - `spot-difference.js` → root `<div class="game-root game-spot">`, keyframes prefixed `sd-`
   - `memory-match.js` → root `<div class="game-root game-memory">`, keyframes prefixed `mm-`
   - `despair-fortress.js` → root `<div class="game-root game-fortress">`, keyframes prefixed `df-`
3. Game stylesheets MUST NOT style bare tags (`button`, `canvas`, `h2`, `body`) outside their root scope class, and MUST consume tokens from `styles/main.css` (`var(--neon-cyan)`, etc.).
4. **16:9 Arcade Cabinet (PC first)**: on viewports `>= 900px` every mini-game MUST render inside a fixed 16:9 stage frame. `styles/main.css` owns this rule (`.game-stage > .game-root { aspect-ratio: 16/9; width: min(100%, calc((100dvh - var(--hud-height) - 2 * clamp(8px, 1.6vh, 20px)) * 16 / 9)); }`), so game modules must fill the frame (`width/height: 100%`) and never assume the viewport aspect ratio. Game-specific desktop layouts may switch to a 2-column grid inside the frame (e.g. `despair-fortress` arena | keypad, `hidden-object` stage | target dock).

---

## 2. Canonical Game Registry & Mode IDs

All routing (`?game=<id>&mode=<mode>`), dynamic imports (`./games/<id>.js`), storage keys, and result formatters MUST use these exact IDs:

| Game ID (`<id>`) | File (`./js/games/<id>.js`) | Korean Title | English Sub-label | Accent Token | Canonical `ctx.mode` Values (Default First) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `hidden-object` | `hidden-object.js` | 숨은그림찾기 | `HIDDEN MISSION` | `--neon-cyan` | `stage1-normal`, `stage1-hard`, `stage2-normal`, `stage2-hard` |
| `spot-difference` | `spot-difference.js` | 틀린그림찾기 | `SPOT THE GLITCH` | `--neon-magenta` | `stage1-normal`, `stage1-hard`, `stage2-normal`, `stage2-hard` |
| `memory-match` | `memory-match.js` | 네온 메모리 매치 | `NEON MEMORY` | `--neon-violet` | `4x3`, `4x4`, `6x4` |
| `despair-fortress` | `despair-fortress.js` | 절망요새 숨바꼭질 | `DESPAIR FORTRESS` | `--neon-crimson` | `standard` |

---

## 3. CSS Design Tokens & `index.html` DOM Contract

### 3.1 Font & Head Setup (`index.html`)
```html
<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <title>POSSIBLE MISSION | 네온 워크샵 아케이드</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link
    href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700;900&family=Outfit:wght@600;700;800;900&family=Space+Grotesk:wght@500;700&display=swap"
    rel="stylesheet"
  />
  <link
    rel="stylesheet"
    as="style"
    crossorigin
    href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
  />
  <link rel="stylesheet" href="./styles/main.css" />
  <link rel="stylesheet" href="./styles/game-hidden.css" />
  <link rel="stylesheet" href="./styles/game-spot.css" />
  <link rel="stylesheet" href="./styles/game-memory.css" />
  <link rel="stylesheet" href="./styles/game-fortress.css" />
</head>
```

### 3.2 Exact CSS Variable Names (`styles/main.css` `:root`)
All stylesheets MUST reference these exact CSS custom property names:

```css
:root {
  /* === Canvas & Surface Hierarchy (Midnight Obsidian) === */
  --bg-obsidian: #070914;
  --bg-obsidian-elevated: #0b0f22;
  --bg-surface-deep: rgba(16, 22, 48, 0.72);
  --bg-surface-hover: rgba(22, 31, 66, 0.84);
  --bg-hud: rgba(7, 9, 20, 0.82);
  --bg-modal: rgba(12, 17, 38, 0.92);
  --bg-pill: rgba(255, 255, 255, 0.06);

  /* === Glassmorphism & Borders === */
  --glass-blur: blur(16px);
  --hud-blur: blur(18px);
  --border-subtle: rgba(148, 163, 184, 0.16);
  --border-specular: rgba(255, 255, 255, 0.22);
  --border-strong: rgba(255, 255, 255, 0.34);

  /* === Neon Party Accents === */
  --neon-cyan: #22d3ee;       /* Primary / Hidden Object / Focus */
  --neon-magenta: #f43f8e;    /* Party Accent / Spot the Diff / Combo */
  --neon-gold: #fbbf24;       /* Rank S / Seed / Best Score / Bonus */
  --neon-emerald: #34d399;    /* Ready / Success / Connected */
  --neon-crimson: #ef4444;    /* Despair Fortress / Danger / Wrong Tap */
  --neon-violet: #a855f7;     /* Memory Match / Aurora / MC Accent */

  /* === Semantic Glows === */
  --glow-cyan: 0 0 24px rgba(34, 211, 238, 0.35), 0 0 6px rgba(34, 211, 238, 0.55);
  --glow-magenta: 0 0 24px rgba(244, 63, 142, 0.35), 0 0 6px rgba(244, 63, 142, 0.55);
  --glow-gold: 0 0 28px rgba(251, 191, 36, 0.40), 0 0 8px rgba(251, 191, 36, 0.60);
  --glow-emerald: 0 0 20px rgba(52, 211, 153, 0.35);
  --glow-crimson: 0 0 26px rgba(239, 68, 68, 0.45), 0 0 8px rgba(239, 68, 68, 0.65);
  --glow-violet: 0 0 24px rgba(168, 85, 247, 0.38), 0 0 6px rgba(168, 85, 247, 0.55);

  /* === Typography === */
  --font-display: 'Outfit', 'Pretendard Variable', 'Noto Sans KR', sans-serif;
  --font-mono: 'Space Grotesk', 'Pretendard Variable', monospace;
  --font-sans: 'Pretendard Variable', 'Pretendard', 'Noto Sans KR', -apple-system, BlinkMacSystemFont, sans-serif;

  /* === Fluid Type Scale === */
  --text-hero: clamp(1.85rem, 3.8vw + 0.8rem, 3.5rem);
  --text-h2: clamp(1.25rem, 1.6vw + 0.7rem, 1.75rem);
  --text-h3: clamp(1.05rem, 0.8vw + 0.8rem, 1.25rem);
  --text-body: clamp(0.875rem, 0.3vw + 0.8rem, 1rem);
  --text-caption: 0.75rem;
  --text-micro: 0.6875rem;

  /* === Text Colors === */
  --text-primary: #f8fafc;
  --text-secondary: #cbd5e1;
  --text-muted: #94a3b8;
  --text-dim: #64748b;

  /* === Radii & Layout === */
  --radius-sm: 8px;
  --radius-md: 14px;
  --radius-lg: 20px;
  --radius-xl: 26px;
  --radius-pill: 9999px;

  --container-max: 1320px;
  --gutter: clamp(14px, 3vw, 28px);
  --hud-height: 60px;

  /* === Shadows & Motion === */
  --shadow-card: 0 18px 42px -12px rgba(2, 6, 23, 0.78), inset 0 1px 0 rgba(255, 255, 255, 0.14);
  --shadow-floating: 0 20px 50px rgba(0, 0, 0, 0.65), 0 0 0 1px rgba(255, 255, 255, 0.08);
  --ease-arcade: cubic-bezier(0.22, 1, 0.36, 1);
  --ease-pop: cubic-bezier(0.34, 1.56, 0.64, 1);
  --dur-fast: 150ms;
  --dur-med: 260ms;
  --dur-slow: 480ms;

  /* === Z-Index Layers === */
  --z-bg: 0;
  --z-content: 10;
  --z-floating-bar: 40;
  --z-hud: 50;
  --z-pause-curtain: 65;
  --z-modal: 80;
  --z-confetti: 90;
  --z-toast: 100;
}
```

### 3.3 Exact Shell DOM Structure & Selectors (`index.html`)
Games mount inside `#game-stage`. The shared HUD (`#game-hud`) and shared overlays (`#modal-root`, `#toast-root`, `#confetti-canvas`) are owned by `app.js` and `ui.js`.

```html
<body>
  <!-- Fixed atmospheric layer -->
  <div class="arcade-backdrop" aria-hidden="true">
    <div class="arcade-backdrop__grid"></div>
    <div class="arcade-backdrop__aurora arcade-backdrop__aurora--cyan"></div>
    <div class="arcade-backdrop__aurora arcade-backdrop__aurora--magenta"></div>
  </div>

  <!-- VIEW 1: LOBBY -->
  <main id="lobby-view" class="lobby-view" data-active="true">
    <!-- Hero Banner (hero-arcade.jpg), Workshop Bar (Nickname/Team, Seed, Preset Chips, Invite/QR, SFX, Hall of Fame, MC Guide), 4 Game Cards -->
    <section id="hero-banner" class="hero-banner"></section>
    <section id="workshop-bar" class="workshop-bar"></section>
    <section id="game-grid" class="game-grid"></section>
  </main>

  <!-- VIEW 2: ACTIVE GAME -->
  <section id="game-view" class="game-view" hidden>
    <header id="game-hud" class="game-hud" role="banner">
      <div class="game-hud__left">
        <button id="hud-exit-btn" class="hud-btn hud-btn--ghost" type="button" aria-label="로비로 나가기">
          <span aria-hidden="true">←</span>
          <span class="game-hud__back-label">로비</span>
        </button>
        <div class="game-hud__identity">
          <span id="hud-game-title" class="game-hud__title"></span>
          <span id="hud-mode-label" class="game-hud__mode"></span>
        </div>
      </div>

      <div class="game-hud__center">
        <span id="hud-seed-badge" class="game-hud__seed"></span>
        <div id="hud-timer" class="hud-timer" data-state="normal" aria-live="off">00:00</div>
        <div id="hud-progress-pill" class="hud-pill hud-pill--progress" hidden></div>
      </div>

      <div class="game-hud__right">
        <div id="hud-extra-slot" class="hud-extra-slot"></div>
        <div id="hud-score" class="hud-score">0 PTS</div>
        <button id="hud-pause-btn" class="hud-btn hud-btn--icon" type="button" aria-label="일시정지">⏸</button>
        <button id="hud-mute-btn" class="hud-btn hud-btn--icon" type="button" aria-label="사운드 토글">🔊</button>
      </div>

      <!-- Hairline bottom progress bar controlled via --hud-progress (0..1) -->
      <div id="hud-progress-bar" class="game-hud__progress" style="--hud-progress: 1;"></div>
    </header>

    <!-- Game mount target: 100dvh minus --hud-height -->
    <div id="game-stage" class="game-stage"></div>

    <!-- Anti-cheat pause / tab-blur curtain -->
    <div id="pause-curtain" class="pause-curtain" hidden>
      <div class="pause-curtain__card">
        <p class="pause-curtain__sub">PAUSED // FAIR PLAY LOCK</p>
        <h2 class="pause-curtain__title">잠깐 쉬는 중!</h2>
        <p class="pause-curtain__desc">공정한 플레이를 위해 화면이 가려졌습니다.</p>
        <button id="pause-resume-btn" class="btn-neon-primary" type="button">▶ 미션 재개</button>
      </div>
    </div>
  </section>

  <!-- Shared Modal, Confetti & Toast Layers -->
  <div id="modal-root" class="modal-root" hidden></div>
  <canvas id="confetti-canvas" class="confetti-canvas" aria-hidden="true"></canvas>
  <div id="toast-root" class="toast-root" aria-live="polite" aria-atomic="true"></div>

  <script type="module" src="./js/app.js"></script>
</body>
```

### 3.4 Exact HUD Selectors & Behavior
| Selector | Controlled By | Purpose & Formatting |
| :--- | :--- | :--- |
| `#game-hud` | `app.js` | Sticky top bar (`height: var(--hud-height)`, `z-index: var(--z-hud)`). |
| `#hud-exit-btn` | `app.js` | Calls `ctx.exitToHub()` (prompts confirm modal only if round is active & uncompleted). |
| `#hud-game-title` | `app.js` | Korean game title (`숨은그림찾기` etc.). |
| `#hud-mode-label` | `app.js` | Active stage/difficulty chip (e.g. `라운지 · NORMAL`, `4×4`). |
| `#hud-seed-badge` | `app.js` | Displays `#<SEED>` in `--font-mono`. Hidden `< 480px`. |
| `#hud-timer` | `ctx.updateHud({ timer })` | Displays formatted clock (`01:15` or `4.0s` / `15.0s`). Sets `data-state="normal" | "warn" | "danger"` automatically (`<= 30%` warn, `<= 10s` danger) or accepts explicit `{ text, state }`. |
| `#hud-score` | `ctx.updateHud({ score })` | Displays comma-formatted `1,250 PTS`. |
| `#hud-progress-pill` | `ctx.updateHud({ progress })` | Displays compact progress badge (e.g. `5 / 7`, `SECTOR 2/3`). Hidden if `progress` is `null`/`undefined`. |
| `#hud-progress-bar` | `ctx.updateHud({ progressRatio })` or `progress` | Updates CSS custom property `--hud-progress` (`0` to `1`) controlling `transform: scaleX(var(--hud-progress))`. |
| `#hud-extra-slot` | `ctx.updateHud({ extra })` | Renders optional per-game HUD pills/buttons (e.g., `x3 COMBO`, `♥ ♥ ♥`, or game-owned Hint button descriptor). |
| `#hud-pause-btn` | `app.js` | Toggles `#pause-curtain` and dispatches custom event `pm:pausechange` (`detail: { paused: boolean }`) on `window` so active games freeze their timers/loops. |
| `#hud-mute-btn` | `app.js` + `audio.js` | Calls `audio.setMuted(!audio.isMuted())` and syncs icon (`🔊` / `🔇`). |

**Responsive Breakpoint Rules (`styles/main.css`)**:
- `360px – 479px`: `--hud-height: 56px`, `.game-hud__back-label` and `.game-hud__seed` hidden, `.workshop-bar` 2×2 grid, `.game-grid` 1 column, touch targets `min-height: 44px; min-width: 44px;`.
- `480px – 639px`: `.game-grid` 1 column, `--hud-height: 60px`, seed badge visible.
- `640px – 1199px`: `.game-grid` `repeat(2, minmax(0, 1fr))`.
- `>= 1200px`: `--hud-height: 64px`, `.game-grid` `repeat(4, minmax(0, 1fr))`, 3D hover tilt (`--rx`, `--ry` max `±6deg`) & spotlight active on `@media (hover: hover) and (pointer: fine)`.
- `@media (prefers-reduced-motion: reduce)`: Disables aurora drift, `hud-pulse`, card 3D transitions, and canvas confetti particles.
- Global Korean rule: `word-break: keep-all; overflow-wrap: break-word;` on `body`, headings, and cards; `font-variant-numeric: tabular-nums;` on `#hud-timer`, `#hud-score`, and seed inputs.

---

## 4. Core JS Module Contracts

### 4.1 `js/core/seed.js` — Deterministic PRNG
Zero-dependency FNV-1a 32-bit hash + Mulberry32 generator so identical seed strings always produce identical sequences across all browsers and devices.

```js
/**
 * 32-bit FNV-1a string hash.
 * @param {string} str
 * @returns {number} Unsigned 32-bit integer
 */
export function hashSeed(str)

/**
 * Creates a deterministic Mulberry32 PRNG function returning [0, 1).
 * @param {string} seedString
 * @returns {() => number}
 */
export function createRng(seedString)

/**
 * Returns a new Fisher-Yates shuffled shallow copy of `arr` using `rng`.
 * MUST NOT mutate `arr`.
 * @template T
 * @param {() => number} rng
 * @param {readonly T[]} arr
 * @returns {T[]}
 */
export function shuffleSeeded(rng, arr)

/**
 * Picks `count` unique items from `arr` deterministically using `rng`.
 * If `count >= arr.length`, returns a seeded shuffle of all items.
 * @template T
 * @param {() => number} rng
 * @param {readonly T[]} arr
 * @param {number} count
 * @returns {T[]}
 */
export function pickSeeded(rng, arr, count)
```

**Spatial Dispersion Rule (recommended helper or inline in Hidden Object & Spot the Difference)**:
When picking `K` items from spatial candidates, shuffle candidates with `shuffleSeeded(rng, pool)`, then greedily accept items whose normalized center distance to already-picked items satisfies $d \ge 0.12$ and prioritizes covering all 4 quadrants before falling back to remaining shuffled candidates if needed. This guarantees 100% determinism and prevents item clustering.

---

### 4.2 `js/core/audio.js` — Web Audio API Synthesizer
Pure Web Audio API synthesis (`AudioContext` lazily initialized and `.resume()`d on first user gesture). Reads/writes mute state via `storage` (or `pm_arcade_v1_muted` key) so mute persists across reloads.

```js
export function playClick()        // Crisp 18ms UI tap (triangle 660Hz -> 440Hz)
export function playFlip()         // 70ms card whoosh/flip (filtered noise + sine sweep 280->520Hz)
export function playMatch(combo=1) // Rising pentatonic ping; pitch scales with combo (capped at combo=6)
export function playError()        // 160ms low sawtooth buzz (150Hz -> 110Hz), soft gain
export function playHint()         // 220ms dual-tone radar chime (880Hz + 1320Hz)
export function playTick()         // 35ms sharp woodblock/clock tick (1000Hz) for final 10s / memorize countdown
export function playClear()        // 4-note bright arcade victory arpeggio (C5-E5-G5-C6)
export function playAlarm()        // Urgent double-pulse descending siren (520Hz->260Hz x2) for Fortress blackout/fail
export function setMuted(bool)     // Persists boolean and silences active gain immediately
export function isMuted()          // Returns boolean
```

*Constraint*: Every `play*()` function MUST safely no-op if `isMuted()` is `true` or `AudioContext` is unavailable, and NEVER throw.

---

### 4.3 `js/core/storage.js` — Local Persistence
All keys are prefixed with `pm_arcade_v1_` in `localStorage` with safe `try/catch` JSON fallbacks (private browsing / full quota safe).

**Storage Keys**:
- `pm_arcade_v1_profile`: `{ nickname: string, team: string }` (defaults: `{ nickname: '익명요원', team: '' }`)
- `pm_arcade_v1_pb`: `{ [gameId]: { [mode]: { score, timeMs, accuracy, grade, seed, updatedAt } } }`
- `pm_arcade_v1_runs`: Array (capped at latest `200` runs) of `{ gameId, mode, modeLabel, seed, nickname, team, score, timeMs, accuracy, grade, timestamp }`
- `pm_arcade_v1_seeds`: Array (capped at latest `10` unique seeds) of `{ seed, lastUsedAt }`
- `pm_arcade_v1_muted`: `'1' | '0'`

**Exported API**:
```js
export function getProfile()                      // -> { nickname: string, team: string }
export function saveProfile({ nickname, team })   // Trims: nickname max 12 chars, team max 10 chars
export function getPersonalBest(gameId, mode)     // -> record | null
export function getAllPersonalBests()             // -> { [gameId]: { [mode]: record } }
export function recordRun(runEntry)               // Appends to runs (max 200), updates PB if score > prev.score (tie-break: timeMs < prev.timeMs). Returns { isNewRecord: boolean, personalBest: record }
export function getRuns({ seed, gameId } = {})    // Filtered & sorted (score desc, timeMs asc, accuracy desc)
export function getSeedHistory()                  // -> string[] (recent seeds, most recent first)
export function addSeedHistory(seed)              // Normalizes uppercase/trimmed, deduplicates, caps at 10
export function getMuted()                        // -> boolean
export function setMutedFlag(bool)                // -> void
```

---

### 4.4 `js/core/ui.js` — Shared UI, Grading, Confetti, Result Formatter & QR

```js
/**
 * Computes arcade rank grade from score and optional completion flag.
 * @param {number} score
 * @param {object} [opts]
 * @param {boolean} [opts.cleared=true] - If false (timeout/fail), caps at 'C'
 * @returns {{ grade: 'S'|'A'|'B'|'C', titleKo: string, badgeEn: string, colorVar: string, copy: string }}
 * Thresholds (when cleared=true):
 *   S: score >= 6800  -> "전설의 요원" / "LEGENDARY AGENT" / --neon-gold
 *   A: score >= 5000  -> "에이스 요원" / "PRO ACE" / --neon-cyan
 *   B: score >= 3000  -> "프로 요원"   / "VETERAN CREW" / --neon-emerald
 *   C: score < 3000 or !cleared -> "생존 완료" / "SURVIVOR" / --neon-magenta
 */
export function calculateGrade(score, opts = {})

/**
 * Displays a floating neon toast notification in #toast-root.
 * @param {string} message
 * @param {'info'|'success'|'warn'|'error'} [type='info']
 * @param {number} [durationMs=2400]
 */
export function showToast(message, type = 'info', durationMs = 2400)

/**
 * Fires GPU-friendly particle confetti on #confetti-canvas (auto-stops after 3.5s).
 * Respects prefers-reduced-motion; spawns 90 particles desktop / 45 mobile.
 * @param {'S'|'A'|'B'|'C'} [tier='S']
 */
export function launchConfetti(tier = 'S')

/**
 * Formats a single-line Slack / KakaoTalk workshop scorecard string.
 * Format:
 * `[POSSIBLE MISSION] <emoji> <gameTitle> (<modeLabel>) | <nickname>(<team>) | <grade>랭크 <score>점 (<timeSec>초) | 정확도 <accuracy>% | 시드: <seed>`
 * (If team is empty, omit `(<team>)`.)
 */
export function formatResultText({ gameId, gameTitle, modeLabel, player, grade, score, timeMs, accuracy, seed })

/**
 * Parses pasted Slack/KakaoTalk result lines for the Hall of Fame projector importer.
 * @param {string} rawText
 * @returns {Array<{ gameTitle, modeLabel, nickname, team, grade, score, timeSec, accuracy, seed }>}
 */
export function parseResultLines(rawText)

/**
 * Copies text via navigator.clipboard with textarea execCommand fallback for KakaoTalk WebView.
 * @param {string} text
 * @returns {Promise<boolean>}
 */
export function copyToClipboard(text)

/**
 * Builds an absolute shareable URL preserving the current pathname (GitHub Pages subpath safe).
 * @param {{ seed: string, game?: string, mode?: string }} params
 * @returns {string}
 */
export function buildShareUrl({ seed, game, mode })

/**
 * Draws a crisp, scannable QR matrix onto a <canvas> using pure JS (zero external CDN).
 * @param {HTMLCanvasElement} canvas
 * @param {string} text
 * @param {object} [opts] - { size?: number, fg?: string, bg?: string }
 */
export function renderQrCode(canvas, text, opts = {})

/**
 * Modal lifecycle helpers operating on #modal-root.
 * Closes on ESC key or backdrop click unless { lockBackdrop: true }.
 */
export function openModal({ title, subtitle, contentEl, className, onClose, lockBackdrop })
export function closeModal()
```

---

### 4.5 `js/app.js` — Hub Controller, Router & Game Context (`ctx`)

**Responsibilities**:
1. **URL & Seed Sync**: On `DOMContentLoaded`, parses `?seed=...&game=...&mode=...` from `window.location.search`. Default seed: `'MISSION-1'` (uppercased, trimmed, max 16 chars, `[A-Z0-9-_]`). Updates URL via `history.replaceState` whenever seed or active game changes.
2. **Lobby Rendering**:
   - **Hero Banner**: Renders `./assets/images/hero-arcade.jpg` with dual scrims, live pill (`● WORKSHOP LIVE • 5–100인 동시 미션`), headline (`오늘 워크샵, 텐션 한계 돌파!`), and dual CTAs (`랜덤 미션 바로 시작` / `오늘의 시드 맞추기`).
   - **Workshop Bar**:
     - Inline Player & Team editor (`nickname`, `team`) persisted via `storage.saveProfile()`.
     - Room Seed input + preset chips (`ROUND 1`, `ROUND 2`, `ROUND 3`, `ROUND 4`, `ROUND 5`, `🎲 랜덤`).
     - Action buttons: `🔗 초대 링크 복사`, `📱 QR 코드`, `🏆 명예의 전당`, `🎙️ MC 가이드`, `🔊/🔇 SFX`.
   - **4 Game Cards (`#game-grid`)**:
     - Each card displays thumbnail, difficulty tag, Personal Best badge for `currentSeed` or overall best, interactive stage/mode selector pills, witty 2-line Korean hook, estimated time, and `출격 (PLAY →)` button.
     - Cards for `hidden-object` and `spot-difference` swap thumbnail previews live when switching `Stage 1` / `Stage 2` pills before launching.
     - Desktop `@media (hover: hover) and (pointer: fine)` applies lightweight `--rx`/`--ry`/`--mx`/`--my` 3D tilt.
3. **Game Lifecycle & Dynamic Import**:
   - Dynamically imports `./games/${gameId}.js`.
   - Seeds the game deterministically: `const rng = createRng(`${seed}::${gameId}::${mode}`);`
   - Calls `activeInstance = mod.mount(stageEl, ctx)`.
   - Handles `visibilitychange` (auto-shows `#pause-curtain` and dispatches `pm:pausechange` `{ paused: true }`).
   - On `exitToHub()` or switching games: calls `activeInstance?.unmount()`, clears `#game-stage`, resets HUD state, restores `#lobby-view`.
   - On `completeGame(payload)`: records run via `storage.recordRun(...)`, computes rank via `ui.calculateGrade(...)`, triggers `audio.playClear()` (or `playAlarm()` if `cleared === false`), launches `ui.launchConfetti(...)` for `S`/`A`, and opens the **Result Modal** (`S/A/B/C` crest, 2×2 score breakdown, `NEW RECORD!` pill, `📋 결과 복사 (Slack/카톡용)`, `🔄 같은 시드로 재도전`, `🕹️ 아케이드 로비`).

#### Exact `ctx` Contract Passed to `mount(container, ctx)`
```js
const ctx = {
  seed,       // string, e.g. "MISSION-1"
  mode,       // string, e.g. "stage1-normal" | "4x4" | "standard"
  player,     // { nickname: string, team: string }
  rng,        // () => number (already seeded for `${seed}::${gameId}::${mode}`)
  audio,      // { playClick, playFlip, playMatch, playError, playHint, playTick, playClear, playAlarm, setMuted, isMuted }
  ui,         // { calculateGrade, showToast, launchConfetti, formatResultText, copyToClipboard, buildShareUrl, renderQrCode, openModal, closeModal }
  storage,    // { getProfile, saveProfile, getPersonalBest, recordRun, getRuns, ... }

  /**
   * Updates the shared top HUD. Games may omit fields they do not want to change.
   * @param {object} patch
   * @param {number|string|{ text: string, state?: 'normal'|'warn'|'danger' }} [patch.timer]
   *   - If number (seconds remaining): formatted as MM:SS (or SS.Xs if < 10s), auto-sets state ('warn' <= 15s, 'danger' <= 7s).
   *   - If string or object: rendered directly.
   * @param {number} [patch.score] - Integer score, rendered as `1,250 PTS`
   * @param {string|null} [patch.progress] - e.g. `"4 / 7"` or `"SECTOR 2/3"` in #hud-progress-pill
   * @param {number} [patch.progressRatio] - 0..1 float controlling #hud-progress-bar width
   * @param {string|HTMLElement|null} [patch.extra] - Optional badge/element in #hud-extra-slot (e.g., lives `♥♥♥` or `x4 COMBO`)
   */
  updateHud({ timer, score, progress, progressRatio, extra }) {},

  /**
   * Signals round end (clear or timeout/fail). `app.js` stops accepting HUD updates for this run,
   * saves PB/run history, plays sound/confetti, and shows the shared Result Modal.
   * @param {object} result
   * @param {number} result.score       - Final non-negative integer score
   * @param {number} result.timeMs      - Exact elapsed active play time in milliseconds (via performance.now())
   * @param {number} result.accuracy    - 0..100 integer percentage
   * @param {boolean} [result.cleared=true] - False if time over / shields depleted
   * @param {string} result.modeLabel   - Human-readable Korean mode label (e.g. "라운지 · 노말", "4×4 스탠다드", "3구역 탈출")
   * @param {Array<{ label: string, value: string }>} [result.details] - Exactly 2–4 breakdown rows for the 2x2 Result Modal grid
   */
  completeGame({ score, timeMs, accuracy, cleared = true, modeLabel, details }) {},

  /**
   * Unmounts the active game and returns cleanly to the Lobby view.
   */
  exitToHub() {}
};
```

#### Exact Game Module Export Contract
Every file in `js/games/*.js` MUST export:
```js
/**
 * @param {HTMLElement} container - Reference to #game-stage (empty at call time)
 * @param {object} ctx - Shared Game Context from app.js
 * @returns {{ unmount: () => void }}
 */
export function mount(container, ctx) {
  // 1. Render scoped root inside `container`
  // 2. Listen to `window` 'pm:pausechange' event: (e) => { isPaused = e.detail.paused; }
  // 3. Return cleanup handle
  return {
    unmount() {
      // Cancel all requestAnimationFrame / setTimeout / setInterval
      // Remove all window/document event listeners (keydown, resize, pm:pausechange)
      // Clear container.innerHTML = ''
    }
  };
}
```
*Strict Rule*: A game MUST NEVER leak `requestAnimationFrame`, intervals, or `window` listeners after `unmount()`. Every game MUST pause its internal clock when `pm:pausechange` fires with `e.detail.paused === true` and adjust elapsed `performance.now()` delta so paused time is never counted against `timeMs`.

**History Contract (hub owned)**: entering a game `pushState`s `?game=&mode=`, returning to the lobby walks back through that entry, and `popstate` while a game is mounted performs the same unmount + lobby render as the `로비로` button. Deep links (`?game=...`) first `replaceState` a lobby entry so the browser Back button never leaves the arcade site. Games must not touch `history` themselves.

---

## 5. Common Fairness, Input & Anti-Cheat Rules

1. **Normalized Coordinate System**: All hit-testing in canvas-based games (`hidden-object`, `spot-difference`, `despair-fortress`) MUST use normalized `[0.0..1.0, 0.0..1.0]` coordinates relative to the drawn image/board rect, independent of device pixel ratio (`devicePixelRatio`) or CSS scaling.
2. **Mobile Touch Hit Slop**: When `event.pointerType === 'touch'`, automatically add `+0.012` (~10–15px) to the hit radius `r`.
3. **Spam-Click Cooldown**: On any wrong click/tap, trigger a **450ms input cooldown** (ignoring rapid multi-finger taps or accidental double-taps during penalty feedback).
4. **Pause Curtain & Tab Switch**: Whenever `paused` is `true`, `#pause-curtain` covers `#game-stage` with an opaque blur so players cannot memorize or search while the clock is stopped.
5. **Double-Completion Guard**: Games MUST maintain a `finished` boolean flag so `ctx.completeGame(...)` can never be called more than once per `mount()`.

---

## 6. Mini-Game Detailed Specifications

### 6.1 Game 1: 숨은그림찾기 (`js/games/hidden-object.js`)
- **CSS Scope**: `.game-hidden` in `styles/game-hidden.css`
- **Assets**:
  - `stage1-*`: `./assets/images/hidden-workshop.jpg` (`1376 × 768`, 크리에이티브 라운지)
  - `stage2-*`: `./assets/images/hidden-space.jpg` (`1376 × 768`, 궤도 관측소)
- **Modes & Parameters**:
  - `stage1-normal` / `stage2-normal`: Pick **7 items** from 18-item pool / **75s** limit / **2 Hints**
  - `stage1-hard` / `stage2-hard`: Pick **10 items** from 18-item pool / **90s** limit / **2 Hints**
- **Selection & Rendering**:
  - Use `ctx.rng` with spatial dispersion ($d \ge 0.12$, covering all 4 quadrants first) to select the 7 or 10 target items.
  - Draw ONLY the selected items onto the `<canvas>` over the stage JPG using deterministic **Canvas vector illustrations** (`#1E1824` `2px` outline, subtle directional drop shadow, `0.92` alpha blend, size ~`38–48px` at 1376px base width).
  - Render the bottom/side **Target Dock** using the **exact same vector drawing helper** (rendered into mini `<canvas>` or matching SVG paths) + Korean label so targets match 1:1 visually.
- **Magnifier Loupe (`2.2x`, `140px` diameter, cyan rim + crosshair)**:
  - **Desktop**: Tracks pointer hover over canvas (`M` key toggles on/off).
  - **Mobile (`touch`)**: Tap vs Drag split — short tap (`< 180ms` and `< 8px` move) checks hit immediately; hold/drag (`>= 180ms` or `>= 8px` move) activates the `2.2x` loupe **72px above the finger** (flips below finger when `y < 100px`) and **never triggers a miss penalty on `pointerup`**.
- **Interactions, Hints & Penalties**:
  - **Hit**: `audio.playMatch(++streak)`, 12-particle sparkle burst + `+500` popup, green checkmark locked in Target Dock.
  - **Already Found Re-tap**: Zero penalty, subtle toast `"이미 찾은 아이템!"`.
  - **Miss**: `audio.playError()`, deduct **3.0s** from remaining timer (`-3.0s` red flash), red `×` shake at tap point, reset `streak = 0`, activate **450ms cooldown**.
  - **Hint (`H` key or HUD/Dock button, max 2)**: `audio.playHint()`, displays a **4.0s** pulsing cyan/gold radar beacon (`r = 0.08`) around the unfound item farthest from the last tap + highlights its Target Dock card.
- **Scoring Formula**:
  - $F$ = found count, $N \in \{7, 10\}$, $T_{\text{rem}}$ = remaining seconds ($\ge 0$), $S_{\max}$ = max streak, $H$ = hints used, $W$ = wrong taps.
  - $\text{Base} = F \times 500$
  - $\text{TimeBonus} = (F === N) ? \text{round}(T_{\text{rem}} \times 45) : 0$
  - $\text{StreakBonus} = S_{\max} \times 100$
  - $\text{PerfectBonus} = (F === N \land W === 0 \land H === 0) ? 1000 : 0$
  - $\text{TotalScore} = \max(0,\ \text{Base} + \text{TimeBonus} + \text{StreakBonus} + \text{PerfectBonus} - H \times 300 - W \times 50)$
  - `accuracy = totalInputs > 0 ? Math.round((F / totalInputs) * 100) : 0`

#### Stage 1 Curated Pool: `./assets/images/hidden-workshop.jpg` (`1376 × 768`)
| ID | 라벨 | 비주얼 특징 | `(x, y)` | `r` | 회전 |
| :--- | :--- | :--- | :---: | :---: | :---: |
| `paper-plane` | 종이비행기 | 하늘색 접이선 있는 흰 종이비행기 | `(0.790, 0.125)` | `0.040` | `-12°` |
| `golden-key` | 황금 열쇠 | 앤티크 황동 열쇠 | `(0.485, 0.825)` | `0.038` | `25°` |
| `mini-trophy` | 미니 트로피 | 반짝이는 작은 황금 컵 | `(0.132, 0.315)` | `0.038` | `0°` |
| `usb-drive` | USB 메모리 | 네온 퍼플 바디 + 실버 단자 | `(0.805, 0.725)` | `0.038` | `-35°` |
| `croissant` | 크루아상 | 노릇한 초승달 빵 | `(0.265, 0.945)` | `0.040` | `8°` |
| `dice-d20` | 20면 주사위 | 에메랄드빛 다면체 주사위 | `(0.260, 0.680)` | `0.038` | `15°` |
| `cassette` | 카세트 테이프 | 레트로 오렌지/크림 테이프 | `(0.115, 0.525)` | `0.040` | `8°` |
| `glasses` | 둥근 안경 | 금테/호피무늬 둥근 안경 | `(0.395, 0.675)` | `0.040` | `-5°` |
| `sticky-star` | 별 포스트잇 | 형광 마젠타 별 모양 메모 | `(0.915, 0.255)` | `0.040` | `10°` |
| `pocket-watch` | 회중시계 | 체인 달린 황동 시계 | `(0.642, 0.695)` | `0.038` | `0°` |
| `origami-crane` | 종이학 | 코랄 핑크 종이학 | `(0.345, 0.505)` | `0.038` | `0°` |
| `screwdriver` | 드라이버 | 빨간 손잡이 정밀 드라이버 | `(0.775, 0.605)` | `0.040` | `18°` |
| `badge-id` | 사원증 | 파란 목걸이 줄 달린 ID 카드 | `(0.742, 0.725)` | `0.042` | `-8°` |
| `compass` | 나침반 | 민트/황동 원형 나침반 | `(0.585, 0.915)` | `0.038` | `0°` |
| `paint-tube` | 물감 튜브 | 코발트 블루 아크릴 물감 | `(0.955, 0.810)` | `0.038` | `-20°` |
| `tiny-crown` | 미니 왕관 | 보석 박힌 작은 금관 | `(0.578, 0.312)` | `0.038` | `-6°` |
| `cookie` | 초코칩 쿠키 | 진한 초코칩이 박힌 쿠키 | `(0.032, 0.915)` | `0.038` | `0°` |
| `magnifying-charm` | 미니 돋보기 | 황동 단안경/루페 참 | `(0.252, 0.525)` | `0.038` | `30°` |

#### Stage 2 Curated Pool: `./assets/images/hidden-space.jpg` (`1376 × 768`)
| ID | 라벨 | 비주얼 특징 | `(x, y)` | `r` | 회전 |
| :--- | :--- | :--- | :---: | :---: | :---: |
| `mini-ufo` | 미니 UFO | 시안 돔을 가진 은빛 비행접시 | `(0.295, 0.195)` | `0.040` | `-10°` |
| `rocket-badge` | 로켓 배지 | 레드/화이트 에나멜 핀 | `(0.032, 0.510)` | `0.038` | `12°` |
| `star-cookie` | 별 우주쿠키 | 금빛 별 모양 스페이스 비스킷 | `(0.345, 0.665)` | `0.038` | `15°` |
| `meteor-gem` | 운석 보석 | 마젠타 빛 다면체 크리스탈 | `(0.185, 0.945)` | `0.038` | `0°` |
| `laser-pointer` | 레이저 포인터 | 크롬/시안 광선 펜라이트 | `(0.305, 0.575)` | `0.040` | `-15°` |
| `alien-duck` | 우주 오리 | 헬멧 쓴 노란 러버덕 | `(0.688, 0.625)` | `0.040` | `0°` |
| `crescent-wrench` | 우주 스패너 | 은빛 메탈 스패너 | `(0.382, 0.745)` | `0.040` | `32°` |
| `flux-battery` | 에너지 셀 | 형광 그린 원통형 배터리 | `(0.872, 0.635)` | `0.038` | `0°` |
| `data-disk` | 데이터 디스크 | 홀로그램 사각 카트리지 | `(0.735, 0.865)` | `0.038` | `8°` |
| `saturn-key` | 행성 열쇠 | 토성 고리 손잡이 황동 키 | `(0.455, 0.925)` | `0.040` | `10°` |
| `space-cat-mug` | 고양이 머그 | 고양이 귀 달린 흰 머그컵 | `(0.695, 0.505)` | `0.038` | `0°` |
| `mini-satellite` | 초소형 위성 | 금박 큐브 + 태양광 날개 | `(0.795, 0.185)` | `0.040` | `20°` |
| `astro-boots` | 우주 부츠 | 화이트/오렌지 미니 우주화 | `(0.585, 0.535)` | `0.038` | `-6°` |
| `gravity-dice` | 무중력 주사위 | 반투명 시안 큐브 주사위 | `(0.662, 0.855)` | `0.038` | `18°` |
| `nebula-bottle` | 성운 유리병 | 보라 성운이 담긴 코르크 병 | `(0.115, 0.055)` | `0.038` | `0°` |
| `solar-compass` | 태양 나침반 | 금빛 아스트롤라베 다이얼 | `(0.515, 0.565)` | `0.038` | `0°` |
| `circuit-chip` | 마이크로 칩 | 금색 핀 달린 에메랄드 칩 | `(0.895, 0.745)` | `0.038` | `-18°` |
| `comet-feather` | 혜성 깃털펜 | 빛나는 시안/골드 깃털 펜 | `(0.285, 0.765)` | `0.040` | `40°` |

---

### 6.2 Game 2: 틀린그림찾기 (`js/games/spot-difference.js`)
- **CSS Scope**: `.game-spot` in `styles/game-spot.css`
- **Assets**:
  - `stage1-*`: `./assets/images/spot-cafe.jpg` (`1200 × 896`, 보드게임 디저트 카페)
  - `stage2-*`: `./assets/images/spot-camp.jpg` (`1200 × 896`, 골든아워 어드벤처 캠프)
- **Modes & Parameters**:
  - `stage1-normal` / `stage2-normal`: Pick **6 anomalies** from 10-item pool / **60s** limit / **2 Hints**
  - `stage1-hard` / `stage2-hard`: Pick **8 anomalies** from 10-item pool / **75s** limit / **2 Hints**
- **Dual-Canvas Procedural Modification Pipeline**:
  - Render base image on `Original` `<canvas>` and `Modified` `<canvas>`.
  - Apply ONLY the `N` seeded anomalies to `Modified` using 3 clean techniques:
    1. `color-swap`: Read `ImageData` within circular/elliptical soft mask; rotate HSL hue (`+110°..+185°` or specified delta) ONLY on pixels with `luminance >= 0.22` (preserving dark `#1E1824` illustration outlines 100%).
    2. `patch-remove`: Clone adjacent clean texture patch over the target object to remove it seamlessly.
    3. `cel-prop`: Draw crisp `2px #1E1824` outlined cel-shaded vector detail (or patch face + redraw hands/suit).
- **Synchronized Interaction & Layout**:
  - **Desktop (`>= 900px`)**: Side-by-side layout (`Original` left, `Modified` right) + **Mirror Crosshair** on opposite canvas at identical normalized `(x, y)` during pointer hover.
  - **Mobile (`< 900px`)**: Stacked top/bottom layout + optional `2.0x` zoom loupe toggle (NO overlay-flicker cheat button).
  - Clicking/tapping **either** canvas marks **both** canvases simultaneously with neon green check rings + sparkle burst on hit, or dual red `×` + **-3.0s penalty** + **450ms cooldown** on miss.
  - **Hint (`H`, max 2)**: Pulses a **3.5s** dashed gold search zone (`r = 0.095`) on **both** canvases simultaneously.
- **Scoring Formula**:
  - $\text{Base} = F \times 600$
  - $\text{TimeBonus} = (F === N) ? \text{round}(T_{\text{rem}} \times 50) : 0$
  - $\text{StreakBonus} = S_{\max} \times 120$
  - $\text{PerfectBonus} = (F === N \land W === 0 \land H === 0) ? 1000 : 0$
  - $\text{TotalScore} = \max(0,\ \text{Base} + \text{TimeBonus} + \text{StreakBonus} + \text{PerfectBonus} - H \times 350 - W \times 50)$

#### Stage 1 Curated Pool: `./assets/images/spot-cafe.jpg` (`1200 × 896`)
| ID | 한글 설명 | 기법 | 변경 내용 (원본 → 변형) | `(x, y)` | `r` |
| :--- | :--- | :---: | :--- | :---: | :---: |
| `cafe-lamp-blue` | 왼쪽 펜던트 조명 색상 | `color-swap` | 하늘색 조명등 → 오렌지/코랄 (`hue +155°`) | `(0.402, 0.145)` | `0.055` |
| `cafe-clock-hands` | 벽시계 바늘 시각 | `cel-prop` | `10시 10분` → 크림 패치 후 `3시 30분` (+빨간 초침) | `(0.292, 0.118)` | `0.060` |
| `cafe-mug-middle` | 쇼케이스 위 가운데 머그 | `color-swap` | 민트색 머그 → 퍼플/마젠타 (`hue +140°`) | `(0.172, 0.568)` | `0.048` |
| `cafe-cake-frosting` | 진열장 상단 중앙 케이크 | `color-swap` | 핑크 크림 → 민트 피스타치오 크림 (딸기 색 유지) | `(0.242, 0.642)` | `0.052` |
| `cafe-vase-flowers` | 카운터 좌측 꽃병 꽃 색 | `color-swap` | 노랑/분홍 꽃잎 → 일렉트릭 블루 꽃잎 | `(0.068, 0.555)` | `0.052` |
| `cafe-barista-apron` | 바리스타 앞치마 색상 | `color-swap` | 갈색 앞치마 → 에메랄드 틸 그린 (`hue +140°`) | `(0.388, 0.525)` | `0.060` |
| `cafe-girl-shirt` | 창가 여성 티셔츠 색상 | `color-swap` | 노란색 반팔 티 → 로열 라벤더 퍼플 (`hue +185°`) | `(0.742, 0.580)` | `0.055` |
| `cafe-green-pawn` | 앞 테이블 초록 말 제거 | `patch-remove` | 주사위 옆 초록 보드게임 말 제거 (나무 테이블 패치) | `(0.836, 0.880)` | `0.048` |
| `cafe-card-suit` | 앞 테이블 카드 문양 | `cel-prop` | 빨간 하트(♥) → 흰 패치 후 검은 스페이드(♠) | `(0.708, 0.872)` | `0.050` |
| `cafe-window-bird` | 창밖 하늘 새 추가 | `cel-prop` | 창문 우측 상단 하늘 → 날아가는 빨간/흰 작은 새 추가 | `(0.885, 0.130)` | `0.055` |

#### Stage 2 Curated Pool: `./assets/images/spot-camp.jpg` (`1200 × 896`)
| ID | 한글 설명 | 기법 | 변경 내용 (원본 → 변형) | `(x, y)` | `r` |
| :--- | :--- | :---: | :--- | :---: | :---: |
| `camp-tent-flap` | 텐트 옆 말린 창문 덮개 | `color-swap` | 노란색 천 → 마젠타 핑크 (`hue -55°`) | `(0.148, 0.468)` | `0.052` |
| `camp-sleeping-pad` | 텐트 옆 말린 침낭 매트 | `color-swap` | 주황색 매트 → 로열 블루 (`hue +175°`) | `(0.098, 0.688)` | `0.058` |
| `camp-kettle-red` | 모닥불 위 주전자 색상 | `color-swap` | 은빛 주전자 → 레드 법랑 주전자 | `(0.492, 0.502)` | `0.052` |
| `camp-sign-bird` | 이정표 위 새 추가 | `cel-prop` | 나무 이정표 꼭대기 → 앉아 있는 노란/주황 새 추가 | `(0.714, 0.210)` | `0.052` |
| `camp-lantern-cyan` | 통나무 위 랜턴 불빛 | `color-swap` | 노란 랜턴 불꽃/테두리 → 에메랄드 시안 불빛 | `(0.908, 0.495)` | `0.055` |
| `camp-picnic-mug` | 돗자리 위 머그컵 색상 | `color-swap` | 하늘색 머그 → 밝은 옐로우 머그 | `(0.658, 0.805)` | `0.048` |
| `camp-green-apple` | 돗자리 위 사과 색상 | `color-swap` | 빨간 사과 → 청사과 (`hue +115°`) | `(0.724, 0.822)` | `0.048` |
| `camp-bottle-pink` | 배낭 옆 물병 색상 | `color-swap` | 파란 물병 → 핫핑크 물병 (`hue +130°`) | `(0.935, 0.835)` | `0.048` |
| `camp-flowers-violet` | 좌하단 바위 옆 꽃 색상 | `color-swap` | 분홍/주황 들꽃 → 바이올렛 블루 꽃잎 | `(0.048, 0.815)` | `0.055` |
| `camp-mushroom` | 우측 그루터기 옆 버섯 | `cel-prop` | 빈 풀밭 → 빨간 갓 흰 점박이 버섯 추가 | `(0.798, 0.655)` | `0.050` |

---

### 6.3 Game 3: 네온 메모리 매치 (`js/games/memory-match.js`)
- **CSS Scope**: `.game-memory` in `styles/game-memory.css`
- **Modes & Parameters**:
  - `4x3`: `3×4` portrait / `4×3` landscape — **6 pairs (12 cards)** / **2.0s preview** / **45s** limit
  - `4x4`: `4×4` — **8 pairs (16 cards)** / **2.0s preview** / **60s** limit
  - `6x4`: `4×6` portrait / `6×4` landscape — **12 pairs (24 cards)** / **2.0s preview** / **80s** limit
- **12-Symbol Deck (High-Contrast Colorblind-Safe SVG + Short Korean Label)**:
  `로켓`, `트로피`, `커피`, `게임기`, `별`, `번개`, `카메라`, `다이아`, `로봇`, `왕관`, `지구`, `피자`.
  Use `pickSeeded(ctx.rng, SYMBOLS, pairs)` then `shuffleSeeded(ctx.rng, doubledDeck)`.
- **Round Flow & Input Rules**:
  1. **Preview Flash (`2.0s`)**: Stagger-reveal all cards (`15ms` per card), show `"암기 시작! 2.0s"` banner. Main timer is frozen and clicks are locked. At `2.0s`, flip all cards face-down (`rotateY(180deg)`, `320ms cubic-bezier(0.22, 1, 0.36, 1)`) via `audio.playFlip()` and start countdown.
  2. **Match (`0ms` input lock!)**: Immediately allow opening the next pair! Trigger `audio.playMatch(++combo)`, gold-cyan glow + `COMBO xN!` popup.
  3. **Mismatch**: Show both cards for `600ms` with horizontal shake + `audio.playError()`, reset `combo = 0`, lock 3rd card input ONLY during those `600ms`.
  4. **Keyboard Support**: Arrow keys move focus across grid, `Enter`/`Space` flips card.
- **Scoring Formula**:
  - $P \in \{6, 8, 12\}$, $M$ = matched pairs, $V$ = total pair attempts (Moves), $T_{\text{rem}}$ = remaining seconds, $C_i$ = combo at $i$-th match ($1$-indexed).
  - $\text{MatchScore} = \sum_{i=1}^{M} \big(300 + \min(C_i - 1, 5) \times 120\big)$
  - $\text{TimeBonus} = (M === P) ? \text{round}(T_{\text{rem}} \times 55) : 0$
  - $\text{EfficiencyBonus} = (M === P) ? \max(0, (2P - V) \times 100) : 0$
  - $\text{PerfectBonus} = (M === P \land V === P) ? 1200 : 0$
  - $\text{TotalScore} = \text{MatchScore} + \text{TimeBonus} + \text{EfficiencyBonus} + \text{PerfectBonus}$
  - `accuracy = V > 0 ? Math.round((M / V) * 100) : 0`

---

### 6.4 Game 4: 절망요새 숨바꼭질 (`js/games/despair-fortress.js`)
- **CSS Scope**: `.game-fortress` in `styles/game-fortress.css`
- **Asset**: `./assets/images/fortress-bg.jpg` (`1376 × 768`) with dark terminal scanline & red alert vignette overlay.
- **Mode**: `standard` — 3 consecutive security sectors, **3 shared Shields (`♥ ♥ ♥`)**.
- **Sector Progression**:
  | Sector | Label | Nodes | Letters | Memorize | Movement & Gimmick | Decode Limit | Base Pts/Slot |
  | :---: | :--- | :---: | :---: | :---: | :--- | :---: | :---: |
  | `1` | 제1구역: 외곽 격납고 | `6` | `A`–`F` | `4.0s` | Static + gentle hover (`±4px`, zero overlap) | `15.0s` | `400` |
  | `2` | 제2구역: 중앙 제어실 | `8` | `A`–`H` | `4.0s` | Smooth drift (`55–75 px/s`) + safe-area bounce + pairwise repulsion | `15.0s` | `550` |
  | `3` | 제3구역: 절대 영점 금고 | `10` | `A`–`J` | `4.5s` | Fast drift (`85–115 px/s`) + repulsion + **Decoy Blink** | `15.0s` | `700` |
- **4-Phase Micro-Loop per Sector**:
  1. `LOCK-ON` (`1.8s` for Sector 1, `0.8s` afterwards): Spawn nodes inside safe play area with pairwise repulsion ensuring zero overlap. Assign unique 2-digit numbers (`03`–`98`, zero-padded) with **no mirror-pair collisions** (e.g., if `17` is chosen, `71` is forbidden in that sector).
  2. `MEMORIZE`: Show both large letter (`A..J`) and 2-digit number (`03..98`). `audio.playTick()` pulses during final `1.5s`.
  3. `BLACKOUT` (`0.35s`): `audio.playAlarm()` / EMP flash; numbers vanish (`opacity: 0`), leaving ONLY letter badges.
  4. `TERMINAL DECODE` (`15.0s`): Terminal header displays 3 distinct target numbers in order: e.g. `CODE: [17] - [04] - [82]` (active slot highlighted cyan).
     - **Dual Input**: Direct tap/click on floating node (`r = 0.048`, `+0.012` touch slop) **OR** keyboard `A–J` **OR** tactile `A–J` keypad buttons (prevents mobile frustration on fast Sector 3 nodes).
     - **SIGNAL LEAK (beginner mercy pulse)**: every `4.6s` of decode time, all still-unsolved numbers reappear for `0.68s` (cyan arena glow + `신호 누출!` banner + hint chime, fading out over the last `180ms`). First pulse fires at `3.0s`. This keeps the game a memory test while never leaving a player completely stuck; it never reveals solved slots or decoy data.
- **Fairness Rule for Sector 3 `Decoy Blink`**:
  - NEVER swap a node's true letter-number pairing.
  - During memorize (`1.2s..3.2s` window only): flash red border on 2 random nodes for `180ms` with `"교란 신호 감지! GLITCH"` banner.
  - During decode: flash brief red warning rings on 2 wrong nodes and fake HUD text (`FAKE: 66`) in side telemetry only.
- **Shields & End Conditions**:
  - **Hit**: Lock slot `[17 ✓]`, `audio.playMatch(++streak)`, disable already-solved node for remainder of sector.
  - **Miss**: `-1 ♥` shield, `audio.playError()`, red `"ACCESS DENIED — 재시도!"` + `350ms` screen shake, reset `streak = 0` (active slot stays open).
  - **Fail**: `shields === 0` OR sector decode timer reaches `0.0s` → `audio.playAlarm()`, call `ctx.completeGame({ ..., cleared: false })`.
  - **Clear**: All 9 slots across 3 sectors solved → `ctx.completeGame({ ..., cleared: true })`.
- **Scoring Formula**:
  - $\text{SlotPoints} = \sum_{\text{solved}} \text{SectorBase}_k$
  - $\text{StreakBonus} = \sum_{\text{solved},\ C_j \ge 2} \big(60 \times \min(C_j, 9)\big)$
  - $\text{FastBonus} = \sum_{k \in \text{cleared sectors}} \text{round}\big(\max(0, 15.0 - t_{\text{decode}, k}) \times 80\big)$
  - $\text{ShieldSurvivalBonus} = (\text{allCleared}) ? (L_{\text{rem}} \times 400) : 0$
  - $\text{TotalScore} = \text{SlotPoints} + \text{StreakBonus} + \text{FastBonus} + \text{ShieldSurvivalBonus}$

---

## 7. Parallel Implementation Checklist (Zero-Conflict Handoff)

| Assignee | Owned Files | Verification Gate |
| :--- | :--- | :--- |
| **Core Lead** | `index.html`, `styles/main.css`, `js/core/seed.js`, `js/core/audio.js`, `js/core/storage.js`, `js/core/ui.js`, `js/app.js` | URL `?seed=TEST&game=memory-match&mode=4x4` boots straight in; QR canvas scans; copy-result + paste-aggregator podium works; pause curtain stops game clock. |
| **Programmer A** | `styles/game-hidden.css`, `js/games/hidden-object.js` | Identical 7/10 subset on same seed; vector props match Target Dock icons 1:1; mobile drag loupe offsets `+72px` and never triggers miss on `pointerup`. |
| **Programmer B** | `styles/game-spot.css`, `js/games/spot-difference.js` | Both canvases sync marks & mirror crosshair; `color-swap` preserves dark outlines; `stage1` and `stage2` all 10 anomalies visibly distinct. |
| **Programmer C** | `styles/game-memory.css`, `js/games/memory-match.js` | 2.0s preview freezes timer; matched pairs have `0ms` lock; mismatched pairs lock `600ms`; `4x3`/`4x4`/`6x4` fit `100dvh` without overflow. |
| **Programmer D** | `styles/game-fortress.css`, `js/games/despair-fortress.js` | No mirror numbers per sector; Sector 2/3 repulsion prevents overlapping badges; keyboard `A-J` & tactile keypad work; Sector 3 decoy never alters true pairs. |
