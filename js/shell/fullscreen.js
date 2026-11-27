/**
 * Fullscreen toggle shared by the lobby and the game view.
 * Any element with `data-fullscreen-toggle` becomes a button that flips between
 * "전체화면" and "축소하기"; the buttons are hidden where the browser has no Fullscreen API
 * (e.g. iPhone Safari).
 */

const ICON_ENTER = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>`;
const ICON_EXIT = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/><line x1="14" y1="10" x2="21" y2="3"/><line x1="3" y1="21" x2="10" y2="14"/></svg>`;

const isSupported = () => Boolean(document.fullscreenEnabled || document.webkitFullscreenEnabled);
const isFullscreen = () => Boolean(document.fullscreenElement || document.webkitFullscreenElement);

async function toggle() {
  try {
    if (isFullscreen()) {
      await (document.exitFullscreen || document.webkitExitFullscreen).call(document);
    } else {
      const root = document.documentElement;
      await (root.requestFullscreen || root.webkitRequestFullscreen).call(root);
    }
  } catch {
    // The browser refused (no user gesture, embedded frame…): the button simply stays as it was
  }
}

/** Paints every toggle button for the current state (call again after adding new buttons). */
export function syncFullscreenButtons() {
  const on = isFullscreen();
  const label = on ? '축소하기' : '전체화면';
  document.querySelectorAll('[data-fullscreen-toggle]').forEach((btn) => {
    btn.hidden = !isSupported();
    btn.setAttribute('aria-pressed', String(on));
    btn.setAttribute('aria-label', label);
    btn.title = label;
    btn.innerHTML = `${on ? ICON_EXIT : ICON_ENTER}${btn.dataset.withLabel === undefined ? '' : `<span class="hud-btn__label">${label}</span>`}`;
  });
}

/** Wires every `[data-fullscreen-toggle]` button through one delegated listener (call once). */
export function initFullscreen() {
  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-fullscreen-toggle]')) toggle();
  });
  document.addEventListener('fullscreenchange', syncFullscreenButtons);
  document.addEventListener('webkitfullscreenchange', syncFullscreenButtons);
  syncFullscreenButtons();
}
