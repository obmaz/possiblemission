/**
 * 도블 (DOBBLE) difficulty settings: 6 presets plus custom values.
 * Shared by the lobby catalog (mode validation / labels) and the game (setup screen).
 *
 * Mode ids
 * - `setup`                            → in-game settings screen (no run)
 * - `easy` … `god`                     → a preset
 * - `custom-<s>-<r>-<t>-<rot>`         → custom values (s = symbols per card [6,8,10,12,14,17],
 *   r = target rounds, t = time limit sec, rot = rotate/scale icons 0/1), so a shared
 *   link + room seed reproduces the exact same deck & card sequence for everyone.
 */

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

const KEYS = DOBBLE_FIELDS.map((f) => f.key);
const pick = (p) => Object.fromEntries(KEYS.map((k) => [k, p[k]]));

export function matchDobblePreset(values) {
  return DOBBLE_PRESETS.find((p) => KEYS.every((k) => p[k] === values[k])) || null;
}

export function dobbleModeId(values) {
  const preset = matchDobblePreset(values);
  if (preset) return preset.id;
  return `custom-${values.symbolsPerCard}-${values.rounds}-${values.timeSec}-${values.rotate}`;
}

export function parseDobbleMode(mode) {
  const raw = String(mode || '');
  const preset = DOBBLE_PRESETS.find((p) => p.id === raw);
  if (preset) return { ...pick(preset), presetId: preset.id };
  const m = raw.match(/^custom-(\d+)-(\d+)-(\d+)-([01])$/);
  if (!m) return null;
  const [symbolsPerCard, rounds, timeSec, rotate] = m.slice(1).map(Number);
  const values = { symbolsPerCard, rounds, timeSec, rotate };
  const valid = DOBBLE_FIELDS.every((f) => f.options.includes(values[f.key]));
  return valid ? { ...values, presetId: null } : null;
}

export function dobbleModeLabel(mode) {
  if (mode === DOBBLE_SETUP_MODE) return '난이도 설정';
  const v = parseDobbleMode(mode);
  if (!v) return '';
  if (v.presetId) return DOBBLE_PRESETS.find((p) => p.id === v.presetId).label;
  return `커스텀 ${v.symbolsPerCard}개×${v.rounds}판`;
}

export function dobbleCatalogModes() {
  return [
    { id: DOBBLE_SETUP_MODE, label: '난이도 설정', thumb: null },
    ...DOBBLE_PRESETS.map((p) => ({ id: p.id, label: p.label, thumb: null })),
  ];
}
