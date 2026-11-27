/** Lobby metadata for 모자이크 줌아웃. */
import { PIXEL_REVEAL_SETUP_MODE, pixelRevealModeLabel } from './settings.js';

export default {
  id: 'pixel-reveal',
  title: '모자이크 줌아웃',
  accent: 'violet',
  tag: '눈치·스피드',
  players: 'both',
  timeHint: '60초',
  summary: '모자이크 그림 정체 맞히기',
  defaultMode: PIXEL_REVEAL_SETUP_MODE,
  modeLabel: pixelRevealModeLabel,
  cardArt: `<div class="game-card__pixel-art" aria-hidden="true">
      <img src="${new URL('./assets/panda.jpg', import.meta.url).href}" alt="" loading="lazy" />
      <div class="pixel-preview__grid"></div>
    </div>`,
};
