/**
 * 플래시 암산 settings: 6 presets plus custom values.
 * Shared by the lobby catalog (mode validation / labels) and the game (setup screen).
 *
 * Mode ids
 * - `setup`                          → in-game settings screen (no run)
 * - `easy` … `god`                   → a preset
 * - `custom-<d>-<n>-<i>-<p>`         → custom values (d = digits, n = numbers per problem,
 *   i = flash interval ×10 s, p = problems), so a shared link + room seed reproduces
 *   exactly the same numbers for everyone.
 */

export const ANZAN_SETUP_MODE = 'setup';

/** Editable fields, each with the discrete values its stepper walks through. */
export const ANZAN_FIELDS = [
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

const KEYS = ANZAN_FIELDS.map((f) => f.key);
const tenths = (v) => Math.round(v * 10);

export function matchAnzanPreset(values) {
  return ANZAN_PRESETS.find((p) => KEYS.every((k) => p[k] === values[k])) || null;
}

/** Mode id for a set of values: the preset id when it matches one, else a custom id. */
export function anzanModeId(values) {
  const preset = matchAnzanPreset(values);
  if (preset) return preset.id;
  return `custom-${values.digits}-${values.count}-${tenths(values.intervalSec)}-${values.problems}`;
}

/** Parses a mode id into values, or null for `setup` / anything invalid. */
export function parseAnzanMode(mode) {
  const raw = String(mode || '');
  const preset = ANZAN_PRESETS.find((p) => p.id === raw);
  if (preset) return { ...Object.fromEntries(KEYS.map((k) => [k, preset[k]])), presetId: preset.id };
  const m = raw.match(/^custom-(\d+)-(\d+)-(\d+)-(\d+)$/);
  if (!m) return null;
  const [digits, count, i, problems] = m.slice(1).map(Number);
  const values = { digits, count, intervalSec: i / 10, problems };
  const valid = ANZAN_FIELDS.every((f) => f.options.includes(values[f.key]));
  return valid ? { ...values, presetId: null } : null;
}

export function anzanModeLabel(mode) {
  if (mode === ANZAN_SETUP_MODE) return '난이도 설정';
  const v = parseAnzanMode(mode);
  if (!v) return '';
  if (v.presetId) return ANZAN_PRESETS.find((p) => p.id === v.presetId).label;
  return `커스텀 ${v.digits}자리×${v.count}`;
}

export function anzanCatalogModes() {
  return [
    { id: ANZAN_SETUP_MODE, label: '난이도 설정', thumb: null },
    ...ANZAN_PRESETS.map((p) => ({ id: p.id, label: p.label, thumb: null })),
  ];
}
