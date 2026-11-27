/**
 * 플래시 암산 settings: 6 presets plus solo/party mode plus custom values.
 * Shared by the manifest (mode labels) and the game (setup screen, run generation).
 */
import { createModeCodec } from '../../js/core/mode-codec.js';

export const ANZAN_SETUP_MODE = 'setup';

export const ANZAN_FIELDS = [
  { key: 'play', label: '플레이 방식', unit: '', options: [0, 1], valueLabels: ['혼자 (입력)', '다같이 (한 화면)'] },
  { key: 'digits', label: '자릿수', unit: '자리', options: [1, 2, 3, 4] },
  { key: 'count', label: '숫자 개수', unit: '개', options: [3, 4, 5, 6, 8, 10, 12, 15] },
  { key: 'intervalSec', label: '표시 간격', unit: '초', options: [0.3, 0.4, 0.5, 0.6, 0.8, 1, 1.2, 1.5, 2], scale: 10 },
  { key: 'problems', label: '문제 수', unit: '문제', options: [3, 5, 10] },
];

export const ANZAN_PRESETS = [
  { id: 'easy', label: 'EASY', ko: '쉬움', digits: 1, count: 5, intervalSec: 1.2, problems: 5 },
  { id: 'medium', label: 'MEDIUM', ko: '보통', digits: 1, count: 8, intervalSec: 0.8, problems: 5 },
  { id: 'hard', label: 'HARD', ko: '어려움', digits: 2, count: 6, intervalSec: 0.8, problems: 5 },
  { id: 'extreme', label: 'EXTREME', ko: '극한', digits: 2, count: 10, intervalSec: 0.6, problems: 5 },
  { id: 'insane', label: 'INSANE', ko: '광기', digits: 3, count: 10, intervalSec: 0.5, problems: 5 },
  { id: 'god', label: 'GOD', ko: '신', digits: 3, count: 15, intervalSec: 0.3, problems: 5 },
];

export const ANZAN_DEFAULT_PRESET = 'medium';

const codec = createModeCodec({
  fields: ANZAN_FIELDS,
  presets: ANZAN_PRESETS,
  customLabel: (v) => `${v.digits}자리×${v.count}`,
});

export const matchAnzanPreset = codec.matchPreset;
export const anzanModeId = codec.modeId;
export const parseAnzanMode = codec.parse;
export const anzanModeLabel = codec.label;
