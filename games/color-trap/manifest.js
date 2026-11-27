/** Lobby metadata for 컬러 트랩. */
import { COLOR_TRAP_SETUP_MODE, colorTrapModeLabel } from './settings.js';

export default {
  id: 'color-trap',
  title: '컬러 트랩',
  accent: 'emerald',
  tag: '순발력·파티',
  players: 'both',
  timeHint: '45~60초',
  summary: '글자 색깔과 뜻 함정',
  defaultMode: COLOR_TRAP_SETUP_MODE,
  modeLabel: colorTrapModeLabel,
  cardArt: `<div class="game-card__colortrap-art" aria-hidden="true">
      <span class="colortrap-preview__rule">글자의 색깔은?</span>
      <span class="colortrap-preview__word">노랑</span>
    </div>`,
};
