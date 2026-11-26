/**
 * Game: 도블 (DOBBLE / SPOT IT!)
 *
 * Classic projective-plane symbol matching: any two cards share EXACTLY ONE symbol.
 * Players spot the matching icon between the two circular cards (which may appear
 * at different sizes and rotations) and tap it on either card.
 *
 * Modes: `setup` (in-game settings screen), a preset id, or `custom-…`
 * (see ./dobble-settings.js). Same room seed + mode → identical deck & card sequence.
 */
import { shuffleSeeded } from '../core/seed.js';
import { WRONG_INPUT_COOLDOWN_MS } from '../core/rules.js';
import { DOBBLE_SYMBOLS } from './dobble-symbols.js';
import {
  DOBBLE_DEFAULT_PRESET,
  DOBBLE_FIELDS,
  DOBBLE_PRESETS,
  dobbleModeId,
  matchDobblePreset,
  parseDobbleMode,
} from './dobble-settings.js';

const LAST_MODE_PREF = 'dobbleLastMode';
const WRONG_PENALTY_SEC = 2.0;
const FINISH_DELAY_MS = 380;

/**
 * Generates a valid projective plane deck of order p (prime).
 * Returns N = p^2 + p + 1 cards, each with (p + 1) symbol indices in 0..N-1.
 * Every pair of distinct cards shares exactly one symbol index.
 */
export function buildProjectiveDeck(p) {
  const cards = [];
  // Card 0: [0, 1, ..., p]
  cards.push(Array.from({ length: p + 1 }, (_, i) => i));
  // Cards 1..p
  for (let i = 0; i < p; i += 1) {
    const card = [0];
    for (let j = 0; j < p; j += 1) {
      card.push(p + 1 + i * p + j);
    }
    cards.push(card);
  }
  // Cards (p+1)..(p^2+p)
  for (let a = 0; a < p; a += 1) {
    for (let b = 0; b < p; b += 1) {
      const card = [a + 1];
      for (let j = 0; j < p; j += 1) {
        card.push(p + 1 + j * p + ((a * j + b) % p));
      }
      cards.push(card);
    }
  }
  return cards;
}

/** Deterministic run generator for Dobble. */
export function generateDobbleRun(rng, settings) {
  const p = settings.symbolsPerCard - 1;
  const rawDeck = buildProjectiveDeck(p);
  const symbolPool = shuffleSeeded(rng, DOBBLE_SYMBOLS).slice(0, rawDeck.length);

  // Build shuffled card sequence so consecutive cards form rounds (like The Tower)
  const deckIndices = shuffleSeeded(
    rng,
    Array.from({ length: rawDeck.length }, (_, i) => i)
  );
  const cardSequence = [];
  let cursor = 0;
  while (cardSequence.length < settings.rounds + 1) {
    if (cursor >= deckIndices.length) {
      const reshuffled = shuffleSeeded(
        rng,
        Array.from({ length: rawDeck.length }, (_, i) => i)
      );
      if (reshuffled[0] === cardSequence[cardSequence.length - 1]) {
        const tmp = reshuffled[0];
        reshuffled[0] = reshuffled[1];
        reshuffled[1] = tmp;
      }
      deckIndices.push(...reshuffled);
    }
    cardSequence.push(deckIndices[cursor]);
    cursor += 1;
  }

  const makeSlotLayout = (count, rotate) => {
    const slots = [];
    if (count === 4) {
      const baseAngles = [Math.PI * 0.25, Math.PI * 0.75, Math.PI * 1.25, Math.PI * 1.75];
      for (const a of baseAngles) {
        const ang = a + (rng() - 0.5) * 0.22;
        const dist = 24 + rng() * 5;
        slots.push({
          x: 50 + Math.cos(ang) * dist,
          y: 50 + Math.sin(ang) * dist,
          size: rotate ? 25 + rng() * 6 : 28,
          rot: rotate ? Math.floor(rng() * 360) : 0,
        });
      }
    } else {
      // 1 center + (count - 1) outer ring slots: guaranteed zero overlap
      slots.push({
        x: 50 + (rng() - 0.5) * 4,
        y: 50 + (rng() - 0.5) * 4,
        size: rotate ? (count === 8 ? 19 + rng() * 5 : 22 + rng() * 5) : count === 8 ? 21 : 23,
        rot: rotate ? Math.floor(rng() * 360) : 0,
      });
      const outer = count - 1;
      const offset = rng() * Math.PI * 2;
      for (let i = 0; i < outer; i += 1) {
        const ang = offset + (i * Math.PI * 2) / outer + (rng() - 0.5) * 0.14;
        const dist = (count === 8 ? 31.5 : 30.5) + (rng() - 0.5) * 2.5;
        slots.push({
          x: 50 + Math.cos(ang) * dist,
          y: 50 + Math.sin(ang) * dist,
          size: rotate ? (count === 8 ? 17 + rng() * 5.5 : 20 + rng() * 5.5) : count === 8 ? 20 : 22,
          rot: rotate ? Math.floor(rng() * 360) : 0,
        });
      }
    }
    return shuffleSeeded(rng, slots);
  };

  const materializeCard = (deckIdx) => {
    const symIndices = shuffleSeeded(rng, rawDeck[deckIdx]);
    const layouts = makeSlotLayout(symIndices.length, settings.rotate === 1);
    return symIndices.map((sIdx, i) => ({
      symbol: symbolPool[sIdx],
      ...layouts[i],
    }));
  };

  const cards = cardSequence.map((idx) => materializeCard(idx));
  const rounds = [];
  for (let i = 0; i < settings.rounds; i += 1) {
    const left = cards[i];
    const right = cards[i + 1];
    const rightIds = new Set(right.map((item) => item.symbol.id));
    const match = left.find((item) => rightIds.has(item.symbol.id))?.symbol;
    rounds.push({ left, right, matchId: match.id, matchLabel: match.label });
  }
  return rounds;
}

const formatValue = (field, value) =>
  field.valueLabels ? field.valueLabels[field.options.indexOf(value)] : `${value}${field.unit}`;

function describe(s) {
  return `카드당 아이콘 ${s.symbolsPerCard}개 · ${s.rounds}라운드 · ${s.timeSec}초${s.rotate ? '' : ' · 회전 없음'}`;
}

export function mount(container, ctx) {
  const settings = parseDobbleMode(ctx.mode);
  return settings ? mountGame(container, ctx, settings) : mountSetup(container, ctx);
}

/* ============================================================================
 * Setup Screen
 * ========================================================================== */
function mountSetup(container, ctx) {
  const last = parseDobbleMode(ctx.storage.getPref?.(LAST_MODE_PREF, '') || '');
  const preset = DOBBLE_PRESETS.find((p) => p.id === DOBBLE_DEFAULT_PRESET);
  const source = last || preset;
  let values = Object.fromEntries(DOBBLE_FIELDS.map((f) => [f.key, source[f.key]]));

  const root = document.createElement('div');
  root.className = 'game-root game-dobble db-setup';
  root.innerHTML = `
    <div class="db-setup__head">
      <h2 class="db-setup__title">도블 스피드 매치 · 난이도</h2>
      <p class="db-setup__sub">두 원형 카드에 <b>딱 하나</b> 겹치는 같은 그림을 빠르게 찾으세요!</p>
    </div>
    <div class="db-setup__body">
      <div class="db-presets" role="radiogroup" aria-label="난이도 프리셋">
        ${DOBBLE_PRESETS.map(
          (p) => `
          <button type="button" class="db-preset db-preset--${p.id}" role="radio" data-preset="${p.id}">
            <span class="db-preset__name">${p.label}</span>
            <span class="db-preset__ko">${p.ko}</span>
            <span class="db-preset__meta">${p.symbolsPerCard}개/카드 · ${p.rounds}판 · ${p.timeSec}초</span>
          </button>`
        ).join('')}
      </div>
      <div class="db-fields">
        ${DOBBLE_FIELDS.map(
          (f) => `
          <div class="db-field" data-field="${f.key}">
            <span class="db-field__label">${f.label}</span>
            <div class="db-stepper">
              <button type="button" class="db-stepper__btn" data-step="-1" aria-label="${f.label} 줄이기">−</button>
              <output class="db-stepper__value" data-value></output>
              <button type="button" class="db-stepper__btn" data-step="1" aria-label="${f.label} 늘리기">+</button>
            </div>
          </div>`
        ).join('')}
        <p class="db-fields__summary" data-summary></p>
      </div>
    </div>
    <button type="button" class="db-setup__start" data-start>시작하기 <span aria-hidden="true">→</span></button>
  `;
  container.appendChild(root);

  function render() {
    const match = matchDobblePreset(values);
    root.querySelectorAll('[data-preset]').forEach((btn) => {
      const on = match?.id === btn.dataset.preset;
      btn.classList.toggle('is-active', on);
      btn.setAttribute('aria-checked', String(on));
    });
    for (const f of DOBBLE_FIELDS) {
      const row = root.querySelector(`[data-field="${f.key}"]`);
      const idx = f.options.indexOf(values[f.key]);
      row.querySelector('[data-value]').textContent = formatValue(f, values[f.key]);
      row.querySelector('[data-step="-1"]').disabled = idx <= 0;
      row.querySelector('[data-step="1"]').disabled = idx >= f.options.length - 1;
    }
    root.querySelector('[data-summary]').textContent = `${match ? `${match.label} · ` : '커스텀 · '}${describe(values)}`;
  }

  const onClick = (e) => {
    const presetBtn = e.target.closest('[data-preset]');
    const stepBtn = e.target.closest('[data-step]');
    if (presetBtn) {
      const p = DOBBLE_PRESETS.find((x) => x.id === presetBtn.dataset.preset);
      values = Object.fromEntries(DOBBLE_FIELDS.map((f) => [f.key, p[f.key]]));
      ctx.audio.playClick();
      render();
    } else if (stepBtn) {
      const key = stepBtn.closest('[data-field]').dataset.field;
      const field = DOBBLE_FIELDS.find((f) => f.key === key);
      const idx = field.options.indexOf(values[key]) + Number(stepBtn.dataset.step);
      if (idx < 0 || idx >= field.options.length) return;
      values = { ...values, [key]: field.options[idx] };
      ctx.audio.playClick();
      render();
    } else if (e.target.closest('[data-start]')) {
      ctx.audio.playClick();
      const mode = dobbleModeId(values);
      ctx.storage.setPref?.(LAST_MODE_PREF, mode);
      ctx.switchMode(mode);
    }
  };
  root.addEventListener('click', onClick);
  render();
  ctx.updateHud({ timer: { text: '--:--', state: 'normal' }, score: 0, progress: '난이도 설정', progressRatio: 1 });
  root.querySelector('[data-start]')?.focus({ preventScroll: true });

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
  const rounds = generateDobbleRun(ctx.rng, settings);
  const totalRounds = rounds.length;
  const modeLabel = matchDobblePreset(settings)?.label || `커스텀 ${settings.symbolsPerCard}개×${totalRounds}판`;

  let unmounted = false;
  let isPaused = false;
  let finished = false;
  let roundIndex = 0;
  let wrongTaps = 0;
  let streak = 0;
  let maxStreak = 0;
  let remainingSec = settings.timeSec;
  let activePlayMs = 0;
  let cooldownUntilMs = 0;
  let lastFrameMs = performance.now();
  let lastTickWholeSec = Math.ceil(settings.timeSec);
  let rafId = 0;
  let finishTimerId = 0;
  let shakeTimerId = 0;

  const root = document.createElement('div');
  root.className = 'game-root game-dobble';
  root.innerHTML = `
    <div class="db-header">
      <div class="db-header__status" data-db-status>두 카드에서 겹치는 같은 그림 1개를 터치하세요!</div>
      <div class="db-header__badges">
        <span class="db-combo" data-db-combo hidden>🔥 x2</span>
        <span class="db-round-pill" data-db-round>1 / ${totalRounds}</span>
      </div>
    </div>

    <div class="db-arena" data-db-arena>
      <div class="db-card-wrap">
        <span class="db-card-label">내 카드</span>
        <div class="db-card" data-db-card="left" aria-label="내 도블 카드"></div>
      </div>
      <div class="db-vs" aria-hidden="true">⚡</div>
      <div class="db-card-wrap">
        <span class="db-card-label">중앙 카드</span>
        <div class="db-card" data-db-card="right" aria-label="중앙 도블 카드"></div>
      </div>
    </div>

    <div class="db-footer">
      <span>어느 카드의 그림을 눌러도 인정됩니다 · 오답 시 -${WRONG_PENALTY_SEC}초</span>
    </div>
  `;
  container.appendChild(root);

  const statusEl = root.querySelector('[data-db-status]');
  const comboEl = root.querySelector('[data-db-combo]');
  const roundPillEl = root.querySelector('[data-db-round]');
  const arenaEl = root.querySelector('[data-db-arena]');
  const leftCardEl = root.querySelector('[data-db-card="left"]');
  const rightCardEl = root.querySelector('[data-db-card="right"]');

  function computeScore() {
    const perMatch = settings.symbolsPerCard === 8 ? 300 : settings.symbolsPerCard === 6 ? 240 : 180;
    const cleared = roundIndex >= totalRounds;
    const base = roundIndex * perMatch;
    const timeBonus = cleared ? Math.round(Math.max(0, remainingSec) * 60) : 0;
    const streakBonus = maxStreak * 80;
    const perfectBonus = cleared && wrongTaps === 0 ? 500 : 0;
    return Math.max(0, base + timeBonus + streakBonus + perfectBonus - wrongTaps * 60);
  }

  function syncHud() {
    ctx.updateHud({
      timer: remainingSec,
      score: computeScore(),
      progress: `${Math.min(roundIndex, totalRounds)} / ${totalRounds}`,
      progressRatio: Math.max(0, Math.min(1, remainingSec / settings.timeSec)),
      extra: streak >= 2 ? `🔥 x${streak}` : '',
    });
  }

  function renderCard(el, items) {
    el.innerHTML = items
      .map(
        (item) => `
        <button
          type="button"
          class="db-sym"
          data-sym="${item.symbol.id}"
          aria-label="${item.symbol.label}"
          style="left:${item.x.toFixed(2)}%;top:${item.y.toFixed(2)}%;width:${item.size.toFixed(2)}%;height:${item.size.toFixed(2)}%;transform:translate(-50%,-50%) rotate(${item.rot}deg);"
        >
          <svg viewBox="0 0 64 64" aria-hidden="true">${item.symbol.svg}</svg>
        </button>`
      )
      .join('');
  }

  function renderRound() {
    if (roundIndex >= totalRounds) return;
    const round = rounds[roundIndex];
    renderCard(leftCardEl, round.left);
    renderCard(rightCardEl, round.right);
    if (roundPillEl) roundPillEl.textContent = `${roundIndex + 1} / ${totalRounds}`;
  }

  function setStatus(text, tone = 'info') {
    if (!statusEl) return;
    statusEl.textContent = text;
    statusEl.dataset.tone = tone;
  }

  function updateComboUi() {
    if (!comboEl) return;
    if (streak >= 2) {
      comboEl.hidden = false;
      comboEl.textContent = `🔥 x${streak} COMBO`;
    } else {
      comboEl.hidden = true;
    }
  }

  function triggerShake() {
    arenaEl?.classList.remove('is-shaking');
    void arenaEl?.offsetWidth;
    arenaEl?.classList.add('is-shaking');
    clearTimeout(shakeTimerId);
    shakeTimerId = window.setTimeout(() => {
      arenaEl?.classList.remove('is-shaking');
    }, 340);
  }

  function finishGame(cleared) {
    if (finished || unmounted) return;
    finished = true;
    const totalInputs = roundIndex + wrongTaps;
    const accuracy = totalInputs > 0 ? Math.round((roundIndex / totalInputs) * 100) : 0;
    ctx.completeGame({
      score: computeScore(),
      timeMs: Math.round(activePlayMs),
      accuracy,
      cleared,
      modeLabel,
      details: [
        { value: `🎯 ${roundIndex}/${totalRounds} 매치` },
        { value: `⏱ ${(activePlayMs / 1000).toFixed(1)}초` },
        { value: `🔥 최대 ${maxStreak}연속` },
        { value: `❌ 오답 ${wrongTaps}회` },
      ],
    });
  }

  const onCardClick = (e) => {
    if (isPaused || finished) return;
    const btn = e.target.closest('[data-sym]');
    if (!btn) return;
    const now = performance.now();
    if (now < cooldownUntilMs) return;

    const round = rounds[roundIndex];
    if (!round) return;

    const pickedId = btn.dataset.sym;
    if (pickedId === round.matchId) {
      streak += 1;
      maxStreak = Math.max(maxStreak, streak);
      roundIndex += 1;
      ctx.audio.playMatch(streak);
      updateComboUi();
      setStatus(`✨ 「${round.matchLabel}」 일치!${streak >= 2 ? ` (${streak}연속)` : ''}`, 'success');
      syncHud();

      if (roundIndex >= totalRounds) {
        finished = true;
        if (roundPillEl) roundPillEl.textContent = `${totalRounds} / ${totalRounds}`;
        root.querySelectorAll(`[data-sym="${pickedId}"]`).forEach((el) => el.classList.add('is-matched'));
        finishTimerId = window.setTimeout(() => {
          if (unmounted) return;
          finished = false;
          finishGame(true);
        }, FINISH_DELAY_MS);
      } else {
        renderRound();
      }
      return;
    }

    // Wrong symbol
    wrongTaps += 1;
    streak = 0;
    cooldownUntilMs = now + WRONG_INPUT_COOLDOWN_MS;
    remainingSec = Math.max(0, remainingSec - WRONG_PENALTY_SEC);
    ctx.audio.playError();
    updateComboUi();
    triggerShake();
    setStatus(`❌ 그 그림은 양쪽에 없어요! (-${WRONG_PENALTY_SEC}초)`, 'error');
    syncHud();

    if (remainingSec <= 0) {
      finishGame(false);
    }
  };

  root.addEventListener('click', onCardClick);

  const onPauseChange = (e) => {
    isPaused = Boolean(e.detail?.paused);
    if (!isPaused) {
      lastFrameMs = performance.now();
    }
  };
  window.addEventListener('pm:pausechange', onPauseChange);

  function frame(nowMs) {
    if (unmounted) return;
    const dtMs = Math.max(0, Math.min(120, nowMs - lastFrameMs));
    lastFrameMs = nowMs;

    if (!isPaused && !finished) {
      activePlayMs += dtMs;
      remainingSec = Math.max(0, remainingSec - dtMs / 1000);
      const wholeSec = Math.ceil(remainingSec);
      if (wholeSec !== lastTickWholeSec) {
        lastTickWholeSec = wholeSec;
        if (wholeSec > 0 && wholeSec <= 10) {
          ctx.audio.playTick();
        }
      }
      syncHud();
      if (remainingSec <= 0) {
        finishGame(false);
        return;
      }
    }
    rafId = requestAnimationFrame(frame);
  }

  renderRound();
  syncHud();
  rafId = requestAnimationFrame(frame);

  return {
    unmount() {
      unmounted = true;
      if (rafId) cancelAnimationFrame(rafId);
      if (finishTimerId) clearTimeout(finishTimerId);
      if (shakeTimerId) clearTimeout(shakeTimerId);
      root.removeEventListener('click', onCardClick);
      window.removeEventListener('pm:pausechange', onPauseChange);
      container.innerHTML = '';
    },
  };
}
