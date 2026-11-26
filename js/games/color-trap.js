/**
 * Game: 컬러 트랩 (COLOR TRAP / Stroop Challenge)
 *
 * Dual-mode party & solo Stroop challenge:
 * - Solo (`play: 0`): 4-choice buttons (+ keys 1-4), timer, streak combo, wrong cooldown.
 * - Party (`play: 1`): Large projector-ready prompt for 5~100 people shouting together,
 *   spoiler-free until MC hits Reveal (`Space`), plus next (`Enter`/`→`) & team +1 bar.
 */
import { pickSeeded, shuffleSeeded } from '../core/seed.js';
import { WRONG_INPUT_COOLDOWN_MS } from '../core/rules.js';
import { createPartyScoreboard, renderPlayModeSwitch } from './party-kit.js';
import {
  COLOR_TRAP_DEFAULT_PRESET,
  COLOR_TRAP_FIELDS,
  COLOR_TRAP_PRESETS,
  colorTrapModeId,
  matchColorTrapPreset,
  parseColorTrapMode,
} from './color-trap-settings.js';

const LAST_MODE_PREF = 'colorTrapLastMode';
const WRONG_PENALTY_SEC = 2.0;

export const TRAP_COLORS = [
  { id: 'red', label: '빨강', hex: '#e11d48', soft: 'rgba(225, 29, 72, 0.12)' },
  { id: 'blue', label: '파랑', hex: '#2563eb', soft: 'rgba(37, 99, 235, 0.12)' },
  { id: 'green', label: '초록', hex: '#16a34a', soft: 'rgba(22, 163, 74, 0.12)' },
  { id: 'yellow', label: '노랑', hex: '#ca8a04', soft: 'rgba(202, 138, 4, 0.14)' },
  { id: 'purple', label: '보라', hex: '#9333ea', soft: 'rgba(147, 51, 234, 0.12)' },
  { id: 'orange', label: '주황', hex: '#ea580c', soft: 'rgba(234, 88, 12, 0.12)' },
];

const COLOR_MAP = new Map(TRAP_COLORS.map((c) => [c.id, c]));

/** Generates deterministic Stroop & 3x3 grid-count questions for a run. */
export function generateColorTrapRun(rng, settings) {
  const questions = [];
  for (let i = 0; i < settings.rounds; i += 1) {
    const useGrid = settings.modeMix === 2 && i >= 2 && i % 3 === 2;
    if (useGrid) {
      const targetColor = TRAP_COLORS[Math.floor(rng() * TRAP_COLORS.length)];
      const askByInk = rng() < 0.65;
      const targetCount = 2 + Math.floor(rng() * 3); // 2, 3, or 4 matching tiles
      const others = TRAP_COLORS.filter((c) => c.id !== targetColor.id);

      const tiles = [];
      for (let t = 0; t < 9; t += 1) {
        const isTarget = t < targetCount;
        if (askByInk) {
          const ink = isTarget ? targetColor : others[Math.floor(rng() * others.length)];
          const wordPool = TRAP_COLORS.filter((c) => c.id !== ink.id);
          const word = wordPool[Math.floor(rng() * wordPool.length)];
          tiles.push({ word, ink });
        } else {
          const word = isTarget ? targetColor : others[Math.floor(rng() * others.length)];
          const inkPool = TRAP_COLORS.filter((c) => c.id !== word.id);
          const ink = inkPool[Math.floor(rng() * inkPool.length)];
          tiles.push({ word, ink });
        }
      }
      const shuffledTiles = shuffleSeeded(rng, tiles);
      const countSet = new Set([targetCount]);
      for (const delta of shuffleSeeded(rng, [-1, 1, 2, -2, 3])) {
        if (countSet.size >= 4) break;
        const cand = targetCount + delta;
        if (cand >= 1 && cand <= 6) countSet.add(cand);
      }
      const choices = shuffleSeeded(
        rng,
        [...countSet].map((n) => ({
          id: String(n),
          label: `${n}개`,
          hex: null,
          isCorrect: n === targetCount,
        }))
      );
      questions.push({
        kind: 'grid',
        askByInk,
        targetColor,
        answerId: String(targetCount),
        answerLabel: `${targetCount}개`,
        tiles: shuffledTiles,
        choices,
      });
      continue;
    }

    // Standard Stroop word question
    const askColor = settings.modeMix === 0 ? true : rng() < 0.65;
    const word = TRAP_COLORS[Math.floor(rng() * TRAP_COLORS.length)];
    const inkPool = TRAP_COLORS.filter((c) => c.id !== word.id);
    const ink = inkPool[Math.floor(rng() * inkPool.length)];
    const answerColor = askColor ? ink : word;
    const distractors = pickSeeded(
      rng,
      TRAP_COLORS.filter((c) => c.id !== answerColor.id),
      3
    );
    const choices = shuffleSeeded(rng, [answerColor, ...distractors]).map((c) => ({
      id: c.id,
      label: c.label,
      hex: c.hex,
      soft: c.soft,
      isCorrect: c.id === answerColor.id,
    }));

    questions.push({
      kind: 'stroop',
      askColor,
      word,
      ink,
      answerId: answerColor.id,
      answerLabel: answerColor.label,
      choices,
    });
  }
  return questions;
}

const formatValue = (f, v) => (f.valueLabels ? f.valueLabels[f.options.indexOf(v)] : `${v}${f.unit}`);

function describe(s) {
  const playTxt = s.play === 1 ? '다같이 한 화면 진행' : '혼자 선택지 도전';
  const mixTxt = COLOR_TRAP_FIELDS[3].valueLabels[s.modeMix];
  return `${playTxt} · ${s.rounds}문제 · ${mixTxt}${s.play === 0 ? ` · ${s.timeSec}초` : ''}`;
}

export function mount(container, ctx) {
  const settings = parseColorTrapMode(ctx.mode);
  return settings ? mountGame(container, ctx, settings) : mountSetup(container, ctx);
}

/* ============================================================================
 * Setup Screen
 * ========================================================================== */
function mountSetup(container, ctx) {
  const last = parseColorTrapMode(ctx.storage.getPref?.(LAST_MODE_PREF, '') || '');
  const preset = COLOR_TRAP_PRESETS.find((p) => p.id === COLOR_TRAP_DEFAULT_PRESET);
  const source = last || { ...preset, play: 0 };
  let values = Object.fromEntries(COLOR_TRAP_FIELDS.map((f) => [f.key, source[f.key]]));

  const root = document.createElement('div');
  root.className = 'game-root game-color-trap ct-setup';
  root.innerHTML = `
    <div class="ct-setup__head">
      <h2 class="ct-setup__title">컬러 트랩 · 난이도</h2>
      <p class="ct-setup__sub">글자의 <b>색깔</b>과 <b>뜻</b>이 다릅니다! 헷갈리지 말고 정확히 고르세요.</p>
    </div>
    ${renderPlayModeSwitch(values.play, 'ct')}
    <div class="ct-setup__body">
      <div class="ct-presets" role="radiogroup" aria-label="난이도 프리셋">
        ${COLOR_TRAP_PRESETS.map(
          (p) => `
          <button type="button" class="ct-preset ct-preset--${p.id}" role="radio" data-preset="${p.id}">
            <span class="ct-preset__name">${p.label}</span>
            <span class="ct-preset__ko">${p.ko}</span>
            <span class="ct-preset__meta">${p.rounds}문제 · ${COLOR_TRAP_FIELDS[3].valueLabels[p.modeMix]}</span>
          </button>`
        ).join('')}
      </div>
      <div class="ct-fields">
        ${COLOR_TRAP_FIELDS.map(
          (f) => `
          <div class="ct-field" data-field="${f.key}">
            <span class="ct-field__label">${f.label}</span>
            <div class="ct-stepper">
              <button type="button" class="ct-stepper__btn" data-step="-1" aria-label="${f.label} 줄이기">−</button>
              <output class="ct-stepper__value" data-value></output>
              <button type="button" class="ct-stepper__btn" data-step="1" aria-label="${f.label} 늘리기">+</button>
            </div>
          </div>`
        ).join('')}
        <p class="ct-fields__summary" data-summary></p>
      </div>
    </div>
    <button type="button" class="ct-setup__start" data-start>시작하기 <span aria-hidden="true">→</span></button>
  `;
  container.appendChild(root);

  function render() {
    const match = matchColorTrapPreset(values);
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
    for (const f of COLOR_TRAP_FIELDS) {
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
      const p = COLOR_TRAP_PRESETS.find((x) => x.id === presetBtn.dataset.preset);
      values = { ...values, rounds: p.rounds, timeSec: p.timeSec, modeMix: p.modeMix };
      ctx.audio.playClick();
      render();
    } else if (stepBtn) {
      const key = stepBtn.closest('[data-field]').dataset.field;
      const field = COLOR_TRAP_FIELDS.find((f) => f.key === key);
      const idx = field.options.indexOf(values[key]) + Number(stepBtn.dataset.step);
      if (idx < 0 || idx >= field.options.length) return;
      values = { ...values, [key]: field.options[idx] };
      ctx.audio.playClick();
      render();
    } else if (e.target.closest('[data-start]')) {
      ctx.audio.playClick();
      const mode = colorTrapModeId(values);
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
 * Active Game (Solo Choices + Party Projector Mode)
 * ========================================================================== */
function mountGame(container, ctx, settings) {
  const isParty = settings.play === 1;
  const questions = generateColorTrapRun(ctx.rng, settings);
  const totalRounds = questions.length;
  const modeLabel =
    (matchColorTrapPreset(settings)?.label || `커스텀 ${totalRounds}문제`) + (isParty ? ' · 다같이' : '');

  let unmounted = false;
  let isPaused = false;
  let finished = false;
  let roundIndex = 0;
  let correctCount = 0;
  let wrongTaps = 0;
  let streak = 0;
  let maxStreak = 0;
  let remainingSec = settings.timeSec;
  let activePlayMs = 0;
  let cooldownUntilMs = 0;
  let partyRevealed = false;
  let lastFrameMs = performance.now();
  let lastTickWholeSec = Math.ceil(settings.timeSec);
  let rafId = 0;
  let shakeTimerId = 0;

  const root = document.createElement('div');
  root.className = `game-root game-color-trap ${isParty ? 'is-party' : 'is-solo'}`;
  root.innerHTML = `
    <div class="ct-header">
      <div class="ct-directive" data-ct-directive></div>
      <div class="ct-badges">
        <span class="ct-combo" data-ct-combo hidden>🔥 x2</span>
        <span class="ct-round-pill" data-ct-round>1 / ${totalRounds}</span>
      </div>
    </div>

    <div class="ct-stage" data-ct-stage></div>

    <div class="ct-bottom" data-ct-bottom></div>
  `;
  container.appendChild(root);

  const directiveEl = root.querySelector('[data-ct-directive]');
  const comboEl = root.querySelector('[data-ct-combo]');
  const roundPillEl = root.querySelector('[data-ct-round]');
  const stageEl = root.querySelector('[data-ct-stage]');
  const bottomEl = root.querySelector('[data-ct-bottom]');

  const partyBoard = isParty
    ? createPartyScoreboard({
        onAward: () => {
          ctx.audio.playMatch(1);
          partyRevealed = true;
          renderBottom();
        },
      })
    : null;

  function computeScore() {
    if (isParty) {
      const totalAwarded = partyBoard?.getTotalAwarded() || 0;
      return totalAwarded * 200 + roundIndex * 100;
    }
    const base = correctCount * 160;
    const streakBonus = maxStreak * 70;
    const timeBonus = roundIndex >= totalRounds ? Math.round(Math.max(0, remainingSec) * 25) : 0;
    const perfectBonus = roundIndex >= totalRounds && wrongTaps === 0 ? 400 : 0;
    return Math.max(0, base + streakBonus + timeBonus + perfectBonus - wrongTaps * 50);
  }

  function syncHud() {
    if (isParty) {
      ctx.updateHud({
        timer: { text: `${Math.min(roundIndex + 1, totalRounds)} / ${totalRounds}`, state: 'normal' },
        score: computeScore(),
        progress: `진행 ${roundIndex} / ${totalRounds}`,
        progressRatio: roundIndex / totalRounds,
        extra: '🎙️ 다같이 모드',
      });
    } else {
      ctx.updateHud({
        timer: remainingSec,
        score: computeScore(),
        progress: `${Math.min(roundIndex, totalRounds)} / ${totalRounds}`,
        progressRatio: Math.max(0, Math.min(1, remainingSec / settings.timeSec)),
        extra: streak >= 2 ? `🔥 x${streak}` : '',
      });
    }
  }

  function triggerShake() {
    stageEl?.classList.remove('is-shaking');
    void stageEl?.offsetWidth;
    stageEl?.classList.add('is-shaking');
    clearTimeout(shakeTimerId);
    shakeTimerId = window.setTimeout(() => stageEl?.classList.remove('is-shaking'), 320);
  }

  function renderStage() {
    const q = questions[roundIndex];
    if (!q) return;
    if (roundPillEl) roundPillEl.textContent = `${roundIndex + 1} / ${totalRounds}`;
    if (comboEl) {
      comboEl.hidden = streak < 2;
      comboEl.textContent = `🔥 x${streak}`;
    }

    if (q.kind === 'grid') {
      const targetHtml = `<span class="ct-target-chip" style="color:${q.targetColor.hex};background:${q.targetColor.soft};">${q.targetColor.label}</span>`;
      directiveEl.innerHTML = q.askByInk
        ? `${targetHtml} <span>색깔로 칠해진 글자는 몇 개?</span>`
        : `<span>글자 뜻이</span> ${targetHtml}<span>인 타일은 몇 개?</span>`;
      stageEl.innerHTML = `
        <div class="ct-grid-board" role="img" aria-label="3x3 컬러 트랩 타일">
          ${q.tiles
            .map(
              (t) => `
              <div class="ct-grid-tile" style="color:${t.ink.hex};">${t.word.label}</div>`
            )
            .join('')}
        </div>
      `;
    } else {
      directiveEl.innerHTML = q.askColor
        ? '<span class="ct-rule-badge is-color">🎨 글자의 색깔</span>을 말하세요!'
        : '<span class="ct-rule-badge is-word">📝 글자의 단어 뜻</span>을 말하세요!';
      stageEl.innerHTML = `
        <div class="ct-word-card">
          <span class="ct-word" style="color:${q.ink.hex};">${q.word.label}</span>
        </div>
      `;
    }
  }

  function renderBottom() {
    const q = questions[roundIndex];
    if (!q) return;

    if (!isParty) {
      bottomEl.innerHTML = `
        <div class="ct-choices" role="group" aria-label="정답 선택지">
          ${q.choices
            .map(
              (c, idx) => `
              <button type="button" class="ct-choice" data-choice="${c.id}" style="${c.hex ? `--choice-color:${c.hex};--choice-soft:${c.soft};` : ''}">
                <span class="ct-choice__key">${idx + 1}</span>
                ${c.hex ? `<span class="ct-choice__swatch" style="background:${c.hex};"></span>` : ''}
                <span class="ct-choice__label">${c.label}</span>
              </button>`
            )
            .join('')}
        </div>
        <p class="ct-hint-line">숫자키 1~4로도 선택 가능 · 오답 시 -${WRONG_PENALTY_SEC}초</p>
      `;
      return;
    }

    const ansColor = COLOR_MAP.get(q.answerId);
    const ansBadge = ansColor
      ? `<span class="ct-reveal-pill" style="color:${ansColor.hex};background:${ansColor.soft};border-color:${ansColor.hex};">${ansColor.label}</span>`
      : `<span class="ct-reveal-pill">${q.answerLabel}</span>`;

    bottomEl.innerHTML = `
      <div class="ct-party-controls">
        <div class="ct-party-answer">${partyRevealed ? `정답: ${ansBadge}` : '👀 화면을 보고 먼저 외치는 사람 승리!'}</div>
        <div class="ct-party-actions">
          <button type="button" class="ct-mc-btn ct-mc-btn--reveal" data-mc-reveal ${partyRevealed ? 'disabled' : ''}>
            ${partyRevealed ? '정답 공개됨' : '👁️ 정답 공개 (Space)'}
          </button>
          <button type="button" class="ct-mc-btn ct-mc-btn--next" data-mc-next>
            ${roundIndex + 1 >= totalRounds ? '🏁 결과 보기 (Enter)' : '다음 문제 → (Enter)'}
          </button>
        </div>
      </div>
    `;
    if (partyBoard) bottomEl.appendChild(partyBoard.el);
  }

  function renderAll() {
    renderStage();
    renderBottom();
    syncHud();
  }

  function finishGame(cleared) {
    if (finished || unmounted) return;
    finished = true;
    const totalInputs = correctCount + wrongTaps;
    const accuracy = isParty ? 100 : totalInputs > 0 ? Math.round((correctCount / totalInputs) * 100) : 0;
    const details = isParty
      ? [
          { value: `🎙️ ${roundIndex}/${totalRounds} 진행` },
          { value: partyBoard.getWinnerSummary() },
          { value: `⏱ ${(activePlayMs / 1000).toFixed(1)}초` },
        ]
      : [
          { value: `🎨 ${correctCount}/${totalRounds} 정답` },
          { value: `⏱ ${(activePlayMs / 1000).toFixed(1)}초` },
          { value: `🔥 최대 ${maxStreak}연속` },
          { value: `❌ 오답 ${wrongTaps}회` },
        ];
    ctx.completeGame({
      score: computeScore(),
      timeMs: Math.round(activePlayMs),
      accuracy,
      cleared,
      modeLabel,
      details,
    });
  }

  function handleSoloPick(choiceId) {
    if (isPaused || finished || isParty) return;
    const now = performance.now();
    if (now < cooldownUntilMs) return;
    const q = questions[roundIndex];
    if (!q) return;

    if (choiceId === q.answerId) {
      correctCount += 1;
      streak += 1;
      maxStreak = Math.max(maxStreak, streak);
      roundIndex += 1;
      ctx.audio.playMatch(streak);
      if (roundIndex >= totalRounds) {
        syncHud();
        finishGame(true);
      } else {
        renderAll();
      }
      return;
    }

    wrongTaps += 1;
    streak = 0;
    cooldownUntilMs = now + WRONG_INPUT_COOLDOWN_MS;
    remainingSec = Math.max(0, remainingSec - WRONG_PENALTY_SEC);
    ctx.audio.playError();
    triggerShake();
    syncHud();
    if (remainingSec <= 0) {
      finishGame(false);
    }
  }

  const onClick = (e) => {
    if (isPaused || finished) return;
    const choiceBtn = e.target.closest('[data-choice]');
    if (choiceBtn) {
      handleSoloPick(choiceBtn.dataset.choice);
      return;
    }
    if (isParty && e.target.closest('[data-mc-reveal]')) {
      partyRevealed = true;
      ctx.audio.playHint();
      renderBottom();
      return;
    }
    if (isParty && e.target.closest('[data-mc-next]')) {
      ctx.audio.playClick();
      roundIndex += 1;
      partyRevealed = false;
      if (roundIndex >= totalRounds) {
        finishGame(true);
      } else {
        renderAll();
      }
    }
  };

  const onKeyDown = (e) => {
    if (isPaused || finished) return;
    if (isParty) {
      if (e.code === 'Space' && !partyRevealed) {
        e.preventDefault();
        partyRevealed = true;
        ctx.audio.playHint();
        renderBottom();
      } else if (e.key === 'Enter' || e.key === 'ArrowRight') {
        e.preventDefault();
        ctx.audio.playClick();
        roundIndex += 1;
        partyRevealed = false;
        if (roundIndex >= totalRounds) finishGame(true);
        else renderAll();
      }
      return;
    }
    const idx = ['1', '2', '3', '4'].indexOf(e.key);
    if (idx !== -1) {
      const q = questions[roundIndex];
      const choice = q?.choices[idx];
      if (choice) {
        e.preventDefault();
        handleSoloPick(choice.id);
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
      if (!isParty) {
        remainingSec = Math.max(0, remainingSec - dtMs / 1000);
        const wholeSec = Math.ceil(remainingSec);
        if (wholeSec !== lastTickWholeSec) {
          lastTickWholeSec = wholeSec;
          if (wholeSec > 0 && wholeSec <= 10) ctx.audio.playTick();
        }
        syncHud();
        if (remainingSec <= 0) {
          finishGame(false);
          return;
        }
      }
    }
    rafId = requestAnimationFrame(frame);
  }

  renderAll();
  rafId = requestAnimationFrame(frame);

  return {
    unmount() {
      unmounted = true;
      if (rafId) cancelAnimationFrame(rafId);
      if (shakeTimerId) clearTimeout(shakeTimerId);
      root.removeEventListener('click', onClick);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('pm:pausechange', onPauseChange);
      partyBoard?.destroy();
      container.innerHTML = '';
    },
  };
}
