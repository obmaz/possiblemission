/**
 * Deterministic PRNG utilities (FNV-1a 32-bit hash + Mulberry32).
 * Ensures identical seed strings produce identical sequences across all devices.
 */

/**
 * 32-bit FNV-1a string hash.
 * @param {string} str
 * @returns {number} Unsigned 32-bit integer
 */
function hashSeed(str) {
  const input = String(str ?? '');
  let hash = 0x811c9dc5; // 2166136261
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193); // 16777619
  }
  return hash >>> 0;
}

/**
 * Creates a deterministic Mulberry32 PRNG function returning [0, 1).
 * @param {string} seedString
 * @returns {() => number}
 */
export function createRng(seedString) {
  let state = hashSeed(seedString || 'MISSION-1');
  if (state === 0) state = 0x6d2b79f5;
  return function nextRandom() {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Returns a new Fisher-Yates shuffled shallow copy of `arr` using `rng`.
 * Does not mutate `arr`.
 * @template T
 * @param {() => number} rng
 * @param {readonly T[]} arr
 * @returns {T[]}
 */
export function shuffleSeeded(rng, arr) {
  const copy = Array.from(arr);
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = copy[i];
    copy[i] = copy[j];
    copy[j] = tmp;
  }
  return copy;
}

/**
 * Picks `count` unique items from `arr` deterministically using `rng`.
 * If `count >= arr.length`, returns a seeded shuffle of all items.
 * @template T
 * @param {() => number} rng
 * @param {readonly T[]} arr
 * @param {number} count
 * @returns {T[]}
 */
export function pickSeeded(rng, arr, count) {
  const safeCount = Math.max(0, Math.floor(count));
  const shuffled = shuffleSeeded(rng, arr);
  if (safeCount >= shuffled.length) {
    return shuffled;
  }
  return shuffled.slice(0, safeCount);
}

/**
 * Picks `count` spatially dispersed items with normalized coordinates `{ x, y }`,
 * covering all 4 quadrants first and enforcing minimum center distance `minDist`.
 * @template {{ x: number, y: number }} T
 * @param {() => number} rng
 * @param {readonly T[]} pool
 * @param {number} count
 * @param {number} [minDist=0.12]
 * @returns {T[]}
 */
export function pickDispersed(rng, pool, count, minDist = 0.12) {
  const safeCount = Math.max(0, Math.min(Math.floor(count), pool.length));
  if (safeCount === 0) return [];

  const shuffled = shuffleSeeded(rng, pool);
  const picked = [];
  const pickedSet = new Set();
  const minDistSq = minDist * minDist;

  const isFarEnough = (cand) => {
    for (const item of picked) {
      const dx = cand.x - item.x;
      const dy = cand.y - item.y;
      if (dx * dx + dy * dy < minDistSq) return false;
    }
    return true;
  };

  const getQuadrant = (item) => (item.x >= 0.5 ? 1 : 0) + (item.y >= 0.5 ? 2 : 0);

  // Pass 1: Cover each of the 4 quadrants first
  const seenQuadrants = new Set();
  for (const cand of shuffled) {
    if (picked.length >= safeCount) break;
    const q = getQuadrant(cand);
    if (!seenQuadrants.has(q) && isFarEnough(cand)) {
      seenQuadrants.add(q);
      picked.push(cand);
      pickedSet.add(cand);
    }
  }

  // Pass 2: Fill remaining slots respecting minDist
  for (const cand of shuffled) {
    if (picked.length >= safeCount) break;
    if (!pickedSet.has(cand) && isFarEnough(cand)) {
      picked.push(cand);
      pickedSet.add(cand);
    }
  }

  // Pass 3: Fallback if pool density cannot satisfy minDist for all requested items
  for (const cand of shuffled) {
    if (picked.length >= safeCount) break;
    if (!pickedSet.has(cand)) {
      picked.push(cand);
      pickedSet.add(cand);
    }
  }

  return picked;
}
