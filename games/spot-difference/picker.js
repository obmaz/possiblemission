/**
 * Entry screen for the `pick` mode:
 * - "바로 하기": choose a difficulty and play the picture the room seed picks, so everyone in
 *   the same room gets the same picture without coordinating.
 * - "그림 골라서 하기": choose a picture, then a difficulty.
 * It never scores anything: choosing calls ctx.switchMode(), which relaunches the game in the
 * chosen mode so the URL, room seed sync and records keep working.
 */
import { createRng } from '../../js/core/seed.js';
import { SPOT_DIFFICULTIES, SPOT_STAGES, spotModeId } from './stages.js';

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

  const root = document.createElement('div');
  root.className = 'game-root game-spot-difference sd-picker';
  root.innerHTML = `
    <div class="sd-picker__head">
      <h2 class="sd-picker__title" data-sd-pick-title>난이도를 고르세요</h2>
      <p class="sd-picker__sub" data-sd-pick-sub>같은 룸 시드라면 모두에게 같은 그림과 차이점이 나옵니다.</p>
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
  const chosenEl = root.querySelector('[data-sd-pick-chosen]');
  const TITLES = { start: '난이도를 고르세요', grid: '그림을 고르세요' };
  let chosen = null; // picture picked in the grid; null = let the room seed pick

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
    const card = e.target.closest('[data-stage]');
    const level = e.target.closest('[data-level]');
    const back = e.target.closest('[data-back]');
    if (card) {
      ctx.audio.playClick();
      chosen = SPOT_STAGES.find((st) => st.id === card.dataset.stage);
      chosenEl.replaceChildren(card.querySelector('.sd-pick-card__thumb').cloneNode(true));
      show('levels');
    } else if (level) {
      ctx.audio.playClick();
      ctx.switchMode(spotModeId((chosen || seededStage()).id, level.dataset.level));
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
      container.innerHTML = '';
    },
  };
}
