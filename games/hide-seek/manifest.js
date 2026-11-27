/** Lobby metadata for 숫자 숨바꼭질. */
import { HIDE_SEEK_SETUP_MODE, hideSeekModeLabel } from './settings.js';

export default {
  id: 'hide-seek',
  title: '숫자 숨바꼭질',
  accent: 'crimson',
  tag: '순간 포착',
  players: 'solo',
  timeHint: '약 90초',
  summary: '타일 뒤 숨은 숫자 순간 포착',
  defaultMode: HIDE_SEEK_SETUP_MODE,
  modeLabel: hideSeekModeLabel,
  cardArt: `<div class="game-card__tile-art" aria-hidden="true">
      ${[['H', '092'], ['Q', ''], ['A', '160'], ['F', '']]
        .map(([letter, num]) => `<span class="tile-preview"><i>${num}</i><b>${letter}</b></span>`)
        .join('')}
    </div>`,
};
