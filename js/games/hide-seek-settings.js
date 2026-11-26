/**
 * 숫자 숨바꼭질 difficulty settings: 6 presets plus fully custom values.
 * Shared by the lobby catalog (mode validation / labels) and the game (setup screen).
 *
 * Mode ids
 * - `setup`                      → in-game settings screen (no run)
 * - `easy` … `god`               → a preset
 * - `custom-<t>-<r>-<b>-<i>-<w>-<s>-<h>` → custom values, so a shared link (and the
 *   room seed) reproduces exactly the same wall for everyone:
 *   t = tiles, r = reveal ×10 s, b = hide batch (0 = all at once),
 *   i = hide interval ×10 s, w = peek window ×10 s, s = time limit s,
 *   h = mix Korean syllables 가–하 into the tiles (0/1)
 */

export const HIDE_SEEK_SETUP_MODE = 'setup';

/** Editable fields, each with the discrete values its stepper walks through. */
export const SETTING_FIELDS = [
  { key: 'tiles', label: '알파벳 타일 개수', unit: '개', options: [24, 40, 60, 84, 104, 126] },
  { key: 'revealSec', label: '처음 전체 공개 시간', unit: '초', options: [0.6, 1, 1.5, 2, 3, 4, 5] },
  { key: 'hideBatch', label: '한 번에 사라지는 숫자', unit: '개', options: [1, 2, 3, 5, 8, 12, 0], allLabel: '전부' },
  { key: 'hideIntervalSec', label: '사라지는 간격', unit: '초', options: [0.3, 0.5, 0.6, 0.8, 1, 1.5, 2] },
  { key: 'peekSec', label: '숫자가 다시 보이는 시간', unit: '초', options: [0.5, 0.7, 0.9, 1.1, 1.5, 2, 2.5] },
  { key: 'timeSec', label: '라운드 제한 시간', unit: '초', options: [20, 25, 30, 35, 40, 45, 60] },
  { key: 'hangul', label: '한글(가~하) 섞기', unit: '', options: [0, 1], valueLabels: ['끔', '켬'] },
];

export const PRESETS = [
  { id: 'easy', label: 'EASY', ko: '쉬움', tiles: 24, revealSec: 4, hideBatch: 2, hideIntervalSec: 1, peekSec: 2, timeSec: 45, hangul: 0 },
  { id: 'medium', label: 'MEDIUM', ko: '보통', tiles: 40, revealSec: 3, hideBatch: 3, hideIntervalSec: 0.8, peekSec: 1.5, timeSec: 40, hangul: 0 },
  { id: 'hard', label: 'HARD', ko: '어려움', tiles: 60, revealSec: 2, hideBatch: 5, hideIntervalSec: 0.6, peekSec: 1.1, timeSec: 35, hangul: 0 },
  { id: 'extreme', label: 'EXTREME', ko: '극한', tiles: 84, revealSec: 1.5, hideBatch: 8, hideIntervalSec: 0.5, peekSec: 0.9, timeSec: 30, hangul: 0 },
  { id: 'insane', label: 'INSANE', ko: '광기', tiles: 104, revealSec: 1, hideBatch: 0, hideIntervalSec: 0.5, peekSec: 0.7, timeSec: 30, hangul: 1 },
  { id: 'god', label: 'GOD', ko: '신', tiles: 126, revealSec: 0.6, hideBatch: 0, hideIntervalSec: 0.3, peekSec: 0.5, timeSec: 25, hangul: 1 },
];

export const DEFAULT_PRESET_ID = 'medium';

/** Grid shape for each tile count (fills a 16:9 wall). */
export const TILE_GRID = { 24: [6, 4], 40: [8, 5], 60: [10, 6], 84: [12, 7], 104: [13, 8], 126: [14, 9] };

const FIELD_KEYS = SETTING_FIELDS.map((f) => f.key);
const pickSettings = (p) => Object.fromEntries(FIELD_KEYS.map((k) => [k, p[k]]));
const tenths = (v) => Math.round(v * 10);

/** Same values as a preset? Returns that preset or null. */
export function matchPreset(settings) {
  return PRESETS.find((p) => FIELD_KEYS.every((k) => p[k] === settings[k])) || null;
}

/** Mode id for a set of values: the preset id when it matches one, else a custom id. */
export function hideSeekModeId(settings) {
  const preset = matchPreset(settings);
  if (preset) return preset.id;
  const s = settings;
  return `custom-${s.tiles}-${tenths(s.revealSec)}-${s.hideBatch}-${tenths(s.hideIntervalSec)}-${tenths(s.peekSec)}-${s.timeSec}-${s.hangul}`;
}

/** Parses a mode id into settings, or null for `setup` / anything invalid. */
export function parseHideSeekMode(mode) {
  const raw = String(mode || '');
  const preset = PRESETS.find((p) => p.id === raw);
  if (preset) return { ...pickSettings(preset), presetId: preset.id };
  const m = raw.match(/^custom-(\d+)-(\d+)-(\d+)-(\d+)-(\d+)-(\d+)-([01])$/);
  if (!m) return null;
  const [tiles, r, hideBatch, i, w, timeSec, hangul] = m.slice(1).map(Number);
  const settings = { tiles, revealSec: r / 10, hideBatch, hideIntervalSec: i / 10, peekSec: w / 10, timeSec, hangul };
  // Only values the steppers can produce are accepted
  const valid = SETTING_FIELDS.every((f) => f.options.includes(settings[f.key]));
  return valid ? { ...settings, presetId: null } : null;
}

/** Short Korean label for HUD / records, e.g. "HARD" or "커스텀 60타일". */
export function hideSeekModeLabel(mode) {
  if (mode === HIDE_SEEK_SETUP_MODE) return '난이도 설정';
  const s = parseHideSeekMode(mode);
  if (!s) return '';
  if (s.presetId) return PRESETS.find((p) => p.id === s.presetId).label;
  return `커스텀 ${s.tiles}타일`;
}

/** Catalog modes for the lobby: the setup screen first, then every preset. */
export function hideSeekCatalogModes() {
  return [
    { id: HIDE_SEEK_SETUP_MODE, label: '난이도 설정', thumb: null },
    ...PRESETS.map((p) => ({ id: p.id, label: p.label, thumb: null })),
  ];
}
