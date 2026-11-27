/**
 * 모자이크 줌아웃 (PIXEL REVEAL) settings: 6 presets + solo/party mode + custom values.
 */

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

export function matchPixelRevealPreset(values) {
  return (
    PIXEL_REVEAL_PRESETS.find(
      (p) => p.rounds === values.rounds && p.revealSec === values.revealSec && p.startGrid === values.startGrid
    ) || null
  );
}

export function pixelRevealModeId(values) {
  const preset = matchPixelRevealPreset(values);
  if (preset) return values.play === 1 ? `${preset.id}-party` : preset.id;
  return `custom-${values.play}-${values.rounds}-${values.revealSec}-${values.startGrid}`;
}

export function parsePixelRevealMode(mode) {
  const raw = String(mode || '');
  const partyMatch = raw.match(/^([a-z]+)-party$/);
  const baseId = partyMatch ? partyMatch[1] : raw;
  const preset = PIXEL_REVEAL_PRESETS.find((p) => p.id === baseId);
  if (preset) {
    return {
      play: partyMatch ? 1 : 0,
      rounds: preset.rounds,
      revealSec: preset.revealSec,
      startGrid: preset.startGrid,
      presetId: preset.id,
    };
  }
  const m = raw.match(/^custom-([01])-(\d+)-(\d+)-(\d+)$/);
  if (!m) return null;
  const [play, rounds, revealSec, startGrid] = m.slice(1).map(Number);
  const values = { play, rounds, revealSec, startGrid };
  const valid = PIXEL_REVEAL_FIELDS.every((f) => f.options.includes(values[f.key]));
  return valid ? { ...values, presetId: null } : null;
}

export function pixelRevealModeLabel(mode) {
  if (mode === PIXEL_REVEAL_SETUP_MODE) return '난이도 설정';
  const v = parsePixelRevealMode(mode);
  if (!v) return '';
  const suffix = v.play === 1 ? ' · 다같이' : '';
  if (v.presetId) return `${PIXEL_REVEAL_PRESETS.find((p) => p.id === v.presetId).label}${suffix}`;
  return `커스텀 ${v.rounds}문제${suffix}`;
}
