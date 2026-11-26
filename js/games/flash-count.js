/**
 * Game: 찰나의 카운팅 (FLASH COUNT)
 *
 * A cluster of crisp vector icons flashes briefly in an arena, then vanishes.
 * Players recall how many of the target icon appeared:
 * - Solo (`play: 0`): 4 numeric choices (+ keys 1-4), instant visual verification.
 * - Party (`play: 1`): Giant projector prompt + MC Reveal (`Space`) showing highlighted
 *   targets + Next (`Enter`/`→`) + team +1 scoreboard.
 */
import { pickSeeded, shuffleSeeded } from '../core/seed.js';
import { WRONG_INPUT_COOLDOWN_MS } from '../core/rules.js';
import { createPartyScoreboard, renderPlayModeSwitch } from './party-kit.js';
import {
  FLASH_COUNT_DEFAULT_PRESET,
  FLASH_COUNT_FIELDS,
  FLASH_COUNT_PRESETS,
  flashCountModeId,
  matchFlashCountPreset,
  parseFlashCountMode,
} from './flash-count-settings.js';

const LAST_MODE_PREF = 'flashCountLastMode';
const READY_SEC = 0.85;
const FEEDBACK_MS = 1250;

export const COUNT_SYMBOLS = [
  {
    id: 'star',
    label: '별',
    color: '#d97706',
    svg: '<polygon points="32,6 39,23 58,24 43,36 48,55 32,44 16,55 21,36 6,24 25,23" fill="#fbbf24" stroke="#92400e" stroke-width="3" stroke-linejoin="round"/>',
  },
  {
    id: 'heart',
    label: '하트',
    color: '#e11d48',
    svg: '<path d="M32 54 C14 42 8 30 8 20 A13 13 0 0 1 32 14 A13 13 0 0 1 56 20 C56 30 50 42 32 54 Z" fill="#fb7185" stroke="#9f1239" stroke-width="3" stroke-linejoin="round"/>',
  },
  {
    id: 'bolt',
    label: '번개',
    color: '#2563eb',
    svg: '<polygon points="36,6 14,35 30,35 26,58 50,28 34,28" fill="#60a5fa" stroke="#1e40af" stroke-width="3" stroke-linejoin="round"/>',
  },
  {
    id: 'diamond',
    label: '다이아',
    color: '#0891b2',
    svg: '<polygon points="18,12 46,12 58,26 32,56 6,26" fill="#22d3ee" stroke="#155e75" stroke-width="3" stroke-linejoin="round"/><polyline points="6,26 58,26" fill="none" stroke="#155e75" stroke-width="2.5"/>',
  },
  {
    id: 'crown',
    label: '왕관',
    color: '#9333ea',
    svg: '<polygon points="8,50 12,18 24,32 32,12 40,32 52,18 56,50" fill="#c084fc" stroke="#581c87" stroke-width="3" stroke-linejoin="round"/><rect x="8" y="48" width="48" height="7" rx="3" fill="#a855f7" stroke="#581c87" stroke-width="2.5"/>',
  },
  {
    id: 'clover',
    label: '클로버',
    color: '#16a34a',
    svg: '<circle cx="24" cy="22" r="10" fill="#4ade80" stroke="#166534" stroke-width="2.8"/><circle cx="40" cy="22" r="10" fill="#4ade80" stroke="#166534" stroke-width="2.8"/><circle cx="24" cy="38" r="10" fill="#4ade80" stroke="#166534" stroke-width="2.8"/><circle cx="40" cy="38" r="10" fill="#4ade80" stroke="#166534" stroke-width="2.8"/><path d="M32 42 L32 58" stroke="#166534" stroke-width="4" stroke-linecap="round"/>',
  },
];

/** Rejection-sampled non-overlapping normalized positions in [10..90] x [14..86]. */
function placeIcons(rng, count) {
  const pts = [];
  const minDist = count >= 22 ? 10.5 : count >= 16 ? 12 : 14;
  for (let i = 0; i < count; i += 1) {
    let best = null;
    let bestClearance = -1;
    for (let attempt = 0; attempt < 60; attempt += 1) {
      const x = 10 + rng() * 80;
      const y = 14 + rng() * 72;
      let minSeen = Infinity;
      for (const p of pts) {
        const d = Math.hypot((x - p.x) * 1.15, y - p.y);
        if (d < minSeen) minSeen = d;
      }
      if (minSeen >= minDist) {
        best = { x, y };
        break;
      }
      if (minSeen > bestClearance) {
        bestClearance = minSeen;
        best = { x, y };
      }
    }
    pts.push({
      x: best.x,
      y: best.y,
      rot: Math.round((rng() - 0.5) * 28),
    });
  }
  return pts;
}

/** Deterministic Flash Count problem sequence for a given seed + settings. */
export function generateFlashCountRun(rng, settings) {
  const problems = [];
  for (let i = 0; i < settings.rounds; i += 1) {
    const active = pickSeeded(rng, COUNT_SYMBOLS, settings.kinds);
    const target = active[0];
    const avg = Math.max(2, Math.round(settings.totalIcons / settings.kinds));
    const maxAllowed = settings.totalIcons - (settings.kinds - 1);
    const offset = Math.floor(rng() * 5) - 2; // -2..+2
    const targetCount = Math.max(2, Math.min(maxAllowed, avg + offset));

    const icons = [];
    for (let k = 0; k < targetCount; k += 1) icons.push(target);

    const others = active.slice(1);
    let rem = settings.totalIcons - targetCount;
    for (let j = 0; j < others.length; j += 1) {
      const leftKinds = others.length - j - 1;
      const share =
        j === others.length - 1
          ? rem
          : Math.max(1, Math.min(rem - leftKinds, Math.round(rem / (others.length - j)) + (rng() < 0.5 ? 1 : -1)));
      for (let k = 0; k < share; k += 1) icons.push(others[j]);
      rem -= share;
    }

    const shuffledIcons = shuffleSeeded(rng, icons);
    const positions = placeIcons(rng, shuffledIcons.length);
    const nodes = shuffledIcons.map((sym, idx) => ({
      symbol: sym,
      x: positions[idx].x,
      y: positions[idx].y,
      rot: positions[idx].rot,
      isTarget: sym.id === target.id,
    }));

    const choiceSet = new Set([targetCount]);
    for (const delta of shuffleSeeded(rng, [-2, -1, 1, 2, -3, 3, 4])) {
      if (choiceSet.size >= 4) break;
      const cand = targetCount + delta;
      if (cand >= 1 && cand <= settings.totalIcons) choiceSet.add(cand);
    }
    while (choiceSet.size < 4) {
      choiceSet.add(1 + Math.floor(rng() * settings.totalIcons));
    }
    const choices = shuffleSeeded(
      rng,
      [...choiceSet].map((count) => ({ count, isCorrect: count === targetCount }))
    );

    problems.push({ target, targetCount, nodes, choices });
  }
  return problems;
}

const formatValue = (f, v) => (f.valueLabels ? f.valueLabels[f.options.indexOf(v)] : `${v}${f.unit}`);

function describe(s) {
  const playTxt = s.play === 1 ? '다같이 한 화면 진행' : '혼자 선택지 도전';
  return `${playTxt} · ${s.rounds}문제 · ${s.totalIcons}개 (${s.kinds}종류) · ${s.flashSec}초 노출`;
}

export function mount(container, ctx) {
  const settings = parseFlashCountMode(ctx.mode);
  return settings ? mountGame(container, ctx, settings) : mountSetup(container, ctx);
}

/* ============================================================================
 * Setup Screen
 * ========================================================================== */
function mountSetup(container, ctx) {
  const last = parseFlashCountMode(ctx.storage.getPref?.(LAST_MODE_PREF, '') || '');
  const preset = FLASH_COUNT_PRESETS.find((p) => p.id === FLASH_COUNT_DEFAULT_PRESET);
  const source = last || { ...preset, play: 0 };
  let values = Object.fromEntries(FLASH_COUNT_FIELDS.map((f) => [f.key, source[f.key]]));

  const root = document.createElement('div');
  root.className = 'game-root game-flash-count fc-setup';
  root.innerHTML = `
    <div class="fc-setup__head">
      <h2 class="fc-setup__title">찰나의 카운팅 · 난이도</h2>
      <p class="fc-setup__sub">잠깐 나타났다가 사라지는 아이콘 중 <b>목표 그림이 몇 개였는지</b> 기억하세요!</p>
    </div>
    ${renderPlayModeSwitch(values.play, 'fc')}
    <div class="fc-setup__body">
      <div class="fc-presets" role="radiogroup" aria-label="난이도 프리셋">
        ${FLASH_COUNT_PRESETS.map(
          (p) => `
          <button type="button" class="fc-preset fc-preset--${p.id}" role="radio" data-preset="${p.id}">
            <span class="fc-preset__name">${p.label}</span>
            <span class="fc-preset__ko">${p.ko}</span>
            <span class="fc-preset__meta">${p.totalIcons}개(${p.kinds}종) · ${p.flashSec}초</span>
          </button>`
        ).join('')}
      </div>
      <div class="fc-fields">
        ${FLASH_COUNT_FIELDS.map(
          (f) => `
          <div class="fc-field" data-field="${f.key}">
            <span class="fc-field__label">${f.label}</span>
            <div class="fc-stepper">
              <button type="button" class="fc-stepper__btn" data-step="-1" aria-label="${f.label} 줄이기">−</button>
              <output class="fc-stepper__value" data-value></output>
              <button type="button" class="fc-stepper__btn" data-step="1" aria-label="${f.label} 늘리기">+</button>
            </div>
          </div>`
        ).join('')}
        <p class="fc-fields__summary" data-summary></p>
      </div>
    </div>
    <button type="button" class="fc-setup__start" data-start>시작하기 <span aria-hidden="true">→</span></button>
  `;
  container.appendChild(root);

  function render() {
    const match = matchFlashCountPreset(values);
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
    for (const f of FLASH_COUNT_FIELDS) {
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
      const p = FLASH_COUNT_PRESETS.find((x) => x.id === presetBtn.dataset.preset);
      values = { ...values, rounds: p.rounds, flashSec: p.flashSec, totalIcons: p.totalIcons, kinds: p.kinds };
      ctx.audio.playClick();
      render();
    } else if (stepBtn) {
      const key = stepBtn.closest('[data-field]').dataset.field;
      const field = FLASH_COUNT_FIELDS.find((f) => f.key === key);
      const idx = field.options.indexOf(values[key]) + Number(stepBtn.dataset.step);
      if (idx < 0 || idx >= field.options.length) return;
      values = { ...values, [key]: field.options[idx] };
      ctx.audio.playClick();
      render();
    } else if (e.target.closest('[data-start]')) {
      ctx.audio.playClick();
      const mode = flashCountModeId(values);
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
  const problems = generateFlashCountRun(ctx.rng, settings);
  const totalRounds = problems.length;
  const modeLabel =
    (matchFlashCountPreset(settings)?.label || `커스텀 ${totalRounds}문제`) + (isParty ? ' · 다같이' : '');

  let unmounted = false;
  let isPaused = false;
  let finished = false;
  let roundIndex = 0;
  let phase = 'ready'; // ready | flash | ask | feedback | ended
  let phaseClock = 0;
  let activePlayMs = 0;
  let answerStartMs = 0;
  let answerTimeMs = 0;
  let correctCount = 0;
  let wrongTaps = 0;
  let score = 0;
  let streak = 0;
  let maxStreak = 0;
  let cooldownUntilMs = 0;
  let partyRevealed = false;
  let feedbackTimerId = 0;
  let lastFrameMs = performance.now();
  let rafId = 0;

  const root = document.createElement('div');
  root.className = `game-root game-flash-count ${isParty ? 'is-party' : 'is-solo'}`;
  root.innerHTML = `
    <div class="fc-header">
      <div class="fc-status" data-fc-status>잠시 후 아이콘들이 번쩍입니다!</div>
      <div class="fc-badges">
        <span class="fc-combo" data-fc-combo hidden>🔥 x2</span>
        <span class="fc-round-pill" data-fc-round>1 / ${totalRounds}</span>
      </div>
    </div>

    <div class="fc-arena" data-fc-arena></div>

    <div class="fc-meter">
      <div class="fc-meter__fill" data-fc-meter style="width: 100%;"></div>
    </div>

    <div class="fc-bottom" data-fc-bottom></div>
  `;
  container.appendChild(root);

  const statusEl = root.querySelector('[data-fc-status]');
  const comboEl = root.querySelector('[data-fc-combo]');
  const roundPillEl = root.querySelector('[data-fc-round]');
  const arenaEl = root.querySelector('[data-fc-arena]');
  const meterEl = root.querySelector('[data-fc-meter]');
  const bottomEl = root.querySelector('[data-fc-bottom]');

  const partyBoard = isParty
    ? createPartyScoreboard({
        onAward: () => {
          ctx.audio.playMatch(1);
          partyRevealed = true;
          renderArena();
          renderBottom();
          syncHud();
        },
      })
    : null;

  function computeTotalScore() {
    if (isParty) return (partyBoard?.getTotalAwarded() || 0) * 200 + roundIndex * 100;
    return score;
  }

  function syncHud() {
    ctx.updateHud({
      timer: { text: `${Math.min(roundIndex + 1, totalRounds)} / ${totalRounds}`, state: 'normal' },
      score: computeTotalScore(),
      progress: isParty ? `진행 ${roundIndex} / ${totalRounds}` : `정답 ${correctCount}`,
      progressRatio: roundIndex / totalRounds,
      extra: isParty ? '🎙️ 다같이 모드' : streak >= 2 ? `🔥 x${streak}` : '',
    });
  }

  function renderArena() {
    const p = problems[roundIndex];
    if (!p) return;

    if (phase === 'ready') {
      if (statusEl) statusEl.textContent = '눈 크게 뜨고 준비! 곧 그림이 나타납니다.';
      arenaEl.innerHTML = `<div class="fc-ready-card"><span>문제 ${roundIndex + 1} / ${totalRounds}</span><strong>집중!</strong></div>`;
      return;
    }

    if (phase === 'flash') {
      if (statusEl) statusEl.textContent = '👀 아이콘의 개수를 눈에 담으세요!';
      arenaEl.innerHTML = p.nodes
        .map(
          (n) => `
          <div class="fc-icon" style="left:${n.x.toFixed(1)}%;top:${n.y.toFixed(1)}%;transform:translate(-50%,-50%) rotate(${n.rot}deg);">
            <svg viewBox="0 0 64 64" aria-hidden="true">${n.symbol.svg}</svg>
          </div>`
        )
        .join('');
      return;
    }

    if (phase === 'ask' && !(isParty && partyRevealed)) {
      if (statusEl) statusEl.textContent = `방금 본 「${p.target.label}」 아이콘은 몇 개였을까요?`;
      arenaEl.innerHTML = `
        <div class="fc-question">
          <div class="fc-question__icon">
            <svg viewBox="0 0 64 64" aria-hidden="true">${p.target.svg}</svg>
          </div>
          <p class="fc-question__text">방금 화면의 <strong style="color:${p.target.color};">${p.target.label}</strong> 개수는?</p>
        </div>
      `;
      return;
    }

    // feedback or party revealed: show exact nodes with targets highlighted
    if (statusEl) statusEl.textContent = `정답: 「${p.target.label}」 ${p.targetCount}개!`;
    arenaEl.innerHTML = `
      ${p.nodes
        .map(
          (n) => `
          <div class="fc-icon ${n.isTarget ? 'is-target' : 'is-dim'}" style="left:${n.x.toFixed(1)}%;top:${n.y.toFixed(1)}%;transform:translate(-50%,-50%) rotate(${n.rot}deg);">
            <svg viewBox="0 0 64 64" aria-hidden="true">${n.symbol.svg}</svg>
          </div>`
        )
        .join('')}
      <div class="fc-answer-pill">${p.target.label} ${p.targetCount}개</div>
    `;
  }

  function renderBottom() {
    const p = problems[roundIndex];
    if (!p) return;

    if (!isParty) {
      if (phase !== 'ask') {
        bottomEl.innerHTML = `<p class="fc-wait-note">${phase === 'flash' ? '아이콘을 세는 중...' : phase === 'ready' ? '준비 중...' : '다음 문제로 이동합니다...'}</p>`;
        return;
      }
      bottomEl.innerHTML = `
        <div class="fc-choices" role="group" aria-label="개수 선택지">
          ${p.choices
            .map(
              (c, idx) => `
              <button type="button" class="fc-choice" data-count="${c.count}">
                <span class="fc-choice__key">${idx + 1}</span>
                <span class="fc-choice__val">${c.count}개</span>
              </button>`
            )
            .join('')}
        </div>
      `;
      return;
    }

    bottomEl.innerHTML = `
      <div class="fc-party-controls">
        <div class="fc-party-status">
          ${
            partyRevealed
              ? `정답: <strong style="color:${p.target.color};">${p.target.label} ${p.targetCount}개</strong>`
              : phase === 'ask'
                ? '🎙️ 먼저 개수를 외치는 사람 승리!'
                : '👀 화면 집중!'
          }
        </div>
        <div class="fc-party-actions">
          <button type="button" class="fc-mc-btn" data-mc-reveal ${phase !== 'ask' || partyRevealed ? 'disabled' : ''}>
            👁️ 정답 공개 (Space)
          </button>
          <button type="button" class="fc-mc-btn fc-mc-btn--next" data-mc-next>
            ${roundIndex + 1 >= totalRounds ? '🏁 결과 (Enter)' : '다음 → (Enter)'}
          </button>
        </div>
      </div>
    `;
    if (partyBoard) bottomEl.appendChild(partyBoard.el);
  }

  function enterPhase(next) {
    phase = next;
    phaseClock = 0;
    if (roundPillEl) roundPillEl.textContent = `${roundIndex + 1} / ${totalRounds}`;
    if (comboEl) {
      comboEl.hidden = streak < 2;
      comboEl.textContent = `🔥 x${streak}`;
    }
    if (next === 'ready') {
      partyRevealed = false;
      if (meterEl) meterEl.style.width = '100%';
    } else if (next === 'flash') {
      ctx.audio.playTick();
    } else if (next === 'ask') {
      answerStartMs = activePlayMs;
      if (meterEl) meterEl.style.width = '0%';
    }
    renderArena();
    renderBottom();
    syncHud();
  }

  function finishGame() {
    if (finished || unmounted) return;
    finished = true;
    phase = 'ended';
    const attempts = correctCount + wrongTaps;
    const accuracy = isParty ? 100 : attempts > 0 ? Math.round((correctCount / attempts) * 100) : 0;
    const cleared = isParty ? true : correctCount >= Math.ceil(totalRounds * 0.5);
    const details = isParty
      ? [
          { value: `⭐ ${totalRounds}문제 진행` },
          { value: partyBoard.getWinnerSummary() },
          { value: `⏱ ${(activePlayMs / 1000).toFixed(1)}초` },
        ]
      : [
          { value: `⭐ ${correctCount}/${totalRounds} 정답` },
          { value: `⏱ 평균 ${(answerTimeMs / Math.max(1, totalRounds) / 1000).toFixed(1)}초` },
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

  function handleSoloAnswer(pickedCount) {
    if (isPaused || finished || isParty || phase !== 'ask') return;
    const now = performance.now();
    if (now < cooldownUntilMs) return;
    const p = problems[roundIndex];
    if (!p) return;

    answerTimeMs += activePlayMs - answerStartMs;
    if (pickedCount === p.targetCount) {
      correctCount += 1;
      streak += 1;
      maxStreak = Math.max(maxStreak, streak);
      const pts = Math.round(160 + settings.totalIcons * 6 + streak * 40);
      score += pts;
      ctx.audio.playMatch(streak);
    } else {
      wrongTaps += 1;
      streak = 0;
      cooldownUntilMs = now + WRONG_INPUT_COOLDOWN_MS;
      ctx.audio.playError();
    }

    enterPhase('feedback');
    clearTimeout(feedbackTimerId);
    feedbackTimerId = window.setTimeout(() => {
      if (unmounted || finished) return;
      roundIndex += 1;
      if (roundIndex >= totalRounds) finishGame();
      else enterPhase('ready');
    }, FEEDBACK_MS);
  }

  const onClick = (e) => {
    if (isPaused || finished) return;
    const choiceBtn = e.target.closest('[data-count]');
    if (choiceBtn) {
      handleSoloAnswer(Number(choiceBtn.dataset.count));
      return;
    }
    if (!isParty) return;
    if (e.target.closest('[data-mc-reveal]') && phase === 'ask') {
      partyRevealed = true;
      ctx.audio.playHint();
      renderArena();
      renderBottom();
    } else if (e.target.closest('[data-mc-next]')) {
      ctx.audio.playClick();
      roundIndex += 1;
      if (roundIndex >= totalRounds) finishGame();
      else enterPhase('ready');
    }
  };

  const onKeyDown = (e) => {
    if (isPaused || finished) return;
    if (isParty) {
      if (e.code === 'Space' && phase === 'ask' && !partyRevealed) {
        e.preventDefault();
        partyRevealed = true;
        ctx.audio.playHint();
        renderArena();
        renderBottom();
      } else if (e.key === 'Enter' || e.key === 'ArrowRight') {
        e.preventDefault();
        ctx.audio.playClick();
        roundIndex += 1;
        if (roundIndex >= totalRounds) finishGame();
        else enterPhase('ready');
      }
      return;
    }
    const idx = ['1', '2', '3', '4'].indexOf(e.key);
    if (idx !== -1 && phase === 'ask') {
      const choice = problems[roundIndex]?.choices[idx];
      if (choice) {
        e.preventDefault();
        handleSoloAnswer(choice.count);
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
      phaseClock += dtMs / 1000;
      if (phase === 'ready' && phaseClock >= READY_SEC) {
        enterPhase('flash');
      } else if (phase === 'flash') {
        const remRatio = Math.max(0, 1 - phaseClock / settings.flashSec);
        if (meterEl) meterEl.style.width = `${(remRatio * 100).toFixed(1)}%`;
        if (phaseClock >= settings.flashSec) {
          enterPhase('ask');
        }
      }
    }
    rafId = requestAnimationFrame(frame);
  }

  enterPhase('ready');
  rafId = requestAnimationFrame(frame);

  return {
    unmount() {
      unmounted = true;
      if (rafId) cancelAnimationFrame(rafId);
      if (feedbackTimerId) clearTimeout(feedbackTimerId);
      root.removeEventListener('click', onClick);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('pm:pausechange', onPauseChange);
      partyBoard?.destroy();
      container.innerHTML = '';
    },
  };
}
