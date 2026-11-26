/**
 * Lightweight registry of 틀린그림찾기 pictures and difficulties.
 * Shared by the lobby (mode list, labels) and the game (picker, parsing) without
 * pulling in the heavy drawing code.
 *
 * Mode ids: `${stageId}-${difficultyId}` (e.g. `cafe-normal`), plus `pick`, which
 * opens the in-game picture → difficulty chooser.
 */

export const SPOT_PICK_MODE = 'pick';

export const SPOT_STAGES = [
  { id: 'cafe', titleKo: '보드게임 디저트 카페', shortKo: '카페', thumb: './assets/images/spot-cafe.jpg', kind: 'photo-set' },
  { id: 'camp', titleKo: '황혼의 모험 캠프', shortKo: '캠프', thumb: './assets/images/spot-camp.jpg', kind: 'photo' },
];

export const SPOT_DIFFICULTIES = [
  { id: 'easy', label: '쉬움', count: 5, timeSec: 90, note: '큼직한 차이 위주' },
  { id: 'normal', label: '보통', count: 7, timeSec: 80, note: '기본 난이도' },
  { id: 'hard', label: '어려움', count: 9, timeSec: 75, note: '작고 미묘한 차이 포함' },
];

export const spotModeId = (stageId, difficultyId) => `${stageId}-${difficultyId}`;

/** Parses a mode id into its stage + difficulty, or null for `pick` / unknown ids. */
export function parseSpotMode(mode) {
  const raw = String(mode || '');
  const dash = raw.lastIndexOf('-');
  if (dash < 0) return null;
  const stage = SPOT_STAGES.find((s) => s.id === raw.slice(0, dash));
  const difficulty = SPOT_DIFFICULTIES.find((d) => d.id === raw.slice(dash + 1));
  return stage && difficulty ? { stage, difficulty } : null;
}

/** Catalog modes for the lobby: the picker first, then every picture × difficulty. */
export function spotCatalogModes() {
  return [
    { id: SPOT_PICK_MODE, label: '난이도 선택', thumb: SPOT_STAGES[0].thumb },
    ...SPOT_STAGES.flatMap((stage) =>
      SPOT_DIFFICULTIES.map((d) => ({
        id: spotModeId(stage.id, d.id),
        label: `${stage.shortKo} · ${d.label}`,
        thumb: stage.thumb,
      }))
    ),
  ];
}
