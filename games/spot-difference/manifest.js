/** Lobby metadata for 틀린그림찾기. Kept free of heavy imports so the lobby loads fast. */
import { SPOT_PICK_MODE, spotAsset, spotModeLabel } from './stages.js';

export default {
  id: 'spot-difference',
  title: '틀린그림찾기',
  accent: 'magenta',
  tag: '매의 눈',
  players: 'both',
  timeHint: '75~90초',
  summary: '카페 20장 조합·캠프 2종',
  defaultMode: SPOT_PICK_MODE,
  modeLabel: spotModeLabel,
  cardArt: `<img class="game-card__img" src="${spotAsset('cafe.jpg')}" alt="" loading="lazy" />`,
};
