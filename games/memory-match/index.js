/**
 * Game: 메모리 매치 (MEMORY MATCH)
 * `mount(container, ctx)` -> `{ unmount() }`. Preview, flip, match, combo; sizes live in ./settings.js.
 */
import { bindClock, bindScore } from '../../js/core/clock.js';
import { pickSeeded, shuffleSeeded } from '../../js/core/seed.js';
import { MEMORY_MODES } from './settings.js';
import { SYMBOLS } from './symbols.js';


const PREVIEW_DURATION_MS = 2000;
const PREVIEW_STAGGER_MS = 10;
const FLIP_DURATION_MS = 320;
const MISMATCH_LOCK_MS = 680;
const FINISH_DELAY_MS = 560;
const FLOAT_BADGE_MS = 940;


/**
 * Resolves mode config with safe fallback to 4x4.
 * @param {string} mode
 */
function resolveModeConfig(mode) {
  return MEMORY_MODES[mode] || MEMORY_MODES['4x4'];
}

/**
 * Deterministically picks `pairs` symbols and shuffles the doubled deck via seeded RNG.
 * @param {() => number} rng
 * @param {string} mode
 */
function buildSeededDeck(rng, mode) {
  const cfg = resolveModeConfig(mode);
  const chosen = pickSeeded(rng, SYMBOLS, cfg.pairs);
  const doubled = [];
  chosen.forEach((symbol) => {
    doubled.push({ symbolId: symbol.id, symbol, pairIndex: 0 });
    doubled.push({ symbolId: symbol.id, symbol, pairIndex: 1 });
  });
  return shuffleSeeded(rng, doubled).map((card, index) => ({
    ...card,
    index,
    isFlipped: false,
    isMatched: false,
  }));
}

function renderCardBackHtml() {
  return `
    <div class="mm-back-emblem">
      <svg class="mm-back-sigil" viewBox="0 0 40 40" fill="none" aria-hidden="true">
        <polygon points="20,3 35,11.5 35,28.5 20,37 5,28.5 5,11.5" fill="rgba(123,91,214,0.1)" stroke="#7b5bd6" stroke-width="1.6"/>
        <polygon points="20,8 30,14 30,26 20,32 10,26 10,14" stroke="rgba(148,163,184,0.55)" stroke-width="1.2" stroke-dasharray="3 2"/>
        <path d="M16.8 15.5C16.8 13.8 18.2 12.6 20.1 12.6C22.1 12.6 23.4 13.8 23.4 15.4C23.4 16.9 22.3 17.7 21.1 18.4C20.2 19 19.9 19.6 19.9 20.7V21.5" stroke="#5b47b8" stroke-width="2.2" stroke-linecap="round"/>
        <circle cx="20" cy="25.5" r="1.5" fill="#fbbf24"/>
      </svg>
      <span class="mm-back-brand">POSSIBLE<br/>MISSION</span>
    </div>
  `;
}

/**
 * Mounts Memory Match inside #game-stage.
 * @param {HTMLElement} container
 * @param {object} ctx
 * @returns {{ unmount: () => void }}
 */
export function mount(container, ctx) {
  // `setup` (or any unknown mode) shows the in-game difficulty chooser first
  if (!MEMORY_MODES[ctx.mode]) return mountSetup(container, ctx);
  const cfg = resolveModeConfig(ctx.mode);
  const deck = buildSeededDeck(ctx.rng, cfg.id);
  const totalPairs = cfg.pairs;

  let phase = 'preview'; // 'preview' | 'playing' | 'ended'
  const maxStaggerMs = Math.max(0, (deck.length - 1) * PREVIEW_STAGGER_MS);
  let previewRevealStarted = false;
  let previewRevealWaitMs = maxStaggerMs + FLIP_DURATION_MS;
  let previewRemainingMs = PREVIEW_DURATION_MS;
  let remainingMs = cfg.timeLimitSec * 1000;
  let elapsedActiveMs = 0;

  let isPaused = false;
  let finished = false;
  let mismatchLock = false;
  let mismatchRemainingMs = 0;
  let mismatchPair = null;

  let flippedIndices = [];
  let moves = 0;
  let matchedPairs = 0;
  let combo = 0;
  let maxCombo = 0;
  let matchScore = 0;

  let lastPreviewTickSec = -1;
  let lastPlayTickSec = -1;
  let lastTopbarCueKey = '';
  let lastTopbarHintKey = '';
  let lastTopbarComboKey = '';
  let lastTopbarMeterHidden = null;
  let lastTopbarMeterRatio = '';
  let lastTopbarSkipHidden = null;
  let lastMoves = -1;
  let rafId = 0;
  let revealRafId = 0;
  let lastFrameTs = 0;
  let finishTimeoutId = 0;
  let resizeObserver = null;
  let activeCols = cfg.landscapeCols;
  let activeRows = cfg.landscapeRows;
  const fxTimeouts = new Set();

  // Build Root DOM
  const root = document.createElement('div');
  root.className = 'game-root game-memory-match';
  root.innerHTML = `
    <div class="mm-head">
      <div class="mm-head__text">
        <p class="mm-cue" data-mm-cue>
          <span class="mm-cue__title">2초 안에 카드를 외우세요</span>
          <span class="mm-cue__count" data-mm-count data-active="2" aria-hidden="true"><b data-step="2">2</b><span class="mm-cue__arrow">→</span><b data-step="1">1</b></span>
        </p>
        <p class="mm-hint" data-mm-hint hidden>카드를 뒤집어 같은 그림 짝을 찾으세요</p>
      </div>
      <span class="mm-combo" data-mm-combo hidden></span>
      <div class="mm-stats">
        <span class="mm-moves" data-mm-moves></span>
        <span class="pm-score" data-pm-score></span>
        <span class="pm-timer" data-pm-timer></span>
      </div>
      <button type="button" class="mm-skip" data-mm-preview-skip title="프리뷰 즉시 건너뛰기 (Space)">
        프리뷰 건너뛰기 <span class="mm-skip__key">Space</span>
      </button>
    </div>
    <div class="mm-preview-meter" aria-hidden="true">
      <div class="mm-preview-meter__fill"></div>
    </div>
    <div class="mm-board-wrap">
      <div class="mm-grid" role="grid" aria-label="메모리 매치 카드 보드"></div>
      <div class="mm-fx-layer" aria-hidden="true"></div>
    </div>
  `;
  container.appendChild(root);

  const cueEl = root.querySelector('[data-mm-cue]');
  const cueCountEl = root.querySelector('[data-mm-count]');
  const hintEl = root.querySelector('[data-mm-hint]');
  const comboEl = root.querySelector('[data-mm-combo]');
  const movesEl = root.querySelector('[data-mm-moves]');
  const setTimer = bindClock(root.querySelector('[data-pm-timer]'));
  const setScore = bindScore(root.querySelector('[data-pm-score]'));
  const skipLinkEl = root.querySelector('[data-mm-preview-skip]');
  const previewMeterEl = root.querySelector('.mm-preview-meter');
  const boardWrapEl = root.querySelector('.mm-board-wrap');
  const gridEl = root.querySelector('.mm-grid');
  const fxLayerEl = root.querySelector('.mm-fx-layer');

  const cardButtons = deck.map((card, idx) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'mm-card';
    btn.dataset.index = String(idx);
    btn.style.setProperty('--mm-stagger', `${idx * PREVIEW_STAGGER_MS}ms`);
    btn.setAttribute('aria-label', `${idx + 1}번 카드: ${card.symbol.label} (미리보기)`);
    btn.innerHTML = `
      <div class="mm-card__motion">
        <div class="mm-card__inner">
          <div class="mm-card__face mm-card__back">${renderCardBackHtml()}</div>
          <div
            class="mm-card__face mm-card__front"
            style="--mm-accent: ${card.symbol.accent}; --mm-bg-a: ${card.symbol.bgA}; --mm-bg-b: ${card.symbol.bgB};"
          >
            <div class="mm-card__icon-wrap">${card.symbol.renderSvg(idx)}</div>
            <span class="mm-card__label">${card.symbol.shortLabel}</span>
          </div>
        </div>
      </div>
    `;
    gridEl.appendChild(btn);
    return btn;
  });

  revealRafId = requestAnimationFrame(() => {
    revealRafId = 0;
    if (finished || phase !== 'preview') return;
    previewRevealStarted = true;
    cardButtons.forEach((btn) => btn.classList.add('is-preview'));
  });

  function updateBoardLayout() {
    if (!boardWrapEl || !gridEl) return;
    const wrapW = boardWrapEl.clientWidth;
    const wrapH = boardWrapEl.clientHeight;
    if (wrapW <= 0 || wrapH <= 0) return;

    const isPortrait = wrapW < 560 && wrapH > wrapW;
    activeCols = isPortrait ? cfg.portraitCols : cfg.landscapeCols;
    activeRows = isPortrait ? cfg.portraitRows : cfg.landscapeRows;

    const gap = Math.max(8, Math.min(16, Math.round(Math.min(wrapW, wrapH) * 0.022)));
    const maxCellW = (wrapW - gap * (activeCols - 1)) / activeCols;
    const maxCellH = (wrapH - gap * (activeRows - 1)) / activeRows;

    const cellH = Math.max(36, Math.min(maxCellH, maxCellW / 0.78));
    const cellW = Math.max(36, Math.min(maxCellW, cellH * 0.94));

    const gridW = Math.floor(cellW * activeCols + gap * (activeCols - 1));
    const gridH = Math.floor(cellH * activeRows + gap * (activeRows - 1));

    gridEl.style.setProperty('--mm-cols', String(activeCols));
    gridEl.style.setProperty('--mm-rows', String(activeRows));
    gridEl.style.setProperty('--mm-gap', `${gap}px`);
    gridEl.style.setProperty('--mm-grid-w', `${gridW}px`);
    gridEl.style.setProperty('--mm-grid-h', `${gridH}px`);
  }

  function updateCardAria(idx) {
    const card = deck[idx];
    const btn = cardButtons[idx];
    if (!card || !btn) return;
    if (card.isMatched) {
      btn.setAttribute('aria-label', `${idx + 1}번 카드: ${card.symbol.label} (매칭 완료)`);
    } else if (phase === 'preview') {
      btn.setAttribute('aria-label', `${idx + 1}번 카드: ${card.symbol.label} (미리보기)`);
    } else if (card.isFlipped) {
      btn.setAttribute('aria-label', `${idx + 1}번 카드: ${card.symbol.label} (앞면)`);
    } else {
      btn.setAttribute('aria-label', `${idx + 1}번 카드 (뒷면)`);
    }
  }

  function syncStatus() {
    setTimer(phase === 'preview' ? cfg.timeLimitSec : remainingMs / 1000);
    setScore(matchScore);
    if (moves !== lastMoves) {
      lastMoves = moves;
      movesEl.textContent = `시도 ${moves}회`;
    }
  }

  function syncHint() {
    const remainingPairs = Math.max(0, totalPairs - matchedPairs);
    const hintKey = `${matchedPairs}:${remainingPairs}:${phase}`;
    if (hintKey === lastTopbarHintKey) return;
    lastTopbarHintKey = hintKey;
    if (remainingPairs === 0) {
      hintEl.textContent = '모든 쌍을 찾았습니다!';
    } else if (remainingPairs <= 3) {
      hintEl.innerHTML = `<span class="mm-hint__accent">마지막 ${remainingPairs}쌍!</span> 콤보를 이어가세요!`;
    } else if (matchedPairs === 0) {
      hintEl.textContent = '카드를 뒤집어 같은 그림 짝을 찾으세요';
    } else {
      hintEl.textContent = `남은 쌍 ${remainingPairs} · 콤보를 이어가세요!`;
    }
  }

  function syncCombo() {
    const showCombo = combo >= 2 && phase === 'playing';
    const comboKey = showCombo ? `combo:${combo}` : 'off';
    if (comboKey === lastTopbarComboKey) return;
    lastTopbarComboKey = comboKey;
    comboEl.hidden = !showCombo;
    if (showCombo) comboEl.textContent = `×${combo} COMBO`;
  }

  function syncTopbar() {
    if (phase === 'preview') {
      const countDigit = Math.max(1, Math.ceil(previewRemainingMs / 1000));
      const cueKey = `preview:${countDigit}`;
      if (cueKey !== lastTopbarCueKey) {
        lastTopbarCueKey = cueKey;
        cueEl.hidden = false;
        hintEl.hidden = true;
        cueCountEl.dataset.active = String(countDigit);
      }
      if (lastTopbarMeterHidden !== false) {
        lastTopbarMeterHidden = false;
        previewMeterEl.classList.remove('is-hidden');
      }
      const ratioStr = (previewRemainingMs / PREVIEW_DURATION_MS).toFixed(4);
      if (ratioStr !== lastTopbarMeterRatio) {
        lastTopbarMeterRatio = ratioStr;
        previewMeterEl.style.setProperty('--mm-preview-ratio', ratioStr);
      }
      if (lastTopbarSkipHidden !== false) {
        lastTopbarSkipHidden = false;
        skipLinkEl.hidden = false;
      }
      syncCombo();
      return;
    }

    if (lastTopbarCueKey !== 'play') {
      lastTopbarCueKey = 'play';
      cueEl.hidden = true;
      hintEl.hidden = false;
    }
    if (lastTopbarMeterHidden !== true) {
      lastTopbarMeterHidden = true;
      previewMeterEl.classList.add('is-hidden');
    }
    if (lastTopbarSkipHidden !== true) {
      lastTopbarSkipHidden = true;
      skipLinkEl.hidden = true;
    }

    syncHint();
    syncCombo();
  }

  function spawnFloatBadge(targetCardEl, text, isCombo) {
    if (!fxLayerEl || !boardWrapEl || !targetCardEl) return;
    const wrapRect = boardWrapEl.getBoundingClientRect();
    const cardRect = targetCardEl.getBoundingClientRect();
    const rawX = cardRect.left - wrapRect.left + cardRect.width / 2;
    const rawY = cardRect.top - wrapRect.top + cardRect.height * 0.35;

    const badge = document.createElement('div');
    badge.className = `mm-float-badge ${isCombo ? 'mm-float-badge--combo' : ''}`;
    badge.textContent = text;
    fxLayerEl.appendChild(badge);

    const halfW = (badge.offsetWidth || 120) / 2;
    const padX = 8;
    const minX = Math.min(wrapRect.width / 2, halfW + padX);
    const maxX = Math.max(minX, wrapRect.width - halfW - padX);
    const x = Math.max(minX, Math.min(maxX, rawX));
    const minY = Math.min(wrapRect.height / 2, 42);
    const maxY = Math.max(minY, wrapRect.height - 20);
    const y = Math.max(minY, Math.min(maxY, rawY));

    badge.style.left = `${x}px`;
    badge.style.top = `${y}px`;

    const tid = window.setTimeout(() => {
      fxTimeouts.delete(tid);
      badge.remove();
    }, FLOAT_BADGE_MS);
    fxTimeouts.add(tid);
  }

  function beginPlayPhase({ playFlipSfx = true } = {}) {
    if (phase !== 'preview' || finished) return;
    if (revealRafId) {
      cancelAnimationFrame(revealRafId);
      revealRafId = 0;
    }
    phase = 'playing';
    cardButtons.forEach((btn, idx) => {
      btn.classList.remove('is-preview');
      btn.style.setProperty('--mm-stagger', '0ms');
      updateCardAria(idx);
    });
    if (playFlipSfx) {
      ctx.audio.playFlip();
    }
    syncTopbar();
    syncStatus();
  }

  function finishGame(cleared) {
    if (finished) return;
    finished = true;
    phase = 'ended';
    mismatchLock = false;
    syncTopbar();

    const remainingSec = cleared ? Math.max(0, remainingMs / 1000) : 0;
    const timeBonus = cleared ? Math.round(remainingSec * 55) : 0;
    const efficiencyBonus = cleared ? Math.max(0, (2 * totalPairs - moves) * 100) : 0;
    const perfectBonus = cleared && moves === totalPairs ? 1200 : 0;
    const totalScore = Math.max(0, matchScore + timeBonus + efficiencyBonus + perfectBonus);
    const finalTimeMs = Math.round(elapsedActiveMs);

    setTimer(remainingSec);
    setScore(totalScore);

    const deliverResult = () => {
      ctx.completeGame({
        score: totalScore,
        timeMs: finalTimeMs,
        cleared,
        modeLabel: cfg.modeLabel,
        details: [
          { value: `🃏 ${matchedPairs}/${totalPairs}쌍` },
          { value: `⏱ ${(finalTimeMs / 1000).toFixed(1)}초` },
          { value: `🔁 ${moves}번 뒤집기` },
          { value: `🔥 최대 ${Math.max(1, maxCombo)}연속` },
        ],
      });
    };

    if (cleared) {
      finishTimeoutId = window.setTimeout(() => {
        finishTimeoutId = 0;
        deliverResult();
      }, FINISH_DELAY_MS);
    } else {
      deliverResult();
    }
  }

  function resolveMismatchPair() {
    if (!mismatchPair) return;
    const [i1, i2] = mismatchPair;
    [i1, i2].forEach((idx) => {
      deck[idx].isFlipped = false;
      const btn = cardButtons[idx];
      btn.classList.remove('is-flipped', 'is-mismatch');
      updateCardAria(idx);
    });
    mismatchPair = null;
    flippedIndices = [];
    mismatchLock = false;
    ctx.audio.playFlip();
  }

  function handleCardActivate(idx) {
    if (finished || isPaused || phase !== 'playing' || mismatchLock) return;
    const card = deck[idx];
    if (!card || card.isMatched || card.isFlipped) return;

    card.isFlipped = true;
    cardButtons[idx].classList.add('is-flipped');
    updateCardAria(idx);
    ctx.audio.playFlip();
    flippedIndices.push(idx);

    if (flippedIndices.length < 2) return;

    const [firstIdx, secondIdx] = flippedIndices;
    moves += 1;

    if (deck[firstIdx].symbolId === deck[secondIdx].symbolId) {
      // Match: 0ms input lock — immediately allow next card!
      flippedIndices = [];
      deck[firstIdx].isMatched = true;
      deck[secondIdx].isMatched = true;
      [firstIdx, secondIdx].forEach((mIdx) => {
        const btn = cardButtons[mIdx];
        btn.classList.remove('is-flipped');
        btn.classList.add('is-matched', 'is-just-matched');
        btn.setAttribute('aria-disabled', 'true');
        updateCardAria(mIdx);
      });

      matchedPairs += 1;
      combo += 1;
      maxCombo = Math.max(maxCombo, combo);
      const pts = 300 + Math.min(combo - 1, 5) * 120;
      matchScore += pts;

      ctx.audio.playMatch(combo);
      const badgeLabel = combo >= 2 ? `+${pts} ×${combo}` : `+${pts}`;
      spawnFloatBadge(cardButtons[secondIdx], badgeLabel, combo >= 2);

      syncTopbar();
      syncStatus();

      if (matchedPairs === totalPairs) {
        finishGame(true);
      }
    } else {
      // Mismatch: MISMATCH_LOCK_MS input lock while cards shake and flip back
      combo = 0;
      mismatchLock = true;
      mismatchRemainingMs = MISMATCH_LOCK_MS;
      mismatchPair = [firstIdx, secondIdx];
      cardButtons[firstIdx].classList.add('is-mismatch');
      cardButtons[secondIdx].classList.add('is-mismatch');
      ctx.audio.playError();
      syncTopbar();
      syncStatus();
    }
  }

  // Event Listeners
  const onGridClick = (e) => {
    const btn = e.target instanceof Element ? e.target.closest('.mm-card') : null;
    if (!btn || !gridEl.contains(btn)) return;
    const idx = Number(btn.dataset.index);
    if (Number.isInteger(idx)) {
      handleCardActivate(idx);
    }
  };

  const onGridKeyDown = (e) => {
    const btn = e.target instanceof Element ? e.target.closest('.mm-card') : null;
    if (!btn || !gridEl.contains(btn)) return;
    const idx = Number(btn.dataset.index);
    if (!Number.isInteger(idx)) return;

    const total = cardButtons.length;
    let nextIdx = -1;
    if (e.key === 'ArrowRight') {
      nextIdx = (idx + 1) % total;
    } else if (e.key === 'ArrowLeft') {
      nextIdx = (idx - 1 + total) % total;
    } else if (e.key === 'ArrowDown') {
      nextIdx = idx + activeCols < total ? idx + activeCols : idx % activeCols;
    } else if (e.key === 'ArrowUp') {
      if (idx - activeCols >= 0) {
        nextIdx = idx - activeCols;
      } else {
        const col = idx % activeCols;
        const lastRowBase = Math.floor((total - 1) / activeCols) * activeCols;
        nextIdx = lastRowBase + col < total ? lastRowBase + col : lastRowBase + col - activeCols;
      }
    }

    if (nextIdx >= 0 && cardButtons[nextIdx]) {
      e.preventDefault();
      cardButtons[nextIdx].focus();
    }
  };

  const onPreviewSkipClick = () => {
    if (finished || isPaused || phase !== 'preview') return;
    ctx.audio.playClick();
    previewRemainingMs = 0;
    beginPlayPhase({ playFlipSfx: true });
  };

  const onPreviewSkipKeyDown = (e) => {
    if (finished || isPaused || phase !== 'preview') return;
    if (e.code !== 'Space' && e.key !== ' ') return;
    e.preventDefault();
    onPreviewSkipClick();
  };

  const offPause = ctx.onPause((paused) => {
    isPaused = paused;
    if (!paused) lastFrameTs = performance.now();
  });

  const onWindowResize = () => {
    updateBoardLayout();
  };

  gridEl.addEventListener('click', onGridClick);
  gridEl.addEventListener('keydown', onGridKeyDown);
  skipLinkEl.addEventListener('click', onPreviewSkipClick);
  window.addEventListener('keydown', onPreviewSkipKeyDown);
  window.addEventListener('resize', onWindowResize);

  if (typeof ResizeObserver === 'function') {
    resizeObserver = new ResizeObserver(() => updateBoardLayout());
    resizeObserver.observe(boardWrapEl);
  }

  // Main Pause-Aware Animation Frame Loop
  const tickFrame = (now) => {
    if (finished) {
      rafId = 0;
      return;
    }
    if (!lastFrameTs) lastFrameTs = now;
    const dt = isPaused ? 0 : Math.min(100, Math.max(0, now - lastFrameTs));
    lastFrameTs = now;

    if (!isPaused && dt > 0) {
      if (phase === 'preview') {
        if (previewRevealStarted) {
          if (previewRevealWaitMs > 0) {
            previewRevealWaitMs = Math.max(0, previewRevealWaitMs - dt);
          } else {
            previewRemainingMs = Math.max(0, previewRemainingMs - dt);
            const tickSec = Math.ceil(previewRemainingMs / 1000);
            if (tickSec >= 1 && tickSec !== lastPreviewTickSec) {
              lastPreviewTickSec = tickSec;
              ctx.audio.playTick();
            }
          }
        }
        syncTopbar();
        if (previewRemainingMs <= 0) {
          beginPlayPhase({ playFlipSfx: true });
        }
      } else if (phase === 'playing') {
        elapsedActiveMs += dt;
        remainingMs = Math.max(0, remainingMs - dt);

        if (mismatchLock) {
          mismatchRemainingMs = Math.max(0, mismatchRemainingMs - dt);
          if (mismatchRemainingMs <= 0) {
            resolveMismatchPair();
          }
        }

        const wholeSec = Math.ceil(remainingMs / 1000);
        if (wholeSec <= 10 && wholeSec >= 1 && wholeSec !== lastPlayTickSec) {
          lastPlayTickSec = wholeSec;
          ctx.audio.playTick();
        }

        syncStatus();
        if (remainingMs <= 0) {
          finishGame(false);
          rafId = 0;
          return;
        }
      }
    }

    rafId = requestAnimationFrame(tickFrame);
  };

  updateBoardLayout();
  syncTopbar();
  syncStatus();
  lastFrameTs = performance.now();
  rafId = requestAnimationFrame(tickFrame);

  return {
    unmount() {
      finished = true;
      if (revealRafId) {
        cancelAnimationFrame(revealRafId);
        revealRafId = 0;
      }
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = 0;
      }
      if (finishTimeoutId) {
        clearTimeout(finishTimeoutId);
        finishTimeoutId = 0;
      }
      for (const tid of fxTimeouts) {
        clearTimeout(tid);
      }
      fxTimeouts.clear();

      gridEl.removeEventListener('click', onGridClick);
      gridEl.removeEventListener('keydown', onGridKeyDown);
      skipLinkEl.removeEventListener('click', onPreviewSkipClick);
      window.removeEventListener('keydown', onPreviewSkipKeyDown);
      offPause();
      window.removeEventListener('resize', onWindowResize);
      if (resizeObserver) {
        resizeObserver.disconnect();
        resizeObserver = null;
      }
    },
  };
}

const LEVEL_NOTES = { '4x3': '처음 해보는 분', '4x4': '기본', '6x4': '기억력 자신 있는 분' };

/**
 * Difficulty chooser shown for mode `setup`. Choosing relaunches via ctx.switchMode()
 * so the URL, room seed and per-mode records stay in sync.
 */
function mountSetup(container, ctx) {
  const root = document.createElement('div');
  root.className = 'game-root game-memory-match mm-setup';
  root.innerHTML = `
    <h2 class="mm-setup__title">난이도를 고르세요</h2>
    <div class="mm-setup__levels">
      ${Object.values(MEMORY_MODES)
        .map(
          (cfg) => `
        <button type="button" class="mm-level" data-level="${cfg.id}">
          <span class="mm-level__name">${cfg.modeLabel}</span>
          <span class="mm-level__meta">${cfg.pairs}쌍 · ${cfg.timeLimitSec}초</span>
          <span class="mm-level__note">${LEVEL_NOTES[cfg.id]}</span>
        </button>`
        )
        .join('')}
    </div>
  `;
  container.appendChild(root);

  const onClick = (e) => {
    const btn = e.target.closest('[data-level]');
    if (!btn) return;
    ctx.audio.playClick();
    ctx.switchMode(btn.dataset.level);
  };
  root.addEventListener('click', onClick);
  root.querySelector('[data-level="4x4"]')?.focus({ preventScroll: true });

  return {
    idle: true,
    unmount() {
      root.removeEventListener('click', onClick);
    },
  };
}
