/**
 * 새 미니게임 settings: EASY / MEDIUM / HARD presets plus solo/party & custom values.
 * Shared by the manifest (mode labels) and the game (setup screen, run generation).
 */
import { createModeCodec } from '../../js/core/mode-codec.js';

export const TEMPLATE_SETUP_MODE = 'setup';

export const TEMPLATE_FIELDS = [
  { key: 'play', label: '플레이 방식', unit: '', options: [0, 1], valueLabels: ['혼자 (선택지)', '다같이 (한 화면)'] },
  { key: 'rounds', label: '문제 수', unit: '문제', options: [5, 8, 10, 12] },
  { key: 'timeSec', label: '제한 시간', unit: '초', options: [45, 60, 75, 90] },
];

export const TEMPLATE_PRESETS = [
  { id: 'easy', label: 'EASY', ko: '쉬움', rounds: 5, timeSec: 60 },
  { id: 'medium', label: 'MEDIUM', ko: '보통', rounds: 8, timeSec: 60 },
  { id: 'hard', label: 'HARD', ko: '어려움', rounds: 10, timeSec: 45 },
];

export const TEMPLATE_DEFAULT_PRESET = 'medium';

const codec = createModeCodec({
  fields: TEMPLATE_FIELDS,
  presets: TEMPLATE_PRESETS,
  customLabel: (v) => `${v.rounds}문제`,
});

export const matchTemplatePreset = codec.matchPreset;
export const templateModeId = codec.modeId;
export const parseTemplateMode = codec.parse;
export const templateModeLabel = codec.label;
