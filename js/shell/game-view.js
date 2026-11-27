/**
 * The shared game screen chrome: the top bar (exit, title, pause, fullscreen, hide layout, ⋯ menu).
 * It deliberately shows no timer or score: every mini-game renders its own.
 */
import * as audio from '../core/audio.js';
import * as ui from '../core/ui.js';

const ICON_PAUSE = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="6" y="4" width="4" height="16" rx="1" fill="currentColor"/><rect x="14" y="4" width="4" height="16" rx="1" fill="currentColor"/></svg>`;
const ICON_PLAY = `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><polygon points="6 4 20 12 6 20 6 4"/></svg>`;

/**
 * @param {object} opts
 * @param {HTMLElement} opts.view  `#game-view`
 * @param {ReturnType<import('./runner.js').createRunner>} opts.runner
 * @param {() => void} opts.onExit       leave the game (no confirmation)
 * @param {() => void} opts.onRestart    restart the current run
 * @param {() => void} opts.onToggleMute
 */
export function createGameView({ view, runner, onExit, onRestart, onToggleMute }) {
  const $ = (id) => view.querySelector(`#${id}`);
  const els = {
    title: $('hud-game-title'),
    mode: $('hud-mode-label'),
    seed: $('hud-seed-badge'),
    pause: $('hud-pause-btn'),
    menu: $('hud-menu'),
    moreBtn: $('hud-more-btn'),
    mute: $('hud-mute-btn'),
  };
  let layoutHidden = false;

  /* --- shared layout: collapse the top bar so the game can use more of the screen --- */
  function setLayoutHidden(hidden) {
    layoutHidden = hidden;
    view.dataset.layout = hidden ? 'hidden' : 'shown';
    const label = hidden ? '레이아웃 보이기' : '레이아웃 숨기기';
    view.querySelectorAll('[data-layout-toggle]').forEach((btn) => {
      btn.setAttribute('aria-label', hidden ? '공통 레이아웃 보이기' : '공통 레이아웃 가리기');
      btn.title = hidden ? '공통 레이아웃 보이기' : '공통 레이아웃 가리기 (게임 화면만 크게)';
      btn.querySelector('[data-layout-label]').textContent = label;
    });
    closeMenu();
  }

  /* --- ⋯ menu --- */
  function closeMenu() {
    els.menu.hidden = true;
    els.moreBtn.setAttribute('aria-expanded', 'false');
  }

  function toggleMenu() {
    const open = els.menu.hidden;
    els.menu.hidden = !open;
    els.moreBtn.setAttribute('aria-expanded', String(open));
  }

  /* --- pause button --- */
  function setPauseIcon(paused) {
    els.pause.innerHTML = paused ? ICON_PLAY : ICON_PAUSE;
    els.pause.setAttribute('aria-label', paused ? '재개' : '일시정지');
    els.pause.title = paused ? '재개' : '일시정지';
  }

  /** Leaving mid-run asks first (the run is not saved); finished runs and choosers just leave. */
  function requestExit({ force = false } = {}) {
    const active = runner.active;
    if (force || !active || active.finished || active.idle) {
      onExit();
      return;
    }

    const wasPaused = active.paused;
    if (!wasPaused) runner.setPaused(true);

    const body = document.createElement('div');
    body.className = 'confirm-body';
    body.innerHTML = `
      <p>현재 진행 중인 미션을 중단하고 아케이드 로비로 돌아갈까요? (진행 기록은 저장되지 않습니다)</p>
      <div class="confirm-body__actions">
        <button type="button" class="btn-neon-ghost" data-confirm="stay" id="confirm-stay-btn">계속 플레이</button>
        <button type="button" class="btn-neon-secondary" data-confirm="leave" id="confirm-leave-btn">로비로 나가기</button>
      </div>
    `;
    body.addEventListener('click', (e) => {
      const choice = e.target.closest('[data-confirm]')?.dataset.confirm;
      if (!choice) return;
      audio.playClick();
      if (choice === 'stay') {
        ui.closeModal();
      } else {
        ui.closeModal(true);
        onExit();
      }
    });
    ui.openModal({
      title: '미션을 중단할까요?',
      subtitle: 'EXIT CONFIRMATION',
      contentEl: body,
      onClose: () => {
        const current = runner.active;
        if (current && !current.finished && !wasPaused) runner.setPaused(false);
      },
    });
  }

  /* --- wiring --- */
  $('hud-exit-btn').addEventListener('click', () => {
    audio.playClick();
    requestExit();
  });
  els.pause.addEventListener('click', () => {
    audio.playClick();
    runner.togglePause();
  });
  $('hud-restart-btn').addEventListener('click', () => {
    audio.playClick();
    closeMenu();
    onRestart();
  });
  els.mute.addEventListener('click', () => {
    onToggleMute();
    closeMenu();
  });
  els.moreBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleMenu();
  });
  $('hud-layout-btn').addEventListener('click', () => {
    audio.playClick();
    setLayoutHidden(!layoutHidden);
  });
  document.addEventListener('click', (e) => {
    if (!els.menu.hidden && !els.menu.contains(e.target) && e.target !== els.moreBtn) closeMenu();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeMenu();
  });

  setLayoutHidden(false);

  return {
    requestExit,
    /** A game or chooser is being mounted: show who is playing and reset the pause button. */
    enter({ title, modeLabel, seed }) {
      view.hidden = false;
      closeMenu();
      els.title.textContent = title;
      els.mode.textContent = modeLabel;
      els.seed.textContent = `#${seed}`;
      els.pause.hidden = false;
      setPauseIcon(false);
    },
    leave() {
      view.hidden = true;
      closeMenu();
    },
    setPaused: setPauseIcon,
    hidePause() {
      els.pause.hidden = true;
    },
    get layoutHidden() {
      return layoutHidden;
    },
  };
}
