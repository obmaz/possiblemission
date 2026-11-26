/**
 * Game 4: 숫자 숨바꼭질 (NUMBER HIDE & SEEK)
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
  parseHideSeekMode,
} from './hide-seek-settings.js';

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
const HANGUL = '가나다라마바사아자차카타파하'.split('');
const ROUND_COUNT = 3;
const TARGETS_PER_ROUND = 3;
const PERFECT_ROUND_BONUS = 500;
// A wrong answer costs time (there are no shields), so guessing is never free
const WRONG_PENALTY_SEC = 3;
const LAST_MODE_PREF = 'hideSeekLastMode';

// Phase timings (seconds, game clock — everything stops while paused)
const INTRO_SEC = 2.2;
const ROUND_CLEAR_SEC = 1.3;
const FAIL_SEC = 1.1;
const PEEK_EASE_SEC = 0.16; // how long a number takes to slide out / back in
const PEEK_REST_SEC = 0.6; // a number that just hid stays hidden at least this long
const TILE_FLASH_SEC = 0.6;
const MESSAGE_SEC = 1.1;
const DANGER_TIME_SEC = 8;

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
  const speed = 4 / Math.max(0.6, settings.revealSec); // 1 … 6.7
  const batch = settings.hideBatch === 0 ? 2 : 1 + Math.min(settings.hideBatch, 12) / 12;
  return Math.round((200 + 60 * density + 40 * speed) * batch);
}

/**
 * Pure deterministic run generator: same rng seed + settings → same letters, numbers,
 * tilts, hide order, peek timing and targets on every device.
 * @param {() => number} rng
 * @param {object} settings - parsed values from parseHideSeekMode()
 */
export function generateFortressRun(rng, settings) {
  const [cols, rows] = TILE_GRID[settings.tiles];
  const count = cols * rows;
  const cycleSec = peekCycleSec(settings);
  return Array.from({ length: ROUND_COUNT }, (_round, r) => {
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
    if (settings.hideBatch > 0) {
      shuffleSeeded(rng, tiles).forEach((tile, rank) => {
        tile.hideAt = settings.revealSec + Math.floor(rank / settings.hideBatch) * settings.hideIntervalSec;
      });
    }
    // Three different symbols per round
    const seen = new Set();
    const targets = shuffleSeeded(rng, tiles)
      .filter((tile) => !seen.has(tile.letter) && seen.add(tile.letter))
      .slice(0, TARGETS_PER_ROUND)
      .map((tile) => ({ number: tile.number, letter: tile.letter, solved: false }));
    return { round: r + 1, cols, rows, cycleSec, tiles, targets };
  });
}

/** Canvas colours come from the shared design tokens so the wall matches the shell. */
function readPalette(el) {
  const css = getComputedStyle(el);
  const pick = (name, fallback) => css.getPropertyValue(name).trim() || fallback;
  return {
    neon: pick('--neon-emerald', '#3fbf92'),
    danger: pick('--neon-crimson', '#e06767'),
    text: pick('--text-primary', '#eef2f8'),
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

const formatValue = (field, value) => {
  if (field.valueLabels) return field.valueLabels[value];
  return value === 0 && field.allLabel ? field.allLabel : `${value}${field.unit}`;
};

/** One-line plain-language summary of a set of values. */
function describe(s) {
  const hide =
    s.hideBatch === 0
      ? `${s.revealSec}초 뒤 한꺼번에 사라지고`
      : `${s.revealSec}초 뒤 ${s.hideBatch}개씩 ${s.hideIntervalSec}초마다 사라지고`;
  const hangul = s.hangul ? ' 한글 포함.' : '';
  return `타일 ${s.tiles}개 · 처음 ${hide}, 이후 ${s.peekSec}초씩 다시 보입니다.${hangul}`;
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
      <p class="df-setup__sub">타일 뒤에 숨은 숫자를 찾아 그 타일의 <b>글자</b>를 맞히세요. 같은 룸 시드와 같은 설정이면 모두 같은 벽이 나옵니다.</p>
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
 * The game
 * ========================================================================== */
function mountGame(container, ctx, settings) {
  const rounds = generateFortressRun(ctx.rng, settings);
  const totalRounds = rounds.length;
  const totalTargets = totalRounds * TARGETS_PER_ROUND;
  const roundPts = basePoints(settings);

  const root = document.createElement('div');
  root.className = 'game-root game-fortress';
  root.innerHTML = `
    <header class="df-console">
      <span class="df-round" data-df-round>ROUND 1/${totalRounds}</span>
      <div class="df-targets" aria-live="polite">
        <span class="df-targets__label">찾을 숫자</span>
        <div class="df-targets__slots" data-df-slots></div>
      </div>
      <form class="df-answer" data-df-answer autocomplete="off">
        <input class="df-answer__input" data-df-input maxlength="2" placeholder="정답" aria-label="정답 글자 입력" spellcheck="false" />
        <button type="submit" class="df-answer__btn">확인</button>
      </form>
      <div class="df-timebar" aria-hidden="true"><span data-df-timebar></span></div>
    </header>
    <div class="df-wall-wrap" data-df-wrap>
      <canvas class="df-wall" data-df-canvas aria-label="알파벳 타일 벽. 숫자를 숨긴 타일을 누르세요."></canvas>
      <div class="df-overlay" data-df-overlay hidden>
        <p class="df-overlay__eyebrow" data-df-overlay-sub></p>
        <h2 class="df-overlay__title" data-df-overlay-title></h2>
        <p class="df-overlay__body" data-df-overlay-body></p>
      </div>
    </div>
    <p class="df-help" data-df-help>숫자를 숨기고 있는 타일의 글자를 정답 칸에 입력하세요. 타일을 눌러도 됩니다.</p>
  `;
  container.appendChild(root);

  const roundEl = root.querySelector('[data-df-round]');
  const slotsEl = root.querySelector('[data-df-slots]');
  const answerForm = root.querySelector('[data-df-answer]');
  const answerInput = root.querySelector('[data-df-input]');
  const finePointer = !window.matchMedia?.('(pointer: coarse)').matches;
  const timebarEl = root.querySelector('[data-df-timebar]');
  const wrapEl = root.querySelector('[data-df-wrap]');
  const canvas = root.querySelector('[data-df-canvas]');
  const overlayEl = root.querySelector('[data-df-overlay]');
  const overlaySubEl = root.querySelector('[data-df-overlay-sub]');
  const overlayTitleEl = root.querySelector('[data-df-overlay-title]');
  const overlayBodyEl = root.querySelector('[data-df-overlay-body]');
  const helpEl = root.querySelector('[data-df-help]');
  const g = canvas.getContext('2d');
  const color = readPalette(root);

  // --- Run state ---------------------------------------------------------------
  let roundIdx = 0;
  let phase = 'intro'; // intro | play | clear | fail | ended
  let phaseClock = 0; // seconds in the current phase (play: time since numbers appeared)
  let activeMs = 0;
  let activeTarget = 0;
  let penaltySec = 0; // added to the round clock by wrong answers
  let roundsCleared = 0;
  let score = 0;
  let streak = 0;
  let maxStreak = 0;
  let roundMistakes = 0;
  let inputs = 0;
  let correct = 0;
  let solvedTotal = 0;
  let cooldownUntil = 0; // activeMs
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
  let geometry = []; // per round: tile index -> { x, y, half, angleRad, cell }

  function buildGeometry() {
    geometry = rounds.map((r) => {
      const cols = portrait ? r.rows : r.cols;
      const rows = portrait ? r.cols : r.rows;
      const cellW = (logical.w - WALL_PAD * 2) / cols;
      const cellH = (logical.h - WALL_PAD * 2) / rows;
      const cell = Math.min(cellW, cellH);
      return r.tiles.map((tile) => {
        const i = tile.index;
        const c = portrait ? Math.floor(i / r.cols) : i % r.cols;
        const row = portrait ? i % r.cols : Math.floor(i / r.cols);
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
  const round = () => rounds[roundIdx];

  function renderSlots() {
    slotsEl.innerHTML = round()
      .targets.map((t, i) => {
        const state = t.solved ? 'is-solved' : i === activeTarget ? 'is-active' : '';
        const tail = t.solved ? `<b class="df-slot__letter">${t.letter}</b>` : '';
        return `<span class="df-slot ${state}">${t.number}${tail}</span>`;
      })
      .join('<span class="df-slot__arrow" aria-hidden="true">→</span>');
  }

  const timeUsed = () => (phase === 'play' ? phaseClock + penaltySec : 0);

  function showOverlay(sub, title, body, tone) {
    overlaySubEl.textContent = sub;
    overlayTitleEl.textContent = title;
    overlayBodyEl.textContent = body;
    overlayEl.dataset.tone = tone;
    overlayEl.hidden = false;
  }

  function flashMessage(text, tone) {
    message = { text, tone, until: activeMs + MESSAGE_SEC * 1000 };
  }

  function syncHud() {
    const limit = settings.timeSec;
    const remaining = Math.max(0, limit - timeUsed());
    const counting = phase === 'play';
    timebarEl.style.setProperty('--df-time', (remaining / limit).toFixed(4));
    timebarEl.dataset.state = counting && remaining <= DANGER_TIME_SEC ? 'danger' : 'normal';
    ctx.updateHud({
      timer: counting ? remaining : { text: phase === 'intro' ? 'READY' : '--:--', state: 'normal' },
      score,
      progress: `ROUND ${roundIdx + 1}/${totalRounds}`,
      progressRatio: remaining / limit,
    });
  }

  // --- Flow ------------------------------------------------------------------------
  function enterPhase(next) {
    phase = next;
    phaseClock = 0;
    if (next === 'intro') {
      activeTarget = 0;
      roundMistakes = 0;
      penaltySec = 0;
      tileFlash.clear();
      roundEl.textContent = `ROUND ${roundIdx + 1}/${totalRounds}`;
      renderSlots();
      showOverlay(`ROUND ${roundIdx + 1}`, `숫자 ${TARGETS_PER_ROUND}개를 찾으세요`, describe(settings), 'info');
    } else if (next === 'play') {
      overlayEl.hidden = true;
      ctx.audio.playHint();
      if (finePointer) answerInput.focus({ preventScroll: true });
    }
    syncHud();
  }

  function finishRun(cleared) {
    if (finished) return;
    finished = true;
    phase = 'ended';
    const accuracy = inputs > 0 ? Math.round((correct / inputs) * 100) : 0;
    ctx.completeGame({
      score,
      timeMs: Math.round(activeMs),
      accuracy,
      cleared,
      details: [
        { value: `🏁 ${roundsCleared}/${totalRounds} 라운드` },
        { value: `🔢 ${solvedTotal}/${totalTargets} 숫자` },
        { value: `⏱ ${(activeMs / 1000).toFixed(1)}초` },
        { value: `❌ 오답 ${inputs - correct}회` },
      ],
    });
  }

  function failRun(title) {
    if (phase === 'fail' || finished) return;
    ctx.audio.playAlarm();
    showOverlay('GAME OVER', title, `${score.toLocaleString('en-US')}점`, 'danger');
    enterPhase('fail');
  }

  function roundCleared() {
    const remaining = Math.max(0, settings.timeSec - timeUsed());
    const speedBonus = Math.round(remaining * 60);
    roundsCleared += 1;
    const perfect = roundMistakes === 0 ? PERFECT_ROUND_BONUS : 0;
    score += speedBonus + perfect;
    const isFinal = roundIdx >= totalRounds - 1;
    ctx.audio.playMatch(6);
    const parts = [`스피드 +${speedBonus}`];
    if (perfect) parts.push(`PERFECT +${PERFECT_ROUND_BONUS}`);
    showOverlay(`ROUND ${roundIdx + 1} CLEAR`, isFinal ? '숨바꼭질 완전 정복!' : '라운드 돌파!', parts.join(' · '), 'success');
    enterPhase('clear');
  }

  /** Answers the active target with a letter; `tileIndex` is set when a tile was tapped. */
  function answer(letter, tileIndex = -1) {
    if (finished || isPaused || phase !== 'play') return;
    if (activeMs < cooldownUntil) return;
    const target = round().targets[activeTarget];
    if (!target) return;
    inputs += 1;

    if (letter === target.letter) {
      correct += 1;
      solvedTotal += 1;
      target.solved = true;
      streak += 1;
      maxStreak = Math.max(maxStreak, streak);
      score += roundPts + (streak >= 2 ? 60 * Math.min(streak, 9) : 0);
      ctx.audio.playMatch(streak);
      // Reveal every tile that hides this number
      for (const tile of round().tiles) {
        if (tile.letter === target.letter) {
          tileFlash.set(tile.index, { color: color.neon, until: activeMs + TILE_FLASH_SEC * 2000 });
        }
      }
      flashMessage(`${target.number} = ${target.letter} 정답!`, 'success');
      activeTarget += 1;
      renderSlots();
      if (activeTarget >= round().targets.length) roundCleared();
    } else {
      cooldownUntil = activeMs + WRONG_INPUT_COOLDOWN_MS;
      penaltySec += WRONG_PENALTY_SEC;
      streak = 0;
      roundMistakes += 1;
      ctx.audio.playError();
      if (tileIndex >= 0) {
        tileFlash.set(tileIndex, { color: color.danger, until: activeMs + TILE_FLASH_SEC * 1000 });
      }
      wrapEl.classList.remove('is-shake');
      void wrapEl.offsetWidth;
      wrapEl.classList.add('is-shake');
      flashMessage(`${letter} 아님! -${WRONG_PENALTY_SEC}초`, 'danger');
    }
    syncHud();
  }

  // --- Drawing ---------------------------------------------------------------------
  /** 0 (hidden behind the tile) … 1 (fully out above it) at play time `t`. */
  function peekAmount(tile, r, t) {
    if (t < tile.hideAt) {
      // Opening reveal: pop out, then slide back in when this tile's batch hides
      return Math.max(0, Math.min(1, t / PEEK_EASE_SEC, (tile.hideAt - t) / PEEK_EASE_SEC));
    }
    const since = t - tile.hideAt;
    if (since < PEEK_REST_SEC) return 0;
    const p = (since + tile.peekOffset) % r.cycleSec;
    if (p >= settings.peekSec) return 0;
    return Math.min(1, Math.min(p, settings.peekSec - p) / PEEK_EASE_SEC);
  }

  function drawWall() {
    g.fillStyle = color.wall;
    g.fillRect(0, 0, logical.w, logical.h);
    g.fillStyle = color.wallDot;
    for (let y = 24; y < logical.h; y += 36) {
      for (let x = 24; x < logical.w; x += 36) g.fillRect(x, y, 2, 2);
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
      g.save();
      g.globalAlpha = Math.min(1, peek * 1.4);
      g.fillStyle = color.number;
      g.font = `700 ${Math.round(p.cell * 0.24)}px "Space Grotesk", monospace`;
      g.textAlign = 'center';
      g.textBaseline = 'alphabetic';
      g.fillText(tile.number, p.x, p.y - rise);
      g.fillRect(p.x - p.cell * 0.17, p.y - rise + p.cell * 0.03, p.cell * 0.34, 2);
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
    const r = round();
    const geo = geometry[roundIdx];
    const showNumbers = phase === 'play';
    for (const tile of r.tiles) {
      drawTile(tile, geo[tile.index], showNumbers ? peekAmount(tile, r, phaseClock) : 0);
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
      phaseClock += dt;

      if (phase === 'intro') {
        if (phaseClock >= INTRO_SEC) enterPhase('play');
      } else if (phase === 'play') {
        const remaining = settings.timeSec - timeUsed();
        if (remaining <= 5 && Math.ceil(remaining) !== Math.ceil(remaining + dt)) ctx.audio.playTick();
        if (remaining <= 0) failRun('시간 초과!');
        else syncHud();
      } else if (phase === 'clear') {
        if (phaseClock >= ROUND_CLEAR_SEC) {
          overlayEl.hidden = true;
          if (roundIdx >= totalRounds - 1) {
            finishRun(true);
          } else {
            roundIdx += 1;
            enterPhase('intro');
          }
        }
      } else if (phase === 'fail' && phaseClock >= FAIL_SEC) {
        finishRun(false);
      }
    }
    draw();
  }

  // --- Input -----------------------------------------------------------------------
  function tileAt(clientX, clientY, isTouch) {
    const rect = canvas.getBoundingClientRect();
    const lx = (clientX - rect.left - view.ox) / view.scale;
    const ly = (clientY - rect.top - view.oy) / view.scale;
    const geo = geometry[roundIdx];
    const slop = isTouch ? TOUCH_HIT_SLOP * Math.min(logical.w, logical.h) : 0;
    // Topmost first: tiles are drawn in index order
    for (let i = geo.length - 1; i >= 0; i -= 1) {
      const p = geo[i];
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
    if (idx >= 0) answer(round().tiles[idx].letter, idx);
    if (finePointer) answerInput.focus({ preventScroll: true });
  };

  /** Validates one typed symbol and answers with it. */
  function submitTyped() {
    const value = answerInput.value.trim().toUpperCase();
    answerInput.value = '';
    if (!value) return;
    const symbol = [...value].pop();
    if (!LETTERS.includes(symbol) && !HANGUL.includes(symbol)) {
      flashMessage('알파벳이나 가~하 한 글자를 입력하세요', 'danger');
      return;
    }
    answer(symbol);
  }

  const onAnswerSubmit = (e) => {
    e.preventDefault();
    submitTyped();
  };

  // A single finished character answers immediately (Hangul waits for IME composition)
  const onAnswerInput = (e) => {
    if (e.isComposing) return;
    const value = answerInput.value.trim();
    if (value && /^[A-Za-z]$/.test(value)) submitTyped();
  };
  const onCompositionEnd = () => {
    if (/^[가-힣]$/.test(answerInput.value.trim())) submitTyped();
  };

  const onPause = (e) => {
    isPaused = Boolean(e.detail?.paused);
    if (!isPaused) lastTs = performance.now();
  };

  const resizeObserver = typeof ResizeObserver === 'function' ? new ResizeObserver(resize) : null;
  resizeObserver?.observe(wrapEl);
  window.addEventListener('resize', resize);
  answerForm.addEventListener('submit', onAnswerSubmit);
  answerInput.addEventListener('input', onAnswerInput);
  answerInput.addEventListener('compositionend', onCompositionEnd);
  window.addEventListener('pm:pausechange', onPause);
  canvas.addEventListener('pointerdown', onPointerDown);

  if (window.matchMedia?.('(pointer: coarse)').matches) {
    helpEl.textContent = '숫자를 숨긴 타일을 터치하거나, 그 글자를 정답 칸에 입력하세요.';
  }
  resize();
  enterPhase('intro');
  rafId = requestAnimationFrame(step);

  return {
    unmount() {
      unmounted = true;
      cancelAnimationFrame(rafId);
      resizeObserver?.disconnect();
      window.removeEventListener('resize', resize);
      answerForm.removeEventListener('submit', onAnswerSubmit);
      answerInput.removeEventListener('input', onAnswerInput);
      answerInput.removeEventListener('compositionend', onCompositionEnd);
      window.removeEventListener('pm:pausechange', onPause);
      canvas.removeEventListener('pointerdown', onPointerDown);
      container.innerHTML = '';
    },
  };
}
