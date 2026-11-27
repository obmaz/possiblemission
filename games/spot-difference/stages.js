/**
 * Lightweight registry of 틀린그림찾기 pictures, difficulties (EASY / MEDIUM / HARD) & party settings.
 * Shared by the manifest (mode labels) and the game (setup screen, parsing) without
 * pulling in the heavy drawing code.
 */

export const SPOT_SETUP_MODE = 'setup';
export const SPOT_PICK_MODE = SPOT_SETUP_MODE;
export const SPOT_MEMORIZE_DEFAULT_SEC = 60;
export const SPOT_MEMORIZE_OPTIONS = [15, 30, 45, 60, 90];

/** Every picture is authored at this size; anomaly coordinates are normalized to it. */
export const BASE_W = 1200;
export const BASE_H = 896;

/** Resolves a file under this game's `assets/` folder to an absolute URL. */
export const spotAsset = (path) => new URL(`./assets/${path}`, import.meta.url).href;

export const SPOT_STAGES = [
  { id: 'cafe', titleKo: '보드게임 디저트 카페', shortKo: '카페', thumb: spotAsset('cafe.jpg'), kind: 'photo-set' },
  { id: 'camp', titleKo: '황혼의 모험 캠프', shortKo: '캠프', thumb: spotAsset('camp.jpg'), kind: 'photo' },
];

export const SPOT_DIFFICULTIES = [
  { id: 'easy', label: 'EASY', ko: '쉬움', count: 5, timeSec: 90, memorizeSec: 60 },
  { id: 'medium', label: 'MEDIUM', ko: '보통', count: 7, timeSec: 80, memorizeSec: 60 },
  { id: 'hard', label: 'HARD', ko: '어려움', count: 9, timeSec: 75, memorizeSec: 60 },
];

export const SPOT_DEFAULT_PRESET = 'medium';

export const SPOT_FIELDS = [
  { key: 'play', label: '플레이 방식', unit: '', options: [0, 1], valueLabels: ['혼자 (좌우 비교)', '다같이 (기억해서 찾기)'] },
  { key: 'stageIdx', label: '그림', unit: '', options: [0, 1, 2], valueLabels: ['랜덤 (시드)', '카페', '캠프'] },
  { key: 'count', label: '찾을 개수', unit: '곳', options: [5, 7, 9] },
  { key: 'timeSec', label: '제한 시간', unit: '초', options: [60, 75, 80, 90, 120] },
  { key: 'memorizeSec', label: '외우는 시간', unit: '초', options: SPOT_MEMORIZE_OPTIONS },
];

const STAGE_KEYS = ['rand', 'cafe', 'camp'];
const DIFF_ALIAS = { normal: 'medium' };

export function matchSpotPreset(values) {
  return SPOT_DIFFICULTIES.find((p) => p.count === values.count && p.timeSec === values.timeSec) || null;
}

export function spotModeIdFromValues(values) {
  const stageKey = STAGE_KEYS[values.stageIdx] || 'rand';
  const preset = matchSpotPreset(values);
  if (preset) {
    return values.play === 1 ? `${stageKey}-${preset.id}-party-${values.memorizeSec}` : `${stageKey}-${preset.id}`;
  }
  return `custom-${values.play}-${values.stageIdx}-${values.count}-${values.timeSec}-${values.memorizeSec}`;
}

/** Legacy positional helper `(stageId, difficultyId, memorizeSec?)`. */
export function spotModeId(stageIdOrValues, difficultyId, memorizeSec = 0) {
  if (stageIdOrValues && typeof stageIdOrValues === 'object') return spotModeIdFromValues(stageIdOrValues);
  return memorizeSec > 0 ? `${stageIdOrValues}-${difficultyId}-party-${memorizeSec}` : `${stageIdOrValues}-${difficultyId}`;
}

/** Parses a mode id into setup values + resolved stage/difficulty, or null for `setup`/`pick`/unknown. */
export function parseSpotMode(mode) {
  const raw = String(mode || '');
  if (!raw || raw === SPOT_PICK_MODE || raw === 'pick') return null;

  if (raw.startsWith('custom-')) {
    const parts = raw.slice(7).split('-').map(Number);
    if (parts.length !== 5 || parts.some((n) => !Number.isFinite(n))) return null;
    const [play, stageIdx, count, timeSec, memorizeSec] = parts;
    if (![0, 1].includes(play) || stageIdx < 0 || stageIdx > 2) return null;
    if (!SPOT_FIELDS[2].options.includes(count) || !SPOT_FIELDS[3].options.includes(timeSec)) return null;
    if (!SPOT_MEMORIZE_OPTIONS.includes(memorizeSec)) return null;
    const stage = stageIdx === 0 ? null : SPOT_STAGES[stageIdx - 1];
    return {
      play,
      stageIdx,
      count,
      timeSec,
      memorizeSec,
      party: play === 1,
      stage,
      difficulty: { id: 'custom', label: '커스텀', ko: '커스텀', count, timeSec },
    };
  }

  const partyMatch = /^(.+)-party(?:-(\d+))?$/.exec(raw);
  const base = partyMatch ? partyMatch[1] : raw;
  const dash = base.lastIndexOf('-');
  if (dash < 0) return null;
  const stageKey = base.slice(0, dash);
  const stageIdx = STAGE_KEYS.indexOf(stageKey);
  if (stageIdx < 0) return null;
  const stage = stageIdx === 0 ? null : SPOT_STAGES[stageIdx - 1];
  const diffRaw = base.slice(dash + 1);
  const difficulty = SPOT_DIFFICULTIES.find((d) => d.id === (DIFF_ALIAS[diffRaw] || diffRaw));
  if (!difficulty) return null;

  const rawSec = Number(partyMatch?.[2]);
  const memorizeSec = partyMatch
    ? (Number.isFinite(rawSec) && rawSec >= 5 && rawSec <= 300 ? Math.round(rawSec) : SPOT_MEMORIZE_DEFAULT_SEC)
    : SPOT_MEMORIZE_DEFAULT_SEC;
  const play = partyMatch ? 1 : 0;
  return {
    play,
    stageIdx,
    count: difficulty.count,
    timeSec: difficulty.timeSec,
    memorizeSec,
    party: play === 1,
    stage,
    difficulty,
  };
}

/** Label for a mode id, or '' when unknown. */
export function spotModeLabel(mode) {
  if (mode === SPOT_PICK_MODE || mode === 'pick') return '난이도 선택';
  const parsed = parseSpotMode(mode);
  if (!parsed) return '';
  const stageName = parsed.stage ? parsed.stage.shortKo : '랜덤';
  const base = `${stageName} · ${parsed.difficulty.ko}`;
  return parsed.party ? `${base} · 다같이(${parsed.memorizeSec}초)` : base;
}
