/**
 * 찰나의 카운팅 (FLASH COUNT) settings: 6 presets plus solo/party mode plus custom values.
 * Shared by the manifest (mode labels) and the game (setup screen, run generation).
 */
import { createModeCodec } from '../../js/core/mode-codec.js';

export const FLASH_COUNT_SETUP_MODE = 'setup';

export const FLASH_COUNT_FIELDS = [
  { key: 'play', label: '플레이 방식', unit: '', options: [0, 1], valueLabels: ['혼자 (선택지)', '다같이 (한 화면)'] },
  { key: 'rounds', label: '문제 수', unit: '문제', options: [5, 6, 8, 10] },
  { key: 'flashSec', label: '노출 시간', unit: '초', options: [2.5, 2.0, 1.6, 1.3, 1.0], scale: 10 },
  { key: 'totalIcons', label: '총 아이콘 수', unit: '개', options: [10, 14, 18, 22, 26] },
  { key: 'kinds', label: '아이콘 종류', unit: '종류', options: [2, 3, 4, 5] },
];

export const FLASH_COUNT_PRESETS = [
  { id: 'easy', label: 'EASY', ko: '쉬움', rounds: 5, flashSec: 2.5, totalIcons: 10, kinds: 2 },
  { id: 'medium', label: 'MEDIUM', ko: '보통', rounds: 6, flashSec: 2.0, totalIcons: 14, kinds: 3 },
  { id: 'hard', label: 'HARD', ko: '어려움', rounds: 6, flashSec: 1.6, totalIcons: 18, kinds: 4 },
  { id: 'extreme', label: 'EXTREME', ko: '극한', rounds: 8, flashSec: 1.3, totalIcons: 22, kinds: 4 },
  { id: 'insane', label: 'INSANE', ko: '광기', rounds: 8, flashSec: 1.0, totalIcons: 22, kinds: 5 },
  { id: 'god', label: 'GOD', ko: '신', rounds: 10, flashSec: 1.0, totalIcons: 26, kinds: 5 },
];

export const FLASH_COUNT_DEFAULT_PRESET = 'medium';

const codec = createModeCodec({
  fields: FLASH_COUNT_FIELDS,
  presets: FLASH_COUNT_PRESETS,
  customLabel: (v) => `${v.rounds}문제`,
});

export const matchFlashCountPreset = codec.matchPreset;
export const flashCountModeId = codec.modeId;
export const parseFlashCountMode = codec.parse;
export const flashCountModeLabel = codec.label;
