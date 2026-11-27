/**
 * Entry for a game's own page (`games/<id>/index.html`): runs that one game without the lobby.
 * URL: `?seed=ROOM-1&mode=<mode id>` (both optional). Leaving the game returns to the arcade lobby.
 */
import { initFullscreen } from './shell/fullscreen.js';
import { createRunner } from './shell/runner.js';
import { getSeed, setSeed } from './shell/room.js';

const id = document.body.dataset.game;
const { default: manifest } = await import(`../games/${id}/manifest.js`);
const game = { ...manifest, id };

const params = new URLSearchParams(window.location.search);
setSeed(params.get('seed') || undefined);
initFullscreen();

function syncUrl(mode) {
  const url = new URL(window.location.href);
  url.searchParams.set('seed', getSeed());
  url.searchParams.set('mode', mode);
  window.history.replaceState(null, '', url);
}

function launch(mode) {
  syncUrl(mode);
  return runner.launch(game, mode, getSeed());
}

const runner = createRunner({
  view: document.getElementById('game-view'),
  stage: document.getElementById('game-stage'),
  hooks: {
    onRelaunch: (_gameId, mode) => launch(mode),
    onExit: () => {
      window.location.href = new URL(`../../?seed=${encodeURIComponent(getSeed())}`, window.location.href).href;
    },
  },
});

launch(params.get('mode') || game.defaultMode);
