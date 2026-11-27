/** Lobby metadata for 메모리 매치. */
import { MEMORY_SETUP_MODE, memoryModeLabel } from './settings.js';

export default {
  id: 'memory-match',
  title: '메모리 매치',
  accent: 'violet',
  tag: '단기기억',
  players: 'solo',
  timeHint: '45~80초',
  summary: '2초 암기 후 같은 짝 찾기',
  defaultMode: MEMORY_SETUP_MODE,
  modeLabel: memoryModeLabel,
  cardArt: `<div class="game-card__memory-art" aria-hidden="true">
      <div class="memory-preview-tile">🚄</div>
      <div class="memory-preview-tile">⚡</div>
      <div class="memory-preview-tile">💎</div>
    </div>`,
};
