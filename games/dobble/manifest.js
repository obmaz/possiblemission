/** Lobby metadata for 도블 스피드 매치. */
import { DOBBLE_SETUP_MODE, dobbleModeLabel } from './settings.js';

export default {
  id: 'dobble',
  title: '도블 스피드 매치',
  accent: 'gold',
  tag: '순발력',
  players: 'solo',
  timeHint: '45~75초',
  summary: '공통 그림 1개 찾기',
  defaultMode: DOBBLE_SETUP_MODE,
  modeLabel: dobbleModeLabel,
  cardArt: `<div class="game-card__dobble-art" aria-hidden="true">
      <div class="dobble-preview-disc"><span>⭐</span><span>🍎</span><span>🔑</span><span>👑</span></div>
      <div class="dobble-preview-disc"><span>👑</span><span>🚀</span><span>💎</span><span>🍀</span></div>
    </div>`,
};
