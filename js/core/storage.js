/**
 * LocalStorage persistence layer with safe try/catch and in-memory fallback.
 * All keys are prefixed with `pm_arcade_v1_`.
 */

const PREFIX = 'pm_arcade_v1_';
const KEYS = {
  profile: `${PREFIX}profile`,
  pb: `${PREFIX}pb`,
  runs: `${PREFIX}runs`,
  seeds: `${PREFIX}seeds`,
  muted: `${PREFIX}muted`,
};

const MAX_RUNS = 200;
const MAX_SEEDS = 10;
const memoryFallback = new Map();

function readRaw(key) {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage.getItem(key);
    }
  } catch {
    // Ignore storage access errors (private browsing / sandboxed WebView)
  }
  return memoryFallback.has(key) ? memoryFallback.get(key) : null;
}

function writeRaw(key, value) {
  memoryFallback.set(key, value);
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(key, value);
    }
  } catch {
    // Ignore quota or storage restriction errors
  }
}

function readJson(key, fallback) {
  const raw = readRaw(key);
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  try {
    writeRaw(key, JSON.stringify(value));
  } catch {
    // Ignore serialization errors
  }
}

/**
 * Normalizes a room seed string to uppercase `[A-Z0-9-_]`, max 16 chars.
 * @param {string} rawSeed
 * @returns {string}
 */
export function normalizeSeed(rawSeed) {
  const cleaned = String(rawSeed ?? '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '-')
    .replace(/[^A-Z0-9-_]/g, '')
    .slice(0, 16);
  return cleaned || 'MISSION-1';
}

/**
 * @returns {{ nickname: string, team: string }}
 */
export function getProfile() {
  const data = readJson(KEYS.profile, null);
  if (!data || typeof data !== 'object') {
    return { nickname: '익명요원', team: '' };
  }
  const nickname = String(data.nickname ?? '').trim().slice(0, 12) || '익명요원';
  const team = String(data.team ?? '').trim().slice(0, 10);
  return { nickname, team };
}

/**
 * @param {{ nickname?: string, team?: string }} profile
 * @returns {{ nickname: string, team: string }}
 */
export function saveProfile({ nickname, team } = {}) {
  const current = getProfile();
  const cleanNick = nickname !== undefined
    ? (String(nickname).trim().slice(0, 12) || '익명요원')
    : current.nickname;
  const cleanTeam = team !== undefined
    ? String(team).trim().slice(0, 10)
    : current.team;
  const saved = { nickname: cleanNick, team: cleanTeam };
  writeJson(KEYS.profile, saved);
  return saved;
}

/**
 * @returns {Record<string, Record<string, object>>}
 */
function getAllPersonalBests() {
  const data = readJson(KEYS.pb, {});
  return data && typeof data === 'object' && !Array.isArray(data) ? data : {};
}

/**
 * Records a completed game run and updates personal best if beaten.
 * @param {object} runEntry
 * @returns {{ isNewRecord: boolean, personalBest: object, entry: object }}
 */
export function recordRun(runEntry) {
  const profile = getProfile();
  const timestamp = Number.isFinite(runEntry.timestamp) ? runEntry.timestamp : Date.now();
  const entry = {
    gameId: String(runEntry.gameId || ''),
    mode: String(runEntry.mode || 'standard'),
    modeLabel: String(runEntry.modeLabel || runEntry.mode || ''),
    seed: normalizeSeed(runEntry.seed),
    nickname: String(runEntry.nickname || profile.nickname).trim().slice(0, 12) || '익명요원',
    team: String(runEntry.team ?? profile.team).trim().slice(0, 10),
    score: Math.max(0, Math.round(Number(runEntry.score) || 0)),
    timeMs: Math.max(0, Math.round(Number(runEntry.timeMs) || 0)),
    accuracy: Math.max(0, Math.min(100, Math.round(Number(runEntry.accuracy) || 0))),
    grade: String(runEntry.grade || 'C'),
    cleared: runEntry.cleared !== false,
    timestamp,
  };

  // Append to runs list (capped at latest 200)
  const existingRuns = readJson(KEYS.runs, []);
  const runs = Array.isArray(existingRuns) ? existingRuns : [];
  runs.unshift(entry);
  if (runs.length > MAX_RUNS) {
    runs.length = MAX_RUNS;
  }
  writeJson(KEYS.runs, runs);

  // Update Personal Best per gameId + mode
  const allPb = getAllPersonalBests();
  if (!allPb[entry.gameId] || typeof allPb[entry.gameId] !== 'object') {
    allPb[entry.gameId] = {};
  }
  const prev = allPb[entry.gameId][entry.mode] || null;
  // Only cleared runs can own a personal best, so a failed attempt never shows up
  // as "BEST 0 (C)" in the lobby or as a misleading NEW RECORD! banner.
  const isNewRecord =
    entry.cleared &&
    (!prev ||
      prev.cleared === false ||
      entry.score > prev.score ||
      (entry.score === prev.score && entry.timeMs < prev.timeMs));

  let personalBest = prev;
  if (isNewRecord) {
    personalBest = {
      score: entry.score,
      timeMs: entry.timeMs,
      accuracy: entry.accuracy,
      grade: entry.grade,
      seed: entry.seed,
      cleared: true,
      updatedAt: timestamp,
    };
    allPb[entry.gameId][entry.mode] = personalBest;
    writeJson(KEYS.pb, allPb);
  }

  return { isNewRecord, personalBest, entry };
}

/**
 * @returns {string[]}
 */
export function getSeedHistory() {
  const raw = readJson(KEYS.seeds, []);
  if (!Array.isArray(raw)) return [];
  return raw
    .map((entry) => (typeof entry === 'string' ? entry : entry?.seed))
    .filter(Boolean);
}

/**
 * @param {string} seed
 * @returns {string[]}
 */
export function addSeedHistory(seed) {
  const clean = normalizeSeed(seed);
  const raw = readJson(KEYS.seeds, []);
  const list = Array.isArray(raw) ? raw : [];
  const filtered = list.filter((entry) => {
    const val = typeof entry === 'string' ? entry : entry?.seed;
    return val && val !== clean;
  });
  filtered.unshift({ seed: clean, lastUsedAt: Date.now() });
  if (filtered.length > MAX_SEEDS) {
    filtered.length = MAX_SEEDS;
  }
  writeJson(KEYS.seeds, filtered);
  return filtered.map((e) => e.seed);
}

/**
 * @returns {boolean}
 */
export function getMuted() {
  return readRaw(KEYS.muted) === '1';
}

/**
 * @param {boolean} muted
 */
export function setMutedFlag(muted) {
  writeRaw(KEYS.muted, muted ? '1' : '0');
}

/**
 * Small per-device preferences (e.g. the last 숫자 숨바꼭질 settings).
 * @param {string} key
 * @param {string} [fallback='']
 * @returns {string}
 */
export function getPref(key, fallback = '') {
  const value = readRaw(`${PREFIX}pref_${key}`);
  return value === null ? fallback : value;
}

/**
 * @param {string} key
 * @param {string} value
 */
export function setPref(key, value) {
  writeRaw(`${PREFIX}pref_${key}`, String(value));
}
