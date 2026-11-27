/**
 * Lightweight registry of 틀린그림찾기 pictures and difficulties.
 * Shared by the manifest (mode labels) and the game (picker, parsing) without
 * pulling in the heavy drawing code.
 *
 * Mode ids: `${stageId}-${difficultyId}` (e.g. `cafe-normal`), plus `pick`, which
 * opens the in-game picture → difficulty chooser.
 */

export const SPOT_PICK_MODE = 'pick';
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
  { id: 'easy', label: '쉬움', count: 5, timeSec: 90, note: '큼직한 차이 위주' },
  { id: 'normal', label: '보통', count: 7, timeSec: 80, note: '기본 난이도' },
  { id: 'hard', label: '어려움', count: 9, timeSec: 75, note: '작고 미묘한 차이 포함' },
];

export const spotModeId = (stageId, difficultyId, memorizeSec = 0) =>
  memorizeSec > 0 ? `${stageId}-${difficultyId}-party-${memorizeSec}` : `${stageId}-${difficultyId}`;

/** Parses a mode id into its stage + difficulty (+ optional party memorizeSec), or null for `pick` / unknown ids. */
export function parseSpotMode(mode) {
  const raw = String(mode || '');
  const partyMatch = /^(.+)-party(?:-(\d+))?$/.exec(raw);
  const base = partyMatch ? partyMatch[1] : raw;
  const dash = base.lastIndexOf('-');
  if (dash < 0) return null;
  const stage = SPOT_STAGES.find((s) => s.id === base.slice(0, dash));
  const difficulty = SPOT_DIFFICULTIES.find((d) => d.id === base.slice(dash + 1));
  if (!stage || !difficulty) return null;
  if (!partyMatch) return { stage, difficulty, party: false, memorizeSec: 0 };
  const rawSec = Number(partyMatch[2]);
  const memorizeSec = Number.isFinite(rawSec) && rawSec >= 5 && rawSec <= 300 ? Math.round(rawSec) : SPOT_MEMORIZE_DEFAULT_SEC;
  return { stage, difficulty, party: true, memorizeSec };
}

/** Label for a mode id (`pick`, `<stage>-<difficulty>`, or `<stage>-<difficulty>-party-<sec>`), or '' when unknown. */
export function spotModeLabel(mode) {
  if (mode === SPOT_PICK_MODE) return '난이도 선택';
  const parsed = parseSpotMode(mode);
  if (!parsed) return '';
  const base = `${parsed.stage.shortKo} · ${parsed.difficulty.label}`;
  return parsed.party ? `${base} · 다같이(${parsed.memorizeSec}초)` : base;
}
