/**
 * POSSIBLE MISSION — Arcade Hub Controller, URL/Seed Sync, Dynamic Router & Game Context
 */
import { createRng } from './core/seed.js';
import * as audio from './core/audio.js';
import * as storage from './core/storage.js';
import * as ui from './core/ui.js';
import { SPOT_PICK_MODE, spotCatalogModes } from './games/spot-stages.js';
import {
  HIDE_SEEK_SETUP_MODE,
  hideSeekCatalogModes,
  hideSeekModeLabel,
  parseHideSeekMode,
} from './games/hide-seek-settings.js';

const PRESET_SEEDS = ['MISSION-1', 'ROUND-1', 'ROUND-2', 'ROUND-3', 'ROUND-4', 'ROUND-5'];

const GAME_CATALOG = [
  {
    id: 'spot-difference',
    title: '틀린그림찾기',
    subEn: 'SPOT THE DIFFERENCE',
    accent: 'magenta',
    tag: '매의 눈',
    timeHint: '75~90초',
    hook: '그림 10장 중 하나를 고르고 난이도를 선택하세요. 좌우 그림에서 달라진 곳을 빠르게 짚어내는 눈썰미 대결!',
    defaultMode: SPOT_PICK_MODE,
    modes: spotCatalogModes(),
  },
  {
    id: 'memory-match',
    title: '메모리 매치',
    subEn: 'MEMORY MATCH',
    accent: 'violet',
    art: 'memory',
    tag: '단기기억',
    timeHint: '45~80초',
    hook: '2초 동안 카드를 외운 뒤 같은 그림 짝을 찾으세요. 고속열차·트램·자기부상열차 등 철도 카드도 섞여 나옵니다!',
    defaultMode: 'setup',
    modes: [
      { id: 'setup', label: '난이도 선택', thumb: null },
      { id: '4x3', label: '4×3 웜업', thumb: null },
      { id: '4x4', label: '4×4 스탠다드', thumb: null },
      { id: '6x4', label: '6×4 마스터', thumb: null },
    ],
  },
  {
    id: 'despair-fortress', // id kept so existing links and records keep working
    title: '숫자 숨바꼭질',
    subEn: 'NUMBER HIDE & SEEK',
    accent: 'crimson',
    art: 'tiles',
    tag: '순간 포착',
    timeHint: '약 90초',
    hook: '글자 타일 뒤에 숨었다 고개를 내미는 숫자를 찾아 그 타일의 글자를 맞히세요. EASY부터 GOD까지 난이도를 직접 고릅니다!',
    defaultMode: HIDE_SEEK_SETUP_MODE,
    modes: hideSeekCatalogModes(),
    // Custom settings live in the mode id (custom-…), so accept any valid one
    resolveMode: (id) => (parseHideSeekMode(id) ? { id, label: hideSeekModeLabel(id), thumb: null } : null),
  },
];

/** Hand-made lobby card artwork for games whose look isn't a stage photo. */
const CARD_ART = {
  memory: `<div class="game-card__memory-art" aria-hidden="true">
      <div class="memory-preview-tile">🚄</div>
      <div class="memory-preview-tile">⚡</div>
      <div class="memory-preview-tile">💎</div>
    </div>`,
  tiles: `<div class="game-card__tile-art" aria-hidden="true">
      ${[['H', '092'], ['Q', ''], ['A', '160'], ['F', '']]
        .map(([l, n]) => `<span class="tile-preview"><i>${n}</i><b>${l}</b></span>`)
        .join('')}
    </div>`,
};

const GAME_MAP = new Map(GAME_CATALOG.map((g) => [g.id, g]));

/** A game's mode entry: a catalog mode, or a dynamic one the game knows how to parse. */
function findMode(game, id) {
  return game.modes.find((m) => m.id === id) || game.resolveMode?.(id) || null;
}

const state = {
  seed: 'MISSION-1',
  activeGame: null, // { id, mode, instance, finished, paused, runToken, idle }
  runCounter: 0,
};

/* === DOM References === */
const dom = {};

function cacheDom() {
  dom.lobbyView = document.getElementById('lobby-view');
  dom.heroBanner = document.getElementById('hero-banner');
  dom.workshopBar = document.getElementById('workshop-bar');
  dom.gameGrid = document.getElementById('game-grid');

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
      url.searchParams.set('mode', mode || GAME_MAP.get(game)?.defaultMode || '');
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
      mode: game ? mode || GAME_MAP.get(game)?.defaultMode || '' : null,
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
    dom.hudMuteBtn.textContent = `${icon} 사운드 ${muted ? '꺼짐' : '켜짐'}`;
    dom.hudMuteBtn.setAttribute('aria-pressed', String(muted));
  }
  const lobbyMuteBtn = document.getElementById('lobby-mute-btn');
  if (lobbyMuteBtn) {
    lobbyMuteBtn.textContent = muted ? '🔇 소리 꺼짐' : '🔊 소리 켜짐';
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
      </div>
    </div>
  `;

  document.getElementById('hero-random-play-btn')?.addEventListener('click', () => {
    audio.playClick();
    syncSeedFromInput({ rerender: false });
    const game = GAME_CATALOG[Math.floor(Math.random() * GAME_CATALOG.length)];
    launchGame(game.id, game.defaultMode);
  });
}

function renderWorkshopBar() {
  if (!dom.workshopBar) return;
  const profile = storage.getProfile();

  dom.workshopBar.innerHTML = `
    <div class="workshop-bar__row">
      <label class="workshop-field workshop-field--nick">
        <span class="workshop-field__label">
          <span>요원 닉네임</span>
        </span>
        <input
          id="player-nick-input"
          class="arcade-input"
          type="text"
          maxlength="12"
          placeholder="익명요원"
          value="${escapeHtml(profile.nickname)}"
        />
      </label>

      <label class="workshop-field workshop-field--team">
        <span class="workshop-field__label">
          <span>소속 팀명 (선택)</span>
        </span>
        <input
          id="player-team-input"
          class="arcade-input"
          type="text"
          maxlength="10"
          placeholder="예: A조, 프로덕트팀"
          value="${escapeHtml(profile.team)}"
        />
      </label>

      <div class="workshop-field workshop-field--seed">
        <label class="workshop-field__label" for="seed-input">
          <span>룸 시드 (같은 시드 = 같은 문제)</span>
        </label>
        <div class="seed-input-wrap">
          <input
            id="seed-input"
            class="arcade-input arcade-input--mono"
            type="text"
            maxlength="16"
            spellcheck="false"
            autocomplete="off"
            value="${escapeHtml(state.seed)}"
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
          🔊 소리 켜짐
        </button>
        <details class="workshop-more">
          <summary class="workshop-tool-btn">🎛️ 진행자 도구</summary>
          <div class="workshop-more__panel">
            <div class="workshop-more__tools">
              <button id="open-qr-btn" class="workshop-tool-btn" type="button">📱 QR 코드</button>
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

  GAME_CATALOG.forEach((game) => {
    const card = document.createElement('article');
    card.className = `game-card game-card--${game.accent}`;
    card.dataset.gameId = game.id;

    const thumb = game.modes.find((m) => m.thumb)?.thumb;
    const mediaHtml =
      CARD_ART[game.art] ||
      `<img class="game-card__img" src="${thumb}" alt="${escapeHtml(game.title)} 미리보기" loading="lazy" />`;

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
        </div>
      </div>

      <div class="game-card__body">
        <h2 class="game-card__title">${game.title}</h2>
        <p class="game-card__hook">${game.hook}</p>
        <button type="button" class="game-card__play" data-launch-game>
          <span>시작하기</span>
          <span aria-hidden="true">→</span>
        </button>
      </div>
    `;

    // Every game opens its own difficulty / picture chooser first
    card.querySelector('[data-launch-game]')?.addEventListener('click', () => {
      audio.playClick();
      syncSeedFromInput({ rerender: false });
      launchGame(game.id, game.defaultMode);
    });

    dom.gameGrid.appendChild(card);
  });
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
          <strong>🎛️ 진행자 도구 → QR 코드</strong>를 회의실 프로젝터에 띄우거나 <strong>링크 복사</strong>로 Slack/카톡방에 뿌려주세요.
          같은 시드(예: <code>ROUND-1</code>)에서는 100명 모두 <strong>100% 동일한 문제 배치</strong>가 출제됩니다.
        </div>
      </div>
    </div>
    <div class="mc-step">
      <div class="mc-step__num">2</div>
      <div>
        <div class="mc-step__title">MC의 "3, 2, 1, 출격!" 카운트다운에 맞춰 동시 플레이</div>
        <div class="mc-step__desc">
          참가자들은 닉네임과 팀명을 입력한 뒤 지정된 게임의 <strong>시작하기</strong>를 누르고, 게임 안에서 같은 난이도를 고릅니다.
          탭 전환 시 공정 플레이 커튼이 작동해 반칙을 방지합니다.
        </div>
      </div>
    </div>
    <div class="mc-step">
      <div class="mc-step__num">3</div>
      <div>
        <div class="mc-step__title">결과 화면의 점수로 순위 발표!</div>
        <div class="mc-step__desc">
          게임이 끝나면 각자 화면에 <strong>점수</strong>가 크게 표시됩니다. MC가 점수를 확인해 순위를 발표하세요.
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

/* === Active Game HUD & Lifecycle === */
function closeHudMenu() {
  const hudMenu = document.getElementById('hud-menu');
  const hudMoreBtn = document.getElementById('hud-more-btn');
  if (hudMenu) hudMenu.hidden = true;
  if (hudMoreBtn) hudMoreBtn.setAttribute('aria-expanded', 'false');
}

// Last values written to the HUD. Games call updateHud() every frame, so only
// touch the DOM when a value actually changes.
const hudCache = { timerText: null, timerState: null, score: null, progress: null, ratio: null, extra: null };

function clearHudCache() {
  Object.keys(hudCache).forEach((key) => {
    hudCache[key] = null;
  });
}

function resetHud() {
  clearHudCache();
  closeHudMenu();
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
  if (!force && active && !active.finished && !active.idle) {
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
  if (params.has('game')) {
    // Forward into an old game entry while sitting in the lobby: games are only started
    // from the lobby, so rewrite the entry to match what is on screen (otherwise a reload
    // would unexpectedly deep-link into that game).
    syncUrlState({ seed: nextSeed, historyMode: 'replace' });
  }
  if (nextSeed !== state.seed) {
    state.seed = nextSeed;
    storage.addSeedHistory(nextSeed);
    const seedInput = document.getElementById('seed-input');
    if (seedInput) seedInput.value = nextSeed;
    renderSeedChips();
    renderGameGrid();
  }
}

async function launchGame(gameId, requestedMode) {
  const gameMeta = GAME_MAP.get(gameId);
  if (!gameMeta) {
    ui.showToast('존재하지 않는 게임입니다.', 'error');
    return;
  }

  const validMode = findMode(gameMeta, requestedMode) || gameMeta.modes[0];
  const mode = validMode.id;

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
    idle: false,
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
        if (formatted.text !== hudCache.timerText) {
          hudCache.timerText = formatted.text;
          dom.hudTimer.textContent = formatted.text;
        }
        if (formatted.state !== hudCache.timerState) {
          hudCache.timerState = formatted.state;
          dom.hudTimer.dataset.state = formatted.state;
        }
      }
      if (score !== undefined && dom.hudScore) {
        const pts = Math.max(0, Math.round(Number(score) || 0));
        if (pts !== hudCache.score) {
          hudCache.score = pts;
          dom.hudScore.textContent = `${pts.toLocaleString('en-US')} PTS`;
        }
      }
      if (progress !== undefined && dom.hudProgressPill) {
        const text = progress === null ? '' : String(progress);
        if (text !== hudCache.progress) {
          hudCache.progress = text;
          dom.hudProgressPill.hidden = text === '';
          dom.hudProgressPill.textContent = text;
        }
      }
      if (progressRatio !== undefined && dom.hudProgressBar) {
        const ratioStr = Math.max(0, Math.min(1, Number(progressRatio) || 0)).toFixed(4);
        if (ratioStr !== hudCache.ratio) {
          hudCache.ratio = ratioStr;
          dom.hudProgressBar.style.setProperty('--hud-progress', ratioStr);
        }
      }
      if (extra !== undefined && dom.hudExtraSlot) {
        if (extra instanceof HTMLElement) {
          hudCache.extra = null;
          dom.hudExtraSlot.replaceChildren(extra);
        } else {
          const text = typeof extra === 'string' ? extra.trim() : '';
          if (text !== hudCache.extra) {
            hudCache.extra = text;
            if (text) {
              const badge = document.createElement('span');
              badge.className = 'hud-pill';
              badge.textContent = text;
              dom.hudExtraSlot.replaceChildren(badge);
            } else {
              dom.hudExtraSlot.replaceChildren();
            }
          }
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
        score: safeScore,
        timeMs: safeTimeMs,
        cleared,
        isNewRecord,
        details,
      });
    },
    exitToHub() {
      exitToHub({ force: true });
    },
    /** Relaunches this game in another of its modes (used by in-game pickers). */
    switchMode(nextMode) {
      if (!state.activeGame || state.activeGame.runToken !== runToken) return;
      if (!findMode(gameMeta, nextMode)) return;
      launchGame(gameId, nextMode);
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
    // Idle screens (e.g. a picture picker) have no run to lose: no exit confirm, no pause
    activeEntry.idle = Boolean(activeEntry.instance?.idle);
    if (activeEntry.idle && dom.hudPauseBtn) dom.hudPauseBtn.hidden = true;
  } catch (err) {
    console.error(`Failed to mount game "${gameId}":`, err);
    ui.showToast('게임 모듈을 불러오는 중 오류가 발생했습니다.', 'error');
    exitToHub({ force: true });
  }
}

function openResultModal({ gameMeta, mode, modeLabel, score, timeMs, cleared, isNewRecord, details }) {
  // Each detail is a self-explanatory value (icon + number + unit), no labels
  const statRows =
    Array.isArray(details) && details.length > 0
      ? details.slice(0, 4).map((row) => row.value)
      : [`⏱ ${(timeMs / 1000).toFixed(1)}초`];

  const wrap = document.createElement('div');
  wrap.className = 'result-body';
  wrap.innerHTML = `
    <div class="result-hero ${cleared ? 'is-clear' : 'is-fail'}">
      <span class="result-hero__status">${cleared ? '성공' : '실패'}</span>
      <div class="result-hero__score">${score.toLocaleString('en-US')}점</div>
      ${isNewRecord ? '<span class="new-record-pill">최고 기록!</span>' : ''}
    </div>

    <div class="result-stats">
      ${statRows.map((value) => `<div class="result-stat-box">${escapeHtml(value)}</div>`).join('')}
    </div>

    <div class="result-actions">
      <button type="button" id="result-retry-btn" class="btn-neon-primary">다시 하기</button>
      <button type="button" id="result-change-btn" class="btn-neon-secondary">난이도 바꾸기</button>
      <button type="button" id="result-lobby-btn" class="btn-neon-ghost">다른 게임</button>
    </div>
  `;

  ui.openModal({
    title: `${gameMeta.title} (${modeLabel})`,
    contentEl: wrap,
    lockBackdrop: false,
  });

  document.getElementById('result-retry-btn')?.addEventListener('click', () => {
    audio.playClick();
    ui.closeModal(true);
    launchGame(gameMeta.id, mode);
  });

  document.getElementById('result-change-btn')?.addEventListener('click', () => {
    audio.playClick();
    ui.closeModal(true);
    launchGame(gameMeta.id, gameMeta.defaultMode);
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

/* === Bootstrap === */
function init() {
  cacheDom();

  const params = new URLSearchParams(window.location.search);
  const urlSeed = params.get('seed');
  const urlGame = params.get('game');
  const urlMode = params.get('mode');

  state.seed = storage.normalizeSeed(urlSeed || 'MISSION-1');
  storage.addSeedHistory(state.seed);

  renderHeroBanner();
  renderWorkshopBar();
  renderGameGrid();

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

  dom.hudMuteBtn?.addEventListener('click', () => {
    toggleMute();
    closeHudMenu();
  });

  const hudMoreBtn = document.getElementById('hud-more-btn');
  const hudMenu = document.getElementById('hud-menu');
  const toggleHudMenu = () => {
    if (!hudMenu || !hudMoreBtn) return;
    const open = hudMenu.hidden;
    hudMenu.hidden = !open;
    hudMoreBtn.setAttribute('aria-expanded', String(open));
  };
  hudMoreBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleHudMenu();
  });
  document.addEventListener('click', (e) => {
    if (!hudMenu || hudMenu.hidden) return;
    if (hudMenu.contains(e.target) || e.target === hudMoreBtn) return;
    closeHudMenu();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeHudMenu();
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && state.activeGame && !state.activeGame.finished && !state.activeGame.idle) {
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
    launchGame(urlGame, urlMode || GAME_MAP.get(urlGame).defaultMode);
  } else {
    syncUrlState({ seed: state.seed, historyMode: 'replace' });
  }
}

document.addEventListener('DOMContentLoaded', init);
