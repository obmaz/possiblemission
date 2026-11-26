/**
 * Shared Solo/Party (Multi-person projector) controls for workshop call-out games.
 * Keeps setup mode toggles and MC team scoreboards uniform across games.
 */

export const PLAY_MODES = [
  { id: 0, key: 'solo', label: '혼자 (선택지)', desc: '4지선다 버튼이나 숫자키(1~4)로 직접 도전' },
  { id: 1, key: 'party', label: '다같이 (한 화면)', desc: '프로젝터·모니터를 보며 먼저 외치는 사람 승리' },
];

export const PARTY_TEAMS = [
  { id: 'A', label: 'A팀', color: '#2563eb' },
  { id: 'B', label: 'B팀', color: '#d1477f' },
  { id: 'C', label: 'C팀', color: '#16936a' },
  { id: 'D', label: 'D팀', color: '#c08419' },
];

/** Renders the Solo vs Party segmented toggle used inside setup screens. */
export function renderPlayModeSwitch(activePlayVal, prefix = 'pm') {
  return `
    <div class="${prefix}-playmode" role="radiogroup" aria-label="플레이 방식">
      ${PLAY_MODES.map(
        (m) => `
        <button
          type="button"
          class="${prefix}-playmode__btn ${activePlayVal === m.id ? 'is-active' : ''}"
          role="radio"
          aria-checked="${activePlayVal === m.id}"
          data-playmode="${m.id}"
        >
          <span class="${prefix}-playmode__title">${m.label}</span>
          <span class="${prefix}-playmode__desc">${m.desc}</span>
        </button>`
      ).join('')}
    </div>
  `;
}

/**
 * Creates a lightweight MC team scoreboard widget for Party mode.
 * Clicking a team pill awards +1 point; returns DOM node and score helpers.
 */
export function createPartyScoreboard({ onAward } = {}) {
  const scores = Object.fromEntries(PARTY_TEAMS.map((t) => [t.id, 0]));
  const el = document.createElement('div');
  el.className = 'party-board';
  el.innerHTML = `
    <span class="party-board__hint">먼저 맞힌 팀 터치 (+1점)</span>
    <div class="party-board__teams">
      ${PARTY_TEAMS.map(
        (t) => `
        <button type="button" class="party-team-btn" data-team="${t.id}" style="--team-color:${t.color};">
          <span class="party-team-btn__name">${t.label}</span>
          <strong class="party-team-btn__pts" data-team-pts="${t.id}">0</strong>
        </button>`
      ).join('')}
    </div>
  `;

  const onClick = (e) => {
    const btn = e.target.closest('[data-team]');
    if (!btn) return;
    const id = btn.dataset.team;
    scores[id] += 1;
    const ptsEl = el.querySelector(`[data-team-pts="${id}"]`);
    if (ptsEl) ptsEl.textContent = String(scores[id]);
    onAward?.(id, scores[id]);
  };
  el.addEventListener('click', onClick);

  return {
    el,
    getScores: () => ({ ...scores }),
    getTotalAwarded: () => Object.values(scores).reduce((a, b) => a + b, 0),
    getWinnerSummary: () => {
      const sorted = PARTY_TEAMS
        .map((t) => ({ ...t, pts: scores[t.id] }))
        .sort((a, b) => b.pts - a.pts);
      const top = sorted[0];
      if (!top || top.pts === 0) return '🏆 참가자 전원 박수!';
      const tied = sorted.filter((t) => t.pts === top.pts);
      return tied.length > 1
        ? `🏆 공동 1등 ${tied.map((t) => t.label).join('·')} (${top.pts}점)`
        : `🏆 1등 ${top.label} (${top.pts}점)`;
    },
    destroy() {
      el.removeEventListener('click', onClick);
    },
  };
}
