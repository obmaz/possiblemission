/** Room seed store: the one value every player in a room shares. */
import { addSeedHistory, normalizeSeed } from '../core/storage.js';

const DEFAULT_SEED = 'MISSION-1';
const listeners = new Set();
let seed = DEFAULT_SEED;

export const getSeed = () => seed;

/**
 * Normalizes and stores the seed; listeners run only when the value actually changed.
 * @returns {string} the normalized seed
 */
export function setSeed(next) {
  const normalized = normalizeSeed(next || DEFAULT_SEED);
  addSeedHistory(normalized);
  if (normalized !== seed) {
    seed = normalized;
    listeners.forEach((fn) => fn(seed));
  }
  return seed;
}

/** Subscribes to seed changes; returns the unsubscribe function. */
export function onSeedChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function randomSeed() {
  const prefixes = ['NEON', 'APEX', 'NOVA', 'PULSE', 'CREW', 'SPARK'];
  const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
  return `${prefix}-${Math.floor(100 + Math.random() * 900)}`;
}
