/**
 * Game: 틀린그림찾기 (Spot the Difference)
 * `mount(container, ctx)` -> `{ unmount() }`. Two synchronized 1200×896 canvases, seeded anomaly
 * selection (see ./round.js), loupe, hint radar and mirrored crosshair.
 */
import { bindClock, bindScore } from '../../js/core/clock.js';
import { TOUCH_HIT_SLOP, WRONG_INPUT_COOLDOWN_MS } from '../../js/core/rules.js';
import { applyAnomalyToBuffer, copyBoxFeathered } from './anomaly-fx.js';
import {
  FOUND_ANIM_MS,
  HINT_DURATION_MS,
  MIN_HIT_RADIUS,
  drawEffects,
  drawFoundMarker,
  drawHintBeacon,
  drawLoupe,
  drawMirrorCrosshair,
} from './overlay.js';
import { COLOR, syncPaletteFromTokens } from './palette.js';
import { mountPicker } from './picker.js';
import { parseModeConfig, resolveRoundData } from './round.js';
import { BASE_H, BASE_W } from './stages.js';

const MISS_TIME_PENALTY_SEC = 3.0;
const FINISH_DELAY_MS = 420; // let the final ring & sparkle play before the result modal
const SHAKE_MS = 380;
const HIT_FLASH_MS = 280;
const MAX_HINTS = 2;

export function mount(container, ctx) {
  const config = parseModeConfig(ctx.mode);
  if (!config) return mountPicker(container, ctx);
  const { difficulty, party, memorizeSec, targetCount, timeLimitSec, modeLabel } = config;
  const roundData = resolveRoundData(ctx.rng, config.stage, targetCount, difficulty.id);
  const stage = roundData.stage;
  const anomalies = roundData.anomalies;

  let unmounted = false;
  let isPaused = false;
  let finished = false;
  let partyPhase = party ? 'memorize' : 'find';
  let memorizeRemainingSec = party ? memorizeSec : 0;
  let remainingSec = timeLimitSec;
  let activePlayMs = 0;
  let lastFrameMs = performance.now();
  let lastTickWholeSec = Math.ceil(party ? memorizeSec : timeLimitSec);

  let foundCount = 0;
  let wrongTaps = 0;
  let hintsUsed = 0;
  let streak = 0;
  let maxStreak = 0;
  let cooldownUntilMs = 0;
  let lastTapNorm = { x: 0.5, y: 0.5 };
  let activeHint = null; // { spot, untilMs }
  let loupeEnabled = false;
  let imageReady = false;

  const particles = [];
  const popups = [];
  const pointerMirror = { active: false, side: 'orig', nx: 0.5, ny: 0.5 };
  const touchGesture = {
    active: false,
    pointerId: null,
    side: null,
    startClientX: 0,
    startClientY: 0,
    moved: false,
    startMs: 0,
  };

  let rafId = 0;
  let finishTimerId = 0;
  let shakeTimerId = 0;
  let hitFlashTimerId = 0;
  let needsRender = true;

  function markDirty() {
    needsRender = true;
  }

  // Render Scoped DOM
  const root = document.createElement('div');
  root.className = `game-root game-spot-difference${party ? ' is-party' : ''}`;
  root.innerHTML = `
    <div class="sd-toolbar">
      <div class="sd-toolbar__left">
        <span class="sd-stage-badge">
          <span>${stage.titleKo}</span>
          <span class="sd-stage-badge__sub">${difficulty.label}</span>
          <span class="sd-stage-badge__sub">${targetCount}곳</span>
          ${party ? '<span class="sd-stage-badge__sub">다같이</span>' : ''}
        </span>
        <div class="sd-counter" aria-label="발견한 차이점 개수">
          <span class="sd-counter__text" data-sd-count>0 / ${targetCount}</span>
          <div class="sd-dots" data-sd-dots>
            ${anomalies
              .map(
                (_, i) =>
                  `<span class="sd-dot" data-sd-dot="${i}" title="차이점 ${i + 1}">${i + 1}</span>`
              )
              .join('')}
          </div>
        </div>
        <span class="pm-score" data-pm-score></span>
        <span class="pm-timer" data-pm-timer></span>
      </div>

      <div class="sd-toolbar__actions">
        <div class="sd-view-tabs" role="tablist" aria-label="모바일 보기 전환">
          <button type="button" class="sd-view-tab is-active" data-sd-view="both" role="tab" aria-selected="true">함께보기</button>
          <button type="button" class="sd-view-tab" data-sd-view="orig" role="tab" aria-selected="false">${roundData.leftLabel}</button>
          <button type="button" class="sd-view-tab" data-sd-view="mod" role="tab" aria-selected="false">${roundData.rightLabel}</button>
        </div>
        <button type="button" class="sd-tool-btn sd-tool-btn--loupe" data-sd-loupe aria-pressed="false" title="확대경 토글 (M)">
          🔍 돋보기
        </button>
        <button type="button" class="sd-tool-btn sd-tool-btn--hint" data-sd-hint title="힌트 사용 (H)">
          💡 힌트 (${MAX_HINTS})
        </button>
      </div>
    </div>

    <div class="sd-party-banner" data-sd-party-banner ${party ? '' : 'hidden'}>
      <div class="sd-party-banner__info">
        <span class="sd-party-banner__badge">기억하기 단계</span>
        <span>원래 그림을 잘 기억하세요! 시간이 끝나거나 버튼을 누르면 바뀐 그림에서 찾기가 시작됩니다.</span>
      </div>
      <button type="button" class="sd-party-skip-btn" data-sd-party-skip>지금 바로 찾기 시작 →</button>
    </div>

    <div class="sd-arena" data-sd-arena data-mobile-view="both" ${party ? 'data-party-phase="memorize"' : ''}>
      <section class="sd-board-card sd-board-card--orig" data-sd-card="orig">
        <header class="sd-board-header">
          <span class="sd-board-label">
            <span class="sd-board-label__dot" aria-hidden="true"></span>
            <span>${roundData.leftLabel}</span>
          </span>
        </header>
        <div class="sd-canvas-wrap" data-sd-wrap="orig">
          <canvas class="sd-canvas" data-sd-canvas="orig" width="${BASE_W}" height="${BASE_H}" tabindex="0" role="img" aria-label="${roundData.leftLabel}. 차이점을 클릭해 찾고, Enter 또는 Space로 힌트를 사용할 수 있습니다."></canvas>
          <canvas class="sd-loupe" data-sd-loupe-canvas="orig" width="146" height="146" aria-hidden="true"></canvas>
          <div class="sd-loading" data-sd-loading>스테이지 이미지 로딩 중...</div>
        </div>
      </section>

      <section class="sd-board-card sd-board-card--mod" data-sd-card="mod">
        <header class="sd-board-header">
          <span class="sd-board-label">
            <span class="sd-board-label__dot" aria-hidden="true"></span>
            <span>${roundData.rightLabel}</span>
          </span>
        </header>
        <div class="sd-canvas-wrap" data-sd-wrap="mod">
          <canvas class="sd-canvas" data-sd-canvas="mod" width="${BASE_W}" height="${BASE_H}" tabindex="0" role="img" aria-label="${roundData.rightLabel}. 다른 부분을 클릭해 찾으세요."></canvas>
          <canvas class="sd-loupe" data-sd-loupe-canvas="mod" width="146" height="146" aria-hidden="true"></canvas>
          <div class="sd-loading" data-sd-loading>이미지 준비 중...</div>
        </div>
      </section>
    </div>

    <div class="sd-footer">
      <div class="sd-callout" data-sd-callout data-tone="info">
        <span>${party ? '👀 먼저 원래 그림을 잘 기억해 두세요! (중간에 바로 시작 가능)' : `👀 좌우 그림에서 다른 부분 ${targetCount}곳을 터치하세요! (어느 쪽을 눌러도 인정)`}</span>
      </div>
      <span class="sd-shortcuts">단축키: [H] 힌트 · [M] 돋보기 · 캔버스에서 [Enter] 힌트</span>
    </div>
  `;
  container.appendChild(root);
  syncPaletteFromTokens(root);

  // DOM References
  const origCanvas = root.querySelector('[data-sd-canvas="orig"]');
  const modCanvas = root.querySelector('[data-sd-canvas="mod"]');
  const origCtx = origCanvas.getContext('2d');
  const modCtx = modCanvas.getContext('2d');
  const origLoupeCanvas = root.querySelector('[data-sd-loupe-canvas="orig"]');
  const modLoupeCanvas = root.querySelector('[data-sd-loupe-canvas="mod"]');
  const origCard = root.querySelector('[data-sd-card="orig"]');
  const modCard = root.querySelector('[data-sd-card="mod"]');
  const arenaEl = root.querySelector('[data-sd-arena]');
  const partyBannerEl = root.querySelector('[data-sd-party-banner]');
  const partySkipBtn = root.querySelector('[data-sd-party-skip]');
  const countEl = root.querySelector('[data-sd-count]');
  const setTimer = bindClock(root.querySelector('[data-pm-timer]'));
  const setScore = bindScore(root.querySelector('[data-pm-score]'));
  const dotsWrap = root.querySelector('[data-sd-dots]');
  const hintBtn = root.querySelector('[data-sd-hint]');
  const loupeBtn = root.querySelector('[data-sd-loupe]');
  const calloutEl = root.querySelector('[data-sd-callout]');
  const loadingEls = Array.from(root.querySelectorAll('[data-sd-loading]'));
  const viewTabEls = Array.from(root.querySelectorAll('[data-sd-view]'));

  // Offscreen base buffers (1200x896)
  const origBase = document.createElement('canvas');
  origBase.width = BASE_W;
  origBase.height = BASE_H;
  const origBaseCtx = origBase.getContext('2d');

  const modBase = document.createElement('canvas');
  modBase.width = BASE_W;
  modBase.height = BASE_H;
  const modBaseCtx = modBase.getContext('2d', { willReadFrequently: true });

  function computeScore() {
    const base = foundCount * 600;
    const cleared = foundCount === targetCount;
    const timeBonus = cleared ? Math.round(Math.max(0, remainingSec) * 50) : 0;
    const streakBonus = maxStreak * 120;
    const perfectBonus = cleared && wrongTaps === 0 && hintsUsed === 0 ? 1000 : 0;
    return Math.max(
      0,
      base + timeBonus + streakBonus + perfectBonus - hintsUsed * 350 - wrongTaps * 50
    );
  }

  function syncStatus() {
    setTimer(partyPhase === 'memorize' ? memorizeRemainingSec : remainingSec);
    setScore(computeScore());
  }

  function enterFindPhase() {
    if (partyPhase === 'find' || finished || unmounted) return;
    partyPhase = 'find';
    if (arenaEl) arenaEl.dataset.partyPhase = 'find';
    if (partyBannerEl) partyBannerEl.hidden = true;
    hideLoupes();
    remainingSec = timeLimitSec;
    lastTickWholeSec = Math.ceil(timeLimitSec);
    ctx.audio.playClick();
    setCallout(`🔍 기억을 떠올려 바뀐 그림에서 다른 곳 ${targetCount}곳을 찾으세요!`, 'info');
    syncStatus();
    updateHintBtn();
    markDirty();
  }

  function setCallout(text, tone = 'info') {
    if (!calloutEl) return;
    calloutEl.dataset.tone = tone;
    calloutEl.textContent = text;
  }

  function updateCounterUi() {
    if (countEl) {
      countEl.textContent = `${foundCount} / ${targetCount}`;
    }
    const dotEls = dotsWrap?.querySelectorAll('.sd-dot');
    if (dotEls) {
      // Dots are identity slots: dot N lights up for the Nth seeded anomaly,
      // so the hint pulse and the found check live on the same slot.
      dotEls.forEach((dot, idx) => {
        if (anomalies[idx]?.found) {
          dot.classList.add('is-found');
          dot.textContent = '✓';
        }
      });
    }
  }

  function updateHintBtn() {
    if (!hintBtn) return;
    const rem = Math.max(0, MAX_HINTS - hintsUsed);
    hintBtn.textContent = `💡 힌트 (${rem})`;
    hintBtn.disabled = partyPhase === 'memorize' || rem === 0 || finished;
  }

  function clearHintedDots() {
    dotsWrap?.querySelectorAll('.sd-dot.is-hinted').forEach((dot) => {
      dot.classList.remove('is-hinted');
    });
  }

  function markHintedDot() {
    clearHintedDots();
    if (!activeHint) return;
    dotsWrap
      ?.querySelector(`[data-sd-dot="${activeHint.spot.index}"]`)
      ?.classList.add('is-hinted');
  }

  function hideLoupes() {
    origLoupeCanvas?.classList.remove('is-visible');
    modLoupeCanvas?.classList.remove('is-visible');
  }

  function renderLoupeFor(side, clientX, clientY, isTouch) {
    if (!loupeEnabled || !imageReady || isPaused || finished) {
      hideLoupes();
      return;
    }
    const targetCanvas = side === 'orig' ? origCanvas : modCanvas;
    const loupeCanvas = side === 'orig' ? origLoupeCanvas : modLoupeCanvas;
    const otherLoupe = side === 'orig' ? modLoupeCanvas : origLoupeCanvas;
    const sourceBuffer = side === 'orig' ? origBase : modBase;
    if (!targetCanvas || !loupeCanvas) return;

    otherLoupe?.classList.remove('is-visible');

    const rect = targetCanvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    const localX = clientX - rect.left;
    const localY = clientY - rect.top;
    const nx = Math.max(0, Math.min(1, localX / rect.width));
    const ny = Math.max(0, Math.min(1, localY / rect.height));

    const lSize = loupeCanvas.width;
    const half = lSize / 2;
    // Offset loupe above finger on touch so finger never obscures magnified target
    let offsetY = isTouch ? -76 : 0;
    if (isTouch && localY < 100) offsetY = 76;

    const tx = Math.max(-12, Math.min(rect.width - lSize + 12, localX - half));
    const ty = Math.max(-12, Math.min(rect.height - lSize + 12, localY + offsetY - half));
    loupeCanvas.style.transform = `translate3d(${tx.toFixed(1)}px, ${ty.toFixed(1)}px, 0)`;
    loupeCanvas.classList.add('is-visible');

    drawLoupe(loupeCanvas, sourceBuffer, nx, ny, rect.width);
  }

  function spawnFeedback(nx, ny, type, labelText, ringRPx = 0) {
    const now = performance.now();
    if (type === 'hit') {
      const colors = [COLOR.success, COLOR.gold, COLOR.accent, '#ffffff'];
      for (let i = 0; i < 14; i += 1) {
        const angle = (Math.PI * 2 * i) / 14 + (Math.random() - 0.5) * 0.25;
        const speed = 1.8 + Math.random() * 3.4;
        particles.push({
          x: nx * BASE_W,
          y: ny * BASE_H,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 0.8,
          size: 3.5 + Math.random() * 3.5,
          color: colors[i % colors.length],
          bornAt: now,
          life: 620,
        });
      }
      popups.push({
        x: nx * BASE_W,
        y: ny * BASE_H - Math.max(ringRPx, 48) - 12,
        text: labelText,
        color: COLOR.success,
        bornAt: now,
        life: 1250,
        type: 'hit',
      });
    } else {
      popups.push({
        x: nx * BASE_W,
        y: ny * BASE_H,
        text: labelText,
        color: COLOR.danger,
        bornAt: now,
        life: 820,
        type: 'miss',
      });
    }
  }

  function triggerShake() {
    origCard?.classList.remove('is-shaking');
    modCard?.classList.remove('is-shaking');
    void origCard?.offsetWidth;
    origCard?.classList.add('is-shaking');
    modCard?.classList.add('is-shaking');
    clearTimeout(shakeTimerId);
    shakeTimerId = window.setTimeout(() => {
      origCard?.classList.remove('is-shaking');
      modCard?.classList.remove('is-shaking');
    }, SHAKE_MS);
  }

  function triggerHitFlash() {
    origCard?.classList.add('is-hit');
    modCard?.classList.add('is-hit');
    clearTimeout(hitFlashTimerId);
    hitFlashTimerId = window.setTimeout(() => {
      origCard?.classList.remove('is-hit');
      modCard?.classList.remove('is-hit');
    }, HIT_FLASH_MS);
  }

  function finishGame(cleared) {
    if (finished || unmounted) return;
    finished = true;
    hideLoupes();
    activeHint = null;
    clearHintedDots();
    hintBtn?.classList.remove('is-active');
    markDirty();
    updateHintBtn();
    deliverResult(cleared);
  }

  // Single source for the result payload (time-out finish and full-clear finish)
  function deliverResult(cleared) {
    ctx.completeGame({
      score: computeScore(),
      timeMs: Math.round(activePlayMs),
      cleared,
      modeLabel,
      details: [
        { value: `🔍 ${foundCount}/${targetCount} 차이` },
        { value: `⏱ ${(activePlayMs / 1000).toFixed(1)}초` },
        { value: `❌ 오답 ${wrongTaps}회` },
        { value: `💡 힌트 ${hintsUsed}회` },
      ],
    });
  }

  function handleCanvasTap(side, clientX, clientY, pointerType) {
    if (!imageReady || isPaused || finished || partyPhase === 'memorize') return;
    const now = performance.now();
    if (now < cooldownUntilMs) return;

    const canvas = side === 'orig' ? origCanvas : modCanvas;
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    const nx = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const ny = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
    lastTapNorm = { x: nx, y: ny };

    const slop = pointerType === 'touch' ? TOUCH_HIT_SLOP : 0;

    // Check unfound anomalies first (closest within radius)
    let matchedSpot = null;
    let bestDist = Infinity;
    for (const spot of anomalies) {
      if (spot.found) continue;
      const dx = nx - spot.x;
      const dy = (ny - spot.y) * (BASE_H / BASE_W); // Aspect-corrected circular hit test
      const dist = Math.hypot(dx, dy);
      const hitR = Math.max(spot.r, MIN_HIT_RADIUS) + slop;
      if (dist <= hitR && dist < bestDist) {
        bestDist = dist;
        matchedSpot = spot;
      }
    }

    if (matchedSpot) {
      matchedSpot.found = true;
      matchedSpot.foundAtMs = now;
      foundCount += 1;
      streak += 1;
      maxStreak = Math.max(maxStreak, streak);

      ctx.audio.playMatch(streak);
      triggerHitFlash();
      updateCounterUi();
      syncStatus();

      const bonusTag = streak >= 2 ? ` · ${streak}연속!` : '';
      const ringRPx = Math.max(matchedSpot.r, MIN_HIT_RADIUS) * BASE_W * 0.92;
      spawnFeedback(matchedSpot.x, matchedSpot.y, 'hit', `${matchedSpot.label} +600${bonusTag}`, ringRPx);
      setCallout(`✨ 「${matchedSpot.label}」 발견! (${foundCount}/${targetCount})`, 'success');

      if (activeHint && activeHint.spot.id === matchedSpot.id) {
        activeHint = null;
        clearHintedDots();
        hintBtn?.classList.remove('is-active');
      }
      markDirty();

      if (foundCount >= targetCount) {
        updateHintBtn();
        // Brief celebration window so the player sees the final ring & sparkle
        finished = true;
        hideLoupes();
        finishTimerId = window.setTimeout(() => {
          if (unmounted) return;
          deliverResult(true);
        }, FINISH_DELAY_MS);
      }
      return;
    }

    // Check if user tapped an already-found difference (zero penalty!)
    for (const spot of anomalies) {
      if (!spot.found) continue;
      const dx = nx - spot.x;
      const dy = (ny - spot.y) * (BASE_H / BASE_W);
      const hitR = Math.max(spot.r, MIN_HIT_RADIUS) + slop;
      if (Math.hypot(dx, dy) <= hitR) {
        ctx.ui.showToast('이미 찾은 차이점이에요!', 'info', 1400);
        return;
      }
    }

    // Wrong tap feedback (party mode has no time penalty)
    wrongTaps += 1;
    streak = 0;
    cooldownUntilMs = now + WRONG_INPUT_COOLDOWN_MS;
    if (!party) {
      remainingSec = Math.max(0, remainingSec - MISS_TIME_PENALTY_SEC);
    }

    ctx.audio.playError();
    triggerShake();
    spawnFeedback(nx, ny, 'miss', party ? '틀렸어요!' : `-${MISS_TIME_PENALTY_SEC}초 페널티!`);
    setCallout(
      party ? '❌ 다른 곳이 아니에요! 다시 잘 떠올려 보세요.' : `❌ 다른 곳이 아니에요! (-${MISS_TIME_PENALTY_SEC}초 페널티)`,
      'error'
    );
    syncStatus();
    markDirty();

    if (!party && remainingSec <= 0) {
      finishGame(false);
    }
  }

  function triggerHint() {
    if (!imageReady || isPaused || finished || partyPhase === 'memorize') return;
    if (hintsUsed >= MAX_HINTS) {
      ctx.ui.showToast('힌트를 모두 사용했습니다!', 'warn', 1600);
      return;
    }
    const unfound = anomalies.filter((s) => !s.found);
    if (unfound.length === 0) return;

    // Pick unfound anomaly farthest from last tap for helpful coverage
    let target = unfound[0];
    let maxD = -1;
    for (const s of unfound) {
      const d = Math.hypot(s.x - lastTapNorm.x, s.y - lastTapNorm.y);
      if (d > maxD) {
        maxD = d;
        target = s;
      }
    }

    hintsUsed += 1;
    activeHint = { spot: target, untilMs: performance.now() + HINT_DURATION_MS };
    // Expose the hinted slot in the counter so the dot matches the radar zone.
    markHintedDot();
    hintBtn?.classList.add('is-active');
    markDirty();
    ctx.audio.playHint();
    updateHintBtn();
    syncStatus();
    setCallout(`💡 힌트 레이더 가동! 노란 점선 영역 안을 자세히 보세요.`, 'hint');
  }

  function toggleLoupe(forceState) {
    loupeEnabled = typeof forceState === 'boolean' ? forceState : !loupeEnabled;
    root.classList.toggle('is-loupe-on', loupeEnabled);
    if (loupeBtn) {
      loupeBtn.classList.toggle('is-active', loupeEnabled);
      loupeBtn.setAttribute('aria-pressed', String(loupeEnabled));
      loupeBtn.textContent = loupeEnabled ? '🔍 돋보기 ON' : '🔍 돋보기';
    }
    if (!loupeEnabled) {
      hideLoupes();
    } else {
      ctx.ui.showToast('2.0x 돋보기 활성화! 그림 위를 움직여 보세요.', 'info', 1800);
    }
  }

  /* === Render Loop (Dual Synchronized Canvases) === */
  function renderBoards(nowMs) {
    if (!imageReady) return;

    const drawOverlay = (targetCtx, side) => {
      // Found markers (synchronized on both canvases)
      for (const spot of anomalies) {
        if (spot.found) {
          // Badge matches the counter dot label for the same anomaly slot.
          drawFoundMarker(targetCtx, spot, nowMs, spot.index + 1);
        }
      }

      // Hint beacon (synchronized on both canvases)
      if (activeHint) {
        drawHintBeacon(targetCtx, activeHint, nowMs);
      }

      // Mirror crosshair on opposite canvas
      drawMirrorCrosshair(targetCtx, pointerMirror, side);

      drawEffects(targetCtx, particles, popups, nowMs);
    };

    origCtx.clearRect(0, 0, BASE_W, BASE_H);
    origCtx.drawImage(origBase, 0, 0);
    drawOverlay(origCtx, 'orig');

    modCtx.clearRect(0, 0, BASE_W, BASE_H);
    modCtx.drawImage(modBase, 0, 0);
    drawOverlay(modCtx, 'mod');

    needsRender = false;
  }

  /** True while any canvas overlay is still animating and must be repainted. */
  function hasActiveAnimation(nowMs) {
    if (isPaused) return false;
    if (particles.length > 0 || popups.length > 0) return true;
    if (activeHint && nowMs < activeHint.untilMs) return true;
    for (const spot of anomalies) {
      if (spot.found && nowMs - spot.foundAtMs < FOUND_ANIM_MS) return true;
    }
    return false;
  }

  function expireHintIfNeeded(nowMs) {
    if (!activeHint || nowMs < activeHint.untilMs) return;
    activeHint = null;
    clearHintedDots();
    hintBtn?.classList.remove('is-active');
    markDirty();
  }

  function frame(nowMs) {
    if (unmounted) return;
    const dtMs = Math.max(0, Math.min(120, nowMs - lastFrameMs));
    lastFrameMs = nowMs;

    if (imageReady && !isPaused && !finished) {
      if (partyPhase === 'memorize') {
        memorizeRemainingSec = Math.max(0, memorizeRemainingSec - dtMs / 1000);
        const wholeSec = Math.ceil(memorizeRemainingSec);
        if (wholeSec !== lastTickWholeSec) {
          lastTickWholeSec = wholeSec;
          if (wholeSec > 0 && wholeSec <= 5) {
            ctx.audio.playTick();
          }
        }
        syncStatus();
        if (memorizeRemainingSec <= 0) {
          enterFindPhase();
        }
      } else {
        activePlayMs += dtMs;
        remainingSec = Math.max(0, remainingSec - dtMs / 1000);

        const wholeSec = Math.ceil(remainingSec);
        if (wholeSec !== lastTickWholeSec) {
          lastTickWholeSec = wholeSec;
          if (wholeSec > 0 && wholeSec <= 10) {
            ctx.audio.playTick();
          }
        }

        syncStatus();

        if (remainingSec <= 0) {
          finishGame(false);
          if (unmounted) return;
        }
      }
    }

    expireHintIfNeeded(nowMs);

    // Prune expired particles & popups (and repaint once to erase the last frame of them)
    let prunedAny = false;
    for (let i = particles.length - 1; i >= 0; i -= 1) {
      if (nowMs - particles[i].bornAt >= particles[i].life) {
        particles.splice(i, 1);
        prunedAny = true;
      }
    }
    for (let i = popups.length - 1; i >= 0; i -= 1) {
      if (nowMs - popups[i].bornAt >= popups[i].life) {
        popups.splice(i, 1);
        prunedAny = true;
      }
    }
    if (prunedAny) markDirty();

    // Dirty-flag loop: repaint only on state changes or while overlays animate.
    if (needsRender || hasActiveAnimation(nowMs)) {
      renderBoards(nowMs);
    }
    rafId = requestAnimationFrame(frame);
  }

  /* === Pointer & Keyboard Event Wiring === */
  function updatePointerMirror(side, clientX, clientY) {
    const canvas = side === 'orig' ? origCanvas : modCanvas;
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    pointerMirror.active = true;
    pointerMirror.side = side;
    pointerMirror.nx = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    pointerMirror.ny = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
    markDirty();
  }

  function attachCanvasEvents(canvas, side) {
    const onPointerDown = (e) => {
      if (!imageReady || isPaused || finished) return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;

      if (e.pointerType === 'touch') {
        touchGesture.active = true;
        touchGesture.pointerId = e.pointerId;
        touchGesture.side = side;
        touchGesture.startClientX = e.clientX;
        touchGesture.startClientY = e.clientY;
        touchGesture.moved = false;
        touchGesture.startMs = performance.now();

        if (loupeEnabled) {
          canvas.setPointerCapture?.(e.pointerId);
          renderLoupeFor(side, e.clientX, e.clientY, true);
        }
        return;
      }

      // Mouse / Pen: instant responsive click
      handleCanvasTap(side, e.clientX, e.clientY, e.pointerType);
    };

    const onPointerMove = (e) => {
      if (!imageReady || isPaused || finished) return;

      if (e.pointerType === 'touch') {
        if (!touchGesture.active || touchGesture.pointerId !== e.pointerId) return;
        const dist = Math.hypot(
          e.clientX - touchGesture.startClientX,
          e.clientY - touchGesture.startClientY
        );
        if (dist >= 8) touchGesture.moved = true;
        if (loupeEnabled && (touchGesture.moved || performance.now() - touchGesture.startMs >= 160)) {
          renderLoupeFor(side, e.clientX, e.clientY, true);
          updatePointerMirror(side, e.clientX, e.clientY);
        }
        return;
      }

      updatePointerMirror(side, e.clientX, e.clientY);
      if (loupeEnabled) {
        renderLoupeFor(side, e.clientX, e.clientY, false);
      }
    };

    const onPointerUp = (e) => {
      if (e.pointerType !== 'touch') return;
      if (!touchGesture.active || touchGesture.pointerId !== e.pointerId) return;
      const elapsed = performance.now() - touchGesture.startMs;
      const wasDrag = touchGesture.moved || (loupeEnabled && elapsed >= 180);
      touchGesture.active = false;
      hideLoupes();

      if (!wasDrag) {
        handleCanvasTap(side, e.clientX, e.clientY, 'touch');
      }
    };

    const onPointerLeave = (e) => {
      if (e.pointerType !== 'touch') {
        if (pointerMirror.side === side) pointerMirror.active = false;
        hideLoupes();
        markDirty(); // erase the mirror crosshair
      }
    };

    const onPointerCancel = () => {
      touchGesture.active = false;
      hideLoupes();
    };

    const onCanvasKeyDown = (e) => {
      if (e.key !== 'Enter' && e.key !== ' ' && e.key !== 'Spacebar') return;
      if (isPaused || finished) return;
      e.preventDefault();
      if (e.repeat) return;
      triggerHint();
    };

    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointerleave', onPointerLeave);
    canvas.addEventListener('pointercancel', onPointerCancel);
    canvas.addEventListener('keydown', onCanvasKeyDown);

    return () => {
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointerleave', onPointerLeave);
      canvas.removeEventListener('pointercancel', onPointerCancel);
      canvas.removeEventListener('keydown', onCanvasKeyDown);
    };
  }

  const detachOrig = attachCanvasEvents(origCanvas, 'orig');
  const detachMod = attachCanvasEvents(modCanvas, 'mod');

  const onHintClick = () => {
    ctx.audio.playClick();
    triggerHint();
  };
  const onLoupeClick = () => {
    ctx.audio.playClick();
    toggleLoupe();
  };
  const onPartySkipClick = () => {
    enterFindPhase();
  };
  hintBtn?.addEventListener('click', onHintClick);
  loupeBtn?.addEventListener('click', onLoupeClick);
  partySkipBtn?.addEventListener('click', onPartySkipClick);

  const viewTabCleanups = viewTabEls.map((btn) => {
    const handler = () => {
      ctx.audio.playClick();
      if (arenaEl) arenaEl.dataset.mobileView = btn.dataset.sdView || 'both';
      viewTabEls.forEach((b) => {
        const active = b === btn;
        b.classList.toggle('is-active', active);
        b.setAttribute('aria-selected', String(active));
      });
    };
    btn.addEventListener('click', handler);
    return () => btn.removeEventListener('click', handler);
  });

  function isTypingTarget(target) {
    if (!(target instanceof Element)) return false;
    if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return true;
    if (target instanceof HTMLSelectElement) return true;
    return Boolean(
      target.closest('[contenteditable=""], [contenteditable="true"], [role="textbox"]')
    );
  }

  const onKeyDown = (e) => {
    if (isPaused || finished) return;
    // Ignore auto-repeat so a held H cannot burn both hints at once
    if (e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
    if (isTypingTarget(e.target)) return;
    const key = e.key.toLowerCase();
    if (key === 'h') {
      e.preventDefault();
      triggerHint();
    } else if (key === 'm' || key === 'z') {
      e.preventDefault();
      toggleLoupe();
    }
  };
  window.addEventListener('keydown', onKeyDown);

  const offPause = ctx.onPause((paused) => {
    isPaused = paused;
    if (isPaused) {
      hideLoupes();
      pointerMirror.active = false;
    } else {
      lastFrameMs = performance.now();
    }
    markDirty();
  });

  /* === Load Stage Image & Build Original + Modified Buffers === */
  syncStatus();
  updateHintBtn();

  function startRound() {
    imageReady = true;
    lastFrameMs = performance.now();
    loadingEls.forEach((el) => el.remove());
    needsRender = true;
    renderBoards(lastFrameMs);
    rafId = requestAnimationFrame(frame);
  }

  const imgs = [];
  const loadImage = (src) =>
    new Promise((resolve, reject) => {
      const im = new Image();
      im.decoding = 'async';
      im.onload = () => resolve(im);
      im.onerror = () => reject(new Error(`Failed to load ${src}`));
      im.src = src;
      imgs.push(im);
    });

  if (stage.kind === 'photo-set') {
    Promise.all([loadImage(roundData.leftSrc), loadImage(roundData.rightSrc)])
      .then(([leftImg, rightImg]) => {
        if (unmounted) return;
        origBaseCtx.drawImage(leftImg, 0, 0, BASE_W, BASE_H);
        // Start right canvas identical to left, then paste ONLY the round's selected anomalies
        // from rightImg so every visible difference on screen matches `anomalies` 1-to-1.
        modBaseCtx.drawImage(leftImg, 0, 0, BASE_W, BASE_H);
        const rightBuf = document.createElement('canvas');
        rightBuf.width = BASE_W;
        rightBuf.height = BASE_H;
        const rightBufCtx = rightBuf.getContext('2d', { willReadFrequently: true });
        rightBufCtx.drawImage(rightImg, 0, 0, BASE_W, BASE_H);
        for (const spot of anomalies) {
          if (spot.box) copyBoxFeathered(rightBufCtx, modBaseCtx, spot.box);
        }
        startRound();
      })
      .catch(() => {
        if (unmounted) return;
        loadingEls.forEach((el) => {
          el.textContent = '이미지를 불러오지 못했습니다.';
        });
        ctx.ui.showToast('스테이지 이미지를 불러오는 데 실패했습니다.', 'error');
      });
  } else {
    loadImage(roundData.leftSrc)
      .then((loaded) => {
        if (unmounted) return;
        origBaseCtx.drawImage(loaded, 0, 0, BASE_W, BASE_H);
        modBaseCtx.drawImage(loaded, 0, 0, BASE_W, BASE_H);
        // Apply ONLY the N seeded anomalies onto the modified buffer
        for (const spot of anomalies) applyAnomalyToBuffer(modBaseCtx, spot);
        startRound();
      })
      .catch(() => {
        if (unmounted) return;
        loadingEls.forEach((el) => {
          el.textContent = '이미지를 불러오지 못했습니다.';
        });
        ctx.ui.showToast('스테이지 이미지를 불러오는 데 실패했습니다.', 'error');
      });
  }

  return {
    unmount() {
      unmounted = true;
      if (rafId) cancelAnimationFrame(rafId);
      if (finishTimerId) clearTimeout(finishTimerId);
      if (shakeTimerId) clearTimeout(shakeTimerId);
      if (hitFlashTimerId) clearTimeout(hitFlashTimerId);

      detachOrig();
      detachMod();
      hintBtn?.removeEventListener('click', onHintClick);
      loupeBtn?.removeEventListener('click', onLoupeClick);
      partySkipBtn?.removeEventListener('click', onPartySkipClick);
      viewTabCleanups.forEach((fn) => fn());
      window.removeEventListener('keydown', onKeyDown);
      offPause();

      for (const im of imgs) {
        im.onload = null;
        im.onerror = null;
      }
    },
  };
}
