/** Lobby metadata for 새 미니게임. Kept free of heavy imports so the lobby loads fast. */
import { TEMPLATE_SETUP_MODE, templateModeLabel } from './settings.js';

export default {
  id: 'template',
  title: '새 미니게임',
  accent: 'cyan', // cyan | magenta | gold | emerald | crimson | violet
  tag: '한 단어',
  players: 'both', // 'solo' | 'both' | 'party'
  timeHint: '60초',
  summary: '한 줄 게임 설명',
  defaultMode: TEMPLATE_SETUP_MODE,
  modeLabel: templateModeLabel,
  cardArt: `<div class="game-card__template-art" aria-hidden="true"><span>⚡</span></div>`,
};
