/** Lobby metadata for 플래시 암산. */
import { ANZAN_SETUP_MODE, anzanModeLabel } from './settings.js';

export default {
  id: 'flash-anzan',
  title: '플래시 암산',
  accent: 'cyan',
  tag: '암산',
  players: 'both',
  timeHint: '약 60초',
  summary: '번쩍이는 숫자 연속 암산',
  defaultMode: ANZAN_SETUP_MODE,
  modeLabel: anzanModeLabel,
  cardArt: `<div class="game-card__anzan-art" aria-hidden="true">
      <span class="anzan-preview__count">3 / 5</span>
      <span class="anzan-preview__number">47</span>
    </div>`,
};
