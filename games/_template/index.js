/**
 * Game: 새 미니게임 (TEMPLATE)
 * 표준 골격: setup-screen, isParty 분기, bindClock/bindScore, onPause, completeGame.
 */
import { bindClock, bindScore } from '../../js/core/clock.js';
import { mountSetupScreen } from '../../js/core/setup-screen.js';
import {
  TEMPLATE_DEFAULT_PRESET,
  TEMPLATE_FIELDS,
  TEMPLATE_PRESETS,
  matchTemplatePreset,
  parseTemplateMode,
  templateModeId,
} from './settings.js';

const LAST_MODE_PREF = 'templateLastMode';

export function mount(container, ctx) {
  const settings = parseTemplateMode(ctx.mode);
  return settings ? mountGame(container, ctx, settings) : mountSetup(container, ctx);
}

function mountSetup(container, ctx) {
  return mountSetupScreen(container, ctx, {
    gameId: 'template',
    title: '새 미니게임 · 난이도',
    intro: '같은 룸 시드라면 모두에게 <b>동일한 문제</b>가 출제됩니다.',
    fields: TEMPLATE_FIELDS,
    presets: TEMPLATE_PRESETS,
    defaultPreset: TEMPLATE_DEFAULT_PRESET,
    presetMeta: (p) => `${p.rounds}문제 · ${p.timeSec}초`,
    describe: (v) => `${v.play === 1 ? '다같이' : '혼자'} · ${v.rounds}문제 · 제한 ${v.timeSec}초`,
    parseMode: parseTemplateMode,
    modeId: templateModeId,
    matchPreset: matchTemplatePreset,
    prefKey: LAST_MODE_PREF,
    playSwitch: true,
  });
}

function mountGame(container, ctx, settings) {
  const isParty = settings.play === 1;
  const modeLabel =
    (matchTemplatePreset(settings)?.label || `커스텀 ${settings.rounds}문제`) + (isParty ? ' · 다같이' : '');

  let unmounted = false;
  let isPaused = false;
  let finished = false;
  let remainingSec = settings.timeSec;
  let elapsedMs = 0;
  let score = 0;
  let lastFrameMs = performance.now();
  let rafId = 0;

  const root = document.createElement('div');
  root.className = `game-root game-template${isParty ? ' is-party' : ''}`;
  root.innerHTML = `
    <header class="tp-head">
      <span class="pm-score" data-pm-score ${isParty ? 'hidden' : ''}></span>
      <span class="pm-timer" data-pm-timer ${isParty ? 'hidden' : ''}></span>
    </header>
    <div class="tp-stage">
      <button type="button" class="btn-neon-primary" data-tp-finish>게임 완료 예시</button>
    </div>
  `;
  container.appendChild(root);

  const setTimer = bindClock(root.querySelector('[data-pm-timer]'));
  const setScore = bindScore(root.querySelector('[data-pm-score]'));

  function syncStatus() {
    if (isParty) return;
    setTimer(remainingSec);
    setScore(score);
  }

  function finishGame(cleared) {
    if (finished || unmounted) return;
    finished = true;
    ctx.completeGame({
      score,
      timeMs: Math.round(elapsedMs),
      cleared,
      modeLabel,
      details: [
        { value: `🎯 ${settings.rounds}문제` },
        { value: `⏱ ${(elapsedMs / 1000).toFixed(1)}초` },
      ],
    });
  }

  const onFinishClick = () => {
    ctx.audio.playClick();
    score = 1000;
    finishGame(true);
  };
  root.querySelector('[data-tp-finish]').addEventListener('click', onFinishClick);

  const offPause = ctx.onPause((paused) => {
    isPaused = paused;
    if (!paused) lastFrameMs = performance.now();
  });

  function frame(nowMs) {
    if (unmounted || finished) return;
    const dtMs = Math.max(0, Math.min(120, nowMs - lastFrameMs));
    lastFrameMs = nowMs;

    if (!isPaused) {
      elapsedMs += dtMs;
      if (!isParty) {
        remainingSec = Math.max(0, remainingSec - dtMs / 1000);
        syncStatus();
        if (remainingSec <= 0) {
          finishGame(false);
          return;
        }
      }
    }
    rafId = requestAnimationFrame(frame);
  }

  syncStatus();
  rafId = requestAnimationFrame(frame);

  return {
    unmount() {
      unmounted = true;
      if (rafId) cancelAnimationFrame(rafId);
      root.querySelector('[data-tp-finish]')?.removeEventListener('click', onFinishClick);
      offPause();
    },
  };
}
