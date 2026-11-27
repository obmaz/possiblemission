/** Mute toggle shared by the lobby (hero button) and the game menu. */
import * as audio from '../core/audio.js';
import * as ui from '../core/ui.js';

export const ICON_SOUND_ON = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M18.8 5.8a9 9 0 0 1 0 12.4"/></svg>`;
export const ICON_SOUND_OFF = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor"/><line x1="22" y1="9" x2="16" y2="15"/><line x1="16" y1="9" x2="22" y2="15"/></svg>`;

/** Repaints every `[data-mute-toggle]` button (lobby icon button, game menu item). */
export function syncMuteButtons() {
  const muted = audio.isMuted();
  const label = muted ? '소리 꺼짐' : '소리 켜짐';
  document.querySelectorAll('[data-mute-toggle]').forEach((btn) => {
    const icon = muted ? ICON_SOUND_OFF : ICON_SOUND_ON;
    btn.innerHTML = btn.dataset.withLabel === undefined ? icon : `${icon.replace(/width="20" height="20"/, 'width="16" height="16"')}<span>${label}</span>`;
    btn.classList.toggle('is-muted', muted);
    btn.setAttribute('aria-pressed', String(muted));
    btn.setAttribute('aria-label', label);
    btn.title = label;
  });
}

export function toggleMute() {
  const next = !audio.isMuted();
  audio.setMuted(next);
  syncMuteButtons();
  if (!next) audio.playClick();
  ui.showToast(next ? '사운드 효과를 껐습니다.' : '아케이드 사운드 ON!', 'info', 1600);
}
