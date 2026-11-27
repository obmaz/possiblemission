/**
 * LocalStorage persistence with an in-memory fallback (private browsing, sandboxed WebViews).
 * Keys are prefixed with `pm_arcade_v1_`.
 */

const PREFIX = 'pm_arcade_v1_';
const KEYS = {
  profile: `${PREFIX}profile`,
  bests: `${PREFIX}pb`,
  seeds: `${PREFIX}seeds`,
  muted: `${PREFIX}muted`,
};

const MAX_SEEDS = 10;
const DEFAULT_SEED = 'MISSION-1';
const DEFAULT_NICKNAME = '익명요원';
const NICKNAME_MAX = 12;
const TEAM_MAX = 10;

const memoryFallback = new Map();

function readRaw(key) {
  try {
    const value = window.localStorage.getItem(key);
    if (value !== null) return value;
  } catch {
    // Storage can be blocked entirely
  }
  return memoryFallback.get(key) ?? null;
}

function writeRaw(key, value) {
  memoryFallback.set(key, value);
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Quota exceeded or storage blocked: the in-memory copy still serves this session
  }
}

function readJson(key, fallback) {
  try {
    return JSON.parse(readRaw(key)) ?? fallback;
  } catch {
    return fallback;
  }
}

const writeJson = (key, value) => writeRaw(key, JSON.stringify(value));

const plainObject = (value) => (value && typeof value === 'object' && !Array.isArray(value) ? value : {});

/** Normalizes a room seed to uppercase `[A-Z0-9-_]`, at most 16 characters. */
export function normalizeSeed(rawSeed) {
  const cleaned = String(rawSeed ?? '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '-')
    .replace(/[^A-Z0-9-_]/g, '')
    .slice(0, 16);
  return cleaned || DEFAULT_SEED;
}

/** @returns {{ nickname: string, team: string }} */
export function getProfile() {
  const data = plainObject(readJson(KEYS.profile, null));
  return {
    nickname: String(data.nickname ?? '').trim().slice(0, NICKNAME_MAX) || DEFAULT_NICKNAME,
    team: String(data.team ?? '').trim().slice(0, TEAM_MAX),
  };
}

/** Saves the fields that are given and returns the resulting profile. */
export function saveProfile({ nickname, team } = {}) {
  const current = getProfile();
  const saved = {
    nickname: nickname === undefined ? current.nickname : String(nickname).trim().slice(0, NICKNAME_MAX) || DEFAULT_NICKNAME,
    team: team === undefined ? current.team : String(team).trim().slice(0, TEAM_MAX),
  };
  writeJson(KEYS.profile, saved);
  return saved;
}

/**
 * Records a finished run and keeps the personal best per game + mode. Only cleared runs can
 * set a best (a failed attempt never shows a "new record"); a tie is broken by the faster time.
 * @param {{ gameId: string, mode: string, score: number, timeMs: number, cleared: boolean }} run
 * @returns {{ isNewRecord: boolean }}
 */
export function recordRun({ gameId, mode, score, timeMs, cleared }) {
  const bests = plainObject(readJson(KEYS.bests, {}));
  const forGame = plainObject(bests[gameId]);
  const prev = forGame[mode];
  const isNewRecord = Boolean(cleared) && (!prev || score > prev.score || (score === prev.score && timeMs < prev.timeMs));
  if (isNewRecord) {
    bests[gameId] = { ...forGame, [mode]: { score, timeMs } };
    writeJson(KEYS.bests, bests);
  }
  return { isNewRecord };
}

/** Recently used room seeds, newest first. */
export function getSeedHistory() {
  const raw = readJson(KEYS.seeds, []);
  return Array.isArray(raw) ? raw.filter((seed) => typeof seed === 'string') : [];
}

export function addSeedHistory(seed) {
  const clean = normalizeSeed(seed);
  const others = getSeedHistory().filter((s) => s !== clean);
  writeJson(KEYS.seeds, [clean, ...others].slice(0, MAX_SEEDS));
}

export const getMuted = () => readRaw(KEYS.muted) === '1';

export const setMutedFlag = (muted) => writeRaw(KEYS.muted, muted ? '1' : '0');

/** Small per-device preference (e.g. the last difficulty chosen in a game). */
export const getPref = (key, fallback = '') => readRaw(`${PREFIX}pref_${key}`) ?? fallback;

export const setPref = (key, value) => writeRaw(`${PREFIX}pref_${key}`, String(value));
