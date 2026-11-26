/**
 * Shared Solo/Party (Multi-person shared-screen) toggle for workshop call-out games.
 * Party mode is individual/everyone-together on one screen (no team scoreboard).
 */

export const PLAY_MODES = [
  { id: 0, key: 'solo', label: '혼자 (선택지)', desc: '버튼이나 키보드로 직접 정답 선택' },
  { id: 1, key: 'party', label: '다같이 (한 화면)', desc: '한 화면을 보며 먼저 외치는 사람 승리' },
];

/** Renders the Solo vs Party segmented toggle used inside setup screens. */
export function renderPlayModeSwitch(activePlayVal, prefix = 'pm', soloOverride = '') {
  const soloDescOverride = typeof soloOverride === 'string' ? soloOverride : soloOverride?.desc || '';
  const soloLabelOverride = typeof soloOverride === 'object' ? soloOverride?.label || '' : '';
  return `
    <div class="${prefix}-playmode" role="radiogroup" aria-label="플레이 방식">
      ${PLAY_MODES.map((m) => {
        const label = m.id === 0 && soloLabelOverride ? soloLabelOverride : m.label;
        const desc = m.id === 0 && soloDescOverride ? soloDescOverride : m.desc;
        return `
        <button
          type="button"
          class="${prefix}-playmode__btn ${activePlayVal === m.id ? 'is-active' : ''}"
          role="radio"
          aria-checked="${activePlayVal === m.id}"
          data-playmode="${m.id}"
        >
          <span class="${prefix}-playmode__title">${label}</span>
          <span class="${prefix}-playmode__desc">${desc}</span>
        </button>`;
      }).join('')}
    </div>
  `;
}
