/** Result popup shown when a game calls `ctx.completeGame()`. */
import * as audio from '../core/audio.js';
import * as ui from '../core/ui.js';
import { escapeHtml } from '../core/dom.js';

/**
 * @param {object} opts
 * @param {string} opts.title        modal title, e.g. "도블 스피드 매치 (EASY)"
 * @param {number} opts.score
 * @param {number} opts.timeMs
 * @param {boolean} opts.cleared
 * @param {boolean} opts.isNewRecord
 * @param {{ value: string }[]} opts.details  self-explanatory stat chips (icon + number + unit)
 * @param {{ onLobby: () => void, onChangeLevel: () => void, onRetry: () => void }} opts.actions
 */
export function openResultModal({ title, score, timeMs, cleared, isNewRecord, details, actions }) {
  const stats =
    Array.isArray(details) && details.length > 0
      ? details.slice(0, 4).map((row) => row.value)
      : [`⏱ ${(timeMs / 1000).toFixed(1)}초`];

  const body = document.createElement('div');
  body.className = 'result-body';
  body.innerHTML = `
    <div class="result-hero ${cleared ? 'is-clear' : 'is-fail'}">
      <span class="result-hero__status">${cleared ? '성공' : '실패'}</span>
      <div class="result-hero__score">${score.toLocaleString('en-US')}점</div>
      ${isNewRecord ? '<span class="new-record-pill">최고 기록!</span>' : ''}
    </div>
    <div class="result-stats">
      ${stats.map((value) => `<div class="result-stat-box">${escapeHtml(value)}</div>`).join('')}
    </div>
    <div class="result-actions">
      <button type="button" data-result="lobby" class="btn-neon-ghost" id="result-lobby-btn">로비</button>
      <button type="button" data-result="change" class="btn-neon-secondary" id="result-change-btn">난이도 변경</button>
      <button type="button" data-result="retry" class="btn-neon-primary" id="result-retry-btn">재도전</button>
    </div>
  `;

  const handlers = { lobby: actions.onLobby, change: actions.onChangeLevel, retry: actions.onRetry };
  body.addEventListener('click', (e) => {
    const key = e.target.closest('[data-result]')?.dataset.result;
    if (!key) return;
    audio.playClick();
    ui.closeModal(true);
    handlers[key]();
  });

  // A finished run must always offer retry / change difficulty / lobby, so it cannot be dismissed
  ui.openModal({ title, contentEl: body, dismissible: false });
}
