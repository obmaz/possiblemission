/**
 * Game: 플래시 암산 (FLASH ANZAN)
 *
 * Numbers flash one at a time in the same spot; the player keeps a running total
 * and types the sum. A brief blank separates numbers, so a repeated number still
 * reads as two flashes. Same room seed + same settings → same numbers for everyone.
 *
 * Modes: `setup` (in-game settings screen), a preset id, or `custom-…`
 * (see ./flash-anzan-settings.js). All timing runs on the game clock, so the
 * shell's pause (and its start countdown) freezes everything.
 */
import { ANZAN_DEFAULT_PRESET, ANZAN_FIELDS, ANZAN_PRESETS, anzanModeId, matchAnzanPreset, parseAnzanMode } from './flash-anzan-settings.js';
import { renderPlayModeSwitch } from './party-kit.js';

const READY_SEC = 1.1; // "문제 2 / 5" card before each problem
const FLASH_ON_RATIO = 0.72; // share of each interval the number is visible (rest is blank)
const FEEDBACK_SEC = 2.2;
const LAST_MODE_PREF = 'anzanLastMode';
const MAX_ANSWER_DIGITS = 7;

/** Deterministic problems for a seed: no two neighbours are equal. */
export function generateAnzanRun(rng, settings) {
  const min = settings.digits === 1 ? 1 : 10 ** (settings.digits - 1);
  const max = 10 ** settings.digits - 1;
  return Array.from({ length: settings.problems }, () => {
    const numbers = [];
    while (numbers.length < settings.count) {
      const n = min + Math.floor(rng() * (max - min + 1));
      if (n !== numbers[numbers.length - 1]) numbers.push(n);
    }
    return { numbers, total: numbers.reduce((a, b) => a + b, 0) };
  });
}

/** Points for one correct answer: more digits, more numbers and faster flashes pay more. */
const basePoints = (s) => Math.round((60 * s.digits * s.count) / Math.sqrt(s.intervalSec));

const formatValue = (field, value) =>
  field.valueLabels ? field.valueLabels[field.options.indexOf(value)] : `${value}${field.unit}`;

function describe(s) {
  const playTxt = s.play === 1 ? '다같이 한 화면 진행' : '혼자 합계 입력';
  return `${playTxt} · ${s.digits}자리 숫자 ${s.count}개가 ${s.intervalSec}초 간격으로 나타납니다 · ${s.problems}문제`;
}

/**
 * @param {HTMLElement} container
 * @param {object} ctx
 */
export function mount(container, ctx) {
  const settings = parseAnzanMode(ctx.mode);
  return settings ? mountGame(container, ctx, settings) : mountSetup(container, ctx);
}

/* ============================================================================
 * Setup screen
 * ========================================================================== */
function mountSetup(container, ctx) {
  const last = parseAnzanMode(ctx.storage.getPref?.(LAST_MODE_PREF, '') || '');
  const preset = ANZAN_PRESETS.find((p) => p.id === ANZAN_DEFAULT_PRESET);
  const source = last || { ...preset, play: 0 };
  let values = Object.fromEntries(ANZAN_FIELDS.map((f) => [f.key, source[f.key]]));

  const root = document.createElement('div');
  root.className = 'game-root game-anzan fa-setup';
  root.innerHTML = `
    <div class="fa-setup__head">
      <h2 class="fa-setup__title">플래시 암산 · 난이도</h2>
      <p class="fa-setup__sub">숫자가 하나씩 번쩍입니다. 머릿속으로 더해서 <b>합계</b>를 맞히세요.</p>
    </div>
    ${renderPlayModeSwitch(values.play, 'fa', {
      label: ANZAN_FIELDS[0].valueLabels[0],
      desc: '직접 합계를 입력해 맞히기',
    })}
    <div class="fa-setup__body">
      <div class="fa-presets" role="radiogroup" aria-label="난이도 프리셋">
        ${ANZAN_PRESETS.map(
          (p) => `
          <button type="button" class="fa-preset fa-preset--${p.id}" role="radio" data-preset="${p.id}">
            <span class="fa-preset__name">${p.label}</span>
            <span class="fa-preset__ko">${p.ko}</span>
            <span class="fa-preset__meta">${p.digits}자리 × ${p.count}개 · ${p.intervalSec}초</span>
          </button>`
        ).join('')}
      </div>
      <div class="fa-fields">
        ${ANZAN_FIELDS.map(
          (f) => `
          <div class="fa-field" data-field="${f.key}">
            <span class="fa-field__label">${f.label}</span>
            <div class="fa-stepper">
              <button type="button" class="fa-stepper__btn" data-step="-1" aria-label="${f.label} 줄이기">−</button>
              <output class="fa-stepper__value" data-value></output>
              <button type="button" class="fa-stepper__btn" data-step="1" aria-label="${f.label} 늘리기">+</button>
            </div>
          </div>`
        ).join('')}
        <p class="fa-fields__summary" data-summary></p>
      </div>
    </div>
    <button type="button" class="fa-setup__start" data-start>시작하기 <span aria-hidden="true">→</span></button>
  `;
  container.appendChild(root);

  function render() {
    const match = matchAnzanPreset(values);
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
    for (const f of ANZAN_FIELDS) {
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
      const p = ANZAN_PRESETS.find((x) => x.id === presetBtn.dataset.preset);
      values = { ...values, digits: p.digits, count: p.count, intervalSec: p.intervalSec, problems: p.problems };
      ctx.audio.playClick();
      render();
    } else if (stepBtn) {
      const key = stepBtn.closest('[data-field]').dataset.field;
      const field = ANZAN_FIELDS.find((f) => f.key === key);
      const idx = field.options.indexOf(values[key]) + Number(stepBtn.dataset.step);
      if (idx < 0 || idx >= field.options.length) return;
      values = { ...values, [key]: field.options[idx] };
      ctx.audio.playClick();
      render();
    } else if (e.target.closest('[data-start]')) {
      ctx.audio.playClick();
      const mode = anzanModeId(values);
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
  const isParty = settings.play === 1;
  const problems = generateAnzanRun(ctx.rng, settings);
  const points = basePoints(settings);

  const root = document.createElement('div');
  root.className = `game-root game-anzan ${isParty ? 'is-party' : ''}`;
  root.innerHTML = `
    <div class="fa-stage" data-stage>
      <p class="fa-counter" data-counter></p>
      <div class="fa-number" data-number aria-live="off"></div>
      <p class="fa-caption" data-caption></p>
    </div>
    <form class="fa-answer" data-answer hidden autocomplete="off">
      <p class="fa-answer__title">합계를 입력하세요</p>
      <input class="fa-answer__input" data-input inputmode="numeric" maxlength="${MAX_ANSWER_DIGITS}" placeholder="?" aria-label="합계 입력" />
      <div class="fa-keypad">
        ${['7', '8', '9', '4', '5', '6', '1', '2', '3', '⌫', '0', 'C']
          .map((k) => `<button type="button" class="fa-key" data-key="${k}">${k}</button>`)
          .join('')}
      </div>
      <button type="submit" class="fa-answer__ok">확인</button>
    </form>
    <div class="fa-party-panel" data-party-panel hidden>
      <p class="fa-party-panel__status" data-party-status>👀 가장 먼저 합계를 외치는 사람 승리!</p>
      <div class="fa-party-panel__actions">
        <button type="button" class="fa-mc-btn" data-mc-reveal>👁️ 정답 공개 (Space)</button>
        <button type="button" class="fa-mc-btn fa-mc-btn--next" data-mc-next>다음 문제 → (Enter)</button>
      </div>
    </div>
  `;
  container.appendChild(root);

  const stageEl = root.querySelector('[data-stage]');
  const counterEl = root.querySelector('[data-counter]');
  const numberEl = root.querySelector('[data-number]');
  const captionEl = root.querySelector('[data-caption]');
  const answerForm = root.querySelector('[data-answer]');
  const answerInput = root.querySelector('[data-input]');
  const partyPanel = root.querySelector('[data-party-panel]');
  const partyStatusEl = root.querySelector('[data-party-status]');
  const mcRevealBtn = root.querySelector('[data-mc-reveal]');
  const mcNextBtn = root.querySelector('[data-mc-next]');
  const finePointer = !window.matchMedia?.('(pointer: coarse)').matches;
  // On touch screens the on-screen keypad replaces the native keyboard
  if (!finePointer) answerInput.readOnly = true;

  let problemIdx = 0;
  let phase = 'ready'; // ready | flash | answer | feedback | ended
  let phaseClock = 0;
  let activeMs = 0;
  let answerStartMs = 0;
  let answerTimeMs = 0;
  let correctCount = 0;
  let score = 0;
  let streak = 0;
  let shownIdx = -1;
  let partyRevealed = false;
  let isPaused = false;
  let finished = false;
  let unmounted = false;
  let rafId = 0;
  let lastTs = performance.now();

  const problem = () => problems[problemIdx];

  function syncHud() {
    ctx.updateHud({
      timer: { text: `${problemIdx + 1} / ${problems.length}`, state: 'normal' },
      score: isParty ? problemIdx * 200 : score,
      progress: isParty ? `진행 ${problemIdx} / ${problems.length}` : `정답 ${correctCount}`,
      progressRatio: problemIdx / problems.length,
      extra: isParty ? '🎙️ 다같이 모드' : '',
    });
  }

  function setStage(counter, number, caption, tone = '') {
    counterEl.textContent = counter;
    numberEl.textContent = number;
    captionEl.textContent = caption;
    stageEl.dataset.tone = tone;
  }

  function enter(next) {
    phase = next;
    phaseClock = 0;
    if (next === 'ready') {
      shownIdx = -1;
      partyRevealed = false;
      answerForm.hidden = true;
      partyPanel.hidden = true;
      stageEl.hidden = false;
      setStage(`문제 ${problemIdx + 1} / ${problems.length}`, '준비', describe(settings), 'ready');
    } else if (next === 'flash') {
      partyPanel.hidden = true;
      setStage('', '', '');
    } else if (next === 'answer') {
      answerStartMs = activeMs;
      if (isParty) {
        stageEl.hidden = false;
        answerForm.hidden = true;
        partyPanel.hidden = false;
        if (mcRevealBtn) mcRevealBtn.disabled = false;
        if (mcNextBtn) mcNextBtn.textContent = problemIdx + 1 >= problems.length ? '🏁 결과 보기 (Enter)' : '다음 문제 → (Enter)';
        if (partyStatusEl) partyStatusEl.textContent = '👀 가장 먼저 합계를 외치는 사람 승리!';
        setStage(`문제 ${problemIdx + 1} / ${problems.length}`, '?', '먼저 합계를 외치세요!', 'ready');
      } else {
        stageEl.hidden = true;
        partyPanel.hidden = true;
        answerForm.hidden = false;
        answerInput.value = '';
        if (finePointer) answerInput.focus({ preventScroll: true });
      }
    }
    syncHud();
  }

  function revealPartyAnswer() {
    if (!isParty || phase !== 'answer' || partyRevealed) return;
    partyRevealed = true;
    ctx.audio.playMatch(1);
    if (mcRevealBtn) mcRevealBtn.disabled = true;
    if (partyStatusEl) partyStatusEl.textContent = '정답이 공개되었습니다!';
    setStage(
      '정답 공개!',
      problem().total.toLocaleString('en-US'),
      problem().numbers.map((n) => n.toLocaleString('en-US')).join(' + '),
      'correct'
    );
  }

  function advancePartyProblem() {
    if (!isParty || phase !== 'answer') return;
    ctx.audio.playClick();
    problemIdx += 1;
    if (problemIdx >= problems.length) finish();
    else enter('ready');
  }

  function finish() {
    if (finished) return;
    finished = true;
    phase = 'ended';
    const accuracy = isParty ? 100 : Math.round((correctCount / problems.length) * 100);
    ctx.completeGame({
      score: isParty ? problems.length * 200 : score,
      timeMs: Math.round(activeMs),
      accuracy,
      // Clearing means getting at least 60% of the problems right
      cleared: isParty ? true : correctCount >= Math.ceil(problems.length * 0.6),
      details: isParty
        ? [
            { value: `🎙️ ${problems.length}문제 진행` },
            { value: `⏱ ${(activeMs / 1000).toFixed(1)}초` },
            { value: `🔢 ${settings.digits}자리 × ${settings.count}개` },
            { value: `⚡ ${settings.intervalSec}초 간격` },
          ]
        : [
            { value: `🧮 ${correctCount}/${problems.length} 정답` },
            { value: `⏱ 평균 ${(answerTimeMs / problems.length / 1000).toFixed(1)}초` },
            { value: `🔢 ${settings.digits}자리 × ${settings.count}개` },
            { value: `⚡ ${settings.intervalSec}초 간격` },
          ],
    });
  }

  function submit() {
    if (phase !== 'answer' || isPaused || finished) return;
    const raw = answerInput.value.trim();
    if (!/^\d+$/.test(raw)) {
      answerInput.classList.remove('is-shake');
      void answerInput.offsetWidth;
      answerInput.classList.add('is-shake');
      return;
    }
    const took = activeMs - answerStartMs;
    answerTimeMs += took;
    const ok = Number(raw) === problem().total;
    if (ok) {
      correctCount += 1;
      streak += 1;
      // Quick answers earn up to +50%
      const speedBonus = Math.round(points * 0.5 * Math.max(0, 1 - took / 10000));
      score += points + speedBonus + (streak >= 2 ? 50 * Math.min(streak, 5) : 0);
      ctx.audio.playMatch(streak);
    } else {
      streak = 0;
      ctx.audio.playError();
    }
    answerForm.hidden = true;
    stageEl.hidden = false;
    setStage(
      ok ? '정답!' : `오답 · 입력 ${Number(raw).toLocaleString('en-US')}`,
      problem().total.toLocaleString('en-US'),
      problem().numbers.map((n) => n.toLocaleString('en-US')).join(' + '),
      ok ? 'correct' : 'wrong'
    );
    phase = 'feedback';
    phaseClock = 0;
    syncHud();
  }

  function step(now) {
    if (unmounted) return;
    rafId = requestAnimationFrame(step);
    const dt = Math.min(0.05, Math.max(0, (now - lastTs) / 1000));
    lastTs = now;
    if (isPaused || finished) return;
    activeMs += dt * 1000;
    phaseClock += dt;

    if (phase === 'ready' && phaseClock >= READY_SEC) {
      enter('flash');
    } else if (phase === 'flash') {
      const { numbers } = problem();
      const idx = Math.floor(phaseClock / settings.intervalSec);
      if (idx >= numbers.length) {
        enter('answer');
        return;
      }
      const within = phaseClock - idx * settings.intervalSec;
      const visible = within < settings.intervalSec * FLASH_ON_RATIO;
      if (visible && idx !== shownIdx) {
        shownIdx = idx;
        ctx.audio.playTick();
      }
      setStage(`${idx + 1} / ${numbers.length}`, visible ? numbers[idx].toLocaleString('en-US') : '', '');
    } else if (phase === 'feedback' && phaseClock >= FEEDBACK_SEC) {
      problemIdx += 1;
      if (problemIdx >= problems.length) finish();
      else enter('ready');
    }
  }

  // --- Input -------------------------------------------------------------------------
  const onSubmit = (e) => {
    e.preventDefault();
    submit();
  };
  const onKeypad = (e) => {
    const key = e.target.closest('[data-key]')?.dataset.key;
    if (!key || phase !== 'answer') return;
    ctx.audio.playClick();
    if (key === '⌫') answerInput.value = answerInput.value.slice(0, -1);
    else if (key === 'C') answerInput.value = '';
    else if (answerInput.value.length < MAX_ANSWER_DIGITS) answerInput.value += key;
    if (finePointer) answerInput.focus({ preventScroll: true });
  };
  const onInput = () => {
    answerInput.value = answerInput.value.replace(/\D/g, '').slice(0, MAX_ANSWER_DIGITS);
  };
  const onPause = (e) => {
    isPaused = Boolean(e.detail?.paused);
    if (!isPaused) lastTs = performance.now();
  };

  const onPartyClick = (e) => {
    if (!isParty || isPaused || finished) return;
    if (e.target.closest('[data-mc-reveal]')) revealPartyAnswer();
    else if (e.target.closest('[data-mc-next]')) advancePartyProblem();
  };
  const onPartyKey = (e) => {
    if (!isParty || isPaused || finished) return;
    if (e.code === 'Space') {
      e.preventDefault();
      if (phase === 'answer' && !partyRevealed) revealPartyAnswer();
    } else if (phase === 'answer' && (e.key === 'Enter' || e.key === 'ArrowRight')) {
      e.preventDefault();
      advancePartyProblem();
    }
  };

  answerForm.addEventListener('submit', onSubmit);
  answerForm.addEventListener('click', onKeypad);
  answerInput.addEventListener('input', onInput);
  partyPanel.addEventListener('click', onPartyClick);
  window.addEventListener('keydown', onPartyKey);
  window.addEventListener('pm:pausechange', onPause);

  enter('ready');
  rafId = requestAnimationFrame(step);

  return {
    unmount() {
      unmounted = true;
      cancelAnimationFrame(rafId);
      answerForm.removeEventListener('submit', onSubmit);
      answerForm.removeEventListener('click', onKeypad);
      answerInput.removeEventListener('input', onInput);
      partyPanel.removeEventListener('click', onPartyClick);
      window.removeEventListener('keydown', onPartyKey);
      window.removeEventListener('pm:pausechange', onPause);
      container.innerHTML = '';
    },
  };
}
