/**
 * Entry screen for the `pick` mode:
 * - "바로 하기": choose a difficulty and play the picture the room seed picks, so everyone in
 *   the same room gets the same picture without coordinating.
 * - "그림 골라서 하기": choose a picture, then a difficulty.
 * It never scores anything: choosing calls ctx.switchMode(), which relaunches the game in the
 * chosen mode so the URL, room seed sync and records keep working.
 */
import { createRng } from '../../js/core/seed.js';
import {
  SPOT_DIFFICULTIES,
  SPOT_MEMORIZE_DEFAULT_SEC,
  SPOT_MEMORIZE_OPTIONS,
  SPOT_STAGES,
  spotModeId,
} from './stages.js';

/**
 * Entry screen for the `pick` mode:
 * - "바로 하기": choose a difficulty and play the picture the room seed picks, so
 *   everyone in the same room gets the same picture without coordinating.
 * - "그림 골라서 하기": choose a picture, then a difficulty.
 * It never scores anything: choosing calls ctx.switchMode(), which relaunches the
 * game in the chosen mode so the URL, room seed sync and records keep working.
 * @param {HTMLElement} container
 * @param {object} ctx
 */
export function mountPicker(container, ctx) {
  const levelButtons = SPOT_DIFFICULTIES.map(
    (d) => `
      <button type="button" class="sd-level-btn sd-level-btn--${d.id}" data-level="${d.id}">
        <span class="sd-level-btn__label">${d.label}</span>
        <span class="sd-level-btn__meta">차이 ${d.count}곳 · ${d.timeSec}초</span>
        <span class="sd-level-btn__note">${d.note}</span>
      </button>`
  ).join('');

  const memorizeChips = SPOT_MEMORIZE_OPTIONS.map(
    (sec) => `
      <button type="button" class="sd-mem-chip${sec === SPOT_MEMORIZE_DEFAULT_SEC ? ' is-active' : ''}" data-memorize="${sec}">
        ${sec === 60 ? '1분 (60초)' : `${sec}초`}
      </button>`
  ).join('');

  const root = document.createElement('div');
  root.className = 'game-root game-spot-difference sd-picker';
  root.innerHTML = `
    <div class="sd-picker__head">
      <h2 class="sd-picker__title" data-sd-pick-title>난이도를 고르세요</h2>
      <p class="sd-picker__sub" data-sd-pick-sub>같은 룸 시드라면 모두에게 같은 그림과 차이점이 나옵니다.</p>
    </div>

    <div class="sd-picker__mode-box">
      <div class="sd-play-mode" role="group" aria-label="플레이 방식">
        <button type="button" class="sd-play-mode__btn is-active" data-play-mode="solo" aria-pressed="true">
          👤 혼자하기 (좌우 비교)
        </button>
        <button type="button" class="sd-play-mode__btn" data-play-mode="party" aria-pressed="false">
          👥 다같이 (기억해서 찾기)
        </button>
      </div>
      <div class="sd-memorize-bar" data-memorize-bar hidden>
        <span class="sd-memorize-bar__label">외우는 시간</span>
        <div class="sd-memorize-bar__chips">${memorizeChips}</div>
      </div>
    </div>

    <div class="sd-picker__start" data-view="start">
      <div class="sd-picker__level-list">${levelButtons}</div>
      <button type="button" class="sd-picker__browse" data-browse>🖼️ 그림 골라서 하기</button>
    </div>

    <div class="sd-picker__grid" data-view="grid" hidden>
      ${SPOT_STAGES.map(
        (stage) => `
        <button type="button" class="sd-pick-card" data-stage="${stage.id}">
          <span class="sd-pick-card__thumb" data-thumb="${stage.id}">
            ${stage.thumb ? `<img src="${stage.thumb}" alt="" loading="lazy" />` : ''}
          </span>
          <span class="sd-pick-card__title">${stage.titleKo}</span>
        </button>`
      ).join('')}
      <button type="button" class="sd-picker__back" data-back="start">← 난이도로 돌아가기</button>
    </div>

    <div class="sd-picker__levels" data-view="levels" hidden>
      <div class="sd-picker__chosen" data-sd-pick-chosen></div>
      <div class="sd-picker__level-list">${levelButtons}</div>
      <button type="button" class="sd-picker__back" data-back="grid">← 다른 그림 고르기</button>
    </div>
  `;
  container.appendChild(root);

  const titleEl = root.querySelector('[data-sd-pick-title]');
  const subEl = root.querySelector('[data-sd-pick-sub]');
  const chosenEl = root.querySelector('[data-sd-pick-chosen]');
  const memorizeBarEl = root.querySelector('[data-memorize-bar]');
  const TITLES = { start: '난이도를 고르세요', grid: '그림을 고르세요' };
  let chosen = null; // picture picked in the grid; null = let the room seed pick
  let isParty = false;
  let memorizeSec = SPOT_MEMORIZE_DEFAULT_SEC;

  const syncPlayModeUi = () => {
    root.querySelectorAll('[data-play-mode]').forEach((btn) => {
      const active = (btn.dataset.playMode === 'party') === isParty;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-pressed', String(active));
    });
    if (memorizeBarEl) memorizeBarEl.hidden = !isParty;
    if (subEl) {
      subEl.textContent = isParty
        ? '원래 그림 1장만 먼저 보고 외운 뒤, 그림이 바뀌면 틀린 곳을 찾습니다. (중간에 바로 시작 가능)'
        : '같은 룸 시드라면 모두에게 같은 그림과 차이점이 나옵니다.';
    }
  };

  const show = (view) => {
    root.querySelectorAll('[data-view]').forEach((el) => {
      el.hidden = el.dataset.view !== view;
    });
    if (view !== 'levels') chosen = null;
    titleEl.textContent = TITLES[view] || `${chosen.titleKo} · 난이도를 고르세요`;
    root.querySelector(`[data-view="${view}"] button`)?.focus({ preventScroll: true });
  };

  /** Same room seed → same picture for everyone. */
  const seededStage = () => {
    const rng = createRng(`${ctx.seed}::spot-difference::picture`);
    return SPOT_STAGES[Math.floor(rng() * SPOT_STAGES.length)];
  };

  const onClick = (e) => {
    const modeBtn = e.target.closest('[data-play-mode]');
    const memBtn = e.target.closest('[data-memorize]');
    const card = e.target.closest('[data-stage]');
    const level = e.target.closest('[data-level]');
    const back = e.target.closest('[data-back]');
    if (modeBtn) {
      ctx.audio.playClick();
      isParty = modeBtn.dataset.playMode === 'party';
      syncPlayModeUi();
    } else if (memBtn) {
      ctx.audio.playClick();
      memorizeSec = Number(memBtn.dataset.memorize) || SPOT_MEMORIZE_DEFAULT_SEC;
      root.querySelectorAll('[data-memorize]').forEach((b) => {
        b.classList.toggle('is-active', Number(b.dataset.memorize) === memorizeSec);
      });
    } else if (card) {
      ctx.audio.playClick();
      chosen = SPOT_STAGES.find((st) => st.id === card.dataset.stage);
      chosenEl.replaceChildren(card.querySelector('.sd-pick-card__thumb').cloneNode(true));
      show('levels');
    } else if (level) {
      ctx.audio.playClick();
      ctx.switchMode(spotModeId((chosen || seededStage()).id, level.dataset.level, isParty ? memorizeSec : 0));
    } else if (e.target.closest('[data-browse]')) {
      ctx.audio.playClick();
      show('grid');
    } else if (back) {
      ctx.audio.playClick();
      show(back.dataset.back);
    }
  };
  root.addEventListener('click', onClick);
  root.querySelector('[data-view="start"] [data-level="normal"]')?.focus({ preventScroll: true });

  return {
    idle: true,
    unmount() {
      root.removeEventListener('click', onClick);
    },
  };
}
