/**
 * Round setup for 틀린그림찾기: mode parsing and the deterministic, seeded choice of pictures
 * and anomalies. Pure logic (no DOM), so tests can replay any room seed.
 */
import { pickDispersed } from '../../js/core/seed.js';
import { CAFE_IMAGES, CAFE_REGIONS } from './cafe-manifest.js';
import { CAMP_STAGE } from './camp-stage.js';
import { parseSpotMode, spotAsset } from './stages.js';

/**
 * Photo-set stages (`kind: 'photo-set'`): many near-identical illustrations plus the regions
 * where they can differ. A new generated stage is registered here and in ./stages.js.
 */
export const PHOTO_SET_STAGES = {
  cafe: {
    regions: CAFE_REGIONS,
    images: CAFE_IMAGES.map((image) => ({ ...image, src: spotAsset(image.src) })),
  },
};

/** Single-painting stages (`kind: 'photo'`) with hand-placed anomalies. */
export const PHOTO_STAGES = {
  camp: CAMP_STAGE,
};

/**
 * Parses `ctx.mode` into picture, difficulty, target count and time limit.
 * Returns null for the picker mode (or an unknown id).
 * @param {string} mode
 */
export function parseModeConfig(mode) {
  const parsed = parseSpotMode(mode);
  if (!parsed) return null;
  const { stage, difficulty } = parsed;
  return {
    stage,
    difficulty,
    targetCount: difficulty.count,
    timeLimitSec: difficulty.timeSec,
    modeLabel: `${stage.shortKo} · ${difficulty.label}`,
  };
}

/**
 * Resolves the two board images + deterministic round anomalies for a seeded run.
 * For `photo-set` stages (20 similar illustrations), picks 2 distinct images and
 * extracts only the regions where those 2 images actually differ.
 */
export function resolveRoundData(rng, stage, targetCount, difficultyId = 'normal') {
  if (stage.kind === 'photo-set') {
    const set = PHOTO_SET_STAGES[stage.id];
    const n = set.images.length;
    const idxA = Math.floor(rng() * n);
    const idxB = (idxA + 1 + Math.floor(rng() * (n - 1))) % n;
    const imgA = set.images[idxA];
    const imgB = set.images[idxB];
    const pool = set.regions.filter((_, rIdx) => imgA.states[rIdx] !== imgB.states[rIdx]);
    const anomalies = selectRoundAnomalies(rng, pool, targetCount, difficultyId);
    return {
      leftSrc: imgA.src,
      rightSrc: imgB.src,
      leftLabel: '그림 A',
      rightLabel: '그림 B',
      pool,
      anomalies,
    };
  }
  const pool = PHOTO_STAGES[stage.id].pool;
  const anomalies = selectRoundAnomalies(rng, pool, targetCount, difficultyId);
  return {
    leftSrc: PHOTO_STAGES[stage.id].imageSrc,
    rightSrc: null,
    leftLabel: '원본 그림',
    rightLabel: '변형 그림',
    pool,
    anomalies,
  };
}

/**
 * Deterministically selects `count` dispersed anomalies for a round using `rng`.
 * Easy rounds skip anomalies flagged `subtle` whenever enough obvious ones exist.
 * @param {() => number} rng
 * @param {Array<object>} pool
 * @param {number} count
 * @param {string} [difficultyId]
 */
function selectRoundAnomalies(rng, pool, count, difficultyId = 'normal') {
  const obvious = pool.filter((spot) => !spot.subtle);
  const source = difficultyId === 'easy' && obvious.length >= count ? obvious : pool;
  return pickDispersed(rng, source, count, 0.12).map((spot, idx) => ({
    ...spot,
    index: idx,
    found: false,
    foundAtMs: 0,
  }));
}
