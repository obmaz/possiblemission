/**
 * 컬러 트랩 (COLOR TRAP / Stroop) settings: 6 presets plus solo/party mode plus custom values.
 * Shared by the manifest (mode labels) and the game (setup screen, run generation).
 */
import { createModeCodec } from '../../js/core/mode-codec.js';

export const COLOR_TRAP_SETUP_MODE = 'setup';

export const COLOR_TRAP_FIELDS = [
  { key: 'play', label: '플레이 방식', unit: '', options: [0, 1], valueLabels: ['혼자 (선택지)', '다같이 (한 화면)'] },
  { key: 'rounds', label: '문제 수', unit: '문제', options: [8, 10, 12, 15, 18, 20] },
  { key: 'timeSec', label: '제한 시간', unit: '초', options: [45, 55, 60, 75, 90] },
  { key: 'modeMix', label: '규칙 유형', unit: '', options: [0, 1, 2], valueLabels: ['색깔만', '색깔+뜻', '3×3 타일 포함'] },
];

export const COLOR_TRAP_PRESETS = [
  { id: 'easy', label: 'EASY', ko: '쉬움', rounds: 8, timeSec: 60, modeMix: 0 },
  { id: 'medium', label: 'MEDIUM', ko: '보통', rounds: 10, timeSec: 60, modeMix: 1 },
  { id: 'hard', label: 'HARD', ko: '어려움', rounds: 12, timeSec: 60, modeMix: 2 },
  { id: 'extreme', label: 'EXTREME', ko: '극한', rounds: 15, timeSec: 60, modeMix: 2 },
  { id: 'insane', label: 'INSANE', ko: '광기', rounds: 18, timeSec: 55, modeMix: 2 },
  { id: 'god', label: 'GOD', ko: '신', rounds: 20, timeSec: 45, modeMix: 2 },
];

export const COLOR_TRAP_DEFAULT_PRESET = 'medium';

const codec = createModeCodec({
  fields: COLOR_TRAP_FIELDS,
  presets: COLOR_TRAP_PRESETS,
  customLabel: (v) => `${v.rounds}문제`,
});

export const matchColorTrapPreset = codec.matchPreset;
export const colorTrapModeId = codec.modeId;
export const parseColorTrapMode = codec.parse;
export const colorTrapModeLabel = codec.label;
