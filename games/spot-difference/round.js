/**
 * Round setup for 틀린그림찾기: mode parsing and the deterministic, seeded choice of pictures
 * and anomalies. Pure logic (no DOM), so tests can replay any room seed.
 */
import { pickDispersed } from '../../js/core/seed.js';
import { CAFE_IMAGES, CAFE_REGIONS } from './cafe-manifest.js';
import { CAMP_STAGE } from './camp-stage.js';
import { SPOT_STAGES, parseSpotMode, spotAsset } from './stages.js';

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
  const { stage, difficulty, party, memorizeSec, count, timeSec } = parsed;
  const stageName = stage ? stage.shortKo : '랜덤';
  const baseLabel = `${stageName} · ${difficulty.ko}`;
  return {
    stage,
    difficulty,
    party,
    memorizeSec,
    targetCount: count,
    timeLimitSec: timeSec,
    modeLabel: party ? `${baseLabel} · 다같이(${memorizeSec}초)` : baseLabel,
  };
}

/**
 * Resolves the two board images + deterministic round anomalies for a seeded run.
 * When `stageOrNull` is null (random mode), picks a stage deterministically from `rng`.
 */
export function resolveRoundData(rng, stageOrNull, targetCount, difficultyId = 'medium') {
  const stage = stageOrNull || SPOT_STAGES[Math.floor(rng() * SPOT_STAGES.length)];
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
      stage,
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
    stage,
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
