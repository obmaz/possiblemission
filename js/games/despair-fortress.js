/**
 * Game 4: 후지큐 하이랜드 절망요새 숨바꼭질 (DESPAIR FORTRESS)
 * Implements mount(container, ctx) -> { unmount() } contract.
 * Also exports pure deterministic generator generateFortressRun(rng, mode) for verification.
 */

const ALPHABET = 'ABCDEFGHIJ'.split('');
const MAX_SHIELDS = 3;
const FIRST_LOCK_ON_DURATION = 1.8;
const LOCK_ON_DURATION = 0.8;
const BLACKOUT_DURATION = 0.35;
const DECODE_LIMIT = 15.0;
const WRONG_COOLDOWN_MS = 450;
const SECTOR_CLEAR_PAUSE = 1.05;
const FAIL_OVERLAY_PAUSE = 0.75;

const STANDARD_SECTORS = [
  {
    sector: 1,
    code: 'SECTOR 01',
    label: '제1구역: 외곽 격납고',
    nodeCount: 6,
    memorizeSec: 4.2,
    decodeSec: DECODE_LIMIT,
    movement: 'hover',
    speedMin: 0,
    speedMax: 0,
    basePts: 400,
    decoy: false,
  },
  {
    sector: 2,
    code: 'SECTOR 02',
    label: '제2구역: 중앙 제어실',
    nodeCount: 8,
    memorizeSec: 4.5,
    decodeSec: DECODE_LIMIT,
    movement: 'drift',
    speedMin: 58,
    speedMax: 76,
    basePts: 550,
    decoy: false,
  },
  {
    sector: 3,
    code: 'SECTOR 03',
    label: '제3구역: 절대 영점 금고',
    nodeCount: 10,
    memorizeSec: 4.8,
    decodeSec: DECODE_LIMIT,
    movement: 'drift',
    speedMin: 88,
    speedMax: 116,
    basePts: 700,
    decoy: true,
  },
];

function shuffleWithRng(rng, list) {
  const arr = Array.from(list);
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
  return arr;
}

function mirrorNumber(numStr) {
  return numStr[1] + numStr[0];
}

/**
 * Picks `count` unique 2-digit codes ('03'..'98') with zero mirror-pair collisions.
 */
function pickUniqueSectorNumbers(rng, count) {
  const pool = [];
  for (let n = 3; n <= 98; n += 1) {
    const str = String(n).padStart(2, '0');
    // Skip identical double digits like 11, 22 so mirror rules and visual contrast stay crisp
    if (str[0] === str[1]) continue;
    pool.push(str);
  }
  const shuffled = shuffleWithRng(rng, pool);
  const picked = [];
  const forbidden = new Set();

  for (const numStr of shuffled) {
    if (picked.length >= count) break;
    if (forbidden.has(numStr)) continue;
    picked.push(numStr);
    forbidden.add(numStr);
    forbidden.add(mirrorNumber(numStr));
  }
  return picked;
}

/**
 * Generates collision-free normalized coordinates inside [0.09..0.91] x [0.26..0.88],
 * reserving a safe top header band for telemetry/banners and ensuring vertical pixel spacing >= 2*r.
 */
function generateNonOverlappingCoords(rng, count) {
  const padX = 0.09;
  const padTop = 0.26;
  const padBottom = 0.12;
  const minDistX = count <= 6 ? 0.20 : count <= 8 ? 0.175 : 0.155;
  const minDistY = count <= 6 ? 0.225 : count <= 8 ? 0.21 : 0.198;

  const cols = count <= 6 ? 3 : count <= 8 ? 4 : 5;
  const rows = Math.ceil(count / cols);
  const cellW = (1 - padX * 2) / cols;
  const cellH = (1 - padTop - padBottom) / rows;

  const cells = [];
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      cells.push({ r, c });
    }
  }
  const chosenCells = shuffleWithRng(rng, cells).slice(0, count);

  const pts = chosenCells.map(({ r, c }) => ({
    x: padX + (c + 0.25 + rng() * 0.5) * cellW,
    y: padTop + (r + 0.25 + rng() * 0.5) * cellH,
  }));

  // Deterministic anisotropic relaxation so vertical spacing stays >= 2*r on wide & compact arenas
  for (let iter = 0; iter < 56; iter += 1) {
    for (let i = 0; i < pts.length; i += 1) {
      for (let j = i + 1; j < pts.length; j += 1) {
        const dx = (pts[j].x - pts[i].x) / minDistX;
        const dy = (pts[j].y - pts[i].y) / minDistY;
        const normDist = Math.hypot(dx, dy) || 0.001;
        if (normDist < 1) {
          const push = (1 - normDist) * 0.52;
          const nx = dx / normDist;
          const ny = dy / normDist;
          pts[i].x -= nx * push * minDistX;
          pts[i].y -= ny * push * minDistY;
          pts[j].x += nx * push * minDistX;
          pts[j].y += ny * push * minDistY;
        }
      }
      pts[i].x = Math.max(padX, Math.min(1 - padX, pts[i].x));
      pts[i].y = Math.max(padTop, Math.min(1 - padBottom, pts[i].y));
    }
  }

  return pts;
}

/**
 * Pure deterministic run generator for Despair Fortress.
 * Exported so unit/sanity tests can verify determinism, non-overlap, and mirror rules.
 * @param {() => number} rng
 * @param {string} [mode='standard']
 */
export function generateFortressRun(rng, mode = 'standard') {
  void mode;
  const sectorConfigs = STANDARD_SECTORS;

  return sectorConfigs.map((cfg) => {
    const letters = ALPHABET.slice(0, cfg.nodeCount);
    const numbers = pickUniqueSectorNumbers(rng, cfg.nodeCount);
    const coords = generateNonOverlappingCoords(rng, cfg.nodeCount);
    const letterOrder = shuffleWithRng(rng, letters);

    const nodes = letterOrder.map((letter, idx) => {
      const angle = rng() * Math.PI * 2;
      const speed =
        cfg.movement === 'drift'
          ? cfg.speedMin + rng() * (cfg.speedMax - cfg.speedMin)
          : 0;

      return {
        letter,
        number: numbers[idx],
        anchorX: coords[idx].x,
        anchorY: coords[idx].y,
        x: coords[idx].x,
        y: coords[idx].y,
        angle,
        speed,
        phase: rng() * Math.PI * 2,
        solved: false,
      };
    });

    // Pick 3 distinct target nodes in sequence
    const targetNodes = shuffleWithRng(rng, nodes).slice(0, 3);
    const targets = targetNodes.map((n) => ({
      number: n.number,
      letter: n.letter,
      solved: false,
    }));

    // Deterministic decoy candidates strictly from non-target nodes (never flash true answers)
    const targetLetterSet = new Set(targets.map((t) => t.letter));
    const nonTargetLetters = nodes
      .filter((n) => !targetLetterSet.has(n.letter))
      .map((n) => n.letter);
    const decoyLetters = shuffleWithRng(rng, nonTargetLetters).slice(0, 2);

    // Fake telemetry number guaranteed not to collide with any real node number in this sector
    const existingNumbers = new Set(nodes.map((n) => n.number));
    const fakePool = [];
    for (let n = 10; n <= 98; n += 1) {
      const str = String(n);
      if (!existingNumbers.has(str)) {
        fakePool.push(str);
      }
    }
    const decoyFakeCode = fakePool[Math.floor(rng() * fakePool.length)] || '99';

    return {
      ...cfg,
      nodes,
      targets,
      decoyLetters,
      decoyFakeCode,
    };
  });
}

/**
 * Mounts the Despair Fortress game inside `container` (#game-stage).
 * @param {HTMLElement} container
 * @param {object} ctx
 * @returns {{ unmount: () => void }}
 */
export function mount(container, ctx) {
  const modeLabel = '3구역 탈출';
  const sectors = generateFortressRun(ctx.rng, ctx.mode);
  const totalSectors = sectors.length;
  const totalSlots = totalSectors * 3;
  const maxLetters = sectors[sectors.length - 1].nodeCount;

  const root = document.createElement('div');
  root.className = 'game-root game-fortress';

  root.innerHTML = `
    <section class="df-terminal" aria-label="절망요새 보안 터미널">
      <div class="df-terminal__top">
        <div class="df-sector-info">
          <span class="df-sector-badge">
            <span class="df-sector-dot" aria-hidden="true"></span>
            <span data-df-sector-code>SECTOR 01/${String(totalSectors).padStart(2, '0')}</span>
          </span>
          <span class="df-sector-name" data-df-sector-label>제1구역: 외곽 격납고</span>
        </div>

        <div class="df-status-group">
          <div class="df-shields" data-df-shields aria-label="남은 쉴드"></div>
          <span class="df-streak-pill" data-df-streak hidden>x0 COMBO</span>
        </div>
      </div>

      <div class="df-terminal__codebar">
        <div class="df-code-sequence">
          <span class="df-code-label">TARGET CODE</span>
          <div class="df-slots" data-df-slots></div>
        </div>

        <div class="df-phase-controls">
          <span class="df-phase-pill" data-df-phase data-phase="lockon">LOCK-ON</span>
          <button type="button" class="df-skip-btn" data-df-skip hidden>
            ⚡ 암기 완료 (스킵)
          </button>
        </div>
      </div>

      <div class="df-timer-track" aria-hidden="true">
        <div class="df-timer-fill" data-df-timer-fill style="--df-bar: 1;"></div>
      </div>
    </section>

    <section class="df-arena" data-df-arena>
      <img
        class="df-arena__bg"
        src="./assets/images/fortress-bg.jpg"
        alt="절망요새 보안 금고 배경"
        draggable="false"
      />
      <div class="df-arena__vignette" aria-hidden="true"></div>
      <div class="df-arena__scanlines" aria-hidden="true"></div>

      <div class="df-arena-hud" data-df-arena-hud>
        <div class="df-telemetry" aria-hidden="true">
          <span class="df-telemetry__tag" data-df-telemetry-left>VAULT LOCKDOWN // LIVE</span>
          <span class="df-telemetry__tag df-telemetry__tag--decoy" data-df-decoy-hud hidden>FAKE: --</span>
        </div>
        <div class="df-banner" data-df-banner hidden></div>
      </div>

      <canvas class="df-canvas" data-df-canvas></canvas>
      <div class="df-emp-flash" data-df-emp aria-hidden="true"></div>

      <div class="df-sector-overlay" data-df-overlay hidden>
        <div class="df-sector-card" data-df-overlay-card>
          <p class="df-sector-card__eyebrow" data-df-overlay-sub>SECTOR BREACHED</p>
          <h2 class="df-sector-card__title" data-df-overlay-title>보안 해독 완료!</h2>
          <p class="df-sector-card__bonus" data-df-overlay-bonus>+0 PTS</p>
        </div>
      </div>
    </section>

    <section class="df-keypad-wrap" aria-label="알파벳 전술 키패드">
      <div class="df-keypad-meta">
        <span class="df-keypad-hint" data-df-keypad-hint>노드가 잠금 중입니다...</span>
        <span class="df-keypad-keys-hint">키보드 A–${ALPHABET[maxLetters - 1]} 또는 화면 노드 직접 터치</span>
      </div>
      <div class="df-keypad" data-df-keypad></div>
    </section>
  `;

  container.appendChild(root);

  // Cached DOM references
  const terminalEl = root.querySelector('.df-terminal');
  const sectorCodeEl = root.querySelector('[data-df-sector-code]');
  const sectorLabelEl = root.querySelector('[data-df-sector-label]');
  const shieldsEl = root.querySelector('[data-df-shields]');
  const streakEl = root.querySelector('[data-df-streak]');
  const slotsEl = root.querySelector('[data-df-slots]');
  const phasePillEl = root.querySelector('[data-df-phase]');
  const skipBtn = root.querySelector('[data-df-skip]');
  const timerFillEl = root.querySelector('[data-df-timer-fill]');
  const arenaEl = root.querySelector('[data-df-arena]');
  const arenaHudEl = root.querySelector('[data-df-arena-hud]');
  const canvas = root.querySelector('[data-df-canvas]');
  const telemetryLeftEl = root.querySelector('[data-df-telemetry-left]');
  const decoyHudEl = root.querySelector('[data-df-decoy-hud]');
  const bannerEl = root.querySelector('[data-df-banner]');
  const empFlashEl = root.querySelector('[data-df-emp]');
  const overlayEl = root.querySelector('[data-df-overlay]');
  const overlayCardEl = root.querySelector('[data-df-overlay-card]');
  const overlaySubEl = root.querySelector('[data-df-overlay-sub]');
  const overlayTitleEl = root.querySelector('[data-df-overlay-title]');
  const overlayBonusEl = root.querySelector('[data-df-overlay-bonus]');
  const keypadHintEl = root.querySelector('[data-df-keypad-hint]');
  const keypadEl = root.querySelector('[data-df-keypad]');

  const gCtx = canvas.getContext('2d');

  // Build tactile A-J (or A-L) keypad buttons once
  const keyButtons = new Map();
  for (let i = 0; i < maxLetters; i += 1) {
    const letter = ALPHABET[i];
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'df-key';
    btn.dataset.letter = letter;
    btn.textContent = letter;
    btn.disabled = true;
    btn.addEventListener('click', () => handleLetterGuess(letter, 'keypad'));
    keypadEl.appendChild(btn);
    keyButtons.set(letter, btn);
  }

  // Runtime state
  let sectorIdx = 0;
  let phase = 'lockon'; // 'lockon' | 'memorize' | 'blackout' | 'decode' | 'sector_clear' | 'ended'
  let phaseElapsed = 0;
  let decodeElapsed = 0;
  let activeTimeMs = 0;
  let lastFrameTs = performance.now();
  let rafId = 0;
  let isPaused = false;
  let finished = false;
  let unmounted = false;

  let shields = MAX_SHIELDS;
  let score = 0;
  let streak = 0;
  let maxStreak = 0;
  let solvedSlots = 0;
  let sectorsCleared = 0;
  let totalInputs = 0;
  let correctInputs = 0;
  let activeSlotIdx = 0;
  let lastWrongAt = -Infinity;
  let lastTickStep = -1;
  let decoyPulseTimer = 0;
  let decoyHudTimer = 0;
  let decoyWindowTriggered = false;
  let nextDecodeDecoyAt = 2.4;
  let overlayDelayTimer = 0;
  let pendingOverlayAction = null; // null | 'next_sector' | 'win' | 'fail'

  // Arena canvas dimensions (CSS px)
  let arenaW = 640;
  let arenaH = 360;
  let dpr = 1;

  // Ephemeral visual bursts on canvas
  const bursts = [];
  const nodeFlash = new Map(); // letter -> { color, until }
  const activeTimers = new Set();

  function safeTimeout(fn, ms) {
    const id = window.setTimeout(() => {
      activeTimers.delete(id);
      if (!unmounted && !finished) fn();
    }, ms);
    activeTimers.add(id);
    return id;
  }

  function currentSector() {
    return sectors[sectorIdx];
  }

  function getLockOnDuration(sec) {
    return sec.sector === 1 ? FIRST_LOCK_ON_DURATION : LOCK_ON_DURATION;
  }

  function getNodeRadiusPx() {
    return Math.max(22, Math.min(38, Math.min(arenaW, arenaH) * 0.088));
  }

  function getTopClearancePx() {
    const hudBottom = arenaHudEl
      ? arenaHudEl.offsetTop + arenaHudEl.offsetHeight
      : 58;
    const minReserve = Math.min(Math.round(arenaH * 0.24), arenaW <= 480 ? 58 : 66);
    const maxAllowed = Math.max(28, Math.round(arenaH * 0.30));
    return Math.min(maxAllowed, Math.max(minReserve, hudBottom + 8));
  }

  function getArenaBounds(r) {
    const minX = r + 12;
    const maxX = Math.max(minX + 10, arenaW - r - 12);
    const minY = r + getTopClearancePx();
    const maxY = Math.max(minY + 10, arenaH - r - 12);
    return { minX, maxX, minY, maxY };
  }

  function resolveNodeOverlapPx(sec) {
    if (!sec || !arenaW || !arenaH) return;
    const r = getNodeRadiusPx();
    const { minX, maxX, minY, maxY } = getArenaBounds(r);
    const minSep = r * 2 + 10;

    const pts = sec.nodes.map((n) => ({
      node: n,
      px: Math.max(minX, Math.min(maxX, n.x * arenaW)),
      py: Math.max(minY, Math.min(maxY, n.y * arenaH)),
    }));

    for (let iter = 0; iter < 24; iter += 1) {
      for (let i = 0; i < pts.length; i += 1) {
        for (let j = i + 1; j < pts.length; j += 1) {
          const a = pts[i];
          const b = pts[j];
          const dx = b.px - a.px;
          const dy = b.py - a.py;
          const dist = Math.hypot(dx, dy) || 0.01;
          if (dist < minSep) {
            const overlap = (minSep - dist) * 0.52;
            const nx = dx / dist;
            const ny = dy / dist;
            a.px -= nx * overlap;
            a.py -= ny * overlap;
            b.px += nx * overlap;
            b.py += ny * overlap;
          }
        }
        pts[i].px = Math.max(minX, Math.min(maxX, pts[i].px));
        pts[i].py = Math.max(minY, Math.min(maxY, pts[i].py));
      }
    }

    for (const item of pts) {
      item.node.x = item.px / arenaW;
      item.node.y = item.py / arenaH;
      if (sec.movement === 'hover') {
        item.node.anchorX = item.node.x;
        item.node.anchorY = item.node.y;
      }
    }
  }

  function resizeCanvas() {
    if (!arenaEl || !canvas) return;
    const rect = arenaEl.getBoundingClientRect();
    const nextW = rect.width > 0 ? Math.max(1, Math.round(rect.width)) : arenaW;
    const nextH = rect.height > 0 ? Math.max(1, Math.round(rect.height)) : arenaH;
    const nextDpr = Math.min(window.devicePixelRatio || 1, 2);
    const nextCw = Math.floor(nextW * nextDpr);
    const nextCh = Math.floor(nextH * nextDpr);

    const changed =
      nextW !== arenaW ||
      nextH !== arenaH ||
      nextDpr !== dpr ||
      canvas.width !== nextCw ||
      canvas.height !== nextCh;

    arenaW = nextW;
    arenaH = nextH;
    dpr = nextDpr;

    if (changed) {
      canvas.width = nextCw;
      canvas.height = nextCh;
      if (phase === 'lockon') {
        resolveNodeOverlapPx(currentSector());
      }
    }
  }

  function initSectorVelocities(sec) {
    if (sec.movement !== 'drift') return;
    for (const node of sec.nodes) {
      node.vx = Math.cos(node.angle) * node.speed;
      node.vy = Math.sin(node.angle) * node.speed;
    }
  }

  function spawnBurst(nx, ny, color, count = 14) {
    for (let i = 0; i < count; i += 1) {
      const ang = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.35;
      const spd = 65 + Math.random() * 145;
      bursts.push({
        x: nx * arenaW,
        y: ny * arenaH,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd,
        r: 2.5 + Math.random() * 3,
        color,
        life: 0.45 + Math.random() * 0.25,
        maxLife: 0.7,
      });
    }
  }

  function showBanner(text, tone = 'info') {
    if (!bannerEl) return;
    if (!text) {
      bannerEl.hidden = true;
      return;
    }
    bannerEl.textContent = text;
    bannerEl.dataset.tone = tone;
    bannerEl.hidden = false;
  }

  function renderShields() {
    if (!shieldsEl) return;
    shieldsEl.innerHTML = '';
    for (let i = 0; i < MAX_SHIELDS; i += 1) {
      const span = document.createElement('span');
      span.className = `df-shield-heart ${i >= shields ? 'is-lost' : ''}`;
      span.textContent = i < shields ? '♥' : '♡';
      shieldsEl.appendChild(span);
    }
  }

  function renderStreak() {
    if (!streakEl) return;
    if (streak >= 2) {
      streakEl.hidden = false;
      streakEl.textContent = `x${streak} COMBO`;
    } else {
      streakEl.hidden = true;
    }
  }

  function renderSlots(errorIdx = -1) {
    const sec = currentSector();
    slotsEl.innerHTML = '';
    const revealNumbers = phase === 'decode' || phase === 'sector_clear';

    sec.targets.forEach((t, idx) => {
      if (idx > 0) {
        const arrow = document.createElement('span');
        arrow.className = 'df-slot-arrow';
        arrow.textContent = '→';
        slotsEl.appendChild(arrow);
      }

      const slot = document.createElement('div');
      slot.className = 'df-slot';

      if (!revealNumbers) {
        slot.classList.add('is-masked');
        slot.textContent = '??';
      } else if (t.solved) {
        slot.classList.add('is-solved');
        slot.innerHTML = `<span>${t.number}</span><span class="df-slot__letter">${t.letter}</span>`;
      } else {
        if (idx === activeSlotIdx) {
          slot.classList.add('is-active');
        }
        if (idx === errorIdx) {
          slot.classList.add('is-error');
        }
        slot.textContent = t.number;
      }

      slotsEl.appendChild(slot);
    });
  }

  function syncKeypad() {
    const sec = currentSector();
    const canInput = phase === 'decode' && !isPaused && !finished;
    const nodeMap = new Map(sec.nodes.map((n) => [n.letter, n]));

    const desktopCols = sec.nodeCount <= 10 ? sec.nodeCount : 6;
    const mobileCols = sec.nodeCount === 6 ? 3 : sec.nodeCount === 8 || sec.nodeCount === 12 ? 4 : 5;
    keypadEl.style.setProperty('--df-cols', String(desktopCols));
    keypadEl.style.setProperty('--df-cols-mobile', String(mobileCols));

    keyButtons.forEach((btn, letter) => {
      const node = nodeMap.get(letter);
      if (!node) {
        btn.disabled = true;
        btn.hidden = true;
        btn.classList.remove('is-solved', 'is-wrong');
        return;
      }
      btn.hidden = false;
      btn.classList.toggle('is-solved', node.solved);
      btn.disabled = !canInput || node.solved;
    });
  }

  function syncSharedHud(timerValue, progressRatio) {
    const heartsStr = `${'♥'.repeat(shields)}${'♡'.repeat(MAX_SHIELDS - shields)}`;
    const extraLabel = streak >= 2 ? `${heartsStr} · x${streak}` : `쉴드 ${heartsStr}`;

    ctx.updateHud({
      timer: timerValue,
      score,
      progress: `SECTOR ${sectorIdx + 1}/${totalSectors}`,
      progressRatio,
      extra: extraLabel,
    });
  }

  function enterPhase(nextPhase) {
    phase = nextPhase;
    phaseElapsed = 0;
    const sec = currentSector();

    if (nextPhase === 'lockon') {
      activeSlotIdx = 0;
      lastTickStep = -1;
      decoyPulseTimer = 0;
      decoyHudTimer = 0;
      decoyWindowTriggered = false;
      nextDecodeDecoyAt = 2.2;
      initSectorVelocities(sec);

      sectorCodeEl.textContent = `${sec.code}/${String(totalSectors).padStart(2, '0')}`;
      sectorLabelEl.textContent = sec.label;
      telemetryLeftEl.textContent = `${sec.code} // NODES: ${sec.nodeCount}`;
      decoyHudEl.hidden = true;
      overlayEl.hidden = true;
      skipBtn.hidden = true;
      phasePillEl.dataset.phase = 'lockon';
      phasePillEl.textContent = 'LOCK-ON';
      if (sec.sector === 1) {
        keypadHintEl.textContent = '곧 보안 코드가 나타납니다! 각 노드의 [알파벳 + 숫자]를 외우세요';
        showBanner('숫자-알파벳을 외운 뒤, 타겟 숫자 3개의 알파벳을 순서대로 입력!', 'info');
      } else {
        keypadHintEl.textContent = '보안 노드 위치 스캔 중...';
        showBanner(`${sec.label} — 보안 코드 출현 준비!`, 'info');
      }
      renderSlots();
      syncKeypad();
      resolveNodeOverlapPx(sec);
      syncSharedHud({ text: 'READY', state: 'normal' }, 1);
    } else if (nextPhase === 'memorize') {
      skipBtn.hidden = false;
      phasePillEl.dataset.phase = 'memorize';
      phasePillEl.textContent = `암기 ${sec.memorizeSec.toFixed(1)}s`;
      keypadHintEl.textContent = '숫자와 알파벳 짝을 기억하세요! (Space로 스킵 가능)';
      showBanner('숫자 출현! 알파벳과 번호를 암기하세요!', 'warn');
      timerFillEl.dataset.mode = 'memorize';
      renderSlots();
      syncKeypad();
    } else if (nextPhase === 'blackout') {
      skipBtn.hidden = true;
      phasePillEl.dataset.phase = 'blackout';
      phasePillEl.textContent = 'BLACKOUT';
      keypadHintEl.textContent = '숫자 소멸! 타겟 코드 수신 중...';
      showBanner('숫자 소멸! 알파벳 위치만 남습니다!', 'danger');
      ctx.audio.playTick();
      if (empFlashEl) {
        empFlashEl.classList.remove('is-active');
        void empFlashEl.offsetWidth;
        empFlashEl.classList.add('is-active');
      }
      for (const n of sec.nodes) {
        spawnBurst(n.x, n.y, '#ef4444', 8);
      }
      renderSlots();
      syncKeypad();
    } else if (nextPhase === 'decode') {
      decodeElapsed = 0;
      phasePillEl.dataset.phase = 'decode';
      phasePillEl.textContent = '해독 중';
      timerFillEl.dataset.mode = 'normal';
      const targetNum = sec.targets[activeSlotIdx]?.number || '--';
      keypadHintEl.textContent = `타겟 [${targetNum}] 에 해당하는 알파벳을 선택하세요!`;
      showBanner('', 'info');
      renderSlots();
      syncKeypad();
    } else if (nextPhase === 'sector_clear') {
      skipBtn.hidden = true;
      decoyHudEl.hidden = true;
      decoyHudTimer = 0;
      arenaEl.classList.remove('is-glitch');
      phasePillEl.dataset.phase = 'decode';
      phasePillEl.textContent = 'BREACHED';
      syncKeypad();
    }
  }

  function triggerShake(wrongLetter) {
    terminalEl.classList.remove('is-shake');
    arenaEl.classList.remove('is-shake');
    void terminalEl.offsetWidth;
    terminalEl.classList.add('is-shake');
    arenaEl.classList.add('is-shake');

    if (wrongLetter) {
      const btn = keyButtons.get(wrongLetter);
      if (btn) {
        btn.classList.add('is-wrong');
        safeTimeout(() => btn.classList.remove('is-wrong'), 380);
      }
      nodeFlash.set(wrongLetter, { color: '#ef4444', until: performance.now() + 420 });
    }
  }

  function completeRun(cleared) {
    if (finished) return;
    finished = true;
    phase = 'ended';
    skipBtn.hidden = true;
    syncKeypad();

    if (cleared) {
      const survivalBonus = shields * 400;
      score += survivalBonus;
    }

    const accuracy = totalInputs > 0 ? Math.round((correctInputs / totalInputs) * 100) : 0;
    const heartsText = `${'♥'.repeat(shields)}${'♡'.repeat(MAX_SHIELDS - shields)}`;

    ctx.completeGame({
      score,
      timeMs: Math.round(activeTimeMs),
      accuracy,
      cleared,
      modeLabel,
      details: [
        { label: '돌파 구역', value: `${sectorsCleared} / ${totalSectors} SECTOR` },
        { label: '해독 코드', value: `${solvedSlots} / ${totalSlots} (${accuracy}%)` },
        { label: '최고 콤보', value: `${maxStreak} COMBO` },
        { label: '남은 쉴드', value: heartsText },
      ],
    });
  }

  function handleDecodeFail(reasonTitle, reasonSub) {
    if (finished) return;
    phase = 'ended';
    ctx.audio.playAlarm();
    decoyHudEl.hidden = true;
    overlayCardEl.classList.add('is-fail');
    overlaySubEl.textContent = reasonSub;
    overlayTitleEl.textContent = reasonTitle;
    overlayBonusEl.textContent = `최종 점수 ${score.toLocaleString('en-US')} PTS`;
    overlayEl.hidden = false;

    const id = window.setTimeout(() => {
      activeTimers.delete(id);
      if (!unmounted) completeRun(false);
    }, 750);
    activeTimers.add(id);
  }

  function handleSectorCleared() {
    const sec = currentSector();
    sectorsCleared += 1;
    const remainingSec = Math.max(0, sec.decodeSec - decodeElapsed);
    const fastBonus = Math.round(remainingSec * 80);
    score += fastBonus;

    enterPhase('sector_clear');
    ctx.audio.playMatch(6);

    const isFinal = sectorIdx >= totalSectors - 1;
    const survivalBonus = isFinal ? shields * 400 : 0;

    overlayCardEl.classList.remove('is-fail');
    overlaySubEl.textContent = `${sec.code} BREACHED!`;
    overlayTitleEl.textContent = isFinal ? '절망요새 완전 탈출!' : `${sec.label} 돌파!`;
    overlayBonusEl.textContent = isFinal
      ? `스피드 +${fastBonus} · 생존 +${survivalBonus} PTS`
      : `스피드 보너스 +${fastBonus} PTS`;
    overlayEl.hidden = false;

    syncSharedHud(remainingSec, 1);

    safeTimeout(() => {
      overlayEl.hidden = true;
      if (isFinal) {
        completeRun(true);
      } else {
        sectorIdx += 1;
        enterPhase('lockon');
      }
    }, SECTOR_CLEAR_PAUSE * 1000);
  }

  function handleLetterGuess(letter, source = 'canvas') {
    if (finished || isPaused || phase !== 'decode') return;
    const now = performance.now();
    if (now - lastWrongAt < WRONG_COOLDOWN_MS) return;

    const sec = currentSector();
    const node = sec.nodes.find((n) => n.letter === letter);
    if (!node || node.solved) return;

    const target = sec.targets[activeSlotIdx];
    if (!target) return;

    totalInputs += 1;

    if (node.letter === target.letter) {
      // Correct!
      correctInputs += 1;
      solvedSlots += 1;
      node.solved = true;
      target.solved = true;
      streak += 1;
      if (streak > maxStreak) maxStreak = streak;

      const streakBonus = streak >= 2 ? 60 * Math.min(streak, 9) : 0;
      score += sec.basePts + streakBonus;

      ctx.audio.playMatch(streak);
      spawnBurst(node.x, node.y, '#34d399', 18);
      nodeFlash.set(letter, { color: '#34d399', until: now + 450 });

      renderStreak();
      activeSlotIdx += 1;
      renderSlots();
      syncKeypad();
      syncSharedHud(Math.max(0, sec.decodeSec - decodeElapsed), Math.max(0, 1 - decodeElapsed / sec.decodeSec));

      if (activeSlotIdx >= sec.targets.length) {
        handleSectorCleared();
      } else {
        const nextNum = sec.targets[activeSlotIdx].number;
        keypadHintEl.textContent = `정답! 다음 타겟 [${nextNum}] 의 알파벳을 선택하세요!`;
        showBanner(`[${target.number} = ${letter}] 해독 성공!`, 'success');
        safeTimeout(() => {
          if (phase === 'decode') showBanner('', 'info');
        }, 700);
      }
    } else {
      // Wrong!
      lastWrongAt = now;
      shields = Math.max(0, shields - 1);
      streak = 0;

      ctx.audio.playError();
      spawnBurst(node.x, node.y, '#ef4444', 12);
      triggerShake(letter);
      renderShields();
      renderStreak();
      renderSlots(activeSlotIdx);
      syncSharedHud(Math.max(0, sec.decodeSec - decodeElapsed), Math.max(0, 1 - decodeElapsed / sec.decodeSec));

      if (shields <= 0) {
        handleDecodeFail('쉴드 소진! 요새 봉쇄', 'SECURITY LOCKDOWN // ACCESS DENIED');
      } else {
        showBanner(`ACCESS DENIED — 재시도! (${source === 'keyboard' ? letter : '오답'})`, 'danger');
        safeTimeout(() => {
          if (phase === 'decode') showBanner('', 'info');
        }, 850);
      }
    }
  }

  // Normalized [0..1, 0..1] pointer hit-testing on canvas with +0.012 touch slop
  function handleCanvasPointerDown(e) {
    if (finished || isPaused || phase !== 'decode') return;
    if (e.button !== undefined && e.button !== 0 && e.pointerType === 'mouse') return;

    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    const nx = (e.clientX - rect.left) / rect.width;
    const ny = (e.clientY - rect.top) / rect.height;
    const touchSlop = e.pointerType === 'touch' ? 0.012 : 0;
    const minDim = Math.min(rect.width, rect.height);
    const visualNormR = getNodeRadiusPx() / minDim;
    const hitNormR = Math.max(0.048, visualNormR) + touchSlop;
    const aspect = rect.width / rect.height;

    const sec = currentSector();
    let bestNode = null;
    let bestDist = Infinity;

    for (const node of sec.nodes) {
      if (node.solved) continue;
      // Aspect-corrected normalized distance relative to shorter dimension
      const dx = (nx - node.x) * (aspect >= 1 ? aspect : 1);
      const dy = (ny - node.y) * (aspect < 1 ? 1 / aspect : 1);
      const dist = Math.hypot(dx, dy);
      if (dist <= hitNormR && dist < bestDist) {
        bestDist = dist;
        bestNode = node;
      }
    }

    if (bestNode) {
      handleLetterGuess(bestNode.letter, 'canvas');
    }
  }

  function handleKeyDown(e) {
    if (finished || isPaused) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;

    if (phase === 'memorize' && (e.code === 'Space' || e.key === ' ')) {
      e.preventDefault();
      ctx.audio.playClick();
      enterPhase('blackout');
      return;
    }

    if (phase !== 'decode') return;
    const key = String(e.key || '').toUpperCase();
    if (key.length === 1 && key >= 'A' && key <= ALPHABET[maxLetters - 1]) {
      e.preventDefault();
      handleLetterGuess(key, 'keyboard');
    }
  }

  function handleSkipClick() {
    if (finished || isPaused || phase !== 'memorize') return;
    ctx.audio.playClick();
    enterPhase('blackout');
  }

  function handlePauseChange(e) {
    isPaused = Boolean(e.detail?.paused);
    if (!isPaused) {
      lastFrameTs = performance.now();
    }
    syncKeypad();
  }

  function updatePhysics(dt) {
    const sec = currentSector();
    const r = getNodeRadiusPx();
    const minX = r + 12;
    const maxX = Math.max(minX + 10, arenaW - r - 12);
    const minY = r + 14;
    const maxY = Math.max(minY + 10, arenaH - r - 14);
    const minSep = r * 2 + 12;

    if (sec.movement === 'hover') {
      for (const node of sec.nodes) {
        const px = node.anchorX * arenaW + Math.cos(activeTimeMs * 0.002 + node.phase) * 5;
        const py = node.anchorY * arenaH + Math.sin(activeTimeMs * 0.0024 + node.phase) * 5;
        node.x = Math.max(minX, Math.min(maxX, px)) / arenaW;
        node.y = Math.max(minY, Math.min(maxY, py)) / arenaH;
      }
      return;
    }

    // Drift mode (Sector 2 & 3 & 4): pixel-space motion + wall bounce + pairwise elastic separation
    const pxNodes = sec.nodes.map((n) => ({
      node: n,
      px: n.x * arenaW,
      py: n.y * arenaH,
    }));

    for (const item of pxNodes) {
      item.px += item.node.vx * dt;
      item.py += item.node.vy * dt;

      if (item.px < minX) {
        item.px = minX;
        item.node.vx = Math.abs(item.node.vx);
      } else if (item.px > maxX) {
        item.px = maxX;
        item.node.vx = -Math.abs(item.node.vx);
      }

      if (item.py < minY) {
        item.py = minY;
        item.node.vy = Math.abs(item.node.vy);
      } else if (item.py > maxY) {
        item.py = maxY;
        item.node.vy = -Math.abs(item.node.vy);
      }
    }

    // Pairwise separation passes so nodes NEVER overlap
    for (let pass = 0; pass < 2; pass += 1) {
      for (let i = 0; i < pxNodes.length; i += 1) {
        for (let j = i + 1; j < pxNodes.length; j += 1) {
          const a = pxNodes[i];
          const b = pxNodes[j];
          const dx = b.px - a.px;
          const dy = b.py - a.py;
          const dist = Math.hypot(dx, dy) || 0.01;
          if (dist < minSep) {
            const nx = dx / dist;
            const ny = dy / dist;
            const overlap = (minSep - dist) * 0.52;
            a.px -= nx * overlap;
            a.py -= ny * overlap;
            b.px += nx * overlap;
            b.py += ny * overlap;

            // Elastic velocity exchange along collision normal
            const dvx = a.node.vx - b.node.vx;
            const dvy = a.node.vy - b.node.vy;
            const rel = dvx * nx + dvy * ny;
            if (rel > 0) {
              a.node.vx -= rel * nx;
              a.node.vy -= rel * ny;
              b.node.vx += rel * nx;
              b.node.vy += rel * ny;
            }
          }
        }
      }
    }

    for (const item of pxNodes) {
      item.px = Math.max(minX, Math.min(maxX, item.px));
      item.py = Math.max(minY, Math.min(maxY, item.py));
      item.node.x = item.px / arenaW;
      item.node.y = item.py / arenaH;

      // Clamp speed within sector bounds
      const mag = Math.hypot(item.node.vx, item.node.vy) || 1;
      if (mag < sec.speedMin || mag > sec.speedMax) {
        const clamped = Math.max(sec.speedMin, Math.min(sec.speedMax, mag));
        item.node.vx = (item.node.vx / mag) * clamped;
        item.node.vy = (item.node.vy / mag) * clamped;
      }
    }
  }

  function updateBursts(dt) {
    for (let i = bursts.length - 1; i >= 0; i -= 1) {
      const p = bursts[i];
      p.life -= dt;
      if (p.life <= 0) {
        bursts.splice(i, 1);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.94;
      p.vy *= 0.94;
    }
  }

  function drawArena(now) {
    if (!gCtx) return;
    gCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    gCtx.clearRect(0, 0, arenaW, arenaH);

    const sec = currentSector();
    const r = getNodeRadiusPx();
    const showNumbers = phase === 'memorize';
    const isLockOn = phase === 'lockon';
    const isDecoyFlashing = decoyPulseTimer > 0;

    // Subtle tactical grid lines
    gCtx.save();
    gCtx.strokeStyle = 'rgba(239, 68, 68, 0.08)';
    gCtx.lineWidth = 1;
    const step = 48;
    for (let x = step; x < arenaW; x += step) {
      gCtx.beginPath();
      gCtx.moveTo(x, 0);
      gCtx.lineTo(x, arenaH);
      gCtx.stroke();
    }
    for (let y = step; y < arenaH; y += step) {
      gCtx.beginPath();
      gCtx.moveTo(0, y);
      gCtx.lineTo(arenaW, y);
      gCtx.stroke();
    }
    gCtx.restore();

    // Draw nodes
    for (const node of sec.nodes) {
      const cx = node.x * arenaW;
      const cy = node.y * arenaH;
      const flash = nodeFlash.get(node.letter);
      const hasFlash = flash && flash.until > now;
      const isDecoyNode = isDecoyFlashing && sec.decoyLetters.includes(node.letter) && !node.solved;

      // Flicker warning during final 1.2s of Sector 3 memorize
      let numberAlpha = 1;
      if (showNumbers && sec.decoy && sec.memorizeSec - phaseElapsed <= 1.2) {
        numberAlpha = Math.sin(now * 0.032 + node.phase) > -0.25 ? 1 : 0.25;
      }

      gCtx.save();

      // Lock-on contracting reticle
      if (isLockOn) {
        const t = Math.min(1, phaseElapsed / LOCK_ON_DURATION);
        const retR = r * (1.85 - t * 0.72);
        gCtx.strokeStyle = 'rgba(34, 211, 238, 0.75)';
        gCtx.lineWidth = 1.5;
        gCtx.setLineDash([5, 4]);
        gCtx.beginPath();
        gCtx.arc(cx, cy, retR, 0, Math.PI * 2);
        gCtx.stroke();
        gCtx.setLineDash([]);
      }

      // Outer glow halo
      let borderColor = '#22d3ee';
      let fillTop = 'rgba(15, 23, 46, 0.92)';
      let fillBottom = 'rgba(9, 13, 30, 0.96)';

      if (node.solved) {
        borderColor = '#34d399';
        fillTop = 'rgba(6, 78, 59, 0.72)';
        fillBottom = 'rgba(6, 45, 36, 0.85)';
      } else if (hasFlash) {
        borderColor = flash.color;
      } else if (isDecoyNode) {
        borderColor = '#ef4444';
      } else if (showNumbers) {
        borderColor = '#fbbf24';
      }

      if (isDecoyNode) {
        gCtx.beginPath();
        gCtx.arc(cx, cy, r + 6, 0, Math.PI * 2);
        gCtx.strokeStyle = 'rgba(239, 68, 68, 0.85)';
        gCtx.lineWidth = 2.5;
        gCtx.stroke();
      }

      const grad = gCtx.createLinearGradient(cx, cy - r, cx, cy + r);
      grad.addColorStop(0, fillTop);
      grad.addColorStop(1, fillBottom);

      gCtx.shadowColor = borderColor;
      gCtx.shadowBlur = node.solved ? 12 : 18;
      gCtx.fillStyle = grad;
      gCtx.beginPath();
      gCtx.arc(cx, cy, r, 0, Math.PI * 2);
      gCtx.fill();

      gCtx.shadowBlur = 0;
      gCtx.lineWidth = node.solved ? 2.5 : 2.2;
      gCtx.strokeStyle = borderColor;
      gCtx.stroke();

      // Inner crisp specular ring
      gCtx.beginPath();
      gCtx.arc(cx, cy, r - 4, 0, Math.PI * 2);
      gCtx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
      gCtx.lineWidth = 1;
      gCtx.stroke();

      // Text inside orb
      gCtx.textAlign = 'center';
      gCtx.textBaseline = 'middle';

      if (showNumbers) {
        // Alphabet top, bold Number bottom
        gCtx.fillStyle = '#94a3b8';
        gCtx.font = `800 ${Math.round(r * 0.44)}px Outfit, sans-serif`;
        gCtx.fillText(node.letter, cx, cy - r * 0.34);

        gCtx.globalAlpha = numberAlpha;
        gCtx.fillStyle = '#fbbf24';
        gCtx.font = `800 ${Math.round(r * 0.68)}px "Space Grotesk", monospace`;
        gCtx.fillText(node.number, cx, cy + r * 0.24);
      } else if (isLockOn) {
        gCtx.fillStyle = '#22d3ee';
        gCtx.font = `900 ${Math.round(r * 0.62)}px Outfit, sans-serif`;
        gCtx.fillText(node.letter, cx, cy);
      } else {
        // Hide / Decode phase: ONLY Alphabet visible!
        gCtx.fillStyle = node.solved ? '#34d399' : '#f8fafc';
        gCtx.font = `900 ${Math.round(r * 0.78)}px Outfit, sans-serif`;
        gCtx.fillText(node.letter, cx, cy + 1);

        if (node.solved) {
          gCtx.fillStyle = '#6ee7b7';
          gCtx.font = `700 ${Math.round(r * 0.28)}px "Space Grotesk", monospace`;
          gCtx.fillText('OK', cx, cy + r * 0.56);
        }
      }

      gCtx.restore();
    }

    // Draw burst particles
    for (const p of bursts) {
      gCtx.save();
      gCtx.globalAlpha = Math.max(0, p.life / p.maxLife);
      gCtx.fillStyle = p.color;
      gCtx.beginPath();
      gCtx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      gCtx.fill();
      gCtx.restore();
    }
  }

  function step(now) {
    if (unmounted) return;
    rafId = window.requestAnimationFrame(step);

    const rawDt = Math.min(0.05, Math.max(0, (now - lastFrameTs) / 1000));
    lastFrameTs = now;

    if (!isPaused && !finished) {
      activeTimeMs += rawDt * 1000;
      phaseElapsed += rawDt;
      if (decoyPulseTimer > 0) {
        decoyPulseTimer = Math.max(0, decoyPulseTimer - rawDt);
        if (decoyPulseTimer === 0) {
          arenaEl.classList.remove('is-glitch');
        }
      }

      const sec = currentSector();
      updatePhysics(rawDt);
      updateBursts(rawDt);

      if (phase === 'lockon') {
        const ratio = Math.min(1, phaseElapsed / LOCK_ON_DURATION);
        timerFillEl.style.setProperty('--df-bar', ratio.toFixed(4));
        if (phaseElapsed >= LOCK_ON_DURATION) {
          enterPhase('memorize');
        }
      } else if (phase === 'memorize') {
        const rem = Math.max(0, sec.memorizeSec - phaseElapsed);
        const ratio = Math.max(0, rem / sec.memorizeSec);
        timerFillEl.style.setProperty('--df-bar', ratio.toFixed(4));
        phasePillEl.textContent = `암기 ${rem.toFixed(1)}s`;

        syncSharedHud({ text: `${rem.toFixed(1)}s`, state: rem <= 1.5 ? 'warn' : 'normal' }, ratio);

        if (rem <= 1.5) {
          const tickStep = Math.ceil(rem * 2); // 3, 2, 1
          if (tickStep !== lastTickStep && tickStep > 0) {
            lastTickStep = tickStep;
            ctx.audio.playTick();
          }
          if (!sec.decoy || decoyPulseTimer === 0) {
            showBanner('숫자 소멸 임박! 눈을 떼지 마세요!', 'danger');
          }
        }

        // Sector 3 decoy blink in memorize 1.2s..3.2s window (never swaps true pairs)
        if (sec.decoy && !decoyWindowTriggered && phaseElapsed >= 1.35) {
          decoyWindowTriggered = true;
          decoyPulseTimer = 0.22;
          arenaEl.classList.add('is-glitch');
          showBanner('교란 신호 감지! GLITCH', 'danger');
        }

        if (phaseElapsed >= sec.memorizeSec) {
          enterPhase('blackout');
        }
      } else if (phase === 'blackout') {
        timerFillEl.style.setProperty('--df-bar', '0');
        if (phaseElapsed >= BLACKOUT_DURATION) {
          enterPhase('decode');
        }
      } else if (phase === 'decode') {
        decodeElapsed += rawDt;
        const rem = Math.max(0, sec.decodeSec - decodeElapsed);
        const ratio = Math.max(0, rem / sec.decodeSec);
        timerFillEl.style.setProperty('--df-bar', ratio.toFixed(4));
        timerFillEl.dataset.mode = rem <= 5.0 ? 'danger' : 'normal';
        phasePillEl.textContent = `해독 ${rem.toFixed(1)}s`;

        syncSharedHud(rem, ratio);

        if (rem <= 5.0) {
          const tickStep = Math.ceil(rem);
          if (tickStep !== lastTickStep && tickStep > 0) {
            lastTickStep = tickStep;
            ctx.audio.playTick();
          }
        }

        // Sector 3 decode decoy telemetry & warning ring (only wrong nodes + side telemetry)
        if (sec.decoy && decodeElapsed >= nextDecodeDecoyAt) {
          nextDecodeDecoyAt += 4.2;
          decoyPulseTimer = 0.35;
          arenaEl.classList.add('is-glitch');
          decoyHudEl.textContent = `FAKE: ${sec.decoyFakeCode}`;
          decoyHudEl.hidden = false;
          safeTimeout(() => {
            if (decoyHudEl) decoyHudEl.hidden = true;
          }, 950);
        }

        if (rem <= 0) {
          handleDecodeFail('제한 시간 초과! 금고 봉쇄', 'DECODE TIMEOUT // LOCKDOWN');
        }
      }
    }

    drawArena(now);
  }

  // Event bindings
  const onResize = () => resizeCanvas();
  window.addEventListener('resize', onResize);
  window.addEventListener('keydown', handleKeyDown);
  window.addEventListener('pm:pausechange', handlePauseChange);
  canvas.addEventListener('pointerdown', handleCanvasPointerDown);
  skipBtn.addEventListener('click', handleSkipClick);

  // Initialize
  resizeCanvas();
  renderShields();
  renderStreak();
  enterPhase('lockon');
  lastFrameTs = performance.now();
  rafId = window.requestAnimationFrame(step);

  return {
    unmount() {
      unmounted = true;
      if (rafId) {
        window.cancelAnimationFrame(rafId);
        rafId = 0;
      }
      for (const id of activeTimers) {
        window.clearTimeout(id);
      }
      activeTimers.clear();
      window.removeEventListener('resize', onResize);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('pm:pausechange', handlePauseChange);
      canvas.removeEventListener('pointerdown', handleCanvasPointerDown);
      skipBtn.removeEventListener('click', handleSkipClick);
      container.innerHTML = '';
    },
  };
}
