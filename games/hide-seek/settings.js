/**
 * 숫자 숨바꼭질 difficulty: 6 presets plus fully custom values (tile count, reveal / hide / peek
 * timing, time limit, Hangul mix, spiral background). Shared by the manifest and the game.
 */
import { createModeCodec } from '../../js/core/mode-codec.js';

export const HIDE_SEEK_SETUP_MODE = 'setup';

/** Maximum numbers allowed to hide simultaneously (capped at 9, never hides the whole wall). */
export const maxHideBatchForTiles = (tiles) => Math.min(9, Math.max(1, Math.floor(tiles * 0.78)));

/**
 * Editable fields, each with the discrete values its stepper walks through.
 * Once `revealSec` ends, tiles hide sequentially in a staggered schedule so at most
 * `hideBatch` numbers are hidden at the same moment (never all at once on start).
 */
export const HIDE_SEEK_FIELDS = [
  { key: 'tiles', label: '글자 타일 개수', unit: '개', options: [24, 40, 60, 84, 104, 126] },
  { key: 'revealSec', label: '처음 전체 공개 시간', unit: '초', options: [1.5, 2, 3, 4, 5], scale: 10 },
  { key: 'hideBatch', label: '최대 동시 숨김', unit: '개', options: [1, 2, 3, 4, 5, 6, 7, 8, 9] },
  { key: 'hideSec', label: '숨어 있는 시간', unit: '초', options: [1, 1.5, 1.8, 2, 2.2, 2.5, 2.8, 3.5], scale: 10 },
  { key: 'peekSec', label: '다시 다 보이는 시간', unit: '초', options: [0.5, 0.6, 0.8, 1.1, 1.5, 2, 2.5], scale: 10 },
  { key: 'timeSec', label: '제한 시간', unit: '초', options: [30, 45, 60, 75, 90, 120] },
  { key: 'hangul', label: '한글(가~하) 섞기', unit: '', options: [0, 1], valueLabels: ['끔', '켬'] },
  { key: 'spiral', label: '회오리 배경', unit: '', options: [0, 1], valueLabels: ['끔', '켬'] },
];

export const HIDE_SEEK_PRESETS = [
  { id: 'easy', label: 'EASY', ko: '쉬움', tiles: 24, revealSec: 5, hideBatch: 2, hideSec: 1.5, peekSec: 2, timeSec: 90, hangul: 0, spiral: 0 },
  { id: 'medium', label: 'MEDIUM', ko: '보통', tiles: 40, revealSec: 4, hideBatch: 3, hideSec: 1.8, peekSec: 1.5, timeSec: 75, hangul: 0, spiral: 0 },
  { id: 'hard', label: 'HARD', ko: '어려움', tiles: 60, revealSec: 3, hideBatch: 4, hideSec: 2, peekSec: 1.1, timeSec: 60, hangul: 0, spiral: 0 },
  { id: 'extreme', label: 'EXTREME', ko: '극한', tiles: 84, revealSec: 2, hideBatch: 5, hideSec: 2.2, peekSec: 0.8, timeSec: 60, hangul: 0, spiral: 0 },
  { id: 'insane', label: 'INSANE', ko: '광기', tiles: 104, revealSec: 2, hideBatch: 6, hideSec: 2.5, peekSec: 0.6, timeSec: 60, hangul: 1, spiral: 1 },
  { id: 'god', label: 'GOD', ko: '신', tiles: 126, revealSec: 1.5, hideBatch: 7, hideSec: 2.8, peekSec: 0.5, timeSec: 60, hangul: 1, spiral: 1 },
];

export const HIDE_SEEK_DEFAULT_PRESET = 'medium';

/** Grid shape for each tile count (fills a 16:9 wall). */
export const TILE_GRID = { 24: [6, 4], 40: [8, 5], 60: [10, 6], 84: [12, 7], 104: [13, 8], 126: [14, 9] };

const codec = createModeCodec({
  fields: HIDE_SEEK_FIELDS,
  presets: HIDE_SEEK_PRESETS,
  customLabel: (v) => `${v.tiles}타일`,
  validate: (v) => v.hideBatch <= maxHideBatchForTiles(v.tiles),
});

export const matchHideSeekPreset = codec.matchPreset;
export const hideSeekModeId = codec.modeId;
export const parseHideSeekMode = codec.parse;
export const hideSeekModeLabel = codec.label;
