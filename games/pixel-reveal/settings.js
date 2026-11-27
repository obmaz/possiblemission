/**
 * 모자이크 줌아웃 (PIXEL REVEAL) settings: 6 presets plus solo/party mode plus custom values.
 * Shared by the manifest (mode labels) and the game (setup screen, run generation).
 */
import { createModeCodec } from '../../js/core/mode-codec.js';

export const PIXEL_REVEAL_SETUP_MODE = 'setup';

export const PIXEL_REVEAL_FIELDS = [
  { key: 'play', label: '플레이 방식', unit: '', options: [0, 1], valueLabels: ['혼자 (선택지)', '다같이 (한 화면)'] },
  { key: 'rounds', label: '문제 수', unit: '문제', options: [4, 6, 8, 10, 12] },
  { key: 'revealSec', label: '선명해지는 시간', unit: '초', options: [8, 10, 12, 15] },
  { key: 'startGrid', label: '초기 모자이크 칸', unit: '칸', options: [6, 8, 10, 14] },
];

export const PIXEL_REVEAL_PRESETS = [
  { id: 'easy', label: 'EASY', ko: '쉬움', rounds: 4, revealSec: 15, startGrid: 14 },
  { id: 'medium', label: 'MEDIUM', ko: '보통', rounds: 6, revealSec: 12, startGrid: 10 },
  { id: 'hard', label: 'HARD', ko: '어려움', rounds: 6, revealSec: 10, startGrid: 8 },
  { id: 'extreme', label: 'EXTREME', ko: '극한', rounds: 8, revealSec: 10, startGrid: 10 },
  { id: 'insane', label: 'INSANE', ko: '광기', rounds: 8, revealSec: 10, startGrid: 6 },
  { id: 'god', label: 'GOD', ko: '신', rounds: 8, revealSec: 8, startGrid: 6 },
];

export const PIXEL_REVEAL_DEFAULT_PRESET = 'medium';

const codec = createModeCodec({
  fields: PIXEL_REVEAL_FIELDS,
  presets: PIXEL_REVEAL_PRESETS,
  customLabel: (v) => `${v.rounds}문제`,
});

export const matchPixelRevealPreset = codec.matchPreset;
export const pixelRevealModeId = codec.modeId;
export const parsePixelRevealMode = codec.parse;
export const pixelRevealModeLabel = codec.label;
