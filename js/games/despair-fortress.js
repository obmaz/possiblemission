/**
 * Game: 숫자 숨바꼭질 (NUMBER HIDE & SEEK)
 *
 * Modelled on the "かくれんぼ" room of Fuji-Q Highland's 絶望要塞: one wall screen is
 * covered in tilted letter tiles, and every tile hides a 3-digit number behind it.
 * When a round starts every number is out; then they duck behind their tiles a few at
 * a time and keep peeking out again. The player is told which numbers to find and
 * answers with the LETTER of the tile hiding each number (tap the tile, or type it).
 *
 * Difficulty is fully configurable on an in-game setup screen (mode `setup`): six
 * presets (EASY … GOD) or custom tile count, reveal time, hide batch/interval, peek time
 * and time limit — see ./hide-seek-settings.js.
 *
 * The module id stays `despair-fortress` so existing links and records keep working.
 * Built for a single screen (e.g. a wall display in a venue).
 */
import { shuffleSeeded } from '../core/seed.js';
import { TOUCH_HIT_SLOP, WRONG_INPUT_COOLDOWN_MS } from '../core/rules.js';
import {
  DEFAULT_PRESET_ID,
  PRESETS,
  SETTING_FIELDS,
  TILE_GRID,
  hideSeekModeId,
  matchPreset,
  hideSeekModeLabel,
  maxHideBatchForTiles,
  parseHideSeekMode,
} from './hide-seek-settings.js';

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
const HANGUL = '가나다라마바사아자차카타파하'.split('');
const TARGET_COUNT = 3;
const PERFECT_BONUS = 500;
// A wrong answer costs time, so guessing is never free
const WRONG_PENALTY_SEC = 3;
const LAST_MODE_PREF = 'hideSeekLastMode';

// Timings (seconds, game clock — everything stops while paused)
const END_OVERLAY_SEC = 1.6;
const PEEK_EASE_SEC = 0.18; // how long a number takes to spring out / slide back in
const DANGER_TIME_SEC = 10;

// Game feel ("juice"): short, readable reactions — never enough to hide the wall
const FX = {
  introSec: 0.45, // tiles spring onto the wall in a wave from the centre
  introSpreadSec: 0.35,
  hoverScale: 0.07,
  pressMs: 140,
  popMs: 520, // a found letter's tiles bounce
  shakeMs: 380, // a wrong tile wobbles
  burstMs: 520, // ring that expands from a found tile
  floaterMs: 950, // "+120", "-3초" text
  flyMs: 430, // found letter flies from the wall into its box
  screenShakeMs: 240,
  screenShakePx: 7,
  sparksPerTile: 7,
  maxSparks: 260,
  clearWaveMs: 600,
};

// Spinning spiral background (INSANE / GOD or the custom toggle)
const SPIRAL_SPACING = 110; // distance between two white bands, logical px
const SPIRAL_SPEED = 1.8; // rad/s; bands flow toward the centre

// Logical wall size: the short side is fixed and the long side follows the screen's
// aspect ratio, so the wall always fills the display. Portrait screens swap the grid.
const WALL_SHORT_SIDE = 900;
const PORTRAIT_ASPECT = 0.87;
const WALL_PAD = 46;

const TILE_ANGLES = [45, 45, 38, 30, 20, 12, 0, -12, -20, -30, -38];

/** Points per found number grow with tile density, shorter reveal, and hidden ratio. */
function basePoints(settings) {
  const density = settings.tiles / 24; // 1 … 5.25
  const speed = 5 / settings.revealSec; // 1 … 3.3
  const hiddenRatio = settings.hideBatch / 9; // 0.11 … 1.0
  const duty = settings.hideSec / (settings.hideSec + settings.peekSec);
  return Math.round((200 + 60 * density + 60 * speed) * (1 + hiddenRatio * duty) * (settings.spiral ? 1.2 : 1));
}

/**
 * Pure deterministic generator: same rng seed + settings → same letters, numbers,
 * tilts, rotation order and targets on every device. One wall per game.
 * @param {() => number} rng
 * @param {object} settings - parsed values from parseHideSeekMode()
 */
export function generateFortressRun(rng, settings) {
  const [cols, rows] = TILE_GRID[settings.tiles];
  const count = cols * rows;
  const hideBatch = Math.min(settings.hideBatch, maxHideBatchForTiles(count));
  const symbols = settings.hangul ? [...LETTERS, ...HANGUL] : LETTERS;
  // Every symbol owns exactly one number, so duplicate letters hide the same number
  const numberPool = shuffleSeeded(
    rng,
    Array.from({ length: 1000 }, (_, n) => String(n).padStart(3, '0'))
  );
  const numberOf = Object.fromEntries(symbols.map((sym, i) => [sym, numberPool[i]]));
  const tiles = Array.from({ length: count }, (_, index) => {
    const letter = symbols[Math.floor(rng() * symbols.length)];
    return { index, letter, number: numberOf[letter] };
  }).map((tile) => ({
    ...tile,
    angle: TILE_ANGLES[Math.floor(rng() * TILE_ANGLES.length)],
    size: 0.74 + rng() * 0.26, // fraction of the cell
    jx: (rng() - 0.5) * 0.14, // jitter inside the cell
    jy: (rng() - 0.5) * 0.1,
    hideRank: tile.index,
  }));
  // Numbers disappear in non-overlapping round-robin batches of `hideBatch`, in a seeded order
  shuffleSeeded(rng, tiles).forEach((tile, rank) => {
    tile.hideRank = rank;
  });
  // Three different symbols to find
  const seen = new Set();
  const targets = shuffleSeeded(rng, tiles)
    .filter((tile) => !seen.has(tile.letter) && seen.add(tile.letter))
    .slice(0, TARGET_COUNT)
    .map((tile) => ({ number: tile.number, letter: tile.letter, solved: false }));
  return { cols, rows, count, hideBatch, tiles, targets };
}

/**
 * Returns 0 (hidden behind tile) … 1 (fully visible) at time `t`.
 * Tiles hide in a staggered rolling cadence so they never disappear all at once
 * when `revealSec` ends, and at most `wall.hideBatch` tiles are hidden simultaneously.
 */
export function tilePeekAt(wall, settings, tile, t) {
  if (t < PEEK_EASE_SEC) return Math.max(0, Math.min(1, t / PEEK_EASE_SEC));
  if (t < settings.revealSec) return 1;

  const hideSec = settings.hideSec;
  const n = wall.tiles.length;
  const b = Math.min(wall.hideBatch, Math.max(1, n - 1));
  const step = b === 1 ? hideSec + settings.peekSec : (hideSec + settings.peekSec * 0.5) / b;
  const cycle = n * step;
  const elapsed = t - settings.revealSec;

  // Before a tile's first scheduled turn, keep it visible (never hide all `b` on start)
  const firstStart = tile.hideRank * step;
  if (elapsed <= firstStart) return 1;

  const localT = (elapsed - firstStart) % cycle;
  if (localT >= hideSec) return 1;

  const ease = Math.min(PEEK_EASE_SEC, hideSec * 0.4);
  if (localT < ease) return 1 - localT / ease;
  if (localT > hideSec - ease) return 1 - (hideSec - localT) / ease;
  return 0;
}

/** Canvas colours come from the shared design tokens so the wall matches the shell. */
function readPalette(el) {
  const css = getComputedStyle(el);
  const pick = (name, fallback) => css.getPropertyValue(name).trim() || fallback;
  return {
    neon: pick('--neon-emerald', '#3fbf92'),
    danger: pick('--neon-crimson', '#e06767'),
    gold: pick('--neon-gold', '#d9a21b'),
    text: pick('--text-on-image', '#f6f8fc'),
    // Deep green wall, like the reference photo: lit in the middle, darker at the edges
    wallCenter: '#1e4a3f',
    wallEdge: '#0e241f',
    tile: '#e9eee9',
    tileShade: '#d9e2dc',
    tileRim: '#ffffff',
    tileInset: 'rgba(60, 72, 68, 0.5)',
    tileGlow: 'rgba(225, 255, 240, 0.32)',
    letter: '#28302c',
    solvedLetter: '#0f6e4f',
    number: '#f4faf6',
    numberGlow: 'rgba(200, 255, 230, 0.7)',
  };
}

const clamp01 = (t) => Math.max(0, Math.min(1, t));
const easeOutCubic = (t) => 1 - (1 - t) ** 3;
/** Overshoots a little before settling — the "spring" in pops and peeks. */
function easeOutBack(t) {
  const c1 = 1.70158;
  return 1 + (c1 + 1) * (t - 1) ** 3 + c1 * (t - 1) ** 2;
}

/** `rgba()` of a hex colour, for fading feedback colours. */
function withAlpha(hex, a) {
  const m = /^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(hex.trim());
  if (!m) return hex;
  return `rgba(${parseInt(m[1], 16)}, ${parseInt(m[2], 16)}, ${parseInt(m[3], 16)}, ${a})`;
}

function roundedRect(g, x, y, w, h, r) {
  g.beginPath();
  if (typeof g.roundRect === 'function') g.roundRect(x, y, w, h, r);
  else g.rect(x, y, w, h);
}

const formatValue = (field, value) => (field.valueLabels ? field.valueLabels[value] : `${value}${field.unit}`);

/** One-line plain-language summary of a set of values. */
function describe(s) {
  const extras = [s.hangul ? '한글 포함' : '', s.spiral ? '회오리 배경' : ''].filter(Boolean).join(' · ');
  return `타일 ${s.tiles}개 · 처음 ${s.revealSec}초 뒤 순차로 최대 ${s.hideBatch}개까지 ${s.hideSec}초씩 숨음 · 제한 ${s.timeSec}초${extras ? ` · ${extras}` : ''}`;
}

/**
 * @param {HTMLElement} container
 * @param {object} ctx
 * @returns {{ unmount: () => void, idle?: boolean }}
 */
export function mount(container, ctx) {
  const settings = parseHideSeekMode(ctx.mode);
  return settings ? mountGame(container, ctx, settings) : mountSetup(container, ctx);
}

/* ============================================================================
 * Setup screen (mode `setup`): presets + custom values, then start
 * ========================================================================== */
function mountSetup(container, ctx) {
  const last = parseHideSeekMode(ctx.storage.getPref?.(LAST_MODE_PREF, '') || '');
  const preset = PRESETS.find((p) => p.id === DEFAULT_PRESET_ID);
  let values = last
    ? Object.fromEntries(SETTING_FIELDS.map((f) => [f.key, last[f.key]]))
    : Object.fromEntries(SETTING_FIELDS.map((f) => [f.key, preset[f.key]]));

  const root = document.createElement('div');
  root.className = 'game-root game-fortress df-setup';
  root.innerHTML = `
    <div class="df-setup__head">
      <h2 class="df-setup__title">숫자 숨바꼭질 · 난이도</h2>
      <p class="df-setup__sub">타일 뒤에 숨은 숫자 3개를 찾아 그 타일의 <b>글자</b>를 맞히세요. 같은 룸 시드와 같은 설정이면 모두 같은 벽이 나옵니다.</p>
    </div>
    <div class="df-setup__body">
      <div class="df-presets" role="radiogroup" aria-label="난이도 프리셋">
        ${PRESETS.map(
          (p) => `
          <button type="button" class="df-preset df-preset--${p.id}" role="radio" data-preset="${p.id}">
            <span class="df-preset__name">${p.label}</span>
            <span class="df-preset__ko">${p.ko}</span>
            <span class="df-preset__meta">타일 ${p.tiles} · 최대 숨김 ${p.hideBatch}개</span>
          </button>`
        ).join('')}
      </div>
      <div class="df-fields">
        ${SETTING_FIELDS.map(
          (f) => `
          <div class="df-field" data-field="${f.key}">
            <span class="df-field__label">${f.label}</span>
            <div class="df-stepper">
              <button type="button" class="df-stepper__btn" data-step="-1" aria-label="${f.label} 줄이기">−</button>
              <output class="df-stepper__value" data-value></output>
              <button type="button" class="df-stepper__btn" data-step="1" aria-label="${f.label} 늘리기">+</button>
            </div>
          </div>`
        ).join('')}
        <p class="df-fields__summary" data-summary></p>
      </div>
    </div>
    <button type="button" class="df-setup__start" data-start>시작하기 <span aria-hidden="true">→</span></button>
  `;
  container.appendChild(root);

  function render() {
    const match = matchPreset(values);
    root.querySelectorAll('[data-preset]').forEach((btn) => {
      const on = match?.id === btn.dataset.preset;
      btn.classList.toggle('is-active', on);
      btn.setAttribute('aria-checked', String(on));
    });
    const maxBatch = maxHideBatchForTiles(values.tiles);
    for (const f of SETTING_FIELDS) {
      const row = root.querySelector(`[data-field="${f.key}"]`);
      const idx = f.options.indexOf(values[f.key]);
      row.querySelector('[data-value]').textContent = formatValue(f, values[f.key]);
      row.querySelector('[data-step="-1"]').disabled = idx <= 0;
      const nextOverLimit = f.key === 'hideBatch' && idx + 1 < f.options.length && f.options[idx + 1] > maxBatch;
      row.querySelector('[data-step="1"]').disabled = idx >= f.options.length - 1 || nextOverLimit;
    }
    root.querySelector('[data-summary]').textContent = `${match ? `${match.label} · ` : '커스텀 · '}${describe(values)}`;
  }

  const onClick = (e) => {
    const presetBtn = e.target.closest('[data-preset]');
    const stepBtn = e.target.closest('[data-step]');
    if (presetBtn) {
      const p = PRESETS.find((x) => x.id === presetBtn.dataset.preset);
      values = Object.fromEntries(SETTING_FIELDS.map((f) => [f.key, p[f.key]]));
      ctx.audio.playClick();
      render();
    } else if (stepBtn) {
      const key = stepBtn.closest('[data-field]').dataset.field;
      const field = SETTING_FIELDS.find((f) => f.key === key);
      const idx = field.options.indexOf(values[key]) + Number(stepBtn.dataset.step);
      if (idx < 0 || idx >= field.options.length) return;
      const nextValues = { ...values, [key]: field.options[idx] };
      const maxBatch = maxHideBatchForTiles(nextValues.tiles);
      if (nextValues.hideBatch > maxBatch) {
        const batchOpts = SETTING_FIELDS.find((f) => f.key === 'hideBatch').options;
        nextValues.hideBatch = batchOpts.filter((v) => v <= maxBatch).pop() ?? batchOpts[0];
      }
      values = nextValues;
      ctx.audio.playClick();
      render();
    } else if (e.target.closest('[data-start]')) {
      ctx.audio.playClick();
      const mode = hideSeekModeId(values);
      ctx.storage.setPref?.(LAST_MODE_PREF, mode);
      ctx.switchMode(mode);
    }
  };
  root.addEventListener('click', onClick);
  render();
  ctx.updateHud({ timer: { text: '--:--', state: 'normal' }, score: 0, progress: '난이도 설정', progressRatio: 1 });
  root.querySelector('[data-start]').focus({ preventScroll: true });

  return {
    idle: true,
    unmount() {
      root.removeEventListener('click', onClick);
      container.innerHTML = '';
    },
  };
}

/* ============================================================================
 * The game: one wall, three numbers to find in any order
 * ========================================================================== */
function mountGame(container, ctx, settings) {
  const wall = generateFortressRun(ctx.rng, settings);
  const { targets } = wall;
  const pts = basePoints(settings);

  const root = document.createElement('div');
  root.className = 'game-root game-fortress';
  root.innerHTML = `
    <header class="df-console">
      <div class="df-targets" data-df-targets>
        ${targets
          .map(
            (t, i) => `
          <label class="df-target" data-target="${i}">
            <span class="df-target__num">${t.number}</span>
            <input class="df-target__box" data-box="${i}" maxlength="1" autocomplete="off" spellcheck="false"
              aria-label="${t.number}을(를) 숨긴 글자" />
          </label>`
          )
          .join('')}
      </div>
      <div class="df-timebar" aria-hidden="true"><span data-df-timebar></span></div>
    </header>
    <div class="df-wall-wrap" data-df-wrap${settings.spiral ? ' data-spiral' : ''}>
      <canvas class="df-wall" data-df-canvas aria-label="글자 타일 벽. 숫자를 숨긴 타일을 누르세요."></canvas>
      <div class="df-overlay" data-df-overlay hidden>
        <h2 class="df-overlay__title" data-df-overlay-title></h2>
        <p class="df-overlay__body" data-df-overlay-body></p>
      </div>
    </div>
    <p class="df-help">숫자 옆 칸에 그 숫자를 숨긴 글자를 입력하거나, 칸을 고르고 타일을 누르세요. 순서는 상관없어요.</p>
  `;
  container.appendChild(root);

  const boxes = [...root.querySelectorAll('[data-box]')];
  const slots = boxes.map((b) => b.closest('.df-target'));
  const timebarEl = root.querySelector('[data-df-timebar]');
  const wrapEl = root.querySelector('[data-df-wrap]');
  const canvas = root.querySelector('[data-df-canvas]');
  const overlayEl = root.querySelector('[data-df-overlay]');
  const overlayTitleEl = root.querySelector('[data-df-overlay-title]');
  const overlayBodyEl = root.querySelector('[data-df-overlay-body]');
  const g = canvas.getContext('2d');
  const color = readPalette(root);
  const finePointer = !window.matchMedia?.('(pointer: coarse)').matches;
  const reduceMotion = Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);

  // --- Run state ---------------------------------------------------------------
  let phase = 'play'; // play | clear | fail | ended
  let clock = 0; // seconds since numbers appeared (drives reveal, hiding, peeking)
  let phaseClock = 0;
  let penaltySec = 0;
  let activeMs = 0; // drives every animation; frozen while paused
  let playMs = 0; // time actually spent playing (the result's time)
  let activeBox = 0; // the box a tapped tile answers
  let score = 0;
  let streak = 0;
  let mistakes = 0;
  let cooldownUntil = 0; // activeMs; blocks rapid-fire guessing after a miss
  let solved = 0;
  let spin = 0;
  const solvedLetters = new Set();

  // --- Juice state ---------------------------------------------------------------
  const tileAnims = new Map(); // tileIndex -> { kind: 'pop' | 'shake', t0, tint }
  const hoverMix = new Float32Array(wall.tiles.length); // 0…1 per tile, eased
  let hoverTile = -1;
  let press = null; // { tile, t0 }
  let bursts = []; // { x, y, r, t0, tint }
  let sparks = []; // { x, y, vx, vy, life, max, tint, size }
  let floaters = []; // { text, x, y, t0, tint, size }
  let screenShake = null; // { t0, amp }
  let endMix = 0; // 0 → 1 as the wall dims after a time-out

  let isPaused = false;
  let finished = false;
  let unmounted = false;
  let rafId = 0;
  let lastTs = performance.now();

  // --- Wall geometry ---------------------------------------------------------------
  let logical = { w: 1600, h: WALL_SHORT_SIDE };
  let portrait = false;
  let view = { scale: 1, ox: 0, oy: 0, cssW: 1, cssH: 1, dpr: 1 };
  let geometry = []; // tile index -> { x, y, half, angleRad, cell, introDelay }
  let gradients = null; // cached per logical size

  function buildGeometry() {
    const cols = portrait ? wall.rows : wall.cols;
    const rows = portrait ? wall.cols : wall.rows;
    const cellW = (logical.w - WALL_PAD * 2) / cols;
    const cellH = (logical.h - WALL_PAD * 2) / rows;
    const cell = Math.min(cellW, cellH);
    const maxDist = Math.hypot(logical.w / 2, logical.h / 2);
    geometry = wall.tiles.map((tile) => {
      const i = tile.index;
      const c = portrait ? Math.floor(i / wall.cols) : i % wall.cols;
      const row = portrait ? i % wall.cols : Math.floor(i / wall.cols);
      const x = WALL_PAD + (c + 0.5 + tile.jx) * cellW;
      const y = WALL_PAD + (row + 0.58 + tile.jy) * cellH;
      return {
        // Sit slightly low in the cell to leave head-room for the popping number
        x,
        y,
        // A 45° tile must still fit its cell: half-diagonal ≤ half cell
        half: cell * tile.size * 0.31,
        angleRad: (tile.angle * Math.PI) / 180,
        cell,
        // 0…1 distance from the centre: the intro and the clear wave ripple outward
        ring: Math.hypot(x - logical.w / 2, y - logical.h / 2) / maxDist,
      };
    });
    gradients = null;
  }

  function resize() {
    const rect = wrapEl.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const aspect = rect.width / rect.height;
    portrait = aspect < PORTRAIT_ASPECT;
    const next = portrait
      ? { w: WALL_SHORT_SIDE, h: Math.round(WALL_SHORT_SIDE / Math.max(aspect, 0.45)) }
      : { w: Math.round(WALL_SHORT_SIDE * Math.min(Math.max(aspect, 1), 2.6)), h: WALL_SHORT_SIDE };
    if (next.w !== logical.w || next.h !== logical.h || geometry.length === 0) {
      logical = next;
      buildGeometry();
    }
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const scale = Math.min(rect.width / logical.w, rect.height / logical.h);
    view = {
      scale,
      ox: (rect.width - logical.w * scale) / 2,
      oy: (rect.height - logical.h * scale) / 2,
      cssW: rect.width,
      cssH: rect.height,
      dpr,
    };
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
  }

  /** Where logical point (x, y) is on the page — for DOM effects that leave the wall. */
  function toClient(x, y) {
    const rect = canvas.getBoundingClientRect();
    return { x: rect.left + view.ox + x * view.scale, y: rect.top + view.oy + y * view.scale };
  }

  // --- DOM sync --------------------------------------------------------------------
  const remainingSec = () => Math.max(0, settings.timeSec - clock - penaltySec);

  function syncHud() {
    const remaining = remainingSec();
    timebarEl.style.setProperty('--df-time', (remaining / settings.timeSec).toFixed(4));
    timebarEl.dataset.state = remaining <= DANGER_TIME_SEC ? 'danger' : 'normal';
    ctx.updateHud({
      timer: phase === 'play' ? remaining : { text: '--:--', state: 'normal' },
      score,
      progress: `찾은 숫자 ${solved}/${targets.length}`,
      progressRatio: remaining / settings.timeSec,
    });
  }

  function showOverlay(title, body, tone) {
    overlayTitleEl.textContent = title;
    overlayBodyEl.textContent = body;
    overlayEl.dataset.tone = tone;
    overlayEl.hidden = false;
  }

  /** Restarts a one-shot CSS animation class. */
  function replayClass(el, cls) {
    el.classList.remove(cls);
    void el.offsetWidth;
    el.classList.add(cls);
  }

  const firstOpenBox = () => targets.findIndex((t) => !t.solved);

  function focusBox(i) {
    activeBox = i;
    slots.forEach((slot, k) => slot.classList.toggle('is-active', k === i && !targets[k].solved));
    if (finePointer && i >= 0) boxes[i].focus({ preventScroll: true });
  }

  // --- Effects -----------------------------------------------------------------------
  function addFloater(text, x, y, tint, size = 40) {
    // Keep the text on the wall even above a top-row tile (it rises ~46 px)
    floaters.push({ text, x, y: Math.max(y, size + 60), t0: activeMs, tint, size });
  }

  function addBurst(tileIndex, tint, delayMs = 0) {
    const p = geometry[tileIndex];
    bursts.push({ x: p.x, y: p.y, r: p.half, t0: activeMs + delayMs, tint });
    if (reduceMotion) return;
    for (let k = 0; k < FX.sparksPerTile && sparks.length < FX.maxSparks; k += 1) {
      const a = Math.random() * Math.PI * 2;
      const v = 220 + Math.random() * 260;
      sparks.push({
        x: p.x,
        y: p.y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v - 120,
        life: 0,
        max: 0.45 + Math.random() * 0.3,
        delay: delayMs / 1000,
        tint,
        size: 3 + Math.random() * 4,
      });
    }
  }

  function shakeScreen(amp = FX.screenShakePx) {
    if (!reduceMotion) screenShake = { t0: activeMs, amp };
  }

  /** The found letter flies from the wall into its answer box, which pops on landing. */
  function flyToBox(i, tileIndex, letter) {
    const slot = slots[i];
    if (reduceMotion || typeof document.body.animate !== 'function') {
      replayClass(slot, 'is-landed');
      return;
    }
    const p = geometry[tileIndex];
    const from = toClient(p.x, p.y);
    const to = boxes[i].getBoundingClientRect();
    const base = root.getBoundingClientRect();
    const fly = document.createElement('span');
    fly.className = 'df-fly';
    fly.textContent = letter;
    root.appendChild(fly);
    const dx = to.left + to.width / 2 - from.x;
    const dy = to.top + to.height / 2 - from.y;
    fly.style.left = `${from.x - base.left}px`;
    fly.style.top = `${from.y - base.top}px`;
    const anim = fly.animate(
      [
        { transform: 'translate(-50%, -50%) scale(1.25)', opacity: 1 },
        { transform: `translate(calc(-50% + ${dx * 0.55}px), calc(-50% + ${dy * 0.45 - 40}px)) scale(1.1)`, opacity: 1, offset: 0.55 },
        { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(0.8)`, opacity: 0.9 },
      ],
      { duration: FX.flyMs, easing: 'cubic-bezier(0.5, 0, 0.75, 0.6)' }
    );
    anim.onfinish = () => {
      fly.remove();
      if (!unmounted) replayClass(slot, 'is-landed');
    };
  }

  // --- Flow --------------------------------------------------------------------------
  function finishRun(cleared) {
    if (finished) return;
    finished = true;
    phase = 'ended';
    ctx.completeGame({
      score,
      timeMs: Math.round(playMs),
      accuracy: solved + mistakes > 0 ? Math.round((solved / (solved + mistakes)) * 100) : 0,
      cleared,
      details: [
        { value: `🔢 ${solved}/${targets.length} 숫자` },
        { value: `⏱ ${(playMs / 1000).toFixed(1)}초` },
        { value: `❌ 오답 ${mistakes}회` },
        { value: `🎚 ${hideSeekModeLabel(ctx.mode)}` },
      ],
    });
  }

  function endPhase(next) {
    phase = next;
    phaseClock = 0;
    hoverTile = -1;
    canvas.style.cursor = '';
    boxes.forEach((b) => {
      b.disabled = true;
    });
    if (next === 'clear') {
      const bonus = Math.round(remainingSec() * 60) + (mistakes === 0 ? PERFECT_BONUS : 0);
      score += bonus;
      ctx.audio.playClear();
      // Celebration: every tile bounces in a wave from the centre
      for (const tile of wall.tiles) {
        const p = geometry[tile.index];
        tileAnims.set(tile.index, { kind: 'pop', t0: activeMs + p.ring * FX.clearWaveMs, tint: color.neon });
        if (solvedLetters.has(tile.letter)) addBurst(tile.index, color.neon, p.ring * FX.clearWaveMs);
      }
      showOverlay('모두 찾았습니다!', `남은 시간 보너스 +${bonus.toLocaleString('en-US')}`, 'success');
    } else {
      ctx.audio.playAlarm();
      shakeScreen(10);
      showOverlay('시간 초과!', `${solved}/${targets.length}개 찾음`, 'danger');
    }
    syncHud();
  }

  /** Answers target `i` with `letter`; `tileIndex` is set when a tile was tapped. */
  function answer(i, letter, tileIndex = -1) {
    if (finished || isPaused || phase !== 'play') return;
    const target = targets[i];
    if (!target || target.solved) return;
    const box = boxes[i];
    const slot = slots[i];
    if (activeMs < cooldownUntil) {
      box.value = '';
      return;
    }
    if (letter === target.letter) {
      target.solved = true;
      solved += 1;
      streak += 1;
      const gained = pts + (streak >= 2 ? 60 * Math.min(streak, 9) : 0);
      score += gained;
      ctx.audio.playMatch(streak);
      box.value = target.letter;
      box.disabled = true;
      slot.classList.add('is-solved');
      solvedLetters.add(target.letter);
      // Every tile with this letter bounces and bursts, nearest to the tap first
      const origin = tileIndex >= 0 ? geometry[tileIndex] : null;
      let flyFrom = tileIndex;
      for (const tile of wall.tiles) {
        if (tile.letter !== target.letter) continue;
        if (flyFrom < 0) flyFrom = tile.index;
        const p = geometry[tile.index];
        const delay = origin ? Math.min(220, Math.hypot(p.x - origin.x, p.y - origin.y) * 0.25) : 0;
        tileAnims.set(tile.index, { kind: 'pop', t0: activeMs + delay, tint: color.neon });
        addBurst(tile.index, color.neon, delay);
      }
      const at = geometry[flyFrom];
      addFloater(`+${gained}`, at.x, at.y - at.half * 2.2, color.neon, 44);
      if (streak >= 2) addFloater(`${streak} COMBO`, at.x, at.y - at.half * 2.2 - 46, color.gold, 28);
      flyToBox(i, flyFrom, target.letter);
      if (solved >= targets.length) endPhase('clear');
      else focusBox(firstOpenBox());
    } else {
      penaltySec += WRONG_PENALTY_SEC;
      cooldownUntil = activeMs + WRONG_INPUT_COOLDOWN_MS;
      streak = 0;
      mistakes += 1;
      ctx.audio.playError();
      box.value = '';
      replayClass(slot, 'is-wrong');
      replayClass(timebarEl.parentElement, 'is-hit');
      shakeScreen();
      if (tileIndex >= 0) {
        const p = geometry[tileIndex];
        tileAnims.set(tileIndex, { kind: 'shake', t0: activeMs, tint: color.danger });
        addFloater(`-${WRONG_PENALTY_SEC}초`, p.x, p.y - p.half * 2.2, color.danger, 40);
      } else {
        addFloater(`${letter} 아님  -${WRONG_PENALTY_SEC}초`, logical.w / 2, logical.h - 80, color.danger, 40);
      }
    }
    syncHud();
  }

  // --- Drawing ---------------------------------------------------------------------
  /** 0 (hidden behind the tile) … 1 (fully out above it) at time `t`. */
  function peekAmount(tile, t) {
    return tilePeekAt(wall, settings, tile, t);
  }

  /** Black-and-white spiral turning so the bands flow toward the centre. */
  function drawSpiral() {
    g.fillStyle = '#0b0b0b';
    g.fillRect(0, 0, logical.w, logical.h);
    const cx = logical.w / 2;
    const cy = logical.h / 2;
    const k = SPIRAL_SPACING / (Math.PI * 2);
    const maxTheta = Math.hypot(logical.w, logical.h) / 2 / k + Math.PI * 2;
    g.save();
    g.strokeStyle = '#f2f2f2';
    g.lineWidth = SPIRAL_SPACING / 2;
    g.lineCap = 'butt';
    g.beginPath();
    for (let th = 0; th <= maxTheta; th += 0.06) {
      const r = k * th;
      const a = th + spin;
      const x = cx + Math.cos(a) * r;
      const y = cy + Math.sin(a) * r;
      if (th === 0) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
    g.stroke();
    g.restore();
  }

  function ensureGradients() {
    if (gradients) return gradients;
    const cx = logical.w / 2;
    const cy = logical.h / 2;
    const far = Math.hypot(cx, cy);
    const wallGrad = g.createRadialGradient(cx, cy * 0.85, 0, cx, cy, far);
    wallGrad.addColorStop(0, color.wallCenter);
    wallGrad.addColorStop(1, color.wallEdge);
    const vignette = g.createRadialGradient(cx, cy, far * 0.45, cx, cy, far);
    vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
    vignette.addColorStop(1, 'rgba(0, 0, 0, 0.38)');
    const danger = g.createRadialGradient(cx, cy, far * 0.5, cx, cy, far);
    danger.addColorStop(0, withAlpha(color.danger, 0));
    danger.addColorStop(1, withAlpha(color.danger, 0.5));
    gradients = { wallGrad, vignette, danger };
    return gradients;
  }

  function drawWall() {
    const grads = ensureGradients();
    if (settings.spiral) {
      drawSpiral();
    } else {
      g.fillStyle = grads.wallGrad;
      g.fillRect(0, 0, logical.w, logical.h);
    }
  }

  /** Frame, vignette and the low-time pulse — drawn over the tiles. */
  function drawFrame() {
    const grads = ensureGradients();
    g.fillStyle = grads.vignette;
    g.fillRect(0, 0, logical.w, logical.h);
    if (phase === 'play' && remainingSec() <= DANGER_TIME_SEC) {
      const beat = 0.5 + 0.5 * Math.sin((activeMs / 1000) * Math.PI * 2 * 1.4);
      g.save();
      g.globalAlpha = 0.25 + 0.35 * beat;
      g.fillStyle = grads.danger;
      g.fillRect(0, 0, logical.w, logical.h);
      g.restore();
    }
    g.save();
    g.strokeStyle = withAlpha(color.neon, 0.7);
    g.lineWidth = 3;
    g.shadowColor = color.neon;
    g.shadowBlur = 18;
    roundedRect(g, 9, 9, logical.w - 18, logical.h - 18, 14);
    g.stroke();
    g.restore();
  }

  /** Scale and extra rotation of a tile from the intro, hover, press and feedback. */
  function tileMotion(tile, p) {
    let scale = 1;
    let rot = 0;
    let tint = null;
    let tintMix = 0;
    if (!reduceMotion) {
      const t = (clock - p.ring * FX.introSpreadSec) / FX.introSec;
      if (t < 1) scale *= easeOutBack(clamp01(t));
    }
    scale *= 1 + FX.hoverScale * hoverMix[tile.index];
    if (press && press.tile === tile.index) {
      const k = (activeMs - press.t0) / FX.pressMs;
      if (k < 1) scale *= 1 - 0.1 * (1 - k);
    }
    const anim = tileAnims.get(tile.index);
    if (anim) {
      const dur = anim.kind === 'pop' ? FX.popMs : FX.shakeMs;
      const k = (activeMs - anim.t0) / dur;
      if (k >= 1) {
        tileAnims.delete(tile.index);
      } else if (k >= 0) {
        tint = anim.tint;
        tintMix = 1 - k;
        if (anim.kind === 'pop') scale *= 1 + (reduceMotion ? 0 : 0.32) * Math.sin(Math.PI * k) * (1 - k * 0.4);
        else if (!reduceMotion) rot = Math.sin(k * Math.PI * 7) * (1 - k) * 0.2;
      }
    }
    return { scale, rot, tint, tintMix };
  }

  /**
   * Tile + number styled after the real wall: a back-lit, light panel with a white rim
   * and a thin inner frame, an upright light-weight letter, and a small glowing
   * number that springs out from behind it.
   */
  function drawTile(tile, p, peekRaw) {
    const m = tileMotion(tile, p);
    if (m.scale < 0.02) return;
    const s = p.half * m.scale;
    const done = solvedLetters.has(tile.letter);
    const hover = hoverMix[tile.index];
    const peek = done ? 0 : peekRaw * clamp01(m.scale);

    // Number first, so the tile covers it until it springs up and out from behind
    if (peek > 0.01) {
      const rise = p.half * 1.55 * easeOutBack(peek);
      const size = Math.round(p.cell * 0.19);
      g.save();
      g.globalAlpha = Math.min(1, peek * 1.4);
      g.font = `600 ${size}px "Space Grotesk", "Pretendard Variable", sans-serif`;
      g.textAlign = 'center';
      g.textBaseline = 'alphabetic';
      if (settings.spiral) {
        // A dark tag keeps the light number readable over the white spiral bands
        const w = g.measureText(tile.number).width + size * 0.6;
        g.fillStyle = 'rgba(10, 10, 10, 0.88)';
        roundedRect(g, p.x - w / 2, p.y - rise - size * 0.98, w, size * 1.25, size * 0.3);
        g.fill();
      }
      g.shadowColor = color.numberGlow;
      g.shadowBlur = size * 0.5;
      g.fillStyle = color.number;
      g.fillText(tile.number, p.x, p.y - rise);
      g.restore();
    }

    g.save();
    g.translate(p.x, p.y);
    g.rotate(p.angleRad + m.rot);
    // Back-lit glow: brighter under the cursor and while reacting
    g.shadowColor = m.tint ? withAlpha(m.tint, 0.5 + 0.5 * m.tintMix) : color.tileGlow;
    g.shadowBlur = s * (0.3 + 0.35 * hover + 0.9 * m.tintMix);
    g.shadowOffsetY = s * 0.06;
    // Panel with a soft top-lit shade
    const shade = g.createLinearGradient(0, -s, 0, s);
    shade.addColorStop(0, color.tile);
    shade.addColorStop(1, color.tileShade);
    g.fillStyle = shade;
    roundedRect(g, -s, -s, s * 2, s * 2, s * 0.16);
    g.fill();
    g.shadowColor = 'transparent';
    // White rim, or the feedback colour while reacting
    g.lineWidth = s * (0.09 + 0.07 * m.tintMix);
    g.strokeStyle = m.tint && m.tintMix > 0.05 ? m.tint : color.tileRim;
    g.stroke();
    // Thin inner frame — green once its letter is found
    g.lineWidth = Math.max(1, s * (done ? 0.07 : 0.045));
    g.strokeStyle = done ? color.neon : color.tileInset;
    roundedRect(g, -s * 0.72, -s * 0.72, s * 1.44, s * 1.44, s * 0.08);
    g.stroke();
    g.restore();

    // Upright, light-weight letter
    g.fillStyle = done ? color.solvedLetter : color.letter;
    g.font = `${done ? 700 : 500} ${Math.round(s * 0.92)}px "Space Grotesk", "Pretendard Variable", "Noto Sans KR", sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(tile.letter, p.x, p.y + s * 0.04);
  }

  function drawEffects(dt) {
    // Rings
    bursts = bursts.filter((b) => activeMs - b.t0 < FX.burstMs);
    for (const b of bursts) {
      const k = (activeMs - b.t0) / FX.burstMs;
      if (k < 0) continue;
      g.save();
      g.globalAlpha = 1 - k;
      g.strokeStyle = b.tint;
      g.lineWidth = 2 + 6 * (1 - k);
      g.beginPath();
      g.arc(b.x, b.y, b.r * (1.1 + 1.8 * easeOutCubic(k)), 0, Math.PI * 2);
      g.stroke();
      g.restore();
    }
    // Sparks
    for (const sp of sparks) {
      if (sp.delay > 0) {
        sp.delay -= dt;
        continue;
      }
      sp.life += dt;
      sp.vx *= 0.96;
      sp.vy = sp.vy * 0.96 + 900 * dt;
      sp.x += sp.vx * dt;
      sp.y += sp.vy * dt;
    }
    sparks = sparks.filter((sp) => sp.life < sp.max);
    for (const sp of sparks) {
      if (sp.delay > 0) continue;
      g.globalAlpha = 1 - sp.life / sp.max;
      g.fillStyle = sp.tint;
      g.fillRect(sp.x - sp.size / 2, sp.y - sp.size / 2, sp.size, sp.size);
    }
    g.globalAlpha = 1;
    // Floating text
    floaters = floaters.filter((f) => activeMs - f.t0 < FX.floaterMs);
    for (const f of floaters) {
      const k = (activeMs - f.t0) / FX.floaterMs;
      const pop = easeOutBack(clamp01(k / 0.25));
      g.save();
      g.globalAlpha = k < 0.6 ? 1 : 1 - (k - 0.6) / 0.4;
      g.translate(f.x, f.y - 46 * easeOutCubic(k));
      g.scale(pop, pop);
      g.font = `800 ${f.size}px "Outfit", "Pretendard Variable", sans-serif`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.lineJoin = 'round';
      g.lineWidth = f.size * 0.18;
      g.strokeStyle = 'rgba(6, 18, 14, 0.85)';
      g.strokeText(f.text, 0, 0);
      g.fillStyle = f.tint;
      g.fillText(f.text, 0, 0);
      g.restore();
    }
  }

  function draw(dt) {
    const { scale, ox, oy, dpr } = view;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, view.cssW, view.cssH);
    let sx = 0;
    let sy = 0;
    if (screenShake) {
      const k = (activeMs - screenShake.t0) / FX.screenShakeMs;
      if (k >= 1) screenShake = null;
      else {
        sx = (Math.random() * 2 - 1) * screenShake.amp * (1 - k);
        sy = (Math.random() * 2 - 1) * screenShake.amp * (1 - k);
      }
    }
    g.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * (ox + sx * scale), dpr * (oy + sy * scale));
    drawWall();
    const showNumbers = phase === 'play';
    g.save();
    if (endMix > 0) g.globalAlpha = 1 - 0.55 * endMix;
    for (const tile of wall.tiles) {
      drawTile(tile, geometry[tile.index], showNumbers ? peekAmount(tile, clock) : 0);
    }
    g.restore();
    drawFrame();
    drawEffects(dt);
  }

  // --- Loop ------------------------------------------------------------------------
  function step(now) {
    if (unmounted) return;
    rafId = requestAnimationFrame(step);
    const dt = Math.min(0.05, Math.max(0, (now - lastTs) / 1000));
    lastTs = now;
    const running = !isPaused && !finished;

    if (running) {
      activeMs += dt * 1000;
      spin += dt * SPIRAL_SPEED;
      for (let i = 0; i < hoverMix.length; i += 1) {
        const goal = i === hoverTile ? 1 : 0;
        if (hoverMix[i] !== goal) {
          hoverMix[i] += (goal - hoverMix[i]) * Math.min(1, dt * 14);
          if (Math.abs(goal - hoverMix[i]) < 0.01) hoverMix[i] = goal;
        }
      }
      if (phase === 'play') {
        clock += dt;
        playMs += dt * 1000;
        const remaining = remainingSec();
        if (remaining <= 5 && Math.ceil(remaining) !== Math.ceil(remaining + dt)) ctx.audio.playTick();
        if (remaining <= 0) endPhase('fail');
        else syncHud();
      } else {
        phaseClock += dt;
        if (phase === 'fail') endMix = Math.min(1, endMix + dt * 2.5);
        if (phaseClock >= END_OVERLAY_SEC) finishRun(phase === 'clear');
      }
    }
    draw(running ? dt : 0);
  }

  // --- Input -----------------------------------------------------------------------
  function tileAt(clientX, clientY, isTouch) {
    const rect = canvas.getBoundingClientRect();
    const lx = (clientX - rect.left - view.ox) / view.scale;
    const ly = (clientY - rect.top - view.oy) / view.scale;
    const slop = isTouch ? TOUCH_HIT_SLOP * Math.min(logical.w, logical.h) : 0;
    // Topmost first: tiles are drawn in index order
    for (let i = geometry.length - 1; i >= 0; i -= 1) {
      const p = geometry[i];
      const dx = lx - p.x;
      const dy = ly - p.y;
      const cos = Math.cos(-p.angleRad);
      const sin = Math.sin(-p.angleRad);
      const ux = dx * cos - dy * sin;
      const uy = dx * sin + dy * cos;
      if (Math.abs(ux) <= p.half + slop && Math.abs(uy) <= p.half + slop) return i;
    }
    return -1;
  }

  const onPointerDown = (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (phase !== 'play') return;
    const idx = tileAt(e.clientX, e.clientY, e.pointerType === 'touch');
    if (idx < 0) return;
    press = { tile: idx, t0: activeMs };
    if (targets[activeBox]?.solved) activeBox = firstOpenBox();
    if (activeBox >= 0) answer(activeBox, wall.tiles[idx].letter, idx);
    if (finePointer && activeBox >= 0) boxes[activeBox].focus({ preventScroll: true });
  };

  const onPointerMove = (e) => {
    if (e.pointerType !== 'mouse' || phase !== 'play') return;
    const idx = tileAt(e.clientX, e.clientY, false);
    if (idx === hoverTile) return;
    hoverTile = idx;
    canvas.style.cursor = idx >= 0 ? 'pointer' : 'default';
  };

  const onPointerLeave = () => {
    hoverTile = -1;
  };

  /** A box holds exactly one symbol; a finished one is checked right away. */
  function checkBox(i) {
    const box = boxes[i];
    const value = [...box.value.trim().toUpperCase()].pop() || '';
    box.value = value;
    if (!value) return;
    if (!LETTERS.includes(value) && !HANGUL.includes(value)) {
      box.value = '';
      replayClass(slots[i], 'is-wrong');
      addFloater('알파벳이나 가~하 한 글자만', logical.w / 2, logical.h - 80, color.danger, 34);
      return;
    }
    answer(i, value);
  }

  const onBoxInput = (e) => {
    if (e.isComposing) return; // Hangul is checked when composition ends
    checkBox(Number(e.target.dataset.box));
  };
  const onBoxComposed = (e) => checkBox(Number(e.target.dataset.box));
  const onBoxFocus = (e) => focusBox(Number(e.target.dataset.box));
  const onSlotAnimEnd = (e) => e.currentTarget.classList.remove('is-wrong', 'is-landed');

  const onPause = (e) => {
    isPaused = Boolean(e.detail?.paused);
    if (!isPaused) lastTs = performance.now();
  };

  const resizeObserver = typeof ResizeObserver === 'function' ? new ResizeObserver(resize) : null;
  resizeObserver?.observe(wrapEl);
  window.addEventListener('resize', resize);
  window.addEventListener('pm:pausechange', onPause);
  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerleave', onPointerLeave);
  for (const box of boxes) {
    box.addEventListener('input', onBoxInput);
    box.addEventListener('compositionend', onBoxComposed);
    box.addEventListener('focus', onBoxFocus);
  }
  for (const slot of slots) slot.addEventListener('animationend', onSlotAnimEnd);

  resize();
  focusBox(0);
  syncHud();
  rafId = requestAnimationFrame(step);

  return {
    unmount() {
      unmounted = true;
      cancelAnimationFrame(rafId);
      resizeObserver?.disconnect();
      window.removeEventListener('resize', resize);
      window.removeEventListener('pm:pausechange', onPause);
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerleave', onPointerLeave);
      for (const box of boxes) {
        box.removeEventListener('input', onBoxInput);
        box.removeEventListener('compositionend', onBoxComposed);
        box.removeEventListener('focus', onBoxFocus);
      }
      for (const slot of slots) slot.removeEventListener('animationend', onSlotAnimEnd);
      container.innerHTML = '';
    },
  };
}
