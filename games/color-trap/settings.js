/**
 * 컬러 트랩 (COLOR TRAP / Stroop Challenge) settings: presets + solo/party mode + custom values.
 *
 * Mode ids
 * - `setup`                            → in-game settings screen
 * - `<preset>` / `<preset>-party`      → preset in solo (0) or party (1) play mode
 * - `custom-<play>-<r>-<t>-<mix>`      → custom settings
 */

export const COLOR_TRAP_SETUP_MODE = 'setup';

export const COLOR_TRAP_FIELDS = [
  { key: 'play', label: '플레이 방식', unit: '', options: [0, 1], valueLabels: ['혼자 (선택지)', '다같이 (한 화면)'] },
  { key: 'rounds', label: '문제 수', unit: '문제', options: [8, 10, 12, 15, 20] },
  { key: 'timeSec', label: '제한 시간', unit: '초', options: [45, 60, 75, 90] },
  { key: 'modeMix', label: '규칙 유형', unit: '', options: [0, 1, 2], valueLabels: ['색깔만', '색깔+뜻', '3×3 타일 포함'] },
];

export const COLOR_TRAP_PRESETS = [
  { id: 'easy', label: 'EASY', ko: '쉬움', rounds: 8, timeSec: 60, modeMix: 0 },
  { id: 'medium', label: 'MEDIUM', ko: '보통', rounds: 10, timeSec: 60, modeMix: 1 },
  { id: 'hard', label: 'HARD', ko: '어려움', rounds: 12, timeSec: 60, modeMix: 2 },
  { id: 'extreme', label: 'EXTREME', ko: '극한', rounds: 15, timeSec: 60, modeMix: 2 },
  { id: 'insane', label: 'INSANE', ko: '광기', rounds: 18, timeSec: 55, modeMix: 2 },
  { id: 'god', label: 'GOD', ko: '신', rounds: 20, timeSec: 45, modeMix: 2 },
];

// Normalize presets so their rounds exist in COLOR_TRAP_FIELDS if needed
COLOR_TRAP_FIELDS[1].options = [8, 10, 12, 15, 18, 20];
COLOR_TRAP_FIELDS[2].options = [45, 55, 60, 75, 90];

export const COLOR_TRAP_DEFAULT_PRESET = 'medium';


export function matchColorTrapPreset(values) {
  return (
    COLOR_TRAP_PRESETS.find(
      (p) => p.rounds === values.rounds && p.timeSec === values.timeSec && p.modeMix === values.modeMix
    ) || null
  );
}

export function colorTrapModeId(values) {
  const preset = matchColorTrapPreset(values);
  if (preset) return values.play === 1 ? `${preset.id}-party` : preset.id;
  return `custom-${values.play}-${values.rounds}-${values.timeSec}-${values.modeMix}`;
}

export function parseColorTrapMode(mode) {
  const raw = String(mode || '');
  const partyMatch = raw.match(/^([a-z]+)-party$/);
  const baseId = partyMatch ? partyMatch[1] : raw;
  const preset = COLOR_TRAP_PRESETS.find((p) => p.id === baseId);
  if (preset) {
    return {
      play: partyMatch ? 1 : 0,
      rounds: preset.rounds,
      timeSec: preset.timeSec,
      modeMix: preset.modeMix,
      presetId: preset.id,
    };
  }
  const m = raw.match(/^custom-([01])-(\d+)-(\d+)-([012])$/);
  if (!m) return null;
  const [play, rounds, timeSec, modeMix] = m.slice(1).map(Number);
  const values = { play, rounds, timeSec, modeMix };
  const valid = COLOR_TRAP_FIELDS.every((f) => f.options.includes(values[f.key]));
  return valid ? { ...values, presetId: null } : null;
}

export function colorTrapModeLabel(mode) {
  if (mode === COLOR_TRAP_SETUP_MODE) return '난이도 설정';
  const v = parseColorTrapMode(mode);
  if (!v) return '';
  const suffix = v.play === 1 ? ' · 다같이' : '';
  if (v.presetId) return `${COLOR_TRAP_PRESETS.find((p) => p.id === v.presetId).label}${suffix}`;
  return `커스텀 ${v.rounds}문제${suffix}`;
}
