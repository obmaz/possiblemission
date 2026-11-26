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
const END_OVERLAY_SEC = 1.3;
const PEEK_EASE_SEC = 0.16; // how long a number takes to slide out / back in
const PEEK_REST_SEC = 0.6; // a number that just hid stays hidden at least this long
const TILE_FLASH_SEC = 0.6;
const MESSAGE_SEC = 1.1;
const DANGER_TIME_SEC = 10;

// Spinning spiral background (INSANE / GOD or the custom toggle)
const SPIRAL_SPACING = 110; // distance between two white bands, logical px
const SPIRAL_SPEED = 1.8; // rad/s; bands flow toward the centre

// Logical wall size: the short side is fixed and the long side follows the screen's
// aspect ratio, so the wall always fills the display. Portrait screens swap the grid.
const WALL_SHORT_SIDE = 900;
const PORTRAIT_ASPECT = 0.87;
const WALL_PAD = 46;

const TILE_ANGLES = [45, 45, 38, 30, 20, 12, 0, -12, -20, -30, -38];

/** Peek cycle for hidden numbers: longer peeks also come back less often. */
const peekCycleSec = (settings) => settings.peekSec * 3 + 2;

/** Points per found number grow with how hard the settings are. */
function basePoints(settings) {
  const density = settings.tiles / 24; // 1 … 5.25
  const speed = 5 / settings.revealSec; // 1 … 3.3
  const batch = 1 + settings.hideBatch / 5; // 1.2 … 2
  return Math.round((200 + 60 * density + 60 * speed) * batch * (settings.spiral ? 1.2 : 1));
}

/**
 * Pure deterministic generator: same rng seed + settings → same letters, numbers,
 * tilts, hide order, peek timing and targets on every device. One wall per game.
 * @param {() => number} rng
 * @param {object} settings - parsed values from parseHideSeekMode()
 */
export function generateFortressRun(rng, settings) {
  const [cols, rows] = TILE_GRID[settings.tiles];
  const count = cols * rows;
  const cycleSec = peekCycleSec(settings);
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
    peekOffset: rng() * cycleSec,
    hideAt: settings.revealSec,
  }));
  // Numbers disappear a batch at a time, in a seeded order
  shuffleSeeded(rng, tiles).forEach((tile, rank) => {
    tile.hideAt = settings.revealSec + Math.floor(rank / settings.hideBatch) * settings.hideIntervalSec;
  });
  // Three different symbols to find
  const seen = new Set();
  const targets = shuffleSeeded(rng, tiles)
    .filter((tile) => !seen.has(tile.letter) && seen.add(tile.letter))
    .slice(0, TARGET_COUNT)
    .map((tile) => ({ number: tile.number, letter: tile.letter, solved: false }));
  return { cols, rows, cycleSec, tiles, targets };
}

/** Canvas colours come from the shared design tokens so the wall matches the shell. */
function readPalette(el) {
  const css = getComputedStyle(el);
  const pick = (name, fallback) => css.getPropertyValue(name).trim() || fallback;
  return {
    neon: pick('--neon-emerald', '#3fbf92'),
    danger: pick('--neon-crimson', '#e06767'),
    text: pick('--text-on-image', '#f6f8fc'),
    wall: '#121a17',
    wallDot: 'rgba(255, 255, 255, 0.035)',
    tile: '#e8eee9',
    tileEdge: '#9fb3a8',
    tileInset: 'rgba(16, 24, 20, 0.28)',
    letter: '#101814',
    number: '#f5f8f4',
    pill: 'rgba(8, 12, 10, 0.9)',
  };
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
  return `타일 ${s.tiles}개 · 처음 ${s.revealSec}초 뒤 ${s.hideBatch}개씩 ${s.hideIntervalSec}초마다 사라지고, 이후 ${s.peekSec}초씩 다시 보입니다 · 제한 ${s.timeSec}초${extras ? ` · ${extras}` : ''}`;
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
            <span class="df-preset__meta">타일 ${p.tiles} · 공개 ${p.revealSec}초</span>
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
    for (const f of SETTING_FIELDS) {
      const row = root.querySelector(`[data-field="${f.key}"]`);
      const idx = f.options.indexOf(values[f.key]);
      row.querySelector('[data-value]').textContent = formatValue(f, values[f.key]);
      row.querySelector('[data-step="-1"]').disabled = idx <= 0;
      row.querySelector('[data-step="1"]').disabled = idx >= f.options.length - 1;
      // The interval only matters when numbers hide in batches
      row.classList.toggle('is-muted', f.key === 'hideIntervalSec' && values.hideBatch === 0);
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
      values = { ...values, [key]: field.options[idx] };
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
      <span class="df-console__label">찾을 숫자</span>
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
    <div class="df-wall-wrap" data-df-wrap>
      <canvas class="df-wall" data-df-canvas aria-label="글자 타일 벽. 숫자를 숨긴 타일을 누르세요."></canvas>
      <div class="df-overlay" data-df-overlay hidden>
        <h2 class="df-overlay__title" data-df-overlay-title></h2>
        <p class="df-overlay__body" data-df-overlay-body></p>
      </div>
    </div>
    <p class="df-help" data-df-help>숫자 옆 칸에 그 숫자를 숨긴 타일의 글자를 한 글자 입력하세요. 순서는 상관없고, 칸을 고른 뒤 타일을 눌러도 됩니다.</p>
  `;
  container.appendChild(root);

  const boxes = [...root.querySelectorAll('[data-box]')];
  const timebarEl = root.querySelector('[data-df-timebar]');
  const wrapEl = root.querySelector('[data-df-wrap]');
  const canvas = root.querySelector('[data-df-canvas]');
  const overlayEl = root.querySelector('[data-df-overlay]');
  const overlayTitleEl = root.querySelector('[data-df-overlay-title]');
  const overlayBodyEl = root.querySelector('[data-df-overlay-body]');
  const g = canvas.getContext('2d');
  const color = readPalette(root);
  const finePointer = !window.matchMedia?.('(pointer: coarse)').matches;

  // --- Run state ---------------------------------------------------------------
  let phase = 'play'; // play | clear | fail | ended
  let clock = 0; // seconds since numbers appeared (drives reveal, hiding, peeking)
  let phaseClock = 0;
  let penaltySec = 0;
  let activeMs = 0;
  let activeBox = 0; // the box a tapped tile answers
  let score = 0;
  let streak = 0;
  let mistakes = 0;
  let cooldownUntil = 0; // activeMs; blocks rapid-fire guessing after a miss
  let solved = 0;
  let spin = 0;
  let message = null; // { text, tone, until }
  const tileFlash = new Map(); // tileIndex -> { color, until }

  let isPaused = false;
  let finished = false;
  let unmounted = false;
  let rafId = 0;
  let lastTs = performance.now();

  // --- Wall geometry ---------------------------------------------------------------
  let logical = { w: 1600, h: WALL_SHORT_SIDE };
  let portrait = false;
  let view = { scale: 1, ox: 0, oy: 0, cssW: 1, cssH: 1, dpr: 1 };
  let geometry = []; // tile index -> { x, y, half, angleRad, cell }

  function buildGeometry() {
    const cols = portrait ? wall.rows : wall.cols;
    const rows = portrait ? wall.cols : wall.rows;
    const cellW = (logical.w - WALL_PAD * 2) / cols;
    const cellH = (logical.h - WALL_PAD * 2) / rows;
    const cell = Math.min(cellW, cellH);
    geometry = wall.tiles.map((tile) => {
      const i = tile.index;
      const c = portrait ? Math.floor(i / wall.cols) : i % wall.cols;
      const row = portrait ? i % wall.cols : Math.floor(i / wall.cols);
      return {
        // Sit slightly low in the cell to leave head-room for the popping number
        x: WALL_PAD + (c + 0.5 + tile.jx) * cellW,
        y: WALL_PAD + (row + 0.58 + tile.jy) * cellH,
        // A 45° tile must still fit its cell: half-diagonal ≤ half cell
        half: cell * tile.size * 0.31,
        angleRad: (tile.angle * Math.PI) / 180,
        cell,
      };
    });
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

  function flashMessage(text, tone) {
    message = { text, tone, until: activeMs + MESSAGE_SEC * 1000 };
  }

  const firstOpenBox = () => targets.findIndex((t) => !t.solved);

  function focusBox(i) {
    activeBox = i;
    boxes.forEach((b, k) => b.closest('.df-target').classList.toggle('is-active', k === i && !targets[k].solved));
    if (finePointer && i >= 0) boxes[i].focus({ preventScroll: true });
  }

  function finishRun(cleared) {
    if (finished) return;
    finished = true;
    phase = 'ended';
    ctx.completeGame({
      score,
      timeMs: Math.round(activeMs),
      accuracy: solved + mistakes > 0 ? Math.round((solved / (solved + mistakes)) * 100) : 0,
      cleared,
      details: [
        { value: `🔢 ${solved}/${targets.length} 숫자` },
        { value: `⏱ ${(activeMs / 1000).toFixed(1)}초` },
        { value: `❌ 오답 ${mistakes}회` },
        { value: `🎚 ${hideSeekModeLabel(ctx.mode)}` },
      ],
    });
  }

  function endPhase(next) {
    phase = next;
    phaseClock = 0;
    boxes.forEach((b) => {
      b.disabled = true;
    });
    if (next === 'clear') {
      const bonus = Math.round(remainingSec() * 60) + (mistakes === 0 ? PERFECT_BONUS : 0);
      score += bonus;
      ctx.audio.playMatch(6);
      showOverlay('모두 찾았습니다!', `남은 시간 보너스 +${bonus.toLocaleString('en-US')}`, 'success');
    } else {
      ctx.audio.playAlarm();
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
    if (activeMs < cooldownUntil) {
      box.value = '';
      return;
    }
    if (letter === target.letter) {
      target.solved = true;
      solved += 1;
      streak += 1;
      score += pts + (streak >= 2 ? 60 * Math.min(streak, 9) : 0);
      ctx.audio.playMatch(streak);
      box.value = target.letter;
      box.disabled = true;
      box.closest('.df-target').classList.add('is-solved');
      for (const tile of wall.tiles) {
        if (tile.letter === target.letter) {
          tileFlash.set(tile.index, { color: color.neon, until: activeMs + TILE_FLASH_SEC * 2000 });
        }
      }
      flashMessage(`${target.number} = ${target.letter} 정답!`, 'success');
      if (solved >= targets.length) endPhase('clear');
      else focusBox(firstOpenBox());
    } else {
      penaltySec += WRONG_PENALTY_SEC;
      cooldownUntil = activeMs + WRONG_INPUT_COOLDOWN_MS;
      streak = 0;
      mistakes += 1;
      ctx.audio.playError();
      box.value = '';
      const slot = box.closest('.df-target');
      slot.classList.remove('is-wrong');
      void slot.offsetWidth;
      slot.classList.add('is-wrong');
      if (tileIndex >= 0) {
        tileFlash.set(tileIndex, { color: color.danger, until: activeMs + TILE_FLASH_SEC * 1000 });
      }
      flashMessage(`${letter} 아님! -${WRONG_PENALTY_SEC}초`, 'danger');
    }
    syncHud();
  }

  // --- Drawing ---------------------------------------------------------------------
  /** 0 (hidden behind the tile) … 1 (fully out above it) at time `t`. */
  function peekAmount(tile, t) {
    if (t < tile.hideAt) {
      // Opening reveal: pop out, then slide back in when this tile's batch hides
      return Math.max(0, Math.min(1, t / PEEK_EASE_SEC, (tile.hideAt - t) / PEEK_EASE_SEC));
    }
    const since = t - tile.hideAt;
    if (since < PEEK_REST_SEC) return 0;
    const p = (since + tile.peekOffset) % wall.cycleSec;
    if (p >= settings.peekSec) return 0;
    return Math.min(1, Math.min(p, settings.peekSec - p) / PEEK_EASE_SEC);
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

  function drawWall() {
    if (settings.spiral) {
      drawSpiral();
    } else {
      g.fillStyle = color.wall;
      g.fillRect(0, 0, logical.w, logical.h);
      g.fillStyle = color.wallDot;
      for (let y = 24; y < logical.h; y += 36) {
        for (let x = 24; x < logical.w; x += 36) g.fillRect(x, y, 2, 2);
      }
    }
    g.save();
    g.strokeStyle = color.neon;
    g.lineWidth = 6;
    g.shadowColor = color.neon;
    g.shadowBlur = 22;
    g.strokeRect(5, 5, logical.w - 10, logical.h - 10);
    g.restore();
  }

  function drawTile(tile, p, peek) {
    const flash = tileFlash.get(tile.index);
    const flashing = flash && flash.until > activeMs;

    // Number first, so the tile covers it until it slides up and out from behind
    if (peek > 0.01) {
      const rise = p.half * 1.5 * peek;
      const size = Math.round(p.cell * 0.24);
      g.save();
      g.globalAlpha = Math.min(1, peek * 1.4);
      g.font = `700 ${size}px "Space Grotesk", monospace`;
      g.textAlign = 'center';
      g.textBaseline = 'alphabetic';
      if (settings.spiral) {
        // A dark tag keeps the white number readable over the white spiral bands
        const w = g.measureText(tile.number).width + size * 0.5;
        g.fillStyle = 'rgba(10, 10, 10, 0.88)';
        roundedRect(g, p.x - w / 2, p.y - rise - size * 0.95, w, size * 1.2, size * 0.3);
        g.fill();
      }
      g.fillStyle = color.number;
      g.fillText(tile.number, p.x, p.y - rise);
      if (!settings.spiral) g.fillRect(p.x - p.cell * 0.17, p.y - rise + p.cell * 0.03, p.cell * 0.34, 2);
      g.restore();
    }

    const s = p.half;
    g.save();
    g.translate(p.x, p.y);
    g.rotate(p.angleRad);
    g.fillStyle = color.tile;
    g.strokeStyle = flashing ? flash.color : color.tileEdge;
    g.lineWidth = flashing ? 6 : 2;
    roundedRect(g, -s, -s, s * 2, s * 2, s * 0.12);
    g.fill();
    g.stroke();
    g.strokeStyle = color.tileInset;
    g.lineWidth = 1.5;
    g.strokeRect(-s * 0.78, -s * 0.78, s * 1.56, s * 1.56);
    g.restore();

    g.fillStyle = color.letter;
    g.font = `800 ${Math.round(s * 1.05)}px Outfit, "Pretendard Variable", "Noto Sans KR", sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(tile.letter, p.x, p.y + s * 0.05);
  }

  function drawMessage() {
    if (!message || message.until <= activeMs) return;
    const tone = message.tone === 'danger' ? color.danger : color.neon;
    g.font = '800 34px "Pretendard Variable", Outfit, sans-serif';
    const w = g.measureText(message.text).width + 56;
    const x = logical.w / 2 - w / 2;
    g.fillStyle = color.pill;
    g.strokeStyle = tone;
    g.lineWidth = 3;
    roundedRect(g, x, logical.h - 96, w, 62, 31);
    g.fill();
    g.stroke();
    g.fillStyle = color.text;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(message.text, logical.w / 2, logical.h - 64);
  }

  function draw() {
    const { scale, ox, oy, dpr } = view;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, view.cssW, view.cssH);
    g.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * ox, dpr * oy);
    drawWall();
    const showNumbers = phase === 'play';
    for (const tile of wall.tiles) {
      drawTile(tile, geometry[tile.index], showNumbers ? peekAmount(tile, clock) : 0);
    }
    drawMessage();
  }

  // --- Loop ------------------------------------------------------------------------
  function step(now) {
    if (unmounted) return;
    rafId = requestAnimationFrame(step);
    const dt = Math.min(0.05, Math.max(0, (now - lastTs) / 1000));
    lastTs = now;

    if (!isPaused && !finished) {
      activeMs += dt * 1000;
      spin += dt * SPIRAL_SPEED;
      if (phase === 'play') {
        clock += dt;
        const remaining = remainingSec();
        if (remaining <= 5 && Math.ceil(remaining) !== Math.ceil(remaining + dt)) ctx.audio.playTick();
        if (remaining <= 0) endPhase('fail');
        else syncHud();
      } else {
        phaseClock += dt;
        if (phaseClock >= END_OVERLAY_SEC) finishRun(phase === 'clear');
      }
    }
    draw();
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
    const idx = tileAt(e.clientX, e.clientY, e.pointerType === 'touch');
    if (idx < 0) return;
    if (targets[activeBox]?.solved) activeBox = firstOpenBox();
    if (activeBox >= 0) answer(activeBox, wall.tiles[idx].letter, idx);
    if (finePointer && activeBox >= 0) boxes[activeBox].focus({ preventScroll: true });
  };

  /** A box holds exactly one symbol; a finished one is checked right away. */
  function checkBox(i) {
    const box = boxes[i];
    const value = [...box.value.trim().toUpperCase()].pop() || '';
    box.value = value;
    if (!value) return;
    if (!LETTERS.includes(value) && !HANGUL.includes(value)) {
      box.value = '';
      flashMessage('알파벳이나 가~하 한 글자만 입력하세요', 'danger');
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

  const onPause = (e) => {
    isPaused = Boolean(e.detail?.paused);
    if (!isPaused) lastTs = performance.now();
  };

  const resizeObserver = typeof ResizeObserver === 'function' ? new ResizeObserver(resize) : null;
  resizeObserver?.observe(wrapEl);
  window.addEventListener('resize', resize);
  window.addEventListener('pm:pausechange', onPause);
  canvas.addEventListener('pointerdown', onPointerDown);
  for (const box of boxes) {
    box.addEventListener('input', onBoxInput);
    box.addEventListener('compositionend', onBoxComposed);
    box.addEventListener('focus', onBoxFocus);
  }

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
      for (const box of boxes) {
        box.removeEventListener('input', onBoxInput);
        box.removeEventListener('compositionend', onBoxComposed);
        box.removeEventListener('focus', onBoxFocus);
      }
      container.innerHTML = '';
    },
  };
}
