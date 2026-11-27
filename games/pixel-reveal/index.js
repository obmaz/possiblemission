/**
 * Game: 모자이크 줌아웃 (PIXEL REVEAL)
 *
 * Crisp generated 4:3 illustrations start heavily pixelated and sharpen smoothly over
 * `revealSec` seconds. Faster guesses earn higher speed bonuses.
 * - Solo (`play: 0`): 4 choices (+ keys 1-4), speed bonus, instant full-picture reveal on solve.
 * - Party (`play: 1`): Shared-screen projector mode with Freeze (`F`), Reveal (`Space`),
 *   Next (`Enter`/`→`).
 */
import { bindClock, bindScore } from '../../js/core/clock.js';
import { pickSeeded, shuffleSeeded } from '../../js/core/seed.js';
import { WRONG_INPUT_COOLDOWN_MS } from '../../js/core/rules.js';
import { mountSetupScreen } from '../../js/core/setup-screen.js';
import { REVEAL_ITEMS } from './items.js';
import {
  PIXEL_REVEAL_DEFAULT_PRESET,
  PIXEL_REVEAL_FIELDS,
  PIXEL_REVEAL_PRESETS,
  matchPixelRevealPreset,
  parsePixelRevealMode,
  pixelRevealModeId,
} from './settings.js';

export { REVEAL_ITEMS };

const LAST_MODE_PREF = 'pixelRevealLastMode';
const FEEDBACK_MS = 1050;
const CANVAS_W = 800;
const CANVAS_H = 600;

/** Deterministic round sequence and 4-choice options for a given seed + settings. */
export function generatePixelRevealRun(rng, settings) {
  const picked = shuffleSeeded(rng, REVEAL_ITEMS).slice(0, settings.rounds);
  return picked.map((item) => {
    const sameCat = REVEAL_ITEMS.filter((x) => x.id !== item.id && x.category === item.category);
    const pool = sameCat.length >= 3 ? sameCat : REVEAL_ITEMS.filter((x) => x.id !== item.id);
    const distractors = pickSeeded(rng, pool, 3).map((x) => x.label);
    const choices = shuffleSeeded(rng, [item.label, ...distractors]).map((label) => ({
      label,
      isCorrect: label === item.label,
    }));
    return { item, choices };
  });
}

function describe(s) {
  const playTxt = s.play === 1 ? '다같이 한 화면 진행' : '혼자 선택지 도전';
  return `${playTxt} · ${s.rounds}문제 · ${s.revealSec}초간 선명해짐 (${s.startGrid}칸 시작)`;
}

export function mount(container, ctx) {
  const settings = parsePixelRevealMode(ctx.mode);
  return settings ? mountGame(container, ctx, settings) : mountSetup(container, ctx);
}

function mountSetup(container, ctx) {
  return mountSetupScreen(container, ctx, {
    gameId: 'pixel-reveal',
    title: '모자이크 줌아웃 · 난이도',
    intro: '거대한 모자이크가 서서히 선명해집니다. <b>누구보다 빠르게</b> 정체를 맞히세요!',
    fields: PIXEL_REVEAL_FIELDS,
    presets: PIXEL_REVEAL_PRESETS,
    defaultPreset: PIXEL_REVEAL_DEFAULT_PRESET,
    presetMeta: (p) => `${p.rounds}문제 · ${p.revealSec}초 · ${p.startGrid}칸`,
    describe,
    parseMode: parsePixelRevealMode,
    modeId: pixelRevealModeId,
    matchPreset: matchPixelRevealPreset,
    prefKey: LAST_MODE_PREF,
    playSwitch: true,
  });
}

/* ============================================================================
 * Active Game
 * ========================================================================== */
function mountGame(container, ctx, settings) {
  const isParty = settings.play === 1;
  const rounds = generatePixelRevealRun(ctx.rng, settings);
  const totalRounds = rounds.length;
  const modeLabel =
    (matchPixelRevealPreset(settings)?.label || `커스텀 ${totalRounds}문제`) + (isParty ? ' · 다같이' : '');

  let unmounted = false;
  let isPaused = false;
  let finished = false;
  let roundIndex = 0;
  let roundElapsedSec = 0;
  let activePlayMs = 0;
  let correctCount = 0;
  let wrongTaps = 0;
  let score = 0;
  let streak = 0;
  let maxStreak = 0;
  let cooldownUntilMs = 0;
  let roundState = 'revealing'; // revealing | feedback | ended
  let feedbackElapsedMs = 0;
  let shakeTimerId = 0;
  let partyFrozen = false;
  let partyRevealed = false;
  let lastFrameMs = performance.now();
  let rafId = 0;

  // Preload all round images
  const imageCache = new Map();
  for (const r of rounds) {
    const img = new Image();
    img.src = r.item.src;
    imageCache.set(r.item.id, img);
  }

  const offscreen = document.createElement('canvas');
  const offCtx = offscreen.getContext('2d');

  const root = document.createElement('div');
  root.className = `game-root game-pixel-reveal ${isParty ? 'is-party' : 'is-solo'}`;
  root.innerHTML = `
    <div class="pr-header">
      <div class="pr-status" data-pr-status>서서히 선명해지는 그림의 정체를 맞히세요!</div>
      <div class="pr-badges">
        <span class="pr-bonus-pill" data-pr-bonus>+350점</span>
        <span class="pr-round-pill" data-pr-round>1 / ${totalRounds}</span>
        ${isParty ? '' : '<span class="pm-score" data-pm-score></span><span class="pm-timer" data-pm-timer></span>'}
      </div>
    </div>

    <div class="pr-canvas-wrap" data-pr-wrap>
      <canvas class="pr-canvas" data-pr-canvas width="${CANVAS_W}" height="${CANVAS_H}" aria-label="모자이크 줌아웃 캔버스"></canvas>
      <div class="pr-answer-banner" data-pr-banner hidden></div>
    </div>

    <div class="pr-meter">
      <div class="pr-meter__fill" data-pr-meter style="width: 0%;"></div>
    </div>

    <div class="pr-bottom" data-pr-bottom></div>
  `;
  container.appendChild(root);

  const statusEl = root.querySelector('[data-pr-status]');
  const bonusEl = root.querySelector('[data-pr-bonus]');
  const roundPillEl = root.querySelector('[data-pr-round]');
  const setTimer = bindClock(root.querySelector('[data-pm-timer]'));
  const setScore = bindScore(root.querySelector('[data-pm-score]'));
  const wrapEl = root.querySelector('[data-pr-wrap]');
  const canvas = root.querySelector('[data-pr-canvas]');
  const ctx2d = canvas.getContext('2d');
  const bannerEl = root.querySelector('[data-pr-banner]');
  const meterEl = root.querySelector('[data-pr-meter]');
  const bottomEl = root.querySelector('[data-pr-bottom]');

  function currentSpeedBonus() {
    const ratio = Math.max(0, 1 - roundElapsedSec / settings.revealSec);
    return Math.round(120 + ratio * 280);
  }

  function computeTotalScore() {
    if (isParty) {
      return roundIndex * 200;
    }
    return score;
  }

  /** Solo shows the time left to reveal this picture; party rounds have no clock or score. */
  function syncStatus() {
    setTimer(Math.max(0, settings.revealSec - roundElapsedSec));
    setScore(score);
  }

  function drawCurrentFrame() {
    const r = rounds[roundIndex];
    if (!r) return;
    const img = imageCache.get(r.item.id);
    if (!img || !img.complete || img.naturalWidth === 0) {
      ctx2d.fillStyle = '#e2e8f0';
      ctx2d.fillRect(0, 0, CANVAS_W, CANVAS_H);
      return;
    }

    const full = roundState === 'feedback' || partyRevealed || (!isParty && roundElapsedSec >= settings.revealSec);
    if (full) {
      ctx2d.imageSmoothingEnabled = true;
      ctx2d.clearRect(0, 0, CANVAS_W, CANVAS_H);
      ctx2d.drawImage(img, 0, 0, CANVAS_W, CANVAS_H);
      return;
    }

    const p = Math.max(0, Math.min(1, roundElapsedSec / settings.revealSec));
    // Exponential sharpening so early stages remain challenging and final seconds become crisp
    const gridW = Math.max(
      settings.startGrid,
      Math.round(settings.startGrid * Math.pow(180 / settings.startGrid, p * p * 0.65 + p * 0.35))
    );
    const gridH = Math.max(3, Math.round((gridW * CANVAS_H) / CANVAS_W));

    offscreen.width = gridW;
    offscreen.height = gridH;
    offCtx.imageSmoothingEnabled = true;
    offCtx.clearRect(0, 0, gridW, gridH);
    offCtx.drawImage(img, 0, 0, gridW, gridH);

    ctx2d.imageSmoothingEnabled = false;
    ctx2d.clearRect(0, 0, CANVAS_W, CANVAS_H);
    ctx2d.drawImage(offscreen, 0, 0, gridW, gridH, 0, 0, CANVAS_W, CANVAS_H);
  }

  function renderBottom() {
    const r = rounds[roundIndex];
    if (!r) return;

    if (!isParty) {
      bottomEl.innerHTML = `
        <div class="pr-choices" role="group" aria-label="정답 선택지">
          ${r.choices
            .map(
              (c, idx) => `
              <button type="button" class="pr-choice" data-choice="${c.label}" ${roundState !== 'revealing' ? 'disabled' : ''}>
                <span class="pr-choice__key">${idx + 1}</span>
                <span class="pr-choice__label">${c.label}</span>
              </button>`
            )
            .join('')}
        </div>
      `;
      return;
    }

    bottomEl.innerHTML = `
      <div class="pr-party-controls">
        <div class="pr-party-status">
          ${
            partyRevealed
              ? `정답: <strong class="pr-reveal-word">${r.item.label}</strong>`
              : partyFrozen
                ? '⏸ 일시정지됨! 외친 참가자의 답을 확인하세요'
                : '👀 먼저 외치는 사람 승리!'
          }
        </div>
        <div class="pr-party-actions">
          <button type="button" class="pr-mc-btn" data-mc-freeze ${partyRevealed ? 'disabled' : ''}>
            ${partyFrozen ? '▶ 재개 (F)' : '⏸ 멈춤 (F)'}
          </button>
          <button type="button" class="pr-mc-btn pr-mc-btn--reveal" data-mc-reveal ${partyRevealed ? 'disabled' : ''}>
            ${partyRevealed ? '정답 공개됨' : '👁️ 정답 공개 (Space)'}
          </button>
          <button type="button" class="pr-mc-btn pr-mc-btn--next" data-mc-next>
            ${roundIndex + 1 >= totalRounds ? '🏁 결과 (Enter)' : '다음 → (Enter)'}
          </button>
        </div>
      </div>
    `;
  }

  function startRound() {
    roundElapsedSec = 0;
    feedbackElapsedMs = 0;
    roundState = 'revealing';
    partyFrozen = false;
    partyRevealed = false;
    if (bannerEl) {
      bannerEl.hidden = true;
      bannerEl.textContent = '';
      bannerEl.dataset.tone = '';
    }
    if (roundPillEl) roundPillEl.textContent = `${roundIndex + 1} / ${totalRounds}`;
    if (statusEl) statusEl.textContent = '서서히 선명해지는 그림의 정체를 맞히세요!';
    drawCurrentFrame();
    renderBottom();
    syncStatus();
  }

  function finishGame() {
    if (finished || unmounted) return;
    finished = true;
    roundState = 'ended';
    const totalAttempts = correctCount + wrongTaps;
    const accuracy = isParty ? 100 : totalAttempts > 0 ? Math.round((correctCount / totalAttempts) * 100) : 0;
    const cleared = isParty ? true : correctCount >= Math.ceil(totalRounds * 0.5);
    const details = isParty
      ? [
          { value: `🖼️ ${totalRounds}문제 진행` },
          { value: `⏱ ${(activePlayMs / 1000).toFixed(1)}초` },
        ]
      : [
          { value: `🖼️ ${correctCount}/${totalRounds} 정답` },
          { value: `⏱ ${(activePlayMs / 1000).toFixed(1)}초` },
          { value: `🔥 최대 ${maxStreak}연속` },
          { value: `❌ 오답 ${wrongTaps}회` },
        ];
    ctx.completeGame({
      score: computeTotalScore(),
      timeMs: Math.round(activePlayMs),
      accuracy,
      cleared,
      modeLabel,
      details,
    });
  }

  function enterFeedback(correct, customLabel = '') {
    const r = rounds[roundIndex];
    roundState = 'feedback';
    feedbackElapsedMs = 0;
    drawCurrentFrame();
    if (bannerEl) {
      bannerEl.hidden = false;
      bannerEl.dataset.tone = correct ? 'success' : 'error';
      bannerEl.textContent = customLabel || `${correct ? '✨ 정답!' : '⏰ 시간 초과!'} ${r.item.label}`;
    }
    renderBottom();
    syncStatus();
  }

  function handleSoloPick(label) {
    if (isPaused || finished || isParty || roundState !== 'revealing') return;
    const now = performance.now();
    if (now < cooldownUntilMs) return;
    const r = rounds[roundIndex];
    if (!r) return;

    if (label === r.item.label) {
      const gained = currentSpeedBonus() + streak * 40;
      score += gained;
      correctCount += 1;
      streak += 1;
      maxStreak = Math.max(maxStreak, streak);
      ctx.audio.playMatch(streak);
      enterFeedback(true, `✨ 정답! ${r.item.label} (+${gained}점)`);
      return;
    }

    wrongTaps += 1;
    streak = 0;
    cooldownUntilMs = now + WRONG_INPUT_COOLDOWN_MS;
    roundElapsedSec = Math.min(settings.revealSec, roundElapsedSec + 1.5);
    ctx.audio.playError();
    wrapEl?.classList.remove('is-shaking');
    void wrapEl?.offsetWidth;
    wrapEl?.classList.add('is-shaking');
    clearTimeout(shakeTimerId);
    shakeTimerId = window.setTimeout(() => wrapEl?.classList.remove('is-shaking'), 320);
    if (statusEl) statusEl.textContent = '❌ 아쉬워요! 다시 골라보세요 (+1.5초 진행)';
  }

  function togglePartyFreeze() {
    if (!isParty || partyRevealed) return;
    partyFrozen = !partyFrozen;
    ctx.audio.playClick();
    renderBottom();
  }

  function revealPartyAnswer() {
    if (!isParty || partyRevealed) return;
    partyRevealed = true;
    partyFrozen = true;
    ctx.audio.playHint();
    drawCurrentFrame();
    renderBottom();
  }

  function advancePartyRound() {
    if (!isParty) return;
    ctx.audio.playClick();
    roundIndex += 1;
    if (roundIndex >= totalRounds) finishGame();
    else startRound();
  }

  const onClick = (e) => {
    if (isPaused || finished) return;
    const choiceBtn = e.target.closest('[data-choice]');
    if (choiceBtn) {
      handleSoloPick(choiceBtn.dataset.choice);
      return;
    }
    if (!isParty) return;
    if (e.target.closest('[data-mc-freeze]')) togglePartyFreeze();
    else if (e.target.closest('[data-mc-reveal]')) revealPartyAnswer();
    else if (e.target.closest('[data-mc-next]')) advancePartyRound();
  };

  const onKeyDown = (e) => {
    if (isPaused || finished) return;
    if (isParty) {
      if (e.code === 'Space') {
        e.preventDefault();
        revealPartyAnswer();
      } else if (e.key === 'Enter' || e.key === 'ArrowRight') {
        e.preventDefault();
        advancePartyRound();
      } else if (e.code === 'KeyF' || e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        togglePartyFreeze();
      }
      return;
    }
    const idx = ['1', '2', '3', '4'].indexOf(e.key);
    if (idx !== -1 && roundState === 'revealing') {
      const choice = rounds[roundIndex]?.choices[idx];
      if (choice) {
        e.preventDefault();
        handleSoloPick(choice.label);
      }
    }
  };

  root.addEventListener('click', onClick);
  window.addEventListener('keydown', onKeyDown);

  const offPause = ctx.onPause((paused) => {
    isPaused = paused;
    if (!isPaused) lastFrameMs = performance.now();
  });

  function frame(nowMs) {
    if (unmounted) return;
    const dtMs = Math.max(0, Math.min(120, nowMs - lastFrameMs));
    lastFrameMs = nowMs;

    if (!isPaused && !finished) {
      activePlayMs += dtMs;
      if (roundState === 'revealing' && !(isParty && partyFrozen) && !partyRevealed) {
        roundElapsedSec = Math.min(settings.revealSec, roundElapsedSec + dtMs / 1000);
        const pct = Math.min(100, (roundElapsedSec / settings.revealSec) * 100);
        if (meterEl) meterEl.style.width = `${pct.toFixed(1)}%`;
        if (bonusEl) {
          bonusEl.hidden = isParty;
          if (!isParty) bonusEl.textContent = `⚡ +${currentSpeedBonus()}점`;
        }
        drawCurrentFrame();
        syncStatus();

        if (!isParty && roundElapsedSec >= settings.revealSec) {
          streak = 0;
          ctx.audio.playError();
          enterFeedback(false);
        }
      } else if (roundState === 'feedback') {
        feedbackElapsedMs += dtMs;
        if (feedbackElapsedMs >= FEEDBACK_MS) {
          roundIndex += 1;
          if (roundIndex >= totalRounds) finishGame();
          else startRound();
        }
      } else {
        drawCurrentFrame();
      }
    }
    rafId = requestAnimationFrame(frame);
  }

  startRound();
  syncStatus();
  rafId = requestAnimationFrame(frame);

  return {
    unmount() {
      unmounted = true;
      if (rafId) cancelAnimationFrame(rafId);
      if (shakeTimerId) clearTimeout(shakeTimerId);
      root.removeEventListener('click', onClick);
      window.removeEventListener('keydown', onKeyDown);
      offPause();
      container.innerHTML = '';
    },
  };
}
