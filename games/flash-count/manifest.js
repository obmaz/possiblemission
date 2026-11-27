/** Lobby metadata for 찰나의 카운팅. */
import { FLASH_COUNT_SETUP_MODE, flashCountModeLabel } from './settings.js';

export default {
  id: 'flash-count',
  title: '찰나의 카운팅',
  accent: 'cyan',
  tag: '순간기억',
  players: 'both',
  timeHint: '45~60초',
  summary: '잠깐 뜬 아이콘 개수 기억',
  defaultMode: FLASH_COUNT_SETUP_MODE,
  modeLabel: flashCountModeLabel,
  cardArt: `<div class="game-card__flashcount-art" aria-hidden="true">
      <span>⭐</span><span>❤️</span><span>⚡</span>
      <span class="flashcount-preview__pill">× ?</span>
    </div>`,
};
