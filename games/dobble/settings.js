/**
 * 도블 (DOBBLE) difficulty: 6 presets plus custom values (symbols per card, rounds, time, rotation).
 * Shared by the manifest (mode labels) and the game (setup screen, run generation).
 */
import { createModeCodec } from '../../js/core/mode-codec.js';

export const DOBBLE_SETUP_MODE = 'setup';

export const DOBBLE_FIELDS = [
  { key: 'symbolsPerCard', label: '카드당 아이콘 수', unit: '개', options: [6, 8, 10, 12, 14, 17] },
  { key: 'rounds', label: '목표 라운드 수', unit: '판', options: [10, 15, 18, 20, 22, 25, 30] },
  { key: 'timeSec', label: '제한 시간', unit: '초', options: [45, 50, 60, 65, 70, 75, 90] },
  { key: 'rotate', label: '회전·크기 변화', unit: '', options: [0, 1], valueLabels: ['끔', '켬'] },
];

export const DOBBLE_PRESETS = [
  { id: 'easy', label: 'EASY', ko: '쉬움', symbolsPerCard: 6, rounds: 15, timeSec: 75, rotate: 1 },
  { id: 'medium', label: 'MEDIUM', ko: '보통', symbolsPerCard: 8, rounds: 15, timeSec: 75, rotate: 1 },
  { id: 'hard', label: 'HARD', ko: '어려움', symbolsPerCard: 10, rounds: 15, timeSec: 75, rotate: 1 },
  { id: 'extreme', label: 'EXTREME', ko: '극한', symbolsPerCard: 12, rounds: 15, timeSec: 70, rotate: 1 },
  { id: 'insane', label: 'INSANE', ko: '광기', symbolsPerCard: 14, rounds: 15, timeSec: 70, rotate: 1 },
  { id: 'god', label: 'GOD', ko: '신', symbolsPerCard: 17, rounds: 15, timeSec: 65, rotate: 1 },
];

export const DOBBLE_DEFAULT_PRESET = 'medium';

const codec = createModeCodec({
  fields: DOBBLE_FIELDS,
  presets: DOBBLE_PRESETS,
  customLabel: (v) => `${v.symbolsPerCard}개×${v.rounds}판`,
});

export const matchDobblePreset = codec.matchPreset;
export const dobbleModeId = codec.modeId;
export const parseDobbleMode = codec.parse;
export const dobbleModeLabel = codec.label;
