/**
 * POSSIBLE MISSION — Arcade Hub Controller, URL/Seed Sync, Dynamic Router & Game Context
 */
import { createRng } from './core/seed.js';
import * as audio from './core/audio.js';
import * as storage from './core/storage.js';
import * as ui from './core/ui.js';

const PRESET_SEEDS = ['MISSION-1', 'ROUND-1', 'ROUND-2', 'ROUND-3', 'ROUND-4', 'ROUND-5'];

const GAME_CATALOG = [
  {
    id: 'hidden-object',
    title: '숨은그림찾기',
    subEn: 'HIDDEN MISSION',
    accent: 'cyan',
    tag: '관찰력 · 돋보기',
    timeHint: '75~90초',
    hook: '네온 아지트와 우주 관측소에 숨겨진 미션 오브젝트를 루페로 스캔해 찾아내세요!',
    defaultMode: 'stage1-normal',
    modes: [
      { id: 'stage1-normal', label: '라운지 · 노말', thumb: './assets/images/hidden-workshop.jpg' },
      { id: 'stage1-hard', label: '라운지 · 하드', thumb: './assets/images/hidden-workshop.jpg' },
      { id: 'stage2-normal', label: '관측소 · 노말', thumb: './assets/images/hidden-space.jpg' },
      { id: 'stage2-hard', label: '관측소 · 하드', thumb: './assets/images/hidden-space.jpg' },
    ],
  },
  {
    id: 'spot-difference',
    title: '틀린그림찾기',
    subEn: 'SPOT THE GLITCH',
    accent: 'magenta',
    tag: '매의 눈 · 듀얼뷰',
    timeHint: '60~75초',
    hook: '원본과 변형 캔버스 사이의 교묘한 글리치 포인트를 정확히 짚어내는 스피드 눈썰미 대결!',
    defaultMode: 'stage1-normal',
    modes: [
      { id: 'stage1-normal', label: '카페 · 노말', thumb: './assets/images/spot-cafe.jpg' },
      { id: 'stage1-hard', label: '카페 · 하드', thumb: './assets/images/spot-cafe.jpg' },
      { id: 'stage2-normal', label: '캠프 · 노말', thumb: './assets/images/spot-camp.jpg' },
      { id: 'stage2-hard', label: '캠프 · 하드', thumb: './assets/images/spot-camp.jpg' },
    ],
  },
  {
    id: 'memory-match',
    title: '네온 메모리 매치',
    subEn: 'NEON MEMORY',
    accent: 'violet',
    tag: '단기기억 · 콤보',
    timeHint: '45~80초',
    hook: '단 2초의 플래시 암기 후, 0ms 연속 매치 콤보로 덱을 쓸어버리는 두뇌 타임어택!',
    defaultMode: '4x4',
    modes: [
      { id: '4x3', label: '4×3 웜업', thumb: null },
      { id: '4x4', label: '4×4 스탠다드', thumb: null },
      { id: '6x4', label: '6×4 마스터', thumb: null },
    ],
  },
  {
    id: 'despair-fortress',
    title: '절망요새 숨바꼭질',
    subEn: 'DESPAIR FORTRESS',
    accent: 'crimson',
    tag: '순발력 · 보스전',
    timeHint: '약 60초',
    hook: '블랙아웃 직전 떠다니는 보안 코드를 암기해 3구역 금고를 해독하는 극한 집중 미션!',
    defaultMode: 'standard',
    modes: [
      { id: 'standard', label: '3구역 탈출', thumb: './assets/images/fortress-bg.jpg' },
    ],
  },
];

const GAME_MAP = new Map(GAME_CATALOG.map((g) => [g.id, g]));

const state = {
  seed: 'MISSION-1',
  selectedModes: Object.fromEntries(GAME_CATALOG.map((g) => [g.id, g.defaultMode])),
  hofTab: 'seed', // 'seed' | 'recent' | 'pb'
  activeGame: null, // { id, mode, instance, finished, paused, runToken, isStub }
  runCounter: 0,
};

/* === DOM References === */
const dom = {};

function cacheDom() {
  dom.lobbyView = document.getElementById('lobby-view');
  dom.heroBanner = document.getElementById('hero-banner');
  dom.workshopBar = document.getElementById('workshop-bar');
  dom.gameGrid = document.getElementById('game-grid');
  dom.hallOfFame = document.getElementById('hall-of-fame');

  dom.gameView = document.getElementById('game-view');
  dom.hudExitBtn = document.getElementById('hud-exit-btn');
  dom.hudGameTitle = document.getElementById('hud-game-title');
  dom.hudModeLabel = document.getElementById('hud-mode-label');
  dom.hudSeedBadge = document.getElementById('hud-seed-badge');
  dom.hudTimer = document.getElementById('hud-timer');
  dom.hudProgressPill = document.getElementById('hud-progress-pill');
  dom.hudExtraSlot = document.getElementById('hud-extra-slot');
  dom.hudScore = document.getElementById('hud-score');
  dom.hudProgressBar = document.getElementById('hud-progress-bar');
  dom.hudRestartBtn = document.getElementById('hud-restart-btn');
  dom.hudPauseBtn = document.getElementById('hud-pause-btn');
  dom.hudMuteBtn = document.getElementById('hud-mute-btn');
  dom.gameStage = document.getElementById('game-stage');
  dom.pauseCurtain = document.getElementById('pause-curtain');
  dom.pauseResumeBtn = document.getElementById('pause-resume-btn');
}

/* === URL & Seed Helpers === */
const HISTORY_KIND_GAME = 'game';
const HISTORY_KIND_HUB = 'hub';
let ignoreNextPopState = false;

/**
 * Mirrors the current view into the address bar.
 * `push` adds a history entry (lobby -> game) so the browser Back button returns to
 * the lobby instead of leaving the arcade site.
 */
function syncUrlState({ seed, game, mode, historyMode = 'replace' } = {}) {
  try {
    const url = new URL(window.location.href);
    url.searchParams.set('seed', seed || state.seed);
    if (game) {
      url.searchParams.set('game', game);
      url.searchParams.set('mode', mode || state.selectedModes[game] || '');
    } else {
      url.searchParams.delete('game');
      url.searchParams.delete('mode');
    }
    const nextUrl = `${url.pathname}${url.search}${url.hash}`;
    const payload = {
      pm: game ? HISTORY_KIND_GAME : HISTORY_KIND_HUB,
      pushedByApp: historyMode === 'push',
      seed: seed || state.seed,
      game: game || null,
      mode: game ? mode || state.selectedModes[game] || '' : null,
    };
    if (historyMode === 'push') {
      window.history.pushState(payload, '', nextUrl);
    } else {
      window.history.replaceState(payload, '', nextUrl);
    }
  } catch {
    // Ignore restricted history APIs
  }
}

function generateRandomSeed() {
  const prefixes = ['NEON', 'APEX', 'NOVA', 'PULSE', 'CREW', 'SPARK'];
  const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
  const code = Math.floor(100 + Math.random() * 900);
  return `${prefix}-${code}`;
}

function setRoomSeed(nextSeed, { announce = false } = {}) {
  const normalized = storage.normalizeSeed(nextSeed);
  state.seed = normalized;
  storage.addSeedHistory(normalized);
  syncUrlState({
    seed: normalized,
    game: state.activeGame?.id,
    mode: state.activeGame?.mode,
  });

  const seedInput = document.getElementById('seed-input');
  if (seedInput && seedInput.value !== normalized) {
    seedInput.value = normalized;
  }

  renderSeedChips();
  renderGameGrid();
  renderHallOfFame();

  if (announce) {
    ui.showToast(`룸 시드가 #${normalized} 로 동기화되었습니다!`, 'success');
  }
}

function syncSeedFromInput({ rerender = true, announce = false } = {}) {
  const seedInput = document.getElementById('seed-input');
  if (!seedInput) return state.seed;
  const normalized = storage.normalizeSeed(seedInput.value || 'MISSION-1');
  if (seedInput.value !== normalized) {
    seedInput.value = normalized;
  }
  if (normalized !== state.seed) {
    if (rerender) {
      setRoomSeed(normalized, { announce });
    } else {
      state.seed = normalized;
      storage.addSeedHistory(normalized);
      syncUrlState({
        seed: normalized,
        game: state.activeGame?.id,
        mode: state.activeGame?.mode,
      });
    }
  }
  return state.seed;
}

/* === Mute Icon Sync === */
function syncMuteButtons() {
  const muted = audio.isMuted();
  const icon = muted ? '🔇' : '🔊';
  if (dom.hudMuteBtn) {
    dom.hudMuteBtn.textContent = icon;
    dom.hudMuteBtn.setAttribute('aria-pressed', String(muted));
  }
  const lobbyMuteBtn = document.getElementById('lobby-mute-btn');
  if (lobbyMuteBtn) {
    lobbyMuteBtn.textContent = muted ? '🔇 음소거' : '🔊 SFX ON';
    lobbyMuteBtn.setAttribute('aria-pressed', String(muted));
  }
}

function toggleMute() {
  const next = !audio.isMuted();
  audio.setMuted(next);
  syncMuteButtons();
  if (!next) audio.playClick();
  ui.showToast(next ? '사운드 효과를 껐습니다.' : '아케이드 사운드 ON!', 'info', 1600);
}

/* === Lobby Renderers === */
function renderHeroBanner() {
  if (!dom.heroBanner) return;
  dom.heroBanner.innerHTML = `
    <img
      class="hero-banner__bg"
      src="./assets/images/hero-arcade.jpg"
      alt="네온 워크샵 아케이드 파티 배너"
    />
    <div class="hero-banner__scrim" aria-hidden="true"></div>
    <div class="hero-banner__content">
      <div class="hero-banner__topline">
        <span class="hero-live-pill">
          <span class="hero-live-pill__dot" aria-hidden="true"></span>
          WORKSHOP LIVE • 5–100인 동시 미션
        </span>
        <span class="hero-brand-tag">POSSIBLE MISSION // ARCADE</span>
      </div>
      <h1 class="hero-banner__title">
        오늘 워크샵, <span class="hero-banner__title-accent">텐션 한계 돌파!</span>
      </h1>
      <p class="hero-banner__desc">
        로그인 없이 <strong>1분 컷</strong>. 같은 <strong>룸 시드</strong>만 맞추면
        모두 똑같은 문제로 겨룹니다.
      </p>
      <div class="hero-banner__actions">
        <button id="hero-random-play-btn" class="btn-neon-primary" type="button">
          ⚡ 랜덤 미션 바로 시작
        </button>
        <button id="hero-sync-seed-btn" class="btn-neon-secondary" type="button">
          🎯 오늘의 시드 맞추기
        </button>
      </div>
    </div>
  `;

  document.getElementById('hero-random-play-btn')?.addEventListener('click', () => {
    audio.playClick();
    syncSeedFromInput({ rerender: false });
    const game = GAME_CATALOG[Math.floor(Math.random() * GAME_CATALOG.length)];
    const mode = state.selectedModes[game.id] || game.defaultMode;
    launchGame(game.id, mode);
  });

  document.getElementById('hero-sync-seed-btn')?.addEventListener('click', () => {
    audio.playClick();
    const seedInput = document.getElementById('seed-input');
    if (seedInput) {
      seedInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
      seedInput.focus();
      seedInput.select();
    }
    ui.showToast('MC가 안내한 룸 시드를 입력하거나 프리셋 칩을 눌러주세요!', 'info');
  });
}

function renderWorkshopBar() {
  if (!dom.workshopBar) return;
  const profile = storage.getProfile();

  dom.workshopBar.innerHTML = `
    <ol class="quick-start" aria-label="시작 방법">
      <li class="quick-start__step"><b>1</b> 이름 입력 <span>(선택)</span></li>
      <li class="quick-start__step"><b>2</b> 룸 시드 확인</li>
      <li class="quick-start__step"><b>3</b> 게임 카드에서 <b>출격</b></li>
    </ol>

    <div class="workshop-bar__row">
      <label class="workshop-field workshop-field--nick">
        <span class="workshop-field__label">
          <span>요원 닉네임</span>
          <span class="workshop-field__sub">MAX 12</span>
        </span>
        <input
          id="player-nick-input"
          class="arcade-input"
          type="text"
          maxlength="12"
          placeholder="익명요원"
          value="${escapeAttr(profile.nickname)}"
        />
      </label>

      <label class="workshop-field workshop-field--team">
        <span class="workshop-field__label">
          <span>소속 팀명 (선택)</span>
          <span class="workshop-field__sub">MAX 10</span>
        </span>
        <input
          id="player-team-input"
          class="arcade-input"
          type="text"
          maxlength="10"
          placeholder="예: A조, 프로덕트팀"
          value="${escapeAttr(profile.team)}"
        />
      </label>

      <div class="workshop-field workshop-field--seed">
        <label class="workshop-field__label" for="seed-input">
          <span>룸 시드 — 모두 같은 코드를 입력하면 같은 문제!</span>
          <span class="workshop-field__sub">5–100 SYNC</span>
        </label>
        <div class="seed-input-wrap">
          <input
            id="seed-input"
            class="arcade-input arcade-input--mono"
            type="text"
            maxlength="16"
            spellcheck="false"
            autocomplete="off"
            value="${escapeAttr(state.seed)}"
          />
          <button id="seed-apply-btn" class="btn-neon-ghost" type="button">적용</button>
        </div>
      </div>
    </div>

    <div class="workshop-bar__bottom">
      <div class="workshop-actions">
        <button id="copy-invite-btn" class="workshop-tool-btn workshop-tool-btn--accent" type="button">
          🔗 초대 링크 복사
        </button>
        <button id="lobby-mute-btn" class="workshop-tool-btn" type="button" aria-pressed="false">
          🔊 SFX ON
        </button>
        <details class="workshop-more">
          <summary class="workshop-tool-btn">🎛️ 진행자 도구</summary>
          <div class="workshop-more__panel">
            <div class="workshop-more__tools">
              <button id="open-qr-btn" class="workshop-tool-btn" type="button">📱 QR 코드</button>
              <button id="open-hof-btn" class="workshop-tool-btn" type="button">📋 결과 취합기</button>
              <button id="open-mc-guide-btn" class="workshop-tool-btn workshop-tool-btn--mc" type="button">
                🎙️ MC 가이드
              </button>
            </div>
            <div class="workshop-more__seeds">
              <span class="workshop-more__label">빠른 시드</span>
              <div id="seed-chips" class="seed-chips" role="group" aria-label="프리셋 룸 시드"></div>
            </div>
          </div>
        </details>
      </div>
    </div>
  `;

  const nickInput = document.getElementById('player-nick-input');
  const teamInput = document.getElementById('player-team-input');
  const saveProfileFromInputs = () => {
    storage.saveProfile({
      nickname: nickInput?.value ?? '',
      team: teamInput?.value ?? '',
    });
  };
  nickInput?.addEventListener('change', saveProfileFromInputs);
  nickInput?.addEventListener('blur', saveProfileFromInputs);
  teamInput?.addEventListener('change', saveProfileFromInputs);
  teamInput?.addEventListener('blur', saveProfileFromInputs);

  const seedInput = document.getElementById('seed-input');
  const applySeed = () => {
    audio.playClick();
    setRoomSeed(seedInput?.value || 'MISSION-1', { announce: true });
  };
  const commitSeedOnBlurOrChange = () => {
    const prevSeed = state.seed;
    const nextSeed = syncSeedFromInput({ rerender: false });
    if (nextSeed !== prevSeed) {
      // Defer DOM re-render so an in-progress click on a chip, mode pill, play button, or HOF tab is not disrupted.
      setTimeout(() => {
        if (!state.activeGame) {
          renderSeedChips();
          renderGameGrid();
          renderHallOfFame();
        }
      }, 0);
    }
  };
  document.getElementById('seed-apply-btn')?.addEventListener('click', applySeed);
  seedInput?.addEventListener('change', commitSeedOnBlurOrChange);
  seedInput?.addEventListener('blur', commitSeedOnBlurOrChange);
  seedInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      applySeed();
    }
  });

  document.getElementById('copy-invite-btn')?.addEventListener('click', async () => {
    audio.playClick();
    syncSeedFromInput();
    const url = ui.buildShareUrl({ seed: state.seed });
    const ok = await ui.copyToClipboard(url);
    ui.showToast(
      ok ? `시드 #${state.seed} 초대 링크가 복사되었습니다!` : '링크 복사에 실패했습니다. URL을 직접 복사해주세요.',
      ok ? 'success' : 'warn'
    );
  });

  document.getElementById('open-qr-btn')?.addEventListener('click', () => {
    audio.playClick();
    syncSeedFromInput();
    openQrModal();
  });

  document.getElementById('open-hof-btn')?.addEventListener('click', () => {
    audio.playClick();
    syncSeedFromInput();
    openAggregatorModal();
  });

  document.getElementById('open-mc-guide-btn')?.addEventListener('click', () => {
    audio.playClick();
    openMcGuideModal();
  });

  document.getElementById('lobby-mute-btn')?.addEventListener('click', toggleMute);

  renderSeedChips();
  syncMuteButtons();
}

function renderSeedChips() {
  const container = document.getElementById('seed-chips');
  if (!container) return;

  const history = storage.getSeedHistory().filter((s) => !PRESET_SEEDS.includes(s)).slice(0, 3);
  container.innerHTML = '';

  const label = document.createElement('span');
  label.className = 'seed-chips__label';
  label.textContent = '빠른 시드:';
  container.appendChild(label);

  PRESET_SEEDS.forEach((seedVal) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `seed-chip ${state.seed === seedVal ? 'is-active' : ''}`;
    btn.textContent = seedVal;
    btn.addEventListener('click', () => {
      audio.playClick();
      setRoomSeed(seedVal, { announce: true });
    });
    container.appendChild(btn);
  });

  history.forEach((seedVal) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `seed-chip seed-chip--history ${state.seed === seedVal ? 'is-active' : ''}`;
    btn.textContent = `#${seedVal}`;
    btn.title = '최근 사용한 시드';
    btn.addEventListener('click', () => {
      audio.playClick();
      setRoomSeed(seedVal, { announce: true });
    });
    container.appendChild(btn);
  });

  const randBtn = document.createElement('button');
  randBtn.type = 'button';
  randBtn.className = 'seed-chip';
  randBtn.textContent = '🎲 랜덤';
  randBtn.addEventListener('click', () => {
    audio.playClick();
    setRoomSeed(generateRandomSeed(), { announce: true });
  });
  container.appendChild(randBtn);
}

function renderGameGrid() {
  if (!dom.gameGrid) return;
  dom.gameGrid.innerHTML = '';

  const supportsHover = window.matchMedia?.('(hover: hover) and (pointer: fine)').matches;
  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  GAME_CATALOG.forEach((game) => {
    const selectedModeId = state.selectedModes[game.id] || game.defaultMode;
    const modeObj = game.modes.find((m) => m.id === selectedModeId) || game.modes[0];
    const pb = storage.getPersonalBest(game.id, modeObj.id);

    const card = document.createElement('article');
    card.className = `game-card game-card--${game.accent}`;
    card.dataset.gameId = game.id;

    const mediaHtml = modeObj.thumb
      ? `<img class="game-card__img" src="${modeObj.thumb}" alt="${escapeAttr(game.title)} 스테이지 미리보기" loading="lazy" />`
      : `<div class="game-card__memory-art" aria-hidden="true">
           <div class="memory-preview-tile">🚀</div>
           <div class="memory-preview-tile">⚡</div>
           <div class="memory-preview-tile">💎</div>
         </div>`;

    const pbHtml = pb
      ? `<span class="game-card__pb-pill">BEST ${pb.score.toLocaleString('en-US')} (${pb.grade})</span>`
      : `<span class="game-card__pb-pill is-empty">첫 도전 대기</span>`;

    card.innerHTML = `
      <div class="game-card__media">
        ${mediaHtml}
        <div class="game-card__media-scrim" aria-hidden="true"></div>
        <div class="game-card__badges">
          <span class="game-card__tag">${game.tag}</span>
          <span class="game-card__time">⏱ ${game.timeHint}</span>
        </div>
        <div class="game-card__pb-bar">
          <span class="game-card__sub-en">${game.subEn}</span>
          ${pbHtml}
        </div>
      </div>

      <div class="game-card__body">
        <h2 class="game-card__title">${game.title}</h2>
        <p class="game-card__hook">${game.hook}</p>

        <div class="game-card__modes" role="group" aria-label="${escapeAttr(game.title)} 모드 선택">
          ${game.modes
            .map(
              (m) => `
              <button
                type="button"
                class="mode-pill ${m.id === modeObj.id ? 'is-selected' : ''}"
                data-mode-id="${m.id}"
              >${m.label}</button>`
            )
            .join('')}
        </div>

        <button type="button" class="game-card__play" data-launch-game>
          <span>출격 (PLAY →)</span>
        </button>
      </div>
    `;

    card.querySelectorAll('[data-mode-id]').forEach((pill) => {
      pill.addEventListener('click', () => {
        audio.playClick();
        state.selectedModes[game.id] = pill.dataset.modeId;
        renderGameGrid();
      });
    });

    card.querySelector('[data-launch-game]')?.addEventListener('click', () => {
      audio.playClick();
      syncSeedFromInput({ rerender: false });
      launchGame(game.id, state.selectedModes[game.id] || game.defaultMode);
    });

    if (supportsHover && !reducedMotion) {
      card.addEventListener('pointermove', (e) => {
        const rect = card.getBoundingClientRect();
        const px = (e.clientX - rect.left) / rect.width;
        const py = (e.clientY - rect.top) / rect.height;
        const rx = (0.5 - py) * 10; // ±5deg
        const ry = (px - 0.5) * 10;
        card.style.setProperty('--rx', `${rx.toFixed(2)}deg`);
        card.style.setProperty('--ry', `${ry.toFixed(2)}deg`);
        card.style.setProperty('--mx', `${(px * 100).toFixed(1)}%`);
        card.style.setProperty('--my', `${(py * 100).toFixed(1)}%`);
      });
      card.addEventListener('pointerleave', () => {
        card.style.setProperty('--rx', '0deg');
        card.style.setProperty('--ry', '0deg');
      });
    }

    dom.gameGrid.appendChild(card);
  });
}

function renderHallOfFame() {
  if (!dom.hallOfFame) return;

  const tabs = [
    { id: 'seed', label: `현재 시드 (#${state.seed})` },
    { id: 'recent', label: '최근 플레이' },
    { id: 'pb', label: '종목별 최고' },
  ];

  let rowsHtml = '';

  if (state.hofTab === 'seed') {
    const runs = storage.getRuns({ seed: state.seed }).slice(0, 8);
    if (runs.length === 0) {
      rowsHtml = `<div class="hof-empty">아직 <strong>#${escapeHtml(state.seed)}</strong> 시드 기록이 없습니다. 첫 번째 S랭크 주인공이 되어보세요!</div>`;
    } else {
      rowsHtml = runs.map((run, idx) => formatHofRow(run, idx + 1)).join('');
    }
  } else if (state.hofTab === 'recent') {
    const runs = storage.getRecentRuns(8);
    if (runs.length === 0) {
      rowsHtml = `<div class="hof-empty">아직 플레이 기록이 없습니다. 위 4개 미션 중 하나를 골라 출격하세요!</div>`;
    } else {
      rowsHtml = runs.map((run, idx) => formatHofRow(run, idx + 1)).join('');
    }
  } else {
    const allPb = storage.getAllPersonalBests();
    const pbEntries = [];
    for (const game of GAME_CATALOG) {
      const modes = allPb[game.id] || {};
      for (const mode of game.modes) {
        const rec = modes[mode.id];
        if (rec) {
          pbEntries.push({
            gameId: game.id,
            modeLabel: mode.label,
            nickname: storage.getProfile().nickname,
            team: storage.getProfile().team,
            score: rec.score,
            timeMs: rec.timeMs,
            accuracy: rec.accuracy,
            grade: rec.grade,
            seed: rec.seed,
          });
        }
      }
    }
    pbEntries.sort((a, b) => b.score - a.score);
    if (pbEntries.length === 0) {
      rowsHtml = `<div class="hof-empty">달성한 최고 기록(Personal Best)이 아직 없습니다.</div>`;
    } else {
      rowsHtml = pbEntries.slice(0, 8).map((run, idx) => formatHofRow(run, idx + 1)).join('');
    }
  }

  dom.hallOfFame.innerHTML = `
    <div class="hof-header">
      <div class="hof-header__title-group">
        <span class="hof-header__eyebrow">LOCAL HALL OF FAME // WORKSHOP RECORDS</span>
        <h2 class="hof-header__title">명예의 전당 & 최근 기록</h2>
      </div>
      <div class="hof-controls">
        <div class="hof-tabs" role="tablist">
          ${tabs
            .map(
              (t) => `
              <button
                type="button"
                role="tab"
                aria-selected="${state.hofTab === t.id}"
                class="hof-tab ${state.hofTab === t.id ? 'is-active' : ''}"
                data-hof-tab="${t.id}"
              >${escapeHtml(t.label)}</button>`
            )
            .join('')}
        </div>
        <button id="hof-open-aggregator" class="workshop-tool-btn workshop-tool-btn--accent" type="button">
          📋 결과 취합기 (MC용)
        </button>
      </div>
    </div>
    <div class="hof-list">${rowsHtml}</div>
  `;

  dom.hallOfFame.querySelectorAll('[data-hof-tab]').forEach((btn) => {
    btn.addEventListener('click', () => {
      audio.playClick();
      state.hofTab = btn.dataset.hofTab;
      renderHallOfFame();
    });
  });

  document.getElementById('hof-open-aggregator')?.addEventListener('click', () => {
    audio.playClick();
    openAggregatorModal();
  });
}

function formatHofRow(run, rank) {
  const game = GAME_MAP.get(run.gameId);
  const title = game ? game.title : run.gameId;
  const timeSec = ((Number(run.timeMs) || 0) / 1000).toFixed(1);
  const teamLabel = run.team ? ` (${escapeHtml(run.team)})` : '';
  const rankClass = rank <= 3 ? `hof-rank--${rank}` : '';

  return `
    <div class="hof-row">
      <div class="hof-rank ${rankClass}">${rank}</div>
      <div class="hof-player">
        <span class="hof-player__name">${escapeHtml(run.nickname || '익명요원')}${teamLabel}</span>
        <span class="hof-player__meta">#${escapeHtml(run.seed)} · ${timeSec}초 · 정확도 ${run.accuracy ?? 0}%</span>
      </div>
      <div class="hof-game">${escapeHtml(title)} · ${escapeHtml(run.modeLabel || '')}</div>
      <span class="hof-grade hof-grade--${escapeAttr(run.grade)}">${escapeHtml(run.grade)}</span>
      <div class="hof-score">${Number(run.score || 0).toLocaleString('en-US')} PTS</div>
    </div>
  `;
}

/* === Shared Modals (QR, MC Guide, Hall of Fame Aggregator, Result) === */
function openQrModal() {
  const shareUrl = ui.buildShareUrl({ seed: state.seed });
  const wrap = document.createElement('div');
  wrap.className = 'qr-card';
  wrap.innerHTML = `
    <p style="color: var(--text-secondary); font-size: 0.92rem;">
      참가자 스마트폰 카메라로 아래 QR을 스캔하면<br/>
      룸 시드 <strong style="color: var(--neon-gold);">#${escapeHtml(state.seed)}</strong> 상태로 즉시 입장합니다!
    </p>
    <div class="qr-frame">
      <canvas id="qr-invite-canvas" aria-label="룸 시드 초대 QR 코드"></canvas>
    </div>
    <div class="qr-url-box">${escapeHtml(shareUrl)}</div>
    <button type="button" class="btn-neon-primary" id="qr-copy-url-btn" style="width: 100%;">
      🔗 초대 링크 복사하기
    </button>
  `;

  ui.openModal({
    title: `시드 #${state.seed} 초대 QR`,
    subtitle: 'INSTANT WORKSHOP JOIN',
    contentEl: wrap,
  });

  const canvas = document.getElementById('qr-invite-canvas');
  try {
    ui.renderQrCode(canvas, shareUrl, { size: 220, fg: '#070914', bg: '#ffffff' });
  } catch {
    if (canvas) canvas.replaceWith(document.createTextNode('URL이 너무 길어 QR을 생성할 수 없습니다.'));
  }

  document.getElementById('qr-copy-url-btn')?.addEventListener('click', async () => {
    audio.playClick();
    const ok = await ui.copyToClipboard(shareUrl);
    ui.showToast(ok ? '초대 링크를 복사했습니다!' : '복사에 실패했습니다.', ok ? 'success' : 'warn');
  });
}

function openMcGuideModal() {
  const wrap = document.createElement('div');
  wrap.className = 'mc-steps';
  wrap.innerHTML = `
    <div class="mc-step">
      <div class="mc-step__num">1</div>
      <div>
        <div class="mc-step__title">모든 참가자에게 동일한 '룸 시드' 공유 (5~100명 동시)</div>
        <div class="mc-step__desc">
          상단의 <strong>QR 코드</strong>를 회의실 프로젝터에 띄우거나 <strong>링크 복사</strong>로 Slack/카톡방에 뿌려주세요.
          같은 시드(예: <code>ROUND-1</code>)에서는 100명 모두 <strong>100% 동일한 문제 배치</strong>가 출제됩니다.
        </div>
      </div>
    </div>
    <div class="mc-step">
      <div class="mc-step__num">2</div>
      <div>
        <div class="mc-step__title">MC의 "3, 2, 1, 출격!" 카운트다운에 맞춰 동시 플레이</div>
        <div class="mc-step__desc">
          참가자들은 닉네임과 팀명을 입력한 뒤 지정된 종목/난이도 카드의 <strong>출격(PLAY)</strong>을 누릅니다.
          탭 전환 시 공정 플레이 커튼이 작동해 반칙을 방지합니다.
        </div>
      </div>
    </div>
    <div class="mc-step">
      <div class="mc-step__num">3</div>
      <div>
        <div class="mc-step__title">결과 복사로 단톡방 인증 → MC 결과 취합기로 포디움 공개!</div>
        <div class="mc-step__desc">
          게임 종료 후 <strong>결과 복사 (Slack/카톡)</strong> 버튼으로 1줄 스코어카드를 채팅방에 붙여넣습니다.
          MC는 채팅 내역을 통째로 복사해 <strong>명예의 전당 → 결과 취합기</strong>에 붙여넣으면 실시간 순위가 자동 정렬됩니다!
        </div>
      </div>
    </div>
  `;

  ui.openModal({
    title: 'MC 워크샵 진행 가이드',
    subtitle: 'ZERO-BACKEND 100-PLAYER SYNC',
    contentEl: wrap,
  });
}

function openAggregatorModal() {
  const wrap = document.createElement('div');
  wrap.style.display = 'flex';
  wrap.style.flexDirection = 'column';
  wrap.style.gap = '12px';

  wrap.innerHTML = `
    <p style="color: var(--text-secondary); font-size: 0.88rem;">
      Slack이나 카카오톡 방에 올라온 <code>[POSSIBLE MISSION]</code> 결과 메시지들을 여러 줄 통째로 붙여넣으면 자동으로 점수·시간순 포디움을 만들어줍니다!
    </p>
    <textarea
      id="agg-input"
      class="aggregator-textarea"
      placeholder="[POSSIBLE MISSION] 🔍 숨은그림찾기 (라운지 · 노말) | 김철수(A조) | S랭크 7,450점 (34.2초) | 정확도 92% | 시드: ROUND-1"
    ></textarea>
    <div style="display: flex; gap: 8px; flex-wrap: wrap;">
      <button type="button" id="agg-parse-btn" class="btn-neon-primary" style="flex: 1;">
        🏆 순위표 생성하기
      </button>
      <button type="button" id="agg-sample-btn" class="btn-neon-ghost">
        샘플 채우기
      </button>
    </div>
    <div id="agg-output" class="hof-list"></div>
  `;

  ui.openModal({
    title: '명예의 전당 & 결과 취합기',
    subtitle: 'PROJECTOR LEADERBOARD IMPORTER',
    contentEl: wrap,
    className: 'arcade-modal--wide',
  });

  const inputEl = document.getElementById('agg-input');
  const outputEl = document.getElementById('agg-output');

  const renderParsed = (raw) => {
    const list = ui.parseResultLines(raw);
    if (!outputEl) return;
    if (list.length === 0) {
      outputEl.innerHTML = `<div class="hof-empty">인식된 <code>[POSSIBLE MISSION]</code> 결과 줄이 없습니다.</div>`;
      return;
    }
    outputEl.innerHTML = list
      .map((item, idx) => {
        const rank = idx + 1;
        const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `${rank}`;
        const teamStr = item.team ? ` (${escapeHtml(item.team)})` : '';
        return `
          <div class="hof-row">
            <div class="hof-rank ${rank <= 3 ? `hof-rank--${rank}` : ''}">${medal}</div>
            <div class="hof-player">
              <span class="hof-player__name">${escapeHtml(item.nickname)}${teamStr}</span>
              <span class="hof-player__meta">#${escapeHtml(item.seed)} · ${item.timeSec}초 · 정확도 ${item.accuracy}%</span>
            </div>
            <div class="hof-game">${escapeHtml(item.gameTitle)} · ${escapeHtml(item.modeLabel)}</div>
            <span class="hof-grade hof-grade--${escapeAttr(item.grade)}">${escapeHtml(item.grade)}</span>
            <div class="hof-score">${item.score.toLocaleString('en-US')} PTS</div>
          </div>
        `;
      })
      .join('');
  };

  // Pre-populate with local runs for current seed if available
  const localSeedRuns = storage.getRuns({ seed: state.seed });
  if (localSeedRuns.length > 0 && outputEl) {
    outputEl.innerHTML = localSeedRuns.slice(0, 6).map((r, i) => formatHofRow(r, i + 1)).join('');
  }

  document.getElementById('agg-parse-btn')?.addEventListener('click', () => {
    audio.playClick();
    renderParsed(inputEl?.value || '');
  });

  document.getElementById('agg-sample-btn')?.addEventListener('click', () => {
    audio.playClick();
    if (!inputEl) return;
    inputEl.value = [
      `[POSSIBLE MISSION] 🔍 숨은그림찾기 (라운지 · 노말) | 김하늘(A조) | S랭크 7,420점 (31.4초) | 정확도 100% | 시드: ${state.seed}`,
      `[POSSIBLE MISSION] ⚡ 틀린그림찾기 (카페 · 노말) | 박준영(B조) | A랭크 6,150점 (28.9초) | 정확도 88% | 시드: ${state.seed}`,
      `[POSSIBLE MISSION] 🧠 네온 메모리 매치 (4×4 스탠다드) | 이서연(디자인) | S랭크 7,890점 (24.1초) | 정확도 94% | 시드: ${state.seed}`,
    ].join('\n');
    renderParsed(inputEl.value);
  });
}

/* === Active Game HUD & Lifecycle === */
function resetHud() {
  if (dom.hudTimer) {
    dom.hudTimer.textContent = '00:00';
    dom.hudTimer.dataset.state = 'normal';
  }
  if (dom.hudScore) {
    dom.hudScore.textContent = '0 PTS';
  }
  if (dom.hudProgressPill) {
    dom.hudProgressPill.textContent = '';
    dom.hudProgressPill.hidden = true;
  }
  if (dom.hudExtraSlot) {
    dom.hudExtraSlot.innerHTML = '';
  }
  if (dom.hudProgressBar) {
    dom.hudProgressBar.style.setProperty('--hud-progress', '1');
  }
  if (dom.hudPauseBtn) {
    dom.hudPauseBtn.disabled = false;
    dom.hudPauseBtn.hidden = false;
    dom.hudPauseBtn.textContent = '⏸';
    dom.hudPauseBtn.setAttribute('aria-label', '일시정지');
    dom.hudPauseBtn.setAttribute('title', '일시정지');
  }
}

function formatTimerValue(timer) {
  if (timer && typeof timer === 'object') {
    return {
      text: String(timer.text ?? '00:00'),
      state: timer.state || 'normal',
    };
  }
  if (typeof timer === 'string') {
    return { text: timer, state: 'normal' };
  }
  const sec = Math.max(0, Number(timer) || 0);
  const timerState = sec <= 7 ? 'danger' : sec <= 15 ? 'warn' : 'normal';
  if (sec < 10) {
    return { text: `${sec.toFixed(1)}s`, state: timerState };
  }
  const whole = Math.ceil(sec);
  const mins = Math.floor(whole / 60);
  const rem = whole % 60;
  return {
    text: `${String(mins).padStart(2, '0')}:${String(rem).padStart(2, '0')}`,
    state: timerState,
  };
}

function setPaused(paused) {
  if (!state.activeGame || state.activeGame.finished) return;
  const next = Boolean(paused);
  if (state.activeGame.paused === next) return;
  state.activeGame.paused = next;

  if (dom.pauseCurtain) {
    dom.pauseCurtain.hidden = !next;
  }
  if (dom.hudPauseBtn) {
    dom.hudPauseBtn.textContent = next ? '▶' : '⏸';
    dom.hudPauseBtn.setAttribute('aria-label', next ? '재개' : '일시정지');
  }

  window.dispatchEvent(new CustomEvent('pm:pausechange', { detail: { paused: next } }));
}

function unmountActiveGame() {
  if (!state.activeGame) return;
  try {
    state.activeGame.instance?.unmount?.();
  } catch (err) {
    console.error('Error during game unmount:', err);
  }
  state.activeGame = null;
  if (dom.gameStage) dom.gameStage.innerHTML = '';
  if (dom.pauseCurtain) dom.pauseCurtain.hidden = true;
}

function exitToHub({ force = false, fromHistory = false } = {}) {
  const active = state.activeGame;
  if (!force && active && !active.finished && !active.isStub) {
    const confirmBody = document.createElement('div');
    confirmBody.style.display = 'flex';
    confirmBody.style.flexDirection = 'column';
    confirmBody.style.gap = '14px';
    confirmBody.innerHTML = `
      <p style="color: var(--text-secondary);">
        현재 진행 중인 미션을 중단하고 아케이드 로비로 돌아갈까요? (진행 기록은 저장되지 않습니다)
      </p>
      <div style="display: flex; gap: 10px; justify-content: flex-end;">
        <button type="button" class="btn-neon-ghost" id="confirm-stay-btn">계속 플레이</button>
        <button type="button" class="btn-neon-secondary" id="confirm-leave-btn">로비로 나가기</button>
      </div>
    `;
    const wasPaused = active.paused;
    if (!wasPaused) setPaused(true);

    ui.openModal({
      title: '미션을 중단할까요?',
      subtitle: 'EXIT CONFIRMATION',
      contentEl: confirmBody,
      onClose: () => {
        if (state.activeGame && !state.activeGame.finished && !wasPaused) {
          setPaused(false);
        }
      },
    });

    document.getElementById('confirm-stay-btn')?.addEventListener('click', () => {
      audio.playClick();
      ui.closeModal();
    });
    document.getElementById('confirm-leave-btn')?.addEventListener('click', () => {
      audio.playClick();
      ui.closeModal(true);
      exitToHub({ force: true });
    });
    return;
  }

  ui.closeModal(true);
  unmountActiveGame();
  resetHud();

  if (dom.gameView) dom.gameView.hidden = true;
  if (dom.lobbyView) {
    dom.lobbyView.hidden = false;
    dom.lobbyView.dataset.active = 'true';
  }

  // If the current entry was pushed when the game started, walk back so the Back button
  // never skips over the lobby and leaves the site.
  if (!fromHistory && window.history.state?.pushedByApp) {
    ignoreNextPopState = true;
    window.history.back();
  } else {
    syncUrlState({ seed: state.seed, historyMode: 'replace' });
  }

  renderGameGrid();
  renderHallOfFame();
}

function handlePopState() {
  if (ignoreNextPopState) {
    ignoreNextPopState = false;
    syncUrlState({ seed: state.seed, historyMode: 'replace' });
    return;
  }

  // Browser-initiated Back/Forward: treat leaving a game exactly like the "로비로" button
  if (state.activeGame) {
    exitToHub({ force: true, fromHistory: true });
    return;
  }

  const params = new URLSearchParams(window.location.search);
  const nextSeed = storage.normalizeSeed(params.get('seed') || state.seed);
  if (nextSeed !== state.seed) {
    state.seed = nextSeed;
    storage.addSeedHistory(nextSeed);
    const seedInput = document.getElementById('seed-input');
    if (seedInput) seedInput.value = nextSeed;
    renderSeedChips();
    renderGameGrid();
    renderHallOfFame();
  }
}

async function launchGame(gameId, requestedMode) {
  const gameMeta = GAME_MAP.get(gameId);
  if (!gameMeta) {
    ui.showToast('존재하지 않는 게임입니다.', 'error');
    return;
  }

  const validMode = gameMeta.modes.find((m) => m.id === requestedMode) || gameMeta.modes[0];
  const mode = validMode.id;
  state.selectedModes[gameId] = mode;

  // Restarting/retrying reuses the current history entry; entering from the lobby pushes one
  const wasGameActive = Boolean(state.activeGame);
  unmountActiveGame();
  ui.closeModal(true);

  if (!dom.lobbyView?.hidden) {
    syncSeedFromInput({ rerender: false });
  }
  state.seed = storage.normalizeSeed(state.seed);
  storage.addSeedHistory(state.seed);
  syncUrlState({
    seed: state.seed,
    game: gameId,
    mode,
    historyMode: wasGameActive ? 'replace' : 'push',
  });

  if (dom.lobbyView) {
    dom.lobbyView.hidden = true;
    dom.lobbyView.dataset.active = 'false';
  }
  if (dom.gameView) {
    dom.gameView.hidden = false;
  }

  resetHud();
  if (dom.hudGameTitle) dom.hudGameTitle.textContent = gameMeta.title;
  if (dom.hudModeLabel) dom.hudModeLabel.textContent = validMode.label;
  if (dom.hudSeedBadge) dom.hudSeedBadge.textContent = `#${state.seed}`;
  if (dom.hudPauseBtn) {
    dom.hudPauseBtn.textContent = '⏸';
    dom.hudPauseBtn.setAttribute('aria-label', '일시정지');
  }

  state.runCounter += 1;
  const runToken = state.runCounter;
  const player = storage.getProfile();
  const rng = createRng(`${state.seed}::${gameId}::${mode}`);

  const activeEntry = {
    id: gameId,
    mode,
    modeLabel: validMode.label,
    instance: null,
    finished: false,
    paused: false,
    runToken,
    isStub: false,
  };
  state.activeGame = activeEntry;

  const ctx = {
    seed: state.seed,
    mode,
    player,
    rng,
    audio,
    ui,
    storage,
    updateHud({ timer, score, progress, progressRatio, extra } = {}) {
      if (!state.activeGame || state.activeGame.runToken !== runToken || state.activeGame.finished) {
        return;
      }
      if (timer !== undefined && dom.hudTimer) {
        const formatted = formatTimerValue(timer);
        dom.hudTimer.textContent = formatted.text;
        dom.hudTimer.dataset.state = formatted.state;
      }
      if (score !== undefined && dom.hudScore) {
        const pts = Math.max(0, Math.round(Number(score) || 0));
        dom.hudScore.textContent = `${pts.toLocaleString('en-US')} PTS`;
      }
      if (progress !== undefined && dom.hudProgressPill) {
        if (progress === null || progress === '') {
          dom.hudProgressPill.hidden = true;
          dom.hudProgressPill.textContent = '';
        } else {
          dom.hudProgressPill.hidden = false;
          dom.hudProgressPill.textContent = String(progress);
        }
      }
      if (progressRatio !== undefined && dom.hudProgressBar) {
        const clamped = Math.max(0, Math.min(1, Number(progressRatio) || 0));
        dom.hudProgressBar.style.setProperty('--hud-progress', clamped.toFixed(4));
      }
      if (extra !== undefined && dom.hudExtraSlot) {
        dom.hudExtraSlot.innerHTML = '';
        if (extra instanceof HTMLElement) {
          dom.hudExtraSlot.appendChild(extra);
        } else if (typeof extra === 'string' && extra.trim()) {
          const badge = document.createElement('span');
          badge.className = 'hud-pill';
          badge.textContent = extra;
          dom.hudExtraSlot.appendChild(badge);
        }
      }
    },
    completeGame({ score = 0, timeMs = 0, accuracy = 0, cleared = true, modeLabel, details = [] } = {}) {
      if (!state.activeGame || state.activeGame.runToken !== runToken || state.activeGame.finished) {
        return;
      }
      state.activeGame.finished = true;
      if (dom.pauseCurtain) dom.pauseCurtain.hidden = true;
      if (dom.hudPauseBtn) {
        dom.hudPauseBtn.disabled = true;
        dom.hudPauseBtn.hidden = true;
      }

      const safeScore = Math.max(0, Math.round(Number(score) || 0));
      const safeTimeMs = Math.max(0, Math.round(Number(timeMs) || 0));
      const safeAccuracy = Math.max(0, Math.min(100, Math.round(Number(accuracy) || 0)));
      const finalModeLabel = modeLabel || validMode.label;
      const gradeInfo = ui.calculateGrade(safeScore, { cleared });

      const { isNewRecord } = storage.recordRun({
        gameId,
        mode,
        modeLabel: finalModeLabel,
        seed: state.seed,
        nickname: player.nickname,
        team: player.team,
        score: safeScore,
        timeMs: safeTimeMs,
        accuracy: safeAccuracy,
        grade: gradeInfo.grade,
        cleared,
      });

      if (cleared) {
        audio.playClear();
        if (gradeInfo.grade === 'S' || gradeInfo.grade === 'A') {
          ui.launchConfetti(gradeInfo.grade);
        }
      } else {
        audio.playAlarm();
      }

      openResultModal({
        gameMeta,
        mode,
        modeLabel: finalModeLabel,
        player,
        score: safeScore,
        timeMs: safeTimeMs,
        accuracy: safeAccuracy,
        cleared,
        gradeInfo,
        isNewRecord,
        details,
      });
    },
    exitToHub() {
      exitToHub({ force: true });
    },
  };

  try {
    const mod = await import(`./games/${gameId}.js`);
    if (!state.activeGame || state.activeGame.runToken !== runToken) return;
    if (typeof mod.mount !== 'function') {
      throw new Error(`Module ./games/${gameId}.js does not export mount()`);
    }
    dom.gameStage.innerHTML = '';
    activeEntry.instance = mod.mount(dom.gameStage, ctx);
    activeEntry.isStub = Boolean(dom.gameStage.querySelector('.game-stub'));
  } catch (err) {
    console.error(`Failed to mount game "${gameId}":`, err);
    ui.showToast('게임 모듈을 불러오는 중 오류가 발생했습니다.', 'error');
    exitToHub({ force: true });
  }
}

function openResultModal({
  gameMeta,
  mode,
  modeLabel,
  player,
  score,
  timeMs,
  accuracy,
  cleared,
  gradeInfo,
  isNewRecord,
  details,
}) {
  const timeSec = (timeMs / 1000).toFixed(1);
  const summaryLine = ui.formatResultText({
    gameId: gameMeta.id,
    gameTitle: gameMeta.title,
    modeLabel,
    player,
    grade: gradeInfo.grade,
    score,
    timeMs,
    accuracy,
    seed: state.seed,
  });

  const statRows =
    Array.isArray(details) && details.length >= 2
      ? details.slice(0, 4)
      : [
          { label: '플레이 시간', value: `${timeSec}초` },
          { label: '정확도', value: `${accuracy}%` },
          { label: '미션 상태', value: cleared ? 'CLEAR' : 'TIME / SHIELD OUT' },
          { label: '룸 시드', value: `#${state.seed}` },
        ];

  const wrap = document.createElement('div');
  wrap.style.display = 'flex';
  wrap.style.flexDirection = 'column';
  wrap.style.gap = '14px';

  wrap.innerHTML = `
    <div class="result-hero">
      <div class="rank-crest rank-crest--${gradeInfo.grade}">${gradeInfo.grade}</div>
      <div class="result-hero__info">
        <div class="result-hero__badges">
          <span class="game-card__tag">${escapeHtml(gradeInfo.badgeEn)} · ${escapeHtml(gradeInfo.titleKo)}</span>
          ${isNewRecord ? '<span class="new-record-pill">NEW RECORD!</span>' : ''}
        </div>
        <div class="result-hero__score">${score.toLocaleString('en-US')} PTS</div>
        <p class="result-hero__copy">${escapeHtml(gradeInfo.copy)}</p>
      </div>
    </div>

    <div class="result-stats">
      ${statRows
        .map(
          (row) => `
          <div class="result-stat-box">
            <span class="result-stat-box__label">${escapeHtml(row.label)}</span>
            <span class="result-stat-box__val">${escapeHtml(row.value)}</span>
          </div>`
        )
        .join('')}
    </div>

    <div class="result-preview-line">${escapeHtml(summaryLine)}</div>

    <div class="result-actions">
      <button type="button" id="result-copy-btn" class="btn-neon-primary">
        📋 결과 복사 (Slack/카톡)
      </button>
      <button type="button" id="result-retry-btn" class="btn-neon-secondary">
        🔄 다시 하기
      </button>
      <button type="button" id="result-lobby-btn" class="btn-neon-ghost">
        🕹️ 다른 게임 고르기
      </button>
    </div>
  `;

  ui.openModal({
    title: `${gameMeta.title} (${modeLabel})`,
    subtitle: cleared ? 'MISSION ACCOMPLISHED' : 'MISSION ENDED',
    contentEl: wrap,
    lockBackdrop: false,
  });

  document.getElementById('result-copy-btn')?.addEventListener('click', async () => {
    audio.playClick();
    const ok = await ui.copyToClipboard(summaryLine);
    ui.showToast(
      ok ? 'Slack / 카카오톡용 결과 1줄이 복사되었습니다!' : '복사에 실패했습니다.',
      ok ? 'success' : 'warn'
    );
  });

  document.getElementById('result-retry-btn')?.addEventListener('click', () => {
    audio.playClick();
    ui.closeModal(true);
    launchGame(gameMeta.id, mode);
  });

  document.getElementById('result-lobby-btn')?.addEventListener('click', () => {
    audio.playClick();
    exitToHub({ force: true });
  });
}

/* === Safe HTML Escaping === */
function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeAttr(str) {
  return escapeHtml(str);
}

/* === Bootstrap === */
function init() {
  cacheDom();

  const params = new URLSearchParams(window.location.search);
  const urlSeed = params.get('seed');
  const urlGame = params.get('game');
  const urlMode = params.get('mode');

  state.seed = storage.normalizeSeed(urlSeed || 'MISSION-1');
  storage.addSeedHistory(state.seed);

  if (urlGame && GAME_MAP.has(urlGame) && urlMode) {
    const gm = GAME_MAP.get(urlGame);
    if (gm.modes.some((m) => m.id === urlMode)) {
      state.selectedModes[urlGame] = urlMode;
    }
  }

  renderHeroBanner();
  renderWorkshopBar();
  renderGameGrid();
  renderHallOfFame();

  // HUD Controls
  dom.hudExitBtn?.addEventListener('click', () => {
    audio.playClick();
    exitToHub();
  });

  dom.hudRestartBtn?.addEventListener('click', () => {
    audio.playClick();
    if (!state.activeGame) return;
    const { id, mode } = state.activeGame;
    ui.showToast(`#${state.seed} 시드로 미션을 다시 시작합니다!`, 'info', 1600);
    launchGame(id, mode);
  });

  dom.hudPauseBtn?.addEventListener('click', () => {
    if (!state.activeGame || state.activeGame.finished) return;
    audio.playClick();
    setPaused(!state.activeGame.paused);
  });

  dom.pauseResumeBtn?.addEventListener('click', () => {
    audio.playClick();
    setPaused(false);
  });

  dom.hudMuteBtn?.addEventListener('click', toggleMute);

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && state.activeGame && !state.activeGame.finished && !state.activeGame.isStub) {
      setPaused(true);
    }
  });

  syncMuteButtons();

  // Host-tools popover: close on outside click or Escape
  document.addEventListener('click', (e) => {
    const details = document.querySelector('.workshop-more');
    if (details?.open && !details.contains(e.target)) details.open = false;
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const details = document.querySelector('.workshop-more');
      if (details?.open) details.open = false;
    }
  });

  window.addEventListener('popstate', handlePopState);

  // Direct deep-link launch (?seed=TEST&game=memory-match&mode=4x4)
  if (urlGame && GAME_MAP.has(urlGame)) {
    // Replace the landing entry with the lobby, then push the game on top of it
    syncUrlState({ seed: state.seed, historyMode: 'replace' });
    const modeToStart = state.selectedModes[urlGame] || GAME_MAP.get(urlGame).defaultMode;
    launchGame(urlGame, modeToStart);
  } else {
    syncUrlState({ seed: state.seed, historyMode: 'replace' });
  }
}

document.addEventListener('DOMContentLoaded', init);
