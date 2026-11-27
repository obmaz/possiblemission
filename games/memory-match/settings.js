/**
 * 메모리 매치 modes: board size, pair count and time limit.
 * `setup` opens the in-game difficulty screen (no run).
 */

export const MEMORY_SETUP_MODE = 'setup';

export const MEMORY_MODES = {
  '4x3': {
    id: '4x3',
    modeLabel: '4×3 웜업',
    pairs: 6,
    timeLimitSec: 45,
    landscapeCols: 4,
    landscapeRows: 3,
    portraitCols: 3,
    portraitRows: 4,
  },
  '4x4': {
    id: '4x4',
    modeLabel: '4×4 스탠다드',
    pairs: 8,
    timeLimitSec: 60,
    landscapeCols: 4,
    landscapeRows: 4,
    portraitCols: 4,
    portraitRows: 4,
  },
  '6x4': {
    id: '6x4',
    modeLabel: '6×4 마스터',
    pairs: 12,
    timeLimitSec: 80,
    landscapeCols: 6,
    landscapeRows: 4,
    portraitCols: 4,
    portraitRows: 6,
  },
};

/** Label for a mode id, or '' when the id is unknown. */
export function memoryModeLabel(mode) {
  if (mode === MEMORY_SETUP_MODE) return '난이도 선택';
  return MEMORY_MODES[mode]?.modeLabel || '';
}
