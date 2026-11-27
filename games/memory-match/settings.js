/**
 * 메모리 매치 (MEMORY MATCH) settings: EASY / MEDIUM / HARD presets plus custom grid, time & preview.
 * Shared by the manifest (mode labels) and the game (setup screen, run generation).
 */
import { createModeCodec } from '../../js/core/mode-codec.js';

export const MEMORY_SETUP_MODE = 'setup';

export const MEMORY_GRIDS = [
  { label: '4×3', pairs: 6, landscapeCols: 4, landscapeRows: 3, portraitCols: 3, portraitRows: 4 },
  { label: '4×4', pairs: 8, landscapeCols: 4, landscapeRows: 4, portraitCols: 4, portraitRows: 4 },
  { label: '6×4', pairs: 12, landscapeCols: 6, landscapeRows: 4, portraitCols: 4, portraitRows: 6 },
];

export const MEMORY_FIELDS = [
  { key: 'grid', label: '보드 크기', unit: '', options: [0, 1, 2], valueLabels: ['4×3 (6쌍)', '4×4 (8쌍)', '6×4 (12쌍)'] },
  { key: 'timeSec', label: '제한 시간', unit: '초', options: [45, 60, 80, 100] },
  { key: 'previewSec', label: '미리보기', unit: '초', options: [1, 2, 3, 5] },
];

export const MEMORY_PRESETS = [
  { id: 'easy', label: 'EASY', ko: '쉬움', grid: 0, timeSec: 45, previewSec: 2 },
  { id: 'medium', label: 'MEDIUM', ko: '보통', grid: 1, timeSec: 60, previewSec: 2 },
  { id: 'hard', label: 'HARD', ko: '어려움', grid: 2, timeSec: 80, previewSec: 2 },
];

export const MEMORY_DEFAULT_PRESET = 'medium';

const LEGACY_GRID_MAP = { '4x3': 'easy', '4x4': 'medium', '6x4': 'hard' };

const codec = createModeCodec({
  fields: MEMORY_FIELDS,
  presets: MEMORY_PRESETS,
  customLabel: (v) => `${MEMORY_GRIDS[v.grid]?.label || '4×4'} 커스텀`,
});

export const matchMemoryPreset = codec.matchPreset;
export const memoryModeId = codec.modeId;

export function parseMemoryMode(mode) {
  return codec.parse(LEGACY_GRID_MAP[mode] || mode);
}

export function memoryModeLabel(mode) {
  if (mode === MEMORY_SETUP_MODE) return '난이도 선택';
  return codec.label(LEGACY_GRID_MAP[mode] || mode);
}

/** Resolves a parsed mode into full board dimensions & timings, or null for `setup`/unknown. */
export function resolveMemoryConfig(mode) {
  const parsed = parseMemoryMode(mode);
  if (!parsed) return null;
  const grid = MEMORY_GRIDS[parsed.grid] || MEMORY_GRIDS[1];
  return {
    id: mode,
    modeLabel: memoryModeLabel(mode),
    pairs: grid.pairs,
    timeLimitSec: parsed.timeSec,
    previewSec: parsed.previewSec,
    landscapeCols: grid.landscapeCols,
    landscapeRows: grid.landscapeRows,
    portraitCols: grid.portraitCols,
    portraitRows: grid.portraitRows,
  };
}
