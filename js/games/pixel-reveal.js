/**
 * Game: 모자이크 줌아웃 (PIXEL REVEAL)
 *
 * Crisp generated 4:3 illustrations start heavily pixelated and sharpen smoothly over
 * `revealSec` seconds. Faster guesses earn higher speed bonuses.
 * - Solo (`play: 0`): 4 choices (+ keys 1-4), speed bonus, instant full-picture reveal on solve.
 * - Party (`play: 1`): Shared-screen projector mode with Freeze (`Space`), Reveal (`Enter`),
 *   Next (`→`), and quick MC team scoreboard.
 */
import { pickSeeded, shuffleSeeded } from '../core/seed.js';
import { WRONG_INPUT_COOLDOWN_MS } from '../core/rules.js';
import { createPartyScoreboard, renderPlayModeSwitch } from './party-kit.js';
import {
  PIXEL_REVEAL_DEFAULT_PRESET,
  PIXEL_REVEAL_FIELDS,
  PIXEL_REVEAL_PRESETS,
  matchPixelRevealPreset,
  parsePixelRevealMode,
  pixelRevealModeId,
} from './pixel-reveal-settings.js';

const LAST_MODE_PREF = 'pixelRevealLastMode';
const FEEDBACK_MS = 1050;
const CANVAS_W = 800;
const CANVAS_H = 597;

export const REVEAL_ITEMS = [
  {
    id: 'burger',
    label: '치즈버거',
    src: './assets/images/reveal/burger.jpg',
    distractors: ['피자', '핫도그', '샌드위치', '타코', '도넛'],
  },
  {
    id: 'panda',
    label: '판다',
    src: './assets/images/reveal/panda.jpg',
    distractors: ['코알라', '북극곰', '펭귄', '너구리', '고양이'],
  },
  {
    id: 'rocket',
    label: '우주 로켓',
    src: './assets/images/reveal/rocket.jpg',
    distractors: ['비행기', '인공위성', '잠수함', '헬리콥터', '등대'],
  },
  {
    id: 'sushi',
    label: '연어 초밥',
    src: './assets/images/reveal/sushi.jpg',
    distractors: ['김밥', '우동', '라멘', '만두', '스테이크'],
  },
  {
    id: 'eiffel',
    label: '에펠탑',
    src: './assets/images/reveal/eiffel.jpg',
    distractors: ['자유의 여신상', '피사의 사탑', '피라미드', '콜로세움', '빅벤'],
  },
  {
    id: 'cactus',
    label: '선인장',
    src: './assets/images/reveal/cactus.jpg',
    distractors: ['야자수', '해바라기', '튤립', '버섯', '대나무'],
  },
  {
    id: 'balloon',
    label: '열기구',
    src: './assets/images/reveal/balloon.jpg',
    distractors: ['낙하산', '비행선', '드론', '글라이더', '우산'],
  },
  {
    id: 'snowman',
    label: '눈사람',
    src: './assets/images/reveal/snowman.jpg',
    distractors: ['산타클로스', '루돌프', '펭귄', '허수아비', '로봇'],
  },
];

/** Deterministic round sequence and 4-choice options for a given seed + settings. */
export function generatePixelRevealRun(rng, settings) {
  const picked = shuffleSeeded(rng, REVEAL_ITEMS).slice(0, settings.rounds);
  return picked.map((item) => {
    const distractors = pickSeeded(rng, item.distractors, 3);
    const choices = shuffleSeeded(rng, [item.label, ...distractors]).map((label) => ({
      label,
      isCorrect: label === item.label,
    }));
    return { item, choices };
  });
}

const formatValue = (f, v) => (f.valueLabels ? f.valueLabels[f.options.indexOf(v)] : `${v}${f.unit}`);

function describe(s) {
  const playTxt = s.play === 1 ? '다같이 한 화면 진행' : '혼자 선택지 도전';
  return `${playTxt} · ${s.rounds}문제 · ${s.revealSec}초간 선명해짐 (${s.startGrid}칸 시작)`;
}

export function mount(container, ctx) {
  const settings = parsePixelRevealMode(ctx.mode);
  return settings ? mountGame(container, ctx, settings) : mountSetup(container, ctx);
}

/* ============================================================================
 * Setup Screen
 * ========================================================================== */
function mountSetup(container, ctx) {
  const last = parsePixelRevealMode(ctx.storage.getPref?.(LAST_MODE_PREF, '') || '');
  const preset = PIXEL_REVEAL_PRESETS.find((p) => p.id === PIXEL_REVEAL_DEFAULT_PRESET);
  const source = last || { ...preset, play: 0 };
  let values = Object.fromEntries(PIXEL_REVEAL_FIELDS.map((f) => [f.key, source[f.key]]));

  const root = document.createElement('div');
  root.className = 'game-root game-pixel-reveal pr-setup';
  root.innerHTML = `
    <div class="pr-setup__head">
      <h2 class="pr-setup__title">모자이크 줌아웃 · 난이도</h2>
      <p class="pr-setup__sub">거대한 모자이크가 서서히 선명해집니다. <b>누구보다 빠르게</b> 정체를 맞히세요!</p>
    </div>
    ${renderPlayModeSwitch(values.play, 'pr')}
    <div class="pr-setup__body">
      <div class="pr-presets" role="radiogroup" aria-label="난이도 프리셋">
        ${PIXEL_REVEAL_PRESETS.map(
          (p) => `
          <button type="button" class="pr-preset pr-preset--${p.id}" role="radio" data-preset="${p.id}">
            <span class="pr-preset__name">${p.label}</span>
            <span class="pr-preset__ko">${p.ko}</span>
            <span class="pr-preset__meta">${p.rounds}문제 · ${p.revealSec}초 · ${p.startGrid}칸</span>
          </button>`
        ).join('')}
      </div>
      <div class="pr-fields">
        ${PIXEL_REVEAL_FIELDS.map(
          (f) => `
          <div class="pr-field" data-field="${f.key}">
            <span class="pr-field__label">${f.label}</span>
            <div class="pr-stepper">
              <button type="button" class="pr-stepper__btn" data-step="-1" aria-label="${f.label} 줄이기">−</button>
              <output class="pr-stepper__value" data-value></output>
              <button type="button" class="pr-stepper__btn" data-step="1" aria-label="${f.label} 늘리기">+</button>
            </div>
          </div>`
        ).join('')}
        <p class="pr-fields__summary" data-summary></p>
      </div>
    </div>
    <button type="button" class="pr-setup__start" data-start>시작하기 <span aria-hidden="true">→</span></button>
  `;
  container.appendChild(root);

  function render() {
    const match = matchPixelRevealPreset(values);
    root.querySelectorAll('[data-playmode]').forEach((btn) => {
      const on = Number(btn.dataset.playmode) === values.play;
      btn.classList.toggle('is-active', on);
      btn.setAttribute('aria-checked', String(on));
    });
    root.querySelectorAll('[data-preset]').forEach((btn) => {
      const on = match?.id === btn.dataset.preset;
      btn.classList.toggle('is-active', on);
      btn.setAttribute('aria-checked', String(on));
    });
    for (const f of PIXEL_REVEAL_FIELDS) {
      const row = root.querySelector(`[data-field="${f.key}"]`);
      const idx = f.options.indexOf(values[f.key]);
      row.querySelector('[data-value]').textContent = formatValue(f, values[f.key]);
      row.querySelector('[data-step="-1"]').disabled = idx <= 0;
      row.querySelector('[data-step="1"]').disabled = idx >= f.options.length - 1;
    }
    root.querySelector('[data-summary]').textContent = `${match ? `${match.label} · ` : '커스텀 · '}${describe(values)}`;
  }

  const onClick = (e) => {
    const playBtn = e.target.closest('[data-playmode]');
    const presetBtn = e.target.closest('[data-preset]');
    const stepBtn = e.target.closest('[data-step]');
    if (playBtn) {
      values = { ...values, play: Number(playBtn.dataset.playmode) };
      ctx.audio.playClick();
      render();
    } else if (presetBtn) {
      const p = PIXEL_REVEAL_PRESETS.find((x) => x.id === presetBtn.dataset.preset);
      values = { ...values, rounds: p.rounds, revealSec: p.revealSec, startGrid: p.startGrid };
      ctx.audio.playClick();
      render();
    } else if (stepBtn) {
      const key = stepBtn.closest('[data-field]').dataset.field;
      const field = PIXEL_REVEAL_FIELDS.find((f) => f.key === key);
      const idx = field.options.indexOf(values[key]) + Number(stepBtn.dataset.step);
      if (idx < 0 || idx >= field.options.length) return;
      values = { ...values, [key]: field.options[idx] };
      ctx.audio.playClick();
      render();
    } else if (e.target.closest('[data-start]')) {
      ctx.audio.playClick();
      const mode = pixelRevealModeId(values);
      ctx.storage.setPref?.(LAST_MODE_PREF, mode);
      ctx.switchMode(mode);
    }
  };

  root.addEventListener('click', onClick);
  render();
  ctx.updateHud({ timer: { text: '--:--', state: 'normal' }, score: 0, progress: '난이도 설정', progressRatio: 1 });

  return {
    idle: true,
    unmount() {
      root.removeEventListener('click', onClick);
      container.innerHTML = '';
    },
  };
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
  let feedbackTimerId = 0;
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
  const wrapEl = root.querySelector('[data-pr-wrap]');
  const canvas = root.querySelector('[data-pr-canvas]');
  const ctx2d = canvas.getContext('2d');
  const bannerEl = root.querySelector('[data-pr-banner]');
  const meterEl = root.querySelector('[data-pr-meter]');
  const bottomEl = root.querySelector('[data-pr-bottom]');

  const partyBoard = isParty
    ? createPartyScoreboard({
        onAward: () => {
          ctx.audio.playMatch(1);
          partyRevealed = true;
          partyFrozen = true;
          drawCurrentFrame();
          renderBottom();
          syncHud();
        },
      })
    : null;

  function currentSpeedBonus() {
    const ratio = Math.max(0, 1 - roundElapsedSec / settings.revealSec);
    return Math.round(120 + ratio * 280);
  }

  function computeTotalScore() {
    if (isParty) {
      return (partyBoard?.getTotalAwarded() || 0) * 200 + roundIndex * 100;
    }
    return score;
  }

  function syncHud() {
    const remSec = Math.max(0, settings.revealSec - roundElapsedSec);
    ctx.updateHud({
      timer: isParty ? { text: `${roundIndex + 1} / ${totalRounds}`, state: 'normal' } : remSec,
      score: computeTotalScore(),
      progress: `${Math.min(roundIndex, totalRounds)} / ${totalRounds}`,
      progressRatio: isParty ? roundIndex / totalRounds : Math.max(0, Math.min(1, remSec / settings.revealSec)),
      extra: isParty ? '🎙️ 다같이 모드' : streak >= 2 ? `🔥 x${streak}` : '',
    });
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

    const full = roundState === 'feedback' || partyRevealed || roundElapsedSec >= settings.revealSec;
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
            ${partyFrozen ? '▶ 재개 (Space)' : '⏸ 멈춤 (Space)'}
          </button>
          <button type="button" class="pr-mc-btn pr-mc-btn--reveal" data-mc-reveal ${partyRevealed ? 'disabled' : ''}>
            👁️ 정답 공개 (Enter)
          </button>
          <button type="button" class="pr-mc-btn pr-mc-btn--next" data-mc-next>
            ${roundIndex + 1 >= totalRounds ? '🏁 결과 (→)' : '다음 →'}
          </button>
        </div>
      </div>
    `;
    if (partyBoard) bottomEl.appendChild(partyBoard.el);
  }

  function startRound() {
    roundElapsedSec = 0;
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
    syncHud();
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
          { value: partyBoard.getWinnerSummary() },
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
    drawCurrentFrame();
    if (bannerEl) {
      bannerEl.hidden = false;
      bannerEl.dataset.tone = correct ? 'success' : 'error';
      bannerEl.textContent = customLabel || `${correct ? '✨ 정답!' : '⏰ 시간 초과!'} ${r.item.label}`;
    }
    renderBottom();
    syncHud();

    clearTimeout(feedbackTimerId);
    feedbackTimerId = window.setTimeout(() => {
      if (unmounted || finished) return;
      roundIndex += 1;
      if (roundIndex >= totalRounds) finishGame();
      else startRound();
    }, FEEDBACK_MS);
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

  const onClick = (e) => {
    if (isPaused || finished) return;
    const choiceBtn = e.target.closest('[data-choice]');
    if (choiceBtn) {
      handleSoloPick(choiceBtn.dataset.choice);
      return;
    }
    if (!isParty) return;
    if (e.target.closest('[data-mc-freeze]')) {
      partyFrozen = !partyFrozen;
      ctx.audio.playClick();
      renderBottom();
    } else if (e.target.closest('[data-mc-reveal]')) {
      partyRevealed = true;
      partyFrozen = true;
      ctx.audio.playHint();
      drawCurrentFrame();
      renderBottom();
    } else if (e.target.closest('[data-mc-next]')) {
      ctx.audio.playClick();
      roundIndex += 1;
      if (roundIndex >= totalRounds) finishGame();
      else startRound();
    }
  };

  const onKeyDown = (e) => {
    if (isPaused || finished) return;
    if (isParty) {
      if (e.code === 'Space' && !partyRevealed) {
        e.preventDefault();
        partyFrozen = !partyFrozen;
        ctx.audio.playClick();
        renderBottom();
      } else if (e.key === 'Enter' && !partyRevealed) {
        e.preventDefault();
        partyRevealed = true;
        partyFrozen = true;
        ctx.audio.playHint();
        drawCurrentFrame();
        renderBottom();
      } else if (e.key === 'ArrowRight' || (e.key === 'Enter' && partyRevealed)) {
        e.preventDefault();
        ctx.audio.playClick();
        roundIndex += 1;
        if (roundIndex >= totalRounds) finishGame();
        else startRound();
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

  const onPauseChange = (e) => {
    isPaused = Boolean(e.detail?.paused);
    if (!isPaused) lastFrameMs = performance.now();
  };
  window.addEventListener('pm:pausechange', onPauseChange);

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
        syncHud();

        if (!isParty && roundElapsedSec >= settings.revealSec) {
          streak = 0;
          ctx.audio.playError();
          enterFeedback(false);
        }
      } else {
        drawCurrentFrame();
      }
    }
    rafId = requestAnimationFrame(frame);
  }

  startRound();
  rafId = requestAnimationFrame(frame);

  return {
    unmount() {
      unmounted = true;
      if (rafId) cancelAnimationFrame(rafId);
      if (feedbackTimerId) clearTimeout(feedbackTimerId);
      if (shakeTimerId) clearTimeout(shakeTimerId);
      root.removeEventListener('click', onClick);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('pm:pausechange', onPauseChange);
      partyBoard?.destroy();
      container.innerHTML = '';
    },
  };
}
