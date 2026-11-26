/**
 * Game 4: 절망요새 숨바꼭질 (DESPAIR FORTRESS · HIDE & SEEK)
 *
 * Modelled on the "かくれんぼ" room of Fuji-Q Highland's 絶望要塞: one wall screen is
 * covered in tilted letter tiles, and every tile hides a 3-digit number behind it.
 * Numbers peek out above their tile one by one and duck back down. The player is told
 * which numbers to find and answers with the LETTER of the tile hiding each number
 * (tap the tile, or type the letter). Right when a round starts, every number pops
 * out at once for about a second — the famous "photograph that moment" tip.
 *
 * Built for a single screen (e.g. a wall display in a venue).
 * Implements mount(container, ctx) -> { unmount() } and exports the pure generator
 * generateFortressRun(rng) for determinism checks.
 */
import { shuffleSeeded } from '../core/seed.js';
import { TOUCH_HIT_SLOP, WRONG_INPUT_COOLDOWN_MS } from '../core/rules.js';

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const MAX_SHIELDS = 3;
const TARGETS_PER_ROUND = 3;
const SURVIVAL_BONUS_PER_SHIELD = 400;
const PERFECT_ROUND_BONUS = 500;

// Phase timings (seconds, game clock — everything stops while paused)
const INTRO_SEC = 1.6;
const ROUND_CLEAR_SEC = 1.3;
const FAIL_SEC = 1.1;
const PEEK_EASE_SEC = 0.16; // how long a number takes to slide out / back in
const TILE_FLASH_SEC = 0.6;
const MESSAGE_SEC = 1.1;
const DANGER_TIME_SEC = 8;

// Logical wall size: the short side is fixed and the long side follows the screen's
// aspect ratio, so the wall always fills the display. Portrait screens swap the grid.
const WALL_SHORT_SIDE = 900;
const PORTRAIT_ASPECT = 0.87;
const WALL_PAD = 46;

const ROUNDS = [
  { round: 1, cols: 8, rows: 5, flashSec: 1.6, cycleSec: 4.2, windowSec: 1.1, timeSec: 30, basePts: 400 },
  { round: 2, cols: 10, rows: 6, flashSec: 1.2, cycleSec: 5.0, windowSec: 0.9, timeSec: 32, basePts: 550 },
  { round: 3, cols: 12, rows: 7, flashSec: 1.0, cycleSec: 5.6, windowSec: 0.75, timeSec: 35, basePts: 700 },
];

const TILE_ANGLES = [45, 45, 38, 30, 20, 12, 0, -12, -20, -30, -38];

/**
 * Pure deterministic run generator: same rng seed → same letters, numbers, tilts,
 * peek timing and targets on every device. Screen positions are derived later from
 * each tile's grid cell, so landscape and portrait screens share the same content.
 * @param {() => number} rng
 */
export function generateFortressRun(rng) {
  return ROUNDS.map((cfg) => {
    const count = cfg.cols * cfg.rows;
    const numberPool = shuffleSeeded(
      rng,
      Array.from({ length: 1000 }, (_, n) => String(n).padStart(3, '0'))
    );
    const tiles = Array.from({ length: count }, (_, index) => ({
      index,
      letter: LETTERS[Math.floor(rng() * LETTERS.length)],
      number: numberPool[index],
      angle: TILE_ANGLES[Math.floor(rng() * TILE_ANGLES.length)],
      size: 0.74 + rng() * 0.26, // fraction of the cell
      jx: (rng() - 0.5) * 0.14, // jitter inside the cell
      jy: (rng() - 0.5) * 0.1,
      peekOffset: rng() * cfg.cycleSec,
    }));
    const targets = shuffleSeeded(rng, tiles)
      .slice(0, TARGETS_PER_ROUND)
      .map((tile) => ({ tileIndex: tile.index, number: tile.number, letter: tile.letter, solved: false }));
    return { ...cfg, tiles, targets };
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

/**
 * @param {HTMLElement} container
 * @param {object} ctx
 * @returns {{ unmount: () => void }}
 */
export function mount(container, ctx) {
  const rounds = generateFortressRun(ctx.rng);
  const totalRounds = rounds.length;
  const totalTargets = totalRounds * TARGETS_PER_ROUND;

  const root = document.createElement('div');
  root.className = 'game-root game-fortress';
  root.innerHTML = `
    <header class="df-console">
      <span class="df-round" data-df-round>ROUND 1/${totalRounds}</span>
      <div class="df-targets" aria-live="polite">
        <span class="df-targets__label">찾을 숫자</span>
        <div class="df-targets__slots" data-df-slots></div>
      </div>
      <div class="df-status">
        <span class="df-shields" data-df-shields aria-label="남은 쉴드"></span>
        <div class="df-timebar" aria-hidden="true"><span data-df-timebar></span></div>
      </div>
    </header>
    <div class="df-wall-wrap" data-df-wrap>
      <canvas class="df-wall" data-df-canvas aria-label="알파벳 타일 벽. 숫자를 숨긴 타일을 누르세요."></canvas>
      <div class="df-overlay" data-df-overlay hidden>
        <p class="df-overlay__eyebrow" data-df-overlay-sub></p>
        <h2 class="df-overlay__title" data-df-overlay-title></h2>
        <p class="df-overlay__body" data-df-overlay-body></p>
      </div>
    </div>
    <p class="df-help" data-df-help>숫자를 숨기고 있는 타일을 누르거나, 그 타일의 알파벳을 키보드로 입력하세요.</p>
  `;
  container.appendChild(root);

  const roundEl = root.querySelector('[data-df-round]');
  const slotsEl = root.querySelector('[data-df-slots]');
  const shieldsEl = root.querySelector('[data-df-shields]');
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
  let phase = 'intro'; // intro | flash | hunt | clear | fail | ended
  let phaseClock = 0; // seconds spent in the current phase
  let huntClock = 0; // seconds since numbers started peeking (drives the cycle)
  let roundElapsed = 0; // counts against the round's limit (flash + hunt)
  let activeMs = 0;
  let activeTarget = 0;
  let shields = MAX_SHIELDS;
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
  const heartsText = () => `${'♥'.repeat(shields)}${'♡'.repeat(MAX_SHIELDS - shields)}`;

  function renderSlots() {
    slotsEl.innerHTML = round()
      .targets.map((t, i) => {
        const state = t.solved ? 'is-solved' : i === activeTarget ? 'is-active' : '';
        const tail = t.solved ? `<b class="df-slot__letter">${t.letter}</b>` : '';
        return `<span class="df-slot ${state}">${t.number}${tail}</span>`;
      })
      .join('<span class="df-slot__arrow" aria-hidden="true">→</span>');
  }

  function renderShields() {
    shieldsEl.textContent = heartsText();
  }

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
    const limit = round().timeSec;
    const remaining = Math.max(0, limit - roundElapsed);
    const counting = phase === 'flash' || phase === 'hunt';
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
      huntClock = 0;
      roundElapsed = 0;
      roundMistakes = 0;
      tileFlash.clear();
      roundEl.textContent = `ROUND ${roundIdx + 1}/${totalRounds}`;
      renderSlots();
      showOverlay(
        `ROUND ${roundIdx + 1}`,
        `타일 ${round().tiles.length}개 · 숫자 ${TARGETS_PER_ROUND}개`,
        '시작하는 순간 모든 숫자가 잠깐 보입니다. 놓치지 마세요!',
        'info'
      );
    } else if (next === 'flash') {
      overlayEl.hidden = true;
      ctx.audio.playHint();
    }
    syncHud();
  }

  function finishRun(cleared) {
    if (finished) return;
    finished = true;
    phase = 'ended';
    if (cleared) score += shields * SURVIVAL_BONUS_PER_SHIELD;
    const accuracy = inputs > 0 ? Math.round((correct / inputs) * 100) : 0;
    ctx.completeGame({
      score,
      timeMs: Math.round(activeMs),
      accuracy,
      cleared,
      details: [
        { label: '돌파 라운드', value: `${cleared ? totalRounds : roundIdx} / ${totalRounds}` },
        { label: '찾은 숫자', value: `${solvedTotal} / ${totalTargets} (${accuracy}%)` },
        { label: '최고 콤보', value: `${maxStreak} COMBO` },
        { label: '남은 쉴드', value: heartsText() },
      ],
    });
  }

  function failRun(title) {
    if (phase === 'fail' || finished) return;
    ctx.audio.playAlarm();
    showOverlay('LOCKDOWN', title, `최종 점수 ${score.toLocaleString('en-US')} PTS`, 'danger');
    enterPhase('fail');
  }

  function roundCleared() {
    const remaining = Math.max(0, round().timeSec - roundElapsed);
    const speedBonus = Math.round(remaining * 60);
    const perfect = roundMistakes === 0 ? PERFECT_ROUND_BONUS : 0;
    score += speedBonus + perfect;
    const isFinal = roundIdx >= totalRounds - 1;
    ctx.audio.playMatch(6);
    const parts = [`스피드 +${speedBonus}`];
    if (perfect) parts.push(`PERFECT +${PERFECT_ROUND_BONUS}`);
    if (isFinal) parts.push(`생존 +${shields * SURVIVAL_BONUS_PER_SHIELD}`);
    showOverlay(`ROUND ${roundIdx + 1} CLEAR`, isFinal ? '절망요새 탈출 성공!' : '라운드 돌파!', parts.join(' · '), 'success');
    enterPhase('clear');
  }

  /** Answers the active target with a letter; `tileIndex` is set when a tile was tapped. */
  function answer(letter, tileIndex = -1) {
    if (finished || isPaused || (phase !== 'flash' && phase !== 'hunt')) return;
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
      score += round().basePts + (streak >= 2 ? 60 * Math.min(streak, 9) : 0);
      ctx.audio.playMatch(streak);
      // Always reveal where the number really was
      tileFlash.set(target.tileIndex, { color: color.neon, until: activeMs + TILE_FLASH_SEC * 2000 });
      flashMessage(`${target.number} = ${target.letter} 정답!`, 'success');
      activeTarget += 1;
      renderSlots();
      if (activeTarget >= round().targets.length) roundCleared();
    } else {
      cooldownUntil = activeMs + WRONG_INPUT_COOLDOWN_MS;
      shields -= 1;
      streak = 0;
      roundMistakes += 1;
      ctx.audio.playError();
      if (tileIndex >= 0) {
        tileFlash.set(tileIndex, { color: color.danger, until: activeMs + TILE_FLASH_SEC * 1000 });
      }
      renderShields();
      wrapEl.classList.remove('is-shake');
      void wrapEl.offsetWidth;
      wrapEl.classList.add('is-shake');
      flashMessage(`${letter} 아님! 쉴드 -1`, 'danger');
      if (shields <= 0) failRun('쉴드 소진! 요새 봉쇄');
    }
    syncHud();
  }

  // --- Drawing ---------------------------------------------------------------------
  function peekAmount(tile, r) {
    if (phase === 'flash') return 1;
    if (phase !== 'hunt') return 0;
    const t = (huntClock + tile.peekOffset) % r.cycleSec;
    if (t >= r.windowSec) return 0;
    return Math.min(1, Math.min(t, r.windowSec - t) / PEEK_EASE_SEC);
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
    g.font = `800 ${Math.round(s * 1.05)}px Outfit, sans-serif`;
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
    const showNumbers = phase === 'flash' || phase === 'hunt';
    for (const tile of r.tiles) {
      drawTile(tile, geo[tile.index], showNumbers ? peekAmount(tile, r) : 0);
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
      const r = round();

      if (phase === 'intro') {
        if (phaseClock >= INTRO_SEC) enterPhase('flash');
      } else if (phase === 'flash' || phase === 'hunt') {
        roundElapsed += dt;
        if (phase === 'hunt') huntClock += dt;
        else if (phaseClock >= r.flashSec) enterPhase('hunt');
        const remaining = r.timeSec - roundElapsed;
        if (remaining <= 5 && Math.ceil(remaining) !== Math.ceil(remaining + dt)) ctx.audio.playTick();
        if (remaining <= 0) failRun('시간 초과! 금고 봉쇄');
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
  };

  const onKeyDown = (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
    if (phase !== 'flash' && phase !== 'hunt') return;
    const key = String(e.key || '').toUpperCase();
    if (key.length !== 1 || !LETTERS.includes(key)) return;
    e.preventDefault();
    answer(key);
  };

  const onPause = (e) => {
    isPaused = Boolean(e.detail?.paused);
    if (!isPaused) lastTs = performance.now();
  };

  const resizeObserver = typeof ResizeObserver === 'function' ? new ResizeObserver(resize) : null;
  resizeObserver?.observe(wrapEl);
  window.addEventListener('resize', resize);
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('pm:pausechange', onPause);
  canvas.addEventListener('pointerdown', onPointerDown);

  if (window.matchMedia?.('(pointer: coarse)').matches) {
    helpEl.textContent = '숫자를 숨기고 있는 타일을 터치하세요. 라운드 시작 순간 모든 숫자가 잠깐 보입니다!';
  }
  resize();
  renderShields();
  enterPhase('intro');
  rafId = requestAnimationFrame(step);

  return {
    unmount() {
      unmounted = true;
      cancelAnimationFrame(rafId);
      resizeObserver?.disconnect();
      window.removeEventListener('resize', resize);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('pm:pausechange', onPause);
      canvas.removeEventListener('pointerdown', onPointerDown);
      container.innerHTML = '';
    },
  };
}
