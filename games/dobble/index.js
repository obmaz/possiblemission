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
import { bindClock, bindScore } from '../../js/core/clock.js';
import { shuffleSeeded } from '../../js/core/seed.js';
import { mountSetupScreen } from '../../js/core/setup-screen.js';
import { WRONG_INPUT_COOLDOWN_MS } from '../../js/core/rules.js';
import { DOBBLE_SYMBOLS } from './symbols.js';
import {
  DOBBLE_DEFAULT_PRESET,
  DOBBLE_FIELDS,
  DOBBLE_PRESETS,
  dobbleModeId,
  matchDobblePreset,
  parseDobbleMode,
} from './settings.js';

const LAST_MODE_PREF = 'dobbleLastMode';
const WRONG_PENALTY_SEC = 2.0;
const FINISH_DELAY_MS = 380;

/**
 * Finite field GF(q) arithmetic supporting prime orders and prime powers q=8, 9, 16.
 * Allows valid projective-plane Dobble decks for 4, 6, 8, 9, 10, 12, 14, 17, 18 icons/card.
 */
function makeField(q) {
  if (q === 8 || q === 16) {
    const poly = q === 8 ? 0b1011 : 0b10011; // x^3+x+1 / x^4+x+1 over GF(2)
    return {
      add: (a, b) => a ^ b,
      mul: (a, b) => {
        let res = 0;
        let x = a;
        let y = b;
        while (y > 0) {
          if (y & 1) res ^= x;
          x <<= 1;
          if (x & q) x ^= poly;
          y >>= 1;
        }
        return res;
      },
    };
  }
  if (q === 9) {
    // Elements 0..8 represent a + b*i over GF(3) with i^2 = -1 = 2 (mod 3)
    return {
      add: (x, y) => {
        const a = (x % 3) + (y % 3);
        const b = Math.floor(x / 3) + Math.floor(y / 3);
        return (a % 3) + (b % 3) * 3;
      },
      mul: (x, y) => {
        const a = x % 3;
        const b = Math.floor(x / 3);
        const c = y % 3;
        const d = Math.floor(y / 3);
        const re = (((a * c - b * d) % 3) + 3) % 3;
        const im = (a * d + b * c) % 3;
        return re + im * 3;
      },
    };
  }
  return {
    add: (a, b) => (a + b) % q,
    mul: (a, b) => (a * b) % q,
  };
}

/**
 * Generates a valid projective plane deck of prime-power order q.
 * Returns N = q^2 + q + 1 cards, each with (q + 1) symbol indices in 0..N-1.
 * Every pair of distinct cards shares exactly one symbol index.
 */
export function buildProjectiveDeck(q) {
  const F = makeField(q);
  const cards = [];
  // Card 0: [0, 1, ..., q]
  cards.push(Array.from({ length: q + 1 }, (_, i) => i));
  // Cards 1..q
  for (let i = 0; i < q; i += 1) {
    const card = [0];
    for (let j = 0; j < q; j += 1) {
      card.push(q + 1 + i * q + j);
    }
    cards.push(card);
  }
  // Cards (q+1)..(q^2+q)
  for (let a = 0; a < q; a += 1) {
    for (let b = 0; b < q; b += 1) {
      const card = [a + 1];
      for (let j = 0; j < q; j += 1) {
        card.push(q + 1 + j * q + F.add(F.mul(a, j), b));
      }
      cards.push(card);
    }
  }
  return cards;
}

/** Deterministic run generator for Dobble. Always includes KRRI & KTX featured symbols. */
export function generateDobbleRun(rng, settings) {
  const q = settings.symbolsPerCard - 1;
  const rawDeck = buildProjectiveDeck(q);
  const featured = DOBBLE_SYMBOLS.filter((s) => s.featured);
  const others = shuffleSeeded(
    rng,
    DOBBLE_SYMBOLS.filter((s) => !s.featured)
  );
  const symbolPool = shuffleSeeded(rng, [...featured, ...others].slice(0, rawDeck.length));

  // Consecutive cards of one shuffled sequence form the rounds
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
    if (count <= 8) {
      // 1 center + (count - 1) outer ring slots
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
    } else {
      // 10, 12, 14, 17 icons: 1 center + inner ring + outer ring with zero overlap
      const ringSpec =
        count <= 10
          ? { inner: 3, outer: count - 4, rIn: 20, rOut: 37, baseSize: 16.5 }
          : count <= 12
            ? { inner: 4, outer: count - 5, rIn: 20, rOut: 37.5, baseSize: 15.2 }
            : count <= 14
              ? { inner: 4, outer: count - 5, rIn: 19.5, rOut: 38, baseSize: 14.0 }
              : { inner: 5, outer: count - 6, rIn: 19, rOut: 38.5, baseSize: 12.6 };

      const jitterSize = () =>
        rotate ? ringSpec.baseSize * (0.86 + rng() * 0.24) : ringSpec.baseSize;

      slots.push({
        x: 50 + (rng() - 0.5) * 2.5,
        y: 50 + (rng() - 0.5) * 2.5,
        size: jitterSize() * 1.08,
        rot: rotate ? Math.floor(rng() * 360) : 0,
      });

      const inOffset = rng() * Math.PI * 2;
      for (let i = 0; i < ringSpec.inner; i += 1) {
        const ang = inOffset + (i * Math.PI * 2) / ringSpec.inner + (rng() - 0.5) * 0.12;
        const dist = ringSpec.rIn + (rng() - 0.5) * 1.4;
        slots.push({
          x: 50 + Math.cos(ang) * dist,
          y: 50 + Math.sin(ang) * dist,
          size: jitterSize(),
          rot: rotate ? Math.floor(rng() * 360) : 0,
        });
      }

      const outOffset = inOffset + Math.PI / ringSpec.outer;
      for (let i = 0; i < ringSpec.outer; i += 1) {
        const ang = outOffset + (i * Math.PI * 2) / ringSpec.outer + (rng() - 0.5) * 0.08;
        const dist = ringSpec.rOut + (rng() - 0.5) * 1.2;
        slots.push({
          x: 50 + Math.cos(ang) * dist,
          y: 50 + Math.sin(ang) * dist,
          size: jitterSize(),
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

function describe(s) {
  return `카드당 아이콘 ${s.symbolsPerCard}개 · ${s.rounds}라운드 · ${s.timeSec}초${s.rotate ? '' : ' · 회전 없음'}`;
}

export function mount(container, ctx) {
  const settings = parseDobbleMode(ctx.mode);
  return settings ? mountGame(container, ctx, settings) : mountSetup(container, ctx);
}

function mountSetup(container, ctx) {
  return mountSetupScreen(container, ctx, {
    gameId: 'dobble',
    title: '도블 스피드 매치 · 난이도',
    intro: '두 원형 카드에 <b>딱 하나</b> 겹치는 같은 그림을 빠르게 찾으세요!',
    fields: DOBBLE_FIELDS,
    presets: DOBBLE_PRESETS,
    defaultPreset: DOBBLE_DEFAULT_PRESET,
    presetMeta: (p) => `${p.symbolsPerCard}개/카드 · ${p.rounds}판 · ${p.timeSec}초`,
    describe,
    parseMode: parseDobbleMode,
    modeId: dobbleModeId,
    matchPreset: matchDobblePreset,
    prefKey: LAST_MODE_PREF,
  });
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
        <span class="pm-score" data-pm-score></span>
        <span class="pm-timer" data-pm-timer></span>
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
  const setTimer = bindClock(root.querySelector('[data-pm-timer]'));
  const setScore = bindScore(root.querySelector('[data-pm-score]'));
  const leftCardEl = root.querySelector('[data-db-card="left"]');
  const rightCardEl = root.querySelector('[data-db-card="right"]');

  function computeScore() {
    const perMatch = Math.round(settings.symbolsPerCard * 38);
    const cleared = roundIndex >= totalRounds;
    const base = roundIndex * perMatch;
    const timeBonus = cleared ? Math.round(Math.max(0, remainingSec) * 60) : 0;
    const streakBonus = maxStreak * 80;
    const perfectBonus = cleared && wrongTaps === 0 ? 500 : 0;
    return Math.max(0, base + timeBonus + streakBonus + perfectBonus - wrongTaps * 60);
  }

  function syncStatus() {
    setTimer(remainingSec);
    setScore(computeScore());
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
    ctx.completeGame({
      score: computeScore(),
      timeMs: Math.round(activePlayMs),
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
      syncStatus();

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
    syncStatus();

    if (remainingSec <= 0) {
      finishGame(false);
    }
  };

  root.addEventListener('click', onCardClick);

  const offPause = ctx.onPause((paused) => {
    isPaused = paused;
    if (!paused) lastFrameMs = performance.now();
  });

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
      syncStatus();
      if (remainingSec <= 0) {
        finishGame(false);
        return;
      }
    }
    rafId = requestAnimationFrame(frame);
  }

  renderRound();
  syncStatus();
  rafId = requestAnimationFrame(frame);

  return {
    unmount() {
      unmounted = true;
      if (rafId) cancelAnimationFrame(rafId);
      if (finishTimerId) clearTimeout(finishTimerId);
      if (shakeTimerId) clearTimeout(shakeTimerId);
      root.removeEventListener('click', onCardClick);
      offPause();
    },
  };
}
