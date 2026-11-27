/**
 * POSSIBLE MISSION — app bootstrap.
 * Wires the lobby, the game runner and the shared game chrome, and keeps the address bar
 * (`?seed=&game=&mode=`) and the browser Back button in sync with what is on screen.
 */
import * as ui from './core/ui.js';
import { createGameView } from './shell/game-view.js';
import { initFullscreen } from './shell/fullscreen.js';
import { createLobby } from './shell/lobby.js';
import { getGame, loadGames, resolveMode } from './shell/registry.js';
import { getSeed, onSeedChange, setSeed } from './shell/room.js';
import { createRunner } from './shell/runner.js';
import { syncMuteButtons, toggleMute } from './shell/sound.js';

const lobbyView = document.getElementById('lobby-view');
const gameView = document.getElementById('game-view');

/** The game currently on screen (null in the lobby). */
let current = null;
let ignoreNextPopState = false;

/* === URL & history === */

/**
 * Mirrors the screen into the address bar. `push` adds a history entry (lobby → game) so the
 * browser Back button returns to the lobby instead of leaving the site.
 */
function syncUrl({ game, mode, push = false } = {}) {
  try {
    const url = new URL(window.location.href);
    url.searchParams.set('seed', getSeed());
    if (game) {
      url.searchParams.set('game', game);
      url.searchParams.set('mode', mode);
    } else {
      url.searchParams.delete('game');
      url.searchParams.delete('mode');
    }
    const next = `${url.pathname}${url.search}${url.hash}`;
    window.history[push ? 'pushState' : 'replaceState']({ pushedByApp: push }, '', next);
  } catch {
    // Sandboxed frames can forbid the History API
  }
}

function handlePopState() {
  if (ignoreNextPopState) {
    ignoreNextPopState = false;
    syncUrl();
    return;
  }
  // Browser Back/Forward while playing behaves exactly like the "로비로" button
  if (current) {
    exitToLobby({ fromHistory: true });
    return;
  }
  const params = new URLSearchParams(window.location.search);
  setSeed(params.get('seed') || getSeed());
  // Forward into an old game entry from the lobby: games only start from the lobby,
  // so rewrite the entry to match the screen (a reload must not deep-link into a game)
  if (params.has('game')) syncUrl();
}

/* === Shell === */

const runner = createRunner({
  view: gameView,
  stage: document.getElementById('game-stage'),
  hooks: {
    onEnter: (entry) => {
      view.enter({ title: getGame(entry.id).title, modeLabel: entry.modeLabel, seed: getSeed() });
    },
    onMounted: (entry) => {
      if (entry.idle) view.hidePause();
    },
    onPauseChange: (paused) => view.setPaused(paused),
    onFinish: () => view.hidePause(),
    onRelaunch: (gameId, mode) => launchGame(getGame(gameId), mode),
    onExit: () => exitToLobby(),
  },
});

const view = createGameView({
  view: gameView,
  runner,
  onExit: () => exitToLobby(),
  onRestart: () => {
    if (!current) return;
    ui.showToast(`#${getSeed()} 시드로 미션을 다시 시작합니다!`, 'info', 1600);
    launchGame(current.game, current.mode);
  },
  onToggleMute: toggleMute,
});

async function launchGame(game, requestedMode) {
  if (!game) {
    ui.showToast('존재하지 않는 게임입니다.', 'error');
    return;
  }
  const { id: mode } = resolveMode(game, requestedMode);
  // Retrying / switching difficulty reuses the history entry; entering from the lobby pushes one
  syncUrl({ game: game.id, mode, push: !current });
  current = { game, mode };
  lobbyView.hidden = true;
  await runner.launch(game, mode, getSeed());
}

function exitToLobby({ fromHistory = false } = {}) {
  ui.closeModal(true);
  runner.unmount();
  view.leave();
  current = null;
  lobbyView.hidden = false;

  // Walk back over the entry pushed at game start so Back never skips the lobby
  if (!fromHistory && window.history.state?.pushedByApp) {
    ignoreNextPopState = true;
    window.history.back();
  } else {
    syncUrl();
  }
}

/* === Bootstrap === */

async function init() {
  const params = new URLSearchParams(window.location.search);
  setSeed(params.get('seed') || undefined);
  initFullscreen();

  const games = await loadGames();
  createLobby({
    mounts: {
      hero: document.getElementById('hero-banner'),
      workshop: document.getElementById('workshop-bar'),
      grid: document.getElementById('game-grid'),
    },
    games,
    onLaunch: (game) => launchGame(game, game.defaultMode),
  });
  syncMuteButtons();

  onSeedChange(() => {
    if (!current) syncUrl();
  });
  window.addEventListener('popstate', handlePopState);

  // Deep link (?seed=TEST&game=memory-match&mode=4x4): put the lobby underneath, then push the game on top
  syncUrl();
  const linked = getGame(params.get('game'));
  if (linked) launchGame(linked, params.get('mode') || linked.defaultMode);
}

init();
