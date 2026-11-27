/**
 * Discovers mini-games from `games/registry.js`: loads every folder's manifest and stylesheet
 * up front (the lobby needs them) and imports a game's code only when it is played.
 */
import { GAME_IDS } from '../../games/registry.js';

const gamesById = new Map();

/** Appends a stylesheet and resolves once it has loaded (or failed, so the lobby never blocks). */
function loadStyle(href) {
  return new Promise((resolve) => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.addEventListener('load', resolve, { once: true });
    link.addEventListener('error', resolve, { once: true });
    document.head.appendChild(link);
  });
}

async function loadGame(id) {
  const [{ default: manifest }] = await Promise.all([
    import(`../../games/${id}/manifest.js`),
    loadStyle(new URL(`../../games/${id}/style.css`, import.meta.url).href),
  ]);
  return { ...manifest, id };
}

/**
 * Loads every registered game. A game that fails to load is skipped so one broken
 * folder cannot take the whole lobby down.
 * @returns {Promise<object[]>} manifests in registry order
 */
export async function loadGames() {
  const results = await Promise.allSettled(GAME_IDS.map(loadGame));
  results.forEach((result, i) => {
    if (result.status === 'fulfilled') gamesById.set(GAME_IDS[i], result.value);
    else console.error(`Failed to load game "${GAME_IDS[i]}":`, result.reason);
  });
  return listGames();
}

function listGames() {
  return GAME_IDS.map((id) => gamesById.get(id)).filter(Boolean);
}

export const getGame = (id) => gamesById.get(id) ?? null;

/**
 * Validates a mode id for a game, falling back to its default mode.
 * @returns {{ id: string, label: string }}
 */
export function resolveMode(game, modeId) {
  const label = game.modeLabel(modeId);
  if (label) return { id: modeId, label };
  return { id: game.defaultMode, label: game.modeLabel(game.defaultMode) };
}

/** Imports the game's code (`games/<id>/index.js`) on demand. */
export function importGameModule(id) {
  return import(`../../games/${id}/index.js`);
}
