/**
 * 찰나의 카운팅 (FLASH COUNT) settings: 6 presets + solo/party mode + custom values.
 */

export const FLASH_COUNT_SETUP_MODE = 'setup';

export const FLASH_COUNT_FIELDS = [
  { key: 'play', label: '플레이 방식', unit: '', options: [0, 1], valueLabels: ['혼자 (선택지)', '다같이 (한 화면)'] },
  { key: 'rounds', label: '문제 수', unit: '문제', options: [5, 6, 8, 10] },
  { key: 'flashSec', label: '노출 시간', unit: '초', options: [2.5, 2.0, 1.6, 1.3, 1.0] },
  { key: 'totalIcons', label: '총 아이콘 수', unit: '개', options: [10, 14, 18, 22, 26] },
  { key: 'kinds', label: '아이콘 종류', unit: '종류', options: [2, 3, 4, 5] },
];

export const FLASH_COUNT_PRESETS = [
  { id: 'easy', label: 'EASY', ko: '쉬움', rounds: 5, flashSec: 2.5, totalIcons: 10, kinds: 2 },
  { id: 'medium', label: 'MEDIUM', ko: '보통', rounds: 6, flashSec: 2.0, totalIcons: 14, kinds: 3 },
  { id: 'hard', label: 'HARD', ko: '어려움', rounds: 6, flashSec: 1.6, totalIcons: 18, kinds: 4 },
  { id: 'extreme', label: 'EXTREME', ko: '극한', rounds: 8, flashSec: 1.3, totalIcons: 22, kinds: 4 },
  { id: 'insane', label: 'INSANE', ko: '광기', rounds: 8, flashSec: 1.0, totalIcons: 22, kinds: 5 },
  { id: 'god', label: 'GOD', ko: '신', rounds: 10, flashSec: 1.0, totalIcons: 26, kinds: 5 },
];

export const FLASH_COUNT_DEFAULT_PRESET = 'medium';

export function matchFlashCountPreset(values) {
  return (
    FLASH_COUNT_PRESETS.find(
      (p) =>
        p.rounds === values.rounds
        && p.flashSec === values.flashSec
        && p.totalIcons === values.totalIcons
        && p.kinds === values.kinds
    ) || null
  );
}

export function flashCountModeId(values) {
  const preset = matchFlashCountPreset(values);
  if (preset) return values.play === 1 ? `${preset.id}-party` : preset.id;
  return `custom-${values.play}-${values.rounds}-${Math.round(values.flashSec * 10)}-${values.totalIcons}-${values.kinds}`;
}

export function parseFlashCountMode(mode) {
  const raw = String(mode || '');
  const partyMatch = raw.match(/^([a-z]+)-party$/);
  const baseId = partyMatch ? partyMatch[1] : raw;
  const preset = FLASH_COUNT_PRESETS.find((p) => p.id === baseId);
  if (preset) {
    return {
      play: partyMatch ? 1 : 0,
      rounds: preset.rounds,
      flashSec: preset.flashSec,
      totalIcons: preset.totalIcons,
      kinds: preset.kinds,
      presetId: preset.id,
    };
  }
  const m = raw.match(/^custom-([01])-(\d+)-(\d+)-(\d+)-(\d+)$/);
  if (!m) return null;
  const [play, rounds, flashTenths, totalIcons, kinds] = m.slice(1).map(Number);
  const values = { play, rounds, flashSec: flashTenths / 10, totalIcons, kinds };
  const valid = FLASH_COUNT_FIELDS.every((f) => f.options.includes(values[f.key]));
  return valid ? { ...values, presetId: null } : null;
}

export function flashCountModeLabel(mode) {
  if (mode === FLASH_COUNT_SETUP_MODE) return '난이도 설정';
  const v = parseFlashCountMode(mode);
  if (!v) return '';
  const suffix = v.play === 1 ? ' · 다같이' : '';
  if (v.presetId) return `${FLASH_COUNT_PRESETS.find((p) => p.id === v.presetId).label}${suffix}`;
  return `커스텀 ${v.rounds}문제${suffix}`;
}

export function flashCountCatalogModes() {
  return [
    { id: FLASH_COUNT_SETUP_MODE, label: '난이도 설정', thumb: null },
    ...FLASH_COUNT_PRESETS.flatMap((p) => [
      { id: p.id, label: p.label, thumb: null },
      { id: `${p.id}-party`, label: `${p.label} · 다같이`, thumb: null },
    ]),
  ];
}
