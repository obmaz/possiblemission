/**
 * 플래시 암산 settings: 6 presets plus solo/party mode plus custom values.
 *
 * Mode ids
 * - `setup`                            → in-game settings screen (no run)
 * - `<preset>` / `<preset>-party`      → a preset in solo (0) or party (1) mode
 * - `custom-<d>-<n>-<i>-<p>[-party]`   → custom values
 */

export const ANZAN_SETUP_MODE = 'setup';

export const ANZAN_FIELDS = [
  { key: 'play', label: '플레이 방식', unit: '', options: [0, 1], valueLabels: ['혼자 (입력)', '다같이 (한 화면)'] },
  { key: 'digits', label: '자릿수', unit: '자리', options: [1, 2, 3, 4] },
  { key: 'count', label: '숫자 개수', unit: '개', options: [3, 4, 5, 6, 8, 10, 12, 15] },
  { key: 'intervalSec', label: '표시 간격', unit: '초', options: [0.3, 0.4, 0.5, 0.6, 0.8, 1, 1.2, 1.5, 2] },
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

const CORE_KEYS = ['digits', 'count', 'intervalSec', 'problems'];
const tenths = (v) => Math.round(v * 10);

export function matchAnzanPreset(values) {
  return ANZAN_PRESETS.find((p) => CORE_KEYS.every((k) => p[k] === values[k])) || null;
}

/** Mode id for a set of values: preserves legacy ids for solo (`play === 0`). */
export function anzanModeId(values) {
  const preset = matchAnzanPreset(values);
  const suffix = values.play === 1 ? '-party' : '';
  if (preset) return `${preset.id}${suffix}`;
  return `custom-${values.digits}-${values.count}-${tenths(values.intervalSec)}-${values.problems}${suffix}`;
}

/** Parses a mode id into values, or null for `setup` / anything invalid. */
export function parseAnzanMode(mode) {
  const raw = String(mode || '');
  const isParty = raw.endsWith('-party');
  const base = isParty ? raw.slice(0, -'-party'.length) : raw;
  const play = isParty ? 1 : 0;

  const preset = ANZAN_PRESETS.find((p) => p.id === base);
  if (preset) {
    return { play, ...Object.fromEntries(CORE_KEYS.map((k) => [k, preset[k]])), presetId: preset.id };
  }
  const m = base.match(/^custom-(\d+)-(\d+)-(\d+)-(\d+)$/);
  if (!m) return null;
  const [digits, count, i, problems] = m.slice(1).map(Number);
  const values = { play, digits, count, intervalSec: i / 10, problems };
  const valid = ANZAN_FIELDS.every((f) => f.options.includes(values[f.key]));
  return valid ? { ...values, presetId: null } : null;
}

export function anzanModeLabel(mode) {
  if (mode === ANZAN_SETUP_MODE) return '난이도 설정';
  const v = parseAnzanMode(mode);
  if (!v) return '';
  const suffix = v.play === 1 ? ' · 다같이' : '';
  if (v.presetId) return `${ANZAN_PRESETS.find((p) => p.id === v.presetId).label}${suffix}`;
  return `커스텀 ${v.digits}자리×${v.count}${suffix}`;
}

export function anzanCatalogModes() {
  return [
    { id: ANZAN_SETUP_MODE, label: '난이도 설정', thumb: null },
    ...ANZAN_PRESETS.flatMap((p) => [
      { id: p.id, label: p.label, thumb: null },
      { id: `${p.id}-party`, label: `${p.label} · 다같이`, thumb: null },
    ]),
  ];
}
