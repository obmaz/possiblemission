/** Lobby screen: hero banner, player / room-seed form and the game cards built from the registry. */
import * as audio from '../core/audio.js';
import * as storage from '../core/storage.js';
import * as ui from '../core/ui.js';
import { escapeHtml } from '../core/dom.js';
import { syncFullscreenButtons } from './screen-mode.js';
import { openBannerTitleModal, openMcGuideModal, openQrModal } from './host-modals.js';
import { getSeed, onSeedChange, randomSeed, setSeed } from './room.js';
import { ICON_SOUND_ON, syncMuteButtons, toggleMute } from './sound.js';

const PRESET_SEEDS = ['MISSION-1', 'ROUND-1', 'ROUND-2', 'ROUND-3', 'ROUND-4', 'ROUND-5'];
const HISTORY_CHIPS = 3;
const DEFAULT_HERO_TITLE = { lead: '미니게임으로', accent: '스트레스 해소!' };
const PREF_HERO_TITLE_CUSTOM = 'hero_title_custom';
const PREF_HERO_TITLE_LEAD = 'hero_title_lead';
const PREF_HERO_TITLE_ACCENT = 'hero_title_accent';

function getHeroTitle() {
  if (storage.getPref(PREF_HERO_TITLE_CUSTOM, '') !== '1') return { ...DEFAULT_HERO_TITLE };
  const lead = storage.getPref(PREF_HERO_TITLE_LEAD, '').trim().slice(0, 24);
  const accent = storage.getPref(PREF_HERO_TITLE_ACCENT, '').trim().slice(0, 24);
  if (!lead && !accent) return { ...DEFAULT_HERO_TITLE };
  return { lead, accent };
}

function saveHeroTitle(lead, accent) {
  const cleanLead = String(lead ?? '').trim().slice(0, 24);
  const cleanAccent = String(accent ?? '').trim().slice(0, 24);
  if (!cleanLead && !cleanAccent) {
    resetHeroTitle();
    return;
  }
  storage.setPref(PREF_HERO_TITLE_CUSTOM, '1');
  storage.setPref(PREF_HERO_TITLE_LEAD, cleanLead);
  storage.setPref(PREF_HERO_TITLE_ACCENT, cleanAccent);
}

function resetHeroTitle() {
  storage.setPref(PREF_HERO_TITLE_CUSTOM, '0');
  storage.setPref(PREF_HERO_TITLE_LEAD, '');
  storage.setPref(PREF_HERO_TITLE_ACCENT, '');
}

function renderHeroTitleHtml({ lead, accent }) {
  if (lead && accent) {
    return `${escapeHtml(lead)} <span class="hero-banner__title-accent">${escapeHtml(accent)}</span>`;
  }
  if (lead) return escapeHtml(lead);
  return `<span class="hero-banner__title-accent">${escapeHtml(accent)}</span>`;
}

const ICON_SETTINGS = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3.2"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.08a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.08a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`;
const ICON_PLAYER_SOLO = `<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="12" cy="7.5" r="4"/><path d="M4.5 20.5a7.5 7.5 0 0 1 15 0z"/></svg>`;
const ICON_PLAYER_GROUP = `<svg width="21" height="15" viewBox="0 0 28 24" fill="currentColor" aria-hidden="true"><circle cx="6.5" cy="9.5" r="2.9" opacity="0.72"/><path d="M1.5 20.5a5 5 0 0 1 10 0z" opacity="0.72"/><circle cx="21.5" cy="9.5" r="2.9" opacity="0.72"/><path d="M16.5 20.5a5 5 0 0 1 10 0z" opacity="0.72"/><circle cx="14" cy="7.5" r="3.6"/><path d="M7.2 21a6.8 6.8 0 0 1 13.6 0z"/></svg>`;

function renderPlayerIcons(players) {
  const solo = players === 'solo' || players === 'both';
  const group = players === 'party' || players === 'both';
  const label = solo && group ? '1인 및 다같이 플레이 가능' : group ? '다같이 플레이 가능' : '1인 플레이';
  return `
    <span class="game-card__players" aria-label="${label}">
      ${solo ? `<span class="game-card__player-chip" data-player-icon="solo" title="1인 플레이 가능">${ICON_PLAYER_SOLO}</span>` : ''}
      ${group ? `<span class="game-card__player-chip" data-player-icon="group" title="다같이(한 화면) 플레이 가능">${ICON_PLAYER_GROUP}</span>` : ''}
    </span>`;
}

function renderHero(root) {
  root.innerHTML = `
    <div class="hero-banner__media">
      <img class="hero-banner__bg" src="./assets/hero-arcade.jpg" alt="네온 아케이드 파티 배너" />
      <div class="hero-banner__scrim" aria-hidden="true"></div>
    </div>
    <div class="hero-banner__brand">
      <img class="hero-banner__logo" src="./assets/brand-logo.svg" alt="Possible Mission" />
    </div>
    <div class="hero-banner__tools">
      <button class="hero-icon-btn" type="button" data-fullscreen-toggle></button>
      <button class="hero-icon-btn" type="button" data-mute-toggle id="lobby-mute-btn">${ICON_SOUND_ON}</button>
      <details class="workshop-more">
        <summary class="hero-icon-btn" aria-label="진행자 도구" title="진행자 도구">${ICON_SETTINGS}</summary>
        <div class="workshop-more__panel">
          <div class="workshop-more__tools">
            <button class="workshop-tool-btn" type="button" data-open="qr">📱 QR 코드</button>
            <button class="workshop-tool-btn workshop-tool-btn--mc" type="button" data-open="mc">🎙️ MC 가이드</button>
            <button class="workshop-tool-btn" type="button" data-open="banner-title">✏️ 배너 타이틀</button>
          </div>
          <div class="workshop-more__seeds">
            <span class="workshop-more__label">빠른 시드</span>
            <div class="seed-chips" data-seed-chips role="group" aria-label="프리셋 룸 시드"></div>
          </div>
        </div>
      </details>
    </div>
    <div class="hero-banner__content">
      <h1 class="hero-banner__title">${renderHeroTitleHtml(getHeroTitle())}</h1>
      <p class="hero-banner__desc">
        로그인 없이 <strong>1분 컷</strong>. 같은 <strong>룸 시드</strong>만 맞추면 모두 똑같은 문제로 겨룹니다.
      </p>
      <div class="hero-banner__actions">
        <button id="hero-random-play-btn" class="btn-neon-primary" type="button">⚡ 랜덤 미션 바로 시작</button>
      </div>
    </div>
  `;
}

function renderWorkshopBar(root) {
  const profile = storage.getProfile();
  root.innerHTML = `
    <div class="workshop-bar__row">
      <label class="workshop-field workshop-field--nick">
        <span class="workshop-field__label"><span>요원 닉네임</span></span>
        <input id="player-nick-input" class="arcade-input" type="text" maxlength="12" placeholder="익명요원" value="${escapeHtml(profile.nickname)}" />
      </label>
      <label class="workshop-field workshop-field--team">
        <span class="workshop-field__label"><span>소속 팀명 (선택)</span></span>
        <input id="player-team-input" class="arcade-input" type="text" maxlength="10" placeholder="예: A조, 프로덕트팀" value="${escapeHtml(profile.team)}" />
      </label>
      <div class="workshop-field workshop-field--seed">
        <label class="workshop-field__label" for="seed-input"><span>룸 시드 (같은 시드 = 같은 문제)</span></label>
        <div class="seed-input-wrap">
          <input id="seed-input" class="arcade-input arcade-input--mono" type="text" maxlength="16" spellcheck="false" autocomplete="off" value="${escapeHtml(getSeed())}" />
          <button id="seed-apply-btn" class="btn-neon-ghost" type="button">적용</button>
        </div>
      </div>
    </div>
  `;
}

function renderCard(game) {
  const card = document.createElement('article');
  card.className = `game-card game-card--${game.accent}`;
  card.dataset.gameId = game.id;
  card.innerHTML = `
    <div class="game-card__media">
      ${game.cardArt}
      <div class="game-card__media-scrim" aria-hidden="true"></div>
      <div class="game-card__badges">
        <div class="game-card__badges-left">
          <span class="game-card__tag">${escapeHtml(game.tag)}</span>
          ${renderPlayerIcons(game.players)}
        </div>
        <span class="game-card__time">⏱ ${escapeHtml(game.timeHint)}</span>
      </div>
    </div>
    <div class="game-card__body">
      <div class="game-card__pb-bar">
        <h2 class="game-card__title">${escapeHtml(game.title)}</h2>
        <span class="game-card__summary">${escapeHtml(game.summary)}</span>
      </div>
      <button type="button" class="game-card__play" data-launch-game>
        <span>시작하기</span><span aria-hidden="true">→</span>
      </button>
    </div>
  `;
  return card;
}

/**
 * Builds the lobby inside its three placeholder sections.
 * @param {object} opts
 * @param {{ hero: HTMLElement, workshop: HTMLElement, grid: HTMLElement }} opts.mounts
 * @param {object[]} opts.games  registry manifests
 * @param {(game: object) => void} opts.onLaunch  start a game (its default mode)
 */
export function createLobby({ mounts, games, onLaunch }) {
  renderHero(mounts.hero);
  renderWorkshopBar(mounts.workshop);
  mounts.grid.replaceChildren(...games.map(renderCard));
  syncMuteButtons();
  syncFullscreenButtons();

  const seedInput = mounts.workshop.querySelector('#seed-input');
  const chipsEl = mounts.hero.querySelector('[data-seed-chips]');

  /* --- seed chips: rebuilt each time the panel opens, highlighted in place otherwise --- */
  function renderSeedChips() {
    const history = storage.getSeedHistory().filter((s) => !PRESET_SEEDS.includes(s)).slice(0, HISTORY_CHIPS);
    const chip = (seed, label, cls = '') =>
      `<button type="button" class="seed-chip ${cls}" data-seed="${seed}">${label}</button>`;
    chipsEl.innerHTML =
      PRESET_SEEDS.map((s) => chip(s, s)).join('') +
      history.map((s) => chip(s, `#${s}`, 'seed-chip--history')).join('') +
      '<button type="button" class="seed-chip" data-seed-random>🎲 랜덤</button>';
    markActiveChip();
  }

  function markActiveChip() {
    chipsEl.querySelectorAll('[data-seed]').forEach((el) => el.classList.toggle('is-active', el.dataset.seed === getSeed()));
  }

  const announceSeed = (seed) => ui.showToast(`룸 시드가 #${seed} 로 동기화되었습니다!`, 'success');

  chipsEl.addEventListener('click', (e) => {
    const chip = e.target.closest('[data-seed], [data-seed-random]');
    if (!chip) return;
    audio.playClick();
    announceSeed(setSeed(chip.dataset.seed ?? randomSeed()));
  });
  mounts.hero.querySelector('.workshop-more').addEventListener('toggle', (e) => {
    if (e.target.open) renderSeedChips();
  });
  renderSeedChips();

  onSeedChange(() => {
    seedInput.value = getSeed();
    markActiveChip();
  });

  /* --- hero actions --- */
  mounts.hero.querySelector('#hero-random-play-btn').addEventListener('click', () => {
    audio.playClick();
    commitSeedInput();
    onLaunch(games[Math.floor(Math.random() * games.length)]);
  });
  mounts.hero.querySelector('[data-open="qr"]').addEventListener('click', () => {
    audio.playClick();
    openQrModal(commitSeedInput());
  });
  mounts.hero.querySelector('[data-open="mc"]').addEventListener('click', () => {
    audio.playClick();
    openMcGuideModal();
  });
  mounts.hero.querySelector('[data-open="banner-title"]').addEventListener('click', () => {
    audio.playClick();
    const syncTitle = () => {
      mounts.hero.querySelector('.hero-banner__title').innerHTML = renderHeroTitleHtml(getHeroTitle());
    };
    mounts.hero.querySelector('.workshop-more').open = false;
    openBannerTitleModal({
      current: getHeroTitle(),
      defaults: DEFAULT_HERO_TITLE,
      onSave: (lead, accent) => {
        saveHeroTitle(lead, accent);
        syncTitle();
      },
      onReset: () => {
        resetHeroTitle();
        syncTitle();
      },
    });
  });
  mounts.hero.querySelector('#lobby-mute-btn').addEventListener('click', toggleMute);

  /* --- player profile + room seed form --- */
  const nickInput = mounts.workshop.querySelector('#player-nick-input');
  const teamInput = mounts.workshop.querySelector('#player-team-input');
  const saveProfile = () => storage.saveProfile({ nickname: nickInput.value, team: teamInput.value });
  [nickInput, teamInput].forEach((input) => {
    input.addEventListener('change', saveProfile);
    input.addEventListener('blur', saveProfile);
  });

  /** Applies whatever is typed in the seed box (normalizing it) and returns the room seed. */
  function commitSeedInput() {
    const seed = setSeed(seedInput.value);
    seedInput.value = seed;
    return seed;
  }

  const applySeed = () => {
    audio.playClick();
    announceSeed(commitSeedInput());
  };
  mounts.workshop.querySelector('#seed-apply-btn').addEventListener('click', applySeed);
  seedInput.addEventListener('change', commitSeedInput);
  seedInput.addEventListener('blur', commitSeedInput);
  seedInput.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    applySeed();
  });

  /* --- game cards --- */
  mounts.grid.addEventListener('click', (e) => {
    const card = e.target.closest('.game-card');
    if (!card || !e.target.closest('[data-launch-game]')) return;
    audio.playClick();
    commitSeedInput();
    onLaunch(games.find((g) => g.id === card.dataset.gameId));
  });

  // Host-tools popover: close on outside click or Escape
  const tools = mounts.hero.querySelector('.workshop-more');
  document.addEventListener('click', (e) => {
    if (tools.open && !tools.contains(e.target)) tools.open = false;
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') tools.open = false;
  });

  return { commitSeedInput };
}
